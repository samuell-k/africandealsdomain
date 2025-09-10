/**
 * Remaining Order Management Endpoints for Admin
 * Fixes data structure and type issues, adds missing endpoints
 */

const express = require('express');
const router = express.Router();
const db = require('../db.js');
const { requireAuth, requireRole } = require('./auth.js');

// ====================================================================
// ENHANCED ERROR HANDLING SYSTEM
// ====================================================================

const enhancedErrorHandler = (routeHandler) => {
    return async (req, res, next) => {
        const startTime = Date.now();
        
        try {
            // Enhanced logging
            console.log(`📡 [ORDERS-API] ${req.method} ${req.originalUrl}`);
            console.log(`👤 [ORDERS-API] User: ${req.user?.email || 'unknown'} (Role: ${req.user?.role || 'unknown'})`);
            console.log(`📊 [ORDERS-API] Query params:`, req.query);
            console.log(`📦 [ORDERS-API] Body:`, req.body);
            
            await routeHandler(req, res, next);
            
            const duration = Date.now() - startTime;
            console.log(`⚡ [ORDERS-API] Request completed in ${duration}ms`);
            
        } catch (error) {
            const duration = Date.now() - startTime;
            
            // Comprehensive error logging
            console.error(`❌ [ORDERS-API] ERROR in ${req.method} ${req.originalUrl}`);
            console.error(`⏱️ [ORDERS-API] Failed after ${duration}ms`);
            console.error(`👤 [ORDERS-API] User: ${req.user?.email || 'unknown'}`);
            console.error(`💥 [ORDERS-API] Error details:`, {
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

console.log('🔧 [REMAIN-ORDER-ENDPOINTS] Loading remaining order endpoints...');

// Apply authentication middleware to all routes
router.use(requireAuth);
router.use(requireRole('admin'));

// ==================== MAIN ORDERS LISTING ENDPOINT ====================

// GET /orders - Get all orders with proper filtering and pagination
router.get('/', enhancedErrorHandler(async (req, res) => {
    const { 
        status = '', 
        search = '', 
        page = 1, 
        limit = 20,
        date_range = '',
        sort_by = 'created_at',
        sort_order = 'DESC'
    } = req.query;

    let whereConditions = [];
    let queryParams = [];

    console.log(`📋 [ORDERS-API] Fetching orders with filters:`, { status, search, page, limit, date_range });

    // Build dynamic WHERE clause
    if (status && status !== '' && status !== 'all') {
        whereConditions.push('o.status = ?');
        queryParams.push(status);
    }

    if (search && search.trim() !== '') {
        whereConditions.push(`(
            o.order_number LIKE ? OR 
            u.username LIKE ? OR 
            u.email LIKE ? OR 
            CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) LIKE ? OR
            u.first_name LIKE ? OR 
            u.last_name LIKE ?
        )`);
        const searchTerm = `%${search.trim()}%`;
        queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Date range filter
    if (date_range && date_range !== 'all' && date_range !== '') {
        switch (date_range) {
            case 'today':
                whereConditions.push('DATE(o.created_at) = CURDATE()');
                break;
            case 'week':
                whereConditions.push('o.created_at >= DATE_SUB(NOW(), INTERVAL 1 WEEK)');
                break;
            case 'month':
                whereConditions.push('o.created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)');
                break;
            case '3months':
                whereConditions.push('o.created_at >= DATE_SUB(NOW(), INTERVAL 3 MONTH)');
                break;
        }
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    
    // Get total count for pagination
    const [countResult] = await db.execute(`
        SELECT COUNT(DISTINCT o.id) as total 
        FROM orders o 
        LEFT JOIN users u ON o.user_id = u.id
        ${whereClause}
    `, queryParams);

    const totalOrders = countResult[0].total;
    const offset = (page - 1) * limit;

    // Get orders with comprehensive stakeholder information and correct pricing details
    const [orders] = await db.execute(`
        SELECT 
            o.id, 
            o.order_number, 
            
            -- Correct Pricing Information
            -- Base total = Sum of (original product price * quantity) - what seller set as price
            CAST(COALESCE(SUM(p.price * oi.quantity), 0) AS DECIMAL(12,2)) as base_total_amount,
            -- Final total = What buyer actually pays (base + commission + shipping + tax - discount)
            CAST(COALESCE(o.total_amount, 0) AS DECIMAL(12,2)) as final_total_amount,
            CAST(COALESCE(o.shipping_cost, 0) AS DECIMAL(8,2)) as shipping_cost,
            CAST(COALESCE(o.tax_amount, 0) AS DECIMAL(8,2)) as tax_amount,
            CAST(COALESCE(o.discount_amount, 0) AS DECIMAL(8,2)) as discount_amount,
            CAST(COALESCE(o.commission_amount, 0) AS DECIMAL(8,2)) as commission_amount,
            
            -- Order Status and Details  
            o.status, 
            COALESCE(o.payment_status, 'pending') as payment_status,
            COALESCE(o.payment_method, 'not_specified') as payment_method,
            o.shipping_address,
            o.tracking_number,
            o.notes,
            o.created_at, 
            o.updated_at,
            o.shipped_at,
            o.delivered_at,
            
            -- Buyer Information
            TRIM(CONCAT(COALESCE(buyer.first_name, ''), ' ', COALESCE(buyer.last_name, ''))) as buyer_name,
            COALESCE(buyer.username, '') as buyer_username,
            COALESCE(buyer.email, '') as buyer_email,
            COALESCE(buyer.phone, '') as buyer_phone,
            buyer.id as buyer_id,
            
            -- Seller Information  
            TRIM(CONCAT(COALESCE(seller.first_name, ''), ' ', COALESCE(seller.last_name, ''))) as seller_name,
            COALESCE(seller.username, '') as seller_username,
            COALESCE(seller.email, '') as seller_email,
            COALESCE(seller.phone, '') as seller_phone,
            seller.id as seller_id,
            
            -- Agent Information (if assigned)
            TRIM(CONCAT(COALESCE(agent.first_name, ''), ' ', COALESCE(agent.last_name, ''))) as agent_name,
            COALESCE(agent.username, '') as agent_username,
            COALESCE(agent.email, '') as agent_email,
            COALESCE(agent.phone, '') as agent_phone,
            agent.id as agent_id,
            
            -- Order Item Information
            COUNT(DISTINCT oi.id) as item_count,
            SUM(oi.quantity) as total_quantity
            
        FROM orders o 
        LEFT JOIN users buyer ON o.user_id = buyer.id
        LEFT JOIN users seller ON o.seller_id = seller.id  
        LEFT JOIN users agent ON o.agent_id = agent.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        ${whereClause}
        GROUP BY o.id, o.order_number, o.total_amount, o.status, o.payment_status, o.payment_method, 
                 o.shipping_cost, o.tax_amount, o.discount_amount, o.commission_amount,
                 o.shipping_address, o.tracking_number, o.notes, o.created_at, o.updated_at, o.shipped_at, o.delivered_at,
                 buyer.first_name, buyer.last_name, buyer.username, buyer.email, buyer.phone, buyer.id,
                 seller.first_name, seller.last_name, seller.username, seller.email, seller.phone, seller.id,
                 agent.first_name, agent.last_name, agent.username, agent.email, agent.phone, agent.id
        ORDER BY o.${sort_by} ${sort_order}
        LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), offset]);

    // Process orders to ensure proper data types and clean values
    const processedOrders = orders.map(order => {
        const baseAmount = parseFloat(order.base_total_amount) || 0;
        const finalAmount = parseFloat(order.final_total_amount) || 0;
        const commission = parseFloat(order.commission_amount) || 0;
        
        return {
            ...order,
            // Pricing data with proper conversion and calculations
            base_total_amount: baseAmount,
            final_total_amount: finalAmount,
            shipping_cost: parseFloat(order.shipping_cost) || 0,
            tax_amount: parseFloat(order.tax_amount) || 0,
            discount_amount: parseFloat(order.discount_amount) || 0,
            commission_amount: commission,
            
            // Calculate platform commission if not stored
            calculated_commission: commission || (finalAmount - baseAmount - parseFloat(order.shipping_cost || 0) - parseFloat(order.tax_amount || 0) + parseFloat(order.discount_amount || 0)),
            
            // Quantity and item information
            item_count: parseInt(order.item_count) || 0,
            total_quantity: parseInt(order.total_quantity) || 0,
            
            // Stakeholder information with fallbacks
            buyer_name: (order.buyer_name && order.buyer_name.trim()) || order.buyer_username || 'Unknown Buyer',
            seller_name: (order.seller_name && order.seller_name.trim()) || order.seller_username || 'Unknown Seller',
            agent_name: order.agent_id ? ((order.agent_name && order.agent_name.trim()) || order.agent_username || 'Unknown Agent') : null,
            
            // Payment information
            payment_status: order.payment_status || 'pending',
            payment_method: order.payment_method || 'not_specified',
            
            // For backward compatibility 
            total_amount: finalAmount,
            user_name: (order.buyer_name && order.buyer_name.trim()) || order.buyer_username || 'Unknown Buyer',
            user_email: order.buyer_email,
            
            // Other data
            has_agent: !!order.agent_id,
            
            // Pricing breakdown for display
            pricing_breakdown: {
                base: baseAmount,
                commission: commission || (finalAmount - baseAmount - parseFloat(order.shipping_cost || 0) - parseFloat(order.tax_amount || 0) + parseFloat(order.discount_amount || 0)),
                shipping: parseFloat(order.shipping_cost) || 0,
                tax: parseFloat(order.tax_amount) || 0,
                discount: parseFloat(order.discount_amount) || 0,
                final: finalAmount
            }
        };
    });

    console.log(`✅ [ORDERS-API] Found ${processedOrders.length} orders out of ${totalOrders} total`);

    res.json({
        success: true,
        message: 'Orders retrieved successfully',
        orders: processedOrders, // This ensures the 'orders' property exists
        pagination: {
            current_page: parseInt(page),
            per_page: parseInt(limit),
            total: totalOrders,
            total_pages: Math.ceil(totalOrders / limit),
            from: offset + 1,
            to: Math.min(offset + parseInt(limit), totalOrders)
        },
        filters: { 
            status: status || '', 
            search: search || '', 
            date_range: date_range || '' 
        }
    });
}));

// ==================== ORDER DETAILS ENDPOINT ====================

// GET /:id - Get specific order details
router.get('/:id', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;

    console.log(`📋 [ORDERS-API] Fetching details for order: ${id}`);

    const [orders] = await db.execute(`
        SELECT 
            o.*, 
            -- Correct Pricing Information
            -- Base total = Sum of (original product price * quantity) - seller's actual prices
            CAST(COALESCE(SUM(p.price * oi.quantity), 0) AS DECIMAL(12,2)) as base_total_amount,
            -- Final total = What buyer pays (includes commission)
            CAST(COALESCE(o.total_amount, 0) AS DECIMAL(12,2)) as final_total_amount,
            CAST(COALESCE(o.shipping_cost, 0) AS DECIMAL(8,2)) as shipping_cost,
            CAST(COALESCE(o.tax_amount, 0) AS DECIMAL(8,2)) as tax_amount,
            CAST(COALESCE(o.discount_amount, 0) AS DECIMAL(8,2)) as discount_amount,
            CAST(COALESCE(o.commission_amount, 0) AS DECIMAL(8,2)) as commission_amount,
            
            -- Order Quantities
            COUNT(DISTINCT oi.id) as item_count,
            SUM(oi.quantity) as total_quantity,
            
            -- Buyer Information
            TRIM(CONCAT(COALESCE(buyer.first_name, ''), ' ', COALESCE(buyer.last_name, ''))) as buyer_name,
            COALESCE(buyer.username, '') as buyer_username,
            COALESCE(buyer.email, '') as buyer_email,
            COALESCE(buyer.phone, '') as buyer_phone,
            buyer.id as buyer_id,
            
            -- Seller Information  
            TRIM(CONCAT(COALESCE(seller.first_name, ''), ' ', COALESCE(seller.last_name, ''))) as seller_name,
            COALESCE(seller.username, '') as seller_username,
            COALESCE(seller.email, '') as seller_email,
            COALESCE(seller.phone, '') as seller_phone,
            seller.id as seller_id,
            
            -- Agent Information (if assigned)
            TRIM(CONCAT(COALESCE(agent.first_name, ''), ' ', COALESCE(agent.last_name, ''))) as agent_name,
            COALESCE(agent.username, '') as agent_username,
            COALESCE(agent.email, '') as agent_email,
            COALESCE(agent.phone, '') as agent_phone,
            agent.id as agent_id
            
        FROM orders o 
        LEFT JOIN users buyer ON o.user_id = buyer.id
        LEFT JOIN users seller ON o.seller_id = seller.id  
        LEFT JOIN users agent ON o.agent_id = agent.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.id = ?
        GROUP BY o.id
    `, [id]);

    if (orders.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Order not found'
        });
    }

    const order = orders[0];
    
    // Process order with correct pricing information
    const baseAmount = parseFloat(order.base_total_amount) || 0;
    const finalAmount = parseFloat(order.final_total_amount) || 0;
    const shippingCost = parseFloat(order.shipping_cost) || 0;
    const taxAmount = parseFloat(order.tax_amount) || 0;
    const discountAmount = parseFloat(order.discount_amount) || 0;
    const commissionAmount = parseFloat(order.commission_amount) || 0;

    // Calculate commission if not stored
    const calculatedCommission = commissionAmount || (finalAmount - baseAmount - shippingCost - taxAmount + discountAmount);

    // Update order object with processed values
    order.base_total_amount = baseAmount;
    order.final_total_amount = finalAmount;
    order.shipping_cost = shippingCost;
    order.tax_amount = taxAmount;
    order.discount_amount = discountAmount;
    order.commission_amount = calculatedCommission;
    order.total_quantity = parseInt(order.total_quantity) || 0;
    order.item_count = parseInt(order.item_count) || 0;
    
    // For backward compatibility
    order.total_amount = finalAmount;
    order.user_name = (order.buyer_name && order.buyer_name.trim()) || order.buyer_username || 'Unknown Buyer';
    order.user_email = order.buyer_email;
    
    // Payment information
    order.payment_status = order.payment_status || 'pending';

    // Get order items with correct pricing and product details
    const [items] = await db.execute(`
        SELECT 
            oi.id,
            oi.order_id,
            oi.product_id,
            COALESCE(oi.quantity, 1) as quantity,
            -- Original product price (what seller set)
            CAST(COALESCE(p.price, 0) AS DECIMAL(10,2)) as original_price,
            -- Price buyer paid per item (may include commission)
            CAST(COALESCE(oi.price, p.price, 0) AS DECIMAL(10,2)) as paid_price,
            -- Total for this line item
            CAST(COALESCE(oi.quantity * oi.price, oi.quantity * p.price, 0) AS DECIMAL(10,2)) as line_total,
            
            -- Product Information
            COALESCE(p.name, 'Product Not Found') as product_name,
            COALESCE(p.description, '') as product_description,
            COALESCE(p.main_image, '') as product_image,
            COALESCE(p.sku, '') as product_sku,
            p.status as product_status,
            
            -- Seller Information for this item
            TRIM(CONCAT(COALESCE(seller.first_name, ''), ' ', COALESCE(seller.last_name, ''))) as item_seller_name,
            COALESCE(seller.email, '') as item_seller_email
            
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        LEFT JOIN users seller ON p.seller_id = seller.id
        WHERE oi.order_id = ?
        ORDER BY oi.id
    `, [id]);

    // Process order items with comprehensive pricing information
    const processedItems = items.map(item => ({
        ...item,
        quantity: parseInt(item.quantity) || 1,
        original_price: parseFloat(item.original_price) || 0,
        paid_price: parseFloat(item.paid_price) || 0,
        line_total: parseFloat(item.line_total) || 0,
        
        // Calculate per-item commission
        item_commission: (parseFloat(item.paid_price) || 0) - (parseFloat(item.original_price) || 0),
        
        // For backward compatibility
        price: parseFloat(item.paid_price) || 0,
        total: parseFloat(item.line_total) || 0
    }));

    order.items = processedItems;

    console.log(`✅ [ORDERS-API] Order details loaded for order: ${id}`);

    res.json({
        success: true,
        message: 'Order details retrieved successfully',
        order: order
    });
}));

// ==================== ORDER STATUS UPDATE ENDPOINT ====================

// PUT /:id/status - Update order status
router.put('/:id/status', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    const { status, notes } = req.body;

    console.log(`📋 [ORDERS-API] Updating order ${id} status to: ${status}`);

    // Validate status
    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'disputed', 'refunded'];
    if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({
            success: false,
            message: `Invalid status. Valid statuses are: ${validStatuses.join(', ')}`
        });
    }

    // Check if order exists and get stakeholder information
    const [existingOrder] = await db.execute(`
        SELECT o.id, o.status, o.user_id as buyer_id, o.seller_id, o.agent_id
        FROM orders o 
        WHERE o.id = ?
    `, [id]);
    
    if (existingOrder.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Order not found'
        });
    }

    const order = existingOrder[0];

    // Update order status
    await db.execute(`
        UPDATE orders 
        SET status = ?, updated_at = NOW()
        WHERE id = ?
    `, [status, id]);

    // Notify stakeholders about status change
    const statusChangeMessage = `Order #${id} status updated from ${order.status} to ${status}`;
    const stakeholderIds = [order.buyer_id, order.seller_id];
    if (order.agent_id) {
        stakeholderIds.push(order.agent_id);
    }

    // Send notifications to all stakeholders
    for (const stakeholderId of stakeholderIds.filter(id => id)) {
        try {
            await db.execute(`
                INSERT INTO messages (sender_id, receiver_id, message, message_type, order_id, created_at)
                VALUES (?, ?, ?, 'system', ?, NOW())
            `, [req.user.id, stakeholderId, statusChangeMessage, id]);
        } catch (notifyError) {
            console.warn(`Failed to notify stakeholder ${stakeholderId}:`, notifyError.message);
        }
    }

    // Log the status change
    await db.execute(`
        INSERT INTO system_logs (level, message, details, created_at)
        VALUES (?, ?, ?, NOW())
    `, [
        'info',
        `Order status updated`,
        JSON.stringify({
            order_id: parseInt(id),
            old_status: existingOrder[0].status,
            new_status: status,
            updated_by: req.user.id,
            updated_by_email: req.user.email,
            notes: notes || null,
            timestamp: new Date().toISOString()
        })
    ]);

    console.log(`✅ [ORDERS-API] Order ${id} status updated from ${existingOrder[0].status} to ${status}`);

    res.json({
        success: true,
        message: 'Order status updated successfully'
    });
}));

// ==================== ORDER STATISTICS ENDPOINT ====================

// GET /stats/summary - Get order statistics summary
router.get('/stats/summary', enhancedErrorHandler(async (req, res) => {
    console.log('📊 [ORDERS-API] Fetching order statistics summary...');

    // Get order counts by status
    const [statusStats] = await db.execute(`
        SELECT 
            status,
            COUNT(*) as count,
            CAST(COALESCE(SUM(total_amount), 0) AS DECIMAL(10,2)) as total_amount
        FROM orders
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY status
    `);

    // Get recent orders (last 7 days)
    const [recentStats] = await db.execute(`
        SELECT 
            COUNT(*) as recent_orders,
            CAST(COALESCE(SUM(total_amount), 0) AS DECIMAL(10,2)) as recent_revenue
        FROM orders
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `);

    // Get total statistics
    const [totalStats] = await db.execute(`
        SELECT 
            COUNT(*) as total_orders,
            CAST(COALESCE(SUM(total_amount), 0) AS DECIMAL(10,2)) as total_revenue,
            CAST(COALESCE(AVG(total_amount), 0) AS DECIMAL(10,2)) as average_order_value
        FROM orders
        WHERE status NOT IN ('cancelled', 'disputed')
    `);

    // Process statistics to ensure proper data types
    const processedStatusStats = statusStats.map(stat => ({
        ...stat,
        count: parseInt(stat.count) || 0,
        total_amount: parseFloat(stat.total_amount) || 0
    }));

    console.log('✅ [ORDERS-API] Order statistics retrieved');

    res.json({
        success: true,
        message: 'Order statistics retrieved successfully',
        stats: {
            by_status: processedStatusStats,
            recent_orders: parseInt(recentStats[0]?.recent_orders) || 0,
            recent_revenue: parseFloat(recentStats[0]?.recent_revenue) || 0,
            total_orders: parseInt(totalStats[0]?.total_orders) || 0,
            total_revenue: parseFloat(totalStats[0]?.total_revenue) || 0,
            average_order_value: parseFloat(totalStats[0]?.average_order_value) || 0
        }
    });
}));

// ==================== PAYMENT STATUS UPDATE ENDPOINT ====================

// PUT /:id/payment-status - Update payment status
router.put('/:id/payment-status', enhancedErrorHandler(async (req, res) => {
    const { id } = req.params;
    const { payment_status, notes } = req.body;

    console.log(`💰 [ORDERS-API] Updating order ${id} payment status to: ${payment_status}`);

    // Validate payment status
    const validPaymentStatuses = ['pending', 'paid', 'partially_paid', 'failed', 'refunded', 'disputed'];
    if (!payment_status || !validPaymentStatuses.includes(payment_status)) {
        return res.status(400).json({
            success: false,
            message: `Invalid payment status. Valid statuses are: ${validPaymentStatuses.join(', ')}`
        });
    }

    // Check if order exists
    const [existingOrder] = await db.execute('SELECT id, payment_status FROM orders WHERE id = ?', [id]);
    
    if (existingOrder.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Order not found'
        });
    }

    // Update payment status
    await db.execute(`
        UPDATE orders 
        SET payment_status = ?, updated_at = NOW()
        WHERE id = ?
    `, [payment_status, id]);

    // Log the payment status change
    await db.execute(`
        INSERT INTO system_logs (level, message, details, created_at)
        VALUES (?, ?, ?, NOW())
    `, [
        'info',
        `Order payment status updated`,
        JSON.stringify({
            order_id: parseInt(id),
            old_payment_status: existingOrder[0].payment_status,
            new_payment_status: payment_status,
            updated_by: req.user.id,
            updated_by_email: req.user.email,
            notes: notes || null,
            timestamp: new Date().toISOString()
        })
    ]);

    console.log(`✅ [ORDERS-API] Order ${id} payment status updated from ${existingOrder[0].payment_status} to ${payment_status}`);

    res.json({
        success: true,
        message: 'Payment status updated successfully'
    });
}));

// ==================== BULK OPERATIONS ENDPOINT ====================

// POST /bulk-update-status - Bulk update order status
router.post('/bulk-update-status', enhancedErrorHandler(async (req, res) => {
    const { order_ids, status, notes } = req.body;

    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'order_ids array is required'
        });
    }

    // Validate status
    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'disputed', 'refunded'];
    if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({
            success: false,
            message: `Invalid status. Valid statuses are: ${validStatuses.join(', ')}`
        });
    }

    console.log(`📋 [ORDERS-API] Bulk updating ${order_ids.length} orders to status: ${status}`);

    // Create placeholders for the IN clause
    const placeholders = order_ids.map(() => '?').join(',');
    
    // Update orders
    const [result] = await db.execute(`
        UPDATE orders 
        SET status = ?, updated_at = NOW()
        WHERE id IN (${placeholders})
    `, [status, ...order_ids]);

    // Log the bulk update
    await db.execute(`
        INSERT INTO system_logs (level, message, details, created_at)
        VALUES (?, ?, ?, NOW())
    `, [
        'info',
        `Bulk order status update`,
        JSON.stringify({
            order_ids: order_ids,
            new_status: status,
            updated_by: req.user.id,
            updated_by_email: req.user.email,
            affected_rows: result.affectedRows,
            notes: notes || null,
            timestamp: new Date().toISOString()
        })
    ]);

    console.log(`✅ [ORDERS-API] Bulk update completed. ${result.affectedRows} orders updated`);

    res.json({
        success: true,
        message: `Successfully updated ${result.affectedRows} orders`,
        updated_count: result.affectedRows
    });
}));

console.log('✅ [REMAIN-ORDER-ENDPOINTS] Remaining order endpoints loaded successfully');

module.exports = router;