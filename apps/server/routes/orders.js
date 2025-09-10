const express = require('express');
const router = express.Router();
const { requireAuth } = require('./auth');
const pool = require('../db');
const { sendTemplatedEmail } = require('../utils/mailer');
const CommissionService = require('../services/commissionService');
const multer = require('multer');
const path = require('path');

// Configure multer for payment proof uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads/payment-proofs/'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'payment-proof-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only image and PDF files are allowed!'), false);
    }
  }
});

// GET /api/orders - Get all orders for a user
router.get('/', requireAuth, async (req, res) => {
  try {
    const [orders] = await pool.query(`
      SELECT 
        o.id,
        o.order_number,
        o.total_amount,
        o.status,
        o.payment_status,
        o.tracking_status,
        o.agent_id,
        o.delivery_code,
        o.created_at,
        o.updated_at,
        o.shipping_address,
        o.billing_address,
        o.payment_method,
        o.payment_proof,
        o.tracking_number,
        o.estimated_delivery,
        o.delivered_at,
        o.pickup_location,
        o.delivery_location,
        -- PSM CONFIRMATION FIELDS
        o.psm_deposit_at,
        o.psm_agent_id,
        o.buyer_pickup_at,
        o.buyer_pickup_code,
        o.seller_payout_status,
        o.seller_payout_released_at,
        o.pda_commission_status,
        o.pda_commission_released_at,
        o.psm_commission_status,
        o.psm_commission_released_at,
        o.completed_at,
        -- AGENT INFORMATION
        u_agent.name as agent_name,
        a.phone as agent_phone,
        a.status as agent_status,
        -- PSM AGENT INFORMATION
        u_psm.name as psm_agent_name,
        a_psm.phone as psm_agent_phone,
        -- PICKUP SITE INFORMATION
        ps.name as pickup_site_name,
        ps.address as pickup_site_address,
        ps.phone as pickup_site_phone,
        ps.latitude as pickup_site_lat,
        ps.longitude as pickup_site_lng,
        -- ORDER ITEMS COUNT
        COUNT(oi.id) as item_count
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN agents a ON o.agent_id = a.user_id
      LEFT JOIN users u_agent ON a.user_id = u_agent.id
      LEFT JOIN agents a_psm ON o.psm_agent_id = a_psm.user_id
      LEFT JOIN users u_psm ON a_psm.user_id = u_psm.id
      LEFT JOIN pickup_sites ps ON o.pickup_site_id = ps.id
      WHERE o.user_id = ?
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `, [req.user.id]);

    // Parse JSON fields with error handling
    const processedOrders = orders.map(order => {
      let pickup_location = null;
      let delivery_location = null;
      let shipping_address = null;
      let billing_address = null;

      try {
        pickup_location = order.pickup_location ? JSON.parse(order.pickup_location) : null;
      } catch (e) {
        console.warn(`Failed to parse pickup_location for order ${order.id}:`, e);
      }

      try {
        delivery_location = order.delivery_location ? JSON.parse(order.delivery_location) : null;
      } catch (e) {
        console.warn(`Failed to parse delivery_location for order ${order.id}:`, e);
      }

      try {
        shipping_address = order.shipping_address ? JSON.parse(order.shipping_address) : null;
      } catch (e) {
        console.warn(`Failed to parse shipping_address for order ${order.id}:`, e);
      }

      try {
        billing_address = order.billing_address ? JSON.parse(order.billing_address) : null;
      } catch (e) {
        console.warn(`Failed to parse billing_address for order ${order.id}:`, e);
      }

      return {
        ...order,
        pickup_location,
        delivery_location,
        shipping_address,
        billing_address,
        agent: order.agent_id ? {
          name: order.agent_name || '',
          phone: order.agent_phone,
          status: order.agent_status
        } : null
      };
    });

    res.json({ success: true, orders: processedOrders });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// GET /api/orders/:id - Get specific order details
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const orderId = req.params.id;
    
    console.log('🔍 [ORDER-DETAIL] Request for order ID:', orderId);
    console.log('🔍 [ORDER-DETAIL] Authenticated user:', {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role
    });
    
    // Get order details
    const [orders] = await pool.query(`
      SELECT 
        o.*,
        COALESCE(u.name, u.username) as buyer_name,
        u.email as buyer_email
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.id = ? AND o.user_id = ?
    `, [orderId, req.user.id]);
    
    console.log('🔍 [ORDER-DETAIL] Query result count:', orders.length);

    if (orders.length === 0) {
      console.log('🔍 [ORDER-DETAIL] Order not found - checking if order exists for any user...');
      
      // Check if order exists at all
      const [anyOrder] = await pool.query('SELECT id, user_id FROM orders WHERE id = ?', [orderId]);
      if (anyOrder.length > 0) {
        console.log('🔍 [ORDER-DETAIL] Order exists but belongs to user:', anyOrder[0].user_id, 'not', req.user.id);
        return res.status(403).json({ error: 'Access denied. This order does not belong to your account.' });
      } else {
        console.log('🔍 [ORDER-DETAIL] Order does not exist in database');
        return res.status(404).json({ error: 'Order not found' });
      }
    }

    const order = orders[0];
    console.log('🔍 [ORDER-DETAIL] Found order:', {
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      user_id: order.user_id
    });

    // Get order items
    const [orderItems] = await pool.query(`
      SELECT 
        oi.*,
        p.name as product_name,
        COALESCE(
          p.main_image,
          (SELECT image_url FROM product_images WHERE product_id = p.id AND is_main = TRUE ORDER BY id LIMIT 1),
          (SELECT image_url FROM product_images WHERE product_id = p.id ORDER BY sort_order, id LIMIT 1)
        ) as product_image,
        p.price as product_price,
        'RWF' as product_currency,
        COALESCE(s.name, s.username) as seller_name
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN users s ON p.seller_id = s.id
      WHERE oi.order_id = ?
    `, [orderId]);

    order.items = orderItems;

    res.json({ success: true, order });
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({ error: 'Failed to fetch order details' });
  }
});

