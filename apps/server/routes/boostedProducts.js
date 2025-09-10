const express = require('express');
const router = express.Router();

// GET /api/boosted-products
router.get('/', (req, res) => {
  res.json({ message: 'Boosted products list (placeholder)' });
});

// POST /api/boosted-products
router.post('/', (req, res) => {
  res.json({ message: 'Create boosted product (placeholder)' });
});

module.exports = router; 