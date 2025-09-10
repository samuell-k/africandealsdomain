   
const express = require('express');
const path = require('path');
const http = require('http');
const app = express();
const server = http.createServer(app);
const { Server } = require('socket.io'); 
const io = new Server(server, { 
  cors: { 
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'http://127.0.0.1:3001', 'http://localhost:3002', 'http://127.0.0.1:3002'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['polling', 'websocket'],
  allowEIO3: true
});

// Make Socket.IO available to routes
app.set('io', io);
const cors = require('cors');
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'http://127.0.0.1:3001', 'http://localhost:3002', 'http://127.0.0.1:3002'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));   
     
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware to ensure API routes always return JSON
app.use('/api/*', (req, res, next) => {
  // Log all API requests
  console.log(`🌐 [API] ${req.method} ${req.path} - ${new Date().toISOString()}`);
  
  // Set JSON content type for all API responses
  res.setHeader('Content-Type', 'application/json');
  
  // Override res.redirect for API routes to return JSON instead
  const originalRedirect = res.redirect;
  res.redirect = function(url) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ 
        error: 'Authentication required', 
        redirectTo: url,
        message: 'Please login to access this resource'
      });
    }
    return originalRedirect.call(this, url);
  };
  
  next();
});
   
// Socket.io user tracking and delivery system
const signedInUsers = new Map();
const agentSockets = new Map(); // Map agent IDs to socket IDs
const buyerSockets = new Map(); // Map buyer IDs to socket IDs

