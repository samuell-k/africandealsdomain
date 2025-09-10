const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'add_physical_product',
    port: process.env.DB_PORT || 3306
};

async function fixOrderStatusEnum() {
    let connection;
    
    try {
        connection = await mysql.createConnection(dbConfig);
        
        console.log('🔧 Fixing order status with valid ENUM values...');
        
        // The valid ENUM values from the schema are:
        // 'PENDING','PROCESSING','ASSIGNED_TO_PDA','ASSIGNED_TO_FDA','PDA_EN_ROUTE_TO_SELLER','FDA_EN_ROUTE_TO_SELLER','PDA_AT_SELLER','FDA_AT_SELLER','PICKED_FROM_SELLER','EN_ROUTE_TO_PSM','EN_ROUTE_TO_BUYER','FDA_EN_ROUTE_TO_BUYER','DEPOSITED_AT_PSM','READY_FOR_PICKUP','DELIVERED','COMPLETED','CANCELLED'
        
        // Update orders to use 'PENDING' status (which should be available for pickup)
        const [updateResult] = await connection.query(`
            UPDATE orders 
            SET status = 'PENDING' 
            WHERE (status = '' OR status IS NULL)
            AND agent_id IS NULL
            AND marketplace_type = 'physical'
        `);
        
        console.log(`✅ Updated ${updateResult.affectedRows} orders to PENDING status`);
        
        // Check the available orders endpoint logic - let me see what statuses it accepts
        console.log('\n🔍 Checking what statuses the available orders endpoint accepts...');
        
        // Based on the code I saw earlier, it checks for: 'PAYMENT_CONFIRMED', 'processing', 'confirmed'
        // But these are not valid ENUM values! Let me update the endpoint to use valid ENUM values
        
        // For now, let's check what orders we have with PENDING status
        const [pendingOrders] = await connection.query(`
            SELECT id, status, agent_id FROM orders 
            WHERE status = 'PENDING'
            AND agent_id IS NULL
            AND marketplace_type = 'physical'
            LIMIT 5
        `);
        
        console.log(`📋 Orders with PENDING status: ${pendingOrders.length}`);
        pendingOrders.forEach(order => {
            console.log(`  - Order ${order.id}: ${order.status} (Agent: ${order.agent_id})`);
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

fixOrderStatusEnum();