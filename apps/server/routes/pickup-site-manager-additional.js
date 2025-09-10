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

// Middleware to check if user is pickup site manager
const requirePickupSiteManager = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.userId;
    console.log('[PICKUP-SITE-MANAGER-ADDITIONAL] Verifying agent for user:', userId);
    
    const [agents] = await pool.query(
      'SELECT * FROM agents WHERE user_id = ? AND agent_type = "pickup_site_manager"',
      [userId]
    );
    
    if (agents.length === 0) {
      console.log('[PICKUP-SITE-MANAGER-ADDITIONAL] No pickup site manager found for user:', userId);
      return res.status(403).json({ error: 'Pickup site manager access required' });
    }
    
    const agent = agents[0];
    console.log('[PICKUP-SITE-MANAGER-ADDITIONAL] Agent found:', { id: agent.id, agent_type: agent.agent_type });
    
    // Extract pickup site ID from commission settings or direct column
    let pickupSiteId = agent.pickup_site_id;
    
    if (!pickupSiteId && agent.commission_settings) {
      try {
        const settings = JSON.parse(agent.commission_settings);
        pickupSiteId = settings.pickup_site_id;
      } catch (e) {
        console.log('[PICKUP-SITE-MANAGER-ADDITIONAL] Could not parse commission settings');
      }
    }
    
    if (!pickupSiteId) {
      console.log('[PICKUP-SITE-MANAGER-ADDITIONAL] No pickup site assigned - using virtual site');
      agent.pickup_site_id = 0;
      agent.pickup_site = {
        id: 0,
        site_name: 'Home Delivery Only',
        name: 'Home Delivery Only',
        address: 'Virtual Site - Home Delivery Service',
        city: 'All Cities',
        state: 'All States',
        is_active: 1,
        capacity: 999999,
        current_load: 0,
        manager_name: agent.first_name + ' ' + agent.last_name,
        manager_phone: agent.phone || 'N/A'
      };
      req.agent = agent;
      return next();
    }
    
    // Get pickup site details
    const [sites] = await pool.query('SELECT * FROM pickup_sites WHERE id = ?', [pickupSiteId]);
    
    agent.pickup_site_id = pickupSiteId;
    agent.pickup_site = sites[0] || null;
    
    req.agent = agent;
    next();
  } catch (error) {
    console.error('[PICKUP-SITE-MANAGER-ADDITIONAL] Middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/pickup-site-manager-additional/site-info - Get pickup site information
router.get('/site-info', authenticateToken, requirePickupSiteManager, async (req, res) => {
  try {
    console.log('[PSM-ADDITIONAL] Getting site info for agent:', req.agent.id);
    
    const siteInfo = {
      agent: {
        id: req.agent.id,
        user_id: req.agent.user_id,
        agent_type: req.agent.agent_type,
        status: req.agent.status,
        phone: req.agent.phone,
        total_orders: req.agent.total_orders || 0,
        success_rate: req.agent.success_rate || '100.00',
        total_earnings: req.agent.total_earnings || '0.00'
      },
      pickup_site: req.agent.pickup_site,
      permissions: {
        can_create_manual_orders: req.agent.can_create_manual_orders || 0,
        can_confirm_deliveries: req.agent.can_confirm_deliveries || 0,
        can_handle_pickups: req.agent.can_handle_pickups || 0,
        can_browse_marketplace: req.agent.can_browse_marketplace || 0
      }
    };
    
    res.json({
      success: true,
      data: siteInfo
    });
    
  } catch (error) {
    console.error('[PSM-ADDITIONAL] Error getting site info:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get site information',
      details: error.message 
    });
  }
});

// GET /api/pickup-site-manager-additional/test-connection - Test API connection
router.get('/test-connection', authenticateToken, requirePickupSiteManager, async (req, res) => {
  try {
    console.log('[PSM-ADDITIONAL] Testing connection for user:', req.user.id);
    
    res.json({
      success: true,
      message: 'Pickup Site Manager Additional API is working',
      timestamp: new Date().toISOString(),
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name
      },
      agent: {
        id: req.agent.id,
        agent_type: req.agent.agent_type,
        pickup_site_id: req.agent.pickup_site_id
      }
    });
    
  } catch (error) {
    console.error('[PSM-ADDITIONAL] Error testing connection:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Connection test failed',
      details: error.message 
    });
  }
});

// GET /api/pickup-site-manager-additional/orders/recent - Get recent orders
router.get('/orders/recent', authenticateToken, requirePickupSiteManager, async (req, res) => {
  try {
    console.log('[PSM-ADDITIONAL] Getting recent orders for agent:', req.agent.id);
    
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    
    const [orders] = await pool.query(`
      SELECT 
        mo.*,
        u.name as customer_name,
        u.email as customer_email,
        u.phone as customer_phone
      FROM manual_orders mo
      LEFT JOIN users u ON mo.customer_id = u.id
      WHERE mo.agent_id = ?
      ORDER BY mo.created_at DESC
      LIMIT ? OFFSET ?
    `, [req.agent.id, limit, offset]);
    
    // Get total count
    const [countResult] = await pool.query(
      'SELECT COUNT(*) as total FROM manual_orders WHERE agent_id = ?',
      [req.agent.id]
    );
    
    const total = countResult[0].total;
    
    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          total,
          limit,
          offset,
          hasMore: (offset + limit) < total
        }
      }
    });
    
  } catch (error) {
    console.error('[PSM-ADDITIONAL] Error getting recent orders:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get recent orders',
      details: error.message 
    });
  }
});

module.exports = router;