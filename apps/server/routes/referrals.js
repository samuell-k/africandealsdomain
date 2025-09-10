const express = require('express');
const router = express.Router();
const { requireAuth } = require('./auth');
const pool = require('../db');

// POST /api/referrals/track-generation - Track when a referral link is generated
router.post('/track-generation', requireAuth, async (req, res) => {
  try {
    const { userId, productId, platform, referralCode, generatedAt } = req.body;
    
    // Insert referral generation record
    await pool.query(`
      INSERT INTO referral_links (
        user_id, product_id, referral_code, platform, generated_at, status
      ) VALUES (?, ?, ?, ?, ?, 'active')
    `, [userId, productId, referralCode, platform, generatedAt]);
    
    res.json({ 
      success: true, 
      message: 'Referral link generation tracked successfully',
      referralCode: referralCode
    });
    
  } catch (error) {
    console.error('Error tracking referral generation:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to track referral generation' 
    });
  }
});

// POST /api/referrals/track-purchase - Track when someone makes a purchase through referral
router.post('/track-purchase', async (req, res) => {
  try {
    const { referralCode, orderId, purchaseAmount, purchasedAt } = req.body;
    
    // Find the referral link
    const [referralLinks] = await pool.query(`
      SELECT rl.*, u.name as referrer_name, u.email as referrer_email
      FROM referral_links rl
      JOIN users u ON rl.user_id = u.id
      WHERE rl.referral_code = ? AND rl.status = 'active'
    `, [referralCode]);
    
    if (referralLinks.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Referral code not found or inactive' 
      });
    }
    
    const referralLink = referralLinks[0];
    
    // Calculate commission (15% of 21% platform margin)
    const platformMargin = purchaseAmount * 0.21;
    const referralCommission = platformMargin * 0.15;
    
    // Insert referral purchase record
    await pool.query(`
      INSERT INTO referral_purchases (
        referral_link_id, order_id, purchase_amount, commission_amount, 
        purchased_at, status
      ) VALUES (?, ?, ?, ?, ?, 'pending')
    `, [referralLink.id, orderId, purchaseAmount, referralCommission, purchasedAt]);
    
    // Update referral link usage count
    await pool.query(`
      UPDATE referral_links 
      SET usage_count = usage_count + 1, last_used_at = NOW()
      WHERE id = ?
    `, [referralLink.id]);
    
    // Create commission transaction for the referrer
    await pool.query(`
      INSERT INTO commission_transactions (
        order_id, agent_id, commission_type, amount, percentage, 
        base_amount, status, created_at
      ) VALUES (?, ?, 'referral_commission', ?, 15.0, ?, 'pending', NOW())
    `, [orderId, referralLink.user_id, referralCommission, platformMargin]);
    
    // Create agent earnings record
    await pool.query(`
      INSERT INTO agent_earnings (
        agent_id, order_id, amount, earnings_type, status, created_at
      ) VALUES (?, ?, ?, 'referral', 'pending', NOW())
    `, [referralLink.user_id, orderId, referralCommission]);
    
    res.json({ 
      success: true, 
      message: 'Referral purchase tracked successfully',
      commission: referralCommission,
      referrer: {
        id: referralLink.user_id,
        name: referralLink.referrer_name
      }
    });
    
  } catch (error) {
    console.error('Error tracking referral purchase:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to track referral purchase' 
    });
  }
});

// GET /api/referrals/my-referrals - Get user's referral statistics
router.get('/my-referrals', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get referral links statistics
    const [referralStats] = await pool.query(`
      SELECT 
        COUNT(rl.id) as total_links_generated,
        SUM(rl.usage_count) as total_clicks,
        COUNT(rp.id) as total_purchases,
        SUM(rp.commission_amount) as total_commissions_earned,
        SUM(CASE WHEN rp.status = 'paid' THEN rp.commission_amount ELSE 0 END) as paid_commissions,
        SUM(CASE WHEN rp.status = 'pending' THEN rp.commission_amount ELSE 0 END) as pending_commissions
      FROM referral_links rl
      LEFT JOIN referral_purchases rp ON rl.id = rp.referral_link_id
      WHERE rl.user_id = ?
    `, [userId]);
    
    // Get recent referral activities
    const [recentActivities] = await pool.query(`
      SELECT 
        rl.referral_code,
        rl.platform,
        rl.generated_at,
        rl.usage_count,
        rp.purchase_amount,
        rp.commission_amount,
        rp.purchased_at,
        rp.status as purchase_status,
        p.name as product_name
      FROM referral_links rl
      LEFT JOIN referral_purchases rp ON rl.id = rp.referral_link_id
      LEFT JOIN products p ON rl.product_id = p.id
      WHERE rl.user_id = ?
      ORDER BY rl.generated_at DESC
      LIMIT 20
    `, [userId]);
    
    res.json({
      success: true,
      statistics: referralStats[0] || {
        total_links_generated: 0,
        total_clicks: 0,
        total_purchases: 0,
        total_commissions_earned: 0,
        paid_commissions: 0,
        pending_commissions: 0
      },
      recent_activities: recentActivities
    });
    
  } catch (error) {
    console.error('Error fetching referral statistics:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch referral statistics' 
    });
  }
});

