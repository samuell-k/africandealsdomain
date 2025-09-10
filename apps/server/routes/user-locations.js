const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Get user's locations
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [locations] = await db.execute(`
      SELECT id, location_type, latitude, longitude, address, city, state, country, 
             postal_code, is_primary, is_active, created_at, updated_at
      FROM user_locations 
      WHERE user_id = ? AND is_active = TRUE
      ORDER BY is_primary DESC, created_at DESC
    `, [req.user.id]);

    res.json({
      success: true,
      locations
    });
  } catch (error) {
    console.error('Error fetching user locations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch locations'
    });
  }
});

// Add new location
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      location_type = 'manual',
      latitude,
      longitude,
      address,
      city,
      state,
      country,
      postal_code,
      is_primary = false
    } = req.body;

    // Validate required fields
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    // If this is set as primary, unset other primary locations
    if (is_primary) {
      await db.execute(`
        UPDATE user_locations 
        SET is_primary = FALSE 
        WHERE user_id = ?
      `, [req.user.id]);
    }

    const [result] = await db.execute(`
      INSERT INTO user_locations (
        user_id, location_type, latitude, longitude, address, city, state, 
        country, postal_code, is_primary, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      req.user.id, location_type, latitude, longitude, address, 
      city, state, country, postal_code, is_primary
    ]);

    // Update user's last location if this is primary
    if (is_primary) {
      await db.execute(`
        UPDATE users 
        SET last_location_lat = ?, last_location_lng = ?, last_location_update = NOW()
        WHERE id = ?
      `, [latitude, longitude, req.user.id]);
    }

    res.json({
      success: true,
      message: 'Location added successfully',
      location_id: result.insertId
    });
  } catch (error) {
    console.error('Error adding location:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add location'
    });
  }
});

// Update location
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const locationId = req.params.id;
    const {
      latitude,
      longitude,
      address,
      city,
      state,
      country,
      postal_code,
      is_primary = false
    } = req.body;

    // Verify location belongs to user
    const [existing] = await db.execute(`
      SELECT id FROM user_locations 
      WHERE id = ? AND user_id = ?
    `, [locationId, req.user.id]);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }

    // If this is set as primary, unset other primary locations
    if (is_primary) {
      await db.execute(`
        UPDATE user_locations 
        SET is_primary = FALSE 
        WHERE user_id = ? AND id != ?
      `, [req.user.id, locationId]);
    }

    await db.execute(`
      UPDATE user_locations 
      SET latitude = ?, longitude = ?, address = ?, city = ?, state = ?, 
          country = ?, postal_code = ?, is_primary = ?, updated_at = NOW()
      WHERE id = ? AND user_id = ?
    `, [
      latitude, longitude, address, city, state, country, postal_code, 
      is_primary, locationId, req.user.id
    ]);

    // Update user's last location if this is primary
    if (is_primary && latitude && longitude) {
      await db.execute(`
        UPDATE users 
        SET last_location_lat = ?, last_location_lng = ?, last_location_update = NOW()
        WHERE id = ?
      `, [latitude, longitude, req.user.id]);
    }

    res.json({
      success: true,
      message: 'Location updated successfully'
    });
  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update location'
    });
  }
});

// Delete location
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const locationId = req.params.id;

    // Verify location belongs to user
    const [existing] = await db.execute(`
      SELECT id, is_primary FROM user_locations 
      WHERE id = ? AND user_id = ?
    `, [locationId, req.user.id]);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }

    // Soft delete
    await db.execute(`
      UPDATE user_locations 
      SET is_active = FALSE, updated_at = NOW()
      WHERE id = ? AND user_id = ?
    `, [locationId, req.user.id]);

    res.json({
      success: true,
      message: 'Location deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting location:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete location'
    });
  }
});

// Update real-time location
router.post('/realtime', authenticateToken, async (req, res) => {
  try {
    const {
      latitude,
      longitude,
      accuracy,
      speed,
      heading,
      order_id
    } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    // Insert real-time location
    await db.execute(`
      INSERT INTO realtime_locations (
        user_id, order_id, latitude, longitude, accuracy, speed, heading, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `, [req.user.id, order_id, latitude, longitude, accuracy, speed, heading]);

    // Update user's last location
    await db.execute(`
      UPDATE users 
      SET last_location_lat = ?, last_location_lng = ?, last_location_update = NOW()
      WHERE id = ?
    `, [latitude, longitude, req.user.id]);

    // If user is an agent, update agent location
    if (req.user.role === 'agent') {
      await db.execute(`
        UPDATE agents 
        SET current_location_lat = ?, current_location_lng = ?, 
            location_updated_at = NOW(), is_online = TRUE, last_active = NOW()
        WHERE user_id = ?
      `, [latitude, longitude, req.user.id]);
    }

    // Emit real-time location update via Socket.io
    const io = req.app.get('io');
    if (io && order_id) {
      io.emit('location_update', {
        userId: req.user.id,
        orderId: order_id,
        latitude,
        longitude,
        accuracy,
        speed,
        heading,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'Location updated successfully'
    });
  } catch (error) {
    console.error('Error updating real-time location:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update location'
    });
  }
});

// Get real-time location history
router.get('/realtime/:orderId?', authenticateToken, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    let query = `
      SELECT rl.*, u.name as user_name, u.role
      FROM realtime_locations rl
      JOIN users u ON rl.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (orderId) {
      query += ' AND rl.order_id = ?';
      params.push(orderId);
    }

    // If not admin, only show own locations or locations for orders they're involved in
    if (req.user.role !== 'admin') {
      query += ` AND (rl.user_id = ? OR rl.order_id IN (
        SELECT id FROM orders WHERE buyer_id = ? OR agent_id = (
          SELECT id FROM agents WHERE user_id = ?
        )
      ))`;
      params.push(req.user.id, req.user.id, req.user.id);
    }

    query += ' ORDER BY rl.timestamp DESC LIMIT 100';

    const [locations] = await db.execute(query, params);

    res.json({
      success: true,
      locations
    });
  } catch (error) {
    console.error('Error fetching real-time locations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch locations'
    });
  }
});

