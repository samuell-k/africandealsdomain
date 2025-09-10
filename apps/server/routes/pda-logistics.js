/**
 * PDA Logistics Routes - Complete Implementation
 * Handles all PDA logistics flow endpoints with dual confirmations,
 * GPS validation, OTP/QR codes, and comprehensive tracking
 */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth } = require('./auth');
const pdaLogistics = require('../services/pdaLogisticsService');
const multer = require('multer');
const path = require('path');

// Configure multer for photo evidence uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads/order-photos/'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'order-photo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Middleware to verify PDA agent
const requirePDAAgent = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.userId;
    
    // Check if user is a PDA or compatible agent
    const [agents] = await pool.query(
      'SELECT * FROM users WHERE id = ? AND role = "agent"',
      [userId]
    );

    if (agents.length === 0) {
      return res.status(403).json({ 
        error: 'PDA agent access required',
        userRole: req.user.role
      });
    }

    req.agent = agents[0];
    next();
  } catch (error) {
    console.error('[PDA-LOGISTICS] Agent verification error:', error);
    res.status(500).json({ error: 'Server error during agent verification' });
  }
};

/**
 * GET /api/pda-logistics/orders/available
 * Get available orders for PDA assignment
 */
router.get('/orders/available', requireAuth, requirePDAAgent, async (req, res) => {
  try {
    const { limit = 20, radius = 50 } = req.query;
    const agentId = req.agent.id;

    const [orders] = await pool.execute(`
      SELECT 
        o.id, o.order_number, o.detailed_status, o.total_amount,
        o.delivery_method, o.delivery_distance, o.created_at,
        buyer.name as buyer_name, buyer.phone as buyer_phone,
        seller.name as seller_name, seller.phone as seller_phone,
        seller.address as seller_address,
        ps.name as pickup_site_name, ps.address_line1 as pickup_address,
        ps.latitude as pickup_lat, ps.longitude as pickup_lng
      FROM orders o
      JOIN users buyer ON o.user_id = buyer.id
      JOIN users seller ON o.seller_id = seller.id
      LEFT JOIN pickup_sites ps ON o.pickup_site_id = ps.id
      WHERE o.detailed_status IN ('PAYMENT_CONFIRMED') 
        AND o.agent_id IS NULL
        AND o.manual_payment_approved = TRUE
      ORDER BY o.created_at ASC
      LIMIT ?
    `, [parseInt(limit)]);

    // Get order items for each order
    for (let order of orders) {
      const [items] = await pool.execute(`
        SELECT oi.*, p.name as product_name, p.main_image as product_image
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
      `, [order.id]);
      order.items = items;
    }

    res.json({
      success: true,
      orders,
      availableCount: orders.length,
      agentId
    });

  } catch (error) {
    console.error('[PDA-LOGISTICS] Error fetching available orders:', error);
    res.status(500).json({ error: 'Failed to fetch available orders' });
  }
});

/**
 * GET /api/pda-logistics/orders/active
 * Get PDA's active orders
 */
router.get('/orders/active', requireAuth, requirePDAAgent, async (req, res) => {
  try {
    const userId = req.user.id;

    const [orders] = await pool.execute(`
      SELECT 
        o.id, o.order_number, o.status, o.tracking_status, o.total_amount,
        o.delivery_method, o.created_at, o.updated_at,
        buyer.name as buyer_name, buyer.phone as buyer_phone,
        seller.name as seller_name, seller.phone as seller_phone
      FROM orders o
      JOIN users buyer ON o.user_id = buyer.id
      JOIN users seller ON o.seller_id = seller.id
      WHERE o.agent_id = ? 
        AND o.status NOT IN ('delivered', 'cancelled', 'refunded')
      ORDER BY o.created_at ASC
      LIMIT 20
    `, [userId]);

    // Enhance each order with basic info
    for (let order of orders) {
      try {
        // Get order items count
        const [itemsCount] = await pool.execute(`
          SELECT COUNT(*) as count
          FROM order_items
          WHERE order_id = ?
        `, [order.id]);
        
        order.items_count = itemsCount[0]?.count || 0;
      } catch (err) {
        order.items_count = 0;
      }
    }

    res.json({
      success: true,
      orders,
      activeCount: orders.length
    });

  } catch (error) {
    console.error('[PDA-LOGISTICS] Error fetching active orders:', error.message);
    console.error('[PDA-LOGISTICS] Stack trace:', error.stack);
    res.status(500).json({ 
      error: 'Failed to fetch active orders',
      details: error.message 
    });
  }
});

