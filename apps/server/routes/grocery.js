const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const authMiddleware = require('../middleware/auth');
const { authenticateToken, isBuyer, isSeller, isAgent, isAdmin } = authMiddleware;

// Database connection
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'add_physical_product',
  port: process.env.DB_PORT || 3333
};

// Get grocery categories
router.get('/categories', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    const [categories] = await connection.execute(`
      SELECT 
        id,
        name,
        slug,
        icon,
        description,
        is_active
      FROM grocery_categories 
      WHERE is_active = 1
      ORDER BY sort_order ASC, name ASC
    `);
    
    await connection.end();
    
    res.json({
      success: true,
      categories: categories
    });
  } catch (error) {
    console.error('Error fetching grocery categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories'
    });
  }
});

// Get grocery products with location-based filtering
router.get('/products', async (req, res) => {
  try {
    const {
      category,
      search,
      min_price,
      max_price,
      unit_types,
      lat,
      lng,
      radius = 30,
      page = 1,
      limit = 12,
      sort = 'distance'
    } = req.query;

    const connection = await mysql.createConnection(dbConfig);
    
    let whereConditions = ['p.is_active = 1', 'u.is_active = 1'];
    let queryParams = [];
    
    // Category filter
    if (category) {
      whereConditions.push('gc.slug = ?');
      queryParams.push(category);
    }
    
    // Search filter
    if (search) {
      whereConditions.push('(p.name LIKE ? OR p.description LIKE ?)');
      queryParams.push(`%${search}%`, `%${search}%`);
    }
    
    // Price range filter
    if (min_price) {
      whereConditions.push('gp.unit_price >= ?');
      queryParams.push(parseFloat(min_price));
    }
    
    if (max_price) {
      whereConditions.push('gp.unit_price <= ?');
      queryParams.push(parseFloat(max_price));
    }
    
    // Unit type filter
    if (unit_types) {
      const units = Array.isArray(unit_types) ? unit_types : [unit_types];
      const placeholders = units.map(() => '?').join(',');
      whereConditions.push(`gp.unit_type IN (${placeholders})`);
      queryParams.push(...units);
    }
    
    // Location-based filtering
    let distanceSelect = '';
    let distanceWhere = '';
    if (lat && lng) {
      distanceSelect = `, (6371 * acos(cos(radians(?)) * cos(radians(COALESCE(u.latitude, -1.9441))) * cos(radians(COALESCE(u.longitude, 30.0619)) - radians(?)) + sin(radians(?)) * sin(radians(COALESCE(u.latitude, -1.9441))))) AS distance_km`;
      distanceWhere = `HAVING distance_km <= ${radius}`;
      queryParams.unshift(parseFloat(lat), parseFloat(lng), parseFloat(lat));
    }
    
    // Sorting
    let orderBy = 'gp.created_at DESC';
    switch (sort) {
      case 'distance':
        orderBy = lat && lng ? 'distance_km ASC' : 'gp.created_at DESC';
        break;
      case 'price_low':
        orderBy = 'gp.unit_price ASC';
        break;
      case 'price_high':
        orderBy = 'gp.unit_price DESC';
        break;
      case 'newest':
        orderBy = 'gp.created_at DESC';
        break;
      case 'rating':
        orderBy = 'u.rating DESC';
        break;
    }
    
    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    queryParams.push(parseInt(limit), offset);
    
    const query = `
      SELECT 
        gp.id,
        gp.product_id,
        gp.unit_type,
        gp.unit_price,
        gp.minimum_order,
        gp.maximum_order,
        gp.available_stock,
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
        u.name as seller_name,
        u.email as seller_email,
        u.phone as seller_phone,
        u.city as seller_city,
        COALESCE(u.total_sales, 0) as seller_total_sales,
        u.address as seller_location,
        u.latitude as lat,
        u.longitude as lng,
        COALESCE(u.rating, 0) as seller_rating
        ${distanceSelect}
      FROM grocery_products gp
      LEFT JOIN products p ON gp.product_id = p.id
      LEFT JOIN grocery_categories gc ON p.category_id = gc.id
      LEFT JOIN users u ON p.seller_id = u.id
      WHERE ${whereConditions.join(' AND ')}
      ${distanceWhere}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;
    
    const [products] = await connection.execute(query, queryParams);
    
    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM grocery_products gp
      LEFT JOIN products p ON gp.product_id = p.id
      LEFT JOIN grocery_categories gc ON p.category_id = gc.id
      LEFT JOIN users u ON p.seller_id = u.id
      WHERE ${whereConditions.join(' AND ')}
    `;
    
    const [countResult] = await connection.execute(countQuery, queryParams.slice(0, -2));
    const totalProducts = countResult[0].total;
    
    await connection.end();
    
    res.json({
      success: true,
      products: products,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(totalProducts / parseInt(limit)),
        total_products: totalProducts,
        per_page: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching grocery products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products'
    });
  }
});

