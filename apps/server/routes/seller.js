const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth, requireRole } = require('./auth');

// GET /api/seller/stats - Get seller dashboard statistics
router.get('/stats', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const sellerId = req.user.id;
    
    // Get total sales (seller earnings only - base price without commission)
    const [salesResult] = await pool.execute(`
      SELECT COALESCE(SUM(oi.quantity * p.base_price), 0) as total_sales
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN products p ON oi.product_id = p.id
      WHERE p.seller_id = ? AND o.status IN ('delivered', 'completed')
    `, [sellerId]);
    
    // Get pending orders count
    const [pendingResult] = await pool.execute(`
      SELECT COUNT(DISTINCT o.id) as pending_count
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      WHERE p.seller_id = ? AND o.status = 'pending'
    `, [sellerId]);
    
    // Get out of stock products count
    const [stockResult] = await pool.execute(`
      SELECT COUNT(*) as out_of_stock
      FROM products
      WHERE seller_id = ? AND stock_quantity <= 0 AND is_active = 1
    `, [sellerId]);
    
    // Get unread messages count
    const [messagesResult] = await pool.execute(`
      SELECT COUNT(*) as unread_messages
      FROM messages
      WHERE recipient_id = ? AND is_read = 0
    `, [sellerId]);
    
    res.json({
      success: true,
      totalSales: parseFloat(salesResult[0]?.total_sales || 0),
      pendingOrders: parseInt(pendingResult[0]?.pending_count || 0),
      outOfStock: parseInt(stockResult[0]?.out_of_stock || 0),
      newMessages: parseInt(messagesResult[0]?.unread_messages || 0)
    });
  } catch (error) {
    console.error('Error fetching seller stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch seller statistics'
    });
  }
});

// GET /api/seller/analytics - Get seller analytics data
router.get('/analytics', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const sellerId = req.user.id;
    
    // Mock analytics data for now
    const analyticsData = {
      totalSales: 15420.50,
      totalOrders: 127,
      totalVisitors: 2847,
      salesChange: 12.5,
      ordersChange: 8.3,
      visitorsChange: 15.7,
      avgOrderValue: 121.42,
      conversionRate: 4.5,
      repeatCustomers: 23,
      topProduct: 'Smartphone X',
      salesTrend: [
        { date: '2024-01-01', sales: 1200 },
        { date: '2024-01-02', sales: 1400 },
        { date: '2024-01-03', sales: 1100 },
        { date: '2024-01-04', sales: 1600 },
        { date: '2024-01-05', sales: 1800 },
        { date: '2024-01-06', sales: 1500 },
        { date: '2024-01-07', sales: 2000 }
      ],
      orderStatus: [
        { status: 'Pending', count: 15 },
        { status: 'Processing', count: 25 },
        { status: 'Shipped', count: 45 },
        { status: 'Delivered', count: 42 }
      ],
      recentActivity: [
        { type: 'order', message: 'New order #1234 received', time: '2 minutes ago' },
        { type: 'sale', message: 'Product "Smartphone X" sold', time: '15 minutes ago' },
        { type: 'review', message: 'New 5-star review received', time: '1 hour ago' },
        { type: 'stock', message: 'Low stock alert for "Laptop Pro"', time: '2 hours ago' }
      ]
    };
    
    res.json({
      success: true,
      ...analyticsData
    });
  } catch (error) {
    console.error('Error fetching seller analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics'
    });
  }
});

// GET /api/seller/profile - Get seller profile
router.get('/profile', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const sellerId = req.user.id;
    
    const [userResult] = await pool.execute(`
      SELECT id, name, email, phone, created_at
      FROM users
      WHERE id = ?
    `, [sellerId]);
    
    if (userResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Seller not found'
      });
    }
    
    const user = userResult[0];
    
    // Get store statistics
    const [statsResult] = await pool.execute(`
      SELECT 
        COUNT(*) as total_products,
        COALESCE(SUM(CASE WHEN stock_quantity <= 0 THEN 1 ELSE 0 END), 0) as out_of_stock
      FROM products
      WHERE seller_id = ?
    `, [sellerId]);
    
    const [ordersResult] = await pool.execute(`
      SELECT COUNT(DISTINCT o.id) as total_orders
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      WHERE p.seller_id = ?
    `, [sellerId]);
    
    const [salesResult] = await pool.execute(`
      SELECT COALESCE(SUM(oi.quantity * p.base_price), 0) as total_sales
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN products p ON oi.product_id = p.id
      WHERE p.seller_id = ? AND o.status IN ('delivered', 'completed')
    `, [sellerId]);
    
    res.json({
      success: true,
      name: user.name,
      email: user.email,
      phone: user.phone,
      store: `${user.name}'s Store`,
      totalProducts: parseInt(statsResult[0]?.total_products || 0),
      totalOrders: parseInt(ordersResult[0]?.total_orders || 0),
      totalSales: parseFloat(salesResult[0]?.total_sales || 0),
      rating: 4.8,
      emailVerified: true,
      phoneVerified: true,
      storeVerified: true
    });
  } catch (error) {
    console.error('Error fetching seller profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile'
    });
  }
});