// POST /api/orders - Create new order with delivery method selection
router.post('/', requireAuth, async (req, res) => {
  try {
    console.log('🔍 DEBUG - Order creation request received:', {
      body: req.body,
      user: req.user,
      headers: req.headers
    });
    
    const { items, shipping, payment, total, delivery_method, pickup_site_id, delivery_address, referral_code } = req.body;
    const buyerId = req.user.id;
    const buyerRole = req.user.role;

    // 🔒 SECURITY CHECK 1: Allow buyers and pickup site managers to create orders
    if (!['buyer', 'agent'].includes(buyerRole)) {
      console.error(`🚨 SECURITY ALERT: User ${buyerId} (role: ${buyerRole}) attempted to create order`);
      return res.status(403).json({ 
        error: 'Only buyers and pickup site managers can create orders',
        details: 'This role cannot create orders'
      });
    }

    // 🔒 SECURITY CHECK 2: Validate user exists and is active
    const [userCheck] = await pool.query(`
      SELECT id, name, email, role FROM users WHERE id = ? AND role IN ('buyer', 'agent')
    `, [buyerId]);

    if (userCheck.length === 0) {
      console.error(`🚨 SECURITY ALERT: Invalid user ID ${buyerId} attempted to create order`);
      return res.status(403).json({ 
        error: 'Invalid user account',
        details: 'User account not found or inactive'
      });
    }

    const user = userCheck[0];
    console.log(`✅ Order creation validated for ${user.role}: ${user.name} (${user.email})`);

    // 🎯 REFERRAL TRACKING: Validate and process referral code if provided
    let referralInfo = null;
    if (referral_code) {
      try {
        const [referralLinks] = await pool.query(`
          SELECT rl.*, u.name as referrer_name, u.email as referrer_email
          FROM referral_links rl
          JOIN users u ON rl.user_id = u.id
          WHERE rl.referral_code = ? AND rl.status = 'active'
        `, [referral_code]);
        
        if (referralLinks.length > 0) {
          referralInfo = referralLinks[0];
          console.log(`🎯 Valid referral code found: ${referral_code} from user ${referralInfo.referrer_name}`);
          
          // Prevent self-referral
          if (referralInfo.user_id === buyerId) {
            console.warn(`⚠️ Self-referral attempt blocked for user ${buyerId}`);
            referralInfo = null;
          }
        } else {
          console.warn(`⚠️ Invalid or inactive referral code: ${referral_code}`);
        }
      } catch (referralError) {
        console.error('Error validating referral code:', referralError);
        // Continue with order creation even if referral validation fails
      }
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Order must contain at least one item' });
    }

    if (!shipping || !payment) {
      return res.status(400).json({ error: 'Shipping and payment information required' });
    }

    // 🚚 NEW DELIVERY SYSTEM: Home delivery only for customers
    // Force home delivery for regular buyers, allow pickup only for admin/manual orders
    let finalDeliveryMethod = 'home'; // Default to home delivery
    let isManualOrder = false;
    
    if (user.role === 'agent') {
      // PSM creating manual order - allow pickup if specified
      isManualOrder = true;
      finalDeliveryMethod = delivery_method || 'home';
    } else {
      // Regular buyer - force home delivery
      finalDeliveryMethod = 'home';
      console.log('🏠 Forcing home delivery for regular buyer');
    }

    // Validate delivery address for home delivery
    if (finalDeliveryMethod === 'home' && !delivery_address) {
      return res.status(400).json({ error: 'Delivery address is required for home delivery' });
    }

    // Validate pickup site only for manual orders with pickup
    if (finalDeliveryMethod === 'pickup' && isManualOrder) {
      if (!pickup_site_id) {
        return res.status(400).json({ error: 'Pickup site selection is required for pickup delivery' });
      }
      
      const [pickupSite] = await pool.query(`
        SELECT id, name, address_line1, capacity, current_load, is_active 
        FROM pickup_sites WHERE id = ? AND is_active = 1
      `, [pickup_site_id]);

      if (pickupSite.length === 0) {
        return res.status(400).json({ error: 'Selected pickup site is not available' });
      }

      if (pickupSite[0].current_load >= pickupSite[0].capacity) {
        return res.status(400).json({ error: 'Selected pickup site is at full capacity' });
      }
    }

    // Get seller_id from the first product in the order
    console.log('🔍 DEBUG - Looking up product:', items[0].product_id);
    const [productInfo] = await pool.query('SELECT seller_id, price FROM products WHERE id = ?', [items[0].product_id]);
    console.log('🔍 DEBUG - Product query result:', productInfo);
    
    if (productInfo.length === 0) {
        console.error('❌ Product not found:', items[0].product_id);
        return res.status(404).json({ error: `Product not found for order creation. Product ID: ${items[0].product_id}` });
    }
    const sellerId = productInfo[0].seller_id;
    const basePrice = parseFloat(productInfo[0].price);

    // Determine delivery type and calculate pricing with commission
    const deliveryType = finalDeliveryMethod === 'home' ? 'home_delivery' : 'pickup';
    const marketplaceType = req.body.marketplace_type || 'physical';
    
    // Calculate final pricing - for regular buyers, hide delivery fee (make it appear free)
    let pricingDetails;
    if (isManualOrder) {
      // Manual orders show real pricing
      pricingDetails = await CommissionService.calculateBuyerPrice(basePrice, deliveryType, marketplaceType);
    } else {
      // Regular buyers see "free" home delivery (fee absorbed into product price)
      pricingDetails = await CommissionService.calculateBuyerPrice(basePrice, deliveryType, marketplaceType);
      // Hide delivery fee from customer view (but keep it in backend calculations)
      pricingDetails.customerVisibleDeliveryFee = 0;
      pricingDetails.deliveryFeeHidden = true;
    }
    
    // Generate order number
    const orderNumber = 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

    // 🔒 SECURITY CHECK 3: Log order creation attempt
    console.log(`📦 Creating order for ${user.role} ${buyerId} (${user.email}):`, {
      orderNumber,
      sellerId,
      basePrice,
      finalPrice: pricingDetails.finalPrice,
      deliveryType,
      finalDeliveryMethod,
      isManualOrder,
      deliveryFeeHidden: pricingDetails.deliveryFeeHidden || false,
      pickupSiteId: pickup_site_id,
      itemCount: items.length,
      timestamp: new Date().toISOString()
    });

    // Create order with new home delivery system
    const [orderResult] = await pool.query(`
      INSERT INTO orders (
        user_id, seller_id, order_number, total_amount, status, 
        shipping_address, billing_address, payment_method, payment_proof,
        delivery_type, delivery_method, pickup_site_id, delivery_address,
        platform_margin, home_delivery_fee, final_buyer_price, seller_payout,
        is_home_delivery_only, same_agent_pickup_delivery, referral_code,
        created_at
      ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      buyerId, // Explicitly use buyer ID
      sellerId,
      orderNumber, 
      basePrice, // Store base price in total_amount
      JSON.stringify(shipping), 
      JSON.stringify(payment.billing_address || shipping),
      payment.method,
      payment.payment_proof || null,
      deliveryType,
      finalDeliveryMethod, // Use the final delivery method
      pickup_site_id || null,
      delivery_address ? JSON.stringify(delivery_address) : null,
      pricingDetails.platformMargin,
      pricingDetails.deliveryFee,
      pricingDetails.finalPrice,
      pricingDetails.sellerPayout,
      finalDeliveryMethod === 'home' ? 1 : 0, // is_home_delivery_only
      1, // same_agent_pickup_delivery - always true in new system
      referralInfo ? referral_code : null // Store referral code if valid
    ]);

    const orderId = orderResult.insertId;
    // 🔒 SECURITY CHECK 4: Verify order was created with correct buyer
    const [orderVerification] = await pool.query(`
      SELECT o.id, o.user_id, u.name, u.email, u.role 
      FROM orders o 
      JOIN users u ON o.user_id = u.id 
      WHERE o.id = ?
    `, [orderId]);

    if (orderVerification.length === 0 || orderVerification[0].user_id !== buyerId) {
      console.error(`🚨 CRITICAL ERROR: Order ${orderId} created with wrong user_id!`);
      // Rollback the order creation
      await pool.query('DELETE FROM orders WHERE id = ?', [orderId]);
      return res.status(500).json({ 
        error: 'Order creation failed - security validation error',
        details: 'Order was not assigned to the correct user'
      });
    }

    console.log(`✅ Order ${orderId} successfully created for ${user.role} ${buyerId}`);

    // Create order items
    for (const item of items) {
      await pool.query(`
        INSERT INTO order_items (
          order_id, product_id, quantity, unit_price, total_price
        ) VALUES (?, ?, ?, ?, ?)
      `, [
        orderId, 
        item.product_id, 
        item.quantity, 
        basePrice, // Use base price for order items
        basePrice * item.quantity
      ]);
    }

    // Calculate and distribute commissions
    try {
      const involvedAgents = {
        fastDeliveryAgent: req.body.fast_delivery_agent_id || null,
        pickupSiteManager: req.body.pickup_site_manager_id || null,
        pickupDeliveryAgent: req.body.pickup_delivery_agent_id || null,
        psmHelped: req.body.psm_helped || false
      };

      const commissionResult = await CommissionService.calculateOrderCommissions(
        orderId, 
        basePrice, 
        deliveryType, 
        involvedAgents
      );

      console.log(`💰 Commissions calculated for order ${orderId}:`, commissionResult);
    } catch (commissionError) {
      console.error(`⚠️ Commission calculation failed for order ${orderId}:`, commissionError);
      // Don't fail the order creation if commission calculation fails
    }

    // 🎯 REFERRAL COMMISSION PROCESSING: Process referral commission if applicable
    if (referralInfo) {
      try {
        // Calculate referral commission (15% of platform margin)
        const platformMargin = pricingDetails.platformMargin;
        const referralCommission = platformMargin * 0.15;
        
        console.log(`🎯 Processing referral commission for order ${orderId}:`, {
          referralCode: referral_code,
          referrerId: referralInfo.user_id,
          referrerName: referralInfo.referrer_name,
          platformMargin: platformMargin,
          referralCommission: referralCommission
        });

        // Create referral purchase record
        await pool.query(`
          INSERT INTO referral_purchases (
            referral_link_id, order_id, purchase_amount, commission_amount, 
            purchased_at, status
          ) VALUES (?, ?, ?, ?, NOW(), 'pending')
        `, [referralInfo.id, orderId, basePrice, referralCommission]);

        // Update referral link usage count
        await pool.query(`
          UPDATE referral_links 
          SET usage_count = usage_count + 1, last_used_at = NOW()
          WHERE id = ?
        `, [referralInfo.id]);

        // Create agent earnings record for referral commission
        await pool.query(`
          INSERT INTO agent_earnings (
            agent_id, order_id, amount, earnings_type, status, created_at
          ) VALUES (?, ?, ?, 'referral', 'pending', NOW())
        `, [referralInfo.user_id, orderId, referralCommission]);

        console.log(`✅ Referral commission processed: ${referralCommission} RWF for user ${referralInfo.user_id}`);
        
      } catch (referralCommissionError) {
        console.error(`⚠️ Referral commission processing failed for order ${orderId}:`, referralCommissionError);
        // Don't fail the order creation if referral processing fails
      }
    }

    // Clear the user's cart after successful order
    await pool.query('DELETE FROM cart WHERE user_id = ?', [buyerId]);

    // 🔒 SECURITY CHECK 5: Final verification
    const [finalCheck] = await pool.query(`
      SELECT COUNT(*) as count FROM orders WHERE id = ? AND user_id = ?
    `, [orderId, buyerId]);

    if (finalCheck[0].count === 0) {
      console.error(`🚨 FINAL SECURITY CHECK FAILED: Order ${orderId} not found for ${user.role} ${buyerId}`);
      return res.status(500).json({ 
        error: 'Order verification failed',
        details: 'Please contact support'
      });
    }

    console.log(`🎉 Order ${orderId} (${orderNumber}) successfully created and verified for ${user.email}`);

    // Send order confirmation email
    try {
      // Get order items with product details for email
      const [orderItems] = await pool.query(`
        SELECT oi.*, p.name as product_name, p.main_image as image_url
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
      `, [orderId]);

      const orderItemsForEmail = orderItems.map(item => ({
        name: item.product_name,
        quantity: item.quantity,
        price: item.unit_price,
        total: item.total_price,
        image: item.image_url
      }));

      const subtotal = orderItemsForEmail.reduce((sum, item) => sum + parseFloat(item.total), 0);
      const shippingCost = 5.00; // Default shipping cost
      const totalAmount = subtotal + shippingCost;

      await sendTemplatedEmail(
        user.email,
        `Order Confirmation #${orderNumber} - African Deals Domain`,
        'order-confirmation',
        {
          userName: user.name,
          orderNumber: orderNumber,
          orderDate: new Date().toLocaleDateString(),
          orderItems: orderItemsForEmail,
          subtotal: subtotal.toFixed(2),
          shippingCost: shippingCost.toFixed(2),
          totalAmount: totalAmount.toFixed(2),
          currency: '$',
          shippingAddress: shipping,
          estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
          orderDetailsUrl: `https://africandealsdomain.com/buyer/orders/${orderId}`,
          trackingUrl: `https://africandealsdomain.com/buyer/orders/${orderId}/track`,
          supportUrl: 'https://africandealsdomain.com/support',
          websiteUrl: 'https://africandealsdomain.com',
          email: user.email
        }
      );
      console.log('[EMAIL SUCCESS] Order confirmation sent to:', user.email);
    } catch (emailErr) {
      console.error('[EMAIL ERROR] Failed to send order confirmation:', emailErr.message);
      // Don't fail order creation if email fails
    }

    // Send admin alert for new order
    try {
      await sendTemplatedEmail(
        'admin@africandealsdomain.com',
        `New Order Placed - ${orderNumber}`,
        'admin-alert',
        {
          alertType: 'Order',
          alertTitle: 'New Order Placed',
          alertDescription: `A new order has been placed and requires processing.`,
          priority: 'medium',
          timestamp: new Date().toLocaleString(),
          alertId: `ORD-${orderId}`,
          systemModule: 'Order Management',
          eventType: 'Order Placement',
          severityLevel: 'Medium',
          userInfo: {
            userName: user.name,
            userEmail: user.email,
            userType: user.role === 'buyer' ? 'Buyer' : 'Pickup Site Manager',
            userId: buyerId,
            registrationDate: new Date().toLocaleDateString()
          },
          recommendedActions: [
            'Review order details',
            'Assign delivery agent if needed',
            'Monitor payment status',
            'Ensure seller fulfillment'
          ],
          adminDashboardUrl: 'https://africandealsdomain.com/admin/dashboard',
          reviewUrl: `https://africandealsdomain.com/admin/orders/${orderId}`,
          systemLogsUrl: 'https://africandealsdomain.com/admin/logs',
          supportUrl: 'https://africandealsdomain.com/admin/support'
        }
      );
      console.log('[EMAIL SUCCESS] Admin alert sent for new order');
    } catch (emailErr) {
      console.error('[EMAIL ERROR] Failed to send admin alert:', emailErr.message);
    }

    res.json({ 
      success: true, 
      order: {
        id: orderId,
        order_number: orderNumber,
        total_amount: total,
        status: 'pending',
        buyer_id: buyerId,
        buyer_email: user.email
      },
      message: 'Order created successfully' 
    });
  } catch (error) {
    console.error('❌ Error creating order:', error);
    
    let errorMessage = 'Failed to create order';
    let statusCode = 500;
    
    // Handle specific database errors
    if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Database connection failed. Please try again in a moment.';
      statusCode = 503; // Service Unavailable
    } else if (error.code === 'ER_BAD_FIELD_ERROR') {
      errorMessage = 'Database schema error. Please contact support.';
      statusCode = 500;
    } else if (error.code === 'ER_NO_SUCH_TABLE') {
      errorMessage = 'Database tables not properly configured. Please contact support.';
      statusCode = 500;
    } else if (error.message.includes('authentication')) {
      errorMessage = 'Authentication failed. Please log in again.';
      statusCode = 401;
    } else if (error.code === 'ER_DUP_ENTRY') {
      errorMessage = 'Order already exists or duplicate data detected.';
      statusCode = 409;
    }
    
    res.status(statusCode).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : 'Please contact support if this issue persists',
      timestamp: new Date().toISOString(),
      code: error.code || 'UNKNOWN_ERROR'
    });
  }
});

