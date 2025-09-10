const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Get delivery history for agent
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, date_from, date_to } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT dh.*, 
             o.order_number, o.total as order_total,
             buyer.name as buyer_name, buyer.phone as buyer_phone,
             seller.name as seller_name
      FROM delivery_history dh
      JOIN orders o ON dh.order_id = o.id
      JOIN users buyer ON o.buyer_id = buyer.id
      JOIN users seller ON o.seller_id = seller.id
      WHERE 1=1
    `;
    const params = [];

    // Filter by agent if not admin
    if (req.user.role === 'agent') {
      query += ' AND dh.agent_id = (SELECT id FROM agents WHERE user_id = ?)';
      params.push(req.user.id);
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Apply filters
    if (status) {
      query += ' AND dh.status = ?';
      params.push(status);
    }

    if (date_from) {
      query += ' AND dh.created_at >= ?';
      params.push(date_from);
    }

    if (date_to) {
      query += ' AND dh.created_at <= ?';
      params.push(date_to + ' 23:59:59');
    }

    // Get total count
    const countQuery = query.replace(/SELECT dh\.\*, .*? FROM/, 'SELECT COUNT(*) as total FROM');
    const [countResult] = await db.execute(countQuery, params);
    const total = countResult[0].total;

    // Add pagination
    query += ' ORDER BY dh.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [deliveries] = await db.execute(query, params);

    res.json({
      success: true,
      deliveries,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching delivery history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch delivery history'
    });
  }
});

// Get delivery statistics for agent
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'agent' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    let agentCondition = '';
    const params = [];

    if (req.user.role === 'agent') {
      agentCondition = 'WHERE dh.agent_id = (SELECT id FROM agents WHERE user_id = ?)';
      params.push(req.user.id);
    }

    // Get overall statistics
    const [stats] = await db.execute(`
      SELECT 
        COUNT(*) as total_deliveries,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as completed_deliveries,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_deliveries,
        COALESCE(SUM(delivery_fee), 0) as total_delivery_fees,
        COALESCE(SUM(tip_amount), 0) as total_tips,
        COALESCE(AVG(distance_km), 0) as avg_distance,
        COALESCE(AVG(duration_minutes), 0) as avg_duration
      FROM delivery_history dh
      ${agentCondition}
    `, params);

    // Get monthly statistics for the last 6 months
    const [monthlyStats] = await db.execute(`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as deliveries,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as completed,
        COALESCE(SUM(delivery_fee + tip_amount), 0) as earnings
      FROM delivery_history dh
      ${agentCondition}
      ${agentCondition ? 'AND' : 'WHERE'} created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month DESC
    `, params);

    // Get daily statistics for the last 30 days
    const [dailyStats] = await db.execute(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as deliveries,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as completed,
        COALESCE(SUM(delivery_fee + tip_amount), 0) as earnings
      FROM delivery_history dh
      ${agentCondition}
      ${agentCondition ? 'AND' : 'WHERE'} created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `, params);

    res.json({
      success: true,
      stats: stats[0],
      monthly_stats: monthlyStats,
      daily_stats: dailyStats
    });
  } catch (error) {
    console.error('Error fetching delivery stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch delivery statistics'
    });
  }
});

// Get specific delivery details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const deliveryId = req.params.id;

    let query = `
      SELECT dh.*, 
             o.order_number, o.total as order_total, o.status as order_status,
             buyer.name as buyer_name, buyer.phone as buyer_phone, buyer.email as buyer_email,
             seller.name as seller_name, seller.phone as seller_phone,
             agent_user.name as agent_name, agent_user.phone as agent_phone
      FROM delivery_history dh
      JOIN orders o ON dh.order_id = o.id
      JOIN users buyer ON o.buyer_id = buyer.id
      JOIN users seller ON o.seller_id = seller.id
      JOIN agents a ON dh.agent_id = a.id
      JOIN users agent_user ON a.user_id = agent_user.id
      WHERE dh.id = ?
    `;
    const params = [deliveryId];

    // Filter by agent if not admin
    if (req.user.role === 'agent') {
      query += ' AND dh.agent_id = (SELECT id FROM agents WHERE user_id = ?)';
      params.push(req.user.id);
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const [delivery] = await db.execute(query, params);

    if (delivery.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Delivery not found'
      });
    }

    // Get location tracking history for this delivery
    const [locationHistory] = await db.execute(`
      SELECT latitude, longitude, accuracy, speed, heading, timestamp
      FROM realtime_locations
      WHERE order_id = ? AND user_id = (
        SELECT user_id FROM agents WHERE id = ?
      )
      ORDER BY timestamp ASC
    `, [delivery[0].order_id, delivery[0].agent_id]);

    res.json({
      success: true,
      delivery: delivery[0],
      location_history: locationHistory
    });
  } catch (error) {
    console.error('Error fetching delivery details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch delivery details'
    });
  }
});

