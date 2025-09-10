/**
 * Pickup Delivery Agent Routes - Complete Implementation
 * Handles all functionality for Pickup Transfer Agents (Physical Products)
 */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const { requireAuth, requireRole } = require('../middleware/auth');

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname))
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Middleware to verify JWT token with enhanced logging
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production', (err, user) => {
    if (err) return res.status(401).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// Verify PDA middleware (trimmed but consistent)
const verifyPickupDeliveryAgent = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.userId;
    const [userInfo] = await pool.query('SELECT id, role, agent_type, name, email, phone FROM users WHERE id = ?', [userId]);
    if (userInfo.length === 0) return res.status(404).json({ error: 'User not found' });

    const validRoles = ['agent', 'admin', 'pickup_delivery_agent', 'pickup_site_manager'];
    if (!validRoles.includes(userInfo[0].role)) {
      return res.status(403).json({ error: 'Agent access required' });
    }

    const [agentRecords] = await pool.query(
      'SELECT * FROM agents WHERE user_id = ? AND agent_type IN ("pickup_delivery", "pickup_delivery_agent", "pickup_site_manager")',
      [userId]
    );

    let agentRecord = agentRecords[0];
    if (!agentRecord) {
      const agentType = userInfo[0].agent_type || (userInfo[0].role === 'pickup_site_manager' ? 'pickup_site_manager' : 'pickup_delivery');
      const [insertResult] = await pool.query(
        'INSERT INTO agents (user_id, agent_type, status, admin_approval_status, created_at) VALUES (?, ?, "active", "approved", NOW())',
        [userId, agentType]
      );
      agentRecord = { id: insertResult.insertId, user_id: userId, agent_type: agentType, status: 'active', admin_approval_status: 'approved' };
    }

    req.agent = {
      id: agentRecord.id,
      user_id: userId,
      agent_type: agentRecord.agent_type,
      status: agentRecord.status,
      admin_approval_status: agentRecord.admin_approval_status || 'approved',
      name: userInfo[0].name,
      email: userInfo[0].email,
      phone: userInfo[0].phone,
    };
    next();
  } catch (e) {
    console.error('[PDA] Agent verification error:', e);
    res.status(500).json({ error: 'Server error during agent verification' });
  }
};

// Require PDA (simplified check)
const requirePickupDeliveryAgent = async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const userId = req.user.id || req.user.userId;
    const [agents] = await pool.query(
      'SELECT * FROM agents WHERE user_id = ? AND agent_type IN ("pickup_delivery", "fast_delivery", "pickup_site_manager")',
      [userId]
    );
    if (agents.length === 0) return res.status(403).json({ error: 'Pickup delivery agent access required' });
    req.agent = agents.find(a => a.agent_type === 'pickup_delivery') || agents[0];
    next();
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Utility: distance
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) ** 2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

