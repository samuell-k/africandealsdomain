/**
 * Real-Time WebSocket Service
 * Handles live updates for agents, customers, and admin
 */

const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const pool = require('../db');

class RealTimeService {
    constructor(server) {
        this.wss = new WebSocket.Server({ 
            server,
            path: '/ws',
            verifyClient: this.verifyClient.bind(this)
        });
        
        this.clients = new Map(); // Store connected clients
        this.agentLocations = new Map(); // Store agent locations
        this.orderUpdates = new Map(); // Store order update subscriptions
        
        this.setupWebSocketHandlers();
        this.startLocationBroadcast();
        
        console.log('🔴 Real-Time WebSocket Service initialized');
    }

    /**
     * Verify WebSocket client connection
     */
    verifyClient(info) {
        const url = new URL(info.req.url, 'http://localhost');
        const token = url.searchParams.get('token');
        
        if (!token) {
            return false;
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production');
            info.req.user = decoded;
            return true;
        } catch (error) {
            console.error('WebSocket token verification failed:', error);
            return false;
        }
    }

    /**
     * Setup WebSocket event handlers
     */
    setupWebSocketHandlers() {
        this.wss.on('connection', (ws, req) => {
            const user = req.user;
            const clientId = `${user.role}_${user.userId}`;
            
            // Store client connection
            this.clients.set(clientId, {
                ws,
                user,
                lastSeen: Date.now(),
                subscriptions: new Set()
            });

            console.log(`📱 Client connected: ${clientId} (${user.role})`);

            // Handle incoming messages
            ws.on('message', async (message) => {
                try {
                    const data = JSON.parse(message);
                    await this.handleMessage(clientId, data);
                } catch (error) {
                    console.error('WebSocket message error:', error);
                    this.sendError(ws, 'Invalid message format');
                }
            });

            // Handle client disconnect
            ws.on('close', () => {
                console.log(`📱 Client disconnected: ${clientId}`);
                this.clients.delete(clientId);
                this.agentLocations.delete(clientId);
            });

            // Handle connection errors
            ws.on('error', (error) => {
                console.error(`WebSocket error for ${clientId}:`, error);
            });

            // Send welcome message
            this.sendMessage(ws, {
                type: 'connection_established',
                clientId,
                timestamp: new Date().toISOString()
            });
        });
    }

    /**
     * Handle incoming WebSocket messages
     */
    async handleMessage(clientId, data) {
        const client = this.clients.get(clientId);
        if (!client) return;

        const { type, payload } = data;

        switch (type) {
            case 'location_update':
                await this.handleLocationUpdate(clientId, payload);
                break;
                
            case 'subscribe_orders':
                await this.handleOrderSubscription(clientId, payload);
                break;
                
            case 'order_status_update':
                await this.handleOrderStatusUpdate(clientId, payload);
                break;
                
            case 'ping':
                this.sendMessage(client.ws, { type: 'pong', timestamp: Date.now() });
                break;
                
            default:
                console.log(`Unknown message type: ${type}`);
        }

        // Update last seen
        client.lastSeen = Date.now();
    }

