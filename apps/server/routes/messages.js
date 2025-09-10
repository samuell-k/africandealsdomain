const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth } = require('./auth');

// GET /api/messages - Get all messages for a user
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const orderId = req.query.order_id;

    let query = `
      SELECT 
        m.*,
        u.name as sender_name,
        u.email as sender_email,
        p.name as product_name,
        p.main_image as product_image
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      LEFT JOIN products p ON m.product_id = p.id
      WHERE (m.recipient_id = ? OR m.sender_id = ?)
    `;
    
    const params = [userId, userId];
    
    if (orderId) {
      query += ' AND m.order_id = ?';
      params.push(orderId);
    }
    
    query += ' ORDER BY m.created_at DESC';

    const [messages] = await pool.execute(query, params);
    
    res.json({
      success: true,
      messages: messages.map(msg => ({
        id: msg.id,
        subject: msg.subject,
        content: msg.content,
        sender_id: msg.sender_id,
        recipient_id: msg.recipient_id,
        sender_name: msg.sender_name,
        sender_email: msg.sender_email,
        product_name: msg.product_name,
        product_image: msg.product_image,
        order_id: msg.order_id,
        is_read: msg.is_read,
        created_at: msg.created_at,
        updated_at: msg.updated_at
      }))
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// GET /api/messages/:id - Get a specific message
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const messageId = req.params.id;
    const userId = req.user.id;

    const query = `
      SELECT 
        m.*,
        u.name as sender_name,
        u.email as sender_email,
        p.name as product_name,
        p.main_image as product_image
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      LEFT JOIN products p ON m.product_id = p.id
      WHERE m.id = ? AND (m.recipient_id = ? OR m.sender_id = ?)
    `;

    const [messages] = await pool.execute(query, [messageId, userId, userId]);
    
    if (messages.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Mark as read if recipient is viewing
    if (messages[0].recipient_id == userId && !messages[0].is_read) {
      await pool.execute(
        'UPDATE messages SET is_read = 1 WHERE id = ?',
        [messageId]
      );
    }

    res.json({
      success: true,
      message: {
        id: messages[0].id,
        subject: messages[0].subject,
        content: messages[0].content,
        sender_name: messages[0].sender_name,
        sender_email: messages[0].sender_email,
        product_name: messages[0].product_name,
        product_image: messages[0].product_image,
        is_read: messages[0].is_read,
        created_at: messages[0].created_at,
        updated_at: messages[0].updated_at
      }
    });
  } catch (error) {
    console.error('Error fetching message:', error);
    res.status(500).json({ error: 'Failed to fetch message' });
  }
});

// POST /api/messages - Send a new message
router.post('/', requireAuth, async (req, res) => {
  try {
    const { recipient_id, subject, content, product_id, order_id } = req.body;
    const sender_id = req.user.id;

    if (!recipient_id || !subject || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const query = `
      INSERT INTO messages (sender_id, recipient_id, subject, content, product_id, order_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    const [result] = await pool.execute(query, [
      sender_id, recipient_id, subject, content, product_id || null, order_id || null
    ]);

    res.json({
      success: true,
      message_id: result.insertId,
      message: 'Message sent successfully'
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// PUT /api/messages/:id/read - Mark message as read
router.put('/:id/read', async (req, res) => {
  try {
    const messageId = req.params.id;
    const userId = req.user?.id || req.body.user_id;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const query = `
      UPDATE messages 
      SET is_read = 1, updated_at = NOW()
      WHERE id = ? AND recipient_id = ?
    `;

    const [result] = await pool.execute(query, [messageId, userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Message not found or unauthorized' });
    }

    res.json({
      success: true,
      message: 'Message marked as read'
    });
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

// DELETE /api/messages/:id - Delete a message
router.delete('/:id', async (req, res) => {
  try {
    const messageId = req.params.id;
    const userId = req.user?.id || req.body.user_id;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const query = `
      DELETE FROM messages 
      WHERE id = ? AND (sender_id = ? OR recipient_id = ?)
    `;

    const [result] = await pool.execute(query, [messageId, userId, userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Message not found or unauthorized' });
    }

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// GET /api/messages/unread/count - Get unread message count
router.get('/unread/count', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const query = `
      SELECT COUNT(*) as count
      FROM messages 
      WHERE recipient_id = ? AND is_read = 0
    `;

    const [result] = await pool.execute(query, [userId]);

    res.json({
      success: true,
      unread_count: result[0].count
    });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

module.exports = router; 