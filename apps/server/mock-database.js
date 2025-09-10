// Mock Database Module for Testing with Realistic Data
const realisticMockData = require('./realistic-mock-data');

class MockDatabase {
    constructor() {
        this.data = JSON.parse(JSON.stringify(realisticMockData)); // Deep copy to avoid mutations
        console.log('🗄️  [MOCK-DB] Initialized with realistic data');
        console.log(`   📊 Users: ${this.data.users.length}`);
        console.log(`   📦 Orders: ${this.data.local_market_orders.length}`);
        console.log(`   🛍️  Order Items: ${this.data.local_market_order_items.length}`);
    }

    async createConnection() {
        return {
            execute: async (query, params = []) => {
                console.log('🔍 [MOCK-DB] Query:', query.substring(0, 100) + '...');
                console.log('📝 [MOCK-DB] Params:', params);
                
                return this.executeQuery(query, params);
            },
            end: async () => {
                console.log('🔌 [MOCK-DB] Connection closed');
            }
        };
    }

    executeQuery(query, params = []) {
        // Handle SELECT queries for local market orders
        if (query.includes('SELECT') && query.includes('local_market_orders')) {
            return this.handleOrderQueries(query, params);
        }
        
        // Handle UPDATE queries
        if (query.includes('UPDATE local_market_orders')) {
            return this.handleOrderUpdates(query, params);
        }
        
        // Handle status queries
        if (query.includes('SELECT status FROM local_market_orders WHERE id = ?')) {
            const orderId = params[0];
            const order = this.data.local_market_orders.find(o => o.id === orderId);
            return [order ? [{ status: order.status }] : []];
        }
        
        // Handle agent availability check
        if (query.includes('SELECT') && query.includes('WHERE id = ?') && query.includes('agent_id IS NULL')) {
            const orderId = params[0];
            const order = this.data.local_market_orders.find(o => 
                o.id === orderId && 
                o.agent_id === null && 
                ['confirmed', 'preparing', 'ready_for_pickup'].includes(o.status)
            );
            return [order ? [order] : []];
        }
        
        // Default response
        return [[]];
    }

    handleOrderQueries(query, params) {
        let orders = [...this.data.local_market_orders];
        
        // Apply filters based on query
        if (query.includes('WHERE')) {
            // Filter by status
            if (query.includes('status = ?')) {
                const status = params.find(p => ['confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered'].includes(p));
                if (status) {
                    orders = orders.filter(o => o.status === status);
                }
            }
            
            // Filter by agent_id IS NULL
            if (query.includes('agent_id IS NULL')) {
                orders = orders.filter(o => o.agent_id === null);
            }
            
            // Filter by agent_id = ?
            if (query.includes('agent_id = ?')) {
                const agentId = params[0];
                orders = orders.filter(o => o.agent_id === agentId);
            }
            
            // Filter by specific order ID
            if (query.includes('id = ?') && !query.includes('agent_id IS NULL')) {
                const orderId = params[0];
                orders = orders.filter(o => o.id === orderId);
            }
        }
        
        // Apply LIMIT
        if (query.includes('LIMIT ?')) {
            const limitIndex = params.findIndex(p => typeof p === 'number' && p > 0);
            if (limitIndex !== -1) {
                const limit = params[limitIndex];
                orders = orders.slice(0, limit);
            }
        }
        
        // Add order items if query includes JOIN
        if (query.includes('JOIN') && query.includes('local_market_order_items')) {
            orders = orders.map(order => {
                const items = this.data.local_market_order_items.filter(item => item.order_id === order.id);
                return {
                    ...order,
                    item_count: items.length,
                    product_names: items.map(item => item.product_name).join(', ')
                };
            });
        }
        
        // Add order_type if specified in query
        if (query.includes("'local_market' as order_type")) {
            orders = orders.map(order => ({
                ...order,
                order_type: 'local_market'
            }));
        }
        
        return [orders];
    }

    handleOrderUpdates(query, params) {
        if (query.includes('SET status = ?')) {
            // Update order status
            const status = params[0];
            const orderId = params[params.length - 1];
            const order = this.data.local_market_orders.find(o => o.id === orderId);
            
            if (order) {
                order.status = status;
                order.updated_at = new Date().toISOString();
                
                // Set appropriate timestamps
                if (status === 'preparing') {
                    order.preparation_started_at = new Date().toISOString();
                } else if (status === 'ready_for_pickup') {
                    order.ready_for_pickup_at = new Date().toISOString();
                } else if (status === 'out_for_delivery') {
                    order.delivery_started_at = new Date().toISOString();
                } else if (status === 'delivered') {
                    order.delivered_at = new Date().toISOString();
                }
                
                console.log(`✅ [MOCK-DB] Updated order ${orderId} status to ${status}`);
                return [{ affectedRows: 1 }];
            } else {
                console.log(`❌ [MOCK-DB] Order ${orderId} not found`);
                return [{ affectedRows: 0 }];
            }
        } 
        else if (query.includes('SET agent_id = ?')) {
            // Assign agent
            const agentId = params[0];
            const orderId = params[params.length - 1];
            const order = this.data.local_market_orders.find(o => o.id === orderId);
            
            if (order && order.agent_id === null) {
                order.agent_id = agentId;
                order.assigned_at = new Date().toISOString();
                order.updated_at = new Date().toISOString();
                order.status = 'out_for_delivery';
                order.delivery_started_at = new Date().toISOString();
                
                // Add agent info
                const agent = this.data.users.find(u => u.id === agentId);
                if (agent) {
                    order.agent_name = agent.name;
                    order.agent_phone = agent.phone;
                }
                
                console.log(`✅ [MOCK-DB] Assigned agent ${agentId} to order ${orderId}`);
                return [{ affectedRows: 1 }];
            } else {
                console.log(`❌ [MOCK-DB] Cannot assign agent to order ${orderId} (not found or already assigned)`);
                return [{ affectedRows: 0 }];
            }
        }
        
        return [{ affectedRows: 0 }];
    }

    // Helper method to reset data for testing
    resetData() {
        this.data = JSON.parse(JSON.stringify(realisticMockData));
        console.log('🔄 [MOCK-DB] Data reset to initial state');
    }

    // Helper method to get current data state
    getCurrentData() {
        return JSON.parse(JSON.stringify(this.data));
    }
}

// Export singleton instance
const mockDb = new MockDatabase();
module.exports = mockDb;