io.on('connection', (socket) => {
  console.log('[SOCKET] New connection:', socket.id);
  
  socket.on('user:login', (user) => {
    if (user && user.id) {
      signedInUsers.set(socket.id, user);
      
      // Track role-specific sockets for delivery system
      if (user.role === 'agent') {
        agentSockets.set(user.id, socket.id);
      } else if (user.role === 'buyer') {
        buyerSockets.set(user.id, socket.id);
      }
      
      console.log(`[SOCKET] User logged in: ${user.name} (${user.role}) [${user.id}]`);
      io.emit('signedInUsers', Array.from(signedInUsers.values()));
    }
  }); 

  // Handle agent location updates
  socket.on('agent:location_update', (data) => {
    const user = signedInUsers.get(socket.id);
    if (user && user.role === 'agent') {
      // Broadcast location update to relevant buyers
      socket.broadcast.emit('location_update', {
        agentId: user.id,
        location: data.location,
        orderId: data.orderId
      });
      console.log(`[SOCKET] Agent ${user.id} location updated`);
    }
  });

  // Handle delivery status updates
  socket.on('delivery:status_update', (data) => {
    const user = signedInUsers.get(socket.id);
    if (user && user.role === 'agent') {
      // Notify buyer about status update
      if (data.buyerId && buyerSockets.has(data.buyerId)) {
        const buyerSocketId = buyerSockets.get(data.buyerId);
        io.to(buyerSocketId).emit('tracking_update', {
          orderId: data.orderId,
          status: data.status,
          agentId: user.id
        });
      }
      console.log(`[SOCKET] Delivery status updated: ${data.status} for order ${data.orderId}`);
    }
  });

  // Handle order assignment notifications
  socket.on('order:assigned', (data) => {
    // Notify agent about new order assignment
    if (data.agentId && agentSockets.has(data.agentId)) {
      const agentSocketId = agentSockets.get(data.agentId);
      io.to(agentSocketId).emit('new_order_assigned', {
        orderId: data.orderId,
        orderDetails: data.orderDetails
      });
    }
    
    // Notify buyer about agent assignment
    if (data.buyerId && buyerSockets.has(data.buyerId)) {
      const buyerSocketId = buyerSockets.get(data.buyerId);
      io.to(buyerSocketId).emit('agent_assigned', {
        orderId: data.orderId,
        agentDetails: data.agentDetails
      });
    }
    
    console.log(`[SOCKET] Order ${data.orderId} assigned to agent ${data.agentId}`);
  });

  // Join a chat room for a specific order
  socket.on('chat:join', (data) => {
    if (data.orderId) {
      const room = `order_${data.orderId}`;
      socket.join(room);
      console.log(`[SOCKET] User ${socket.id} joined chat room: ${room}`);
    }
  });

  // Handle chat messages for an order
  socket.on('chat:message', (data) => {
    // This is now primarily handled by the API to ensure persistence first.
    // The API will emit the 'chat:new_message' event.
    // This can be kept for other real-time features or direct p2p that doesn't need saving.
    const user = signedInUsers.get(socket.id);
    console.log(`[SOCKET] Received chat message from ${user?.name}, but API should handle it.`);
  });

  // Handle PSM delivery confirmations
  socket.on('psm_confirms_delivery', (data) => {
    const user = signedInUsers.get(socket.id);
    if (user && user.role === 'agent' && user.agent_type === 'pickup_site_manager') {
      console.log(`[SOCKET] PSM ${user.id} confirmed delivery for order ${data.orderId}`);
      
      // Notify PDA that PSM confirmed receipt
      if (data.pdaId && agentSockets.has(data.pdaId)) {
        const pdaSocketId = agentSockets.get(data.pdaId);
        io.to(pdaSocketId).emit('psm_confirms_delivery', {
          orderId: data.orderId,
          orderNumber: data.orderNumber,
          pickupSiteName: data.pickupSiteName || 'Pickup Site',
          confirmedAt: data.confirmedAt,
          message: data.message || 'Package successfully received at pickup site'
        });
        console.log(`[SOCKET] Notified PDA ${data.pdaId} about PSM confirmation`);
      }
      
      // Notify buyer that package is ready for pickup
      if (data.buyerId && buyerSockets.has(data.buyerId)) {
        const buyerSocketId = buyerSockets.get(data.buyerId);
        io.to(buyerSocketId).emit('order_ready_for_pickup', {
          orderId: data.orderId,
          orderNumber: data.orderNumber,
          pickupSiteName: data.pickupSiteName || 'Pickup Site',
          message: 'Your order has arrived at the pickup site and is ready for collection'
        });
        console.log(`[SOCKET] Notified buyer about order ready for pickup`);
      }
    }
  });

  // Handle PDA delivery to PSM notifications
  socket.on('pda_delivery_to_psm', (data) => {
    const user = signedInUsers.get(socket.id);
    if (user && user.role === 'agent' && user.agent_type === 'pickup_delivery_agent') {
      console.log(`[SOCKET] PDA ${user.id} delivered order ${data.orderId} to PSM`);
      
      // Notify PSM about incoming delivery
      if (data.psmId && agentSockets.has(data.psmId)) {
        const psmSocketId = agentSockets.get(data.psmId);
        io.to(psmSocketId).emit('pda_delivery_to_psm', {
          orderId: data.orderId,
          orderNumber: data.orderNumber,
          pdaName: data.pdaName || 'PDA Agent',
          deliveredAt: data.deliveredAt,
          message: data.message || 'Package delivered by PDA - please confirm receipt'
        });
        console.log(`[SOCKET] Notified PSM ${data.psmId} about PDA delivery`);
      }
    }
  });

  // Handle user joining specific rooms
  socket.on('join:user_room', (data) => {
    if (data.userId) {
      const room = `user_${data.userId}`;
      socket.join(room);
      console.log(`[SOCKET] User ${socket.id} joined user room: ${room}`);
    }
  });

  // Handle typing indicators
  socket.on('chat:typing', (data) => {
    const user = signedInUsers.get(socket.id);
    if (user && data.orderId) {
      socket.to(`order_${data.orderId}`).emit('user_typing', {
        userId: user.id,
        userName: user.name,
        orderId: data.orderId,
        isTyping: data.isTyping
      });
    }
  });

  // Handle location sharing updates
  socket.on('location:share', (data) => {
    const user = signedInUsers.get(socket.id);
    if (user && data.orderId) {
      // Broadcast location to order participants
      socket.to(`order_${data.orderId}`).emit('location_shared', {
        userId: user.id,
        userName: user.name,
        location: data.location,
        orderId: data.orderId,
        timestamp: new Date().toISOString()
      });
      console.log(`[SOCKET] Location shared by ${user.name} for order ${data.orderId}`);
    }
  });

  // Handle delivery status updates from agents
  socket.on('delivery:update_status', (data) => {
    const user = signedInUsers.get(socket.id);
    if (user && user.role === 'agent' && data.orderId) {
      // Notify all participants in the order
      io.to(`order_${data.orderId}`).emit('delivery_status_changed', {
        orderId: data.orderId,
        status: data.status,
        agentId: user.id,
        agentName: user.name,
        timestamp: new Date().toISOString(),
        notes: data.notes
      });
      console.log(`[SOCKET] Delivery status updated to ${data.status} for order ${data.orderId}`);
    }
  });

  // Handle payment status updates
  socket.on('payment:status_update', (data) => {
    const user = signedInUsers.get(socket.id);
    if (user && data.orderId) {
      // Notify relevant parties about payment status change
      io.to(`order_${data.orderId}`).emit('payment_status_changed', {
        orderId: data.orderId,
        status: data.status,
        userId: user.id,
        timestamp: new Date().toISOString()
      });
      console.log(`[SOCKET] Payment status updated to ${data.status} for order ${data.orderId}`);
    }
  });

  socket.on('disconnect', () => {
    if (signedInUsers.has(socket.id)) {
      const user = signedInUsers.get(socket.id);
      
      // Remove from role-specific maps
      if (user.role === 'agent') {
        agentSockets.delete(user.id);
      } else if (user.role === 'buyer') {
        buyerSockets.delete(user.id);
      }
      
      console.log(`[SOCKET] User disconnected: ${user.name} (${user.role}) [${user.id}]`);
      signedInUsers.delete(socket.id);
      io.emit('signedInUsers', Array.from(signedInUsers.values()));
    } else {
      console.log('[SOCKET] Disconnected:', socket.id);
    }
  });
});

