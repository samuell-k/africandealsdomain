const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('./auth');
const pool = require('../db');

// ==================== ADMIN SHIPPING ANALYTICS ====================

// GET /api/shipping-analytics/insights - Get comprehensive shipping insights
router.get('/insights', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    // Get comprehensive insights from the view
    const [insights] = await pool.execute(`
      SELECT * FROM shipping_insights_view
      ORDER BY total_logistics_cost DESC
      LIMIT 20
    `);

    // Get top categories by shipping cost
    const [topShippingCategories] = await pool.execute(`
      SELECT 
        category_name,
        total_shipping_cost,
        total_orders,
        shipping_per_order,
        RANK() OVER (ORDER BY total_shipping_cost DESC) as rank_by_shipping
      FROM shipping_insights_view
      WHERE total_orders > 0
      ORDER BY total_shipping_cost DESC
      LIMIT 10
    `);

    // Get top categories by packaging cost
    const [topPackagingCategories] = await pool.execute(`
      SELECT 
        category_name,
        total_packaging_cost,
        total_orders,
        packaging_per_order,
        RANK() OVER (ORDER BY total_packaging_cost DESC) as rank_by_packaging
      FROM shipping_insights_view
      WHERE total_orders > 0
      ORDER BY total_packaging_cost DESC
      LIMIT 10
    `);

    // Get most ordered categories
    const [mostOrderedCategories] = await pool.execute(`
      SELECT 
        category_name,
        total_orders,
        total_logistics_cost,
        shipping_per_order,
        packaging_per_order,
        RANK() OVER (ORDER BY total_orders DESC) as rank_by_orders
      FROM shipping_insights_view
      ORDER BY total_orders DESC
      LIMIT 10
    `);

    // Get regional shipping statistics
    const [regionalStats] = await pool.execute(`
      SELECT 
        delivery_region,
        province,
        COUNT(*) as rule_count,
        AVG(base_shipping_fee) as avg_base_fee,
        AVG(packaging_fee) as avg_packaging_fee,
        AVG(delivery_time_days) as avg_delivery_time
      FROM shipping_rules
      WHERE is_active = 1 AND delivery_region != 'default'
      GROUP BY delivery_region, province
      ORDER BY rule_count DESC, avg_base_fee DESC
    `);

    // Get shipping cost distribution
    const [costDistribution] = await pool.execute(`
      SELECT 
        CASE 
          WHEN total_logistics_cost < 100 THEN 'Low (< $100)'
          WHEN total_logistics_cost < 500 THEN 'Medium ($100-$500)'
          WHEN total_logistics_cost < 1000 THEN 'High ($500-$1000)'
          ELSE 'Very High (> $1000)'
        END as cost_range,
        COUNT(*) as category_count,
        AVG(total_logistics_cost) as avg_cost,
        SUM(total_orders) as total_orders_in_range
      FROM shipping_insights_view
      GROUP BY cost_range
      ORDER BY avg_cost ASC
    `);

    // Get monthly trends (simulated data for now)
    const [monthlyTrends] = await pool.execute(`
      SELECT 
        DATE_FORMAT(last_updated, '%Y-%m') as month,
        COUNT(*) as categories_updated,
        AVG(total_shipping_cost) as avg_shipping_cost,
        AVG(total_packaging_cost) as avg_packaging_cost,
        SUM(total_orders) as total_orders
      FROM shipping_analytics
      WHERE last_updated >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(last_updated, '%Y-%m')
      ORDER BY month DESC
      LIMIT 12
    `);

    res.json({
      success: true,
      data: {
        overview: {
          total_categories: insights.length,
          total_shipping_cost: insights.reduce((sum, cat) => sum + parseFloat(cat.total_shipping_cost || 0), 0),
          total_packaging_cost: insights.reduce((sum, cat) => sum + parseFloat(cat.total_packaging_cost || 0), 0),
          total_orders: insights.reduce((sum, cat) => sum + parseInt(cat.total_orders || 0), 0)
        },
        insights,
        topShippingCategories,
        topPackagingCategories,
        mostOrderedCategories,
        regionalStats,
        costDistribution,
        monthlyTrends
      }
    });
  } catch (error) {
    console.error('Error fetching shipping insights:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch shipping insights'
    });
  }
});

