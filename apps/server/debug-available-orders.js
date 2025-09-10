const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'add_physical_product',
    port: process.env.DB_PORT || 3306
};

async function debugAvailableOrders() {
    let connection;
    
    try {
        connection = await mysql.createConnection(dbConfig);
        
        console.log('🔍 Debugging Available Orders Query...');
        
        // Check all orders
        const [allOrders] = await connection.query(`
            SELECT id, order_number, status, agent_id, marketplace_type, created_at
            FROM orders 
            ORDER BY created_at DESC 
            LIMIT 10
        `);
        
        console.log('\n📋 Recent Orders:');
        allOrders.forEach(order => {
            console.log(`  - Order ${order.id}: ${order.status} (Agent: ${order.agent_id}) [${order.marketplace_type}]`);
        });
        
        // Check available orders query
        const [availableOrders] = await connection.query(`
            SELECT 
                o.id,
                o.order_number,
                o.total_amount,
                o.status,
                o.agent_id,
                o.marketplace_type,
                o.created_at,
                u.username as buyer_name,
                s.username as seller_name,
                ps.name as pickup_site
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN users s ON o.seller_id = s.id
            LEFT JOIN pickup_sites ps ON o.pickup_site_id = ps.id
            WHERE o.agent_id IS NULL 
            AND o.status IN ('PENDING', 'PROCESSING')
            AND o.marketplace_type = 'physical'
            ORDER BY o.created_at DESC
        `);
        
        console.log(`\n📋 Available Orders Query Result: ${availableOrders.length} orders`);
        availableOrders.forEach(order => {
            console.log(`  - Order ${order.id}: $${order.total_amount} (${order.status}) - Agent: ${order.agent_id}`);
        });
        
        // Check specific order 161
        const [order161] = await connection.query(`
            SELECT * FROM orders WHERE id = 161
        `);
        
        if (order161.length > 0) {
            const order = order161[0];
            console.log(`\n📦 Order 161 Details:`);
            console.log(`  - Status: '${order.status}'`);
            console.log(`  - Agent ID: ${order.agent_id}`);
            console.log(`  - Marketplace Type: '${order.marketplace_type}'`);
            console.log(`  - Should be available: ${order.agent_id === null && ['PENDING', 'PROCESSING'].includes(order.status) && order.marketplace_type === 'physical'}`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

debugAvailableOrders();