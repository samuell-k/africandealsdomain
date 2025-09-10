const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth, requireRole } = require('./auth');

// Get all brands
router.get('/', async (req, res) => {
  try {
    const [brands] = await pool.execute(
      'SELECT * FROM brands WHERE is_active = TRUE ORDER BY name ASC'
    );
    
    res.json({ success: true, brands });
  } catch (error) {
    console.error('Error fetching brands:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch brands' });
  }
});

// Create brand (admin only)
router.post('/', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { name, slug, description, logo, website } = req.body;
    
    const [result] = await pool.execute(`
      INSERT INTO brands (name, slug, description, logo, website)
      VALUES (?, ?, ?, ?, ?)
    `, [name, slug, description, logo, website]);
    
    res.json({ success: true, message: 'Brand created successfully', id: result.insertId });
  } catch (error) {
    console.error('Error creating brand:', error);
    res.status(500).json({ success: false, message: 'Failed to create brand' });
  }
});

// Update brand (admin only)
router.put('/:id', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, description, logo, website, is_active } = req.body;
    
    await pool.execute(`
      UPDATE brands 
      SET name = ?, slug = ?, description = ?, logo = ?, website = ?, is_active = ?, updated_at = NOW()
      WHERE id = ?
    `, [name, slug, description, logo, website, is_active, id]);
    
    res.json({ success: true, message: 'Brand updated successfully' });
  } catch (error) {
    console.error('Error updating brand:', error);
    res.status(500).json({ success: false, message: 'Failed to update brand' });
  }
});

// Delete brand (admin only)
router.delete('/:id', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.execute('DELETE FROM brands WHERE id = ?', [id]);
    
    res.json({ success: true, message: 'Brand deleted successfully' });
  } catch (error) {
    console.error('Error deleting brand:', error);
    res.status(500).json({ success: false, message: 'Failed to delete brand' });
  }
});

module.exports = router;