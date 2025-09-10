/**
 * Fast Delivery Agent Routes - FIXED VERSION
 * Handles all functionality for Fast Delivery Agents
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

  jwt.verify(token, process.env.JWT_SECRET || 'adminafricandealsdomainpassword', (err, user) => {
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
    const userId = req.user.id || req.user.userId;
    
    const [agents] = await pool.query(
      'SELECT * FROM agents WHERE user_id = ? AND agent_type = "fast_delivery"',
      [userId]
    );

    if (agents.length === 0) {
      return res.status(403).json({ error: 'Fast delivery agent access required' });
    }

    req.agent = agents[0];
    next();
  } catch (error) {
    console.error('Agent verification error:', error);
    res.status(500).json({ error: 'Server error during agent verification' });
  }
};

// GET /api/fast-delivery-agent/available-orders
router.get('/available-orders', authenticateToken, verifyFastDeliveryAgent, async (req, res) => {
  try {
    const { limit = 20, radius = 5 } = req.query;
    
    console.log(`[AVAILABLE-ORDERS] Fetching orders for agent ${req.agent.id}`);

    // Get available orders from regular orders table (primary source)
    const [orders] = await pool.query(`
      SELECT 
        o.*,
        u.username as buyer_name,
        u.email as buyer_email,
        u.phone as buyer_phone,
        JSON_EXTRACT(o.shipping_address, '$.address') as delivery_address,
        JSON_EXTRACT(o.shipping_address, '$.lat') as delivery_lat,
        JSON_EXTRACT(o.shipping_address, '$.lng') as delivery_lng,
        JSON_EXTRACT(o.shipping_address, '$.phone') as buyer_phone_alt
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.agent_id IS NULL 
      AND o.status IN ('pending', 'confirmed')
      AND (o.delivery_type = 'fast_delivery' OR o.delivery_type IS NULL OR o.delivery_type = 'home_delivery')
      ORDER BY o.created_at DESC
      LIMIT ?
    `, [parseInt(limit)]);
    
    // Also get grocery orders
    const [groceryOrders] = await pool.query(`
      SELECT 
        go.*,
        u.username as buyer_name,
        u.phone as buyer_phone,
        u.email as buyer_email,
        'grocery' as order_type
      FROM grocery_orders go
      LEFT JOIN users u ON go.buyer_id = u.id
      WHERE go.status = 'pending' 
        AND go.agent_id IS NULL
      ORDER BY go.created_at ASC
      LIMIT ?
    `, [parseInt(limit)]);

    console.log(`[AVAILABLE-ORDERS] Found ${orders.length} regular orders and ${groceryOrders.length} grocery orders`);

    // Process regular orders
    const processedOrders = await Promise.all(orders.map(async (order) => {
      // Get order items
      const [orderItems] = await pool.query(`
        SELECT oi.*, p.name as product_name
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
      `, [order.id]);

      return {
        ...order,
        agent_commission: parseFloat(order.agent_commission) || 0,
        items: orderItems.map(item => ({
          ...item,
          product_name: item.product_name || item.name || 'Product',
          price: item.unit_price,
          quantity: item.quantity
        })),
        order_type: 'regular'
      };
    }));
    
    // Process grocery orders  
    const processedGroceryOrders = groceryOrders.map(order => ({
      ...order,
      id: order.id,
      order_number: order.order_number,
      total_amount: order.total_amount,
      agent_commission: parseFloat(order.agent_commission) || 0,
      buyer_name: order.buyer_name,
      buyer_phone: order.buyer_phone,
      delivery_address: order.delivery_address,
      items: JSON.parse(order.shopping_list || '[]'),
      order_type: 'grocery'
    }));

    // Combine all orders
    const allOrders = [...processedOrders, ...processedGroceryOrders];
    
    res.json({
      success: true,
      orders: allOrders
    });

  } catch (error) {
    console.error('Available orders fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch available orders' });
  }
});

// GET /api/fast-delivery-agent/active-orders
router.get('/active-orders', authenticateToken, verifyFastDeliveryAgent, async (req, res) => {
  try {
    const agentId = req.agent.id;

    console.log(`[ACTIVE-ORDERS] Fetching active orders for agent ${agentId}`);

    // Get active regular orders
    const [orders] = await pool.query(`
      SELECT 
        o.*,
        u.username as buyer_name,
        u.email as buyer_email,
        u.phone as buyer_phone,
        JSON_EXTRACT(o.shipping_address, '$.address') as delivery_address,
        JSON_EXTRACT(o.shipping_address, '$.lat') as delivery_lat,
        JSON_EXTRACT(o.shipping_address, '$.lng') as delivery_lng
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.agent_id = ? 
      AND o.status IN ('assigned', 'picked_from_seller', 'en_route', 'arrived_at_buyer')
      ORDER BY o.agent_assigned_at DESC
    `, [agentId]);

    // Get active grocery orders
    const [groceryOrders] = await pool.query(`
      SELECT 
        go.*,
        u.username as buyer_name,
        u.phone as buyer_phone,
        u.email as buyer_email
      FROM grocery_orders go
      LEFT JOIN users u ON go.buyer_id = u.id
      WHERE go.agent_id = ? 
        AND go.status IN ('assigned', 'shopping', 'picked_up', 'in_transit')
      ORDER BY go.agent_assigned_at DESC
    `, [agentId]);

    console.log(`[ACTIVE-ORDERS] Found ${orders.length} regular orders and ${groceryOrders.length} grocery orders`);

    // Process regular orders
    const processedOrders = await Promise.all(orders.map(async (order) => {
      const [orderItems] = await pool.query(`
        SELECT oi.*, p.name as product_name
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
      `, [order.id]);

      return {
        ...order,
        agent_commission: parseFloat(order.agent_commission) || 0,
        items: orderItems.map(item => ({
          ...item,
          product_name: item.product_name || item.name || 'Product',
          price: item.unit_price
        })),
        order_type: 'regular'
      };
    }));
    
    // Process grocery orders
    const processedGroceryOrders = groceryOrders.map(order => ({
      ...order,
      total_amount: order.total_amount,
      agent_commission: parseFloat(order.agent_commission) || 0,
      items: JSON.parse(order.shopping_list || '[]'),
      order_type: 'grocery'
    }));

    const allActiveOrders = [...processedOrders, ...processedGroceryOrders];

    res.json({
      success: true,
      orders: allActiveOrders
    });

  } catch (error) {
    console.error('Active orders fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch active orders' });
  }
});

// POST /api/fast-delivery-agent/accept-order/:orderId
router.post('/accept-order/:orderId', authenticateToken, verifyFastDeliveryAgent, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const orderId = req.params.orderId;
    const agentId = req.agent.id;
    const { orderType } = req.body; // 'regular' or 'grocery'

    console.log(`[ACCEPT-ORDER] Agent ${agentId} accepting order ${orderId} (type: ${orderType || 'regular'})`);

    let order;
    let tableName = orderType === 'grocery' ? 'grocery_orders' : 'orders';
    let userIdField = orderType === 'grocery' ? 'buyer_id' : 'user_id';
    
    // Lock and get the order
    const [orders] = await connection.query(
      `SELECT * FROM ${tableName} WHERE id = ? AND agent_id IS NULL AND status IN ('pending', 'confirmed') FOR UPDATE`,
      [orderId]
    );

    if (orders.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Order not available for assignment' });
    }

    order = orders[0];

    // Check agent capacity
    const [currentOrders] = await connection.query(
      `SELECT COUNT(*) as count FROM orders WHERE agent_id = ? AND status IN ('assigned', 'picked_from_seller', 'en_route')
       UNION ALL
       SELECT COUNT(*) as count FROM grocery_orders WHERE agent_id = ? AND status IN ('assigned', 'shopping', 'picked_up', 'in_transit')`,
      [agentId, agentId]
    );

    const totalActive = currentOrders.reduce((sum, row) => sum + row.count, 0);
    if (totalActive >= 5) {
      await connection.rollback();
      return res.status(400).json({ error: 'Maximum concurrent orders reached (5)' });
    }

    // Assign order to agent
    await connection.query(
      `UPDATE ${tableName} SET agent_id = ?, status = 'assigned', agent_assigned_at = NOW(), updated_at = NOW() WHERE id = ?`,
      [agentId, orderId]
    );

    // Generate delivery code
    const deliveryCode = Math.random().toString(36).substr(2, 6).toUpperCase();
    await connection.query(
      `UPDATE ${tableName} SET delivery_code = ? WHERE id = ?`,
      [deliveryCode, orderId]
    );

    await connection.commit();
    
    res.json({ 
      success: true, 
      message: 'Order accepted successfully',
      orderNumber: order.order_number,
      deliveryCode: deliveryCode
    });

  } catch (error) {
    await connection.rollback();
    console.error('Accept order error:', error);
    res.status(500).json({ error: 'Failed to accept order' });
  } finally {
    connection.release();
  }
});

// GET /api/fast-delivery-agent/stats  
router.get('/stats', authenticateToken, verifyFastDeliveryAgent, async (req, res) => {
  try {
    const agentId = req.agent.id;

    // Today's stats from both tables
    const [todayStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as completed_orders,
        SUM(CASE WHEN status = 'delivered' THEN agent_commission ELSE 0 END) as today_earnings
      FROM orders WHERE agent_id = ? AND DATE(created_at) = CURDATE()
      UNION ALL
      SELECT 
        COUNT(*) as total_orders,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as completed_orders,
        SUM(CASE WHEN status = 'delivered' THEN agent_commission ELSE 0 END) as today_earnings
      FROM grocery_orders WHERE agent_id = ? AND DATE(created_at) = CURDATE()
    `, [agentId, agentId]);

    const totalToday = todayStats.reduce((acc, row) => ({
      total_orders: acc.total_orders + row.total_orders,
      completed_orders: acc.completed_orders + row.completed_orders,
      today_earnings: acc.today_earnings + parseFloat(row.today_earnings || 0)
    }), { total_orders: 0, completed_orders: 0, today_earnings: 0 });

    res.json({
      success: true,
      stats: {
        today: totalToday,
        active: { count: 0 }, // Will be calculated separately if needed
        rating: { average_rating: 4.5, total_ratings: 0 }
      }
    });

  } catch (error) {
    console.error('Stats fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
