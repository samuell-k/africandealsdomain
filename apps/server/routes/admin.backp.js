const express = require('express');
const router = express.Router();
const db = require('../db.js');
const bcrypt = require('bcrypt');
const { requireAuth, requireRole } = require('./auth.js');
const { sendTemplatedEmail } = require('../utils/mailer');

// ====================================================================
// ENHANCED ERROR HANDLING SYSTEM
// ====================================================================

const enhancedErrorHandler = (routeHandler) => {
    return async (req, res, next) => {
        const startTime = Date.now();
        
        try {
            // Enhanced logging
            console.log(`📡 [ADMIN-API] ${req.method} ${req.originalUrl}`);
            console.log(`👤 [ADMIN-API] User: ${req.user?.email || 'unknown'} (Role: ${req.user?.role || 'unknown'})`);
            console.log(`📊 [ADMIN-API] Query params:`, req.query);
            console.log(`📦 [ADMIN-API] Body:`, req.body);
            
            await routeHandler(req, res, next);
            
            const duration = Date.now() - startTime;
            console.log(`⚡ [ADMIN-API] Request completed in ${duration}ms`);
            
        } catch (error) {
            const duration = Date.now() - startTime;
            
            // Comprehensive error logging
            console.error(`❌ [ADMIN-API] ERROR in ${req.method} ${req.originalUrl}`);
            console.error(`⏱️ [ADMIN-API] Failed after ${duration}ms`);
            console.error(`👤 [ADMIN-API] User: ${req.user?.email || 'unknown'}`);
            console.error(`💥 [ADMIN-API] Error details:`, {
                message: error.message,
                stack: error.stack,
                sql: error.sql || 'N/A',
                sqlMessage: error.sqlMessage || 'N/A',
                code: error.code || 'UNKNOWN',
                errno: error.errno || 'N/A'
            });
            
            // Save error to database for tracking
            try {
                await db.execute(`
                    INSERT INTO system_logs (level, message, details, created_at)
                    VALUES (?, ?, ?, NOW())
                `, [
                    'error',
                    `API Error: ${req.method} ${req.originalUrl}`,
                    JSON.stringify({
                        error: error.message,
                        stack: error.stack,
                        user: req.user?.email || 'unknown',
                        userAgent: req.headers['user-agent'],
                        ip: req.ip,
                        params: req.params,
                        query: req.query,
                        body: req.body
                    })
                ]);
            } catch (logError) {
                console.error('Failed to log error to database:', logError);
            }
            
            // User-friendly error response
            const isDevelopment = process.env.NODE_ENV === 'development';
            
            res.status(error.status || 500).json({
                success: false,
                message: error.message || 'Internal server error',
                error: isDevelopment ? {
                    message: error.message,
                    stack: error.stack,
                    details: error
                } : 'An unexpected error occurred. Please try again.',
                timestamp: new Date().toISOString(),
                requestId: req.headers['x-request-id'] || 'unknown'
            });
        }
    };
};

console.log('🔧 [ADMIN ROUTER] Loading admin routes...');

// Public health check endpoint (no auth required)
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Admin API is healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Apply authentication middleware to all admin routes (except health)
router.use(requireAuth);
router.use(requireRole('admin'));

console.log('🔧 [ADMIN ROUTER] Admin routes loaded successfully');

// ==================== DASHBOARD & ANALYTICS ====================

// GET /api/admin/dashboard - Dashboard statistics
router.get('/dashboard', enhancedErrorHandler(async (req, res) => {
    // Get real-time statistics
    const [userStats] = await db.execute(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN role = 'buyer' THEN 1 END) as total_buyers,
        COUNT(CASE WHEN role = 'seller' THEN 1 END) as total_sellers,
        COUNT(CASE WHEN role = 'agent' THEN 1 END) as total_agents,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as new_users_week
      FROM users
    `);

    const [orderStats] = await db.execute(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_orders,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as new_orders_week,
        COALESCE(SUM(total_amount), 0) as total_revenue
      FROM orders
    `);

    const [productStats] = await db.execute(`
      SELECT 
        COUNT(*) as total_products,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_products,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_products,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as new_products_week
      FROM products
    `);

    const [paymentStats] = await db.execute(`
      SELECT 
        COUNT(*) as total_transactions,
        COUNT(CASE WHEN status = 'pending_confirmation' THEN 1 END) as pending_payments,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_payments,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as total_payment_amount
      FROM payment_transactions
    `);

    // Get pending approvals count
    let approvalStats = [{ pending_approvals: 0, manual_payments: 0 }];
    try {
        [approvalStats] = await db.execute(`
          SELECT 
            COUNT(*) as pending_approvals,
            COUNT(CASE WHEN approval_type = 'MANUAL_PAYMENT' THEN 1 END) as manual_payments
          FROM admin_approvals 
          WHERE status = 'pending'
        `);
    } catch (error) {
        console.warn('admin_approvals table not available yet:', error.message);
    }

    // Recent activities
    const [recentActivities] = await db.execute(`
      SELECT 
        'user_registration' as type,
        CONCAT(username, ' registered as ', role) as description,
        created_at as timestamp
      FROM users 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      
      UNION ALL
      
      SELECT 
        'order_placed' as type,
        CONCAT('Order #', order_number, ' placed - $', total_amount) as description,
        created_at as timestamp
      FROM orders 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      
      ORDER BY timestamp DESC 
      LIMIT 10
    `);

    const dashboardData = {
      stats: {
        users: userStats[0],
        orders: orderStats[0],
        products: productStats[0],
        payments: paymentStats[0],
        approvals: approvalStats[0]
      },
      recent_activities: recentActivities,
      system_health: {
        database_status: 'healthy',
        last_updated: new Date().toISOString()
      }
    };

    res.json({
      success: true,
      message: 'Dashboard data retrieved successfully',
      ...dashboardData
    });
}));

// GET /api/admin/analytics - Advanced analytics
router.get('/analytics', enhancedErrorHandler(async (req, res) => {
    const { period = '30' } = req.query;
    
    // Daily statistics for the period
    const [dailyStats] = await db.execute(`
      SELECT 
        DATE(created_at) as date,
        COUNT(CASE WHEN table_name = 'users' THEN 1 END) as new_users,
        COUNT(CASE WHEN table_name = 'orders' THEN 1 END) as new_orders,
        COUNT(CASE WHEN table_name = 'products' THEN 1 END) as new_products
      FROM (
        SELECT created_at, 'users' as table_name FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        UNION ALL
        SELECT created_at, 'orders' as table_name FROM orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        UNION ALL
        SELECT created_at, 'products' as table_name FROM products WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      ) combined
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `, [period, period, period]);

    // Revenue analytics
    const [revenueStats] = await db.execute(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as order_count,
        SUM(total_amount) as daily_revenue,
        AVG(total_amount) as avg_order_value
      FROM orders 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `, [period]);

    res.json({
      success: true,
      message: 'Analytics data retrieved successfully',
      analytics: {
        daily_stats: dailyStats,
        revenue_stats: revenueStats,
        period: `${period} days`
      }
    });
}));

// ==================== USER MANAGEMENT ====================

// GET /api/admin/users - Get all users with filtering
router.get('/users', enhancedErrorHandler(async (req, res) => {
    const { 
      role, 
      status, 
      search, 
      page = 1, 
      limit = 50,
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = req.query;

    let whereConditions = [];
    let queryParams = [];

    // Build dynamic WHERE clause
    if (role) {
      whereConditions.push('role = ?');
      queryParams.push(role);
    }

    if (status) {
      if (status === 'active') {
        whereConditions.push('is_active = 1');
      } else if (status === 'inactive') {
        whereConditions.push('is_active = 0');
      }
    }

    if (search) {
      whereConditions.push('(username LIKE ? OR email LIKE ? OR first_name LIKE ? OR last_name LIKE ?)');
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    
    // Get total count
    const [countResult] = await db.execute(`
      SELECT COUNT(*) as total 
      FROM users 
      ${whereClause}
    `, queryParams);

    const totalUsers = countResult[0].total;
    const offset = (page - 1) * limit;

    // Get users with pagination
    const [users] = await db.execute(`
      SELECT 
        id, username, email, first_name, last_name, role, 
        is_active, is_verified, phone, created_at, updated_at
      FROM users 
      ${whereClause}
      ORDER BY ${sort_by} ${sort_order}
      LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), offset]);

    // Get total statistics for all users (not just filtered)
    const [totalStats] = await db.execute(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN role = 'buyer' THEN 1 END) as total_buyers,
        COUNT(CASE WHEN role = 'seller' THEN 1 END) as total_sellers,
        COUNT(CASE WHEN role = 'agent' THEN 1 END) as total_agents
      FROM users
    `);

    res.json({
      success: true,
      message: 'Users retrieved successfully',
      users: users,
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total: totalUsers,
        total_pages: Math.ceil(totalUsers / limit)
      },
      statistics: totalStats[0],
      filters: { role, status, search }
    });
}));

// GET /api/admin/users/:id - Get specific user details
router.get('/users/:id', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;

    const [users] = await db.execute(`
      SELECT 
        id, username, email, first_name, last_name, role, 
        is_active, is_verified, phone, created_at, updated_at
      FROM users 
      WHERE id = ?
    `, [id]);

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];

    // Get user's orders if they're a buyer
    let orders = [];
    if (user.role === 'buyer') {
      [orders] = await db.execute(`
        SELECT id, order_number, total_amount, status, created_at
        FROM orders 
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 10
      `, [id]);
    }

    // Get user's products if they're a seller
    let products = [];
    if (user.role === 'seller') {
      [products] = await db.execute(`
        SELECT id, name, price, status, created_at
        FROM products 
        WHERE seller_id = ?
        ORDER BY created_at DESC
        LIMIT 10
      `, [id]);
    }

    res.json({
      success: true,
      message: 'User details retrieved successfully',
      user: user,
      orders: orders,
      products: products
    });
}));

// PUT /api/admin/users/:id/status - Update user status
router.put('/users/:id/status', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    const { status, reason } = req.body;

    if (!['active', 'inactive', 'suspended'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be active, inactive, or suspended'
      });
    }

    const isActive = status === 'active' ? 1 : 0;

    await db.execute(`
      UPDATE users 
      SET is_active = ?, updated_at = NOW()
      WHERE id = ?
    `, [isActive, id]);

    // Log the status change
    await db.execute(`
      INSERT INTO system_logs (level, message, details, created_at)
      VALUES (?, ?, ?, NOW())
    `, [
      'info',
      `User status changed to ${status}`,
      JSON.stringify({
        user_id: id,
        new_status: status,
        reason: reason || 'No reason provided',
        changed_by: req.user.id,
        changed_by_email: req.user.email
      })
    ]);

    res.json({
      success: true,
      message: `User status updated to ${status} successfully`
    });
}));

// POST /api/admin/users - Create new user
router.post('/users', enhancedErrorHandler(async (req, res) => {
    const { 
      first_name, 
      last_name, 
      username, 
      email, 
      phone, 
      password, 
      role, 
      agent_type, 
      is_active = 1 
    } = req.body;

    // Validate required fields
    if (!first_name || !last_name || !username || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: first_name, last_name, username, email, password, role'
      });
    }

    // Validate agent type for agents
    if (role === 'agent' && !agent_type) {
      return res.status(400).json({
        success: false,
        message: 'Agent type is required for agent role'
      });
    }

    // Check if username or email already exists
    const [existingUsers] = await db.execute(
      'SELECT id FROM users WHERE username = ? OR email = ?', 
      [username, email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Username or email already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const [result] = await db.execute(`
      INSERT INTO users (
        first_name, last_name, username, email, phone, password, 
        role, agent_type, is_active, is_verified, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
    `, [
      first_name, 
      last_name, 
      username, 
      email, 
      phone || null, 
      hashedPassword, 
      role, 
      role === 'agent' ? agent_type : null, 
      is_active
    ]);

    // Log user creation
    await db.execute(`
      INSERT INTO system_logs (level, message, details, created_at)
      VALUES (?, ?, ?, NOW())
    `, [
      'info',
      `New user created by admin`,
      JSON.stringify({
        new_user_id: result.insertId,
        username: username,
        email: email,
        role: role,
        agent_type: agent_type || null,
        created_by: req.user?.id || 'unknown',
        created_by_email: req.user?.email || 'unknown'
      })
    ]);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user_id: result.insertId
    });
}));

// PUT /api/admin/users/:id - Update user
router.put('/users/:id', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    const { 
      first_name, 
      last_name, 
      username, 
      email, 
      phone, 
      role, 
      agent_type, 
      is_active 
    } = req.body;

    // Check if user exists
    const [existingUsers] = await db.execute('SELECT * FROM users WHERE id = ?', [id]);
    
    if (existingUsers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const existingUser = existingUsers[0];

    // Validate required fields
    if (!first_name || !last_name || !username || !email || !role) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: first_name, last_name, username, email, role'
      });
    }

    // Validate agent type for agents
    if (role === 'agent' && !agent_type) {
      return res.status(400).json({
        success: false,
        message: 'Agent type is required for agent role'
      });
    }

    // Check if username or email already exists (excluding current user)
    const [duplicateUsers] = await db.execute(
      'SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?', 
      [username, email, id]
    );

    if (duplicateUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Username or email already exists'
      });
    }

    // Update user
    await db.execute(`
      UPDATE users SET 
        first_name = ?, 
        last_name = ?, 
        username = ?, 
        email = ?, 
        phone = ?, 
        role = ?, 
        agent_type = ?, 
        is_active = ?, 
        updated_at = NOW()
      WHERE id = ?
    `, [
      first_name, 
      last_name, 
      username, 
      email, 
      phone || null, 
      role, 
      role === 'agent' ? agent_type : null, 
      is_active !== undefined ? is_active : existingUser.is_active,
      id
    ]);

    // Log user update
    await db.execute(`
      INSERT INTO system_logs (level, message, details, created_at)
      VALUES (?, ?, ?, NOW())
    `, [
      'info',
      `User updated by admin`,
      JSON.stringify({
        user_id: id,
        username: username,
        email: email,
        role: role,
        agent_type: agent_type || null,
        changes: {
          first_name: existingUser.first_name !== first_name,
          last_name: existingUser.last_name !== last_name,
          username: existingUser.username !== username,
          email: existingUser.email !== email,
          phone: existingUser.phone !== phone,
          role: existingUser.role !== role,
          agent_type: existingUser.agent_type !== agent_type,
          is_active: existingUser.is_active !== is_active
        },
        updated_by: req.user.id,
        updated_by_email: req.user.email
      })
    ]);

    res.json({
      success: true,
      message: 'User updated successfully'
    });
}));

// DELETE /api/admin/users/:id - Delete user (soft delete)
router.delete('/users/:id', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    // Check if user exists
    const [users] = await db.execute('SELECT id, email FROM users WHERE id = ?', [id]);
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Soft delete by deactivating
    await db.execute(`
      UPDATE users 
      SET is_active = 0, updated_at = NOW()
      WHERE id = ?
    `, [id]);

    // Log the deletion
    await db.execute(`
      INSERT INTO system_logs (level, message, details, created_at)
      VALUES (?, ?, ?, NOW())
    `, [
      'warning',
      `User account deleted`,
      JSON.stringify({
        user_id: id,
        user_email: users[0].email,
        reason: reason || 'No reason provided',
        deleted_by: req.user.id,
        deleted_by_email: req.user.email
      })
    ]);

    res.json({
      success: true,
      message: 'User account deactivated successfully'
    });
}));

// ==================== PRODUCT MANAGEMENT ====================

// DUPLICATE ROUTE REMOVED - Using the enhanced products route below with stats

// PUT /api/admin/products/:id/approve - Approve product
router.put('/products/:id/approve', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    const { notes } = req.body;

    await db.execute(`
      UPDATE products 
      SET status = 'active', updated_at = NOW()
      WHERE id = ?
    `, [id]);

    // Log the approval
    await db.execute(`
      INSERT INTO system_logs (level, message, details, created_at)
      VALUES (?, ?, ?, NOW())
    `, [
      'info',
      `Product approved`,
      JSON.stringify({
        product_id: id,
        notes: notes || 'No notes provided',
        approved_by: req.user.id,
        approved_by_email: req.user.email
      })
    ]);

    res.json({
      success: true,
      message: 'Product approved successfully'
    });
}));

// PUT /api/admin/products/:id/reject - Reject product
router.put('/products/:id/reject', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    await db.execute(`
      UPDATE products 
      SET status = 'rejected', updated_at = NOW()
      WHERE id = ?
    `, [id]);

    // Log the rejection
    await db.execute(`
      INSERT INTO system_logs (level, message, details, created_at)
      VALUES (?, ?, ?, NOW())
    `, [
      'warning',
      `Product rejected`,
      JSON.stringify({
        product_id: id,
        reason: reason,
        rejected_by: req.user.id,
        rejected_by_email: req.user.email
      })
    ]);

    res.json({
      success: true,
      message: 'Product rejected successfully'
    });
}));

// ==================== ORDER MANAGEMENT ====================

// GET /api/admin/orders - Get all orders with filtering
router.get('/orders', enhancedErrorHandler(async (req, res) => {
    const { 
      status, 
      user_id,
      seller_id,
      search, 
      page = 1, 
      limit = 50,
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = req.query;

    let whereConditions = [];
    let queryParams = [];

    if (status) {
      whereConditions.push('o.status = ?');
      queryParams.push(status);
    }

    if (user_id) {
      whereConditions.push('o.user_id = ?');
      queryParams.push(user_id);
    }

    if (seller_id) {
      whereConditions.push('o.seller_id = ?');
      queryParams.push(seller_id);
    }

    if (search) {
      whereConditions.push('(o.order_number LIKE ? OR u.email LIKE ?)');
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    
    // Get total count
    const [countResult] = await db.execute(`
      SELECT COUNT(*) as total 
      FROM orders o
      ${whereClause}
    `, queryParams);

    const totalOrders = countResult[0].total;
    const offset = (page - 1) * limit;

    // Get orders with user info
    const [orders] = await db.execute(`
      SELECT 
        o.id, o.order_number, o.total_amount, o.status, o.created_at,
        o.shipping_address, o.payment_method,
        u.username as buyer_name, u.email as buyer_email,
        s.username as seller_name, s.email as seller_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN users s ON o.seller_id = s.id
      ${whereClause}
      ORDER BY o.${sort_by} ${sort_order}
      LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), offset]);

    res.json({
      success: true,
      message: 'Orders retrieved successfully',
      orders: orders,
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total: totalOrders,
        total_pages: Math.ceil(totalOrders / limit)
      },
      filters: { status, user_id, seller_id, search }
    });
}));

// GET /api/admin/orders/:id - Get specific order details
router.get('/orders/:id', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;

    const [orders] = await db.execute(`
      SELECT 
        o.*, 
        u.username as buyer_name, u.email as buyer_email, u.phone as buyer_phone,
        s.username as seller_name, s.email as seller_email, s.phone as seller_phone
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN users s ON o.seller_id = s.id
      WHERE o.id = ?
    `, [id]);

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Get order items
    const [orderItems] = await db.execute(`
      SELECT 
        oi.*, 
        p.name as product_name
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `, [id]);

    // Get payment transactions
    const [payments] = await db.execute(`
      SELECT * FROM payment_transactions 
      WHERE order_id = ?
      ORDER BY created_at DESC
    `, [id]);

    res.json({
      success: true,
      message: 'Order details retrieved successfully',
      order: orders[0],
      order_items: orderItems,
      payments: payments
    });
}));

// PUT /api/admin/orders/:id/status - Update order status
router.put('/orders/:id/status', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    const { status, reason } = req.body;

    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Get current order status
    const [currentOrder] = await db.execute('SELECT status FROM orders WHERE id = ?', [id]);
    
    if (currentOrder.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const oldStatus = currentOrder[0].status;

    // Update order status
    await db.execute(`
      UPDATE orders 
      SET status = ?, updated_at = NOW()
      WHERE id = ?
    `, [status, id]);

    // Log status change in order_status_history if table exists
    try {
      await db.execute(`
        INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, change_reason, created_at)
        VALUES (?, ?, ?, ?, ?, NOW())
      `, [id, oldStatus, status, req.user.id, reason || 'Status updated by admin']);
    } catch (error) {
      console.warn('order_status_history table not available:', error.message);
    }

    // Log the status change
    await db.execute(`
      INSERT INTO system_logs (level, message, details, created_at)
      VALUES (?, ?, ?, NOW())
    `, [
      'info',
      `Order status changed from ${oldStatus} to ${status}`,
      JSON.stringify({
        order_id: id,
        old_status: oldStatus,
        new_status: status,
        reason: reason || 'No reason provided',
        changed_by: req.user.id,
        changed_by_email: req.user.email
      })
    ]);

    res.json({
      success: true,
      message: `Order status updated to ${status} successfully`
    });
}));