// STATS
router.get('/stats', authenticateToken, verifyPickupDeliveryAgent, async (req, res) => {
  try {
    const agentId = req.agent.id;
    const [todayStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(CASE WHEN status IN ('COMPLETED', 'COLLECTED_BY_BUYER') THEN 1 ELSE 0 END) as completed_orders,
        SUM(CASE WHEN status IN ('COMPLETED', 'COLLECTED_BY_BUYER') THEN 
          CASE 
            WHEN agent_commission > 0 THEN agent_commission
            ELSE (total_amount - (total_amount / 1.21)) * 0.70
          END
        ELSE 0 END) as today_earnings
      FROM orders 
      WHERE agent_id = ? AND DATE(created_at) = CURDATE() AND marketplace_type = 'physical'
    `, [agentId]);

    const [activeStats] = await pool.query(`
      SELECT COUNT(*) as active_count
      FROM orders 
      WHERE agent_id = ? AND status IN ('ASSIGNED_TO_PDA', 'PDA_EN_ROUTE_TO_SELLER', 'PDA_AT_SELLER', 'PICKED_FROM_SELLER', 'EN_ROUTE_TO_PSM', 'DELIVERED_TO_PSM', 'READY_FOR_PICKUP')
    `, [agentId]);

    const [weekStats] = await pool.query(`
      SELECT 
        COUNT(*) as week_orders,
        SUM(CASE WHEN status IN ('COMPLETED', 'COLLECTED_BY_BUYER') THEN 1 ELSE 0 END) as week_completed,
        SUM(CASE WHEN status IN ('COMPLETED', 'COLLECTED_BY_BUYER') THEN 
          CASE 
            WHEN agent_commission > 0 THEN agent_commission
            ELSE (total_amount - (total_amount / 1.21)) * 0.70
          END
        ELSE 0 END) as week_earnings
      FROM orders 
      WHERE agent_id = ? AND YEARWEEK(created_at) = YEARWEEK(NOW()) AND marketplace_type = 'physical'
    `, [agentId]);

    const [ratingStats] = await pool.query(`
      SELECT AVG(rating) as average_rating, COUNT(*) as total_ratings
      FROM agent_ratings 
      WHERE agent_id = ?
    `, [agentId]);

    res.json({
      success: true,
      stats: {
        today: {
          total: todayStats[0].total_orders || 0,
          completed: todayStats[0].completed_orders || 0,
          earnings: parseFloat(todayStats[0].today_earnings || 0)
        },
        week: {
          total: weekStats[0].week_orders || 0,
          completed: weekStats[0].week_completed || 0,
          earnings: parseFloat(weekStats[0].week_earnings || 0)
        },
        active: { count: activeStats[0].active_count || 0 },
        rating: {
          average: parseFloat(ratingStats[0]?.average_rating || 0),
          total: ratingStats[0]?.total_ratings || 0
        }
      }
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// AVAILABLE ORDERS (kept as-is but trimmed for brevity)
router.get('/available-orders', authenticateToken, verifyPickupDeliveryAgent, async (req, res) => {
  try {
    const agentId = req.agent.id;
    const [orders] = await pool.query(`SELECT * FROM orders WHERE status = 'CONFIRMED' AND marketplace_type = 'physical' ORDER BY created_at DESC LIMIT 50`);
    res.json({ success: true, orders });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch available orders' });
  }
});

// UPDATE LOCATION (kept simplified)
router.post('/update-location', authenticateToken, verifyPickupDeliveryAgent, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { latitude, longitude, accuracy } = req.body;
    const locationData = { lat: latitude, lng: longitude, accuracy: accuracy || null };
    await pool.query(
      `UPDATE agents SET current_location = ?, last_location_update = NOW() WHERE user_id = ? AND (agent_type = 'pickup_delivery_agent' OR agent_type = 'pickup_delivery')`,
      [JSON.stringify(locationData), userId]
    );
    res.json({ success: true, message: 'Location updated successfully', location: locationData });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// SEND MESSAGE (kept as-is)
router.post('/send-message', authenticateToken, verifyPickupDeliveryAgent, async (req, res) => {
  try {
    const { order_id, recipient_type, message, message_type = 'text' } = req.body;
    const senderId = req.user.userId || req.user.id;
    if (!['buyer', 'seller'].includes(recipient_type)) return res.status(400).json({ error: 'Invalid recipient type. Must be buyer or seller' });

    const [orders] = await pool.query('SELECT user_id as buyer_id, seller_id FROM orders WHERE id = ?', [order_id]);
    if (orders.length === 0) return res.status(404).json({ error: 'Order not found' });
    const order = orders[0];

    let recipientId = recipient_type === 'buyer' ? order.buyer_id : order.seller_id;
    if (!recipientId && recipient_type === 'seller') {
      const [items] = await pool.query('SELECT p.seller_id FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ? LIMIT 1', [order_id]);
      if (items.length > 0 && items[0].seller_id) recipientId = items[0].seller_id;
    }
    if (!recipientId) return res.status(400).json({ error: `${recipient_type} information not found for this order` });

    await pool.query('INSERT INTO messages (sender_id, recipient_id, subject, content, order_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())', [senderId, recipientId, `Order #${order_id} - Agent Message`, message, order_id]);

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${recipientId}`).emit('new_message', {
        sender_id: senderId,
        sender_type: 'agent',
        message,
        message_type,
        order_id,
        timestamp: new Date().toISOString()
      });
    }

    res.json({ success: true, message: 'Message sent successfully' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// ACCEPT ORDER (CONFIRMED → ASSIGNED)
router.post('/orders/:id/accept', authenticateToken, requirePickupDeliveryAgent, async (req, res) => {
  try {
    const orderId = req.params.id;
    const agentId = req.user.id || req.user.userId;
    const { notes } = req.body;

    const [orders] = await pool.execute('SELECT id, status, seller_id, buyer_id, total_amount FROM orders WHERE id = ? AND status = "CONFIRMED"', [orderId]);
    if (orders.length === 0) return res.status(404).json({ success: false, error: 'Order not found or not available for pickup' });

    await pool.execute('UPDATE orders SET status = "ASSIGNED", agent_id = ?, agent_assigned_at = NOW(), updated_at = NOW() WHERE id = ?', [agentId, orderId]);
    await pool.execute('UPDATE agents SET status = "busy", updated_at = NOW() WHERE user_id = ?', [agentId]);
    await pool.execute('INSERT INTO order_status_logs (order_id, old_status, new_status, changed_by, notes, created_at) VALUES (?, "CONFIRMED", "ASSIGNED", ?, ?, NOW())', [orderId, agentId, notes || 'Order accepted by PDA agent']);

    const order = orders[0];
    await pool.execute('INSERT INTO notifications (user_id, title, message, type, order_id, created_at) VALUES (?, "Order Assigned to Agent", "Your order has been assigned to a pickup delivery agent", "order_update", ?, NOW())', [order.seller_id, orderId]);
    await pool.execute('INSERT INTO notifications (user_id, title, message, type, order_id, created_at) VALUES (?, "Order In Transit", "Your order has been picked up and is on the way to you", "order_update", ?, NOW())', [order.buyer_id, orderId]);

    res.json({ success: true, message: 'Order accepted successfully', order: { id: orderId, status: 'ASSIGNED', agent_id: agentId } });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Failed to accept order' });
  }
});

// GET ACTIVE ORDERS
router.get('/active-orders', authenticateToken, verifyPickupDeliveryAgent, async (req, res) => {
  try {
    const agentId = req.agent.id;
    const [orders] = await pool.query(`
      SELECT o.*, 
             u.name as buyer_name, u.email as buyer_email, u.phone as buyer_phone,
             GROUP_CONCAT(CONCAT(COALESCE(p.name, 'Unknown Product'), ' (', oi.quantity, ')') SEPARATOR ', ') as items_summary
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE o.agent_id = ? 
        AND o.status IN ('ASSIGNED_TO_PDA', 'PDA_EN_ROUTE_TO_SELLER', 'PDA_AT_SELLER', 'PICKED_FROM_SELLER', 'EN_ROUTE_TO_PSM', 'DELIVERED_TO_PSM', 'READY_FOR_PICKUP')
        AND o.marketplace_type = 'physical'
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `, [agentId]);

    res.json({ success: true, orders });
  } catch (e) {
    console.error('[PDA] Active orders error:', e);
    res.status(500).json({ error: 'Failed to fetch active orders' });
  }
});

// GET ORDER HISTORY
router.get('/order-history', authenticateToken, verifyPickupDeliveryAgent, async (req, res) => {
  try {
    const agentId = req.agent.id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const [orders] = await pool.query(`
      SELECT o.*, 
             u.name as buyer_name, u.email as buyer_email, u.phone as buyer_phone,
             GROUP_CONCAT(CONCAT(COALESCE(p.name, 'Unknown Product'), ' (', oi.quantity, ')') SEPARATOR ', ') as items_summary
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE o.agent_id = ? 
        AND o.status IN ('COMPLETED', 'COLLECTED_BY_BUYER', 'CANCELLED')
        AND o.marketplace_type = 'physical'
      GROUP BY o.id
      ORDER BY o.updated_at DESC
      LIMIT ? OFFSET ?
    `, [agentId, parseInt(limit), parseInt(offset)]);

    const [countResult] = await pool.query(`
      SELECT COUNT(*) as total
      FROM orders 
      WHERE agent_id = ? 
        AND status IN ('COMPLETED', 'COLLECTED_BY_BUYER', 'CANCELLED')
        AND marketplace_type = 'physical'
    `, [agentId]);

    res.json({ 
      success: true, 
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / limit)
      }
    });
  } catch (e) {
    console.error('[PDA] Order history error:', e);
    res.status(500).json({ error: 'Failed to fetch order history' });
  }
});

// UPDATE ORDER STATUS
router.post('/orders/:id/update-status', authenticateToken, verifyPickupDeliveryAgent, async (req, res) => {
  try {
    const orderId = req.params.id;
    const agentId = req.agent.id;
    const { status, notes, location } = req.body;

    // Validate status
    const validStatuses = [
      'ASSIGNED_TO_PDA', 'PDA_EN_ROUTE_TO_SELLER', 'PDA_AT_SELLER', 
      'PICKED_FROM_SELLER', 'EN_ROUTE_TO_PSM', 'DELIVERED_TO_PSM', 
      'READY_FOR_PICKUP', 'COLLECTED_BY_BUYER', 'COMPLETED'
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    // Get current order
    const [orders] = await pool.execute('SELECT * FROM orders WHERE id = ? AND agent_id = ?', [orderId, agentId]);
    if (orders.length === 0) {
      return res.status(404).json({ success: false, error: 'Order not found or not assigned to you' });
    }

    const currentOrder = orders[0];
    
    // Update order status
    await pool.execute('UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?', [status, orderId]);
    
    // Log status change
    await pool.execute(
      'INSERT INTO order_status_logs (order_id, old_status, new_status, changed_by, notes, location_data, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
      [orderId, currentOrder.status, status, req.user.id || req.user.userId, notes || '', location ? JSON.stringify(location) : null]
    );

    // Send notifications based on status
    const statusNotifications = {
      'PDA_EN_ROUTE_TO_SELLER': 'Agent is on the way to collect your order',
      'PDA_AT_SELLER': 'Agent has arrived at the seller location',
      'PICKED_FROM_SELLER': 'Your order has been collected from the seller',
      'EN_ROUTE_TO_PSM': 'Your order is on the way to the pickup site',
      'DELIVERED_TO_PSM': 'Your order has been delivered to the pickup site',
      'READY_FOR_PICKUP': 'Your order is ready for pickup',
      'COLLECTED_BY_BUYER': 'Order has been collected by the buyer',
      'COMPLETED': 'Order has been completed successfully'
    };

    if (statusNotifications[status]) {
      await pool.execute(
        'INSERT INTO notifications (user_id, title, message, type, order_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [currentOrder.user_id, 'Order Status Update', statusNotifications[status], 'order_update', orderId]
      );
    }

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${currentOrder.user_id}`).emit('order_status_update', {
        order_id: orderId,
        status: status,
        message: statusNotifications[status] || 'Order status updated',
        timestamp: new Date().toISOString()
      });
    }

    res.json({ success: true, message: 'Order status updated successfully', order: { id: orderId, status } });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to update order status' });
  }
});