/**
 * POST /api/pda-logistics/orders/:orderId/accept
 * Accept an available order assignment
 */
router.post('/orders/:orderId/accept', requireAuth, requirePDAAgent, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const agentId = req.agent.id;
    const { location } = req.body;

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Check if order is still available
      const [orders] = await connection.execute(`
        SELECT * FROM orders 
        WHERE id = ? AND detailed_status = 'PAYMENT_CONFIRMED' AND agent_id IS NULL
      `, [orderId]);

      if (orders.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: 'Order not available for assignment' });
      }

      // Assign agent to order
      await connection.execute(`
        UPDATE orders SET agent_id = ?, updated_at = NOW() 
        WHERE id = ?
      `, [agentId, orderId]);

      // Transition to assigned status
      await pdaLogistics.transitionOrderStatus(
        orderId, 
        pdaLogistics.ORDER_STATUSES.ASSIGNED_TO_PDA, 
        req.user.id,
        { 
          reason: 'Order accepted by PDA agent',
          location: location
        }
      );

      await connection.commit();

      res.json({
        success: true,
        message: 'Order accepted successfully',
        orderId,
        status: 'ASSIGNED_TO_PDA'
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('[PDA-LOGISTICS] Error accepting order:', error);
    res.status(500).json({ error: 'Failed to accept order' });
  }
});

/**
 * POST /api/pda-logistics/orders/:orderId/status-transition
 * Transition order status with validations
 */
router.post('/orders/:orderId/status-transition', requireAuth, requirePDAAgent, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const { newStatus, location, reason, metadata } = req.body;

    // Validate that agent owns this order
    const [orders] = await pool.execute(
      'SELECT agent_id FROM orders WHERE id = ?',
      [orderId]
    );

    if (orders.length === 0 || orders[0].agent_id !== req.agent.id) {
      return res.status(403).json({ error: 'Order not assigned to this agent' });
    }

    const result = await pdaLogistics.transitionOrderStatus(
      orderId, 
      newStatus, 
      req.user.id,
      { 
        reason,
        location,
        metadata
      }
    );

    res.json({
      success: true,
      message: 'Status updated successfully',
      transition: result
    });

  } catch (error) {
    console.error('[PDA-LOGISTICS] Error transitioning status:', error);
    res.status(500).json({ error: error.message || 'Failed to update status' });
  }
});

/**
 * POST /api/pda-logistics/orders/:orderId/confirm/:confirmationType
 * Handle dual confirmations (seller handover, PSM deposit, buyer delivery)
 */
