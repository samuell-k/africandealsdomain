const express = require('express');
const router = express.Router();
const db = require('../db.js');
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

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ 
                success: false, 
                message: 'Invalid or expired token' 
            });
        }
        req.user = user;
        next();
    });
};

console.log('🔧 [LOCAL-MARKET-ORDERS] Loading local market orders routes...');

// ====================================================================
// PRODUCTS ENDPOINTS
// ====================================================================

// Get local market products (proxy to grocery products)
router.get('/products', async (req, res) => {
    try {
        console.log('[PRODUCTS] Fetching local market products...');
        
        // Use the same database connection as other routes
        const query = `
            SELECT 
                gp.id,
                gp.product_id,
                gp.unit_type,
                gp.unit_price as price_per_unit,
                gp.unit_price as price,
                gp.minimum_order,
                gp.maximum_order,
                gp.available_stock as stock_quantity,
                gp.brand,
                gp.expiry_date,
                gp.is_perishable,
                gp.storage_requirements,
                gp.nutritional_info,
                gp.origin_location,
                gp.is_organic,
                gp.is_local_produce,
                gp.delivery_zones,
                gp.created_at,
                gp.updated_at,
                p.name as product_name,
                p.description as product_description,
                p.main_image,
                p.category_id as main_category_id,
                gc.name as category_name,
                gc.icon as category_icon,
                u.id as seller_id,
                u.name as seller_name,
                u.email as seller_email,
                u.phone as seller_phone,
                u.city as seller_city,
                COALESCE(u.total_sales, 0) as seller_total_sales,
                u.address as seller_location,
                u.latitude as lat,
                u.longitude as lng,
                COALESCE(u.rating, 0) as seller_rating
            FROM grocery_products gp
            LEFT JOIN products p ON gp.product_id = p.id
            LEFT JOIN grocery_categories gc ON p.category_id = gc.id
            LEFT JOIN users u ON p.seller_id = u.id
            WHERE p.is_active = 1 AND u.is_active = 1
            ORDER BY gp.created_at DESC
            LIMIT 50
        `;
        
        const [products] = await db.execute(query);
        
        console.log(`[PRODUCTS] Found ${products.length} products`);
        
        res.json({
            success: true,
            products: products,
            message: `Found ${products.length} products`
        });
        
    } catch (error) {
        console.error('[PRODUCTS] Error fetching products:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch products',
            error: error.message
        });
    }
});

// ====================================================================
// ORDERS ENDPOINTS
// ====================================================================

// Place a new order
router.post('/orders', authenticateToken, async (req, res) => {
    try {
        console.log('[ORDER] Placing new local market order...');
        const userId = req.user.id;
        const { items, delivery_info, totals } = req.body;
        
        if (!items || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Order items are required'
            });
        }
        
        // Generate order ID
        const orderId = 'LM' + Date.now() + Math.random().toString(36).substr(2, 5);
        
        // Insert order into database
        const orderQuery = `
            INSERT INTO local_market_orders (
                id, buyer_id, status, delivery_address, 
                products_total, platform_fee, packaging_fee, delivery_fee, grand_total,
                payment_method, payment_status, created_at, updated_at
            ) VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, 'mobile_money', 'pending', NOW(), NOW())
        `;
        
        await db.execute(orderQuery, [
            orderId,
            userId,
            delivery_info.delivery_address || 'Address not provided',
            totals.products_total || 0,
            totals.platform_fee || 0,
            totals.packaging_fee || 0,
            totals.delivery_fee || 0,
            totals.grand_total || 0
        ]);
        
        // Insert order items
        for (const item of items) {
            const itemQuery = `
                INSERT INTO local_market_order_items (
                    order_id, product_id, product_name, quantity, unit_price, total_price,
                    seller_id, seller_name, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `;
            
            await db.execute(itemQuery, [
                orderId,
                item.product_id,
                item.product_name,
                item.quantity,
                item.price,
                item.price * item.quantity,
                item.seller_id || null,
                item.seller_name || 'Unknown Seller'
            ]);
        }
        
        console.log(`[ORDER] Order ${orderId} placed successfully for user ${userId}`);
        
        res.json({
            success: true,
            order_id: orderId,
            message: 'Order placed successfully'
        });
        
    } catch (error) {
        console.error('[ORDER] Error placing order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to place order',
            error: error.message
        });
    }
});