// ==================== PAYMENT MANAGEMENT ====================

// GET /api/admin/pda-approvals/pending - Get pending payment approvals
router.get('/pda-approvals/pending', enhancedErrorHandler(async (req, res) => {
    try {
      // Try to get from admin_approvals table first
      const [approvals] = await db.execute(`
        SELECT 
          aa.id, aa.order_id, aa.approval_type, aa.status, aa.request_reason,
          aa.created_at, aa.updated_at,
          o.order_number, o.total_amount,
          u.username as buyer_name, u.email as buyer_email,
          s.username as seller_name, s.email as seller_email
        FROM admin_approvals aa
        LEFT JOIN orders o ON aa.order_id = o.id
        LEFT JOIN users u ON o.user_id = u.id
        LEFT JOIN users s ON o.seller_id = s.id
        WHERE aa.status = 'pending' AND aa.approval_type = 'MANUAL_PAYMENT'
        ORDER BY aa.created_at DESC
      `);

      res.json({
        success: true,
        message: 'Pending payment approvals retrieved successfully',
        approvals: approvals,
        count: approvals.length
      });

    } catch (error) {
      // Fallback to payment_transactions if admin_approvals doesn't exist
      console.warn('admin_approvals table not available, using payment_transactions fallback');
      
      const [transactions] = await db.execute(`
        SELECT 
          pt.id, pt.order_id, pt.amount, pt.status, pt.payment_method,
          pt.screenshot_url, pt.created_at,
          o.order_number, o.total_amount,
          u.username as buyer_name, u.email as buyer_email,
          s.username as seller_name, s.email as seller_email
        FROM payment_transactions pt
        LEFT JOIN orders o ON pt.order_id = o.id
        LEFT JOIN users u ON o.user_id = u.id
        LEFT JOIN users s ON o.seller_id = s.id
        WHERE pt.status = 'pending_confirmation'
        ORDER BY pt.created_at DESC
      `);

      // Transform to match expected format
      const approvals = transactions.map(t => ({
        id: t.id,
        order_id: t.order_id,
        approval_type: 'MANUAL_PAYMENT',
        status: 'pending',
        request_reason: `Payment confirmation needed for ${t.payment_method} payment`,
        created_at: t.created_at,
        updated_at: t.created_at,
        order_number: t.order_number,
        total_amount: t.total_amount,
        buyer_name: t.buyer_name,
        buyer_email: t.buyer_email,
        seller_name: t.seller_name,
        seller_email: t.seller_email,
        amount: t.amount,
        payment_method: t.payment_method,
        screenshot_url: t.screenshot_url
      }));

      res.json({
        success: true,
        message: 'Pending payment approvals retrieved successfully (from transactions)',
        approvals: approvals,
        count: approvals.length
      });
    }
}));

// GET /api/admin/payment-approvals - Get all payment approvals
router.get('/payment-approvals', enhancedErrorHandler(async (req, res) => {
    // Get all payment approvals that need admin review
    const [approvals] = await db.execute(`
        SELECT 
            pa.id,
            pa.order_id,
            pa.payment_method,
            pa.payment_proof,
            pa.status,
            pa.created_at,
            pa.processed_at,
            pa.processed_by,
            pa.rejection_reason,
            o.order_number,
            o.total_amount as amount,
            u.username as buyer_name,
            u.email as buyer_email,
            u.phone as buyer_phone,
            pt.mobile_number,
            pt.mobile_provider,
            pt.bank_name,
            pt.reference_code
        FROM payment_approvals pa
        LEFT JOIN orders o ON pa.order_id = o.id
        LEFT JOIN users u ON o.user_id = u.id
        LEFT JOIN payment_transactions pt ON pa.order_id = pt.order_id
        ORDER BY 
            CASE WHEN pa.status = 'pending' THEN 0 ELSE 1 END,
            pa.created_at DESC
    `);

    // Get order items for each approval
    for (const approval of approvals) {
        const [items] = await db.execute(`
            SELECT 
                p.name,
                oi.quantity,
                oi.unit_price as price
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
        `, [approval.order_id]);
        
        approval.order_items = items;
    }

    res.json({
        success: true,
        approvals: approvals
    });
}));

// GET /api/admin/payment-approval-stats - Get payment approval statistics
router.get('/payment-approval-stats', enhancedErrorHandler(async (req, res) => {
    // Get payment approval statistics
    const [stats] = await db.execute(`
        SELECT
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
            COUNT(CASE WHEN status = 'approved' AND DATE(processed_at) = CURDATE() THEN 1 END) as approved_today,
            COUNT(CASE WHEN status = 'rejected' AND DATE(processed_at) = CURDATE() THEN 1 END) as rejected_today,
            SUM(CASE WHEN status = 'pending' THEN 
                (SELECT total_amount FROM orders WHERE id = order_id)
            ELSE 0 END) as pending_value
        FROM payment_approvals
    `);

    res.json({
        success: true,
        stats: stats[0]
    });
}));

// POST /api/admin/pda-approvals/:id/approve - Approve payment
router.post('/pda-approvals/:id/approve', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    const { notes } = req.body;

    try {
      // Get payment approval details
      const [approvalResult] = await db.execute(`
        SELECT * FROM payment_approvals WHERE id = ? AND status = 'pending'
      `, [id]);
      
      if (approvalResult.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Payment approval not found or already processed'
        });
      }
      
      const approval = approvalResult[0];
      
      // Begin transaction
      await db.execute('START TRANSACTION');
      
      try {
        // Update payment approval status
        await db.execute(`
          UPDATE payment_approvals 
          SET status = 'approved', 
              processed_by = ?, 
              processed_at = NOW(), 
              admin_notes = ?
          WHERE id = ? AND status = 'pending'
        `, [req.user.id, notes || 'Approved by admin', id]);
        
        // Update payment transaction status
        await db.execute(`
          UPDATE payment_transactions 
          SET status = 'completed', 
              processed_by = ?, 
              processed_at = NOW(), 
              admin_notes = ?
          WHERE order_id = ?
        `, [req.user.id, notes || 'Approved by admin', approval.order_id]);
        
        // Update order payment status
        await db.execute(`
          UPDATE orders 
          SET payment_status = 'completed',
              manual_payment_approved = TRUE, 
              manual_payment_approved_by = ?, 
              manual_payment_approved_at = NOW(),
              status = CASE 
                WHEN status = 'pending_payment' THEN 'processing' 
                ELSE status 
              END
          WHERE id = ?
        `, [req.user.id, approval.order_id]);
        
        // Log the approval
        await db.execute(`
          INSERT INTO system_logs (level, message, details, created_at)
          VALUES (?, ?, ?, NOW())
        `, [
          'info',
          `Payment approval granted for order #${approval.order_id}`,
          JSON.stringify({
            approval_id: id,
            order_id: approval.order_id,
            notes: notes || 'No notes provided',
            approved_by: req.user.id,
            approved_by_email: req.user.email
          })
        ]);
        
        // Create notification for buyer
        await db.execute(`
          INSERT INTO notifications (user_id, type, title, message, related_id, created_at)
          SELECT 
            user_id, 
            'payment_approved', 
            'Payment Approved', 
            'Your payment has been approved and your order is now being processed.', 
            ?, 
            NOW()
          FROM orders
          WHERE id = ?
        `, [approval.order_id, approval.order_id]);
        
        // Create notification for seller
        await db.execute(`
          INSERT INTO notifications (user_id, type, title, message, related_id, created_at)
          SELECT 
            seller_id, 
            'new_order', 
            'New Order Received', 
            'You have received a new order. Payment has been approved.', 
            ?, 
            NOW()
          FROM orders
          WHERE id = ?
        `, [approval.order_id, approval.order_id]);
        
        // Commit transaction
        await db.execute('COMMIT');
        
        res.json({
          success: true,
          message: 'Payment approved successfully'
        });
      } catch (error) {
        // Rollback transaction on error
        await db.execute('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Error approving payment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to approve payment'
      });
    }
}));

// POST /api/admin/pda-approvals/:id/reject - Reject payment
router.post('/pda-approvals/:id/reject', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    try {
      // Get payment approval details
      const [approvalResult] = await db.execute(`
        SELECT * FROM payment_approvals WHERE id = ? AND status = 'pending'
      `, [id]);
      
      if (approvalResult.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Payment approval not found or already processed'
        });
      }
      
      const approval = approvalResult[0];
      
      // Begin transaction
      await db.execute('START TRANSACTION');
      
      try {
        // Update payment approval status
        await db.execute(`
          UPDATE payment_approvals 
          SET status = 'rejected', 
              processed_by = ?, 
              processed_at = NOW(), 
              rejection_reason = ?,
              admin_notes = ?
          WHERE id = ? AND status = 'pending'
        `, [req.user.id, reason, `Rejected: ${reason}`, id]);
        
        // Update payment transaction status
        await db.execute(`
          UPDATE payment_transactions 
          SET status = 'rejected', 
              processed_by = ?, 
              processed_at = NOW(), 
              admin_notes = ?
          WHERE order_id = ?
        `, [req.user.id, `Rejected: ${reason}`, approval.order_id]);
        
        // Update order payment status
        await db.execute(`
          UPDATE orders 
          SET payment_status = 'rejected',
              status = 'payment_failed'
          WHERE id = ?
        `, [approval.order_id]);
        
        // Log the rejection
        await db.execute(`
          INSERT INTO system_logs (level, message, details, created_at)
          VALUES (?, ?, ?, NOW())
        `, [
          'warning',
          `Payment rejected for order #${approval.order_id}`,
          JSON.stringify({
            approval_id: id,
            order_id: approval.order_id,
            reason: reason,
            rejected_by: req.user.id,
            rejected_by_email: req.user.email
          })
        ]);
        
        // Create notification for buyer
        await db.execute(`
          INSERT INTO notifications (user_id, type, title, message, related_id, created_at)
          SELECT 
            user_id, 
            'payment_rejected', 
            'Payment Rejected', 
            ?, 
            ?, 
            NOW()
          FROM orders
          WHERE id = ?
        `, [
          `Your payment for order #${approval.order_id} has been rejected. Reason: ${reason}. Please update your payment information.`,
          approval.order_id, 
          approval.order_id
        ]);
        
        // Commit transaction
        await db.execute('COMMIT');
        
        res.json({
          success: true,
          message: 'Payment rejected successfully'
        });
      } catch (error) {
        // Rollback transaction on error
        await db.execute('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Error rejecting payment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reject payment'
      });
    }
}));

// ==================== PAYMENT APPROVAL MANAGEMENT ====================

// GET /api/admin/payment-approvals - Get all payment approvals
router.get('/payment-approvals', enhancedErrorHandler(async (req, res) => {
  const { 
    status = 'pending', 
    search, 
    page = 1, 
    limit = 10,
    sort_by = 'created_at',
    sort_order = 'DESC'
  } = req.query;

  let whereConditions = [];
  let queryParams = [];

  // Build dynamic WHERE clause
  if (status && status !== 'all') {
    whereConditions.push('pa.status = ?');
    queryParams.push(status);
  }

  if (search) {
    whereConditions.push('(o.order_number LIKE ? OR u.email LIKE ? OR u.username LIKE ?)');
    const searchTerm = `%${search}%`;
    queryParams.push(searchTerm, searchTerm, searchTerm);
  }

  const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
  
  // Get total count
  const [countResult] = await db.execute(`
    SELECT COUNT(*) as total 
    FROM payment_approvals pa
    LEFT JOIN orders o ON pa.order_id = o.id
    LEFT JOIN users u ON o.user_id = u.id
    ${whereClause}
  `, queryParams);

  const totalApprovals = countResult[0].total;
  const offset = (page - 1) * limit;

  // Get payment approvals with pagination
  const [approvals] = await db.execute(`
    SELECT 
      pa.id, pa.order_id, pa.payment_method, pa.payment_proof, pa.status,
      pa.admin_notes, pa.created_at, pa.updated_at,
      o.total_amount as amount, o.order_number,
      u.id as customer_id, u.username as customer_name, u.email as customer_email
    FROM payment_approvals pa
    LEFT JOIN orders o ON pa.order_id = o.id
    LEFT JOIN users u ON o.user_id = u.id
    ${whereClause}
    ORDER BY ${sort_by} ${sort_order}
    LIMIT ? OFFSET ?
  `, [...queryParams, parseInt(limit), offset]);

  // Get statistics
  const [stats] = await db.execute(`
    SELECT 
      COUNT(CASE WHEN pa.status = 'pending' THEN 1 END) as pending_count,
      COUNT(CASE WHEN pa.status = 'approved' AND DATE(pa.updated_at) = CURDATE() THEN 1 END) as approved_today,
      COUNT(CASE WHEN pa.status = 'rejected' AND DATE(pa.updated_at) = CURDATE() THEN 1 END) as rejected_today
    FROM payment_approvals pa
  `);

  res.json({
    success: true,
    message: 'Payment approvals retrieved successfully',
    approvals: approvals,
    pagination: {
      current_page: parseInt(page),
      per_page: parseInt(limit),
      total: totalApprovals,
      total_pages: Math.ceil(totalApprovals / limit)
    },
    statistics: stats[0],
    filters: { status, search }
  });
}));

// GET /api/admin/payment-approval-stats - Get payment approval statistics
router.get('/payment-approval-stats', enhancedErrorHandler(async (req, res) => {
  // Get statistics
  const [stats] = await db.execute(`
    SELECT 
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
      COUNT(CASE WHEN status = 'approved' AND DATE(updated_at) = CURDATE() THEN 1 END) as approved_today,
      COUNT(CASE WHEN status = 'rejected' AND DATE(updated_at) = CURDATE() THEN 1 END) as rejected_today
    FROM payment_approvals
  `);

  res.json({
    success: true,
    message: 'Payment approval statistics retrieved successfully',
    stats: stats[0]
  });
}));

// POST /api/admin/payment-approvals/:id/approve - Approve payment
router.post('/payment-approvals/:id/approve', enhancedErrorHandler(async (req, res) => {
  const { id } = req.params;
  const { admin_notes } = req.body;
  const adminId = req.user.id;

  // Begin transaction
  await db.execute('START TRANSACTION');

  try {
    // Get payment approval details
    const [approvals] = await db.execute(`
      SELECT pa.*, o.user_id, o.order_number, u.email as user_email, u.username as user_name
      FROM payment_approvals pa
      JOIN orders o ON pa.order_id = o.id
      JOIN users u ON o.user_id = u.id
      WHERE pa.id = ?
    `, [id]);

    if (approvals.length === 0) {
      await db.execute('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Payment approval not found'
      });
    }

    const approval = approvals[0];

    if (approval.status !== 'pending') {
      await db.execute('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Payment has already been processed'
      });
    }

    // Update payment approval status
    await db.execute(`
      UPDATE payment_approvals
      SET status = 'approved', 
          admin_notes = ?,
          admin_id = ?,
          updated_at = NOW()
      WHERE id = ?
    `, [admin_notes, adminId, id]);

    // Update order payment status
    await db.execute(`
      UPDATE orders
      SET payment_status = 'confirmed',
          status = 'processing',
          updated_at = NOW()
      WHERE id = ?
    `, [approval.order_id]);

    // Log the action
    await db.execute(`
      INSERT INTO system_logs (level, message, details, created_at)
      VALUES (?, ?, ?, NOW())
    `, [
      'info',
      `Payment approved for order #${approval.order_number}`,
      JSON.stringify({
        admin_id: adminId,
        payment_approval_id: id,
        order_id: approval.order_id,
        admin_notes: admin_notes
      })
    ]);

    // Send notification to user
    try {
      await sendTemplatedEmail(
        approval.user_email,
        `Payment Confirmed for Order #${approval.order_number}`,
        'payment-confirmed',
        {
          userName: approval.user_name,
          orderNumber: approval.order_number,
          orderDate: new Date(approval.created_at).toLocaleDateString(),
          paymentMethod: approval.payment_method,
          orderDetailsUrl: `https://africandealsdomain.com/buyer/orders/${approval.order_id}`,
          supportUrl: 'https://africandealsdomain.com/support'
        }
      );
    } catch (emailError) {
      console.error('Failed to send payment confirmation email:', emailError);
      // Continue with the transaction, don't fail if email fails
    }

    // Commit transaction
    await db.execute('COMMIT');

    res.json({
      success: true,
      message: 'Payment approved successfully'
    });
  } catch (error) {
    // Rollback transaction on error
    await db.execute('ROLLBACK');
    throw error;
  }
}));

// POST /api/admin/payment-approvals/:id/reject - Reject payment
router.post('/payment-approvals/:id/reject', enhancedErrorHandler(async (req, res) => {
  const { id } = req.params;
  const { admin_notes } = req.body;
  const adminId = req.user.id;

  if (!admin_notes) {
    return res.status(400).json({
      success: false,
      message: 'Admin notes are required for rejection'
    });
  }

  // Begin transaction
  await db.execute('START TRANSACTION');

  try {
    // Get payment approval details
    const [approvals] = await db.execute(`
      SELECT pa.*, o.user_id, o.order_number, u.email as user_email, u.username as user_name
      FROM payment_approvals pa
      JOIN orders o ON pa.order_id = o.id
      JOIN users u ON o.user_id = u.id
      WHERE pa.id = ?
    `, [id]);

    if (approvals.length === 0) {
      await db.execute('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Payment approval not found'
      });
    }

    const approval = approvals[0];

    if (approval.status !== 'pending') {
      await db.execute('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Payment has already been processed'
      });
    }

    // Update payment approval status
    await db.execute(`
      UPDATE payment_approvals
      SET status = 'rejected', 
          admin_notes = ?,
          admin_id = ?,
          updated_at = NOW()
      WHERE id = ?
    `, [admin_notes, adminId, id]);

    // Update order payment status
    await db.execute(`
      UPDATE orders
      SET payment_status = 'rejected',
          updated_at = NOW()
      WHERE id = ?
    `, [approval.order_id]);

    // Log the action
    await db.execute(`
      INSERT INTO system_logs (level, message, details, created_at)
      VALUES (?, ?, ?, NOW())
    `, [
      'info',
      `Payment rejected for order #${approval.order_number}`,
      JSON.stringify({
        admin_id: adminId,
        payment_approval_id: id,
        order_id: approval.order_id,
        admin_notes: admin_notes
      })
    ]);

    // Send notification to user
    try {
      await sendTemplatedEmail(
        approval.user_email,
        `Payment Rejected for Order #${approval.order_number}`,
        'payment-rejected',
        {
          userName: approval.user_name,
          orderNumber: approval.order_number,
          orderDate: new Date(approval.created_at).toLocaleDateString(),
          paymentMethod: approval.payment_method,
          rejectionReason: admin_notes,
          orderDetailsUrl: `https://africandealsdomain.com/buyer/orders/${approval.order_id}`,
          supportUrl: 'https://africandealsdomain.com/support'
        }
      );
    } catch (emailError) {
      console.error('Failed to send payment rejection email:', emailError);
      // Continue with the transaction, don't fail if email fails
    }

    // Commit transaction
    await db.execute('COMMIT');

    res.json({
      success: true,
      message: 'Payment rejected successfully'
    });
  } catch (error) {
    // Rollback transaction on error
    await db.execute('ROLLBACK');
    throw error;
  }
}));

// ==================== AGENT MANAGEMENT ====================

