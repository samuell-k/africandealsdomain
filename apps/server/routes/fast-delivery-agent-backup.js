/**
 * Fast Delivery Agent Routes - Complete Implementation
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
  const distance = R * c; // Distance in km
  return Math.round(distance * 100) / 100; // Round to 2 decimal places
}

/**
 * Get Agent Profile
 * GET /api/fast-delivery-agent/profile
 */
router.get('/profile', authenticateToken, verifyFastDeliveryAgent, async (req, res) => {
  try {
    const [agentData] = await pool.query(`
      SELECT 
        a.*,
        u.username,
        u.email,
        u.phone,
        AVG(ar.rating) as average_rating,
        COUNT(ar.id) as total_ratings
      FROM agents a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN agent_ratings ar ON a.id = ar.agent_id
      WHERE a.id = ?
      GROUP BY a.id
    `, [req.agent.id]);

    if (agentData.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.json({
      success: true,
      agent: {
        ...agentData[0],
        rating: parseFloat(agentData[0].average_rating || 0).toFixed(1)
      }
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

/**
 * Get Agent Statistics
 * GET /api/fast-delivery-agent/stats
 */
router.get('/stats', authenticateToken, verifyFastDeliveryAgent, async (req, res) => {
  try {
    const agentId = req.agent.id;

    // Today's stats
    const [todayStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as completed_orders,
        SUM(CASE WHEN status = 'delivered' THEN agent_commission ELSE 0 END) as today_earnings
      FROM grocery_orders 
      WHERE agent_id = ? AND DATE(created_at) = CURDATE()
    `, [agentId]);

    // Active orders count
    const [activeStats] = await pool.query(`
      SELECT COUNT(*) as active_count
      FROM grocery_orders 
      WHERE agent_id = ? AND status IN ('assigned', 'picked_from_seller', 'en_route')
    `, [agentId]);

    // Weekly stats
    const [weekStats] = await pool.query(`
      SELECT 
        COUNT(*) as week_orders,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as week_completed,
        SUM(CASE WHEN status = 'delivered' THEN agent_commission ELSE 0 END) as week_earnings
      FROM grocery_orders 
      WHERE agent_id = ? AND YEARWEEK(created_at) = YEARWEEK(NOW())
    `, [agentId]);

    // Agent rating
    const [ratingStats] = await pool.query(`
      SELECT 
        AVG(rating) as average_rating,
        COUNT(*) as total_ratings
      FROM agent_ratings 
      WHERE agent_id = ?
    `, [agentId]);

    res.json({
      success: true,
      stats: {
        today: {
          total: todayStats[0].total_orders || 0,
          completed: todayStats[0].completed_orders || 0,
          earnings: parseFloat(todayStats[0].today_earnings || 0)
        },
        week: {
          total: weekStats[0].week_orders || 0,
          completed: weekStats[0].week_completed || 0,
          earnings: parseFloat(weekStats[0].week_earnings || 0)
        },
        active: {
          count: activeStats[0].active_count || 0
        },
        rating: {
          average: parseFloat(ratingStats[0]?.average_rating || 0),
          total: ratingStats[0]?.total_ratings || 0
        }
      }
    });

  } catch (error) {
    console.error('Stats fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

/**
 * Get Available Orders (Local Market/Grocery Orders)
 * GET /api/fast-delivery-agent/available-orders
 */
router.get('/available-orders', authenticateToken, verifyFastDeliveryAgent, async (req, res) => {
  try {
    const agentId = req.agent.id;
    const { limit = 10, radius = 5 } = req.query;

    // Get agent's current location
    const agentLocation = req.agent.current_location ? JSON.parse(req.agent.current_location) : null;

    let query = `
      SELECT 
        go.*,
        u.username as buyer_name,
        u.email as buyer_email,
        u.phone as buyer_phone
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
        estimated_time = Math.max(Math.round(distance * 3), 10); // 3 minutes per km, minimum 10 minutes
      }

      return {
        ...order,
        distance,
        estimated_time,
        delivery_time_window: order.delivery_time_window || 'ASAP'
      };
    });

    // Filter by radius if location is available
    const filteredOrders = agentLocation ? 
      ordersWithDistance.filter(order => order.distance === null || order.distance <= radius) :
      ordersWithDistance;

    // Get order items for each order
    for (let order of filteredOrders) {
      const [items] = await pool.query(
        'SELECT * FROM grocery_order_items WHERE order_id = ?',
        [order.id]
      );
      order.items = items;
    }

    res.json({
      success: true,
      orders: filteredOrders,
      agentLocation: agentLocation,
      totalAvailable: filteredOrders.length
    });

  } catch (error) {
    console.error('Available orders fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch available orders' });
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
        u.phone as buyer_phone
      FROM grocery_orders go
      LEFT JOIN users u ON go.user_id = u.id
      WHERE go.agent_id = ? 
      AND go.status IN ('assigned', 'picked_from_seller', 'en_route', 'arriving')
      ORDER BY go.created_at DESC
    `, [agentId]);

    // Get order items for each order
    for (let order of orders) {
      const [items] = await pool.query(
        'SELECT * FROM grocery_order_items WHERE order_id = ?',
        [order.id]
      );
      order.items = items;
    }

    res.json({
      success: true,
      orders: orders
    });

  } catch (error) {
    console.error('Active orders fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch active orders' });
  }
});

/**
 * Accept Order (with order locking to prevent double assignment)
 * POST /api/fast-delivery-agent/accept-order/:orderId
 */
router.post('/accept-order/:orderId', authenticateToken, verifyFastDeliveryAgent, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const orderId = req.params.orderId;
    const agentId = req.agent.id;

    // Lock the order row to prevent concurrent access
    const [orders] = await connection.query(
      'SELECT * FROM grocery_orders WHERE id = ? AND agent_id IS NULL AND status IN ("pending", "confirmed") FOR UPDATE',
      [orderId]
    );

    if (orders.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Order not available for assignment or already taken by another agent' });
    }

    const order = orders[0];

    // Check agent capacity (max 5 concurrent orders for fast delivery)
    const [currentOrders] = await connection.query(
      'SELECT COUNT(*) as count FROM grocery_orders WHERE agent_id = ? AND status IN ("assigned", "picked_from_seller", "en_route")',
      [agentId]
    );

    if (currentOrders[0].count >= 5) {
      await connection.rollback();
      return res.status(400).json({ error: 'Maximum concurrent orders reached (5)' });
    }

    // Assign order to agent
    await connection.query(
      'UPDATE grocery_orders SET agent_id = ?, status = "assigned", agent_assigned_at = NOW(), updated_at = NOW() WHERE id = ?',
      [agentId, orderId]
    );

    // Generate delivery code
    const deliveryCode = Math.random().toString(36).substr(2, 6).toUpperCase();
    await connection.query(
      'UPDATE grocery_orders SET delivery_code = ? WHERE id = ?',
      [deliveryCode, orderId]
    );

    // Log activity
    await connection.query(
      'INSERT INTO agent_activities (agent_id, activity_type, order_id, description, created_at) VALUES (?, "order_accepted", ?, "Grocery order accepted and assigned", NOW())',
      [agentId, orderId]
    );

    await connection.commit();

    // Send notification to buyer via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${order.user_id}`).emit('agent_assigned', {
        orderId: orderId,
        agentDetails: {
          id: agentId,
          name: req.agent.name,
          phone: req.agent.phone,
          rating: req.agent.average_rating || 0
        },
        deliveryCode: deliveryCode,
        estimatedTime: '15-30 minutes'
      });
    }

    res.json({
      success: true,
      message: 'Order accepted successfully',
      order: {
        id: orderId,
        order_number: order.order_number,
        delivery_code: deliveryCode,
        status: 'assigned',
        assigned_at: new Date().toISOString(),
        buyer_details: {
          name: order.buyer_name,
          phone: order.buyer_phone,
          address: order.delivery_address
        },
        seller_details: {
          name: order.seller_name,
          phone: order.seller_phone,
          address: order.pickup_address
        }
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error('Order acceptance error:', error);
    res.status(500).json({ error: 'Failed to accept order' });
  } finally {
    connection.release();
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
      WHERE go.id = ? AND (go.agent_id = ? OR go.agent_id IS NULL)
    `, [orderId, agentId]);

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orders[0];

    // Get order items
    const [items] = await pool.query(
      'SELECT * FROM grocery_order_items WHERE order_id = ?',
      [orderId]
    );

    order.items = items;

    res.json({
      success: true,
      order: order
    });

  } catch (error) {
    console.error('Order details fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch order details' });
  }
});

/**
 * Update Order Status (with GPS verification)
 * PUT /api/fast-delivery-agent/update-status/:orderId
 */
router.put('/update-status/:orderId', authenticateToken, verifyFastDeliveryAgent, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const agentId = req.agent.id;
    const { status, notes, location, issue_type, issue_description } = req.body;

    // Validate status
    const validStatuses = ['assigned', 'arrived_at_seller', 'picked_from_seller', 'en_route', 'arrived_at_buyer', 'delivered', 'issue_at_pickup', 'delivery_failed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Verify order belongs to agent
    const [orders] = await pool.query(
      'SELECT * FROM grocery_orders WHERE id = ? AND agent_id = ?',
      [orderId, agentId]
    );

    if (orders.length === 0) {
      return res.status(403).json({ error: 'Order not assigned to this agent' });
    }

    const order = orders[0];

    // GPS verification for critical status updates
    if (location && (status === 'arrived_at_seller' || status === 'picked_from_seller' || status === 'arrived_at_buyer' || status === 'delivered')) {
      const requiredRadius = 0.1; // 100 meters
      let targetLat, targetLng;

      if (status === 'arrived_at_seller' || status === 'picked_from_seller') {
        targetLat = order.pickup_lat;
        targetLng = order.pickup_lng;
      } else {
        targetLat = order.delivery_lat;
        targetLng = order.delivery_lng;
      }

      if (targetLat && targetLng) {
        const distance = calculateDistance(location.latitude, location.longitude, targetLat, targetLng);
        if (distance > requiredRadius) {
          return res.status(400).json({ 
            error: `You must be within ${requiredRadius * 1000}m of the ${status.includes('seller') ? 'pickup' : 'delivery'} location to update status`,
            distance: Math.round(distance * 1000),
            required: Math.round(requiredRadius * 1000)
          });
        }
      }
    }

    // Update order status
    let updateQuery = 'UPDATE grocery_orders SET status = ?, agent_delivery_notes = ?, updated_at = NOW()';
    let updateParams = [status, notes || null];

    // Handle specific status updates
    if (status === 'arrived_at_seller') {
      updateQuery += ', arrived_at_seller_time = NOW()';
    } else if (status === 'picked_from_seller') {
      updateQuery += ', actual_pickup_time = NOW()';
      // Trigger seller payment release for local market orders
      await triggerSellerPaymentRelease(orderId, order);
    } else if (status === 'arrived_at_buyer') {
      updateQuery += ', arrived_at_buyer_time = NOW()';
    } else if (status === 'delivered') {
      updateQuery += ', actual_delivery_time = NOW(), delivered_at = NOW()';
      
      if (location) {
        updateQuery += ', delivery_confirmed_lat = ?, delivery_confirmed_lng = ?';
        updateParams.push(location.latitude, location.longitude);
      }
    } else if (status === 'issue_at_pickup') {
      updateQuery += ', issue_type = ?, issue_description = ?, issue_reported_at = NOW()';
      updateParams.push(issue_type || 'pickup_issue', issue_description || notes);
    } else if (status === 'delivery_failed') {
      updateQuery += ', delivery_failed_reason = ?, delivery_failed_at = NOW()';
      updateParams.push(notes || 'Buyer not available');
    }

    updateQuery += ' WHERE id = ?';
    updateParams.push(orderId);

    await pool.query(updateQuery, updateParams);

    // Log status change
    await pool.query(
      'INSERT INTO order_status_history (order_id, status, notes, changed_by, changed_at) VALUES (?, ?, ?, ?, NOW())',
      [orderId, status, notes || null, agentId]
    );

    // Log agent activity
    await pool.query(
      'INSERT INTO agent_activities (agent_id, activity_type, order_id, description, created_at) VALUES (?, "status_update", ?, ?, NOW())',
      [agentId, orderId, `Order status updated to ${status}`]
    );

    // Handle delivery completion
    if (status === 'delivered') {
      await handleDeliveryCompletion(orderId, agentId, order);
    }

    // Handle issues
    if (status === 'issue_at_pickup' || status === 'delivery_failed') {
      await handleOrderIssue(orderId, agentId, order, status, issue_type, issue_description || notes);
    }

    // Send real-time updates via Socket.IO
    const io = req.app.get('io');
    if (io) {
      // Notify buyer
      io.to(`user_${order.user_id}`).emit('tracking_update', {
        orderId: orderId,
        status: status,
        notes: notes,
        location: location,
        timestamp: new Date().toISOString(),
        agentId: agentId
      });

      // Notify order room
      io.to(`order_${orderId}`).emit('delivery_status_changed', {
        orderId: orderId,
        status: status,
        agentId: agentId,
        agentName: req.agent.name,
        timestamp: new Date().toISOString(),
        notes: notes
      });
    }

    res.json({
      success: true,
      message: 'Order status updated successfully',
      status: status,
      timestamp: new Date().toISOString(),
      location_verified: location ? true : false
    });

  } catch (error) {
    console.error('Status update error:', error);
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

    // Update agent status and location
    let updateQuery = 'UPDATE agents SET status = "available", updated_at = NOW()';
    let updateParams = [];

    if (location) {
      updateQuery += ', current_location = ?';
      updateParams.push(JSON.stringify({
        lat: location.latitude,
        lng: location.longitude,
        accuracy: location.accuracy,
        timestamp: new Date().toISOString()
      }));
    }

    updateQuery += ' WHERE id = ?';
    updateParams.push(agentId);

    await pool.query(updateQuery, updateParams);

    // Log activity
    await pool.query(
      'INSERT INTO agent_activities (agent_id, activity_type, description, created_at) VALUES (?, "status_change", "Agent went online", NOW())',
      [agentId]
    );

    res.json({
      success: true,
      message: 'Agent is now online and available for orders',
      status: 'available'
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

    // Update agent status
    await pool.query(
      'UPDATE agents SET status = "offline", updated_at = NOW() WHERE id = ?',
      [agentId]
    );

    // Log activity
    await pool.query(
      'INSERT INTO agent_activities (agent_id, activity_type, description, created_at) VALUES (?, "status_change", "Agent went offline", NOW())',
      [agentId]
    );

    res.json({
      success: true,
      message: 'Agent is now offline',
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

    // Validate coordinates
    if (!latitude || !longitude || 
        latitude < -90 || latitude > 90 || 
        longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: 'Invalid GPS coordinates' });
    }

    // Update agent's current location
    await pool.query(
      'UPDATE agents SET current_location = ?, updated_at = NOW() WHERE id = ?',
      [JSON.stringify({
        lat: latitude,
        lng: longitude,
        accuracy: accuracy || null,
        heading: heading || null,
        speed: speed || null,
        timestamp: new Date().toISOString()
      }), agentId]
    );

    // Log location in tracking table
    await pool.query(
      'INSERT INTO agent_location_tracking (agent_id, latitude, longitude, accuracy, heading, speed, recorded_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
      [agentId, latitude, longitude, accuracy || null, heading || null, speed || null]
    );

    res.json({
      success: true,
      message: 'Location updated successfully',
      location: { latitude, longitude, accuracy, heading, speed },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Location update error:', error);
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
    const { period = 'week' } = req.query;

    let dateFilter = '';
    if (period === 'today') {
      dateFilter = 'AND DATE(go.delivered_at) = CURDATE()';
    } else if (period === 'week') {
      dateFilter = 'AND YEARWEEK(go.delivered_at) = YEARWEEK(NOW())';
    } else if (period === 'month') {
      dateFilter = 'AND YEAR(go.delivered_at) = YEAR(NOW()) AND MONTH(go.delivered_at) = MONTH(NOW())';
    }

    const [earnings] = await pool.query(`
      SELECT 
        COUNT(*) as total_deliveries,
        SUM(agent_commission) as total_earnings,
        AVG(agent_commission) as average_commission,
        MIN(agent_commission) as min_commission,
        MAX(agent_commission) as max_commission
      FROM grocery_orders go
      WHERE go.agent_id = ? 
      AND go.status = 'delivered' 
      AND go.agent_commission IS NOT NULL
      ${dateFilter}
    `, [agentId]);

    // Get detailed earnings breakdown
    const [breakdown] = await pool.query(`
      SELECT 
        DATE(go.delivered_at) as delivery_date,
        COUNT(*) as deliveries,
        SUM(agent_commission) as daily_earnings
      FROM grocery_orders go
      WHERE go.agent_id = ? 
      AND go.status = 'delivered' 
      AND go.agent_commission IS NOT NULL
      ${dateFilter}
      GROUP BY DATE(go.delivered_at)
      ORDER BY delivery_date DESC
    `, [agentId]);

    res.json({
      success: true,
      earnings: {
        summary: {
          total_deliveries: earnings[0].total_deliveries || 0,
          total_earnings: parseFloat(earnings[0].total_earnings || 0),
          average_commission: parseFloat(earnings[0].average_commission || 0),
          min_commission: parseFloat(earnings[0].min_commission || 0),
          max_commission: parseFloat(earnings[0].max_commission || 0)
        },
        breakdown: breakdown.map(item => ({
          date: item.delivery_date,
          deliveries: item.deliveries,
          earnings: parseFloat(item.daily_earnings)
        })),
        period: period
      }
    });

  } catch (error) {
    console.error('Earnings fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch earnings' });
  }
});

/**
 * Confirm Buyer Delivery (by buyer or agent)
 * POST /api/fast-delivery-agent/confirm-delivery/:orderId
 */
router.post('/confirm-delivery/:orderId', authenticateToken, verifyFastDeliveryAgent, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const agentId = req.agent.id;
    const { delivery_code, confirmed_by_buyer = false, buyer_signature, delivery_notes } = req.body;

    // Verify order belongs to agent and is delivered
    const [orders] = await pool.query(
      'SELECT * FROM grocery_orders WHERE id = ? AND agent_id = ? AND status = "delivered"',
      [orderId, agentId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found or not in delivered status' });
    }

    const order = orders[0];

    // Verify delivery code if provided
    if (delivery_code && delivery_code !== order.delivery_code) {
      return res.status(400).json({ error: 'Invalid delivery code' });
    }

    // Update order with buyer confirmation
    await pool.query(
      'UPDATE grocery_orders SET buyer_confirmed = 1, buyer_confirmed_at = NOW(), confirmed_by_buyer = ?, buyer_signature = ?, final_delivery_notes = ? WHERE id = ?',
      [confirmed_by_buyer ? 1 : 0, buyer_signature || null, delivery_notes || null, orderId]
    );

    // Start grace period for disputes (5 minutes)
    const gracePeriodEnd = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
    await pool.query(
      'UPDATE grocery_orders SET dispute_grace_period_end = ? WHERE id = ?',
      [gracePeriodEnd, orderId]
    );

    // Schedule commission approval after grace period
    setTimeout(async () => {
      await approveAgentCommission(orderId, agentId);
    }, 5 * 60 * 1000); // 5 minutes

    res.json({
      success: true,
      message: 'Delivery confirmed successfully',
      grace_period_end: gracePeriodEnd.toISOString(),
      commission_approval_pending: true
    });

  } catch (error) {
    console.error('Delivery confirmation error:', error);
    res.status(500).json({ error: 'Failed to confirm delivery' });
  }
});

/**
 * Report Issue with Order
 * POST /api/fast-delivery-agent/report-issue/:orderId
 */
router.post('/report-issue/:orderId', authenticateToken, verifyFastDeliveryAgent, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const agentId = req.agent.id;
    const { issue_type, description, photos } = req.body;

    // Verify order belongs to agent
    const [orders] = await pool.query(
      'SELECT * FROM grocery_orders WHERE id = ? AND agent_id = ?',
      [orderId, agentId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Create issue record
    const [result] = await pool.query(
      'INSERT INTO order_issues (order_id, agent_id, issue_type, description, photos, reported_at, status) VALUES (?, ?, ?, ?, ?, NOW(), "open")',
      [orderId, agentId, issue_type, description, JSON.stringify(photos || [])]
    );

    // Update order status
    await pool.query(
      'UPDATE grocery_orders SET status = "issue_reported", issue_id = ? WHERE id = ?',
      [result.insertId, orderId]
    );

    // Notify admin
    const io = req.app.get('io');
    if (io) {
      io.emit('admin_notification', {
        type: 'order_issue',
        orderId: orderId,
        agentId: agentId,
        issueType: issue_type,
        description: description,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'Issue reported successfully',
      issue_id: result.insertId
    });

  } catch (error) {
    console.error('Issue reporting error:', error);
    res.status(500).json({ error: 'Failed to report issue' });
  }
});

/**
 * Get Order History
 * GET /api/fast-delivery-agent/order-history
 */
router.get('/order-history', authenticateToken, verifyFastDeliveryAgent, async (req, res) => {
  try {
    const agentId = req.agent.id;
    const { page = 1, limit = 20, status, period } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE go.agent_id = ?';
    let queryParams = [agentId];

    if (status) {
      whereClause += ' AND go.status = ?';
      queryParams.push(status);
    }

    if (period) {
      if (period === 'today') {
        whereClause += ' AND DATE(go.created_at) = CURDATE()';
      } else if (period === 'week') {
        whereClause += ' AND YEARWEEK(go.created_at) = YEARWEEK(NOW())';
      } else if (period === 'month') {
        whereClause += ' AND YEAR(go.created_at) = YEAR(NOW()) AND MONTH(go.created_at) = MONTH(NOW())';
      }
    }

    const [orders] = await pool.query(`
      SELECT 
        go.*,
        u.username as buyer_name,
        u.phone as buyer_phone,
        COUNT(goi.id) as item_count,
        SUM(goi.quantity) as total_items
      FROM grocery_orders go
      LEFT JOIN users u ON go.user_id = u.id
      LEFT JOIN grocery_order_items goi ON go.id = goi.order_id
      ${whereClause}
      GROUP BY go.id
      ORDER BY go.created_at DESC
      LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), parseInt(offset)]);

    // Get total count
    const [countResult] = await pool.query(`
      SELECT COUNT(*) as total
      FROM grocery_orders go
      ${whereClause}
    `, queryParams);

    res.json({
      success: true,
      orders: orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / limit)
      }
    });

  } catch (error) {
    console.error('Order history fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch order history' });
  }
});