// GET /api/referrals/earnings - Get detailed earnings breakdown
router.get('/earnings', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    // Get detailed earnings with order information
    const [earnings] = await pool.query(`
      SELECT 
        ae.id,
        ae.amount,
        ae.status,
        ae.created_at,
        ae.paid_at,
        o.order_number,
        o.total_amount as order_total,
        rp.purchase_amount,
        rl.referral_code,
        p.name as product_name,
        u.name as buyer_name
      FROM agent_earnings ae
      JOIN orders o ON ae.order_id = o.id
      JOIN referral_purchases rp ON o.id = rp.order_id
      JOIN referral_links rl ON rp.referral_link_id = rl.id
      LEFT JOIN products p ON rl.product_id = p.id
      LEFT JOIN users u ON o.user_id = u.id
      WHERE ae.agent_id = ? AND ae.earnings_type = 'referral'
      ORDER BY ae.created_at DESC
      LIMIT ? OFFSET ?
    `, [userId, parseInt(limit), parseInt(offset)]);
    
    // Get total count for pagination
    const [countResult] = await pool.query(`
      SELECT COUNT(*) as total
      FROM agent_earnings ae
      WHERE ae.agent_id = ? AND ae.earnings_type = 'referral'
    `, [userId]);
    
    res.json({
      success: true,
      earnings: earnings,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(countResult[0].total / limit),
        total_records: countResult[0].total,
        per_page: parseInt(limit)
      }
    });
    
  } catch (error) {
    console.error('Error fetching referral earnings:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch referral earnings' 
    });
  }
});