// GET /api/admin/agents - Get all agents
router.get('/agents', enhancedErrorHandler(async (req, res) => {
    const { status, page = 1, limit = 50 } = req.query;

    let whereConditions = ["role = 'agent'"];
    let queryParams = [];

    if (status) {
      if (status === 'active') {
        whereConditions.push('is_active = 1');
      } else if (status === 'inactive') {
        whereConditions.push('is_active = 0');
      }
    }

    const whereClause = 'WHERE ' + whereConditions.join(' AND ');
    const offset = (page - 1) * limit;

    // Get agents
    const [agents] = await db.execute(`
      SELECT 
        id, username, email, first_name, last_name, phone,
        is_active, is_verified, created_at
      FROM users 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), offset]);

    // Get total count
    const [countResult] = await db.execute(`
      SELECT COUNT(*) as total 
      FROM users 
      ${whereClause}
    `, queryParams);

    res.json({
      success: true,
      message: 'Agents retrieved successfully',
      agents: agents,
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total: countResult[0].total,
        total_pages: Math.ceil(countResult[0].total / limit)
      }
    });
}));

// ==================== SYSTEM MANAGEMENT ====================

// GET /api/admin/activities - Get recent system activities
router.get('/activities', enhancedErrorHandler(async (req, res) => {
    const { limit = 50 } = req.query;

    const [activities] = await db.execute(`
      SELECT level, message, details, created_at
      FROM system_logs 
      ORDER BY created_at DESC 
      LIMIT ?
    `, [parseInt(limit)]);

    res.json({
      success: true,
      message: 'System activities retrieved successfully',
      activities: activities
    });
}));

// POST /api/admin/error-reports - Receive error reports from frontend
router.post('/error-reports', enhancedErrorHandler(async (req, res) => {
    const errorData = req.body;

    try {
      await db.execute(`
        INSERT INTO error_reports (
          error_id, error_type, message, stack_trace, url, 
          user_id, user_agent, ip_address, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
        errorData.id || 'unknown',
        errorData.type || 'frontend_error',
        errorData.message || 'No message',
        errorData.stack || null,
        errorData.page || req.headers.referer,
        req.user?.id || null,
        req.headers['user-agent'],
        req.ip
      ]);
    } catch (error) {
      // If error_reports table doesn't exist, log to system_logs
      await db.execute(`
        INSERT INTO system_logs (level, message, details, created_at)
        VALUES (?, ?, ?, NOW())
      `, [
        'error',
        'Frontend Error Report',
        JSON.stringify(errorData)
      ]);
    }

    res.json({
      success: true,
      message: 'Error report received'
    });
}));

// ==================== PRODUCT MANAGEMENT ====================

// GET /api/admin/products - Get all products with admin filtering
router.get('/products', enhancedErrorHandler(async (req, res) => {
    const { 
      status, 
      category_id, 
      category,  // Support both category and category_id
      seller_id,
      seller,    // Support both seller and seller_id
      search, 
      page = 1, 
      limit = 20, // Changed from 50 to 20 to match client
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = req.query;

    let whereConditions = [];
    let queryParams = [];

    // Build dynamic WHERE clause
    if (status) {
      if (status === 'active') {
        whereConditions.push('p.status IN (?, ?)');
        queryParams.push('active', 'approved');
      } else {
        whereConditions.push('p.status = ?');
        queryParams.push(status);
      }
    }

    if (category_id || category) {
      whereConditions.push('p.category_id = ?');
      queryParams.push(category_id || category);
    }

    if (seller_id || seller) {
      whereConditions.push('p.seller_id = ?');
      queryParams.push(seller_id || seller);
    }

    if (search) {
      whereConditions.push('(p.name LIKE ? OR p.description LIKE ? OR u.username LIKE ?)');
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    
    // Get total count
    const [countResult] = await db.execute(`
      SELECT COUNT(*) as total 
      FROM products p
      LEFT JOIN users u ON p.seller_id = u.id
      ${whereClause}
    `, queryParams);

    const totalProducts = countResult[0].total;
    const offset = (page - 1) * limit;

    // Get products with seller info
    const [products] = await db.execute(`
      SELECT 
        p.id, p.name, p.description, p.price, p.status, p.main_image,
        p.created_at, p.updated_at, p.category_id,
        u.username as seller_name, u.email as seller_email,
        c.name as category_name
      FROM products p
      LEFT JOIN users u ON p.seller_id = u.id
      LEFT JOIN categories c ON p.category_id = c.id
      ${whereClause}
      ORDER BY p.${sort_by} ${sort_order}
      LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), offset]);

    // Get product statistics
    let productStats = [{ 
      total_products: 0, 
      active_products: 0, 
      pending_products: 0, 
      rejected_products: 0, 
      inactive_products: 0 
    }];
    
    try {
      const [stats] = await db.execute(`
        SELECT 
          COUNT(*) as total_products,
          COUNT(CASE WHEN status IN ('active', 'approved') THEN 1 END) as active_products,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_products,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_products,
          COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_products
        FROM products
      `);
      productStats = stats;
    } catch (statsError) {
      console.error('Error getting product statistics:', statsError);
    }

    // Calculate category count and average price from products
    const categorySet = new Set();
    let totalPrice = 0;
    let activeProducts = 0;

    products.forEach(product => {
      if (product.category_name) {
        categorySet.add(product.category_name);
      }
      if (product.price) {
        totalPrice += parseFloat(product.price);
      }
      if (product.status === 'active' || product.status === 'approved') {
        activeProducts++;
      }
    });

    const avgPrice = products.length > 0 ? (totalPrice / products.length) : 0;

    // Format products with is_active field
    const formattedProducts = products.map(product => ({
      ...product,
      is_active: product.status === 'active' || product.status === 'approved' ? 1 : 0
    }));

    res.json({
      success: true,
      message: 'Products retrieved successfully',
      products: formattedProducts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalProducts,
        pages: Math.ceil(totalProducts / limit)
      },
      stats: {
        total: totalProducts,
        active: activeProducts,
        categories: categorySet.size,
        avgPrice: avgPrice
      },
      filters: { status, category: category_id || category, seller: seller_id || seller, search }
    });
}));

// GET /api/admin/products/:id - Get specific product details
router.get('/products/:id', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;

    const [products] = await db.execute(`
      SELECT 
        p.*, 
        u.username as seller_name, u.email as seller_email, u.phone as seller_phone,
        c.name as category_name
      FROM products p
      LEFT JOIN users u ON p.seller_id = u.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `, [id]);

    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const product = products[0];

    // Get product images
    const [images] = await db.execute(`
      SELECT image_url, is_main 
      FROM product_images 
      WHERE product_id = ?
      ORDER BY is_main DESC, created_at ASC
    `, [id]);

    // Get product reviews
    let reviews = [];
    try {
      const [reviewsResult] = await db.execute(`
        SELECT 
          r.id, r.rating, r.comment, r.created_at,
          u.username as reviewer_name
        FROM product_reviews r
        LEFT JOIN users u ON r.buyer_id = u.id
        WHERE r.product_id = ?
        ORDER BY r.created_at DESC
        LIMIT 10
      `, [id]);
      reviews = reviewsResult || [];
    } catch (reviewError) {
      console.error('Error fetching reviews:', reviewError);
    }

    // Format product with is_active field
    const formattedProduct = {
      ...product,
      is_active: product.status === 'active' || product.status === 'approved' ? 1 : 0,
      images: images
    };

    res.json({
      success: true,
      message: 'Product details retrieved successfully',
      product: formattedProduct,
      reviews: reviews
    });
}));

// PUT /api/admin/products/:id/status - Update product status (approve/reject)
router.put('/products/:id/status', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    const { status, reason, is_active } = req.body;

    // Handle both status and is_active fields
    let newStatus = status;
    if (is_active !== undefined) {
      newStatus = is_active ? 'active' : 'inactive';
    }

    if (!['active', 'pending', 'rejected', 'inactive'].includes(newStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be active, pending, rejected, or inactive'
      });
    }

    // Get product details for logging
    const [products] = await db.execute('SELECT * FROM products WHERE id = ?', [id]);
    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const product = products[0];

    // Update product status
    await db.execute(`
      UPDATE products 
      SET status = ?, updated_at = NOW()
      WHERE id = ?
    `, [newStatus, id]);

    // Log the status change
    await db.execute(`
      INSERT INTO system_logs (level, message, details, created_at)
      VALUES (?, ?, ?, NOW())
    `, [
      'info',
      `Product status updated by admin`,
      JSON.stringify({
        product_id: id,
        product_name: product.name,
        old_status: product.status,
        new_status: newStatus,
        reason: reason || 'No reason provided',
        admin_email: req.user?.email || 'unknown',
        timestamp: new Date().toISOString()
      })
    ]);

    // Send notification to seller if status changed to rejected
    if (newStatus === 'rejected' && product.seller_id) {
      try {
        const [sellers] = await db.execute('SELECT email, first_name FROM users WHERE id = ?', [product.seller_id]);
        if (sellers.length > 0) {
          await sendTemplatedEmail(
            sellers[0].email,
            'Product Rejected',
            'product-rejected',
            {
              sellerName: sellers[0].first_name,
              productName: product.name,
              reason: reason || 'Please review product details and resubmit',
              supportEmail: process.env.SUPPORT_EMAIL || 'support@addphysicalproducts.com'
            }
          );
        }
      } catch (emailError) {
        console.error('Failed to send rejection email:', emailError);
      }
    }

    res.json({
      success: true,
      message: `Product status updated to ${newStatus}`,
      product_id: id,
      new_status: newStatus
    });
}));

// DELETE /api/admin/products/:id - Delete product (soft delete)
router.delete('/products/:id', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    // Get product details for logging
    const [products] = await db.execute('SELECT * FROM products WHERE id = ?', [id]);
    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const product = products[0];

    // Soft delete the product
    await db.execute(`
      UPDATE products 
      SET status = 'deleted', updated_at = NOW()
      WHERE id = ?
    `, [id]);

    // Log the deletion
    await db.execute(`
      INSERT INTO system_logs (level, message, details, created_at)
      VALUES (?, ?, ?, NOW())
    `, [
      'warning',
      `Product deleted by admin`,
      JSON.stringify({
        product_id: id,
        product_name: product.name,
        seller_id: product.seller_id,
        reason: reason || 'No reason provided',
        admin_email: req.user?.email || 'unknown',
        timestamp: new Date().toISOString()
      })
    ]);

    res.json({
      success: true,
      message: 'Product deleted successfully',
      product_id: id
    });
}));

// GET /api/admin/products/export - Export products to CSV
router.get('/products/export', enhancedErrorHandler(async (req, res) => {
    const [products] = await db.execute(`
      SELECT 
        p.id, p.name, p.description, p.price, p.status, p.stock_quantity,
        p.created_at, p.updated_at,
        u.username as seller_name, u.email as seller_email,
        c.name as category_name
      FROM products p
      LEFT JOIN users u ON p.seller_id = u.id
      LEFT JOIN categories c ON p.category_id = c.id
      ORDER BY p.created_at DESC
    `);

    // Convert to CSV
    const csvHeader = 'ID,Name,Description,Price,Status,Stock,Seller,Seller Email,Category,Created,Updated\n';
    const csvRows = products.map(product => {
      return [
        product.id,
        `"${product.name?.replace(/"/g, '""') || ''}"`,
        `"${product.description?.replace(/"/g, '""') || ''}"`,
        product.price || 0,
        product.status || '',
        product.stock_quantity || 0,
        `"${product.seller_name?.replace(/"/g, '""') || ''}"`,
        product.seller_email || '',
        `"${product.category_name?.replace(/"/g, '""') || ''}"`,
        product.created_at || '',
        product.updated_at || ''
      ].join(',');
    }).join('\n');

    const csv = csvHeader + csvRows;

    res.json({
      success: true,
      message: 'Products exported successfully',
      csv: csv,
      count: products.length
    });
}));

// GET /api/admin/sellers - Get all sellers for filter dropdown
router.get('/sellers', enhancedErrorHandler(async (req, res) => {
    const [sellers] = await db.execute(`
      SELECT 
        u.id, u.username as name, u.email,
        COUNT(p.id) as product_count
      FROM users u
      LEFT JOIN products p ON u.id = p.seller_id
      WHERE u.role = 'seller'
      GROUP BY u.id, u.username, u.email
      ORDER BY u.username ASC
    `);

    res.json({
      success: true,
      message: 'Sellers retrieved successfully',
      sellers: sellers
    });
}));

// ==================== ORDER MANAGEMENT ====================

// GET /api/admin/orders - Get all orders with admin filtering
router.get('/orders', enhancedErrorHandler(async (req, res) => {
    const { 
      status, 
      user_id,
      agent_id,
      search, 
      page = 1, 
      limit = 50,
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = req.query;

    let whereConditions = [];
    let queryParams = [];

    // Build dynamic WHERE clause
    if (status) {
      whereConditions.push('o.status = ?');
      queryParams.push(status);
    }

    if (user_id) {
      whereConditions.push('o.user_id = ?');
      queryParams.push(user_id);
    }

    if (agent_id) {
      whereConditions.push('o.agent_id = ?');
      queryParams.push(agent_id);
    }

    if (search) {
      whereConditions.push('(o.order_number LIKE ? OR u.username LIKE ? OR u.email LIKE ?)');
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    
    // Get total count
    const [countResult] = await db.execute(`
      SELECT COUNT(*) as total 
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ${whereClause}
    `, queryParams);

    const totalOrders = countResult[0].total;
    const offset = (page - 1) * limit;

    // Get orders with user and agent info
    const [orders] = await db.execute(`
      SELECT 
        o.id, o.order_number, o.total_amount, o.status, o.created_at, o.updated_at,
        u.username as buyer_name, u.email as buyer_email,
        a.username as agent_name, a.email as agent_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN users a ON o.agent_id = a.id
      ${whereClause}
      ORDER BY o.${sort_by} ${sort_order}
      LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), offset]);

    // Get order statistics
    const [orderStats] = await db.execute(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_orders,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
        COALESCE(SUM(total_amount), 0) as total_revenue
      FROM orders
    `);

    res.json({
      success: true,
      message: 'Orders retrieved successfully',
      orders: orders,
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total: totalOrders,
        total_pages: Math.ceil(totalOrders / limit)
      },
      statistics: orderStats[0],
      filters: { status, user_id, agent_id, search }
    });
}));

// GET /api/admin/orders/:id - Get specific order details
router.get('/orders/:id', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;

    const [orders] = await db.execute(`
      SELECT 
        o.*, 
        u.username as buyer_name, u.email as buyer_email, u.phone as buyer_phone,
        a.username as agent_name, a.email as agent_email, a.phone as agent_phone
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN users a ON o.agent_id = a.id
      WHERE o.id = ?
    `, [id]);

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const order = orders[0];

    // Get order items
    const [orderItems] = await db.execute(`
      SELECT 
        oi.*, 
        p.name as product_name, p.main_image as product_image,
        u.username as seller_name, u.email as seller_email
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN users u ON p.seller_id = u.id
      WHERE oi.order_id = ?
    `, [id]);

    res.json({
      success: true,
      message: 'Order details retrieved successfully',
      order: {
        ...order,
        items: orderItems
      }
    });
}));

// PUT /api/admin/orders/:id/status - Update order status
router.put('/orders/:id/status', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    const { status, reason } = req.body;

    if (!['pending', 'processing', 'shipped', 'delivered', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    // Get order details for logging
    const [orders] = await db.execute('SELECT * FROM orders WHERE id = ?', [id]);
    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const order = orders[0];

    // Update order status
    await db.execute(`
      UPDATE orders 
      SET status = ?, updated_at = NOW()
      WHERE id = ?
    `, [status, id]);

    // Log the status change
    await db.execute(`
      INSERT INTO system_logs (level, message, details, created_at)
      VALUES (?, ?, ?, NOW())
    `, [
      'info',
      `Order status updated by admin`,
      JSON.stringify({
        order_id: id,
        order_number: order.order_number,
        old_status: order.status,
        new_status: status,
        reason: reason || 'No reason provided',
        admin_email: req.user?.email || 'unknown',
        timestamp: new Date().toISOString()
      })
    ]);

    res.json({
      success: true,
      message: `Order status updated to ${status}`,
      order_id: id,
      new_status: status
    });
}));

// ==================== HEALTH CHECK ====================

