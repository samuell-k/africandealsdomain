const express = require('express');
const router = express.Router();
const { convertCurrency } = require('../../../packages/api-clients/currency');

// GET /api/currency/convert?from=USD&to=RWF&amount=100
router.get('/convert', async (req, res) => {
  const { from, to, amount } = req.query;
  if (!from || !to || !amount) return res.status(400).json({ error: 'Missing params' });
  try {
    const result = await convertCurrency(from, to, amount);
    res.json({ from, to, amount: Number(amount), result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }  
});
  
module.exports = router; 