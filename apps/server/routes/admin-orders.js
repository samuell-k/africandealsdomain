/**
 * Admin Orders Management API Routes
 * Handles order-related operations for admin dashboard
 */

const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');

// Database connection
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'african_deals_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

// Middleware to verify admin authentication
const verifyAdminAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'No token provided' });
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        
        // Verify user is admin
        const userId = decoded.id || decoded.userId;
        const [users] = await pool.execute(
            'SELECT id, email, role FROM users WHERE id = ? AND role = "admin"',
            [userId]
        );

        if (users.length === 0) {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }

        req.user = users[0];
        next();
    } catch (error) {
        console.error('❌ Admin auth verification failed:', error);
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

// Get active orders for admin dashboard
router.get('/active', verifyAdminAuth, async (req, res) => {
    try {
        console.log('📋 Admin fetching active orders...');
        
        const [orders] = await pool.execute(`
            SELECT 
                o.id,
                o.order_number,
                o.total_amount,
                o.status,
                o.payment_status,
                o.payment_method,
                o.created_at,
                o.updated_at,
                u.name as buyer_name,
                u.email as buyer_email,
                COUNT(oi.id) as item_count
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN order_items oi ON o.id = oi.order_id
            WHERE o.status IN ('pending', 'processing', 'shipped', 'confirmed')
            GROUP BY o.id
            ORDER BY o.created_at DESC
            LIMIT 20
        `);

        console.log(`✅ Found ${orders.length} active orders`);

        res.json({
            success: true,
            orders: orders,
            total: orders.length
        });

    } catch (error) {
        console.error('❌ Error fetching active orders:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch active orders',
            error: error.message
        });
    }
});

// Get all orders with pagination and filtering
router.get('/all', verifyAdminAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const status = req.query.status;
        const search = req.query.search;

        console.log(`📋 Admin fetching orders - Page: ${page}, Limit: ${limit}, Status: ${status || 'all'}`);

        let whereClause = 'WHERE 1=1';
        let queryParams = [];

        if (status && status !== 'all') {
            whereClause += ' AND o.status = ?';
            queryParams.push(status);
        }

        if (search) {
            whereClause += ' AND (u.name LIKE ? OR u.email LIKE ? OR o.id LIKE ?)';
            const searchTerm = `%${search}%`;
            queryParams.push(searchTerm, searchTerm, searchTerm);
        }

        const [orders] = await pool.execute(`
            SELECT 
                o.id,
                o.order_number,
                o.total_amount,
                o.status,
                o.payment_status,
                o.payment_method,
                o.created_at,
                o.updated_at,
                o.shipping_address,
                u.name as buyer_name,
                u.email as buyer_email,
                u.phone as buyer_phone,
                COUNT(oi.id) as item_count
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN order_items oi ON o.id = oi.order_id
            ${whereClause}
            GROUP BY o.id
            ORDER BY o.created_at DESC
            LIMIT ? OFFSET ?
        `, [...queryParams, limit, offset]);

        // Get total count
        const [countResult] = await pool.execute(`
            SELECT COUNT(DISTINCT o.id) as total
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            ${whereClause}
        `, queryParams);

        const total = countResult[0].total;

        console.log(`✅ Found ${orders.length} orders (${total} total)`);

        res.json({
            success: true,
            orders: orders,
            pagination: {
                page: page,
                limit: limit,
                total: total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('❌ Error fetching orders:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch orders',
            error: error.message
        });
    }
});