    /**
     * Handle agent location updates
     */
    async handleLocationUpdate(clientId, payload) {
        const client = this.clients.get(clientId);
        if (!client || client.user.role !== 'agent') return;

        const { latitude, longitude, accuracy, heading, speed } = payload;

        // Validate coordinates
        if (!latitude || !longitude || 
            latitude < -90 || latitude > 90 || 
            longitude < -180 || longitude > 180) {
            this.sendError(client.ws, 'Invalid GPS coordinates');
            return;
        }

        try {
            // Get agent info
            const [agents] = await pool.query(
                'SELECT * FROM agents WHERE user_id = ?',
                [client.user.userId]
            );

            if (agents.length === 0) {
                this.sendError(client.ws, 'Agent not found');
                return;
            }

            const agent = agents[0];

            // Update location in database
            await pool.query(
                `UPDATE agents 
                 SET current_location = JSON_OBJECT(
                   'lat', ?, 
                   'lng', ?, 
                   'accuracy', ?, 
                   'heading', ?, 
                   'speed', ?, 
                   'timestamp', NOW()
                 ), 
                 updated_at = NOW() 
                 WHERE id = ?`,
                [latitude, longitude, accuracy || null, heading || null, speed || null, agent.id]
            );

            // Store in memory for real-time access
            this.agentLocations.set(clientId, {
                agentId: agent.id,
                latitude,
                longitude,
                accuracy,
                heading,
                speed,
                timestamp: Date.now(),
                agentType: agent.agent_type
            });

            // Check for nearby orders and notify
            const nearbyOrders = await this.findNearbyOrders(agent.id, latitude, longitude, agent.agent_type);
            
            if (nearbyOrders.length > 0) {
                this.sendMessage(client.ws, {
                    type: 'nearby_orders',
                    orders: nearbyOrders,
                    timestamp: new Date().toISOString()
                });
            }

            // Broadcast location to subscribed customers/admin
            this.broadcastAgentLocation(agent.id, {
                latitude,
                longitude,
                accuracy,
                heading,
                speed,
                timestamp: Date.now()
            });

            // Confirm location update
            this.sendMessage(client.ws, {
                type: 'location_updated',
                location: { latitude, longitude, accuracy, heading, speed },
                nearbyOrders: nearbyOrders.length,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Location update error:', error);
            this.sendError(client.ws, 'Failed to update location');
        }
    }

    /**
     * Handle order subscription
     */
    async handleOrderSubscription(clientId, payload) {
        const client = this.clients.get(clientId);
        if (!client) return;

        const { orderId, action } = payload;

        if (action === 'subscribe') {
            client.subscriptions.add(`order_${orderId}`);
            this.sendMessage(client.ws, {
                type: 'subscription_confirmed',
                orderId,
                timestamp: new Date().toISOString()
            });
        } else if (action === 'unsubscribe') {
            client.subscriptions.delete(`order_${orderId}`);
        }
    }

    /**
     * Handle order status updates
     */
    async handleOrderStatusUpdate(clientId, payload) {
        const client = this.clients.get(clientId);
        if (!client || client.user.role !== 'agent') return;

        const { orderId, status, notes, location } = payload;

        try {
            // Verify order belongs to agent
            const [orders] = await pool.query(
                'SELECT * FROM orders WHERE id = ? AND agent_id = (SELECT id FROM agents WHERE user_id = ?)',
                [orderId, client.user.userId]
            );

            if (orders.length === 0) {
                this.sendError(client.ws, 'Order not found or not assigned to you');
                return;
            }

            // Update order status
            await pool.query(
                'UPDATE orders SET tracking_status = ?, agent_delivery_notes = ?, updated_at = NOW() WHERE id = ?',
                [status, notes || null, orderId]
            );

            // Broadcast update to all subscribers
            this.broadcastOrderUpdate(orderId, {
                status,
                notes,
                location,
                timestamp: new Date().toISOString(),
                agentId: client.user.userId
            });

            // Confirm update
            this.sendMessage(client.ws, {
                type: 'order_status_updated',
                orderId,
                status,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Order status update error:', error);
            this.sendError(client.ws, 'Failed to update order status');
        }
    }

    /**
     * Broadcast agent location to subscribers
     */
    broadcastAgentLocation(agentId, locationData) {
        const message = {
            type: 'agent_location_update',
            agentId,
            location: locationData
        };

        this.clients.forEach((client, clientId) => {
            if (client.subscriptions.has(`agent_${agentId}`)) {
                this.sendMessage(client.ws, message);
            }
        });
    }

    /**
     * Broadcast order updates to subscribers
     */
    broadcastOrderUpdate(orderId, updateData) {
        const message = {
            type: 'order_update',
            orderId,
            update: updateData
        };

        this.clients.forEach((client, clientId) => {
            if (client.subscriptions.has(`order_${orderId}`)) {
                this.sendMessage(client.ws, message);
            }
        });
    }

    /**
     * Send new order notifications to available agents
     */
    async notifyAvailableAgents(order) {
        try {
            // Get available agents based on order type
            let agentType = 'pickup_delivery';
            if (order.marketplace_type === 'grocery') {
                agentType = 'fast_delivery';
            }

            const [availableAgents] = await pool.query(
                `SELECT a.*, u.id as user_id 
                 FROM agents a 
                 JOIN users u ON a.user_id = u.id 
                 WHERE a.agent_type = ? 
                 AND a.status = 'available' 
                 AND a.admin_approval_status = 'approved'`,
                [agentType]
            );

            const message = {
                type: 'new_order_available',
                order: {
                    id: order.id,
                    order_number: order.order_number,
                    total_amount: order.total_amount,
                    pickup_address: order.pickup_address,
                    delivery_address: order.delivery_address,
                    created_at: order.created_at
                },
                timestamp: new Date().toISOString()
            };

            // Send to all available agents of the correct type
            availableAgents.forEach(agent => {
                const clientId = `agent_${agent.user_id}`;
                const client = this.clients.get(clientId);
                if (client) {
                    this.sendMessage(client.ws, message);
                }
            });

        } catch (error) {
            console.error('Error notifying available agents:', error);
        }
    }

    /**
     * Start periodic location broadcast
     */
    startLocationBroadcast() {
        setInterval(() => {
            // Broadcast all agent locations to admin dashboard
            const agentLocations = Array.from(this.agentLocations.entries()).map(([clientId, location]) => ({
                clientId,
                ...location
            }));

            if (agentLocations.length > 0) {
                this.clients.forEach((client, clientId) => {
                    if (client.user.role === 'admin') {
                        this.sendMessage(client.ws, {
                            type: 'agent_locations_update',
                            locations: agentLocations,
                            timestamp: new Date().toISOString()
                        });
                    }
                });
            }

            // Clean up stale connections
            this.cleanupStaleConnections();

        }, 30000); // Every 30 seconds
    }

    /**
     * Clean up stale connections
     */
    cleanupStaleConnections() {
        const now = Date.now();
        const staleThreshold = 5 * 60 * 1000; // 5 minutes

        this.clients.forEach((client, clientId) => {
            if (now - client.lastSeen > staleThreshold) {
                console.log(`🧹 Cleaning up stale connection: ${clientId}`);
                client.ws.terminate();
                this.clients.delete(clientId);
                this.agentLocations.delete(clientId);
            }
        });
    }

    /**
     * Find nearby orders for agent
     */
    async findNearbyOrders(agentId, latitude, longitude, agentType) {
        try {
            let query = '';
            let params = [];

            if (agentType === 'fast_delivery') {
                query = `
                    SELECT id, order_number, delivery_lat, delivery_lng, total_amount, created_at
                    FROM grocery_orders 
                    WHERE agent_id IS NULL 
                    AND status IN ('pending', 'confirmed')
                    AND delivery_lat IS NOT NULL 
                    AND delivery_lng IS NOT NULL
                    HAVING (
                        6371 * acos(
                            cos(radians(?)) * cos(radians(delivery_lat)) * 
                            cos(radians(delivery_lng) - radians(?)) + 
                            sin(radians(?)) * sin(radians(delivery_lat))
                        )
                    ) <= 5
                    ORDER BY created_at DESC
                    LIMIT 3
                `;
                params = [latitude, longitude, latitude];
            } else if (agentType === 'pickup_delivery') {
                query = `
                    SELECT id, order_number, pickup_lat, pickup_lng, delivery_lat, delivery_lng, total_amount, created_at
                    FROM orders 
                    WHERE agent_id IS NULL 
                    AND status IN ('pending', 'confirmed')
                    AND pickup_lat IS NOT NULL 
                    AND pickup_lng IS NOT NULL
                    HAVING (
                        6371 * acos(
                            cos(radians(?)) * cos(radians(pickup_lat)) * 
                            cos(radians(pickup_lng) - radians(?)) + 
                            sin(radians(?)) * sin(radians(pickup_lat))
                        )
                    ) <= 10
                    ORDER BY created_at DESC
                    LIMIT 3
                `;
                params = [latitude, longitude, latitude];
            }

            if (query) {
                const [orders] = await pool.query(query, params);
                return orders;
            }

            return [];
        } catch (error) {
            console.error('Find nearby orders error:', error);
            return [];
        }
    }

    /**
     * Send message to WebSocket client
     */
    sendMessage(ws, message) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }

    /**
     * Send error message to WebSocket client
     */
    sendError(ws, error) {
        this.sendMessage(ws, {
            type: 'error',
            error,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Get connected clients count
     */
    getConnectedClientsCount() {
        return this.clients.size;
    }

    /**
     * Get agent locations
     */
    getAgentLocations() {
        return Array.from(this.agentLocations.values());
    }

    /**
     * Broadcast system message to all clients
     */
    broadcastSystemMessage(message) {
        this.clients.forEach((client) => {
            this.sendMessage(client.ws, {
                type: 'system_message',
                message,
                timestamp: new Date().toISOString()
            });
        });
    }
}

module.exports = RealTimeService;