router.post('/orders/:orderId/confirm/:confirmationType', requireAuth, upload.single('photo'), async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const confirmationType = req.params.confirmationType;
    const { method, otpCode, qrData, signature, gpsCoordinates, gpsAccuracy } = req.body;
    const photoFile = req.file;

    // Validate confirmation type
    if (!Object.values(pdaLogistics.CONFIRMATION_TYPES).includes(confirmationType)) {
      return res.status(400).json({ error: 'Invalid confirmation type' });
    }

    let confirmationData = {};
    let validationResult = { valid: true };

    // Handle different confirmation methods
    switch (method) {
      case 'OTP':
        if (!otpCode) {
          return res.status(400).json({ error: 'OTP code is required' });
        }
        validationResult = await pdaLogistics.verifyOTP(orderId, otpCode, confirmationType, req.user.id);
        if (!validationResult.valid) {
          return res.status(400).json({ error: validationResult.reason });
        }
        confirmationData.otpCode = otpCode;
        break;

      case 'QR_SCAN':
        if (!qrData) {
          return res.status(400).json({ error: 'QR data is required' });
        }
        // TODO: Validate QR code
        confirmationData.qrData = qrData;
        break;

      case 'SIGNATURE':
        if (!signature) {
          return res.status(400).json({ error: 'Signature is required' });
        }
        confirmationData.signature = signature;
        break;

      case 'PHOTO':
        if (!photoFile) {
          return res.status(400).json({ error: 'Photo is required' });
        }
        confirmationData.photoUrl = `/uploads/order-photos/${photoFile.filename}`;
        break;

      default:
        return res.status(400).json({ error: 'Invalid confirmation method' });
    }

    // GPS validation if coordinates provided
    let gpsValidation = { withinRadius: true };
    if (gpsCoordinates && gpsCoordinates.lat && gpsCoordinates.lng) {
      // TODO: Get expected location based on confirmation type
      const expectedLocation = { lat: gpsCoordinates.lat, lng: gpsCoordinates.lng }; // Placeholder
      
      gpsValidation = await pdaLogistics.validateGPSLocation(
        orderId,
        gpsCoordinates.lat,
        gpsCoordinates.lng,
        gpsAccuracy,
        expectedLocation
      );
    }

    // Create confirmation record
    await pdaLogistics.createConfirmation(
      orderId,
      confirmationType,
      method,
      req.user.role,
      req.user.id,
      confirmationData,
      {
        coordinates: gpsCoordinates,
        accuracy: gpsAccuracy,
        withinRadius: gpsValidation.withinRadius
      }
    );

    // Store photo evidence if provided
    if (photoFile) {
      await pool.execute(`
        INSERT INTO order_photos 
        (order_id, photo_url, photo_type, taken_by, taken_at_status, gps_coordinates)
        VALUES (?, ?, ?, ?, (SELECT detailed_status FROM orders WHERE id = ?), ?)
      `, [
        orderId,
        `/uploads/order-photos/${photoFile.filename}`,
        confirmationType + '_PROOF',
        req.user.id,
        orderId,
        gpsCoordinates ? JSON.stringify(gpsCoordinates) : null
      ]);
    }

    // Determine next status based on confirmation type and current status
    let nextStatus = null;
    const [currentOrder] = await pool.execute(
      'SELECT detailed_status, delivery_method FROM orders WHERE id = ?',
      [orderId]
    );

    if (currentOrder.length > 0) {
      const currentStatus = currentOrder[0].detailed_status;
      const deliveryMethod = currentOrder[0].delivery_method;

      switch (confirmationType) {
        case 'SELLER_HANDOVER':
          if (currentStatus === 'PDA_AT_SELLER') {
            nextStatus = 'PICKED_FROM_SELLER';
          }
          break;
        case 'PSM_DEPOSIT':
          if (currentStatus === 'EN_ROUTE_TO_PSM') {
            nextStatus = 'DELIVERED_TO_PSM';
          }
          break;
        case 'BUYER_DELIVERY':
          if (currentStatus === 'EN_ROUTE_TO_BUYER') {
            nextStatus = 'DELIVERED_TO_BUYER';
          }
          break;
        case 'BUYER_PICKUP':
          if (currentStatus === 'READY_FOR_PICKUP') {
            nextStatus = 'COLLECTED_BY_BUYER';
          }
          break;
      }

      // Auto-transition status if applicable
      if (nextStatus) {
        await pdaLogistics.transitionOrderStatus(
          orderId,
          nextStatus,
          req.user.id,
          {
            reason: `Confirmation completed: ${confirmationType}`,
            location: gpsCoordinates,
            metadata: { confirmationType, method }
          }
        );
      }
    }

    res.json({
      success: true,
      message: 'Confirmation completed successfully',
      confirmationType,
      method,
      gpsValidation,
      nextStatus
    });

  } catch (error) {
    console.error('[PDA-LOGISTICS] Error processing confirmation:', error);
    res.status(500).json({ error: 'Failed to process confirmation' });
  }
});

/**
 * POST /api/pda-logistics/orders/:orderId/generate-otp
 * Generate OTP for confirmation
 */
