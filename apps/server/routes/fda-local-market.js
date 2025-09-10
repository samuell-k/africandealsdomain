/**
 * FDA LOCAL MARKET CONFIRMATION SYSTEM
 * 
 * Handles Fast Delivery Agent (FDA) confirmations for local market deliveries:
 * 1. FDA ↔ Seller confirmation (to release seller money after delivery)
 * 2. FDA ↔ Buyer confirmation (to release agent commission)
 * 
 * Verification Methods:
 * - OTP/PIN codes
 * - QR code scanning
 * - Photo proof with signatures
 */

const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Database connection
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'add_physical_product',
  port: process.env.DB_PORT || 3333,
});

// Configure multer for photo uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'fda-confirmations');
    try {
      await fs.access(uploadDir);
    } catch {
      await fs.mkdir(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `fda-confirmation-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Authentication middleware
const authenticateAgent = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    // Verify token and check if user is an agent
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const userId = decoded.id || decoded.userId;
    const [agents] = await db.execute(
      'SELECT * FROM agents WHERE user_id = ? AND status = "active"',
      [userId]
    );
    
    if (agents.length === 0) {
      return res.status(403).json({ success: false, error: 'Not authorized as agent' });
    }
    
    req.userId = userId;
    req.agentInfo = agents[0];
    next();
  } catch (error) {
    console.error('Agent authentication failed:', error);
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
};

/**
 * GENERATE SELLER PICKUP CODE
 * Creates a unique OTP code for seller verification
 */
router.post('/generate-seller-pickup-code/:orderId', authenticateAgent, async (req, res) => {
  try {
    const { orderId } = req.params;
    const agentId = req.agentInfo.id; // use agents.id consistently
    
    console.log(`[FDA-SELLER] 🔐 Generating pickup code for order ${orderId} by agent ${agentId}`);
    
    // Verify order assignment
    const [orders] = await db.execute(`
      SELECT o.*, u.name as buyer_name, u.phone as buyer_phone,
             s.name as seller_name, s.phone as seller_phone, s.address as seller_address
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN users s ON o.seller_id = s.id
      WHERE o.id = ? AND o.agent_id = ? AND o.delivery_method = 'home'
    `, [orderId, agentId]);
    
    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found or not assigned to this agent'
      });
    }
    
    const order = orders[0];
    
    // Check if order is in correct status
    if (!['ASSIGNED_TO_FDA', 'FDA_EN_ROUTE_TO_SELLER'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        error: `Order status ${order.status} not valid for seller pickup code generation`
      });
    }
    
    // Generate unique 6-digit pickup code
    const pickupCode = Math.random().toString().slice(2, 8);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    
    // Store pickup code
    await db.execute(`
      INSERT INTO fda_confirmation_codes (order_id, agent_id, code_type, code_value, expires_at, status)
      VALUES (?, ?, 'seller_pickup', ?, ?, 'active')
      ON DUPLICATE KEY UPDATE 
        code_value = VALUES(code_value),
        expires_at = VALUES(expires_at),
        status = VALUES(status),
        created_at = NOW()
    `, [orderId, agentId, pickupCode, expiresAt]);
    
    // Update order status
    await db.execute(
      'UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?',
      ['FDA_AT_SELLER', orderId]
    );
    
    console.log(`[FDA-SELLER] ✅ Pickup code ${pickupCode} generated for order ${orderId}`);
    
    res.json({
      success: true,
      pickupCode: pickupCode,
      expiresAt: expiresAt,
      message: 'Pickup code generated. Seller should enter this code to confirm handover.',
      order: {
        id: order.id,
        order_number: order.order_number,
        seller_name: order.seller_name,
        seller_phone: order.seller_phone,
        total_amount: order.total_amount
      }
    });
    
  } catch (error) {
    console.error('Error generating seller pickup code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate pickup code'
    });
  }
});

/**
 * VERIFY SELLER PICKUP CODE
 * FDA enters seller's confirmation code
 */
router.post('/verify-seller-pickup/:orderId', authenticateAgent, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { pickupCode, sellerConfirmation, photoProof } = req.body;
    const agentId = req.agentInfo.id; // use agents.id consistently
    
    console.log(`[FDA-SELLER] 📋 Verifying seller pickup for order ${orderId}`);
    
    // Verify the pickup code
    const [codes] = await db.execute(`
      SELECT * FROM fda_confirmation_codes
      WHERE order_id = ? AND agent_id = ? AND code_type = 'seller_pickup' 
        AND code_value = ? AND status = 'active' AND expires_at > NOW()
    `, [orderId, agentId, pickupCode]);
    
    if (codes.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired pickup code'
      });
    }
    
    // Get order details
    const [orders] = await db.execute(`
      SELECT o.*, u.name as buyer_name, s.name as seller_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id  
      LEFT JOIN users s ON o.seller_id = s.id
      WHERE o.id = ? AND o.agent_id = ?
    `, [orderId, agentId]);
    
    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    const order = orders[0];
    
    // Start transaction for seller handover confirmation
    await db.beginTransaction();
    
    try {
      // Mark pickup code as used
      await db.execute(
        'UPDATE fda_confirmation_codes SET status = ?, used_at = NOW() WHERE id = ?',
        ['used', codes[0].id]
      );
      
      // Record seller handover confirmation
      await db.execute(`
        INSERT INTO order_confirmations 
        (order_id, confirmation_type, confirmed_by_user_id, confirmation_method, confirmation_data, notes)
        VALUES (?, 'seller_handover', ?, 'otp', ?, ?)
      `, [
        orderId,
        agentId,
        JSON.stringify({ 
          pickup_code: pickupCode,
          location: req.body.location || null,
          timestamp: new Date().toISOString()
        }),
        sellerConfirmation || 'Package collected from seller via OTP verification'
      ]);
      
      // Update order fields (route seller payout to admin approval)
      await db.execute(`
        UPDATE orders SET 
          status = 'PICKED_FROM_SELLER',
          fda_seller_pickup_at = NOW(),
          fda_seller_pickup_code = ?,
          fda_seller_pickup_notes = ?,
          seller_payout_status = 'awaiting_admin_approval',
          updated_at = NOW()
        WHERE id = ?
      `, [pickupCode, sellerConfirmation, orderId]);

      // Create admin approval request for seller payout
      const sellerPayoutAmount = order.total_amount ? order.total_amount * 0.85 : null;
      await db.execute(`
        INSERT INTO admin_approvals (approval_type, order_id, requested_by, status, amount, created_at)
        VALUES ('SELLER_PAYOUT', ?, ?, 'pending', ?, NOW())
      `, [orderId, req.userId, sellerPayoutAmount]);
      
      await db.commit();
      
      console.log(`[FDA-SELLER] ✅ Seller handover confirmed for order ${orderId}`);
      
      res.json({
        success: true,
        message: 'Seller handover confirmed successfully! Payout sent for admin approval.',
        order: {
          id: order.id,
          order_number: order.order_number,
          status: 'PICKED_FROM_SELLER',
          seller_payout_status: 'awaiting_admin_approval',
          next_action: 'Proceed to buyer delivery'
        }
      });
      
      // Send notification to admin
      console.log(`[ADMIN-NOTIFICATION] Seller handover confirmed for Order #${order.order_number} - payout awaiting admin approval`);
      
    } catch (error) {
      await db.rollback();
      throw error;
    }
    
  } catch (error) {
    console.error('Error verifying seller pickup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify seller pickup'
    });
  }
});

