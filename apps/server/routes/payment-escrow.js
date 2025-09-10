const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Create escrow for order
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const { order_id, amount, currency = 'USD' } = req.body;

    if (!order_id || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Order ID and amount are required'
      });
    }

    // Get order details
    const [orderResult] = await db.execute(`
      SELECT o.*, a.id as agent_id
      FROM orders o
      LEFT JOIN agents a ON o.agent_id = a.id
      WHERE o.id = ? AND o.buyer_id = ?
    `, [order_id, req.user.id]);

    if (orderResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or access denied'
      });
    }

    const order = orderResult[0];

    // Check if escrow already exists
    const [existingEscrow] = await db.execute(`
      SELECT id FROM payment_escrow WHERE order_id = ?
    `, [order_id]);

    if (existingEscrow.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Escrow already exists for this order'
      });
    }

    // Check buyer's wallet balance
    const [buyerWallet] = await db.execute(`
      SELECT wallet_balance FROM users WHERE id = ?
    `, [req.user.id]);

    if (buyerWallet[0].wallet_balance < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient wallet balance'
      });
    }

    // Start transaction
    await db.execute('START TRANSACTION');

    try {
      // Create escrow entry
      const [escrowResult] = await db.execute(`
        INSERT INTO payment_escrow (
          order_id, buyer_id, seller_id, agent_id, amount, currency, 
          status, held_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'held', NOW(), NOW())
      `, [order_id, order.buyer_id, order.seller_id, order.agent_id, amount, currency]);

      const escrowId = escrowResult.insertId;

      // Deduct from buyer's wallet
      await db.execute(`
        UPDATE users 
        SET wallet_balance = wallet_balance - ?
        WHERE id = ?
      `, [amount, req.user.id]);

      // Update order with escrow info
      await db.execute(`
        UPDATE orders 
        SET payment_status = 'held', escrow_id = ?
        WHERE id = ?
      `, [escrowId, order_id]);

      // Log transaction
      await db.execute(`
        INSERT INTO payment_transactions (
          order_id, escrow_id, user_id, transaction_type, amount, currency,
          status, description, created_at
        ) VALUES (?, ?, ?, 'hold', ?, ?, 'completed', 'Payment held in escrow', NOW())
      `, [order_id, escrowId, req.user.id, amount, currency]);

      await db.execute('COMMIT');

      res.json({
        success: true,
        message: 'Payment held in escrow successfully',
        escrow_id: escrowId
      });
    } catch (error) {
      await db.execute('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error creating escrow:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create escrow'
    });
  }
});