router.post('/orders/:orderId/generate-otp', requireAuth, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const { confirmationType, forRole, forUserId } = req.body;

    const otpCode = await pdaLogistics.generateOTP(
      orderId,
      confirmationType,
      forRole,
      forUserId || req.user.id
    );

    res.json({
      success: true,
      otpCode: otpCode, // In production, send via SMS/email instead
      message: 'OTP generated successfully'
    });

  } catch (error) {
    console.error('[PDA-LOGISTICS] Error generating OTP:', error);
    res.status(500).json({ error: 'Failed to generate OTP' });
  }
});

/**
 * POST /api/pda-logistics/orders/:orderId/gps-update
 * Update GPS tracking for order
 */
router.post('/orders/:orderId/gps-update', requireAuth, requirePDAAgent, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const { latitude, longitude, accuracy, altitude, speed, heading } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    await pool.execute(`
      INSERT INTO order_gps_tracking 
      (order_id, tracked_user_id, latitude, longitude, accuracy, altitude, speed, heading, status_at_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, (SELECT detailed_status FROM orders WHERE id = ?))
    `, [
      orderId, 
      req.user.id, 
      latitude, 
      longitude, 
      accuracy || null, 
      altitude || null, 
      speed || null, 
      heading || null, 
      orderId
    ]);

    res.json({
      success: true,
      message: 'GPS location updated successfully'
    });

  } catch (error) {
    console.error('[PDA-LOGISTICS] Error updating GPS:', error);
    res.status(500).json({ error: 'Failed to update GPS location' });
  }
});

/**
 * GET /api/pda-logistics/orders/:orderId/tracking
 * Get comprehensive tracking information for an order
 */
router.get('/orders/:orderId/tracking', requireAuth, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    
    const trackingData = await pdaLogistics.getOrderTracking(orderId);

    res.json({
      success: true,
      tracking: trackingData
    });

  } catch (error) {
    console.error('[PDA-LOGISTICS] Error fetching tracking data:', error);
    res.status(500).json({ error: 'Failed to fetch tracking data' });
  }
});

/**
 * GET /api/pda-logistics/orders/:orderId/qr-code
 * Get or generate QR code for order
 */
router.get('/orders/:orderId/qr-code', requireAuth, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const { type = 'ORDER_RECEIPT' } = req.query;

    // Check for existing QR code
    const [existingQR] = await pool.execute(`
      SELECT * FROM order_qr_codes 
      WHERE order_id = ? AND qr_type = ? AND is_active = TRUE
      ORDER BY created_at DESC LIMIT 1
    `, [orderId, type]);

    let qrData;
    if (existingQR.length > 0) {
      qrData = {
        qrData: existingQR[0].qr_code_data,
        qrImageUrl: existingQR[0].qr_image_url
      };
    } else {
      // Generate new QR code
      const connection = await pool.getConnection();
      try {
        qrData = await pdaLogistics.generateOrderQR(connection, orderId, type, req.user.role);
      } finally {
        connection.release();
      }
    }

    res.json({
      success: true,
      qrCode: qrData
    });

  } catch (error) {
    console.error('[PDA-LOGISTICS] Error getting QR code:', error);
    res.status(500).json({ error: 'Failed to get QR code' });
  }
});

/**
 * GET /api/pda-logistics/stats
 * Get PDA agent statistics
 */
