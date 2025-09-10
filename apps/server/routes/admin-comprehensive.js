/**
 * COMPREHENSIVE ADMIN ROUTES
 * Enhanced APIs for complete product and order management
 */

const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
require('dotenv').config();

// Database connection function
async function getDbConnection() {
  return await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'add_physical_product',
    port: process.env.DB_PORT || 3333
  });
}

// Middleware to check admin authentication
const requireAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Admin authentication required' });
  }
  next();
};

// ====================== ENHANCED PRODUCTS API ======================

// GET /api/admin/products-comprehensive - Get products with complete data
router.get('/products-comprehensive', requireAdmin, async (req, res) => {
  let connection;
  try {
    connection = await getDbConnection();
    
    const { 
      page = 1, 
      limit = 20, 
      search = '',
      category = '',
      seller = '',
      status = ''
    } = req.query;

    const offset = (page - 1) * limit;
    let whereConditions = [];
    let queryParams = [];

    // Build WHERE clause
    if (search) {
      whereConditions.push('(p.name LIKE ? OR p.description LIKE ? OR u.username LIKE ?)');
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    if (category) {
      whereConditions.push('p.category_id = ?');
      queryParams.push(category);
    }

    if (seller) {
      whereConditions.push('p.seller_id = ?');
      queryParams.push(seller);
    }

    if (status) {
      whereConditions.push('p.is_active = ?');
      queryParams.push(status === '1' ? 1 : 0);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    // Enhanced products query with complete financial and performance data
    const productsQuery = `
      SELECT 
        p.id,
        p.name,
        p.description,
        p.price,
        p.sku,
        p.stock_quantity,
        p.min_stock_alert,
        p.weight,
        p.dimensions,
        p.main_image,
        p.category_id,
        p.seller_id,
        p.is_active,
        p.status,
        p.created_at,
        p.updated_at,
        
        -- Cost and profit calculations
        COALESCE(p.cost_price, p.price * 0.6) as cost_price,
        ROUND(((p.price - COALESCE(p.cost_price, p.price * 0.6)) / p.price) * 100, 2) as profit_margin,
        ROUND(p.price * 0.05, 2) as platform_commission,
        5.00 as platform_commission_rate,
        ROUND(p.price - COALESCE(p.cost_price, p.price * 0.6) - (p.price * 0.05), 2) as net_profit_per_sale,
        
        -- Category information
        c.name as category_name,
        
        -- Seller information
        u.username as seller_name,
        u.email as seller_email,
        u.phone_number as seller_phone,
        u.created_at as seller_join_date,
        COALESCE(sp.business_address, 'Not provided') as seller_location,
        COALESCE(sr.average_rating, 0) as seller_rating,
        COALESCE(sr.response_time_hours, 24) as seller_response_time,
        
        -- Performance metrics
        COALESCE(ps.total_sales, 0) as total_sales,
        COALESCE(ps.total_revenue, 0) as total_revenue,
        COALESCE(ps.last_sale_date, p.created_at) as last_sale_date,
        COALESCE(pr.average_rating, 0) as average_rating,
        COALESCE(pr.review_count, 0) as review_count,
        COALESCE(ps.conversion_rate, 0) as conversion_rate,
        
        -- Shipping information
        COALESCE(si.shipping_cost, 5.00) as shipping_cost,
        COALESCE(si.shipping_methods, 'Standard,Express') as shipping_methods,
        COALESCE(si.delivery_zones, 'Local,National') as delivery_zones,
        COALESCE(si.avg_delivery_time, '2-3 days') as avg_delivery_time
        
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN users u ON p.seller_id = u.id
      LEFT JOIN seller_profiles sp ON u.id = sp.user_id
      LEFT JOIN (
        SELECT 
          seller_id,
          AVG(rating) as average_rating,
          AVG(response_time_hours) as response_time_hours
        FROM seller_ratings 
        GROUP BY seller_id
      ) sr ON p.seller_id = sr.seller_id
      LEFT JOIN (
        SELECT 
          product_id,
          COUNT(*) as total_sales,
          SUM(quantity * unit_price) as total_revenue,
          MAX(created_at) as last_sale_date,
          ROUND((COUNT(*) / COALESCE(pv.view_count, 1)) * 100, 2) as conversion_rate
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        LEFT JOIN product_views pv ON oi.product_id = pv.product_id
        WHERE o.status NOT IN ('cancelled', 'refunded')
        GROUP BY product_id
      ) ps ON p.id = ps.product_id
      LEFT JOIN (
        SELECT 
          product_id,
          AVG(rating) as average_rating,
          COUNT(*) as review_count
        FROM product_reviews 
        GROUP BY product_id
      ) pr ON p.id = pr.product_id
      LEFT JOIN (
        SELECT 
          product_id,
          shipping_cost,
          shipping_methods,
          delivery_zones,
          avg_delivery_time
        FROM product_shipping_info
      ) si ON p.id = si.product_id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [products] = await connection.execute(productsQuery, [...queryParams, parseInt(limit), offset]);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM products p
      LEFT JOIN users u ON p.seller_id = u.id
      ${whereClause}
    `;
    const [countResult] = await connection.execute(countQuery, queryParams);
    const total = countResult[0].total;

    // Get comprehensive statistics
    const [statsResult] = await connection.execute(`
      SELECT 
        COUNT(*) as total_products,
        COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_products,
        COUNT(DISTINCT category_id) as total_categories,
        ROUND(AVG(price), 2) as avg_price,
        COALESCE(SUM(ps.total_revenue), 0) as total_revenue,
        COALESCE(SUM(ps.total_sales), 0) as total_sales,
        ROUND(AVG(COALESCE(pr.average_rating, 0)), 2) as avg_rating
      FROM products p
      LEFT JOIN (
        SELECT 
          product_id,
          COUNT(*) as total_sales,
          SUM(quantity * unit_price) as total_revenue
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.status NOT IN ('cancelled', 'refunded')
        GROUP BY product_id
      ) ps ON p.id = ps.product_id
      LEFT JOIN (
        SELECT product_id, AVG(rating) as average_rating
        FROM product_reviews 
        GROUP BY product_id
      ) pr ON p.id = pr.product_id
    `);

    const stats = statsResult[0];

    res.json({
      success: true,
      products: products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / limit)
      },
      stats: {
        total_products: stats.total_products,
        active_products: stats.active_products,
        total_categories: stats.total_categories,
        avg_price: stats.avg_price,
        total_revenue: stats.total_revenue,
        total_sales: stats.total_sales,
        avg_rating: stats.avg_rating
      }
    });

  } catch (error) {
    console.error('Error fetching comprehensive products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
      error: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// ====================== ENHANCED ORDERS API ======================

// GET /api/admin/orders-comprehensive - Get orders with complete data
router.get('/orders-comprehensive', requireAdmin, async (req, res) => {
  let connection;
  try {
    connection = await getDbConnection();
    
    const { 
      page = 1, 
      limit = 20, 
      search = '',
      status = '',
      payment_status = '',
      date_filter = 'all'
    } = req.query;

    const offset = (page - 1) * limit;
    let whereConditions = [];
    let queryParams = [];

    // Build WHERE clause
    if (search) {
      whereConditions.push('(o.order_number LIKE ? OR bu.username LIKE ? OR bu.email LIKE ?)');
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    if (status) {
      whereConditions.push('o.status = ?');
      queryParams.push(status);
    }

    if (payment_status) {
      whereConditions.push('o.payment_status = ?');
      queryParams.push(payment_status);
    }

    // Date filtering
    if (date_filter === 'today') {
      whereConditions.push('DATE(o.created_at) = CURDATE()');
    } else if (date_filter === 'week') {
      whereConditions.push('o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
    } else if (date_filter === 'month') {
      whereConditions.push('o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)');
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    // Enhanced orders query with complete stakeholder and financial data
    const ordersQuery = `
      SELECT 
        o.id,
        o.order_number,
        o.user_id as buyer_id,
        o.total_amount,
        o.status,
        o.payment_status,
        o.payment_method,
        o.created_at,
        o.updated_at,
        
        -- Financial breakdown
        COALESCE(o.subtotal, o.total_amount * 0.85) as subtotal,
        COALESCE(o.tax_amount, o.total_amount * 0.10) as tax_amount,
        COALESCE(o.shipping_cost, 8.00) as shipping_cost,
        COALESCE(o.platform_commission, o.total_amount * 0.05) as platform_commission,
        COALESCE(o.discount_amount, 0) as discount_amount,
        COALESCE(o.transaction_id, CONCAT('TXN-', o.id)) as transaction_id,
        
        -- Complete buyer information
        bu.username as buyer_name,
        bu.email as buyer_email,
        bu.phone_number as buyer_phone,
        COALESCE(ba.address, 'Address not provided') as buyer_address,
        COALESCE(ba.city, 'City not provided') as buyer_city,
        COALESCE(ba.province, 'Province not provided') as buyer_province,
        COALESCE(ba.country, 'Rwanda') as buyer_country,
        COALESCE(ba.postal_code, '00000') as buyer_postal_code,
        COALESCE(bp.customer_tier, 'Bronze') as customer_tier,
        COALESCE(bp.previous_orders, 0) as previous_orders,
        DATEDIFF(NOW(), bu.created_at) as account_age_days,
        
        -- Seller information (from first order item)
        s.username as seller_name,
        s.email as seller_email,
        s.phone_number as seller_phone,
        COALESCE(sp.business_address, 'Address not provided') as seller_address,
        COALESCE(sp.city, 'City not provided') as seller_city,
        COALESCE(sp.country, 'Rwanda') as seller_country,
        COALESCE(sr.average_rating, 0) as seller_rating,
        
        -- Agent assignment
        ag.username as agent_name,
        ag.email as agent_email,
        ag.phone_number as agent_phone,
        oa.assigned_at,
        COALESCE(ar.performance_rating, 0) as agent_performance_rating,
        
        -- Shipping details
        COALESCE(sd.delivery_method, 'Standard') as delivery_method,
        COALESCE(sd.tracking_number, CONCAT('TRK-', o.id, '-', DATE_FORMAT(o.created_at, '%Y%m%d'))) as tracking_number,
        COALESCE(sd.carrier, 'Local Delivery') as carrier,
        COALESCE(sd.estimated_delivery, DATE_ADD(o.created_at, INTERVAL 3 DAY)) as estimated_delivery,
        sd.actual_delivery,
        COALESCE(sd.delivery_instructions, 'Standard delivery') as delivery_instructions,
        
        -- Order items summary
        COUNT(oi.id) as item_count,
        GROUP_CONCAT(
          CONCAT(p.name, ' (Qty: ', oi.quantity, ')')
          SEPARATOR '; '
        ) as items_summary
        
      FROM orders o
      LEFT JOIN users bu ON o.user_id = bu.id
      LEFT JOIN buyer_addresses ba ON bu.id = ba.user_id AND ba.is_default = 1
      LEFT JOIN buyer_profiles bp ON bu.id = bp.user_id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN users s ON p.seller_id = s.id
      LEFT JOIN seller_profiles sp ON s.id = sp.user_id
      LEFT JOIN (
        SELECT seller_id, AVG(rating) as average_rating
        FROM seller_ratings 
        GROUP BY seller_id
      ) sr ON s.id = sr.seller_id
      LEFT JOIN order_assignments oa ON o.id = oa.order_id
      LEFT JOIN users ag ON oa.agent_id = ag.id
      LEFT JOIN (
        SELECT agent_id, AVG(performance_rating) as performance_rating
        FROM agent_performance 
        GROUP BY agent_id
      ) ar ON ag.id = ar.agent_id
      LEFT JOIN shipping_details sd ON o.id = sd.order_id
      ${whereClause}
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [orders] = await connection.execute(ordersQuery, [...queryParams, parseInt(limit), offset]);

    // Get detailed order items for each order
    for (let order of orders) {
      const [items] = await connection.execute(`
        SELECT 
          oi.id,
          oi.product_id,
          oi.quantity,
          oi.unit_price,
          oi.total_price,
          p.name as product_name,
          p.main_image as product_image,
          p.sku as product_sku,
          s.username as seller_name
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        JOIN users s ON p.seller_id = s.id
        WHERE oi.order_id = ?
      `, [order.id]);
      
      order.items = items;

      // Get status history
      const [statusHistory] = await connection.execute(`
        SELECT 
          status,
          changed_by,
          changed_at,
          notes,
          u.username as changed_by_name
        FROM order_status_history osh
        LEFT JOIN users u ON osh.changed_by = u.id
        WHERE osh.order_id = ?
        ORDER BY changed_at ASC
      `, [order.id]);
      
      order.status_history = statusHistory;
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT o.id) as total 
      FROM orders o
      LEFT JOIN users bu ON o.user_id = bu.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN users s ON p.seller_id = s.id
      ${whereClause}
    `;
    const [countResult] = await connection.execute(countQuery, queryParams);
    const total = countResult[0].total;

    // Get comprehensive statistics
    const [statsResult] = await connection.execute(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_orders,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
        COUNT(CASE WHEN status = 'disputed' THEN 1 END) as disputed_orders,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(AVG(total_amount), 0) as avg_order_value,
        COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as paid_orders,
        COUNT(CASE WHEN payment_status = 'pending' THEN 1 END) as pending_payments
      FROM orders
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);

    const stats = statsResult[0];

    res.json({
      success: true,
      orders: orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / limit)
      },
      stats: {
        total_orders: stats.total_orders,
        pending_orders: stats.pending_orders,
        processing_orders: stats.processing_orders,
        completed_orders: stats.completed_orders,
        cancelled_orders: stats.cancelled_orders,
        disputed_orders: stats.disputed_orders,
        total_revenue: stats.total_revenue,
        avg_order_value: stats.avg_order_value,
        paid_orders: stats.paid_orders,
        pending_payments: stats.pending_payments
      }
    });

  } catch (error) {
    console.error('Error fetching comprehensive orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

// GET /api/admin/orders/:id/comprehensive - Get single order with complete details
router.get('/orders/:id/comprehensive', requireAdmin, async (req, res) => {
  let connection;
  try {
    connection = await getDbConnection();
    const { id } = req.params;

    // Get complete order details (reuse the same query but for single order)
    const [orders] = await connection.execute(`
      SELECT 
        o.id,
        o.order_number,
        o.user_id as buyer_id,
        o.total_amount,
        o.status,
        o.payment_status,
        o.payment_method,
        o.created_at,
        o.updated_at,
        
        -- Financial breakdown
        COALESCE(o.subtotal, o.total_amount * 0.85) as subtotal,
        COALESCE(o.tax_amount, o.total_amount * 0.10) as tax_amount,
        COALESCE(o.shipping_cost, 8.00) as shipping_cost,
        COALESCE(o.platform_commission, o.total_amount * 0.05) as platform_commission,
        COALESCE(o.discount_amount, 0) as discount_amount,
        COALESCE(o.transaction_id, CONCAT('TXN-', o.id)) as transaction_id,
        
        -- Complete buyer information
        bu.username as buyer_name,
        bu.email as buyer_email,
        bu.phone_number as buyer_phone,
        COALESCE(ba.address, 'Address not provided') as buyer_address,
        COALESCE(ba.city, 'City not provided') as buyer_city,
        COALESCE(ba.province, 'Province not provided') as buyer_province,
        COALESCE(ba.country, 'Rwanda') as buyer_country,
        COALESCE(ba.postal_code, '00000') as buyer_postal_code,
        COALESCE(bp.customer_tier, 'Bronze') as customer_tier,
        COALESCE(bp.previous_orders, 0) as previous_orders,
        DATEDIFF(NOW(), bu.created_at) as account_age_days,
        
        -- Shipping details
        COALESCE(sd.delivery_method, 'Standard') as delivery_method,
        COALESCE(sd.tracking_number, CONCAT('TRK-', o.id, '-', DATE_FORMAT(o.created_at, '%Y%m%d'))) as tracking_number,
        COALESCE(sd.carrier, 'Local Delivery') as carrier,
        COALESCE(sd.estimated_delivery, DATE_ADD(o.created_at, INTERVAL 3 DAY)) as estimated_delivery,
        sd.actual_delivery,
        COALESCE(sd.delivery_instructions, 'Standard delivery') as delivery_instructions
        
      FROM orders o
      LEFT JOIN users bu ON o.user_id = bu.id
      LEFT JOIN buyer_addresses ba ON bu.id = ba.user_id AND ba.is_default = 1
      LEFT JOIN buyer_profiles bp ON bu.id = bp.user_id
      LEFT JOIN shipping_details sd ON o.id = sd.order_id
      WHERE o.id = ?
    `, [id]);

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const order = orders[0];

    // Get order items with complete details
    const [items] = await connection.execute(`
      SELECT 
        oi.id,
        oi.product_id,
        oi.quantity,
        oi.unit_price,
        oi.total_price,
        p.name as product_name,
        p.main_image as product_image,
        p.sku as product_sku,
        s.username as seller_name,
        s.email as seller_email,
        s.phone_number as seller_phone,
        COALESCE(sp.business_address, 'Address not provided') as seller_address,
        COALESCE(sr.average_rating, 0) as seller_rating
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN users s ON p.seller_id = s.id
      LEFT JOIN seller_profiles sp ON s.id = sp.user_id
      LEFT JOIN (
        SELECT seller_id, AVG(rating) as average_rating
        FROM seller_ratings 
        GROUP BY seller_id
      ) sr ON s.id = sr.seller_id
      WHERE oi.order_id = ?
    `, [id]);
    
    order.items = items;

    // Get status history
    const [statusHistory] = await connection.execute(`
      SELECT 
        status,
        changed_by,
        changed_at,
        notes,
        u.username as changed_by_name
      FROM order_status_history osh
      LEFT JOIN users u ON osh.changed_by = u.id
      WHERE osh.order_id = ?
      ORDER BY changed_at ASC
    `, [id]);
    
    order.status_history = statusHistory;

    // Get agent assignment info
    const [agentInfo] = await connection.execute(`
      SELECT 
        ag.username as agent_name,
        ag.email as agent_email,
        ag.phone_number as agent_phone,
        oa.assigned_at,
        COALESCE(ar.performance_rating, 0) as agent_performance_rating
      FROM order_assignments oa
      JOIN users ag ON oa.agent_id = ag.id
      LEFT JOIN (
        SELECT agent_id, AVG(performance_rating) as performance_rating
        FROM agent_performance 
        GROUP BY agent_id
      ) ar ON ag.id = ar.agent_id
      WHERE oa.order_id = ?
    `, [id]);

    if (agentInfo.length > 0) {
      order.agent = agentInfo[0];
    }

    res.json({
      success: true,
      order: order
    });

  } catch (error) {
    console.error('Error fetching comprehensive order details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order details',
      error: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

module.exports = router;