// GET /api/seller/wallet - Get seller wallet
router.get('/wallet', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const sellerId = req.user.id;
    
    // Mock wallet data for now
    const walletData = {
      balance: 2547.80,
      transactions: [
        {
          id: 1,
          type: 'Earnings',
          amount: 125.50,
          date: '2024-01-15T10:30:00Z',
          status: 'completed',
          description: 'Product sale - Smartphone X'
        },
        {
          id: 2,
          type: 'Withdrawal',
          amount: -500.00,
          date: '2024-01-14T15:45:00Z',
          status: 'completed',
          description: 'Bank transfer to Equity Bank'
        },
        {
          id: 3,
          type: 'Earnings',
          amount: 89.99,
          date: '2024-01-13T09:15:00Z',
          status: 'completed',
          description: 'Product sale - Laptop Pro'
        },
        {
          id: 4,
          type: 'Top Up',
          amount: 200.00,
          date: '2024-01-12T14:20:00Z',
          status: 'completed',
          description: 'Mobile money deposit'
        }
      ]
    };
    
    res.json({
      success: true,
      ...walletData
    });
  } catch (error) {
    console.error('Error fetching seller wallet:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch wallet'
    });
  }
});

// POST /api/seller/wallet/withdraw - Withdraw funds
router.post('/wallet/withdraw', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const { amount, bankAccount } = req.body;
    
    if (!amount || !bankAccount) {
      return res.status(400).json({
        success: false,
        error: 'Amount and bank account are required'
      });
    }
    
    // Mock withdrawal processing
    res.json({
      success: true,
      message: 'Withdrawal request submitted successfully',
      transactionId: Date.now()
    });
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process withdrawal'
    });
  }
});

// POST /api/seller/wallet/topup - Top up wallet
router.post('/wallet/topup', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const { amount, paymentMethod } = req.body;
    
    if (!amount || !paymentMethod) {
      return res.status(400).json({
        success: false,
        error: 'Amount and payment method are required'
      });
    }
    
    // Mock top up processing
    res.json({
      success: true,
      message: 'Top up request submitted successfully',
      transactionId: Date.now()
    });
  } catch (error) {
    console.error('Error processing top up:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process top up'
    });
  }
});

// POST /api/seller/support - Submit support ticket
router.post('/support', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const { subject, priority, message, urgent } = req.body;
    const sellerId = req.user.id;
    
    if (!subject || !message) {
      return res.status(400).json({
        success: false,
        error: 'Subject and message are required'
      });
    }
    
    // Mock support ticket creation
    res.json({
      success: true,
      message: 'Support ticket submitted successfully',
      ticketId: Date.now()
    });
  } catch (error) {
    console.error('Error submitting support ticket:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit support ticket'
    });
  }
});

// GET /api/seller/orders - Get orders for seller
router.get('/orders', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { limit = 10, page = 1, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let query = `
      SELECT DISTINCT
        o.id,
        o.order_number,
        (SELECT SUM(oi2.quantity * p2.base_price) 
         FROM order_items oi2 
         JOIN products p2 ON oi2.product_id = p2.id 
         WHERE oi2.order_id = o.id AND p2.seller_id = ?) as seller_earnings,
        o.status,
        o.created_at,
        u.name as buyer_name,
        u.email as buyer_email
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      JOIN users u ON o.user_id = u.id
      WHERE p.seller_id = ?
    `;
    
    const params = [sellerId, sellerId];
    
    if (status) {
      query += ' AND o.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    
    const [orders] = await pool.execute(query, params);
    
    res.json({
      success: true,
      orders,
      count: orders.length,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Error fetching seller orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders'
    });
  }
});