// Release escrow payment (when buyer confirms delivery)
router.post('/release', authenticateToken, async (req, res) => {
  try {
    const { order_id, release_reason } = req.body;

    if (!order_id) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
    }

    // Get escrow details
    const [escrowResult] = await db.execute(`
      SELECT pe.*, o.status as order_status
      FROM payment_escrow pe
      JOIN orders o ON pe.order_id = o.id
      WHERE pe.order_id = ? AND pe.buyer_id = ? AND pe.status = 'held'
    `, [order_id, req.user.id]);

    if (escrowResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Escrow not found or already processed'
      });
    }

    const escrow = escrowResult[0];

    // Only allow release if order is delivered
    if (escrow.order_status !== 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'Order must be delivered before releasing payment'
      });
    }

    // Start transaction
    await db.execute('START TRANSACTION');

    try {
      // Calculate commission (1% default)
      const commissionRate = 0.01; // 1%
      const commissionAmount = escrow.amount * commissionRate;
      const sellerAmount = escrow.amount - commissionAmount;

      // Release payment to seller
      await db.execute(`
        UPDATE users 
        SET wallet_balance = wallet_balance + ?
        WHERE id = ?
      `, [sellerAmount, escrow.seller_id]);

      // Update escrow status
      await db.execute(`
        UPDATE payment_escrow 
        SET status = 'released', released_at = NOW(), release_reason = ?
        WHERE id = ?
      `, [release_reason || 'Delivery confirmed by buyer', escrow.id]);

      // Update order payment status
      await db.execute(`
        UPDATE orders 
        SET payment_status = 'released'
        WHERE id = ?
      `, [order_id]);

      // Log seller payment transaction
      await db.execute(`
        INSERT INTO payment_transactions (
          order_id, escrow_id, user_id, transaction_type, amount, currency,
          status, description, created_at
        ) VALUES (?, ?, ?, 'release', ?, ?, 'completed', 'Payment released to seller', NOW())
      `, [order_id, escrow.id, escrow.seller_id, sellerAmount, escrow.currency]);

      // Log commission transaction
      if (commissionAmount > 0) {
        await db.execute(`
          INSERT INTO payment_transactions (
            order_id, escrow_id, user_id, transaction_type, amount, currency,
            status, description, created_at
          ) VALUES (?, ?, ?, 'commission', ?, ?, 'completed', 'Platform commission', NOW())
        `, [order_id, escrow.id, escrow.seller_id, commissionAmount, escrow.currency]);
      }

      // Update agent earnings if applicable
      if (escrow.agent_id) {
        const deliveryFee = 5.00; // Default delivery fee
        await db.execute(`
          UPDATE agents 
          SET total_earnings = total_earnings + ?
          WHERE id = ?
        `, [deliveryFee, escrow.agent_id]);

        // Log agent payment
        const [agentUser] = await db.execute(`
          SELECT user_id FROM agents WHERE id = ?
        `, [escrow.agent_id]);

        if (agentUser.length > 0) {
          await db.execute(`
            UPDATE users 
            SET wallet_balance = wallet_balance + ?
            WHERE id = ?
          `, [deliveryFee, agentUser[0].user_id]);

          await db.execute(`
            INSERT INTO payment_transactions (
              order_id, escrow_id, user_id, transaction_type, amount, currency,
              status, description, created_at
            ) VALUES (?, ?, ?, 'fee', ?, ?, 'completed', 'Delivery fee', NOW())
          `, [order_id, escrow.id, agentUser[0].user_id, deliveryFee, escrow.currency]);
        }
      }

      await db.execute('COMMIT');

      res.json({
        success: true,
        message: 'Payment released successfully',
        seller_amount: sellerAmount,
        commission_amount: commissionAmount
      });
    } catch (error) {
      await db.execute('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error releasing escrow:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to release payment'
    });
  }
});

// Request refund
router.post('/refund', authenticateToken, async (req, res) => {
  try {
    const { order_id, refund_reason } = req.body;

    if (!order_id || !refund_reason) {
      return res.status(400).json({
        success: false,
        message: 'Order ID and refund reason are required'
      });
    }

    // Get escrow details
    const [escrowResult] = await db.execute(`
      SELECT pe.*, o.status as order_status
      FROM payment_escrow pe
      JOIN orders o ON pe.order_id = o.id
      WHERE pe.order_id = ? AND pe.buyer_id = ? AND pe.status = 'held'
    `, [order_id, req.user.id]);

    if (escrowResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Escrow not found or already processed'
      });
    }

    const escrow = escrowResult[0];

    // Start transaction
    await db.execute('START TRANSACTION');

    try {
      // Refund to buyer's wallet
      await db.execute(`
        UPDATE users 
        SET wallet_balance = wallet_balance + ?
        WHERE id = ?
      `, [escrow.amount, escrow.buyer_id]);

      // Update escrow status
      await db.execute(`
        UPDATE payment_escrow 
        SET status = 'refunded', refunded_at = NOW(), release_reason = ?
        WHERE id = ?
      `, [refund_reason, escrow.id]);

      // Update order payment status
      await db.execute(`
        UPDATE orders 
        SET payment_status = 'refunded', status = 'cancelled'
        WHERE id = ?
      `, [order_id]);

      // Log refund transaction
      await db.execute(`
        INSERT INTO payment_transactions (
          order_id, escrow_id, user_id, transaction_type, amount, currency,
          status, description, created_at
        ) VALUES (?, ?, ?, 'refund', ?, ?, 'completed', ?, NOW())
      `, [order_id, escrow.id, escrow.buyer_id, escrow.amount, escrow.currency, refund_reason]);

      await db.execute('COMMIT');

      res.json({
        success: true,
        message: 'Refund processed successfully',
        refund_amount: escrow.amount
      });
    } catch (error) {
      await db.execute('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error processing refund:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process refund'
    });
  }
});