// POST /api/referrals/share-product - Generate a shareable referral link for a product
router.post('/share-product', requireAuth, async (req, res) => {
  try {
    const { product_id, platform } = req.body || {};
    if (!product_id) {
      return res.status(400).json({ success: false, error: 'product_id is required' });
    }

    const userId = req.user.id;

    // Build base URL
    const host = req.headers.host;
    const protocolHeader = req.headers['x-forwarded-proto'];
    const protocol = protocolHeader ? protocolHeader.split(',')[0] : (req.secure ? 'https' : 'http');
    const baseUrl = `${protocol}://${host}`;

    // Create referral code and share URL
    const referralCode = `REF-${userId}-${product_id}-${Date.now().toString().slice(-6)}`;
    const shareUrl = `${baseUrl}/buyer/product-detail.html?id=${encodeURIComponent(product_id)}&ref=${encodeURIComponent(referralCode)}`;

    // Persist (best effort)
    try {
      await pool.query(
        `INSERT INTO referral_links (user_id, product_id, referral_code, platform, generated_at, status, usage_count)
         VALUES (?, ?, ?, ?, NOW(), 'active', 0)`,
        [userId, product_id, platform || 'copy_link', referralCode]
      );
    } catch (dbErr) {
      console.warn('[REFERRALS] Could not insert referral_links record:', dbErr.message);
      // Continue; link can still be used without DB record
    }

    // Build platform-specific share URL
    const encodedShare = encodeURIComponent(shareUrl);
    const msg = encodeURIComponent('Check out this product on African Deals Domain!');
    let platformUrl = shareUrl;
    switch ((platform || '').toLowerCase()) {
      case 'whatsapp':
        platformUrl = `https://wa.me/?text=${msg}%20${encodedShare}`;
        break;
      case 'facebook':
        platformUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedShare}`;
        break;
      case 'twitter':
      case 'x':
        platformUrl = `https://twitter.com/intent/tweet?url=${encodedShare}&text=${msg}`;
        break;
      case 'telegram':
        platformUrl = `https://t.me/share/url?url=${encodedShare}&text=${msg}`;
        break;
      case 'linkedin':
        platformUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedShare}`;
        break;
      case 'email':
        platformUrl = `mailto:?subject=${encodeURIComponent('Great Product on ADD')}&body=${msg}%20${encodedShare}`;
        break;
      case 'copy_link':
      default:
        platformUrl = shareUrl;
    }

    return res.json({
      success: true,
      share_url: shareUrl,
      platform_url: platformUrl,
      referral_code: referralCode
    });
  } catch (error) {
    console.error('Error generating share-product link:', error);
    return res.status(500).json({ success: false, error: 'Failed to generate share link' });
  }
});

// POST /api/referrals/track-click - Increment click count for a referral link
router.post('/track-click', async (req, res) => {
  try {
    const { referral_code } = req.body || {};
    if (!referral_code) {
      return res.status(400).json({ success: false, error: 'referral_code is required' });
    }

    await pool.query(
      `UPDATE referral_links SET usage_count = usage_count + 1, last_used_at = NOW() WHERE referral_code = ?`,
      [referral_code]
    );

    return res.json({ success: true });
  } catch (error) {
    console.error('Error tracking referral click:', error);
    return res.status(500).json({ success: false, error: 'Failed to track click' });
  }
});

// POST /api/referrals/session/update - No-op session tracker (prevents 404s)
router.post('/session/update', async (req, res) => {
  try {
    // Optionally persist minimal info later
    return res.json({ success: true });
  } catch (error) {
    return res.json({ success: true });
  }
});

// GET /api/referrals/withdrawal-balance - Get user's available referral balance for withdrawal
router.get('/withdrawal-balance', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user's referral earnings summary
    const [balanceResult] = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN ae.status = 'paid' THEN ae.amount ELSE 0 END), 0) as available_balance,
        COALESCE(SUM(CASE WHEN ae.status = 'pending' THEN ae.amount ELSE 0 END), 0) as pending_balance,
        COUNT(CASE WHEN ae.status = 'paid' THEN 1 END) as completed_referrals,
        COUNT(CASE WHEN ae.status = 'pending' THEN 1 END) as pending_referrals
      FROM agent_earnings ae
      WHERE ae.agent_id = ? AND ae.earnings_type = 'referral'
    `, [userId]);
    
    // Get total withdrawn amount
    const [withdrawnResult] = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as total_withdrawn
      FROM referral_withdrawals 
      WHERE user_id = ? AND status = 'completed'
    `, [userId]);
    
    const balance = balanceResult[0];
    const totalWithdrawn = withdrawnResult[0].total_withdrawn;
    const availableForWithdrawal = Math.max(0, balance.available_balance - totalWithdrawn);
    
    // Check if user can withdraw (any amount > 0)
    const canWithdraw = availableForWithdrawal > 0;
    
    res.json({
      success: true,
      available_balance: availableForWithdrawal,
      pending_balance: balance.pending_balance,
      total_earned: balance.available_balance + balance.pending_balance,
      total_withdrawn: totalWithdrawn,
      completed_referrals: balance.completed_referrals,
      pending_referrals: balance.pending_referrals,
      can_withdraw: canWithdraw,
      minimum_withdrawal: 0,
      currency: 'RWF'
    });
    
  } catch (error) {
    console.error('Error fetching referral withdrawal balance:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch withdrawal balance' 
    });
  }
});

// GET /api/referrals/withdrawals - Get user's referral withdrawal history
router.get('/withdrawals', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    // Get withdrawal history
    const [withdrawals] = await pool.query(`
      SELECT 
        rw.id,
        rw.amount,
        rw.payment_method,
        rw.payment_details,
        rw.status,
        rw.admin_notes,
        rw.created_at,
        rw.processed_at,
        admin.name as processed_by_name
      FROM referral_withdrawals rw
      LEFT JOIN users admin ON rw.processed_by = admin.id
      WHERE rw.user_id = ?
      ORDER BY rw.created_at DESC
      LIMIT ? OFFSET ?
    `, [userId, parseInt(limit), parseInt(offset)]);
    
    // Get total count for pagination
    const [countResult] = await pool.query(`
      SELECT COUNT(*) as total
      FROM referral_withdrawals
      WHERE user_id = ?
    `, [userId]);
    
    // Format payment details for display
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
    console.error('Error fetching referral withdrawals:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch withdrawal history' 
    });
  }
});

// POST /api/referrals/request-withdrawal - Request referral earnings withdrawal
router.post('/request-withdrawal', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, payment_method, payment_details, notes } = req.body;
    
    // Validate input
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid withdrawal amount'
      });
    }
    
    if (!payment_method || !['mobile_money', 'bank_transfer'].includes(payment_method)) {
      return res.status(400).json({
        success: false,
        message: 'Valid payment method is required (mobile_money or bank_transfer)'
      });
    }
    
    if (!payment_details || !payment_details.account_number) {
      return res.status(400).json({
        success: false,
        message: 'Payment details with account number are required'
      });
    }
    
    // Check available balance
    const [balanceResult] = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN ae.status = 'paid' THEN ae.amount ELSE 0 END), 0) as available_balance
      FROM agent_earnings ae
      WHERE ae.agent_id = ? AND ae.earnings_type = 'referral'
    `, [userId]);
    
    const [withdrawnResult] = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as total_withdrawn
      FROM referral_withdrawals 
      WHERE user_id = ? AND status = 'completed'
    `, [userId]);
    
    const availableBalance = balanceResult[0].available_balance - withdrawnResult[0].total_withdrawn;
    
    if (availableBalance < amount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ${availableBalance.toLocaleString()} RWF`
      });
    }
    
    // Check for pending withdrawal requests
    const [pendingResult] = await pool.query(`
      SELECT COUNT(*) as pending_count
      FROM referral_withdrawals
      WHERE user_id = ? AND status IN ('pending', 'processing')
    `, [userId]);
    
    if (pendingResult[0].pending_count > 0) {
      return res.status(400).json({
        success: false,
        message: 'You have a pending withdrawal request. Please wait for it to be processed.'
      });
    }
    
    // Create withdrawal request
    const [result] = await pool.query(`
      INSERT INTO referral_withdrawals (
        user_id, amount, payment_method, payment_details, notes, status, created_at
      ) VALUES (?, ?, ?, ?, ?, 'pending', NOW())
    `, [
      userId, 
      amount, 
      payment_method, 
      JSON.stringify(payment_details), 
      notes || null
    ]);
    
    // Create admin notification
    try {
      await pool.query(`
        INSERT INTO admin_notifications (
          type, title, message, data, created_at
        ) VALUES (?, ?, ?, ?, NOW())
      `, [
        'referral_withdrawal_request',
        'New Referral Withdrawal Request',
        `User has requested withdrawal of ${amount.toLocaleString()} RWF from referral earnings`,
        JSON.stringify({
          withdrawal_id: result.insertId,
          user_id: userId,
          amount: amount,
          payment_method: payment_method
        })
      ]);
    } catch (notificationError) {
      console.warn('Failed to create admin notification:', notificationError);
    }
    
    res.json({
      success: true,
      message: 'Withdrawal request submitted successfully',
      withdrawal_id: result.insertId,
      amount: amount,
      status: 'pending',
      estimated_processing_time: '2-5 business days'
    });
    
  } catch (error) {
    console.error('Error creating referral withdrawal request:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create withdrawal request' 
    });
  }
});

