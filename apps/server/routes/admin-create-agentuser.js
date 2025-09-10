const express = require('express');
const router = express.Router();
const db = require('../db.js');
const bcrypt = require('bcrypt');
const { requireAuth, requireRole } = require('./auth.js');

// Create Agent User (admin only)
// POST /api/admin/create-agentuser
router.post('/create-agentuser', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      username,
      email,
      phone,
      password,
      role,
      agent_type,
      is_active = 1
    } = req.body;

    // Basic validation
    if (!first_name || !last_name || !username || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: first_name, last_name, username, email, password, role'
      });
    }

    if (role !== 'agent') {
      return res.status(400).json({ success: false, message: 'This endpoint only creates agent users' });
    }

    if (!agent_type) {
      return res.status(400).json({ success: false, message: 'Agent type is required for agent role' });
    }

    // Check duplicates
    const [existingUsers] = await db.execute(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ success: false, message: 'Username or email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with agent_type stored in users table as well
    const [userResult] = await db.execute(
      `INSERT INTO users (
        first_name, last_name, username, email, phone, password,
        role, agent_type, is_active, is_verified, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
      [
        first_name,
        last_name,
        username,
        email,
        phone || null,
        hashedPassword,
        role,
        agent_type,
        is_active
      ]
    );

    const newUserId = userResult.insertId;

    // Ensure agents profile exists with the correct agent_type
    try {
      const [agentRows] = await db.execute('SELECT id FROM agents WHERE user_id = ?', [newUserId]);
      if (agentRows.length === 0) {
        await db.execute(
          `INSERT INTO agents (user_id, first_name, last_name, email, phone, status, agent_type, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'offline', ?, NOW(), NOW())`,
          [newUserId, first_name, last_name, email, phone || null, agent_type]
        );
      } else {
        await db.execute(
          `UPDATE agents SET first_name = ?, last_name = ?, email = ?, phone = ?, agent_type = ?, updated_at = NOW()
           WHERE user_id = ?`,
          [first_name, last_name, email, phone || null, agent_type, newUserId]
        );
      }
    } catch (agentErr) {
      console.error('[ADMIN CREATE AGENT USER] Failed to sync agents profile:', agentErr.message);
      // Continue; user is created – but inform the client
    }

    // Log to system_logs
    try {
      await db.execute(
        `INSERT INTO system_logs (level, message, details, created_at)
         VALUES (?, ?, ?, NOW())`,
        [
          'info',
          'Admin created agent user',
          JSON.stringify({
            new_user_id: newUserId,
            username,
            email,
            role,
            agent_type,
            created_by: req.user?.id || 'unknown',
            created_by_email: req.user?.email || 'unknown'
          })
        ]
      );
    } catch (logErr) {
      console.warn('[ADMIN CREATE AGENT USER] Failed to log creation:', logErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Agent user created successfully',
      user_id: newUserId
    });
  } catch (error) {
    console.error('[ADMIN CREATE AGENT USER] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create agent user', error: error.message });
  }
});

module.exports = router;