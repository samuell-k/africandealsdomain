const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const { authenticateToken } = require('../middleware/auth');

// Database connection
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'add_physical_product',
  port: process.env.DB_PORT || 3333
};

// Update agent status
router.post('/status', authenticateToken, async (req, res) => {
  try {
    const { status, location } = req.body;
    const userId = req.user.id;
    
    if (!['online', 'offline', 'busy'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }
    
    const connection = await mysql.createConnection(dbConfig);
    
    // Verify user is an agent
    const [users] = await connection.execute(`
      SELECT role FROM users WHERE id = ?
    `, [userId]);
    
    if (users.length === 0 || users[0].role !== 'agent') {
      await connection.end();
      return res.status(403).json({
        success: false,
        message: 'Access denied. Agent role required.'
      });
    }
    
    // Update agent status and location
    let updateQuery = 'UPDATE users SET agent_status = ?, last_active = NOW()';
    let queryParams = [status, userId];
    
    if (location && location.lat && location.lng) {
      updateQuery += ', latitude = ?, longitude = ?';
      queryParams.splice(1, 0, location.lat, location.lng);
    }
    
    updateQuery += ' WHERE id = ?';
    
    await connection.execute(updateQuery, queryParams);
    
    await connection.end();
    
    res.json({
      success: true,
      message: 'Status updated successfully'
    });
  } catch (error) {
    console.error('Error updating agent status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update status'
    });
  }
});

// Get agent dashboard stats
router.get('/dashboard-stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const connection = await mysql.createConnection(dbConfig);
    
    // Verify user is an agent
    const [users] = await connection.execute(`
      SELECT role FROM users WHERE id = ?
    `, [userId]);
    
    if (users.length === 0 || users[0].role !== 'agent') {
      await connection.end();
      return res.status(403).json({
        success: false,
        message: 'Access denied. Agent role required.'
      });
    }
    
    // Get today's deliveries
    const [todayDeliveries] = await connection.execute(`
      SELECT COUNT(*) as count
      FROM grocery_orders
      WHERE agent_id = ? AND status = 'delivered' AND DATE(delivered_at) = CURDATE()
    `, [userId]);
    
    // Get today's earnings
    const [todayEarnings] = await connection.execute(`
      SELECT COALESCE(SUM(delivery_fee), 0) as earnings
      FROM grocery_orders
      WHERE agent_id = ? AND status = 'delivered' AND DATE(delivered_at) = CURDATE()
    `, [userId]);
    
    // Get active orders
    const [activeOrders] = await connection.execute(`
      SELECT COUNT(*) as count
      FROM grocery_orders
      WHERE agent_id = ? AND status IN ('assigned', 'in_transit', 'shopping')
    `, [userId]);
    
    // Get agent rating
    const [rating] = await connection.execute(`
      SELECT AVG(agent_rating) as rating
      FROM grocery_orders
      WHERE agent_id = ? AND agent_rating IS NOT NULL
    `, [userId]);
    
    await connection.end();
    
    res.json({
      success: true,
      stats: {
        todayDeliveries: todayDeliveries[0].count,
        todayEarnings: todayEarnings[0].earnings,
        activeOrders: activeOrders[0].count,
        rating: rating[0].rating ? parseFloat(rating[0].rating).toFixed(1) : '4.8'
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard stats'
    });
  }
});

