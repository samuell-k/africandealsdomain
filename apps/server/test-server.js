const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3003; // Use different port to avoid conflicts

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from client directory
app.use('/seller', express.static(path.join(__dirname, '..', 'client', 'seller')));
app.use('/public', express.static(path.join(__dirname, '..', 'client', 'public')));

// Load test routes
const localMarketOrdersTest = require('./routes/local-market-orders-test');
const fastDeliveryAgentTest = require('./routes/fast-delivery-agent-test');

// Mount test routes
app.use('/api/local-market-orders', localMarketOrdersTest);
app.use('/api/fast-delivery-agent', fastDeliveryAgentTest);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Test server is running',
        timestamp: new Date().toISOString(),
        endpoints: [
            'GET /api/local-market-orders/seller/orders',
            'GET /api/local-market-orders/seller/orders/:orderId',
            'POST /api/local-market-orders/seller/orders/:orderId/status',
            'GET /api/fast-delivery-agent/available-orders',
            'POST /api/fast-delivery-agent/accept-order/:orderId',
            'GET /api/fast-delivery-agent/my-orders'
        ]
    });
});

// Serve the seller orders page
app.get('/seller/local-market-orders', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'seller', 'local-market-orders.html'));
});

// Default route
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Local Market Integration Test Server',
        version: '1.0.0',
        endpoints: {
            health: '/api/health',
            seller_dashboard: '/seller/local-market-orders',
            api_docs: '/api/health'
        }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: err.message
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        path: req.path
    });
});

// Start server
app.listen(PORT, () => {
    console.log('🚀 Test Server Started Successfully!');
    console.log('='.repeat(50));
    console.log('📡 Server running on: http://localhost:' + PORT);
    console.log('🏪 Seller Dashboard: http://localhost:' + PORT + '/seller/local-market-orders');
    console.log('🔍 Health Check: http://localhost:' + PORT + '/api/health');
    console.log('='.repeat(50));
    console.log('📋 Available Test Endpoints:');
    console.log('   GET  /api/local-market-orders/seller/orders');
    console.log('   GET  /api/local-market-orders/seller/orders/:orderId');
    console.log('   POST /api/local-market-orders/seller/orders/:orderId/status');
    console.log('   GET  /api/fast-delivery-agent/available-orders');
    console.log('   POST /api/fast-delivery-agent/accept-order/:orderId');
    console.log('   GET  /api/fast-delivery-agent/my-orders');
    console.log('='.repeat(50));
    console.log('🎯 Ready for testing!');
});

module.exports = app;