// Get escrow status for order
router.get('/order/:orderId', authenticateToken, async (req, res) => {
  try {
    const orderId = req.params.orderId;

    // Verify user has access to this order
    const [orderCheck] = await db.execute(`
      SELECT o.id, o.buyer_id, o.seller_id, a.user_id as agent_user_id
      FROM orders o
      LEFT JOIN agents a ON o.agent_id = a.id
      WHERE o.id = ? AND (o.buyer_id = ? OR o.seller_id = ? OR a.user_id = ? OR ? = 'admin')
    `, [orderId, req.user.id, req.user.id, req.user.id, req.user.role]);

    if (orderCheck.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this order'
      });
    }

    // Get escrow details
    const [escrow] = await db.execute(`
      SELECT pe.*, 
             buyer.name as buyer_name,
             seller.name as seller_name,
             agent_user.name as agent_name
      FROM payment_escrow pe
      JOIN users buyer ON pe.buyer_id = buyer.id
      JOIN users seller ON pe.seller_id = seller.id
      LEFT JOIN agents a ON pe.agent_id = a.id
      LEFT JOIN users agent_user ON a.user_id = agent_user.id
      WHERE pe.order_id = ?
    `, [orderId]);

    if (escrow.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No escrow found for this order'
      });
    }

    res.json({
      success: true,
      escrow: escrow[0]
    });
  } catch (error) {
    console.error('Error fetching escrow status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch escrow status'
    });
  }
});

// Get payment transactions for user
router.get('/transactions', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, type, status } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT pt.*, o.order_number
      FROM payment_transactions pt
      LEFT JOIN orders o ON pt.order_id = o.id
      WHERE pt.user_id = ?
    `;
    const params = [req.user.id];

    if (type) {
      query += ' AND pt.transaction_type = ?';
      params.push(type);
    }

    if (status) {
      query += ' AND pt.status = ?';
      params.push(status);
    }

    // Get total count
    const countQuery = query.replace(/SELECT pt\.\*, o\.order_number/, 'SELECT COUNT(*) as total');
    const [countResult] = await db.execute(countQuery, params);
    const total = countResult[0].total;

    // Add pagination
    query += ' ORDER BY pt.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [transactions] = await db.execute(query, params);

    res.json({
      success: true,
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions'
    });
  }
});

// Get wallet balance
router.get('/wallet/balance', authenticateToken, async (req, res) => {
  try {
    const [result] = await db.execute(`
      SELECT wallet_balance, wallet_currency
      FROM users
      WHERE id = ?
    `, [req.user.id]);

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      balance: result[0].wallet_balance,
      currency: result[0].wallet_currency
    });
  } catch (error) {
    console.error('Error fetching wallet balance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wallet balance'
    });
  }
});

// Add funds to wallet (for testing purposes)
router.post('/wallet/topup', authenticateToken, async (req, res) => {
  try {
    const { amount, payment_method = 'test' } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid amount is required'
      });
    }

    // Start transaction
    await db.execute('START TRANSACTION');

    try {
      // Add to wallet
      await db.execute(`
        UPDATE users 
        SET wallet_balance = wallet_balance + ?
        WHERE id = ?
      `, [amount, req.user.id]);

      // Log transaction
      await db.execute(`
        INSERT INTO payment_transactions (
          user_id, transaction_type, amount, currency, status, payment_method,
          description, created_at
        ) VALUES (?, 'payment', ?, 'USD', 'completed', ?, 'Wallet top-up', NOW())
      `, [req.user.id, amount, payment_method]);

      await db.execute('COMMIT');

      res.json({
        success: true,
        message: 'Wallet topped up successfully',
        amount
      });
    } catch (error) {
      await db.execute('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error topping up wallet:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to top up wallet'
    });
  }
});

module.exports = router;