// Get agent's assigned orders
router.get('/assigned-orders', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;
    
    const connection = await mysql.createConnection(dbConfig);
    
    let whereCondition = 'go.agent_id = ?';
    let queryParams = [userId];
    
    if (status) {
      whereCondition += ' AND go.status = ?';
      queryParams.push(status);
    } else {
      whereCondition += ' AND go.status IN ("assigned", "shopping", "in_transit")';
    }
    
    const [orders] = await connection.execute(`
      SELECT 
        go.*,
        u.name as buyer_name,
        u.phone as buyer_phone,
        COUNT(goi.id) as item_count
      FROM grocery_orders go
      LEFT JOIN users u ON go.buyer_id = u.id
      LEFT JOIN grocery_order_items goi ON go.id = goi.grocery_order_id
      WHERE ${whereCondition}
      GROUP BY go.id
      ORDER BY go.created_at DESC
    `, queryParams);
    
    // Get order items for each order
    for (let order of orders) {
      const [items] = await connection.execute(`
        SELECT 
          goi.*,
          gp.product_name,
          gp.unit_type,
          gp.main_image,
          u.name as seller_name,
          u.city as seller_city,
          u.address as seller_address,
          u.phone as seller_phone
        FROM grocery_order_items goi
        LEFT JOIN grocery_products gp ON goi.grocery_product_id = gp.id
        LEFT JOIN users u ON goi.seller_id = u.id
        WHERE goi.grocery_order_id = ?
      `, [order.id]);
      
      order.items = items;
    }
    
    await connection.end();
    
    res.json({
      success: true,
      orders: orders
    });
  } catch (error) {
    console.error('Error fetching assigned orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch assigned orders'
    });
  }
});

// Update order status
router.post('/order/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, message, location } = req.body;
    const userId = req.user.id;
    
    const validStatuses = ['shopping', 'in_transit', 'delivered'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }
    
    const connection = await mysql.createConnection(dbConfig);
    await connection.beginTransaction();
    
    try {
      // Verify order belongs to agent
      const [orders] = await connection.execute(`
        SELECT * FROM grocery_orders
        WHERE id = ? AND agent_id = ?
      `, [id, userId]);
      
      if (orders.length === 0) {
        await connection.rollback();
        await connection.end();
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }
      
      // Update order status
      let updateQuery = 'UPDATE grocery_orders SET status = ?';
      let queryParams = [status];
      
      if (status === 'delivered') {
        updateQuery += ', delivered_at = NOW()';
        
        // Update agent status back to online
        await connection.execute(`
          UPDATE users SET agent_status = 'online' WHERE id = ?
        `, [userId]);
      }
      
      updateQuery += ' WHERE id = ?';
      queryParams.push(id);
      
      await connection.execute(updateQuery, queryParams);
      
      // Add tracking entry
      await connection.execute(`
        INSERT INTO grocery_order_tracking (grocery_order_id, status, message, agent_location_lat, agent_location_lng, created_at)
        VALUES (?, ?, ?, ?, ?, NOW())
      `, [
        id,
        status,
        message || `Order status updated to ${status}`,
        location?.lat || null,
        location?.lng || null
      ]);
      
      await connection.commit();
      await connection.end();
      
      res.json({
        success: true,
        message: 'Order status updated successfully'
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status'
    });
  }
});

// Get order details for agent
router.get('/order-details/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const connection = await mysql.createConnection(dbConfig);
    
    // Get order details
    const [orders] = await connection.execute(`
      SELECT 
        go.*,
        u.name as buyer_name,
        u.phone as buyer_phone,
        u.email as buyer_email
      FROM grocery_orders go
      LEFT JOIN users u ON go.buyer_id = u.id
      WHERE go.id = ? AND (go.agent_id = ? OR go.agent_id IS NULL)
    `, [id, userId]);
    
    if (orders.length === 0) {
      await connection.end();
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    const order = orders[0];
    
    // Get order items with seller details
    const [items] = await connection.execute(`
      SELECT 
        goi.*,
        gp.product_name,
        gp.unit_type,
        gp.main_image,
        u.name as seller_name,
        u.city as seller_city,
        u.address as seller_address,
        u.phone as seller_phone,
        u.latitude as seller_latitude,
        u.longitude as seller_longitude
      FROM grocery_order_items goi
      LEFT JOIN grocery_products gp ON goi.grocery_product_id = gp.id
      LEFT JOIN users u ON goi.seller_id = u.id
      WHERE goi.grocery_order_id = ?
    `, [id]);
    
    order.items = items;
    
    // Get tracking history
    const [tracking] = await connection.execute(`
      SELECT * FROM grocery_order_tracking
      WHERE grocery_order_id = ?
      ORDER BY created_at ASC
    `, [id]);
    
    order.tracking = tracking;
    
    await connection.end();
    
    res.json({
      success: true,
      order: order
    });
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order details'
    });
  }
});