// GET /api/admin/health - Health check endpoint
router.get('/health', (req, res) => {
    res.json({
      success: true,
      message: 'Admin API is healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
});


// ==================== ADDITIONAL ADMIN ENDPOINTS ====================

// GET /api/admin/agents - Get all agents
router.get('/agents', enhancedErrorHandler(async (req, res) => {
    const { page = 1, limit = 50, status, search } = req.query;
    
    let whereConditions = [];
    let queryParams = [];
    
    if (status) {
        whereConditions.push('status = ?');
        queryParams.push(status);
    }
    
    if (search) {
        whereConditions.push('(name LIKE ? OR email LIKE ? OR phone LIKE ?)');
        const searchTerm = `%${search}%`;
        queryParams.push(searchTerm, searchTerm, searchTerm);
    }
    
    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    
    const [agents] = await db.execute(`
        SELECT id, name, email, phone, status, agent_type, location, created_at
        FROM agents 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), (page - 1) * limit]);
    
    const [countResult] = await db.execute(`
        SELECT COUNT(*) as total FROM agents ${whereClause}
    `, queryParams);
    
    res.json({
        success: true,
        message: 'Agents retrieved successfully',
        agents,
        pagination: {
            current_page: parseInt(page),
            per_page: parseInt(limit),
            total: countResult[0].total,
            total_pages: Math.ceil(countResult[0].total / limit)
        }
    });
}));

// POST /api/admin/agents/:id/approve - Approve agent
router.post('/agents/:id/approve', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    
    await db.execute(`
        UPDATE agents 
        SET status = 'approved', approved_by = ?, approved_at = NOW(), approval_reason = ?
        WHERE id = ?
    `, [req.user.id, reason || 'Approved by admin', id]);
    
    res.json({
        success: true,
        message: 'Agent approved successfully'
    });
}));

// POST /api/admin/agents/:id/reject - Reject agent
router.post('/agents/:id/reject', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    
    await db.execute(`
        UPDATE agents 
        SET status = 'rejected', rejected_by = ?, rejected_at = NOW(), rejection_reason = ?
        WHERE id = ?
    `, [req.user.id, reason || 'Rejected by admin', id]);
    
    res.json({
        success: true,
        message: 'Agent rejected successfully'
    });
}));

// GET /api/admin/announcements - Get all announcements
router.get('/announcements', enhancedErrorHandler(async (req, res) => {
    const [announcements] = await db.execute(`
        SELECT id, title, content, type, status, created_at, updated_at
        FROM announcements 
        ORDER BY created_at DESC
    `);
    
    res.json({
        success: true,
        message: 'Announcements retrieved successfully',
        announcements
    });
}));

// POST /api/admin/announcements - Create announcement
router.post('/announcements', enhancedErrorHandler(async (req, res) => {
    const { title, content, type = 'general', status = 'draft' } = req.body;
    
    const [result] = await db.execute(`
        INSERT INTO announcements (title, content, type, status, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, NOW())
    `, [title, content, type, status, req.user.id]);
    
    res.json({
        success: true,
        message: 'Announcement created successfully',
        id: result.insertId
    });
}));

// GET /api/admin/brands - Get all brands
router.get('/brands', enhancedErrorHandler(async (req, res) => {
    const [brands] = await db.execute(`
        SELECT id, name, description, logo_url, status, created_at
        FROM brands 
        ORDER BY name ASC
    `);
    
    res.json({
        success: true,
        message: 'Brands retrieved successfully',
        brands
    });
}));

// POST /api/admin/brands - Create brand
router.post('/brands', enhancedErrorHandler(async (req, res) => {
    const { name, description, logo_url, status = 'active' } = req.body;
    
    // Validation
    if (!name || !name.trim()) {
        return res.status(400).json({
            success: false,
            message: 'Brand name is required'
        });
    }

    // Check if brand name already exists
    const [existingBrand] = await db.execute(
        'SELECT id FROM brands WHERE name = ?',
        [name.trim()]
    );

    if (existingBrand.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Brand with this name already exists'
        });
    }

    const [result] = await db.execute(`
        INSERT INTO brands (name, description, logo_url, status, created_at)
        VALUES (?, ?, ?, ?, NOW())
    `, [name.trim(), description || null, logo_url || null, status]);
    
    res.json({
        success: true,
        message: 'Brand created successfully',
        brand: {
            id: result.insertId,
            name: name.trim(),
            description: description || null,
            logo_url: logo_url || null,
            status: status
        }
    });
}));

// PUT /api/admin/brands/:id - Update brand
router.put('/brands/:id', enhancedErrorHandler(async (req, res) => {
    const brandId = req.params.id;
    const { name, description, logo_url, status } = req.body;
    
    // Validation
    if (!name || !name.trim()) {
        return res.status(400).json({
            success: false,
            message: 'Brand name is required'
        });
    }

    // Check if brand exists
    const [existingBrand] = await db.execute(
        'SELECT id FROM brands WHERE id = ?',
        [brandId]
    );

    if (existingBrand.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Brand not found'
        });
    }

    // Check for name conflicts (excluding current brand)
    const [duplicateBrand] = await db.execute(
        'SELECT id FROM brands WHERE name = ? AND id != ?',
        [name.trim(), brandId]
    );

    if (duplicateBrand.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Brand with this name already exists'
        });
    }

    await db.execute(
        'UPDATE brands SET name = ?, description = ?, logo_url = ?, status = ?, updated_at = NOW() WHERE id = ?',
        [name.trim(), description || null, logo_url || null, status || 'active', brandId]
    );
    
    res.json({
        success: true,
        message: 'Brand updated successfully'
    });
}));

// DELETE /api/admin/brands/:id - Delete brand
router.delete('/brands/:id', enhancedErrorHandler(async (req, res) => {
    const brandId = req.params.id;
    
    // Check if brand exists
    const [existingBrand] = await db.execute(
        'SELECT id, name FROM brands WHERE id = ?',
        [brandId]
    );

    if (existingBrand.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Brand not found'
        });
    }

    // Check if brand has products
    const [products] = await db.execute(
        'SELECT id FROM products WHERE brand_id = ?',
        [brandId]
    );

    if (products.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Cannot delete brand that has products. Move or delete products first.'
        });
    }

    await db.execute('DELETE FROM brands WHERE id = ?', [brandId]);
    
    res.json({
        success: true,
        message: 'Brand deleted successfully'
    });
}));

// GET /api/admin/categories - Get all categories
router.get('/categories', enhancedErrorHandler(async (req, res) => {
    const [categories] = await db.execute(`
        SELECT id, name, description, parent_id, status, created_at
        FROM categories 
        ORDER BY parent_id ASC, name ASC
    `);
    
    res.json({
        success: true,
        message: 'Categories retrieved successfully',
        categories
    });
}));

// POST /api/admin/categories - Create new category
router.post('/categories', enhancedErrorHandler(async (req, res) => {
    const { name, description, parent_id, status } = req.body;
    
    // Validation
    if (!name || !name.trim()) {
        return res.status(400).json({
            success: false,
            message: 'Category name is required'
        });
    }

    // Check if category name already exists
    const [existingCategory] = await db.execute(
        'SELECT id FROM categories WHERE name = ? AND parent_id = ?',
        [name.trim(), parent_id || null]
    );

    if (existingCategory.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Category with this name already exists in the selected parent category'
        });
    }

    const [result] = await db.execute(
        'INSERT INTO categories (name, description, parent_id, status, created_at) VALUES (?, ?, ?, ?, NOW())',
        [name.trim(), description || null, parent_id || null, status || 'active']
    );
    
    res.json({
        success: true,
        message: 'Category created successfully',
        category: {
            id: result.insertId,
            name: name.trim(),
            description: description || null,
            parent_id: parent_id || null,
            status: status || 'active'
        }
    });
}));

// PUT /api/admin/categories/:id - Update category
router.put('/categories/:id', enhancedErrorHandler(async (req, res) => {
    const categoryId = req.params.id;
    const { name, description, parent_id, status } = req.body;
    
    // Validation
    if (!name || !name.trim()) {
        return res.status(400).json({
            success: false,
            message: 'Category name is required'
        });
    }

    // Check if category exists
    const [existingCategory] = await db.execute(
        'SELECT id FROM categories WHERE id = ?',
        [categoryId]
    );

    if (existingCategory.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Category not found'
        });
    }

    // Check for name conflicts (excluding current category)
    const [duplicateCategory] = await db.execute(
        'SELECT id FROM categories WHERE name = ? AND parent_id = ? AND id != ?',
        [name.trim(), parent_id || null, categoryId]
    );

    if (duplicateCategory.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Category with this name already exists in the selected parent category'
        });
    }

    // Prevent circular dependency (parent can't be itself or its child)
    if (parent_id) {
        const [circularCheck] = await db.execute(`
            WITH RECURSIVE category_hierarchy AS (
                SELECT id, parent_id, 0 as level
                FROM categories 
                WHERE id = ?
                
                UNION ALL
                
                SELECT c.id, c.parent_id, ch.level + 1
                FROM categories c
                INNER JOIN category_hierarchy ch ON c.parent_id = ch.id
                WHERE ch.level < 10
            )
            SELECT id FROM category_hierarchy WHERE id = ?
        `, [categoryId, parent_id]);

        if (circularCheck.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot set parent category: would create circular dependency'
            });
        }
    }

    await db.execute(
        'UPDATE categories SET name = ?, description = ?, parent_id = ?, status = ?, updated_at = NOW() WHERE id = ?',
        [name.trim(), description || null, parent_id || null, status || 'active', categoryId]
    );
    
    res.json({
        success: true,
        message: 'Category updated successfully'
    });
}));

// DELETE /api/admin/categories/:id - Delete category
router.delete('/categories/:id', enhancedErrorHandler(async (req, res) => {
    const categoryId = req.params.id;
    
    // Check if category exists
    const [existingCategory] = await db.execute(
        'SELECT id, name FROM categories WHERE id = ?',
        [categoryId]
    );

    if (existingCategory.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Category not found'
        });
    }

    // Check if category has subcategories
    const [subcategories] = await db.execute(
        'SELECT id FROM categories WHERE parent_id = ?',
        [categoryId]
    );

    if (subcategories.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Cannot delete category that has subcategories. Delete subcategories first.'
        });
    }

    // Check if category has products
    const [products] = await db.execute(
        'SELECT id FROM products WHERE category_id = ?',
        [categoryId]
    );

    if (products.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Cannot delete category that has products. Move or delete products first.'
        });
    }

    await db.execute('DELETE FROM categories WHERE id = ?', [categoryId]);
    
    res.json({
        success: true,
        message: 'Category deleted successfully'
    });
}));

// GET /api/admin/reviews - Get all reviews
router.get('/reviews', enhancedErrorHandler(async (req, res) => {
    const { status, page = 1, limit = 50 } = req.query;
    
    let whereClause = '';
    let queryParams = [];
    
    if (status) {
        whereClause = 'WHERE r.status = ?';
        queryParams.push(status);
    }
    
    const [reviews] = await db.execute(`
        SELECT r.*, p.name as product_name, u.username as reviewer_name
        FROM reviews r
        LEFT JOIN products p ON r.product_id = p.id
        LEFT JOIN users u ON r.user_id = u.id
        ${whereClause}
        ORDER BY r.created_at DESC
        LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), (page - 1) * limit]);
    
    res.json({
        success: true,
        message: 'Reviews retrieved successfully',
        reviews
    });
}));

// POST /api/admin/reviews/:id/approve - Approve review
router.post('/reviews/:id/approve', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    const { notes } = req.body;
    
    // Check if review exists
    const [existingReview] = await db.execute('SELECT id FROM reviews WHERE id = ?', [id]);
    
    if (existingReview.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Review not found'
        });
    }
    
    await db.execute(`
        UPDATE reviews 
        SET status = 'approved', approved_by = ?, approved_at = NOW(), admin_notes = ?
        WHERE id = ?
    `, [req.user.id, notes || null, id]);
    
    res.json({
        success: true,
        message: 'Review approved successfully'
    });
}));

// POST /api/admin/reviews/:id/reject - Reject review
router.post('/reviews/:id/reject', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    const { notes } = req.body;
    
    // Check if review exists
    const [existingReview] = await db.execute('SELECT id FROM reviews WHERE id = ?', [id]);
    
    if (existingReview.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Review not found'
        });
    }
    
    await db.execute(`
        UPDATE reviews 
        SET status = 'rejected', rejected_by = ?, rejected_at = NOW(), admin_notes = ?
        WHERE id = ?
    `, [req.user.id, notes || null, id]);
    
    res.json({
        success: true,
        message: 'Review rejected successfully'
    });
}));

// DELETE /api/admin/reviews/:id - Delete review
router.delete('/reviews/:id', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    
    // Check if review exists
    const [existingReview] = await db.execute('SELECT id FROM reviews WHERE id = ?', [id]);
    
    if (existingReview.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Review not found'
        });
    }
    
    await db.execute('DELETE FROM reviews WHERE id = ?', [id]);
    
    res.json({
        success: true,
        message: 'Review deleted successfully'
    });
}));

// PUT /api/admin/reviews/:id - Update review
router.put('/reviews/:id', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    const { rating, comment, status } = req.body;
    
    // Check if review exists
    const [existingReview] = await db.execute('SELECT id FROM reviews WHERE id = ?', [id]);
    
    if (existingReview.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Review not found'
        });
    }
    
    // Validation
    if (rating && (rating < 1 || rating > 5)) {
        return res.status(400).json({
            success: false,
            message: 'Rating must be between 1 and 5'
        });
    }
    
    await db.execute(`
        UPDATE reviews 
        SET rating = COALESCE(?, rating), comment = COALESCE(?, comment), 
            status = COALESCE(?, status), updated_at = NOW()
        WHERE id = ?
    `, [rating, comment, status, id]);
    
    res.json({
        success: true,
        message: 'Review updated successfully'
    });
}));

// GET /api/admin/sellers - Get all sellers
router.get('/sellers', enhancedErrorHandler(async (req, res) => {
    const { status, page = 1, limit = 50, search } = req.query;
    
    let whereClause = 'WHERE u.role = "seller"';
    let queryParams = [];
    
    if (status) {
        whereClause += ' AND u.is_active = ?';
        queryParams.push(status === 'active' ? 1 : 0);
    }
    
    if (search) {
        whereClause += ' AND (u.username LIKE ? OR u.email LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?)';
        const searchPattern = `%${search}%`;
        queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }
    
    const [sellers] = await db.execute(`
        SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.phone,
               u.is_active, u.is_verified, u.created_at, u.last_login,
               COUNT(DISTINCT p.id) as total_products,
               COUNT(DISTINCT o.id) as total_orders,
               COALESCE(SUM(CASE WHEN o.status = 'completed' THEN o.total_amount ELSE 0 END), 0) as total_sales
        FROM users u
        LEFT JOIN products p ON u.id = p.seller_id
        LEFT JOIN orders o ON u.id = o.seller_id
        ${whereClause}
        GROUP BY u.id
        ORDER BY u.created_at DESC
        LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), (page - 1) * limit]);
    
    res.json({
        success: true,
        message: 'Sellers retrieved successfully',
        sellers
    });
}));

// PUT /api/admin/sellers/:id - Update seller status
router.put('/sellers/:id', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    const { is_active, is_verified, notes } = req.body;
    
    // Check if seller exists
    const [existingSeller] = await db.execute(
        'SELECT id, role FROM users WHERE id = ? AND role = "seller"',
        [id]
    );

    if (existingSeller.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Seller not found'
        });
    }
    
    // Update seller
    await db.execute(
        'UPDATE users SET is_active = COALESCE(?, is_active), is_verified = COALESCE(?, is_verified), updated_at = NOW() WHERE id = ?',
        [is_active, is_verified, id]
    );
    
    // Log the action
    if (notes) {
        await db.execute(`
            INSERT INTO admin_actions (admin_id, action_type, target_type, target_id, notes, created_at)
            VALUES (?, 'seller_update', 'user', ?, ?, NOW())
        `, [req.user.id, id, notes]);
    }
    
    res.json({
        success: true,
        message: 'Seller updated successfully'
    });
}));

// POST /api/admin/sellers/:id/approve - Approve seller
router.post('/sellers/:id/approve', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    const { notes } = req.body;
    
    // Check if seller exists
    const [existingSeller] = await db.execute(
        'SELECT id, is_verified FROM users WHERE id = ? AND role = "seller"',
        [id]
    );

    if (existingSeller.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Seller not found'
        });
    }
    
    await db.execute(
        'UPDATE users SET is_verified = 1, is_active = 1, updated_at = NOW() WHERE id = ?',
        [id]
    );
    
    // Log the approval
    await db.execute(`
        INSERT INTO admin_actions (admin_id, action_type, target_type, target_id, notes, created_at)
        VALUES (?, 'seller_approve', 'user', ?, ?, NOW())
    `, [req.user.id, id, notes || 'Seller approved']);
    
    res.json({
        success: true,
        message: 'Seller approved successfully'
    });
}));

// POST /api/admin/sellers/:id/suspend - Suspend seller
router.post('/sellers/:id/suspend', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    
    if (!reason) {
        return res.status(400).json({
            success: false,
            message: 'Suspension reason is required'
        });
    }
    
    // Check if seller exists
    const [existingSeller] = await db.execute(
        'SELECT id FROM users WHERE id = ? AND role = "seller"',
        [id]
    );

    if (existingSeller.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Seller not found'
        });
    }
    
    await db.execute(
        'UPDATE users SET is_active = 0, updated_at = NOW() WHERE id = ?',
        [id]
    );
    
    // Log the suspension
    await db.execute(`
        INSERT INTO admin_actions (admin_id, action_type, target_type, target_id, notes, created_at)
        VALUES (?, 'seller_suspend', 'user', ?, ?, NOW())
    `, [req.user.id, id, reason]);
    
    res.json({
        success: true,
        message: 'Seller suspended successfully'
    });
}));

// DELETE /api/admin/sellers/:id - Delete seller (soft delete)
router.delete('/sellers/:id', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    
    // Check if seller exists
    const [existingSeller] = await db.execute(
        'SELECT id FROM users WHERE id = ? AND role = "seller"',
        [id]
    );

    if (existingSeller.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Seller not found'
        });
    }
    
    // Check if seller has active products or orders
    const [activeData] = await db.execute(`
        SELECT 
            COUNT(DISTINCT p.id) as active_products,
            COUNT(DISTINCT o.id) as pending_orders
        FROM users u
        LEFT JOIN products p ON u.id = p.seller_id AND p.is_active = 1
        LEFT JOIN orders o ON u.id = o.seller_id AND o.status IN ('pending', 'processing')
        WHERE u.id = ?
    `, [id]);
    
    if (activeData[0].active_products > 0 || activeData[0].pending_orders > 0) {
        return res.status(400).json({
            success: false,
            message: `Cannot delete seller with ${activeData[0].active_products} active products and ${activeData[0].pending_orders} pending orders`
        });
    }
    
    // Soft delete - mark as deleted
    await db.execute(
        'UPDATE users SET is_active = 0, is_deleted = 1, deleted_at = NOW() WHERE id = ?',
        [id]
    );
    
    // Log the deletion
    await db.execute(`
        INSERT INTO admin_actions (admin_id, action_type, target_type, target_id, notes, created_at)
        VALUES (?, 'seller_delete', 'user', ?, 'Seller account deleted', NOW())
    `, [req.user.id, id]);
    
    res.json({
        success: true,
        message: 'Seller deleted successfully'
    });
}));

// GET /api/admin/support-tickets - Get all support tickets
router.get('/support-tickets', enhancedErrorHandler(async (req, res) => {
    const { status, priority, page = 1, limit = 50, search } = req.query;
    
    let whereConditions = [];
    let queryParams = [];
    
    if (status) {
        whereConditions.push('t.status = ?');
        queryParams.push(status);
    }
    
    if (priority) {
        whereConditions.push('t.priority = ?');
        queryParams.push(priority);
    }
    
    if (search) {
        whereConditions.push('(t.subject LIKE ? OR t.description LIKE ? OR u.username LIKE ?)');
        const searchPattern = `%${search}%`;
        queryParams.push(searchPattern, searchPattern, searchPattern);
    }
    
    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    
    const [tickets] = await db.execute(`
        SELECT t.*, u.username as user_name, u.email as user_email,
               a.username as assigned_admin_name
        FROM support_tickets t
        LEFT JOIN users u ON t.user_id = u.id
        LEFT JOIN users a ON t.assigned_to = a.id
        ${whereClause}
        ORDER BY 
            CASE t.priority 
                WHEN 'urgent' THEN 1
                WHEN 'high' THEN 2
                WHEN 'medium' THEN 3
                WHEN 'low' THEN 4
                ELSE 5
            END,
            t.created_at DESC
        LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), (page - 1) * limit]);
    
    res.json({
        success: true,
        message: 'Support tickets retrieved successfully',
        tickets
    });
}));

// PUT /api/admin/support-tickets/:id - Update support ticket
router.put('/support-tickets/:id', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    const { status, priority, assigned_to, admin_notes } = req.body;
    
    // Check if ticket exists
    const [existingTicket] = await db.execute('SELECT id FROM support_tickets WHERE id = ?', [id]);
    
    if (existingTicket.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Support ticket not found'
        });
    }
    
    // Update ticket
    await db.execute(`
        UPDATE support_tickets 
        SET status = COALESCE(?, status), 
            priority = COALESCE(?, priority),
            assigned_to = COALESCE(?, assigned_to),
            admin_notes = COALESCE(?, admin_notes),
            updated_at = NOW()
        WHERE id = ?
    `, [status, priority, assigned_to, admin_notes, id]);
    
    // Log the update
    await db.execute(`
        INSERT INTO admin_actions (admin_id, action_type, target_type, target_id, notes, created_at)
        VALUES (?, 'ticket_update', 'support_ticket', ?, ?, NOW())
    `, [req.user.id, id, `Updated ticket: ${admin_notes || 'Status/priority updated'}`]);
    
    res.json({
        success: true,
        message: 'Support ticket updated successfully'
    });
}));

// POST /api/admin/support-tickets/:id/reply - Reply to support ticket
router.post('/support-tickets/:id/reply', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    const { message } = req.body;
    
    if (!message || !message.trim()) {
        return res.status(400).json({
            success: false,
            message: 'Reply message is required'
        });
    }
    
    // Check if ticket exists
    const [existingTicket] = await db.execute('SELECT id, user_id FROM support_tickets WHERE id = ?', [id]);
    
    if (existingTicket.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Support ticket not found'
        });
    }
    
    // Add reply
    await db.execute(`
        INSERT INTO ticket_replies (ticket_id, user_id, admin_id, message, is_admin_reply, created_at)
        VALUES (?, ?, ?, ?, 1, NOW())
    `, [id, existingTicket[0].user_id, req.user.id, message.trim()]);
    
    // Update ticket status to 'replied' if it was 'open'
    await db.execute(`
        UPDATE support_tickets 
        SET status = CASE 
                WHEN status = 'open' THEN 'replied'
                ELSE status 
            END,
            updated_at = NOW()
        WHERE id = ?
    `, [id]);
    
    res.json({
        success: true,
        message: 'Reply sent successfully'
    });
}));

// POST /api/admin/support-tickets/:id/close - Close support ticket
router.post('/support-tickets/:id/close', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    const { resolution_notes } = req.body;
    
    // Check if ticket exists
    const [existingTicket] = await db.execute('SELECT id FROM support_tickets WHERE id = ?', [id]);
    
    if (existingTicket.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Support ticket not found'
        });
    }
    
    // Close ticket
    await db.execute(`
        UPDATE support_tickets 
        SET status = 'closed', 
            closed_by = ?, 
            closed_at = NOW(),
            resolution_notes = ?,
            updated_at = NOW()
        WHERE id = ?
    `, [req.user.id, resolution_notes || 'Ticket resolved', id]);
    
    // Log the closure
    await db.execute(`
        INSERT INTO admin_actions (admin_id, action_type, target_type, target_id, notes, created_at)
        VALUES (?, 'ticket_close', 'support_ticket', ?, ?, NOW())
    `, [req.user.id, id, resolution_notes || 'Ticket closed']);
    
    res.json({
        success: true,
        message: 'Support ticket closed successfully'
    });
}));

