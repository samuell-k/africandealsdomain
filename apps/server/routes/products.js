const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAuth, requireRole } = require('../middleware/auth');
const CommissionService = require('../services/commissionService');
     
// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
 
// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Accept both main_image and gallery_images
const uploadFields = upload.fields([
  { name: 'main_image', maxCount: 1 },
  { name: 'gallery_images', maxCount: 10 }
]);

// GET /api/products - Get all products with optional filtering
router.get('/', async (req, res) => {
  try {
    const { 
      category_id, 
      search, 
      min_price, 
      max_price,
      sort = 'newest',
      page = 1, 
      limit = 20 
    } = req.query;
    
    let query = `
      SELECT 
        p.*,
        c.name as category_name,
        c.slug as category_slug,
        u.name as seller_name
      FROM products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      LEFT JOIN users u ON p.seller_id = u.id
      WHERE p.is_active = 1
    `;
    
    const params = [];
    
    if (category_id) {
      query += ' AND p.category_id = ?';
      params.push(category_id);
    }
    
    if (search) {
      query += ' AND (p.name LIKE ? OR p.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    if (min_price) {
      query += ' AND p.price >= ?';
      params.push(parseFloat(min_price));
    }
    
    if (max_price) { 
      query += ' AND p.price <= ?';
      params.push(parseFloat(max_price));
    }
    
    // Add sorting
    switch (sort) {
      case 'price-low':
        query += ' ORDER BY p.price ASC';
        break;
      case 'price-high':
        query += ' ORDER BY p.price DESC';
        break;
      case 'name':
        query += ' ORDER BY p.name ASC';
        break;
      case 'newest':
      default:
        query += ' ORDER BY p.created_at DESC';
        break;
    }
    
    // Add pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    
    const [rows] = await pool.execute(query, params);
    
    // Process products with commission pricing (hide commission from buyers)
    const deliveryType = req.query.delivery_type || 'pickup';
    const processedProducts = await CommissionService.processProductPricing(rows, deliveryType);
    
    res.json({
      success: true,
      products: processedProducts,
      count: processedProducts.length,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products'
    });
  }
});

// GET /api/products/seller - Get products for current seller
router.get('/seller', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const sellerId = req.user.id;
    
    const [rows] = await pool.execute(`
      SELECT 
        p.id, p.name, p.description, p.features, p.specifications_text, 
        p.whats_included, p.usage_instructions, p.warranty_period, p.return_policy,
        p.category_id, p.base_price as price, p.seller_id, p.stock_quantity, 
        p.main_image, p.specifications, p.is_active, p.created_at, p.updated_at,
        c.name as category_name,
        c.slug as category_slug
      FROM products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      WHERE p.seller_id = ? AND p.is_active = 1
      ORDER BY p.created_at DESC
    `, [sellerId]);

    // Add gallery images to each product
    for (const product of rows) {
      const [galleryImages] = await pool.execute(`
        SELECT image_url, sort_order
        FROM product_images
        WHERE product_id = ?
        ORDER BY sort_order ASC
      `, [product.id]);
      
      product.gallery_images = galleryImages.map(img => img.image_url);
    }

    res.json({
      success: true,
      products: rows,
      count: rows.length
    });
  } catch (error) {
    console.error('Error fetching seller products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch seller products'
    });
  }
});

