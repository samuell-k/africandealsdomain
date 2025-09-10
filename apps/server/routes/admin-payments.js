const express = require('express');
const router = express.Router();
const pool = require('../db');
// Use the exported isAdmin middleware and alias it locally as verifyAdmin
const { authenticateToken, isAdmin: verifyAdmin } = require('../middleware/auth');

// GET ALL WITHDRAWAL REQUESTS
router.get('/withdrawals', authenticateToken, verifyAdmin, async (req, res) => {
  try {
    const { status = 'all', page = 1, limit = 20, agent_type = 'all' } = req.query;
    const offset = (page - 1) * limit;

    let statusFilter = '';
    let agentTypeFilter = '';
    let queryParams = [];

    if (status !== 'all') {
      statusFilter = 'WHERE aw.status = ?';
      queryParams.push(status);
    }

    if (agent_type !== 'all') {
      const typeCondition = agent_type === 'PDA' ? "a.agent_type = 'pickup_delivery'" : "a.agent_type = 'fast_delivery'";
      agentTypeFilter = statusFilter ? `AND ${typeCondition}` : `WHERE ${typeCondition}`;
    }

    const [withdrawals] = await pool.query(`
      SELECT 
        aw.*,
        u.name as agent_name,
        u.email as agent_email,
        u.phone as agent_phone,
        a.agent_type,
        a.trust_level,
        admin_u.name as processed_by_name,
        -- Calculate agent's total earnings
        (SELECT SUM(CASE WHEN o.status IN ('COMPLETED', 'COLLECTED_BY_BUYER') THEN 
          CASE 
            WHEN o.agent_commission > 0 THEN o.agent_commission
            ELSE (o.total_amount - (o.total_amount / 1.21)) * 
              CASE WHEN o.marketplace_type = 'physical' THEN 0.70 ELSE 0.50 END
          END
        ELSE 0 END) 
        FROM orders o WHERE o.agent_id = aw.agent_id) as total_earnings,
        -- Calculate total withdrawn
        (SELECT COALESCE(SUM(amount), 0) 
         FROM agent_withdrawals 
         WHERE agent_id = aw.agent_id AND status = 'completed') as total_withdrawn
      FROM agent_withdrawals aw
      JOIN agents a ON aw.agent_id = a.id
      JOIN users u ON aw.user_id = u.id
      LEFT JOIN users admin_u ON aw.processed_by = admin_u.id
      ${statusFilter} ${agentTypeFilter}
      ORDER BY aw.created_at DESC
      LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), parseInt(offset)]);

    const [countResult] = await pool.query(`
      SELECT COUNT(*) as total 
      FROM agent_withdrawals aw
      JOIN agents a ON aw.agent_id = a.id
      ${statusFilter} ${agentTypeFilter}
    `, queryParams);

    // Get summary statistics
    const [summary] = await pool.query(`
      SELECT 
        COUNT(*) as total_requests,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_requests,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing_requests,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_requests,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_requests,
        SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_amount,
        SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as paid_amount
      FROM agent_withdrawals
    `);

    res.json({
      success: true,
      withdrawals,
      summary: summary[0],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / limit)
      }
    });

  } catch (error) {
    console.error('[Admin] Get withdrawals error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch withdrawal requests' 
    });
  }
});

// GET BUYER PAYMENT REQUESTS (MANUAL PAYMENTS)
router.get('/buyer-payments/pending', authenticateToken, verifyAdmin, async (req, res) => {
  try {
    const { status = 'pending', limit = 100 } = req.query;
    
    // Get buyer payment proofs from multiple sources
    let whereClause = 'WHERE 1=1';
    let queryParams = [];
    
    if (status && status !== 'all') {
      whereClause += ' AND pp.status = ?';
      queryParams.push(status);
    }
    
    // Get from payment_proofs table
    const [paymentProofs] = await pool.query(`
      SELECT 
        pp.id,
        pp.order_id,
        'MANUAL_PAYMENT' as approval_type,
        pp.status,
        pp.screenshot_path as payment_proof,
        pp.amount,
        pp.user_id as requested_by,
        pp.created_at,
        pp.updated_at,
        o.order_number,
        o.total_amount,
        o.delivery_method,
        o.payment_proof as o_payment_proof,
        requester.first_name as requester_first_name,
        requester.last_name as requester_last_name,
        requester.username as requester_username,
        requester.email as requester_email,
        requester.phone as requester_phone,
        buyer.first_name as buyer_first_name,
        buyer.last_name as buyer_last_name,
        buyer.phone as buyer_phone,
        seller.first_name as seller_first_name,
        seller.last_name as seller_last_name,
        seller.phone as seller_phone
      FROM payment_proofs pp
      LEFT JOIN orders o ON pp.order_id = o.id
      LEFT JOIN users requester ON pp.user_id = requester.id
      LEFT JOIN users buyer ON o.user_id = buyer.id
      LEFT JOIN users seller ON o.seller_id = seller.id
      ${whereClause}
      ORDER BY pp.created_at DESC
      LIMIT ?
    `, [...queryParams, parseInt(limit)]);
    
    // Also get from admin_approvals table
    let adminWhereClause = 'WHERE aa.approval_type = "MANUAL_PAYMENT"';
    let adminQueryParams = [];
    
    if (status && status !== 'all') {
      adminWhereClause += ' AND aa.status = ?';
      adminQueryParams.push(status);
    }
    
    const [adminApprovals] = await pool.query(`
      SELECT 
        aa.id,
        aa.order_id,
        aa.approval_type,
        aa.status,
        NULL as payment_proof,
        NULL as amount,
        aa.requested_by,
        aa.created_at,
        aa.updated_at,
        o.order_number,
        o.total_amount,
        o.delivery_method,
        o.payment_proof as o_payment_proof,
        requester.first_name as requester_first_name,
        requester.last_name as requester_last_name,
        requester.username as requester_username,
        requester.email as requester_email,
        requester.phone as requester_phone,
        buyer.first_name as buyer_first_name,
        buyer.last_name as buyer_last_name,
        buyer.phone as buyer_phone,
        seller.first_name as seller_first_name,
        seller.last_name as seller_last_name,
        seller.phone as seller_phone
      FROM admin_approvals aa
      LEFT JOIN orders o ON aa.order_id = o.id
      LEFT JOIN users requester ON aa.requested_by = requester.id
      LEFT JOIN users buyer ON o.user_id = buyer.id
      LEFT JOIN users seller ON o.seller_id = seller.id
      ${adminWhereClause}
      ORDER BY aa.created_at DESC
      LIMIT ?
    `, [...adminQueryParams, parseInt(limit)]);
    
    // Prioritize payment_proofs table data since it has the actual payment proof images
    // Only include admin_approvals if there's no corresponding payment_proof entry
    const paymentProofOrderIds = new Set(paymentProofs.map(p => p.order_id).filter(id => id));
    const filteredAdminApprovals = adminApprovals.filter(a => !paymentProofOrderIds.has(a.order_id));
    
    // Combine results, prioritizing payment_proofs
    const combined = [...paymentProofs, ...filteredAdminApprovals];
    
    const processedPayments = combined.map(payment => {
      const requesterName = `${payment.requester_first_name || ''} ${payment.requester_last_name || ''}`.trim() || 
                           payment.requester_username || 'Unknown';
      const buyerName = `${payment.buyer_first_name || ''} ${payment.buyer_last_name || ''}`.trim() || 'Unknown';
      const sellerName = `${payment.seller_first_name || ''} ${payment.seller_last_name || ''}`.trim() || 'Unknown';
      
      // Normalize payment proof URL - prioritize screenshot_path from payment_proofs table
      let paymentProofUrl = null;
      const rawProof = payment.screenshot_path || payment.payment_proof || payment.o_payment_proof;
      if (rawProof) {
        if (rawProof.startsWith('http')) {
          paymentProofUrl = rawProof;
        } else if (rawProof.startsWith('/uploads')) {
          paymentProofUrl = rawProof;
        } else if (rawProof.includes('/')) {
          paymentProofUrl = rawProof; // Already has path
        } else {
          paymentProofUrl = `/uploads/payment-proofs/${rawProof}`;
        }
      }
      
      return {
        ...payment,
        requester_name: requesterName,
        buyer_name: buyerName,
        seller_name: sellerName,
        payment_proof_url: paymentProofUrl,
        amount: payment.amount || payment.total_amount || 0,
        approval_type: payment.approval_type || 'MANUAL_PAYMENT' // Ensure all have approval_type
      };
    });
    
    // Sort by created_at (no need to remove duplicates since we already filtered)
    const uniquePayments = processedPayments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    res.json({
      success: true,
      message: 'Buyer payment requests retrieved successfully',
      payments: uniquePayments.slice(0, parseInt(limit)),
      total: uniquePayments.length
    });
    
  } catch (error) {
    console.error('[Admin] Get buyer payments error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch buyer payment requests' 
    });
  }
});

// APPROVE BUYER PAYMENT REQUEST
router.post('/buyer-payments/:id/approve', authenticateToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { review_notes, notes } = req.body;
    const adminId = req.user.id;
    
    // First try to find in payment_proofs table
    const [paymentProof] = await pool.query('SELECT * FROM payment_proofs WHERE id = ?', [id]);
    
    if (paymentProof.length > 0) {
      // Update payment_proofs table
      await pool.query(`
        UPDATE payment_proofs 
        SET status = 'approved', 
            admin_notes = ?,
            reviewed_by = ?,
            reviewed_at = NOW(),
            updated_at = NOW()
        WHERE id = ?
      `, [review_notes || notes || 'Approved by admin', adminId, id]);
      
      // Update order status - move from pending to paid when payment is approved
      const orderUpdateResult = await pool.query(`
        UPDATE orders 
        SET payment_status = 'paid',
            status = CASE 
                WHEN status IN ('pending', 'payment_submitted', '') THEN 'PROCESSING'
                WHEN status IS NULL THEN 'PROCESSING'
                WHEN status = 'cancelled' THEN 'PROCESSING'
                ELSE status 
            END,
            updated_at = NOW()
        WHERE id = ?
      `, [paymentProof[0].order_id]);
      
      console.log(`[Admin] Updated order ${paymentProof[0].order_id} after payment approval:`, orderUpdateResult[0]);
      
      // 🎯 PROCESS REFERRAL COMMISSIONS: Mark referral commissions as paid when order is approved
      try {
        const orderId = paymentProof[0].order_id;
        
        // Check if this order has referral commissions
        const [referralEarnings] = await pool.query(`
          SELECT ae.id, ae.amount, ae.agent_id, u.name as agent_name
          FROM agent_earnings ae
          JOIN users u ON ae.agent_id = u.id
          WHERE ae.order_id = ? AND ae.earnings_type = 'referral' AND ae.status = 'pending'
        `, [orderId]);
        
        if (referralEarnings.length > 0) {
          // Mark referral earnings as paid
          await pool.query(`
            UPDATE agent_earnings 
            SET status = 'paid', paid_at = NOW()
            WHERE order_id = ? AND earnings_type = 'referral' AND status = 'pending'
          `, [orderId]);
          
          // Update referral purchases status
          await pool.query(`
            UPDATE referral_purchases 
            SET status = 'paid'
            WHERE order_id = ? AND status = 'pending'
          `, [orderId]);
          
          console.log(`🎯 [REFERRAL] Processed ${referralEarnings.length} referral commissions for order ${orderId}:`, 
            referralEarnings.map(e => `${e.agent_name}: ${e.amount} RWF`));
        }
      } catch (referralError) {
        console.error(`⚠️ [REFERRAL] Failed to process referral commissions for order ${paymentProof[0].order_id}:`, referralError);
        // Don't fail the payment approval if referral processing fails
      }
      
      // Also update admin_approvals if exists
      await pool.query(`
        UPDATE admin_approvals 
        SET status = 'approved',
            review_notes = ?,
            reviewed_by = ?,
            reviewed_at = NOW(),
            updated_at = NOW()
        WHERE order_id = ? AND approval_type = 'MANUAL_PAYMENT'
      `, [review_notes || notes || 'Approved by admin', adminId, paymentProof[0].order_id]);
      
    } else {
      // Try admin_approvals table
      const [adminApproval] = await pool.query('SELECT * FROM admin_approvals WHERE id = ? AND approval_type = "MANUAL_PAYMENT"', [id]);
      
      if (adminApproval.length === 0) {
        return res.status(404).json({ success: false, error: 'Payment request not found' });
      }
      
      // Update admin_approvals table
      await pool.query(`
        UPDATE admin_approvals 
        SET status = 'approved',
            review_notes = ?,
            reviewed_by = ?,
            reviewed_at = NOW(),
            updated_at = NOW()
        WHERE id = ?
      `, [review_notes || notes || 'Approved by admin', adminId, id]);
      
      // Update order status - move from pending to paid when payment is approved
      const orderUpdateResult2 = await pool.query(`
        UPDATE orders 
        SET payment_status = 'paid',
            status = CASE 
                WHEN status IN ('pending', 'payment_submitted', '') THEN 'PROCESSING'
                WHEN status IS NULL THEN 'PROCESSING'
                WHEN status = 'cancelled' THEN 'PROCESSING'
                ELSE status 
            END,
            updated_at = NOW()
        WHERE id = ?
      `, [adminApproval[0].order_id]);
      
      console.log(`[Admin] Updated order ${adminApproval[0].order_id} after admin approval:`, orderUpdateResult2[0]);
      
      // 🎯 PROCESS REFERRAL COMMISSIONS: Mark referral commissions as paid when order is approved
      try {
        const orderId = adminApproval[0].order_id;
        
        // Check if this order has referral commissions
        const [referralEarnings] = await pool.query(`
          SELECT ae.id, ae.amount, ae.agent_id, u.name as agent_name
          FROM agent_earnings ae
          JOIN users u ON ae.agent_id = u.id
          WHERE ae.order_id = ? AND ae.earnings_type = 'referral' AND ae.status = 'pending'
        `, [orderId]);
        
        if (referralEarnings.length > 0) {
          // Mark referral earnings as paid
          await pool.query(`
            UPDATE agent_earnings 
            SET status = 'paid', paid_at = NOW()
            WHERE order_id = ? AND earnings_type = 'referral' AND status = 'pending'
          `, [orderId]);
          
          // Update referral purchases status
          await pool.query(`
            UPDATE referral_purchases 
            SET status = 'paid'
            WHERE order_id = ? AND status = 'pending'
          `, [orderId]);
          
          console.log(`🎯 [REFERRAL] Processed ${referralEarnings.length} referral commissions for order ${orderId}:`, 
            referralEarnings.map(e => `${e.agent_name}: ${e.amount} RWF`));
        }
      } catch (referralError) {
        console.error(`⚠️ [REFERRAL] Failed to process referral commissions for order ${adminApproval[0].order_id}:`, referralError);
        // Don't fail the payment approval if referral processing fails
      }
    }
    
    // Log admin activity
    await pool.query(`
      INSERT INTO admin_activity_logs (admin_id, action, details, created_at)
      VALUES (?, 'APPROVE_BUYER_PAYMENT', ?, NOW())
    `, [adminId, `Approved buyer payment request #${id}`]);
    
    res.json({
      success: true,
      message: 'Buyer payment request approved successfully'
    });
    
  } catch (error) {
    console.error('[Admin] Approve buyer payment error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to approve buyer payment request' 
    });
  }
});

