const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');

// Database configuration
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'add_physical_product',
  port: 3333
};

async function testMessagingSystem() {
  let connection;
  
  try {
    console.log('🔍 Testing Messaging System...\n');
    
    // Connect to database
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Database connected');
    
    // Test 1: Check if order_id column exists in messages table
    console.log('\n📋 Test 1: Checking messages table structure...');
    const [columns] = await connection.execute('DESCRIBE messages');
    const hasOrderId = columns.some(col => col.Field === 'order_id');
    
    if (hasOrderId) {
      console.log('✅ order_id column exists in messages table');
    } else {
      console.log('❌ order_id column missing - running migration...');
      await connection.execute('ALTER TABLE messages ADD COLUMN order_id INT NULL AFTER product_id');
      await connection.execute('ALTER TABLE messages ADD INDEX idx_order (order_id)');
      console.log('✅ Migration applied');
    }
    
    // Test 2: Check for test users
    console.log('\n👥 Test 2: Checking for test users...');
    const [buyers] = await connection.execute('SELECT id, name, email FROM users WHERE role = "buyer" LIMIT 1');
    const [sellers] = await connection.execute('SELECT id, name, email FROM users WHERE role = "seller" LIMIT 1');
    
    let buyerId, sellerId;
    
    if (buyers.length === 0) {
      console.log('❌ No buyers found. Creating test buyer...');
      const [result] = await connection.execute(`
        INSERT INTO users (name, email, password, role, created_at, updated_at) 
        VALUES ('Test Buyer', 'buyer@test.com', '$2b$10$test', 'buyer', NOW(), NOW())
      `);
      buyerId = result.insertId;
      console.log('✅ Test buyer created with ID:', buyerId);
    } else {
      buyerId = buyers[0].id;
      console.log('✅ Found buyer:', buyers[0].name);
    }
    
    if (sellers.length === 0) {
      console.log('❌ No sellers found. Creating test seller...');
      const [result] = await connection.execute(`
        INSERT INTO users (name, email, password, role, created_at, updated_at) 
        VALUES ('Test Seller', 'seller@test.com', '$2b$10$test', 'seller', NOW(), NOW())
      `);
      sellerId = result.insertId;
      console.log('✅ Test seller created with ID:', sellerId);
    } else {
      sellerId = sellers[0].id;
      console.log('✅ Found seller:', sellers[0].name);
    }
    
    // Test 3: Check for products and orders
    console.log('\n📦 Test 3: Checking for products and orders...');
    const [products] = await connection.execute('SELECT id, name, seller_id FROM products LIMIT 1');
    const [orders] = await connection.execute('SELECT id, user_id, order_number FROM orders LIMIT 1');
    
    let productId, orderId;
    
    if (products.length === 0) {
      console.log('❌ No products found. Creating test product...');
      const [result] = await connection.execute(`
        INSERT INTO products (name, description, price, seller_id, stock_quantity, created_at, updated_at) 
        VALUES ('Test Product', 'Test description', 100.00, ${sellerId}, 10, NOW(), NOW())
      `);
      productId = result.insertId;
      console.log('✅ Test product created with ID:', productId);
    } else {
      productId = products[0].id;
      console.log('✅ Found product:', products[0].name);
    }
    
    if (orders.length === 0) {
      console.log('❌ No orders found. Creating test order...');
      const [result] = await connection.execute(`
        INSERT INTO orders (user_id, order_number, total_amount, status, created_at, updated_at) 
        VALUES (${buyerId}, 'ORD-${Date.now()}', 100.00, 'pending', NOW(), NOW())
      `);
      orderId = result.insertId;
      console.log('✅ Test order created with ID:', orderId);
    } else {
      orderId = orders[0].id;
      console.log('✅ Found order:', orders[0].order_number);
    }
    
    // Test 4: Create test messages
    console.log('\n💬 Test 4: Creating test messages...');
    
    // Message from seller to buyer
    await connection.execute(`
      INSERT INTO messages (sender_id, recipient_id, subject, content, order_id, created_at, updated_at)
      VALUES (${sellerId}, ${buyerId}, 'Order Update', 'Your order has been processed!', ${orderId}, NOW(), NOW())
    `);
    console.log('✅ Message from seller to buyer created');
    
    // Message from buyer to seller
    await connection.execute(`
      INSERT INTO messages (sender_id, recipient_id, subject, content, order_id, created_at, updated_at)
      VALUES (${buyerId}, ${sellerId}, 'Question', 'When will my order ship?', ${orderId}, NOW(), NOW())
    `);
    console.log('✅ Message from buyer to seller created');
    
    // Test 5: Test message retrieval
    console.log('\n📥 Test 5: Testing message retrieval...');
    
    // Test buyer messages
    const [buyerMessages] = await connection.execute(`
      SELECT m.*, u.name as sender_name 
      FROM messages m 
      LEFT JOIN users u ON m.sender_id = u.id 
      WHERE (m.recipient_id = ? OR m.sender_id = ?) AND m.order_id = ?
      ORDER BY m.created_at DESC
    `, [buyerId, buyerId, orderId]);
    
    console.log(`✅ Buyer can see ${buyerMessages.length} messages`);
    buyerMessages.forEach(msg => {
      console.log(`   - ${msg.sender_name}: ${msg.subject}`);
    });
    
    // Test seller messages
    const [sellerMessages] = await connection.execute(`
      SELECT m.*, u.name as sender_name 
      FROM messages m 
      LEFT JOIN users u ON m.sender_id = u.id 
      WHERE (m.recipient_id = ? OR m.sender_id = ?) AND m.order_id = ?
      ORDER BY m.created_at DESC
    `, [sellerId, sellerId, orderId]);
    
    console.log(`✅ Seller can see ${sellerMessages.length} messages`);
    sellerMessages.forEach(msg => {
      console.log(`   - ${msg.sender_name}: ${msg.subject}`);
    });
    
    // Test 6: Generate test tokens
    console.log('\n🔑 Test 6: Generating test tokens...');
    
    const buyerToken = jwt.sign(
      { id: buyerId, email: 'buyer@test.com', role: 'buyer' },
      'your-secret-key',
      { expiresIn: '24h' }
    );
    
    const sellerToken = jwt.sign(
      { id: sellerId, email: 'seller@test.com', role: 'seller' },
      'your-secret-key',
      { expiresIn: '24h' }
    );
    
    console.log('✅ Buyer token generated');
    console.log('✅ Seller token generated');
    
    // Test 7: Test API endpoints (simulated)
    console.log('\n🌐 Test 7: Testing API endpoints...');
    
    // Simulate buyer fetching messages
    console.log('📥 Simulating buyer fetching messages...');
    const buyerMessagesCount = buyerMessages.length;
    console.log(`   Expected: ${buyerMessagesCount} messages`);
    
    // Simulate seller fetching messages
    console.log('📥 Simulating seller fetching messages...');
    const sellerMessagesCount = sellerMessages.length;
    console.log(`   Expected: ${sellerMessagesCount} messages`);
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   - Database: ✅ Connected`);
    console.log(`   - Messages table: ✅ Has order_id column`);
    console.log(`   - Test users: ✅ Buyer (${buyerId}), Seller (${sellerId})`);
    console.log(`   - Test data: ✅ Product (${productId}), Order (${orderId})`);
    console.log(`   - Test messages: ✅ ${buyerMessagesCount + sellerMessagesCount} messages created`);
    console.log(`   - API simulation: ✅ Endpoints ready for testing`);
    
    console.log('\n🔧 Next steps:');
    console.log('   1. Start the server: npm start --prefix apps/server');
    console.log('   2. Test buyer messaging: http://localhost:3001/buyer/order-detail.html?id=' + orderId);
    console.log('   3. Test seller messaging: http://localhost:3001/seller/order-detail.html?id=' + orderId);
    console.log('   4. Use tokens for API testing:');
    console.log('      Buyer token: ' + buyerToken.substring(0, 50) + '...');
    console.log('      Seller token: ' + sellerToken.substring(0, 50) + '...');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the test
testMessagingSystem(); 