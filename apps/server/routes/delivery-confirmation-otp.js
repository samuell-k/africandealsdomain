/**
 * Enhanced Delivery Confirmation System with OTP Verification
 * Handles delivery confirmation workflow with order code verification
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('./auth');
const db = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for delivery proof uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../uploads/delivery-proofs');
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 15);
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `delivery-proof-${timestamp}-${randomString}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

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

// Middleware to verify admin role
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ 
            success: false, 
            message: 'Admin access required' 
        });
    }
    next();
};

/**
 * Generate delivery verification code
 */
function generateDeliveryCode() {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
}

/**
 * Generate pickup verification code
 */
function generatePickupCode() {
    return Math.floor(1000000000 + Math.random() * 9000000000).toString(); // 10-digit code
}

/**
 * GET /api/delivery-confirmation-otp/agent/orders
 * Get orders assigned to agent for delivery
 */
router.get('/agent/orders', requireAuth, requireAgent, async (req, res) => {
    try {
        const query = `
            SELECT 
                o.id, o.order_number, o.total_amount, o.status,
                o.delivery_code, o.pickup_code, o.delivery_method,
                o.shipping_address, o.delivery_address,
                o.estimated_delivery_time, o.agent_assigned_at,
                u.name as buyer_name, u.phone as buyer_phone,
                s.name as seller_name, s.phone as seller_phone,
                GROUP_CONCAT(
                    CONCAT(oi.product_name, ' (', oi.quantity, 'x)')
                    SEPARATOR ', '
                ) as items
            FROM orders o
            JOIN users u ON o.user_id = u.id
            LEFT JOIN users s ON o.seller_id = s.id
            LEFT JOIN order_items oi ON o.id = oi.order_id
            WHERE o.agent_id = ? 
            AND o.status IN ('PICKED_FROM_SELLER', 'EN_ROUTE_TO_BUYER', 'FDA_EN_ROUTE_TO_BUYER')
            GROUP BY o.id
            ORDER BY o.estimated_delivery_time ASC
        `;

        const [orders] = await db.execute(query, [req.user.id]);

        // Generate delivery codes for orders that don't have them
        for (let order of orders) {
            if (!order.delivery_code) {
                const deliveryCode = generateDeliveryCode();
                await db.execute(
                    'UPDATE orders SET delivery_code = ? WHERE id = ?',
                    [deliveryCode, order.id]
                );
                order.delivery_code = deliveryCode;
            }
        }

        res.json({
            success: true,
            orders: orders,
            count: orders.length
        });

    } catch (error) {
        console.error('❌ Error fetching agent orders:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch orders'
        });
    }
});

/**
 * POST /api/delivery-confirmation-otp/verify-code
 * Verify delivery code provided by buyer
 */
router.post('/verify-code', requireAuth, requireAgent, async (req, res) => {
    try {
        const { order_id, delivery_code } = req.body;

        if (!order_id || !delivery_code) {
            return res.status(400).json({
                success: false,
                message: 'Order ID and delivery code are required'
            });
        }

        // Verify the order belongs to this agent and code matches
        const [orders] = await db.execute(
            'SELECT id, order_number, delivery_code, status FROM orders WHERE id = ? AND agent_id = ?',
            [order_id, req.user.id]
        );

        if (orders.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Order not found or not assigned to you'
            });
        }

        const order = orders[0];

        if (order.delivery_code !== delivery_code) {
            return res.status(400).json({
                success: false,
                message: 'Invalid delivery code'
            });
        }

        res.json({
            success: true,
            message: 'Delivery code verified successfully',
            order: {
                id: order.id,
                order_number: order.order_number,
                status: order.status
            }
        });

    } catch (error) {
        console.error('❌ Error verifying delivery code:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify delivery code'
        });
    }
});

/**
 * POST /api/delivery-confirmation-otp/confirm-delivery
 * Confirm delivery with photo proof and GPS location
 */