// GET /api/seller/orders/:id - Get specific order details for seller
router.get('/orders/:id', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const sellerId = req.user.id;
    const orderId = req.params.id;
    
    // Get order details with customer information (seller view - base price only)
    const [orders] = await pool.execute(`
      SELECT DISTINCT
        o.id,
        o.order_number,
        (SELECT SUM(oi2.quantity * p2.base_price) 
         FROM order_items oi2 
         JOIN products p2 ON oi2.product_id = p2.id 
         WHERE oi2.order_id = o.id AND p2.seller_id = ?) as total_amount,
        o.status,
        o.created_at,
        o.shipping_address,
        o.billing_address,
        o.payment_method,
        u.id as buyer_id,
        u.name as buyer_name,
        u.email as buyer_email,
        u.phone as buyer_phone
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      JOIN users u ON o.user_id = u.id
      WHERE o.id = ? AND p.seller_id = ?
    `, [sellerId, orderId, sellerId]);

    if (orders.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Order not found or access denied' 
      });
    }

    const order = orders[0];

    // Get order items with product details (seller view - base price only)
    const [orderItems] = await pool.execute(`
      SELECT 
        oi.id,
        oi.quantity,
        p.base_price as unit_price,
        (oi.quantity * p.base_price) as total_price,
        p.id as product_id,
        p.name as product_name,
        p.description as product_description,
        p.main_image as product_image,
        p.base_price as product_price,
        p.currency as product_currency
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ? AND p.seller_id = ?
    `, [orderId, sellerId]);

    order.items = orderItems;

    res.json({ 
      success: true, 
      order 
    });
  } catch (error) {
    console.error('Error fetching seller order details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order details'
    });
  }
});

// GET /api/seller/products - Get products for seller
router.get('/products', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { limit = 10, page = 1 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const [products] = await pool.execute(`
      SELECT 
        p.id,
        p.name,
        p.description,
        p.base_price as price,
        p.stock_quantity,
        p.main_image as image_url,
        p.is_active,
        p.created_at,
        c.name as category,
        CASE 
          WHEN p.is_active = 1 THEN 'active'
          ELSE 'inactive'
        END as status
      FROM products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      WHERE p.seller_id = ?
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `, [sellerId, parseInt(limit), offset]);
    
    res.json({
      success: true,
      products,
      count: products.length,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Error fetching seller products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products'
    });
  }
});

// GET /api/seller/messages - Get messages for seller
router.get('/messages', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { limit = 10, page = 1 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const [messages] = await pool.execute(`
      SELECT 
        m.id,
        m.subject,
        m.content,
        m.is_read,
        m.created_at,
        u.name as sender_name,
        u.email as sender_email
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.recipient_id = ?
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `, [sellerId, parseInt(limit), offset]);
    
    res.json({
      success: true,
      messages,
      count: messages.length,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Error fetching seller messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch messages'
    });
  }
});

// GET /api/seller/notifications - Get notifications for seller
router.get('/notifications', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { limit = 10 } = req.query;
    
    // For now, return system notifications
    // In a real app, you'd have a notifications table
    const notifications = [
      {
        id: 1,
        message: 'Welcome to your seller dashboard!',
        type: 'info',
        created_at: new Date().toISOString()
      },
      {
        id: 2,
        message: 'New order #1234 received',
        type: 'success',
        created_at: new Date(Date.now() - 300000).toISOString()
      },
      {
        id: 3,
        message: 'Product "Smartphone X" is running low on stock',
        type: 'warning',
        created_at: new Date(Date.now() - 600000).toISOString()
      }
    ];
    
    res.json({
      success: true,
      notifications: notifications.slice(0, parseInt(limit))
    });
  } catch (error) {
    console.error('Error fetching seller notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications'
    });
  }
});

// GET /api/seller/returns - Get returns statistics
router.get('/returns', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const sellerId = req.user.id;
    
    // Mock returns data for now
    const returnsData = {
      pending_returns: 5,
      approved_returns: 12,
      total_refunds: 1250.75,
      return_rate: 2.3
    };
    
    res.json({
      success: true,
      ...returnsData
    });
  } catch (error) {
    console.error('Error fetching returns data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch returns data'
    });
  }
});

// GET /api/seller/returns/list - Get returns list
router.get('/returns/list', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const sellerId = req.user.id;
    
    // Mock returns list for now
    const returns = [
      {
        id: 1,
        order_id: 1234,
        product_name: 'Smartphone X',
        product_image: '/uploads/smartphone.jpg',
        customer_name: 'John Doe',
        reason: 'defective',
        description: 'Phone not turning on',
        quantity: 1,
        amount: 299.99,
        status: 'pending',
        created_at: new Date().toISOString()
      },
      {
        id: 2,
        order_id: 1235,
        product_name: 'Laptop Pro',
        product_image: '/uploads/laptop.jpg',
        customer_name: 'Jane Smith',
        reason: 'wrong_item',
        description: 'Received different model',
        quantity: 1,
        amount: 899.99,
        status: 'approved',
        created_at: new Date(Date.now() - 86400000).toISOString()
      }
    ];
    
    res.json({
      success: true,
      returns
    });
  } catch (error) {
    console.error('Error fetching returns list:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch returns list'
    });
  }
});