// REJECT BUYER PAYMENT REQUEST
router.post('/buyer-payments/:id/reject', authenticateToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { review_notes, notes, rejection_reason } = req.body;
    const adminId = req.user.id;
    const reason = rejection_reason || review_notes || notes || 'Rejected by admin';
    
    // First try to find in payment_proofs table
    const [paymentProof] = await pool.query('SELECT * FROM payment_proofs WHERE id = ?', [id]);
    
    if (paymentProof.length > 0) {
      // Update payment_proofs table
      await pool.query(`
        UPDATE payment_proofs 
        SET status = 'rejected', 
            admin_notes = ?,
            reviewed_by = ?,
            reviewed_at = NOW(),
            updated_at = NOW()
        WHERE id = ?
      `, [reason, adminId, id]);
      
      // Update order status - reject payment but keep order available for re-payment
      const rejectUpdateResult = await pool.query(`
        UPDATE orders 
        SET payment_status = 'pending',
            status = CASE 
                WHEN status IN ('payment_submitted', 'confirmed', 'PROCESSING') THEN 'PENDING'
                WHEN status IS NULL THEN 'PENDING'
                ELSE status 
            END,
            updated_at = NOW()
        WHERE id = ?
      `, [paymentProof[0].order_id]);
      
      console.log(`[Admin] Updated order ${paymentProof[0].order_id} after payment rejection:`, rejectUpdateResult[0]);
      
      // Also update admin_approvals if exists
      await pool.query(`
        UPDATE admin_approvals 
        SET status = 'rejected',
            review_notes = ?,
            reviewed_by = ?,
            reviewed_at = NOW(),
            updated_at = NOW()
        WHERE order_id = ? AND approval_type = 'MANUAL_PAYMENT'
      `, [reason, adminId, paymentProof[0].order_id]);
      
    } else {
      // Try admin_approvals table
      const [adminApproval] = await pool.query('SELECT * FROM admin_approvals WHERE id = ? AND approval_type = "MANUAL_PAYMENT"', [id]);
      
      if (adminApproval.length === 0) {
        return res.status(404).json({ success: false, error: 'Payment request not found' });
      }
      
      // Update admin_approvals table
      await pool.query(`
        UPDATE admin_approvals 
        SET status = 'rejected',
            review_notes = ?,
            reviewed_by = ?,
            reviewed_at = NOW(),
            updated_at = NOW()
        WHERE id = ?
      `, [reason, adminId, id]);
      
      // Update order status - reject payment but keep order available for re-payment
      const rejectUpdateResult2 = await pool.query(`
        UPDATE orders 
        SET payment_status = 'pending',
            status = CASE 
                WHEN status IN ('payment_submitted', 'confirmed', 'PROCESSING') THEN 'PENDING'
                WHEN status IS NULL THEN 'PENDING'
                ELSE status 
            END,
            updated_at = NOW()
        WHERE id = ?
      `, [adminApproval[0].order_id]);
      
      console.log(`[Admin] Updated order ${adminApproval[0].order_id} after admin approval rejection:`, rejectUpdateResult2[0]);
    }
    
    // Log admin activity
    await pool.query(`
      INSERT INTO admin_activity_logs (admin_id, action, details, created_at)
      VALUES (?, 'REJECT_BUYER_PAYMENT', ?, NOW())
    `, [adminId, `Rejected buyer payment request #${id}: ${reason}`]);
    
    res.json({
      success: true,
      message: 'Buyer payment request rejected successfully'
    });
    
  } catch (error) {
    console.error('[Admin] Reject buyer payment error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to reject buyer payment request' 
    });
  }
});

