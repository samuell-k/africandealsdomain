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
const mailer = require('../utils/enhanced-mailer');

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
      WHERE agent_id = ? AND DATE(order_date) = CURDATE()
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
      WHERE agent_id = ? AND YEARWEEK(order_date) = YEARWEEK(NOW())
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
 * Get Available Orders (Regular Orders for Fast Delivery)
 * GET /api/fast-delivery-agent/available-orders
 */
router.get('/available-orders', authenticateToken, verifyFastDeliveryAgent, async (req, res) => {
  try {
    const agentId = req.agent.id;
    const { limit = 10, radius = 5 } = req.query;

    // Get agent's current location
    const agentLocation = req.agent.current_location ? JSON.parse(req.agent.current_location) : null;

    // Get commission settings
    const [commissionSettings] = await pool.query(`
      SELECT * FROM commission_settings WHERE setting_type = 'fast_delivery_agent' LIMIT 1
    `);
    
    const defaultCommissionRate = commissionSettings.length > 0 ? 
      parseFloat(commissionSettings[0].commission_rate) : 0.70; // Default 70% of platform commission

    // Query regular orders, grocery orders, and local market orders
    const regularOrdersQuery = `
      SELECT 
        o.*,
        u.username as buyer_name,
        u.email as buyer_email,
        u.phone as buyer_phone,
        JSON_EXTRACT(o.shipping_address, '$.address') as delivery_address,
        JSON_EXTRACT(o.shipping_address, '$.lat') as delivery_lat,
        JSON_EXTRACT(o.shipping_address, '$.lng') as delivery_lng,
        JSON_EXTRACT(o.shipping_address, '$.phone') as buyer_phone_alt,
        'regular' as order_type
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.agent_id IS NULL 
      AND o.status IN ('pending', 'confirmed')
      AND (o.delivery_type = 'fast_delivery' OR o.delivery_type IS NULL OR o.delivery_type = 'home_delivery')
      ORDER BY o.created_at DESC
      LIMIT ?
    `;
    
    const groceryOrdersQuery = `
      SELECT 
        go.id,
        go.order_number,
        go.total_amount,
        go.agent_commission,
        go.platform_commission,
        go.delivery_address,
        go.delivery_lat,
        go.delivery_lng,
        go.status,
        go.created_at,
        go.updated_at,
        go.buyer_id as user_id,
        u.username as buyer_name,
        u.email as buyer_email,
        u.phone as buyer_phone,
        go.delivery_address as delivery_address,
        go.delivery_lat,
        go.delivery_lng,
        go.delivery_address as buyer_phone_alt,
        'grocery' as order_type
      FROM grocery_orders go
      LEFT JOIN users u ON go.buyer_id = u.id
      WHERE go.agent_id IS NULL 
      AND go.status IN ('pending', 'confirmed')
      ORDER BY go.created_at DESC
      LIMIT ?
    `;

    // Add local market orders query
    const localMarketOrdersQuery = `
      SELECT 
        lmo.id,
        lmo.id as order_number,
        lmo.grand_total as total_amount,
        COALESCE(lmo.delivery_fee * 0.7, 500) as agent_commission,
        COALESCE(lmo.platform_fee, 0) as platform_commission,
        lmo.delivery_address,
        lmo.delivery_latitude as delivery_lat,
        lmo.delivery_longitude as delivery_lng,
        lmo.status,
        lmo.created_at,
        lmo.updated_at,
        lmo.buyer_id as user_id,
        u.username as buyer_name,
        u.email as buyer_email,
        u.phone as buyer_phone,
        lmo.delivery_address as delivery_address,
        lmo.delivery_latitude as delivery_lat,
        lmo.delivery_longitude as delivery_lng,
        lmo.delivery_address as buyer_phone_alt,
        'local_market' as order_type
      FROM local_market_orders lmo
      LEFT JOIN users u ON lmo.buyer_id = u.id
      WHERE lmo.agent_id IS NULL 
      AND lmo.status IN ('confirmed', 'preparing', 'ready_for_pickup', 'ready')
      AND (lmo.payment_status IN ('confirmed','paid','submitted'))
      ORDER BY lmo.created_at DESC
      LIMIT ?
    `;
    
    const [regularOrders] = await pool.query(regularOrdersQuery, [parseInt(limit/3)]);
    const [groceryOrders] = await pool.query(groceryOrdersQuery, [parseInt(limit/3)]);
    const [localMarketOrders] = await pool.query(localMarketOrdersQuery, [parseInt(limit/3)]);
    
    // Combine and sort by created_at
    const orders = [...regularOrders, ...groceryOrders, ...localMarketOrders]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, parseInt(limit));
    
    console.log(`[FAST-DELIVERY] Found ${orders.length} available orders for agent ${req.agent.id}`);

    // Calculate distances and commission for each order
    const ordersWithDetails = await Promise.all(orders.map(async (order) => {
      let distance = null;
      let estimated_time = null;

      // Parse coordinates if they exist
      const deliveryLat = order.delivery_lat ? parseFloat(order.delivery_lat) : null;
      const deliveryLng = order.delivery_lng ? parseFloat(order.delivery_lng) : null;

      if (agentLocation && deliveryLat && deliveryLng) {
        distance = calculateDistance(
          agentLocation.lat,
          agentLocation.lng,
          deliveryLat,
          deliveryLng
        );
        estimated_time = Math.max(Math.round(distance * 3), 10); // 3 minutes per km, minimum 10 minutes
      }

      // Calculate agent commission - use existing commission or calculate from total
      let agentCommission = order.agent_commission || 0;
      let totalPlatformCommission = order.platform_commission || 0;
      
      if (agentCommission === 0) {
        // Calculate from order total if not already set
        totalPlatformCommission = order.total_amount * 0.21; // 21% platform commission
        agentCommission = totalPlatformCommission * defaultCommissionRate; // 70% of platform commission
      }

      // Get order items for display - handle both regular and grocery orders
      let orderItems = [];
      if (order.order_type === 'grocery') {
        const [items] = await pool.query(`
          SELECT goi.*, p.name as product_name, goi.unit_price as price, goi.quantity
          FROM grocery_order_items goi
          LEFT JOIN products p ON goi.grocery_product_id = p.id
          WHERE goi.grocery_order_id = ?
        `, [order.id]);
        orderItems = items;
      } else {
        const [items] = await pool.query(`
          SELECT oi.*, p.name as product_name
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ?
        `, [order.id]);
        orderItems = items;
      }

      return {
        ...order,
        distance,
        estimated_time,
        delivery_time_window: order.delivery_time_window || 'ASAP',
        agent_commission: agentCommission,
        platform_commission: totalPlatformCommission,
        items: orderItems.map(item => ({
          ...item,
          product_name: item.product_name || item.name || 'Product',
          price: item.unit_price
        }))
      };
    }));

    // Filter by radius if location is available
    const filteredOrders = agentLocation ? 
      ordersWithDetails.filter(order => order.distance === null || order.distance <= radius) :
      ordersWithDetails;

    // Get agent's current order capacity
    const [currentOrders] = await pool.query(`
      SELECT COUNT(*) as current_count
      FROM (
        SELECT id FROM orders WHERE agent_id = ? AND status IN ('assigned', 'picked_up', 'in_transit')
        UNION ALL
        SELECT id FROM grocery_orders WHERE agent_id = ? AND status IN ('assigned', 'picked_up', 'in_transit')
        UNION ALL
        SELECT id FROM local_market_orders WHERE agent_id = ? AND status IN ('assigned', 'picked_up', 'in_transit')
      ) as all_orders
    `, [agentId, agentId, agentId]);

    const currentOrderCount = currentOrders[0]?.current_count || 0;
    const maxOrders = 5; // Maximum orders an agent can handle at once

    res.json({
      success: true,
      orders: filteredOrders,
      agent_capacity: {
        current_orders: currentOrderCount,
        max_orders: maxOrders,
        available_slots: maxOrders - currentOrderCount
      },
      agentLocation: agentLocation,
      totalAvailable: filteredOrders.length,
      commissionRate: defaultCommissionRate
    });

  } catch (error) {
    console.error('[FAST-DELIVERY] Available orders fetch error:', error);
    console.error('[FAST-DELIVERY] Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to fetch available orders',
      details: error.message 
    });
  }
});