/**
 * GENERATE BUYER DELIVERY CODE  
 * Creates delivery confirmation code for buyer
 */
router.post('/generate-buyer-delivery-code/:orderId', authenticateAgent, async (req, res) => {
  try {
    const { orderId } = req.params;
    const agentId = req.agentInfo.id; // use agents.id consistently
    
    console.log(`[FDA-BUYER] 🔐 Generating delivery code for order ${orderId}`);
    
    // Verify order is ready for delivery
    const [orders] = await db.execute(`
      SELECT o.*, u.name as buyer_name, u.phone as buyer_phone, u.address as buyer_address
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.id = ? AND o.agent_id = ? AND o.status = 'PICKED_FROM_SELLER'
    `, [orderId, agentId]);
    
    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found or not ready for delivery'
      });
    }
    
    const order = orders[0];
    
    // Generate delivery code
    const deliveryCode = Math.random().toString().slice(2, 8);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    
    // Store delivery code
    await db.execute(`
      INSERT INTO fda_confirmation_codes (order_id, agent_id, code_type, code_value, expires_at, status)
      VALUES (?, ?, 'buyer_delivery', ?, ?, 'active')
      ON DUPLICATE KEY UPDATE 
        code_value = VALUES(code_value),
        expires_at = VALUES(expires_at),
        status = VALUES(status),
        created_at = NOW()
    `, [orderId, agentId, deliveryCode, expiresAt]);
    
    // Update order status
    await db.execute(
      'UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?',
      ['FDA_EN_ROUTE_TO_BUYER', orderId]
    );
    
    console.log(`[FDA-BUYER] ✅ Delivery code ${deliveryCode} generated for order ${orderId}`);
    
    res.json({
      success: true,
      deliveryCode: deliveryCode,
      expiresAt: expiresAt,
      message: 'Delivery code generated. Show this to buyer for confirmation.',
      order: {
        id: order.id,
        order_number: order.order_number,
        buyer_name: order.buyer_name,
        buyer_phone: order.buyer_phone,
        buyer_address: order.buyer_address,
        total_amount: order.total_amount
      }
    });
    
  } catch (error) {
    console.error('Error generating delivery code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate delivery code'
    });
  }
});

