/**
 * Fast Delivery Agent Routes - Clean Implementation
 * Handles all functionality for Fast Delivery Agents (Local Market Orders)
 */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname))
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

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

// Middleware to verify fast delivery agent
const verifyFastDeliveryAgent = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.userId; // Support both formats
    console.log('[FAST-DELIVERY] Verifying agent for user:', userId);
    
    const [agents] = await pool.query(
      'SELECT * FROM agents WHERE user_id = ? AND agent_type = "fast_delivery"',
      [userId]
    );

    if (agents.length === 0) {
      console.log('[FAST-DELIVERY] No fast delivery agent found for user:', userId);
      return res.status(403).json({ error: 'Fast delivery agent access required' });
    }

    const agent = agents[0];
    console.log('[FAST-DELIVERY] Agent found:', { id: agent.id, status: agent.admin_approval_status });
    
    // Allow access even if not approved yet (for testing)
    req.agent = agent;
    next();
  } catch (error) {
    console.error('[FAST-DELIVERY] Agent verification error:', error);
    res.status(500).json({ error: 'Server error during agent verification' });
  }
};

// Calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const d = R * c; // Distance in km
  return Math.round(d * 100) / 100; // Round to 2 decimal places
}

// Helper function to calculate commission
function calculateCommission(orderTotal) {
  const commissionRate = 0.15; // 15% commission for fast delivery
  const baseCommission = orderTotal * commissionRate;
  const minCommission = 1.00; // Minimum $1 commission
  const maxCommission = 50.00; // Maximum $50 commission
  
  return Math.max(minCommission, Math.min(maxCommission, baseCommission));
}

/**
 * Get Agent Profile
 * GET /api/fast-delivery-agent/profile
 */
router.get('/profile', authenticateToken, verifyFastDeliveryAgent, async (req, res) => {
  try {
    const agent = req.agent;
    
    // Get additional agent stats
    const [stats] = await pool.query(`
      SELECT 
        COUNT(CASE WHEN go.status = 'delivered' THEN 1 END) as total_deliveries,
        AVG(CASE WHEN ar.rating IS NOT NULL THEN ar.rating END) as average_rating,
        SUM(CASE WHEN go.status = 'delivered' THEN go.agent_commission END) as total_earnings
      FROM grocery_orders go
      LEFT JOIN agent_ratings ar ON go.id = ar.order_id
      WHERE go.agent_id = ?
    `, [agent.id]);

    res.json({
      success: true,
      agent: {
        ...agent,
        total_deliveries: stats[0]?.total_deliveries || 0,
        average_rating: parseFloat(stats[0]?.average_rating || 0).toFixed(1),
        total_earnings: parseFloat(stats[0]?.total_earnings || 0).toFixed(2)
      }
    });
  } catch (error) {
    console.error('Get agent profile error:', error);
    res.status(500).json({ error: 'Failed to get agent profile' });
  }
});

/**
 * Get Agent Statistics
 * GET /api/fast-delivery-agent/stats
 */
router.get('/stats', authenticateToken, verifyFastDeliveryAgent, async (req, res) => {
  try {
    const agentId = req.agent.id;
    const today = new Date().toISOString().split('T')[0];

    // Today's stats
    const [todayStats] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as completed,
        SUM(CASE WHEN status = 'delivered' THEN agent_commission ELSE 0 END) as earnings
      FROM grocery_orders 
      WHERE agent_id = ? AND DATE(created_at) = ?
    `, [agentId, today]);

    // Active orders count
    const [activeStats] = await pool.query(`
      SELECT COUNT(*) as count
      FROM grocery_orders 
      WHERE agent_id = ? AND status IN ('assigned', 'arrived_at_seller', 'picked_from_seller', 'en_route', 'arrived_at_buyer')
    `, [agentId]);

    // This week's stats
    const [weekStats] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as completed,
        SUM(CASE WHEN status = 'delivered' THEN agent_commission ELSE 0 END) as earnings
      FROM grocery_orders 
      WHERE agent_id = ? AND WEEK(created_at) = WEEK(NOW()) AND YEAR(created_at) = YEAR(NOW())
    `, [agentId]);

    res.json({
      success: true,
      stats: {
        today: {
          total: todayStats[0]?.total || 0,
          completed: todayStats[0]?.completed || 0,
          earnings: parseFloat(todayStats[0]?.earnings || 0)
        },
        active: {
          count: activeStats[0]?.count || 0
        },
        week: {
          total: weekStats[0]?.total || 0,
          completed: weekStats[0]?.completed || 0,
          earnings: parseFloat(weekStats[0]?.earnings || 0)
        }
      }
    });
  } catch (error) {
    console.error('Get agent stats error:', error);
    res.status(500).json({ error: 'Failed to get agent statistics' });
  }
});

