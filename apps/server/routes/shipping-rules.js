const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('./auth');
const pool = require('../db');

// ==================== PUBLIC SHIPPING CALCULATION ====================

// GET /api/shipping-rules/calculate - Calculate shipping for products
router.get('/calculate', async (req, res) => {
  try {
    const { product_ids, destination_zone, weight, is_fragile, is_urgent } = req.query;
    
    if (!product_ids) {
      return res.status(400).json({
        success: false,
        message: 'Product IDs are required'
      });
    }

    const productIdArray = product_ids.split(',').map(id => parseInt(id));
    
    // Get products with their categories
    const [products] = await pool.execute(`
      SELECT p.id, p.name, p.category_id, pc.parent_id as sub_category_id
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      WHERE p.id IN (${productIdArray.map(() => '?').join(',')}) AND p.is_active = 1
    `, productIdArray);

    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active products found'
      });
    }

    let totalShipping = 0;
    const shippingBreakdown = [];

    for (const product of products) {
      // Find the most specific shipping rule
      let shippingRule = null;
      
      // First try to find rule for sub-category (if exists)
      if (product.sub_category_id) {
        const [subCategoryRules] = await pool.execute(`
          SELECT * FROM shipping_rules 
          WHERE sub_category_id = ? AND is_active = 1 
          ORDER BY priority DESC, id DESC 
          LIMIT 1
        `, [product.category_id]);
        
        if (subCategoryRules.length > 0) {
          shippingRule = subCategoryRules[0];
        }
      }
      
      // If no sub-category rule found, try category rule
      if (!shippingRule && product.category_id) {
        const [categoryRules] = await pool.execute(`
          SELECT * FROM shipping_rules 
          WHERE category_id = ? AND sub_category_id IS NULL AND is_active = 1 
          ORDER BY priority DESC, id DESC 
          LIMIT 1
        `, [product.category_id]);
        
        if (categoryRules.length > 0) {
          shippingRule = categoryRules[0];
        }
      }
      
      // If no specific rule found, use default rule
      if (!shippingRule) {
        const [defaultRules] = await pool.execute(`
          SELECT * FROM shipping_rules 
          WHERE category_id IS NULL AND sub_category_id IS NULL AND is_active = 1 
          ORDER BY priority DESC, id DESC 
          LIMIT 1
        `);
        
        if (defaultRules.length > 0) {
          shippingRule = defaultRules[0];
        }
      }

      if (shippingRule) {
        let productShipping = parseFloat(shippingRule.base_shipping_fee);
        productShipping += parseFloat(shippingRule.packaging_fee || 0);
        
        // Apply weight multiplier
        if (weight) {
          productShipping *= parseFloat(shippingRule.weight_multiplier || 1);
        }
        
        // Apply fragile multiplier
        if (is_fragile === 'true') {
          productShipping *= parseFloat(shippingRule.fragile_multiplier || 1);
        }
        
        // Apply urgent multiplier
        if (is_urgent === 'true') {
          productShipping *= parseFloat(shippingRule.urgent_multiplier || 1);
        }
        
        totalShipping += productShipping;
        
        shippingBreakdown.push({
          product_id: product.id,
          product_name: product.name,
          rule_name: shippingRule.name,
          base_fee: shippingRule.base_shipping_fee,
          packaging_fee: shippingRule.packaging_fee,
          calculated_shipping: productShipping.toFixed(2),
          delivery_time_days: shippingRule.delivery_time_days
        });
      } else {
        // Use system default
        const [settings] = await pool.execute(`
          SELECT setting_value FROM system_settings WHERE setting_key = 'default_shipping_fee'
        `);
        
        const defaultFee = settings.length > 0 ? parseFloat(settings[0].setting_value) : 10.00;
        totalShipping += defaultFee;
        
        shippingBreakdown.push({
          product_id: product.id,
          product_name: product.name,
          rule_name: 'Default Shipping',
          base_fee: defaultFee,
          packaging_fee: 0,
          calculated_shipping: defaultFee.toFixed(2),
          delivery_time_days: 3
        });
      }
    }

    // Check for free shipping threshold
    const [freeShippingSettings] = await pool.execute(`
      SELECT setting_value FROM system_settings WHERE setting_key = 'free_shipping_threshold'
    `);
    
    const freeShippingThreshold = freeShippingSettings.length > 0 ? parseFloat(freeShippingSettings[0].setting_value) : null;
    
    res.json({
      success: true,
      shipping: {
        total_shipping: totalShipping.toFixed(2),
        free_shipping_threshold: freeShippingThreshold,
        breakdown: shippingBreakdown,
        applied_modifiers: {
          is_fragile: is_fragile === 'true',
          is_urgent: is_urgent === 'true',
          weight: weight || null
        }
      }
    });
  } catch (error) {
    console.error('Error calculating shipping:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate shipping'
    });
  }
});