// GET SINGLE WITHDRAWAL REQUEST
router.get('/withdrawals/:id', authenticateToken, verifyAdmin, async (req, res) => {
  try {
    const withdrawalId = req.params.id;

    const [withdrawals] = await pool.query(`
      SELECT 
        aw.*,
        u.name as agent_name,
        u.email as agent_email,
        u.phone as agent_phone,
        a.agent_type,
        a.trust_level,
        a.location,
        admin_u.name as processed_by_name
      FROM agent_withdrawals aw
      JOIN agents a ON aw.agent_id = a.id
      JOIN users u ON aw.user_id = u.id
      LEFT JOIN users admin_u ON aw.processed_by = admin_u.id
      WHERE aw.id = ?
    `, [withdrawalId]);

    if (withdrawals.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Withdrawal request not found' 
      });
    }

    const withdrawal = withdrawals[0];

    // Get agent's earnings and withdrawal history
    const [agentStats] = await pool.query(`
      SELECT 
        -- Total earnings
        (SELECT SUM(CASE WHEN o.status IN ('COMPLETED', 'COLLECTED_BY_BUYER') THEN 
          CASE 
            WHEN o.agent_commission > 0 THEN o.agent_commission
            ELSE (o.total_amount - (o.total_amount / 1.21)) * 
              CASE WHEN o.marketplace_type = 'physical' THEN 0.70 ELSE 0.50 END
          END
        ELSE 0 END) 
        FROM orders o WHERE o.agent_id = ?) as total_earnings,
        -- Total withdrawn
        (SELECT COALESCE(SUM(amount), 0) 
         FROM agent_withdrawals 
         WHERE agent_id = ? AND status = 'completed') as total_withdrawn,
        -- Pending withdrawals
        (SELECT COALESCE(SUM(amount), 0) 
         FROM agent_withdrawals 
         WHERE agent_id = ? AND status IN ('pending', 'processing') AND id != ?) as pending_withdrawals,
        -- Completed orders count
        (SELECT COUNT(*) 
         FROM orders 
         WHERE agent_id = ? AND status IN ('COMPLETED', 'COLLECTED_BY_BUYER')) as completed_orders
    `, [withdrawal.agent_id, withdrawal.agent_id, withdrawal.agent_id, withdrawalId, withdrawal.agent_id]);

    const stats = agentStats[0];
    const availableBalance = (stats.total_earnings || 0) - (stats.total_withdrawn || 0) - (stats.pending_withdrawals || 0);

    // Get recent withdrawal history
    const [recentWithdrawals] = await pool.query(`
      SELECT * FROM agent_withdrawals 
      WHERE agent_id = ? AND id != ?
      ORDER BY created_at DESC 
      LIMIT 5
    `, [withdrawal.agent_id, withdrawalId]);

    res.json({
      success: true,
      withdrawal,
      agent_stats: {
        ...stats,
        available_balance: Math.max(0, availableBalance)
      },
      recent_withdrawals: recentWithdrawals
    });

  } catch (error) {
    console.error('[Admin] Get withdrawal details error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch withdrawal details' 
    });
  }
});