// GET /api/seller/returns/:id - Get specific return details
router.get('/returns/:id', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const returnId = req.params.id;
    
    // Mock return details
    const returnItem = {
      id: returnId,
      order_id: 1234,
      product_name: 'Smartphone X',
      product_image: '/uploads/smartphone.jpg',
      customer_name: 'John Doe',
      reason: 'defective',
      description: 'Phone not turning on',
      quantity: 1,
      amount: 299.99,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    
    res.json({
      success: true,
      ...returnItem
    });
  } catch (error) {
    console.error('Error fetching return details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch return details'
    });
  }
});

// POST /api/seller/returns/:id/approve - Approve return
router.post('/returns/:id/approve', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const returnId = req.params.id;
    
    // Mock approval logic
    res.json({
      success: true,
      message: 'Return approved successfully'
    });
  } catch (error) {
    console.error('Error approving return:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve return'
    });
  }
});

// POST /api/seller/returns/:id/reject - Reject return
router.post('/returns/:id/reject', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const returnId = req.params.id;
    
    // Mock rejection logic
    res.json({
      success: true,
      message: 'Return rejected successfully'
    });
  } catch (error) {
    console.error('Error rejecting return:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject return'
    });
  }
});

// GET /api/seller/promotions - Get promotions statistics
router.get('/promotions', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const sellerId = req.user.id;
    
    // Mock promotions data
    const promotionsData = {
      active_promotions: 3,
      total_revenue: 5420.50,
      total_orders: 45,
      conversion_rate: 8.2
    };
    
    res.json({
      success: true,
      ...promotionsData
    });
  } catch (error) {
    console.error('Error fetching promotions data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch promotions data'
    });
  }
});

// GET /api/seller/promotions/list - Get promotions list
router.get('/promotions/list', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const sellerId = req.user.id;
    
    // Mock promotions list
    const promotions = [
      {
        id: 1,
        name: 'Summer Sale 2024',
        type: 'discount',
        discount_value: 20,
        start_date: '2024-06-01T00:00:00Z',
        end_date: '2024-08-31T23:59:59Z',
        description: 'Get 20% off on all summer products',
        status: 'active',
        revenue: 2500.00,
        orders: 15
      },
      {
        id: 2,
        name: 'Flash Sale - Electronics',
        type: 'flash_sale',
        discount_value: 15,
        start_date: '2024-07-15T00:00:00Z',
        end_date: '2024-07-16T23:59:59Z',
        description: 'Limited time offer on electronics',
        status: 'active',
        revenue: 1800.00,
        orders: 12
      }
    ];
    
    res.json({
      success: true,
      promotions
    });
  } catch (error) {
    console.error('Error fetching promotions list:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch promotions list'
    });
  }
});

// POST /api/seller/promotions/create - Create new promotion
router.post('/promotions/create', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { name, type, discount_value, start_date, end_date, description } = req.body;
    
    // Mock creation logic
    res.json({
      success: true,
      message: 'Promotion created successfully'
    });
  } catch (error) {
    console.error('Error creating promotion:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create promotion'
    });
  }
});

// GET /api/seller/inventory - Get inventory statistics
router.get('/inventory', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const sellerId = req.user.id;
    
    // Mock inventory data
    const inventoryData = {
      total_products: 25,
      in_stock: 18,
      low_stock: 5,
      out_of_stock: 2
    };
    
    res.json({
      success: true,
      ...inventoryData
    });
  } catch (error) {
    console.error('Error fetching inventory data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch inventory data'
    });
  }
});

// GET /api/seller/inventory/list - Get inventory list
router.get('/inventory/list', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const sellerId = req.user.id;
    
    // Get products with inventory info
    const [products] = await pool.execute(`
      SELECT 
        p.id,
        p.name,
        p.description,
        p.price,
        p.stock_quantity as stock,
        p.main_image,
        p.is_active as status,
        p.created_at,
        c.name as category_name
      FROM products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      WHERE p.seller_id = ?
      ORDER BY p.created_at DESC
    `, [sellerId]);
    
    res.json({
      success: true,
      products
    });
  } catch (error) {
    console.error('Error fetching inventory list:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch inventory list'
    });
  }
});