/**
 * CONFIRM BUYER DELIVERY
 * FDA confirms successful delivery to buyer
 */
router.post('/confirm-buyer-delivery/:orderId', authenticateAgent, upload.single('deliveryPhoto'), async (req, res) => {
  try {
    const { orderId } = req.params;
    const { deliveryCode, buyerConfirmation, buyerSignature } = req.body;
    const agentId = req.agentInfo.id; // use agents.id consistently
    const photoPath = req.file ? req.file.filename : null;
    
    console.log(`[FDA-BUYER] 📦 Confirming delivery for order ${orderId}`);
    
    // Verify delivery code
    const [codes] = await db.execute(`
      SELECT * FROM fda_confirmation_codes
      WHERE order_id = ? AND agent_id = ? AND code_type = 'buyer_delivery'
        AND code_value = ? AND status = 'active' AND expires_at > NOW()
    `, [orderId, agentId, deliveryCode]);
    
    if (codes.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired delivery code'
      });
    }
    
    // Get order details
    const [orders] = await db.execute(`
      SELECT o.*, u.name as buyer_name, s.name as seller_name,
             a.commission_rate, o.total_amount
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN users s ON o.seller_id = s.id  
      LEFT JOIN agents a ON o.agent_id = a.id
      WHERE o.id = ? AND o.agent_id = ?
    `, [orderId, agentId]);
    
    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    const order = orders[0];
    const sellerPayoutAmount = order.total_amount * 0.85; // 85% to seller
    const agentCommission = order.total_amount * (order.commission_rate / 100 || 0.15); // Agent commission
    
    // Start transaction for delivery confirmation  
    await db.beginTransaction();
    
    try {
      // Mark delivery code as used
      await db.execute(
        'UPDATE fda_confirmation_codes SET status = ?, used_at = NOW() WHERE id = ?',
        ['used', codes[0].id]
      );
      
      // Record delivery confirmation
      await db.execute(`
        INSERT INTO order_confirmations 
        (order_id, confirmation_type, confirmed_by_user_id, confirmation_method, confirmation_data, notes)
        VALUES (?, 'buyer_delivery', ?, ?, ?, ?)
      `, [
        orderId,
        agentId,
        photoPath ? 'photo' : 'otp',
        JSON.stringify({
          delivery_code: deliveryCode,
          photo: photoPath,
          signature: buyerSignature,
          location: req.body.location || null,
          timestamp: new Date().toISOString()
        }),
        buyerConfirmation || 'Package delivered to buyer successfully'
      ]);
      
      // Update order with delivery confirmation and route payouts for admin approval
      await db.execute(`
        UPDATE orders SET 
          status = 'DELIVERED',
          fda_buyer_delivery_at = NOW(),
          fda_buyer_delivery_code = ?,
          fda_buyer_delivery_notes = ?,
          fda_delivery_photo = ?,
          
          -- ROUTE SELLER PAYOUT FOR ADMIN APPROVAL
          seller_payout_status = 'awaiting_admin_approval',
          seller_payout_amount = ?,
          seller_payout_release_reason = 'Local delivery completed - awaiting admin approval',
          
          -- ROUTE AGENT COMMISSION FOR ADMIN APPROVAL
          fda_commission_status = 'awaiting_admin_approval',
          fda_commission_amount = ?,
          
          -- MARK ORDER COMPLETE (business rule: completion after admin approval can also be enforced)
          updated_at = NOW()
        WHERE id = ?
      `, [
        deliveryCode,
        buyerConfirmation,
        photoPath,
        sellerPayoutAmount,
        agentCommission,
        orderId
      ]);

      // Create admin approval requests for seller payout and FDA commission
      await db.execute(`
        INSERT INTO admin_approvals (approval_type, order_id, requested_by, status, amount, created_at)
        VALUES ('SELLER_PAYOUT', ?, ?, 'pending', ?, NOW())
      `, [orderId, req.userId, sellerPayoutAmount]);

      await db.execute(`
        INSERT INTO admin_approvals (approval_type, order_id, requested_by, status, amount, created_at)
        VALUES ('FDA_COMMISSION', ?, ?, 'pending', ?, NOW())
      `, [orderId, req.userId, agentCommission]);
      
      await db.commit();
      
      console.log(`[FDA-BUYER] ✅ Delivery confirmed for order ${orderId}`);
      console.log(`[PAYOUT] ⏳ Seller payout and FDA commission sent for admin approval`);
      
      res.json({
        success: true,
        message: 'Delivery confirmed! Payouts are pending admin approval.',
        order: {
          id: order.id,
          order_number: order.order_number,
          status: 'DELIVERED',
          completed_at: null,
          seller_payout_status: 'awaiting_admin_approval',
          fda_commission_status: 'awaiting_admin_approval'
        },
        payouts: {
          seller_amount: sellerPayoutAmount,
          agent_commission: agentCommission,
          release_time: new Date().toISOString()
        }
      });
      
      // Send notifications
      console.log(`[BUYER-NOTIFICATION] Order marked as delivered for ${order.buyer_name}`);
      console.log(`[ADMIN-NOTIFICATION] Local Market delivery completed for Order #${order.order_number}`);
      
    } catch (error) {
      await db.rollback();
      throw error;
    }
    
  } catch (error) {
    console.error('Error confirming buyer delivery:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to confirm delivery'
    });
  }
});

