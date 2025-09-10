const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for payment proof uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadsDir = path.join(__dirname, '../uploads/payment-proofs');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'payment-proof-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// GET /api/payments - Get payment methods
router.get('/', async (req, res) => {
  try {
    const [paymentMethods] = await pool.execute(`
      SELECT id, name, type, description, is_active, instructions, icon
      FROM payment_methods 
      WHERE is_active = 1 
      ORDER BY sort_order ASC
    `);

    res.json({
      success: true,
      paymentMethods: paymentMethods || [
        {
          id: 1,
          name: 'Mobile Money',
          type: 'mobile_money',
          description: 'Pay using MTN Mobile Money, Airtel Money, or Tigo Cash',
          is_active: 1,
          instructions: 'Send money to the provided number and upload screenshot',
          icon: '📱'
        },
        {
          id: 2,
          name: 'Bank Transfer',
          type: 'bank_transfer',
          description: 'Direct bank transfer to our account',
          is_active: 1,
          instructions: 'Transfer to our bank account and upload receipt',
          icon: '🏦'
        },
        {
          id: 3,
          name: 'Cash on Delivery',
          type: 'cash_on_delivery',
          description: 'Pay when you receive your order',
          is_active: 1,
          instructions: 'Pay cash to the delivery agent',
          icon: '💵'
        }
      ]
    });
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment methods'
    });
  }
});

// POST /api/payments - Process payment
router.post('/', requireAuth, upload.single('payment_proof'), async (req, res) => {
  try {
    const { order_id, payment_method_id, payment_method_type, amount, currency, transaction_reference, notes } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!order_id || !payment_method_id || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Order ID, payment method, and amount are required'
      });
    }

    // Verify order exists and belongs to user
    const [orders] = await pool.execute(`
      SELECT id, total_amount, payment_status, user_id 
      FROM orders 
      WHERE id = ? AND user_id = ?
    `, [order_id, userId]);

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const order = orders[0];

    if (order.payment_status === 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Order is already paid'
      });
    }

    // Verify amount matches order total
    if (parseFloat(amount) !== parseFloat(order.total_amount)) {
      return res.status(400).json({
        success: false,
        error: 'Payment amount does not match order total'
      });
    }

    // Create payment record
    const paymentProofPath = req.file ? req.file.filename : null;
    
    const [paymentResult] = await pool.execute(`
      INSERT INTO payments (
        order_id, user_id, payment_method_id, payment_method_type, 
        amount, currency, transaction_reference, payment_proof, 
        notes, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
    `, [
      order_id, userId, payment_method_id, payment_method_type || 'manual',
      amount, currency || 'USD', transaction_reference, paymentProofPath,
      notes, 
    ]);

    // Update order payment status
    await pool.execute(`
      UPDATE orders 
      SET payment_status = 'pending_verification', payment_method = ?, updated_at = NOW()
      WHERE id = ?
    `, [payment_method_type || 'manual', order_id]);

    // Log payment action
    await pool.execute(`
      INSERT INTO payment_logs (payment_id, action, details, user_id, created_at)
      VALUES (?, 'payment_submitted', ?, ?, NOW())
    `, [
      paymentResult.insertId,
      JSON.stringify({
        order_id,
        amount,
        payment_method: payment_method_type,
        has_proof: !!paymentProofPath
      }),
      userId
    ]);

    res.json({
      success: true,
      message: 'Payment submitted successfully',
      payment: {
        id: paymentResult.insertId,
        order_id,
        amount,
        status: 'pending_verification',
        payment_method: payment_method_type
      }
    });

  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process payment'
    });
  }
});

// GET /api/payments/:id - Get payment details
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const paymentId = req.params.id;
    const userId = req.user.id;

    const [payments] = await pool.execute(`
      SELECT p.*, o.order_number, pm.name as payment_method_name
      FROM payments p
      LEFT JOIN orders o ON p.order_id = o.id
      LEFT JOIN payment_methods pm ON p.payment_method_id = pm.id
      WHERE p.id = ? AND (p.user_id = ? OR ? IN (SELECT id FROM users WHERE role = 'admin'))
    `, [paymentId, userId, userId]);

    if (payments.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    res.json({
      success: true,
      payment: payments[0]
    });

  } catch (error) {
    console.error('Error fetching payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment details'
    });
  }
});

// PUT /api/payments/:id/verify - Verify payment (Admin only)
router.put('/:id/verify', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const paymentId = req.params.id;
    const { status, admin_notes } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Status must be approved or rejected'
      });
    }

    // Get payment details
    const [payments] = await pool.execute(`
      SELECT p.*, o.id as order_id, o.user_id as buyer_id
      FROM payments p
      LEFT JOIN orders o ON p.order_id = o.id
      WHERE p.id = ?
    `, [paymentId]);

    if (payments.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    const payment = payments[0];

    // Update payment status
    await pool.execute(`
      UPDATE payments 
      SET status = ?, admin_notes = ?, verified_at = NOW(), verified_by = ?
      WHERE id = ?
    `, [status, admin_notes, req.user.id, paymentId]);

    // Update order status based on payment verification
    if (status === 'approved') {
      await pool.execute(`
        UPDATE orders 
        SET payment_status = 'completed', status = 'processing', updated_at = NOW()
        WHERE id = ?
      `, [payment.order_id]);

      // Release money to escrow for seller/agent commission calculation
      await pool.execute(`
        INSERT INTO payment_escrow (
          order_id, total_amount, seller_amount, agent_amount, platform_fee,
          status, created_at
        ) VALUES (?, ?, ?, ?, ?, 'held', NOW())
      `, [
        payment.order_id,
        payment.amount,
        payment.amount * 0.79, // 79% to seller (21% goes to agent)
        payment.amount * 0.21, // 21% to agent
        0 // No platform fee for now
      ]);

    } else if (status === 'rejected') {
      await pool.execute(`
        UPDATE orders 
        SET payment_status = 'failed', status = 'cancelled', updated_at = NOW()
        WHERE id = ?
      `, [payment.order_id]);
    }

    // Log verification action
    await pool.execute(`
      INSERT INTO payment_logs (payment_id, action, details, user_id, created_at)
      VALUES (?, 'payment_verified', ?, ?, NOW())
    `, [
      paymentId,
      JSON.stringify({
        status,
        admin_notes,
        verified_by: req.user.id
      }),
      req.user.id
    ]);

    res.json({
      success: true,
      message: `Payment ${status} successfully`,
      payment: {
        id: paymentId,
        status,
        verified_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify payment'
    });
  }
});

// GET /api/payments/order/:orderId - Get payments for an order
router.get('/order/:orderId', requireAuth, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.user.id;

    // Verify user has access to this order
    const [orders] = await pool.execute(`
      SELECT user_id FROM orders WHERE id = ?
    `, [orderId]);

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    if (orders[0].user_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const [payments] = await pool.execute(`
      SELECT p.*, pm.name as payment_method_name
      FROM payments p
      LEFT JOIN payment_methods pm ON p.payment_method_id = pm.id
      WHERE p.order_id = ?
      ORDER BY p.created_at DESC
    `, [orderId]);

    res.json({
      success: true,
      payments
    });

  } catch (error) {
    console.error('Error fetching order payments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order payments'
    });
  }
});

module.exports = router;