// Make io available to all routes
app.set('io', io);

const CLIENT_PUBLIC = path.join(__dirname, '../client/public');
const CLIENT_AUTH = path.join(__dirname, '../client/auth');
const CLIENT_ERROR = path.join(__dirname, '../client/error/404');
  
// Configure MIME types for static files
express.static.mime.define({
  'text/css': ['css'],
  'application/javascript': ['js'],
  'image/png': ['png'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/gif': ['gif'],
  'image/svg+xml': ['svg'],
  'text/html': ['html'],
  'application/json': ['json']
});

// Serve static assets with proper MIME types
const staticOptions = {
  setHeaders: (res, path, stat) => {
    if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    } else if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (path.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (path.endsWith('.svg')) {
      res.setHeader('Content-Type', 'image/svg+xml');
    } else if (path.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html');
    }
  }
};

app.use('/public', express.static(CLIENT_PUBLIC, staticOptions));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), staticOptions));
app.use('/shared', express.static(path.join(__dirname, '../client/shared'), staticOptions));
app.use('/buyer', express.static(path.join(__dirname, '../client/buyer'), staticOptions));
app.use('/seller', express.static(path.join(__dirname, '../client/seller'), staticOptions));
app.use('/grocery', express.static(path.join(__dirname, '../client/grocery'), staticOptions));
app.use('/agent', express.static(path.join(__dirname, '../client/agent'), staticOptions));
app.use('/admin', express.static(path.join(__dirname, '../client/admin'), staticOptions));
app.use('/auth', express.static(path.join(__dirname, '../client/auth'), staticOptions));
app.use('/error', express.static(path.join(__dirname, '../client/error'), staticOptions));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    server: 'ADD Physical Products API',
    version: '1.0.0',
    uptime: process.uptime()
  });
});

