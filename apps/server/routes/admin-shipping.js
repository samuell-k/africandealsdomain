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

// Get current delivery settings
router.get('/delivery-settings', authenticateToken, requireAdmin, async (req, res) => {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    
    // Get all delivery settings
    const [settings] = await connection.execute(`
      SELECT setting_key, setting_value, setting_type
      FROM platform_settings
      WHERE category = 'delivery'
    `);

    // Convert to object format
    const deliverySettings = {};
    
    // Set defaults first
    const defaults = {
      base_fee: 2000,
      per_km_fee: 100,
      per_kg_fee: 200,
      fragile_fee: 1000,
      free_delivery_threshold: 0,
      max_distance: 50,
      min_fee: 1000
    };

    // Apply defaults
    Object.assign(deliverySettings, defaults);

    // Override with database values
    settings.forEach(setting => {
      const value = setting.setting_type === 'number' ? parseFloat(setting.setting_value) : setting.setting_value;
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
      base_fee: Math.max(0, parseFloat(base_fee) || 2000),
      per_km_fee: Math.max(0, parseFloat(per_km_fee) || 100),
      per_kg_fee: Math.max(0, parseFloat(per_kg_fee) || 200),
      fragile_fee: Math.max(0, parseFloat(fragile_fee) || 1000),
      free_delivery_threshold: Math.max(0, parseFloat(free_delivery_threshold) || 0),
      max_distance: Math.max(1, parseFloat(max_distance) || 50),
      min_fee: Math.max(0, parseFloat(min_fee) || 1000)
    };

    connection = await mysql.createConnection(dbConfig);

    // Start transaction
    await connection.beginTransaction();

    try {
      // Delete existing delivery settings
      await connection.execute(`
        DELETE FROM platform_settings WHERE category = 'delivery'
      `);

      // Insert new settings
      const insertPromises = Object.entries(settings).map(([key, value]) => {
        return connection.execute(`
          INSERT INTO platform_settings (category, setting_key, setting_value, setting_type, created_at, updated_at)
          VALUES ('delivery', ?, ?, 'number', NOW(), NOW())
        `, [key, value.toString()]);
      });

      await Promise.all(insertPromises);

      // Commit transaction
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

// Test delivery calculation
router.post('/test-delivery-calculation', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      distance_km,
      weight_kg,
      has_fragile_items,
      order_total
    } = req.body;

    let connection;
    
    try {
      connection = await mysql.createConnection(dbConfig);
      
      // Get current settings
      const [settings] = await connection.execute(`
        SELECT setting_key, setting_value, setting_type
        FROM platform_settings
        WHERE category = 'delivery'
      `);

      const deliveryConfig = {
        base_fee: 2000,
        per_km_fee: 100,
        per_kg_fee: 200,
        fragile_fee: 1000,
        free_delivery_threshold: 0,
        max_distance: 50,
        min_fee: 1000
      };

      // Apply database settings
      settings.forEach(setting => {
        const value = setting.setting_type === 'number' ? parseFloat(setting.setting_value) : setting.setting_value;
        deliveryConfig[setting.setting_key] = value;
      });

      // Calculate delivery fee
      const distance = parseFloat(distance_km) || 5;
      const weight = parseFloat(weight_kg) || 1;
      const fragile = has_fragile_items === true;
      const orderAmount = parseFloat(order_total) || 0;

      // Check for free delivery
      if (deliveryConfig.free_delivery_threshold > 0 && orderAmount >= deliveryConfig.free_delivery_threshold) {
        return res.json({
          success: true,
          calculation: {
            base_fee: 0,
            distance_fee: 0,
            weight_fee: 0,
            fragile_fee: 0,
            total_fee: 0,
            free_delivery: true,
            reason: `Order over FRW ${deliveryConfig.free_delivery_threshold.toLocaleString()}`
          }
        });
      }

      // Calculate individual fees
      const baseFee = deliveryConfig.base_fee;
      const distanceFee = Math.round(distance * deliveryConfig.per_km_fee);
      const weightFee = weight > 5 ? Math.round((weight - 5) * deliveryConfig.per_kg_fee) : 0;
      const fragileFee = fragile ? deliveryConfig.fragile_fee : 0;
      
      const totalFee = Math.max(baseFee + distanceFee + weightFee + fragileFee, deliveryConfig.min_fee);

      res.json({
        success: true,
        calculation: {
          base_fee: baseFee,
          distance_fee: distanceFee,
          weight_fee: weightFee,
          fragile_fee: fragileFee,
          total_fee: totalFee,
          free_delivery: false,
          breakdown: `Base: FRW ${baseFee.toLocaleString()} + Distance: FRW ${distanceFee.toLocaleString()} + Weight: FRW ${weightFee.toLocaleString()} + Fragile: FRW ${fragileFee.toLocaleString()}`
        }
      });

    } finally {
      if (connection) {
        await connection.end();
      }
    }
    
  } catch (error) {
    console.error('Error calculating delivery fee:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to calculate delivery fee',
      error: error.message 
    });
  }
});

// Get delivery statistics
router.get('/delivery-stats', authenticateToken, requireAdmin, async (req, res) => {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    
    // Get delivery statistics
    const [pickupOrders] = await connection.execute(`
      SELECT COUNT(*) as count, AVG(total_amount) as avg_amount
      FROM orders 
      WHERE delivery_method = 'pickup' 
      AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);

    const [homeOrders] = await connection.execute(`
      SELECT COUNT(*) as count, AVG(total_amount) as avg_amount, AVG(delivery_fee) as avg_delivery_fee
      FROM orders 
      WHERE delivery_method = 'home' 
      AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);

    const [totalRevenue] = await connection.execute(`
      SELECT SUM(delivery_fee) as total_delivery_revenue
      FROM orders 
      WHERE delivery_method = 'home' 
      AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);

    res.json({
      success: true,
      stats: {
        pickup_orders: {
          count: pickupOrders[0].count || 0,
          avg_amount: parseFloat(pickupOrders[0].avg_amount) || 0
        },
        home_orders: {
          count: homeOrders[0].count || 0,
          avg_amount: parseFloat(homeOrders[0].avg_amount) || 0,
          avg_delivery_fee: parseFloat(homeOrders[0].avg_delivery_fee) || 0
        },
        total_delivery_revenue: parseFloat(totalRevenue[0].total_delivery_revenue) || 0,
        period: 'Last 30 days'
      }
    });
    
  } catch (error) {
    console.error('Error fetching delivery stats:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch delivery statistics',
      error: error.message 
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

module.exports = router;