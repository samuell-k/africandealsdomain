const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');

// Import mock database for fallback
const mockDB = require('../mock-local-market-db');

// Database connection
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'african_deals_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Authentication middleware
const requireAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id || decoded.userId;

    const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    req.user = users[0];
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads', 'local-market'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `local-market-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

console.log('🏪 [LOCAL-MARKET] Loading local market routes...');

// ====================================================================
// CATEGORIES ENDPOINTS
// ====================================================================

// GET /api/local-market/categories - Get all local market categories
router.get('/categories', async (req, res) => {
  try {
    console.log('[CATEGORIES] Fetching local market categories...');
    
    const [categories] = await pool.execute(`
      SELECT 
        lmc.id,
        lmc.name,
        lmc.description,
        lmc.icon,
        lmc.color,
        lmc.is_active,
        COUNT(lmp.id) as product_count
      FROM local_market_categories lmc
      LEFT JOIN local_market_products lmp ON lmc.id = lmp.category_id AND lmp.is_active = 1
      WHERE lmc.is_active = 1
      GROUP BY lmc.id
      ORDER BY lmc.sort_order ASC, lmc.name ASC
    `);
    
    console.log(`[CATEGORIES] Found ${categories.length} categories`);
    
    res.json({
      success: true,
      categories: categories,
      message: `Found ${categories.length} categories`
    });
    
  } catch (error) {
    console.error('[CATEGORIES] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories'
    });
  }
});

// ====================================================================
// PRODUCTS ENDPOINTS
// ====================================================================