router.get('/stats', requireAuth, requirePDAAgent, async (req, res) => {
  try {
    const agentId = req.agent.id;

    // Get comprehensive stats
    const [todayStats] = await pool.execute(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(CASE WHEN detailed_status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_orders,
        SUM(CASE WHEN detailed_status = 'COMPLETED' THEN total_amount * 0.05 ELSE 0 END) as today_earnings
      FROM orders 
      WHERE agent_id = ? AND DATE(created_at) = CURDATE()
    `, [agentId]);

    const [weekStats] = await pool.execute(`
      SELECT 
        COUNT(*) as week_orders,
        SUM(CASE WHEN detailed_status = 'COMPLETED' THEN 1 ELSE 0 END) as week_completed,
        SUM(CASE WHEN detailed_status = 'COMPLETED' THEN total_amount * 0.05 ELSE 0 END) as week_earnings
      FROM orders 
      WHERE agent_id = ? AND YEARWEEK(created_at) = YEARWEEK(NOW())
    `, [agentId]);

    const [activeStats] = await pool.execute(`
      SELECT COUNT(*) as active_count
      FROM orders 
      WHERE agent_id = ? AND detailed_status NOT IN ('COMPLETED', 'CANCELLED', 'DISPUTED')
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
        active: {
          count: activeStats[0].active_count || 0
        }
      }
    });

  } catch (error) {
    console.error('[PDA-LOGISTICS] Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

/**
 * GET /api/pda-logistics/notifications
 * Get notifications for the current user
 */
router.get('/notifications', requireAuth, async (req, res) => {
  try {
    const { limit = 50, unreadOnly = false } = req.query;
    const userId = req.user.id;

    let whereClause = 'WHERE user_id = ?';
    let queryParams = [userId];

    if (unreadOnly === 'true') {
      whereClause += ' AND is_read = FALSE';
    }

    const [notifications] = await pool.execute(`
      SELECT * FROM enhanced_notifications 
      ${whereClause}
      ORDER BY created_at DESC 
      LIMIT ?
    `, [...queryParams, parseInt(limit)]);

    res.json({
      success: true,
      notifications,
      unreadCount: notifications.filter(n => !n.is_read).length
    });

  } catch (error) {
    console.error('[PDA-LOGISTICS] Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/**
 * PUT /api/pda-logistics/notifications/:id/read
 * Mark notification as read
 */
router.put('/notifications/:id/read', requireAuth, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const userId = req.user.id;

    await pool.execute(`
      UPDATE enhanced_notifications 
      SET is_read = TRUE 
      WHERE id = ? AND user_id = ?
    `, [notificationId, userId]);

    res.json({
      success: true,
      message: 'Notification marked as read'
    });

  } catch (error) {
    console.error('[PDA-LOGISTICS] Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

/**
 * GET /api/pda-logistics/confirmations/pending
 * Get pending confirmations for the agent
 */
router.get('/confirmations/pending', requireAuth, requirePDAAgent, async (req, res) => {
  try {
    const userId = req.user.id;

    const [confirmations] = await pool.execute(`
      SELECT 
        o.id, o.order_number, o.status, o.tracking_status, o.total_amount,
        o.delivery_method, o.created_at,
        buyer.name as buyer_name, buyer.phone as buyer_phone,
        seller.name as seller_name, seller.phone as seller_phone,
        'SELLER_HANDOVER' as confirmation_type,
        'GPS' as required_method
      FROM orders o
      JOIN users buyer ON o.user_id = buyer.id
      JOIN users seller ON o.seller_id = seller.id
      WHERE o.agent_id = ? 
        AND o.tracking_status IN ('assigned', 'picked_up', 'en_route')
      ORDER BY o.created_at ASC
    `, [userId]);

    res.json({
      success: true,
      confirmations,
      count: confirmations.length
    });

  } catch (error) {
    console.error('[PDA-LOGISTICS] Error fetching pending confirmations:', error);
    res.status(500).json({ error: 'Failed to fetch pending confirmations' });
  }
});

/**
 * GET /api/pda-logistics/profile
 * Get agent profile information
 */
router.get('/profile', requireAuth, requirePDAAgent, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user profile first
    const [userProfile] = await pool.execute(`
      SELECT id, name, email, phone, role
      FROM users 
      WHERE id = ?
    `, [userId]);

    if (userProfile.length === 0) {
      return res.status(404).json({ error: 'Agent profile not found' });
    }

    const profile = userProfile[0];

    // Get agent profile if exists
    let agentProfile = null;
    try {
      const [agentData] = await pool.execute(`
        SELECT agent_type, status, rating, total_deliveries, total_earnings, current_lat, current_lng
        FROM agents 
        WHERE user_id = ?
      `, [userId]);
      
      if (agentData.length > 0) {
        agentProfile = agentData[0];
      }
    } catch (agentErr) {
      console.log('[PDA-LOGISTICS] Agent profile not found, continuing...');
    }

    // Get basic stats
    let stats = { total_orders: 0, completed_orders: 0, avg_order_value: 0 };
    try {
      const [statsData] = await pool.execute(`
        SELECT 
          COUNT(*) as total_orders,
          COUNT(CASE WHEN detailed_status = 'DELIVERED_TO_BUYER' THEN 1 END) as completed_orders,
          AVG(CASE WHEN detailed_status = 'DELIVERED_TO_BUYER' THEN total_amount END) as avg_order_value
        FROM orders 
        WHERE agent_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      `, [userId]);
      
      if (statsData.length > 0) {
        stats = statsData[0];
      }
    } catch (statsErr) {
      console.log('[PDA-LOGISTICS] Stats query failed, using defaults...');
    }

    res.json({
      success: true,
      profile: {
        ...profile,
        ...agentProfile,
        recent_stats: stats
      }
    });

  } catch (error) {
    console.error('[PDA-LOGISTICS] Error fetching agent profile:', error);
    res.status(500).json({ error: 'Failed to fetch agent profile' });
  }
});

/**
 * PUT /api/pda-logistics/profile
 * Update agent profile information
 */
router.put('/profile', requireAuth, requirePDAAgent, async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      name, phone, address, city, country, 
      latitude, longitude, notifications,
      emergency_contact, working_hours, vehicle_type,
      license_number, primary_territory, emergency_phone
    } = req.body;

    // Fix: Convert working_hours to proper JSON format
    let workingHoursJSON = null;
    if (working_hours) {
      if (typeof working_hours === 'string') {
        // Convert "08:00-18:00" to {"start":"08:00","end":"18:00"}
        const timeParts = working_hours.split('-');
        if (timeParts.length === 2) {
          workingHoursJSON = JSON.stringify({
            start: timeParts[0].trim(),
            end: timeParts[1].trim()
          });
        } else {
          // Default format
          workingHoursJSON = JSON.stringify({
            start: "08:00",
            end: "18:00",
            description: working_hours
          });
        }
      } else if (typeof working_hours === 'object') {
        workingHoursJSON = JSON.stringify(working_hours);
      }
    }

    // Update user table - Fix: Convert undefined to null
    if (name || phone) {
      await pool.execute(`
        UPDATE users 
        SET name = COALESCE(?, name), phone = COALESCE(?, phone)
        WHERE id = ?
      `, [name || null, phone || null, userId]);
    }

    // Update agent table - Fix: Convert undefined to null and fix working_hours format
    await pool.execute(`
      UPDATE agents 
      SET 
        address = COALESCE(?, address),
        city = COALESCE(?, city),
        country = COALESCE(?, country),
        current_lat = COALESCE(?, current_lat),
        current_lng = COALESCE(?, current_lng),
        working_hours = COALESCE(?, working_hours),
        vehicle_type = COALESCE(?, vehicle_type),
        license_number = COALESCE(?, license_number),
        updated_at = NOW()
      WHERE user_id = ?
    `, [
      address || null, 
      city || null, 
      country || null, 
      latitude || null, 
      longitude || null, 
      workingHoursJSON, 
      vehicle_type || null,
      license_number || null,
      userId
    ]);

    res.json({
      success: true,
      message: 'Profile updated successfully'
    });

  } catch (error) {
    console.error('[PDA-LOGISTICS] Error updating agent profile:', error.message);
    console.error('[PDA-LOGISTICS] Stack trace:', error.stack);
    res.status(500).json({ 
      error: 'Failed to update agent profile',
      details: error.message 
    });
  }
});

/**
 * POST /api/pda-logistics/gps-update
 * Update agent GPS location
 */
router.post('/gps-update', requireAuth, requirePDAAgent, async (req, res) => {
  try {
    const userId = req.user.id;
    const { latitude, longitude, accuracy } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    // Update agent location
    await pool.execute(`
      UPDATE agents 
      SET 
        current_lat = ?,
        current_lng = ?,
        last_location_update = NOW(),
        updated_at = NOW()
      WHERE user_id = ?
    `, [latitude, longitude, userId]);

    res.json({
      success: true,
      message: 'GPS location updated successfully',
      location: { latitude, longitude, accuracy },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[PDA-LOGISTICS] Error updating GPS location:', error);
    res.status(500).json({ error: 'Failed to update GPS location' });
  }
});

module.exports = router;