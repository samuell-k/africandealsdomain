const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Get chat messages for an order
router.get('/:orderId', authenticateToken, async (req, res) => {
  try {
    const orderId = req.params.orderId;

    // Verify user has access to this order
    const [orderCheck] = await db.execute(`
      SELECT o.id, o.buyer_id, a.user_id as agent_user_id
      FROM orders o
      LEFT JOIN agents a ON o.agent_id = a.id
      WHERE o.id = ? AND (o.buyer_id = ? OR a.user_id = ? OR ? = 'admin')
    `, [orderId, req.user.id, req.user.id, req.user.role]);

    if (orderCheck.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this order chat'
      });
    }

    // Get chat messages
    const [messages] = await db.execute(`
      SELECT cm.*, 
             sender.name as sender_name, sender.role as sender_role,
             receiver.name as receiver_name, receiver.role as receiver_role
      FROM chat_messages cm
      JOIN users sender ON cm.sender_id = sender.id
      JOIN users receiver ON cm.receiver_id = receiver.id
      WHERE cm.order_id = ?
      ORDER BY cm.created_at ASC
    `, [orderId]);

    // Mark messages as read for current user
    await db.execute(`
      UPDATE chat_messages 
      SET is_read = TRUE, read_at = NOW()
      WHERE order_id = ? AND receiver_id = ? AND is_read = FALSE
    `, [orderId, req.user.id]);

    res.json({
      success: true,
      messages
    });
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages'
    });
  }
});

// Send a chat message
router.post('/:orderId', authenticateToken, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const { message, message_type = 'text' } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }

    // Verify user has access to this order and get receiver
    const [orderCheck] = await db.execute(`
      SELECT o.id, o.buyer_id, a.user_id as agent_user_id, a.id as agent_id
      FROM orders o
      LEFT JOIN agents a ON o.agent_id = a.id
      WHERE o.id = ? AND (o.buyer_id = ? OR a.user_id = ?)
    `, [orderId, req.user.id, req.user.id]);

    if (orderCheck.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this order'
      });
    }

    const order = orderCheck[0];
    
    // Determine receiver based on sender
    let receiverId;
    if (req.user.id === order.buyer_id) {
      // Buyer sending to agent
      receiverId = order.agent_user_id;
    } else if (req.user.id === order.agent_user_id) {
      // Agent sending to buyer
      receiverId = order.buyer_id;
    } else {
      return res.status(403).json({
        success: false,
        message: 'Invalid sender for this order'
      });
    }

    if (!receiverId) {
      return res.status(400).json({
        success: false,
        message: 'No agent assigned to this order yet'
      });
    }

    // Insert message
    const [result] = await db.execute(`
      INSERT INTO chat_messages (
        order_id, sender_id, receiver_id, message, message_type, created_at
      ) VALUES (?, ?, ?, ?, ?, NOW())
    `, [orderId, req.user.id, receiverId, message.trim(), message_type]);

    // Get the inserted message with user details
    const [newMessage] = await db.execute(`
      SELECT cm.*, 
             sender.name as sender_name, sender.role as sender_role,
             receiver.name as receiver_name, receiver.role as receiver_role
      FROM chat_messages cm
      JOIN users sender ON cm.sender_id = sender.id
      JOIN users receiver ON cm.receiver_id = receiver.id
      WHERE cm.id = ?
    `, [result.insertId]);

    // Emit real-time message via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`order_${orderId}`).emit('new_message', {
        orderId,
        message: newMessage[0]
      });

      // Also emit to specific user rooms if they exist
      io.to(`user_${receiverId}`).emit('new_message', {
        orderId,
        message: newMessage[0]
      });
    }

    res.json({
      success: true,
      message: 'Message sent successfully',
      data: newMessage[0]
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  }
});

// Get unread message count for user
router.get('/unread/count', authenticateToken, async (req, res) => {
  try {
    const [result] = await db.execute(`
      SELECT COUNT(*) as unread_count
      FROM chat_messages cm
      JOIN orders o ON cm.order_id = o.id
      LEFT JOIN agents a ON o.agent_id = a.id
      WHERE cm.receiver_id = ? AND cm.is_read = FALSE
        AND (o.buyer_id = ? OR a.user_id = ?)
    `, [req.user.id, req.user.id, req.user.id]);

    res.json({
      success: true,
      unread_count: result[0].unread_count
    });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch unread count'
    });
  }
});

// Get chat summary for user's orders
router.get('/summary/orders', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT DISTINCT
        o.id as order_id,
        o.order_number,
        o.status as order_status,
        o.total,
        buyer.name as buyer_name,
        agent_user.name as agent_name,
        (SELECT COUNT(*) FROM chat_messages WHERE order_id = o.id AND receiver_id = ? AND is_read = FALSE) as unread_count,
        (SELECT message FROM chat_messages WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM chat_messages WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1) as last_message_time
      FROM orders o
      JOIN users buyer ON o.buyer_id = buyer.id
      LEFT JOIN agents a ON o.agent_id = a.id
      LEFT JOIN users agent_user ON a.user_id = agent_user.id
      WHERE EXISTS (
        SELECT 1 FROM chat_messages cm WHERE cm.order_id = o.id 
        AND (cm.sender_id = ? OR cm.receiver_id = ?)
      )
    `;
    
    const params = [req.user.id, req.user.id, req.user.id];

    // Filter based on user role
    if (req.user.role === 'buyer') {
      query += ' AND o.buyer_id = ?';
      params.push(req.user.id);
    } else if (req.user.role === 'agent') {
      query += ' AND a.user_id = ?';
      params.push(req.user.id);
    }

    query += ' ORDER BY last_message_time DESC';

    const [chats] = await db.execute(query, params);

    res.json({
      success: true,
      chats
    });
  } catch (error) {
    console.error('Error fetching chat summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch chat summary'
    });
  }
});

// Mark messages as read
router.put('/:orderId/read', authenticateToken, async (req, res) => {
  try {
    const orderId = req.params.orderId;

    await db.execute(`
      UPDATE chat_messages 
      SET is_read = TRUE, read_at = NOW()
      WHERE order_id = ? AND receiver_id = ? AND is_read = FALSE
    `, [orderId, req.user.id]);

    res.json({
      success: true,
      message: 'Messages marked as read'
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark messages as read'
    });
  }
});

// Send system message (for order status updates)
router.post('/:orderId/system', authenticateToken, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const { message } = req.body;

    // Verify user has access to this order
    const [orderCheck] = await db.execute(`
      SELECT o.id, o.buyer_id, a.user_id as agent_user_id
      FROM orders o
      LEFT JOIN agents a ON o.agent_id = a.id
      WHERE o.id = ? AND (o.buyer_id = ? OR a.user_id = ? OR ? = 'admin')
    `, [orderId, req.user.id, req.user.id, req.user.role]);

    if (orderCheck.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this order'
      });
    }

    const order = orderCheck[0];

    // Send system message to both buyer and agent
    const recipients = [order.buyer_id, order.agent_user_id].filter(Boolean);
    
    for (const receiverId of recipients) {
      if (receiverId !== req.user.id) {
        await db.execute(`
          INSERT INTO chat_messages (
            order_id, sender_id, receiver_id, message, message_type, created_at
          ) VALUES (?, ?, ?, ?, 'system', NOW())
        `, [orderId, req.user.id, receiverId, message]);
      }
    }

    // Emit real-time system message
    const io = req.app.get('io');
    if (io) {
      io.to(`order_${orderId}`).emit('system_message', {
        orderId,
        message,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'System message sent'
    });
  } catch (error) {
    console.error('Error sending system message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send system message'
    });
  }
});

module.exports = router;