// GET /api/local-market/products - Get all local market products
router.get('/products', async (req, res) => {
  try {
    console.log('[PRODUCTS] Fetching local market products...');
    
    const { 
      category_id, 
      search, 
      min_price, 
      max_price, 
      availability, 
      sort_by = 'name',
      limit = 50,
      offset = 0 
    } = req.query;

    // Try database first, fallback to mock data if connection fails
    try {
    
    let whereConditions = ['lmp.is_active = 1', 'u.is_active = 1'];
    let queryParams = [];
    
    // Category filter
    if (category_id) {
      whereConditions.push('lmp.category_id = ?');
      queryParams.push(category_id);
    }
    
    // Search filter
    if (search) {
      whereConditions.push('(lmp.name LIKE ? OR lmp.description LIKE ? OR u.name LIKE ?)');
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }
    
    // Price range filter
    if (min_price) {
      whereConditions.push('lmp.price >= ?');
      queryParams.push(parseFloat(min_price));
    }
    
    if (max_price) {
      whereConditions.push('lmp.price <= ?');
      queryParams.push(parseFloat(max_price));
    }
    
    // Availability filter
    if (availability === 'in_stock') {
      whereConditions.push('lmp.stock_quantity > 0');
    } else if (availability === 'low_stock') {
      whereConditions.push('lmp.stock_quantity <= 5 AND lmp.stock_quantity > 0');
    }
    
    // Sort options
    let orderBy = 'lmp.created_at DESC';
    switch (sort_by) {
      case 'name':
        orderBy = 'lmp.name ASC';
        break;
      case 'price_low':
        orderBy = 'lmp.price ASC';
        break;
      case 'price_high':
        orderBy = 'lmp.price DESC';
        break;
      case 'rating':
        orderBy = 'u.rating DESC';
        break;
      case 'newest':
        orderBy = 'lmp.created_at DESC';
        break;
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    const query = `
      SELECT 
        lmp.id,
        lmp.name as product_name,
        lmp.description as product_description,
        lmp.price,
        lmp.unit_type,
        lmp.stock_quantity,
        lmp.minimum_order,
        lmp.maximum_order,
        lmp.main_image,
        lmp.images,
        lmp.is_organic,
        lmp.is_local_produce,
        lmp.expiry_date,
        lmp.storage_requirements,
        lmp.nutritional_info,
        lmp.origin_location,
        lmp.created_at,
        lmp.updated_at,
        lmc.id as category_id,
        lmc.name as category_name,
        lmc.icon as category_icon,
        u.id as seller_id,
        u.name as seller_name,
        u.email as seller_email,
        u.phone as seller_phone,
        u.city as seller_city,
        u.address as seller_address,
        u.latitude as seller_lat,
        u.longitude as seller_lng,
        COALESCE(u.rating, 4.5) as seller_rating,
        COALESCE(u.total_sales, 0) as seller_total_sales
      FROM local_market_products lmp
      LEFT JOIN local_market_categories lmc ON lmp.category_id = lmc.id
      LEFT JOIN users u ON lmp.seller_id = u.id
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;
    
    queryParams.push(parseInt(limit), parseInt(offset));
    
    const [products] = await pool.execute(query, queryParams);
    
    // Parse JSON fields
    products.forEach(product => {
      if (product.images) {
        try {
          product.images = JSON.parse(product.images);
        } catch (e) {
          product.images = [];
        }
      }
      
      if (product.nutritional_info) {
        try {
          product.nutritional_info = JSON.parse(product.nutritional_info);
        } catch (e) {
          product.nutritional_info = null;
        }
      }
    });
    
    console.log(`[PRODUCTS] Found ${products.length} products`);
    
    res.json({
      success: true,
      products: products,
      total: products.length,
      message: `Found ${products.length} products`
    });
    
    } catch (dbError) {
      console.warn('[PRODUCTS] Database error, using mock data:', dbError.message);
      
      // Use mock database as fallback
      const mockResult = await mockDB.getProducts({
        limit: parseInt(limit),
        offset: parseInt(offset),
        category: search // Simple category filter for mock
      });
      
      res.json({
        success: true,
        products: mockResult.products,
        total: mockResult.total,
        hasMore: mockResult.hasMore,
        message: `Found ${mockResult.products.length} products (demo data)`
      });
    }
    
  } catch (error) {
    console.error('[PRODUCTS] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products'
    });
  }
});

// GET /api/local-market/products/nearby - Get products filtered by user location
router.get('/products/nearby', async (req, res) => {
  try {
    console.log('[PRODUCTS] Fetching nearby local market products...');

    const { lat, lng, radius_km = 10, category_id, search, limit = 50, offset = 0 } = req.query;

    // Try database first, fallback to mock data if connection fails
    try {

    let whereConditions = ['lmp.is_active = 1', 'u.is_active = 1'];
    let queryParams = [];

    if (category_id) {
      whereConditions.push('lmp.category_id = ?');
      queryParams.push(category_id);
    }
    if (search) {
      whereConditions.push('(lmp.name LIKE ? OR lmp.description LIKE ? OR u.name LIKE ?)');
      const s = `%${search}%`;
      queryParams.push(s, s, s);
    }

    const whereClause = whereConditions.length ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const hasLocation = lat && lng;
    const radius = parseFloat(radius_km) || 10;

    const distanceSelect = hasLocation
      ? `, (6371 * 2 * ASIN(SQRT(POWER(SIN((? - ABS(u.latitude)) * PI()/180 / 2), 2) + COS(? * PI()/180) * COS(ABS(u.latitude) * PI()/180) * POWER(SIN((? - u.longitude) * PI()/180 / 2), 2)))) AS distance_km`
      : `, NULL AS distance_km`;

    const havingClause = hasLocation ? `HAVING distance_km <= ?` : '';

    const sql = `
      SELECT 
        lmp.id,
        lmp.name as product_name,
        lmp.description as product_description,
        lmp.price,
        lmp.unit_type,
        lmp.stock_quantity,
        lmp.minimum_order,
        lmp.maximum_order,
        lmp.main_image,
        lmp.images,
        lmc.id as category_id,
        lmc.name as category_name,
        u.id as seller_id,
        u.name as seller_name,
        u.latitude as seller_lat,
        u.longitude as seller_lng
        ${distanceSelect}
      FROM local_market_products lmp
      LEFT JOIN local_market_categories lmc ON lmp.category_id = lmc.id
      LEFT JOIN users u ON lmp.seller_id = u.id
      ${whereClause}
      ${hasLocation ? 'ORDER BY distance_km ASC' : 'ORDER BY lmp.created_at DESC'}
      LIMIT ? OFFSET ?
    `;

    const params = [];
    if (hasLocation) {
      // For distanceSelect: ?, ?, ? correspond to lat, lat, lng
      params.push(parseFloat(lat), parseFloat(lat), parseFloat(lng));
    }
    params.push(...queryParams);
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await pool.execute(sql, params);

    let products = rows;
    if (hasLocation) {
      products = rows.filter(r => r.distance_km == null || r.distance_km <= radius);
    }

    res.json({ success: true, products, total: products.length, hasMore: products.length === parseInt(limit) });
    
    } catch (dbError) {
      console.warn('[PRODUCTS/NEARBY] Database error, using mock data:', dbError.message);
      
      // Use mock database as fallback
      const mockResult = await mockDB.getNearbyProducts(lat, lng, {
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
      
      res.json({
        success: true,
        products: mockResult.products,
        total: mockResult.total,
        hasMore: mockResult.hasMore,
        message: `Found ${mockResult.products.length} nearby products (demo data)`
      });
    }
    
  } catch (error) {
    console.error('[PRODUCTS/NEARBY] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch nearby products' });
  }
});

// GET /api/local-market/products/:id - Get single product details
router.get('/products/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    console.log(`[PRODUCT-DETAILS] Fetching product ${productId}...`);
    
    const [products] = await pool.execute(`
      SELECT 
        lmp.*,
        lmc.name as category_name,
        lmc.icon as category_icon,
        u.name as seller_name,
        u.email as seller_email,
        u.phone as seller_phone,
        u.city as seller_city,
        u.address as seller_address,
        u.latitude as seller_lat,
        u.longitude as seller_lng,
        COALESCE(u.rating, 4.5) as seller_rating,
        COALESCE(u.total_sales, 0) as seller_total_sales
      FROM local_market_products lmp
      LEFT JOIN local_market_categories lmc ON lmp.category_id = lmc.id
      LEFT JOIN users u ON lmp.seller_id = u.id
      WHERE lmp.id = ? AND lmp.is_active = 1
    `, [productId]);
    
    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    const product = products[0];
    
    // Parse JSON fields
    if (product.images) {
      try {
        product.images = JSON.parse(product.images);
      } catch (e) {
        product.images = [];
      }
    }
    
    if (product.nutritional_info) {
      try {
        product.nutritional_info = JSON.parse(product.nutritional_info);
      } catch (e) {
        product.nutritional_info = null;
      }
    }
    
    res.json({
      success: true,
      product: product
    });
    
  } catch (error) {
    console.error('[PRODUCT-DETAILS] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product details'
    });
  }
});

// ====================================================================
// ORDERS ENDPOINTS
// ====================================================================

// POST /api/local-market/orders - Create new order
router.post('/orders', requireAuth, upload.single('paymentProof'), async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const userId = req.user.id;
    const { orderData } = req.body;
    
    console.log(`[CREATE-ORDER] Creating order for user ${userId}...`);
    
    if (!orderData) {
      throw new Error('Order data is required');
    }
    
    const order = JSON.parse(orderData);
    const { items, delivery, payment } = order;
    
    if (!items || items.length === 0) {
      throw new Error('Order must contain at least one item');
    }
    
    // Calculate total amount
    let totalAmount = 0;
    const orderItems = [];
    
    for (const item of items) {
      const [products] = await connection.execute(
        'SELECT * FROM local_market_products WHERE id = ? AND is_active = 1',
        [item.id]
      );
      
      if (products.length === 0) {
        throw new Error(`Product ${item.id} not found`);
      }
      
      const product = products[0];
      
      if (product.stock_quantity < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}`);
      }
      
      const itemTotal = product.price * item.quantity;
      totalAmount += itemTotal;
      
      orderItems.push({
        product_id: product.id,
        product_name: product.name,
        seller_id: product.seller_id,
        quantity: item.quantity,
        unit_price: product.price,
        total_price: itemTotal
      });
    }
    
    // Add delivery fee if applicable
    const deliveryFee = delivery?.fee || 0;
    totalAmount += deliveryFee;
    
    // Create order
    const orderNumber = `LM${Date.now()}${Math.floor(Math.random() * 1000)}`;
    
    const [orderResult] = await connection.execute(`
      INSERT INTO local_market_orders (
        order_number,
        buyer_id,
        total_amount,
        delivery_fee,
        delivery_address,
        delivery_phone,
        delivery_notes,
        payment_method,
        payment_status,
        status,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      orderNumber,
      userId,
      totalAmount,
      deliveryFee,
      delivery?.address || '',
      delivery?.phone || req.user.phone || '',
      delivery?.notes || '',
      payment?.method || 'mobile_money',
      'pending',
      'pending'
    ]);
    
    const orderId = orderResult.insertId;
    
    // Insert order items
    for (const item of orderItems) {
      await connection.execute(`
        INSERT INTO local_market_order_items (
          order_id,
          product_id,
          product_name,
          seller_id,
          quantity,
          unit_price,
          total_price
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        orderId,
        item.product_id,
        item.product_name,
        item.seller_id,
        item.quantity,
        item.unit_price,
        item.total_price
      ]);
      
      // Update product stock
      await connection.execute(
        'UPDATE local_market_products SET stock_quantity = stock_quantity - ? WHERE id = ?',
        [item.quantity, item.product_id]
      );
    }
    
    // Handle payment proof upload
    if (req.file) {
      const paymentProofPath = `/uploads/local-market/${req.file.filename}`;
      await connection.execute(
        'UPDATE local_market_orders SET payment_proof = ? WHERE id = ?',
        [paymentProofPath, orderId]
      );
    }
    
    // Add order tracking
    await connection.execute(`
      INSERT INTO local_market_order_tracking (
        order_id,
        status,
        notes,
        created_at
      ) VALUES (?, ?, ?, NOW())
    `, [orderId, 'pending', 'Order created and payment proof uploaded']);
    
    await connection.commit();
    
    console.log(`[CREATE-ORDER] Order ${orderNumber} created successfully`);
    
    res.json({
      success: true,
      message: 'Order created successfully',
      order: {
        id: orderId,
        order_number: orderNumber,
        total_amount: totalAmount,
        status: 'pending'
      }
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('[CREATE-ORDER] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create order'
    });
  } finally {
    connection.release();
  }
});