// Get order details
router.get('/orders/:orderId', authenticateToken, async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.user.id;
        
        console.log(`[ORDER] Fetching order ${orderId} for user ${userId}`);
        
        const orderQuery = `
            SELECT * FROM local_market_orders 
            WHERE id = ? AND buyer_id = ?
        `;
        
        const [orders] = await db.execute(orderQuery, [orderId, userId]);
        
        if (orders.length === 0) {
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
        `;
        
        const [items] = await db.execute(itemsQuery, [orderId]);
        order.items = items;
        
        res.json({
            success: true,
            order: order
        });
        
    } catch (error) {
        console.error('[ORDER] Error fetching order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch order',
            error: error.message
        });
    }
});

// Update order status
router.put('/orders/:orderId/status', authenticateToken, async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;
        const userId = req.user.id;
        
        console.log(`[ORDER] Updating order ${orderId} status to ${status}`);
        
        const updateQuery = `
            UPDATE local_market_orders 
            SET status = ?, updated_at = NOW() 
            WHERE id = ? AND buyer_id = ?
        `;
        
        const [result] = await db.execute(updateQuery, [status, orderId, userId]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Order not found or access denied'
            });
        }
        
        res.json({
            success: true,
            message: 'Order status updated successfully'
        });
        
    } catch (error) {
        console.error('[ORDER] Error updating order status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update order status',
            error: error.message
        });
    }
});

// Get all orders for user (with real data)
router.get('/orders', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { status, limit = 20, offset = 0 } = req.query;
        
        console.log(`[ORDERS] Fetching orders for user ${userId}`);
        
        let whereClause = 'WHERE buyer_id = ?';
        let queryParams = [userId];
        
        if (status) {
            whereClause += ' AND status = ?';
            queryParams.push(status);
        }
        
        const ordersQuery = `
            SELECT 
                lmo.*,
                COUNT(lmoi.id) as item_count,
                GROUP_CONCAT(lmoi.product_name SEPARATOR ', ') as product_names
            FROM local_market_orders lmo
            LEFT JOIN local_market_order_items lmoi ON lmo.id = lmoi.order_id
            ${whereClause}
            GROUP BY lmo.id
            ORDER BY lmo.created_at DESC
            LIMIT ? OFFSET ?
        `;
        
        queryParams.push(parseInt(limit), parseInt(offset));
        
        const [orders] = await db.execute(ordersQuery, queryParams);
        
        res.json({
            success: true,
            orders: orders,
            total: orders.length
        });
        
    } catch (error) {
        console.error('[ORDERS] Error fetching orders:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch orders',
            error: error.message
        });
    }
});

// Submit payment proof
router.post('/orders/:orderId/payment-proof', authenticateToken, async (req, res) => {
    try {
        const { orderId } = req.params;
        const { payment_method, transaction_id, payment_phone, amount, proof_image } = req.body;
        const userId = req.user.id;
        
        console.log(`[PAYMENT] Submitting payment proof for order ${orderId}`);
        
        // Verify order belongs to user
        const orderQuery = 'SELECT * FROM local_market_orders WHERE id = ? AND buyer_id = ?';
        const [orders] = await db.execute(orderQuery, [orderId, userId]);
        
        if (orders.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }
        
        // Update order with payment proof
        const updateQuery = `
            UPDATE local_market_orders 
            SET 
                payment_method = ?,
                payment_transaction_id = ?,
                payment_phone = ?,
                payment_amount = ?,
                payment_proof_image = ?,
                payment_status = 'submitted',
                payment_submitted_at = NOW(),
                updated_at = NOW()
            WHERE id = ? AND buyer_id = ?
        `;
        
        await db.execute(updateQuery, [
            payment_method,
            transaction_id,
            payment_phone,
            amount,
            proof_image,
            orderId,
            userId
        ]);
        
        res.json({
            success: true,
            message: 'Payment proof submitted successfully'
        });
        
    } catch (error) {
        console.error('[PAYMENT] Error submitting payment proof:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit payment proof',
            error: error.message
        });
    }
});

// Agent endpoints
router.get('/agent/orders', authenticateToken, async (req, res) => {
    try {
        const agentId = req.user.id;
        const { status = 'pending' } = req.query;
        
        console.log(`[AGENT] Fetching orders for agent ${agentId}, status: ${status}`);
        
        let whereClause = '';
        let queryParams = [];
        
        if (status === 'available') {
            // Orders that need agent assignment
            whereClause = 'WHERE (agent_id IS NULL OR agent_id = 0) AND status IN ("pending", "confirmed")';
        } else if (status === 'assigned') {
            // Orders assigned to this agent
            whereClause = 'WHERE agent_id = ?';
            queryParams.push(agentId);
        } else {
            // All orders with specific status
            whereClause = 'WHERE status = ?';
            queryParams.push(status);
        }
        
        const ordersQuery = `
            SELECT 
                lmo.*,
                u.name as buyer_name,
                u.phone as buyer_phone,
                u.email as buyer_email,
                COUNT(lmoi.id) as item_count,
                GROUP_CONCAT(lmoi.product_name SEPARATOR ', ') as product_names,
                agent.name as agent_name
            FROM local_market_orders lmo
            LEFT JOIN users u ON lmo.buyer_id = u.id
            LEFT JOIN local_market_order_items lmoi ON lmo.id = lmoi.order_id
            LEFT JOIN users agent ON lmo.agent_id = agent.id
            ${whereClause}
            GROUP BY lmo.id
            ORDER BY lmo.created_at DESC
            LIMIT 50
        `;
        
        const [orders] = await db.execute(ordersQuery, queryParams);
        
        res.json({
            success: true,
            orders: orders
        });
        
    } catch (error) {
        console.error('[AGENT] Error fetching orders:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch orders',
            error: error.message
        });
    }
});

// Agent accepts order
router.post('/agent/orders/:orderId/accept', authenticateToken, async (req, res) => {
    try {
        const { orderId } = req.params;
        const agentId = req.user.id;
        
        console.log(`[AGENT] Agent ${agentId} accepting order ${orderId}`);
        
        // Check if order is available for assignment
        const orderQuery = 'SELECT * FROM local_market_orders WHERE id = ? AND (agent_id IS NULL OR agent_id = 0)';
        const [orders] = await db.execute(orderQuery, [orderId]);
        
        if (orders.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Order not available or already assigned'
            });
        }
        
        // Assign agent to order
        const updateQuery = `
            UPDATE local_market_orders 
            SET 
                agent_id = ?,
                status = 'confirmed',
                assigned_at = NOW(),
                updated_at = NOW()
            WHERE id = ?
        `;
        
        await db.execute(updateQuery, [agentId, orderId]);
        
        res.json({
            success: true,
            message: 'Order accepted successfully'
        });
        
    } catch (error) {
        console.error('[AGENT] Error accepting order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to accept order',
            error: error.message
        });
    }
});

// Agent updates order status
router.put('/agent/orders/:orderId/status', authenticateToken, async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status, notes } = req.body;
        const agentId = req.user.id;
        
        console.log(`[AGENT] Agent ${agentId} updating order ${orderId} to status ${status}`);
        
        // Verify agent is assigned to this order
        const orderQuery = 'SELECT * FROM local_market_orders WHERE id = ? AND agent_id = ?';
        const [orders] = await db.execute(orderQuery, [orderId, agentId]);
        
        if (orders.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Order not found or not assigned to you'
            });
        }
        
        // Update order status
        let updateQuery = `
            UPDATE local_market_orders 
            SET status = ?, updated_at = NOW()
        `;
        let queryParams = [status];
        
        // Add specific timestamp fields based on status
        if (status === 'confirmed') {
            updateQuery += ', confirmed_at = NOW()';
        } else if (status === 'preparing') {
            updateQuery += ', preparation_started_at = NOW()';
        } else if (status === 'ready_for_pickup') {
            updateQuery += ', ready_at = NOW()';
        } else if (status === 'out_for_delivery') {
            updateQuery += ', delivery_started_at = NOW()';
        } else if (status === 'delivered') {
            updateQuery += ', delivered_at = NOW()';
        }
        
        if (notes) {
            updateQuery += ', agent_notes = ?';
            queryParams.push(notes);
        }
        
        updateQuery += ' WHERE id = ? AND agent_id = ?';
        queryParams.push(orderId, agentId);
        
        await db.execute(updateQuery, queryParams);
        
        res.json({
            success: true,
            message: 'Order status updated successfully'
        });
        
    } catch (error) {
        console.error('[AGENT] Error updating order status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update order status',
            error: error.message
        });
    }
});

// Confirm delivery (by buyer)
router.post('/orders/:orderId/confirm-delivery', authenticateToken, async (req, res) => {
    try {
        const { orderId } = req.params;
        const { rating, feedback } = req.body;
        const userId = req.user.id;
        
        console.log(`[DELIVERY] User ${userId} confirming delivery for order ${orderId}`);
        
        // Verify order belongs to user and is delivered
        const orderQuery = 'SELECT * FROM local_market_orders WHERE id = ? AND buyer_id = ? AND status = "delivered"';
        const [orders] = await db.execute(orderQuery, [orderId, userId]);
        
        if (orders.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Order not found or not yet delivered'
            });
        }
        
        // Update order with delivery confirmation
        const updateQuery = `
            UPDATE local_market_orders 
            SET 
                delivery_confirmed = 1,
                delivery_confirmed_at = NOW(),
                buyer_rating = ?,
                buyer_feedback = ?,
                status = 'completed',
                updated_at = NOW()
            WHERE id = ? AND buyer_id = ?
        `;
        
        await db.execute(updateQuery, [rating, feedback, orderId, userId]);
        
        res.json({
            success: true,
            message: 'Delivery confirmed successfully'
        });
        
    } catch (error) {
        console.error('[DELIVERY] Error confirming delivery:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to confirm delivery',
            error: error.message
        });
    }
});

// Admin endpoints for order management
router.get('/admin/orders', authenticateToken, async (req, res) => {
    try {
        // Check if user is admin (you might want to add role checking middleware)
        const { status, limit = 50, offset = 0 } = req.query;
        
        console.log('[ADMIN] Fetching all orders');
        
        let whereClause = '';
        let queryParams = [];
        
        if (status) {
            whereClause = 'WHERE lmo.status = ?';
            queryParams.push(status);
        }
        
        const ordersQuery = `
            SELECT 
                lmo.*,
                u.name as buyer_name,
                u.phone as buyer_phone,
                u.email as buyer_email,
                agent.name as agent_name,
                agent.phone as agent_phone,
                COUNT(lmoi.id) as item_count,
                GROUP_CONCAT(lmoi.product_name SEPARATOR ', ') as product_names
            FROM local_market_orders lmo
            LEFT JOIN users u ON lmo.buyer_id = u.id
            LEFT JOIN users agent ON lmo.agent_id = agent.id
            LEFT JOIN local_market_order_items lmoi ON lmo.id = lmoi.order_id
            ${whereClause}
            GROUP BY lmo.id
            ORDER BY lmo.created_at DESC
            LIMIT ? OFFSET ?
        `;
        
        queryParams.push(parseInt(limit), parseInt(offset));
        
        const [orders] = await db.execute(ordersQuery, queryParams);
        
        res.json({
            success: true,
            orders: orders
        });
        
    } catch (error) {
        console.error('[ADMIN] Error fetching orders:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch orders',
            error: error.message
        });
    }
});

// Database schema update endpoint (for development)
router.post('/admin/update-schema', async (req, res) => {
    try {
        console.log('[SCHEMA] Updating local market orders schema...');
        
        // Add new columns to existing table
        const alterQueries = [
            // Payment Information
            `ALTER TABLE local_market_orders 
             ADD COLUMN IF NOT EXISTS payment_transaction_id VARCHAR(100) NULL,
             ADD COLUMN IF NOT EXISTS payment_phone VARCHAR(20) NULL,
             ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(10,2) NULL,
             ADD COLUMN IF NOT EXISTS payment_proof_image TEXT NULL,
             ADD COLUMN IF NOT EXISTS payment_submitted_at TIMESTAMP NULL,
             ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMP NULL`,
            
            // Agent Management
            `ALTER TABLE local_market_orders 
             ADD COLUMN IF NOT EXISTS agent_notes TEXT NULL`,
            
            // Order Timeline
            `ALTER TABLE local_market_orders 
             ADD COLUMN IF NOT EXISTS preparation_started_at TIMESTAMP NULL,
             ADD COLUMN IF NOT EXISTS ready_at TIMESTAMP NULL,
             ADD COLUMN IF NOT EXISTS delivery_started_at TIMESTAMP NULL`,
            
            // Delivery Confirmation
            `ALTER TABLE local_market_orders 
             ADD COLUMN IF NOT EXISTS delivery_confirmed BOOLEAN DEFAULT FALSE,
             ADD COLUMN IF NOT EXISTS delivery_confirmed_at TIMESTAMP NULL,
             ADD COLUMN IF NOT EXISTS buyer_rating INT NULL,
             ADD COLUMN IF NOT EXISTS buyer_feedback TEXT NULL`,
            
            // Update payment status enum
            `ALTER TABLE local_market_orders 
             MODIFY COLUMN payment_status ENUM('pending', 'submitted', 'confirmed', 'failed') DEFAULT 'pending'`,
            
            // Update status enum
            `ALTER TABLE local_market_orders 
             MODIFY COLUMN status ENUM('pending', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'cancelled', 'completed') DEFAULT 'pending'`
        ];
        
        for (const query of alterQueries) {
            try {
                await db.execute(query);
                console.log('[SCHEMA] Query executed successfully');
            } catch (error) {
                console.log('[SCHEMA] Query skipped (column might already exist):', error.message);
            }
        }
        
        res.json({
            success: true,
            message: 'Schema updated successfully'
        });
        
    } catch (error) {
        console.error('[SCHEMA] Error updating schema:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update schema',
            error: error.message
        });
    }
});

// ====================================================================
// USER LOCATION ENDPOINTS
// ====================================================================

// Update user location
router.patch('/orders/user/location', authenticateToken, async (req, res) => {
    try {
        const { latitude, longitude, address, district, sector } = req.body;
        const userId = req.user.id;
        
        console.log(`[LOCATION] Updating location for user ${userId}:`, { latitude, longitude, address, district, sector });
        
        // Validate required fields
        if (!latitude || !longitude) {
            return res.status(400).json({
                success: false,
                error: 'Latitude and longitude are required'
            });
        }
        
        // Update user location in database (using existing columns)
        const updateQuery = `
            UPDATE users 
            SET latitude = ?, longitude = ?, address = ?, updated_at = NOW()
            WHERE id = ?
        `;
        
        const [result] = await db.execute(updateQuery, [
            latitude, longitude, address || null, userId
        ]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        console.log(`[LOCATION] Location updated successfully for user ${userId}`);
        
        res.json({
            success: true,
            message: 'Location updated successfully',
            data: {
                latitude,
                longitude,
                address,
                district,
                sector
            }
        });
        
    } catch (error) {
        console.error('[LOCATION] Error updating user location:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update location'
        });
    }
});

// ====================================================================
// ENHANCED ERROR HANDLING SYSTEM
// ====================================================================

const enhancedErrorHandler = (routeHandler) => {
    return async (req, res, next) => {
        const startTime = Date.now();
        
        try {
            console.log(`📡 [LOCAL-MARKET-ORDERS] ${req.method} ${req.originalUrl}`);
            console.log(`👤 [LOCAL-MARKET-ORDERS] User: ${req.user?.email || 'unknown'} (Role: ${req.user?.role || 'unknown'})`);
            
            await routeHandler(req, res, next);
            
            const duration = Date.now() - startTime;
            console.log(`⚡ [LOCAL-MARKET-ORDERS] Request completed in ${duration}ms`);
            
        } catch (error) {
            const duration = Date.now() - startTime;
            
            console.error(`❌ [LOCAL-MARKET-ORDERS] ERROR in ${req.method} ${req.originalUrl}`);
            console.error(`⏱️ [LOCAL-MARKET-ORDERS] Failed after ${duration}ms`);
            console.error(`💥 [LOCAL-MARKET-ORDERS] Error details:`, {
                message: error.message,
                stack: error.stack,
                sql: error.sql || 'N/A',
                sqlMessage: error.sqlMessage || 'N/A',
                code: error.code || 'UNKNOWN'
            });
            
            res.status(error.status || 500).json({
                success: false,
                message: error.message || 'Internal server error',
                error: process.env.NODE_ENV === 'development' ? error.stack : 'An unexpected error occurred'
            });
        }
    };
};

// ====================================================================
// ORDER MANAGEMENT ROUTES
// ====================================================================

// Get orders for current authenticated user
router.get('/orders', authenticateToken, enhancedErrorHandler(async (req, res) => {
    const [orders] = await db.execute(`
        SELECT 
            lmo.*,
            u.username as seller_name,
            u.phone as seller_phone,
            fa.username as agent_name,
            fa.phone as agent_phone
        FROM local_market_orders lmo
        LEFT JOIN users u ON lmo.seller_id = u.id
        LEFT JOIN users fa ON lmo.fast_agent_id = fa.id
        WHERE lmo.buyer_id = ?
        ORDER BY lmo.created_at DESC
    `, [req.user.id]);

    // Get order items for each order
    for (let order of orders) {
        const [items] = await db.execute(`
            SELECT 
                lmoi.*,
                p.name as product_name,
                p.main_image
            FROM local_market_order_items lmoi
            LEFT JOIN products p ON lmoi.product_id = p.id
            WHERE lmoi.order_id = ?
        `, [order.id]);
        order.items = items;
    }

    res.json({ success: true, orders });
}));

// Get specific order details with items
router.get('/:orderId', authenticateToken, enhancedErrorHandler(async (req, res) => {
    // Get order details
    const [orderRows] = await db.execute(`
        SELECT 
            lmo.*,
            u.username as seller_name,
            u.phone as seller_phone,
            u.email as seller_email,
            fa.username as agent_name,
            fa.phone as agent_phone,
            fa.email as agent_email,
            buyer.username as buyer_name,
            buyer.phone as buyer_phone
        FROM local_market_orders lmo
        LEFT JOIN users u ON lmo.seller_id = u.id
        LEFT JOIN users fa ON lmo.fast_agent_id = fa.id
        LEFT JOIN users buyer ON lmo.buyer_id = buyer.id
        WHERE lmo.id = ? AND (lmo.buyer_id = ? OR lmo.seller_id = ? OR lmo.fast_agent_id = ? OR ? = 'admin')
    `, [req.params.orderId, req.user.id, req.user.id, req.user.id, req.user.role]);

    if (orderRows.length === 0) {
        return res.status(404).json({ 
            success: false, 
            message: 'Order not found or access denied' 
        });
    }

    const order = orderRows[0];

    // Get order items
    const [items] = await db.execute(`
        SELECT 
            lmoi.*,
            p.name,
            p.description,
            p.main_image as image
        FROM local_market_order_items lmoi
        LEFT JOIN products p ON lmoi.product_id = p.id
        WHERE lmoi.order_id = ?
    `, [req.params.orderId]);

    order.items = items;

    res.json({ success: true, order });
}));

// Create new local market order with payment verification
router.post('/', authenticateToken, enhancedErrorHandler(async (req, res) => {
    console.log('📦 [LOCAL-MARKET-ORDERS] Received order data:', JSON.stringify(req.body, null, 2));
    
    const {
        items,
        delivery_address,
        delivery_latitude,
        delivery_longitude,
        delivery_phone,
        preferred_delivery_time,
        special_instructions,
        payment_method = 'mobile_money',
        payment_proof_url,
        payment_reference,
        products_total,
        platform_fee,
        packaging_fee,
        delivery_fee,
        grand_total
    } = req.body;

    const buyer_id = req.user.id;

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Missing required field: items'
        });
    }

    if (!delivery_address) {
        return res.status(400).json({
            success: false,
            message: 'Delivery address is required'
        });
    }

    // Calculate totals from items if not provided
    let calculated_subtotal = 0;
    const processedItems = [];
    
    for (const item of items) {
        if (!item.product_id || !item.quantity || (!item.unit_price && !item.price)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid item data. Each item must have product_id, quantity, and price'
            });
        }
        
        const unit_price = item.unit_price || item.price;
        const total_price = item.total_price || (unit_price * item.quantity);
        calculated_subtotal += total_price;
        
        processedItems.push({
            product_id: item.product_id,
            product_name: item.product_name || item.name,
            quantity: item.quantity,
            unit_price: unit_price,
            total_price: total_price,
            seller_id: item.seller_id || 1 // Default seller for local market
        });
    }

    // Use provided totals or calculate them
    const final_subtotal = products_total || calculated_subtotal;
    const final_delivery_fee = delivery_fee || 2000; // 2000 RWF standard delivery fee
    const final_service_fee = platform_fee || Math.round(final_subtotal * 0.05); // 5% service fee
    const final_total_amount = grand_total || (final_subtotal + final_delivery_fee + final_service_fee);
    
    // Get the first seller_id from items (for local market, usually all items are from same seller)
    const seller_id = processedItems[0].seller_id;

    // Create order with PENDING_PAYMENT status (requires admin approval)
    const [orderResult] = await db.execute(`
        INSERT INTO local_market_orders (
            buyer_id, seller_id, status, subtotal, delivery_fee, 
            service_fee, total_amount, delivery_address, 
            delivery_latitude, delivery_longitude, delivery_phone,
            preferred_delivery_time, special_instructions,
            payment_method, payment_proof_url, payment_reference,
            created_at
        ) VALUES (?, ?, 'pending_payment', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
        buyer_id, seller_id, final_subtotal, final_delivery_fee, final_service_fee,
        final_total_amount, delivery_address, delivery_latitude,
        delivery_longitude, delivery_phone, preferred_delivery_time, special_instructions, 
        payment_method, payment_proof_url, payment_reference
    ]);

    const orderId = orderResult.insertId;

    // Add order items
    for (const item of processedItems) {
        await db.execute(`
            INSERT INTO local_market_order_items (
                order_id, product_id, product_name, quantity, unit_price, total_price, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, NOW())
        `, [orderId, item.product_id, item.product_name, item.quantity, item.unit_price, item.total_price]);
    }

    // Create admin approval request for payment verification
    await db.execute(`
        INSERT INTO admin_approvals (
            type, reference_id, user_id, data, status, created_at
        ) VALUES ('LOCAL_MARKET_PAYMENT', ?, ?, ?, 'pending', NOW())
    `, [
        orderId,
        buyer_id,
        JSON.stringify({
            order_id: orderId,
            total_amount: final_total_amount,
            payment_method: payment_method,
            payment_proof_url: payment_proof_url,
            payment_reference: payment_reference,
            african_deals_number: '+250788910639',
            seller_name: 'Local Market Seller',
            buyer_email: req.user.email,
            delivery_address: delivery_address,
            items: processedItems
        })
    ]);

    // Emit socket event for real-time updates
    if (req.app.get('io')) {
        req.app.get('io').emit('newLocalMarketOrder', {
            orderId,
            sellerId: seller_id,
            buyerId: buyer_id,
            totalAmount: final_total_amount,
            status: 'pending_payment'
        });

        // Notify admins about payment verification needed
        req.app.get('io').emit('adminNotification', {
            type: 'payment_verification',
            message: `New local market order payment needs verification - Order #${orderId}`,
            orderId: orderId,
            amount: final_total_amount
        });
    }

    res.json({ 
        success: true, 
        order_id: orderId,
        orderId: orderId,
        message: 'Order created successfully. Payment verification pending.',
        totalAmount: final_total_amount,
        status: 'pending_payment',
        africanDealsNumber: '+250788910639',
        note: 'Your order will be processed after payment verification by our admin team.'
    });
}));