// Helper function to handle delivery completion
async function handleDeliveryCompletion(orderId, agentId, order) {
  try {
    // Calculate commission based on 21% distribution logic
    // Fast delivery agents get 15% of total order value
    const commissionRate = 15;
    const commission = (order.total_amount * commissionRate) / 100;

    // Update commission
    await pool.query(
      'UPDATE grocery_orders SET agent_commission = ?, commission_calculated = 1 WHERE id = ?',
      [commission, orderId]
    );

    // Update agent earnings
    await pool.query(
      'UPDATE agents SET total_earnings = total_earnings + ?, total_deliveries = total_deliveries + 1 WHERE id = ?',
      [commission, agentId]
    );

    // Create earnings record
    await pool.query(
      'INSERT INTO agent_earnings (agent_id, order_id, amount, commission_rate, earned_at, status) VALUES (?, ?, ?, ?, NOW(), "pending")',
      [agentId, orderId, commission, commissionRate]
    );

  } catch (error) {
    console.error('Delivery completion handling error:', error);
  }
}

// Helper function to trigger seller payment release
async function triggerSellerPaymentRelease(orderId, order) {
  try {
    // For local market orders, release seller payment immediately after pickup
    await pool.query(
      'UPDATE grocery_orders SET seller_payment_status = "approved", seller_payment_approved_at = NOW() WHERE id = ?',
      [orderId]
    );

    // Create seller payout request
    await pool.query(
      'INSERT INTO seller_payouts (order_id, seller_id, amount, status, requested_at) VALUES (?, ?, ?, "approved", NOW())',
      [orderId, order.seller_id, order.seller_amount]
    );

    console.log(`[FAST-DELIVERY] Seller payment released for order ${orderId}`);

  } catch (error) {
    console.error('Seller payment release error:', error);
  }
}

