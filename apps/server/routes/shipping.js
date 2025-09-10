const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('./auth');
const pool = require('../db');

// GET /api/shipping/rate - Calculate shipping rate
router.get('/rate', async (req, res) => {
  try {
    const { from, to, weight } = req.query;
    if (!from || !to || !weight) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Get shipping rate based on zones
    const [rates] = await pool.execute(`
      SELECT * FROM shipping_rates 
      WHERE zone = ? AND min_weight <= ? AND (max_weight IS NULL OR max_weight >= ?)
      ORDER BY base_rate ASC LIMIT 1
    `, [to, weight, weight]);

    if (rates.length === 0) {
      return res.status(404).json({ error: 'No shipping rate found for this route' });
    }

    const rate = rates[0];
    const totalCost = rate.base_rate + (weight * rate.additional_rate);

    res.json({
      success: true,
      rate: {
        base_rate: rate.base_rate,
        additional_rate: rate.additional_rate,
        total_cost: totalCost,
        delivery_time: rate.delivery_time,
        zone: rate.zone
      }
    });
  } catch (error) {
    console.error('Error calculating shipping rate:', error);
    res.status(500).json({ error: 'Failed to calculate shipping rate' });
  }
});

// GET /api/admin/shipping/stats - Get shipping statistics
router.get('/admin/stats', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const [zonesResult] = await pool.execute(`
      SELECT COUNT(*) as active_zones FROM delivery_zones WHERE is_active = 1
    `);

    const [packagesResult] = await pool.execute(`
      SELECT COUNT(*) as package_types FROM shipping_packages WHERE is_active = 1
    `);

    const [avgShippingResult] = await pool.execute(`
      SELECT AVG(shipping_cost) as avg_shipping FROM orders WHERE shipping_cost > 0
    `);

    const [fragileItemsResult] = await pool.execute(`
      SELECT COUNT(*) as fragile_items FROM products WHERE is_fragile = 1
    `);

    res.json({
      success: true,
      stats: {
        active_zones: zonesResult[0].active_zones,
        package_types: packagesResult[0].package_types,
        avg_shipping: parseFloat(avgShippingResult[0].avg_shipping || 0).toFixed(2),
        fragile_items: fragileItemsResult[0].fragile_items
      }
    });
  } catch (error) {
    console.error('Error fetching shipping stats:', error);
    res.status(500).json({ error: 'Failed to fetch shipping statistics' });
  }
});

// GET /api/admin/shipping/zones - Get all delivery zones
router.get('/admin/zones', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const [zones] = await pool.execute(`
      SELECT * FROM delivery_zones ORDER BY name
    `);

    res.json({
      success: true,
      zones
    });
  } catch (error) {
    console.error('Error fetching zones:', error);
    res.status(500).json({ error: 'Failed to fetch zones' });
  }
});