// Update order status (for sellers, agents, and admins)
router.patch('/:orderId/status', authenticateToken, enhancedErrorHandler(async (req, res) => {
    const { status, notes } = req.body;
    const orderId = req.params.orderId;
    const userId = req.user.id;

    // Verify user has permission to update this order
    const [orderRows] = await db.execute(`
        SELECT seller_id, fast_agent_id, buyer_id, status as current_status
        FROM local_market_orders 
        WHERE id = ?
    `, [orderId]);

    if (orderRows.length === 0) {
        return res.status(404).json({ 
            success: false, 
            message: 'Order not found' 
        });
    }

    const order = orderRows[0];
    const isAuthorized = order.seller_id === userId || 
                       order.fast_agent_id === userId ||
                       req.user.role === 'admin';

    if (!isAuthorized) {
        return res.status(403).json({ 
            success: false, 
            message: 'Not authorized to update this order' 
        });
    }

    // Update order status
    await db.execute(`
        UPDATE local_market_orders 
        SET status = ?, updated_at = NOW()
        WHERE id = ?
    `, [status, orderId]);

    // Add status history
    await db.execute(`
        INSERT INTO local_market_order_status_history (
            order_id, status, notes, updated_by, created_at
        ) VALUES (?, ?, ?, ?, NOW())
    `, [orderId, status, notes || '', userId]);

    // Emit socket event for real-time updates
    if (req.app.get('io')) {
        req.app.get('io').emit('orderStatusUpdate', {
            orderId,
            status,
            buyerId: order.buyer_id,
            sellerId: order.seller_id,
            agentId: order.fast_agent_id
        });
    }

    res.json({ 
        success: true, 
        message: 'Order status updated successfully' 
    });
}));