// APPROVE WITHDRAWAL
router.post('/withdrawals/:id/approve', authenticateToken, verifyAdmin, async (req, res) => {
  try {
    const withdrawalId = req.params.id;
    const adminId = req.user.id || req.user.userId;
    const { admin_notes, payment_reference } = req.body;

    // Get withdrawal details
    const [withdrawals] = await pool.query(`
      SELECT aw.*, u.name as agent_name, u.phone as agent_phone
      FROM agent_withdrawals aw
      JOIN users u ON aw.user_id = u.id
      WHERE aw.id = ? AND aw.status = 'pending'
    `, [withdrawalId]);

    if (withdrawals.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Withdrawal request not found or already processed' 
      });
    }

    const withdrawal = withdrawals[0];

    // Update withdrawal status to completed
    await pool.execute(`
      UPDATE agent_withdrawals 
      SET status = 'completed', 
          admin_notes = ?, 
          processed_by = ?, 
          processed_at = NOW(),
          updated_at = NOW()
      WHERE id = ?
    `, [
      `${admin_notes || 'Payment approved and processed'} ${payment_reference ? `| Ref: ${payment_reference}` : ''}`,
      adminId, 
      withdrawalId
    ]);

    // Create notification for agent
    await pool.execute(`
      INSERT INTO notifications 
      (user_id, title, message, type, created_at)
      VALUES (?, 'Withdrawal Approved', ?, 'payment', NOW())
    `, [
      withdrawal.user_id,
      `Your withdrawal request of ${withdrawal.amount.toLocaleString()} FRW has been approved and processed. ${payment_reference ? `Reference: ${payment_reference}` : ''}`
    ]);

    // Log the approval
    console.log(`[Admin] Withdrawal approved: ID ${withdrawalId}, Agent: ${withdrawal.agent_name}, Amount: ${withdrawal.amount} FRW`);

    res.json({
      success: true,
      message: 'Withdrawal request approved and payment processed',
      withdrawal_id: withdrawalId,
      status: 'completed'
    });

  } catch (error) {
    console.error('[Admin] Approve withdrawal error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to approve withdrawal request' 
    });
  }
});