/**
 * GET FDA ORDERS - Orders for Fast Delivery Agent
 */
router.get('/orders', authenticateAgent, async (req, res) => {
  try {
    const agentId = req.agentInfo.id; // use agents.id consistently
    const { status } = req.query;
    
    let statusFilter = '';
    if (status) {
      statusFilter = 'AND o.status = ?';
    }
    
    const queryParams = status ? [agentId, status] : [agentId];
    
    const [orders] = await db.execute(`
      SELECT 
        o.*,
        u.name as buyer_name,
        u.phone as buyer_phone,
        u.address as buyer_address,
        s.name as seller_name,
        s.phone as seller_phone,
        s.address as seller_address,
        -- FDA CONFIRMATION FIELDS
        o.fda_seller_pickup_at,
        o.fda_seller_pickup_code,
        o.fda_buyer_delivery_at,
        o.fda_buyer_delivery_code,
        o.seller_payout_status,
        o.fda_commission_status,
        -- ORDER ITEMS
        GROUP_CONCAT(
          CONCAT(oi.product_name, ' (x', oi.quantity, ')')
          SEPARATOR ', '
        ) as items_summary
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN users s ON o.seller_id = s.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.agent_id = ? AND o.delivery_method = 'home' ${statusFilter}
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `, queryParams);
    
    res.json({
      success: true,
      orders: orders,
      count: orders.length
    });
    
  } catch (error) {
    console.error('Error fetching FDA orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders'
    });
  }
});

/**
 * GET QR CODE FOR SELLER/BUYER VERIFICATION
 */
router.get('/qr-code/:orderId/:type', authenticateAgent, async (req, res) => {
  try {
    const { orderId, type } = req.params; // type: 'seller' or 'buyer'
    const agentId = req.agentInfo.id; // use agents.id consistently
    
    // Generate QR code data
    const qrData = {
      orderId: orderId,
      agentId: agentId,
      type: type,
      timestamp: Date.now(),
      signature: crypto.createHash('sha256')
        .update(`${orderId}-${agentId}-${type}-${process.env.JWT_SECRET}`)
        .digest('hex').slice(0, 16)
    };
    
    res.json({
      success: true,
      qrData: JSON.stringify(qrData),
      message: `QR code generated for ${type} verification`
    });
    
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate QR code'
    });
  }
});

module.exports = router;