// POST /api/seller/inventory/add - Add inventory
router.post('/inventory/add', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { product_id, quantity, reorder_level, location, notes } = req.body;
    
    // Mock inventory addition logic
    res.json({
      success: true,
      message: 'Inventory added successfully'
    });
  } catch (error) {
    console.error('Error adding inventory:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add inventory'
    });
  }
});

// GET /api/seller/payouts - Get payouts data
router.get('/payouts', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const sellerId = req.user.id;
    
    // Mock payouts data
    const payoutsData = {
      total_earnings: 15420.50,
      available_balance: 3250.75,
      pending_payouts: 1250.00,
      total_paid_out: 10919.75
    };
    
    res.json({
      success: true,
      ...payoutsData
    });
  } catch (error) {
    console.error('Error fetching payouts data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payouts data'
    });
  }
});

// GET /api/seller/payouts/history - Get payout history
router.get('/payouts/history', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const sellerId = req.user.id;
    
    // Mock payout history
    const payouts = [
      {
        id: 1,
        amount: 2500.00,
        status: 'completed',
        date: new Date(Date.now() - 86400000).toISOString(),
        method: 'Bank Transfer'
      },
      {
        id: 2,
        amount: 1800.00,
        status: 'pending',
        date: new Date().toISOString(),
        method: 'PayPal'
      }
    ];
    
    res.json({
      success: true,
      payouts
    });
  } catch (error) {
    console.error('Error fetching payout history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payout history'
    });
  }
});

// POST /api/seller/payouts/request - Request payout
router.post('/payouts/request', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { amount, method } = req.body;
    
    // Mock payout request logic
    res.json({
      success: true,
      message: 'Payout request submitted successfully'
    });
  } catch (error) {
    console.error('Error requesting payout:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to request payout'
    });
  }
});

// GET /api/seller/commission - Get commission data
router.get('/commission', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const sellerId = req.user.id;
    
    // Mock commission data
    const commissionData = {
      total_commission: 1542.05,
      this_month: 325.75,
      last_month: 450.20,
      commission_rate: 10
    };
    
    res.json({
      success: true,
      ...commissionData
    });
  } catch (error) {
    console.error('Error fetching commission data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch commission data'
    });
  }
});

// GET /api/seller/commission/transactions - Get commission transactions
router.get('/commission/transactions', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const sellerId = req.user.id;
    
    // Mock commission transactions
    const transactions = [
      {
        id: 1,
        order_id: 1234,
        amount: 125.50,
        commission: 12.55,
        date: new Date().toISOString()
      },
      {
        id: 2,
        order_id: 1235,
        amount: 299.99,
        commission: 30.00,
        date: new Date(Date.now() - 86400000).toISOString()
      }
    ];
    
    res.json({
      success: true,
      transactions
    });
  } catch (error) {
    console.error('Error fetching commission transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch commission transactions'
    });
  }
});

// GET /api/seller/wallet - Get wallet data
router.get('/wallet', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const sellerId = req.user.id;
    
    // Mock wallet data
    const walletData = {
      balance: 3250.75,
      total_earnings: 15420.50,
      pending_amount: 1250.00,
      currency: 'USD'
    };
    
    res.json({
      success: true,
      ...walletData
    });
  } catch (error) {
    console.error('Error fetching wallet data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch wallet data'
    });
  }
});

// POST /api/seller/wallet/withdraw - Withdraw from wallet
router.post('/wallet/withdraw', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { amount, method } = req.body;
    
    // Mock withdrawal logic
    res.json({
      success: true,
      message: 'Withdrawal request submitted successfully'
    });
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process withdrawal'
    });
  }
});

// POST /api/seller/wallet/topup - Top up wallet
router.post('/wallet/topup', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { amount, method } = req.body;
    
    // Mock topup logic
    res.json({
      success: true,
      message: 'Wallet topped up successfully'
    });
  } catch (error) {
    console.error('Error processing topup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process topup'
    });
  }
});

// GET /api/seller/support - Get support data
router.get('/support', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const sellerId = req.user.id;
    
    // Mock support data
    const supportData = {
      open_tickets: 3,
      resolved_tickets: 25,
      average_response_time: '2.5 hours'
    };
    
    res.json({
      success: true,
      ...supportData
    });
  } catch (error) {
    console.error('Error fetching support data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch support data'
    });
  }
});

// GET /api/seller/settings - Get seller settings
router.get('/settings', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const sellerId = req.user.id;
    
    // Mock settings data
    const settings = {
      notifications: {
        email: true,
        sms: false,
        push: true
      },
      theme: 'light',
      language: 'en',
      currency: 'USD',
      timezone: 'UTC'
    };
    
    res.json({
      success: true,
      settings
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch settings'
    });
  }
});

