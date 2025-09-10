/**
 * Delivery & Tax Settings API Routes
 * Handles admin configuration for delivery options and tax calculations
 */

const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');

// Use shared database connection
const pool = require('../db');

// Admin authentication middleware
const authenticateAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const userId = decoded.id || decoded.userId;
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE id = ? AND role = "admin"',
      [userId]
    );

    if (users.length === 0) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    req.admin = users[0];
    next();
  } catch (error) {
    console.error('Admin authentication error:', error);
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// Initialize settings table if it doesn't exist
const initializeSettingsTable = async (retryCount = 0) => {
  try {
    // Test connection first
    if (!pool || typeof pool.execute !== 'function') {
      throw new Error('Database pool not available');
    }
    
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS delivery_tax_settings (
        id INT PRIMARY KEY AUTO_INCREMENT,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value JSON NOT NULL,
        updated_by INT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Insert default settings if they don't exist (with 0 tax as requested)
    const defaultSettings = {
      pickup: {
        enabled: true,
        fee: 0,
        processingTime: 2
      },
      homeDelivery: {
        enabled: true,
        buyerPercentage: 6,
        platformPercentage: 21,
        minFee: 500,
        maxFee: 5000
      },
      tax: {
        vatEnabled: false,
        vatRate: 0,
        calculationMethod: 'exclusive',
        exemptions: {
          food: false,
          medical: false,
          education: false
        }
      },
      freeShipping: {
        enabled: true,
        threshold: 50000
      }
    };

    for (const [key, value] of Object.entries(defaultSettings)) {
      try {
        await pool.execute(`
          INSERT IGNORE INTO delivery_tax_settings (setting_key, setting_value) 
          VALUES (?, ?)
        `, [key, JSON.stringify(value)]);
      } catch (insertError) {
        // Settings already exist, this is expected behavior
      }
    }

    console.log('✅ Delivery & Tax settings table initialized successfully');
  } catch (error) {
    if (retryCount < 3) {
      // Retry up to 3 times with increasing delay
      const delay = (retryCount + 1) * 2000;
      setTimeout(() => {
        initializeSettingsTable(retryCount + 1);
      }, delay);
    }
    // Silent handling after max retries - don't spam console
  }
};

// Initialize with delay to ensure database is ready
if (pool) {
  setTimeout(() => {
    initializeSettingsTable();
  }, 3000);
}

// GET /api/admin/delivery-tax-settings - Get current settings
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT setting_key, setting_value FROM delivery_tax_settings'
    );

    const settings = {};
    rows.forEach(row => {
      settings[row.setting_key] = JSON.parse(row.setting_value);
    });

    res.json({
      success: true,
      settings: settings
    });
  } catch (error) {
    console.error('Error fetching delivery tax settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching settings'
    });
  }
});

// POST /api/admin/delivery-tax-settings - Update settings
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const { pickup, homeDelivery, tax, freeShipping } = req.body;
    const adminId = req.admin.id;

    // Validate input
    if (!pickup || !homeDelivery || !tax || !freeShipping) {
      return res.status(400).json({
        success: false,
        message: 'All setting categories are required'
      });
    }

    // Validate numeric values
    if (homeDelivery.buyerPercentage < 0 || homeDelivery.buyerPercentage > 100) {
      return res.status(400).json({
        success: false,
        message: 'Buyer delivery percentage must be between 0 and 100'
      });
    }

    if (tax.vatRate < 0 || tax.vatRate > 100) {
      return res.status(400).json({
        success: false,
        message: 'VAT rate must be between 0 and 100'
      });
    }

    // Update each setting
    const settingsToUpdate = {
      pickup,
      homeDelivery,
      tax,
      freeShipping
    };

    for (const [key, value] of Object.entries(settingsToUpdate)) {
      await pool.execute(`
        INSERT INTO delivery_tax_settings (setting_key, setting_value, updated_by) 
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE 
        setting_value = VALUES(setting_value),
        updated_by = VALUES(updated_by),
        updated_at = CURRENT_TIMESTAMP
      `, [key, JSON.stringify(value), adminId]);
    }

    // Log the update
    await pool.execute(`
      INSERT INTO admin_logs (admin_id, action, details, created_at) 
      VALUES (?, 'delivery_tax_settings_update', ?, NOW())
    `, [adminId, JSON.stringify({ updated_settings: Object.keys(settingsToUpdate) })]);

    res.json({
      success: true,
      message: 'Settings updated successfully'
    });
  } catch (error) {
    console.error('Error updating delivery tax settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating settings'
    });
  }
});