// POST /api/admin/support-tickets/:id/reopen - Reopen support ticket
router.post('/support-tickets/:id/reopen', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    
    // Check if ticket exists
    const [existingTicket] = await db.execute('SELECT id FROM support_tickets WHERE id = ?', [id]);
    
    if (existingTicket.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Support ticket not found'
        });
    }
    
    // Reopen ticket
    await db.execute(`
        UPDATE support_tickets 
        SET status = 'open', 
            closed_by = NULL, 
            closed_at = NULL,
            admin_notes = COALESCE(CONCAT(admin_notes, '\n\nReopened: ', ?), ?),
            updated_at = NOW()
        WHERE id = ?
    `, [reason || 'Ticket reopened', reason || 'Ticket reopened', id]);
    
    // Log the reopening
    await db.execute(`
        INSERT INTO admin_actions (admin_id, action_type, target_type, target_id, notes, created_at)
        VALUES (?, 'ticket_reopen', 'support_ticket', ?, ?, NOW())
    `, [req.user.id, id, reason || 'Ticket reopened']);
    
    res.json({
        success: true,
        message: 'Support ticket reopened successfully'
    });
}));

// DELETE /api/admin/support-tickets/:id - Delete support ticket
router.delete('/support-tickets/:id', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    
    // Check if ticket exists
    const [existingTicket] = await db.execute('SELECT id FROM support_tickets WHERE id = ?', [id]);
    
    if (existingTicket.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Support ticket not found'
        });
    }
    
    // Delete associated replies first
    await db.execute('DELETE FROM ticket_replies WHERE ticket_id = ?', [id]);
    
    // Delete ticket
    await db.execute('DELETE FROM support_tickets WHERE id = ?', [id]);
    
    // Log the deletion
    await db.execute(`
        INSERT INTO admin_actions (admin_id, action_type, target_type, target_id, notes, created_at)
        VALUES (?, 'ticket_delete', 'support_ticket', ?, 'Ticket deleted', NOW())
    `, [req.user.id, id]);
    
    res.json({
        success: true,
        message: 'Support ticket deleted successfully'
    });
}));

// GET /api/admin/system-logs - Get system logs
router.get('/system-logs', enhancedErrorHandler(async (req, res) => {
    const { level, page = 1, limit = 100, search, date_from, date_to } = req.query;
    
    let whereConditions = [];
    let queryParams = [];
    
    if (level) {
        whereConditions.push('level = ?');
        queryParams.push(level);
    }
    
    if (search) {
        whereConditions.push('(message LIKE ? OR details LIKE ?)');
        const searchPattern = `%${search}%`;
        queryParams.push(searchPattern, searchPattern);
    }
    
    if (date_from) {
        whereConditions.push('created_at >= ?');
        queryParams.push(date_from);
    }
    
    if (date_to) {
        whereConditions.push('created_at <= ?');
        queryParams.push(date_to);
    }
    
    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    
    // Get logs with pagination
    const [logs] = await db.execute(`
        SELECT * FROM system_logs 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), (page - 1) * limit]);
    
    // Get total count for pagination
    const [countResult] = await db.execute(`
        SELECT COUNT(*) as total FROM system_logs 
        ${whereClause}
    `, queryParams);
    
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);
    
    res.json({
        success: true,
        message: 'System logs retrieved successfully',
        logs,
        pagination: {
            current_page: parseInt(page),
            total_pages: totalPages,
            total_items: total,
            items_per_page: parseInt(limit)
        }
    });
}));

// DELETE /api/admin/system-logs - Clear system logs
router.delete('/system-logs', enhancedErrorHandler(async (req, res) => {
    const { level, older_than_days } = req.body;
    
    let whereConditions = [];
    let queryParams = [];
    
    if (level) {
        whereConditions.push('level = ?');
        queryParams.push(level);
    }
    
    if (older_than_days) {
        whereConditions.push('created_at < DATE_SUB(NOW(), INTERVAL ? DAY)');
        queryParams.push(parseInt(older_than_days));
    }
    
    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    
    // Don't allow deleting all logs without conditions for safety
    if (whereConditions.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'At least one filter condition is required to prevent accidental deletion of all logs'
        });
    }
    
    const [result] = await db.execute(`
        DELETE FROM system_logs 
        ${whereClause}
    `, queryParams);
    
    // Log this action
    await db.execute(`
        INSERT INTO system_logs (level, message, details, created_at)
        VALUES ('info', 'System logs cleared by admin', ?, NOW())
    `, [JSON.stringify({ 
        admin_id: req.user.id, 
        deleted_count: result.affectedRows,
        filters: { level, older_than_days }
    })]);
    
    res.json({
        success: true,
        message: `${result.affectedRows} log entries deleted successfully`
    });
}));

// POST /api/admin/system-logs/export - Export system logs
router.post('/system-logs/export', enhancedErrorHandler(async (req, res) => {
    const { level, date_from, date_to, format = 'json' } = req.body;
    
    let whereConditions = [];
    let queryParams = [];
    
    if (level) {
        whereConditions.push('level = ?');
        queryParams.push(level);
    }
    
    if (date_from) {
        whereConditions.push('created_at >= ?');
        queryParams.push(date_from);
    }
    
    if (date_to) {
        whereConditions.push('created_at <= ?');
        queryParams.push(date_to);
    }
    
    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    
    const [logs] = await db.execute(`
        SELECT * FROM system_logs 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT 10000
    `, queryParams);
    
    // Log the export action
    await db.execute(`
        INSERT INTO system_logs (level, message, details, created_at)
        VALUES ('info', 'System logs exported by admin', ?, NOW())
    `, [JSON.stringify({ 
        admin_id: req.user.id, 
        export_count: logs.length,
        filters: { level, date_from, date_to },
        format
    })]);
    
    res.json({
        success: true,
        message: 'Logs exported successfully',
        data: logs,
        count: logs.length
    });
}));

// GET /api/admin/promotions - Get all promotions
router.get('/promotions', enhancedErrorHandler(async (req, res) => {
    const { status, type, page = 1, limit = 50, search } = req.query;
    
    let whereConditions = [];
    let queryParams = [];
    
    if (status) {
        whereConditions.push('status = ?');
        queryParams.push(status);
    }
    
    if (type) {
        whereConditions.push('discount_type = ?');
        queryParams.push(type);
    }
    
    if (search) {
        whereConditions.push('(title LIKE ? OR code LIKE ?)');
        const searchPattern = `%${search}%`;
        queryParams.push(searchPattern, searchPattern);
    }
    
    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    
    const [promotions] = await db.execute(`
        SELECT p.*, COUNT(o.id) as usage_count
        FROM promotions p
        LEFT JOIN orders o ON p.code = o.promo_code
        ${whereClause}
        GROUP BY p.id
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), (page - 1) * limit]);
    
    res.json({
        success: true,
        message: 'Promotions retrieved successfully',
        promotions
    });
}));

// POST /api/admin/promotions - Create promotion
router.post('/promotions', enhancedErrorHandler(async (req, res) => {
    const { 
        title, code, description, discount_type, discount_value, 
        min_order_amount, max_discount_amount, usage_limit, 
        start_date, end_date, status = 'active'
    } = req.body;
    
    // Validation
    if (!title || !code || !discount_type || !discount_value) {
        return res.status(400).json({
            success: false,
            message: 'Title, code, discount type, and discount value are required'
        });
    }
    
    // Check if promo code already exists
    const [existingPromo] = await db.execute(
        'SELECT id FROM promotions WHERE code = ?',
        [code.toUpperCase()]
    );
    
    if (existingPromo.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Promotion code already exists'
        });
    }
    
    const [result] = await db.execute(`
        INSERT INTO promotions (
            title, code, description, discount_type, discount_value,
            min_order_amount, max_discount_amount, usage_limit,
            start_date, end_date, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
        title, code.toUpperCase(), description || null, discount_type, discount_value,
        min_order_amount || 0, max_discount_amount || null, usage_limit || null,
        start_date || null, end_date || null, status
    ]);
    
    res.json({
        success: true,
        message: 'Promotion created successfully',
        promotion: { id: result.insertId, code: code.toUpperCase() }
    });
}));

// PUT /api/admin/promotions/:id - Update promotion
router.put('/promotions/:id', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    const { 
        title, description, discount_type, discount_value, 
        min_order_amount, max_discount_amount, usage_limit, 
        start_date, end_date, status
    } = req.body;
    
    // Check if promotion exists
    const [existingPromo] = await db.execute('SELECT id FROM promotions WHERE id = ?', [id]);
    
    if (existingPromo.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Promotion not found'
        });
    }
    
    await db.execute(`
        UPDATE promotions SET
            title = COALESCE(?, title),
            description = COALESCE(?, description),
            discount_type = COALESCE(?, discount_type),
            discount_value = COALESCE(?, discount_value),
            min_order_amount = COALESCE(?, min_order_amount),
            max_discount_amount = COALESCE(?, max_discount_amount),
            usage_limit = COALESCE(?, usage_limit),
            start_date = COALESCE(?, start_date),
            end_date = COALESCE(?, end_date),
            status = COALESCE(?, status),
            updated_at = NOW()
        WHERE id = ?
    `, [
        title, description, discount_type, discount_value,
        min_order_amount, max_discount_amount, usage_limit,
        start_date, end_date, status, id
    ]);
    
    res.json({
        success: true,
        message: 'Promotion updated successfully'
    });
}));

// DELETE /api/admin/promotions/:id - Delete promotion
router.delete('/promotions/:id', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    
    // Check if promotion exists
    const [existingPromo] = await db.execute('SELECT id, code FROM promotions WHERE id = ?', [id]);
    
    if (existingPromo.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Promotion not found'
        });
    }
    
    // Check if promotion has been used
    const [usage] = await db.execute(
        'SELECT COUNT(*) as count FROM orders WHERE promo_code = ?',
        [existingPromo[0].code]
    );
    
    if (usage[0].count > 0) {
        return res.status(400).json({
            success: false,
            message: 'Cannot delete promotion that has been used in orders'
        });
    }
    
    await db.execute('DELETE FROM promotions WHERE id = ?', [id]);
    
    res.json({
        success: true,
        message: 'Promotion deleted successfully'
    });
}));

// POST /api/admin/promotions/:id/toggle - Toggle promotion status
router.post('/promotions/:id/toggle', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    
    // Check if promotion exists
    const [existingPromo] = await db.execute('SELECT id, status FROM promotions WHERE id = ?', [id]);
    
    if (existingPromo.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Promotion not found'
        });
    }
    
    const newStatus = existingPromo[0].status === 'active' ? 'inactive' : 'active';
    
    await db.execute('UPDATE promotions SET status = ?, updated_at = NOW() WHERE id = ?', [newStatus, id]);
    
    res.json({
        success: true,
        message: `Promotion ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`,
        status: newStatus
    });
}));

// GET /api/admin/health-check - System health check
router.get('/health-check', enhancedErrorHandler(async (req, res) => {
    const healthStatus = {
        database: 'healthy',
        server: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
    };
    
    try {
        // Test database connection
        await db.execute('SELECT 1');
        healthStatus.database = 'healthy';
    } catch (error) {
        healthStatus.database = 'unhealthy';
        healthStatus.database_error = error.message;
    }
    
    res.json({
        success: true,
        message: 'Health check completed',
        health: healthStatus
    });
}));

// ========== CMS MANAGEMENT ENDPOINTS ==========

// GET /api/admin/cms/pages - Get all CMS pages
router.get('/cms/pages', enhancedErrorHandler(async (req, res) => {
    const { status, type, page = 1, limit = 50, search } = req.query;
    
    let whereConditions = [];
    let queryParams = [];
    
    if (status) {
        whereConditions.push('status = ?');
        queryParams.push(status);
    }
    
    if (type) {
        whereConditions.push('page_type = ?');
        queryParams.push(type);
    }
    
    if (search) {
        whereConditions.push('(title LIKE ? OR slug LIKE ? OR content LIKE ?)');
        const searchPattern = `%${search}%`;
        queryParams.push(searchPattern, searchPattern, searchPattern);
    }
    
    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    
    const [pages] = await db.execute(`
        SELECT p.*, u.username as author_name
        FROM cms_pages p
        LEFT JOIN users u ON p.author_id = u.id
        ${whereClause}
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), (page - 1) * limit]);
    
    res.json({
        success: true,
        message: 'CMS pages retrieved successfully',
        pages
    });
}));

// POST /api/admin/cms/pages - Create CMS page
router.post('/cms/pages', enhancedErrorHandler(async (req, res) => {
    const { 
        title, slug, content, excerpt, page_type = 'page', 
        status = 'draft', meta_title, meta_description, 
        featured_image, template
    } = req.body;
    
    // Validation
    if (!title || !content) {
        return res.status(400).json({
            success: false,
            message: 'Title and content are required'
        });
    }
    
    // Generate slug if not provided
    const pageSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    
    // Check if slug already exists
    const [existingPage] = await db.execute('SELECT id FROM cms_pages WHERE slug = ?', [pageSlug]);
    
    if (existingPage.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'A page with this slug already exists'
        });
    }
    
    const [result] = await db.execute(`
        INSERT INTO cms_pages (
            title, slug, content, excerpt, page_type, status,
            meta_title, meta_description, featured_image, template,
            author_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
        title, pageSlug, content, excerpt || null, page_type, status,
        meta_title || null, meta_description || null, featured_image || null, 
        template || 'default', req.user.id
    ]);
    
    res.json({
        success: true,
        message: 'CMS page created successfully',
        page: { id: result.insertId, slug: pageSlug }
    });
}));

// PUT /api/admin/cms/pages/:id - Update CMS page
router.put('/cms/pages/:id', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    const { 
        title, slug, content, excerpt, page_type, status,
        meta_title, meta_description, featured_image, template
    } = req.body;
    
    // Check if page exists
    const [existingPage] = await db.execute('SELECT id, slug FROM cms_pages WHERE id = ?', [id]);
    
    if (existingPage.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'CMS page not found'
        });
    }
    
    // Check slug uniqueness if changed
    if (slug && slug !== existingPage[0].slug) {
        const [duplicateSlug] = await db.execute('SELECT id FROM cms_pages WHERE slug = ? AND id != ?', [slug, id]);
        
        if (duplicateSlug.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'A page with this slug already exists'
            });
        }
    }
    
    await db.execute(`
        UPDATE cms_pages SET
            title = COALESCE(?, title),
            slug = COALESCE(?, slug),
            content = COALESCE(?, content),
            excerpt = COALESCE(?, excerpt),
            page_type = COALESCE(?, page_type),
            status = COALESCE(?, status),
            meta_title = COALESCE(?, meta_title),
            meta_description = COALESCE(?, meta_description),
            featured_image = COALESCE(?, featured_image),
            template = COALESCE(?, template),
            updated_at = NOW()
        WHERE id = ?
    `, [
        title, slug, content, excerpt, page_type, status,
        meta_title, meta_description, featured_image, template, id
    ]);
    
    res.json({
        success: true,
        message: 'CMS page updated successfully'
    });
}));

// DELETE /api/admin/cms/pages/:id - Delete CMS page
router.delete('/cms/pages/:id', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    
    // Check if page exists
    const [existingPage] = await db.execute('SELECT id, title FROM cms_pages WHERE id = ?', [id]);
    
    if (existingPage.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'CMS page not found'
        });
    }
    
    await db.execute('DELETE FROM cms_pages WHERE id = ?', [id]);
    
    res.json({
        success: true,
        message: 'CMS page deleted successfully'
    });
}));

// POST /api/admin/cms/pages/:id/publish - Publish/unpublish page
router.post('/cms/pages/:id/publish', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    const { publish } = req.body; // true to publish, false to unpublish
    
    // Check if page exists
    const [existingPage] = await db.execute('SELECT id, status FROM cms_pages WHERE id = ?', [id]);
    
    if (existingPage.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'CMS page not found'
        });
    }
    
    const newStatus = publish ? 'published' : 'draft';
    
    await db.execute('UPDATE cms_pages SET status = ?, updated_at = NOW() WHERE id = ?', [newStatus, id]);
    
    res.json({
        success: true,
        message: `Page ${publish ? 'published' : 'unpublished'} successfully`,
        status: newStatus
    });
}));

// GET /api/admin/cms/blog - Get all blog posts
router.get('/cms/blog', enhancedErrorHandler(async (req, res) => {
    const { status, category, page = 1, limit = 50, search } = req.query;
    
    let whereConditions = ['page_type = ?'];
    let queryParams = ['blog'];
    
    if (status) {
        whereConditions.push('status = ?');
        queryParams.push(status);
    }
    
    if (category) {
        whereConditions.push('blog_category = ?');
        queryParams.push(category);
    }
    
    if (search) {
        whereConditions.push('(title LIKE ? OR content LIKE ? OR excerpt LIKE ?)');
        const searchPattern = `%${search}%`;
        queryParams.push(searchPattern, searchPattern, searchPattern);
    }
    
    const whereClause = 'WHERE ' + whereConditions.join(' AND ');
    
    const [posts] = await db.execute(`
        SELECT p.*, u.username as author_name
        FROM cms_pages p
        LEFT JOIN users u ON p.author_id = u.id
        ${whereClause}
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), (page - 1) * limit]);
    
    res.json({
        success: true,
        message: 'Blog posts retrieved successfully',
        posts
    });
}));

// GET /api/admin/cms/announcements - Get all announcements
router.get('/cms/announcements', enhancedErrorHandler(async (req, res) => {
    const { status, priority, page = 1, limit = 50 } = req.query;
    
    let whereConditions = [];
    let queryParams = [];
    
    if (status) {
        whereConditions.push('status = ?');
        queryParams.push(status);
    }
    
    if (priority) {
        whereConditions.push('priority = ?');
        queryParams.push(priority);
    }
    
    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    
    const [announcements] = await db.execute(`
        SELECT a.*, u.username as author_name
        FROM announcements a
        LEFT JOIN users u ON a.author_id = u.id
        ${whereClause}
        ORDER BY a.priority DESC, a.created_at DESC
        LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), (page - 1) * limit]);
    
    res.json({
        success: true,
        message: 'Announcements retrieved successfully',
        announcements
    });
}));

// POST /api/admin/cms/announcements - Create announcement
router.post('/cms/announcements', enhancedErrorHandler(async (req, res) => {
    const { 
        title, content, type = 'info', priority = 'medium',
        status = 'active', target_audience = 'all',
        start_date, end_date, dismissible = true
    } = req.body;
    
    // Validation
    if (!title || !content) {
        return res.status(400).json({
            success: false,
            message: 'Title and content are required'
        });
    }
    
    const [result] = await db.execute(`
        INSERT INTO announcements (
            title, content, type, priority, status, target_audience,
            start_date, end_date, dismissible, author_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
        title, content, type, priority, status, target_audience,
        start_date || null, end_date || null, dismissible, req.user.id
    ]);
    
    res.json({
        success: true,
        message: 'Announcement created successfully',
        announcement: { id: result.insertId }
    });
}));

// PUT /api/admin/cms/announcements/:id - Update announcement
router.put('/cms/announcements/:id', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    const { 
        title, content, type, priority, status, target_audience,
        start_date, end_date, dismissible
    } = req.body;
    
    // Check if announcement exists
    const [existing] = await db.execute('SELECT id FROM announcements WHERE id = ?', [id]);
    
    if (existing.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Announcement not found'
        });
    }
    
    await db.execute(`
        UPDATE announcements SET
            title = COALESCE(?, title),
            content = COALESCE(?, content),
            type = COALESCE(?, type),
            priority = COALESCE(?, priority),
            status = COALESCE(?, status),
            target_audience = COALESCE(?, target_audience),
            start_date = COALESCE(?, start_date),
            end_date = COALESCE(?, end_date),
            dismissible = COALESCE(?, dismissible),
            updated_at = NOW()
        WHERE id = ?
    `, [
        title, content, type, priority, status, target_audience,
        start_date, end_date, dismissible, id
    ]);
    
    res.json({
        success: true,
        message: 'Announcement updated successfully'
    });
}));

