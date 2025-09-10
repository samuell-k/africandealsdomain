/**
 * Real-Time GPS Tracking and Order Assignment System
 * Handles live agent tracking, order assignment, and real-time updates
 */

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

// Middleware to verify agent role
const verifyAgentRole = async (req, res, next) => {
  try {
    const [agents] = await pool.query(
      'SELECT * FROM agents WHERE user_id = ? AND status != "suspended"',
      [req.user.userId]
    );

    if (agents.length === 0) {
      return res.status(403).json({ error: 'Agent access required' });
    }

    req.agent = agents[0];
    next();
  } catch (error) {
    console.error('Agent verification error:', error);
    res.status(500).json({ error: 'Server error during agent verification' });
  }
};

/**
 * Update Agent GPS Location
 * POST /api/tracking/location
 */
router.post('/location', authenticateToken, verifyAgentRole, async (req, res) => {
  try {
    const { latitude, longitude, accuracy, heading, speed } = req.body;
    const agentId = req.agent.id;

    // Validate coordinates
    if (!latitude || !longitude || 
        latitude < -90 || latitude > 90 || 
        longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: 'Invalid GPS coordinates' });
    }

    // Update agent's current location
    await pool.query(
      `UPDATE agents 
       SET current_location = JSON_OBJECT(
         'lat', ?, 
         'lng', ?, 
         'accuracy', ?, 
         'heading', ?, 
         'speed', ?, 
         'timestamp', NOW()
       ), 
       updated_at = NOW() 
       WHERE id = ?`,
      [latitude, longitude, accuracy || null, heading || null, speed || null, agentId]
    );

    // Log location in tracking table
    await pool.query(
      `INSERT INTO agent_location_tracking 
       (agent_id, latitude, longitude, accuracy, heading, speed, recorded_at) 
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [agentId, latitude, longitude, accuracy || null, heading || null, speed || null]
    );

    // Check for nearby orders that need assignment
    const nearbyOrders = await findNearbyOrders(agentId, latitude, longitude, req.agent.agent_type);

    res.json({
      success: true,
      message: 'Location updated successfully',
      location: { latitude, longitude, accuracy, heading, speed },
      nearbyOrders: nearbyOrders.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Location update error:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

/**
 * Get Available Orders for Agent
 * GET /api/tracking/available-orders
 */
router.get('/available-orders', authenticateToken, verifyAgentRole, async (req, res) => {
  try {
    const agentId = req.agent.id;
    const agentType = req.agent.agent_type;
    const { limit = 10, radius = 5 } = req.query;

    // Get agent's current location
    const [locationResult] = await pool.query(
      'SELECT current_location FROM agents WHERE id = ?',
      [agentId]
    );

    if (!locationResult[0]?.current_location) {
      return res.json({
        success: true,
        orders: [],
        message: 'Please enable location services to see available orders'
      });
    }

    const agentLocation = JSON.parse(locationResult[0].current_location);
    
    let availableOrders = [];

    if (agentType === 'fast_delivery') {
      // Get grocery orders
      availableOrders = await getAvailableGroceryOrders(agentLocation, radius, limit);
    } else if (agentType === 'pickup_delivery') {
      // Get pickup orders
      availableOrders = await getAvailablePickupOrders(agentLocation, radius, limit);
    } else if (agentType === 'pickup_site_manager') {
      // Get orders for specific pickup site
      availableOrders = await getPickupSiteOrders(agentId, limit);
    }

    // Calculate distances and estimated times
    const ordersWithDistance = availableOrders.map(order => ({
      ...order,
      distance: calculateDistance(
        agentLocation.lat, 
        agentLocation.lng, 
        order.pickup_lat || order.delivery_lat, 
        order.pickup_lng || order.delivery_lng
      ),
      estimatedTime: calculateEstimatedTime(
        agentLocation.lat, 
        agentLocation.lng, 
        order.pickup_lat || order.delivery_lat, 
        order.pickup_lng || order.delivery_lng
      )
    }));

    // Sort by distance
    ordersWithDistance.sort((a, b) => a.distance - b.distance);

    res.json({
      success: true,
      orders: ordersWithDistance,
      agentLocation: agentLocation,
      totalAvailable: ordersWithDistance.length
    });

  } catch (error) {
    console.error('Available orders error:', error);
    res.status(500).json({ error: 'Failed to fetch available orders' });
  }
});

/**
 * Accept Order Assignment
 * POST /api/tracking/accept-order/:orderId
 */
router.post('/accept-order/:orderId', authenticateToken, verifyAgentRole, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const agentId = req.agent.id;
    const agentType = req.agent.agent_type;

    // Check if order is still available
    const [orders] = await pool.query(
      `SELECT * FROM orders 
       WHERE id = ? AND agent_id IS NULL AND status IN ('pending', 'confirmed')`,
      [orderId]
    );

    if (orders.length === 0) {
      return res.status(400).json({ error: 'Order not available for assignment' });
    }

    const order = orders[0];

    // Check agent capacity
    const [currentOrders] = await pool.query(
      `SELECT COUNT(*) as count FROM orders 
       WHERE agent_id = ? AND status IN ('assigned', 'picked_up', 'en_route')`,
      [agentId]
    );

    const maxOrders = agentType === 'pickup_delivery' ? 8 : 5;
    if (currentOrders[0].count >= maxOrders) {
      return res.status(400).json({ 
        error: `Maximum concurrent orders reached (${maxOrders})` 
      });
    }

    // Assign order to agent
    await pool.query(
      `UPDATE orders 
       SET agent_id = ?, 
           agent_type = ?, 
           status = 'assigned', 
           tracking_status = 'assigned',
           agent_assigned_at = NOW(),
           updated_at = NOW()
       WHERE id = ?`,
      [agentId, agentType, orderId]
    );

    // Create assignment record
    await pool.query(
      `INSERT INTO agent_assignments 
       (agent_id, order_id, assigned_at, status) 
       VALUES (?, ?, NOW(), 'active')`,
      [agentId, orderId]
    );

    // Generate delivery code
    const deliveryCode = generateDeliveryCode();
    await pool.query(
      'UPDATE orders SET delivery_code = ? WHERE id = ?',
      [deliveryCode, orderId]
    );

    // Log activity
    await pool.query(
      `INSERT INTO agent_activities 
       (agent_id, activity_type, order_id, description, created_at) 
       VALUES (?, 'order_accepted', ?, 'Order accepted and assigned', NOW())`,
      [agentId, orderId]
    );

    // Send email notification to agent
    try {
      const mailer = require('../utils/mailer.js');
      await mailer.sendOrderAssignmentToAgent(req.user.email, {
        order_number: order.order_number,
        customer_name: order.customer_name || 'Customer',
        customer_phone: order.customer_phone || 'N/A',
        delivery_address: order.delivery_address || order.shipping_address,
        total_amount: order.total_amount,
        delivery_code: deliveryCode
      }, {
        name: req.user.username,
        agent_type: agentType
      });
    } catch (emailError) {
      console.error('Email notification error:', emailError);
    }

    res.json({
      success: true,
      message: 'Order accepted successfully',
      order: {
        id: orderId,
        order_number: order.order_number,
        delivery_code: deliveryCode,
        status: 'assigned',
        assigned_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Order acceptance error:', error);
    res.status(500).json({ error: 'Failed to accept order' });
  }
});

/**
 * Update Order Status
 * PUT /api/tracking/order/:orderId/status
 */
router.put('/order/:orderId/status', authenticateToken, verifyAgentRole, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const agentId = req.agent.id;
    const { status, notes, location } = req.body;

    // Validate status
    const validStatuses = ['assigned', 'picked_up', 'en_route', 'arriving', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Verify order belongs to agent
    const [orders] = await pool.query(
      'SELECT * FROM orders WHERE id = ? AND agent_id = ?',
      [orderId, agentId]
    );

    if (orders.length === 0) {
      return res.status(403).json({ error: 'Order not assigned to this agent' });
    }

    // Update order status
    let updateQuery = `
      UPDATE orders 
      SET tracking_status = ?, 
          agent_delivery_notes = ?, 
          updated_at = NOW()
    `;
    let updateParams = [status, notes || null];

    // Handle specific status updates
    if (status === 'picked_up') {
      updateQuery += ', actual_pickup_time = NOW()';
    } else if (status === 'delivered') {
      updateQuery += ', actual_delivery_time = NOW(), delivered_at = NOW(), status = "delivered"';
      
      if (location) {
        updateQuery += ', delivery_confirmed_lat = ?, delivery_confirmed_lng = ?';
        updateParams.push(location.latitude, location.longitude);
      }
    }

    updateQuery += ' WHERE id = ?';
    updateParams.push(orderId);

    await pool.query(updateQuery, updateParams);

    // Log status change
    await pool.query(
      `INSERT INTO order_status_history 
       (order_id, status, notes, changed_by, changed_at) 
       VALUES (?, ?, ?, ?, NOW())`,
      [orderId, status, notes || null, agentId]
    );

    // Log agent activity
    await pool.query(
      `INSERT INTO agent_activities 
       (agent_id, activity_type, order_id, description, created_at) 
       VALUES (?, 'status_update', ?, ?, NOW())`,
      [agentId, orderId, `Order status updated to ${status}`]
    );

    // Handle delivery completion
    if (status === 'delivered') {
      await handleDeliveryCompletion(orderId, agentId);
    }

    res.json({
      success: true,
      message: 'Order status updated successfully',
      status: status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Status update error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

/**
 * Get Agent's Current Orders
 * GET /api/tracking/my-orders
 */
router.get('/my-orders', authenticateToken, verifyAgentRole, async (req, res) => {
  try {
    const agentId = req.agent.id;
    const { status = 'active' } = req.query;

    let statusFilter = '';
    if (status === 'active') {
      statusFilter = `AND o.tracking_status IN ('assigned', 'picked_up', 'en_route', 'arriving')`;
    } else if (status === 'completed') {
      statusFilter = `AND o.tracking_status = 'delivered'`;
    }

    const [orders] = await pool.query(`
      SELECT 
        o.*,
        u.username as customer_name,
        u.email as customer_email,
        u.phone as customer_phone,
        ps.name as pickup_site_name,
        ps.address as pickup_site_address
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN pickup_sites ps ON o.pickup_site_id = ps.id
      WHERE o.agent_id = ? ${statusFilter}
      ORDER BY o.agent_assigned_at DESC
      LIMIT 20
    `, [agentId]);

    // Add order items for each order
    for (let order of orders) {
      const [items] = await pool.query(
        'SELECT * FROM order_items WHERE order_id = ?',
        [order.id]
      );
      order.items = items;
    }

    res.json({
      success: true,
      orders: orders,
      totalOrders: orders.length
    });

  } catch (error) {
    console.error('My orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

/**
 * Get Real-time Agent Statistics
 * GET /api/tracking/stats
 */
router.get('/stats', authenticateToken, verifyAgentRole, async (req, res) => {
  try {
    const agentId = req.agent.id;

    // Get today's stats
    const [todayStats] = await pool.query(`
      SELECT 
        COUNT(*) as orders_today,
        SUM(CASE WHEN tracking_status = 'delivered' THEN 1 ELSE 0 END) as completed_today,
        SUM(CASE WHEN tracking_status = 'delivered' THEN agent_commission ELSE 0 END) as earnings_today
      FROM orders 
      WHERE agent_id = ? AND DATE(agent_assigned_at) = CURDATE()
    `, [agentId]);

    // Get active orders count
    const [activeOrders] = await pool.query(`
      SELECT COUNT(*) as active_count
      FROM orders 
      WHERE agent_id = ? AND tracking_status IN ('assigned', 'picked_up', 'en_route', 'arriving')
    `, [agentId]);

    // Get this week's stats
    const [weekStats] = await pool.query(`
      SELECT 
        COUNT(*) as orders_week,
        SUM(CASE WHEN tracking_status = 'delivered' THEN 1 ELSE 0 END) as completed_week,
        SUM(CASE WHEN tracking_status = 'delivered' THEN agent_commission ELSE 0 END) as earnings_week
      FROM orders 
      WHERE agent_id = ? AND YEARWEEK(agent_assigned_at) = YEARWEEK(NOW())
    `, [agentId]);

    // Get agent rating
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
          orders: todayStats[0].orders_today || 0,
          completed: todayStats[0].completed_today || 0,
          earnings: parseFloat(todayStats[0].earnings_today || 0)
        },
        week: {
          orders: weekStats[0].orders_week || 0,
          completed: weekStats[0].completed_week || 0,
          earnings: parseFloat(weekStats[0].earnings_week || 0)
        },
        active: {
          orders: activeOrders[0].active_count || 0
        },
        rating: {
          average: parseFloat(ratingStats[0]?.average_rating || 0),
          total: ratingStats[0]?.total_ratings || 0
        }
      }
    });

  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Helper Functions

/**
 * Find nearby orders for agent
 */
async function findNearbyOrders(agentId, latitude, longitude, agentType) {
  try {
    let query = '';
    let params = [];

    if (agentType === 'fast_delivery') {
      query = `
        SELECT id, order_number, delivery_lat, delivery_lng, total_amount
        FROM grocery_orders 
        WHERE agent_id IS NULL 
        AND status IN ('pending', 'confirmed')
        AND delivery_lat IS NOT NULL 
        AND delivery_lng IS NOT NULL
        HAVING (
          6371 * acos(
            cos(radians(?)) * cos(radians(delivery_lat)) * 
            cos(radians(delivery_lng) - radians(?)) + 
            sin(radians(?)) * sin(radians(delivery_lat))
          )
        ) <= 5
        ORDER BY distance
        LIMIT 5
      `;
      params = [latitude, longitude, latitude];
    } else if (agentType === 'pickup_delivery') {
      query = `
        SELECT id, order_number, pickup_lat, pickup_lng, delivery_lat, delivery_lng, total_amount
        FROM orders 
        WHERE agent_id IS NULL 
        AND status IN ('pending', 'confirmed')
        AND pickup_lat IS NOT NULL 
        AND pickup_lng IS NOT NULL
        HAVING (
          6371 * acos(
            cos(radians(?)) * cos(radians(pickup_lat)) * 
            cos(radians(pickup_lng) - radians(?)) + 
            sin(radians(?)) * sin(radians(pickup_lat))
          )
        ) <= 10
        ORDER BY distance
        LIMIT 5
      `;
      params = [latitude, longitude, latitude];
    }

    if (query) {
      const [orders] = await pool.query(query, params);
      return orders;
    }

    return [];
  } catch (error) {
    console.error('Find nearby orders error:', error);
    return [];
  }
}

/**
 * Get available grocery orders
 */
async function getAvailableGroceryOrders(agentLocation, radius, limit) {
  const [orders] = await pool.query(`
    SELECT 
      go.*,
      u.username as customer_name,
      u.phone as customer_phone
    FROM grocery_orders go
    LEFT JOIN users u ON go.user_id = u.id
    WHERE go.agent_id IS NULL 
    AND go.status IN ('pending', 'confirmed')
    AND go.delivery_lat IS NOT NULL 
    AND go.delivery_lng IS NOT NULL
    ORDER BY go.created_at DESC
    LIMIT ?
  `, [parseInt(limit)]);

  return orders;
}

/**
 * Get available pickup orders
 */
async function getAvailablePickupOrders(agentLocation, radius, limit) {
  const [orders] = await pool.query(`
    SELECT 
      o.*,
      u.username as customer_name,
      u.phone as customer_phone,
      ps.name as pickup_site_name,
      ps.address as pickup_site_address
    FROM orders o
    LEFT JOIN users u ON o.user_id = u.id
    LEFT JOIN pickup_sites ps ON o.pickup_site_id = ps.id
    WHERE o.agent_id IS NULL 
    AND o.status IN ('pending', 'confirmed')
    AND o.marketplace_type = 'physical'
    ORDER BY o.created_at DESC
    LIMIT ?
  `, [parseInt(limit)]);

  return orders;
}

/**
 * Get orders for pickup site manager
 */
async function getPickupSiteOrders(agentId, limit) {
  // Get agent's pickup site
  const [agent] = await pool.query(
    'SELECT pickup_site_id FROM agents WHERE id = ?',
    [agentId]
  );

  if (!agent[0]?.pickup_site_id) {
    return [];
  }

  const [orders] = await pool.query(`
    SELECT 
      o.*,
      u.username as customer_name,
      u.phone as customer_phone
    FROM orders o
    LEFT JOIN users u ON o.user_id = u.id
    WHERE o.pickup_site_id = ? 
    AND o.status IN ('pending', 'confirmed', 'shipped')
    ORDER BY o.created_at DESC
    LIMIT ?
  `, [agent[0].pickup_site_id, parseInt(limit)]);

  return orders;
}

/**
 * Calculate distance between two points
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in kilometers
  return Math.round(distance * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculate estimated time
 */
function calculateEstimatedTime(lat1, lon1, lat2, lon2) {
  const distance = calculateDistance(lat1, lon1, lat2, lon2);
  const averageSpeed = 30; // km/h average speed in city
  const timeInHours = distance / averageSpeed;
  const timeInMinutes = Math.round(timeInHours * 60);
  return Math.max(timeInMinutes, 5); // Minimum 5 minutes
}

/**
 * Generate delivery code
 */
function generateDeliveryCode() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

/**
 * Handle delivery completion
 */
async function handleDeliveryCompletion(orderId, agentId) {
  try {
    // Calculate commission
    const [order] = await pool.query(
      'SELECT * FROM orders WHERE id = ?',
      [orderId]
    );

    if (order.length > 0) {
      const orderData = order[0];
      const commissionRate = getCommissionRate(orderData.agent_type);
      const commission = (orderData.total_amount * commissionRate) / 100;

      // Update commission
      await pool.query(
        'UPDATE orders SET agent_commission = ?, commission_calculated = 1 WHERE id = ?',
        [commission, orderId]
      );

      // Update agent earnings
      await pool.query(
        'UPDATE agents SET total_earnings = total_earnings + ?, total_deliveries = total_deliveries + 1 WHERE id = ?',
        [commission, agentId]
      );

      // Create earnings record
      await pool.query(
        `INSERT INTO agent_earnings 
         (agent_id, order_id, amount, commission_rate, earned_at) 
         VALUES (?, ?, ?, ?, NOW())`,
        [agentId, orderId, commission, commissionRate]
      );
    }

    // Update assignment status
    await pool.query(
      'UPDATE agent_assignments SET status = "completed", completed_at = NOW() WHERE order_id = ?',
      [orderId]
    );

  } catch (error) {
    console.error('Delivery completion handling error:', error);
  }
}

/**
 * Get commission rate by agent type
 */
function getCommissionRate(agentType) {
  const rates = {
    'fast_delivery': 15,
    'pickup_delivery': 12,
    'pickup_site_manager': 10
  };
  return rates[agentType] || 10;
}

module.exports = router;