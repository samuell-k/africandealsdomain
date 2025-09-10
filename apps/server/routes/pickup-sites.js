/**
 * Pickup Sites API Routes
 * Handles pickup site management and availability
 */

const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/pickup-sites - Get all active pickup sites
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        ps.id,
        ps.site_code,
        ps.name as site_name,
        ps.description,
        ps.address_line1 as address,
        ps.city,
        ps.country,
        ps.latitude,
        ps.longitude,
        ps.phone,
        ps.capacity,
        ps.current_load,
        ps.is_active
      FROM pickup_sites ps
      WHERE ps.is_active = 1
      ORDER BY ps.name
    `);

    res.json({
      success: true,
      sites: rows,
      message: `Found ${rows.length} active pickup sites`
    });

  } catch (error) {
    console.error('Error fetching pickup sites:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pickup sites',
      error: error.message
    });
  }
});

// GET /api/pickup-sites/available - Get available pickup sites (not at capacity)
router.get('/available', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        ps.id,
        ps.site_code,
        ps.name as site_name,
        ps.description,
        ps.address_line1 as address,
        ps.city,
        ps.country,
        ps.latitude,
        ps.longitude,
        ps.phone,
        ps.capacity,
        ps.current_load,
        (ps.capacity - ps.current_load) as available_capacity
      FROM pickup_sites ps
      WHERE ps.is_active = 1 AND ps.current_load < ps.capacity
      ORDER BY (ps.capacity - ps.current_load) DESC, ps.name
    `);

    res.json({
      success: true,
      sites: rows,
      message: `Found ${rows.length} available pickup sites`
    });

  } catch (error) {
    console.error('Error fetching available pickup sites:', error);
    
    // Handle database connection errors gracefully
    if (error.code === 'ECONNREFUSED') {
      // Return default pickup sites when database is unavailable
      return res.json({
        success: true,
        pickup_sites: [
          {
            id: 1,
            site_code: 'KIGALI01',
            site_name: 'Kigali City Center',
            description: 'Main pickup location in Kigali downtown',
            address: 'KN 4 Ave, Kigali City',
            city: 'Kigali',
            country: 'Rwanda',
            capacity: 100,
            current_load: 0,
            is_active: true,
            manager_name: 'Default Manager',
            manager_phone: '+250788123456',
            operating_hours: '8:00 AM - 6:00 PM'
          }
        ],
        fallback: true,
        message: 'Using default pickup sites - database temporarily unavailable'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available pickup sites',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Service temporarily unavailable'
    });
  }
});

// GET /api/pickup-sites/:id - Get specific pickup site details
router.get('/:id', async (req, res) => {
  try {
    const siteId = req.params.id;
    
    const [rows] = await pool.query(`
      SELECT ps.*
      FROM pickup_sites ps
      WHERE ps.id = ?
    `, [siteId]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pickup site not found'
      });
    }

    res.json({
      success: true,
      site: rows[0]
    });

  } catch (error) {
    console.error('Error fetching pickup site:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pickup site',
      error: error.message
    });
  }
});

module.exports = router;