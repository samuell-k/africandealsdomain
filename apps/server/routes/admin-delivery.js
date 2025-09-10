const express = require('express');
const mysql = require('mysql2/promise');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'add_physical_product',
  port: process.env.DB_PORT || 3333
};

// Get delivery settings including home delivery percentage
router.get('/delivery-settings', authenticateToken, requireAdmin, async (req, res) => {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    
    // Get delivery settings
    const [settings] = await connection.execute(`
      SELECT setting_key, setting_value, setting_type
      FROM platform_settings
      WHERE category = 'delivery'
    `);

    // Set defaults
    const deliverySettings = {
      home_delivery_percentage: 6, // Default 6% for home delivery
      pickup_delivery_free: true,
      local_products_free: true,
      base_fee: 2000,
      per_km_fee: 100,
      per_kg_fee: 200,
      fragile_fee: 1000,
      free_delivery_threshold: 0,
      max_distance: 50,
      min_fee: 1000
    };

    // Override with database values
    settings.forEach(setting => {
      const value = setting.setting_type === 'number' ? parseFloat(setting.setting_value) : 
                   setting.setting_type === 'boolean' ? setting.setting_value === 'true' : 
                   setting.setting_value;
      deliverySettings[setting.setting_key] = value;
    });

    res.json(deliverySettings);
    
  } catch (error) {
    console.error('Error fetching delivery settings:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch delivery settings',
      error: error.message 
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Update delivery settings
router.post('/delivery-settings', authenticateToken, requireAdmin, async (req, res) => {
  let connection;
  
  try {
    const {
      home_delivery_percentage,
      pickup_delivery_free,
      local_products_free,
      base_fee,
      per_km_fee,
      per_kg_fee,
      fragile_fee,
      free_delivery_threshold,
      max_distance,
      min_fee
    } = req.body;

    // Validate input
    const settings = {
      home_delivery_percentage: Math.max(0, Math.min(50, parseFloat(home_delivery_percentage) || 6)), // Max 50%
      pickup_delivery_free: pickup_delivery_free !== false, // Default true
      local_products_free: local_products_free !== false, // Default true
      base_fee: Math.max(0, parseFloat(base_fee) || 2000),
      per_km_fee: Math.max(0, parseFloat(per_km_fee) || 100),
      per_kg_fee: Math.max(0, parseFloat(per_kg_fee) || 200),
      fragile_fee: Math.max(0, parseFloat(fragile_fee) || 1000),
      free_delivery_threshold: Math.max(0, parseFloat(free_delivery_threshold) || 0),
      max_distance: Math.max(1, parseFloat(max_distance) || 50),
      min_fee: Math.max(0, parseFloat(min_fee) || 1000)
    };

    connection = await mysql.createConnection(dbConfig);
    await connection.beginTransaction();

    try {
      // Delete existing delivery settings
      await connection.execute(`DELETE FROM platform_settings WHERE category = 'delivery'`);

      // Insert new settings
      const insertPromises = Object.entries(settings).map(([key, value]) => {
        const settingType = typeof value === 'boolean' ? 'boolean' : 'number';
        return connection.execute(`
          INSERT INTO platform_settings (category, setting_key, setting_value, setting_type, created_at, updated_at)
          VALUES ('delivery', ?, ?, ?, NOW(), NOW())
        `, [key, value.toString(), settingType]);
      });

      await Promise.all(insertPromises);
      await connection.commit();

      console.log(`Admin ${req.user.id} updated delivery settings:`, settings);

      res.json({
        success: true,
        message: 'Delivery settings updated successfully',
        settings: settings
      });
      
    } catch (error) {
      await connection.rollback();
      throw error;
    }
    
  } catch (error) {
    console.error('Error updating delivery settings:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update delivery settings',
      error: error.message 
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

module.exports = router;