// Helper function to handle order issues
async function handleOrderIssue(orderId, agentId, order, status, issueType, description) {
  try {
    // Block seller payment if issue at pickup
    if (status === 'issue_at_pickup') {
      await pool.query(
        'UPDATE grocery_orders SET seller_payment_status = "blocked", seller_payment_blocked_reason = ? WHERE id = ?',
        [description, orderId]
      );
    }

    // Create issue record
    await pool.query(
      'INSERT INTO order_issues (order_id, agent_id, issue_type, description, reported_at, status) VALUES (?, ?, ?, ?, NOW(), "open")',
      [orderId, agentId, issueType || status, description]
    );

    // Notify admin for review
    console.log(`[FAST-DELIVERY] Issue reported for order ${orderId}: ${issueType || status}`);

  } catch (error) {
    console.error('Order issue handling error:', error);
  }
}

// Helper function to approve agent commission after grace period
async function approveAgentCommission(orderId, agentId) {
  try {
    // Check if grace period has passed and no disputes
    const [orders] = await pool.query(
      'SELECT * FROM grocery_orders WHERE id = ? AND dispute_grace_period_end < NOW() AND buyer_confirmed = 1',
      [orderId]
    );

    if (orders.length > 0) {
      // Approve agent commission
      await pool.query(
        'UPDATE agent_earnings SET status = "approved", approved_at = NOW() WHERE order_id = ? AND agent_id = ?',
        [orderId, agentId]
      );

      console.log(`[FAST-DELIVERY] Commission approved for agent ${agentId}, order ${orderId}`);
    }

  } catch (error) {
    console.error('Commission approval error:', error);
  }
}