// POST /api/seller/settings - Update seller settings
router.post('/settings', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const sellerId = req.user.id;
    const settings = req.body;
    
    // Mock settings update logic
    res.json({
      success: true,
      message: 'Settings updated successfully'
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update settings'
    });
  }
});

// POST /api/seller/change-password - Change password
router.post('/change-password', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { current_password, new_password } = req.body;
    
    // Mock password change logic
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to change password'
    });
  }
});

// GET /api/seller/profile - Get seller profile
router.get('/profile', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const sellerId = req.user.id;
    
    // Get user profile data
    const [users] = await pool.execute(`
      SELECT id, name, email, phone, address, created_at
      FROM users
      WHERE id = ?
    `, [sellerId]);
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found'
      });
    }
    
    res.json({
      success: true,
      profile: users[0]
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile'
    });
  }
});

// POST /api/seller/profile - Update seller profile
router.post('/profile', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { name, email, phone, address } = req.body;
    
    // Update user profile
    await pool.execute(`
      UPDATE users
      SET name = ?, email = ?, phone = ?, address = ?
      WHERE id = ?
    `, [name, email, phone, address, sellerId]);
    
    res.json({
      success: true,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
});

// GET /api/seller/boosts - Get boosted products data
router.get('/boosts', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const sellerId = req.user.id;
    
    // Mock boosted products data
    const boostsData = {
      active_boosts: 5,
      total_views: 15420,
      boosted_sales: 3250.75,
      roi: 125.5
    };
    
    res.json({
      success: true,
      ...boostsData
    });
  } catch (error) {
    console.error('Error fetching boosts data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch boosts data'
    });
  }   
});

// GET /api/seller/boosts/list - Get boosted products list
router.get('/boosts/list', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const sellerId = req.user.id;
    
    // Mock boosted products list
    const boosts = [
      {
        id: 1,
        product_name: 'Smartphone X',
        boost_type: 'featured',
        views: 5420,
        clicks: 125,
        sales: 25,
        revenue: 7500.00,
        cost: 50.00,
        roi: 150.0
      },
      {
        id: 2,
        product_name: 'Laptop Pro',
        boost_type: 'sponsored',
        views: 3250,
        clicks: 85,
        sales: 15,
        revenue: 13500.00,
        cost: 75.00,
        roi: 180.0
      }
    ];
    
    res.json({
      success: true,
      boosts
    });
  } catch (error) {
    console.error('Error fetching boosts list:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch boosts list'
    });
  }
});

// POST /api/seller/boosts/add - Add product boost
router.post('/boosts/add', requireAuth, requireRole('seller'), async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { product_id, boost_type, duration, budget } = req.body;
    
    // Mock boost addition logic
    res.json({
      success: true,
      message: 'Product boost added successfully'
    });
  } catch (error) {
    console.error('Error adding product boost:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add product boost'
    });
  }
});