// ========================================
// ADMIN ENDPOINTS FOR REFERRAL WITHDRAWAL MANAGEMENT
// ========================================

// GET /api/referrals/admin/pending-payments - Get all pending referral withdrawal requests for admin
router.get('/admin/pending-payments', requireAuth, async (req, res) => {
  try {
    // Verify admin access
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Admin access required' 
      });
    }

    // Get all pending referral withdrawal requests with user details
    const [pendingPayments] = await pool.query(`
      SELECT 
        rw.id,
        rw.user_id,
        rw.amount,
        rw.payment_method,
        rw.payment_details,
        rw.notes,
        rw.status,
        rw.created_at,
        rw.updated_at,
        -- User information
        u.name as user_name,
        u.email as user_email,
        u.phone as user_phone,
        -- User's referral statistics
        (SELECT COUNT(*) FROM agent_earnings ae WHERE ae.agent_id = rw.user_id AND ae.earnings_type = 'referral' AND ae.status = 'paid') as total_referrals,
        (SELECT COALESCE(SUM(ae.amount), 0) FROM agent_earnings ae WHERE ae.agent_id = rw.user_id AND ae.earnings_type = 'referral' AND ae.status = 'paid') as total_earned,
        (SELECT COALESCE(SUM(rw2.amount), 0) FROM referral_withdrawals rw2 WHERE rw2.user_id = rw.user_id AND rw2.status = 'completed') as total_withdrawn
      FROM referral_withdrawals rw
      JOIN users u ON rw.user_id = u.id
      WHERE rw.status = 'pending'
      ORDER BY rw.created_at ASC
    `);

    // Calculate total pending amount
    const totalAmount = pendingPayments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);

    res.json({
      success: true,
      pending_payments: pendingPayments,
      total_amount: totalAmount,
      count: pendingPayments.length
    });

  } catch (error) {
    console.error('Error fetching pending referral payments:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch pending payments' 
    });
  }
});