// GET /api/products/:id - Get specific product with comprehensive details
router.get('/:id', async (req, res) => {
  try {
    console.log(`Fetching product details for ID: ${req.params.id}`);
    
    // Fetch comprehensive product information (starting with core columns)
    const [rows] = await pool.execute(`
      SELECT 
        p.*,
        c.name as category_name,
        c.slug as category_slug,
        u.name as seller_name,
        u.email as seller_email,
        u.phone as seller_phone
      FROM products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      LEFT JOIN users u ON p.seller_id = u.id
      WHERE p.id = ? AND p.is_active = 1
    `, [req.params.id]);

    console.log(`Found ${rows.length} products`);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    const product = rows[0];
    console.log(`Product found: ${product.name}`);

    // Fetch gallery images
    console.log('Fetching gallery images...');
    const [galleryImages] = await pool.execute(`
      SELECT image_url, sort_order
      FROM product_images
      WHERE product_id = ?
      ORDER BY sort_order ASC
    `, [product.id]);

    product.gallery_images = galleryImages.map(img => img.image_url);
    console.log(`Gallery images: ${product.gallery_images.length}`);

    // Fetch product reviews and ratings (with fallback)
    let reviewStats = [{
      total_reviews: 0,
      average_rating: 0,
      five_stars: 0,
      four_stars: 0,
      three_stars: 0,
      two_stars: 0,
      one_star: 0
    }];
    let reviews = [];

    try {
      const [reviewStatsResult] = await pool.execute(`
        SELECT 
          COUNT(*) as total_reviews,
          AVG(rating) as average_rating,
          SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_stars,
          SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_stars,
          SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_stars,
          SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two_stars,
          SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one_star
        FROM product_reviews 
        WHERE product_id = ? AND is_approved = 1
      `, [product.id]);
      reviewStats = reviewStatsResult;

      // Fetch recent reviews
      const [reviewsResult] = await pool.execute(`
        SELECT 
          pr.*,
          u.name as reviewer_name,
          u.profile_image as reviewer_image
        FROM product_reviews pr
        LEFT JOIN users u ON pr.user_id = u.id
        WHERE pr.product_id = ? AND pr.is_approved = 1
        ORDER BY pr.created_at DESC
        LIMIT 5
      `, [product.id]);
      reviews = reviewsResult;
    } catch (error) {
      console.warn('Product reviews table not found, using default values');
    }

    // Fetch related products (same category)
    const [relatedProducts] = await pool.execute(`
      SELECT 
        p.id, p.name, p.price, p.main_image,
        u.name as seller_name
      FROM products p
      LEFT JOIN users u ON p.seller_id = u.id
      WHERE p.category_id = ? 
        AND p.id != ? 
        AND p.is_active = 1
      ORDER BY p.created_at DESC
      LIMIT 4
    `, [product.category_id, product.id]);

    // Fetch product view count (if tracking enabled)
    let viewCount = [{ views: 0 }];
    try {
      const [viewCountResult] = await pool.execute(`
        SELECT COUNT(*) as views
        FROM product_views
        WHERE product_id = ?
      `, [product.id]);
      viewCount = viewCountResult;
    } catch (error) {
      console.warn('Product views table not found, using default values');
    }

    // Add comprehensive product data
    product.reviews = {
      stats: reviewStats[0] || {
        total_reviews: 0,
        average_rating: 0,
        five_stars: 0,
        four_stars: 0,
        three_stars: 0,
        two_stars: 0,
        one_star: 0
      },
      recent: reviews
    };

    product.related_products = relatedProducts;
    product.view_count = viewCount[0]?.views || 0;

    // Enhanced seller information
    product.seller_info = {
      id: product.seller_id,
      name: product.seller_name,
      email: product.seller_email,
      phone: product.seller_phone,
      rating: parseFloat(product.seller_rating) || 0,
      total_sales: parseFloat(product.seller_total_sales) || 0,
      profile_image: product.seller_profile_image,
      location: `${product.seller_city || 'Unknown'}, ${product.seller_country || 'Unknown'}`,
      joined_date: product.created_at
    };

    // Enhanced category information
    product.category_info = {
      id: product.category_id,
      name: product.category_name,
      slug: product.category_slug,
      description: product.category_description,
      parent_category: product.parent_category_name
    };

    // Parse specifications if they exist
    if (product.specifications) {
      try {
        product.specifications = JSON.parse(product.specifications);
      } catch (e) {
        console.warn('Invalid specifications JSON for product', product.id);
      }
    }

    // Add product metadata
    product.meta = {
      view_count: product.view_count,
      is_featured: Boolean(product.is_featured),
      is_boosted: Boolean(product.is_boosted),
      is_sponsored: Boolean(product.is_sponsored),
      commission_rate: parseFloat(product.commission_rate) || 1.0,
      last_updated: product.updated_at
    };

    // Process product with commission pricing (hide commission from buyers)
    const deliveryType = req.query.delivery_type || 'pickup';
    const [processedProduct] = await CommissionService.processProductPricing([product], deliveryType);

    // Log product view (optional - for analytics)
    try {
      await pool.execute(`
        INSERT INTO product_views (product_id, viewed_at, ip_address) 
        VALUES (?, NOW(), ?) 
        ON DUPLICATE KEY UPDATE viewed_at = NOW()
      `, [product.id, req.ip || 'unknown']);
    } catch (error) {
      // Ignore view tracking errors - table may not exist yet
      if (error.code !== 'ER_NO_SUCH_TABLE') {
        console.warn('Failed to track product view:', error.message);
      }
    }

    res.json({
      success: true,
      product: processedProduct
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product details'
    });
  }
});

