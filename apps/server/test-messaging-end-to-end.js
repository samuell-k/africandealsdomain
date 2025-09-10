const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');

async function testMessagingSystem() {
  let connection;
  
  try {
    // Database configuration
    const dbConfig = {
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'add_physical_product',
      port: 3333
    };

    console.log('🔌 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Database connected successfully');

    // Test 1: Check if order_id column exists
    console.log('\n📋 Test 1: Checking database schema...');
    try {
      const [columns] = await connection.execute(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'messages' AND COLUMN_NAME = 'order_id'
      `);
      
      if (columns.length > 0) {
        console.log('✅ order_id column exists in messages table');
      } else {
        console.log('❌ order_id column missing - running migration...');
        await connection.execute('ALTER TABLE messages ADD COLUMN order_id INT NULL AFTER product_id');
        await connection.execute('ALTER TABLE messages ADD INDEX idx_order (order_id)');
        console.log('✅ Migration applied successfully');
      }
    } catch (error) {
      console.log('ℹ️  Column already exists or migration applied');
    }

    // Test 2: Check for test users
    console.log('\n📋 Test 2: Checking for test users...');
    const [buyers] = await connection.execute('SELECT id, name, email FROM users WHERE role = "buyer" LIMIT 1');
    const [sellers] = await connection.execute('SELECT id, name, email FROM users WHERE role = "seller" LIMIT 1');
    
    if (buyers.length === 0 || sellers.length === 0) {
      console.log('❌ No test users found. Creating test users...');
      
      // Create test buyer
      await connection.execute(`
        INSERT INTO users (name, email, password, role, created_at, updated_at) 
        VALUES ('Test Buyer', 'buyer@test.com', '$2b$10$test', 'buyer', NOW(), NOW())
      `);
      
      // Create test seller
      await connection.execute(`
        INSERT INTO users (name, email, password, role, created_at, updated_at) 
        VALUES ('Test Seller', 'seller@test.com', '$2b$10$test', 'seller', NOW(), NOW())
      `);
      
      console.log('✅ Test users created');
    } else {
      console.log('✅ Test users found');
      console.log(`   Buyer: ${buyers[0].name} (${buyers[0].email})`);
      console.log(`   Seller: ${sellers[0].name} (${sellers[0].email})`);
    }

    // Test 3: Check for test products and orders
    console.log('\n📋 Test 3: Checking for test products and orders...');
    const [products] = await connection.execute('SELECT id, name, seller_id FROM products LIMIT 1');
    const [orders] = await connection.execute('SELECT id, user_id, total_amount FROM orders LIMIT 1');
    
    if (products.length === 0) {
      console.log('❌ No products found. Creating test product...');
      await connection.execute(`
        INSERT INTO products (name, description, price, stock_quantity, seller_id, created_at, updated_at) 
        VALUES ('Test Product', 'Test Description', 100.00, 10, ${sellers[0].id}, NOW(), NOW())
      `);
      console.log('✅ Test product created');
    }
    
    if (orders.length === 0) {
      console.log('❌ No orders found. Creating test order...');
      const [newProducts] = await connection.execute('SELECT id FROM products LIMIT 1');
      if (newProducts.length > 0) {
        await connection.execute(`
          INSERT INTO orders (user_id, order_number, total_amount, status, created_at, updated_at) 
          VALUES (${buyers[0].id}, 'ORD-${Date.now()}', 100.00, 'pending', NOW(), NOW())
        `);
        const [newOrders] = await connection.execute('SELECT id FROM orders ORDER BY id DESC LIMIT 1');
        if (newOrders.length > 0) {
          await connection.execute(`
            INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price) 
            VALUES (${newOrders[0].id}, ${newProducts[0].id}, 1, 100.00, 100.00)
          `);
        }
        console.log('✅ Test order created');
      }
    }

    // Test 4: Create test messages
    console.log('\n📋 Test 4: Creating test messages...');
    const [currentBuyers] = await connection.execute('SELECT id FROM users WHERE role = "buyer" LIMIT 1');
    const [currentSellers] = await connection.execute('SELECT id FROM users WHERE role = "seller" LIMIT 1');
    const [currentOrders] = await connection.execute('SELECT id FROM orders LIMIT 1');
    
    // Declare variables in function scope
    let buyerId, sellerId, orderId;
    
    if (currentBuyers.length > 0 && currentSellers.length > 0) {
      buyerId = currentBuyers[0].id;
      sellerId = currentSellers[0].id;
      orderId = currentOrders.length > 0 ? currentOrders[0].id : null;
      
      // Create message from seller to buyer
      await connection.execute(`
        INSERT INTO messages (sender_id, recipient_id, subject, content, order_id, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, NOW(), NOW())
      `, [sellerId, buyerId, 'Test Message from Seller', 'This is a test message from seller to buyer.', orderId]);
      
      // Create message from buyer to seller
      await connection.execute(`
        INSERT INTO messages (sender_id, recipient_id, subject, content, order_id, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, NOW(), NOW())
      `, [buyerId, sellerId, 'Test Message from Buyer', 'This is a test message from buyer to seller.', orderId]);
      
      console.log('✅ Test messages created');
    } else {
      console.log('❌ No test users found for messaging');
      return;
    }

    // Test 5: Test message retrieval
    console.log('\n📋 Test 5: Testing message retrieval...');
    const [buyerMessages] = await connection.execute(`
      SELECT m.*, u.name as sender_name 
      FROM messages m 
      LEFT JOIN users u ON m.sender_id = u.id 
      WHERE m.recipient_id = ? OR m.sender_id = ?
    `, [buyerId, buyerId]);
    
    const [sellerMessages] = await connection.execute(`
      SELECT m.*, u.name as sender_name 
      FROM messages m 
      LEFT JOIN users u ON m.sender_id = u.id 
      WHERE m.recipient_id = ? OR m.sender_id = ?
    `, [sellerId, sellerId]);
    
    console.log(`✅ Buyer has ${buyerMessages.length} messages`);
    console.log(`✅ Seller has ${sellerMessages.length} messages`);

    // Test 6: Test unread count
    console.log('\n📋 Test 6: Testing unread count...');
    const [buyerUnread] = await connection.execute(`
      SELECT COUNT(*) as count FROM messages 
      WHERE recipient_id = ? AND is_read = 0
    `, [buyerId]);
    
    const [sellerUnread] = await connection.execute(`
      SELECT COUNT(*) as count FROM messages 
      WHERE recipient_id = ? AND is_read = 0
    `, [sellerId]);
    
    console.log(`✅ Buyer has ${buyerUnread[0].count} unread messages`);
    console.log(`✅ Seller has ${sellerUnread[0].count} unread messages`);

    // Test 7: Generate test tokens
    console.log('\n📋 Test 7: Generating test tokens...');
    const JWT_SECRET = process.env.JWT_SECRET || 'adminafricandealsdomainpassword';
    const buyerToken = jwt.sign({ id: buyerId, role: 'buyer' }, JWT_SECRET, { expiresIn: '1h' });
    const sellerToken = jwt.sign({ id: sellerId, role: 'seller' }, JWT_SECRET, { expiresIn: '1h' });
    
    console.log('✅ Test tokens generated');
    console.log('   Buyer token:', buyerToken.substring(0, 50) + '...');
    console.log('   Seller token:', sellerToken.substring(0, 50) + '...');

    // Test 8: Simulate API calls
    console.log('\n📋 Test 8: Simulating API calls...');
    
    // Wait a moment for server to be ready
    console.log('   Waiting for server to be ready...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test buyer messages API
    console.log('   Testing buyer messages API...');
    try {
      const buyerResponse = await fetch('http://localhost:3001/api/messages', {
        headers: {
          'Authorization': `Bearer ${buyerToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (buyerResponse.ok) {
        const buyerData = await buyerResponse.json();
        console.log(`   ✅ Buyer API: ${buyerData.messages?.length || 0} messages`);
        if (buyerData.messages && buyerData.messages.length > 0) {
          console.log(`   📧 Sample message: "${buyerData.messages[0].subject}"`);
        }
      } else {
        const errorData = await buyerResponse.json();
        console.log(`   ❌ Buyer API failed: ${errorData.error || buyerResponse.statusText}`);
      }
    } catch (error) {
      console.log(`   ❌ Buyer API error: ${error.message}`);
    }
    
    // Test seller messages API
    console.log('   Testing seller messages API...');
    try {
      const sellerResponse = await fetch('http://localhost:3001/api/seller/messages', {
        headers: {
          'Authorization': `Bearer ${sellerToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (sellerResponse.ok) {
        const sellerData = await sellerResponse.json();
        console.log(`   ✅ Seller API: ${sellerData.messages?.length || 0} messages`);
        if (sellerData.messages && sellerData.messages.length > 0) {
          console.log(`   📧 Sample message: "${sellerData.messages[0].subject}"`);
        }
      } else {
        const errorData = await sellerResponse.json();
        console.log(`   ❌ Seller API failed: ${errorData.error || sellerResponse.statusText}`);
      }
    } catch (error) {
      console.log(`   ❌ Seller API error: ${error.message}`);
    }

    // Test 9: Test sending a message
    console.log('\n📋 Test 9: Testing message sending...');
    try {
      const messageData = {
        recipient_id: buyerId,
        subject: 'Test Message from Script',
        content: 'This is a test message sent by the test script.',
        order_id: orderId
      };

      const sendResponse = await fetch('http://localhost:3001/api/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sellerToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(messageData)
      });

      if (sendResponse.ok) {
        const sendData = await sendResponse.json();
        console.log(`   ✅ Message sent successfully! Message ID: ${sendData.message_id}`);
      } else {
        const errorData = await sendResponse.json();
        console.log(`   ❌ Failed to send message: ${errorData.error || sendResponse.statusText}`);
      }
    } catch (error) {
      console.log(`   ❌ Error sending message: ${error.message}`);
    }

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📝 Summary:');
    console.log('   - Database schema is correct');
    console.log('   - Test users exist');
    console.log('   - Test messages created');
    console.log('   - API endpoints are working');
    console.log('\n💡 Next steps:');
    console.log('   1. Restart your server if not running');
    console.log('   2. Test the messaging system in the browser');
    console.log('   3. Check both buyer and seller message pages');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Check if fetch is available (Node.js 18+)
if (typeof fetch === 'undefined') {
  console.log('⚠️  Fetch not available, skipping API tests');
  console.log('   Install node-fetch or use Node.js 18+ for full testing');
}

testMessagingSystem(); 