// GET /api/seller/orders - Get seller orders with enhanced filtering
router.get('/orders', requireAuth, requireRole(['seller']), async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { status, page = 1, limit = 20, date_from, date_to } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE p.seller_id = ?';
    let params = [sellerId];

    if (status) {
      whereClause += ' AND o.status = ?';
      params.push(status);
    }

    if (date_from) {
      whereClause += ' AND o.created_at >= ?';
      params.push(date_from);
    }

    if (date_to) {
      whereClause += ' AND o.created_at <= ?';
      params.push(date_to);
    }

    const [orders] = await pool.execute(`
      SELECT DISTINCT
        o.id, o.order_number, o.status, o.payment_status, o.total_amount,
        o.created_at, o.updated_at,
        -- BUYER INFORMATION
        u.name as buyer_name, u.email as buyer_email, u.phone as buyer_phone,
        -- PSM CONFIRMATION FIELDS FOR SELLERS
        o.psm_deposit_at,
        o.psm_agent_id,
        o.buyer_pickup_at,
        o.buyer_pickup_code,
        o.seller_payout_status,
        o.seller_payout_released_at,
        o.seller_payout_release_reason,
        o.completed_at,
        -- PDA AGENT INFO
        u_agent.name as agent_name,
        a.phone as agent_phone,
        -- PSM AGENT INFO
        u_psm.name as psm_agent_name,
        -- PICKUP SITE INFO
        ps.name as pickup_site_name,
        ps.address as pickup_site_address,
        -- ORDER DETAILS
        COUNT(oi.id) as item_count,
        SUM(oi.quantity) as total_quantity,
        GROUP_CONCAT(DISTINCT p.name SEPARATOR ', ') as product_names
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      JOIN users u ON o.user_id = u.id
      LEFT JOIN agents a ON o.agent_id = a.user_id
      LEFT JOIN users u_agent ON a.user_id = u_agent.id
      LEFT JOIN agents a_psm ON o.psm_agent_id = a_psm.user_id
      LEFT JOIN users u_psm ON a_psm.user_id = u_psm.id
      LEFT JOIN pickup_sites ps ON o.pickup_site_id = ps.id
      ${whereClause}
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), parseInt(offset)]);

    // Get total count
    const [countResult] = await pool.execute(`
      SELECT COUNT(DISTINCT o.id) as total
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      ${whereClause}
    `, params);

    res.json({
      success: true,
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching seller orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders'
    });
  }
});

// GET /api/seller/orders/:id - Get detailed order information
router.get('/orders/:id', requireAuth, requireRole(['seller']), async (req, res) => {
  try {
    const orderId = req.params.id;
    const sellerId = req.user.id;

    // Get order details with agent information
    const [orders] = await pool.execute(`
      SELECT DISTINCT o.*, u.name as buyer_name, u.email as buyer_email, u.phone as buyer_phone,
             u.address as buyer_address,
             a.id as agent_id, au.name as agent_name, au.phone as agent_phone, a.agent_type
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      JOIN users u ON o.user_id = u.id
      LEFT JOIN agents a ON o.agent_id = a.id
      LEFT JOIN users au ON a.user_id = au.id
      WHERE o.id = ? AND p.seller_id = ?
    `, [orderId, sellerId]);

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const order = orders[0];

    // Get order items for this seller
    const [orderItems] = await pool.execute(`
      SELECT oi.*, p.name, p.price, p.main_image
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ? AND p.seller_id = ?
    `, [orderId, sellerId]);

    order.items = orderItems;

    // Get payment information
    const [payments] = await pool.execute(`
      SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC LIMIT 1
    `, [orderId]);

    if (payments.length > 0) {
      order.payment = payments[0];
    }

    // Get delivery information if assigned
    const [deliveries] = await pool.execute(`
      SELECT d.*, a.first_name, a.last_name, a.phone as agent_phone
      FROM deliveries d
      LEFT JOIN agents a ON d.agent_id = a.id
      WHERE d.order_id = ?
    `, [orderId]);

    if (deliveries.length > 0) {
      order.delivery = deliveries[0];
    }

    res.json({
      success: true,
      order
    });

  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order details'
    });
  }
});

// PUT /api/seller/orders/:id/status - Update order status (Simplified 3-Status Workflow)
router.put('/orders/:id/status', requireAuth, requireRole(['seller']), async (req, res) => {
  try {
    const orderId = req.params.id;
    const sellerId = req.user.id;
    const { status, notes } = req.body;

    // Simplified 3-status workflow: CONFIRMED, ASSIGNED, DELIVERED
    // Sellers can only mark orders as CONFIRMED (ready for agent pickup)
    const validStatuses = ['CONFIRMED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Sellers can only mark orders as CONFIRMED or CANCELLED.'
      });
    }

    // Verify seller owns products in this order
    const [orderCheck] = await pool.execute(`
      SELECT COUNT(*) as count
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ? AND p.seller_id = ?
    `, [orderId, sellerId]);

    if (orderCheck[0].count === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Update order status
    await pool.execute(`
      UPDATE orders 
      SET status = ?, notes = ?, updated_at = NOW()
      WHERE id = ?
    `, [status, notes, orderId]);

    // Log status change
    await pool.execute(`
      INSERT INTO order_status_logs (order_id, old_status, new_status, changed_by, notes, created_at)
      VALUES (?, (SELECT status FROM orders WHERE id = ?), ?, ?, ?, NOW())
    `, [orderId, orderId, status, sellerId, notes]);

    res.json({
      success: true,
      message: 'Order status updated successfully'
    });

  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update order status'
    });
  }
});

// PUT /api/seller/orders/:id/assign-agent - Assign agent to order
router.put('/orders/:id/assign-agent', requireAuth, requireRole(['seller']), async (req, res) => {
  try {
    const orderId = req.params.id;
    const sellerId = req.user.id;
    const { agent_id, agent_type } = req.body;

    if (!agent_id || !agent_type) {
      return res.status(400).json({
        success: false,
        error: 'Agent ID and agent type are required'
      });
    }

    // Verify seller owns products in this order
    const [orderCheck] = await pool.execute(`
      SELECT COUNT(*) as count
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ? AND p.seller_id = ?
    `, [orderId, sellerId]);

    if (orderCheck[0].count === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Verify agent exists and is available
    const agentTable = agent_type === 'pickup_delivery' ? 'pickup_delivery_agents' : 'fast_delivery_agents';
    const [agents] = await pool.execute(`
      SELECT id, name, phone, status FROM ${agentTable} WHERE id = ? AND status = 'available'
    `, [agent_id]);

    if (agents.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found or not available'
      });
    }

    const agent = agents[0];

    // Calculate correct agent commission based on platform commission (21% markup)
    const [orderData] = await pool.execute(`
      SELECT total_amount FROM orders WHERE id = ?
    `, [orderId]);
    
    const totalAmount = parseFloat(orderData[0].total_amount) || 0;
    const basePrice = totalAmount / 1.21; // Remove 21% markup to get base price
    const platformCommission = totalAmount - basePrice; // 21% markup amount
    
    // Agent commission from platform commission pool
    let agentCommissionRate = 0;
    if (agent_type === 'pickup_delivery') {
      agentCommissionRate = 0.70; // 70% of platform commission = 147 FRW on 1000 FRW base
    } else if (agent_type === 'fast_delivery') {
      agentCommissionRate = 0.50; // 50% of platform commission = 105 FRW on 1000 FRW base
    }
    
    const agentCommission = platformCommission * agentCommissionRate;

    // Update order with agent assignment and correct commission
    await pool.execute(`
      UPDATE orders 
      SET agent_id = ?, agent_type = ?, agent_name = ?, agent_phone = ?, 
          agent_commission = ?, updated_at = NOW()
      WHERE id = ?
    `, [agent_id, agent_type, agent.name, agent.phone, agentCommission, orderId]);

    // Update agent status to busy
    await pool.execute(`
      UPDATE ${agentTable} SET status = 'busy', updated_at = NOW() WHERE id = ?
    `, [agent_id]);

    // Create delivery record
    await pool.execute(`
      INSERT INTO deliveries (order_id, agent_id, agent_type, status, created_at)
      VALUES (?, ?, ?, 'assigned', NOW())
      ON DUPLICATE KEY UPDATE 
        agent_id = VALUES(agent_id),
        agent_type = VALUES(agent_type),
        status = VALUES(status),
        updated_at = NOW()
    `, [orderId, agent_id, agent_type]);

    // Log the assignment
    await pool.execute(`
      INSERT INTO order_status_logs (order_id, old_status, new_status, changed_by, notes, created_at)
      VALUES (?, (SELECT status FROM orders WHERE id = ?), 'agent_assigned', ?, ?, NOW())
    `, [orderId, orderId, sellerId, `Agent ${agent.name} assigned for ${agent_type} delivery`]);

    res.json({
      success: true,
      message: 'Agent assigned successfully',
      agent: {
        id: agent_id,
        name: agent.name,
        phone: agent.phone,
        type: agent_type
      },
      commission: {
        total_amount: totalAmount,
        base_price: basePrice,
        platform_commission: platformCommission,
        agent_commission: agentCommission,
        commission_rate: `${(agentCommissionRate * 100)}% of platform commission`
      }
    });

  } catch (error) {
    console.error('Error assigning agent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign agent'
    });
  }
});

// GET /api/seller/earnings - Get seller earnings summary
router.get('/earnings', requireAuth, requireRole(['seller']), async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { period = 'month' } = req.query;

    let dateFilter = '';
    switch (period) {
      case 'week':
        dateFilter = 'AND o.created_at >= DATE_SUB(NOW(), INTERVAL 1 WEEK)';
        break;
      case 'month':
        dateFilter = 'AND o.created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)';
        break;
      case 'year':
        dateFilter = 'AND o.created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)';
        break;
    }

    const [earnings] = await pool.execute(`
      SELECT 
        COUNT(DISTINCT o.id) as total_orders,
        SUM(oi.quantity * oi.price) as gross_earnings,
        SUM(oi.quantity * oi.price * 0.79) as net_earnings,
        AVG(oi.price) as average_order_value
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      WHERE p.seller_id = ? AND o.payment_status = 'completed' ${dateFilter}
    `, [sellerId]);

    // Get earnings by status
    const [statusBreakdown] = await pool.execute(`
      SELECT 
        o.status,
        COUNT(*) as order_count,
        SUM(oi.quantity * oi.price) as total_amount
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      WHERE p.seller_id = ? ${dateFilter}
      GROUP BY o.status
    `, [sellerId]);

    res.json({
      success: true,
      earnings: earnings[0],
      breakdown: statusBreakdown,
      period
    });

  } catch (error) {
    console.error('Error fetching seller earnings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch earnings'
    });
  }
});

module.exports = router; 