// Get order details by ID
router.get('/:orderId', verifyAdminAuth, async (req, res) => {
    try {
        const orderId = req.params.orderId;
        console.log(`📋 Admin fetching order details: ${orderId}`);

        const [orders] = await pool.execute(`
            SELECT 
                o.*,
                u.name as buyer_name,
                u.email as buyer_email,
                u.phone as buyer_phone
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            WHERE o.id = ?
        `, [orderId]);

        if (orders.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        const order = orders[0];

        // Get order items
        const [items] = await pool.execute(`
            SELECT 
                oi.*,
                p.name as product_name,
                COALESCE(
                  p.main_image,
                  (SELECT image_url FROM product_images WHERE product_id = p.id AND is_main = TRUE ORDER BY id LIMIT 1),
                  (SELECT image_url FROM product_images WHERE product_id = p.id ORDER BY sort_order, id LIMIT 1)
                ) as product_image
            FROM order_items oi
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
        `, [orderId]);

        order.items = items;

        console.log(`✅ Order details loaded: ${orderId}`);

        res.json({
            success: true,
            order: order
        });

    } catch (error) {
        console.error('❌ Error fetching order details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch order details',
            error: error.message
        });
    }
});

// Update order status
router.put('/:orderId/status', verifyAdminAuth, async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const { status, notes } = req.body;

        console.log(`📋 Admin updating order ${orderId} status to: ${status}`);

        if (!status) {
            return res.status(400).json({
                success: false,
                message: 'Status is required'
            });
        }

        const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }

        // Update order status
        const [result] = await pool.execute(`
            UPDATE orders 
            SET status = ?, updated_at = NOW()
            WHERE id = ?
        `, [status, orderId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Log admin activity
        await pool.execute(`
            INSERT INTO admin_activity_logs (admin_id, action, details, created_at)
            VALUES (?, 'order_status_update', ?, NOW())
        `, [req.user.id, JSON.stringify({
            order_id: orderId,
            new_status: status,
            notes: notes || null
        })]);

        console.log(`✅ Order ${orderId} status updated to: ${status}`);

        res.json({
            success: true,
            message: 'Order status updated successfully'
        });

    } catch (error) {
        console.error('❌ Error updating order status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update order status',
            error: error.message
        });
    }
});

// Get order statistics for dashboard
router.get('/stats/overview', verifyAdminAuth, async (req, res) => {
    try {
        console.log('📊 Admin fetching order statistics...');

        // Get order counts by status
        const [statusCounts] = await pool.execute(`
            SELECT 
                status,
                COUNT(*) as count,
                SUM(total_amount) as total_amount
            FROM orders
            GROUP BY status
        `);

        // Get recent orders count (last 7 days)
        const [recentOrders] = await pool.execute(`
            SELECT COUNT(*) as count
            FROM orders
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        `);

        // Get total revenue
        const [revenue] = await pool.execute(`
            SELECT 
                SUM(total_amount) as total_revenue,
                COUNT(*) as total_orders
            FROM orders
            WHERE status IN ('delivered', 'completed')
        `);

        // Get monthly growth
        const [monthlyGrowth] = await pool.execute(`
            SELECT 
                COUNT(*) as current_month
            FROM orders
            WHERE YEAR(created_at) = YEAR(NOW()) 
            AND MONTH(created_at) = MONTH(NOW())
        `);

        const [lastMonthGrowth] = await pool.execute(`
            SELECT 
                COUNT(*) as last_month
            FROM orders
            WHERE YEAR(created_at) = YEAR(DATE_SUB(NOW(), INTERVAL 1 MONTH))
            AND MONTH(created_at) = MONTH(DATE_SUB(NOW(), INTERVAL 1 MONTH))
        `);

        const currentMonth = monthlyGrowth[0]?.current_month || 0;
        const lastMonth = lastMonthGrowth[0]?.last_month || 0;
        const growthPercentage = lastMonth > 0 ? ((currentMonth - lastMonth) / lastMonth * 100).toFixed(1) : 0;

        console.log('✅ Order statistics loaded');

        res.json({
            success: true,
            stats: {
                by_status: statusCounts,
                recent_orders: recentOrders[0]?.count || 0,
                total_revenue: revenue[0]?.total_revenue || 0,
                total_orders: revenue[0]?.total_orders || 0,
                monthly_growth: {
                    current_month: currentMonth,
                    last_month: lastMonth,
                    growth_percentage: growthPercentage
                }
            }
        });

    } catch (error) {
        console.error('❌ Error fetching order statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch order statistics',
            error: error.message
        });
    }
});

module.exports = router;