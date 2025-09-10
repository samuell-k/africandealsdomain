const express = require('express'); 
const router = express.Router(); 
const { requireAuth } = require('./auth'); 
const pool = require('../db');

// GET /api/cart - Get user's cart (SAFE VERSION)
router.get('/', requireAuth, async (req, res) => {
  try {
    console.log(`[CART-API] Fetching cart for user ID: ${req.user.id}`);
    
    // Use only the most basic columns that should exist in any setup
    const [items] = await pool.query(`
      SELECT 
        c.id,
        c.quantity,
        c.user_id,
        c.product_id,
        p.id as product_id_check,
        p.name,
        p.price
      FROM cart c
      JOIN products p ON c.product_id = p.id
      WHERE c.user_id = ?
    `, [req.user.id]);
    
    console.log(`[CART-API] Found ${items.length} cart items for user ${req.user.id}`);
    
    // Transform the data to match what the frontend expects
    const transformedItems = items.map(item => ({
      id: item.id,
      quantity: item.quantity,
      product_id: item.product_id,
      name: item.name,
      price: parseFloat(item.price),
      currency: 'RWF', // Default currency
      main_image: null // Will be handled by frontend fallback
    }));
    
    res.json({ 
      success: true, 
      items: transformedItems 
    });
  } catch (error) {
    console.error('[CART-API] Error fetching cart:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch cart',
      message: 'Unable to load your cart items. Please try again.'
    });
  }
});

// POST /api/cart/add - Add item to cart (SAFE VERSION)
router.post('/add', requireAuth, async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    
    console.log(`[CART-API] Adding product ${productId} to cart for user ${req.user.id}`);
    
    if (!productId) {
      return res.status(400).json({ 
        success: false,
        error: 'Product ID is required',
        message: 'Please specify which product to add to cart.'
      });
    }
    
    if (quantity <= 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid quantity',
        message: 'Quantity must be greater than 0.'
      });
    }
    
    // Check if product exists (basic check)
    const [products] = await pool.query(
      'SELECT id, name FROM products WHERE id = ?',
      [productId]
    );
    
    if (products.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Product not found',
        message: 'This product is no longer available.'
      });
    }
    
    const product = products[0];
    
    // Check if item already exists in cart
    const [existing] = await pool.query(
      'SELECT id, quantity FROM cart WHERE user_id = ? AND product_id = ?',
      [req.user.id, productId]
    );
    
    if (existing.length > 0) {
      // Update quantity
      const newQuantity = existing[0].quantity + quantity;
      
      await pool.query(
        'UPDATE cart SET quantity = ? WHERE id = ?',
        [newQuantity, existing[0].id]
      );
      
      console.log(`[CART-API] Updated cart item quantity to ${newQuantity}`);
    } else {
      // Add new item
      await pool.query(
        'INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)',
        [req.user.id, productId, quantity]
      );
      
      console.log(`[CART-API] Added new item to cart`);
    }
    
    res.json({ 
      success: true, 
      message: `${product.name} added to cart successfully!`
    });
  } catch (error) {
    console.error('[CART-API] Error adding to cart:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to add item to cart',
      message: 'Unable to add item to cart. Please try again.'
    });
  }
});

// PUT /api/cart/update - Update cart item quantity (SAFE VERSION)
router.put('/update', requireAuth, async (req, res) => {
  try {
    const { cartId, quantity } = req.body;
    
    console.log(`[CART-API] Updating cart item ${cartId} to quantity ${quantity} for user ${req.user.id}`);
    
    if (!cartId || quantity === undefined) {
      return res.status(400).json({ 
        success: false,
        error: 'Cart ID and quantity are required',
        message: 'Invalid request parameters.'
      });
    }
    
    // Verify cart item belongs to user
    const [cartItems] = await pool.query(
      'SELECT id FROM cart WHERE id = ? AND user_id = ?',
      [cartId, req.user.id]
    );
    
    if (cartItems.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Cart item not found',
        message: 'This item is no longer in your cart.'
      });
    }
    
    if (quantity <= 0) {
      // Remove item if quantity is 0 or negative
      await pool.query(
        'DELETE FROM cart WHERE id = ? AND user_id = ?',
        [cartId, req.user.id]
      );
      
      console.log(`[CART-API] Removed cart item ${cartId}`);
      res.json({ 
        success: true, 
        message: 'Item removed from cart'
      });
    } else {
      // Update quantity
      await pool.query(
        'UPDATE cart SET quantity = ? WHERE id = ? AND user_id = ?',
        [quantity, cartId, req.user.id]
      );
      
      console.log(`[CART-API] Updated cart item ${cartId} to quantity ${quantity}`);
      res.json({ 
        success: true, 
        message: 'Cart updated successfully'
      });
    }
  } catch (error) {
    console.error('[CART-API] Error updating cart:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update cart',
      message: 'Unable to update cart. Please try again.'
    });
  }
});

// DELETE /api/cart/remove - Remove item from cart (SAFE VERSION)
router.delete('/remove/:cartId', requireAuth, async (req, res) => {
  try {
    const { cartId } = req.params;
    
    console.log(`[CART-API] Removing cart item ${cartId} for user ${req.user.id}`);
    
    if (!cartId) {
      return res.status(400).json({ 
        success: false,
        error: 'Cart ID is required',
        message: 'Invalid request parameters.'
      });
    }
    
    // Remove the item (with user verification)
    const [result] = await pool.query(
      'DELETE FROM cart WHERE id = ? AND user_id = ?',
      [cartId, req.user.id]
    );
    
    if (result.affectedRows > 0) {
      console.log(`[CART-API] Successfully removed cart item ${cartId}`);
      res.json({ 
        success: true, 
        message: 'Item removed from cart'
      });
    } else {
      res.status(404).json({ 
        success: false,
        error: 'Cart item not found',
        message: 'This item is no longer in your cart.'
      });
    }
  } catch (error) {
    console.error('[CART-API] Error removing from cart:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to remove item from cart',
      message: 'Unable to remove item from cart. Please try again.'
    });
  }
});

// GET /api/cart/count - Get cart item count (SAFE VERSION)
router.get('/count', requireAuth, async (req, res) => {
  try {
    const [result] = await pool.query(
      'SELECT SUM(quantity) as totalItems, COUNT(*) as count FROM cart WHERE user_id = ?',
      [req.user.id]
    );
    
    const totalItems = result[0].totalItems || 0;
    const count = result[0].count || 0;
    
    res.json({ 
      success: true, 
      count: count,
      totalItems: totalItems
    });
  } catch (error) {
    console.error('[CART-API] Error getting cart count:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get cart count',
      message: 'Unable to get cart count. Please try again.'
    });
  }
});

// DELETE /api/cart/clear - Clear entire cart (SAFE VERSION)
router.delete('/clear', requireAuth, async (req, res) => {
  try {
    console.log(`[CART-API] Clearing entire cart for user ${req.user.id}`);
    
    const [result] = await pool.query('DELETE FROM cart WHERE user_id = ?', [req.user.id]);
    
    console.log(`[CART-API] Cleared ${result.affectedRows} items from cart`);
    
    res.json({ 
      success: true, 
      message: `Cart cleared successfully (${result.affectedRows} items removed)`
    });
  } catch (error) {
    console.error('[CART-API] Error clearing cart:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to clear cart',
      message: 'Unable to clear cart. Please try again.'
    });
  }
});   

module.exports = router;