// REJECT WITHDRAWAL
router.post('/withdrawals/:id/reject', authenticateToken, verifyAdmin, async (req, res) => {
  try {
    const withdrawalId = req.params.id;
    const adminId = req.user.id || req.user.userId;
    const { admin_notes, rejection_reason } = req.body;

    if (!rejection_reason) {
      return res.status(400).json({ 
        success: false, 
        error: 'Rejection reason is required' 
      });
    }

    // Get withdrawal details
    const [withdrawals] = await pool.query(`
      SELECT aw.*, u.name as agent_name
      FROM agent_withdrawals aw
      JOIN users u ON aw.user_id = u.id
      WHERE aw.id = ? AND aw.status = 'pending'
    `, [withdrawalId]);

    if (withdrawals.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Withdrawal request not found or already processed' 
      });
    }

    const withdrawal = withdrawals[0];

    // Update withdrawal status to rejected
    await pool.execute(`
      UPDATE agent_withdrawals 
      SET status = 'rejected', 
          admin_notes = ?, 
          processed_by = ?, 
          processed_at = NOW(),
          updated_at = NOW()
      WHERE id = ?
    `, [
      `Rejected: ${rejection_reason}. ${admin_notes || ''}`,
      adminId, 
      withdrawalId
    ]);

    // Create notification for agent
    await pool.execute(`
      INSERT INTO notifications 
      (user_id, title, message, type, created_at)
      VALUES (?, 'Withdrawal Rejected', ?, 'payment', NOW())
    `, [
      withdrawal.user_id,
      `Your withdrawal request of ${withdrawal.amount.toLocaleString()} FRW has been rejected. Reason: ${rejection_reason}`
    ]);

    // Log the rejection
    console.log(`[Admin] Withdrawal rejected: ID ${withdrawalId}, Agent: ${withdrawal.agent_name}, Reason: ${rejection_reason}`);

    res.json({
      success: true,
      message: 'Withdrawal request rejected',
      withdrawal_id: withdrawalId,
      status: 'rejected'
    });

  } catch (error) {
    console.error('[Admin] Reject withdrawal error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to reject withdrawal request' 
    });
  }
});