module.exports = router;

// Middleware to check if user is fast delivery agent
const requireFastDeliveryAgent = async (req, res, next) => {
  try {
    const [agents] = await pool.query(
      'SELECT * FROM agents WHERE user_id = ? AND agent_type = "fast_delivery"',
      [req.user.id]
    );
    
    if (agents.length === 0) {
      return res.status(403).json({ error: 'Fast delivery agent access required' });
    }
    
    req.agent = agents[0];
    next();
  } catch (error) {
    console.error('Fast delivery agent middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

// GET /api/fast-delivery-agent/dashboard - Get dashboard data
router.get('/dashboard', authenticateToken, requireFastDeliveryAgent, async (req, res) => {
  try {
    // Get today's stats
    const [todayStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as completed_orders,
        SUM(CASE WHEN status IN ('assigned', 'shopping', 'picked_up', 'in_transit') THEN 1 ELSE 0 END) as active_orders,
        SUM(CASE WHEN status = 'delivered' THEN agent_commission ELSE 0 END) as today_earnings
      FROM grocery_orders 
      WHERE agent_id = ? AND DATE(created_at) = CURDATE()
    `, [req.agent.id]);

    // Get weekly stats
    const [weeklyStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(CASE WHEN status = 'delivered' THEN agent_commission ELSE 0 END) as weekly_earnings,
        AVG(CASE WHEN status = 'delivered' THEN TIMESTAMPDIFF(MINUTE, created_at, delivered_at) ELSE NULL END) as avg_delivery_time
      FROM grocery_orders 
      WHERE agent_id = ? AND YEARWEEK(created_at) = YEARWEEK(NOW())
    `, [req.agent.id]);

    // Get current location and availability
    const [agentStatus] = await pool.query(`
      SELECT current_lat, current_lng, is_available, status, trust_level, average_rating
      FROM agents WHERE id = ?
    `, [req.agent.id]);

    res.json({
      todayStats: todayStats[0],
      weeklyStats: weeklyStats[0],
      agentStatus: agentStatus[0]
    });

  } catch (error) {
    console.error('Fast delivery dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
});

// GET /api/fast-delivery-agent/available-orders - Get available grocery orders
router.get('/available-orders', authenticateToken, requireFastDeliveryAgent, async (req, res) => {
  try {
    const { lat, lng } = req.query;
    
    const [orders] = await pool.query(`
      SELECT 
        go.*,
        u.username as buyer_name,
        u.phone as buyer_phone,
        u.email as buyer_email
      FROM grocery_orders go
      LEFT JOIN users u ON go.buyer_id = u.id
      WHERE go.status = 'pending' 
        AND go.agent_id IS NULL
      ORDER BY go.created_at ASC
      LIMIT 20
    `);

    // Calculate distances if agent location provided
    const ordersWithDistance = orders.map(order => {
      const deliveryAddress = JSON.parse(order.delivery_address);
      let distance = null;
      
      if (lat && lng && deliveryAddress.lat && deliveryAddress.lng) {
        distance = calculateDistance(
          parseFloat(lat), parseFloat(lng),
          deliveryAddress.lat, deliveryAddress.lng
        );
      }
      
      return {
        ...order,
        delivery_address: deliveryAddress,
        shopping_list: JSON.parse(order.shopping_list),
        delivery_time_window: order.delivery_time_window ? JSON.parse(order.delivery_time_window) : null,
        distance: distance ? Math.round(distance * 100) / 100 : null
      };
    });

    // Sort by distance if available
    if (lat && lng) {
      ordersWithDistance.sort((a, b) => {
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
    }

    res.json({ orders: ordersWithDistance });

  } catch (error) {
    console.error('Get available orders error:', error);
    res.status(500).json({ error: 'Failed to get available orders' });
  }
});

// POST /api/fast-delivery-agent/accept-order/:orderId - Accept a grocery order
router.post('/accept-order/:orderId', authenticateToken, requireFastDeliveryAgent, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { estimated_delivery_time } = req.body;

    // Check if order is still available
    const [orders] = await pool.query(`
      SELECT * FROM grocery_orders 
      WHERE id = ? AND status = 'pending' AND agent_id IS NULL
    `, [orderId]);

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not available or already assigned' });
    }

    // Check agent's current workload
    const [activeOrders] = await pool.query(`
      SELECT COUNT(*) as count FROM grocery_orders 
      WHERE agent_id = ? AND status IN ('assigned', 'shopping', 'picked_up', 'in_transit')
    `, [req.agent.id]);

    const maxConcurrentOrders = 5; // This could be configurable
    if (activeOrders[0].count >= maxConcurrentOrders) {
      return res.status(400).json({ error: 'Maximum concurrent orders reached' });
    }

    // Assign order to agent
    await pool.query(`
      UPDATE grocery_orders 
      SET agent_id = ?, status = 'assigned', updated_at = NOW()
      WHERE id = ?
    `, [req.agent.id, orderId]);

    // Create assignment record
    await pool.query(`
      INSERT INTO agent_assignments (order_id, agent_id, assignment_type, status)
      VALUES (?, ?, 'fast_delivery', 'accepted')
    `, [orderId, req.agent.id]);

    // Update agent availability if this is their first active order
    if (activeOrders[0].count === 0) {
      await pool.query(`
        UPDATE agents SET is_available = FALSE WHERE id = ?
      `, [req.agent.id]);
    }

    // Notify buyer via socket.io if available
    const io = req.app.get('io');
    if (io) {
      const order = orders[0];
      io.to(`user_${order.buyer_id}`).emit('order_assigned', {
        orderId: orderId,
        agentId: req.agent.id,
        estimatedDeliveryTime: estimated_delivery_time,
        message: 'Your grocery order has been assigned to a delivery agent'
      });
    }

    res.json({ message: 'Order accepted successfully' });

  } catch (error) {
    console.error('Accept order error:', error);
    res.status(500).json({ error: 'Failed to accept order' });
  }
});

// GET /api/fast-delivery-agent/my-orders - Get agent's assigned orders
router.get('/my-orders', authenticateToken, requireFastDeliveryAgent, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE go.agent_id = ?';
    let queryParams = [req.agent.id];

    if (status && status !== 'all') {
      whereClause += ' AND go.status = ?';
      queryParams.push(status);
    }

    const [orders] = await pool.query(`
      SELECT 
        go.*,
        u.username as buyer_name,
        u.phone as buyer_phone,
        u.email as buyer_email
      FROM grocery_orders go
      LEFT JOIN users u ON go.buyer_id = u.id
      ${whereClause}
      ORDER BY go.created_at DESC
      LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), parseInt(offset)]);

    // Get total count
    const [countResult] = await pool.query(`
      SELECT COUNT(*) as total FROM grocery_orders go ${whereClause}
    `, queryParams);

    const processedOrders = orders.map(order => ({
      ...order,
      delivery_address: JSON.parse(order.delivery_address),
      shopping_list: JSON.parse(order.shopping_list),
      delivery_time_window: order.delivery_time_window ? JSON.parse(order.delivery_time_window) : null
    }));

    res.json({
      orders: processedOrders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / limit)
      }
    });

  } catch (error) {
    console.error('Get my orders error:', error);
    res.status(500).json({ error: 'Failed to get orders' });
  }
});

// PUT /api/fast-delivery-agent/order/:orderId/status - Update order status
router.put('/order/:orderId/status', authenticateToken, requireFastDeliveryAgent, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, notes, location } = req.body;

    const validStatuses = ['assigned', 'shopping', 'picked_up', 'in_transit', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Check if order belongs to this agent
    const [orders] = await pool.query(`
      SELECT * FROM grocery_orders WHERE id = ? AND agent_id = ?
    `, [orderId, req.agent.id]);

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found or not assigned to you' });
    }

    // Update order status
    const updateFields = ['status = ?', 'updated_at = NOW()'];
    const updateValues = [status];

    if (status === 'delivered') {
      updateFields.push('delivered_at = NOW()');
    }

    await pool.query(`
      UPDATE grocery_orders 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `, [...updateValues, orderId]);

    // Update assignment status
    await pool.query(`
      UPDATE agent_assignments 
      SET status = ?, ${status === 'delivered' ? 'completed_at = NOW()' : ''}
      WHERE order_id = ? AND agent_id = ?
    `, [status === 'delivered' ? 'completed' : 'in_progress', orderId, req.agent.id]);

    // Update agent location if provided
    if (location && location.lat && location.lng) {
      await pool.query(`
        UPDATE agents 
        SET current_lat = ?, current_lng = ?, last_location_update = NOW()
        WHERE id = ?
      `, [location.lat, location.lng, req.agent.id]);

      // Track location
      await pool.query(`
        INSERT INTO agent_location_tracking (agent_id, latitude, longitude, order_id)
        VALUES (?, ?, ?, ?)
      `, [req.agent.id, location.lat, location.lng, orderId]);
    }

    // If order completed, check if agent should be available again
    if (status === 'delivered' || status === 'cancelled') {
      const [activeOrders] = await pool.query(`
        SELECT COUNT(*) as count FROM grocery_orders 
        WHERE agent_id = ? AND status IN ('assigned', 'shopping', 'picked_up', 'in_transit')
      `, [req.agent.id]);

      if (activeOrders[0].count === 0) {
        await pool.query(`
          UPDATE agents SET is_available = TRUE WHERE id = ?
        `, [req.agent.id]);
      }
    }

    // Notify buyer via socket.io
    const io = req.app.get('io');
    if (io) {
      const order = orders[0];
      io.to(`user_${order.buyer_id}`).emit('delivery_status_update', {
        orderId: orderId,
        status: status,
        notes: notes,
        location: location,
        timestamp: new Date().toISOString()
      });
    }

    res.json({ message: 'Order status updated successfully' });

  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// POST /api/fast-delivery-agent/order/:orderId/receipt - Upload shopping receipt
router.post('/order/:orderId/receipt', authenticateToken, requireFastDeliveryAgent, upload.single('receipt'), async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'Receipt image is required' });
    }

    // Check if order belongs to this agent
    const [orders] = await pool.query(`
      SELECT * FROM grocery_orders WHERE id = ? AND agent_id = ?
    `, [orderId, req.agent.id]);

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found or not assigned to you' });
    }

    // Update order with receipt image
    await pool.query(`
      UPDATE grocery_orders 
      SET receipt_image = ?, updated_at = NOW()
      WHERE id = ?
    `, [req.file.filename, orderId]);

    res.json({ 
      message: 'Receipt uploaded successfully',
      receiptUrl: `/uploads/${req.file.filename}`
    });

  } catch (error) {
    console.error('Upload receipt error:', error);
    res.status(500).json({ error: 'Failed to upload receipt' });
  }
});

// POST /api/fast-delivery-agent/order/:orderId/delivery-proof - Upload delivery proof
router.post('/order/:orderId/delivery-proof', authenticateToken, requireFastDeliveryAgent, upload.single('proof'), async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'Delivery proof image is required' });
    }

    // Check if order belongs to this agent
    const [orders] = await pool.query(`
      SELECT * FROM grocery_orders WHERE id = ? AND agent_id = ?
    `, [orderId, req.agent.id]);

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found or not assigned to you' });
    }

    // Update order with delivery proof
    await pool.query(`
      UPDATE grocery_orders 
      SET delivery_proof_image = ?, updated_at = NOW()
      WHERE id = ?
    `, [req.file.filename, orderId]);

    res.json({ 
      message: 'Delivery proof uploaded successfully',
      proofUrl: `/uploads/${req.file.filename}`
    });

  } catch (error) {
    console.error('Upload delivery proof error:', error);
    res.status(500).json({ error: 'Failed to upload delivery proof' });
  }
});

// PUT /api/fast-delivery-agent/location - Update agent location
router.put('/location', authenticateToken, requireFastDeliveryAgent, async (req, res) => {
  try {
    const { lat, lng, accuracy, speed, heading } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    // Update agent location
    await pool.query(`
      UPDATE agents 
      SET current_lat = ?, current_lng = ?, last_location_update = NOW()
      WHERE id = ?
    `, [lat, lng, req.agent.id]);

    // Track location
    await pool.query(`
      INSERT INTO agent_location_tracking (agent_id, latitude, longitude, accuracy, speed, heading)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [req.agent.id, lat, lng, accuracy || null, speed || null, heading || null]);

    res.json({ message: 'Location updated successfully' });

  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// GET /api/fast-delivery-agent/earnings - Get earnings summary
router.get('/earnings', authenticateToken, requireFastDeliveryAgent, async (req, res) => {
  try {
    const { period = 'week' } = req.query;

    let dateCondition = '';
    switch (period) {
      case 'today':
        dateCondition = 'DATE(go.delivered_at) = CURDATE()';
        break;
      case 'week':
        dateCondition = 'YEARWEEK(go.delivered_at) = YEARWEEK(NOW())';
        break;
      case 'month':
        dateCondition = 'YEAR(go.delivered_at) = YEAR(NOW()) AND MONTH(go.delivered_at) = MONTH(NOW())';
        break;
      default:
        dateCondition = 'YEARWEEK(go.delivered_at) = YEARWEEK(NOW())';
    }

    const [earnings] = await pool.query(`
      SELECT 
        COUNT(*) as total_deliveries,
        SUM(agent_commission) as total_earnings,
        AVG(agent_commission) as avg_commission,
        SUM(delivery_fee) as total_delivery_fees
      FROM grocery_orders go
      WHERE go.agent_id = ? AND go.status = 'delivered' AND ${dateCondition}
    `, [req.agent.id]);

    // Get daily breakdown for the period
    const [dailyBreakdown] = await pool.query(`
      SELECT 
        DATE(go.delivered_at) as date,
        COUNT(*) as deliveries,
        SUM(agent_commission) as earnings
      FROM grocery_orders go
      WHERE go.agent_id = ? AND go.status = 'delivered' AND ${dateCondition}
      GROUP BY DATE(go.delivered_at)
      ORDER BY date DESC
    `, [req.agent.id]);

    res.json({
      summary: earnings[0],
      dailyBreakdown: dailyBreakdown
    });

  } catch (error) {
    console.error('Get earnings error:', error);
    res.status(500).json({ error: 'Failed to get earnings data' });
  }
});

// PUT /api/fast-delivery-agent/availability - Update availability status
router.put('/availability', authenticateToken, requireFastDeliveryAgent, async (req, res) => {
  try {
    const { is_available } = req.body;

    if (typeof is_available !== 'boolean') {
      return res.status(400).json({ error: 'is_available must be a boolean' });
    }

    // Check if agent has active orders
    if (is_available) {
      const [activeOrders] = await pool.query(`
        SELECT COUNT(*) as count FROM grocery_orders 
        WHERE agent_id = ? AND status IN ('assigned', 'shopping', 'picked_up', 'in_transit')
      `, [req.agent.id]);

      if (activeOrders[0].count > 0) {
        return res.status(400).json({ 
          error: 'Cannot set as available while having active orders' 
        });
      }
    }

    await pool.query(`
      UPDATE agents SET is_available = ?, last_active = NOW() WHERE id = ?
    `, [is_available, req.agent.id]);

    res.json({ message: 'Availability updated successfully' });

  } catch (error) {
    console.error('Update availability error:', error);
    res.status(500).json({ error: 'Failed to update availability' });
  }
});

module.exports = router;