// PUT /api/orders/:id/status - Update order status
router.put('/:id/status', requireAuth, async (req, res) => {
  try {
    const orderId = req.params.id;
    const { status } = req.body;

    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await pool.query(
      'UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ? AND user_id = ?',
      [status, orderId, req.user.id]
    );

    res.json({ success: true, message: 'Order status updated' });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// PUT /api/orders/:id/tracking-status - Update order tracking status (for agents)
router.put('/:id/tracking-status', requireAuth, async (req, res) => {
  try {
    const orderId = req.params.id;
    const { status, notes, location } = req.body;

    const validStatuses = ['assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid tracking status' });
    }

    // Check if order exists and is assigned to this agent
    const [orders] = await pool.query(`
      SELECT o.*, u.id as buyer_id, u.email as buyer_email, u.username as buyer_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.id = ? AND o.agent_id = ?
    `, [orderId, req.user.id]);

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found or not assigned to you' });
    }

    const order = orders[0];

    // Update order tracking status
    await pool.query(`
      UPDATE orders 
      SET status = ?, tracking_status = ?, updated_at = NOW()
      WHERE id = ?
    `, [status === 'delivered' ? 'delivered' : 'shipped', status, orderId]);

    // Add tracking history
    await pool.query(`
      INSERT INTO order_tracking (order_id, status, notes, location, created_at)
      VALUES (?, ?, ?, ?, NOW())
    `, [orderId, status, notes || `Status updated to ${status}`, location ? JSON.stringify(location) : null]);

    // If delivered, update delivery confirmation
    if (status === 'delivered') {
      await pool.query(`
        UPDATE orders 
        SET delivered_at = NOW(), delivery_confirmed_at = NOW()
        WHERE id = ?
      `, [orderId]);

      // Update agent status back to available
      await pool.query(`
        UPDATE agents SET status = 'available' WHERE user_id = ?
      `, [req.user.id]);

      // Send delivery confirmation email
      try {
        const [agentInfo] = await pool.query(`
          SELECT first_name, last_name, phone FROM agents WHERE user_id = ?
        `, [req.user.id]);

        const agent = agentInfo[0];
        const agentName = agent ? `${agent.first_name} ${agent.last_name}`.trim() : 'Delivery Agent';

        await sendTemplatedEmail(
          order.buyer_email,
          `Order Delivered #${order.order_number} - African Deals Domain`,
          'order-delivered',
          {
            userName: order.buyer_name || 'Valued Customer',
            orderNumber: order.order_number,
            deliveryDate: new Date().toLocaleDateString(),
            deliveryTime: new Date().toLocaleTimeString(),
            deliveredTo: order.buyer_name || 'Customer',
            deliveryAgent: agentName,
            agentPhone: agent?.phone || '',
            orderDate: new Date(order.created_at).toLocaleDateString(),
            preparedDate: new Date(order.created_at).toLocaleDateString(),
            shippedDate: new Date(order.updated_at).toLocaleDateString(),
            orderDetailsUrl: `https://africandealsdomain.com/buyer/orders/${orderId}`,
            reviewUrl: `https://africandealsdomain.com/buyer/orders/${orderId}/review`,
            shopAgainUrl: 'https://africandealsdomain.com/products',
            supportUrl: 'https://africandealsdomain.com/support',
            websiteUrl: 'https://africandealsdomain.com',
            email: order.buyer_email
          }
        );
        console.log('[EMAIL SUCCESS] Delivery confirmation sent to:', order.buyer_email);
      } catch (emailErr) {
        console.error('[EMAIL ERROR] Failed to send delivery confirmation:', emailErr.message);
      }
    }

    // Emit real-time update to buyer
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${order.buyer_id}`).emit('order_status_update', {
        orderId: orderId,
        status: status,
        message: `Your order has been ${status.replace('_', ' ')}`,
        timestamp: new Date().toISOString()
      });
    }

    res.json({ 
      success: true, 
      message: 'Order tracking status updated successfully',
      status: status
    });

  } catch (error) {
    console.error('Error updating order tracking status:', error);
    res.status(500).json({ error: 'Failed to update tracking status' });
  }
});

// POST /api/orders/:id/payment - Process payment for order
router.post('/:id/payment', requireAuth, async (req, res) => {
  try {
    const orderId = req.params.id;
    const { method, amount, cardData, paypalEmail, mobileData, bankData } = req.body;
    const userId = req.user.id;

    // Validate payment method
    const validMethods = ['credit-card', 'paypal', 'mobile-money', 'bank-transfer'];
    if (!validMethods.includes(method)) {
      return res.status(400).json({ error: 'Invalid payment method' });
    }

    // Check if order exists and belongs to user
    const [orders] = await pool.query(`
      SELECT * FROM orders 
      WHERE id = ? AND user_id = ? AND status IN ('pending', 'confirmed')
    `, [orderId, userId]);

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found or already processed' });
    }

    const order = orders[0];

    // Validate payment amount
    if (Math.abs(parseFloat(amount) - parseFloat(order.total_amount)) > 0.01) {
      return res.status(400).json({ error: 'Payment amount does not match order total' });
    }

    // Generate payment reference
    const paymentRef = 'PAY-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

    // Process payment based on method
    let paymentResult = { success: false, transactionId: null, message: '' };

    switch (method) {
      case 'credit-card':
        paymentResult = await processCreditCardPayment(cardData, amount, paymentRef);
        break;
      case 'paypal':
        paymentResult = await processPayPalPayment(paypalEmail, amount, paymentRef);
        break;
      case 'mobile-money':
        paymentResult = await processMobileMoneyPayment(mobileData, amount, paymentRef);
        break;
      case 'bank-transfer':
        paymentResult = await processBankTransferPayment(bankData, amount, paymentRef);
        break;
    }

    if (paymentResult.success) {
      // Update order status to paid
      await pool.query(`
        UPDATE orders 
        SET status = 'confirmed', payment_status = 'paid', payment_method = ?, 
            payment_reference = ?, payment_date = NOW(), updated_at = NOW()
        WHERE id = ?
      `, [method, paymentRef, orderId]);

      // Create payment record
      await pool.query(`
        INSERT INTO payments (
          order_id, user_id, amount, method, reference, transaction_id, 
          status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'completed', NOW())
      `, [orderId, userId, amount, method, paymentRef, paymentResult.transactionId]);

      // Create order tracking entry
      await pool.query(`
        INSERT INTO order_tracking (order_id, status, notes, created_at)
        VALUES (?, 'confirmed', 'Payment completed successfully', NOW())
      `, [orderId]);

      // 🎯 PROCESS REFERRAL COMMISSIONS: Mark referral commissions as paid when order payment is confirmed
      try {
        // Check if this order has referral commissions
        const [referralEarnings] = await pool.query(`
          SELECT ae.id, ae.amount, ae.agent_id, u.name as agent_name
          FROM agent_earnings ae
          JOIN users u ON ae.agent_id = u.id
          WHERE ae.order_id = ? AND ae.earnings_type = 'referral' AND ae.status = 'pending'
        `, [orderId]);
        
        if (referralEarnings.length > 0) {
          // Mark referral earnings as paid
          await pool.query(`
            UPDATE agent_earnings 
            SET status = 'paid', paid_at = NOW()
            WHERE order_id = ? AND earnings_type = 'referral' AND status = 'pending'
          `, [orderId]);
          
          // Update referral purchases status
          await pool.query(`
            UPDATE referral_purchases 
            SET status = 'paid'
            WHERE order_id = ? AND status = 'pending'
          `, [orderId]);
          
          console.log(`🎯 [REFERRAL] Auto-processed ${referralEarnings.length} referral commissions for order ${orderId}:`, 
            referralEarnings.map(e => `${e.agent_name}: ${e.amount} RWF`));
        }
      } catch (referralError) {
        console.error(`⚠️ [REFERRAL] Failed to process referral commissions for order ${orderId}:`, referralError);
        // Don't fail the payment confirmation if referral processing fails
      }

      // Send payment confirmation email
      try {
        const [userInfo] = await pool.query(`
          SELECT name, email FROM users WHERE id = ?
        `, [userId]);

        const user = userInfo[0];
        const subtotal = parseFloat(order.total_amount) - 5.00; // Assuming $5 shipping
        const shippingCost = 5.00;

        await sendTemplatedEmail(
          user.email,
          `Payment Confirmed #${order.order_number} - African Deals Domain`,
          'payment-confirmation',
          {
            userName: user.name,
            transactionId: paymentResult.transactionId || paymentRef,
            paymentDate: new Date().toLocaleDateString(),
            paymentMethod: method.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
            orderNumber: order.order_number,
            currency: '$',
            totalAmount: parseFloat(order.total_amount).toFixed(2),
            subtotal: subtotal.toFixed(2),
            shippingCost: shippingCost.toFixed(2),
            orderDetailsUrl: `https://africandealsdomain.com/buyer/orders/${orderId}`,
            websiteUrl: 'https://africandealsdomain.com',
            supportUrl: 'https://africandealsdomain.com/support',
            email: user.email
          }
        );
        console.log('[EMAIL SUCCESS] Payment confirmation sent to:', user.email);
      } catch (emailErr) {
        console.error('[EMAIL ERROR] Failed to send payment confirmation:', emailErr.message);
      }

      res.json({
        success: true,
        message: 'Payment processed successfully',
        paymentReference: paymentRef,
        transactionId: paymentResult.transactionId
      });
    } else {
      // Payment failed - create failed payment record
      await pool.query(`
        INSERT INTO payments (
          order_id, user_id, amount, method, reference, status, 
          failure_reason, created_at
        ) VALUES (?, ?, ?, ?, ?, 'failed', ?, NOW())
      `, [orderId, userId, amount, method, paymentRef, paymentResult.message]);

      res.status(400).json({
        error: 'Payment failed',
        message: paymentResult.message,
        paymentReference: paymentRef
      });
    }

  } catch (error) {
    console.error('Payment processing error:', error);
    res.status(500).json({ error: 'Payment processing failed' });
  }
});

