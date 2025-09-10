const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// GET ALL ORDERS WITH ENHANCED PRICING CALCULATIONS
router.get('/', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { 
      status = 'all', 
      page = 1, 
      limit = 20, 
      search = '',
      date_from = '',
      date_to = '',
      payment_status = 'all',
      amount_min = '',
      amount_max = '',
      seller_id = '',
      buyer_id = ''
    } = req.query;

    const offset = (page - 1) * limit;
    let whereConditions = [];
    let queryParams = [];

    // Build WHERE conditions
    if (status !== 'all') {
      whereConditions.push('o.status = ?');
      queryParams.push(status);
    }

    if (payment_status !== 'all') {
      whereConditions.push('o.payment_status = ?');
      queryParams.push(payment_status);
    }

    if (search) {
      whereConditions.push('(o.order_number LIKE ? OR buyer.first_name LIKE ? OR buyer.last_name LIKE ? OR seller.first_name LIKE ? OR seller.last_name LIKE ?)');
      queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (date_from) {
      whereConditions.push('DATE(o.created_at) >= ?');
      queryParams.push(date_from);
    }

    if (date_to) {
      whereConditions.push('DATE(o.created_at) <= ?');
      queryParams.push(date_to);
    }

    if (amount_min) {
      whereConditions.push('o.total_amount >= ?');
      queryParams.push(parseFloat(amount_min));
    }

    if (amount_max) {
      whereConditions.push('o.total_amount <= ?');
      queryParams.push(parseFloat(amount_max));
    }

    if (seller_id) {
      whereConditions.push('o.seller_id = ?');
      queryParams.push(seller_id);
    }

    if (buyer_id) {
      whereConditions.push('o.user_id = ?');
      queryParams.push(buyer_id);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Enhanced query with comprehensive pricing calculations
    const ordersQuery = `
      SELECT 
        o.id,
        o.order_number,
        o.user_id as buyer_id,
        o.seller_id,
        o.agent_id,
        o.status,
        o.payment_status,
        o.payment_method,
        o.delivery_method,
        o.marketplace_type,
        
        -- Enhanced Pricing Calculations
        CAST(COALESCE(o.total_amount, 0) AS DECIMAL(12,2)) as final_total_amount,
        CAST(COALESCE(o.platform_commission, o.commission_amount, 0) AS DECIMAL(10,2)) as commission_amount,
        CAST(COALESCE(o.delivery_fee, 0) AS DECIMAL(8,2)) as shipping_cost,
        CAST(COALESCE(o.transaction_fee, 0) AS DECIMAL(8,2)) as tax_amount,
        
        -- Order Item Details  
        COUNT(DISTINCT oi.id) as item_count,
        COALESCE(SUM(oi.quantity), 0) as total_quantity,
        
        -- Calculate base total from order items (seller's original prices)
        CAST(COALESCE(SUM(COALESCE(p.base_price, p.price, 0) * oi.quantity), 0) AS DECIMAL(12,2)) as base_total_amount,
        CAST(COALESCE(SUM(oi.unit_price * oi.quantity), 0) AS DECIMAL(12,2)) as items_total,
        
        -- Calculate commission
        CAST(COALESCE(SUM(oi.unit_price * oi.quantity) - SUM(COALESCE(p.base_price, p.price, 0) * oi.quantity), 0) AS DECIMAL(10,2)) as calculated_commission,
        
        -- User Information
        TRIM(CONCAT(COALESCE(buyer.first_name, ''), ' ', COALESCE(buyer.last_name, ''))) as buyer_name,
        COALESCE(buyer.email, '') as buyer_email,
        COALESCE(buyer.phone, '') as buyer_phone,
        TRIM(CONCAT(COALESCE(seller.first_name, ''), ' ', COALESCE(seller.last_name, ''))) as seller_name,
        COALESCE(seller.email, '') as seller_email,
        COALESCE(seller.phone, '') as seller_phone,
        TRIM(CONCAT(COALESCE(agent.first_name, ''), ' ', COALESCE(agent.last_name, ''))) as agent_name,
        
        -- Timestamps
        o.created_at,
        o.updated_at,
        o.confirmed_at,
        o.delivered_at,
        
        -- Additional Details
        o.tracking_number,
        o.delivery_code,
        o.notes,
        o.admin_notes,
        o.payment_proof
        
      FROM orders o
      LEFT JOIN users buyer ON o.user_id = buyer.id
      LEFT JOIN users seller ON o.seller_id = seller.id  
      LEFT JOIN users agent ON o.agent_id = agent.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      ${whereClause}
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `;

    queryParams.push(parseInt(limit), parseInt(offset));

    const [orders] = await pool.query(ordersQuery, queryParams);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(DISTINCT o.id) as total
      FROM orders o
      LEFT JOIN users buyer ON o.user_id = buyer.id
      LEFT JOIN users seller ON o.seller_id = seller.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      ${whereClause}
    `;
    
    const countParams = queryParams.slice(0, -2); // Remove LIMIT and OFFSET
    const [countResult] = await pool.query(countQuery, countParams);

    // Process orders to ensure commission calculations
    const processedOrders = orders.map(order => {
      const baseAmount = parseFloat(order.base_total_amount) || 0;
      const finalAmount = parseFloat(order.final_total_amount) || 0;
      const itemsTotal = parseFloat(order.items_total) || 0;
      const storedCommission = parseFloat(order.commission_amount) || 0;
      const calculatedCommission = parseFloat(order.calculated_commission) || 0;
      const shippingCost = parseFloat(order.shipping_cost) || 0;
      const taxAmount = parseFloat(order.tax_amount) || 0;
      
      // Use the most accurate commission calculation
      const commission = calculatedCommission || storedCommission || Math.max(0, itemsTotal - baseAmount);
      
      return {
        ...order,
        base_total_amount: baseAmount,
        final_total_amount: finalAmount,
        items_total: itemsTotal,
        commission_amount: commission,
        calculated_commission: calculatedCommission,
        shipping_cost: shippingCost,
        tax_amount: taxAmount,
        // Calculate commission rate
        commission_rate: baseAmount > 0 ? ((commission / baseAmount) * 100).toFixed(2) : '0.00'
      };
    });

    res.json({
      success: true,
      orders: processedOrders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / limit)
      }
    });

  } catch (error) {
    console.error('[Admin] Get orders error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch orders' 
    });
  }
});

// GET ORDER DETAILS WITH ALL PRODUCTS AND PRICING BREAKDOWN
router.get('/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Get order details
    const [orderResult] = await pool.query(`
      SELECT 
        o.*,
        -- User Information
        TRIM(CONCAT(COALESCE(buyer.first_name, ''), ' ', COALESCE(buyer.last_name, ''))) as buyer_name,
        COALESCE(buyer.email, '') as buyer_email,
        COALESCE(buyer.phone, '') as buyer_phone,
        buyer.username as buyer_username,
        
        TRIM(CONCAT(COALESCE(seller.first_name, ''), ' ', COALESCE(seller.last_name, ''))) as seller_name,
        COALESCE(seller.email, '') as seller_email,
        COALESCE(seller.phone, '') as seller_phone,
        seller.username as seller_username,
        
        TRIM(CONCAT(COALESCE(agent.first_name, ''), ' ', COALESCE(agent.last_name, ''))) as agent_name,
        COALESCE(agent.email, '') as agent_email,
        COALESCE(agent.phone, '') as agent_phone
        
      FROM orders o
      LEFT JOIN users buyer ON o.user_id = buyer.id
      LEFT JOIN users seller ON o.seller_id = seller.id  
      LEFT JOIN users agent ON o.agent_id = agent.id
      WHERE o.id = ?
    `, [id]);

    if (orderResult.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Order not found' 
      });
    }

    const order = orderResult[0];

    // Get order items with detailed product information
    const [items] = await pool.query(`
      SELECT 
        oi.id as item_id,
        oi.product_id,
        oi.quantity,
        oi.unit_price as buyer_paid_price,
        oi.total_price as buyer_paid_total,
        
        -- Product Information
        p.name as product_name,
        p.description as product_description,
        p.sku as product_sku,
        p.main_image as product_image,
        p.condition as product_condition,
        p.brand,
        p.category,
        
        -- Pricing Analysis
        CAST(COALESCE(p.base_price, p.price, 0) AS DECIMAL(10,2)) as seller_base_price,
        CAST(COALESCE(p.price, 0) AS DECIMAL(10,2)) as product_current_price,
        CAST(COALESCE(oi.unit_price, 0) AS DECIMAL(10,2)) as paid_unit_price,
        
        -- Calculate commission per item
        CAST(COALESCE(oi.unit_price - COALESCE(p.base_price, p.price), 0) AS DECIMAL(10,2)) as commission_per_unit,
        CAST(COALESCE((oi.unit_price - COALESCE(p.base_price, p.price)) * oi.quantity, 0) AS DECIMAL(10,2)) as total_commission_for_item,
        
        -- Seller Information for this item
        TRIM(CONCAT(COALESCE(item_seller.first_name, ''), ' ', COALESCE(item_seller.last_name, ''))) as item_seller_name,
        COALESCE(item_seller.email, '') as item_seller_email,
        
        -- Product status and stock
        p.status as product_status,
        p.stock_quantity,
        p.is_active as product_active
        
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN users item_seller ON p.seller_id = item_seller.id
      WHERE oi.order_id = ?
      ORDER BY oi.id
    `, [id]);

    // Calculate totals
    const baseTotal = items.reduce((sum, item) => sum + (parseFloat(item.seller_base_price) * item.quantity), 0);
    const paidTotal = items.reduce((sum, item) => sum + parseFloat(item.buyer_paid_total || 0), 0);
    const totalCommission = items.reduce((sum, item) => sum + parseFloat(item.total_commission_for_item || 0), 0);
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

    const enhancedOrder = {
      ...order,
      // Calculated totals
      base_total_amount: baseTotal,
      items_total: paidTotal,
      calculated_commission: totalCommission,
      total_quantity: totalQuantity,
      item_count: items.length,
      
      // Calculate fees
      shipping_cost: parseFloat(order.delivery_fee || 0),
      tax_amount: parseFloat(order.transaction_fee || 0),
      
      // Commission analysis
      commission_rate: baseTotal > 0 ? ((totalCommission / baseTotal) * 100).toFixed(2) : '0.00',
      
      // Items and related data
      items: items
    };

    res.json({
      success: true,
      order: enhancedOrder
    });

  } catch (error) {
    console.error('[Admin] Get order details error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch order details' 
    });
  }
});

module.exports = router;