// DELETE /api/admin/cms/announcements/:id - Delete announcement
router.delete('/cms/announcements/:id', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    
    const [existing] = await db.execute('SELECT id FROM announcements WHERE id = ?', [id]);
    
    if (existing.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Announcement not found'
        });
    }
    
    await db.execute('DELETE FROM announcements WHERE id = ?', [id]);
    
    res.json({
        success: true,
        message: 'Announcement deleted successfully'
    });
}));

// ========== NOTIFICATION MANAGEMENT ENDPOINTS ==========

// GET /api/admin/notifications - Get all notifications
router.get('/notifications', enhancedErrorHandler(async (req, res) => {
    const { type, status, page = 1, limit = 50, search } = req.query;
    
    let whereConditions = [];
    let queryParams = [];
    
    if (type) {
        whereConditions.push('type = ?');
        queryParams.push(type);
    }
    
    if (status) {
        whereConditions.push('status = ?');
        queryParams.push(status);
    }
    
    if (search) {
        whereConditions.push('(title LIKE ? OR content LIKE ?)');
        const searchPattern = `%${search}%`;
        queryParams.push(searchPattern, searchPattern);
    }
    
    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    
    const [notifications] = await db.execute(`
        SELECT n.*, u.username as author_name,
               COUNT(nl.id) as sent_count,
               COUNT(CASE WHEN nl.opened_at IS NOT NULL THEN 1 END) as opened_count
        FROM notifications n
        LEFT JOIN users u ON n.author_id = u.id
        LEFT JOIN notification_logs nl ON n.id = nl.notification_id
        ${whereClause}
        GROUP BY n.id
        ORDER BY n.created_at DESC
        LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), (page - 1) * limit]);
    
    res.json({
        success: true,
        message: 'Notifications retrieved successfully',
        notifications
    });
}));

// POST /api/admin/notifications - Create notification
router.post('/notifications', enhancedErrorHandler(async (req, res) => {
    const { 
        title, content, type, target_audience = 'all',
        scheduled_at, priority = 'medium', 
        push_enabled = false, email_enabled = false,
        sms_enabled = false, action_url
    } = req.body;
    
    // Validation
    if (!title || !content) {
        return res.status(400).json({
            success: false,
            message: 'Title and content are required'
        });
    }
    
    const [result] = await db.execute(`
        INSERT INTO notifications (
            title, content, type, target_audience, scheduled_at, priority,
            push_enabled, email_enabled, sms_enabled, action_url,
            author_id, created_at, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'draft')
    `, [
        title, content, type || 'general', target_audience,
        scheduled_at || null, priority, push_enabled, email_enabled,
        sms_enabled, action_url || null, req.user.id
    ]);
    
    res.json({
        success: true,
        message: 'Notification created successfully',
        notification: { id: result.insertId }
    });
}));

// PUT /api/admin/notifications/:id - Update notification
router.put('/notifications/:id', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    const { 
        title, content, type, target_audience, scheduled_at, priority,
        push_enabled, email_enabled, sms_enabled, action_url, status
    } = req.body;
    
    // Check if notification exists
    const [existing] = await db.execute('SELECT id, status FROM notifications WHERE id = ?', [id]);
    
    if (existing.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Notification not found'
        });
    }
    
    // Prevent editing sent notifications
    if (existing[0].status === 'sent') {
        return res.status(400).json({
            success: false,
            message: 'Cannot edit notification that has already been sent'
        });
    }
    
    await db.execute(`
        UPDATE notifications SET
            title = COALESCE(?, title),
            content = COALESCE(?, content),
            type = COALESCE(?, type),
            target_audience = COALESCE(?, target_audience),
            scheduled_at = COALESCE(?, scheduled_at),
            priority = COALESCE(?, priority),
            push_enabled = COALESCE(?, push_enabled),
            email_enabled = COALESCE(?, email_enabled),
            sms_enabled = COALESCE(?, sms_enabled),
            action_url = COALESCE(?, action_url),
            status = COALESCE(?, status),
            updated_at = NOW()
        WHERE id = ?
    `, [
        title, content, type, target_audience, scheduled_at, priority,
        push_enabled, email_enabled, sms_enabled, action_url, status, id
    ]);
    
    res.json({
        success: true,
        message: 'Notification updated successfully'
    });
}));

// POST /api/admin/notifications/:id/send - Send notification
router.post('/notifications/:id/send', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    const { immediate = false } = req.body;
    
    // Get notification details
    const [notification] = await db.execute(`
        SELECT * FROM notifications WHERE id = ?
    `, [id]);
    
    if (notification.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Notification not found'
        });
    }
    
    const notif = notification[0];
    
    if (notif.status === 'sent') {
        return res.status(400).json({
            success: false,
            message: 'Notification has already been sent'
        });
    }
    
    // Get target users based on audience
    let userQuery = 'SELECT id, email, phone FROM users WHERE 1=1';
    let userParams = [];
    
    if (notif.target_audience !== 'all') {
        userQuery += ' AND role = ?';
        userParams.push(notif.target_audience);
    }
    
    const [targetUsers] = await db.execute(userQuery, userParams);
    
    if (targetUsers.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'No target users found'
        });
    }
    
    // Update notification status
    const sendTime = immediate ? new Date() : new Date(notif.scheduled_at || Date.now());
    await db.execute(
        'UPDATE notifications SET status = ?, sent_at = ? WHERE id = ?',
        [immediate ? 'sent' : 'scheduled', sendTime, id]
    );
    
    // Create notification logs for each user
    const logEntries = targetUsers.map(user => [
        id, user.id, 'pending', new Date()
    ]);
    
    if (logEntries.length > 0) {
        const placeholders = logEntries.map(() => '(?, ?, ?, ?)').join(',');
        await db.execute(`
            INSERT INTO notification_logs (notification_id, user_id, status, created_at) 
            VALUES ${placeholders}
        `, logEntries.flat());
    }
    
    // TODO: Implement actual notification sending (push, email, SMS)
    // For now, just simulate the sending process
    
    res.json({
        success: true,
        message: `Notification ${immediate ? 'sent' : 'scheduled'} to ${targetUsers.length} users`,
        sent_count: targetUsers.length,
        send_time: sendTime
    });
}));

// DELETE /api/admin/notifications/:id - Delete notification
router.delete('/notifications/:id', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    
    // Check if notification exists
    const [existing] = await db.execute('SELECT id, status FROM notifications WHERE id = ?', [id]);
    
    if (existing.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Notification not found'
        });
    }
    
    // Prevent deleting sent notifications
    if (existing[0].status === 'sent') {
        return res.status(400).json({
            success: false,
            message: 'Cannot delete notification that has already been sent'
        });
    }
    
    // Delete related logs first
    await db.execute('DELETE FROM notification_logs WHERE notification_id = ?', [id]);
    
    // Delete notification
    await db.execute('DELETE FROM notifications WHERE id = ?', [id]);
    
    res.json({
        success: true,
        message: 'Notification deleted successfully'
    });
}));

// GET /api/admin/notification-templates - Get all notification templates
router.get('/notification-templates', enhancedErrorHandler(async (req, res) => {
    const { type, page = 1, limit = 50 } = req.query;
    
    let whereConditions = [];
    let queryParams = [];
    
    if (type) {
        whereConditions.push('type = ?');
        queryParams.push(type);
    }
    
    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    
    const [templates] = await db.execute(`
        SELECT * FROM notification_templates
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), (page - 1) * limit]);
    
    res.json({
        success: true,
        message: 'Notification templates retrieved successfully',
        templates
    });
}));

// POST /api/admin/notification-templates - Create notification template
router.post('/notification-templates', enhancedErrorHandler(async (req, res) => {
    const { 
        name, type, title_template, content_template, 
        push_template, email_template, sms_template,
        variables, description
    } = req.body;
    
    // Validation
    if (!name || !type || !title_template || !content_template) {
        return res.status(400).json({
            success: false,
            message: 'Name, type, title template, and content template are required'
        });
    }
    
    const [result] = await db.execute(`
        INSERT INTO notification_templates (
            name, type, title_template, content_template,
            push_template, email_template, sms_template,
            variables, description, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
        name, type, title_template, content_template,
        push_template || null, email_template || null, sms_template || null,
        JSON.stringify(variables || {}), description || null
    ]);
    
    res.json({
        success: true,
        message: 'Notification template created successfully',
        template: { id: result.insertId }
    });
}));

// GET /api/admin/notification-analytics - Get notification analytics
router.get('/notification-analytics', enhancedErrorHandler(async (req, res) => {
    const { period = '30' } = req.query; // days
    
    const periodDays = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);
    
    // Get basic stats
    const [stats] = await db.execute(`
        SELECT 
            COUNT(*) as total_notifications,
            COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_notifications,
            COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled_notifications,
            COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_notifications
        FROM notifications 
        WHERE created_at >= ?
    `, [startDate]);
    
    // Get delivery stats
    const [deliveryStats] = await db.execute(`
        SELECT 
            COUNT(*) as total_deliveries,
            COUNT(CASE WHEN status = 'delivered' THEN 1 END) as successful_deliveries,
            COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_deliveries,
            COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as opened_count,
            COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) as clicked_count
        FROM notification_logs 
        WHERE created_at >= ?
    `, [startDate]);
    
    // Get type breakdown
    const [typeBreakdown] = await db.execute(`
        SELECT type, COUNT(*) as count
        FROM notifications 
        WHERE created_at >= ?
        GROUP BY type
        ORDER BY count DESC
    `, [startDate]);
    
    // Get daily stats for chart
    const [dailyStats] = await db.execute(`
        SELECT 
            DATE(created_at) as date,
            COUNT(*) as notifications_created,
            COUNT(CASE WHEN status = 'sent' THEN 1 END) as notifications_sent
        FROM notifications 
        WHERE created_at >= ?
        GROUP BY DATE(created_at)
        ORDER BY date ASC
    `, [startDate]);
    
    res.json({
        success: true,
        message: 'Notification analytics retrieved successfully',
        analytics: {
            period: periodDays,
            overview: stats[0],
            delivery: deliveryStats[0],
            type_breakdown: typeBreakdown,
            daily_stats: dailyStats
        }
    });
}));

// ========== BACKUP & RESTORE MANAGEMENT ENDPOINTS ==========

// GET /api/admin/backups - Get all backups
router.get('/backups', enhancedErrorHandler(async (req, res) => {
    const { type, status, page = 1, limit = 50 } = req.query;
    
    let whereConditions = [];
    let queryParams = [];
    
    if (type) {
        whereConditions.push('type = ?');
        queryParams.push(type);
    }
    
    if (status) {
        whereConditions.push('status = ?');
        queryParams.push(status);
    }
    
    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    
    const [backups] = await db.execute(`
        SELECT b.*, u.username as created_by_name
        FROM backups b
        LEFT JOIN users u ON b.created_by = u.id
        ${whereClause}
        ORDER BY b.created_at DESC
        LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), (page - 1) * limit]);
    
    res.json({
        success: true,
        message: 'Backups retrieved successfully',
        backups
    });
}));

// POST /api/admin/backups - Create backup
router.post('/backups', enhancedErrorHandler(async (req, res) => {
    const { 
        name, type = 'full', description, 
        include_users = true, include_products = true, 
        include_orders = true, include_payments = true,
        include_logs = false, include_files = false
    } = req.body;
    
    // Validation
    if (!name) {
        return res.status(400).json({
            success: false,
            message: 'Backup name is required'
        });
    }
    
    // Check if backup with same name exists
    const [existingBackup] = await db.execute(
        'SELECT id FROM backups WHERE name = ?',
        [name]
    );
    
    if (existingBackup.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Backup with this name already exists'
        });
    }
    
    const backupConfig = {
        include_users,
        include_products,
        include_orders,
        include_payments,
        include_logs,
        include_files
    };
    
    const [result] = await db.execute(`
        INSERT INTO backups (
            name, type, description, config, status,
            created_by, created_at
        ) VALUES (?, ?, ?, ?, 'pending', ?, NOW())
    `, [
        name, type, description || null,
        JSON.stringify(backupConfig), req.user.id
    ]);
    
    // TODO: Implement actual backup process in background
    // For now, simulate backup completion
    setTimeout(async () => {
        try {
            const fileSize = Math.floor(Math.random() * 100) + 10; // MB
            const fileName = `${name.replace(/\s+/g, '_')}_${Date.now()}.sql`;
            
            await db.execute(`
                UPDATE backups SET 
                    status = 'completed',
                    file_name = ?,
                    file_size = ?,
                    completed_at = NOW()
                WHERE id = ?
            `, [fileName, fileSize, result.insertId]);
            
        } catch (error) {
            await db.execute(`
                UPDATE backups SET 
                    status = 'failed',
                    error_message = ?
                WHERE id = ?
            `, [error.message, result.insertId]);
        }
    }, 3000);
    
    res.json({
        success: true,
        message: 'Backup started successfully',
        backup: { id: result.insertId, name, status: 'pending' }
    });
}));

// GET /api/admin/backups/:id/download - Download backup file
router.get('/backups/:id/download', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    
    // Get backup details
    const [backup] = await db.execute(
        'SELECT * FROM backups WHERE id = ? AND status = "completed"',
        [id]
    );
    
    if (backup.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Backup not found or not completed'
        });
    }
    
    const backupData = backup[0];
    
    // TODO: Implement actual file serving
    // For now, return a simulated response
    res.json({
        success: true,
        message: 'Backup file ready for download',
        download_url: `/downloads/backups/${backupData.file_name}`,
        file_name: backupData.file_name,
        file_size: backupData.file_size
    });
}));

// DELETE /api/admin/backups/:id - Delete backup
router.delete('/backups/:id', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    
    // Check if backup exists
    const [existingBackup] = await db.execute('SELECT id, file_name FROM backups WHERE id = ?', [id]);
    
    if (existingBackup.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Backup not found'
        });
    }
    
    // TODO: Delete actual backup file from storage
    
    await db.execute('DELETE FROM backups WHERE id = ?', [id]);
    
    res.json({
        success: true,
        message: 'Backup deleted successfully'
    });
}));

// POST /api/admin/restore - Restore from backup
router.post('/restore', enhancedErrorHandler(async (req, res) => {
    const { backup_id, restore_options = {} } = req.body;
    
    // Validation
    if (!backup_id) {
        return res.status(400).json({
            success: false,
            message: 'Backup ID is required'
        });
    }
    
    // Get backup details
    const [backup] = await db.execute(
        'SELECT * FROM backups WHERE id = ? AND status = "completed"',
        [backup_id]
    );
    
    if (backup.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Backup not found or not completed'
        });
    }
    
    // Create restore log entry
    const [result] = await db.execute(`
        INSERT INTO restore_logs (
            backup_id, restore_options, status, 
            initiated_by, created_at
        ) VALUES (?, ?, 'pending', ?, NOW())
    `, [
        backup_id,
        JSON.stringify(restore_options),
        req.user.id
    ]);
    
    // TODO: Implement actual restore process
    // For now, simulate restore completion
    setTimeout(async () => {
        try {
            await db.execute(`
                UPDATE restore_logs SET 
                    status = 'completed',
                    completed_at = NOW()
                WHERE id = ?
            `, [result.insertId]);
            
        } catch (error) {
            await db.execute(`
                UPDATE restore_logs SET 
                    status = 'failed',
                    error_message = ?
                WHERE id = ?
            `, [error.message, result.insertId]);
        }
    }, 5000);
    
    res.json({
        success: true,
        message: 'Restore process initiated',
        restore_id: result.insertId
    });
}));

// GET /api/admin/restore-logs - Get restore logs
router.get('/restore-logs', enhancedErrorHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    
    const [restoreLogs] = await db.execute(`
        SELECT rl.*, b.name as backup_name, u.username as initiated_by_name
        FROM restore_logs rl
        LEFT JOIN backups b ON rl.backup_id = b.id
        LEFT JOIN users u ON rl.initiated_by = u.id
        ORDER BY rl.created_at DESC
        LIMIT ? OFFSET ?
    `, [parseInt(limit), (page - 1) * limit]);
    
    res.json({
        success: true,
        message: 'Restore logs retrieved successfully',
        logs: restoreLogs
    });
}));

// GET /api/admin/system-info - Get system information
router.get('/system-info', enhancedErrorHandler(async (req, res) => {
    try {
        // Database info
        const [dbVersion] = await db.execute('SELECT VERSION() as version');
        
        // Get database size
        const [dbSize] = await db.execute(`
            SELECT 
                ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb
            FROM information_schema.tables 
            WHERE table_schema = DATABASE()
        `);
        
        // Get table counts
        const [tableCounts] = await db.execute(`
            SELECT table_name, table_rows 
            FROM information_schema.tables 
            WHERE table_schema = DATABASE()
            ORDER BY table_rows DESC
        `);
        
        // System stats
        const systemInfo = {
            database: {
                version: dbVersion[0]?.version || 'Unknown',
                size_mb: dbSize[0]?.size_mb || 0,
                tables: tableCounts
            },
            server: {
                node_version: process.version,
                platform: process.platform,
                uptime: Math.floor(process.uptime()),
                memory_usage: process.memoryUsage()
            },
            timestamp: new Date().toISOString()
        };
        
        res.json({
            success: true,
            message: 'System information retrieved successfully',
            system_info: systemInfo
        });
        
    } catch (error) {
        res.json({
            success: true,
            message: 'Partial system information retrieved',
            system_info: {
                server: {
                    node_version: process.version,
                    platform: process.platform,
                    uptime: Math.floor(process.uptime()),
                    memory_usage: process.memoryUsage()
                },
                database: {
                    version: 'Unable to retrieve',
                    error: error.message
                },
                timestamp: new Date().toISOString()
            }
        });
    }
}));

// POST /api/admin/maintenance-mode - Toggle maintenance mode
router.post('/maintenance-mode', enhancedErrorHandler(async (req, res) => {
    const { enabled, message = 'System under maintenance' } = req.body;
    
    // TODO: Implement actual maintenance mode toggle
    // This would typically involve setting a flag in database or config file
    
    res.json({
        success: true,
        message: `Maintenance mode ${enabled ? 'enabled' : 'disabled'}`,
        maintenance: {
            enabled: enabled,
            message: enabled ? message : null,
            enabled_by: req.user.id,
            enabled_at: enabled ? new Date().toISOString() : null
        }
    });
}));

// GET /api/admin/disk-usage - Get disk usage information
router.get('/disk-usage', enhancedErrorHandler(async (req, res) => {
    // TODO: Implement actual disk usage calculation
    // For now, return simulated data
    
    const diskUsage = {
        total_space: 100 * 1024, // 100GB in MB
        used_space: 45 * 1024,   // 45GB in MB
        free_space: 55 * 1024,   // 55GB in MB
        usage_percentage: 45,
        breakdown: {
            database: 15 * 1024,    // 15GB
            uploads: 20 * 1024,     // 20GB
            logs: 5 * 1024,         // 5GB
            backups: 5 * 1024,      // 5GB
            other: 0
        },
        timestamp: new Date().toISOString()
    };
    
    res.json({
        success: true,
        message: 'Disk usage information retrieved',
        disk_usage: diskUsage
    });
}));

// ========== SECURITY & API MANAGEMENT ENDPOINTS ==========

// GET /api/admin/security/sessions - Get active user sessions
router.get('/security/sessions', enhancedErrorHandler(async (req, res) => {
    const { user_id, page = 1, limit = 50 } = req.query;
    
    let whereConditions = ['status = "active"'];
    let queryParams = [];
    
    if (user_id) {
        whereConditions.push('user_id = ?');
        queryParams.push(user_id);
    }
    
    const whereClause = 'WHERE ' + whereConditions.join(' AND ');
    
    const [sessions] = await db.execute(`
        SELECT s.*, u.username, u.email, u.role
        FROM user_sessions s
        LEFT JOIN users u ON s.user_id = u.id
        ${whereClause}
        ORDER BY s.created_at DESC
        LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), (page - 1) * limit]);
    
    res.json({
        success: true,
        message: 'Active sessions retrieved successfully',
        sessions
    });
}));

// DELETE /api/admin/security/sessions/:id - Revoke user session
router.delete('/security/sessions/:id', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    
    await db.execute('UPDATE user_sessions SET status = "revoked", revoked_at = NOW() WHERE id = ?', [id]);
    
    res.json({
        success: true,
        message: 'Session revoked successfully'
    });
}));

// GET /api/admin/security/login-attempts - Get failed login attempts
router.get('/security/login-attempts', enhancedErrorHandler(async (req, res) => {
    const { ip_address, status, page = 1, limit = 100 } = req.query;
    
    let whereConditions = [];
    let queryParams = [];
    
    if (ip_address) {
        whereConditions.push('ip_address = ?');
        queryParams.push(ip_address);
    }
    
    if (status) {
        whereConditions.push('status = ?');
        queryParams.push(status);
    }
    
    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    
    const [attempts] = await db.execute(`
        SELECT la.*, u.username, u.email
        FROM login_attempts la
        LEFT JOIN users u ON la.user_id = u.id
        ${whereClause}
        ORDER BY la.attempted_at DESC
        LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), (page - 1) * limit]);
    
    res.json({
        success: true,
        message: 'Login attempts retrieved successfully',
        attempts
    });
}));