// Payment processing functions (mock implementations)
async function processCreditCardPayment(cardData, amount, reference) {
  // Mock credit card processing
  // In production, integrate with Stripe, Square, or other payment processors
  
  // Basic validation
  if (!cardData.cardNumber || !cardData.expiryDate || !cardData.cvv) {
    return { success: false, message: 'Invalid card details' };
  }

  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Mock success/failure (90% success rate)
  const success = Math.random() > 0.1;
  
  if (success) {
    return {
      success: true,
      transactionId: 'CC-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
      message: 'Payment processed successfully'
    };
  } else {
    return {
      success: false,
      message: 'Card declined. Please check your card details and try again.'
    };
  }
}

async function processPayPalPayment(email, amount, reference) {
  // Mock PayPal processing
  // In production, integrate with PayPal API
  
  if (!email || !email.includes('@')) {
    return { success: false, message: 'Invalid PayPal email' };
  }

  await new Promise(resolve => setTimeout(resolve, 1500));

  const success = Math.random() > 0.05; // 95% success rate
  
  if (success) {
    return {
      success: true,
      transactionId: 'PP-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
      message: 'PayPal payment completed'
    };
  } else {
    return {
      success: false,
      message: 'PayPal payment failed. Please try again.'
    };
  }
}

async function processMobileMoneyPayment(mobileData, amount, reference) {
  // Mock mobile money processing
  // In production, integrate with MTN MoMo, Airtel Money APIs
  
  if (!mobileData.phoneNumber || !mobileData.provider) {
    return { success: false, message: 'Invalid mobile money details' };
  }

  await new Promise(resolve => setTimeout(resolve, 3000));

  const success = Math.random() > 0.15; // 85% success rate
  
  if (success) {
    return {
      success: true,
      transactionId: `${mobileData.provider.toUpperCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      message: 'Mobile money payment completed'
    };
  } else {
    return {
      success: false,
      message: 'Mobile money payment failed. Please check your balance and try again.'
    };
  }
}

async function processBankTransferPayment(bankData, amount, reference) {
  // Mock bank transfer processing
  // In production, integrate with banking APIs
  
  if (!bankData.bank || !bankData.accountNumber) {
    return { success: false, message: 'Invalid bank details' };
  }

  await new Promise(resolve => setTimeout(resolve, 2500));

  const success = Math.random() > 0.2; // 80% success rate
  
  if (success) {
    return {
      success: true,
      transactionId: 'BT-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
      message: 'Bank transfer initiated successfully'
    };
  } else {
    return {
      success: false,
      message: 'Bank transfer failed. Please verify your account details.'
    };
  }
}

// ========== DELIVERY TRACKING SYSTEM ROUTES ==========

// GET /api/orders/:id/tracking - Get order tracking information
router.get('/:id/tracking', requireAuth, async (req, res) => {
  try {
    const orderId = req.params.id;
    
    // Get order with agent and tracking info
    const [orders] = await pool.query(`
      SELECT 
        o.*,
        a.id as agent_id,
        u_agent.name as agent_name,
        a.phone as agent_phone,
        a.current_location,
        a.rating as agent_rating,
        a.vehicle_type as agent_vehicle,
        a.status as agent_status,
        u.name as buyer_name,
        u.email as buyer_email
      FROM orders o
      LEFT JOIN agents a ON o.agent_id = a.user_id
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN users u_agent ON a.user_id = u_agent.id
      WHERE o.id = ? AND (o.user_id = ? OR a.user_id = ?)
    `, [orderId, req.user.id, req.user.id]);

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found or access denied' });
    }

    const order = orders[0];

    // Get tracking history
    const [trackingHistory] = await pool.query(`
      SELECT * FROM order_tracking_history 
      WHERE order_id = ? 
      ORDER BY created_at ASC
    `, [orderId]);

    // Parse JSON fields
    if (order.pickup_location) {
      order.pickup_location = JSON.parse(order.pickup_location);
    }
    if (order.delivery_location) {
      order.delivery_location = JSON.parse(order.delivery_location);
    }

    // Parse agent current location from JSON
    let agentLocation = null;
    if (order.current_location) {
      try {
        agentLocation = JSON.parse(order.current_location);
      } catch (e) {
        console.warn('Failed to parse agent current_location:', e);
        agentLocation = null;
      }
    }

    res.json({
      success: true,
      order: {
        ...order,
        agent: order.agent_id ? {
          id: order.agent_id,
          name: order.agent_name || '',
          phone: order.agent_phone ? order.agent_phone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2') : null, // Obfuscate phone
          current_location: agentLocation || {
            lat: null,
            lng: null
          },
          rating: order.agent_rating,
          vehicle_type: order.agent_vehicle,
          status: order.agent_status
        } : null,
        tracking_history: trackingHistory
      }
    });
  } catch (error) {
    console.error('Error fetching order tracking:', error);
    res.status(500).json({ error: 'Failed to fetch tracking information' });
  }
});

// POST /api/orders/:id/assign-agent - Auto-assign nearest available agent
router.post('/:id/assign-agent', requireAuth, async (req, res) => {
  try {
    const orderId = req.params.id;
    const { pickup_location, delivery_location } = req.body;

    // Verify order exists and belongs to user
    const [orders] = await pool.query(`
      SELECT * FROM orders WHERE id = ? AND user_id = ? AND agent_id IS NULL
    `, [orderId, req.user.id]);

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found or already assigned' });
    }

    // Find nearest available agent (simplified - in production, use proper geospatial queries)
    const [agents] = await pool.query(`
      SELECT * FROM agents 
      WHERE status = 'available' AND is_active = 1
      ORDER BY rating DESC, total_deliveries DESC
      LIMIT 1
    `);

    if (agents.length === 0) {
      return res.status(404).json({ error: 'No available agents found' });
    }

    const agent = agents[0];
    const deliveryCode = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Calculate commission using CommissionService
    const CommissionService = require('../services/commissionService');
    const order = orders[0];
    const baseAmount = parseFloat(order.total_amount);
    
    // Determine delivery type and agent type
    const deliveryType = order.delivery_type || 'pickup';
    const agentType = agent.agent_type || 'fast_delivery';
    
    // Calculate commissions
    const commissionData = await CommissionService.calculateOrderCommissions(
      orderId, 
      baseAmount, 
      deliveryType, 
      { [agentType]: agent.id }
    );
    
    // Find agent's commission from the calculated data
    const agentCommission = commissionData.find(c => c.agent_id === agent.id)?.amount || 0;
    const deliveryFee = deliveryType === 'home_delivery' ? (baseAmount * 0.06) : 0;

    // Assign agent to order
    await pool.query(`
      UPDATE orders SET 
        agent_id = ?,
        delivery_code = ?,
        tracking_status = 'assigned',
        delivery_fee = ?,
        agent_commission = ?,
        pickup_location = ?,
        delivery_location = ?,
        estimated_pickup_time = DATE_ADD(NOW(), INTERVAL 30 MINUTE),
        estimated_delivery_time = DATE_ADD(NOW(), INTERVAL 2 HOUR),
        updated_at = NOW()
      WHERE id = ?
    `, [
      agent.id, deliveryCode, deliveryFee, agentCommission,
      JSON.stringify(pickup_location), JSON.stringify(delivery_location),
      orderId
    ]);

    // Update agent status
    await pool.query(`
      UPDATE agents SET status = 'busy', updated_at = NOW() WHERE id = ?
    `, [agent.id]);

    // Add tracking history
    await pool.query(`
      INSERT INTO order_tracking_history (order_id, agent_id, status, notes)
      VALUES (?, ?, 'assigned', 'Order assigned to agent')
    `, [orderId, agent.id]);

    // Create agent earnings record
    await pool.query(`
      INSERT INTO agent_earnings (agent_id, order_id, amount, earnings_type, status)
      VALUES (?, ?, ?, 'delivery_fee', 'pending')
    `, [agent.id, orderId, agentCommission]);

    res.json({
      success: true,
      message: 'Agent assigned successfully',
      agent: {
        id: agent.id,
        name: `${agent.first_name} ${agent.last_name}`,
        phone: agent.phone ? agent.phone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2') : null,
        vehicle_type: agent.vehicle_type,
        rating: agent.rating
      },
      delivery_code: deliveryCode,
      estimated_pickup: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      estimated_delivery: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    });
  } catch (error) {
    console.error('Error assigning agent:', error);
    res.status(500).json({ error: 'Failed to assign agent' });
  }
});

// PUT /api/orders/:id/tracking-status - Update tracking status (for agents)
router.put('/:id/tracking-status', requireAuth, async (req, res) => {
  try {
    const orderId = req.params.id;
    const { status, location, notes } = req.body;

    const validTrackingStatuses = ['assigned', 'picked_up', 'en_route', 'arriving', 'delivered'];
    if (!validTrackingStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid tracking status' });
    }

    // Verify agent has access to this order
    const [orders] = await pool.query(`
      SELECT o.*, a.user_id as agent_user_id FROM orders o
      JOIN agents a ON o.agent_id = a.id
      WHERE o.id = ? AND a.user_id = ?
    `, [orderId, req.user.id]);

    if (orders.length === 0) {
      return res.status(403).json({ error: 'Access denied or order not found' });
    }

    // Update tracking status
    await pool.query(`
      UPDATE orders SET 
        tracking_status = ?,
        ${status === 'picked_up' ? 'actual_pickup_time = NOW(),' : ''}
        ${status === 'delivered' ? 'actual_delivery_time = NOW(), status = "delivered",' : ''}
        updated_at = NOW()
      WHERE id = ?
    `, [status, orderId]);

    // Add tracking history
    await pool.query(`
      INSERT INTO order_tracking_history (order_id, agent_id, status, location_lat, location_lng, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [orderId, orders[0].agent_id, status, location?.lat || null, location?.lng || null, notes || null]);

    // If delivered, update agent status and earnings
    if (status === 'delivered') {
      await pool.query(`
        UPDATE agents SET 
          status = 'available',
          total_deliveries = total_deliveries + 1,
          successful_deliveries = successful_deliveries + 1,
          updated_at = NOW()
        WHERE id = ?
      `, [orders[0].agent_id]);

      // Mark earnings as paid
      await pool.query(`
        UPDATE agent_earnings SET status = 'paid', paid_at = NOW()
        WHERE order_id = ? AND agent_id = ?
      `, [orderId, orders[0].agent_id]);
    }

    res.json({ success: true, message: 'Tracking status updated' });
  } catch (error) {
    console.error('Error updating tracking status:', error);
    res.status(500).json({ error: 'Failed to update tracking status' });
  }
});