// GET /api/shipping-analytics/regional-performance - Get regional shipping performance
router.get('/regional-performance', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { region, province } = req.query;

    let query = `
      SELECT 
        sr.delivery_region,
        sr.province,
        sr.district,
        sr.name as rule_name,
        sr.base_shipping_fee,
        sr.packaging_fee,
        sr.delivery_time_days,
        COUNT(rso.id) as override_count,
        pc.name as category_name
      FROM shipping_rules sr
      LEFT JOIN regional_shipping_overrides rso ON sr.id = rso.base_rule_id
      LEFT JOIN product_categories pc ON sr.category_id = pc.id
      WHERE sr.is_active = 1 AND sr.delivery_region != 'default'
    `;

    const params = [];

    if (region) {
      query += ' AND sr.delivery_region = ?';
      params.push(region);
    }

    if (province) {
      query += ' AND sr.province = ?';
      params.push(province);
    }

    query += `
      GROUP BY sr.id
      ORDER BY sr.region_priority DESC, sr.base_shipping_fee DESC
    `;

    const [regionalPerformance] = await pool.execute(query, params);

    // Get available regions and provinces
    const [regions] = await pool.execute(`
      SELECT DISTINCT delivery_region, province
      FROM shipping_rules
      WHERE delivery_region != 'default' AND is_active = 1
      ORDER BY delivery_region, province
    `);

    res.json({
      success: true,
      data: {
        regionalPerformance,
        availableRegions: regions
      }
    });
  } catch (error) {
    console.error('Error fetching regional performance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch regional performance data'
    });
  }
});

// POST /api/shipping-analytics/refresh - Refresh analytics data
router.post('/refresh', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    // In a real application, this would recalculate analytics from actual order data
    // For now, we'll update the last_updated timestamp and generate new sample data
    
    await pool.execute(`
      UPDATE shipping_analytics 
      SET 
        total_orders = FLOOR(RAND() * 150) + 10,
        total_shipping_cost = ROUND(RAND() * 6000 + 300, 2),
        total_packaging_cost = ROUND(RAND() * 1800 + 150, 2),
        last_updated = NOW()
      WHERE category_id IS NOT NULL
    `);

    // Recalculate averages
    await pool.execute(`
      UPDATE shipping_analytics 
      SET 
        avg_shipping_cost = ROUND(total_shipping_cost / NULLIF(total_orders, 0), 2),
        avg_packaging_cost = ROUND(total_packaging_cost / NULLIF(total_orders, 0), 2)
      WHERE category_id IS NOT NULL
    `);

    res.json({
      success: true,
      message: 'Analytics data refreshed successfully'
    });
  } catch (error) {
    console.error('Error refreshing analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh analytics data'
    });
  }
});

// GET /api/shipping-analytics/category-details/:id - Get detailed analytics for a specific category
router.get('/category-details/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const categoryId = req.params.id;

    // Get category analytics
    const [categoryAnalytics] = await pool.execute(`
      SELECT * FROM shipping_insights_view WHERE category_id = ?
    `, [categoryId]);

    if (categoryAnalytics.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Category analytics not found'
      });
    }

    // Get all shipping rules for this category
    const [shippingRules] = await pool.execute(`
      SELECT 
        sr.*,
        COUNT(rso.id) as override_count
      FROM shipping_rules sr
      LEFT JOIN regional_shipping_overrides rso ON sr.id = rso.base_rule_id
      WHERE sr.category_id = ? AND sr.is_active = 1
      GROUP BY sr.id
      ORDER BY sr.region_priority DESC, sr.delivery_region
    `, [categoryId]);

    // Get regional overrides for this category
    const [regionalOverrides] = await pool.execute(`
      SELECT 
        rso.*,
        sr.name as base_rule_name
      FROM regional_shipping_overrides rso
      JOIN shipping_rules sr ON rso.base_rule_id = sr.id
      WHERE sr.category_id = ? AND rso.is_active = 1
      ORDER BY rso.region_name, rso.province, rso.district
    `, [categoryId]);

    res.json({
      success: true,
      data: {
        analytics: categoryAnalytics[0],
        shippingRules,
        regionalOverrides
      }
    });
  } catch (error) {
    console.error('Error fetching category details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch category details'
    });
  }
});

module.exports = router;