// API ROUTES
try {
  const authModule = require('./routes/auth');
  const authRouter = authModule.router;
  app.use('/api/auth', authRouter);
  console.log('✅ Auth API Connected');
  
  const productsRouter = require('./routes/products');
  app.use('/api/products', productsRouter);
  console.log('✅ Products API Connected');
         
  const categoriesRouter = require('./routes/categories');
  app.use('/api/categories', categoriesRouter);
  console.log('✅ Categories API Connected');
  
  const currencyRouter = require('./routes/currency');
  app.use('/api/currency', currencyRouter);
  console.log('✅ Currency API Connected');
  
  const homeAdsRouter = require('./routes/home-background-ad');
  app.use('/api/home-ads', homeAdsRouter);
  console.log('✅ Home Background Ads API Connected');
  
  const messagesRouter = require('./routes/messages');
  app.use('/api/messages', messagesRouter);
  console.log('✅ Messages API Connected');
  
  const wishlistRouter = require('./routes/wishlist');
  app.use('/api/wishlist', wishlistRouter);
  console.log('✅ Wishlist API Connected');
  
  const ordersRouter = require('./routes/orders');
  app.use('/api/orders', ordersRouter);
  console.log('✅ Orders API Connected');
  
  const cartRouter = require('./routes/cart');
  app.use('/api/cart', cartRouter);
  console.log('✅ Cart API Connected');
  
  const sellerRouter = require('./routes/seller');
  app.use('/api/seller', sellerRouter);
  console.log('✅ Seller API Connected');
  
  // Local Market APIs
  try {
    const localMarketRouter = require('./routes/local-market');
    app.use('/api/local-market', localMarketRouter);
    console.log('✅ Local Market API Connected');
  } catch (lmErr) {
    console.error('❌ Failed to load Local Market API:', lmErr.message);
  }
  
  try {
    const localMarketOrdersRouter = require('./routes/local-market-orders');
    app.use('/api/local-market', localMarketOrdersRouter);
    console.log('✅ Local Market Orders API Connected');
  } catch (lmoErr) {
    console.error('❌ Failed to load Local Market Orders API:', lmoErr.message);
  }
  
  // Grocery (categories and related)
  try {
    const groceryRouter = require('./routes/grocery');
    app.use('/api/grocery', groceryRouter);
    console.log('✅ Grocery API Connected');
  } catch (gErr) {
    console.error('❌ Failed to load Grocery API:', gErr.message);
  }
  
  // Referrals and Product Sharing System
  try {
    const referralsRouter = require('./routes/referrals');
    app.use('/api/referrals', referralsRouter);
    console.log('✅ Referrals API Connected');
  } catch (referralsError) {
    console.error('❌ Failed to load referrals router:', referralsError.message);
  }
  
  // Agent Registration and Management Routes (mount before general admin routes)
  const agentRegistrationRouter = require('./routes/agent-registration');
  app.use('/api/auth', agentRegistrationRouter);
  console.log('✅ Agent Registration API Connected');
  
  // Admin Agent Applications Router
  try {
    const adminAgentApplicationsRouter = require('./routes/admin-agent-applications');
    app.use('/api/admin', adminAgentApplicationsRouter);
    console.log('✅ Admin Agent Applications API Connected');
  } catch (adminAgentAppsError) {
    console.error('❌ Failed to load admin agent applications router:', adminAgentAppsError.message);
  }
  
  // Mount main admin router FIRST
  console.log('🔧 Loading admin router...');
  try {
    const adminRouter = require('./routes/admin');
    console.log('🔧 Admin router loaded successfully');
    console.log('🔧 Mounting admin router on /api/admin...');
    app.use('/api/admin', adminRouter);
    console.log('✅ Admin API Connected');

    // Mount admin create agent user endpoint (separate file to avoid touching admin.js)
    try {
      const adminCreateAgentUserRouter = require('./routes/admin-create-agentuser');
      app.use('/api/admin', adminCreateAgentUserRouter);
      console.log('✅ Admin Create Agent User API Connected');
    } catch (createAgentErr) {
      console.error('❌ Failed to load Admin Create Agent User router:', createAgentErr.message);
    }
    
    // Load missing admin endpoints
    try {
      const adminMissingEndpointsRouter = require('./routes/admin-missing-endpoints');
      app.use('/api/admin', adminMissingEndpointsRouter);
      console.log('✅ Admin Missing Endpoints API Connected');
    } catch (missingError) {
      console.error('❌ Failed to load admin missing endpoints:', missingError.message);
    }
    
  } catch (adminError) {
    console.error('❌ Failed to load admin router:', adminError.message);
    console.error('❌ Admin router stack:', adminError.stack);
  }

  // Admin Agent Management Router - Re-enabled with error handling
  try {
    const adminAgentManagementRouter = require('./routes/admin-agent-management');
    app.use('/api/admin', adminAgentManagementRouter);
    console.log('✅ Admin Agent Management API Connected');
  } catch (agentMgmtError) {
    console.error('❌ Failed to load admin agent management:', agentMgmtError.message);
  }

  // Fixed Admin Orders Management Router with Proper Authentication
  try {
    const adminOrdersFixedRouter = require('./routes/admin-orders-fixed');
    app.use('/api/admin/orders', adminOrdersFixedRouter);
    console.log('✅ Fixed Admin Orders API Connected');
  } catch (adminOrdersFixedError) {
    console.error('❌ Failed to load fixed admin orders router:', adminOrdersFixedError.message);
  }

  // Original Admin Orders Management Router (Backup)
  try {
    const adminOrdersRouter = require('./routes/admin-orders');
    app.use('/api/admin/orders-backup', adminOrdersRouter);
    console.log('✅ Backup Admin Orders API Connected');
  } catch (adminOrdersError) {
    console.error('❌ Failed to load admin orders router:', adminOrdersError.message);
  }

  // Enhanced Admin Orders Management with Proper Data Structure
  try {
    const remainOrderEndpointsRouter = require('./routes/remain-order-endpoints');
    app.use('/api/admin/orders', remainOrderEndpointsRouter);
    console.log('✅ Remaining Order Endpoints API Connected');
  } catch (remainOrderEndpointsError) {
    console.error('❌ Failed to load remaining order endpoints:', remainOrderEndpointsError.message);
  }

  // Admin Payments Management Router
  try {
    const adminPaymentsRouter = require('./routes/admin-payments');
    app.use('/api/admin/payments', adminPaymentsRouter);
    console.log('✅ Admin Payments API Connected');
  } catch (adminPaymentsError) {
    console.error('❌ Failed to load admin payments:', adminPaymentsError.message);
  }

  // Payment Credentials Management Router (Admin)
  try {
    const paymentCredentialsRouter = require('./routes/payment-credentials');
    app.use('/api/admin', paymentCredentialsRouter);
    console.log('✅ Payment Credentials API Connected');
  } catch (paymentCredentialsError) {
    console.error('❌ Failed to load payment credentials:', paymentCredentialsError.message);
  }

  // Partners & Promotions Management Router
  try {
    const partnersPromotionsRouter = require('./routes/admin-partners-promotions');
    app.use('/api', partnersPromotionsRouter);
    console.log('✅ Partners & Promotions API Connected');
  } catch (partnersPromotionsError) {
    console.error('❌ Failed to load partners & promotions router:', partnersPromotionsError.message);
  }

  // Payment Credentials Public Router (No Auth Required)
  try {
    const paymentCredentialsPublicRouter = require('./routes/payment-credentials-public');
    app.use('/api/payment-credentials', paymentCredentialsPublicRouter);
    console.log('✅ Payment Credentials Public API Connected');
  } catch (paymentCredentialsPublicError) {
    console.error('❌ Failed to load payment credentials public:', paymentCredentialsPublicError.message);
  }

  // Referrals Router (user + admin endpoints)
  try {
    const referralsRouter = require('./routes/referrals');
    app.use('/api/referrals', referralsRouter);
    console.log('✅ Referrals API Connected');
  } catch (referralsRouterError) {
    console.error('❌ Failed to load referrals router:', referralsRouterError.message);
  }

  // Delivery Confirmation System Router
  try {
    const deliveryConfirmationRouter = require('./routes/delivery-confirmation');
    app.use('/api/delivery-confirmation', deliveryConfirmationRouter);
    console.log('✅ Delivery Confirmation API Connected');
  } catch (deliveryConfirmationError) {
    console.error('❌ Failed to load delivery confirmation router:', deliveryConfirmationError.message);
  }

  // Enhanced Delivery Confirmation with OTP System Router
  try {
    const deliveryConfirmationOtpRouter = require('./routes/delivery-confirmation-otp');
    app.use('/api/delivery-confirmation-otp', deliveryConfirmationOtpRouter);
    console.log('✅ Delivery Confirmation OTP API Connected');
  } catch (deliveryConfirmationOtpError) {
    console.error('❌ Failed to load delivery confirmation OTP router:', deliveryConfirmationOtpError.message);
  }

  // Order Confirmation System Router
  try {
    const orderConfirmationRouter = require('./routes/order-confirmation');
    app.use('/api/order-confirmation', orderConfirmationRouter);
    console.log('✅ Order Confirmation API Connected');
  } catch (orderConfirmationError) {
    console.error('❌ Failed to load order confirmation router:', orderConfirmationError.message);
  }

  // Escrow Management System Router
  try {
    const escrowManagementRouter = require('./routes/escrow-management');
    app.use('/api/admin/escrow', escrowManagementRouter);
    app.use('/api/admin/wallets', escrowManagementRouter);
    app.use('/api/admin/payment-methods', escrowManagementRouter);
    console.log('✅ Escrow Management API Connected');
  } catch (escrowManagementError) {
    console.error('❌ Failed to load escrow management router:', escrowManagementError.message);
  }
  
  const deliveryTaxSettingsRouter = require('./routes/delivery-tax-settings');
  app.use('/api/admin/delivery-tax-settings', deliveryTaxSettingsRouter);
  app.use('/api/delivery-tax-settings', deliveryTaxSettingsRouter);
  console.log('✅ Delivery Tax Settings API Connected');
  
  const pickupSitesRouter = require('./routes/pickup-sites');
  app.use('/api/pickup-sites', pickupSitesRouter);
  console.log('✅ Pickup Sites API Connected');
  
  const agentsRouter = require('./routes/agents');
  app.use('/api/agents', agentsRouter);
  console.log('✅ Agents API Connected');
  
  // Health Check Routes
  const healthCheckRouter = require('./routes/health-check');
  app.use('/api/health', healthCheckRouter);
  console.log('✅ Health Check API Connected');
  
  // NEW AGENT TYPES ROUTES
  const fastDeliveryAgentRouter = require('./routes/fast-delivery-agent');
  app.use('/api/fast-delivery-agent', fastDeliveryAgentRouter);
  console.log('✅ Fast Delivery Agent API Connected');
  
  // FDA LOCAL MARKET CONFIRMATION SYSTEM
  const fdaLocalMarketRouter = require('./routes/fda-local-market');
  app.use('/api/fda-local-market', fdaLocalMarketRouter);
  console.log('✅ FDA Local Market Confirmation API Connected');
  
  // LOCAL MARKET SYSTEM
  try {
    const localMarketRouter = require('./routes/local-market');
    app.use('/api/local-market', localMarketRouter);
    console.log('✅ Local Market API Connected');
  } catch (localMarketError) {
    console.error('❌ Failed to load local market router:', localMarketError.message);
  }
  
  const pickupDeliveryAgentRouter = require('./routes/pickup-delivery-agent');
  app.use('/api/pickup-delivery-agent', pickupDeliveryAgentRouter);
  console.log('✅ Pickup Delivery Agent API Connected');
  
  const pickupSiteManagerRouter = require('./routes/pickup-site-manager');
  app.use('/api/pickup-site-manager', pickupSiteManagerRouter);
  console.log('✅ Pickup Site Manager API Connected');
  
  // REAL-TIME TRACKING SYSTEM
  const realTimeTrackingRouter = require('./routes/real-time-tracking');
  app.use('/api/tracking', realTimeTrackingRouter);
  console.log('✅ Real-Time Tracking API Connected');
  
  // PDA LOGISTICS SYSTEM - Enhanced order tracking and confirmations
  const pdaLogisticsRouter = require('./routes/pda-logistics');
  app.use('/api/pda-logistics', pdaLogisticsRouter);
  console.log('✅ PDA Logistics API Connected');
  
  // ADMIN PDA APPROVALS - Manual payment and payout approvals
  const adminPdaApprovalsRouter = require('./routes/admin-pda-approvals');
  app.use('/api/admin/pda-approvals', adminPdaApprovalsRouter);
  console.log('✅ Admin PDA Approvals API Connected');
  
  const boostedProductsRouter = require('./routes/boostedProducts');
  app.use('/api/boosted-products', boostedProductsRouter);
  console.log('✅ Boosted Products API Connected');
  
  const groceryOrdersRouter = require('./routes/groceryOrders');
  app.use('/api/grocery-orders', groceryOrdersRouter);
  console.log('✅ Grocery Orders API Connected');
  
  const locationRouter = require('./routes/location');
  app.use('/api/location', locationRouter);
  console.log('✅ Location API Connected');
  
  const paymentsRouter = require('./routes/payments');
  app.use('/api/payments', paymentsRouter);
  console.log('✅ Payments API Connected');
  
  const usersRouter = require('./routes/users');
  app.use('/api/users', usersRouter);
  console.log('✅ Users API Connected');
  
  const paymentTransactionsRouter = require('./routes/payment-transactions');
  app.use('/api/payment-transactions', paymentTransactionsRouter);
  console.log('✅ Payment Transactions API Connected');
  
  const paymentMethodsRouter = require('./routes/payment-methods');
  app.use('/api/payment-methods', paymentMethodsRouter);
  console.log('✅ Payment Methods API Connected');
  
  const paymentProofRouter = require('./routes/payment-proof');
  app.use('/api/payment-proof', paymentProofRouter);
  console.log('✅ Payment Proof API Connected');
  
  const shippingRouter = require('./routes/shipping');
  app.use('/api/shipping', shippingRouter);
  console.log('✅ Shipping API Connected');
  
  const shippingRulesRouter = require('./routes/shipping-rules');
  app.use('/api/shipping-rules', shippingRulesRouter);
  console.log('✅ Shipping Rules API Connected');
  
  const deliveryTrackingRouter = require('./routes/delivery-tracking');
  app.use('/api/delivery-tracking', deliveryTrackingRouter);
  console.log('✅ Delivery Tracking API Connected');

  const chatRouter = require('./routes/chat');
  app.use('/api/chat', chatRouter);
  console.log('✅ Chat API Connected');
  
  const setupRouter = require('./routes/setup');
  app.use('/api/setup', setupRouter);
  console.log('✅ Setup API Connected');
  
  // NEW FEATURE ROUTES
  const userLocationsRouter = require('./routes/user-locations');
  app.use('/api/user-locations', userLocationsRouter);
  console.log('✅ User Locations API Connected');
  
  const orderChatRouter = require('./routes/order-chat');
  app.use('/api/order-chat', orderChatRouter);
  console.log('✅ Order Chat API Connected');
  
  const deliveryHistoryRouter = require('./routes/delivery-history');
  app.use('/api/delivery-history', deliveryHistoryRouter);
  console.log('✅ Delivery History API Connected');
  
  const uploadRouter = require('./routes/upload');
  app.use('/api/upload', uploadRouter);
  console.log('✅ Upload API Connected');
  
  const paymentEscrowRouter = require('./routes/payment-escrow');
  app.use('/api/payment-escrow', paymentEscrowRouter);
  console.log('✅ Payment Escrow API Connected');
  
  const commissionManagementRouter = require('./routes/commission-management');
  app.use('/api/commission-management', commissionManagementRouter);
  console.log('✅ Commission Management API Connected');
  
  // LOCAL MARKET ROUTES
  const groceryRouter = require('./routes/grocery');
  app.use('/api/grocery', groceryRouter);
  console.log('✅ Grocery API Connected');
  
  const localMarketRouter = require('./routes/localMarket');
  app.use('/api/local-market', localMarketRouter);
  console.log('✅ Local Market API Connected');
  
  const localMarketAdminRouter = require('./routes/localMarketAdmin');
  app.use('/api/local-market-admin', localMarketAdminRouter);
  console.log('✅ Local Market Admin API Connected');
  
  const localMarketAgentRouter = require('./routes/localMarketAgent');
  app.use('/api/local-market-agent', localMarketAgentRouter);
  console.log('✅ Local Market Agent API Connected');
  
  const localMarketOrdersRouter = require('./routes/local-market-orders');
  app.use('/api/local-market-orders', localMarketOrdersRouter);
  console.log('✅ Local Market Orders API Connected');
  
  const grocerySellerRouter = require('./routes/grocerySeller');
  app.use('/api/grocery-seller', grocerySellerRouter);
  console.log('✅ Grocery Seller API Connected');
    
  const productReviewsRouter = require('./routes/product-reviews');
  app.use('/api/product-reviews', productReviewsRouter);
  console.log('✅ Product Reviews API Connected');
  
  const brandsRouter = require('./routes/brands');
  app.use('/api/brands', brandsRouter);
  console.log('✅ Brands API Connected');

  // NEW MISSING ROUTES - CRITICAL FUNCTIONALITY
  // (Referrals API already connected earlier)

  const walletRouter = require('./routes/wallet');
  app.use('/api/wallet', walletRouter);
  console.log('✅ Wallet API Connected');

  // TEMPORARILY DISABLE FOR TESTING
  // const adminLogsRouter = require('./routes/admin-logs');
  // app.use('/api/admin/logs', adminLogsRouter);
  // app.use('/api/admin/security', adminLogsRouter);
  // console.log('✅ Admin Logs & Security API Connected');

  // TEMPORARILY DISABLE FOR TESTING
  // const adminAdsRouter = require('./routes/admin-ads');
  // app.use('/api/admin', adminAdsRouter);
  // console.log('✅ Admin Ads Management API Connected');

  // const adminAgentsRouter = require('./routes/admin-agents');
  // app.use('/api/admin', adminAgentsRouter);
  // console.log('✅ Admin Agents Management API Connected');

  // const adminAnnouncementsRouter = require('./routes/admin-announcements');
  // app.use('/api/admin', adminAnnouncementsRouter);
  // console.log('✅ Admin Announcements API Connected');

} catch (err) {
  console.error('❌ API route error:', err);
}

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Server is working!', 
    timestamp: new Date().toISOString(),
    port: process.env.PORT || 3002
  });
});


                
// Auth HTML pages (keep these above fallback)
app.get('/auth/auth-buyer.html', (req, res) => {
  res.sendFile(path.join(CLIENT_AUTH, 'auth-buyer.html'));
});
app.get('/auth/auth-seller.html', (req, res) => {
  res.sendFile(path.join(CLIENT_AUTH, 'auth-seller.html'));
});
app.get('/auth/auth-agent.html', (req, res) => {
  res.sendFile(path.join(CLIENT_AUTH, 'auth-agent.html'));
});
app.get('/auth/auth-admin.html', (req, res) => {
  res.sendFile(path.join(CLIENT_AUTH, 'auth-admin.html'));
});

