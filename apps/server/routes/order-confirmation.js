/**
 * Order Confirmation System API Routes
 * Handles buyer order confirmation before agent pickup
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('./auth');
const db = require('../db');

// Middleware to verify buyer role
const requireBuyer = (req, res, next) => {
    if (req.user.role !== 'buyer') {
        return res.status(403).json({ 
            success: false, 
            message: 'Buyer access required' 
        });
    }
    next();
};

// Middleware to verify agent role
const requireAgent = (req, res, next) => {
    if (req.user.role !== 'agent') {
        return res.status(403).json({ 
            success: false, 
            message: 'Agent access required' 
        });
    }
    next();
};

/**
 * GET /api/order-confirmation/pending
 * Get orders pending buyer confirmation
 */
router.get('/pending', requireAuth, async (req, res) => {
    try {
        let query;
        let params = [];

        if (req.user.role === 'buyer') {
            // Buyers see only their own orders pending confirmation
            query = `
                SELECT 
                    o.id, o.order_number, o.total_amount, o.status,
                    o.created_at, o.shipping_address,
                    u.name as seller_name, u.email as seller_email,
                    GROUP_CONCAT(
                        CONCAT(oi.product_name, ' (', oi.quantity, 'x)')
                        SEPARATOR ', '
                    ) as items
                FROM orders o
                JOIN users u ON o.seller_id = u.id
                LEFT JOIN order_items oi ON o.id = oi.order_id
                WHERE o.buyer_id = ? 
                AND o.status = 'pending_confirmation'
                GROUP BY o.id
                ORDER BY o.created_at DESC
            `;
            params = [req.user.id];
        } else if (req.user.role === 'admin') {
            // Admins see all orders pending confirmation
            query = `
                SELECT 
                    o.id, o.order_number, o.total_amount, o.status,
                    o.created_at, o.shipping_address,
                    buyer.name as buyer_name, buyer.email as buyer_email,
                    seller.name as seller_name, seller.email as seller_email,
                    GROUP_CONCAT(
                        CONCAT(oi.product_name, ' (', oi.quantity, 'x)')
                        SEPARATOR ', '
                    ) as items
                FROM orders o
                JOIN users buyer ON o.buyer_id = buyer.id
                JOIN users seller ON o.seller_id = seller.id
                LEFT JOIN order_items oi ON o.id = oi.order_id
                WHERE o.status = 'pending_confirmation'
                GROUP BY o.id
                ORDER BY o.created_at DESC
            `;
        } else {
            return res.status(403).json({ 
                success: false, 
                message: 'Access denied' 
            });
        }

        const [orders] = await db.execute(query, params);

        res.json({
            success: true,
            orders: orders,
            count: orders.length
        });

    } catch (error) {
        console.error('❌ Error fetching pending confirmations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch pending confirmations'
        });
    }
});

/**
 * POST /api/order-confirmation/:orderId/confirm
 * Buyer confirms an order for agent pickup
 */
router.post('/:orderId/confirm', requireAuth, requireBuyer, async (req, res) => {
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const orderId = req.params.orderId;
        const { confirmation_notes } = req.body;

        // Verify order belongs to buyer and is pending confirmation
        const [orders] = await connection.execute(
            'SELECT id, status, buyer_id FROM orders WHERE id = ? AND buyer_id = ?',
            [orderId, req.user.id]
        );

        if (orders.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'Order not found or access denied'
            });
        }

        const order = orders[0];
        if (order.status !== 'pending_confirmation') {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Order is not pending confirmation'
            });
        }

        // Update order status to confirmed
        await connection.execute(
            'UPDATE orders SET status = ?, confirmed_at = NOW(), confirmation_notes = ? WHERE id = ?',
            ['confirmed', confirmation_notes || null, orderId]
        );

        // Log the confirmation
        await connection.execute(`
            INSERT INTO order_status_history 
            (order_id, status, changed_by, notes, created_at)
            VALUES (?, 'confirmed', ?, ?, NOW())
        `, [orderId, req.user.id, `Order confirmed by buyer: ${confirmation_notes || 'No notes'}`]);

        await connection.commit();

        res.json({
            success: true,
            message: 'Order confirmed successfully',
            order_id: orderId
        });

    } catch (error) {
        await connection.rollback();
        console.error('❌ Error confirming order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to confirm order'
        });
    } finally {
        connection.release();
    }
});

/**
 * POST /api/order-confirmation/:orderId/cancel
 * Buyer cancels an order before confirmation
 */
