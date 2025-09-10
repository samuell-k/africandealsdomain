const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

async function cleanSampleOrders() {
  let connection;
   
  try {
    console.log('🧹 Cleaning sample orders from database...');
    
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'add_physical_product',
      port: process.env.DB_PORT || 3333
    });

    console.log('✅ Connected to database');

    // Remove sample orders (orders with order_number starting with 'ORD-2024-')
    const [result] = await connection.execute(`
      DELETE FROM order_items WHERE order_id IN (
        SELECT id FROM orders WHERE order_number LIKE 'ORD-2024-%'
      )
    `);
    console.log(`🗑️ Deleted ${result.affectedRows} sample order items`);

    const [orderResult] = await connection.execute(`
      DELETE FROM orders WHERE order_number LIKE 'ORD-2024-%'
    `);
    console.log(`🗑️ Deleted ${orderResult.affectedRows} sample orders`);

    // Check remaining orders
    const [remainingOrders] = await connection.execute(`
      SELECT 
        o.id,
        o.order_number,
        o.total_amount,
        o.status,
        o.created_at,
        u.name as user_name,
        u.email as user_email
      FROM orders o
      JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
    `);

    console.log('📋 Remaining orders in database:');
    console.log('Total orders found:', remainingOrders.length);
    
    if (remainingOrders.length === 0) {
      console.log('✅ Database is clean - no orders found');
    } else {
      remainingOrders.forEach((order, index) => {
        console.log(`${index + 1}. Order #${order.order_number}`);
        console.log(`   - User: ${order.user_name} (${order.user_email})`);
        console.log(`   - Amount: $${order.total_amount}`);
        console.log(`   - Status: ${order.status}`);
        console.log(`   - Created: ${order.created_at}`);
        console.log('');
      });
    }

    console.log('🎉 Sample orders cleanup completed!');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    console.error('Error details:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

cleanSampleOrders(); 