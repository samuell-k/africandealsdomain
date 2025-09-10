const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const bcrypt = require('bcrypt');

// GET /api/users - Get all users (Admin only)
router.get('/', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { role, status, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '';
    let params = [];

    if (role) {
      whereClause += ' WHERE role = ?';
      params.push(role);
    }

    if (status) {
      whereClause += (whereClause ? ' AND' : ' WHERE') + ' status = ?';
      params.push(status);
    }

    const [users] = await pool.execute(`
      SELECT id, name, email, role, phone, status, created_at, last_login
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), parseInt(offset)]);

    const [countResult] = await pool.execute(`
      SELECT COUNT(*) as total FROM users ${whereClause}
    `, params);

    res.json({
      success: true,
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    });
  }
});

// GET /api/users/:id - Get user by ID
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Users can access their own profile, admins can access any profile, 
    // and buyers can access seller profiles for shopping purposes
    const requestingUser = req.user;
    const targetUserId = parseInt(userId);
    
    if (requestingUser.id !== targetUserId && requestingUser.role !== 'admin') {
      // Check if requesting user is a buyer trying to access seller info
      const [targetUser] = await pool.execute('SELECT role FROM users WHERE id = ?', [targetUserId]);
      
      if (targetUser.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }
      
      // Allow buyers to access seller profiles
      if (requestingUser.role !== 'buyer' || targetUser[0].role !== 'seller') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    }

    const [users] = await pool.execute(`
      SELECT id, name, email, role, phone, status, created_at, last_login, profile_image,
             address, city, latitude, longitude, full_name, business_name, rating, total_reviews
      FROM users 
      WHERE id = ?
    `, [userId]);

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = users[0];

    // Get additional role-specific data
    if (user.role === 'seller') {
      const [sellerData] = await pool.execute(`
        SELECT store_name, store_description, total_products, total_sales
        FROM sellers 
        WHERE user_id = ?
      `, [userId]);
      
      if (sellerData.length > 0) {
        user.seller_profile = sellerData[0];
      }
    }

    if (user.role === 'agent') {
      const [agentData] = await pool.execute(`
        SELECT agent_type, status as agent_status, total_deliveries, rating
        FROM agents 
        WHERE user_id = ?
      `, [userId]);
      
      if (agentData.length > 0) {
        user.agent_profile = agentData[0];
      }
    }

    res.json({
      success: true,
      user
    });

  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user'
    });
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.params.id;
    const { name, email, phone, profile_image } = req.body;
    
    // Users can only update their own profile unless they're admin
    if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Validate email format if provided
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Check if email is already taken by another user
    if (email) {
      const [existingUsers] = await pool.execute(`
        SELECT id FROM users WHERE email = ? AND id != ?
      `, [email, userId]);

      if (existingUsers.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Email already taken'
        });
      }
    }

    // Build update query dynamically
    const updates = [];
    const params = [];

    if (name) {
      updates.push('name = ?');
      params.push(name);
    }
    if (email) {
      updates.push('email = ?');
      params.push(email);
    }
    if (phone) {
      updates.push('phone = ?');
      params.push(phone);
    }
    if (profile_image) {
      updates.push('profile_image = ?');
      params.push(profile_image);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    updates.push('updated_at = NOW()');
    params.push(userId);

    await pool.execute(`
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = ?
    `, params);

    // Get updated user data
    const [updatedUsers] = await pool.execute(`
      SELECT id, name, email, role, phone, status, profile_image
      FROM users 
      WHERE id = ?
    `, [userId]);

    res.json({
      success: true,
      message: 'User updated successfully',
      user: updatedUsers[0]
    });

  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user'
    });
  }
});

// PUT /api/users/:id/password - Change password
router.put('/:id/password', requireAuth, async (req, res) => {
  try {
    const userId = req.params.id;
    const { current_password, new_password } = req.body;
    
    // Users can only change their own password unless they're admin
    if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    if (!new_password || new_password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters'
      });
    }

    // For non-admin users, verify current password
    if (req.user.role !== 'admin') {
      if (!current_password) {
        return res.status(400).json({
          success: false,
          error: 'Current password is required'
        });
      }

      const [users] = await pool.execute(`
        SELECT password FROM users WHERE id = ?
      `, [userId]);

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      const isValidPassword = await bcrypt.compare(current_password, users[0].password);
      if (!isValidPassword) {
        return res.status(400).json({
          success: false,
          error: 'Current password is incorrect'
        });
      }
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // Update password
    await pool.execute(`
      UPDATE users 
      SET password = ?, updated_at = NOW()
      WHERE id = ?
    `, [hashedPassword, userId]);

    res.json({
      success: true,
      message: 'Password updated successfully'
    });

  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update password'
    });
  }
});

// PUT /api/users/:id/status - Update user status (Admin only)
router.put('/:id/status', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const userId = req.params.id;
    const { status, reason } = req.body;

    if (!['active', 'suspended', 'banned'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be active, suspended, or banned'
      });
    }

    await pool.execute(`
      UPDATE users 
      SET status = ?, status_reason = ?, updated_at = NOW()
      WHERE id = ?
    `, [status, reason || null, userId]);

    // Log status change
    await pool.execute(`
      INSERT INTO user_status_logs (user_id, old_status, new_status, reason, changed_by, created_at)
      VALUES (?, (SELECT status FROM users WHERE id = ?), ?, ?, ?, NOW())
    `, [userId, userId, status, reason, req.user.id]);

    res.json({
      success: true,
      message: `User status updated to ${status}`
    });

  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user status'
    });
  }
});

// DELETE /api/users/:id - Delete user (Admin only)
router.delete('/:id', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const userId = req.params.id;

    // Check if user exists
    const [users] = await pool.execute(`
      SELECT id, role FROM users WHERE id = ?
    `, [userId]);

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Don't allow deleting admin users
    if (users[0].role === 'admin') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete admin users'
      });
    }

    // Soft delete - mark as deleted instead of actually deleting
    await pool.execute(`
      UPDATE users 
      SET status = 'deleted', deleted_at = NOW(), deleted_by = ?
      WHERE id = ?
    `, [req.user.id, userId]);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete user'
    });
  }
});

// GET /api/users/profile - Get current user's profile
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const [users] = await pool.execute(`
      SELECT id, name, email, role, phone, status, created_at, last_login, profile_image, 
             city, address, latitude, longitude
      FROM users 
      WHERE id = ?
    `, [userId]);

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = users[0];

    // Get additional role-specific data
    if (user.role === 'seller') {
      const [sellerData] = await pool.execute(`
        SELECT store_name, store_description, total_products, total_sales
        FROM sellers 
        WHERE user_id = ?
      `, [userId]);
      
      if (sellerData.length > 0) {
        user.seller_profile = sellerData[0];
      }
    }

    if (user.role === 'agent') {
      const [agentData] = await pool.execute(`
        SELECT agent_type, status as agent_status, total_deliveries, rating
        FROM agents 
        WHERE user_id = ?
      `, [userId]);
      
      if (agentData.length > 0) {
        user.agent_profile = agentData[0];
      }
    }

    res.json({
      success: true,
      user
    });

  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user profile'
    });
  }
});

// PUT /api/users/profile - Update current user's profile
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, phone, city, address, profile_image } = req.body;
    
    // Build update query dynamically
    const updates = [];
    const params = [];

    if (name) {
      updates.push('name = ?');
      params.push(name);
    }
    if (phone) {
      updates.push('phone = ?');
      params.push(phone);
    }
    if (city) {
      updates.push('city = ?');
      params.push(city);
    }
    if (address) {
      updates.push('address = ?');
      params.push(address);
    }
    if (profile_image) {
      updates.push('profile_image = ?');
      params.push(profile_image);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    updates.push('updated_at = NOW()');
    params.push(userId);

    await pool.execute(`
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = ?
    `, params);

    // Get updated user data
    const [updatedUsers] = await pool.execute(`
      SELECT id, name, email, role, phone, status, profile_image, city, address
      FROM users 
      WHERE id = ?
    `, [userId]);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUsers[0]
    });

  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
});

// GET /api/users/stats/overview - Get user statistics (Admin only)
router.get('/stats/overview', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const [stats] = await pool.execute(`
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN role = 'buyer' THEN 1 ELSE 0 END) as total_buyers,
        SUM(CASE WHEN role = 'seller' THEN 1 ELSE 0 END) as total_sellers,
        SUM(CASE WHEN role = 'agent' THEN 1 ELSE 0 END) as total_agents,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_users,
        SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as new_users_30d
      FROM users 
      WHERE status != 'deleted'
    `);

    res.json({
      success: true,
      stats: stats[0]
    });

  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user statistics'
    });
  }
});

module.exports = router;