router.post('/:orderId/cancel', requireAuth, requireBuyer, async (req, res) => {
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const orderId = req.params.orderId;
        const { cancellation_reason } = req.body;

        // Verify order belongs to buyer and is pending confirmation
        const [orders] = await connection.execute(
            'SELECT id, status, buyer_id FROM orders WHERE id = ? AND buyer_id = ?',
            [orderId, req.user.id]
        );

        if (orders.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'Order not found or access denied'
            });
        }

        const order = orders[0];
        if (order.status !== 'pending_confirmation') {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Order cannot be cancelled at this stage'
            });
        }

        // Update order status to cancelled
        await connection.execute(
            'UPDATE orders SET status = ?, cancelled_at = NOW(), cancellation_reason = ? WHERE id = ?',
            ['cancelled', cancellation_reason || 'Cancelled by buyer', orderId]
        );

        // Log the cancellation
        await connection.execute(`
            INSERT INTO order_status_history 
            (order_id, status, changed_by, notes, created_at)
            VALUES (?, 'cancelled', ?, ?, NOW())
        `, [orderId, req.user.id, `Order cancelled by buyer: ${cancellation_reason || 'No reason provided'}`]);

        await connection.commit();

        res.json({
            success: true,
            message: 'Order cancelled successfully',
            order_id: orderId
        });

    } catch (error) {
        await connection.rollback();
        console.error('❌ Error cancelling order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel order'
        });
    } finally {
        connection.release();
    }
});

/**
 * GET /api/order-confirmation/agent/available
 * Get confirmed orders available for agent pickup
 */
router.get('/agent/available', requireAuth, requireAgent, async (req, res) => {
    try {
        const query = `
            SELECT 
                o.id, o.order_number, o.total_amount, o.status,
                o.created_at, o.confirmed_at, o.shipping_address,
                buyer.name as buyer_name, buyer.phone as buyer_phone,
                seller.name as seller_name, seller.phone as seller_phone,
                GROUP_CONCAT(
                    CONCAT(oi.product_name, ' (', oi.quantity, 'x)')
                    SEPARATOR ', '
                ) as items
            FROM orders o
            JOIN users buyer ON o.buyer_id = buyer.id
            JOIN users seller ON o.seller_id = seller.id
            LEFT JOIN order_items oi ON o.id = oi.order_id
            WHERE o.status = 'confirmed' 
            AND o.agent_id IS NULL
            GROUP BY o.id
            ORDER BY o.confirmed_at ASC
        `;

        const [orders] = await db.execute(query);

        res.json({
            success: true,
            orders: orders,
            count: orders.length
        });

    } catch (error) {
        console.error('❌ Error fetching available orders:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch available orders'
        });
    }
});

/**
 * POST /api/order-confirmation/agent/:orderId/pickup
 * Agent picks up a confirmed order
 */
router.post('/agent/:orderId/pickup', requireAuth, requireAgent, async (req, res) => {
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const orderId = req.params.orderId;

        // Verify order is confirmed and available for pickup
        const [orders] = await connection.execute(
            'SELECT id, status, agent_id FROM orders WHERE id = ?',
            [orderId]
        );

        if (orders.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        const order = orders[0];
        if (order.status !== 'confirmed') {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Order is not confirmed for pickup'
            });
        }

        if (order.agent_id) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Order already assigned to another agent'
            });
        }

        // Assign agent to order and update status
        await connection.execute(
            'UPDATE orders SET agent_id = ?, status = ?, picked_up_at = NOW() WHERE id = ?',
            [req.user.id, 'picked_up', orderId]
        );

        // Log the pickup
        await connection.execute(`
            INSERT INTO order_status_history 
            (order_id, status, changed_by, notes, created_at)
            VALUES (?, 'picked_up', ?, ?, NOW())
        `, [orderId, req.user.id, 'Order picked up by agent']);

        await connection.commit();

        res.json({
            success: true,
            message: 'Order picked up successfully',
            order_id: orderId
        });

    } catch (error) {
        await connection.rollback();
        console.error('❌ Error picking up order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to pick up order'
        });
    } finally {
        connection.release();
    }
});

/**
 * GET /api/order-confirmation/stats
 * Get order confirmation statistics
 */
router.get('/stats', requireAuth, async (req, res) => {
    try {
        // Only admins can view full stats
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }

        const [stats] = await db.execute(`
            SELECT 
                COUNT(*) as total_orders,
                SUM(CASE WHEN status = 'pending_confirmation' THEN 1 ELSE 0 END) as pending_confirmation,
                SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
                SUM(CASE WHEN status = 'picked_up' THEN 1 ELSE 0 END) as picked_up,
                SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
                AVG(TIMESTAMPDIFF(HOUR, created_at, confirmed_at)) as avg_confirmation_time_hours
            FROM orders
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        `);

        res.json({
            success: true,
            stats: stats[0] || {
                total_orders: 0,
                pending_confirmation: 0,
                confirmed: 0,
                picked_up: 0,
                cancelled: 0,
                avg_confirmation_time_hours: 0
            }
        });

    } catch (error) {
        console.error('❌ Error fetching order confirmation stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics'
        });
    }
});

module.exports = router;