// GET /api/local-market/orders/my-orders - Get user's orders
router.get('/orders/my-orders', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`[MY-ORDERS] Fetching orders for user ${userId}...`);
    
    const [orders] = await pool.execute(`
      SELECT 
        lmo.*,
        COUNT(lmoi.id) as items_count
      FROM local_market_orders lmo
      LEFT JOIN local_market_order_items lmoi ON lmo.id = lmoi.order_id
      WHERE lmo.buyer_id = ?
      GROUP BY lmo.id
      ORDER BY lmo.created_at DESC
    `, [userId]);
    
    console.log(`[MY-ORDERS] Found ${orders.length} orders`);
    
    res.json({
      success: true,
      orders: orders,
      message: `Found ${orders.length} orders`
    });
    
  } catch (error) {
    console.error('[MY-ORDERS] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders'
    });
  }
});

// GET /api/local-market/orders/:id - Get order details
router.get('/orders/:id', requireAuth, async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.user.id;
    
    console.log(`[ORDER-DETAILS] Fetching order ${orderId} for user ${userId}...`);
    
    // Get order details
    const [orders] = await pool.execute(`
      SELECT lmo.*, u.name as buyer_name, u.email as buyer_email
      FROM local_market_orders lmo
      LEFT JOIN users u ON lmo.buyer_id = u.id
      WHERE lmo.id = ? AND lmo.buyer_id = ?
    `, [orderId, userId]);
    
    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    const order = orders[0];
    
    // Get order items
    const [items] = await pool.execute(`
      SELECT lmoi.*, lmp.main_image as product_image
      FROM local_market_order_items lmoi
      LEFT JOIN local_market_products lmp ON lmoi.product_id = lmp.id
      WHERE lmoi.order_id = ?
    `, [orderId]);
    
    // Get order tracking
    const [tracking] = await pool.execute(`
      SELECT * FROM local_market_order_tracking
      WHERE order_id = ?
      ORDER BY created_at ASC
    `, [orderId]);
    
    order.items = items;
    order.tracking = tracking;
    
    res.json({
      success: true,
      order: order
    });
    
  } catch (error) {
    console.error('[ORDER-DETAILS] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order details'
    });
  }
});