// Get single grocery product details
router.get('/product/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { lat, lng } = req.query;
    
    const connection = await mysql.createConnection(dbConfig);
    
    let distanceSelect = '';
    let queryParams = [id];
    
    if (lat && lng) {
      distanceSelect = `, (6371 * acos(cos(radians(?)) * cos(radians(p.lat)) * cos(radians(p.lng) - radians(?)) + sin(radians(?)) * sin(radians(p.lat)))) AS distance_km`;
      queryParams.unshift(parseFloat(lat), parseFloat(lng), parseFloat(lat));
      queryParams.push(id);
    }
    
    const [products] = await connection.execute(`
      SELECT 
        gp.id,
        gp.product_id,
        gp.unit_type,
        gp.unit_price,
        gp.minimum_order,
        gp.maximum_order,
        gp.available_stock,
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
        u.name as seller_name,
        u.email as seller_email,
        u.phone as seller_phone,
        u.city as seller_city,
        COALESCE(u.total_sales, 0) as seller_total_sales,
        u.address as seller_location,
        COALESCE(u.rating, 0) as seller_rating,
        u.created_at as seller_since
        ${distanceSelect}
      FROM grocery_products gp
      LEFT JOIN products p ON gp.product_id = p.id
      LEFT JOIN grocery_categories gc ON p.category_id = gc.id
      LEFT JOIN users u ON p.seller_id = u.id
      WHERE gp.id = ? AND p.is_active = 1
    `, queryParams);
    
    if (products.length === 0) {
      await connection.end();
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    const product = products[0];
    
    // Get product images
    const [images] = await connection.execute(`
      SELECT image_path, is_main
      FROM grocery_product_images
      WHERE grocery_product_id = ?
      ORDER BY is_main DESC, created_at ASC
    `, [id]);
    
    product.images = images;
    
    // Get related products from same category
    const [relatedProducts] = await connection.execute(`
      SELECT 
        gp.id,
        p.name as product_name,
        gp.unit_price,
        gp.unit_type,
        p.main_image,
        u.name as seller_name,
        u.city as seller_city
      FROM grocery_products gp
      LEFT JOIN products p ON gp.product_id = p.id
      LEFT JOIN users u ON p.seller_id = u.id
      WHERE p.category_id = ? AND gp.id != ? AND p.is_active = 1
      ORDER BY gp.created_at DESC, RAND()
      LIMIT 6
    `, [product.main_category_id, id]);
    
    product.related_products = relatedProducts;
    
    await connection.end();
    
    res.json({
      success: true,
      product: product
    });
  } catch (error) {
    console.error('Error fetching product details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product details'
    });
  }
});

// Add to cart
router.post('/cart/add', authenticateToken, async (req, res) => {
  try {
    const { grocery_product_id, quantity } = req.body;
    const userId = req.user.id;
    
    if (!grocery_product_id || !quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product or quantity'
      });
    }
    
    const connection = await mysql.createConnection(dbConfig);
    
    // Check if product exists and is available
    const [products] = await connection.execute(`
      SELECT id, unit_price, minimum_order, available_stock, seller_id
      FROM grocery_products
      WHERE id = ? AND is_active = 1
    `, [grocery_product_id]);
    
    if (products.length === 0) {
      await connection.end();
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    const product = products[0];
    
    // Check minimum order quantity
    if (quantity < product.minimum_order) {
      await connection.end();
      return res.status(400).json({
        success: false,
        message: `Minimum order quantity is ${product.minimum_order}`
      });
    }
    
    // Check stock availability
    if (quantity > product.available_stock) {
      await connection.end();
      return res.status(400).json({
        success: false,
        message: 'Insufficient stock available'
      });
    }
    
    // Check if item already in cart
    const [existingItems] = await connection.execute(`
      SELECT id, quantity
      FROM grocery_cart_items
      WHERE buyer_id = ? AND grocery_product_id = ?
    `, [userId, grocery_product_id]);
    
    if (existingItems.length > 0) {
      // Update existing cart item
      const newQuantity = existingItems[0].quantity + quantity;
      const totalPrice = newQuantity * product.unit_price;
      
      await connection.execute(`
        UPDATE grocery_cart_items
        SET quantity = ?, total_price = ?, updated_at = NOW()
        WHERE id = ?
      `, [newQuantity, totalPrice, existingItems[0].id]);
    } else {
      // Add new cart item
      const totalPrice = quantity * product.unit_price;
      
      await connection.execute(`
        INSERT INTO grocery_cart_items (buyer_id, grocery_product_id, quantity, unit_price, total_price, created_at)
        VALUES (?, ?, ?, ?, ?, NOW())
      `, [userId, grocery_product_id, quantity, product.unit_price, totalPrice]);
    }
    
    await connection.end();
    
    res.json({
      success: true,
      message: 'Product added to cart successfully'
    });
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add product to cart'
    });
  }
});

