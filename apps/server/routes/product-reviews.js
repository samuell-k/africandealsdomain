const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth } = require('./auth');

// Get reviews for a product
router.get('/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    
    const [reviews] = await pool.execute(`
      SELECT pr.*, u.name as reviewer_name 
      FROM product_reviews pr
      JOIN users u ON pr.user_id = u.id
      WHERE pr.product_id = ? AND pr.is_approved = TRUE
      ORDER BY pr.created_at DESC
    `, [productId]);
    
    res.json({ success: true, reviews });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch reviews' });
  }
});

// Add a review
router.post('/', requireAuth, async (req, res) => {
  try {
    const { product_id, rating, title, comment } = req.body;
    const userId = req.user.id;
    
    // Check if user already reviewed this product
    const [existing] = await pool.execute(
      'SELECT id FROM product_reviews WHERE user_id = ? AND product_id = ?',
      [userId, product_id]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'You have already reviewed this product' });
    }
    
    await pool.execute(`
      INSERT INTO product_reviews (product_id, user_id, rating, title, comment)
      VALUES (?, ?, ?, ?, ?)
    `, [product_id, userId, rating, title, comment]);
    
    // Update product rating
    await updateProductRating(product_id);
    
    res.json({ success: true, message: 'Review added successfully' });
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({ success: false, message: 'Failed to add review' });
  }
});

// Update product rating average
async function updateProductRating(productId) {
  const [stats] = await pool.execute(`
    SELECT AVG(rating) as avg_rating, COUNT(*) as count
    FROM product_reviews 
    WHERE product_id = ? AND is_approved = TRUE
  `, [productId]);
  
  const avgRating = stats[0].avg_rating || 0;
  const count = stats[0].count || 0;
  
  await pool.execute(
    'UPDATE products SET rating_average = ?, rating_count = ? WHERE id = ?',
    [avgRating, count, productId]
  );
}

module.exports = router;