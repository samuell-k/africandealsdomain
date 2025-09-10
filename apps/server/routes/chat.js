const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

// GET chat history for an order
router.get('/:orderId', authenticateToken, async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.user.id;

        // Security check: ensure user has access to this order's chat
        const [order] = await pool.query(
            'SELECT user_id, agent_id, seller_id FROM orders WHERE id = ?',
            [orderId]
        );

        if (order.length === 0) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }

        const orderInfo = order[0];
        let canAccess = req.user.role === 'admin' ||
                          (req.user.role === 'buyer' && orderInfo.user_id === userId) ||
                          (req.user.role === 'seller' && orderInfo.seller_id === userId);

        // Special check for agent, comparing agents.id with orders.agent_id
        if (req.user.role === 'agent') {
            const [agent] = await pool.query('SELECT id FROM agents WHERE user_id = ?', [userId]);
            if (agent.length > 0 && agent[0].id === orderInfo.agent_id) {
                canAccess = true;
            }
        }
        if (!canAccess) {
            return res.status(403).json({ success: false, error: 'Access denied to this chat' });
        }

        const [messages] = await pool.query(
            `SELECT 
                cm.id, 
                cm.sender_id as senderId, 
                u.name as senderName, 
                cm.message, 
                cm.created_at as timestamp
             FROM chat_messages cm
             JOIN users u ON cm.sender_id = u.id
             WHERE cm.order_id = ?
             ORDER BY cm.created_at ASC`,
            [orderId]
        );

        res.json({ success: true, messages });

    } catch (error) {
        console.error('Error fetching chat history:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// POST a new message to an order chat
router.post('/:orderId', authenticateToken, async (req, res) => {
    try {
        const { orderId } = req.params;
        const { message } = req.body;
        const senderId = req.user.id;

        if (!message) {
            return res.status(400).json({ success: false, error: 'Message content is required' });
        }

        // Security check: ensure user has access to this order's chat
        const [order] = await pool.query(
            'SELECT user_id, agent_id, seller_id FROM orders WHERE id = ?',
            [orderId]
        );

        if (order.length === 0) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }

        const orderInfo = order[0];
        let canAccess = req.user.role === 'admin' ||
                          (req.user.role === 'buyer' && orderInfo.user_id === senderId) ||
                          (req.user.role === 'seller' && orderInfo.seller_id === senderId);

        // Special check for agent, comparing agents.id with orders.agent_id
        if (req.user.role === 'agent') {
            const [agent] = await pool.query('SELECT id FROM agents WHERE user_id = ?', [senderId]);
            if (agent.length > 0 && agent[0].id === orderInfo.agent_id) {
                canAccess = true;
            }
        }
        if (!canAccess) {
            return res.status(403).json({ success: false, error: 'Access denied to this chat' });
        }

        // Determine recipient
        let recipientId = null;
        if (req.user.role === 'buyer') {
            recipientId = orderInfo.agent_id || orderInfo.seller_id;
        } else if (req.user.role === 'agent') {
            recipientId = orderInfo.user_id;
        } else if (req.user.role === 'seller') {
            recipientId = orderInfo.user_id;
        }

        // Insert message into DB
        const [result] = await pool.query(
            'INSERT INTO chat_messages (order_id, sender_id, recipient_id, message) VALUES (?, ?, ?, ?)',
            [orderId, senderId, recipientId, message]
        );

        const newMessage = {
            id: result.insertId,
            orderId: parseInt(orderId),
            senderId: senderId,
            senderName: req.user.name,
            message: message,
            timestamp: new Date().toISOString()
        };

        // Emit message via Socket.IO to the order room
        const io = req.app.get('io');
        if (io) {
            io.to(`order_${orderId}`).emit('chat:new_message', newMessage);
        }

        res.status(201).json({ success: true, message: 'Message sent', data: newMessage });

    } catch (error) {
        console.error('Error sending chat message:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

module.exports = router;