// Get cart items
router.get('/cart', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const connection = await mysql.createConnection(dbConfig);
    
    const [cartItems] = await connection.execute(`
      SELECT 
        gci.*,
        gp.product_name,
        gp.unit_type,
        gp.main_image,
        gp.available_stock,
        gp.seller_id,
        u.name as seller_name,
        u.city as seller_city
      FROM grocery_cart_items gci
      LEFT JOIN grocery_products gp ON gci.grocery_product_id = gp.id
      LEFT JOIN users u ON gp.seller_id = u.id
      WHERE gci.buyer_id = ?
      ORDER BY gci.created_at DESC
    `, [userId]);
    
    // Calculate totals
    const subtotal = cartItems.reduce((sum, item) => sum + parseFloat(item.total_price), 0);
    const platformCommission = subtotal * 0.01; // 1% commission
    const packagingFee = 200; // Fixed packaging fee
    const deliveryFee = 1000; // Base delivery fee (will be calculated based on location)
    const total = subtotal + platformCommission + packagingFee + deliveryFee;
    
    await connection.end();
    
    res.json({
      success: true,
      cart: {
        items: cartItems,
        summary: {
          subtotal: subtotal,
          platform_commission: platformCommission,
          packaging_fee: packagingFee,
          delivery_fee: deliveryFee,
          total: total,
          item_count: cartItems.length
        }
      }
    });
  } catch (error) {
    console.error('Error fetching cart:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cart'
    });
  }
});

// Update cart item quantity
router.put('/cart/update/:itemId', authenticateToken, async (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;
    const userId = req.user.id;
    
    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid quantity'
      });
    }
    
    const connection = await mysql.createConnection(dbConfig);
    
    // Get cart item with product details
    const [cartItems] = await connection.execute(`
      SELECT 
        gci.*,
        gp.unit_price,
        gp.minimum_order,
        gp.available_stock
      FROM grocery_cart_items gci
      LEFT JOIN grocery_products gp ON gci.grocery_product_id = gp.id
      WHERE gci.id = ? AND gci.buyer_id = ?
    `, [itemId, userId]);
    
    if (cartItems.length === 0) {
      await connection.end();
      return res.status(404).json({
        success: false,
        message: 'Cart item not found'
      });
    }
    
    const cartItem = cartItems[0];
    
    // Validate quantity
    if (quantity < cartItem.minimum_order) {
      await connection.end();
      return res.status(400).json({
        success: false,
        message: `Minimum order quantity is ${cartItem.minimum_order}`
      });
    }
    
    if (quantity > cartItem.available_stock) {
      await connection.end();
      return res.status(400).json({
        success: false,
        message: 'Insufficient stock available'
      });
    }
    
    // Update cart item
    const totalPrice = quantity * cartItem.unit_price;
    
    await connection.execute(`
      UPDATE grocery_cart_items
      SET quantity = ?, total_price = ?, updated_at = NOW()
      WHERE id = ?
    `, [quantity, totalPrice, itemId]);
    
    await connection.end();
    
    res.json({
      success: true,
      message: 'Cart updated successfully'
    });
  } catch (error) {
    console.error('Error updating cart:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update cart'
    });
  }
});

// Remove item from cart
router.delete('/cart/remove/:itemId', authenticateToken, async (req, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.user.id;
    
    const connection = await mysql.createConnection(dbConfig);
    
    await connection.execute(`
      DELETE FROM grocery_cart_items
      WHERE id = ? AND buyer_id = ?
    `, [itemId, userId]);
    
    await connection.end();
    
    res.json({
      success: true,
      message: 'Item removed from cart'
    });
  } catch (error) {
    console.error('Error removing cart item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove item from cart'
    });
  }
});

module.exports = router;