const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken, isBuyer, isSeller, isAgent, isAdmin } = require('../middleware/auth');

// Database connection
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'add_physical_product',
  port: process.env.DB_PORT || 3333
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/grocery-products');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'grocery-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 5 // Maximum 5 files
  },
  fileFilter: function (req, file, cb) {
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Middleware to check seller role
const sellerAuth = async (req, res, next) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [users] = await connection.execute(`
      SELECT role FROM users WHERE id = ?
    `, [req.user.id]);
    await connection.end();
    
    if (users.length === 0 || users[0].role !== 'seller') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Seller role required.'
      });
    }
    
    next();
  } catch (error) {
    console.error('Seller auth error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

// Get grocery categories
router.get('/categories', authenticateToken, async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    const [categories] = await connection.execute(`
      SELECT id, name, slug, description, icon, parent_id, sort_order
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

// Add grocery product
router.post('/add-grocery-product', authenticateToken, sellerAuth, upload.array('product_images', 5), async (req, res) => {
  let connection;
  
  try {
    const {
      product_name,
      category_id,
      product_description,
      unit_price,
      unit_type,
      minimum_order,
      available_stock,
      seller_address,
      seller_latitude,
      seller_longitude
    } = req.body;

    const sellerId = req.user.id;

    // Validate required fields
    if (!product_name || !category_id || !unit_price || !unit_type || !available_stock) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Validate numeric fields
    if (parseFloat(unit_price) <= 0 || parseFloat(available_stock) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Price and stock must be greater than 0'
      });
    }

    connection = await mysql.createConnection(dbConfig);
    await connection.beginTransaction();

    try {
      // Check if grocery category exists
      const [groceryCategories] = await connection.execute(`
        SELECT id FROM grocery_categories WHERE id = ? AND is_active = 1
      `, [category_id]);

      if (groceryCategories.length === 0) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'Invalid grocery category selected'
        });
      }

      // Find or create corresponding product category
      const [productCategories] = await connection.execute(`
        SELECT id FROM product_categories WHERE name = (
          SELECT name FROM grocery_categories WHERE id = ?
        )
      `, [category_id]);

      let productCategoryId = null;
      if (productCategories.length > 0) {
        productCategoryId = productCategories[0].id;
      } else {
        // Create product category based on grocery category
        const [groceryCat] = await connection.execute(`
          SELECT name, description FROM grocery_categories WHERE id = ?
        `, [category_id]);
        
        if (groceryCat.length > 0) {
          const [newCatResult] = await connection.execute(`
            INSERT INTO product_categories (name, description, is_active, created_at)
            VALUES (?, ?, 1, NOW())
          `, [groceryCat[0].name, groceryCat[0].description || '']);
          productCategoryId = newCatResult.insertId;
        }
      }

      // Set main image
      let mainImage = null;
      if (req.files && req.files.length > 0) {
        mainImage = `/uploads/grocery-products/${req.files[0].filename}`;
      }

      // First, insert into main products table
      const [productResult] = await connection.execute(`
        INSERT INTO products (
          seller_id,
          category_id,
          name,
          description,
          main_image,
          is_active,
          is_approved,
          created_at
        ) VALUES (?, ?, ?, ?, ?, 1, 1, NOW())
      `, [
        sellerId,
        productCategoryId,
        product_name,
        product_description || null,
        mainImage
      ]);

      const productId = productResult.insertId;

      // Calculate final price including 21% platform fee (covers platform + delivery commissions)
      const basePrice = parseFloat(unit_price);
      const finalPriceWithFees = Math.round(basePrice * 1.21); // Add 21% for all platform costs
      
      // Then insert into grocery_products table
      const [groceryProductResult] = await connection.execute(`
        INSERT INTO grocery_products (
          product_id,
          unit_type,
          unit_price,
          base_price,
          minimum_order,
          available_stock,
          is_perishable,
          is_local_produce,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 1, 1, NOW())
      `, [
        productId,
        unit_type,
        finalPriceWithFees, // Final price buyers see (includes all fees)
        basePrice, // Original price seller entered (for commission calculation)
        parseFloat(minimum_order) || 1,
        parseFloat(available_stock)
      ]);

      // Insert product images
      if (req.files && req.files.length > 0) {
        for (let i = 0; i < req.files.length; i++) {
          const file = req.files[i];
          const imagePath = `/uploads/grocery-products/${file.filename}`;
          const isMain = i === 0; // First image is main

          await connection.execute(`
            INSERT INTO product_images (product_id, image_path, is_main, created_at)
            VALUES (?, ?, ?, NOW())
          `, [productId, imagePath, isMain]);
        }
      }

      // Update seller location if provided
      if (seller_address && seller_latitude && seller_longitude) {
        await connection.execute(`
          UPDATE users 
          SET address = ?, latitude = ?, longitude = ?
          WHERE id = ?
        `, [seller_address, parseFloat(seller_latitude), parseFloat(seller_longitude), sellerId]);
      }

      await connection.commit();

      res.json({
        success: true,
        message: 'Grocery product added successfully',
        product: {
          id: productId,
          grocery_product_id: groceryProductResult.insertId,
          product_name: product_name,
          unit_price: parseFloat(unit_price),
          unit_type: unit_type,
          main_image: mainImage
        }
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error adding grocery product:', error);
    
    // Clean up uploaded files on error
    if (req.files) {
      req.files.forEach(file => {
        fs.unlink(file.path, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to add grocery product'
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Get seller's grocery products
router.get('/grocery-products', authenticateToken, sellerAuth, async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { page = 1, limit = 12, status, category } = req.query;

    const connection = await mysql.createConnection(dbConfig);

    let whereConditions = ['p.seller_id = ?'];
    let queryParams = [sellerId];

    if (status) {
      whereConditions.push('p.is_active = ?');
      queryParams.push(status === 'active' ? 1 : 0);
    }

    if (category) {
      whereConditions.push('pc.id = ?');
      queryParams.push(category);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    queryParams.push(parseInt(limit), offset);

    const [products] = await connection.execute(`
      SELECT 
        p.id,
        p.name as product_name,
        p.description,
        p.main_image,
        p.is_active,
        p.created_at,
        gp.unit_type,
        gp.unit_price as price_per_unit,
        gp.minimum_order,
        gp.available_stock as stock_quantity,
        gp.is_perishable,
        gp.is_local_produce,
        pc.name as category,
        gc.name as category_name,
        gc.icon as category_icon,
        COUNT(goi.id) as total_orders,
        COALESCE(SUM(goi.quantity), 0) as total_sold
      FROM products p
      INNER JOIN grocery_products gp ON p.id = gp.product_id
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      LEFT JOIN grocery_categories gc ON pc.name = gc.name
      LEFT JOIN grocery_order_items goi ON gp.id = goi.grocery_product_id
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY p.id, gp.id
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `, queryParams);

    // Get total count
    const [countResult] = await connection.execute(`
      SELECT COUNT(*) as total
      FROM products p
      INNER JOIN grocery_products gp ON p.id = gp.product_id
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      WHERE ${whereConditions.join(' AND ')}
    `, queryParams.slice(0, -2));

    await connection.end();

    res.json({
      success: true,
      products: products,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(countResult[0].total / parseInt(limit)),
        total_products: countResult[0].total,
        per_page: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching grocery products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch grocery products'
    });
  }
});

// Update grocery product
router.put('/grocery-product/:id', authenticateToken, sellerAuth, upload.array('product_images', 5), async (req, res) => {
  let connection;
  
  try {
    const { id } = req.params;
    const sellerId = req.user.id;
    const {
      product_name,
      category_id,
      product_description,
      unit_price,
      unit_type,
      minimum_order,
      available_stock,
      is_active
    } = req.body;

    connection = await mysql.createConnection(dbConfig);
    await connection.beginTransaction();

    try {
      // Verify product belongs to seller
      const [products] = await connection.execute(`
        SELECT * FROM grocery_products WHERE id = ? AND seller_id = ?
      `, [id, sellerId]);

      if (products.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      // Build update query dynamically
      let updateFields = [];
      let updateParams = [];

      if (product_name) {
        updateFields.push('product_name = ?');
        updateParams.push(product_name);
      }

      if (category_id) {
        updateFields.push('category_id = ?');
        updateParams.push(category_id);
      }

      if (product_description !== undefined) {
        updateFields.push('product_description = ?');
        updateParams.push(product_description);
      }

      if (unit_price) {
        const basePrice = parseFloat(unit_price);
        const finalPriceWithFees = Math.round(basePrice * 1.21); // Add 21% for all platform costs
        updateFields.push('unit_price = ?, base_price = ?');
        updateParams.push(finalPriceWithFees, basePrice);
      }

      if (unit_type) {
        updateFields.push('unit_type = ?');
        updateParams.push(unit_type);
      }

      if (minimum_order) {
        updateFields.push('minimum_order = ?');
        updateParams.push(parseFloat(minimum_order));
      }

      if (available_stock !== undefined) {
        updateFields.push('available_stock = ?');
        updateParams.push(parseFloat(available_stock));
      }

      if (is_active !== undefined) {
        updateFields.push('is_active = ?');
        updateParams.push(is_active === 'true' || is_active === true ? 1 : 0);
      }

      if (updateFields.length > 0) {
        updateFields.push('updated_at = NOW()');
        updateParams.push(id);

        await connection.execute(`
          UPDATE grocery_products 
          SET ${updateFields.join(', ')}
          WHERE id = ?
        `, updateParams);
      }

      // Handle new images if uploaded
      if (req.files && req.files.length > 0) {
        // Get existing images to delete old files
        const [existingImages] = await connection.execute(`
          SELECT image_path FROM grocery_product_images WHERE grocery_product_id = ?
        `, [id]);

        // Delete existing image records
        await connection.execute(`
          DELETE FROM grocery_product_images WHERE grocery_product_id = ?
        `, [id]);

        // Insert new images
        let mainImage = req.files[0].filename;
        for (let i = 0; i < req.files.length; i++) {
          const file = req.files[i];
          const isMain = i === 0;

          await connection.execute(`
            INSERT INTO grocery_product_images (grocery_product_id, image_path, is_main, created_at)
            VALUES (?, ?, ?, NOW())
          `, [id, file.filename, isMain]);
        }

        // Update main image in products table
        await connection.execute(`
          UPDATE grocery_products SET main_image = ? WHERE id = ?
        `, [mainImage, id]);

        // Delete old image files
        existingImages.forEach(img => {
          const filePath = path.join(__dirname, '../uploads/grocery-products', img.image_path);
          fs.unlink(filePath, (err) => {
            if (err) console.error('Error deleting old image:', err);
          });
        });
      }

      await connection.commit();

      res.json({
        success: true,
        message: 'Product updated successfully'
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error updating grocery product:', error);
    
    // Clean up uploaded files on error
    if (req.files) {
      req.files.forEach(file => {
        fs.unlink(file.path, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update grocery product'
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Delete grocery product
router.delete('/grocery-product/:id', authenticateToken, sellerAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const sellerId = req.user.id;

    const connection = await mysql.createConnection(dbConfig);
    await connection.beginTransaction();

    try {
      // Verify product belongs to seller
      const [products] = await connection.execute(`
        SELECT * FROM grocery_products WHERE id = ? AND seller_id = ?
      `, [id, sellerId]);

      if (products.length === 0) {
        await connection.rollback();
        await connection.end();
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      // Check if product has pending orders
      const [pendingOrders] = await connection.execute(`
        SELECT COUNT(*) as count
        FROM grocery_order_items goi
        JOIN grocery_orders go ON goi.grocery_order_id = go.id
        WHERE goi.grocery_product_id = ? AND go.status IN ('pending', 'assigned', 'shopping', 'in_transit')
      `, [id]);

      if (pendingOrders[0].count > 0) {
        await connection.rollback();
        await connection.end();
        return res.status(400).json({
          success: false,
          message: 'Cannot delete product with pending orders'
        });
      }

      // Get product images to delete files
      const [images] = await connection.execute(`
        SELECT image_path FROM grocery_product_images WHERE grocery_product_id = ?
      `, [id]);

      // Delete product (cascade will handle related records)
      await connection.execute(`
        DELETE FROM grocery_products WHERE id = ?
      `, [id]);

      await connection.commit();
      await connection.end();

      // Delete image files
      images.forEach(img => {
        const filePath = path.join(__dirname, '../uploads/grocery-products', img.image_path);
        fs.unlink(filePath, (err) => {
          if (err) console.error('Error deleting image file:', err);
        });
      });

      res.json({
        success: true,
        message: 'Product deleted successfully'
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error deleting grocery product:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete grocery product'
    });
  }
});

// Get grocery product orders
router.get('/grocery-orders', authenticateToken, sellerAuth, async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { status, page = 1, limit = 20 } = req.query;

    const connection = await mysql.createConnection(dbConfig);

    let whereConditions = ['goi.seller_id = ?'];
    let queryParams = [sellerId];

    if (status) {
      whereConditions.push('go.status = ?');
      queryParams.push(status);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    queryParams.push(parseInt(limit), offset);

    const [orders] = await connection.execute(`
      SELECT 
        go.*,
        u.name as buyer_name,
        u.phone as buyer_phone,
        a.name as agent_name,
        a.phone as agent_phone,
        COUNT(goi.id) as item_count,
        SUM(goi.total_price) as seller_total
      FROM grocery_orders go
      LEFT JOIN users u ON go.buyer_id = u.id
      LEFT JOIN users a ON go.agent_id = a.id
      LEFT JOIN grocery_order_items goi ON go.id = goi.grocery_order_id
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY go.id
      ORDER BY go.created_at DESC
      LIMIT ? OFFSET ?
    `, queryParams);

    // Get order items for each order
    for (let order of orders) {
      const [items] = await connection.execute(`
        SELECT 
          goi.*,
          gp.product_name,
          gp.unit_type,
          gp.main_image
        FROM grocery_order_items goi
        LEFT JOIN grocery_products gp ON goi.grocery_product_id = gp.id
        WHERE goi.grocery_order_id = ? AND goi.seller_id = ?
      `, [order.id, sellerId]);

      order.items = items;
    }

    await connection.end();

    res.json({
      success: true,
      orders: orders
    });
  } catch (error) {
    console.error('Error fetching grocery orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch grocery orders'
    });
  }
});

// Get seller dashboard stats for grocery
router.get('/grocery-stats', authenticateToken, sellerAuth, async (req, res) => {
  try {
    const sellerId = req.user.id;

    const connection = await mysql.createConnection(dbConfig);

    // Get total products
    const [totalProducts] = await connection.execute(`
      SELECT COUNT(*) as count FROM grocery_products WHERE seller_id = ? AND is_active = 1
    `, [sellerId]);

    // Get total orders
    const [totalOrders] = await connection.execute(`
      SELECT COUNT(DISTINCT go.id) as count
      FROM grocery_orders go
      JOIN grocery_order_items goi ON go.id = goi.grocery_order_id
      WHERE goi.seller_id = ?
    `, [sellerId]);

    // Get total revenue
    const [totalRevenue] = await connection.execute(`
      SELECT COALESCE(SUM(goi.total_price), 0) as revenue
      FROM grocery_order_items goi
      JOIN grocery_orders go ON goi.grocery_order_id = go.id
      WHERE goi.seller_id = ? AND go.status = 'delivered'
    `, [sellerId]);

    // Get pending orders
    const [pendingOrders] = await connection.execute(`
      SELECT COUNT(DISTINCT go.id) as count
      FROM grocery_orders go
      JOIN grocery_order_items goi ON go.id = goi.grocery_order_id
      WHERE goi.seller_id = ? AND go.status IN ('pending', 'assigned', 'shopping')
    `, [sellerId]);

    // Get low stock products
    const [lowStockProducts] = await connection.execute(`
      SELECT COUNT(*) as count
      FROM grocery_products
      WHERE seller_id = ? AND is_active = 1 AND available_stock <= minimum_order
    `, [sellerId]);

    await connection.end();

    res.json({
      success: true,
      stats: {
        total_products: totalProducts[0].count,
        total_orders: totalOrders[0].count,
        total_revenue: parseFloat(totalRevenue[0].revenue),
        pending_orders: pendingOrders[0].count,
        low_stock_products: lowStockProducts[0].count
      }
    });
  } catch (error) {
    console.error('Error fetching grocery stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch grocery stats'
    });
  }
});

module.exports = router;