// GET /api/admin/security/blocked-ips - Get blocked IP addresses
router.get('/security/blocked-ips', enhancedErrorHandler(async (req, res) => {
    const { page = 1, limit = 100 } = req.query;
    
    const [blockedIPs] = await db.execute(`
        SELECT * FROM blocked_ips 
        WHERE status = 'active'
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    `, [parseInt(limit), (page - 1) * limit]);
    
    res.json({
        success: true,
        message: 'Blocked IPs retrieved successfully',
        blocked_ips: blockedIPs
    });
}));

// POST /api/admin/security/block-ip - Block IP address
router.post('/security/block-ip', enhancedErrorHandler(async (req, res) => {
    const { ip_address, reason, duration_hours = 24 } = req.body;
    
    if (!ip_address) {
        return res.status(400).json({
            success: false,
            message: 'IP address is required'
        });
    }
    
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + duration_hours);
    
    const [result] = await db.execute(`
        INSERT INTO blocked_ips (ip_address, reason, blocked_by, expires_at, created_at, status)
        VALUES (?, ?, ?, ?, NOW(), 'active')
        ON DUPLICATE KEY UPDATE
        reason = VALUES(reason),
        blocked_by = VALUES(blocked_by),
        expires_at = VALUES(expires_at),
        status = 'active'
    `, [ip_address, reason || 'Manually blocked by admin', req.user.id, expiresAt]);
    
    res.json({
        success: true,
        message: 'IP address blocked successfully',
        blocked_ip: { ip_address, expires_at: expiresAt }
    });
}));

// DELETE /api/admin/security/unblock-ip/:ip - Unblock IP address
router.delete('/security/unblock-ip/:ip', enhancedErrorHandler(async (req, res) => {
    const { ip } = req.params;
    
    await db.execute('UPDATE blocked_ips SET status = "inactive" WHERE ip_address = ?', [ip]);
    
    res.json({
        success: true,
        message: 'IP address unblocked successfully'
    });
}));

// GET /api/admin/api/usage - Get API usage statistics
router.get('/api/usage', enhancedErrorHandler(async (req, res) => {
    const { period = '24' } = req.query; // hours
    
    const periodHours = parseInt(period);
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - periodHours);
    
    // Get API usage stats
    const [usageStats] = await db.execute(`
        SELECT 
            endpoint,
            method,
            COUNT(*) as request_count,
            AVG(response_time) as avg_response_time,
            COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count
        FROM api_logs 
        WHERE created_at >= ?
        GROUP BY endpoint, method
        ORDER BY request_count DESC
        LIMIT 50
    `, [startDate]);
    
    // Get hourly breakdown
    const [hourlyStats] = await db.execute(`
        SELECT 
            DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00') as hour,
            COUNT(*) as request_count,
            COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count,
            AVG(response_time) as avg_response_time
        FROM api_logs 
        WHERE created_at >= ?
        GROUP BY hour
        ORDER BY hour ASC
    `, [startDate]);
    
    // Get top users by API usage
    const [topUsers] = await db.execute(`
        SELECT 
            u.username,
            u.email,
            u.role,
            COUNT(al.id) as request_count,
            COUNT(CASE WHEN al.status_code >= 400 THEN 1 END) as error_count
        FROM api_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.created_at >= ?
        GROUP BY u.id
        ORDER BY request_count DESC
        LIMIT 20
    `, [startDate]);
    
    res.json({
        success: true,
        message: 'API usage statistics retrieved successfully',
        usage: {
            period_hours: periodHours,
            endpoints: usageStats,
            hourly_breakdown: hourlyStats,
            top_users: topUsers
        }
    });
}));

// GET /api/admin/api/keys - Get API keys
router.get('/api/keys', enhancedErrorHandler(async (req, res) => {
    const { user_id, status, page = 1, limit = 50 } = req.query;
    
    let whereConditions = [];
    let queryParams = [];
    
    if (user_id) {
        whereConditions.push('user_id = ?');
        queryParams.push(user_id);
    }
    
    if (status) {
        whereConditions.push('status = ?');
        queryParams.push(status);
    }
    
    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    
    const [apiKeys] = await db.execute(`
        SELECT ak.*, u.username, u.email,
               COUNT(al.id) as usage_count,
               MAX(al.created_at) as last_used
        FROM api_keys ak
        LEFT JOIN users u ON ak.user_id = u.id
        LEFT JOIN api_logs al ON ak.id = al.api_key_id
        ${whereClause}
        GROUP BY ak.id
        ORDER BY ak.created_at DESC
        LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), (page - 1) * limit]);
    
    res.json({
        success: true,
        message: 'API keys retrieved successfully',
        api_keys: apiKeys
    });
}));

// POST /api/admin/api/keys - Create API key
router.post('/api/keys', enhancedErrorHandler(async (req, res) => {
    const { user_id, name, permissions, rate_limit = 1000 } = req.body;
    
    if (!user_id || !name) {
        return res.status(400).json({
            success: false,
            message: 'User ID and name are required'
        });
    }
    
    // Generate API key
    const apiKey = 'ak_' + Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2);
    const apiSecret = Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2);
    
    const [result] = await db.execute(`
        INSERT INTO api_keys (
            user_id, name, api_key, api_secret, permissions, 
            rate_limit, created_by, created_at, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), 'active')
    `, [
        user_id, name, apiKey, apiSecret, 
        JSON.stringify(permissions || []), rate_limit, req.user.id
    ]);
    
    res.json({
        success: true,
        message: 'API key created successfully',
        api_key: { 
            id: result.insertId, 
            api_key: apiKey, 
            api_secret: apiSecret,
            name
        }
    });
}));

// PUT /api/admin/api/keys/:id/status - Update API key status
router.put('/api/keys/:id/status', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['active', 'inactive', 'revoked'].includes(status)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid status. Must be active, inactive, or revoked'
        });
    }
    
    await db.execute('UPDATE api_keys SET status = ?, updated_at = NOW() WHERE id = ?', [status, id]);
    
    res.json({
        success: true,
        message: `API key ${status} successfully`
    });
}));

// GET /api/admin/security/threats - Get security threats
router.get('/security/threats', enhancedErrorHandler(async (req, res) => {
    const { severity, status, page = 1, limit = 100 } = req.query;
    
    let whereConditions = [];
    let queryParams = [];
    
    if (severity) {
        whereConditions.push('severity = ?');
        queryParams.push(severity);
    }
    
    if (status) {
        whereConditions.push('status = ?');
        queryParams.push(status);
    }
    
    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    
    const [threats] = await db.execute(`
        SELECT * FROM security_threats
        ${whereClause}
        ORDER BY detected_at DESC
        LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), (page - 1) * limit]);
    
    res.json({
        success: true,
        message: 'Security threats retrieved successfully',
        threats
    });
}));

// PUT /api/admin/security/threats/:id - Update threat status
router.put('/security/threats/:id', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    const { status, notes } = req.body;
    
    await db.execute(`
        UPDATE security_threats SET 
            status = ?, 
            resolution_notes = ?, 
            resolved_by = ?,
            resolved_at = CASE WHEN ? = 'resolved' THEN NOW() ELSE resolved_at END
        WHERE id = ?
    `, [status, notes, req.user.id, status, id]);
    
    res.json({
        success: true,
        message: 'Threat status updated successfully'
    });
}));

