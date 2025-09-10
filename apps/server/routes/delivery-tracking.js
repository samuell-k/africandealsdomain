const express = require('express');
const router = express.Router();
const { requireAuth } = require('./auth');
const pool = require('../db');

// ========== AGENT LOCATION TRACKING ==========

// GET /api/delivery-tracking/agent-location/:orderId - Get agent location for specific order
router.get('/agent-location/:orderId', requireAuth, async (req, res) => {
  try {
    const orderId = req.params.orderId;

    // Get agent location for the order
    const [results] = await pool.query(`
      SELECT 
        a.current_lat,
        a.current_lng,
        a.last_location_update,
        a.status as agent_status,
        o.tracking_status,
        o.estimated_delivery_time
      FROM orders o
      JOIN agents a ON o.agent_id = a.id
      WHERE o.id = ? AND (o.user_id = ? OR a.user_id = ?)
    `, [orderId, req.user.id, req.user.id]);

    if (results.length === 0) {
      return res.status(404).json({ error: 'Order not found or access denied' });
    }

    const result = results[0];

    res.json({
      success: true,
      location: {
        lat: result.current_lat,
        lng: result.current_lng,
        last_update: result.last_location_update,
        agent_status: result.agent_status,
        tracking_status: result.tracking_status,
        estimated_delivery: result.estimated_delivery_time
      }
    });
  } catch (error) {
    console.error('Error fetching agent location:', error);
    res.status(500).json({ error: 'Failed to fetch agent location' });
  }
});

// ========== DELIVERY MESSAGING SYSTEM ==========