// ==================== ADMIN SHIPPING RULES MANAGEMENT ====================

// Apply authentication middleware to all admin routes
router.use('/admin/*', requireAuth);
router.use('/admin/*', requireRole('admin'));

// GET /api/shipping-rules/admin/rules - Get all shipping rules
router.get('/admin/rules', async (req, res) => {
  try {
    const { page = 1, limit = 20, category_id, search } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (category_id) {
      whereClause += ' AND (sr.category_id = ? OR sr.sub_category_id = ?)';
      params.push(category_id, category_id);
    }

    if (search) {
      whereClause += ' AND (sr.name LIKE ? OR sr.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const [rules] = await pool.execute(`
      SELECT 
        sr.*,
        pc1.name as category_name,
        pc2.name as sub_category_name
      FROM shipping_rules sr
      LEFT JOIN product_categories pc1 ON sr.category_id = pc1.id
      LEFT JOIN product_categories pc2 ON sr.sub_category_id = pc2.id
      ${whereClause}
      ORDER BY sr.priority DESC, sr.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), parseInt(offset)]);

    const [countResult] = await pool.execute(`
      SELECT COUNT(*) as total
      FROM shipping_rules sr
      LEFT JOIN product_categories pc1 ON sr.category_id = pc1.id
      LEFT JOIN product_categories pc2 ON sr.sub_category_id = pc2.id
      ${whereClause}
    `, params);

    res.json({
      success: true,
      rules,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching shipping rules:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch shipping rules'
    });
  }
});

// GET /api/shipping-rules/admin/rules/:id - Get specific shipping rule
router.get('/admin/rules/:id', async (req, res) => {
  try {
    const [rules] = await pool.execute(`
      SELECT 
        sr.*,
        pc1.name as category_name,
        pc2.name as sub_category_name
      FROM shipping_rules sr
      LEFT JOIN product_categories pc1 ON sr.category_id = pc1.id
      LEFT JOIN product_categories pc2 ON sr.sub_category_id = pc2.id
      WHERE sr.id = ?
    `, [req.params.id]);

    if (rules.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Shipping rule not found'
      });
    }

    res.json({
      success: true,
      rule: rules[0]
    });
  } catch (error) {
    console.error('Error fetching shipping rule:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch shipping rule'
    });
  }
});

