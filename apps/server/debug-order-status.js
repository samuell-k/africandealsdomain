const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'add_physical_product',
    port: process.env.DB_PORT || 3306
};

async function debugOrderStatus() {
    let connection;
    
    try {
        connection = await mysql.createConnection(dbConfig);
        
        console.log('🔍 Debugging Order Status After Acceptance...');
        
        // Check order 156 specifically
        const [orders] = await connection.query(`
            SELECT 
                id, order_number, status, agent_id, user_id, seller_id,
                marketplace_type, created_at, updated_at
            FROM orders 
            WHERE id = 156
        `);
        
        if (orders.length > 0) {
            const order = orders[0];
            console.log('\n📦 Order 156 Details:');
            console.log(`  - ID: ${order.id}`);
            console.log(`  - Order Number: ${order.order_number}`);
            console.log(`  - Status: ${order.status}`);
            console.log(`  - Agent ID: ${order.agent_id}`);
            console.log(`  - User ID: ${order.user_id}`);
            console.log(`  - Seller ID: ${order.seller_id}`);
            console.log(`  - Marketplace Type: ${order.marketplace_type}`);
            console.log(`  - Created: ${order.created_at}`);
            console.log(`  - Updated: ${order.updated_at}`);
            
            // Check what the active orders query would return
            console.log('\n🔍 Testing Active Orders Query...');
            const [activeOrders] = await connection.query(`
                SELECT 
                    o.id, o.order_number, o.status, o.agent_id, o.total_amount,
                    o.created_at,
                    u.username as buyer_name,
                    u.email as buyer_email,
                    u.phone as buyer_phone,
                    s.username as seller_name,
                    ps.name as pickup_site,
                    ps.address_line1 as pickup_site_address
                FROM orders o
                LEFT JOIN users u ON o.user_id = u.id
                LEFT JOIN users s ON o.seller_id = s.id
                LEFT JOIN pickup_sites ps ON o.pickup_site_id = ps.id
                WHERE o.agent_id = ? 
                AND o.status IN ('PDA_ASSIGNED', 'PDA_EN_ROUTE_TO_SELLER', 'PDA_AT_SELLER', 'PICKED_FROM_SELLER', 'EN_ROUTE_TO_PSM')
                AND o.marketplace_type = 'physical'
                ORDER BY o.created_at DESC
            `, [299]); // PDA user ID
            
            console.log(`📋 Active orders query returned ${activeOrders.length} orders`);
            if (activeOrders.length > 0) {
                activeOrders.forEach(order => {
                    console.log(`  - Order ${order.id}: ${order.status} (Agent: ${order.agent_id})`);
                });
            }
            
            // Check if the issue is with the agent_id
            if (order.agent_id !== 299) {
                console.log(`⚠️ Issue found: Order agent_id is ${order.agent_id}, but PDA user_id is 299`);
                
                // Fix the agent_id
                console.log('🔧 Fixing agent_id...');
                await connection.query(`
                    UPDATE orders SET agent_id = 299 WHERE id = 156
                `);
                console.log('✅ Agent ID updated to 299');
                
                // Test active orders query again
                const [fixedActiveOrders] = await connection.query(`
                    SELECT id, status, agent_id FROM orders 
                    WHERE agent_id = 299 
                    AND status IN ('PDA_ASSIGNED', 'PDA_EN_ROUTE_TO_SELLER', 'PDA_AT_SELLER', 'PICKED_FROM_SELLER', 'EN_ROUTE_TO_PSM')
                    AND marketplace_type = 'physical'
                `);
                
                console.log(`📋 After fix: ${fixedActiveOrders.length} active orders found`);
            }
            
        } else {
            console.log('❌ Order 156 not found');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

debugOrderStatus();