// ====================================================================
// DELIVERY CONFIRMATION ENDPOINTS
// ====================================================================

// POST /api/local-market/orders/:id/confirm-delivery - Confirm delivery
router.post('/orders/:id/confirm-delivery', requireAuth, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const orderId = req.params.id;
    const userId = req.user.id;
    const { verificationCode, rating, feedback, conditionChecks } = req.body;
    
    console.log(`[CONFIRM-DELIVERY] Confirming delivery for order ${orderId}...`);
    
    // Verify order exists and belongs to user
    const [orders] = await connection.execute(`
      SELECT * FROM local_market_orders 
      WHERE id = ? AND buyer_id = ? AND status = 'delivered'
    `, [orderId, userId]);
    
    if (orders.length === 0) {
      throw new Error('Order not found or not available for confirmation');
    }
    
    // Update order status
    await connection.execute(`
      UPDATE local_market_orders SET 
        status = 'completed',
        delivery_confirmed_at = NOW(),
        delivery_confirmation_data = ?,
        updated_at = NOW()
      WHERE id = ?
    `, [
      JSON.stringify({
        verificationCode,
        rating,
        feedback,
        conditionChecks,
        confirmedAt: new Date().toISOString()
      }),
      orderId
    ]);
    
    // Add tracking entry
    await connection.execute(`
      INSERT INTO local_market_order_tracking (
        order_id,
        status,
        notes,
        created_at
      ) VALUES (?, ?, ?, NOW())
    `, [orderId, 'completed', `Delivery confirmed by buyer${feedback ? ` - Feedback: ${feedback}` : ''}`]);
    
    await connection.commit();
    
    res.json({
      success: true,
      message: 'Delivery confirmed successfully!'
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('[CONFIRM-DELIVERY] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to confirm delivery'
    });
  } finally {
    connection.release();
  }
});