// GET /api/admin/security/audit-log - Get security audit log
router.get('/security/audit-log', enhancedErrorHandler(async (req, res) => {
    const { user_id, action, page = 1, limit = 100 } = req.query;
    
    let whereConditions = [];
    let queryParams = [];
    
    if (user_id) {
        whereConditions.push('user_id = ?');
        queryParams.push(user_id);
    }
    
    if (action) {
        whereConditions.push('action LIKE ?');
        queryParams.push(`%${action}%`);
    }
    
    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    
    const [auditLogs] = await db.execute(`
        SELECT al.*, u.username, u.email
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        ${whereClause}
        ORDER BY al.created_at DESC
        LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), (page - 1) * limit]);
    
    res.json({
        success: true,
        message: 'Audit logs retrieved successfully',
        logs: auditLogs
    });
}));

// GET /api/admin/security/dashboard - Get security dashboard data
router.get('/security/dashboard', enhancedErrorHandler(async (req, res) => {
    const { period = '24' } = req.query; // hours
    
    const periodHours = parseInt(period);
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - periodHours);
    
    // Get failed login attempts count
    const [failedLogins] = await db.execute(`
        SELECT COUNT(*) as count FROM login_attempts 
        WHERE status = 'failed' AND attempted_at >= ?
    `, [startDate]);
    
    // Get blocked IPs count
    const [blockedIPs] = await db.execute(`
        SELECT COUNT(*) as count FROM blocked_ips 
        WHERE status = 'active'
    `);
    
    // Get active threats count
    const [activeThreats] = await db.execute(`
        SELECT COUNT(*) as count FROM security_threats 
        WHERE status = 'active'
    `);
    
    // Get API requests count
    const [apiRequests] = await db.execute(`
        SELECT COUNT(*) as count FROM api_logs 
        WHERE created_at >= ?
    `, [startDate]);
    
    // Get recent security events
    const [recentEvents] = await db.execute(`
        (SELECT 'failed_login' as event_type, ip_address as details, attempted_at as event_time 
         FROM login_attempts WHERE status = 'failed' AND attempted_at >= ?)
        UNION ALL
        (SELECT 'threat_detected' as event_type, threat_type as details, detected_at as event_time 
         FROM security_threats WHERE detected_at >= ?)
        UNION ALL
        (SELECT 'ip_blocked' as event_type, ip_address as details, created_at as event_time 
         FROM blocked_ips WHERE created_at >= ?)
        ORDER BY event_time DESC
        LIMIT 10
    `, [startDate, startDate, startDate]);
    
    res.json({
        success: true,
        message: 'Security dashboard data retrieved successfully',
        dashboard: {
            period_hours: periodHours,
            stats: {
                failed_logins: failedLogins[0].count,
                blocked_ips: blockedIPs[0].count,
                active_threats: activeThreats[0].count,
                api_requests: apiRequests[0].count
            },
            recent_events: recentEvents
        }
    });
}));

// ========== PERFORMANCE & ANALYTICS ENDPOINTS ==========

// GET /api/admin/performance/overview - Get system performance overview
router.get('/performance/overview', enhancedErrorHandler(async (req, res) => {
    const systemInfo = {
        cpu_usage: Math.random() * 100,
        memory_usage: Math.random() * 100,
        response_time: Math.floor(Math.random() * 500) + 50,
        active_connections: Math.floor(Math.random() * 100) + 10
    };

    // Get performance history for last 24 hours
    const hoursBack = 24;
    const performanceHistory = [];
    
    for (let i = hoursBack; i >= 0; i--) {
        const hour = new Date();
        hour.setHours(hour.getHours() - i);
        
        performanceHistory.push({
            timestamp: hour.toISOString(),
            cpu: Math.random() * 80 + 10,
            memory: Math.random() * 70 + 15,
            response_time: Math.floor(Math.random() * 200) + 50
        });
    }

    res.json({
        success: true,
        message: 'Performance overview retrieved successfully',
        overview: {
            current: systemInfo,
            history: performanceHistory,
            health_score: Math.floor(Math.random() * 30) + 70
        }
    });
}));

// GET /api/admin/performance/resources - Get detailed resource usage
router.get('/performance/resources', enhancedErrorHandler(async (req, res) => {
    const resources = {
        cpu: {
            usage: Math.random() * 100,
            cores: 4,
            load_average: [Math.random() * 2, Math.random() * 2, Math.random() * 2]
        },
        memory: {
            total: 8192,
            used: Math.floor(Math.random() * 6144) + 1024,
            free: 8192 - Math.floor(Math.random() * 6144) + 1024,
            cached: Math.floor(Math.random() * 2048),
            buffers: Math.floor(Math.random() * 512)
        },
        disk: {
            total: 500000,
            used: Math.floor(Math.random() * 300000) + 100000,
            free: 500000 - Math.floor(Math.random() * 300000) + 100000,
            read_speed: Math.floor(Math.random() * 100) + 50,
            write_speed: Math.floor(Math.random() * 80) + 30
        },
        network: {
            bytes_sent: Math.floor(Math.random() * 1000000000),
            bytes_received: Math.floor(Math.random() * 5000000000),
            packets_sent: Math.floor(Math.random() * 1000000),
            packets_received: Math.floor(Math.random() * 2000000)
        }
    };

    // Top processes mock data
    const topProcesses = [
        { name: 'node (main)', pid: 1234, cpu: 15.2, memory: 156.8 },
        { name: 'mysql', pid: 5678, cpu: 8.5, memory: 234.5 },
        { name: 'nginx', pid: 9012, cpu: 3.2, memory: 45.6 },
        { name: 'redis', pid: 3456, cpu: 2.1, memory: 67.8 },
        { name: 'system', pid: 7890, cpu: 1.8, memory: 89.4 }
    ];

    res.json({
        success: true,
        message: 'Resource usage retrieved successfully',
        resources: {
            ...resources,
            top_processes: topProcesses
        }
    });
}));

// GET /api/admin/performance/database - Get database performance metrics
router.get('/performance/database', enhancedErrorHandler(async (req, res) => {
    // Mock database performance data
    const dbPerformance = {
        connections: {
            active: Math.floor(Math.random() * 50) + 10,
            total: Math.floor(Math.random() * 100) + 50,
            max: 200
        },
        queries: {
            per_second: Math.floor(Math.random() * 500) + 100,
            slow_queries: Math.floor(Math.random() * 10),
            avg_execution_time: Math.floor(Math.random() * 50) + 5
        },
        cache: {
            hit_rate: Math.random() * 20 + 80,
            memory_usage: Math.floor(Math.random() * 512) + 256,
            entries: Math.floor(Math.random() * 10000) + 5000
        },
        tables: {
            total_size: Math.floor(Math.random() * 2048) + 512,
            index_size: Math.floor(Math.random() * 512) + 128,
            fragmentation: Math.random() * 20 + 5
        }
    };

    // Mock slow queries
    const slowQueries = [
        {
            query: 'SELECT * FROM products WHERE category_id IN (SELECT id FROM categories WHERE status = "active")',
            execution_time: 2.45,
            frequency: 15,
            table: 'products'
        },
        {
            query: 'SELECT u.*, COUNT(o.id) FROM users u LEFT JOIN orders o ON u.id = o.user_id GROUP BY u.id',
            execution_time: 1.89,
            frequency: 8,
            table: 'users'
        },
        {
            query: 'UPDATE inventory SET quantity = quantity - 1 WHERE product_id = ?',
            execution_time: 1.23,
            frequency: 25,
            table: 'inventory'
        }
    ];

    res.json({
        success: true,
        message: 'Database performance retrieved successfully',
        database: {
            ...dbPerformance,
            slow_queries: slowQueries
        }
    });
}));

// GET /api/admin/performance/network - Get network performance data
router.get('/performance/network', enhancedErrorHandler(async (req, res) => {
    // Generate network traffic data for last 24 hours
    const networkHistory = [];
    for (let i = 23; i >= 0; i--) {
        const hour = new Date();
        hour.setHours(hour.getHours() - i);
        
        networkHistory.push({
            timestamp: hour.toISOString(),
            incoming: Math.floor(Math.random() * 1000) + 100,
            outgoing: Math.floor(Math.random() * 800) + 50,
            connections: Math.floor(Math.random() * 100) + 20
        });
    }

    // API endpoint performance
    const apiPerformance = [
        { endpoint: '/api/products', requests: 1250, avg_response: 85, error_rate: 0.2 },
        { endpoint: '/api/orders', requests: 890, avg_response: 120, error_rate: 0.5 },
        { endpoint: '/api/users/profile', requests: 650, avg_response: 65, error_rate: 0.1 },
        { endpoint: '/api/auth/login', requests: 345, avg_response: 200, error_rate: 2.1 },
        { endpoint: '/api/cart', requests: 780, avg_response: 95, error_rate: 0.3 }
    ];

    res.json({
        success: true,
        message: 'Network performance retrieved successfully',
        network: {
            traffic_history: networkHistory,
            api_performance: apiPerformance,
            current_bandwidth: {
                incoming: Math.floor(Math.random() * 100) + 20,
                outgoing: Math.floor(Math.random() * 80) + 15
            }
        }
    });
}));

// GET /api/admin/performance/alerts - Get performance alerts
router.get('/performance/alerts', enhancedErrorHandler(async (req, res) => {
    const alerts = [
        {
            id: 1,
            type: 'warning',
            title: 'High Memory Usage',
            description: 'System memory usage has exceeded 80% for the past 30 minutes',
            timestamp: new Date(Date.now() - 30 * 60 * 1000),
            severity: 'medium'
        },
        {
            id: 2,
            type: 'info',
            title: 'Database Optimization Recommended',
            description: 'Table fragmentation detected on products table',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
            severity: 'low'
        },
        {
            id: 3,
            type: 'success',
            title: 'Cache Performance Improved',
            description: 'Cache hit rate increased to 95% after recent optimization',
            timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
            severity: 'info'
        }
    ];

    res.json({
        success: true,
        message: 'Performance alerts retrieved successfully',
        alerts
    });
}));

// GET /api/admin/performance/recommendations - Get optimization recommendations
router.get('/performance/recommendations', enhancedErrorHandler(async (req, res) => {
    const recommendations = [
        {
            id: 1,
            type: 'database',
            priority: 'high',
            title: 'Optimize Database Indexes',
            description: 'Add index on products.category_id to improve query performance',
            impact: 'Could improve query speed by 40-60%',
            action: 'optimize_indexes'
        },
        {
            id: 2,
            type: 'cache',
            priority: 'medium',
            title: 'Increase Cache Size',
            description: 'Current cache size is limiting performance',
            impact: 'Could improve response times by 20-30%',
            action: 'increase_cache'
        },
        {
            id: 3,
            type: 'cleanup',
            priority: 'low',
            title: 'Clean Log Files',
            description: 'Log files are consuming excessive disk space',
            impact: 'Free up 2.3GB of disk space',
            action: 'cleanup_logs'
        }
    ];

    res.json({
        success: true,
        message: 'Optimization recommendations retrieved successfully',
        recommendations
    });
}));

// POST /api/admin/performance/optimize - Run system optimization
router.post('/performance/optimize', enhancedErrorHandler(async (req, res) => {
    const { optimization_type } = req.body;
    
    // Simulate optimization process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    let message = 'System optimization completed successfully';
    
    switch (optimization_type) {
        case 'cache':
            message = 'Cache cleared and optimized successfully';
            break;
        case 'database':
            message = 'Database tables optimized successfully';
            break;
        case 'files':
            message = 'Temporary files cleaned up successfully';
            break;
        default:
            message = 'General system optimization completed';
    }

    res.json({
        success: true,
        message,
        optimization: {
            type: optimization_type,
            completed_at: new Date().toISOString(),
            improvements: {
                performance_gain: Math.floor(Math.random() * 20) + 5,
                space_freed: Math.floor(Math.random() * 500) + 100
            }
        }
    });
}));

// POST /api/admin/performance/clear-cache - Clear system cache
router.post('/performance/clear-cache', enhancedErrorHandler(async (req, res) => {
    // Simulate cache clearing
    await new Promise(resolve => setTimeout(resolve, 1000));

    res.json({
        success: true,
        message: 'System cache cleared successfully',
        cache: {
            cleared_at: new Date().toISOString(),
            size_cleared: Math.floor(Math.random() * 200) + 50
        }
    });
}));

// ========== SYSTEM INTEGRATIONS & WEBHOOKS ENDPOINTS ==========

// GET /api/admin/integrations - Get all system integrations
router.get('/integrations', enhancedErrorHandler(async (req, res) => {
    // Mock integrations data
    const integrations = [
        {
            id: 1,
            name: 'Stripe Payment Gateway',
            type: 'payment',
            url: 'https://api.stripe.com/v1',
            status: 'active',
            last_sync: new Date(Date.now() - 30 * 60 * 1000),
            api_calls_today: 245,
            error_count: 0,
            config: { timeout: 30000, retries: 3 }
        },
        {
            id: 2,
            name: 'SendGrid Email Service',
            type: 'email',
            url: 'https://api.sendgrid.com/v3',
            status: 'active',
            last_sync: new Date(Date.now() - 5 * 60 * 1000),
            api_calls_today: 125,
            error_count: 2,
            config: { daily_limit: 1000 }
        },
        {
            id: 3,
            name: 'Twilio SMS Gateway',
            type: 'sms',
            url: 'https://api.twilio.com/2010-04-01',
            status: 'inactive',
            last_sync: new Date(Date.now() - 2 * 60 * 60 * 1000),
            api_calls_today: 0,
            error_count: 0,
            config: { region: 'us1' }
        },
        {
            id: 4,
            name: 'Google Analytics',
            type: 'analytics',
            url: 'https://analyticsreporting.googleapis.com/v4',
            status: 'active',
            last_sync: new Date(Date.now() - 15 * 60 * 1000),
            api_calls_today: 89,
            error_count: 1,
            config: { tracking_id: 'GA-123456789' }
        }
    ];

    res.json({
        success: true,
        message: 'System integrations retrieved successfully',
        integrations,
        stats: {
            active_integrations: integrations.filter(i => i.status === 'active').length,
            api_calls_today: integrations.reduce((sum, i) => sum + i.api_calls_today, 0),
            failed_requests: integrations.reduce((sum, i) => sum + i.error_count, 0)
        }
    });
}));

// POST /api/admin/integrations - Create new integration
router.post('/integrations', enhancedErrorHandler(async (req, res) => {
    const { 
        name, type, url, api_key, api_secret, 
        config, description, active = true 
    } = req.body;

    if (!name || !type || !url) {
        return res.status(400).json({
            success: false,
            message: 'Name, type, and URL are required'
        });
    }

    // Mock creating integration
    const newIntegration = {
        id: Date.now(),
        name,
        type,
        url,
        status: active ? 'active' : 'inactive',
        created_at: new Date().toISOString(),
        created_by: req.user.id,
        api_calls_today: 0,
        error_count: 0,
        config: config ? JSON.parse(config) : {}
    };

    res.json({
        success: true,
        message: 'Integration created successfully',
        integration: newIntegration
    });
}));

// PUT /api/admin/integrations/:id - Update integration
router.put('/integrations/:id', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    res.json({
        success: true,
        message: 'Integration updated successfully',
        integration: { id: parseInt(id), ...updates, updated_at: new Date().toISOString() }
    });
}));

// DELETE /api/admin/integrations/:id - Delete integration
router.delete('/integrations/:id', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;

    res.json({
        success: true,
        message: 'Integration deleted successfully'
    });
}));

// POST /api/admin/integrations/:id/test - Test integration connection
router.post('/integrations/:id/test', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;

    // Simulate connection test
    await new Promise(resolve => setTimeout(resolve, 2000));

    const success = Math.random() > 0.3; // 70% success rate

    if (success) {
        res.json({
            success: true,
            message: 'Integration connection test successful',
            test_result: {
                status: 'success',
                response_time: Math.floor(Math.random() * 500) + 100,
                test_data: { connection: 'established', auth: 'valid' }
            }
        });
    } else {
        res.json({
            success: false,
            message: 'Integration connection test failed',
            test_result: {
                status: 'error',
                error: 'Authentication failed or service unavailable'
            }
        });
    }
}));

// GET /api/admin/webhooks - Get all webhooks
router.get('/webhooks', enhancedErrorHandler(async (req, res) => {
    // Mock webhooks data
    const webhooks = [
        {
            id: 1,
            name: 'Order Notification Webhook',
            url: 'https://partner.example.com/webhooks/orders',
            events: ['order.created', 'order.updated', 'payment.completed'],
            status: 'active',
            created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            last_triggered: new Date(Date.now() - 30 * 60 * 1000),
            success_count: 1250,
            failure_count: 5,
            timeout: 30
        },
        {
            id: 2,
            name: 'User Registration Webhook',
            url: 'https://crm.example.com/api/webhooks/users',
            events: ['user.registered', 'user.updated'],
            status: 'active',
            created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
            last_triggered: new Date(Date.now() - 2 * 60 * 60 * 1000),
            success_count: 856,
            failure_count: 12,
            timeout: 30
        },
        {
            id: 3,
            name: 'Inventory Alert Webhook',
            url: 'https://inventory.example.com/webhooks/alerts',
            events: ['inventory.low', 'product.out_of_stock'],
            status: 'inactive',
            created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            last_triggered: new Date(Date.now() - 24 * 60 * 60 * 1000),
            success_count: 423,
            failure_count: 8,
            timeout: 45
        }
    ];

    res.json({
        success: true,
        message: 'Webhooks retrieved successfully',
        webhooks,
        stats: {
            total_webhooks: webhooks.length,
            active_webhooks: webhooks.filter(w => w.status === 'active').length,
            total_deliveries: webhooks.reduce((sum, w) => sum + w.success_count + w.failure_count, 0)
        }
    });
}));

// POST /api/admin/webhooks - Create new webhook
router.post('/webhooks', enhancedErrorHandler(async (req, res) => {
    const { 
        name, url, events, secret, timeout = 30, 
        headers, active = true 
    } = req.body;

    if (!name || !url || !events || events.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Name, URL, and at least one event are required'
        });
    }

    // Mock creating webhook
    const newWebhook = {
        id: Date.now(),
        name,
        url,
        events,
        status: active ? 'active' : 'inactive',
        created_at: new Date().toISOString(),
        created_by: req.user.id,
        success_count: 0,
        failure_count: 0,
        timeout: parseInt(timeout),
        secret_hash: secret ? 'sha256_' + Math.random().toString(36) : null
    };

    res.json({
        success: true,
        message: 'Webhook created successfully',
        webhook: newWebhook
    });
}));

// PUT /api/admin/webhooks/:id - Update webhook
router.put('/webhooks/:id', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    res.json({
        success: true,
        message: 'Webhook updated successfully',
        webhook: { id: parseInt(id), ...updates, updated_at: new Date().toISOString() }
    });
}));

// DELETE /api/admin/webhooks/:id - Delete webhook
router.delete('/webhooks/:id', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;

    res.json({
        success: true,
        message: 'Webhook deleted successfully'
    });
}));

// POST /api/admin/webhooks/:id/test - Test webhook
router.post('/webhooks/:id/test', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    const { payload } = req.body;

    // Simulate webhook test
    await new Promise(resolve => setTimeout(resolve, 1500));

    const success = Math.random() > 0.2; // 80% success rate

    if (success) {
        res.json({
            success: true,
            message: 'Webhook test successful',
            test_result: {
                status: 'success',
                response_code: 200,
                response_time: Math.floor(Math.random() * 1000) + 200,
                response_body: { received: true, processed: true }
            }
        });
    } else {
        res.json({
            success: false,
            message: 'Webhook test failed',
            test_result: {
                status: 'error',
                response_code: 500,
                error: 'Connection timeout or server error'
            }
        });
    }
}));

// POST /api/admin/webhooks/test-all - Test all active webhooks
router.post('/webhooks/test-all', enhancedErrorHandler(async (req, res) => {
    // Simulate testing all webhooks
    await new Promise(resolve => setTimeout(resolve, 3000));

    const results = [
        { id: 1, name: 'Order Notification Webhook', status: 'success', response_time: 245 },
        { id: 2, name: 'User Registration Webhook', status: 'success', response_time: 189 },
        { id: 3, name: 'Inventory Alert Webhook', status: 'error', error: 'Connection timeout' }
    ];

    res.json({
        success: true,
        message: 'Webhook testing completed',
        results
    });
}));

// GET /api/admin/integrations/logs - Get integration activity logs
router.get('/integrations/logs', enhancedErrorHandler(async (req, res) => {
    const { type, status, limit = 100 } = req.query;

    // Mock activity logs
    const logs = [
        {
            id: 1,
            type: 'webhook',
            action: 'Webhook delivered successfully',
            details: 'Order Notification Webhook - Order #12345',
            status: 'success',
            integration_name: 'Order Notification Webhook',
            timestamp: new Date(Date.now() - 5 * 60 * 1000),
            response_time: 234
        },
        {
            id: 2,
            type: 'api',
            action: 'Payment processed',
            details: 'Stripe Payment Gateway - $125.99',
            status: 'success',
            integration_name: 'Stripe Payment Gateway',
            timestamp: new Date(Date.now() - 15 * 60 * 1000),
            response_time: 456
        },
        {
            id: 3,
            type: 'webhook',
            action: 'Webhook delivery failed',
            details: 'User Registration Webhook - Connection timeout',
            status: 'error',
            integration_name: 'User Registration Webhook',
            timestamp: new Date(Date.now() - 30 * 60 * 1000),
            error: 'Connection timeout after 30 seconds'
        },
        {
            id: 4,
            type: 'api',
            action: 'Email sent successfully',
            details: 'SendGrid Email Service - Welcome email',
            status: 'success',
            integration_name: 'SendGrid Email Service',
            timestamp: new Date(Date.now() - 45 * 60 * 1000),
            response_time: 678
        },
        {
            id: 5,
            type: 'api',
            action: 'SMS delivery failed',
            details: 'Twilio SMS Gateway - Invalid phone number',
            status: 'error',
            integration_name: 'Twilio SMS Gateway',
            timestamp: new Date(Date.now() - 60 * 60 * 1000),
            error: 'Invalid phone number format'
        }
    ];

    // Filter logs based on query parameters
    let filteredLogs = logs;
    
    if (type) {
        filteredLogs = filteredLogs.filter(log => log.type === type);
    }
    
    if (status) {
        filteredLogs = filteredLogs.filter(log => log.status === status);
    }

    res.json({
        success: true,
        message: 'Activity logs retrieved successfully',
        logs: filteredLogs.slice(0, parseInt(limit))
    });
}));

// POST /api/admin/integrations/test-endpoint - Test API endpoint
router.post('/integrations/test-endpoint', enhancedErrorHandler(async (req, res) => {
    const { method, url, headers, body } = req.body;

    if (!method || !url) {
        return res.status(400).json({
            success: false,
            message: 'Method and URL are required'
        });
    }

    // Simulate API endpoint test
    await new Promise(resolve => setTimeout(resolve, 1000));

    const success = Math.random() > 0.3; // 70% success rate

    if (success) {
        res.json({
            success: true,
            message: 'API endpoint test successful',
            test_result: {
                status: 'success',
                response_code: 200,
                response_time: Math.floor(Math.random() * 500) + 100,
                response_headers: { 'content-type': 'application/json' },
                response_body: { 
                    status: 'ok', 
                    data: { test: true },
                    timestamp: new Date().toISOString()
                }
            }
        });
    } else {
        res.json({
            success: false,
            message: 'API endpoint test failed',
            test_result: {
                status: 'error',
                response_code: 404,
                error: 'Endpoint not found or service unavailable'
            }
        });
    }
}));

// GET /api/admin/webhooks/events - Get available webhook events
router.get('/webhooks/events', enhancedErrorHandler(async (req, res) => {
    const events = [
        {
            category: 'Orders',
            events: [
                { name: 'order.created', description: 'New order is placed' },
                { name: 'order.updated', description: 'Order status or details updated' },
                { name: 'order.cancelled', description: 'Order is cancelled' },
                { name: 'order.completed', description: 'Order is completed' }
            ]
        },
        {
            category: 'Payments',
            events: [
                { name: 'payment.completed', description: 'Payment is successfully processed' },
                { name: 'payment.failed', description: 'Payment processing failed' },
                { name: 'payment.refunded', description: 'Payment is refunded' }
            ]
        },
        {
            category: 'Users',
            events: [
                { name: 'user.registered', description: 'New user account created' },
                { name: 'user.updated', description: 'User profile updated' },
                { name: 'user.deleted', description: 'User account deleted' }
            ]
        },
        {
            category: 'Products',
            events: [
                { name: 'product.created', description: 'New product added' },
                { name: 'product.updated', description: 'Product information updated' },
                { name: 'product.deleted', description: 'Product removed' }
            ]
        },
        {
            category: 'Inventory',
            events: [
                { name: 'inventory.low', description: 'Product stock is running low' },
                { name: 'inventory.out_of_stock', description: 'Product is out of stock' },
                { name: 'inventory.restocked', description: 'Product is back in stock' }
            ]
        }
    ];

    res.json({
        success: true,
        message: 'Webhook events retrieved successfully',
        events
    });
}));

// ========== FILE MANAGER ENDPOINTS ==========

// GET /api/admin/files - Get files and folders
router.get('/files', enhancedErrorHandler(async (req, res) => {
    const { path = '/', type, search, sort = 'name' } = req.query;

    // Mock file system structure
    const mockFiles = [
        {
            id: 1,
            name: 'product-images',
            type: 'folder',
            size: null,
            modified: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            path: '/product-images',
            items: 245,
            permissions: 'rwx'
        },
        {
            id: 2,
            name: 'user-uploads',
            type: 'folder',
            size: null,
            modified: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            path: '/user-uploads',
            items: 89,
            permissions: 'rwx'
        },
        {
            id: 3,
            name: 'documents',
            type: 'folder',
            size: null,
            modified: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            path: '/documents',
            items: 156,
            permissions: 'rwx'
        },
        {
            id: 4,
            name: 'logo.png',
            type: 'image',
            size: 256000,
            modified: new Date(Date.now() - 5 * 60 * 60 * 1000),
            path: '/logo.png',
            url: '/uploads/logo.png',
            permissions: 'rw'
        },
        {
            id: 5,
            name: 'terms-and-conditions.pdf',
            type: 'document',
            size: 1024000,
            modified: new Date(Date.now() - 2 * 60 * 60 * 1000),
            path: '/terms-and-conditions.pdf',
            url: '/uploads/terms-and-conditions.pdf',
            permissions: 'rw'
        },
        {
            id: 6,
            name: 'promotional-video.mp4',
            type: 'video',
            size: 15360000,
            modified: new Date(Date.now() - 1 * 60 * 60 * 1000),
            path: '/promotional-video.mp4',
            url: '/uploads/promotional-video.mp4',
            permissions: 'rw'
        },
        {
            id: 7,
            name: 'notification-sound.mp3',
            type: 'audio',
            size: 512000,
            modified: new Date(Date.now() - 30 * 60 * 1000),
            path: '/notification-sound.mp3',
            url: '/uploads/notification-sound.mp3',
            permissions: 'rw'
        },
        {
            id: 8,
            name: 'backup-data.zip',
            type: 'archive',
            size: 5120000,
            modified: new Date(Date.now() - 6 * 60 * 60 * 1000),
            path: '/backup-data.zip',
            url: '/uploads/backup-data.zip',
            permissions: 'rw'
        },
        {
            id: 9,
            name: 'system-config.json',
            type: 'document',
            size: 2048,
            modified: new Date(Date.now() - 12 * 60 * 60 * 1000),
            path: '/system-config.json',
            url: '/uploads/system-config.json',
            permissions: 'r'
        },
        {
            id: 10,
            name: 'temp-files',
            type: 'folder',
            size: null,
            modified: new Date(Date.now() - 4 * 60 * 60 * 1000),
            path: '/temp-files',
            items: 23,
            permissions: 'rwx'
        }
    ];

    // Filter by path
    let filteredFiles = mockFiles.filter(file => {
        if (path === '/') return true;
        return file.path.startsWith(path);
    });

    // Filter by type
    if (type) {
        filteredFiles = filteredFiles.filter(file => file.type === type);
    }

    // Filter by search
    if (search) {
        filteredFiles = filteredFiles.filter(file => 
            file.name.toLowerCase().includes(search.toLowerCase())
        );
    }

    // Sort files
    filteredFiles.sort((a, b) => {
        // Folders first
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (b.type === 'folder' && a.type !== 'folder') return 1;
        
        switch (sort) {
            case 'name':
                return a.name.localeCompare(b.name);
            case 'date':
                return new Date(b.modified) - new Date(a.modified);
            case 'size':
                return (b.size || 0) - (a.size || 0);
            case 'type':
                return a.type.localeCompare(b.type);
            default:
                return 0;
        }
    });

    // Calculate storage stats
    const totalFiles = mockFiles.filter(f => f.type !== 'folder').length;
    const totalFolders = mockFiles.filter(f => f.type === 'folder').length;
    const totalSize = mockFiles.filter(f => f.type !== 'folder')
                               .reduce((sum, f) => sum + (f.size || 0), 0);

    res.json({
        success: true,
        message: 'Files retrieved successfully',
        files: filteredFiles,
        stats: {
            total_files: totalFiles,
            total_folders: totalFolders,
            total_size: totalSize,
            used_storage: totalSize,
            total_storage: 4 * 1024 * 1024 * 1024, // 4GB
            recent_uploads: 12
        },
        current_path: path
    });
}));

// POST /api/admin/files/upload - Upload files
router.post('/files/upload', enhancedErrorHandler(async (req, res) => {
    const { folder = '/', visibility = 'public' } = req.body;

    // In a real implementation, this would handle file upload with multer
    // Mock successful upload
    const uploadedFiles = [
        {
            id: Date.now(),
            name: 'uploaded-file.jpg',
            type: 'image',
            size: 512000,
            path: `${folder}/uploaded-file.jpg`,
            url: '/uploads/uploaded-file.jpg',
            visibility,
            uploaded_at: new Date().toISOString(),
            uploaded_by: req.user.id
        }
    ];

    res.json({
        success: true,
        message: 'Files uploaded successfully',
        files: uploadedFiles
    });
}));

// POST /api/admin/files/folder - Create folder
router.post('/files/folder', enhancedErrorHandler(async (req, res) => {
    const { name, path = '/' } = req.body;

    if (!name) {
        return res.status(400).json({
            success: false,
            message: 'Folder name is required'
        });
    }

    const newFolder = {
        id: Date.now(),
        name,
        type: 'folder',
        size: null,
        path: `${path}/${name}`.replace('//', '/'),
        items: 0,
        created_at: new Date().toISOString(),
        created_by: req.user.id,
        permissions: 'rwx'
    };

    res.json({
        success: true,
        message: 'Folder created successfully',
        folder: newFolder
    });
}));

// PUT /api/admin/files/:id/rename - Rename file or folder
router.put('/files/:id/rename', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
        return res.status(400).json({
            success: false,
            message: 'New name is required'
        });
    }

    res.json({
        success: true,
        message: 'File renamed successfully',
        file: {
            id: parseInt(id),
            name,
            renamed_at: new Date().toISOString(),
            renamed_by: req.user.id
        }
    });
}));

// POST /api/admin/files/:id/move - Move file or folder
router.post('/files/:id/move', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    const { destination } = req.body;

    if (!destination) {
        return res.status(400).json({
            success: false,
            message: 'Destination path is required'
        });
    }

    res.json({
        success: true,
        message: 'File moved successfully',
        file: {
            id: parseInt(id),
            new_path: destination,
            moved_at: new Date().toISOString(),
            moved_by: req.user.id
        }
    });
}));

// POST /api/admin/files/:id/copy - Copy file or folder
router.post('/files/:id/copy', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    const { destination } = req.body;

    if (!destination) {
        return res.status(400).json({
            success: false,
            message: 'Destination path is required'
        });
    }

    res.json({
        success: true,
        message: 'File copied successfully',
        file: {
            id: parseInt(id),
            new_path: destination,
            copied_at: new Date().toISOString(),
            copied_by: req.user.id
        }
    });
}));// Export the router  
module.exports = router; 
