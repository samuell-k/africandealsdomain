const pool = require('./db');
const bcrypt = require('bcrypt');

async function createTestData() {
  try {
    console.log('🧪 Creating test data for order detail debugging...\n');
    
    // Create test buyer user
    const testEmail = 'test-buyer@example.com';
    const testPassword = 'password123';
    
    console.log('1. Creating test buyer user...');
    
    // Check if user already exists
    const [existingUsers] = await pool.query('SELECT id FROM users WHERE email = ?', [testEmail]);
    
    let testUserId;
    if (existingUsers.length > 0) {
      testUserId = existingUsers[0].id;
      console.log(`✅ Test user already exists with ID: ${testUserId}`);
    } else {
      const hashedPassword = await bcrypt.hash(testPassword, 10);
      const [userResult] = await pool.query(`
        INSERT INTO users (name, email, password, role, phone, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, NOW(), NOW())
      `, ['Test Buyer', testEmail, hashedPassword, 'buyer', '+1234567890']);
      
      testUserId = userResult.insertId;
      console.log(`✅ Test user created with ID: ${testUserId}`);
    }
    
    // Create test product if needed
    console.log('2. Creating test product...');
    
    const [existingProducts] = await pool.query('SELECT id FROM products LIMIT 1');
    let testProductId;
    
    if (existingProducts.length > 0) {
      testProductId = existingProducts[0].id;
      console.log(`✅ Using existing product ID: ${testProductId}`);
    } else {
      // Create a test seller first
      const [sellerResult] = await pool.query(`
        INSERT INTO users (name, email, password, role, phone, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, NOW(), NOW())
      `, ['Test Seller', 'test-seller@example.com', await bcrypt.hash('password123', 10), 'seller', '+1234567891']);
      
      const testSellerId = sellerResult.insertId;
      
      const [productResult] = await pool.query(`
        INSERT INTO products (name, description, price, seller_id, category_id, stock_quantity, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, ['Test Product', 'A test product for order detail testing', 29.99, testSellerId, 1, 100]);
      
      testProductId = productResult.insertId;
      console.log(`✅ Test product created with ID: ${testProductId}`);
    }
    
    // Create test order
    console.log('3. Creating test order...');
    
    const orderNumber = 'TEST-ORDER-' + Date.now();
    const [orderResult] = await pool.query(`
      INSERT INTO orders (
        order_number, user_id, total_amount, status, payment_status, 
        delivery_method, shipping_address, billing_address, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      orderNumber,
      testUserId,
      29.99,
      'confirmed',
      'paid',
      'delivery',
      JSON.stringify({
        first_name: 'Test',
        last_name: 'Buyer',
        address: '123 Test Street',
        city: 'Test City',
        country: 'Rwanda'
      }),
      JSON.stringify({
        first_name: 'Test',
        last_name: 'Buyer',
        address: '123 Test Street',
        city: 'Test City',
        country: 'Rwanda'
      })
    ]);
    
    const testOrderId = orderResult.insertId;
    console.log(`✅ Test order created with ID: ${testOrderId}, Order Number: ${orderNumber}`);
    
    // Create order item
    console.log('4. Creating test order item...');
    
    await pool.query(`
      INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, seller_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [testOrderId, testProductId, 1, 29.99, 29.99, 1]);
    
    console.log('✅ Test order item created');
    
    // Test the API query
    console.log('\n5. Testing API query...');
    
    const [testQuery] = await pool.query(`
      SELECT 
        o.*,
        COALESCE(u.name, u.username) as buyer_name,
        u.email as buyer_email
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.id = ? AND o.user_id = ?
    `, [testOrderId, testUserId]);
    
    if (testQuery.length > 0) {
      console.log('✅ API query test successful');
      console.log('Order details:', {
        id: testQuery[0].id,
        order_number: testQuery[0].order_number,
        buyer_name: testQuery[0].buyer_name,
        status: testQuery[0].status,
        total_amount: testQuery[0].total_amount
      });
    } else {
      console.log('❌ API query test failed');
    }
    
    // Get order items
    const [testItems] = await pool.query(`
      SELECT 
        oi.*,
        p.name as product_name,
        p.price as product_price
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `, [testOrderId]);
    
    console.log(`✅ Found ${testItems.length} order items`);
    
    console.log('\n🎯 TEST INSTRUCTIONS:');
    console.log('====================');
    console.log('1. Open test page: http://localhost:3001/buyer/test-order-detail.html');
    console.log('2. Login credentials:');
    console.log('   Email:', testEmail);
    console.log('   Password:', testPassword);
    console.log('3. Test Order ID:', testOrderId);
    console.log('4. Test Order Number:', orderNumber);
    console.log('5. Direct order detail URL: http://localhost:3001/buyer/order-detail.html?id=' + testOrderId);
    
    console.log('\n📋 DEBUGGING STEPS:');
    console.log('==================');
    console.log('1. Login with the test credentials above');
    console.log('2. Go to orders page: http://localhost:3001/buyer/orders.html');
    console.log('3. Look for the test order and click "View Details"');
    console.log('4. Check browser console for debugging messages');
    console.log('5. Check server console for API debugging messages');
    
  } catch (error) {
    console.error('❌ Error creating test data:', error.message);
  } finally {
    process.exit(0);
  }
}

createTestData();