// POST /api/orders/:id/confirm-delivery - Confirm delivery with code
router.post('/:id/confirm-delivery', requireAuth, async (req, res) => {
  try {
    const orderId = req.params.id;
    const { delivery_code, rating, review } = req.body;

    // Get order with delivery code
    const [orders] = await pool.query(`
      SELECT o.*, a.id as agent_id FROM orders o
      LEFT JOIN agents a ON o.agent_id = a.id
      WHERE o.id = ? AND o.user_id = ?
    `, [orderId, req.user.id]);

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orders[0];

    // Verify delivery code
    if (order.delivery_code !== delivery_code) {
      return res.status(400).json({ error: 'Invalid delivery code' });
    }

    // Update order status
    await pool.query(`
      UPDATE orders SET 
        status = 'delivered',
        tracking_status = 'delivered',
        actual_delivery_time = NOW(),
        updated_at = NOW()
      WHERE id = ?
    `, [orderId]);

    // Add final tracking history
    await pool.query(`
      INSERT INTO order_tracking_history (order_id, agent_id, status, notes)
      VALUES (?, ?, 'delivered', 'Delivery confirmed by buyer')
    `, [orderId, order.agent_id]);

    // If rating provided, save agent review
    if (rating && order.agent_id) {
      await pool.query(`
        INSERT INTO agent_reviews (agent_id, buyer_id, order_id, rating, comment)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment)
      `, [order.agent_id, req.user.id, orderId, rating, review || null]);

      // Update agent's average rating
      const [avgRating] = await pool.query(`
        SELECT AVG(rating) as avg_rating, COUNT(*) as total_reviews
        FROM agent_reviews WHERE agent_id = ?
      `, [order.agent_id]);

      await pool.query(`
        UPDATE agents SET 
          rating = ?,
          status = 'available',
          total_deliveries = total_deliveries + 1,
          successful_deliveries = successful_deliveries + 1,
          updated_at = NOW()
        WHERE id = ?
      `, [avgRating[0].avg_rating || 0, order.agent_id]);
    }

    // Mark agent earnings as paid
    if (order.agent_id) {
      await pool.query(`
        UPDATE agent_earnings SET status = 'paid', paid_at = NOW()
        WHERE order_id = ? AND agent_id = ?
      `, [orderId, order.agent_id]);
    }

    res.json({ 
      success: true, 
      message: 'Delivery confirmed successfully',
      order_status: 'delivered'
    });
  } catch (error) {
    console.error('Error confirming delivery:', error);
    res.status(500).json({ error: 'Failed to confirm delivery' });
  }
});