// POST /api/admin/shipping/zones - Create new delivery zone
router.post('/admin/zones', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { name, countries, cities, base_rate, urgent_delivery_multiplier, fragile_item_multiplier, delivery_time_days } = req.body;

    if (!name || !base_rate) {
      return res.status(400).json({
        success: false,
        message: 'Name and base rate are required'
      });
    }

    const [result] = await pool.execute(`
      INSERT INTO delivery_zones (name, countries, cities, base_rate, urgent_delivery_multiplier, fragile_item_multiplier, delivery_time_days)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [name, JSON.stringify(countries || []), JSON.stringify(cities || []), base_rate, urgent_delivery_multiplier || 1.5, fragile_item_multiplier || 1.2, delivery_time_days || 3]);

    // Log the action
    await pool.execute(`
      INSERT INTO system_logs (level, message, details)
      VALUES (?, ?, ?)
    `, ['info', 'New delivery zone created by admin', JSON.stringify({
      zone_id: result.insertId,
      name,
      base_rate,
      admin_id: req.user.id
    })]);

    res.status(201).json({
      success: true,
      message: 'Delivery zone created successfully',
      zone: {
        id: result.insertId,
        name,
        countries,
        cities,
        base_rate
      }
    });
  } catch (error) {
    console.error('Error creating delivery zone:', error);
    res.status(500).json({ success: false, message: 'Error creating delivery zone' });
  }
});

// GET /api/admin/shipping/packages - Get all package types
router.get('/admin/packages', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const [packages] = await pool.execute(`
      SELECT * FROM shipping_packages ORDER BY name
    `);

    res.json({
      success: true,
      packages
    });
  } catch (error) {
    console.error('Error fetching packages:', error);
    res.status(500).json({ error: 'Failed to fetch packages' });
  }
});

// POST /api/admin/shipping/packages - Create new package type
router.post('/admin/packages', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { name, description, base_fee, fragile_fee, insurance_fee, max_weight, max_dimensions } = req.body;

    if (!name || !base_fee) {
      return res.status(400).json({
        success: false,
        message: 'Name and base fee are required'
      });
    }

    const [result] = await pool.execute(`
      INSERT INTO shipping_packages (name, description, base_fee, fragile_fee, insurance_fee, max_weight, max_dimensions)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [name, description, base_fee, fragile_fee || 0, insurance_fee || 0, max_weight, max_dimensions]);

    // Log the action
    await pool.execute(`
      INSERT INTO system_logs (level, message, details)
      VALUES (?, ?, ?)
    `, ['info', 'New package type created by admin', JSON.stringify({
      package_id: result.insertId,
      name,
      base_fee,
      admin_id: req.user.id
    })]);

    res.status(201).json({
      success: true,
      message: 'Package type created successfully',
      package: {
        id: result.insertId,
        name,
        description,
        base_fee
      }
    });
  } catch (error) {
    console.error('Error creating package type:', error);
    res.status(500).json({ success: false, message: 'Error creating package type' });
  }
});

// GET /api/admin/shipping/rates - Get all shipping rates
router.get('/admin/rates', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const [rates] = await pool.execute(`
      SELECT * FROM shipping_rates ORDER BY zone, min_weight
    `);

    res.json({
      success: true,
      rates
    });
  } catch (error) {
    console.error('Error fetching rates:', error);
    res.status(500).json({ error: 'Failed to fetch rates' });
  }
});

// POST /api/admin/shipping/calculate - Calculate shipping rate with all factors
router.post('/admin/calculate', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { origin_zone, destination_zone, weight, package_type, is_fragile, is_urgent } = req.body;

    if (!destination_zone || !weight || !package_type) {
      return res.status(400).json({
        success: false,
        message: 'Destination zone, weight, and package type are required'
      });
    }

    // Get destination zone
    const [zones] = await pool.execute(`
      SELECT * FROM delivery_zones WHERE id = ?
    `, [destination_zone]);

    if (zones.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Destination zone not found'
      });
    }

    const zone = zones[0];

    // Get package type
    const [packages] = await pool.execute(`
      SELECT * FROM shipping_packages WHERE id = ?
    `, [package_type]);

    if (packages.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Package type not found'
      });
    }

    const package = packages[0];

    // Calculate base shipping rate
    let baseRate = parseFloat(zone.base_rate);

    // Add package fee
    const packageFee = parseFloat(package.base_fee);

    // Add fragile item fee if applicable
    let fragileFee = 0;
    if (is_fragile) {
      fragileFee = parseFloat(package.fragile_fee);
      baseRate *= parseFloat(zone.fragile_item_multiplier || 1.2);
    }

    // Add urgent delivery fee if applicable
    let urgentFee = 0;
    if (is_urgent) {
      baseRate *= parseFloat(zone.urgent_delivery_multiplier || 1.5);
      urgentFee = baseRate * 0.5; // 50% additional for urgent delivery
    }

    // Add insurance fee
    const insuranceFee = parseFloat(package.insurance_fee);

    const totalCost = baseRate + packageFee + fragileFee + urgentFee + insuranceFee;

    res.json({
      success: true,
      calculation: {
        base_rate: baseRate.toFixed(2),
        package_fee: packageFee.toFixed(2),
        fragile_fee: fragileFee.toFixed(2),
        urgent_fee: urgentFee.toFixed(2),
        insurance_fee: insuranceFee.toFixed(2),
        total_cost: totalCost.toFixed(2),
        delivery_time_days: zone.delivery_time_days,
        zone_name: zone.name,
        package_name: package.name
      }
    });
  } catch (error) {
    console.error('Error calculating shipping rate:', error);
    res.status(500).json({ success: false, message: 'Error calculating shipping rate' });
  }
});

module.exports = router; 