// GET /api/delivery-tracking/messages/:orderId - Get messages for an order
router.get('/messages/:orderId', requireAuth, async (req, res) => {
  try {
    const orderId = req.params.orderId;

    // Verify user has access to this order
    const [orderAccess] = await pool.query(`
      SELECT o.id FROM orders o
      LEFT JOIN agents a ON o.agent_id = a.id
      WHERE o.id = ? AND (o.user_id = ? OR a.user_id = ?)
    `, [orderId, req.user.id, req.user.id]);

    if (orderAccess.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get messages
    const [messages] = await pool.query(`
      SELECT 
        dm.*,
        u.name as sender_name,
        u.role as sender_role
      FROM delivery_messages dm
      JOIN users u ON dm.sender_id = u.id
      WHERE dm.order_id = ?
      ORDER BY dm.created_at ASC
    `, [orderId]);

    // Mark messages as read for the current user
    await pool.query(`
      UPDATE delivery_messages SET is_read = 1
      WHERE order_id = ? AND receiver_id = ?
    `, [orderId, req.user.id]);

    res.json({ success: true, messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST /api/delivery-tracking/messages/:orderId - Send message
router.post('/messages/:orderId', requireAuth, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const { message, message_type = 'text' } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message content required' });
    }

    // Get order details and determine receiver
    const [orderDetails] = await pool.query(`
      SELECT 
        o.user_id as buyer_id,
        a.user_id as agent_user_id,
        a.id as agent_id
      FROM orders o
      LEFT JOIN agents a ON o.agent_id = a.id
      WHERE o.id = ? AND (o.user_id = ? OR a.user_id = ?)
    `, [orderId, req.user.id, req.user.id]);

    if (orderDetails.length === 0) {
      return res.status(403).json({ error: 'Access denied or order not found' });
    }

    const order = orderDetails[0];
    
    // Determine receiver based on sender
    let receiverId;
    let isAgent = false;
    
    if (req.user.id === order.buyer_id) {
      // Buyer sending to agent
      receiverId = order.agent_user_id;
      isAgent = false;
    } else if (req.user.id === order.agent_user_id) {
      // Agent sending to buyer
      receiverId = order.buyer_id;
      isAgent = true;
    } else {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!receiverId) {
      return res.status(400).json({ error: 'No agent assigned to this order yet' });
    }

    // Insert message
    const [result] = await pool.query(`
      INSERT INTO delivery_messages (
        order_id, sender_id, receiver_id, message, message_type, is_agent
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [orderId, req.user.id, receiverId, message.trim(), message_type, isAgent]);

    // Get the inserted message with sender info
    const [newMessage] = await pool.query(`
      SELECT 
        dm.*,
        u.name as sender_name,
        u.role as sender_role
      FROM delivery_messages dm
      JOIN users u ON dm.sender_id = u.id
      WHERE dm.id = ?
    `, [result.insertId]);

    res.json({ 
      success: true, 
      message: 'Message sent successfully',
      data: newMessage[0]
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// ========== AGENT REVIEWS SYSTEM ==========

// GET /api/delivery-tracking/agent-reviews/:agentId - Get agent reviews
router.get('/agent-reviews/:agentId', async (req, res) => {
  try {
    const agentId = req.params.agentId;

    // Get agent reviews with buyer info
    const [reviews] = await pool.query(`
      SELECT 
        ar.rating,
        ar.comment,
        ar.created_at,
        u.name as buyer_name
      FROM agent_reviews ar
      JOIN users u ON ar.buyer_id = u.id
      WHERE ar.agent_id = ?
      ORDER BY ar.created_at DESC
      LIMIT 20
    `, [agentId]);

    // Get agent stats
    const [stats] = await pool.query(`
      SELECT 
        AVG(rating) as average_rating,
        COUNT(*) as total_reviews,
        COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star,
        COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star,
        COUNT(CASE WHEN rating = 3 THEN 1 END) as three_star,
        COUNT(CASE WHEN rating = 2 THEN 1 END) as two_star,
        COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star
      FROM agent_reviews
      WHERE agent_id = ?
    `, [agentId]);

    res.json({
      success: true,
      reviews,
      stats: stats[0] || {
        average_rating: 0,
        total_reviews: 0,
        five_star: 0,
        four_star: 0,
        three_star: 0,
        two_star: 0,
        one_star: 0
      }
    });
  } catch (error) {
    console.error('Error fetching agent reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// ========== DELIVERY ANALYTICS ==========

// GET /api/delivery-tracking/analytics - Get delivery analytics (for agents)
router.get('/analytics', requireAuth, async (req, res) => {
  try {
    // Verify user is an agent
    const [agents] = await pool.query(`
      SELECT id FROM agents WHERE user_id = ?
    `, [req.user.id]);

    if (agents.length === 0) {
      return res.status(403).json({ error: 'Agent access required' });
    }

    const agentId = agents[0].id;

    // Get delivery statistics
    const [deliveryStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_deliveries,
        COUNT(CASE WHEN o.status = 'delivered' THEN 1 END) as completed_deliveries,
        COUNT(CASE WHEN o.status = 'cancelled' THEN 1 END) as cancelled_deliveries,
        AVG(CASE WHEN o.actual_delivery_time IS NOT NULL AND o.estimated_delivery_time IS NOT NULL 
            THEN TIMESTAMPDIFF(MINUTE, o.estimated_delivery_time, o.actual_delivery_time) END) as avg_delay_minutes,
        SUM(o.agent_commission) as total_earnings
      FROM orders o
      WHERE o.agent_id = ?
    `, [agentId]);

    // Get recent deliveries
    const [recentDeliveries] = await pool.query(`
      SELECT 
        o.id,
        o.order_number,
        o.status,
        o.tracking_status,
        o.created_at,
        o.actual_delivery_time,
        o.agent_commission,
        u.name as buyer_name
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.agent_id = ?
      ORDER BY o.created_at DESC
      LIMIT 10
    `, [agentId]);

    // Get earnings by month
    const [monthlyEarnings] = await pool.query(`
      SELECT 
        DATE_FORMAT(paid_at, '%Y-%m') as month,
        SUM(amount) as earnings
      FROM agent_earnings
      WHERE agent_id = ? AND status = 'paid'
      GROUP BY DATE_FORMAT(paid_at, '%Y-%m')
      ORDER BY month DESC
      LIMIT 12
    `, [agentId]);

    res.json({
      success: true,
      analytics: {
        delivery_stats: deliveryStats[0],
        recent_deliveries: recentDeliveries,
        monthly_earnings: monthlyEarnings
      }
    });
  } catch (error) {
    console.error('Error fetching delivery analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

module.exports = router;