/**
 * Get Available Orders
 * GET /api/fast-delivery-agent/available-orders
 */
router.get('/available-orders', authenticateToken, verifyFastDeliveryAgent, async (req, res) => {
  try {
    const agentId = req.agent.id;
    const { limit = 20, radius = 10 } = req.query;

    // Get agent's current location
    const agentLocation = req.agent.current_location ? JSON.parse(req.agent.current_location) : null;

    let query = `
      SELECT 
        go.*,
        u.username as buyer_name,
        u.email as buyer_email,
        u.phone as buyer_phone,
        (SELECT COUNT(*) FROM grocery_order_items WHERE order_id = go.id) as item_count,
        (SELECT SUM(total_price) FROM grocery_order_items WHERE order_id = go.id) as items_total
      FROM grocery_orders go
      LEFT JOIN users u ON go.user_id = u.id
      WHERE go.agent_id IS NULL 
      AND go.status IN ('pending', 'confirmed')
      ORDER BY go.created_at DESC
      LIMIT ?
    `;
    
    const [orders] = await pool.query(query, [parseInt(limit)]);

    // Calculate distances if agent location is available
    const ordersWithDistance = orders.map(order => {
      let distance = null;
      let estimated_time = null;

      if (agentLocation && order.delivery_lat && order.delivery_lng) {
        distance = calculateDistance(
          agentLocation.lat,
          agentLocation.lng,
          order.delivery_lat,
          order.delivery_lng
        );
        
        // Estimate delivery time (assuming 30 km/h average speed + 15 min pickup time)
        if (distance) {
          estimated_time = Math.round((distance / 30) * 60 + 15); // minutes
        }
      }

      return {
        ...order,
        distance,
        estimated_time,
        commission: calculateCommission(order.total_amount || order.items_total || 0)
      };
    });

    // Filter by radius if specified and agent location available
    let filteredOrders = ordersWithDistance;
    if (agentLocation && radius && radius !== 'all') {
      filteredOrders = ordersWithDistance.filter(order => 
        !order.distance || order.distance <= parseFloat(radius)
      );
    }

    res.json({
      success: true,
      orders: filteredOrders,
      totalAvailable: orders.length,
      agentLocation: agentLocation
    });
  } catch (error) {
    console.error('Get available orders error:', error);
    res.status(500).json({ error: 'Failed to get available orders' });
  }
});

/**
 * Get Active Orders
 * GET /api/fast-delivery-agent/active-orders
 */
router.get('/active-orders', authenticateToken, verifyFastDeliveryAgent, async (req, res) => {
  try {
    const agentId = req.agent.id;

    const [orders] = await pool.query(`
      SELECT 
        go.*,
        u.username as buyer_name,
        u.email as buyer_email,
        u.phone as buyer_phone,
        (SELECT COUNT(*) FROM grocery_order_items WHERE order_id = go.id) as item_count,
        (SELECT SUM(total_price) FROM grocery_order_items WHERE order_id = go.id) as items_total
      FROM grocery_orders go
      LEFT JOIN users u ON go.user_id = u.id
      WHERE go.agent_id = ? 
      AND go.status IN ('assigned', 'arrived_at_seller', 'picked_from_seller', 'en_route', 'arrived_at_buyer')
      ORDER BY go.agent_assigned_at DESC
    `, [agentId]);

    const ordersWithDetails = orders.map(order => ({
      ...order,
      commission: calculateCommission(order.total_amount || order.items_total || 0)
    }));

    res.json({
      success: true,
      orders: ordersWithDetails
    });
  } catch (error) {
    console.error('Get active orders error:', error);
    res.status(500).json({ error: 'Failed to get active orders' });
  }
});

/**
 * Accept Order
 * POST /api/fast-delivery-agent/accept-order/:orderId
 */