router.post('/confirm-delivery', requireAuth, requireAgent, upload.single('delivery_photo'), async (req, res) => {
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const { order_id, delivery_code, delivery_notes, latitude, longitude } = req.body;
        const delivery_photo = req.file ? req.file.filename : null;

        if (!order_id || !delivery_code) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Order ID and delivery code are required'
            });
        }

        // Verify the order and code
        const [orders] = await connection.execute(
            'SELECT id, order_number, delivery_code, status, user_id FROM orders WHERE id = ? AND agent_id = ?',
            [order_id, req.user.id]
        );

        if (orders.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'Order not found or not assigned to you'
            });
        }

        const order = orders[0];

        if (order.delivery_code !== delivery_code) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Invalid delivery code'
            });
        }

        // Update order status and delivery information
        await connection.execute(`
            UPDATE orders SET 
                status = 'DELIVERED',
                delivery_confirmed_at = NOW(),
                delivery_confirmed_lat = ?,
                delivery_confirmed_lng = ?,
                delivery_photo = ?,
                agent_delivery_notes = ?,
                actual_delivery_time = NOW(),
                delivered_at = NOW()
            WHERE id = ?
        `, [latitude || null, longitude || null, delivery_photo, delivery_notes || null, order_id]);

        // Create delivery confirmation record
        await connection.execute(`
            INSERT INTO delivery_confirmations 
            (order_id, agent_id, delivery_proof_url, delivery_notes, delivery_location, status, created_at, verified_at)
            VALUES (?, ?, ?, ?, ?, 'approved', NOW(), NOW())
        `, [
            order_id, 
            req.user.id, 
            delivery_photo, 
            delivery_notes || 'Delivery confirmed with code verification',
            latitude && longitude ? `${latitude},${longitude}` : null
        ]);

        // Log the delivery confirmation
        await connection.execute(`
            INSERT INTO order_status_history 
            (order_id, status, changed_by, notes, created_at)
            VALUES (?, 'DELIVERED', ?, ?, NOW())
        `, [order_id, req.user.id, `Delivery confirmed with code: ${delivery_code}`]);

        await connection.commit();

        res.json({
            success: true,
            message: 'Delivery confirmed successfully',
            order_id: order_id,
            delivery_photo: delivery_photo
        });

    } catch (error) {
        await connection.rollback();
        console.error('❌ Error confirming delivery:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to confirm delivery'
        });
    } finally {
        connection.release();
    }
});

/**
 * GET /api/delivery-confirmation-otp/buyer/orders
 * Get buyer's orders with delivery codes
 */
router.get('/buyer/orders', requireAuth, async (req, res) => {
    try {
        if (req.user.role !== 'buyer') {
            return res.status(403).json({
                success: false,
                message: 'Buyer access required'
            });
        }

        const query = `
            SELECT 
                o.id, o.order_number, o.total_amount, o.status,
                o.delivery_code, o.pickup_code, o.delivery_method,
                o.shipping_address, o.delivery_address,
                o.estimated_delivery_time, o.delivery_confirmed_at,
                o.delivered_at, o.agent_delivery_notes,
                a.name as agent_name, a.phone as agent_phone,
                s.name as seller_name,
                GROUP_CONCAT(
                    CONCAT(oi.product_name, ' (', oi.quantity, 'x)')
                    SEPARATOR ', '
                ) as items
            FROM orders o
            LEFT JOIN users a ON o.agent_id = a.id
            LEFT JOIN users s ON o.seller_id = s.id
            LEFT JOIN order_items oi ON o.id = oi.order_id
            WHERE o.user_id = ? 
            AND o.status IN ('PICKED_FROM_SELLER', 'EN_ROUTE_TO_BUYER', 'FDA_EN_ROUTE_TO_BUYER', 'DELIVERED')
            GROUP BY o.id
            ORDER BY o.created_at DESC
        `;

        const [orders] = await db.execute(query, [req.user.id]);

        res.json({
            success: true,
            orders: orders,
            count: orders.length
        });

    } catch (error) {
        console.error('❌ Error fetching buyer orders:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch orders'
        });
    }
});