// Assign fast delivery agent to order
router.patch('/:orderId/assign-agent', authenticateToken, enhancedErrorHandler(async (req, res) => {
    const { agent_id } = req.body;
    const orderId = req.params.orderId;

    // Only admins and sellers can assign agents
    if (req.user.role !== 'admin' && req.user.role !== 'seller') {
        return res.status(403).json({ 
            success: false, 
            message: 'Only admins and sellers can assign delivery agents' 
        });
    }

    // Verify order exists and is ready for agent assignment
    const [orderRows] = await db.execute(`
        SELECT id, status, seller_id, buyer_id
        FROM local_market_orders 
        WHERE id = ? AND status IN ('ready_for_pickup', 'confirmed', 'paid')
    `, [orderId]);

    if (orderRows.length === 0) {
        return res.status(404).json({ 
            success: false, 
            message: 'Order not found or not ready for agent assignment' 
        });
    }

    // Verify agent exists and is available
    const [agentRows] = await db.execute(`
        SELECT id, username, phone, is_active
        FROM users 
        WHERE id = ? AND role = 'agent' AND is_active = 1
    `, [agent_id]);

    if (agentRows.length === 0) {
        return res.status(404).json({ 
            success: false, 
            message: 'Agent not found or not available' 
        });
    }

    // Assign agent and update status
    await db.execute(`
        UPDATE local_market_orders 
        SET fast_agent_id = ?, status = 'assigned_to_agent', updated_at = NOW()
        WHERE id = ?
    `, [agent_id, orderId]);

    res.json({ 
        success: true, 
        message: 'Agent assigned successfully' 
    });
}));

// ====================================================================
// AGENT MANAGEMENT ROUTES
// ====================================================================

// GET /api/local-market/agent/available-orders - Get available orders for agents
router.get('/agent/available-orders', authenticateToken, enhancedErrorHandler(async (req, res) => {
    // Only allow agents to access this
    if (req.user.role !== 'agent') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Agents only.'
        });
    }

    const [orders] = await db.execute(`
        SELECT 
            lmo.*,
            u.username as buyer_name,
            u.phone as buyer_phone,
            seller.username as seller_name,
            seller.phone as seller_phone
        FROM local_market_orders lmo
        LEFT JOIN users u ON lmo.buyer_id = u.id
        LEFT JOIN users seller ON lmo.seller_id = seller.id
        WHERE lmo.status IN ('paid', 'confirmed', 'ready_for_pickup') 
        AND lmo.fast_agent_id IS NULL
        ORDER BY lmo.created_at ASC
    `);

    // Get order items for each order
    for (let order of orders) {
        const [items] = await db.execute(`
            SELECT 
                lmoi.*,
                p.name as product_name
            FROM local_market_order_items lmoi
            LEFT JOIN products p ON lmoi.product_id = p.id
            WHERE lmoi.order_id = ?
        `, [order.id]);
        order.items = items;
    }

    res.json({
        success: true,
        orders: orders,
        message: 'Available orders retrieved successfully'
    });
}));

// POST /api/local-market/agent/accept-order/:orderId - Agent accepts an order
router.post('/agent/accept-order/:orderId', authenticateToken, enhancedErrorHandler(async (req, res) => {
    const { orderId } = req.params;
    const agentId = req.user.id;

    // Only allow agents to access this
    if (req.user.role !== 'agent') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Agents only.'
        });
    }

    // Check if order is available for assignment
    const [orders] = await db.execute(`
        SELECT id, status, buyer_id, seller_id
        FROM local_market_orders 
        WHERE id = ? AND status IN ('paid', 'confirmed', 'ready_for_pickup') 
        AND fast_agent_id IS NULL
    `, [orderId]);

    if (orders.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Order not available for assignment'
        });
    }

    // Assign agent to order
    await db.execute(`
        UPDATE local_market_orders 
        SET fast_agent_id = ?, status = 'assigned_to_agent', updated_at = NOW()
        WHERE id = ?
    `, [agentId, orderId]);

    // Add status history
    await db.execute(`
        INSERT INTO local_market_order_status_history (
            order_id, status, notes, updated_by, created_at
        ) VALUES (?, 'assigned_to_agent', ?, ?, NOW())
    `, [orderId, `Order accepted by agent ${req.user.username}`, agentId]);

    // Emit socket event
    if (req.app.get('io')) {
        req.app.get('io').emit('orderStatusUpdate', {
            orderId: orderId,
            status: 'assigned_to_agent',
            agentId: agentId,
            message: 'Agent assigned to your order'
        });
    }

    res.json({
        success: true,
        message: 'Order accepted successfully'
    });
}));

// GET /api/local-market/agent/my-orders - Get agent's assigned orders
router.get('/agent/my-orders', authenticateToken, enhancedErrorHandler(async (req, res) => {
    // Only allow agents to access this
    if (req.user.role !== 'agent') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Agents only.'
        });
    }

    const [orders] = await db.execute(`
        SELECT 
            lmo.*,
            u.username as buyer_name,
            u.phone as buyer_phone,
            u.email as buyer_email,
            seller.username as seller_name,
            seller.phone as seller_phone
        FROM local_market_orders lmo
        LEFT JOIN users u ON lmo.buyer_id = u.id
        LEFT JOIN users seller ON lmo.seller_id = seller.id
        WHERE lmo.fast_agent_id = ?
        ORDER BY lmo.created_at DESC
    `, [req.user.id]);

    // Get order items for each order
    for (let order of orders) {
        const [items] = await db.execute(`
            SELECT 
                lmoi.*,
                p.name as product_name
            FROM local_market_order_items lmoi
            LEFT JOIN products p ON lmoi.product_id = p.id
            WHERE lmoi.order_id = ?
        `, [order.id]);
        order.items = items;
    }

    res.json({
        success: true,
        orders: orders,
        message: 'Your assigned orders retrieved successfully'
    });
}));

// POST /api/local-market/agent/update-status/:orderId - Agent updates order status
router.post('/agent/update-status/:orderId', authenticateToken, enhancedErrorHandler(async (req, res) => {
    const { orderId } = req.params;
    const { status, notes, location } = req.body;
    const agentId = req.user.id;

    // Only allow agents to access this
    if (req.user.role !== 'agent') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Agents only.'
        });
    }

    // Verify agent is assigned to this order
    const [orders] = await db.execute(`
        SELECT id, buyer_id, seller_id, status as current_status
        FROM local_market_orders 
        WHERE id = ? AND fast_agent_id = ?
    `, [orderId, agentId]);

    if (orders.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Order not found or not assigned to you'
        });
    }

    const order = orders[0];

    // Update order status
    await db.execute(`
        UPDATE local_market_orders 
        SET status = ?, updated_at = NOW()
        WHERE id = ?
    `, [status, orderId]);

    // Add status history
    await db.execute(`
        INSERT INTO local_market_order_status_history (
            order_id, status, notes, updated_by, created_at
        ) VALUES (?, ?, ?, ?, NOW())
    `, [orderId, status, notes || `Status updated by agent ${req.user.username}`, agentId]);

    // If location is provided, update agent location
    if (location && location.latitude && location.longitude) {
        await db.execute(`
            UPDATE users 
            SET latitude = ?, longitude = ?, updated_at = NOW()
            WHERE id = ?
        `, [location.latitude, location.longitude, agentId]);
    }

    // Emit socket event for real-time updates
    if (req.app.get('io')) {
        req.app.get('io').emit('orderStatusUpdate', {
            orderId: orderId,
            status: status,
            buyerId: order.buyer_id,
            sellerId: order.seller_id,
            agentId: agentId,
            message: notes || `Order status updated to ${status}`,
            agentLocation: location
        });
    }

    res.json({
        success: true,
        message: 'Order status updated successfully'
    });
}));

// POST /api/local-market/:orderId/confirm-delivery - Buyer confirms delivery
router.post('/:orderId/confirm-delivery', authenticateToken, enhancedErrorHandler(async (req, res) => {
    const { orderId } = req.params;
    const { confirmation_code, rating, feedback } = req.body;
    const buyerId = req.user.id;

    // Verify order belongs to buyer and is delivered
    const [orders] = await db.execute(`
        SELECT id, fast_agent_id, seller_id, status, total_amount
        FROM local_market_orders 
        WHERE id = ? AND buyer_id = ? AND status = 'delivered'
    `, [orderId, buyerId]);

    if (orders.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Order not found or not ready for confirmation'
        });
    }

    const order = orders[0];

    // Update order status to completed
    await db.execute(`
        UPDATE local_market_orders 
        SET status = 'completed', completed_at = NOW()
        WHERE id = ?
    `, [orderId]);

    // Add rating if provided
    if (rating && rating >= 1 && rating <= 5) {
        await db.execute(`
            INSERT INTO local_market_order_ratings (
                order_id, buyer_id, agent_id, rating, feedback, created_at
            ) VALUES (?, ?, ?, ?, ?, NOW())
        `, [orderId, buyerId, order.fast_agent_id, rating, feedback || '']);

        // Update agent rating
        const [avgRating] = await db.execute(`
            SELECT AVG(rating) as avg_rating, COUNT(*) as total_ratings
            FROM local_market_order_ratings 
            WHERE agent_id = ?
        `, [order.fast_agent_id]);

        if (avgRating[0].avg_rating) {
            await db.execute(`
                UPDATE users 
                SET rating = ?, total_ratings = ?
                WHERE id = ?
            `, [avgRating[0].avg_rating, avgRating[0].total_ratings, order.fast_agent_id]);
        }
    }

    // Add status history
    await db.execute(`
        INSERT INTO local_market_order_status_history (
            order_id, status, notes, updated_by, created_at
        ) VALUES (?, 'completed', ?, ?, NOW())
    `, [orderId, `Order completed and confirmed by buyer${rating ? ` with ${rating} star rating` : ''}`, buyerId]);

    // Emit socket event
    if (req.app.get('io')) {
        req.app.get('io').emit('orderStatusUpdate', {
            orderId: orderId,
            status: 'completed',
            buyerId: buyerId,
            sellerId: order.seller_id,
            agentId: order.fast_agent_id,
            message: 'Order completed successfully'
        });
    }

    res.json({
        success: true,
        message: 'Delivery confirmed successfully',
        rating: rating || null
    });
}));

