const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// GET /api/admin/agent-types/overview - Get overview of all agent types
router.get('/overview', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Get agent counts by type
    const [agentCounts] = await pool.query(`
      SELECT 
        agent_type,
        marketplace_type,
        COUNT(*) as count,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count,
        SUM(CASE WHEN verification_status = 'verified' THEN 1 ELSE 0 END) as verified_count
      FROM agents
      GROUP BY agent_type, marketplace_type
      ORDER BY agent_type, marketplace_type
    `);

    // Get performance stats by agent type
    const [performanceStats] = await pool.query(`
      SELECT 
        a.agent_type,
        COUNT(o.id) as total_orders,
        AVG(ar.rating) as avg_rating,
        SUM(ae.amount) as total_earnings
      FROM agents a
      LEFT JOIN orders o ON a.id = o.agent_id
      LEFT JOIN agent_ratings ar ON a.id = ar.agent_id
      LEFT JOIN agent_earnings ae ON a.id = ae.agent_id
      GROUP BY a.agent_type
    `);

    // Get recent agent applications
    const [recentApplications] = await pool.query(`
      SELECT 
        a.*,
        u.username,
        u.email
      FROM agents a
      JOIN users u ON a.user_id = u.id
      WHERE a.verification_status = 'pending'
      ORDER BY a.created_at DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      agent_counts: agentCounts,
      performance_stats: performanceStats,
      recent_applications: recentApplications
    });
  } catch (error) {
    console.error('Admin overview error:', error);
    res.status(500).json({ error: 'Failed to get overview' });
  }
});

// GET /api/admin/agent-types/agents - Get all agents with filtering
router.get('/agents', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { agent_type, marketplace_type, status, verification_status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    let queryParams = [];

    if (agent_type) {
      whereClause += ' AND a.agent_type = ?';
      queryParams.push(agent_type);
    }

    if (marketplace_type) {
      whereClause += ' AND a.marketplace_type = ?';
      queryParams.push(marketplace_type);
    }

    if (status) {
      whereClause += ' AND a.status = ?';
      queryParams.push(status);
    }

    if (verification_status) {
      whereClause += ' AND a.verification_status = ?';
      queryParams.push(verification_status);
    }

    const [agents] = await pool.query(`
      SELECT 
        a.*,
        u.username,
        u.email as user_email,
        COUNT(DISTINCT o.id) as total_orders,
        AVG(ar.rating) as avg_rating,
        SUM(ae.amount) as total_earnings
      FROM agents a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN orders o ON a.id = o.agent_id
      LEFT JOIN agent_ratings ar ON a.id = ar.agent_id
      LEFT JOIN agent_earnings ae ON a.id = ae.agent_id
      ${whereClause}
      GROUP BY a.id
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), parseInt(offset)]);

    // Get total count
    const [countResult] = await pool.query(`
      SELECT COUNT(*) as total
      FROM agents a
      JOIN users u ON a.user_id = u.id
      ${whereClause}
    `, queryParams);

    res.json({
      success: true,
      agents: agents,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Admin get agents error:', error);
    res.status(500).json({ error: 'Failed to get agents' });
  }
});

// PUT /api/admin/agent-types/agents/:agentId/approve - Approve agent
router.put('/agents/:agentId/approve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const agentId = req.params.agentId;
    const { trust_level = 'medium' } = req.body;

    await pool.query(`
      UPDATE agents 
      SET verification_status = 'verified', status = 'active', trust_level = ?
      WHERE id = ?
    `, [trust_level, agentId]);

    // Log admin action
    await pool.query(`
      INSERT INTO agent_activities (agent_id, activity_type, status, notes, created_by)
      VALUES (?, 'verification_approved', 'completed', 'Agent approved by admin', ?)
    `, [agentId, req.user.id]);

    res.json({ success: true, message: 'Agent approved successfully' });
  } catch (error) {
    console.error('Admin approve agent error:', error);
    res.status(500).json({ error: 'Failed to approve agent' });
  }
});

// PUT /api/admin/agent-types/agents/:agentId/reject - Reject agent
router.put('/agents/:agentId/reject', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const agentId = req.params.agentId;
    const { reason } = req.body;

    await pool.query(`
      UPDATE agents 
      SET verification_status = 'rejected', status = 'inactive'
      WHERE id = ?
    `, [agentId]);

    // Log admin action
    await pool.query(`
      INSERT INTO agent_activities (agent_id, activity_type, status, notes, created_by)
      VALUES (?, 'verification_rejected', 'completed', ?, ?)
    `, [agentId, reason || 'Agent rejected by admin', req.user.id]);

    res.json({ success: true, message: 'Agent rejected successfully' });
  } catch (error) {
    console.error('Admin reject agent error:', error);
    res.status(500).json({ error: 'Failed to reject agent' });
  }
});