// Set location as primary
router.put('/:id/primary', authenticateToken, async (req, res) => {
  try {
    const locationId = req.params.id;

    // Verify location belongs to user
    const [existing] = await db.execute(`
      SELECT id, latitude, longitude FROM user_locations 
      WHERE id = ? AND user_id = ? AND is_active = TRUE
    `, [locationId, req.user.id]);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }

    const location = existing[0];

    // Unset other primary locations
    await db.execute(`
      UPDATE user_locations 
      SET is_primary = FALSE 
      WHERE user_id = ?
    `, [req.user.id]);

    // Set this location as primary
    await db.execute(`
      UPDATE user_locations 
      SET is_primary = TRUE, updated_at = NOW()
      WHERE id = ? AND user_id = ?
    `, [locationId, req.user.id]);

    // Update user's last location
    if (location.latitude && location.longitude) {
      await db.execute(`
        UPDATE users 
        SET last_location_lat = ?, last_location_lng = ?, last_location_update = NOW()
        WHERE id = ?
      `, [location.latitude, location.longitude, req.user.id]);
    }

    res.json({
      success: true,
      message: 'Primary location updated successfully'
    });
  } catch (error) {
    console.error('Error setting primary location:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set primary location'
    });
  }
});

// Toggle location sharing
router.post('/sharing', authenticateToken, async (req, res) => {
  try {
    const { enabled } = req.body;

    await db.execute(`
      UPDATE users 
      SET location_sharing = ?
      WHERE id = ?
    `, [enabled, req.user.id]);

    res.json({
      success: true,
      message: `Location sharing ${enabled ? 'enabled' : 'disabled'}`
    });
  } catch (error) {
    console.error('Error updating location sharing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update location sharing'
    });
  }
});

module.exports = router;