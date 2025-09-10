const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/categories - Get all categories (with optional nesting)
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        id, 
        name, 
        slug, 
        description, 
        parent_id, 
        sort_order,
        is_active,
        field_schema,
        packaging_requirements,
        default_shipping_rule_id,
        created_at,
        updated_at
      FROM product_categories 
      ORDER BY sort_order ASC, name ASC
    `);

    // Organize categories into hierarchy
    const categories = buildCategoryTree(rows);
    
    res.json({
      success: true,
      categories: categories,
      count: rows.length
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories'
    });
  }
});

// GET /api/categories/active - Get only top-level active categories
router.get('/active', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        id, 
        name, 
        slug, 
        description, 
        sort_order,
        is_active,
        created_at,
        updated_at
      FROM product_categories 
      WHERE is_active = 1 AND parent_id IS NULL
      ORDER BY sort_order ASC, name ASC
    `);
    
    res.json({
      success: true,
      categories: rows,
      count: rows.length
    });
  } catch (error) {
    console.error('Error fetching active categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch active categories'
    });
  }
});

// GET /api/categories/:id - Get specific category
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM product_categories WHERE id = ? AND is_active = 1',
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Category not found'
      });
    }

    res.json({
      success: true,
      category: rows[0]
    });  
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch category'
    });
  }
});

// POST /api/categories - Create new category (admin only)
router.post('/', async (req, res) => {
  try {
    const { name, slug, description, parent_id, sort_order, field_schema, packaging_requirements } = req.body;
    
    // Validate required fields
    if (!name || !slug) {
      return res.status(400).json({
        success: false,
        error: 'Name and slug are required'
      });
    }

    // Check if slug already exists
    const [existing] = await pool.execute(
      'SELECT id FROM product_categories WHERE slug = ?',
      [slug]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Category with this slug already exists'
      });
    }

    // Validate field_schema if provided
    let validatedFieldSchema = null;
    if (field_schema) {
      try {
        const parsed = typeof field_schema === 'string' ? JSON.parse(field_schema) : field_schema;
        if (Array.isArray(parsed)) {
          validatedFieldSchema = JSON.stringify(parsed);
        }
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid field schema format'
        });
      }
    }

    // Insert new category
    const [result] = await pool.execute(
      `INSERT INTO product_categories (name, slug, description, parent_id, sort_order, field_schema, packaging_requirements, is_active) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [name, slug, description || null, parent_id || null, sort_order || 0, validatedFieldSchema, packaging_requirements || null]
    );

    res.status(201).json({
      success: true,
      category: {
        id: result.insertId,
        name,
        slug,
        description,
        parent_id,
        sort_order,
        field_schema: validatedFieldSchema,
        packaging_requirements
      }
    });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create category'
    });
  }
});

// PUT /api/categories/:id - Update category (admin only)
router.put('/:id', async (req, res) => {
  try {
    const { name, slug, description, parent_id, sort_order, is_active, field_schema, packaging_requirements } = req.body;
    
    // Check if category exists
    const [existing] = await pool.execute(
      'SELECT id FROM product_categories WHERE id = ?',
      [req.params.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Category not found'
      });
    }

    // Validate field_schema if provided
    let validatedFieldSchema = null;
    if (field_schema) {
      try {
        const parsed = typeof field_schema === 'string' ? JSON.parse(field_schema) : field_schema;
        if (Array.isArray(parsed)) {
          validatedFieldSchema = JSON.stringify(parsed);
        }
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid field schema format'
        });
      }
    }

    // Update category
    await pool.execute(
      `UPDATE product_categories 
       SET name = ?, slug = ?, description = ?, parent_id = ?, sort_order = ?, is_active = ?, 
           field_schema = ?, packaging_requirements = ?, updated_at = NOW()
       WHERE id = ?`,
      [name, slug, description, parent_id, sort_order, is_active, validatedFieldSchema, packaging_requirements, req.params.id]
    );

    res.json({
      success: true,
      message: 'Category updated successfully'
    });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update category'
    });
  }
});

// DELETE /api/categories/:id - Delete category (admin only)
router.delete('/:id', async (req, res) => {
  try {
    // Check if category has products
    const [products] = await pool.execute(
      'SELECT COUNT(*) as count FROM products WHERE category_id = ?',
      [req.params.id]
    );

    if (products[0].count > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete category that has products'
      });
    }

    // Check if category has subcategories
    const [subcategories] = await pool.execute(
      'SELECT COUNT(*) as count FROM product_categories WHERE parent_id = ?',
      [req.params.id]
    );

    if (subcategories[0].count > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete category that has subcategories'
      });
    }

    // Soft delete the category
    await pool.execute(
      'UPDATE product_categories SET is_active = 0, updated_at = NOW() WHERE id = ?',
      [req.params.id]
    );

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete category'
    });
  }
});

// GET /api/categories/:slug/subcategories - Get subcategories for a main category
router.get('/:slug/subcategories', async (req, res) => {
  try {
    const [parent] = await pool.execute(
      'SELECT id FROM product_categories WHERE slug = ? AND parent_id IS NULL AND is_active = 1',
      [req.params.slug]
    );

    if (parent.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Category not found'
      });
    }

    const [subcategories] = await pool.execute(`
      SELECT id, name, slug, description, sort_order
      FROM product_categories 
      WHERE parent_id = ? AND is_active = 1
      ORDER BY sort_order ASC, name ASC
    `, [parent[0].id]);

    res.json({
      success: true,
      subcategories: subcategories
    });
  } catch (error) {
    console.error('Error fetching subcategories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subcategories'
    });
  }
});

// GET /api/categories/:slug/schema - Get field schema for a category
router.get('/:slug/schema', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT field_schema, name
      FROM product_categories 
      WHERE slug = ? AND parent_id IS NULL AND is_active = 1
    `, [req.params.slug]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Category not found'
      });
    }

    const category = rows[0];
    let fieldSchema = [];
    
    if (category.field_schema) {
      try {
        fieldSchema = JSON.parse(category.field_schema);
      } catch (e) {
        console.error('Error parsing field schema:', e);
      }
    }

    res.json({
      success: true,
      category: {
        name: category.name,
        slug: req.params.slug,
        fields: fieldSchema
      }
    });
  } catch (error) {
    console.error('Error fetching category schema:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch category schema'
    });
  }
});

// GET /api/categories/schemas - Get all category schemas
router.get('/schemas/all', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT slug, name, field_schema
      FROM product_categories 
      WHERE parent_id IS NULL AND is_active = 1 AND field_schema IS NOT NULL
      ORDER BY sort_order ASC, name ASC
    `);

    const schemas = {};
    rows.forEach(row => {
      try {
        schemas[row.slug] = {
          name: row.name,
          fields: JSON.parse(row.field_schema || '[]')
        };
      } catch (e) {
        console.error(`Error parsing schema for ${row.slug}:`, e);
        schemas[row.slug] = {
          name: row.name,
          fields: []
        };
      }
    });

    res.json({
      success: true,
      schemas: schemas
    });
  } catch (error) {
    console.error('Error fetching category schemas:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch category schemas'
    });
  }
});

// Helper function to build category tree
function buildCategoryTree(categories, parentId = null) {
  const tree = [];
  
  for (const category of categories) {
    if (category.parent_id === parentId) {
      const children = buildCategoryTree(categories, category.id);
      if (children.length > 0) {
        category.children = children;
      }
      tree.push(category);
    }
  }
  
  return tree;
}    

module.exports = router;        