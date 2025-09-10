const express = require('express'); 
const router = express.Router(); 
const { requireAuth } = require('./auth'); 
const pool = require('../db');

// GET /api/cart - Get user's cart
router.get('/', requireAuth, async (req, res) => {
  try {
    console.log(`[CART-API] Fetching cart for user ID: ${req.user.id}`);
    
    const [items] = await pool.query(`
      SELECT 
        c.id,
        c.quantity,
        p.id as product_id,
        p.name,
        p.price,
        p.discount_price,
        COALESCE(p.currency, 'RWF') as currency,
        p.main_image,
        p.stock_quantity,
        p.is_active,
        pc.name as category_name
      FROM cart c
      JOIN products p ON c.product_id = p.id
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      WHERE c.user_id = ? AND p.is_active = 1 AND p.status = 'approved'
      ORDER BY c.created_at DESC
    `, [req.user.id]);
    
    console.log(`[CART-API] Found ${items.length} cart items for user ${req.user.id}`);
    
    res.json({ success: true, items });
  } catch (error) {
    console.error('[CART-API] Error fetching cart:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch cart',
      message: 'Unable to load your cart items. Please try again.'
    });
  }
});

// POST /api/cart/add - Add item to cart
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
    
    // Check if product exists and is active
    const [products] = await pool.query(
      'SELECT id, name, stock_quantity FROM products WHERE id = ? AND is_active = 1 AND status = "approved"',
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
    
    // Check stock availability
    if (product.stock_quantity && product.stock_quantity < quantity) {
      return res.status(400).json({ 
        success: false,
        error: 'Insufficient stock',
        message: `Only ${product.stock_quantity} items available in stock.`
      });
    }
    
    // Check if item already exists in cart
    const [existing] = await pool.query(
      'SELECT id, quantity FROM cart WHERE user_id = ? AND product_id = ?',
      [req.user.id, productId]
    );
    
    if (existing.length > 0) {
      // Update quantity
      const newQuantity = existing[0].quantity + quantity;
      
      // Check total quantity against stock
      if (product.stock_quantity && newQuantity > product.stock_quantity) {
        return res.status(400).json({ 
          success: false,
          error: 'Insufficient stock',
          message: `Cannot add more items. Only ${product.stock_quantity} available, you already have ${existing[0].quantity} in cart.`
        });
      }
      
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

// PUT /api/cart/update - Update cart item quantity
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
    
    // Verify cart item belongs to user and get product info
    const [cartItems] = await pool.query(`
      SELECT c.id, c.product_id, p.name, p.stock_quantity 
      FROM cart c 
      JOIN products p ON c.product_id = p.id 
      WHERE c.id = ? AND c.user_id = ?
    `, [cartId, req.user.id]);
    
    if (cartItems.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Cart item not found',
        message: 'This item is no longer in your cart.'
      });
    }
    
    const cartItem = cartItems[0];
    
    if (quantity <= 0) {
      // Remove item if quantity is 0 or negative
      await pool.query(
        'DELETE FROM cart WHERE id = ? AND user_id = ?',
        [cartId, req.user.id]
      );
      
      console.log(`[CART-API] Removed cart item ${cartId}`);
      res.json({ 
        success: true, 
        message: `${cartItem.name} removed from cart`
      });
    } else {
      // Check stock availability
      if (cartItem.stock_quantity && quantity > cartItem.stock_quantity) {
        return res.status(400).json({ 
          success: false,
          error: 'Insufficient stock',
          message: `Only ${cartItem.stock_quantity} items available in stock.`
        });
      }
      
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

// DELETE /api/cart/remove - Remove item from cart
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
    
    // Get product name before deletion for response message
    const [cartItems] = await pool.query(`
      SELECT p.name 
      FROM cart c 
      JOIN products p ON c.product_id = p.id 
      WHERE c.id = ? AND c.user_id = ?
    `, [cartId, req.user.id]);
    
    if (cartItems.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Cart item not found',
        message: 'This item is no longer in your cart.'
      });
    }
    
    const productName = cartItems[0].name;
    
    // Remove the item
    const [result] = await pool.query(
      'DELETE FROM cart WHERE id = ? AND user_id = ?',
      [cartId, req.user.id]
    );
    
    if (result.affectedRows > 0) {
      console.log(`[CART-API] Successfully removed cart item ${cartId}`);
      res.json({ 
        success: true, 
        message: `${productName} removed from cart`
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

// GET /api/cart/count - Get cart item count
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
    console.error('Error getting cart count:', error);
    res.status(500).json({ error: 'Failed to get cart count' });
  }
});

// DELETE /api/cart/clear - Clear entire cart
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
      