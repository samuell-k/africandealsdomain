const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'add_physical_product',
    port: process.env.DB_PORT || 3306
};

async function fixTestOrders() {
    let connection;
    
    try {
        connection = await mysql.createConnection(dbConfig);
        
        console.log('🔧 Fixing test orders with proper status...');
        
        // Update orders with empty status
        const [result] = await connection.query(`
            UPDATE orders 
            SET status = 'PAYMENT_CONFIRMED' 
            WHERE status = '' OR status IS NULL
            AND agent_id IS NULL
            AND marketplace_type = 'physical'
        `);
        
        console.log(`✅ Updated ${result.affectedRows} orders with PAYMENT_CONFIRMED status`);
        
        // Check available orders now
        const [availableOrders] = await connection.query(`
            SELECT id, order_number, status, total_amount
            FROM orders 
            WHERE agent_id IS NULL 
            AND status IN ('PAYMENT_CONFIRMED', 'processing', 'confirmed')
            AND marketplace_type = 'physical'
            ORDER BY created_at DESC
            LIMIT 5
        `);
        
        console.log(`\n📋 Available orders now: ${availableOrders.length}`);
        availableOrders.forEach(order => {
            console.log(`  - Order ${order.id}: $${order.total_amount} (${order.status})`);
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

fixTestOrders();