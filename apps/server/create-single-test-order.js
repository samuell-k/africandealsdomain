const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'add_physical_product',
    port: process.env.DB_PORT || 3306
};

async function createSingleTestOrder() {
    let connection;
    
    try {
        connection = await mysql.createConnection(dbConfig);
        
        console.log('🛒 Creating single test order...');
        
        const orderNumber = `TEST-${Date.now()}`;
        const [result] = await connection.query(`
            INSERT INTO orders (
                order_number, user_id, seller_id, pickup_site_id, total_amount, status, 
                marketplace_type, payment_status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `, [orderNumber, 1, 4, 11, 29.99, 'PAYMENT_CONFIRMED', 'physical', 'completed']);
        
        const orderId = result.insertId;
        console.log(`✅ Created test order ${orderId}: ${orderNumber}`);
        
        return orderId;
        
    } catch (error) {
        console.error('❌ Error creating test order:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

createSingleTestOrder();