// POST /api/orders/payment-proof - Upload payment proof for manual payment
router.post('/payment-proof', requireAuth, upload.single('payment_proof'), async (req, res) => {
  try {
    const { order_id } = req.body;
    const userId = req.user.id;

    if (!order_id) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Payment proof image is required' });
    }

    // Verify order exists and belongs to user
    const [orders] = await pool.query(`
      SELECT * FROM orders 
      WHERE id = ? AND user_id = ? AND status IN ('pending', 'confirmed')
    `, [order_id, userId]);

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found or already processed' });
    }

    const order = orders[0];
    
    // Get file path for public access
    const paymentProofUrl = `/uploads/payment-proofs/${req.file.filename}`;

    // Update order status to indicate payment proof submitted
    await pool.query(`
      UPDATE orders 
      SET payment_status = 'awaiting_approval', 
          payment_proof = ?,
          updated_at = NOW()
      WHERE id = ?
    `, [paymentProofUrl, order_id]);

    // Create order tracking entry
    await pool.query(`
      INSERT INTO order_tracking (order_id, status, notes, created_at)
      VALUES (?, 'payment_proof_submitted', 'Payment proof uploaded for verification', NOW())
    `, [order_id]);

    // Check if payment approval record exists
    const [existingApprovals] = await pool.query(
      'SELECT id FROM payment_approvals WHERE order_id = ?',
      [order_id]
    );

    if (existingApprovals.length > 0) {
      // Update existing payment approval
      await pool.query(
        'UPDATE payment_approvals SET payment_proof = ?, status = "pending", updated_at = NOW() WHERE order_id = ?',
        [paymentProofUrl, order_id]
      );
    } else {
      // Create new payment approval record
      await pool.query(
        'INSERT INTO payment_approvals (order_id, payment_method, payment_proof, created_at) VALUES (?, ?, ?, NOW())',
        [order_id, order.payment_method, paymentProofUrl]
      );
    }

    // Send notification email to admin
    try {
      const [admins] = await pool.query('SELECT email FROM users WHERE role = "admin" LIMIT 1');
      if (admins.length > 0) {
        await sendTemplatedEmail(
          admins[0].email,
          `New Payment Proof Submitted for Order #${order.order_number}`,
          'admin-payment-approval',
          {
            orderNumber: order.order_number,
            orderAmount: order.total_amount,
            paymentMethod: order.payment_method,
            customerName: req.user.username || req.user.name,
            customerEmail: req.user.email,
            adminDashboardUrl: `${process.env.SITE_URL || 'https://africandealsdomain.com'}/admin/payment-approvals.html`
          }
        );
      }
    } catch (emailErr) {
      console.error('[EMAIL ERROR] Failed to send payment proof notification:', emailErr.message);
      // Continue with the response, don't fail if email fails
    }

    res.json({
      success: true,
      message: 'Payment proof uploaded successfully. We will verify your payment and notify you shortly.',
      payment_proof: paymentProofUrl,
      status: 'awaiting_approval'
    });

  } catch (error) {
    console.error('Error uploading payment proof:', error);
    
    // Clean up uploaded file if database operation failed
    if (req.file) {
      const fs = require('fs');
      const filePath = path.join(__dirname, '../uploads/payment-proofs/', req.file.filename);
      fs.unlink(filePath, (err) => {
        if (err) console.error('Error deleting uploaded file:', err);
      });
    }
    
    res.status(500).json({ error: 'Failed to upload payment proof' });
  }
});