// GET AGENT PROFILE
router.get('/profile', authenticateToken, verifyPickupDeliveryAgent, async (req, res) => {
  try {
    const agent = req.agent;
    
    // Get additional stats with correct commission calculation
    const [monthlyStats] = await pool.query(`
      SELECT 
        COUNT(*) as monthly_orders,
        SUM(CASE WHEN status IN ('COMPLETED', 'COLLECTED_BY_BUYER') THEN 1 ELSE 0 END) as monthly_completed,
        SUM(CASE WHEN status IN ('COMPLETED', 'COLLECTED_BY_BUYER') THEN 
          CASE 
            WHEN agent_commission > 0 THEN agent_commission
            ELSE (total_amount - (total_amount / 1.21)) * 0.70
          END
        ELSE 0 END) as monthly_earnings
      FROM orders 
      WHERE agent_id = ? AND MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW()) AND marketplace_type = 'physical'
    `, [agent.id]);

    const [ratingStats] = await pool.query(`
      SELECT AVG(rating) as average_rating, COUNT(*) as total_ratings
      FROM agent_ratings 
      WHERE agent_id = ?
    `, [agent.id]);

    res.json({
      success: true,
      profile: {
        ...agent,
        monthly_stats: monthlyStats[0],
        rating_stats: ratingStats[0]
      }
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch agent profile' });
  }
});

// UPLOAD DELIVERY PROOF
router.post('/orders/:id/upload-proof', authenticateToken, verifyPickupDeliveryAgent, upload.single('proof_image'), async (req, res) => {
  try {
    const orderId = req.params.id;
    const agentId = req.agent.id;
    const { notes } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Proof image is required' });
    }

    // Verify order belongs to agent
    const [orders] = await pool.execute('SELECT * FROM orders WHERE id = ? AND agent_id = ?', [orderId, agentId]);
    if (orders.length === 0) {
      return res.status(404).json({ success: false, error: 'Order not found or not assigned to you' });
    }

    const proofImagePath = req.file.path;
    
    // Update order with proof
    await pool.execute(
      'UPDATE orders SET delivery_proof_image = ?, delivery_proof_notes = ?, updated_at = NOW() WHERE id = ?',
      [proofImagePath, notes || '', orderId]
    );

    // Log the proof upload
    await pool.execute(
      'INSERT INTO order_status_logs (order_id, old_status, new_status, changed_by, notes, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [orderId, orders[0].status, orders[0].status, req.user.id || req.user.userId, `Delivery proof uploaded: ${notes || ''}`]
    );

    res.json({ 
      success: true, 
      message: 'Delivery proof uploaded successfully',
      proof_image: proofImagePath
    });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to upload delivery proof' });
  }
});

// GET EARNINGS SUMMARY
router.get('/earnings', authenticateToken, verifyPickupDeliveryAgent, async (req, res) => {
  try {
    const agentId = req.agent.id;
    
    // Get total earnings using correct commission calculation (70% of platform profit)
    const [totalEarnings] = await pool.query(`
      SELECT 
        SUM(CASE WHEN status IN ('COMPLETED', 'COLLECTED_BY_BUYER') THEN 
          CASE 
            WHEN agent_commission > 0 THEN agent_commission
            ELSE (total_amount - (total_amount / 1.21)) * 0.70
          END
        ELSE 0 END) as total_earned,
        SUM(CASE WHEN status IN ('COMPLETED', 'COLLECTED_BY_BUYER') AND DATE(updated_at) = CURDATE() THEN 
          CASE 
            WHEN agent_commission > 0 THEN agent_commission
            ELSE (total_amount - (total_amount / 1.21)) * 0.70
          END
        ELSE 0 END) as today_earned,
        SUM(CASE WHEN status IN ('COMPLETED', 'COLLECTED_BY_BUYER') AND YEARWEEK(updated_at) = YEARWEEK(NOW()) THEN 
          CASE 
            WHEN agent_commission > 0 THEN agent_commission
            ELSE (total_amount - (total_amount / 1.21)) * 0.70
          END
        ELSE 0 END) as week_earned,
        SUM(CASE WHEN status IN ('COMPLETED', 'COLLECTED_BY_BUYER') AND MONTH(updated_at) = MONTH(NOW()) AND YEAR(updated_at) = YEAR(NOW()) THEN 
          CASE 
            WHEN agent_commission > 0 THEN agent_commission
            ELSE (total_amount - (total_amount / 1.21)) * 0.70
          END
        ELSE 0 END) as month_earned
      FROM orders 
      WHERE agent_id = ? AND marketplace_type = 'physical'
    `, [agentId]);

    // Get withdrawn amount
    const [withdrawnAmount] = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as total_withdrawn,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending_withdrawal
      FROM agent_withdrawals 
      WHERE agent_id = ?
    `, [agentId]);

    // Calculate available balance
    const totalEarned = parseFloat(totalEarnings[0].total_earned || 0);
    const totalWithdrawn = parseFloat(withdrawnAmount[0].total_withdrawn || 0);
    const pendingWithdrawal = parseFloat(withdrawnAmount[0].pending_withdrawal || 0);
    const availableBalance = totalEarned - totalWithdrawn - pendingWithdrawal;

    res.json({
      success: true,
      earnings: {
        total_earned: totalEarned,
        today_earned: parseFloat(totalEarnings[0].today_earned || 0),
        week_earned: parseFloat(totalEarnings[0].week_earned || 0),
        month_earned: parseFloat(totalEarnings[0].month_earned || 0),
        total_withdrawn: totalWithdrawn,
        pending_withdrawal: pendingWithdrawal,
        available_balance: Math.max(0, availableBalance)
      }
    });
  } catch (e) {
    console.error('[PDA] Earnings error:', e);
    res.status(500).json({ error: 'Failed to fetch earnings' });
  }
});

// COMPLETE ORDER WITH COMMISSION CALCULATION
router.post('/orders/:id/complete', authenticateToken, verifyPickupDeliveryAgent, async (req, res) => {
  try {
    const orderId = req.params.id;
    const agentId = req.agent.id;
    const { completion_notes, completion_photo } = req.body;

    // Get order details
    const [orders] = await pool.query(`
      SELECT id, status, total_amount, agent_commission, marketplace_type, user_id
      FROM orders 
      WHERE id = ? AND agent_id = ? AND status IN ('READY_FOR_PICKUP', 'DELIVERED_TO_PSM')
    `, [orderId, agentId]);

    if (orders.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Order not found or not ready for completion' 
      });
    }

    const order = orders[0];
    
    // Calculate commission if not already set
    let finalCommission = order.agent_commission;
    if (!finalCommission || finalCommission <= 0) {
      const purchasingPrice = order.total_amount / 1.21; // Remove 21% markup
      const platformProfit = order.total_amount - purchasingPrice;
      finalCommission = Math.round(platformProfit * 0.70 * 100) / 100; // 70% of platform profit
    }

    // Update order status to completed
    await pool.execute(`
      UPDATE orders 
      SET status = 'COMPLETED', 
          agent_commission = ?,
          completion_notes = ?,
          completion_photo = ?,
          completed_at = NOW(),
          updated_at = NOW()
      WHERE id = ?
    `, [finalCommission, completion_notes, completion_photo, orderId]);

    // Create commission transaction record
    await pool.execute(`
      INSERT INTO commission_transactions 
      (order_id, agent_id, commission_type, amount, percentage, base_amount, status, created_at)
      VALUES (?, ?, 'pickup_delivery', ?, 70.00, ?, 'pending', NOW())
    `, [
      orderId, 
      agentId, 
      finalCommission, 
      order.total_amount - (order.total_amount / 1.21)
    ]);

    // Add status log
    await pool.execute(`
      INSERT INTO order_status_logs 
      (order_id, old_status, new_status, changed_by, notes, created_at)
      VALUES (?, ?, 'COMPLETED', ?, ?, NOW())
    `, [orderId, order.status, agentId, completion_notes || 'Order completed by PDA']);

    // Send notification to buyer
    await pool.execute(`
      INSERT INTO notifications 
      (user_id, title, message, type, order_id, created_at)
      VALUES (?, 'Order Completed', 'Your order has been successfully completed and is ready for pickup', 'order_update', ?, NOW())
    `, [order.user_id, orderId]);

    // Update agent status to available
    await pool.execute(`
      UPDATE agents SET status = 'available', updated_at = NOW() WHERE id = ?
    `, [agentId]);

    res.json({
      success: true,
      message: 'Order completed successfully',
      order: {
        id: orderId,
        status: 'COMPLETED',
        commission_earned: finalCommission
      }
    });

  } catch (error) {
    console.error('[PDA] Complete order error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to complete order' 
    });
  }
});

// GET COMMISSION DETAILS
router.get('/commissions', authenticateToken, verifyPickupDeliveryAgent, async (req, res) => {
  try {
    const agentId = req.agent.id;
    const { page = 1, limit = 20, status = 'all' } = req.query;
    const offset = (page - 1) * limit;

    let statusFilter = '';
    let queryParams = [agentId];
    
    if (status !== 'all') {
      statusFilter = 'AND ct.status = ?';
      queryParams.push(status);
    }

    const [commissions] = await pool.query(`
      SELECT 
        ct.*,
        o.id as order_number,
        o.total_amount as order_total,
        o.status as order_status,
        o.created_at as order_date,
        u.name as buyer_name
      FROM commission_transactions ct
      LEFT JOIN orders o ON ct.order_id = o.id
      LEFT JOIN users u ON o.user_id = u.id
      WHERE ct.agent_id = ? ${statusFilter}
      ORDER BY ct.created_at DESC
      LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), parseInt(offset)]);

    const [countResult] = await pool.query(`
      SELECT COUNT(*) as total 
      FROM commission_transactions ct
      WHERE ct.agent_id = ? ${statusFilter}
    `, queryParams);

    // Calculate summary
    const [summary] = await pool.query(`
      SELECT 
        COUNT(*) as total_transactions,
        SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_amount,
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as paid_amount,
        SUM(amount) as total_amount
      FROM commission_transactions
      WHERE agent_id = ?
    `, [agentId]);

    res.json({
      success: true,
      commissions,
      summary: summary[0],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / limit)
      }
    });

  } catch (error) {
    console.error('[PDA] Commissions error:', error);
    res.status(500).json({ error: 'Failed to fetch commission details' });
  }
});