router.post('/accept-order/:orderId', authenticateToken, verifyFastDeliveryAgent, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const agentId = req.agent.id;

    // Check if order is still available
    const [orders] = await pool.query(
      'SELECT * FROM grocery_orders WHERE id = ? AND agent_id IS NULL AND status IN ("pending", "confirmed")',
      [orderId]
    );

    if (orders.length === 0) {
      return res.status(400).json({ error: 'Order is no longer available' });
    }

    const order = orders[0];

    // Generate delivery code
    const deliveryCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Update order
    await pool.query(`
      UPDATE grocery_orders 
      SET agent_id = ?, status = 'assigned', agent_assigned_at = NOW(), delivery_code = ?
      WHERE id = ?
    `, [agentId, deliveryCode, orderId]);

    // Update agent status
    await pool.query(
      'UPDATE agents SET status = "busy" WHERE id = ?',
      [agentId]
    );

    // Log activity
    await pool.query(`
      INSERT INTO agent_activities (agent_id, activity_type, order_id, description, created_at)
      VALUES (?, 'order_accepted', ?, 'Agent accepted order', NOW())
    `, [agentId, orderId]);

    // Add to order status history
    await pool.query(`
      INSERT INTO order_status_history (order_id, status, notes, changed_by, changed_at)
      VALUES (?, 'assigned', 'Order assigned to fast delivery agent', ?, NOW())
    `, [orderId, agentId]);

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.emit('order:assigned', {
        orderId: orderId,
        agentId: agentId,
        buyerId: order.user_id,
        orderDetails: order,
        agentDetails: req.agent
      });
    }

    res.json({
      success: true,
      message: 'Order accepted successfully',
      deliveryCode: deliveryCode,
      order: {
        ...order,
        agent_id: agentId,
        status: 'assigned',
        delivery_code: deliveryCode
      }
    });
  } catch (error) {
    console.error('Accept order error:', error);
    res.status(500).json({ error: 'Failed to accept order' });
  }
});

/**
 * Get Order Details
 * GET /api/fast-delivery-agent/order/:orderId
 */
router.get('/order/:orderId', authenticateToken, verifyFastDeliveryAgent, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const agentId = req.agent.id;

    // Get order details
    const [orders] = await pool.query(`
      SELECT 
        go.*,
        u.username as buyer_name,
        u.email as buyer_email,
        u.phone as buyer_phone
      FROM grocery_orders go
      LEFT JOIN users u ON go.user_id = u.id
      WHERE go.id = ? AND go.agent_id = ?
    `, [orderId, agentId]);

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found or not assigned to you' });
    }

    const order = orders[0];

    // Get order items
    const [items] = await pool.query(
      'SELECT * FROM grocery_order_items WHERE order_id = ?',
      [orderId]
    );

    res.json({
      success: true,
      order: {
        ...order,
        items: items,
        commission: calculateCommission(order.total_amount)
      }
    });
  } catch (error) {
    console.error('Get order details error:', error);
    res.status(500).json({ error: 'Failed to get order details' });
  }
});

/**
 * Update Order Status
 * PUT /api/fast-delivery-agent/update-status/:orderId
 */