// POST /api/orders/calculate-delivery - New simplified delivery calculation
router.post('/calculate-delivery', requireAuth, async (req, res) => {
  try {
    const { items, delivery_address } = req.body;
    const userRole = req.user.role;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Items are required for delivery calculation' });
    }

    if (!delivery_address) {
      return res.status(400).json({ error: 'Delivery address is required' });
    }

    // Calculate subtotal
    let subtotal = 0;
    for (const item of items) {
      const [product] = await pool.query('SELECT price FROM products WHERE id = ?', [item.product_id]);
      if (product.length > 0) {
        subtotal += parseFloat(product[0].price) * item.quantity;
      }
    }

    // NEW SYSTEM: Always home delivery for regular buyers
    const deliveryType = 'home_delivery';
    const marketplaceType = 'physical';
    
    // Calculate pricing with commission
    const pricingDetails = await CommissionService.calculateBuyerPrice(subtotal, deliveryType, marketplaceType);
    
    // For regular buyers, hide delivery fee (make it appear free)
    let customerVisibleDeliveryFee = 0;
    let deliveryFeeHidden = true;
    
    if (userRole === 'agent') {
      // Manual orders show real delivery fee
      customerVisibleDeliveryFee = pricingDetails.deliveryFee || 0;
      deliveryFeeHidden = false;
    }

    const response = {
      success: true,
      calculation: {
        subtotal: subtotal,
        deliveryFee: customerVisibleDeliveryFee, // What customer sees
        actualDeliveryFee: pricingDetails.deliveryFee || 0, // Real fee for backend
        deliveryFeeHidden: deliveryFeeHidden,
        taxAmount: 0, // No tax for now
        total: subtotal + customerVisibleDeliveryFee,
        actualTotal: pricingDetails.finalPrice, // Real total for backend
        platformMargin: pricingDetails.platformMargin,
        sellerPayout: pricingDetails.sellerPayout
      },
      deliveryMethod: 'home',
      deliveryType: 'home_delivery',
      isHomeDeliveryOnly: true,
      freeDeliveryMessage: userRole !== 'agent' ? 'Free home delivery included!' : null
    };

    console.log('🚚 Delivery calculation:', {
      userRole,
      subtotal,
      customerVisibleFee: customerVisibleDeliveryFee,
      actualFee: pricingDetails.deliveryFee,
      deliveryFeeHidden
    });

    res.json(response);

  } catch (error) {
    console.error('Error calculating delivery:', error);
    res.status(500).json({ error: 'Failed to calculate delivery cost' });
  }
});

