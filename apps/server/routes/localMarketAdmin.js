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

// Middleware to check admin role
const adminAuth = async (req, res, next) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [users] = await connection.execute(`
      SELECT role FROM users WHERE id = ?
    `, [req.user.id]);
    await connection.end();
    
    if (users.length === 0 || users[0].role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.'
      });
    }
    
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

// Get local market dashboard stats
router.get('/local-market-stats', authenticateToken, adminAuth, async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    // Get today's orders
    const [todayOrders] = await connection.execute(`
      SELECT COUNT(*) as count
      FROM grocery_orders
      WHERE DATE(created_at) = CURDATE()
    `);
    
    // Get platform revenue (commission + packaging fees)
    const [revenue] = await connection.execute(`
      SELECT 
        COALESCE(SUM(platform_commission + packaging_fee), 0) as revenue
      FROM grocery_orders
      WHERE status = 'delivered' AND DATE(delivered_at) = CURDATE()
    `);
    
    // Get active agents
    const [activeAgents] = await connection.execute(`
      SELECT COUNT(*) as count
      FROM users
      WHERE role = 'agent' AND agent_status = 'online' AND is_active = 1
    `);
    
    // Get average delivery time
    const [avgDeliveryTime] = await connection.execute(`
      SELECT 
        AVG(TIMESTAMPDIFF(MINUTE, agent_assigned_at, delivered_at)) as avg_time
      FROM grocery_orders
      WHERE status = 'delivered' AND agent_assigned_at IS NOT NULL AND delivered_at IS NOT NULL
        AND DATE(delivered_at) = CURDATE()
    `);
    
    // Get recent orders
    const [recentOrders] = await connection.execute(`
      SELECT 
        go.id,
        go.order_number,
        go.total_amount,
        go.status,
        go.created_at,
        u.name as buyer_name,
        COUNT(goi.id) as item_count
      FROM grocery_orders go
      LEFT JOIN users u ON go.buyer_id = u.id
      LEFT JOIN grocery_order_items goi ON go.id = goi.grocery_order_id
      GROUP BY go.id
      ORDER BY go.created_at DESC
      LIMIT 10
    `);
    
    await connection.end();
    
    res.json({
      success: true,
      stats: {
        totalOrders: todayOrders[0].count,
        platformRevenue: parseFloat(revenue[0].revenue),
        activeAgents: activeAgents[0].count,
        avgDeliveryTime: Math.round(avgDeliveryTime[0].avg_time || 0)
      },
      recentOrders: recentOrders
    });
  } catch (error) {
    console.error('Error fetching local market stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard stats'
    });
  }
});

// Get/Update local market settings
router.get('/local-market-settings', authenticateToken, adminAuth, async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    const [settings] = await connection.execute(`
      SELECT * FROM local_market_settings WHERE id = 1
    `);
    
    await connection.end();
    
    res.json({
      success: true,
      settings: settings[0] || {
        platform_commission_rate: 1.0,
        default_packaging_fee: 200,
        agent_base_earning: 1000,
        agent_per_km_bonus: 100,
        max_delivery_distance_km: 30,
        min_order_amount: 2000,
        auto_agent_assignment: true
      }
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settings'
    });
  }
});