// ====================================================================
// SELLER ENDPOINTS (for local market sellers)
// ====================================================================

// GET /api/local-market/seller/orders - Get seller's orders
router.get('/seller/orders', requireAuth, async (req, res) => {
  try {
    const sellerId = req.user.id;
    console.log(`[SELLER-ORDERS] Fetching orders for seller ${sellerId}...`);
    
    const [orders] = await pool.execute(`
      SELECT DISTINCT
        lmo.id,
        lmo.order_number,
        lmo.total_amount,
        lmo.status,
        lmo.created_at,
        lmo.delivery_address,
        u.name as buyer_name,
        u.phone as buyer_phone,
        COUNT(lmoi.id) as items_count,
        SUM(CASE WHEN lmoi.seller_id = ? THEN lmoi.total_price ELSE 0 END) as seller_amount
      FROM local_market_orders lmo
      JOIN local_market_order_items lmoi ON lmo.id = lmoi.order_id
      LEFT JOIN users u ON lmo.buyer_id = u.id
      WHERE lmoi.seller_id = ?
      GROUP BY lmo.id
      ORDER BY lmo.created_at DESC
    `, [sellerId, sellerId]);
    
    console.log(`[SELLER-ORDERS] Found ${orders.length} orders`);
    
    res.json({
      success: true,
      orders: orders,
      message: `Found ${orders.length} orders`
    });
    
  } catch (error) {
    console.error('[SELLER-ORDERS] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch seller orders'
    });
  }
});

module.exports = router;