// Home page
app.get('/', (req, res) => {
  res.sendFile(path.join(CLIENT_PUBLIC, 'index.html'));
}); 
 
// Fallback for all other non-API, non-static, non-auth routes (SPA support)
app.get(/^\/(?!api\/|public\/|auth\/|buyer\/|seller\/|agent\/|admin\/|error\/).*/, (req, res) => {
  res.sendFile(path.join(CLIENT_PUBLIC, 'index.html'));
});

// 404 fallback for truly missing URLs (HTML only)
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  if (req.path.startsWith('/error/unauthorized')) {
    return res.status(401).sendFile(path.join(__dirname, '../client/error/unauthorized.html'));
  }
  if (req.path.startsWith('/error/forbidden')) {
    return res.status(403).sendFile(path.join(__dirname, '../client/error/forbidden.html'));
  }
  res.status(404).sendFile(path.join(CLIENT_ERROR, '404.html'));
});    
    
// Global error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  if (req.path.startsWith('/api/')) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  } else {
    res.status(500).sendFile(path.join(CLIENT_ERROR, '404.html'));
  }
});

function startServer(portList) {
  if (!portList.length) {
    console.error('❌ No available ports. Server not started.');
    process.exit(1);
  }
  const port = portList[0];
  const listener = server.listen(port, () => {
    const actualPort = listener.address().port;
    console.log(`✅ Server (HTTP+Socket.io) running on port ${actualPort}`);
    
    // Store the actual server port globally for referral URL generation
    global.serverPort = actualPort;
    process.env.ACTUAL_PORT = actualPort;
    
    // 🔒 Start order ownership monitoring
    startOrderOwnershipMonitoring();
    
    // 🚀 Initialize Real-Time WebSocket Service
    initializeRealTimeService();
  });
  listener.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️ Port ${port} in use, trying next...`);
      startServer(portList.slice(1));
    } else {
      console.error('❌ Server error:', err);
      process.exit(1);
    }
  });
}     
 
// 🔒 Order Ownership Monitoring
async function startOrderOwnershipMonitoring() {
  try {
    const OrderOwnershipMonitor = require('./monitor-order-ownership');
    const monitor = new OrderOwnershipMonitor();
          
    await monitor.connect(); 
    await monitor.startMonitoring();
    
    // Store monitor instance for cleanup
    global.orderMonitor = monitor;
    
    console.log('🔒 Order ownership monitoring started');
  } catch (error) {
    console.error('❌ Failed to start order ownership monitoring:', error.message);
    // Don't exit the server, just log the error
  }
}

// 🚀 Real-Time WebSocket Service Initialization
function initializeRealTimeService() {
  try {
    const RealTimeService = require('./services/real-time-service');
    const realTimeService = new RealTimeService(server);
    
    // Store service instance globally for access from routes
    global.realTimeService = realTimeService;
    
    console.log('🚀 Real-Time WebSocket Service initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Real-Time Service:', error.message);
  }
}

// Add global error handler middleware (must be after all routes)
try {
  const errorHandler = require('./middleware/error-handler');
  app.use(errorHandler);
  console.log('✅ Global Error Handler Connected');
} catch (errorHandlerError) {
  console.error('❌ Failed to load error handler:', errorHandlerError.message);
}
  
// Graceful shutdown  
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  
  // Stop order monitoring if running
  if (global.orderMonitor) {
    await global.orderMonitor.stopMonitoring();
    await global.orderMonitor.cleanup();
  }
    
  process.exit(0); 
});
         
const portCandidates = [
  process.env.PORT && !isNaN(Number(process.env.PORT)) ? Number(process.env.PORT) : null,
  3001,
  3002,
  3003, 
  0 // random open port
].filter(Boolean); 
startServer(portCandidates); 





 

   
    
 
   