router.post('/local-market-settings', authenticateToken, adminAuth, async (req, res) => {
  try {
    const {
      platform_commission_rate,
      default_packaging_fee,
      agent_base_earning,
      agent_per_km_bonus,
      max_delivery_distance_km,
      min_order_amount,
      auto_agent_assignment
    } = req.body;
    
    const connection = await mysql.createConnection(dbConfig);
    
    // Check if settings exist
    const [existing] = await connection.execute(`
      SELECT id FROM local_market_settings WHERE id = 1
    `);
    
    if (existing.length > 0) {
      // Update existing settings
      await connection.execute(`
        UPDATE local_market_settings
        SET 
          platform_commission_rate = COALESCE(?, platform_commission_rate),
          default_packaging_fee = COALESCE(?, default_packaging_fee),
          agent_base_earning = COALESCE(?, agent_base_earning),
          agent_per_km_bonus = COALESCE(?, agent_per_km_bonus),
          max_delivery_distance_km = COALESCE(?, max_delivery_distance_km),
          min_order_amount = COALESCE(?, min_order_amount),
          auto_agent_assignment = COALESCE(?, auto_agent_assignment),
          updated_at = NOW()
        WHERE id = 1
      `, [
        platform_commission_rate,
        default_packaging_fee,
        agent_base_earning,
        agent_per_km_bonus,
        max_delivery_distance_km,
        min_order_amount,
        auto_agent_assignment
      ]);
    } else {
      // Insert new settings
      await connection.execute(`
        INSERT INTO local_market_settings (
          id,
          platform_commission_rate,
          default_packaging_fee,
          agent_base_earning,
          agent_per_km_bonus,
          max_delivery_distance_km,
          min_order_amount,
          auto_agent_assignment,
          created_at
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
        platform_commission_rate || 1.0,
        default_packaging_fee || 200,
        agent_base_earning || 1000,
        agent_per_km_bonus || 100,
        max_delivery_distance_km || 30,
        min_order_amount || 2000,
        auto_agent_assignment !== undefined ? auto_agent_assignment : true
      ]);
    }
    
    await connection.end();
    
    res.json({
      success: true,
      message: 'Settings updated successfully'
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update settings'
    });
  }
});

// Get local market agents
router.get('/local-market-agents', authenticateToken, adminAuth, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    const connection = await mysql.createConnection(dbConfig);
    
    let whereCondition = 'role = "agent"';
    let queryParams = [];
    
    if (status) {
      whereCondition += ' AND agent_status = ?';
      queryParams.push(status);
    }
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    queryParams.push(parseInt(limit), offset);
    
    const [agents] = await connection.execute(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        u.city,
        u.agent_status as status,
        u.rating,
        u.last_active,
        u.created_at,
        COUNT(go.id) as total_deliveries,
        COALESCE(AVG(go.agent_rating), 0) as avg_rating,
        COALESCE(SUM(go.delivery_fee), 0) as total_earnings
      FROM users u
      LEFT JOIN grocery_orders go ON u.id = go.agent_id AND go.status = 'delivered'
      WHERE ${whereCondition}
      GROUP BY u.id
      ORDER BY u.last_active DESC
      LIMIT ? OFFSET ?
    `, queryParams);
    
    await connection.end();
    
    res.json({
      success: true,
      agents: agents
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch agents'
    });
  }
});

// Get local market orders
router.get('/local-market-orders', authenticateToken, adminAuth, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    const connection = await mysql.createConnection(dbConfig);
    
    let whereCondition = '1=1';
    let queryParams = [];
    
    if (status) {
      whereCondition += ' AND go.status = ?';
      queryParams.push(status);
    }
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    queryParams.push(parseInt(limit), offset);
    
    const [orders] = await connection.execute(`
      SELECT 
        go.*,
        u.name as buyer_name,
        u.phone as buyer_phone,
        a.name as agent_name,
        COUNT(goi.id) as item_count
      FROM grocery_orders go
      LEFT JOIN users u ON go.buyer_id = u.id
      LEFT JOIN users a ON go.agent_id = a.id
      LEFT JOIN grocery_order_items goi ON go.id = goi.grocery_order_id
      WHERE ${whereCondition}
      GROUP BY go.id
      ORDER BY go.created_at DESC
      LIMIT ? OFFSET ?
    `, queryParams);
    
    await connection.end();
    
    res.json({
      success: true,
      orders: orders
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders'
    });
  }
});

// Assign bonus to agent
router.post('/assign-agent-bonus', authenticateToken, adminAuth, async (req, res) => {
  try {
    const { agent_id, amount, reason } = req.body;
    const adminId = req.user.id;
    
    if (!agent_id || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Agent ID and valid amount are required'
      });
    }
    
    const connection = await mysql.createConnection(dbConfig);
    
    // Verify agent exists
    const [agents] = await connection.execute(`
      SELECT id, name FROM users WHERE id = ? AND role = 'agent'
    `, [agent_id]);
    
    if (agents.length === 0) {
      await connection.end();
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }
    
    // Insert bonus record
    await connection.execute(`
      INSERT INTO agent_bonuses (agent_id, admin_id, amount, reason, created_at)
      VALUES (?, ?, ?, ?, NOW())
    `, [agent_id, adminId, amount, reason || 'Admin bonus']);
    
    await connection.end();
    
    res.json({
      success: true,
      message: 'Bonus assigned successfully'
    });
  } catch (error) {
    console.error('Error assigning bonus:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign bonus'
    });
  }
});

