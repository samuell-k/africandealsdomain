const express = require('express');
const path = require('path');
const http = require('http');
const app = express();
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, { cors: { origin: '*', methods: ['GET','POST'] } });
const cors = require('cors');
app.use(cors());   
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
   
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

// Serve static assets
app.use('/public', express.static(CLIENT_PUBLIC));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/shared', express.static(path.join(__dirname, '../client/shared')));
app.use('/buyer', express.static(path.join(__dirname, '../client/buyer')));
app.use('/seller', express.static(path.join(__dirname, '../client/seller')));
app.use('/agent', express.static(path.join(__dirname, '../client/agent')));
app.use('/admin', express.static(path.join(__dirname, '../client/admin')));
app.use('/error', express.static(path.join(__dirname, '../client/error')));

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
  
  const messagesRouter = require('./routes/messages');
  app.use('/api/messages', messagesRouter);
  console.log('✅ Messages API Connected');
  
  const wishlistRouter = require('./routes/wishlist');
  app.use('/api/wishlist', wishlistRouter);
  console.log('✅ Wishlist API Connected');
  
  const ordersRouter = require('./routes/orders');
  app.use('/api/orders', ordersRouter);
  console.log('✅ Orders API Connected');
  
  const paymentMethodsRouter = require('./routes/payment-methods');
  app.use('/api/payment-methods', paymentMethodsRouter);
  console.log('✅ Payment Methods API Connected');
  
  const paymentTransactionsRouter = require('./routes/payment-transactions');
  app.use('/api/payment-transactions', paymentTransactionsRouter);
  console.log('✅ Payment Transactions API Connected');
  
  const cartRouter = require('./routes/cart');
  app.use('/api/cart', cartRouter);
  console.log('✅ Cart API Connected');
  
  const sellerRouter = require('./routes/seller');
  app.use('/api/seller', sellerRouter);
  console.log('✅ Seller API Connected');
  
  const adminRouter = require('./routes/admin');
  app.use('/api/admin', adminRouter);
  console.log('✅ Admin API Connected');
  
  const agentsRouter = require('./routes/agents');
  app.use('/api/agents', agentsRouter);
  console.log('✅ Agents API Connected');
  
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
  
  const shippingRouter = require('./routes/shipping');
  app.use('/api/shipping', shippingRouter);
  console.log('✅ Shipping API Connected');
  
  const shippingRulesRouter = require('./routes/shipping-rules');
  app.use('/api/shipping-rules', shippingRulesRouter);
  console.log('✅ Shipping Rules API Connected');
  
  const shippingAnalyticsRouter = require('./routes/shipping-analytics');
  app.use('/api/shipping-analytics', shippingAnalyticsRouter);
  console.log('✅ Shipping Analytics API Connected');
  
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
  
  const paymentEscrowRouter = require('./routes/payment-escrow');
  app.use('/api/payment-escrow', paymentEscrowRouter);
  console.log('✅ Payment Escrow API Connected');
} catch (err) {
  console.error('❌ API route error:', err);
}
            
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
    
    // 🔒 Start order ownership monitoring
    startOrderOwnershipMonitoring();
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