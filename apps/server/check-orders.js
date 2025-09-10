const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

async function checkOrders() {
  let connection;
  
  try {
    console.log('🔍 Checking orders in database...');
    
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'add_physical_product',
      port: process.env.DB_PORT || 3333
    });

    console.log('✅ Connected to database');

    // Check all orders
    const [orders] = await connection.execute(`
      SELECT 
        o.id,
        o.order_number,
        o.total_amount,
        o.status,
        o.created_at,
        u.id as user_id,
        u.name as user_name,
        u.email as user_email
      FROM orders o
      JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
    `);

    console.log('📋 All orders in database:');
    console.log('Total orders found:', orders.length);
    
    if (orders.length === 0) {
      console.log('❌ No orders found in database');
    } else {
      orders.forEach((order, index) => {
        console.log(`${index + 1}. Order #${order.order_number}`);
        console.log(`   - User: ${order.user_name} (${order.user_email}) - ID: ${order.user_id}`);
        console.log(`   - Amount: $${order.total_amount}`);
        console.log(`   - Status: ${order.status}`);
        console.log(`   - Created: ${order.created_at}`);
        console.log('');
      });
    }

    // Check users
    const [users] = await connection.execute(`
      SELECT id, name, email, role, created_at
      FROM users
      ORDER BY created_at DESC
    `);

    console.log('👥 All users in database:');
    console.log('Total users found:', users.length);
    
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (${user.email}) - Role: ${user.role} - ID: ${user.id}`);
    });

    console.log('🎉 Database check completed!');
    
  } catch (error) {
    console.error('❌ Check failed:', error.message);
    console.error('Error details:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkOrders(); 