const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth } = require('./auth');
 
// GET /api/reviews - Get reviews for a product
router.get('/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10, sort = 'newest' } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let orderBy = 'r.created_at DESC';
    if (sort === 'oldest') {
      orderBy = 'r.created_at ASC';
    } else if (sort === 'rating-high') {
      orderBy = 'r.rating DESC, r.created_at DESC';
    } else if (sort === 'rating-low') {
      orderBy = 'r.rating ASC, r.created_at DESC';
    }
    
    const [reviews] = await pool.execute(`
      SELECT 
        r.*,
        u.username as reviewer_name,
        u.profile_image as reviewer_image
      FROM reviews r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.product_id = ? AND r.is_active = 1
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `, [productId, parseInt(limit), offset]);
    
    // Get total count
    const [countResult] = await pool.execute(
      'SELECT COUNT(*) as total FROM reviews WHERE product_id = ? AND is_active = 1',
      [productId]
    );
    
    // Get average rating
    const [avgResult] = await pool.execute(
      'SELECT AVG(rating) as avg_rating, COUNT(*) as total_reviews FROM reviews WHERE product_id = ? AND is_active = 1',
      [productId]
    );
    
    res.json({
      success: true,
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / parseInt(limit))
      },
      stats: {
        average_rating: avgResult[0].avg_rating || 0,
        total_reviews: avgResult[0].total_reviews || 0
      }
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reviews'
    });
  }
});

// GET /api/reviews/user - Get reviews by current user
router.get('/user', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const [reviews] = await pool.execute(`
      SELECT 
        r.*,
        p.name as product_name,
        p.main_image as product_image
      FROM reviews r
      LEFT JOIN products p ON r.product_id = p.id
      WHERE r.user_id = ? AND r.is_active = 1
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `, [userId, parseInt(limit), offset]);
    
    // Get total count
    const [countResult] = await pool.execute(
      'SELECT COUNT(*) as total FROM reviews WHERE user_id = ? AND is_active = 1',
      [userId]
    );
    
    res.json({
      success: true,
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching user reviews:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user reviews'
    });
  }
});

// POST /api/reviews - Create a new review
router.post('/', requireAuth, async (req, res) => {
  try {
    const { product_id, rating, title, comment, images } = req.body;
    const userId = req.user.id;
    
    // Validate required fields
    if (!product_id || !rating || !title || !comment) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }
    
    // Validate rating
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be between 1 and 5'
      });
    }
    
    // Check if user has already reviewed this product
    const [existingReview] = await pool.execute(
      'SELECT id FROM reviews WHERE user_id = ? AND product_id = ? AND is_active = 1',
      [userId, product_id]
    );
    
    if (existingReview.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'You have already reviewed this product'
      });
    }
    
    // Check if user has purchased this product
    const [purchaseCheck] = await pool.execute(`
      SELECT o.id FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE o.buyer_id = ? AND oi.product_id = ? AND o.status = 'delivered'
    `, [userId, product_id]);
    
    if (purchaseCheck.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'You can only review products you have purchased'
      });
    }
    
    // Create review
    const [result] = await pool.execute(`
      INSERT INTO reviews (user_id, product_id, rating, title, comment, images, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `, [userId, product_id, rating, title, comment, images ? JSON.stringify(images) : null]);
    
    // Update product average rating
    await pool.execute(`
      UPDATE products p 
      SET rating = (
        SELECT AVG(rating) 
        FROM reviews 
        WHERE product_id = p.id AND is_active = 1
      )
      WHERE id = ?
    `, [product_id]);
    
    res.status(201).json({
      success: true,
      review: {
        id: result.insertId,
        product_id,
        rating,
        title,
        comment,
        images
      }
    });
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create review'
    });
  }
});

// PUT /api/reviews/:id - Update a review
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, title, comment, images } = req.body;
    const userId = req.user.id;
    
    // Check if review exists and belongs to user
    const [existingReview] = await pool.execute(
      'SELECT id, product_id FROM reviews WHERE id = ? AND user_id = ? AND is_active = 1',
      [id, userId]
    );
    
    if (existingReview.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Review not found or access denied'
      });
    }
    
    // Validate rating if provided
    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be between 1 and 5'
      });
    }
    
    // Update review
    const updates = [];
    const values = [];
    
    if (rating !== undefined) {
      updates.push('rating = ?');
      values.push(rating);
    }
    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }
    if (comment !== undefined) {
      updates.push('comment = ?');
      values.push(comment);
    }
    if (images !== undefined) {
      updates.push('images = ?');
      values.push(JSON.stringify(images));
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }
    
    updates.push('updated_at = NOW()');
    values.push(id);
    
    await pool.execute(
      `UPDATE reviews SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    // Update product average rating
    await pool.execute(`
      UPDATE products p 
      SET rating = (
        SELECT AVG(rating) 
        FROM reviews 
        WHERE product_id = p.id AND is_active = 1
      )
      WHERE id = ?
    `, [existingReview[0].product_id]);
    
    res.json({
      success: true,
      message: 'Review updated successfully'
    });
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update review'
    });
  }
});

// DELETE /api/reviews/:id - Delete a review (soft delete)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Check if review exists and belongs to user
    const [existingReview] = await pool.execute(
      'SELECT id, product_id FROM reviews WHERE id = ? AND user_id = ? AND is_active = 1',
      [id, userId]
    );
    
    if (existingReview.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Review not found or access denied'
      });
    }
    
    // Soft delete review
    await pool.execute(
      'UPDATE reviews SET is_active = 0, updated_at = NOW() WHERE id = ?',
      [id]
    );
    
    // Update product average rating
    await pool.execute(`
      UPDATE products p 
      SET rating = (
        SELECT AVG(rating) 
        FROM reviews 
        WHERE product_id = p.id AND is_active = 1
      )
      WHERE id = ?
    `, [existingReview[0].product_id]);
    
    res.json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete review'
    });
  }
});

// GET /api/reviews/seller/:sellerId - Get reviews for seller's products
router.get('/seller/:sellerId', async (req, res) => {
  try {
    const { sellerId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const [reviews] = await pool.execute(`
      SELECT 
        r.*,
        p.name as product_name,
        p.main_image as product_image,
        u.username as reviewer_name,
        u.profile_image as reviewer_image
      FROM reviews r
      LEFT JOIN products p ON r.product_id = p.id
      LEFT JOIN users u ON r.user_id = u.id
      WHERE p.seller_id = ? AND r.is_active = 1
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `, [sellerId, parseInt(limit), offset]);
    
    // Get total count
    const [countResult] = await pool.execute(`
      SELECT COUNT(*) as total 
      FROM reviews r
      LEFT JOIN products p ON r.product_id = p.id
      WHERE p.seller_id = ? AND r.is_active = 1
    `, [sellerId]);
    
    // Get average rating for seller
    const [avgResult] = await pool.execute(`
      SELECT AVG(r.rating) as avg_rating, COUNT(*) as total_reviews
      FROM reviews r
      LEFT JOIN products p ON r.product_id = p.id
      WHERE p.seller_id = ? AND r.is_active = 1
    `, [sellerId]);
    
    res.json({
      success: true,
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / parseInt(limit))
      },
      stats: {
        average_rating: avgResult[0].avg_rating || 0,
        total_reviews: avgResult[0].total_reviews || 0
      }
    });
  } catch (error) {
    console.error('Error fetching seller reviews:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch seller reviews'
    });
  }
});

module.exports = router;