// Get order analytics
router.get('/analytics/orders', authenticateToken, adminAuth, async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    
    const connection = await mysql.createConnection(dbConfig);
    
    let dateCondition = '';
    let groupBy = '';
    
    switch (period) {
      case 'today':
        dateCondition = 'DATE(created_at) = CURDATE()';
        groupBy = 'HOUR(created_at)';
        break;
      case 'week':
        dateCondition = 'created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
        groupBy = 'DATE(created_at)';
        break;
      case 'month':
        dateCondition = 'created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
        groupBy = 'DATE(created_at)';
        break;
      default:
        dateCondition = 'created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
        groupBy = 'DATE(created_at)';
    }
    
    // Get order trends
    const [orderTrends] = await connection.execute(`
      SELECT 
        ${groupBy} as period,
        COUNT(*) as order_count,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(SUM(platform_commission + packaging_fee), 0) as platform_revenue
      FROM grocery_orders
      WHERE ${dateCondition}
      GROUP BY ${groupBy}
      ORDER BY period ASC
    `);
    
    // Get status distribution
    const [statusDistribution] = await connection.execute(`
      SELECT 
        status,
        COUNT(*) as count
      FROM grocery_orders
      WHERE ${dateCondition}
      GROUP BY status
    `);
    
    // Get top performing agents
    const [topAgents] = await connection.execute(`
      SELECT 
        u.name,
        COUNT(go.id) as deliveries,
        COALESCE(SUM(go.delivery_fee), 0) as earnings,
        COALESCE(AVG(go.agent_rating), 0) as avg_rating
      FROM users u
      LEFT JOIN grocery_orders go ON u.id = go.agent_id AND go.status = 'delivered' AND ${dateCondition.replace('created_at', 'go.delivered_at')}
      WHERE u.role = 'agent'
      GROUP BY u.id
      HAVING deliveries > 0
      ORDER BY deliveries DESC
      LIMIT 10
    `);
    
    await connection.end();
    
    res.json({
      success: true,
      analytics: {
        order_trends: orderTrends,
        status_distribution: statusDistribution,
        top_agents: topAgents
      }
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics'
    });
  }
});

// Manually assign order to agent
router.post('/assign-order', authenticateToken, adminAuth, async (req, res) => {
  try {
    const { order_id, agent_id } = req.body;
    
    if (!order_id || !agent_id) {
      return res.status(400).json({
        success: false,
        message: 'Order ID and Agent ID are required'
      });
    }
    
    const connection = await mysql.createConnection(dbConfig);
    await connection.beginTransaction();
    
    try {
      // Verify order is available for assignment
      const [orders] = await connection.execute(`
        SELECT * FROM grocery_orders
        WHERE id = ? AND status = 'pending' AND agent_id IS NULL
      `, [order_id]);
      
      if (orders.length === 0) {
        await connection.rollback();
        await connection.end();
        return res.status(400).json({
          success: false,
          message: 'Order is not available for assignment'
        });
      }
      
      // Verify agent is available
      const [agents] = await connection.execute(`
        SELECT * FROM users
        WHERE id = ? AND role = 'agent' AND agent_status = 'online' AND is_active = 1
      `, [agent_id]);
      
      if (agents.length === 0) {
        await connection.rollback();
        await connection.end();
        return res.status(400).json({
          success: false,
          message: 'Agent is not available'
        });
      }
      
      // Assign order to agent
      await connection.execute(`
        UPDATE grocery_orders
        SET agent_id = ?, agent_assigned_at = NOW(), status = 'assigned'
        WHERE id = ?
      `, [agent_id, order_id]);
      
      // Update agent status
      await connection.execute(`
        UPDATE users
        SET agent_status = 'busy'
        WHERE id = ?
      `, [agent_id]);
      
      // Add tracking entry
      await connection.execute(`
        INSERT INTO grocery_order_tracking (grocery_order_id, status, message, created_at)
        VALUES (?, 'assigned', 'Order manually assigned by admin', NOW())
      `, [order_id]);
      
      await connection.commit();
      await connection.end();
      
      res.json({
        success: true,
        message: 'Order assigned successfully'
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error assigning order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign order'
    });
  }
});

// Get system health status
router.get('/system-status', authenticateToken, adminAuth, async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    // Check database connectivity
    const [dbCheck] = await connection.execute('SELECT 1 as status');
    
    // Get pending orders count
    const [pendingOrders] = await connection.execute(`
      SELECT COUNT(*) as count FROM grocery_orders WHERE status = 'pending'
    `);
    
    // Get online agents count
    const [onlineAgents] = await connection.execute(`
      SELECT COUNT(*) as count FROM users WHERE role = 'agent' AND agent_status = 'online'
    `);
    
    // Get recent error logs (if you have error logging)
    const [recentErrors] = await connection.execute(`
      SELECT COUNT(*) as count FROM error_logs 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
    `).catch(() => [{ count: 0 }]); // Fallback if error_logs table doesn't exist
    
    await connection.end();
    
    const systemStatus = {
      database: dbCheck[0].status === 1 ? 'healthy' : 'error',
      pending_orders: pendingOrders[0].count,
      online_agents: onlineAgents[0].count,
      recent_errors: recentErrors[0].count,
      overall_status: 'healthy' // You can implement more complex logic here
    };
    
    res.json({
      success: true,
      system_status: systemStatus
    });
  } catch (error) {
    console.error('Error checking system status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check system status',
      system_status: {
        database: 'error',
        overall_status: 'error'
      }
    });
  }
});

module.exports = router;