// Update agent location
router.post('/location', authenticateToken, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const userId = req.user.id;
    
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }
    
    const connection = await mysql.createConnection(dbConfig);
    
    await connection.execute(`
      UPDATE users
      SET latitude = ?, longitude = ?, last_location_update = NOW()
      WHERE id = ? AND role = 'agent'
    `, [latitude, longitude, userId]);
    
    await connection.end();
    
    res.json({
      success: true,
      message: 'Location updated successfully'
    });
  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update location'
    });
  }
});

// Get agent earnings
router.get('/earnings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = 'week' } = req.query;
    
    const connection = await mysql.createConnection(dbConfig);
    
    let dateCondition = '';
    switch (period) {
      case 'today':
        dateCondition = 'DATE(delivered_at) = CURDATE()';
        break;
      case 'week':
        dateCondition = 'delivered_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
        break;
      case 'month':
        dateCondition = 'delivered_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
        break;
      default:
        dateCondition = 'delivered_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
    }
    
    // Get earnings summary
    const [earnings] = await connection.execute(`
      SELECT 
        COUNT(*) as total_deliveries,
        COALESCE(SUM(delivery_fee), 0) as total_earnings,
        COALESCE(AVG(delivery_fee), 0) as avg_earning_per_delivery
      FROM grocery_orders
      WHERE agent_id = ? AND status = 'delivered' AND ${dateCondition}
    `, [userId]);
    
    // Get daily breakdown
    const [dailyEarnings] = await connection.execute(`
      SELECT 
        DATE(delivered_at) as date,
        COUNT(*) as deliveries,
        COALESCE(SUM(delivery_fee), 0) as earnings
      FROM grocery_orders
      WHERE agent_id = ? AND status = 'delivered' AND ${dateCondition}
      GROUP BY DATE(delivered_at)
      ORDER BY date DESC
    `, [userId]);
    
    // Get bonuses
    const [bonuses] = await connection.execute(`
      SELECT 
        amount,
        reason,
        created_at
      FROM agent_bonuses
      WHERE agent_id = ? AND ${dateCondition.replace('delivered_at', 'created_at')}
      ORDER BY created_at DESC
    `, [userId]);
    
    const totalBonuses = bonuses.reduce((sum, bonus) => sum + parseFloat(bonus.amount), 0);
    
    await connection.end();
    
    res.json({
      success: true,
      earnings: {
        summary: {
          total_deliveries: earnings[0].total_deliveries,
          total_earnings: parseFloat(earnings[0].total_earnings),
          total_bonuses: totalBonuses,
          total_income: parseFloat(earnings[0].total_earnings) + totalBonuses,
          avg_earning_per_delivery: parseFloat(earnings[0].avg_earning_per_delivery)
        },
        daily_breakdown: dailyEarnings,
        bonuses: bonuses
      }
    });
  } catch (error) {
    console.error('Error fetching earnings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch earnings'
    });
  }
});

// Get delivery history
router.get('/delivery-history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    
    const connection = await mysql.createConnection(dbConfig);
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const [orders] = await connection.execute(`
      SELECT 
        go.*,
        u.name as buyer_name,
        u.phone as buyer_phone,
        COUNT(goi.id) as item_count
      FROM grocery_orders go
      LEFT JOIN users u ON go.buyer_id = u.id
      LEFT JOIN grocery_order_items goi ON go.id = goi.grocery_order_id
      WHERE go.agent_id = ? AND go.status = 'delivered'
      GROUP BY go.id
      ORDER BY go.delivered_at DESC
      LIMIT ? OFFSET ?
    `, [userId, parseInt(limit), offset]);
    
    // Get total count
    const [countResult] = await connection.execute(`
      SELECT COUNT(*) as total
      FROM grocery_orders
      WHERE agent_id = ? AND status = 'delivered'
    `, [userId]);
    
    await connection.end();
    
    res.json({
      success: true,
      orders: orders,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(countResult[0].total / parseInt(limit)),
        total_orders: countResult[0].total,
        per_page: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching delivery history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch delivery history'
    });
  }
});

module.exports = router;