// GET WITHDRAWAL HISTORY
router.get('/withdrawals', authenticateToken, verifyPickupDeliveryAgent, async (req, res) => {
  try {
    const agentId = req.agent.id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const [withdrawals] = await pool.query(`
      SELECT * FROM agent_withdrawals 
      WHERE agent_id = ? 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `, [agentId, parseInt(limit), parseInt(offset)]);

    const [countResult] = await pool.query(`
      SELECT COUNT(*) as total FROM agent_withdrawals WHERE agent_id = ?
    `, [agentId]);

    res.json({
      success: true,
      withdrawals,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / limit)
      }
    });
  } catch (e) {
    console.error('[PDA] Withdrawals error:', e);
    res.status(500).json({ error: 'Failed to fetch withdrawal history' });
  }
});

// REQUEST WITHDRAWAL
router.post('/withdraw', authenticateToken, verifyPickupDeliveryAgent, async (req, res) => {
  try {
    const agentId = req.agent.id;
    const userId = req.user.id || req.user.userId;
    const { amount, payment_method, payment_details, notes } = req.body;

    console.log('[PDA] Withdrawal request data:', { agentId, userId, amount, payment_method, payment_details, notes });

    // Enhanced validation
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid withdrawal amount. Amount must be a positive number.' 
      });
    }

    if (amount < 1000) {
      return res.status(400).json({ 
        success: false,
        error: 'Minimum withdrawal amount is 1,000 FRW' 
      });
    }

    if (!payment_method) {
      return res.status(400).json({ 
        success: false,
        error: 'Payment method is required' 
      });
    }

    if (!payment_details || typeof payment_details !== 'object') {
      return res.status(400).json({ 
        success: false,
        error: 'Payment details are required and must be valid' 
      });
    }

    // Validate payment details based on method
    if (payment_method === 'momo') {
      if (!payment_details.network || !payment_details.phone) {
        return res.status(400).json({ 
          success: false,
          error: 'Mobile money network and phone number are required' 
        });
      }
    } else if (payment_method === 'bank') {
      if (!payment_details.bank_name || !payment_details.account_number || !payment_details.account_holder) {
        return res.status(400).json({ 
          success: false,
          error: 'Bank name, account number, and account holder name are required' 
        });
      }
    }

    // Check available balance using correct commission calculation
    const [totalEarnings] = await pool.query(`
      SELECT SUM(CASE WHEN status IN ('COMPLETED', 'COLLECTED_BY_BUYER') THEN 
        CASE 
          WHEN agent_commission > 0 THEN agent_commission
          ELSE (total_amount - (total_amount / 1.21)) * 0.70
        END
      ELSE 0 END) as total_earned
      FROM orders WHERE agent_id = ? AND marketplace_type = 'physical'
    `, [agentId]);

    const [withdrawnAmount] = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as total_withdrawn,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending_withdrawal
      FROM agent_withdrawals WHERE agent_id = ?
    `, [agentId]);

    const totalEarned = parseFloat(totalEarnings[0].total_earned || 0);
    const totalWithdrawn = parseFloat(withdrawnAmount[0].total_withdrawn || 0);
    const pendingWithdrawal = parseFloat(withdrawnAmount[0].pending_withdrawal || 0);
    const availableBalance = totalEarned - totalWithdrawn - pendingWithdrawal;

    if (amount > availableBalance) {
      return res.status(400).json({ 
        success: false,
        error: 'Insufficient balance', 
        available_balance: Math.round(availableBalance * 100) / 100,
        requested_amount: amount
      });
    }

    // Get agent details for notification
    const [agentDetails] = await pool.query(`
      SELECT a.*, u.name, u.email, u.phone 
      FROM agents a 
      JOIN users u ON a.user_id = u.id 
      WHERE a.id = ?
    `, [agentId]);

    if (agentDetails.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Agent not found' 
      });
    }

    const agent = agentDetails[0];

    // Create withdrawal request
    const [result] = await pool.execute(`
      INSERT INTO agent_withdrawals (agent_id, user_id, amount, payment_method, payment_details, notes, status, created_at) 
      VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())
    `, [agentId, userId, amount, payment_method, JSON.stringify(payment_details), notes || '']);

    const withdrawalId = result.insertId;

    // Create detailed notification for admin
    const notificationMessage = `New withdrawal request from ${agent.name} (PDA)