// BULK APPROVE WITHDRAWALS
router.post('/withdrawals/bulk-approve', authenticateToken, verifyAdmin, async (req, res) => {
  try {
    const { withdrawal_ids, admin_notes, payment_reference } = req.body;
    const adminId = req.user.id || req.user.userId;

    if (!withdrawal_ids || !Array.isArray(withdrawal_ids) || withdrawal_ids.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Withdrawal IDs are required' 
      });
    }

    const placeholders = withdrawal_ids.map(() => '?').join(',');
    
    // Get withdrawal details
    const [withdrawals] = await pool.query(`
      SELECT aw.*, u.name as agent_name
      FROM agent_withdrawals aw
      JOIN users u ON aw.user_id = u.id
      WHERE aw.id IN (${placeholders}) AND aw.status = 'pending'
    `, withdrawal_ids);

    if (withdrawals.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'No pending withdrawal requests found' 
      });
    }

    // Update all withdrawals
    await pool.execute(`
      UPDATE agent_withdrawals 
      SET status = 'completed', 
          admin_notes = ?, 
          processed_by = ?, 
          processed_at = NOW(),
          updated_at = NOW()
      WHERE id IN (${placeholders}) AND status = 'pending'
    `, [
      `Bulk approval: ${admin_notes || 'Payment approved and processed'} ${payment_reference ? `| Ref: ${payment_reference}` : ''}`,
      adminId,
      ...withdrawal_ids
    ]);

    // Create notifications for all agents
    for (const withdrawal of withdrawals) {
      await pool.execute(`
        INSERT INTO notifications 
        (user_id, title, message, type, created_at)
        VALUES (?, 'Withdrawal Approved', ?, 'payment', NOW())
      `, [
        withdrawal.user_id,
        `Your withdrawal request of ${withdrawal.amount.toLocaleString()} FRW has been approved and processed. ${payment_reference ? `Reference: ${payment_reference}` : ''}`
      ]);
    }

    const totalAmount = withdrawals.reduce((sum, w) => sum + parseFloat(w.amount), 0);
    console.log(`[Admin] Bulk withdrawal approval: ${withdrawals.length} requests, Total: ${totalAmount} FRW`);

    res.json({
      success: true,
      message: `${withdrawals.length} withdrawal requests approved successfully`,
      processed_count: withdrawals.length,
      total_amount: totalAmount
    });

  } catch (error) {
    console.error('[Admin] Bulk approve withdrawals error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process bulk approval' 
    });
  }
});

// ===== BUYER PAYMENT APPROVAL ENDPOINTS =====