/**
 * Get Active Orders
 * GET /api/fast-delivery-agent/active-orders
 */
router.get('/active-orders', authenticateToken, verifyFastDeliveryAgent, async (req, res) => {
  try {
    const agentId = req.agent.id;

    // Query both regular orders and grocery orders assigned to this agent
    const regularOrdersQuery = `
      SELECT 
        o.*,
        u.username as buyer_name,
        u.email as buyer_email,
        u.phone as buyer_phone,
        JSON_EXTRACT(o.shipping_address, '$.address') as delivery_address,
        JSON_EXTRACT(o.shipping_address, '$.lat') as delivery_lat,
        JSON_EXTRACT(o.shipping_address, '$.lng') as delivery_lng,
        JSON_EXTRACT(o.shipping_address, '$.phone') as buyer_phone_alt,
        seller.username as seller_name,
        seller.phone as seller_phone,
        seller.email as seller_email,
        JSON_EXTRACT(o.pickup_address, '$.address') as pickup_address,
        JSON_EXTRACT(o.pickup_address, '$.lat') as pickup_lat,
        JSON_EXTRACT(o.pickup_address, '$.lng') as pickup_lng,
        'regular' as order_type
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN users seller ON o.seller_id = seller.id
      WHERE o.agent_id = ? 
      AND o.status IN ('processing', 'shipped')
      ORDER BY o.created_at DESC
    `;

    const groceryOrdersQuery = `
      SELECT 
        go.id,
        go.order_number,
        go.total_amount,
        go.agent_commission,
        go.platform_commission,
        go.delivery_address,
        go.delivery_lat,
        go.delivery_lng,
        go.status,
        go.created_at,
        go.updated_at,
        go.buyer_id as user_id,
        u.username as buyer_name,
        u.email as buyer_email,
        u.phone as buyer_phone,
        go.delivery_address as delivery_address,
        go.delivery_lat,
        go.delivery_lng,
        go.delivery_address as buyer_phone_alt,
        seller.username as seller_name,
        seller.phone as seller_phone,
        seller.email as seller_email,
        go.pickup_address,
        go.pickup_lat,
        go.pickup_lng,
        'grocery' as order_type,
        go.agent_assigned_at,
        go.delivery_code
      FROM grocery_orders go
      LEFT JOIN users u ON go.buyer_id = u.id
      LEFT JOIN users seller ON go.seller_id = seller.id
      WHERE go.agent_id = ? 
      AND go.status IN ('confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'in_transit')
      ORDER BY go.created_at DESC
    `;
    
    const [regularOrders] = await pool.query(regularOrdersQuery, [agentId]);
    const [groceryOrders] = await pool.query(groceryOrdersQuery, [agentId]);
    
    // Combine and sort by created_at
    const orders = [...regularOrders, ...groceryOrders]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Get order items and calculate commission for each order
    const ordersWithDetails = await Promise.all(orders.map(async (order) => {
      // Get order items - handle both regular and grocery orders
      let items = [];
      if (order.order_type === 'grocery') {
        const [groceryItems] = await pool.query(`
          SELECT goi.*, p.name as product_name, goi.unit_price as price, goi.quantity
          FROM grocery_order_items goi
          LEFT JOIN products p ON goi.grocery_product_id = p.id
          WHERE goi.grocery_order_id = ?
        `, [order.id]);
        items = groceryItems;
      } else {
        const [regularItems] = await pool.query(`
          SELECT oi.*, p.name as product_name
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ?
        `, [order.id]);
        items = regularItems;
      }

      // Calculate agent commission
      let totalPlatformCommission = 0;
      items.forEach(item => {
        const platformRate = 0.21; // Default 21% platform commission
        const itemPlatformCommission = item.total_price * platformRate;
        totalPlatformCommission += itemPlatformCommission;
      });

      const [commissionSettings] = await pool.query(`
        SELECT commission_rate FROM commission_settings WHERE setting_type = 'fast_delivery_agent' LIMIT 1
      `);
      const agentCommissionRate = commissionSettings.length > 0 ? 
        parseFloat(commissionSettings[0].commission_rate) : 0.70;

      const agentCommission = totalPlatformCommission * agentCommissionRate;

      return {
        ...order,
        items: items.map(item => ({
          ...item,
          price: item.unit_price
        })),
        agent_commission: agentCommission,
        platform_commission: totalPlatformCommission
      };
    }));

    res.json({
      success: true,
      orders: ordersWithDetails
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
    const agentId = req.agent.id; // agents.id
    const agentUserId = req.agent.user_id; // users.id (used by local_market_orders)
    const { orderType } = req.body; // Get order type from request body

    console.log(`[ACCEPT-ORDER] Agent ${agentId} attempting to accept order ${orderId} (type: ${orderType || 'regular'})`);

    let order = null;
    let orderItems = [];
    const isGroceryOrder = orderType === 'grocery';
    const isLocalMarketOrder = orderType === 'local_market';

    // Check order availability and lock it - handle all order types
    if (isLocalMarketOrder) {
      // Handle local market orders
      const [localMarketOrders] = await connection.query(
        'SELECT * FROM local_market_orders WHERE id = ? AND agent_id IS NULL AND status IN ("confirmed", "preparing", "ready_for_pickup") AND payment_status = "confirmed" FOR UPDATE',
        [orderId]
      );

      if (localMarketOrders.length === 0) {
        await connection.rollback();
        console.log(`[ACCEPT-ORDER] Local market order ${orderId} not available for assignment`);
        return res.status(400).json({ error: 'Order not available for assignment or already taken by another agent' });
      }

      order = localMarketOrders[0];

      // Get local market order items
      const [items] = await connection.query(`
        SELECT lmoi.*, lmoi.product_name, lmoi.total_price
        FROM local_market_order_items lmoi
        WHERE lmoi.order_id = ?
      `, [orderId]);
      orderItems = items;

    } else if (isGroceryOrder) {
      // Handle grocery orders
      const [groceryOrders] = await connection.query(
        'SELECT * FROM grocery_orders WHERE id = ? AND agent_id IS NULL AND status IN ("pending", "confirmed") FOR UPDATE',
        [orderId]
      );

      if (groceryOrders.length === 0) {
        await connection.rollback();
        console.log(`[ACCEPT-ORDER] Grocery order ${orderId} not available for assignment`);
        return res.status(400).json({ error: 'Order not available for assignment or already taken by another agent' });
      }

      order = groceryOrders[0];

      // Get grocery order items
      const [items] = await connection.query(`
        SELECT goi.*, p.name as product_name, goi.total_price
        FROM grocery_order_items goi
        LEFT JOIN products p ON goi.grocery_product_id = p.id
        WHERE goi.grocery_order_id = ?
      `, [orderId]);
      orderItems = items;

    } else {
      // Handle regular orders
      const [regularOrders] = await connection.query(
        'SELECT * FROM orders WHERE id = ? AND agent_id IS NULL AND status IN ("pending", "confirmed") FOR UPDATE',
        [orderId]
      );

      if (regularOrders.length === 0) {
        await connection.rollback();
        console.log(`[ACCEPT-ORDER] Regular order ${orderId} not available for assignment`);
        return res.status(400).json({ error: 'Order not available for assignment or already taken by another agent' });
      }

      order = regularOrders[0];

      // Get regular order items
      const [items] = await connection.query(`
        SELECT oi.*, p.name as product_name
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
      `, [orderId]);
      orderItems = items;
    }

    // Check agent capacity (max 5 concurrent orders for fast delivery)
    const [currentRegularOrders] = await connection.query(
      'SELECT COUNT(*) as count FROM orders WHERE agent_id = ? AND status IN ("assigned", "picked_from_seller", "en_route")',
      [agentId]
    );
    const [currentGroceryOrders] = await connection.query(
      'SELECT COUNT(*) as count FROM grocery_orders WHERE agent_id = ? AND status IN ("assigned", "confirmed", "preparing", "ready_for_pickup", "picked_up", "in_transit")',
      [agentId]
    );
    const [currentLocalMarketOrders] = await connection.query(
      'SELECT COUNT(*) as count FROM local_market_orders WHERE agent_id = ? AND status IN ("out_for_delivery", "preparing", "ready_for_pickup")',
      [agentId]
    );
    const totalCurrentOrders = currentRegularOrders[0].count + currentGroceryOrders[0].count + currentLocalMarketOrders[0].count;

    if (totalCurrentOrders >= 5) {
      await connection.rollback();
      return res.status(400).json({ error: 'Maximum concurrent orders reached (5)' });
    }

    // Calculate agent commission
    let totalPlatformCommission = 0;
    orderItems.forEach(item => {
      const platformRate = 0.21; // Default 21% platform commission
      const itemPlatformCommission = item.total_price * platformRate;
      totalPlatformCommission += itemPlatformCommission;
    });

    // Get commission settings
    const [commissionSettings] = await connection.query(`
      SELECT commission_rate FROM commission_settings WHERE setting_type = 'fast_delivery_agent' LIMIT 1
    `);
    const agentCommissionRate = commissionSettings.length > 0 ? 
      parseFloat(commissionSettings[0].commission_rate) : 0.70; // Default 70%

    const agentCommission = totalPlatformCommission * agentCommissionRate;

    // Generate delivery code
    const deliveryCode = Math.random().toString(36).substr(2, 6).toUpperCase();

    // Update the appropriate order table with correct status values
    if (isLocalMarketOrder) {
      // local_market_orders.agent_id stores users.id
      await connection.query(
        'UPDATE local_market_orders SET agent_id = ?, status = "out_for_delivery", assigned_at = NOW(), delivery_started_at = NOW(), updated_at = NOW() WHERE id = ?',
        [agentUserId, orderId]
      );
    } else if (isGroceryOrder) {
      await connection.query(
        'UPDATE grocery_orders SET agent_id = ?, status = "confirmed", agent_assigned_at = NOW(), agent_commission = ?, delivery_code = ?, updated_at = NOW() WHERE id = ?',
        [agentId, agentCommission, deliveryCode, orderId]
      );
    } else {
      await connection.query(
        'UPDATE orders SET agent_id = ?, status = "processing", agent_assigned_at = NOW(), agent_commission = ?, delivery_code = ?, updated_at = NOW() WHERE id = ?',
        [agentId, agentCommission, deliveryCode, orderId]
      );
    }

    // Log activity (check if table exists first)
    try {
      await connection.query(
        'INSERT INTO agent_activities (agent_id, activity_type, order_id, description, created_at) VALUES (?, "order_accepted", ?, "Fast delivery order accepted and assigned", NOW())',
        [agentId, orderId]
      );
    } catch (activityError) {
      console.warn('[ACCEPT-ORDER] Could not log activity:', activityError.message);
      // Continue without failing the order acceptance
    }

    await connection.commit();
    console.log(`[ACCEPT-ORDER] Order ${orderId} successfully assigned to agent ${agentId}`);

    // Send notification to buyer via Socket.IO
    const buyerId = isGroceryOrder ? order.buyer_id : order.user_id;
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${buyerId}`).emit('agent_assigned', {
        orderId: orderId,
        orderType: isGroceryOrder ? 'grocery' : 'regular',
        agentDetails: {
          id: agentId,
          name: req.agent.name || 'Fast Delivery Agent',
          phone: req.agent.phone,
          rating: req.agent.average_rating || 0
        },
        deliveryCode: deliveryCode,
        estimatedTime: '15-30 minutes'
      });
    }

    // Get buyer details
    const [buyerDetails] = await pool.query('SELECT username, phone FROM users WHERE id = ?', [buyerId]);
    const buyer = buyerDetails[0] || {};

    res.json({
      success: true,
      message: 'Order accepted successfully',
      order: {
        id: orderId,
        orderNumber: order.order_number,
        order_number: order.order_number,
        delivery_code: deliveryCode,
        status: isGroceryOrder ? 'confirmed' : 'processing',
        assigned_at: new Date().toISOString(),
        agent_commission: agentCommission,
        platform_commission: totalPlatformCommission,
        order_type: isGroceryOrder ? 'grocery' : 'regular',
        buyer_details: {
          name: buyer.username || 'Customer',
          phone: buyer.phone || 'Not provided',
          address: JSON.parse(order.shipping_address || '{}').address || 'Not specified'
        }
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error('[ACCEPT-ORDER] Order acceptance error:', error);
    res.status(500).json({ error: 'Failed to accept order: ' + error.message });
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

    // Try to get order from regular orders first
    let [orders] = await pool.query(`
      SELECT 
        o.*,
        u.username as buyer_name,
        u.email as buyer_email,
        u.phone as buyer_phone,
        JSON_EXTRACT(o.shipping_address, '$.address') as delivery_address,
        JSON_EXTRACT(o.shipping_address, '$.lat') as delivery_lat,
        JSON_EXTRACT(o.shipping_address, '$.lng') as delivery_lng,
        JSON_EXTRACT(o.shipping_address, '$.phone') as buyer_phone_alt,
        seller.username as seller_name,
        seller.phone as seller_phone,
        seller.email as seller_email,
        JSON_EXTRACT(o.pickup_address, '$.address') as pickup_address,
        JSON_EXTRACT(o.pickup_address, '$.lat') as pickup_lat,
        JSON_EXTRACT(o.pickup_address, '$.lng') as pickup_lng,
        'regular' as order_type
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN users seller ON o.seller_id = seller.id
      WHERE o.id = ? AND (o.agent_id = ? OR o.agent_id IS NULL)
    `, [orderId, agentId]);

    // If not found in regular orders, try grocery orders
    if (orders.length === 0) {
      [orders] = await pool.query(`
        SELECT 
          go.*,
          u.username as buyer_name,
          u.email as buyer_email,
          u.phone as buyer_phone,
          go.delivery_address,
          go.delivery_lat,
          go.delivery_lng,
          go.delivery_address as buyer_phone_alt,
          seller.username as seller_name,
          seller.phone as seller_phone,
          seller.email as seller_email,
          go.pickup_address,
          go.pickup_lat,
          go.pickup_lng,
          'grocery' as order_type
        FROM grocery_orders go
        LEFT JOIN users u ON go.buyer_id = u.id
        LEFT JOIN users seller ON go.seller_id = seller.id
        WHERE go.id = ? AND (go.agent_id = ? OR go.agent_id IS NULL)
      `, [orderId, agentId]);
    }

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orders[0];
    let items = [];

    // Get order items based on order type
    if (order.order_type === 'grocery') {
      const [groceryItems] = await pool.query(`
        SELECT 
          goi.*,
          p.name as product_name,
          goi.unit_price as price,
          goi.quantity,
          (goi.unit_price * goi.quantity) as total_price
        FROM grocery_order_items goi
        LEFT JOIN products p ON goi.grocery_product_id = p.id
        WHERE goi.grocery_order_id = ?
      `, [orderId]);
      items = groceryItems;
    } else {
      const [regularItems] = await pool.query(`
        SELECT 
          oi.*,
          p.name as product_name,
          oi.unit_price as price,
          oi.quantity,
          oi.total_price
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
      `, [orderId]);
      items = regularItems;
    }

    // Calculate commission details
    let totalPlatformCommission = 0;
    items.forEach(item => {
      const platformRate = 0.21; // Default 21% platform commission
      const itemPlatformCommission = item.total_price * platformRate;
      totalPlatformCommission += itemPlatformCommission;
    });

    const [commissionSettings] = await pool.query(`
      SELECT commission_rate FROM commission_settings WHERE setting_type = 'fast_delivery_agent' LIMIT 1
    `);
    const agentCommissionRate = commissionSettings.length > 0 ? 
      parseFloat(commissionSettings[0].commission_rate) : 0.70;

    const agentCommission = totalPlatformCommission * agentCommissionRate;

    // Format items with proper names
    const formattedItems = items.map(item => ({
      ...item,
      name: item.product_name || item.name || 'Product',
      price: item.unit_price,
      notes: item.notes || ''
    }));

    const orderWithDetails = {
      ...order,
      items: formattedItems,
      agent_commission: order.agent_commission || agentCommission,
      platform_commission: totalPlatformCommission,
      delivery_address: order.delivery_address || 'Not specified',
      buyer_phone: order.buyer_phone || order.buyer_phone_alt || 'Not provided',
      seller_name: order.seller_name || 'Local Market Seller',
      seller_phone: order.seller_phone || 'Not provided',
      seller_email: order.seller_email || 'Not provided',
      pickup_address: order.pickup_address || 'Local Market Location',
      pickup_lat: order.pickup_lat,
      pickup_lng: order.pickup_lng
    };

    res.json({
      success: true,
      order: orderWithDetails
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

// GET /api/fast-delivery-agent/order-details/:orderId - Get detailed order information
router.get('/order-details/:orderId', authenticateToken, verifyFastDeliveryAgent, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const agentId = req.agent.id;

    console.log(`[ORDER-DETAILS] Agent ${agentId} requesting details for order ${orderId}`);

    // Get order details with seller and buyer information
    const [orderRows] = await pool.query(`
      SELECT 
        go.*,
        u.name as buyer_name,
        u.phone as buyer_phone,
        u.email as buyer_email,
        s.name as seller_name,
        s.phone as seller_phone,
        s.email as seller_email,
        s.address as seller_address,
        s.latitude as seller_latitude,
        s.longitude as seller_longitude
      FROM grocery_orders go
      LEFT JOIN users u ON go.user_id = u.id
      LEFT JOIN users s ON go.seller_id = s.id
      WHERE go.id = ? AND (go.agent_id = ? OR go.agent_id IS NULL)
    `, [orderId, agentId]);

    if (orderRows.length === 0) {
      return res.status(404).json({ error: 'Order not found or not accessible' });
    }

    const order = orderRows[0];

    // Get order items
    const [itemRows] = await pool.query(`
      SELECT 
        goi.*,
        p.name as product_name,
        p.image_url as product_image
      FROM grocery_order_items goi
      LEFT JOIN products p ON goi.product_id = p.id
      WHERE goi.order_id = ?
    `, [orderId]);

    order.items = itemRows;

    console.log(`[ORDER-DETAILS] Returning order details for order ${orderId}`);
    res.json(order);

  } catch (error) {
    console.error('[ORDER-DETAILS] Error getting order details:', error);
    res.status(500).json({ error: 'Failed to get order details' });
  }
});

router.put('/update-status/:orderId', authenticateToken, verifyFastDeliveryAgent, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const agentId = req.agent.id;
    const { status, notes, location, issue_type, issue_description } = req.body;

    // Validate status - support both old and new status formats
    const validStatuses = [
      'assigned', 'confirmed', 'preparing', 'ready', 'ready_for_pickup', 'picked_up', 'in_transit', 'delivered', 'shipped',
      'arrived_at_seller', 'picked_from_seller', 'en_route', 'arrived_at_buyer', 'issue_at_pickup', 'delivery_failed'
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status '${status}'. Valid statuses: ${validStatuses.join(', ')}` });
    }

    // Map frontend statuses to backend statuses for consistency
    let mappedStatus = status;
    const statusMapping = {
      'preparing': 'arrived_at_seller',
      'picked_up': 'picked_from_seller', 
      'in_transit': 'en_route',
      'shipped': 'in_transit',
      'ready_for_pickup': 'arrived_at_seller'
    };
    
    if (statusMapping[status]) {
      mappedStatus = statusMapping[status];
      console.log(`[STATUS-MAPPING] Mapping '${status}' to '${mappedStatus}'`);
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

    // Update order status using mapped status
    let updateQuery = 'UPDATE grocery_orders SET status = ?, agent_delivery_notes = ?, updated_at = NOW()';
    let updateParams = [mappedStatus, notes || null];

    // Handle specific status updates using mapped status
    if (mappedStatus === 'arrived_at_seller') {
      updateQuery += ', arrived_at_seller_time = NOW()';
    } else if (mappedStatus === 'picked_from_seller') {
      updateQuery += ', actual_pickup_time = NOW()';
      // Trigger seller payment release for local market orders
      await triggerSellerPaymentRelease(orderId, order);
    } else if (mappedStatus === 'arrived_at_buyer') {
      updateQuery += ', arrived_at_buyer_time = NOW()';
    } else if (mappedStatus === 'delivered') {
      updateQuery += ', actual_delivery_time = NOW(), delivered_at = NOW()';
      
      if (location) {
        updateQuery += ', delivery_confirmed_lat = ?, delivery_confirmed_lng = ?';
        updateParams.push(location.latitude, location.longitude);
      }
    } else if (mappedStatus === 'issue_at_pickup') {
      updateQuery += ', issue_type = ?, issue_description = ?, issue_reported_at = NOW()';
      updateParams.push(issue_type || 'pickup_issue', issue_description || notes);
    } else if (mappedStatus === 'delivery_failed') {
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

    // Get earnings from both grocery orders and local market orders
    const [groceryEarnings] = await pool.query(`
      SELECT 
        COUNT(*) as total_deliveries,
        SUM(agent_commission) as total_earnings,
        AVG(agent_commission) as average_commission,
        MIN(agent_commission) as min_commission,
        MAX(agent_commission) as max_commission,
        'grocery' as order_type
      FROM grocery_orders go
      WHERE go.agent_id = ? 
      AND go.status = 'delivered' 
      AND go.agent_commission IS NOT NULL
      ${dateFilter}
    `, [agentId]);

    const [localMarketEarnings] = await pool.query(`
      SELECT 
        COUNT(*) as total_deliveries,
        SUM(agent_commission) as total_earnings,
        AVG(agent_commission) as average_commission,
        MIN(agent_commission) as min_commission,
        MAX(agent_commission) as max_commission,
        'local_market' as order_type
      FROM local_market_orders lmo
      WHERE lmo.agent_id = ? 
      AND lmo.status IN ('completed', 'delivered')
      AND lmo.agent_commission IS NOT NULL
      ${dateFilter}
    `, [agentId]);

    // Combine earnings from both sources
    const totalDeliveries = (groceryEarnings[0].total_deliveries || 0) + (localMarketEarnings[0].total_deliveries || 0);
    const totalEarnings = (groceryEarnings[0].total_earnings || 0) + (localMarketEarnings[0].total_earnings || 0);
    const averageCommission = totalDeliveries > 0 ? totalEarnings / totalDeliveries : 0;
    const minCommission = Math.min(
      groceryEarnings[0].min_commission || Infinity, 
      localMarketEarnings[0].min_commission || Infinity
    );
    const maxCommission = Math.max(
      groceryEarnings[0].max_commission || 0, 
      localMarketEarnings[0].max_commission || 0
    );

    const earnings = [{
      total_deliveries: totalDeliveries,
      total_earnings: totalEarnings,
      average_commission: averageCommission,
      min_commission: minCommission === Infinity ? 0 : minCommission,
      max_commission: maxCommission
    }];

    // Get detailed earnings breakdown from both sources
    const [groceryBreakdown] = await pool.query(`
      SELECT 
        DATE(go.completed_at) as delivery_date,
        COUNT(*) as deliveries,
        SUM(agent_commission) as daily_earnings,
        'grocery' as order_type
      FROM grocery_orders go
      WHERE go.agent_id = ? 
      AND go.status = 'delivered' 
      AND go.agent_commission IS NOT NULL
      ${dateFilter}
      GROUP BY DATE(go.completed_at)
      ORDER BY delivery_date DESC
    `, [agentId]);

    const [localMarketBreakdown] = await pool.query(`
      SELECT 
        DATE(lmo.completed_at) as delivery_date,
        COUNT(*) as deliveries,
        SUM(agent_commission) as daily_earnings,
        'local_market' as order_type
      FROM local_market_orders lmo
      WHERE lmo.agent_id = ? 
      AND lmo.status IN ('completed', 'delivered')
      AND lmo.agent_commission IS NOT NULL
      ${dateFilter}
      GROUP BY DATE(lmo.completed_at)
      ORDER BY delivery_date DESC
    `, [agentId]);

    // Combine and sort breakdown data
    const combinedBreakdown = [...groceryBreakdown, ...localMarketBreakdown];
    const breakdownMap = new Map();
    
    combinedBreakdown.forEach(item => {
      const dateKey = item.delivery_date ? item.delivery_date.toISOString().split('T')[0] : null;
      if (dateKey) {
        if (breakdownMap.has(dateKey)) {
          const existing = breakdownMap.get(dateKey);
          existing.deliveries += item.deliveries;
          existing.earnings += parseFloat(item.daily_earnings);
          existing.order_types.push(item.order_type);
        } else {
          breakdownMap.set(dateKey, {
            date: dateKey,
            deliveries: item.deliveries,
            earnings: parseFloat(item.daily_earnings),
            order_types: [item.order_type]
          });
        }
      }
    });

    const breakdown = Array.from(breakdownMap.values()).sort((a, b) => new Date(b.date) - new Date(a.date));

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
          date: item.date,
          deliveries: item.deliveries,
          earnings: parseFloat(item.earnings),
          order_types: item.order_types
        })),
        breakdown_by_type: {
          grocery: {
            total_deliveries: groceryEarnings[0].total_deliveries || 0,
            total_earnings: parseFloat(groceryEarnings[0].total_earnings || 0)
          },
          local_market: {
            total_deliveries: localMarketEarnings[0].total_deliveries || 0,
            total_earnings: parseFloat(localMarketEarnings[0].total_earnings || 0)
          }
        },
        period: period
      }
    });

  } catch (error) {
    console.error('Earnings fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch earnings' });
  }
});