// POST /api/local-market/:orderId/rating - Submit rating for completed order
router.post('/:orderId/rating', authenticateToken, enhancedErrorHandler(async (req, res) => {
    const { orderId } = req.params;
    const { rating, review } = req.body;
    const buyerId = req.user.id;

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({
            success: false,
            message: 'Rating must be between 1 and 5'
        });
    }

    // Verify order belongs to buyer and is completed/delivered
    const [orders] = await db.execute(`
        SELECT id, fast_agent_id, seller_id, status, total_amount
        FROM local_market_orders 
        WHERE id = ? AND buyer_id = ? AND status IN ('delivered', 'completed')
    `, [orderId, buyerId]);

    if (orders.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Order not found or not eligible for rating'
        });
    }

    const order = orders[0];

    // Check if rating already exists
    const [existingRating] = await db.execute(`
        SELECT id FROM local_market_order_ratings 
        WHERE order_id = ? AND buyer_id = ?
    `, [orderId, buyerId]);

    if (existingRating.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'You have already rated this order'
        });
    }

    // Add rating
    await db.execute(`
        INSERT INTO local_market_order_ratings (
            order_id, buyer_id, agent_id, seller_id, rating, feedback, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, NOW())
    `, [orderId, buyerId, order.fast_agent_id, order.seller_id, rating, review || '']);

    // Update agent rating if agent exists
    if (order.fast_agent_id) {
        const [avgRating] = await db.execute(`
            SELECT AVG(rating) as avg_rating, COUNT(*) as total_ratings
            FROM local_market_order_ratings 
            WHERE agent_id = ?
        `, [order.fast_agent_id]);

        if (avgRating[0].avg_rating) {
            await db.execute(`
                UPDATE users 
                SET rating = ?, total_ratings = ?
                WHERE id = ?
            `, [avgRating[0].avg_rating, avgRating[0].total_ratings, order.fast_agent_id]);
        }
    }

    // Update seller rating
    const [sellerAvgRating] = await db.execute(`
        SELECT AVG(rating) as avg_rating, COUNT(*) as total_ratings
        FROM local_market_order_ratings 
        WHERE seller_id = ?
    `, [order.seller_id]);

    if (sellerAvgRating[0].avg_rating) {
        await db.execute(`
            UPDATE users 
            SET rating = ?, total_ratings = ?
            WHERE id = ?
        `, [sellerAvgRating[0].avg_rating, sellerAvgRating[0].total_ratings, order.seller_id]);
    }

    // Log the rating
    await db.execute(`
        INSERT INTO system_logs (level, message, details, created_at)
        VALUES (?, ?, ?, NOW())
    `, [
        'info',
        `Order rating submitted`,
        JSON.stringify({
            order_id: orderId,
            buyer_id: buyerId,
            rating: rating,
            review: review
        })
    ]);

    res.json({
        success: true,
        message: 'Rating submitted successfully',
        rating: rating
    });
}));

// CONFIRMATION AND DELIVERY SYSTEM
// ====================================================================

// POST /api/local-market/:orderId/assign-agent - Assign agent to order (Admin/System)
router.post('/:orderId/assign-agent', authenticateToken, enhancedErrorHandler(async (req, res) => {
    const { orderId } = req.params;
    const { agentId } = req.body;
    const adminId = req.user.id;

    // Only admins can assign agents
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Only admins can assign agents'
        });
    }

    // Verify agent exists and is active
    const [agents] = await db.execute(`
        SELECT id, name, email, phone FROM users 
        WHERE id = ? AND role = 'agent' AND is_active = 1
    `, [agentId]);

    if (agents.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Agent not found or inactive'
        });
    }

    // Get order details
    const [orders] = await db.execute(`
        SELECT id, buyer_id, seller_id, status, order_number
        FROM local_market_orders 
        WHERE id = ? AND status = 'confirmed'
    `, [orderId]);

    if (orders.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Order not found or not ready for agent assignment'
        });
    }

    const order = orders[0];

    // Update order with agent assignment
    await db.execute(`
        UPDATE local_market_orders 
        SET agent_id = ?, status = 'agent_assigned', agent_assigned_at = NOW()
        WHERE id = ?
    `, [agentId, orderId]);

    // Add status history
    await db.execute(`
        INSERT INTO local_market_order_status_history (
            order_id, status, notes, updated_by, created_at
        ) VALUES (?, 'agent_assigned', ?, ?, NOW())
    `, [orderId, `Agent ${agents[0].name} assigned to order`, adminId]);

    // Emit socket events
    if (req.app.get('io')) {
        // Notify agent
        req.app.get('io').to(`user_${agentId}`).emit('notification', {
            type: 'order_assigned',
            message: `New local market order assigned to you: ${order.order_number}`,
            orderId: orderId
        });

        // Notify buyer
        req.app.get('io').to(`user_${order.buyer_id}`).emit('notification', {
            type: 'agent_assigned',
            message: `Agent ${agents[0].name} has been assigned to your order`,
            orderId: orderId
        });

        // Notify seller
        req.app.get('io').to(`user_${order.seller_id}`).emit('notification', {
            type: 'agent_assigned',
            message: `Agent assigned to order ${order.order_number}`,
            orderId: orderId
        });
    }

    res.json({
        success: true,
        message: 'Agent assigned successfully',
        agent: agents[0],
        orderId: orderId
    });
}));

// POST /api/local-market/:orderId/agent-confirm-pickup - Agent confirms pickup from seller
router.post('/:orderId/agent-confirm-pickup', authenticateToken, enhancedErrorHandler(async (req, res) => {
    const { orderId } = req.params;
    const { notes, pickupCode } = req.body;
    const agentId = req.user.id;

    // Verify agent role
    if (req.user.role !== 'agent') {
        return res.status(403).json({
            success: false,
            message: 'Only agents can confirm pickup'
        });
    }

    // Get order details
    const [orders] = await db.execute(`
        SELECT id, buyer_id, seller_id, agent_id, status, order_number, pickup_code
        FROM local_market_orders 
        WHERE id = ? AND agent_id = ? AND status = 'agent_assigned'
    `, [orderId, agentId]);

    if (orders.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Order not found or not assigned to you'
        });
    }

    const order = orders[0];

    // Verify pickup code if provided
    if (order.pickup_code && pickupCode !== order.pickup_code) {
        return res.status(400).json({
            success: false,
            message: 'Invalid pickup code'
        });
    }

    // Update order status to picked up
    await db.execute(`
        UPDATE local_market_orders 
        SET status = 'picked_up', picked_up_at = NOW(), pickup_notes = ?
        WHERE id = ?
    `, [notes || 'Items picked up by agent', orderId]);

    // Add status history
    await db.execute(`
        INSERT INTO local_market_order_status_history (
            order_id, status, notes, updated_by, created_at
        ) VALUES (?, 'picked_up', ?, ?, NOW())
    `, [orderId, `Items picked up by agent: ${notes || 'No additional notes'}`, agentId]);

    // Emit socket events
    if (req.app.get('io')) {
        // Notify buyer
        req.app.get('io').to(`user_${order.buyer_id}`).emit('notification', {
            type: 'order_picked_up',
            message: `Your order ${order.order_number} has been picked up and is on the way`,
            orderId: orderId
        });

        // Notify seller
        req.app.get('io').to(`user_${order.seller_id}`).emit('notification', {
            type: 'order_picked_up',
            message: `Order ${order.order_number} has been picked up by agent`,
            orderId: orderId
        });
    }

    res.json({
        success: true,
        message: 'Pickup confirmed successfully',
        orderId: orderId,
        status: 'picked_up'
    });
}));

// POST /api/local-market/:orderId/agent-start-delivery - Agent starts delivery to buyer
router.post('/:orderId/agent-start-delivery', authenticateToken, enhancedErrorHandler(async (req, res) => {
    const { orderId } = req.params;
    const { estimatedDeliveryTime, currentLocation } = req.body;
    const agentId = req.user.id;

    // Verify agent role
    if (req.user.role !== 'agent') {
        return res.status(403).json({
            success: false,
            message: 'Only agents can start delivery'
        });
    }

    // Get order details
    const [orders] = await db.execute(`
        SELECT id, buyer_id, seller_id, agent_id, status, order_number
        FROM local_market_orders 
        WHERE id = ? AND agent_id = ? AND status = 'picked_up'
    `, [orderId, agentId]);

    if (orders.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Order not found or not ready for delivery'
        });
    }

    const order = orders[0];

    // Update order status to in delivery
    await db.execute(`
        UPDATE local_market_orders 
        SET status = 'in_delivery', delivery_started_at = NOW(), 
            estimated_delivery_time = ?, current_location = ?
        WHERE id = ?
    `, [estimatedDeliveryTime, currentLocation, orderId]);

    // Add status history
    await db.execute(`
        INSERT INTO local_market_order_status_history (
            order_id, status, notes, updated_by, created_at
        ) VALUES (?, 'in_delivery', ?, ?, NOW())
    `, [orderId, `Delivery started. ETA: ${estimatedDeliveryTime || 'Not specified'}`, agentId]);

    // Emit socket events
    if (req.app.get('io')) {
        // Notify buyer
        req.app.get('io').to(`user_${order.buyer_id}`).emit('notification', {
            type: 'delivery_started',
            message: `Your order ${order.order_number} is now being delivered`,
            orderId: orderId,
            estimatedTime: estimatedDeliveryTime
        });
    }

    res.json({
        success: true,
        message: 'Delivery started successfully',
        orderId: orderId,
        status: 'in_delivery'
    });
}));