// GET /api/products/seller/dashboard - Get seller dashboard data
router.get('/seller/dashboard', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const sellerId = req.user.id;
    
    const [rows] = await pool.execute(`
      SELECT 
        p.id, p.name, p.description, p.features, p.specifications_text, 
        p.whats_included, p.usage_instructions, p.warranty_period, p.return_policy,
        p.category_id, p.base_price as price, p.seller_id, p.stock_quantity, 
        p.main_image, p.specifications, p.is_active, p.created_at, p.updated_at,
        c.name as category_name,
        c.slug as category_slug
      FROM products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      WHERE p.seller_id = ? AND p.is_active = 1
      ORDER BY p.created_at DESC
    `, [sellerId]);

    // Add gallery images to each product
    for (const product of rows) {
      const [galleryImages] = await pool.execute(`
        SELECT image_url, sort_order
        FROM product_images
        WHERE product_id = ?
        ORDER BY sort_order ASC
      `, [product.id]);
      
      product.gallery_images = galleryImages.map(img => img.image_url);
    }

    res.json({
      success: true,
      products: rows,
      count: rows.length
    });
  } catch (error) {
    console.error('Error fetching seller products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch seller products'
    });
  }
});

// POST /api/products - Create new product with flexible specifications
router.post('/', requireAuth, requireRole('seller'), uploadFields, async (req, res) => {
  try {
    const {
      name,
      description,
      category_id,
      sub_category_id,
      brand,
      sku,
      condition,
      price,
      currency,
      discount_price,
      moq,
      stock,
      stock_quantity,
      features,
      specifications_text,
      whats_included,
      usage_instructions,
      warranty_period,
      return_policy,
      tags,
      certifications,
      specifications
    } = req.body;

    // Validate required fields (only fields that exist in database)
    const stockQuantity = stock || stock_quantity;
    if (!name || !description || !category_id || !price || !stockQuantity) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, description, category_id, price, stock'
      });
    }

    // Validate category exists
    const [categoryCheck] = await pool.execute(
      'SELECT id FROM product_categories WHERE id = ? AND is_active = 1',
      [category_id]
    );

    if (categoryCheck.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid category'
      });
    }

    // Validate subcategory if provided
    if (sub_category_id) {
      const [subCategoryCheck] = await pool.execute(
        'SELECT id FROM product_categories WHERE id = ? AND parent_id = ? AND is_active = 1',
        [sub_category_id, category_id]
      );

      if (subCategoryCheck.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid subcategory'
        });
      }
    }

    // Get seller ID from authenticated user
    const sellerId = req.user.id;

    // Parse specifications if provided
    let specsJson = null;
    if (specifications) {
      try {
        specsJson = typeof specifications === 'string' ? JSON.parse(specifications) : specifications;
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: 'Invalid specifications format'
        });
      }
    }

    // FIXED: Proper pricing structure
    // base_price: Seller's original price (what seller entered)
    // display_price: Final price buyers see (base_price + 21% commission)
    // price: Same as display_price for backward compatibility
    
    const basePrice = parseFloat(price); // Seller's original price
    const platformCommissionRate = 0.21; // 21% platform commission
    const displayPrice = Math.round(basePrice * (1 + platformCommissionRate)); // base_price + 21%
    
    console.log(`💰 PRICING CALCULATION:
    - Seller Base Price: ${basePrice} FRW
    - Platform Commission (21%): ${Math.round(basePrice * platformCommissionRate)} FRW  
    - Final Display Price: ${displayPrice} FRW`);
    
    // Insert product with CORRECTED pricing structure
    const [result] = await pool.execute(`
      INSERT INTO products (
        name, description, features, specifications_text, whats_included, usage_instructions,
        warranty_period, return_policy, category_id, base_price, display_price, price, seller_id, 
        stock_quantity, main_image, specifications, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [
      name, description, features, specifications_text, whats_included, usage_instructions,
      warranty_period, return_policy, category_id, basePrice, displayPrice, displayPrice, sellerId, 
      stockQuantity, req.files?.main_image?.[0]?.filename || null, 
      specsJson ? JSON.stringify(specsJson) : null
    ]);

    // Response with corrected pricing structure
    const productResponse = {
      id: result.insertId,
      name,
      category_id,
      base_price: basePrice,           // Seller's original price
      display_price: displayPrice,     // Final buyer-facing price (includes 21% commission)
      price: displayPrice,             // Same as display_price for compatibility
      platform_commission: Math.round(basePrice * platformCommissionRate),
      commission_rate: (platformCommissionRate * 100) + '%',
      currency: currency || 'FRW'
    };

    // Note: Specifications are stored in the frontend for now
    // TODO: Create product_specifications table for better querying

    // Handle gallery images if provided
    if (req.files && req.files.gallery_images && req.files.gallery_images.length > 0) {
      for (const file of req.files.gallery_images) {
        await pool.execute(
          'INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?, ?, ?)',
          [result.insertId, file.filename, 0]
        );
      }
    }

    res.status(201).json({
      success: true,
      product: productResponse
    });
  } catch (error) {
    console.error('Error creating product:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    res.status(500).json({
      success: false,
      error: 'Failed to create product',
      details: error.message
    });
  }
});

// PUT /api/products/:id - Update product
router.put('/:id', requireAuth, requireRole('seller'), upload.single('main_image'), async (req, res) => {
  try {
    const productId = req.params.id;
    const updateFields = req.body;
    
    // Check if product exists and belongs to seller
    const [existing] = await pool.execute(
      'SELECT id FROM products WHERE id = ? AND seller_id = ?',
      [productId, req.user.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found or access denied'
      });
    }

    // Build update query dynamically
    const allowedFields = [
      'name', 'description', 'category_id', 'brand', 'sku', 'condition',
      'price', 'currency', 'discount_price', 'moq', 'stock_quantity',
      'weight', 'length', 'width', 'height', 'origin_country',
      'tags', 'certifications'
    ];

    const updates = [];
    const values = [];

    for (const field of allowedFields) {
      if (updateFields[field] !== undefined) {
        // If seller updates price, treat it as base price and compute final buyer price = base * 1.21
        if (field === 'price') {
          const newBase = parseFloat(updateFields[field]);
          if (!isNaN(newBase)) {
            updates.push('base_price = ?');
            values.push(newBase);
            updates.push('price = ?');
            values.push(Math.round(newBase * 1.21));
          }
          continue; // skip default handling for 'price'
        }
        // Escape reserved keywords with backticks
        const escapedField = field === 'condition' ? '`condition`' : field;
        updates.push(`${escapedField} = ?`);
        values.push(updateFields[field]);
      }
    }

    if (req.file) {
      updates.push('main_image = ?');
      values.push(req.file.filename);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }

    updates.push('updated_at = NOW()');
    values.push(productId);

    await pool.execute(
      `UPDATE products SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    res.json({
      success: true,
      message: 'Product updated successfully'
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update product'
    });
  }
});