/**
 * Complete Order with Commission Calculation
 * POST /api/fast-delivery-agent/complete-order/:orderId
 */
router.post('/complete-order/:orderId', authenticateToken, verifyFastDeliveryAgent, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const agentId = req.agent.id;
    const { 
      orderType = 'grocery', 
      completion_notes, 
      completion_photo, 
      delivery_latitude, 
      delivery_longitude,
      delivery_code 
    } = req.body;

    console.log(`[COMPLETE-ORDER] Agent ${agentId} completing ${orderType} order ${orderId}`);

    // Verify order belongs to agent and get order details
    let order = null;
    let tableName = orderType === 'local_market' ? 'local_market_orders' : 'grocery_orders';
    
    const [orders] = await pool.query(
      `SELECT * FROM ${tableName} WHERE id = ? AND agent_id = ?`,
      [orderId, agentId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found or not assigned to you' });
    }

    order = orders[0];

    // Check if order is in a completable status
    const completableStatuses = ['delivered', 'in_transit', 'picked_up'];
    if (!completableStatuses.includes(order.status)) {
      return res.status(400).json({ 
        error: `Order cannot be completed from status: ${order.status}. Must be one of: ${completableStatuses.join(', ')}` 
      });
    }

    // Verify delivery code if provided and required
    if (delivery_code && order.delivery_code && delivery_code !== order.delivery_code) {
      return res.status(400).json({ error: 'Invalid delivery code' });
    }

    // Update order status to completed/delivered
    const updateFields = [];
    const updateValues = [];
    
    if (orderType === 'local_market') {
      updateFields.push('status = "completed"');
      if (completion_notes) {
        updateFields.push('completion_notes = ?');
        updateValues.push(completion_notes);
      }
      if (completion_photo) {
        updateFields.push('completion_photo = ?');
        updateValues.push(completion_photo);
      }
      if (delivery_latitude && delivery_longitude) {
        updateFields.push('delivery_latitude = ?, delivery_longitude = ?');
        updateValues.push(delivery_latitude, delivery_longitude);
      }
    } else {
      updateFields.push('status = "delivered"');
      if (completion_notes) {
        updateFields.push('final_delivery_notes = ?');
        updateValues.push(completion_notes);
      }
    }
    
    updateFields.push('updated_at = NOW()');
    updateValues.push(orderId);

    await pool.query(
      `UPDATE ${tableName} SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    // Calculate and process commission
    const commissionResult = await handleDeliveryCompletion(orderId, agentId, order, orderType);

    // Log the completion activitny
    try {
      await pool.query(
        'INSERT INTO agent_activities (agent_id, activity_type, order_id, description, created_at) VALUES (?, "order_completed", ?, ?, NOW())',
        [agentId, orderId, `${orderType} order completed with commission: ${commissionResult.commission} RWF`]
      );
    } catch (activityError) {
      console.warn('[COMPLETE-ORDER] Could not log activity:', activityError.message);
    }

    // Send notification to buyer
    const io = req.app.get('io');
    if (io) {
      const buyerId = order.buyer_id || order.user_id;
      io.to(`user_${buyerId}`).emit('order_completed', {
        orderId: orderId,
        orderType: orderType,
        status: orderType === 'local_market' ? 'completed' : 'delivered',
        message: 'Your order has been completed successfully!',
        commission: commissionResult.commission
      });
    }

    console.log(`[COMPLETE-ORDER] Order ${orderId} completed successfully with commission ${commissionResult.commission} RWF`);

    res.json({
      success: true,
      message: 'Order completed successfully',
      order: {
        id: orderId,
        status: orderType === 'local_market' ? 'completed' : 'delivered',
        completed_at: new Date().toISOString()
      },
      commission: {
        amount: commissionResult.commission,
        rate: commissionResult.commissionRate,
        base_amount: commissionResult.baseAmount,
        calculation_data: commissionResult.commissionData
      }
    });

  } catch (error) {
    console.error('[COMPLETE-ORDER] Order completion error:', error);
    res.status(500).json({ error: 'Failed to complete order: ' + error.message });
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
      LEFT JOIN users u ON go.buyer_id = u.id
      LEFT JOIN grocery_order_items goi ON go.id = goi.grocery_order_id
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
async function handleDeliveryCompletion(orderId, agentId, order, orderType = 'grocery') {
  try {
    console.log(`[COMMISSION] Calculating commission for ${orderType} order ${orderId}`);
    
    // Import commission calculator
    const { calculateFastDeliveryCommission, calculatePickupDeliveryCommission } = require('../utils/commission-calculator');
    
    let commission = 0;
    let commissionRate = 0;
    let baseAmount = 0;
    let commissionData = {};

    if (orderType === 'local_market') {
      // For local market orders: Fast Delivery Agent gets 50% of platform profit
      baseAmount = order.grand_total || order.total_amount;
      
      // Check if order has referral or site manager (would need to be added to order data)
      const hasReferral = order.referral_id ? true : false;
      const hasSiteManager = order.site_manager_id ? true : false;
      
      const result = calculateFastDeliveryCommission(baseAmount, hasReferral, hasSiteManager);
      commission = result.commission;
      commissionRate = result.commissionPercentage;
      
      commissionData = {
        selling_price: result.sellingPrice,
        purchasing_price: result.purchasingPrice,
        platform_profit: result.platformProfit,
        commission_percentage: result.commissionPercentage,
        final_commission: commission,
        calculation_method: 'platform_profit_percentage',
        breakdown: result.breakdown,
        calculated_at: new Date().toISOString()
      };

      // Update local market order
      await pool.query(
        'UPDATE local_market_orders SET agent_commission = ?, commission_calculated = 1, commission_data = ?, completed_at = NOW() WHERE id = ?',
        [commission, JSON.stringify(commissionData), orderId]
      );
      
      console.log(`[COMMISSION] Local market order ${orderId}: ${commission} RWF (${commissionRate}% of platform profit)`);
      
    } else {
      // For grocery orders: Pickup Delivery Agent gets 70% of platform profit
      baseAmount = order.total_amount;
      
      // Check if order has referral or site manager (would need to be added to order data)
      const hasReferral = order.referral_id ? true : false;
      const hasSiteManager = order.site_manager_id ? true : false;
      
      const result = calculatePickupDeliveryCommission(baseAmount, hasReferral, hasSiteManager);
      commission = result.commission;
      commissionRate = result.commissionPercentage;
      
      commissionData = {
        selling_price: result.sellingPrice,
        purchasing_price: result.purchasingPrice,
        platform_profit: result.platformProfit,
        commission_percentage: result.commissionPercentage,
        final_commission: commission,
        calculation_method: 'platform_profit_percentage',
        breakdown: result.breakdown,
        calculated_at: new Date().toISOString()
      };

      // Update grocery order
      await pool.query(
        'UPDATE grocery_orders SET agent_commission = ?, commission_calculated = 1, completed_at = NOW() WHERE id = ?',
        [commission, orderId]
      );
      
      console.log(`[COMMISSION] Grocery order ${orderId}: ${commission} RWF (${commissionRate}% of platform profit)`);
    }

    // Create commission transaction
    await pool.query(
      'INSERT INTO commission_transactions (order_id, agent_id, commission_type, amount, percentage, base_amount, status) VALUES (?, ?, "fast_delivery", ?, ?, ?, "pending")',
      [orderId, agentId, commission, commissionRate, baseAmount]
    );

    // Create agent earnings record
    await pool.query(
      'INSERT INTO agent_earnings (agent_id, order_id, amount, earnings_type, status) VALUES (?, ?, ?, "delivery", "pending")',
      [agentId, orderId, commission]
    );

    // Update agent totals
    await pool.query(
      'UPDATE agents SET total_earnings = total_earnings + ?, total_deliveries = total_deliveries + 1 WHERE id = ?',
      [commission, agentId]
    );

    console.log(`[COMMISSION] Agent ${agentId} earned ${commission} RWF for completing order ${orderId}`);
    
    return {
      commission,
      commissionRate,
      baseAmount,
      commissionData
    };

  } catch (error) {
    console.error('Delivery completion handling error:', error);
    throw error;
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

/**
 * Update Order Status
 * PUT /api/fast-delivery-agent/update-status/:orderId
 */
router.put('/update-status/:orderId', authenticateToken, verifyFastDeliveryAgent, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const agentId = req.agent.id;
    const { status, notes, orderType = 'regular', location } = req.body;

    console.log(`[UPDATE-STATUS] Agent ${agentId} updating order ${orderId} to status: ${status}, orderType: ${orderType}`);

    // Validate status values against database enums
    const validRegularStatuses = ['pending', 'confirmed', 'payment_submitted', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
    const validGroceryStatuses = [
      'pending', 'confirmed', 'assigned', 'preparing', 'ready', 'ready_for_pickup', 
      'picked_up', 'in_transit', 'delivered', 'cancelled', 'issue_at_pickup', 'delivery_failed'
    ];
    
    if (orderType === 'grocery' && !validGroceryStatuses.includes(status)) {
      return res.status(400).json({ 
        error: `Invalid status '${status}' for grocery order. Valid statuses: ${validGroceryStatuses.join(', ')}` 
      });
    }
    
    if (orderType === 'regular' && !validRegularStatuses.includes(status)) {
      return res.status(400).json({ 
        error: `Invalid status '${status}' for regular order. Valid statuses: ${validRegularStatuses.join(', ')}` 
      });
    }

    // Validate that the order belongs to this agent
    let order = null;
    if (orderType === 'grocery') {
      const [groceryOrders] = await pool.query(
        'SELECT * FROM grocery_orders WHERE id = ? AND agent_id = ?',
        [orderId, agentId]
      );
      order = groceryOrders[0];
    } else {
      const [regularOrders] = await pool.query(
        'SELECT * FROM orders WHERE id = ? AND agent_id = ?',
        [orderId, agentId]
      );
      order = regularOrders[0];
    }

    if (!order) {
      return res.status(404).json({ error: 'Order not found or not assigned to you' });
    }

    // Update the order status
    if (orderType === 'grocery') {
      await pool.query(
        'UPDATE grocery_orders SET status = ?, updated_at = NOW() WHERE id = ?',
        [status, orderId]
      );
    } else {
      await pool.query(
        'UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?',
        [status, orderId]
      );
    }

    // Log the status update
    try {
      await pool.query(
        'INSERT INTO agent_activities (agent_id, activity_type, order_id, description, created_at) VALUES (?, "status_update", ?, ?, NOW())',
        [agentId, orderId, `Status updated to ${status}${notes ? ': ' + notes : ''}`]
      );
    } catch (activityError) {
      console.warn('[UPDATE-STATUS] Could not log activity:', activityError.message);
    }

    // Send notification to buyer if status is significant
    const io = req.app.get('io');
    if (io && ['picked_up', 'in_transit', 'delivered'].includes(status)) {
      const buyerId = orderType === 'grocery' ? order.buyer_id : order.user_id;
      io.to(`user_${buyerId}`).emit('order_status_update', {
        orderId: orderId,
        orderType: orderType,
        status: status,
        message: `Your order status has been updated to: ${status.replace('_', ' ')}`
      });
    }

    console.log(`[UPDATE-STATUS] Order ${orderId} status updated to ${status}`);

    res.json({
      success: true,
      message: 'Order status updated successfully',
      order: {
        id: orderId,
        status: status,
        updated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[UPDATE-STATUS] Status update error:', error);
    res.status(500).json({ error: 'Failed to update order status: ' + error.message });
  }
});

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

/**
 * Get Available Fast Delivery Agents for Assignment
 * GET /api/fast-delivery-agent/available-agents
 */
router.get('/available-agents', async (req, res) => {
  try {
    console.log('[FAST-DELIVERY] Loading available agents...');

    // Get available fast delivery agents
    const [agents] = await pool.query(`
      SELECT 
        a.id,
        u.name,
        u.phone,
        a.status,
        a.current_lat,
        a.current_lng,
        a.vehicle_type,
        a.license_number,
        a.is_available,
        COALESCE(ar.average_rating, 0) as rating,
        COALESCE(ar.total_ratings, 0) as total_ratings,
        COUNT(go.id) as active_orders
      FROM agents a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN (
        SELECT 
          agent_id,
          AVG(rating) as average_rating,
          COUNT(*) as total_ratings
        FROM agent_ratings 
        GROUP BY agent_id
      ) ar ON a.user_id = ar.agent_id
      LEFT JOIN grocery_orders go ON a.id = go.agent_id AND go.status IN (
        'assigned', 'shopping', 'picked_up', 'in_transit'
      )
      WHERE a.agent_type IN ('fast_delivery_agent', 'fast_delivery')
        AND a.status = 'available'
        AND a.is_available = 1
        AND a.is_active = 1
      GROUP BY a.id, u.name, u.phone, a.status, a.current_lat, a.current_lng, a.vehicle_type, a.license_number, a.is_available, ar.average_rating, ar.total_ratings
      HAVING active_orders < 5
      ORDER BY ar.average_rating DESC, ar.total_ratings DESC
      LIMIT 20
    `);

    console.log(`[FAST-DELIVERY] Found ${agents.length} available agents`);

    const formattedAgents = agents.map(agent => ({
      id: agent.id,
      name: agent.name,
      phone: agent.phone,
      status: agent.status,
      rating: parseFloat(agent.rating || 0).toFixed(1),
      total_ratings: agent.total_ratings || 0,
      active_orders: agent.active_orders || 0,
      vehicle_type: agent.vehicle_type,
      license_number: agent.license_number,
      is_available: agent.is_available,
      current_location: agent.current_lat && agent.current_lng ? {
        lat: agent.current_lat,
        lng: agent.current_lng
      } : null
    }));

    res.json({
      success: true,
      agents: formattedAgents,
      total: formattedAgents.length
    });

  } catch (error) {
    console.error('[FAST-DELIVERY] Error loading available agents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load available agents'
    });
  }
});

/**
 * Request Withdrawal
 * POST /api/fast-delivery-agent/request-withdrawal
 */
router.post('/request-withdrawal', authenticateToken, verifyFastDeliveryAgent, async (req, res) => {
  try {
    const agentId = req.agent.id;
    const userId = req.user.id || req.user.userId;
    const { amount, payment_method, payment_details, notes } = req.body;

    console.log(`[FAST-DELIVERY] Withdrawal request from agent ${agentId}: ${amount} FRW`);

    // Validate required fields
    if (!amount || !payment_method || !payment_details) {
      return res.status(400).json({
        success: false,
        error: 'Amount, payment method, and payment details are required'
      });
    }

    // Validate amount
    const withdrawalAmount = parseFloat(amount);
    if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid withdrawal amount'
      });
    }

    if (withdrawalAmount < 1000) {
      return res.status(400).json({
        success: false,
        error: 'Minimum withdrawal amount is 1,000 FRW'
      });
    }

    // Calculate available balance
    const [earningsData] = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN status = 'delivered' THEN agent_commission ELSE 0 END), 0) as total_earnings,
        COALESCE((
          SELECT SUM(amount) 
          FROM agent_withdrawals 
          WHERE agent_id = ? AND status IN ('completed', 'processing')
        ), 0) as total_withdrawn,
        COALESCE((
          SELECT SUM(amount) 
          FROM agent_withdrawals 
          WHERE agent_id = ? AND status = 'pending'
        ), 0) as pending_withdrawals
      FROM local_market_orders 
      WHERE agent_id = ?
    `, [agentId, agentId, agentId]);

    const totalEarnings = parseFloat(earningsData[0].total_earnings || 0);
    const totalWithdrawn = parseFloat(earningsData[0].total_withdrawn || 0);
    const pendingWithdrawals = parseFloat(earningsData[0].pending_withdrawals || 0);
    const availableBalance = totalEarnings - totalWithdrawn - pendingWithdrawals;

    console.log(`[FAST-DELIVERY] Agent ${agentId} balance: ${availableBalance} FRW (Earnings: ${totalEarnings}, Withdrawn: ${totalWithdrawn}, Pending: ${pendingWithdrawals})`);

    if (withdrawalAmount > availableBalance) {
      return res.status(400).json({
        success: false,
        error: `Insufficient balance. Available: ${availableBalance.toLocaleString()} FRW`,
        available_balance: availableBalance
      });
    }

    // Get agent details
    const [agentDetails] = await pool.query(`
      SELECT a.*, u.username, u.email, u.phone
      FROM agents a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.id = ?
    `, [agentId]);

    if (agentDetails.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Agent not found' 
      });
    }

    const agent = agentDetails[0];

    // Create withdrawal request
    const [result] = await pool.execute(`
      INSERT INTO agent_withdrawals (agent_id, user_id, amount, payment_method, payment_details, notes, status, created_at) 
      VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())
    `, [agentId, userId, withdrawalAmount, payment_method, JSON.stringify(payment_details), notes || '']);

    const withdrawalId = result.insertId;

    // Create detailed notification for admin
    const notificationMessage = `New withdrawal request from ${agent.username || agent.email} (Fast Delivery Agent)
Amount: ${withdrawalAmount.toLocaleString()} FRW
Payment Method: ${payment_method.toUpperCase()}
Available Balance: ${availableBalance.toLocaleString()} FRW
Agent Phone: ${agent.phone}
${notes ? `Notes: ${notes}` : ''}`;

    await pool.execute(`
      INSERT INTO admin_notifications (type, title, message, data, created_at) 
      VALUES ('withdrawal_request', 'New Fast Delivery Agent Withdrawal Request', ?, ?, NOW())
    `, [
      notificationMessage,
      JSON.stringify({ 
        withdrawal_id: withdrawalId, 
        agent_id: agentId, 
        user_id: userId, 
        agent_name: agent.username || agent.email,
        agent_phone: agent.phone,
        amount: withdrawalAmount,
        payment_method: payment_method,
        payment_details: payment_details,
        available_balance: availableBalance,
        agent_type: 'Fast Delivery Agent'
      })
    ]);

    // Log the withdrawal request
    console.log(`[FAST-DELIVERY] Withdrawal request created: ID ${withdrawalId}, Agent: ${agent.username || agent.email}, Amount: ${withdrawalAmount} FRW`);

    res.json({
      success: true,
      message: 'Withdrawal request submitted successfully and sent to admin for approval',
      withdrawal_id: withdrawalId,
      status: 'pending',
      estimated_processing_time: '1-3 business days',
      available_balance: availableBalance - withdrawalAmount
    });

  } catch (error) {
    console.error('[FAST-DELIVERY] Withdrawal request error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to process withdrawal request. Please try again later.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Get Withdrawal History
 * GET /api/fast-delivery-agent/withdrawals
 */
router.get('/withdrawals', authenticateToken, verifyFastDeliveryAgent, async (req, res) => {
  try {
    const agentId = req.agent.id;
    const { limit = 10, offset = 0 } = req.query;

    // Get withdrawal history
    const [withdrawals] = await pool.query(`
      SELECT 
        id,
        amount,
        payment_method,
        payment_details,
        notes,
        status,
        admin_notes,
        created_at,
        processed_at
      FROM agent_withdrawals
      WHERE agent_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [agentId, parseInt(limit), parseInt(offset)]);

    // Get total count
    const [countResult] = await pool.query(`
      SELECT COUNT(*) as total
      FROM agent_withdrawals
      WHERE agent_id = ?
    `, [agentId]);

    // Calculate balance summary
    const [balanceData] = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN status = 'delivered' THEN agent_commission ELSE 0 END), 0) as total_earnings,
        COALESCE((
          SELECT SUM(amount) 
          FROM agent_withdrawals 
          WHERE agent_id = ? AND status = 'completed'
        ), 0) as total_withdrawn,
        COALESCE((
          SELECT SUM(amount) 
          FROM agent_withdrawals 
          WHERE agent_id = ? AND status = 'pending'
        ), 0) as pending_withdrawals
      FROM local_market_orders 
      WHERE agent_id = ?
    `, [agentId, agentId, agentId]);

    const totalEarnings = parseFloat(balanceData[0].total_earnings || 0);
    const totalWithdrawn = parseFloat(balanceData[0].total_withdrawn || 0);
    const pendingWithdrawals = parseFloat(balanceData[0].pending_withdrawals || 0);
    const availableBalance = totalEarnings - totalWithdrawn - pendingWithdrawals;

    res.json({
      success: true,
      withdrawals: withdrawals.map(w => ({
        ...w,
        payment_details: JSON.parse(w.payment_details || '{}')
      })),
      pagination: {
        total: countResult[0].total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: countResult[0].total > (parseInt(offset) + parseInt(limit))
      },
      balance_summary: {
        total_earnings: totalEarnings,
        total_withdrawn: totalWithdrawn,
        pending_withdrawals: pendingWithdrawals,
        available_balance: availableBalance
      }
    });

  } catch (error) {
    console.error('[FAST-DELIVERY] Get withdrawals error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch withdrawal history'
    });
  }
});

/**
 * Compatibility: Get My Orders (alias of active-orders)
 * GET /api/fast-delivery-agent/my-orders
 */
router.get('/my-orders', authenticateToken, verifyFastDeliveryAgent, async (req, res) => {
  try {
    const agentId = req.agent.id;

    const activeGroceryStatuses = ['assigned', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'in_transit', 'arrived_at_seller', 'picked_from_seller', 'en_route'];
    const activeLocalStatuses = ['confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery'];

    const [grocery] = await pool.query(
      `SELECT id, status, order_number, total_amount, 'grocery' as order_type
       FROM grocery_orders
       WHERE agent_id = ? AND status IN (${activeGroceryStatuses.map(()=> '?').join(',')})
       ORDER BY created_at DESC`,
      [agentId, ...activeGroceryStatuses]
    );

    const [local] = await pool.query(
      `SELECT id, status, grand_total as total_amount, id as order_number, 'local_market' as order_type
       FROM local_market_orders
       WHERE agent_id = ? AND status IN (${activeLocalStatuses.map(()=> '?').join(',')})
       ORDER BY created_at DESC`,
      [agentId, ...activeLocalStatuses]
    );

    res.json({ success: true, orders: [...grocery, ...local] });
  } catch (error) {
    console.error('[FAST-DELIVERY] my-orders error:', error);
    res.status(500).json({ error: 'Failed to fetch my orders' });
  }
});

/**
 * Compatibility: Order details alias
 * GET /api/fast-delivery-agent/order-details/:orderId
 */
router.get('/order-details/:orderId', authenticateToken, verifyFastDeliveryAgent, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const agentId = req.agent.id;

    const [gRows] = await pool.query('SELECT id, status, order_number, total_amount, buyer_id FROM grocery_orders WHERE id = ? AND agent_id = ?', [orderId, agentId]);
    if (gRows.length > 0) return res.json({ success: true, order: { ...gRows[0], order_type: 'grocery' } });

    const [lRows] = await pool.query('SELECT id, status, grand_total as total_amount, buyer_id FROM local_market_orders WHERE id = ? AND agent_id = ?', [orderId, agentId]);
    if (lRows.length > 0) return res.json({ success: true, order: { ...lRows[0], order_type: 'local_market' } });

    const [rRows] = await pool.query('SELECT id, status, total_amount, user_id as buyer_id FROM orders WHERE id = ? AND agent_id = ?', [orderId, agentId]);
    if (rRows.length > 0) return res.json({ success: true, order: { ...rRows[0], order_type: 'regular' } });

    return res.status(404).json({ error: 'Order not found' });
  } catch (error) {
    console.error('[FAST-DELIVERY] order-details error:', error);
    res.status(500).json({ error: 'Failed to fetch order details' });
  }
});