// GET PENDING BUYER PAYMENT APPROVALS
router.get('/buyer-payments/pending', authenticateToken, verifyAdmin, async (req, res) => {
  try {
    const { status = 'awaiting_approval', page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let statusFilter = '';
    let queryParams = [];

    if (status !== 'all') {
      statusFilter = 'WHERE o.payment_status = ?';
      queryParams.push(status);
    }

    const [payments] = await pool.query(`
      SELECT 
        o.id,
        o.order_number,
        o.total_amount,
        o.payment_status,
        o.payment_proof,
        o.payment_method,
        o.created_at,
        o.updated_at,
        -- Buyer Information
        u.name as buyer_name,
        u.email as buyer_email,
        u.phone as buyer_phone,
        -- Order Items Summary
        GROUP_CONCAT(
          CONCAT(oi.product_name, ' (', oi.quantity, 'x)')
          SEPARATOR ', '
        ) as order_items,
        COUNT(oi.id) as item_count,
        -- Seller Information
        seller.name as seller_name,
        seller.email as seller_email
      FROM orders o
      JOIN users u ON o.user_id = u.id
      LEFT JOIN users seller ON o.seller_id = seller.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      ${statusFilter}
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), parseInt(offset)]);

    // Get total count
    const [countResult] = await pool.query(`
      SELECT COUNT(DISTINCT o.id) as total
      FROM orders o
      ${statusFilter}
    `, queryParams);

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      payments: payments.map(payment => ({
        ...payment,
        payment_proof_url: payment.payment_proof ? `/uploads/payment-proofs/${payment.payment_proof}` : null,
        type: 'MANUAL_PAYMENT'
      })),
      pagination: {
        current_page: parseInt(page),
        total_pages: totalPages,
        total_items: total,
        items_per_page: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('[Admin] Get buyer payments error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch buyer payment approvals' 
    });
  }
});

// APPROVE BUYER PAYMENT
router.post('/buyer-payments/:orderId/approve', authenticateToken, verifyAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { review_notes } = req.body;
    const adminId = req.user.id || req.user.userId;

    // Get order details
    const [orders] = await pool.query(`
      SELECT o.*, u.name as buyer_name, u.email as buyer_email
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.id = ? AND o.payment_status = 'awaiting_approval'
    `, [orderId]);

    if (orders.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Order not found or not awaiting approval' 
      });
    }

    const order = orders[0];

    // Update payment status to approved
    await pool.execute(`
      UPDATE orders 
      SET payment_status = 'paid',
          status = 'processing',
          admin_review_notes = ?,
          reviewed_by = ?,
          reviewed_at = NOW(),
          updated_at = NOW()
      WHERE id = ?
    `, [
      review_notes || 'Payment approved by admin',
      adminId,
      orderId
    ]);

    // Create notification for buyer
    await pool.execute(`
      INSERT INTO notifications 
      (user_id, title, message, type, created_at)
      VALUES (?, 'Payment Approved', ?, 'payment', NOW())
    `, [
      order.user_id,
      `Your payment for order ${order.order_number} has been approved. Your order is now being processed.`
    ]);

    // Log the approval
    console.log(`[Admin] Payment approved: Order ${order.order_number}, Buyer: ${order.buyer_name}, Amount: ${order.total_amount}`);

    res.json({
      success: true,
      message: 'Payment approved successfully',
      order_id: orderId,
      status: 'approved'
    });

  } catch (error) {
    console.error('[Admin] Approve payment error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to approve payment' 
    });
  }
});

// REJECT BUYER PAYMENT
router.post('/buyer-payments/:orderId/reject', authenticateToken, verifyAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { rejection_reason, review_notes } = req.body;
    const adminId = req.user.id || req.user.userId;

    if (!rejection_reason) {
      return res.status(400).json({ 
        success: false, 
        error: 'Rejection reason is required' 
      });
    }

    // Get order details
    const [orders] = await pool.query(`
      SELECT o.*, u.name as buyer_name, u.email as buyer_email
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.id = ? AND o.payment_status = 'awaiting_approval'
    `, [orderId]);

    if (orders.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Order not found or not awaiting approval' 
      });
    }

    const order = orders[0];

    // Update payment status to rejected
    await pool.execute(`
      UPDATE orders 
      SET payment_status = 'rejected',
          status = 'cancelled',
          rejection_reason = ?,
          admin_review_notes = ?,
          reviewed_by = ?,
          reviewed_at = NOW(),
          updated_at = NOW()
      WHERE id = ?
    `, [
      rejection_reason,
      review_notes || `Payment rejected: ${rejection_reason}`,
      adminId,
      orderId
    ]);

    // Create notification for buyer
    await pool.execute(`
      INSERT INTO notifications 
      (user_id, title, message, type, created_at)
      VALUES (?, 'Payment Rejected', ?, 'payment', NOW())
    `, [
      order.user_id,
      `Your payment for order ${order.order_number} has been rejected. Reason: ${rejection_reason}. Please contact support or resubmit payment proof.`
    ]);

    // Log the rejection
    console.log(`[Admin] Payment rejected: Order ${order.order_number}, Buyer: ${order.buyer_name}, Reason: ${rejection_reason}`);

    res.json({
      success: true,
      message: 'Payment rejected',
      order_id: orderId,
      status: 'rejected'
    });

  } catch (error) {
    console.error('[Admin] Reject payment error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to reject payment' 
    });
  }
});

// ===== REFERRAL WITHDRAWAL MANAGEMENT =====

// GET REFERRAL WITHDRAWAL REQUESTS
router.get('/referral-withdrawals', authenticateToken, verifyAdmin, async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let statusFilter = '';
    let queryParams = [];

    if (status !== 'all') {
      statusFilter = 'WHERE rw.status = ?';
      queryParams.push(status);
    }

    queryParams.push(parseInt(limit), parseInt(offset));

    const [withdrawals] = await pool.query(`
      SELECT 
        rw.id,
        rw.amount,
        rw.payment_method,
        rw.payment_details,
        rw.notes,
        rw.status,
        rw.admin_notes,
        rw.created_at,
        rw.processed_at,
        u.name as user_name,
        u.email as user_email,
        u.phone as user_phone,
        admin.name as processed_by_name,
        -- Referral earnings summary
        (SELECT COALESCE(SUM(ae.amount), 0) 
         FROM agent_earnings ae 
         WHERE ae.agent_id = u.id AND ae.earnings_type = 'referral' AND ae.status = 'paid') as total_referral_earnings,
        (SELECT COUNT(*) 
         FROM referral_withdrawals rw2 
         WHERE rw2.user_id = u.id AND rw2.status = 'completed') as previous_withdrawals
      FROM referral_withdrawals rw
      JOIN users u ON rw.user_id = u.id
      LEFT JOIN users admin ON rw.processed_by = admin.id
      ${statusFilter}
      ORDER BY rw.created_at DESC
      LIMIT ? OFFSET ?
    `, queryParams);

    // Get total count
    const countParams = status !== 'all' ? [status] : [];
    const [countResult] = await pool.query(`
      SELECT COUNT(*) as total
      FROM referral_withdrawals rw
      ${statusFilter}
    `, countParams);

    // Format the results
    const formattedWithdrawals = withdrawals.map(withdrawal => ({
      ...withdrawal,
      payment_details: withdrawal.payment_details ? JSON.parse(withdrawal.payment_details) : null,
      amount_formatted: new Intl.NumberFormat('en-US').format(withdrawal.amount),
      status_badge: {
        pending: { color: 'yellow', text: 'Pending Review' },
        processing: { color: 'blue', text: 'Processing' },
        completed: { color: 'green', text: 'Completed' },
        rejected: { color: 'red', text: 'Rejected' }
      }[withdrawal.status] || { color: 'gray', text: withdrawal.status }
    }));

    res.json({
      success: true,
      withdrawals: formattedWithdrawals,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(countResult[0].total / limit),
        total_records: countResult[0].total,
        per_page: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('[Admin] Referral withdrawals fetch error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch referral withdrawal requests' 
    });
  }
});

// PROCESS REFERRAL WITHDRAWAL REQUEST
router.post('/referral-withdrawals/:id/process', authenticateToken, verifyAdmin, async (req, res) => {
  try {
    const withdrawalId = req.params.id;
    const { action, admin_notes } = req.body; // action: 'approve' or 'reject'
    const adminId = req.user.id;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid action. Must be "approve" or "reject"' 
      });
    }

    // Get withdrawal details
    const [withdrawals] = await pool.query(`
      SELECT rw.*, u.name as user_name, u.email as user_email
      FROM referral_withdrawals rw
      JOIN users u ON rw.user_id = u.id
      WHERE rw.id = ? AND rw.status = 'pending'
    `, [withdrawalId]);

    if (withdrawals.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Withdrawal request not found or already processed' 
      });
    }

    const withdrawal = withdrawals[0];
    const newStatus = action === 'approve' ? 'completed' : 'rejected';

    // Update withdrawal status
    await pool.query(`
      UPDATE referral_withdrawals 
      SET status = ?, admin_notes = ?, processed_by = ?, processed_at = NOW()
      WHERE id = ?
    `, [newStatus, admin_notes || null, adminId, withdrawalId]);

    console.log(`[Admin] Referral withdrawal ${withdrawalId} ${action}ed by admin ${adminId}`);

    res.json({
      success: true,
      message: `Referral withdrawal request ${action}ed successfully`,
      withdrawal_id: withdrawalId,
      status: newStatus,
      user_name: withdrawal.user_name,
      amount: withdrawal.amount
    });

  } catch (error) {
    console.error('[Admin] Process referral withdrawal error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process referral withdrawal request' 
    });
  }
});

// ===== WALLET WITHDRAWAL MANAGEMENT =====

// GET WALLET WITHDRAWAL REQUESTS
router.get('/wallet-withdrawals', authenticateToken, verifyAdmin, async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let statusFilter = '';
    let queryParams = [];

    if (status !== 'all') {
      statusFilter = 'WHERE ww.status = ?';
      queryParams.push(status);
    }

    queryParams.push(parseInt(limit), parseInt(offset));

    const [withdrawals] = await pool.query(`
      SELECT 
        ww.id,
        ww.amount,
        ww.payment_method,
        ww.payment_details,
        ww.notes,
        ww.status,
        ww.admin_notes,
        ww.created_at,
        ww.processed_at,
        u.name as user_name,
        u.email as user_email,
        u.phone as user_phone,
        u.wallet_balance as current_wallet_balance,
        admin.name as processed_by_name,
        -- Wallet transaction summary
        (SELECT COUNT(*) 
         FROM wallet_withdrawals ww2 
         WHERE ww2.user_id = u.id AND ww2.status = 'completed') as previous_withdrawals
      FROM wallet_withdrawals ww
      JOIN users u ON ww.user_id = u.id
      LEFT JOIN users admin ON ww.processed_by = admin.id
      ${statusFilter}
      ORDER BY ww.created_at DESC
      LIMIT ? OFFSET ?
    `, queryParams);

    // Get total count
    const countParams = status !== 'all' ? [status] : [];
    const [countResult] = await pool.query(`
      SELECT COUNT(*) as total
      FROM wallet_withdrawals ww
      ${statusFilter}
    `, countParams);

    // Format the results
    const formattedWithdrawals = withdrawals.map(withdrawal => ({
      ...withdrawal,
      payment_details: withdrawal.payment_details ? JSON.parse(withdrawal.payment_details) : null,
      amount_formatted: new Intl.NumberFormat('en-US').format(withdrawal.amount),
      current_wallet_balance_formatted: new Intl.NumberFormat('en-US').format(withdrawal.current_wallet_balance || 0),
      status_badge: {
        pending: { color: 'yellow', text: 'Pending Review' },
        processing: { color: 'blue', text: 'Processing' },
        completed: { color: 'green', text: 'Completed' },
        rejected: { color: 'red', text: 'Rejected' }
      }[withdrawal.status] || { color: 'gray', text: withdrawal.status }
    }));

    res.json({
      success: true,
      withdrawals: formattedWithdrawals,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(countResult[0].total / limit),
        total_records: countResult[0].total,
        per_page: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('[Admin] Wallet withdrawals fetch error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch wallet withdrawal requests' 
    });
  }
});

// PROCESS WALLET WITHDRAWAL REQUEST
router.post('/wallet-withdrawals/:id/process', authenticateToken, verifyAdmin, async (req, res) => {
  try {
    const withdrawalId = req.params.id;
    const { action, admin_notes } = req.body; // action: 'approve' or 'reject'
    const adminId = req.user.id;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid action. Must be "approve" or "reject"' 
      });
    }

    // Get withdrawal details
    const [withdrawals] = await pool.query(`
      SELECT ww.*, u.name as user_name, u.email as user_email, u.wallet_balance
      FROM wallet_withdrawals ww
      JOIN users u ON ww.user_id = u.id
      WHERE ww.id = ? AND ww.status = 'pending'
    `, [withdrawalId]);

    if (withdrawals.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Withdrawal request not found or already processed' 
      });
    }

    const withdrawal = withdrawals[0];
    const newStatus = action === 'approve' ? 'completed' : 'rejected';

    // If approving, deduct from user's wallet balance
    if (action === 'approve') {
      const currentBalance = parseFloat(withdrawal.wallet_balance) || 0;
      const withdrawAmount = parseFloat(withdrawal.amount);

      if (currentBalance < withdrawAmount) {
        return res.status(400).json({
          success: false,
          error: `Insufficient wallet balance. Current: ${currentBalance.toLocaleString()} RWF, Requested: ${withdrawAmount.toLocaleString()} RWF`
        });
      }

      // Deduct from wallet balance
      await pool.query(`
        UPDATE users 
        SET wallet_balance = wallet_balance - ?
        WHERE id = ?
      `, [withdrawAmount, withdrawal.user_id]);

      // Record wallet transaction
      await pool.query(`
        INSERT INTO wallet_transactions (
          user_id, type, amount, description, reference_id, created_at
        ) VALUES (?, 'debit', ?, ?, ?, NOW())
      `, [
        withdrawal.user_id,
        withdrawAmount,
        `Wallet withdrawal - ${withdrawal.payment_method}`,
        `withdrawal_${withdrawalId}`
      ]);
    }

    // Update withdrawal status
    await pool.query(`
      UPDATE wallet_withdrawals 
      SET status = ?, admin_notes = ?, processed_by = ?, processed_at = NOW()
      WHERE id = ?
    `, [newStatus, admin_notes || null, adminId, withdrawalId]);

    console.log(`[Admin] Wallet withdrawal ${withdrawalId} ${action}ed by admin ${adminId}`);

    res.json({
      success: true,
      message: `Wallet withdrawal request ${action}ed successfully`,
      withdrawal_id: withdrawalId,
      status: newStatus,
      user_name: withdrawal.user_name,
      amount: withdrawal.amount
    });

  } catch (error) {
    console.error('[Admin] Process wallet withdrawal error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process wallet withdrawal request' 
    });
  }
});

module.exports = router;