// POST /api/local-market/:orderId/agent-confirm-delivery - Agent confirms delivery to buyer
router.post('/:orderId/agent-confirm-delivery', authenticateToken, enhancedErrorHandler(async (req, res) => {
    const { orderId } = req.params;
    const { deliveryCode, notes, deliveryProof } = req.body;
    const agentId = req.user.id;

    // Verify agent role
    if (req.user.role !== 'agent') {
        return res.status(403).json({
            success: false,
            message: 'Only agents can confirm delivery'
        });
    }

    // Get order details
    const [orders] = await db.execute(`
        SELECT id, buyer_id, seller_id, agent_id, status, order_number, delivery_code, total_amount
        FROM local_market_orders 
        WHERE id = ? AND agent_id = ? AND status = 'in_delivery'
    `, [orderId, agentId]);

    if (orders.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Order not found or not ready for delivery confirmation'
        });
    }

    const order = orders[0];

    // Verify delivery code if provided
    if (order.delivery_code && deliveryCode !== order.delivery_code) {
        return res.status(400).json({
            success: false,
            message: 'Invalid delivery code'
        });
    }

    // Update order status to delivered
    await db.execute(`
        UPDATE local_market_orders 
        SET status = 'delivered', delivered_at = NOW(), 
            delivery_notes = ?, delivery_proof_url = ?
        WHERE id = ?
    `, [notes || 'Order delivered successfully', deliveryProof, orderId]);

    // Add status history
    await db.execute(`
        INSERT INTO local_market_order_status_history (
            order_id, status, notes, updated_by, created_at
        ) VALUES (?, 'delivered', ?, ?, NOW())
    `, [orderId, `Order delivered by agent: ${notes || 'No additional notes'}`, agentId]);

    // Create payment release request automatically
    await db.execute(`
        INSERT INTO payment_release_requests (
            order_id, order_type, requester_id, requester_type, amount, 
            status, request_reason, created_at
        ) VALUES (?, 'local_market', ?, 'agent', ?, 'pending', 
                 'Automatic payment release request after delivery completion', NOW())
    `, [orderId, agentId, order.total_amount]);

    // Emit socket events
    if (req.app.get('io')) {
        // Notify buyer for confirmation
        req.app.get('io').to(`user_${order.buyer_id}`).emit('notification', {
            type: 'delivery_completed',
            message: `Your order ${order.order_number} has been delivered. Please confirm receipt.`,
            orderId: orderId,
            requiresConfirmation: true
        });

        // Notify seller
        req.app.get('io').to(`user_${order.seller_id}`).emit('notification', {
            type: 'order_delivered',
            message: `Order ${order.order_number} has been delivered to buyer`,
            orderId: orderId
        });
    }

    res.json({
        success: true,
        message: 'Delivery confirmed successfully. Awaiting buyer confirmation.',
        orderId: orderId,
        status: 'delivered'
    });
}));

// POST /api/local-market/:orderId/buyer-confirm-receipt - Buyer confirms receipt of order
router.post('/:orderId/buyer-confirm-receipt', authenticateToken, enhancedErrorHandler(async (req, res) => {
    const { orderId } = req.params;
    const { rating, review, satisfactionLevel } = req.body;
    const buyerId = req.user.id;

    // Get order details
    const [orders] = await db.execute(`
        SELECT id, buyer_id, seller_id, agent_id, status, order_number, total_amount
        FROM local_market_orders 
        WHERE id = ? AND buyer_id = ? AND status = 'delivered'
    `, [orderId, buyerId]);

    if (orders.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Order not found or not ready for confirmation'
        });
    }

    const order = orders[0];

    // Update order status to completed
    await db.execute(`
        UPDATE local_market_orders 
        SET status = 'completed', completed_at = NOW(), 
            buyer_rating = ?, buyer_review = ?, satisfaction_level = ?
        WHERE id = ?
    `, [rating, review, satisfactionLevel, orderId]);

    // Add status history
    await db.execute(`
        INSERT INTO local_market_order_status_history (
            order_id, status, notes, updated_by, created_at
        ) VALUES (?, 'completed', ?, ?, NOW())
    `, [orderId, `Order confirmed by buyer${rating ? ` with ${rating} star rating` : ''}`, buyerId]);

    // Update payment release request to approved
    await db.execute(`
        UPDATE payment_release_requests 
        SET status = 'approved', approved_at = NOW(), approved_by = ?
        WHERE order_id = ? AND order_type = 'local_market' AND status = 'pending'
    `, [buyerId, orderId]);

    // Emit socket events
    if (req.app.get('io')) {
        // Notify agent
        if (order.agent_id) {
            req.app.get('io').to(`user_${order.agent_id}`).emit('notification', {
                type: 'order_completed',
                message: `Order ${order.order_number} completed successfully. Payment will be released.`,
                orderId: orderId
            });
        }

        // Notify seller
        req.app.get('io').to(`user_${order.seller_id}`).emit('notification', {
            type: 'order_completed',
            message: `Order ${order.order_number} completed. Payment will be released.`,
            orderId: orderId
        });
    }

    res.json({
        success: true,
        message: 'Order confirmed successfully. Payment release approved.',
        orderId: orderId,
        status: 'completed'
    });
}));

// ADMIN PAYMENT APPROVAL ENDPOINTS
// ====================================================================

// POST /api/local-market/:orderId/approve-payment - Admin approve payment
router.post('/:orderId/approve-payment', authenticateToken, enhancedErrorHandler(async (req, res) => {
    const { orderId } = req.params;
    const { notes } = req.body;
    const adminId = req.user.id;

    // Only admins can approve payments
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Only admins can approve payments'
        });
    }

    // Get order details
    const [orders] = await db.execute(`
        SELECT id, buyer_id, seller_id, total_amount, status, payment_method, payment_proof_url
        FROM local_market_orders 
        WHERE id = ? AND status = 'pending_payment'
    `, [orderId]);

    if (orders.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Order not found or not pending payment verification'
        });
    }

    const order = orders[0];

    // Update order status to confirmed
    await db.execute(`
        UPDATE local_market_orders 
        SET status = 'confirmed', payment_verified_at = NOW(), payment_verified_by = ?
        WHERE id = ?
    `, [adminId, orderId]);

    // Add status history
    await db.execute(`
        INSERT INTO local_market_order_status_history (
            order_id, status, notes, updated_by, created_at
        ) VALUES (?, 'confirmed', ?, ?, NOW())
    `, [orderId, `Payment approved by admin: ${notes || 'Payment verified'}`, adminId]);

    // Log the approval
    await db.execute(`
        INSERT INTO system_logs (level, message, details, created_at)
        VALUES (?, ?, ?, NOW())
    `, [
        'info',
        `Local market payment approved`,
        JSON.stringify({
            order_id: orderId,
            admin_id: adminId,
            amount: order.total_amount,
            notes: notes
        })
    ]);

    // Emit socket event for real-time updates
    if (req.app.get('io')) {
        req.app.get('io').emit('orderStatusUpdate', {
            orderId: orderId,
            status: 'confirmed',
            buyerId: order.buyer_id,
            sellerId: order.seller_id,
            message: 'Payment approved by admin'
        });

        // Notify buyer
        req.app.get('io').to(`user_${order.buyer_id}`).emit('notification', {
            type: 'payment_approved',
            message: 'Your payment has been verified and approved',
            orderId: orderId
        });

        // Notify seller
        req.app.get('io').to(`user_${order.seller_id}`).emit('notification', {
            type: 'order_confirmed',
            message: 'New order confirmed - start preparing items',
            orderId: orderId
        });
    }

    res.json({
        success: true,
        message: 'Payment approved successfully',
        orderId: orderId,
        status: 'confirmed'
    });
}));

// POST /api/local-market/:orderId/reject-payment - Admin reject payment
router.post('/:orderId/reject-payment', authenticateToken, enhancedErrorHandler(async (req, res) => {
    const { orderId } = req.params;
    const { notes } = req.body;
    const adminId = req.user.id;

    // Only admins can reject payments
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Only admins can reject payments'
        });
    }

    // Get order details
    const [orders] = await db.execute(`
        SELECT id, buyer_id, seller_id, total_amount, status, payment_method, payment_proof_url
        FROM local_market_orders 
        WHERE id = ? AND status = 'pending_payment'
    `, [orderId]);

    if (orders.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Order not found or not pending payment verification'
        });
    }

    const order = orders[0];

    // Update order status to payment_rejected
    await db.execute(`
        UPDATE local_market_orders 
        SET status = 'payment_rejected', payment_rejected_at = NOW(), payment_rejected_by = ?
        WHERE id = ?
    `, [adminId, orderId]);

    // Add status history
    await db.execute(`
        INSERT INTO local_market_order_status_history (
            order_id, status, notes, updated_by, created_at
        ) VALUES (?, 'payment_rejected', ?, ?, NOW())
    `, [orderId, `Payment rejected by admin: ${notes || 'Payment verification failed'}`, adminId]);

    // Log the rejection
    await db.execute(`
        INSERT INTO system_logs (level, message, details, created_at)
        VALUES (?, ?, ?, NOW())
    `, [
        'info',
        `Local market payment rejected`,
        JSON.stringify({
            order_id: orderId,
            admin_id: adminId,
            amount: order.total_amount,
            notes: notes
        })
    ]);

    // Emit socket event for real-time updates
    if (req.app.get('io')) {
        req.app.get('io').emit('orderStatusUpdate', {
            orderId: orderId,
            status: 'payment_rejected',
            buyerId: order.buyer_id,
            sellerId: order.seller_id,
            message: 'Payment rejected by admin'
        });

        // Notify buyer
        req.app.get('io').to(`user_${order.buyer_id}`).emit('notification', {
            type: 'payment_rejected',
            message: `Your payment was rejected: ${notes || 'Please contact support'}`,
            orderId: orderId
        });
    }

    res.json({
        success: true,
        message: 'Payment rejected successfully',
        orderId: orderId,
        status: 'payment_rejected'
    });
}));

// GET /api/admin/local-market-payments - Get pending local market payments for admin
router.get('/admin/local-market-payments', authenticateToken, enhancedErrorHandler(async (req, res) => {
    // Only admins can access this
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Admin access required'
        });
    }

    const { status = 'pending_payment', limit = 100 } = req.query;

    const [payments] = await db.execute(`
        SELECT 
            lmo.id,
            lmo.order_number,
            lmo.total_amount,
            lmo.status,
            lmo.payment_method,
            lmo.payment_proof_url,
            lmo.payment_reference,
            lmo.created_at,
            lmo.delivery_address,
            u.name as buyer_name,
            u.email as buyer_email,
            u.phone as buyer_phone,
            lmo.order_details
        FROM local_market_orders lmo
        JOIN users u ON lmo.buyer_id = u.id
        WHERE lmo.status = ?
        ORDER BY lmo.created_at DESC
        LIMIT ?
    `, [status, parseInt(limit)]);

    // Format the data for admin interface
    const formattedPayments = payments.map(payment => ({
        id: payment.id,
        order_number: payment.order_number,
        type: 'LOCAL_MARKET_PAYMENT',
        amount: payment.total_amount,
        total_amount: payment.total_amount,
        status: payment.status,
        payment_method: payment.payment_method,
        payment_proof_url: payment.payment_proof_url,
        payment_reference: payment.payment_reference,
        requester_name: payment.buyer_name,
        requester_email: payment.buyer_email,
        requester_phone: payment.buyer_phone,
        delivery_address: payment.delivery_address,
        created_at: payment.created_at,
        order_details: payment.order_details
    }));

    res.json({
        success: true,
        payments: formattedPayments,
        total: formattedPayments.length
    });
}));