/**
 * Compatibility: Update order status (alias of PUT /update-status/:orderId)
 * POST /api/fast-delivery-agent/update-order-status/:orderId
 */
router.post('/update-order-status/:orderId', authenticateToken, verifyFastDeliveryAgent, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const agentId = req.agent.id;
    const { status = 'delivered', notes = null, orderType } = req.body || {};

    if (orderType === 'local_market') {
      const [rows] = await pool.query('SELECT id FROM local_market_orders WHERE id = ? AND agent_id = ?', [orderId, agentId]);
      if (rows.length === 0) return res.status(403).json({ error: 'Order not assigned to this agent' });
      await pool.query('UPDATE local_market_orders SET status = ?, updated_at = NOW() WHERE id = ?', [status, orderId]);
    } else if (orderType === 'regular') {
      const [rows] = await pool.query('SELECT id FROM orders WHERE id = ? AND agent_id = ?', [orderId, agentId]);
      if (rows.length === 0) return res.status(403).json({ error: 'Order not assigned to this agent' });
      await pool.query('UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?', [status, orderId]);
    } else {
      const [rows] = await pool.query('SELECT id FROM grocery_orders WHERE id = ? AND agent_id = ?', [orderId, agentId]);
      if (rows.length === 0) return res.status(403).json({ error: 'Order not assigned to this agent' });
      await pool.query('UPDATE grocery_orders SET status = ?, agent_delivery_notes = ?, updated_at = NOW() WHERE id = ?', [status, notes, orderId]);
    }

    res.json({ success: true, status });
  } catch (error) {
    console.error('[FAST-DELIVERY] update-order-status error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

module.exports = router;
