/**
 * Commission Management Routes
 * Handles all commission-related API endpoints for admins and agents
 */

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('./auth');
const CommissionService = require('../services/commissionService');
const pool = require('../db');

// ==================== ADMIN COMMISSION MANAGEMENT ====================

// GET /api/commission-management/rates - Get current commission rates (Admin only)
router.get('/rates', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const rates = await CommissionService.getCommissionRates();
    res.json({ success: true, rates });
  } catch (error) {
    console.error('Error fetching commission rates:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch commission rates' });
  }
});

// PUT /api/commission-management/rates - Update commission rates (Admin only)
router.put('/rates', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { rates } = req.body;
    
    // Validate rates
    const validKeys = [
      'default_platform_margin',
      'home_delivery_additional_fee',
      'system_maintenance_fee',
      'fast_delivery_agent_rate',
      'psm_helped_rate',
      'psm_received_rate',
      'pickup_delivery_agent_rate'
    ];
    
    const invalidKeys = Object.keys(rates).filter(key => !validKeys.includes(key));
    if (invalidKeys.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid rate keys: ${invalidKeys.join(', ')}`
      });
    }
    
    // Validate rate values (must be positive numbers)
    for (const [key, value] of Object.entries(rates)) {
      const numValue = parseFloat(value);
      if (isNaN(numValue) || numValue < 0 || numValue > 100) {
        return res.status(400).json({
          success: false,
          message: `Invalid rate value for ${key}: must be between 0 and 100`
        });
      }
    }
    
    const result = await CommissionService.updateCommissionRates(rates, req.user.id);
    res.json(result);
  } catch (error) {
    console.error('Error updating commission rates:', error);
    res.status(500).json({ success: false, message: 'Failed to update commission rates' });
  }
});

// GET /api/commission-management/analytics - Get commission analytics (Admin only)
router.get('/analytics', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    // Default to last 30 days if no dates provided
    const startDate = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = end_date || new Date().toISOString().split('T')[0];
    
    const analytics = await CommissionService.getCommissionAnalytics(startDate, endDate);
    
    // Get summary statistics
    const [summary] = await pool.query(`
      SELECT 
        COUNT(DISTINCT o.id) as total_orders,
        SUM(o.total_amount) as total_revenue,
        SUM(oc.commission_amount) as total_commissions,
        COUNT(DISTINCT oc.agent_id) as active_agents
      FROM orders o
      LEFT JOIN order_commissions oc ON o.id = oc.order_id
      WHERE o.created_at BETWEEN ? AND ?
    `, [startDate, endDate]);
    
    res.json({
      success: true,
      analytics,
      summary: summary[0],
      dateRange: { startDate, endDate }
    });
  } catch (error) {
    console.error('Error fetching commission analytics:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch analytics' });
  }
});

// GET /api/commission-management/orders/:orderId/commissions - Get order commission breakdown
router.get('/orders/:orderId/commissions', requireAuth, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // Check if user has permission to view this order
    const [orderCheck] = await pool.query(`
      SELECT o.id, o.user_id, o.seller_id 
      FROM orders o 
      WHERE o.id = ?
    `, [orderId]);
    
    if (orderCheck.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    const order = orderCheck[0];
    
    // Only allow admin, buyer, or seller to view commissions
    if (req.user.role !== 'admin' && 
        req.user.id !== order.user_id && 
        req.user.id !== order.seller_id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    const commissions = await CommissionService.getOrderCommissions(orderId);
    
    // Hide sensitive commission details from non-admin users
    if (req.user.role !== 'admin') {
      commissions.forEach(commission => {
        delete commission.commission_percentage;
        delete commission.commission_amount;
        delete commission.agent_id;
        delete commission.agent_name;
        delete commission.agent_email;
      });
    }
    
    res.json({ success: true, commissions });
  } catch (error) {
    console.error('Error fetching order commissions:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch commission data' });
  }
});

// ==================== AGENT EARNINGS MANAGEMENT ====================

// GET /api/commission-management/agent/earnings - Get agent earnings (Agent only)
router.get('/agent/earnings', requireAuth, requireRole('agent'), async (req, res) => {
  try {
    const earnings = await CommissionService.getAgentEarnings(req.user.id);
    
    // Get detailed commission history
    const [commissionHistory] = await pool.query(`
      SELECT 
        oc.id,
        oc.order_id,
        oc.commission_type,
        oc.commission_amount,
        oc.status,
        oc.payment_date,
        oc.created_at,
        o.order_number,
        o.total_amount as order_total
      FROM order_commissions oc
      JOIN orders o ON oc.order_id = o.id
      WHERE oc.agent_id = ?
      ORDER BY oc.created_at DESC
      LIMIT 50
    `, [req.user.id]);
    
    res.json({
      success: true,
      earnings,
      commissionHistory
    });
  } catch (error) {
    console.error('Error fetching agent earnings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch earnings data' });
  }
});

// ==================== AGENT CERTIFICATION MANAGEMENT ====================

// GET /api/commission-management/certifications - Get agent certifications
router.get('/certifications', requireAuth, async (req, res) => {
  try {
    let query = `
      SELECT 
        ac.*,
        u.name as agent_name,
        u.email as agent_email,
        admin.name as approved_by_name
      FROM agent_certifications ac
      JOIN users u ON ac.agent_id = u.id
      LEFT JOIN users admin ON ac.admin_approved_by = admin.id
    `;
    const params = [];
    
    // If not admin, only show own certifications
    if (req.user.role !== 'admin') {
      query += ' WHERE ac.agent_id = ?';
      params.push(req.user.id);
    }
    
    query += ' ORDER BY ac.created_at DESC';
    
    const [certifications] = await pool.query(query, params);
    res.json({ success: true, certifications });
  } catch (error) {
    console.error('Error fetching certifications:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch certifications' });
  }
});

// POST /api/commission-management/certifications - Create/Update agent certification
router.post('/certifications', requireAuth, async (req, res) => {
  try {
    const { certification_type, training_status } = req.body;
    const agentId = req.user.role === 'admin' ? req.body.agent_id : req.user.id;
    
    if (!certification_type || !['fast_delivery', 'pickup_site_manager', 'pickup_delivery'].includes(certification_type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid certification type'
      });
    }
    
    // Check if certification already exists
    const [existing] = await pool.query(`
      SELECT id FROM agent_certifications 
      WHERE agent_id = ? AND certification_type = ?
    `, [agentId, certification_type]);
    
    if (existing.length > 0) {
      // Update existing certification
      await pool.query(`
        UPDATE agent_certifications SET
          training_status = ?,
          training_completed_at = CASE WHEN ? = 'completed' THEN NOW() ELSE training_completed_at END,
          updated_at = NOW()
        WHERE agent_id = ? AND certification_type = ?
      `, [training_status, training_status, agentId, certification_type]);
    } else {
      // Create new certification
      await pool.query(`
        INSERT INTO agent_certifications (
          agent_id, certification_type, training_status,
          training_completed_at
        ) VALUES (?, ?, ?, CASE WHEN ? = 'completed' THEN NOW() ELSE NULL END)
      `, [agentId, certification_type, training_status, training_status]);
    }
    
    res.json({ success: true, message: 'Certification updated successfully' });
  } catch (error) {
    console.error('Error updating certification:', error);
    res.status(500).json({ success: false, message: 'Failed to update certification' });
  }
});

// PUT /api/commission-management/certifications/:id/approve - Approve/Reject certification (Admin only)
router.put('/certifications/:id/approve', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { approval_status, rejection_reason } = req.body;
    
    if (!['approved', 'rejected'].includes(approval_status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid approval status'
      });
    }
    
    if (approval_status === 'rejected' && !rejection_reason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }
    
    await pool.query(`
      UPDATE agent_certifications SET
        admin_approval_status = ?,
        admin_approved_by = ?,
        admin_approved_at = NOW(),
        rejection_reason = ?,
        is_active = CASE WHEN ? = 'approved' THEN TRUE ELSE FALSE END,
        updated_at = NOW()
      WHERE id = ?
    `, [approval_status, req.user.id, rejection_reason, approval_status, id]);
    
    // Update user's certification status
    const [certification] = await pool.query(`
      SELECT agent_id, certification_type FROM agent_certifications WHERE id = ?
    `, [id]);
    
    if (certification.length > 0) {
      const certStatus = approval_status === 'approved' ? 'certified' : 'not_certified';
      await pool.query(`
        UPDATE users SET 
          certification_status = ?,
          agent_type = CASE WHEN ? = 'approved' THEN ? ELSE agent_type END
        WHERE id = ?
      `, [certStatus, approval_status, certification[0].certification_type, certification[0].agent_id]);
    }
    
    res.json({ success: true, message: `Certification ${approval_status} successfully` });
  } catch (error) {
    console.error('Error approving certification:', error);
    res.status(500).json({ success: false, message: 'Failed to update certification status' });
  }
});

// ==================== COMMISSION PAYMENT MANAGEMENT ====================

// POST /api/commission-management/pay-commissions - Pay pending commissions (Admin only)
router.post('/pay-commissions', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { commission_ids, payment_method = 'wallet' } = req.body;
    
    if (!commission_ids || !Array.isArray(commission_ids) || commission_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Commission IDs are required'
      });
    }
    
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      // Update commission status to paid
      const placeholders = commission_ids.map(() => '?').join(',');
      await connection.query(`
        UPDATE order_commissions 
        SET status = 'paid', payment_date = NOW()
        WHERE id IN (${placeholders}) AND status = 'pending'
      `, commission_ids);
      
      // Update agent earnings summary
      const [commissions] = await connection.query(`
        SELECT agent_id, agent_type, SUM(commission_amount) as total_paid
        FROM order_commissions 
        WHERE id IN (${placeholders})
        GROUP BY agent_id, agent_type
      `, commission_ids);
      
      for (const commission of commissions) {
        if (commission.agent_id) {
          await connection.query(`
            UPDATE agent_earnings_summary SET
              pending_earnings = pending_earnings - ?,
              paid_earnings = paid_earnings + ?,
              last_payment_date = NOW()
            WHERE agent_id = ? AND agent_type = ?
          `, [
            commission.total_paid,
            commission.total_paid,
            commission.agent_id,
            commission.agent_type
          ]);
          
          // Update user wallet balance
          await connection.query(`
            UPDATE users SET
              wallet_balance = wallet_balance + ?,
              commission_balance = commission_balance + ?
            WHERE id = ?
          `, [commission.total_paid, commission.total_paid, commission.agent_id]);
        }
      }
      
      await connection.commit();
      res.json({ 
        success: true, 
        message: `Successfully paid ${commission_ids.length} commissions`,
        total_paid: commissions.reduce((sum, c) => sum + parseFloat(c.total_paid), 0)
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error paying commissions:', error);
    res.status(500).json({ success: false, message: 'Failed to process commission payments' });
  }
});

// GET /api/commission-management/pending-payments - Get pending commission payments (Admin only)
router.get('/pending-payments', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const [pendingPayments] = await pool.query(`
      SELECT 
        oc.id,
        oc.order_id,
        oc.commission_type,
        oc.agent_type,
        oc.commission_amount,
        oc.created_at,
        u.name as agent_name,
        u.email as agent_email,
        o.order_number
      FROM order_commissions oc
      JOIN users u ON oc.agent_id = u.id
      JOIN orders o ON oc.order_id = o.id
      WHERE oc.status = 'pending' AND oc.agent_id IS NOT NULL
      ORDER BY oc.created_at DESC
    `);
    
    // Group by agent for easier processing
    const groupedPayments = {};
    let totalPending = 0;
    
    pendingPayments.forEach(payment => {
      const key = `${payment.agent_id}_${payment.agent_type}`;
      if (!groupedPayments[key]) {
        groupedPayments[key] = {
          agent_name: payment.agent_name,
          agent_email: payment.agent_email,
          agent_type: payment.agent_type,
          total_amount: 0,
          commission_count: 0,
          commissions: []
        };
      }
      
      groupedPayments[key].total_amount += parseFloat(payment.commission_amount);
      groupedPayments[key].commission_count++;
      groupedPayments[key].commissions.push(payment);
      totalPending += parseFloat(payment.commission_amount);
    });
    
    res.json({
      success: true,
      pendingPayments: Object.values(groupedPayments),
      totalPending: parseFloat(totalPending.toFixed(2)),
      totalCommissions: pendingPayments.length
    });
  } catch (error) {
    console.error('Error fetching pending payments:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch pending payments' });
  }
});

module.exports = router;