// PAYMENT RELEASE REQUEST SYSTEM
// ====================================================================

// GET /api/local-market/payment-release-requests - Get payment release requests
router.get('/payment-release-requests', authenticateToken, enhancedErrorHandler(async (req, res) => {
    const { status = 'pending', limit = 50 } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;

    let query = `
        SELECT 
            prr.id,
            prr.order_id,
            prr.order_type,
            prr.requester_id,
            prr.requester_type,
            prr.amount,
            prr.status,
            prr.request_reason,
            prr.created_at,
            prr.approved_at,
            prr.approved_by,
            lmo.order_number,
            lmo.buyer_id,
            lmo.seller_id,
            lmo.agent_id,
            u_requester.name as requester_name,
            u_requester.email as requester_email,
            u_buyer.name as buyer_name,
            u_seller.name as seller_name,
            u_agent.name as agent_name
        FROM payment_release_requests prr
        JOIN local_market_orders lmo ON prr.order_id = lmo.id
        JOIN users u_requester ON prr.requester_id = u_requester.id
        LEFT JOIN users u_buyer ON lmo.buyer_id = u_buyer.id
        LEFT JOIN users u_seller ON lmo.seller_id = u_seller.id
        LEFT JOIN users u_agent ON lmo.agent_id = u_agent.id
        WHERE prr.order_type = 'local_market' AND prr.status = ?
    `;

    const params = [status];

    // Filter based on user role
    if (userRole !== 'admin') {
        query += ` AND (lmo.buyer_id = ? OR lmo.seller_id = ? OR lmo.agent_id = ? OR prr.requester_id = ?)`;
        params.push(userId, userId, userId, userId);
    }

    query += ` ORDER BY prr.created_at DESC LIMIT ?`;
    params.push(parseInt(limit));

    const [requests] = await db.execute(query, params);

    res.json({
        success: true,
        requests: requests,
        total: requests.length
    });
}));

// POST /api/local-market/:orderId/request-payment-release - Request payment release
router.post('/:orderId/request-payment-release', authenticateToken, enhancedErrorHandler(async (req, res) => {
    const { orderId } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Get order details
    const [orders] = await db.execute(`
        SELECT id, buyer_id, seller_id, agent_id, status, order_number, total_amount
        FROM local_market_orders 
        WHERE id = ? AND status IN ('delivered', 'completed')
    `, [orderId]);

    if (orders.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Order not found or not eligible for payment release'
        });
    }

    const order = orders[0];

    // Verify user is involved in the order
    if (order.buyer_id !== userId && order.seller_id !== userId && 
        order.agent_id !== userId && userRole !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'You are not authorized to request payment release for this order'
        });
    }

    // Check if payment release request already exists
    const [existingRequests] = await db.execute(`
        SELECT id FROM payment_release_requests 
        WHERE order_id = ? AND order_type = 'local_market' AND status = 'pending'
    `, [orderId]);

    if (existingRequests.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Payment release request already exists for this order'
        });
    }

    // Create payment release request
    const [result] = await db.execute(`
        INSERT INTO payment_release_requests (
            order_id, order_type, requester_id, requester_type, amount, 
            status, request_reason, created_at
        ) VALUES (?, 'local_market', ?, ?, ?, 'pending', ?, NOW())
    `, [orderId, userId, userRole, order.total_amount, reason || 'Payment release requested']);

    // Add status history
    await db.execute(`
        INSERT INTO local_market_order_status_history (
            order_id, status, notes, updated_by, created_at
        ) VALUES (?, 'payment_release_requested', ?, ?, NOW())
    `, [orderId, `Payment release requested by ${userRole}: ${reason || 'No reason provided'}`, userId]);

    // Emit socket events to notify relevant parties
    if (req.app.get('io')) {
        // Notify admin
        req.app.get('io').emit('admin_notification', {
            type: 'payment_release_request',
            message: `New payment release request for order ${order.order_number}`,
            orderId: orderId,
            requestId: result.insertId
        });

        // Notify all parties involved
        const notifyUsers = [order.buyer_id, order.seller_id];
        if (order.agent_id) notifyUsers.push(order.agent_id);

        notifyUsers.forEach(notifyUserId => {
            if (notifyUserId !== userId) {
                req.app.get('io').to(`user_${notifyUserId}`).emit('notification', {
                    type: 'payment_release_requested',
                    message: `Payment release requested for order ${order.order_number}`,
                    orderId: orderId
                });
            }
        });
    }

    res.json({
        success: true,
        message: 'Payment release request submitted successfully',
        requestId: result.insertId,
        orderId: orderId
    });
}));

// POST /api/local-market/payment-release-requests/:requestId/approve - Approve payment release (Admin only)
router.post('/payment-release-requests/:requestId/approve', authenticateToken, enhancedErrorHandler(async (req, res) => {
    const { requestId } = req.params;
    const { notes } = req.body;
    const adminId = req.user.id;

    // Only admins can approve payment releases
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Only admins can approve payment releases'
        });
    }

    // Get request details
    const [requests] = await db.execute(`
        SELECT 
            prr.id, prr.order_id, prr.amount, prr.status,
            lmo.order_number, lmo.buyer_id, lmo.seller_id, lmo.agent_id
        FROM payment_release_requests prr
        JOIN local_market_orders lmo ON prr.order_id = lmo.id
        WHERE prr.id = ? AND prr.status = 'pending'
    `, [requestId]);

    if (requests.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Payment release request not found or already processed'
        });
    }

    const request = requests[0];

    // Update request status to approved
    await db.execute(`
        UPDATE payment_release_requests 
        SET status = 'approved', approved_at = NOW(), approved_by = ?, admin_notes = ?
        WHERE id = ?
    `, [adminId, notes || 'Payment release approved by admin', requestId]);

    // Add status history
    await db.execute(`
        INSERT INTO local_market_order_status_history (
            order_id, status, notes, updated_by, created_at
        ) VALUES (?, 'payment_released', ?, ?, NOW())
    `, [request.order_id, `Payment release approved: ${notes || 'No additional notes'}`, adminId]);

    // Log the approval
    await db.execute(`
        INSERT INTO system_logs (level, message, details, created_at)
        VALUES (?, ?, ?, NOW())
    `, [
        'info',
        `Payment release approved for local market order`,
        JSON.stringify({
            request_id: requestId,
            order_id: request.order_id,
            order_number: request.order_number,
            amount: request.amount,
            admin_id: adminId,
            notes: notes
        })
    ]);

    // Emit socket events
    if (req.app.get('io')) {
        // Notify all parties involved
        const notifyUsers = [request.buyer_id, request.seller_id];
        if (request.agent_id) notifyUsers.push(request.agent_id);

        notifyUsers.forEach(userId => {
            req.app.get('io').to(`user_${userId}`).emit('notification', {
                type: 'payment_released',
                message: `Payment has been released for order ${request.order_number}`,
                orderId: request.order_id,
                amount: request.amount
            });
        });
    }

    res.json({
        success: true,
        message: 'Payment release approved successfully',
        requestId: requestId,
        orderId: request.order_id,
        amount: request.amount
    });
}));

// POST /api/local-market/payment-release-requests/:requestId/reject - Reject payment release (Admin only)
router.post('/payment-release-requests/:requestId/reject', authenticateToken, enhancedErrorHandler(async (req, res) => {
    const { requestId } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;

    // Only admins can reject payment releases
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Only admins can reject payment releases'
        });
    }

    if (!reason) {
        return res.status(400).json({
            success: false,
            message: 'Rejection reason is required'
        });
    }

    // Get request details
    const [requests] = await db.execute(`
        SELECT 
            prr.id, prr.order_id, prr.amount, prr.status,
            lmo.order_number, lmo.buyer_id, lmo.seller_id, lmo.agent_id
        FROM payment_release_requests prr
        JOIN local_market_orders lmo ON prr.order_id = lmo.id
        WHERE prr.id = ? AND prr.status = 'pending'
    `, [requestId]);

    if (requests.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Payment release request not found or already processed'
        });
    }

    const request = requests[0];

    // Update request status to rejected
    await db.execute(`
        UPDATE payment_release_requests 
        SET status = 'rejected', rejected_at = NOW(), rejected_by = ?, rejection_reason = ?
        WHERE id = ?
    `, [adminId, reason, requestId]);

    // Add status history
    await db.execute(`
        INSERT INTO local_market_order_status_history (
            order_id, status, notes, updated_by, created_at
        ) VALUES (?, 'payment_release_rejected', ?, ?, NOW())
    `, [request.order_id, `Payment release rejected: ${reason}`, adminId]);

    // Emit socket events
    if (req.app.get('io')) {
        // Notify all parties involved
        const notifyUsers = [request.buyer_id, request.seller_id];
        if (request.agent_id) notifyUsers.push(request.agent_id);

        notifyUsers.forEach(userId => {
            req.app.get('io').to(`user_${userId}`).emit('notification', {
                type: 'payment_release_rejected',
                message: `Payment release rejected for order ${request.order_number}: ${reason}`,
                orderId: request.order_id
            });
        });
    }

    res.json({
        success: true,
        message: 'Payment release request rejected',
        requestId: requestId,
        orderId: request.order_id,
        reason: reason
    });
}));

// AGENT ENDPOINTS
// ====================================================================

