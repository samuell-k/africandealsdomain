const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

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

// Middleware to check if user is agent
const requireAgent = (req, res, next) => {
  if (req.user.role !== 'agent') {
    return res.status(403).json({ error: 'Agent access required' });
  }
  next();
};

// Middleware to get agent details with type validation
const getAgentWithType = async (req, res, next) => {
  try {
    const [agents] = await pool.query(`
      SELECT * FROM agents WHERE user_id = ?
    `, [req.user.id]);
    
    if (agents.length === 0) {
      return res.status(404).json({ error: 'Agent profile not found' });
    }
    
    req.agent = agents[0];
    next();
  } catch (error) {
    console.error('Get agent with type error:', error);
    res.status(500).json({ error: 'Failed to get agent profile' });
  }
};

// Utility function to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// ==================== TYPE 1: FAST DELIVERY AGENTS ====================

// GET /api/agent-types/fast-delivery/dashboard - Fast delivery agent dashboard
router.get('/fast-delivery/dashboard', authenticateToken, requireAgent, getAgentWithType, async (req, res) => {
  try {
    if (!['fast_delivery', 'both'].includes(req.agent.agent_type)) {
      return res.status(403).json({ error: 'Fast delivery agent access required' });
    }

    // Get today's stats from grocery_orders
    const [todayStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_deliveries,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as completed_deliveries,
        SUM(CASE WHEN status IN ('assigned', 'confirmed', 'preparing', 'ready', 'ready_for_pickup', 'picked_up', 'in_transit') THEN 1 ELSE 0 END) as active_deliveries,
        COALESCE(SUM(CASE WHEN status = 'delivered' THEN delivery_fee ELSE 0 END), 0) as today_earnings
      FROM grocery_orders
      WHERE agent_id = ? 
        AND DATE(created_at) = CURDATE()
    `, [req.agent.id]);

    // Get current active orders assigned to this agent
    const [activeOrders] = await pool.query(`
      SELECT 
        go.*,
        u.name as buyer_name,
        u.phone as buyer_phone,
        s.name as seller_name,
        s.phone as seller_phone,
        s.address as seller_address
      FROM grocery_orders go
      LEFT JOIN users u ON go.user_id = u.id
      LEFT JOIN users s ON go.seller_id = s.id
      WHERE go.agent_id = ? 
        AND go.status IN ('assigned', 'confirmed', 'preparing', 'ready', 'ready_for_pickup', 'picked_up', 'in_transit')
      ORDER BY go.created_at ASC
    `, [req.agent.id]);

    // Get available orders (not assigned to any agent)
    const [availableOrders] = await pool.query(`
      SELECT 
        go.*,
        u.name as buyer_name,
        u.phone as buyer_phone,
        s.name as seller_name,
        s.phone as seller_phone,
        s.address as seller_address
      FROM grocery_orders go
      LEFT JOIN users u ON go.user_id = u.id
      LEFT JOIN users s ON go.seller_id = s.id
      WHERE go.agent_id IS NULL 
        AND go.status IN ('confirmed', 'payment_approved')
        AND go.delivery_type = 'fast_delivery'
      ORDER BY go.created_at DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      agent: {
        id: req.agent.id,
        name: `${req.agent.first_name} ${req.agent.last_name}`,
        agent_type: req.agent.agent_type,
        status: req.agent.status,
        trust_level: req.agent.trust_level,
        average_rating: req.agent.average_rating
      },
      stats: todayStats[0],
      activeOrders: activeOrders,
      availableOrders: availableOrders
    });
  } catch (error) {
    console.error('Fast delivery dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

// POST /api/agent-types/fast-delivery/accept-order/:orderId - Accept grocery order
router.post('/fast-delivery/accept-order/:orderId', authenticateToken, requireAgent, getAgentWithType, async (req, res) => {
  try {
    if (!['fast_delivery', 'both'].includes(req.agent.agent_type)) {
      return res.status(403).json({ error: 'Fast delivery agent access required' });
    }

    const orderId = req.params.orderId;

    // Check if order is available
    const [orders] = await pool.query(`
      SELECT * FROM orders 
      WHERE id = ? AND agent_id IS NULL AND marketplace_type = 'grocery_local'
        AND status = 'confirmed' AND payment_status = 'completed'
    `, [orderId]);

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not available' });
    }

    // Assign order to agent
    await pool.query(`
      UPDATE orders 
      SET agent_id = ?, tracking_status = 'assigned', assignment_method = 'manual',
          assignment_timestamp = NOW(), estimated_delivery_time = DATE_ADD(NOW(), INTERVAL 2 HOUR)
      WHERE id = ?
    `, [req.agent.id, orderId]);

    res.json({ success: true, message: 'Order accepted successfully' });
  } catch (error) {
    console.error('Accept fast delivery order error:', error);
    res.status(500).json({ error: 'Failed to accept order' });
  }
});

// PUT /api/agent-types/fast-delivery/update-location - Update GPS location
router.put('/fast-delivery/update-location', authenticateToken, requireAgent, getAgentWithType, async (req, res) => {
  try {
    if (!['fast_delivery', 'both'].includes(req.agent.agent_type)) {
      return res.status(403).json({ error: 'Fast delivery agent access required' });
    }

    const { latitude, longitude, accuracy, speed, heading } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    // Update agent location
    await pool.query(`
      UPDATE agents 
      SET current_location = JSON_OBJECT('latitude', ?, 'longitude', ?, 'timestamp', NOW()),
          last_gps_update = NOW(),
          tracking_accuracy = ?
      WHERE id = ?
    `, [latitude, longitude, accuracy || null, req.agent.id]);

    res.json({ success: true, message: 'Location updated successfully' });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

module.exports = router;