router.put('/update-status/:orderId', authenticateToken, verifyFastDeliveryAgent, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const agentId = req.agent.id;
    const { status, notes, location } = req.body;

    // Validate status
    const validStatuses = [
      'arrived_at_seller', 'picked_from_seller', 'en_route', 
      'arrived_at_buyer', 'delivered', 'issue_at_pickup', 'delivery_failed'
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Check if order belongs to agent
    const [orders] = await pool.query(
      'SELECT * FROM grocery_orders WHERE id = ? AND agent_id = ?',
      [orderId, agentId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found or not assigned to you' });
    }

    const order = orders[0];

    // Prepare update data
    let updateFields = ['status = ?'];
    let updateValues = [status];

    // Add timestamp fields based on status
    switch (status) {
      case 'arrived_at_seller':
        updateFields.push('arrived_at_seller_time = NOW()');
        break;
      case 'picked_from_seller':
        updateFields.push('actual_pickup_time = NOW()');
        // Release seller payment immediately for local market
        updateFields.push('seller_payment_status = "approved"', 'seller_payment_approved_at = NOW()');
        break;
      case 'arrived_at_buyer':
        updateFields.push('arrived_at_buyer_time = NOW()');
        break;
      case 'delivered':
        updateFields.push('actual_delivery_time = NOW()', 'delivered_at = NOW()');
        if (location) {
          updateFields.push('delivery_confirmed_lat = ?', 'delivery_confirmed_lng = ?');
          updateValues.push(location.latitude, location.longitude);
        }
        // Set grace period end (5 minutes from now)
        updateFields.push('dispute_grace_period_end = DATE_ADD(NOW(), INTERVAL 5 MINUTE)');
        break;
      case 'delivery_failed':
        updateFields.push('delivery_failed_at = NOW()');
        if (notes) {
          updateFields.push('delivery_failed_reason = ?');
          updateValues.push(notes);
        }
        break;
    }

    if (notes && status !== 'delivery_failed') {
      updateFields.push('agent_delivery_notes = ?');
      updateValues.push(notes);
    }

    updateValues.push(orderId);

    // Update order
    await pool.query(`
      UPDATE grocery_orders 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `, updateValues);

    // Add to order status history
    await pool.query(`
      INSERT INTO order_status_history (order_id, status, notes, changed_by, changed_at)
      VALUES (?, ?, ?, ?, NOW())
    `, [orderId, status, notes || `Status updated to ${status}`, agentId]);

    // Log activity
    await pool.query(`
      INSERT INTO agent_activities (agent_id, activity_type, order_id, description, created_at)
      VALUES (?, 'status_update', ?, ?, NOW())
    `, [agentId, orderId, `Status updated to ${status}`]);

    // If delivered, calculate commission
    if (status === 'delivered') {
      // Calculate and record commission
      const commission = calculateCommission(order.total_amount);
      await pool.query(`
        UPDATE grocery_orders SET agent_commission = ?, commission_calculated = TRUE WHERE id = ?
      `, [commission, orderId]);

      await pool.query(`
        INSERT INTO agent_earnings (agent_id, order_id, amount, commission_rate, earned_at)
        VALUES (?, ?, ?, 0.15, NOW())
      `, [agentId, orderId, commission]);
    }

    // If order is completed or failed, make agent available again
    if (['delivered', 'delivery_failed'].includes(status)) {
      await pool.query(
        'UPDATE agents SET status = "available" WHERE id = ?',
        [agentId]
      );
    }

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.emit('delivery:status_update', {
        orderId: orderId,
        status: status,
        agentId: agentId,
        buyerId: order.user_id,
        notes: notes,
        location: location
      });
    }

    res.json({
      success: true,
      message: 'Order status updated successfully',
      order: {
        ...order,
        status: status
      }
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

/**
 * Go Online
 * POST /api/fast-delivery-agent/go-online
 */
router.post('/go-online', authenticateToken, verifyFastDeliveryAgent, async (req, res) => {
  try {
    const agentId = req.agent.id;
    const { location } = req.body;

    if (!location || !location.latitude || !location.longitude) {
      return res.status(400).json({ error: 'Location is required to go online' });
    }

    // Update agent status and location
    await pool.query(`
      UPDATE agents 
      SET status = 'available', current_location = ?, last_active = NOW()
      WHERE id = ?
    `, [JSON.stringify(location), agentId]);

    // Record location
    await pool.query(`
      INSERT INTO agent_location_tracking (agent_id, latitude, longitude, accuracy, recorded_at)
      VALUES (?, ?, ?, ?, NOW())
    `, [agentId, location.latitude, location.longitude, location.accuracy || null]);

    // Log activity
    await pool.query(`
      INSERT INTO agent_activities (agent_id, activity_type, description, created_at)
      VALUES (?, 'went_online', 'Agent went online and is available for orders', NOW())
    `, [agentId]);

    res.json({
      success: true,
      message: 'You are now online and available for orders',
      status: 'available',
      location: location
    });
  } catch (error) {
    console.error('Go online error:', error);
    res.status(500).json({ error: 'Failed to go online' });
  }
});

/**
 * Go Offline
 * POST /api/fast-delivery-agent/go-offline
 */
router.post('/go-offline', authenticateToken, verifyFastDeliveryAgent, async (req, res) => {
  try {
    const agentId = req.agent.id;

    // Check if agent has active orders
    const [activeOrders] = await pool.query(`
      SELECT COUNT(*) as count FROM grocery_orders 
      WHERE agent_id = ? AND status IN ('assigned', 'arrived_at_seller', 'picked_from_seller', 'en_route', 'arrived_at_buyer')
    `, [agentId]);

    if (activeOrders[0].count > 0) {
      return res.status(400).json({ 
        error: 'Cannot go offline while having active orders. Please complete all deliveries first.' 
      });
    }

    // Update agent status
    await pool.query(
      'UPDATE agents SET status = "offline", last_active = NOW() WHERE id = ?',
      [agentId]
    );

    // Log activity
    await pool.query(`
      INSERT INTO agent_activities (agent_id, activity_type, description, created_at)
      VALUES (?, 'went_offline', 'Agent went offline', NOW())
    `, [agentId]);

    res.json({
      success: true,
      message: 'You are now offline',
      status: 'offline'
    });
  } catch (error) {
    console.error('Go offline error:', error);
    res.status(500).json({ error: 'Failed to go offline' });
  }
});

/**
 * Update Location
 * POST /api/fast-delivery-agent/update-location
 */
router.post('/update-location', authenticateToken, verifyFastDeliveryAgent, async (req, res) => {
  try {
    const agentId = req.agent.id;
    const { latitude, longitude, accuracy, heading, speed } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const location = { lat: latitude, lng: longitude };

    // Update agent's current location
    await pool.query(
      'UPDATE agents SET current_location = ?, last_active = NOW() WHERE id = ?',
      [JSON.stringify(location), agentId]
    );

    // Record location tracking
    await pool.query(`
      INSERT INTO agent_location_tracking (agent_id, latitude, longitude, accuracy, heading, speed, recorded_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `, [agentId, latitude, longitude, accuracy, heading, speed]);

    res.json({
      success: true,
      message: 'Location updated successfully',
      location: location
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

/**
 * Get Earnings
 * GET /api/fast-delivery-agent/earnings
 */
router.get('/earnings', authenticateToken, verifyFastDeliveryAgent, async (req, res) => {
  try {
    const agentId = req.agent.id;
    const { period = 'today' } = req.query;

    let dateFilter = '';
    let params = [agentId];

    switch (period) {
      case 'today':
        dateFilter = 'AND DATE(earned_at) = CURDATE()';
        break;
      case 'week':
        dateFilter = 'AND WEEK(earned_at) = WEEK(NOW()) AND YEAR(earned_at) = YEAR(NOW())';
        break;
      case 'month':
        dateFilter = 'AND MONTH(earned_at) = MONTH(NOW()) AND YEAR(earned_at) = YEAR(NOW())';
        break;
      case 'all':
        dateFilter = '';
        break;
    }

    const [earnings] = await pool.query(`
      SELECT 
        SUM(amount) as total_earnings,
        COUNT(*) as total_orders,
        AVG(amount) as average_per_order,
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as paid_earnings,
        SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_earnings
      FROM agent_earnings 
      WHERE agent_id = ? ${dateFilter}
    `, params);

    // Get recent earnings details
    const [recentEarnings] = await pool.query(`
      SELECT 
        ae.*,
        go.order_number,
        go.total_amount as order_total
      FROM agent_earnings ae
      LEFT JOIN grocery_orders go ON ae.order_id = go.id
      WHERE ae.agent_id = ? ${dateFilter}
      ORDER BY ae.earned_at DESC
      LIMIT 10
    `, params);

    res.json({
      success: true,
      earnings: {
        summary: earnings[0] || {
          total_earnings: 0,
          total_orders: 0,
          average_per_order: 0,
          paid_earnings: 0,
          pending_earnings: 0
        },
        recent: recentEarnings,
        period: period
      }
    });
  } catch (error) {
    console.error('Get earnings error:', error);
    res.status(500).json({ error: 'Failed to get earnings data' });
  }
});

/**
 * Get Order History
 * GET /api/fast-delivery-agent/order-history
 */
router.get('/order-history', authenticateToken, verifyFastDeliveryAgent, async (req, res) => {
  try {
    const agentId = req.agent.id;
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    let statusFilter = '';
    let params = [agentId];

    if (status && status !== 'all') {
      statusFilter = 'AND go.status = ?';
      params.push(status);
    }

    params.push(parseInt(limit), offset);

    const [orders] = await pool.query(`
      SELECT 
        go.*,
        u.username as buyer_name,
        u.email as buyer_email,
        u.phone as buyer_phone,
        (SELECT COUNT(*) FROM grocery_order_items WHERE order_id = go.id) as item_count
      FROM grocery_orders go
      LEFT JOIN users u ON go.user_id = u.id
      WHERE go.agent_id = ? ${statusFilter}
      ORDER BY go.created_at DESC
      LIMIT ? OFFSET ?
    `, params);

    // Get total count
    const [countResult] = await pool.query(`
      SELECT COUNT(*) as total
      FROM grocery_orders go
      WHERE go.agent_id = ? ${statusFilter}
    `, params.slice(0, -2)); // Remove limit and offset

    const ordersWithDetails = orders.map(order => ({
      ...order,
      commission: order.agent_commission || calculateCommission(order.total_amount)
    }));

    res.json({
      success: true,
      orders: ordersWithDetails,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Get order history error:', error);
    res.status(500).json({ error: 'Failed to get order history' });
  }
});

/**
 * Report Issue
 * POST /api/fast-delivery-agent/report-issue/:orderId
 */
router.post('/report-issue/:orderId', authenticateToken, verifyFastDeliveryAgent, upload.array('photos', 5), async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const agentId = req.agent.id;
    const { issue_type, description } = req.body;

    // Check if order belongs to agent
    const [orders] = await pool.query(
      'SELECT * FROM grocery_orders WHERE id = ? AND agent_id = ?',
      [orderId, agentId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found or not assigned to you' });
    }

    // Handle uploaded photos
    const photos = req.files ? req.files.map(file => file.filename) : [];

    // Insert issue record
    const [issueResult] = await pool.query(`
      INSERT INTO order_issues (order_id, agent_id, issue_type, description, photos, reported_at)
      VALUES (?, ?, ?, ?, ?, NOW())
    `, [orderId, agentId, issue_type, description, JSON.stringify(photos)]);

    // Update order with issue information
    await pool.query(`
      UPDATE grocery_orders 
      SET issue_type = ?, issue_description = ?, issue_reported_at = NOW(), issue_id = ?
      WHERE id = ?
    `, [issue_type, description, issueResult.insertId, orderId]);

    // Block seller payment if issue is at pickup
    if (issue_type.includes('pickup') || issue_type.includes('seller')) {
      await pool.query(`
        UPDATE grocery_orders 
        SET seller_payment_status = 'blocked', seller_payment_blocked_reason = ?
        WHERE id = ?
      `, [`Issue reported: ${issue_type}`, orderId]);
    }

    // Log activity
    await pool.query(`
      INSERT INTO agent_activities (agent_id, activity_type, order_id, description, created_at)
      VALUES (?, 'issue_reported', ?, ?, NOW())
    `, [agentId, orderId, `Issue reported: ${issue_type}`]);

    res.json({
      success: true,
      message: 'Issue reported successfully',
      issue_id: issueResult.insertId
    });
  } catch (error) {
    console.error('Report issue error:', error);
    res.status(500).json({ error: 'Failed to report issue' });
  }
});

/**
 * Confirm Delivery
 * POST /api/fast-delivery-agent/confirm-delivery/:orderId
 */
router.post('/confirm-delivery/:orderId', authenticateToken, verifyFastDeliveryAgent, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const agentId = req.agent.id;
    const { delivery_code, confirmed_by_buyer, delivery_notes } = req.body;

    // Check if order belongs to agent and is delivered
    const [orders] = await pool.query(
      'SELECT * FROM grocery_orders WHERE id = ? AND agent_id = ? AND status = "delivered"',
      [orderId, agentId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found, not assigned to you, or not delivered yet' });
    }

    const order = orders[0];

    // Verify delivery code
    if (order.delivery_code !== delivery_code) {
      return res.status(400).json({ error: 'Invalid delivery code' });
    }

    // Update order with confirmation details
    await pool.query(`
      UPDATE grocery_orders 
      SET buyer_confirmed = TRUE, buyer_confirmed_at = NOW(), 
          confirmed_by_buyer = ?, final_delivery_notes = ?
      WHERE id = ?
    `, [confirmed_by_buyer, delivery_notes, orderId]);

    // Set grace period end (5 minutes from now)
    await pool.query(`
      UPDATE grocery_orders 
      SET dispute_grace_period_end = DATE_ADD(NOW(), INTERVAL 5 MINUTE)
      WHERE id = ?
    `, [orderId]);

    res.json({
      success: true,
      message: 'Delivery confirmed successfully',
      grace_period_end: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      commission_approval_pending: true
    });
  } catch (error) {
    console.error('Confirm delivery error:', error);
    res.status(500).json({ error: 'Failed to confirm delivery' });
  }
});

module.exports = router;