// GET /api/local-market/agent/orders - Get orders assigned to agent
router.get('/agent/orders', authenticateToken, enhancedErrorHandler(async (req, res) => {
    const agentId = req.user.id;

    // Only agents can access this endpoint
    if (req.user.role !== 'agent') {
        return res.status(403).json({
            success: false,
            message: 'Only agents can access this endpoint'
        });
    }

    const { status, limit = 50 } = req.query;

    let query = `
        SELECT 
            lmo.*,
            u_buyer.name as buyer_name,
            u_buyer.email as buyer_email,
            u_buyer.phone as buyer_phone,
            u_seller.name as seller_name,
            u_seller.email as seller_email,
            u_seller.phone as seller_phone
        FROM local_market_orders lmo
        LEFT JOIN users u_buyer ON lmo.buyer_id = u_buyer.id
        LEFT JOIN users u_seller ON lmo.seller_id = u_seller.id
        WHERE lmo.agent_id = ?
    `;

    const params = [agentId];

    if (status) {
        query += ` AND lmo.status = ?`;
        params.push(status);
    }

    query += ` ORDER BY lmo.created_at DESC LIMIT ?`;
    params.push(parseInt(limit));

    const [orders] = await db.execute(query, params);

    res.json({
        success: true,
        orders: orders,
        total: orders.length
    });
}));

// ADMIN ENDPOINTS
// ====================================================================

// GET /api/local-market/payment-release-requests - Get payment release requests for admin
router.get('/payment-release-requests', authenticateToken, enhancedErrorHandler(async (req, res) => {
    // Only admins can access this endpoint
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Only admins can access this endpoint'
        });
    }

    const { status = 'pending', limit = 50 } = req.query;

    const query = `
        SELECT 
            lmo.*,
            u_buyer.name as buyer_name,
            u_buyer.email as buyer_email,
            u_buyer.phone as buyer_phone,
            u_seller.name as seller_name,
            u_seller.email as seller_email,
            u_seller.phone as seller_phone,
            u_agent.name as agent_name,
            u_agent.phone as agent_phone
        FROM local_market_orders lmo
        LEFT JOIN users u_buyer ON lmo.buyer_id = u_buyer.id
        LEFT JOIN users u_seller ON lmo.seller_id = u_seller.id
        LEFT JOIN users u_agent ON lmo.agent_id = u_agent.id
        WHERE lmo.payment_release_requested = 1
        AND lmo.payment_released = 0
        ORDER BY lmo.updated_at DESC
        LIMIT ?
    `;

    const [requests] = await db.execute(query, [parseInt(limit)]);

    res.json({
        success: true,
        requests: requests,
        total: requests.length
    });
}));

// POST /api/local-market/payment-release-requests/:id/approve - Approve payment release
router.post('/payment-release-requests/:id/approve', authenticateToken, enhancedErrorHandler(async (req, res) => {
    const orderId = req.params.id;
    const adminId = req.user.id;

    // Only admins can approve payment releases
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Only admins can approve payment releases'
        });
    }

    const { notes } = req.body;

    // Update order to release payment
    await db.execute(`
        UPDATE local_market_orders 
        SET payment_released = 1,
            payment_release_approved_by = ?,
            payment_release_approved_at = NOW(),
            payment_release_notes = ?,
            updated_at = NOW()
        WHERE id = ?
    `, [adminId, notes || 'Payment release approved by admin', orderId]);

    // Log the action
    await db.execute(`
        INSERT INTO local_market_order_logs (order_id, action, details, created_by, created_at)
        VALUES (?, ?, ?, ?, NOW())
    `, [
        orderId,
        'payment_released',
        `Payment released by admin: ${notes || 'No additional notes'}`,
        adminId
    ]);

    res.json({
        success: true,
        message: 'Payment release approved successfully'
    });
}));

// GET /api/local-market/admin/local-market-payments - Get local market payments for admin
router.get('/admin/local-market-payments', authenticateToken, enhancedErrorHandler(async (req, res) => {
    // Only admins can access this endpoint
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Only admins can access this endpoint'
        });
    }

    const { status = 'pending_payment', limit = 50 } = req.query;

    const query = `
        SELECT 
            lmo.*,
            u_buyer.name as buyer_name,
            u_buyer.email as buyer_email,
            u_buyer.phone as buyer_phone,
            u_seller.name as seller_name,
            u_seller.email as seller_email,
            u_seller.phone as seller_phone
        FROM local_market_orders lmo
        LEFT JOIN users u_buyer ON lmo.buyer_id = u_buyer.id
        LEFT JOIN users u_seller ON lmo.seller_id = u_seller.id
        WHERE lmo.status = ?
        ORDER BY lmo.created_at DESC
        LIMIT ?
    `;

    const [payments] = await db.execute(query, [status, parseInt(limit)]);

    res.json({
        success: true,
        payments: payments,
        total: payments.length
    });
}));

// ====================================================================
// SELLER ENDPOINTS
// ====================================================================

// Get orders for sellers (local market sellers)
router.get('/seller/orders', authenticateToken, async (req, res) => {
    try {
        console.log('[SELLER] Fetching local market orders for seller...');
        const sellerId = req.user.id;
        const { status, limit = 50, offset = 0 } = req.query;
        
        let whereClause = 'WHERE 1=1';
        let queryParams = [];
        
        // For local market, we'll show all orders since they're centralized
        // But we can filter by status if needed
        if (status && status !== 'all') {
            whereClause += ' AND lmo.status = ?';
            queryParams.push(status);
        }
        
        const ordersQuery = `
            SELECT 
                lmo.*,
                u.name as buyer_name,
                u.phone as buyer_phone,
                u.email as buyer_email,
                u.address as buyer_address,
                COUNT(lmoi.id) as total_items,
                GROUP_CONCAT(CONCAT(lmoi.quantity, 'x ', lmoi.product_name) SEPARATOR ', ') as items_summary,
                agent.name as agent_name,
                agent.phone as agent_phone,
                CASE 
                    WHEN lmo.status = 'pending' THEN 'Awaiting Payment'
                    WHEN lmo.status = 'confirmed' THEN 'Payment Confirmed'
                    WHEN lmo.status = 'preparing' THEN 'Preparing Order'
                    WHEN lmo.status = 'ready_for_pickup' THEN 'Ready for Pickup'
                    WHEN lmo.status = 'out_for_delivery' THEN 'Out for Delivery'
                    WHEN lmo.status = 'delivered' THEN 'Delivered'
                    WHEN lmo.status = 'cancelled' THEN 'Cancelled'
                    ELSE lmo.status
                END as status_display,
                TIMESTAMPDIFF(MINUTE, lmo.created_at, NOW()) as minutes_ago
            FROM local_market_orders lmo
            LEFT JOIN users u ON lmo.buyer_id = u.id
            LEFT JOIN local_market_order_items lmoi ON lmo.id = lmoi.order_id
            LEFT JOIN users agent ON lmo.agent_id = agent.id
            ${whereClause}
            GROUP BY lmo.id
            ORDER BY lmo.created_at DESC
            LIMIT ? OFFSET ?
        `;
        
        queryParams.push(parseInt(limit), parseInt(offset));
        
        const [orders] = await db.execute(ordersQuery, queryParams);
        
        // Get order statistics
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
        
        const [stats] = await db.execute(statsQuery);
        
        console.log(`[SELLER] Found ${orders.length} orders for seller`);
        
        res.json({
            success: true,
            orders: orders,
            stats: stats[0] || {},
            total: orders.length
        });
        
    } catch (error) {
        console.error('[SELLER] Error fetching orders:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch orders',
            error: error.message
        });
    }
});

// Update order status (seller perspective)
router.post('/seller/orders/:orderId/status', authenticateToken, async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status, notes } = req.body;
        const sellerId = req.user.id;
        
        console.log(`[SELLER] Updating order ${orderId} status to ${status}`);
        
        // Verify order exists and get current status
        const orderQuery = 'SELECT * FROM local_market_orders WHERE id = ?';
        const [orders] = await db.execute(orderQuery, [orderId]);
        
        if (orders.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }
        
        const order = orders[0];
        
        // Validate status transitions
        const validTransitions = {
            'pending': ['cancelled'],
            'confirmed': ['preparing', 'cancelled'],
            'preparing': ['ready_for_pickup', 'cancelled'],
            'ready_for_pickup': ['out_for_delivery', 'cancelled'],
            'out_for_delivery': ['delivered'],
            'delivered': [],
            'cancelled': []
        };
        
        if (!validTransitions[order.status] || !validTransitions[order.status].includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot change status from ${order.status} to ${status}`
            });
        }
        
        // Update order status
        let updateQuery = `
            UPDATE local_market_orders 
            SET status = ?, updated_at = NOW()
        `;
        let queryParams = [status];
        
        // Add specific timestamp fields based on status
        if (status === 'confirmed') {
            updateQuery += ', confirmed_at = NOW()';
        } else if (status === 'preparing') {
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
            updateQuery += ', seller_notes = ?';
            queryParams.push(notes);
        }
        
        updateQuery += ' WHERE id = ?';
        queryParams.push(orderId);
        
        await db.execute(updateQuery, queryParams);
        
        // If status is ready_for_pickup, notify available agents
        if (status === 'ready_for_pickup') {
            // This would trigger notifications to fast delivery agents
            console.log(`[SELLER] Order ${orderId} is ready for pickup - notifying agents`);
        }
        
        res.json({
            success: true,
            message: 'Order status updated successfully'
        });
        
    } catch (error) {
        console.error('[SELLER] Error updating order status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update order status',
            error: error.message
        });
    }
});

// Get order details for seller
router.get('/seller/orders/:orderId', authenticateToken, async (req, res) => {
    try {
        const { orderId } = req.params;
        const sellerId = req.user.id;
        
        console.log(`[SELLER] Fetching order details for ${orderId}`);
        
        const orderQuery = `
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
        
        const [orders] = await db.execute(orderQuery, [orderId]);
        
        if (orders.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }
        
        // Get order items
        const itemsQuery = `
            SELECT * FROM local_market_order_items 
            WHERE order_id = ?
            ORDER BY created_at ASC
        `;
        
        const [items] = await db.execute(itemsQuery, [orderId]);
        
        const order = orders[0];
        order.items = items;
        
        res.json({
            success: true,
            order: order
        });
        
    } catch (error) {
        console.error('[SELLER] Error fetching order details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch order details',
            error: error.message
        });
    }
});

console.log('✅ [LOCAL-MARKET-ORDERS] Local market orders routes loaded successfully');

module.exports = router;