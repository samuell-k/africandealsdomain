const express = require('express');
const router = express.Router();

// GET /api/grocery-orders
router.get('/', (req, res) => {
  res.json({ message: 'Grocery orders list (placeholder)' });
});

// POST /api/grocery-orders
router.post('/', (req, res) => {
  res.json({ message: 'Create grocery order (placeholder)' });
});
      
module.exports = router; 