// DELETE /api/products/:id - Delete product (soft delete)
router.delete('/:id', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const productId = req.params.id;
    
    // Check if product exists and belongs to seller
    const [existing] = await pool.execute(
      'SELECT id FROM products WHERE id = ? AND seller_id = ?',
      [productId, req.user.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found or access denied'
      });
    }

    // Soft delete
    await pool.execute(
      'UPDATE products SET is_active = 0, updated_at = NOW() WHERE id = ?',
      [productId]
    );

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete product'
    });
  }
});

// GET /api/products/category/:slug - Get products by category slug
router.get('/category/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const { 
      sub_category, 
      search, 
      min_price, 
      max_price, 
      sort_by = 'created_at', 
      sort_order = 'DESC',
      page = 1, 
      limit = 20,
      specifications 
    } = req.query;

    // Get category ID from slug
    const [categoryRows] = await pool.execute(
      'SELECT id, name FROM product_categories WHERE slug = ? AND parent_id IS NULL AND is_active = 1',
      [slug]
    );

    if (categoryRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Category not found'
      });
    }

    const categoryId = categoryRows[0].id;
    const categoryName = categoryRows[0].name;

    // Build query conditions
    let whereConditions = ['p.category_id = ?', 'p.is_active = 1', 'p.is_approved = 1'];
    let queryParams = [categoryId];

    // Add subcategory filter
    if (sub_category) {
      const [subCatRows] = await pool.execute(
        'SELECT id FROM product_categories WHERE slug = ? AND parent_id = ? AND is_active = 1',
        [sub_category, categoryId]
      );
      
      if (subCatRows.length > 0) {
        whereConditions.push('p.sub_category_id = ?');
        queryParams.push(subCatRows[0].id);
      }
    }

    // Add search filter
    if (search) {
      whereConditions.push('(p.name LIKE ? OR p.description LIKE ? OR p.tags LIKE ?)');
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    // Add price filters
    if (min_price) {
      whereConditions.push('p.price >= ?');
      queryParams.push(parseFloat(min_price));
    }
    if (max_price) {
      whereConditions.push('p.price <= ?');
      queryParams.push(parseFloat(max_price));
    }

    // Add specification filters
    if (specifications) {
      try {
        const specFilters = JSON.parse(specifications);
        for (const [fieldName, fieldValue] of Object.entries(specFilters)) {
          if (fieldValue && fieldValue !== '') {
            whereConditions.push(`EXISTS (
              SELECT 1 FROM product_specifications ps 
              WHERE ps.product_id = p.id 
              AND ps.field_name = ? 
              AND ps.field_value LIKE ?
            )`);
            queryParams.push(fieldName, `%${fieldValue}%`);
          }
        }
      } catch (e) {
        console.error('Error parsing specification filters:', e);
      }
    }

    // Calculate offset
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build the main query
    const baseQuery = `
      FROM products p
      LEFT JOIN users u ON p.seller_id = u.id
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      LEFT JOIN product_categories sc ON p.sub_category_id = sc.id
      WHERE ${whereConditions.join(' AND ')}
    `;

    // Get total count
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total ${baseQuery}`,
      queryParams
    );
    const total = countResult[0].total;

    // Get products
    const [productsRaw] = await pool.execute(`
      SELECT 
        p.*,
        u.username as seller_name,
        u.email as seller_email,
        pc.name as category_name,
        sc.name as sub_category_name,
        sc.slug as sub_category_slug
      ${baseQuery}
      ORDER BY p.${sort_by} ${sort_order}
      LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), offset]);

    // Normalize pricing for buyer display (ensure 21% included)
    const products = await CommissionService.processProductPricing(productsRaw, 'pickup');

    // Get specifications for each product
    for (const product of products) {
      const [specs] = await pool.execute(
        'SELECT field_name, field_value FROM product_specifications WHERE product_id = ?',
        [product.id]
      );
      
      product.specifications = {};
      specs.forEach(spec => {
        product.specifications[spec.field_name] = spec.field_value;
      });

      // Parse JSON specifications if available
      if (product.specifications && typeof product.specifications === 'string') {
        try {
          product.specifications = JSON.parse(product.specifications);
        } catch (e) {
          // Keep as is if parsing fails
        }
      }

      // Get gallery images
      const [galleryImages] = await pool.execute(`
        SELECT image_url 
        FROM product_images 
        WHERE product_id = ? 
        ORDER BY sort_order ASC
      `, [product.id]);
      
      product.gallery_images = galleryImages.map(img => img.image_url);
    }

    res.json({
      success: true,
      products: products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / parseInt(limit))
      },
      category: {
        id: categoryId,
        name: categoryName,
        slug: slug
      }
    });
  } catch (error) {
    console.error('Error fetching products by category:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products'
    });
  }
});