Amount: ${amount.toLocaleString()} FRW
Payment Method: ${payment_method.toUpperCase()}
Available Balance: ${availableBalance.toLocaleString()} FRW
Agent Phone: ${agent.phone}
${notes ? `Notes: ${notes}` : ''}`;

    await pool.execute(`
      INSERT INTO admin_notifications (type, title, message, data, created_at) 
      VALUES ('withdrawal_request', 'New PDA Withdrawal Request', ?, ?, NOW())
    `, [
      notificationMessage,
      JSON.stringify({ 
        withdrawal_id: withdrawalId, 
        agent_id: agentId, 
        user_id: userId, 
        agent_name: agent.name,
        agent_phone: agent.phone,
        amount: amount,
        payment_method: payment_method,
        payment_details: payment_details,
        available_balance: availableBalance,
        agent_type: 'PDA'
      })
    ]);

    // Log the withdrawal request
    console.log(`[PDA] Withdrawal request created: ID ${withdrawalId}, Agent: ${agent.name}, Amount: ${amount} FRW`);

    res.json({
      success: true,
      message: 'Withdrawal request submitted successfully and sent to admin for approval',
      withdrawal_id: withdrawalId,
      status: 'pending',
      estimated_processing_time: '1-3 business days'
    });

  } catch (e) {
    console.error('[PDA] Withdrawal request error:', e);
    res.status(500).json({ 
      success: false,
      error: 'Failed to process withdrawal request. Please try again later.',
      details: process.env.NODE_ENV === 'development' ? e.message : undefined
    });
  }
});

module.exports = router;