// POST /api/shipping-rules/admin/rules - Create new shipping rule
router.post('/admin/rules', async (req, res) => {
  try {
    const {
      name,
      description,
      category_id,
      sub_category_id,
      base_shipping_fee,
      packaging_fee,
      weight_multiplier,
      fragile_multiplier,
      urgent_multiplier,
      free_shipping_threshold,
      max_weight,
      min_weight,
      delivery_time_days,
      notes,
      priority,
      is_active
    } = req.body;

    if (!name || base_shipping_fee === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Name and base shipping fee are required'
      });
    }

    const [result] = await pool.execute(`
      INSERT INTO shipping_rules (
        name, description, category_id, sub_category_id, base_shipping_fee,
        packaging_fee, weight_multiplier, fragile_multiplier, urgent_multiplier,
        free_shipping_threshold, max_weight, min_weight, delivery_time_days,
        notes, priority, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name, description, category_id || null, sub_category_id || null, base_shipping_fee,
      packaging_fee || 0, weight_multiplier || 1, fragile_multiplier || 1, urgent_multiplier || 1.5,
      free_shipping_threshold || null, max_weight || null, min_weight || 0, delivery_time_days || 3,
      notes, priority || 0, is_active !== false
    ]);

    // Log the action
    await pool.execute(`
      INSERT INTO system_logs (level, message, details, user_id)
      VALUES (?, ?, ?, ?)
    `, ['info', 'New shipping rule created', JSON.stringify({
      rule_id: result.insertId,
      name,
      category_id,
      sub_category_id,
      base_shipping_fee
    }), req.user.id]);

    res.status(201).json({
      success: true,
      message: 'Shipping rule created successfully',
      rule: {
        id: result.insertId,
        name,
        description,
        category_id,
        sub_category_id,
        base_shipping_fee
      }
    });
  } catch (error) {
    console.error('Error creating shipping rule:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create shipping rule'
    });
  }
});

// PUT /api/shipping-rules/admin/rules/:id - Update shipping rule
router.put('/admin/rules/:id', async (req, res) => {
  try {
    const {
      name,
      description,
      category_id,
      sub_category_id,
      base_shipping_fee,
      packaging_fee,
      weight_multiplier,
      fragile_multiplier,
      urgent_multiplier,
      free_shipping_threshold,
      max_weight,
      min_weight,
      delivery_time_days,
      notes,
      priority,
      is_active
    } = req.body;

    // Check if rule exists
    const [existing] = await pool.execute('SELECT id FROM shipping_rules WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Shipping rule not found'
      });
    }

    await pool.execute(`
      UPDATE shipping_rules SET
        name = ?, description = ?, category_id = ?, sub_category_id = ?,
        base_shipping_fee = ?, packaging_fee = ?, weight_multiplier = ?,
        fragile_multiplier = ?, urgent_multiplier = ?, free_shipping_threshold = ?,
        max_weight = ?, min_weight = ?, delivery_time_days = ?, notes = ?,
        priority = ?, is_active = ?, updated_at = NOW()
      WHERE id = ?
    `, [
      name, description, category_id || null, sub_category_id || null,
      base_shipping_fee, packaging_fee || 0, weight_multiplier || 1,
      fragile_multiplier || 1, urgent_multiplier || 1.5, free_shipping_threshold || null,
      max_weight || null, min_weight || 0, delivery_time_days || 3, notes,
      priority || 0, is_active !== false, req.params.id
    ]);

    // Log the action
    await pool.execute(`
      INSERT INTO system_logs (level, message, details, user_id)
      VALUES (?, ?, ?, ?)
    `, ['info', 'Shipping rule updated', JSON.stringify({
      rule_id: req.params.id,
      name,
      updated_by: req.user.id
    }), req.user.id]);

    res.json({
      success: true,
      message: 'Shipping rule updated successfully'
    });
  } catch (error) {
    console.error('Error updating shipping rule:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update shipping rule'
    });
  }
});

// DELETE /api/shipping-rules/admin/rules/:id - Delete shipping rule
router.delete('/admin/rules/:id', async (req, res) => {
  try {
    // Check if rule exists
    const [existing] = await pool.execute('SELECT id, name FROM shipping_rules WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Shipping rule not found'
      });
    }

    // Soft delete by setting is_active to false
    await pool.execute('UPDATE shipping_rules SET is_active = 0, updated_at = NOW() WHERE id = ?', [req.params.id]);

    // Log the action
    await pool.execute(`
      INSERT INTO system_logs (level, message, details, user_id)
      VALUES (?, ?, ?, ?)
    `, ['info', 'Shipping rule deleted', JSON.stringify({
      rule_id: req.params.id,
      rule_name: existing[0].name,
      deleted_by: req.user.id
    }), req.user.id]);

    res.json({
      success: true,
      message: 'Shipping rule deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting shipping rule:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete shipping rule'
    });
  }
});

// GET /api/shipping-rules/admin/stats - Get shipping rules statistics
router.get('/admin/stats', async (req, res) => {
  try {
    const [stats] = await pool.execute(`
      SELECT 
        COUNT(*) as total_rules,
        COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_rules,
        COUNT(CASE WHEN category_id IS NOT NULL THEN 1 END) as category_rules,
        COUNT(CASE WHEN sub_category_id IS NOT NULL THEN 1 END) as subcategory_rules,
        AVG(base_shipping_fee) as avg_shipping_fee,
        MIN(base_shipping_fee) as min_shipping_fee,
        MAX(base_shipping_fee) as max_shipping_fee
      FROM shipping_rules
    `);

    const [categoryStats] = await pool.execute(`
      SELECT 
        pc.name as category_name,
        COUNT(sr.id) as rule_count,
        AVG(sr.base_shipping_fee) as avg_fee
      FROM product_categories pc
      LEFT JOIN shipping_rules sr ON pc.id = sr.category_id
      WHERE pc.parent_id IS NULL
      GROUP BY pc.id, pc.name
      ORDER BY rule_count DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      stats: stats[0],
      category_breakdown: categoryStats
    });
  } catch (error) {
    console.error('Error fetching shipping rules stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch shipping rules statistics'
    });
  }
});

module.exports = router;