// POST /api/orders/:id/confirm-delivery - Buyer confirms delivery and optionally rates the agent
router.post('/:id/confirm-delivery', requireAuth, async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.user.id;
    const { deliveryStatus, condition, rating, comments } = req.body || {};

    if (!deliveryStatus) {
      return res.status(400).json({ error: 'deliveryStatus is required' });
    }

    // Verify order exists and belongs to requesting user
    const [orders] = await pool.query(
      `SELECT id, user_id, agent_id, status FROM orders WHERE id = ? AND user_id = ?`,
      [orderId, userId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orders[0];

    // Determine new status based on buyer confirmation
    let newStatus = order.status;
    let updates = [];

    if (deliveryStatus === 'received') {
      // Mark delivered and completed
      newStatus = 'COMPLETED';
      updates.push("delivered_at = NOW()", "completed_at = NOW()");
    } else if (deliveryStatus === 'partial') {
      newStatus = 'PARTIALLY_RECEIVED';
      updates.push("delivered_at = NOW()");
    } else if (deliveryStatus === 'not_received') {
      newStatus = 'DELIVERY_ISSUE';
    }

    // Update order with new status and timestamps
    const setClause = updates.length ? `, ${updates.join(', ')}` : '';
    await pool.query(
      `UPDATE orders SET status = ?, updated_at = NOW()${setClause} WHERE id = ?`,
      [newStatus, orderId]
    );

    // Add order tracking log
    const noteParts = [];
    if (condition) noteParts.push(`condition: ${condition}`);
    if (comments) noteParts.push(`comments: ${comments}`);
    await pool.query(
      `INSERT INTO order_tracking (order_id, status, notes, created_at)
       VALUES (?, ?, ?, NOW())`,
      [orderId, deliveryStatus === 'received' ? 'buyer_confirmed_delivery' : deliveryStatus, noteParts.join(' | ')]
    );

    // Store rating for agent if provided and order has an assigned agent
    const numericRating = parseFloat(rating);
    if (order.agent_id && numericRating && numericRating > 0) {
      await pool.query(
        `INSERT INTO agent_ratings (agent_id, order_id, rating, comments, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [order.agent_id, orderId, Math.min(Math.max(numericRating, 1), 5), comments || null]
      );
    }

    return res.json({
      success: true,
      message: 'Delivery confirmation recorded successfully',
      status: newStatus
    });
  } catch (error) {
    console.error('Error confirming delivery:', error);
    return res.status(500).json({ error: 'Failed to confirm delivery' });
  }
});

/**
 * Simplified Buyer Delivery Confirmation (3-Status Workflow)
 * POST /api/buyer/orders/:id/confirm-delivery
 */
router.post('/buyer/orders/:id/confirm-delivery', requireAuth, async (req, res) => {
  try {
    const orderId = req.params.id;
    const buyerId = req.user.id;
    const { notes } = req.body;

    console.log(`[BUYER] Confirming delivery for order ${orderId} by buyer ${buyerId}`);

    // Check if order exists and belongs to this buyer
    const [orders] = await pool.execute(`
      SELECT id, status, seller_id, agent_id, total_amount, agent_commission
      FROM orders 
      WHERE id = ? AND buyer_id = ? AND status = 'DELIVERED'
    `, [orderId, buyerId]);

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found or not available for confirmation'
      });
    }

    const order = orders[0];

    // Update order status to COMPLETED
    await pool.execute(`
      UPDATE orders 
      SET status = 'COMPLETED', 
          completed_at = NOW(),
          buyer_confirmed_at = NOW(),
          updated_at = NOW()
      WHERE id = ?
    `, [orderId]);

    // Log status change
    await pool.execute(`
      INSERT INTO order_status_logs (order_id, old_status, new_status, changed_by, notes, created_at)
      VALUES (?, 'DELIVERED', 'COMPLETED', ?, ?, NOW())
    `, [orderId, buyerId, notes || 'Order confirmed by buyer']);

    // Notify seller that order is completed
    await pool.execute(`
      INSERT INTO notifications (user_id, title, message, type, order_id, created_at)
      VALUES (?, 'Order Completed', 'Buyer has confirmed delivery of the order', 'order_completed', ?, NOW())
    `, [order.seller_id, orderId]);

    // Notify agent if assigned
    if (order.agent_id) {
      await pool.execute(`
        INSERT INTO notifications (user_id, title, message, type, order_id, created_at)
        VALUES (?, 'Order Completed', 'Buyer has confirmed delivery of the order', 'order_completed', ?, NOW())
      `, [order.agent_id, orderId]);
    }

    res.json({
      success: true,
      message: 'Delivery confirmed successfully. Order completed.',
      order: {
        id: orderId,
        status: 'COMPLETED',
        completed_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[BUYER] Error confirming delivery:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to confirm delivery'
    });
  }
});

// ===== ENHANCED DELIVERY CONFIRMATION ENDPOINTS =====

// POST /api/orders/:id/confirm-delivery - Enhanced delivery confirmation with verification code
router.post('/:id/confirm-delivery', requireAuth, async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.user.id;
    const { 
      verificationCode, 
      rating, 
      feedback, 
      conditionChecks,
      confirmedAt 
    } = req.body;

    console.log(`[DELIVERY CONFIRMATION] Order ${orderId} by user ${userId}`);

    // Verify order exists and belongs to user
    const [orders] = await pool.query(`
      SELECT o.*, 
             a.id as agent_id, 
             a.user_id as agent_user_id,
             u_agent.name as agent_name,
             u_agent.phone as agent_phone,
             u_buyer.name as buyer_name,
             u_buyer.email as buyer_email
      FROM orders o
      LEFT JOIN agents a ON o.agent_id = a.id
      LEFT JOIN users u_agent ON a.user_id = u_agent.id
      LEFT JOIN users u_buyer ON o.user_id = u_buyer.id
      WHERE o.id = ? AND o.user_id = ? AND o.status = 'shipped'
    `, [orderId, userId]);

    if (orders.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Order not found or not available for confirmation' 
      });
    }

    const order = orders[0];

    // Verify delivery code if provided
    if (verificationCode && order.delivery_code) {
      if (verificationCode !== order.delivery_code) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid verification code' 
        });
      }
    }

    // Update order status to delivered
    await pool.query(`
      UPDATE orders SET 
        status = 'delivered',
        delivered_at = NOW(),
        delivery_confirmed_at = NOW(),
        delivery_confirmation_data = ?,
        updated_at = NOW()
      WHERE id = ?
    `, [
      JSON.stringify({
        verificationCode: verificationCode,
        conditionChecks: conditionChecks,
        confirmedAt: confirmedAt || new Date().toISOString(),
        rating: rating,
        feedback: feedback
      }),
      orderId
    ]);

    // Add delivery confirmation to tracking history
    await pool.query(`
      INSERT INTO order_tracking (order_id, status, notes, created_at)
      VALUES (?, 'delivered', ?, NOW())
    `, [orderId, `Delivery confirmed by buyer${feedback ? ` - Feedback: ${feedback}` : ''}`]);

    // Save agent rating if provided
    if (rating && order.agent_id && rating > 0) {
      await pool.query(`
        INSERT INTO agent_reviews (agent_id, buyer_id, order_id, rating, comment, created_at)
        VALUES (?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE 
          rating = VALUES(rating), 
          comment = VALUES(comment),
          updated_at = NOW()
      `, [order.agent_id, userId, orderId, Math.min(Math.max(rating, 1), 5), feedback || null]);

      // Update agent's average rating
      const [avgRating] = await pool.query(`
        SELECT AVG(rating) as avg_rating, COUNT(*) as total_reviews
        FROM agent_reviews WHERE agent_id = ?
      `, [order.agent_id]);

      await pool.query(`
        UPDATE agents SET 
          rating = ?,
          total_reviews = ?,
          updated_at = NOW()
        WHERE id = ?
      `, [avgRating[0].avg_rating || 0, avgRating[0].total_reviews || 0, order.agent_id]);
    }

    // Update agent status back to available if they were assigned
    if (order.agent_id) {
      await pool.query(`
        UPDATE agents SET 
          status = 'available',
          total_deliveries = total_deliveries + 1,
          successful_deliveries = successful_deliveries + 1,
          updated_at = NOW()
        WHERE id = ?
      `, [order.agent_id]);

      // Mark agent earnings as completed
      await pool.query(`
        UPDATE agent_earnings SET 
          status = 'completed', 
          completed_at = NOW()
        WHERE order_id = ? AND agent_id = ?
      `, [orderId, order.agent_id]);
    }

    // Send delivery confirmation email to customer
    try {
      const { sendDeliveryCompletionToCustomer } = require('../utils/mailer');
      
      if (order.buyer_email && order.agent_name) {
        await sendDeliveryCompletionToCustomer(
          order.buyer_email,
          {
            order_number: order.order_number,
            customer_name: order.buyer_name,
            total_amount: order.total_amount
          },
          {
            name: order.agent_name,
            phone: order.agent_phone
          }
        );
      }
    } catch (emailError) {
      console.error('Failed to send delivery confirmation email:', emailError);
      // Don't fail the request if email fails
    }

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${userId}`).emit('order_delivered', {
        orderId: orderId,
        status: 'delivered',
        message: 'Your order has been delivered successfully!',
        timestamp: new Date().toISOString()
      });

      // Notify agent if assigned
      if (order.agent_user_id) {
        io.to(`user_${order.agent_user_id}`).emit('delivery_confirmed', {
          orderId: orderId,
          rating: rating,
          feedback: feedback,
          message: 'Buyer has confirmed delivery',
          timestamp: new Date().toISOString()
        });
      }
    }

    res.json({
      success: true,
      message: 'Delivery confirmed successfully!',
      order: {
        id: orderId,
        status: 'delivered',
        delivered_at: new Date().toISOString(),
        rating: rating || null
      }
    });

  } catch (error) {
    console.error('Error confirming delivery:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to confirm delivery. Please try again.' 
    });
  }
});

// POST /api/orders/:id/report-issue - Report delivery issue
router.post('/:id/report-issue', requireAuth, async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.user.id;
    const { issueDescription, reportedAt, agentInfo } = req.body;

    console.log(`[DELIVERY ISSUE] Order ${orderId} reported by user ${userId}`);

    // Verify order exists and belongs to user
    const [orders] = await pool.query(`
      SELECT o.*, 
             u.name as buyer_name,
             u.email as buyer_email
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.id = ? AND o.user_id = ?
    `, [orderId, userId]);

    if (orders.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Order not found' 
      });
    }

    const order = orders[0];

    // Create delivery issue record
    await pool.query(`
      INSERT INTO delivery_issues (
        order_id, 
        buyer_id, 
        agent_id, 
        issue_description, 
        agent_info, 
        status, 
        reported_at,
        created_at
      ) VALUES (?, ?, ?, ?, ?, 'open', ?, NOW())
    `, [
      orderId, 
      userId, 
      order.agent_id, 
      issueDescription,
      JSON.stringify(agentInfo || {}),
      reportedAt || new Date().toISOString()
    ]);

    // Add to order tracking
    await pool.query(`
      INSERT INTO order_tracking (order_id, status, notes, created_at)
      VALUES (?, 'issue_reported', ?, NOW())
    `, [orderId, `Delivery issue reported: ${issueDescription}`]);

    // Update order status to indicate issue
    await pool.query(`
      UPDATE orders SET 
        status = 'delivery_issue',
        updated_at = NOW()
      WHERE id = ?
    `, [orderId]);

    // Send notification to admin
    try {
      const { sendTemplatedEmail } = require('../utils/mailer');
      
      const [admins] = await pool.query('SELECT email FROM users WHERE role = "admin" LIMIT 1');
      if (admins.length > 0) {
        await sendTemplatedEmail(
          admins[0].email,
          `Delivery Issue Reported - Order #${order.order_number}`,
          'admin-delivery-issue',
          {
            orderNumber: order.order_number,
            customerName: order.buyer_name,
            customerEmail: order.buyer_email,
            issueDescription: issueDescription,
            agentInfo: agentInfo,
            reportedAt: reportedAt || new Date().toISOString(),
            adminDashboardUrl: `${process.env.BASE_URL || 'http://localhost:3002'}/admin/delivery-issues.html`
          }
        );
      }
    } catch (emailError) {
      console.error('Failed to send delivery issue notification:', emailError);
    }

    // Emit real-time notification
    const io = req.app.get('io');
    if (io) {
      // Notify admins
      io.emit('delivery_issue_reported', {
        orderId: orderId,
        orderNumber: order.order_number,
        customerName: order.buyer_name,
        issueDescription: issueDescription,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'Issue reported successfully. Our support team will contact you soon.',
      issueId: orderId,
      status: 'reported'
    });

  } catch (error) {
    console.error('Error reporting delivery issue:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to report issue. Please try again.' 
    });
  }
});

module.exports = router; 
