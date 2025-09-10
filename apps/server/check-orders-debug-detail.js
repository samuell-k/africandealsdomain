const pool = require('./db');

async function checkOrders() {
  try {
    console.log('🔍 Checking orders in database...\n');
    
    // Check if orders table exists
    const [tables] = await pool.query("SHOW TABLES LIKE 'orders'");
    if (tables.length === 0) {
      console.log('❌ Orders table does not exist!');
      return;
    }
    
    console.log('✅ Orders table exists');
    
    // Get order count
    const [countResult] = await pool.query('SELECT COUNT(*) as count FROM orders');
    console.log(`📊 Total orders: ${countResult[0].count}`);
    
    if (countResult[0].count === 0) {
      console.log('⚠️  No orders found in database');
      console.log('\n🔧 Creating test order...');
      
      // Create a test order
      const testOrder = {
        order_number: 'ORD-TEST-' + Date.now(),
        user_id: 1, // Assuming user ID 1 exists
        total_amount: 25.99,
        status: 'confirmed',
        payment_status: 'paid',
        delivery_method: 'pickup',
        shipping_address: JSON.stringify({
          first_name: 'Test',
          last_name: 'User',
          address: '123 Test Street',
          city: 'Kigali',
          country: 'Rwanda'
        })
      };
      
      const [insertResult] = await pool.query(`
        INSERT INTO orders (order_number, user_id, total_amount, status, payment_status, delivery_method, shipping_address, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [
        testOrder.order_number,
        testOrder.user_id,
        testOrder.total_amount,
        testOrder.status,
        testOrder.payment_status,
        testOrder.delivery_method,
        testOrder.shipping_address
      ]);
      
      console.log(`✅ Test order created with ID: ${insertResult.insertId}`);
      
      // Create test order item
      await pool.query(`
        INSERT INTO order_items (order_id, product_id, quantity, price, created_at, updated_at)
        VALUES (?, 1, 2, 12.99, NOW(), NOW())
      `, [insertResult.insertId]);
      
      console.log('✅ Test order item created');
    }
    
    // Get sample orders
    const [orders] = await pool.query(`
      SELECT 
        id, 
        order_number, 
        user_id, 
        total_amount, 
        status, 
        payment_status,
        delivery_method,
        created_at
      FROM orders 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log('\n📦 Recent orders:');
    console.table(orders);
    
    // Check users table for buyer
    const [users] = await pool.query(`
      SELECT id, username, email, role 
      FROM users 
      WHERE role = 'buyer' 
      LIMIT 3
    `);
    
    console.log('\n👤 Buyer users:');
    console.table(users);
    
    // Test the API endpoint logic
    if (orders.length > 0) {
      const testOrderId = orders[0].id;
      const testUserId = orders[0].user_id;
      
      console.log(`\n🧪 Testing API logic for order ID: ${testOrderId}, User ID: ${testUserId}`);
      
      const [testResult] = await pool.query(`
        SELECT 
          o.*,
          COALESCE(u.name, u.username) as buyer_name,
          u.email as buyer_email
        FROM orders o
        JOIN users u ON o.user_id = u.id
        WHERE o.id = ? AND o.user_id = ?
      `, [testOrderId, testUserId]);
      
      if (testResult.length > 0) {
        console.log('✅ API query would succeed');
        console.log('Order details:', {
          id: testResult[0].id,
          order_number: testResult[0].order_number,
          buyer_name: testResult[0].buyer_name,
          status: testResult[0].status
        });
      } else {
        console.log('❌ API query would fail - no matching order');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkOrders();