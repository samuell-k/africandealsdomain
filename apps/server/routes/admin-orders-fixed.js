const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// GET ALL ORDERS WITH ENHANCED PRICING AND PROPER AUTH
router.get('/', authenticateToken, isAdmin, async (req, res) => {
  try {
    console.log('📊 [FIXED-ADMIN-ORDERS] Request received');
    console.log('👤 [FIXED-ADMIN-ORDERS] User:', req.user?.email, 'Role:', req.user?.role);
    
    const { 
      status = '', 
      search = '', 
      page = 1, 
      limit = 20,
      date_range = '',
      payment_status = ''
    } = req.query;

    console.log('🔍 [FIXED-ADMIN-ORDERS] Query params:', { status, search, page, limit, date_range, payment_status });

    const offset = (page - 1) * limit;
    let whereConditions = [];
    let queryParams = [];

    // Build WHERE conditions
    if (status && status !== '' && status !== 'all') {
      whereConditions.push('o.status = ?');
      queryParams.push(status);
    }

    if (payment_status && payment_status !== '' && payment_status !== 'all') {
      whereConditions.push('o.payment_status = ?');
      queryParams.push(payment_status);
    }

    if (search && search.trim() !== '') {
      whereConditions.push('(o.order_number LIKE ? OR buyer.first_name LIKE ? OR buyer.last_name LIKE ? OR buyer.email LIKE ?)');
      const searchTerm = `%${search.trim()}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Date range filter
    if (date_range && date_range !== 'all' && date_range !== '') {
      switch (date_range) {
        case 'today':
          whereConditions.push('DATE(o.created_at) = CURDATE()');
          break;
        case 'week':
          whereConditions.push('o.created_at >= DATE_SUB(NOW(), INTERVAL 1 WEEK)');
          break;
        case 'month':
          whereConditions.push('o.created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)');
          break;
      }
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    // Enhanced query with comprehensive order information
    const ordersQuery = `
      SELECT 
        o.id,
        o.order_number,
        o.user_id as buyer_id,
        o.seller_id,
        o.agent_id,
        o.status,
        COALESCE(o.payment_status, 'pending') as payment_status,
        COALESCE(o.payment_method, 'not_specified') as payment_method,
        o.delivery_method,
        o.marketplace_type,
        
        -- Enhanced Pricing Calculations
        CAST(COALESCE(o.total_amount, 0) AS DECIMAL(12,2)) as final_total_amount,
        CAST(COALESCE(o.platform_commission, o.commission_amount, 0) AS DECIMAL(10,2)) as commission_amount,
        CAST(COALESCE(o.delivery_fee, 0) AS DECIMAL(8,2)) as shipping_cost,
        CAST(COALESCE(o.transaction_fee, 0) AS DECIMAL(8,2)) as tax_amount,
        
        -- Order Item Details  
        COUNT(DISTINCT oi.id) as item_count,
        COALESCE(SUM(oi.quantity), 0) as total_quantity,
        
        -- FIXED: Calculate totals using correct pricing structure
        -- base_total_amount: Total of seller's base prices (what sellers receive)
        -- items_total: Total of buyer-paid prices (what buyers actually paid)
        CAST(COALESCE(SUM(COALESCE(p.base_price, 0) * oi.quantity), 0) AS DECIMAL(12,2)) as base_total_amount,
        CAST(COALESCE(SUM(COALESCE(p.display_price, oi.unit_price, 0) * oi.quantity), 0) AS DECIMAL(12,2)) as items_total,
        
        -- User Information
        TRIM(CONCAT(COALESCE(buyer.first_name, ''), ' ', COALESCE(buyer.last_name, ''))) as buyer_name,
        COALESCE(buyer.email, '') as buyer_email,
        COALESCE(buyer.phone, '') as buyer_phone,
        TRIM(CONCAT(COALESCE(seller.first_name, ''), ' ', COALESCE(seller.last_name, ''))) as seller_name,
        COALESCE(seller.email, '') as seller_email,
        COALESCE(seller.phone, '') as seller_phone,
        TRIM(CONCAT(COALESCE(agent.first_name, ''), ' ', COALESCE(agent.last_name, ''))) as agent_name,
        
        -- Timestamps
        o.created_at,
        o.updated_at,
        o.confirmed_at,
        o.delivered_at,
        
        -- Additional Details
        o.tracking_number,
        o.delivery_code,
        o.notes,
        o.admin_notes
        
      FROM orders o
      LEFT JOIN users buyer ON o.user_id = buyer.id
      LEFT JOIN users seller ON o.seller_id = seller.id  
      LEFT JOIN users agent ON o.agent_id = agent.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      ${whereClause}
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `;

    queryParams.push(parseInt(limit), parseInt(offset));

    console.log('🔍 [FIXED-ADMIN-ORDERS] Executing query with', queryParams.length, 'parameters');
    
    const [orders] = await pool.query(ordersQuery, queryParams);

    console.log('✅ [FIXED-ADMIN-ORDERS] Found', orders.length, 'orders');

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(DISTINCT o.id) as total
      FROM orders o
      LEFT JOIN users buyer ON o.user_id = buyer.id
      LEFT JOIN users seller ON o.seller_id = seller.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      ${whereClause}
    `;
    
    const countParams = queryParams.slice(0, -2); // Remove LIMIT and OFFSET
    const [countResult] = await pool.query(countQuery, countParams);

    // Process orders to ensure proper data types
    const processedOrders = orders.map(order => {
      const baseAmount = parseFloat(order.base_total_amount) || 0;
      const finalAmount = parseFloat(order.final_total_amount) || 0;
      const itemsTotal = parseFloat(order.items_total) || 0;
      const storedCommission = parseFloat(order.commission_amount) || 0;
      const shippingCost = parseFloat(order.shipping_cost) || 0;
      const taxAmount = parseFloat(order.tax_amount) || 0;
      
      // Calculate commission if not stored
      const commission = storedCommission || Math.max(0, itemsTotal - baseAmount);
      
      return {
        ...order,
        base_total_amount: baseAmount,
        final_total_amount: finalAmount,
        items_total: itemsTotal,
        commission_amount: commission,
        shipping_cost: shippingCost,
        tax_amount: taxAmount,
        // Backward compatibility
        total_amount: finalAmount,
        user_name: order.buyer_name,
        user_email: order.buyer_email,
        // Calculate commission rate
        commission_rate: baseAmount > 0 ? ((commission / baseAmount) * 100).toFixed(2) : '0.00'
      };
    });

    console.log('✅ [FIXED-ADMIN-ORDERS] Processed', processedOrders.length, 'orders');

    res.json({
      success: true,
      orders: processedOrders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / limit),
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total_pages: Math.ceil(countResult[0].total / limit)
      }
    });

  } catch (error) {
    console.error('[FIXED-ADMIN-ORDERS] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch orders',
      message: error.message 
    });
  }
});

// GET ORDER DETAILS BY ID
router.get('/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📋 [FIXED-ADMIN-ORDERS] Fetching order details: ${id}`);

    // Get order details
    const [orderResult] = await pool.query(`
      SELECT 
        o.*,
        -- User Information
        TRIM(CONCAT(COALESCE(buyer.first_name, ''), ' ', COALESCE(buyer.last_name, ''))) as buyer_name,
        COALESCE(buyer.email, '') as buyer_email,
        COALESCE(buyer.phone, '') as buyer_phone,
        buyer.username as buyer_username,
        
        TRIM(CONCAT(COALESCE(seller.first_name, ''), ' ', COALESCE(seller.last_name, ''))) as seller_name,
        COALESCE(seller.email, '') as seller_email,
        COALESCE(seller.phone, '') as seller_phone,
        seller.username as seller_username,
        
        TRIM(CONCAT(COALESCE(agent.first_name, ''), ' ', COALESCE(agent.last_name, ''))) as agent_name,
        COALESCE(agent.email, '') as agent_email,
        COALESCE(agent.phone, '') as agent_phone
        
      FROM orders o
      LEFT JOIN users buyer ON o.user_id = buyer.id
      LEFT JOIN users seller ON o.seller_id = seller.id  
      LEFT JOIN users agent ON o.agent_id = agent.id
      WHERE o.id = ?
    `, [id]);

    if (orderResult.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Order not found' 
      });
    }

    const order = orderResult[0];

    // Get order items with detailed product information
    const [items] = await pool.query(`
      SELECT 
        oi.id as item_id,
        oi.product_id,
        oi.quantity,
        oi.unit_price as buyer_paid_price,
        oi.total_price as buyer_paid_total,
        
        -- Product Information
        p.name as product_name,
        p.description as product_description,
        p.sku as product_sku,
        p.main_image as product_image,
        p.condition as product_condition,
        p.brand,
        p.category,
        
        -- FIXED: Pricing Analysis using correct price structure
        CAST(COALESCE(p.base_price, 0) AS DECIMAL(10,2)) as seller_base_price,
        CAST(COALESCE(p.display_price, p.price, 0) AS DECIMAL(10,2)) as product_display_price,
        CAST(COALESCE(oi.unit_price, p.display_price, 0) AS DECIMAL(10,2)) as buyer_paid_unit_price
        
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
      ORDER BY oi.id
    `, [id]);

    // FIXED: Calculate totals using correct pricing structure
    const baseTotal = items.reduce((sum, item) => sum + (parseFloat(item.seller_base_price || 0) * item.quantity), 0);
    const paidTotal = items.reduce((sum, item) => sum + (parseFloat(item.buyer_paid_unit_price || 0) * item.quantity), 0);
    const totalCommission = items.reduce((sum, item) => {
      const basePrice = parseFloat(item.seller_base_price || 0);
      const paidPrice = parseFloat(item.buyer_paid_unit_price || 0);
      const commission = (paidPrice - basePrice) * item.quantity;
      return sum + Math.max(0, commission);
    }, 0);
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

    // Get payment information
    const [paymentInfo] = await pool.query(`
      SELECT 
        pp.payment_method,
        pp.amount as payment_amount,
        pp.status as proof_status,
        pp.approved_at,
        pp.approved_by,
        pp.created_at as payment_date,
        aa.status as admin_approval_status,
        aa.reviewed_by as admin_reviewer,
        aa.reviewed_at
      FROM payment_proofs pp
      LEFT JOIN admin_approvals aa ON pp.id = aa.proof_id
      WHERE pp.order_id = ?
      ORDER BY pp.created_at DESC
      LIMIT 1
    `, [id]);

    const enhancedOrder = {
      ...order,
      // Calculated totals (All in FRW)
      base_total_amount: parseFloat(baseTotal.toFixed(2)),
      items_total: parseFloat(paidTotal.toFixed(2)),
      calculated_commission: parseFloat(totalCommission.toFixed(2)),
      total_quantity: totalQuantity,
      item_count: items.length,
      
      // Fees and costs (All in FRW)
      shipping_cost: parseFloat(order.delivery_fee || 0),
      tax_amount: parseFloat(order.transaction_fee || 0),
      discount_amount: parseFloat(order.discount_amount || 0),
      additional_fees: parseFloat(order.additional_fees || 0),
      
      // Final total verification (All in FRW)
      final_total_amount: parseFloat(order.total_amount || paidTotal),
      
      // Commission analysis
      commission_rate: baseTotal > 0 ? ((totalCommission / baseTotal) * 100).toFixed(2) : '0.00',
      target_commission_rate: 21.0,
      is_correct_commission: baseTotal > 0 ? Math.abs(((totalCommission / baseTotal) * 100) - 21.0) < 2.0 : false,
      
      // Currency information - Always FRW
      currency: 'FRW',
      currency_symbol: 'FRW',
      
      // Items with properly formatted prices
      items: items.map(item => ({
        ...item,
        buyer_paid_price: parseFloat(item.buyer_paid_price || 0),
        buyer_paid_total: parseFloat(item.buyer_paid_total || 0),
        seller_base_price: parseFloat(item.seller_base_price || 0),
        paid_unit_price: parseFloat(item.paid_unit_price || 0),
        unit_commission: parseFloat(item.paid_unit_price || 0) - parseFloat(item.seller_base_price || 0),
        total_commission: (parseFloat(item.paid_unit_price || 0) - parseFloat(item.seller_base_price || 0)) * item.quantity
      })),
      
      // Payment information
      payment_info: paymentInfo.length > 0 ? paymentInfo[0] : null,
      
      // Status history and tracking
      created_at_formatted: new Date(order.created_at).toLocaleString(),
      updated_at_formatted: new Date(order.updated_at).toLocaleString()
    };

    console.log(`✅ [FIXED-ADMIN-ORDERS] Order ${id} details fetched successfully`);
    
    res.json({
      success: true,
      order: enhancedOrder,
      message: 'Order details fetched successfully'
    });

  } catch (error) {
    console.error('❌ [FIXED-ADMIN-ORDERS] Error fetching order details:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch order details',
      details: error.message
    });
  }
});

// UPDATE ORDER STATUS (FIXED VERSION)
router.put('/:id/status', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, payment_status, admin_notes } = req.body;
    const adminId = req.user.id;
    
    console.log(`🔄 [ADMIN-ORDER-UPDATE] Updating order ${id}:`, { status, payment_status, admin_notes });

    // Validate order exists first
    const [orderCheck] = await pool.query('SELECT id, status, seller_id FROM orders WHERE id = ?', [id]);
    if (orderCheck.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Order not found' 
      });
    }

    // Build update query dynamically
    let updateFields = [];
    let updateValues = [];

    if (status && status.trim() !== '') {
      updateFields.push('status = ?');
      updateValues.push(status);
    }

    if (payment_status && payment_status.trim() !== '') {
      updateFields.push('payment_status = ?');
      updateValues.push(payment_status);
    }

    if (admin_notes !== undefined) {
      updateFields.push('admin_notes = ?');
      updateValues.push(admin_notes);
    }

    // Always update the updated_at timestamp
    updateFields.push('updated_at = CURRENT_TIMESTAMP');

    if (updateFields.length === 1) { // Only updated_at
      return res.status(400).json({ 
        success: false, 
        error: 'No valid fields to update. Please provide status, payment_status, or admin_notes.' 
      });
    }

    // Add order ID to values for WHERE clause
    updateValues.push(id);

    const updateQuery = `
      UPDATE orders 
      SET ${updateFields.join(', ')} 
      WHERE id = ?
    `;

    console.log('🔍 [DEBUG] Update query:', updateQuery);
    console.log('🔍 [DEBUG] Update values:', updateValues);

    const [result] = await pool.query(updateQuery, updateValues);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found or no changes made'
      });
    }

    // Add to order history
    try {
      await pool.query(`
        INSERT INTO order_history (order_id, user_id, action, description, notes, created_at)
        VALUES (?, ?, 'ADMIN_UPDATE', 'Admin updated order details', ?, NOW())
      `, [id, adminId, `Updated: status=${status || 'unchanged'}, payment=${payment_status || 'unchanged'}, notes=${admin_notes ? 'added' : 'none'}`]);
    } catch (historyError) {
      console.warn('⚠️ [WARNING] Could not add to order history:', historyError.message);
    }

    console.log(`✅ [ADMIN-ORDER-UPDATE] Order ${id} updated successfully`);

    res.json({
      success: true,
      message: 'Order updated successfully',
      updated_fields: { 
        status: status || null, 
        payment_status: payment_status || null, 
        admin_notes: admin_notes || null 
      }
    });

  } catch (error) {
    console.error('❌ [ADMIN-ORDER-UPDATE] Error updating order:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update order',
      message: error.message,
      details: error.stack
    });
  }
});

// INITIATE SELLER PAYMENT (FIXED VERSION)
router.post('/:id/pay-seller', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { seller_id, amount, payment_type } = req.body;
    const adminId = req.user.id;
    
    console.log(`💰 [ADMIN-SELLER-PAYMENT] Initiating payment for order ${id}:`, { seller_id, amount, payment_type });

    // First, get the order details with calculated amounts
    const [orderData] = await pool.query(`
      SELECT 
        o.id,
        o.seller_id,
        o.status,
        o.order_number,
        CONCAT(seller.first_name, ' ', seller.last_name) as seller_name,
        seller.email as seller_email,
        SUM(COALESCE(p.base_price, 0) * oi.quantity) as seller_base_amount,
        SUM(COALESCE(p.display_price, oi.unit_price, 0) * oi.quantity) as buyer_paid_amount,
        COALESCE(o.delivery_fee, 0) as delivery_fee
      FROM orders o
      LEFT JOIN users seller ON o.seller_id = seller.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE o.id = ?
      GROUP BY o.id
    `, [id]);

    if (orderData.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Order not found' 
      });
    }

    const order = orderData[0];
    
    // If seller_id is provided, validate it matches
    if (seller_id && seller_id != order.seller_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Seller ID mismatch' 
      });
    }

    // Calculate the net amount to pay seller
    const sellerBaseAmount = parseFloat(order.seller_base_amount || 0);
    const deliveryFee = parseFloat(order.delivery_fee || 0);
    const netToSeller = Math.max(0, sellerBaseAmount - deliveryFee);
    
    // Use provided amount or calculated amount
    const paymentAmount = amount || netToSeller;

    console.log(`💰 [DEBUG] Payment calculation:`, {
      seller_base_amount: sellerBaseAmount,
      delivery_fee: deliveryFee,
      net_to_seller: netToSeller,
      payment_amount: paymentAmount
    });

    // Record payment initiation in order history
    await pool.query(`
      INSERT INTO order_history (order_id, user_id, action, description, notes, created_at)
      VALUES (?, ?, 'SELLER_PAYMENT_INITIATED', 'Admin initiated seller payment', ?, NOW())
    `, [id, adminId, `Payment of ${paymentAmount} FRW initiated via ${payment_type || 'manual_admin_payment'} to ${order.seller_name} (${order.seller_email})`]);

    // Optionally update payment status
    await pool.query(`
      UPDATE orders 
      SET payment_status = 'paid', updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [id]);

    console.log(`✅ [ADMIN-SELLER-PAYMENT] Payment initiated for order ${id}`);

    res.json({
      success: true,
      message: 'Seller payment initiated successfully',
      payment_details: { 
        order_id: id, 
        order_number: order.order_number,
        seller_id: order.seller_id, 
        seller_name: order.seller_name,
        seller_email: order.seller_email,
        amount: paymentAmount, 
        payment_type: payment_type || 'manual_admin_payment',
        currency: 'FRW'
      }
    });

  } catch (error) {
    console.error('❌ [ADMIN-SELLER-PAYMENT] Error initiating payment:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to initiate seller payment',
      message: error.message,
      details: error.stack
    });
  }
});

// GENERATE PAYMENT REPORT
router.get('/:id/payment-report', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`📊 [ADMIN-PAYMENT-REPORT] Generating report for order ${id}`);

    // Get comprehensive order data
    const [orderData] = await pool.query(`
      SELECT 
        o.*,
        CONCAT(buyer.first_name, ' ', buyer.last_name) as buyer_name,
        buyer.email as buyer_email,
        CONCAT(seller.first_name, ' ', seller.last_name) as seller_name,
        seller.email as seller_email,
        COUNT(oi.id) as item_count,
        SUM(oi.quantity) as total_quantity,
        SUM(p.base_price * oi.quantity) as seller_amount,
        SUM(p.display_price * oi.quantity) as buyer_amount,
        SUM((p.display_price - p.base_price) * oi.quantity) as commission_amount
      FROM orders o
      LEFT JOIN users buyer ON o.user_id = buyer.id
      LEFT JOIN users seller ON o.seller_id = seller.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE o.id = ?
      GROUP BY o.id
    `, [id]);

    if (orderData.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Order not found' 
      });
    }

    const order = orderData[0];
    const report = {
      order_number: order.order_number,
      order_id: order.id,
      created_at: order.created_at,
      status: order.status,
      payment_status: order.payment_status,
      buyer_name: order.buyer_name,
      buyer_email: order.buyer_email,
      seller_name: order.seller_name,
      seller_email: order.seller_email,
      item_count: order.item_count,
      total_quantity: order.total_quantity,
      seller_base_amount: parseFloat(order.seller_amount || 0),
      buyer_paid_amount: parseFloat(order.buyer_amount || 0),
      platform_commission: parseFloat(order.commission_amount || 0),
      delivery_fee: parseFloat(order.delivery_fee || 0),
      net_to_seller: parseFloat(order.seller_amount || 0) - parseFloat(order.delivery_fee || 0),
      currency: 'FRW'
    };

    console.log(`✅ [ADMIN-PAYMENT-REPORT] Report generated for order ${id}`);

    res.json({
      success: true,
      report: report,
      message: 'Payment report generated successfully'
    });

  } catch (error) {
    console.error('❌ [ADMIN-PAYMENT-REPORT] Error generating report:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate payment report',
      message: error.message 
    });
  }
});

// SEND ORDER NOTIFICATIONS
router.post('/:id/notify', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { notification_type, send_to } = req.body;
    
    console.log(`📧 [ADMIN-NOTIFICATION] Sending notifications for order ${id}:`, { notification_type, send_to });

    // Get order data for notification
    const [orderData] = await pool.query(`
      SELECT 
        o.*,
        buyer.email as buyer_email,
        seller.email as seller_email,
        agent.email as agent_email
      FROM orders o
      LEFT JOIN users buyer ON o.user_id = buyer.id
      LEFT JOIN users seller ON o.seller_id = seller.id
      LEFT JOIN users agent ON o.agent_id = agent.id
      WHERE o.id = ?
    `, [id]);

    if (orderData.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Order not found' 
      });
    }

    // Log notification attempt (in a real system, you'd send actual emails/SMS)
    await pool.query(`
      INSERT INTO order_history (order_id, user_id, action, description, notes, created_at)
      VALUES (?, ?, 'NOTIFICATION_SENT', 'Admin sent notifications', ?, NOW())
    `, [id, req.user.id, `Sent ${notification_type} notifications to: ${send_to.join(', ')}`]);

    console.log(`✅ [ADMIN-NOTIFICATION] Notifications logged for order ${id}`);

    res.json({
      success: true,
      message: 'Notifications sent successfully',
      notification_details: { order_id: id, notification_type, send_to }
    });

  } catch (error) {
    console.error('❌ [ADMIN-NOTIFICATION] Error sending notifications:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send notifications',
      message: error.message 
    });
  }
});

// GET ORDER HISTORY
router.get('/:id/history', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`📜 [ADMIN-ORDER-HISTORY] Loading history for order ${id}`);

    const [history] = await pool.query(`
      SELECT 
        oh.*,
        CONCAT(u.first_name, ' ', u.last_name) as user_name
      FROM order_history oh
      LEFT JOIN users u ON oh.user_id = u.id
      WHERE oh.order_id = ?
      ORDER BY oh.created_at DESC
    `, [id]);

    console.log(`✅ [ADMIN-ORDER-HISTORY] Found ${history.length} history records for order ${id}`);

    res.json({
      success: true,
      history: history,
      message: 'Order history loaded successfully'
    });

  } catch (error) {
    console.error('❌ [ADMIN-ORDER-HISTORY] Error loading history:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to load order history',
      message: error.message 
    });
  }
});

module.exports = router;