// POST /api/admin/agent-types/agents/:agentId/bonus - Give bonus to agent
router.post('/agents/:agentId/bonus', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const agentId = req.params.agentId;
    const { amount, reason, order_id } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid bonus amount required' });
    }

    // Create agent earning record
    await pool.query(`
      INSERT INTO agent_earnings (agent_id, order_id, earnings_type, amount, description, status)
      VALUES (?, ?, 'bonus', ?, ?, 'paid')
    `, [agentId, order_id || null, amount, reason || 'Admin bonus']);

    // Update agent total earnings
    await pool.query(`
      UPDATE agents 
      SET bonus_earned = bonus_earned + ?, total_earnings = total_earnings + ?
      WHERE id = ?
    `, [amount, amount, agentId]);

    res.json({ success: true, message: 'Bonus given successfully' });
  } catch (error) {
    console.error('Admin give bonus error:', error);
    res.status(500).json({ error: 'Failed to give bonus' });
  }
});

// GET /api/admin/agent-types/pickup-sites - Get all pickup sites
router.get('/pickup-sites', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [pickupSites] = await pool.query(`
      SELECT 
        ps.*,
        a.first_name as manager_first_name,
        a.last_name as manager_last_name,
        a.phone as manager_phone,
        a.agent_code,
        COUNT(DISTINCT o.id) as total_orders
      FROM pickup_sites ps
      JOIN agents a ON ps.agent_id = a.id
      LEFT JOIN orders o ON ps.id = o.pickup_site_id
      GROUP BY ps.id
      ORDER BY ps.created_at DESC
    `);

    res.json({ success: true, pickup_sites: pickupSites });
  } catch (error) {
    console.error('Admin get pickup sites error:', error);
    res.status(500).json({ error: 'Failed to get pickup sites' });
  }
});

// PUT /api/admin/agent-types/pickup-sites/:siteId/verify - Verify pickup site
router.put('/pickup-sites/:siteId/verify', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const siteId = req.params.siteId;

    await pool.query(`
      UPDATE pickup_sites 
      SET verification_status = 'verified'
      WHERE id = ?
    `, [siteId]);

    res.json({ success: true, message: 'Pickup site verified successfully' });
  } catch (error) {
    console.error('Admin verify pickup site error:', error);
    res.status(500).json({ error: 'Failed to verify pickup site' });
  }
});

// GET /api/admin/agent-types/performance/:agentType - Get performance metrics by agent type
router.get('/performance/:agentType', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const agentType = req.params.agentType;
    const { period = 'week' } = req.query;

    let dateFilter = '';
    switch (period) {
      case 'today':
        dateFilter = 'AND DATE(o.created_at) = CURDATE()';
        break;
      case 'week':
        dateFilter = 'AND o.created_at >= DATE_SUB(NOW(), INTERVAL 1 WEEK)';
        break;
      case 'month':
        dateFilter = 'AND o.created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)';
        break;
      default:
        dateFilter = 'AND o.created_at >= DATE_SUB(NOW(), INTERVAL 1 WEEK)';
    }

    const [performance] = await pool.query(`
      SELECT 
        a.id,
        a.agent_code,
        a.first_name,
        a.last_name,
        a.trust_level,
        COUNT(o.id) as total_orders,
        SUM(CASE WHEN o.tracking_status = 'delivered' THEN 1 ELSE 0 END) as completed_orders,
        AVG(ar.rating) as avg_rating,
        SUM(ae.amount) as total_earnings
      FROM agents a
      LEFT JOIN orders o ON a.id = o.agent_id ${dateFilter}
      LEFT JOIN agent_ratings ar ON a.id = ar.agent_id
      LEFT JOIN agent_earnings ae ON a.id = ae.agent_id ${dateFilter.replace('o.created_at', 'ae.created_at')}
      WHERE a.agent_type = ?
      GROUP BY a.id
      ORDER BY total_orders DESC, avg_rating DESC
    `, [agentType]);

    res.json({ success: true, performance: performance });
  } catch (error) {
    console.error('Admin get performance error:', error);
    res.status(500).json({ error: 'Failed to get performance metrics' });
  }
});

// PUT /api/admin/agent-types/agents/:agentId/assign-zone - Assign agent to zone
router.put('/agents/:agentId/assign-zone', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const agentId = req.params.agentId;
    const { primary_territory, secondary_territories, coverage_radius } = req.body;

    await pool.query(`
      UPDATE agents 
      SET primary_territory = ?, secondary_territories = ?, coverage_radius = ?
      WHERE id = ?
    `, [primary_territory, JSON.stringify(secondary_territories || []), coverage_radius || 10.0, agentId]);

    res.json({ success: true, message: 'Agent zone assigned successfully' });
  } catch (error) {
    console.error('Admin assign zone error:', error);
    res.status(500).json({ error: 'Failed to assign zone' });
  }
});

module.exports = router;
