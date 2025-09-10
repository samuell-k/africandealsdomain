const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth } = require('./auth');

// GET /api/wishlist - Get user's wishlist
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const query = `
      SELECT 
        w.*,
        p.name as product_name,
        p.description as product_description,
        p.price as product_price,
        p.main_image as product_image,
        p.stock_quantity,
        p.is_active as product_active,
        c.name as category_name,
        u.name as seller_name
      FROM wishlist w
      LEFT JOIN products p ON w.product_id = p.id
      LEFT JOIN product_categories c ON p.category_id = c.id
      LEFT JOIN users u ON p.seller_id = u.id
      WHERE w.user_id = ? AND p.is_active = 1
      ORDER BY w.created_at DESC
    `;

    const [wishlistItems] = await pool.execute(query, [userId]);
    
    res.json({
      success: true,
      wishlist: wishlistItems.map(item => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.product_name,
        product_description: item.product_description,
        product_price: item.product_price,
        product_image: item.product_image,
        stock_quantity: item.stock_quantity,
        product_active: item.product_active,
        category_name: item.category_name,
        seller_name: item.seller_name,
        created_at: item.created_at
      }))
    });
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    res.status(500).json({ error: 'Failed to fetch wishlist' });
  }
});

// POST /api/wishlist - Add item to wishlist
router.post('/', async (req, res) => {
  try {
    const { product_id } = req.body;
    const user_id = req.user?.id || req.body.user_id;

    if (!user_id || !product_id) {
      return res.status(400).json({ error: 'User ID and Product ID required' });
    }

    // Check if product exists and is active
    const [products] = await pool.execute(
      'SELECT id FROM products WHERE id = ? AND is_active = 1',
      [product_id]
    );

    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found or inactive' });
    }

    // Check if already in wishlist
    const [existing] = await pool.execute(
      'SELECT id FROM wishlist WHERE user_id = ? AND product_id = ?',
      [user_id, product_id]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Product already in wishlist' });
    }

    // Add to wishlist
    const [result] = await pool.execute(
      'INSERT INTO wishlist (user_id, product_id, created_at) VALUES (?, ?, NOW())',
      [user_id, product_id]
    );

    res.json({
      success: true,
      wishlist_id: result.insertId,
      message: 'Product added to wishlist successfully'
    });
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    res.status(500).json({ error: 'Failed to add to wishlist' });
  }
});

// DELETE /api/wishlist/:id - Remove item from wishlist
router.delete('/:id', async (req, res) => {
  try {
    const wishlistId = req.params.id;
    const userId = req.user?.id || req.body.user_id;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const query = `
      DELETE FROM wishlist 
      WHERE id = ? AND user_id = ?
    `;

    const [result] = await pool.execute(query, [wishlistId, userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Wishlist item not found or unauthorized' });
    }

    res.json({
      success: true,
      message: 'Item removed from wishlist successfully'
    });
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    res.status(500).json({ error: 'Failed to remove from wishlist' });
  }
});

// DELETE /api/wishlist/product/:productId - Remove product from wishlist by product ID
router.delete('/product/:productId', async (req, res) => {
  try {
    const productId = req.params.productId;
    const userId = req.user?.id || req.body.user_id;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const query = `
      DELETE FROM wishlist 
      WHERE product_id = ? AND user_id = ?
    `;

    const [result] = await pool.execute(query, [productId, userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Wishlist item not found or unauthorized' });
    }

    res.json({
      success: true,
      message: 'Product removed from wishlist successfully'
    });
  } catch (error) {
    console.error('Error removing product from wishlist:', error);
    res.status(500).json({ error: 'Failed to remove product from wishlist' });
  }
});

// GET /api/wishlist/count - Get wishlist count
router.get('/count', async (req, res) => {
  try {
    const userId = req.query.userId || req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const query = `
      SELECT COUNT(*) as count
      FROM wishlist w
      LEFT JOIN products p ON w.product_id = p.id
      WHERE w.user_id = ? AND p.is_active = 1
    `;

    const [result] = await pool.execute(query, [userId]);

    res.json({
      success: true,
      count: result[0].count
    });
  } catch (error) {
    console.error('Error fetching wishlist count:', error);
    res.status(500).json({ error: 'Failed to fetch wishlist count' });
  }
});

// POST /api/wishlist/move-to-cart/:productId - Move wishlist item to cart
router.post('/move-to-cart/:productId', async (req, res) => {
  try {
    const productId = req.params.productId;
    const userId = req.user?.id || req.body.user_id;
    const { quantity = 1 } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    // Check if product is in wishlist
    const [wishlistItem] = await pool.execute(
      'SELECT id FROM wishlist WHERE user_id = ? AND product_id = ?',
      [userId, productId]
    );

    if (wishlistItem.length === 0) {
      return res.status(404).json({ error: 'Product not in wishlist' });
    }

    // Check if product is already in cart
    const [cartItem] = await pool.execute(
      'SELECT id, quantity FROM cart WHERE user_id = ? AND product_id = ?',
      [userId, productId]
    );

    if (cartItem.length > 0) {
      // Update quantity
      await pool.execute(
        'UPDATE cart SET quantity = quantity + ? WHERE user_id = ? AND product_id = ?',
        [quantity, userId, productId]
      );
    } else {
      // Add to cart
      await pool.execute(
        'INSERT INTO cart (user_id, product_id, quantity, created_at) VALUES (?, ?, ?, NOW())',
        [userId, productId, quantity]
      );
    }

    // Remove from wishlist
    await pool.execute(
      'DELETE FROM wishlist WHERE user_id = ? AND product_id = ?',
      [userId, productId]
    );

    res.json({
      success: true,
      message: 'Product moved to cart successfully'
    });
  } catch (error) {
    console.error('Error moving to cart:', error);
    res.status(500).json({ error: 'Failed to move to cart' });
  }
});

// POST /api/wishlist/toggle - Toggle item in wishlist (add if not exists, remove if exists)
router.post('/toggle', requireAuth, async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.user?.id || req.body.user_id;

    if (!userId || !productId) {
      return res.status(400).json({ error: 'User ID and Product ID required' });
    }

    // Check if product exists and is active
    const [products] = await pool.execute(
      'SELECT id FROM products WHERE id = ? AND is_active = 1',
      [productId]
    );

    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found or inactive' });
    }

    // Check if already in wishlist
    const [existing] = await pool.execute(
      'SELECT id FROM wishlist WHERE user_id = ? AND product_id = ?',
      [userId, productId]
    );

    if (existing.length > 0) {
      // Remove from wishlist
      await pool.execute(
        'DELETE FROM wishlist WHERE user_id = ? AND product_id = ?',
        [userId, productId]
      );

      res.json({
        success: true,
        added: false,
        message: 'Product removed from wishlist'
      });
    } else {
      // Add to wishlist
      const [result] = await pool.execute(
        'INSERT INTO wishlist (user_id, product_id, created_at) VALUES (?, ?, NOW())',
        [userId, productId]
      );

      res.json({
        success: true,
        added: true,
        wishlist_id: result.insertId,
        message: 'Product added to wishlist'
      });
    }
  } catch (error) {
    console.error('Error toggling wishlist:', error);
    res.status(500).json({ error: 'Failed to toggle wishlist' });
  }
});

module.exports = router; 