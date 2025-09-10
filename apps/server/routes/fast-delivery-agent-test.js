const express = require('express');
const router = express.Router();
const mockDb = require('../mock-database.js');
const jwt = require('jsonwebtoken');

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ 
            success: false, 
            message: 'Access token required' 
        });
    }

    // For testing, we'll skip JWT verification and create a mock agent
    req.user = {
        id: 'agent123',
        role: 'fast_delivery_agent',
        name: 'Test Agent'
    };
    next();
};

console.log('🔧 [FAST-DELIVERY-AGENT-TEST] Loading test fast delivery agent routes...');

// Get available orders for agent
router.get('/available-orders', authenticateToken, async (req, res) => {
    try {
        const { orderType, limit = 20 } = req.query;
        console.log('[AVAILABLE-ORDERS] Fetching orders for agent:', req.user.id, 'Type:', orderType);
        
        const connection = await mockDb.createConnection();
        let allOrders = [];
        
        // Get local market orders if requested or no specific type
        if (!orderType || orderType === 'local_market') {
            const localMarketQuery = `
                SELECT 
                    lmo.*,
                    u.name as buyer_name,
                    u.phone as buyer_phone,
                    u.email as buyer_email,
                    COUNT(lmoi.id) as item_count,
                    GROUP_CONCAT(lmoi.product_name SEPARATOR ', ') as product_names,
                    'local_market' as order_type
                FROM local_market_orders lmo
                LEFT JOIN users u ON lmo.buyer_id = u.id
                LEFT JOIN local_market_order_items lmoi ON lmo.id = lmoi.order_id
                WHERE lmo.status IN ("confirmed", "preparing", "ready_for_pickup") 
                AND lmo.payment_status = "confirmed"
                AND lmo.agent_id IS NULL
                GROUP BY lmo.id
                ORDER BY lmo.created_at DESC
                LIMIT ?
            `;
            
            const [localMarketOrders] = await connection.execute(localMarketQuery, [parseInt(limit)]);
            allOrders = allOrders.concat(localMarketOrders || []);
        }
        
        // TODO: Add other order types (grocery, regular) here when needed
        
        await connection.end();
        
        // Calculate distances (mock calculation for testing)
        const processedOrders = allOrders.map(order => ({
            ...order,
            distance: Math.round((Math.random() * 10 + 1) * 100) / 100, // Random distance 1-10km
            estimated_pickup_time: Math.round(Math.random() * 20 + 10), // 10-30 minutes
            priority_score: Math.round(Math.random() * 100) // 0-100 priority score
        }));
        
        // Sort by priority and distance
        processedOrders.sort((a, b) => {
            if (a.priority_score !== b.priority_score) {
                return b.priority_score - a.priority_score; // Higher priority first
            }
            return a.distance - b.distance; // Closer orders first
        });
        
        res.json({
            success: true,
            orders: processedOrders,
            total: processedOrders.length,
            agent_capacity: {
                current_orders: 1, // Mock current capacity
                max_orders: 5,
                available_slots: 4
            }
        });
        
    } catch (error) {
        console.error('[AVAILABLE-ORDERS] Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch available orders',
            error: error.message
        });
    }
});

// Accept an order
router.post('/accept-order/:orderId', authenticateToken, async (req, res) => {
    try {
        const { orderId } = req.params;
        const { orderType = 'local_market' } = req.body;
        const agentId = req.user.id;
        
        console.log('[ACCEPT-ORDER] Agent', agentId, 'accepting order:', orderId, 'Type:', orderType);
        
        const connection = await mockDb.createConnection();
        
        // Check agent capacity (mock check)
        const currentOrders = 1; // Mock current orders
        const maxOrders = 5;
        
        if (currentOrders >= maxOrders) {
            await connection.end();
            return res.status(400).json({
                success: false,
                message: 'Agent has reached maximum order capacity'
            });
        }
        
        // Handle local market orders
        if (orderType === 'local_market') {
            // Check if order exists and is available
            const [orders] = await connection.execute(
                'SELECT * FROM local_market_orders WHERE id = ? AND agent_id IS NULL AND status IN ("confirmed", "preparing", "ready_for_pickup")',
                [orderId]
            );
            
            if (!orders || orders.length === 0) {
                await connection.end();
                return res.status(404).json({
                    success: false,
                    message: 'Order not found or already assigned'
                });
            }
            
            // Assign agent to order
            const [result] = await connection.execute(
                'UPDATE local_market_orders SET agent_id = ?, status = "out_for_delivery", assigned_at = NOW(), delivery_started_at = NOW(), updated_at = NOW() WHERE id = ?',
                [agentId, orderId]
            );
            
            if (result.affectedRows === 0) {
                await connection.end();
                return res.status(400).json({
                    success: false,
                    message: 'Failed to assign order'
                });
            }
        }
        
        await connection.end();
        
        res.json({
            success: true,
            message: 'Order accepted successfully',
            data: {
                orderId,
                orderType,
                agentId,
                status: 'out_for_delivery',
                assignedAt: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('[ACCEPT-ORDER] Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to accept order',
            error: error.message
        });
    }
});

// Get agent's current orders
router.get('/my-orders', authenticateToken, async (req, res) => {
    try {
        const agentId = req.user.id;
        console.log('[MY-ORDERS] Fetching orders for agent:', agentId);
        
        const connection = await mockDb.createConnection();
        
        // Get local market orders assigned to this agent
        const query = `
            SELECT 
                lmo.*,
                u.name as buyer_name,
                u.phone as buyer_phone,
                u.email as buyer_email,
                COUNT(lmoi.id) as item_count,
                GROUP_CONCAT(lmoi.product_name SEPARATOR ', ') as product_names,
                'local_market' as order_type
            FROM local_market_orders lmo
            LEFT JOIN users u ON lmo.buyer_id = u.id
            LEFT JOIN local_market_order_items lmoi ON lmo.id = lmoi.order_id
            WHERE lmo.agent_id = ?
            AND lmo.status IN ("out_for_delivery", "delivered")
            GROUP BY lmo.id
            ORDER BY lmo.assigned_at DESC
        `;
        
        const [orders] = await connection.execute(query, [agentId]);
        
        await connection.end();
        
        res.json({
            success: true,
            orders: orders || [],
            total: orders ? orders.length : 0
        });
        
    } catch (error) {
        console.error('[MY-ORDERS] Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch agent orders',
            error: error.message
        });
    }
});

console.log('✅ [FAST-DELIVERY-AGENT-TEST] Fast delivery agent test routes loaded successfully');

module.exports = router;