// GET /api/delivery-tax-settings/calculate - Calculate delivery and tax for a product
router.get('/calculate', async (req, res) => {
  try {
    const { productPrice, deliveryType = 'pickup', productId } = req.query;

    if (!productPrice || isNaN(productPrice)) {
      return res.status(400).json({
        success: false,
        message: 'Valid product price is required'
      });
    }

    const price = parseFloat(productPrice);

    // Get current settings
    const [rows] = await pool.execute(
      'SELECT setting_key, setting_value FROM delivery_tax_settings'
    );

    const settings = {};
    rows.forEach(row => {
      settings[row.setting_key] = JSON.parse(row.setting_value);
    });

    let deliveryFee = 0;
    let platformDeliveryFee = 0;

    if (deliveryType === 'pickup') {
      deliveryFee = settings.pickup?.enabled ? (settings.pickup.fee || 0) : 0;
    } else if (deliveryType === 'home') {
      if (settings.homeDelivery?.enabled) {
        // Calculate platform delivery fee (21% of product price)
        platformDeliveryFee = (price * (settings.homeDelivery.platformPercentage || 21)) / 100;
        
        // Calculate buyer delivery fee (6% of platform delivery fee)
        deliveryFee = (platformDeliveryFee * (settings.homeDelivery.buyerPercentage || 6)) / 100;
        
        // Apply min/max limits
        const minFee = settings.homeDelivery.minFee || 500;
        const maxFee = settings.homeDelivery.maxFee || 5000;
        deliveryFee = Math.max(minFee, Math.min(maxFee, deliveryFee));
      }
    }

    // Check for free shipping threshold
    if (settings.freeShipping?.enabled && price >= (settings.freeShipping.threshold || 50000)) {
      deliveryFee = 0;
    }

    // Calculate tax
    let taxAmount = 0;
    if (settings.tax?.vatEnabled) {
      const taxableAmount = price + deliveryFee;
      taxAmount = (taxableAmount * (settings.tax.vatRate || 18)) / 100;
    }

    const subtotal = price + deliveryFee;
    const total = subtotal + taxAmount;

    res.json({
      success: true,
      calculation: {
        productPrice: price,
        deliveryFee: deliveryFee,
        platformDeliveryFee: platformDeliveryFee,
        taxAmount: taxAmount,
        subtotal: subtotal,
        total: total,
        deliveryType: deliveryType,
        freeShippingApplied: settings.freeShipping?.enabled && price >= (settings.freeShipping.threshold || 50000)
      }
    });
  } catch (error) {
    console.error('Error calculating delivery and tax:', error);
    
    // Handle database connection errors gracefully
    if (error.code === 'ECONNREFUSED') {
      // Return default calculation when database is unavailable
      const { subtotal, delivery_method } = req.body;
      const deliveryFee = delivery_method === 'home' ? 5.00 : 2.00;
      const taxAmount = 0; // No tax for fallback
      const total = parseFloat(subtotal) + deliveryFee + taxAmount;
      
      return res.json({
        success: true,
        calculation: {
          subtotal: parseFloat(subtotal),
          deliveryFee: deliveryFee,
          taxAmount: taxAmount,
          total: total,
          breakdown: {
            products: parseFloat(subtotal),
            delivery: deliveryFee,
            tax: taxAmount
          }
        },
        fallback: true,
        message: 'Using default calculation - database temporarily unavailable'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error calculating delivery and tax',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Service temporarily unavailable'
    });
  }
});

// GET /api/delivery-tax-settings/options - Get available delivery options
router.get('/options', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT setting_key, setting_value FROM delivery_tax_settings WHERE setting_key IN ("pickup", "homeDelivery")'
    );

    const settings = {};
    rows.forEach(row => {
      settings[row.setting_key] = JSON.parse(row.setting_value);
    });

    const options = [];

    if (settings.pickup?.enabled) {
      options.push({
        type: 'pickup',
        name: 'Pickup Delivery',
        description: 'Collect your order from a pickup point',
        fee: settings.pickup.fee || 0,
        processingTime: settings.pickup.processingTime || 2,
        icon: 'fas fa-store'
      });
    }

    if (settings.homeDelivery?.enabled) {
      options.push({
        type: 'home',
        name: 'Home Delivery',
        description: 'Direct delivery to your address',
        fee: 'Calculated based on order value',
        processingTime: '3-5 days',
        icon: 'fas fa-home'
      });
    }

    res.json({
      success: true,
      options: options
    });
  } catch (error) {
    console.error('Error fetching delivery options:', error);
    
    // Handle database connection errors gracefully
    if (error.code === 'ECONNREFUSED') {
      // Return default delivery options when database is unavailable
      return res.json({
        success: true,
        options: [
          {
            key: 'pickup',
            name: 'Pickup at Site',
            base_fee: 2.00,
            description: 'Collect your order from our pickup location',
            processingTime: '1-2 days',
            icon: 'fas fa-store'
          },
          {
            key: 'home_delivery', 
            name: 'Home Delivery',
            base_fee: 5.00,
            description: 'We deliver directly to your doorstep',
            processingTime: '3-5 days',
            icon: 'fas fa-home'
          }
        ],
        fallback: true,
        message: 'Using default delivery options - database temporarily unavailable'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error fetching delivery options',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Service temporarily unavailable'
    });
  }
});

module.exports = router;