// POST /api/referrals/admin/process-payment - Process (approve/reject) referral withdrawal request
router.post('/admin/process-payment', requireAuth, async (req, res) => {
  try {
    // Verify admin access
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Admin access required' 
      });
    }

    const { withdrawal_id, action, admin_notes } = req.body;
    const adminId = req.user.id;

    if (!withdrawal_id || !action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'withdrawal_id and valid action (approve/reject) are required'
      });
    }

    // Get withdrawal request details
    const [withdrawal] = await pool.query(`
      SELECT rw.*, u.name as user_name, u.email as user_email
      FROM referral_withdrawals rw
      JOIN users u ON rw.user_id = u.id
      WHERE rw.id = ? AND rw.status = 'pending'
    `, [withdrawal_id]);

    if (withdrawal.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Withdrawal request not found or already processed'
      });
    }

    const withdrawalRequest = withdrawal[0];

    if (action === 'approve') {
      // Verify user still has sufficient balance
      const [balanceCheck] = await pool.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN ae.status = 'paid' THEN ae.amount ELSE 0 END), 0) as available_balance
        FROM agent_earnings ae
        WHERE ae.agent_id = ? AND ae.earnings_type = 'referral'
      `, [withdrawalRequest.user_id]);

      const [withdrawnAmount] = await pool.query(`
        SELECT COALESCE(SUM(amount), 0) as total_withdrawn
        FROM referral_withdrawals 
        WHERE user_id = ? AND status = 'completed'
      `, [withdrawalRequest.user_id]);

      const availableBalance = balanceCheck[0].available_balance - withdrawnAmount[0].total_withdrawn;

      if (availableBalance < withdrawalRequest.amount) {
        return res.status(400).json({
          success: false,
          error: `Insufficient balance. Available: ${availableBalance} RWF, Requested: ${withdrawalRequest.amount} RWF`
        });
      }

      // Approve withdrawal
      await pool.query(`
        UPDATE referral_withdrawals 
        SET status = 'completed', 
            admin_notes = ?,
            processed_by = ?,
            processed_at = NOW(),
            updated_at = NOW()
        WHERE id = ?
      `, [admin_notes || 'Approved by admin', adminId, withdrawal_id]);

      console.log(`✅ [ADMIN] Approved referral withdrawal #${withdrawal_id} for ${withdrawalRequest.user_name}: ${withdrawalRequest.amount} RWF`);

    } else if (action === 'reject') {
      // Reject withdrawal
      await pool.query(`
        UPDATE referral_withdrawals 
        SET status = 'rejected', 
            admin_notes = ?,
            processed_by = ?,
            processed_at = NOW(),
            updated_at = NOW()
        WHERE id = ?
      `, [admin_notes || 'Rejected by admin', adminId, withdrawal_id]);

      console.log(`❌ [ADMIN] Rejected referral withdrawal #${withdrawal_id} for ${withdrawalRequest.user_name}: ${withdrawalRequest.amount} RWF`);
    }

    // Log admin activity
    await pool.query(`
      INSERT INTO admin_activity_logs (admin_id, action, details, created_at)
      VALUES (?, ?, ?, NOW())
    `, [
      adminId, 
      `REFERRAL_WITHDRAWAL_${action.toUpperCase()}`,
      `${action === 'approve' ? 'Approved' : 'Rejected'} referral withdrawal request #${withdrawal_id} for user ${withdrawalRequest.user_name} (${withdrawalRequest.amount} RWF)`
    ]);

    res.json({
      success: true,
      message: `Withdrawal request ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      withdrawal_id: withdrawal_id,
      action: action,
      amount: withdrawalRequest.amount,
      user_name: withdrawalRequest.user_name
    });

  } catch (error) {
    console.error('Error processing referral withdrawal:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process withdrawal request' 
    });
  }
});

module.exports = router;