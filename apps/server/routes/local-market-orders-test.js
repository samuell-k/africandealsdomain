const express = require('express');
const router = express.Router();
const mockDb = require('../mock-database.js');
const jwt = require('jsonwebtoken');

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ 
            success: false, 
            message: 'Access token required' 
        });
    }

    // For testing, we'll skip JWT verification and create a mock user
    req.user = {
        id: 'seller123',
        role: 'seller',
        name: 'Test Seller'
    };
    next();
};

console.log('🔧 [LOCAL-MARKET-ORDERS-TEST] Loading test local market orders routes...');

// ====================================================================
// SELLER ENDPOINTS
// ====================================================================

// Get seller orders with statistics
router.get('/seller/orders', authenticateToken, async (req, res) => {
    try {
        console.log('[SELLER-ORDERS] Fetching orders for seller:', req.user.id);
        
        const { status, limit = 50, offset = 0 } = req.query;
        
        // Get orders with items and stats
        const connection = await mockDb.createConnection();
        
        let query = `
            SELECT 
                lmo.*,
                u.name as buyer_name,
                u.phone as buyer_phone,
                u.email as buyer_email,
                u.address as buyer_address,
                COUNT(lmoi.id) as total_items,
                GROUP_CONCAT(CONCAT(lmoi.quantity, 'x ', lmoi.product_name) SEPARATOR ', ') as items_summary,
                agent.name as agent_name,
                agent.phone as agent_phone
            FROM local_market_orders lmo
            LEFT JOIN users u ON lmo.buyer_id = u.id
            LEFT JOIN local_market_order_items lmoi ON lmo.id = lmoi.order_id
            LEFT JOIN users agent ON lmo.agent_id = agent.id
            WHERE lmo.payment_status = 'confirmed'
        `;
        
        const params = [];
        
        if (status) {
            query += ' AND lmo.status = ?';
            params.push(status);
        }
        
        query += `
            GROUP BY lmo.id
            ORDER BY lmo.created_at DESC
            LIMIT ? OFFSET ?
        `;
        params.push(parseInt(limit), parseInt(offset));
        
        const [orders, stats] = await connection.execute(query, params);
        
        // Get statistics
        const statsQuery = `
            SELECT 
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
                COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_count,
                COUNT(CASE WHEN status = 'preparing' THEN 1 END) as preparing_count,
                COUNT(CASE WHEN status = 'ready_for_pickup' THEN 1 END) as ready_count,
                COUNT(CASE WHEN status = 'out_for_delivery' THEN 1 END) as out_for_delivery_count,
                COUNT(CASE WHEN status = 'delivered' AND DATE(delivered_at) = CURDATE() THEN 1 END) as delivered_today_count,
                COALESCE(SUM(CASE WHEN status = 'delivered' AND MONTH(delivered_at) = MONTH(NOW()) THEN grand_total END), 0) as monthly_revenue
            FROM local_market_orders
            WHERE payment_status = 'confirmed'
        `;
        
        const [statsResult] = await connection.execute(statsQuery);
        
        await connection.end();
        
        res.json({
            success: true,
            orders: orders || [],
            stats: statsResult[0] || {
                pending_count: 0,
                confirmed_count: 0,
                preparing_count: 0,
                ready_count: 0,
                out_for_delivery_count: 0,
                delivered_today_count: 0,
                monthly_revenue: 0
            },
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                total: orders ? orders.length : 0
            }
        });
        
    } catch (error) {
        console.error('[SELLER-ORDERS] Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch orders',
            error: error.message
        });
    }
});

// Get single order details
router.get('/seller/orders/:orderId', authenticateToken, async (req, res) => {
    try {
        const { orderId } = req.params;
        console.log('[SELLER-ORDER-DETAILS] Fetching order:', orderId);
        
        const connection = await mockDb.createConnection();
        
        const query = `
            SELECT 
                lmo.*,
                u.name as buyer_name,
                u.phone as buyer_phone,
                u.email as buyer_email,
                u.address as buyer_address,
                agent.name as agent_name,
                agent.phone as agent_phone
            FROM local_market_orders lmo
            LEFT JOIN users u ON lmo.buyer_id = u.id
            LEFT JOIN users agent ON lmo.agent_id = agent.id
            WHERE lmo.id = ?
        `;
        
        const [orders] = await connection.execute(query, [orderId]);
        
        if (!orders || orders.length === 0) {
            await connection.end();
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }
        
        const order = orders[0];
        
        // Get order items
        const itemsQuery = `
            SELECT * FROM local_market_order_items 
            WHERE order_id = ?
            ORDER BY created_at ASC
        `;
        
        const [items] = await connection.execute(itemsQuery, [orderId]);
        order.items = items || [];
        
        await connection.end();
        
        res.json({
            success: true,
            order: order
        });
        
    } catch (error) {
        console.error('[SELLER-ORDER-DETAILS] Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch order details',
            error: error.message
        });
    }
});

// Update order status
router.post('/seller/orders/:orderId/status', authenticateToken, async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status, notes } = req.body;
        
        console.log('[UPDATE-ORDER-STATUS] Updating order:', orderId, 'to status:', status);
        
        // Validate status
        const validStatuses = ['confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }
        
        const connection = await mockDb.createConnection();
        
        // Check if order exists
        const [existingOrders] = await connection.execute(
            'SELECT status FROM local_market_orders WHERE id = ?',
            [orderId]
        );
        
        if (!existingOrders || existingOrders.length === 0) {
            await connection.end();
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }
        
        const currentStatus = existingOrders[0].status;
        
        // Validate status transition
        const validTransitions = {
            'pending': ['confirmed', 'cancelled'],
            'confirmed': ['preparing', 'cancelled'],
            'preparing': ['ready_for_pickup', 'cancelled'],
            'ready_for_pickup': ['out_for_delivery', 'cancelled'],
            'out_for_delivery': ['delivered', 'cancelled'],
            'delivered': [],
            'cancelled': []
        };
        
        if (!validTransitions[currentStatus] || !validTransitions[currentStatus].includes(status)) {
            await connection.end();
            return res.status(400).json({
                success: false,
                message: 'Cannot change status from ' + currentStatus + ' to ' + status
            });
        }
        
        // Update order status
        let updateQuery = 'UPDATE local_market_orders SET status = ?, updated_at = NOW()';
        const params = [status];
        
        // Add timestamp fields based on status
        if (status === 'preparing') {
            updateQuery += ', preparation_started_at = NOW()';
        } else if (status === 'ready_for_pickup') {
            updateQuery += ', ready_at = NOW()';
        } else if (status === 'out_for_delivery') {
            updateQuery += ', delivery_started_at = NOW()';
        } else if (status === 'delivered') {
            updateQuery += ', delivered_at = NOW()';
        } else if (status === 'cancelled') {
            updateQuery += ', cancelled_at = NOW()';
        }
        
        if (notes) {
            updateQuery += ', notes = ?';
            params.push(notes);
        }
        
        updateQuery += ' WHERE id = ?';
        params.push(orderId);
        
        const [result] = await connection.execute(updateQuery, params);
        
        await connection.end();
        
        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Order status updated successfully',
            data: {
                orderId,
                newStatus: status,
                notes: notes || null
            }
        });
        
    } catch (error) {
        console.error('[UPDATE-ORDER-STATUS] Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update order status',
            error: error.message
        });
    }
});

console.log('✅ [LOCAL-MARKET-ORDERS-TEST] Local market orders test routes loaded successfully');

module.exports = router;