// GET /api/products/:id/specifications - Get product specifications
router.get('/:id/specifications', async (req, res) => {
  try {
    const [specs] = await pool.execute(
      'SELECT field_name, field_value FROM product_specifications WHERE product_id = ?',
      [req.params.id]
    );

    const specifications = {};
    specs.forEach(spec => {
      specifications[spec.field_name] = spec.field_value;
    });

    res.json({
      success: true,
      specifications: specifications
    });
  } catch (error) {
    console.error('Error fetching product specifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch specifications'
    });
  }
});


// Admin product management routes
router.put('/:id/approve', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.execute(
      'UPDATE products SET status = ?, updated_at = NOW() WHERE id = ?',
      ['approved', id]
    );
    
    res.json({ success: true, message: 'Product approved successfully' });
  } catch (error) {
    console.error('Error approving product:', error);
    res.status(500).json({ success: false, message: 'Failed to approve product' });
  }
});

router.put('/:id/reject', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    await pool.execute(
      'UPDATE products SET status = ?, rejection_reason = ?, updated_at = NOW() WHERE id = ?',
      ['rejected', reason, id]
    );
    
    res.json({ success: true, message: 'Product rejected successfully' });
  } catch (error) {
    console.error('Error rejecting product:', error);
    res.status(500).json({ success: false, message: 'Failed to reject product' });
  }
});

router.delete('/:id', requireAuth, requireRole(['admin', 'seller']), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // If seller, check ownership
    if (userRole === 'seller') {
      const [products] = await pool.execute(
        'SELECT seller_id FROM products WHERE id = ?',
        [id]
      );
      
      if (products.length === 0 || products[0].seller_id !== userId) {
        return res.status(403).json({ success: false, message: 'Not authorized to delete this product' });
      }
    }
    
    await pool.execute('DELETE FROM products WHERE id = ?', [id]);
    
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ success: false, message: 'Failed to delete product' });
  }
});

module.exports = router; 