/**
 * GET /api/delivery-confirmation-otp/admin/confirmations
 * Get all delivery confirmations for admin review
 */
router.get('/admin/confirmations', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = '';
        let params = [];

        if (status) {
            whereClause = 'WHERE dc.status = ?';
            params.push(status);
        }

        const query = `
            SELECT 
                dc.id, dc.order_id, dc.status, dc.created_at, dc.verified_at,
                dc.delivery_proof_url, dc.delivery_notes, dc.delivery_location,
                o.order_number, o.total_amount, o.delivery_code,
                o.delivery_confirmed_at, o.delivered_at,
                buyer.name as buyer_name, buyer.phone as buyer_phone,
                agent.name as agent_name, agent.phone as agent_phone,
                seller.name as seller_name
            FROM delivery_confirmations dc
            JOIN orders o ON dc.order_id = o.id
            JOIN users buyer ON o.user_id = buyer.id
            JOIN users agent ON dc.agent_id = agent.id
            LEFT JOIN users seller ON o.seller_id = seller.id
            ${whereClause}
            ORDER BY dc.created_at DESC
            LIMIT ? OFFSET ?
        `;

        params.push(parseInt(limit), parseInt(offset));
        const [confirmations] = await db.execute(query, params);

        // Get total count
        const countQuery = `
            SELECT COUNT(*) as total
            FROM delivery_confirmations dc
            JOIN orders o ON dc.order_id = o.id
            ${whereClause}
        `;
        const countParams = status ? [status] : [];
        const [countResult] = await db.execute(countQuery, countParams);

        res.json({
            success: true,
            confirmations: confirmations,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult[0].total,
                pages: Math.ceil(countResult[0].total / limit)
            }
        });

    } catch (error) {
        console.error('❌ Error fetching delivery confirmations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch delivery confirmations'
        });
    }
});

/**
 * GET /api/delivery-confirmation-otp/admin/stats
 * Get delivery confirmation statistics
 */
router.get('/admin/stats', requireAuth, requireAdmin, async (req, res) => {
    try {
        const [stats] = await db.execute(`
            SELECT 
                COUNT(*) as total_deliveries,
                SUM(CASE WHEN o.status = 'DELIVERED' THEN 1 ELSE 0 END) as completed_deliveries,
                SUM(CASE WHEN o.status IN ('PICKED_FROM_SELLER', 'EN_ROUTE_TO_BUYER', 'FDA_EN_ROUTE_TO_BUYER') THEN 1 ELSE 0 END) as pending_deliveries,
                SUM(CASE WHEN o.delivery_code IS NOT NULL THEN 1 ELSE 0 END) as orders_with_codes,
                SUM(CASE WHEN o.delivery_confirmed_at IS NOT NULL THEN 1 ELSE 0 END) as confirmed_deliveries,
                AVG(TIMESTAMPDIFF(MINUTE, o.agent_assigned_at, o.delivered_at)) as avg_delivery_time_minutes
            FROM orders o
            WHERE o.agent_id IS NOT NULL
            AND o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        `);

        // Get recent delivery confirmations
        const [recentDeliveries] = await db.execute(`
            SELECT 
                o.id, o.order_number, o.status, o.delivered_at,
                buyer.name as buyer_name,
                agent.name as agent_name
            FROM orders o
            JOIN users buyer ON o.user_id = buyer.id
            LEFT JOIN users agent ON o.agent_id = agent.id
            WHERE o.status = 'DELIVERED'
            ORDER BY o.delivered_at DESC
            LIMIT 10
        `);

        res.json({
            success: true,
            stats: stats[0] || {
                total_deliveries: 0,
                completed_deliveries: 0,
                pending_deliveries: 0,
                orders_with_codes: 0,
                confirmed_deliveries: 0,
                avg_delivery_time_minutes: 0
            },
            recent_deliveries: recentDeliveries
        });

    } catch (error) {
        console.error('❌ Error fetching delivery stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch delivery statistics'
        });
    }
});

module.exports = router;