// Create delivery history entry (when agent picks up order)
router.post('/', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'agent') {
      return res.status(403).json({
        success: false,
        message: 'Only agents can create delivery entries'
      });
    }

    const {
      order_id,
      pickup_location_lat,
      pickup_location_lng,
      pickup_address,
      delivery_location_lat,
      delivery_location_lng,
      delivery_address,
      delivery_fee = 0,
      notes
    } = req.body;

    // Verify agent is assigned to this order
    const [orderCheck] = await db.execute(`
      SELECT o.id, a.id as agent_id
      FROM orders o
      JOIN agents a ON o.agent_id = a.id
      WHERE o.id = ? AND a.user_id = ?
    `, [order_id, req.user.id]);

    if (orderCheck.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Order not found or not assigned to you'
      });
    }

    const agentId = orderCheck[0].agent_id;

    // Check if delivery history already exists
    const [existing] = await db.execute(`
      SELECT id FROM delivery_history WHERE order_id = ? AND agent_id = ?
    `, [order_id, agentId]);

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Delivery history already exists for this order'
      });
    }

    // Create delivery history entry
    const [result] = await db.execute(`
      INSERT INTO delivery_history (
        agent_id, order_id, pickup_location_lat, pickup_location_lng, pickup_address,
        delivery_location_lat, delivery_location_lng, delivery_address,
        pickup_time, delivery_fee, status, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, 'picked_up', ?, NOW())
    `, [
      agentId, order_id, pickup_location_lat, pickup_location_lng, pickup_address,
      delivery_location_lat, delivery_location_lng, delivery_address,
      delivery_fee, notes
    ]);

    // Update order status
    await db.execute(`
      UPDATE orders SET status = 'picked_up' WHERE id = ?
    `, [order_id]);

    res.json({
      success: true,
      message: 'Delivery history created successfully',
      delivery_id: result.insertId
    });
  } catch (error) {
    console.error('Error creating delivery history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create delivery history'
    });
  }
});

// Update delivery status
router.put('/:id/status', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'agent') {
      return res.status(403).json({
        success: false,
        message: 'Only agents can update delivery status'
      });
    }

    const deliveryId = req.params.id;
    const { status, notes, tip_amount } = req.body;

    const validStatuses = ['picked_up', 'in_transit', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    // Verify delivery belongs to agent
    const [deliveryCheck] = await db.execute(`
      SELECT dh.id, dh.order_id, dh.pickup_time
      FROM delivery_history dh
      JOIN agents a ON dh.agent_id = a.id
      WHERE dh.id = ? AND a.user_id = ?
    `, [deliveryId, req.user.id]);

    if (deliveryCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Delivery not found'
      });
    }

    const delivery = deliveryCheck[0];

    // Calculate duration if being marked as delivered
    let updateFields = 'status = ?, notes = ?, updated_at = NOW()';
    let params = [status, notes];

    if (status === 'delivered') {
      updateFields += ', delivery_time = NOW()';
      
      if (delivery.pickup_time) {
        updateFields += ', duration_minutes = TIMESTAMPDIFF(MINUTE, pickup_time, NOW())';
      }
      
      if (tip_amount !== undefined) {
        updateFields += ', tip_amount = ?';
        params.push(tip_amount);
      }
    }

    params.push(deliveryId);

    // Update delivery history
    await db.execute(`
      UPDATE delivery_history 
      SET ${updateFields}
      WHERE id = ?
    `, params);

    // Update order status
    await db.execute(`
      UPDATE orders SET status = ? WHERE id = ?
    `, [status, delivery.order_id]);

    // If delivered, update agent stats
    if (status === 'delivered') {
      await db.execute(`
        UPDATE agents 
        SET total_deliveries = total_deliveries + 1,
            last_active = NOW()
        WHERE user_id = ?
      `, [req.user.id]);
    }

    // Send system message to chat
    const io = req.app.get('io');
    if (io) {
      io.to(`order_${delivery.order_id}`).emit('delivery_status_update', {
        orderId: delivery.order_id,
        status,
        notes,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'Delivery status updated successfully'
    });
  } catch (error) {
    console.error('Error updating delivery status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update delivery status'
    });
  }
});

module.exports = router;