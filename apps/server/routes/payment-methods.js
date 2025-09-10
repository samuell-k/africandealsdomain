const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth, requireRole } = require('./auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for logo uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadsDir = path.join(__dirname, '../uploads/payment-logos');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// GET /api/payment-methods - Get all payment methods (public for checkout)
router.get('/', async (req, res) => {
  try {
    const { active_only } = req.query;
    
    let query = `
      SELECT 
        id, method_name as name, provider, is_active as active, 
        description, instructions, logo_url, sort_order,
        api_url, credentials
      FROM payment_methods
    `;
    
    if (active_only === 'true') {
      query += ' WHERE is_active = true';
    }
    
    query += ' ORDER BY sort_order ASC, method_name ASC';
    
    const [methods] = await pool.execute(query);
    
    // Hide sensitive credentials from public API
    const publicMethods = methods.map(method => ({
      ...method,
      credentials: req.user && req.user.role === 'admin' ? method.credentials : null
    }));
    
    res.json({
      success: true,
      payment_methods: publicMethods
    });
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment methods'
    });
  }
});

// GET /api/payment-methods/:id - Get specific payment method
router.get('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const [methods] = await pool.execute(`
      SELECT 
        id, method_name as name, provider, is_active as active,
        description, instructions, logo_url, sort_order,
        api_url, credentials, created_at, updated_at
      FROM payment_methods 
      WHERE id = ?
    `, [req.params.id]);

    if (methods.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Payment method not found'
      });
    }

    res.json({
      success: true,
      payment_method: methods[0]
    });
  } catch (error) {
    console.error('Error fetching payment method:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment method'
    });
  }
});

// POST /api/payment-methods - Create new payment method
router.post('/', requireAuth, requireRole('admin'), upload.single('logo'), async (req, res) => {
  try {
    const {
      name,
      provider,
      active,
      api_url,
      credentials,
      description,
      instructions,
      sort_order
    } = req.body;

    // Validate required fields
    if (!name || !provider) {
      return res.status(400).json({
        success: false,
        error: 'Name and provider are required'
      });
    }

    // Parse credentials if provided
    let credentialsJson = null;
    if (credentials) {
      try {
        credentialsJson = typeof credentials === 'string' ? JSON.parse(credentials) : credentials;
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: 'Invalid credentials format'
        });
      }
    }

    const logoUrl = req.file ? `/uploads/payment-logos/${req.file.filename}` : null;

    const [result] = await pool.execute(`
      INSERT INTO payment_methods (
        method_name, provider, is_active, api_url, credentials,
        description, instructions, logo_url, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name, provider, active === 'true' || active === true,
      api_url || null, credentialsJson ? JSON.stringify(credentialsJson) : null,
      description || null, instructions || null, logoUrl,
      parseInt(sort_order) || 0
    ]);

    res.status(201).json({
      success: true,
      payment_method: {
        id: result.insertId,
        name,
        provider,
        active: active === 'true' || active === true
      }
    });
  } catch (error) {
    console.error('Error creating payment method:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create payment method'
    });
  }
});

// PUT /api/payment-methods/:id - Update payment method
router.put('/:id', requireAuth, requireRole('admin'), upload.single('logo'), async (req, res) => {
  try {
    const methodId = req.params.id;
    const {
      name,
      provider,
      active,
      api_url,
      credentials,
      description,
      instructions,
      sort_order
    } = req.body;

    // Check if payment method exists
    const [existing] = await pool.execute(
      'SELECT id, logo_url FROM payment_methods WHERE id = ?',
      [methodId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Payment method not found'
      });
    }

    // Parse credentials if provided
    let credentialsJson = null;
    if (credentials) {
      try {
        credentialsJson = typeof credentials === 'string' ? JSON.parse(credentials) : credentials;
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: 'Invalid credentials format'
        });
      }
    }

    // Handle logo upload
    let logoUrl = existing[0].logo_url;
    if (req.file) {
      logoUrl = `/uploads/payment-logos/${req.file.filename}`;
      
      // Delete old logo file if it exists
      if (existing[0].logo_url) {
        const oldLogoPath = path.join(__dirname, '../uploads/payment-logos', path.basename(existing[0].logo_url));
        if (fs.existsSync(oldLogoPath)) {
          fs.unlinkSync(oldLogoPath);
        }
      }
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('method_name = ?');
      values.push(name);
    }
    if (provider !== undefined) {
      updates.push('provider = ?');
      values.push(provider);
    }
    if (active !== undefined) {
      updates.push('is_active = ?');
      values.push(active === 'true' || active === true);
    }
    if (api_url !== undefined) {
      updates.push('api_url = ?');
      values.push(api_url || null);
    }
    if (credentials !== undefined) {
      updates.push('credentials = ?');
      values.push(credentialsJson ? JSON.stringify(credentialsJson) : null);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description || null);
    }
    if (instructions !== undefined) {
      updates.push('instructions = ?');
      values.push(instructions || null);
    }
    if (sort_order !== undefined) {
      updates.push('sort_order = ?');
      values.push(parseInt(sort_order) || 0);
    }
    if (req.file) {
      updates.push('logo_url = ?');
      values.push(logoUrl);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }

    updates.push('updated_at = NOW()');
    values.push(methodId);

    await pool.execute(
      `UPDATE payment_methods SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    res.json({
      success: true,
      message: 'Payment method updated successfully'
    });
  } catch (error) {
    console.error('Error updating payment method:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update payment method'
    });
  }
});

// DELETE /api/payment-methods/:id - Delete payment method
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const methodId = req.params.id;

    // Check if payment method exists
    const [existing] = await pool.execute(
      'SELECT id, logo_url FROM payment_methods WHERE id = ?',
      [methodId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Payment method not found'
      });
    }

    // Check if payment method is being used in any transactions
    const [transactions] = await pool.execute(
      'SELECT COUNT(*) as count FROM payment_transactions WHERE payment_method_id = ?',
      [methodId]
    );

    if (transactions[0].count > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete payment method that has been used in transactions'
      });
    }

    // Delete logo file if it exists
    if (existing[0].logo_url) {
      const logoPath = path.join(__dirname, '../uploads/payment-logos', path.basename(existing[0].logo_url));
      if (fs.existsSync(logoPath)) {
        fs.unlinkSync(logoPath);
      }
    }

    // Delete payment method
    await pool.execute('DELETE FROM payment_methods WHERE id = ?', [methodId]);

    res.json({
      success: true,
      message: 'Payment method deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting payment method:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete payment method'
    });
  }
});

// POST /api/payment-methods/:id/toggle - Toggle payment method active status
router.post('/:id/toggle', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const methodId = req.params.id;

    // Check if payment method exists
    const [existing] = await pool.execute(
      'SELECT id, is_active FROM payment_methods WHERE id = ?',
      [methodId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Payment method not found'
      });
    }

    const newStatus = !existing[0].is_active;

    await pool.execute(
      'UPDATE payment_methods SET is_active = ?, updated_at = NOW() WHERE id = ?',
      [newStatus, methodId]
    );

    res.json({
      success: true,
      message: `Payment method ${newStatus ? 'enabled' : 'disabled'} successfully`,
      active: newStatus
    });
  } catch (error) {
    console.error('Error toggling payment method:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle payment method'
    });
  }
});

module.exports = router;