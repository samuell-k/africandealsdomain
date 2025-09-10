const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function testOrdersAPI() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'add_physical_product',
    port: process.env.DB_PORT || 3333
  });

  try {
    console.log('🧪 Testing Orders API and Database...\n');

    // 1. Check if we have sellers
    const [sellers] = await connection.execute('SELECT id, name, email FROM users WHERE role = "seller" LIMIT 1');
    
    if (sellers.length === 0) {
      console.log('❌ No sellers found, creating test seller...');
      const [result] = await connection.execute(`
        INSERT INTO users (name, email, password, role, phone, is_active) 
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        'Test Seller API',
        'testseller-api@example.com',
        '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
        'seller',
        '+250788123456',
        1
      ]);
      sellers.push({ id: result.insertId, name: 'Test Seller API', email: 'testseller-api@example.com' });
      console.log(`✅ Created test seller with ID: ${result.insertId}`);
    }

    const sellerId = sellers[0].id;
    console.log(`📋 Using seller: ${sellers[0].name} (ID: ${sellerId})`);

    // 2. Check if we have buyers
    const [buyers] = await connection.execute('SELECT id, name, email FROM users WHERE role = "buyer" LIMIT 1');
    
    if (buyers.length === 0) {
      console.log('❌ No buyers found, creating test buyer...');
      const [result] = await connection.execute(`
        INSERT INTO users (name, email, password, role, phone, is_active) 
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        'Test Buyer API',
        'testbuyer-api@example.com',
        '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
        'buyer',
        '+250788123457',
        1
      ]);
      buyers.push({ id: result.insertId, name: 'Test Buyer API', email: 'testbuyer-api@example.com' });
      console.log(`✅ Created test buyer with ID: ${result.insertId}`);
    }

    const buyerId = buyers[0].id;

    // 3. Check if we have products for this seller
    let [products] = await connection.execute(`
      SELECT id, name, price FROM products WHERE seller_id = ? AND is_active = 1 LIMIT 1
    `, [sellerId]);

    if (products.length === 0) {
      console.log('❌ No products found, creating test product...');
      const [result] = await connection.execute(`
        INSERT INTO products (name, description, price, stock_quantity, seller_id, is_active, main_image, currency) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'Test Product API',
        'A test product for API testing',
        149.99,
        10,
        sellerId,
        1,
        'test-product-api.jpg',
        'USD'
      ]);
      products.push({ id: result.insertId, name: 'Test Product API', price: 149.99 });
      console.log(`✅ Created test product with ID: ${result.insertId}`);
    }

    const productId = products[0].id;

    // 4. Create multiple test orders with different statuses
    console.log('\n📦 Creating test orders...');
    const testOrders = [
      { status: 'PENDING', amount: 149.99, notes: 'New order pending processing' },
      { status: 'PROCESSING', amount: 299.98, notes: 'Order being processed' },
      { status: 'READY_FOR_PICKUP', amount: 199.99, notes: 'Order ready for pickup' },
      { status: 'DELIVERED', amount: 99.99, notes: 'Order delivered successfully' },
      { status: 'COMPLETED', amount: 249.99, notes: 'Order completed' }
    ];

    const createdOrders = [];

    for (let i = 0; i < testOrders.length; i++) {
      const orderData = testOrders[i];
      const orderNumber = `TEST-API-${Date.now()}-${i}`;
      
      const [orderResult] = await connection.execute(`
        INSERT INTO orders (user_id, order_number, total_amount, status, payment_method, payment_status, shipping_address, billing_address, notes, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
        buyerId,
        orderNumber,
        orderData.amount,
        orderData.status,
        'credit_card',
        'paid',
        JSON.stringify({
          street: '123 Test Street',
          city: 'Test City',
          country: 'Test Country',
          postal_code: '12345'
        }),
        JSON.stringify({
          street: '123 Test Street',
          city: 'Test City',
          country: 'Test Country',
          postal_code: '12345'
        }),
        orderData.notes
      ]);

      const orderId = orderResult.insertId;
      
      // Create order item
      await connection.execute(`
        INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price) 
        VALUES (?, ?, ?, ?, ?)
      `, [orderId, productId, 1, orderData.amount, orderData.amount]);

      createdOrders.push({ id: orderId, number: orderNumber, status: orderData.status });
      console.log(`✅ Created order ${orderNumber} with status ${orderData.status}`);
    }

    // 5. Test the seller orders query (same as API endpoint)
    console.log('\n🔍 Testing seller orders query...');
    const [ordersResult] = await connection.execute(`
      SELECT DISTINCT
        o.id, o.order_number, o.status, o.payment_status, o.total_amount,
        o.created_at, o.updated_at,
        -- BUYER INFORMATION
        u.name as buyer_name, u.email as buyer_email, u.phone as buyer_phone,
        -- PSM CONFIRMATION FIELDS FOR SELLERS
        o.psm_deposit_at,
        o.psm_agent_id,
        o.buyer_pickup_at,
        o.buyer_pickup_code,
        o.seller_payout_status,
        o.seller_payout_released_at,
        o.seller_payout_release_reason,
        o.completed_at,
        -- ORDER DETAILS
        COUNT(oi.id) as item_count,
        SUM(oi.quantity) as total_quantity,
        GROUP_CONCAT(DISTINCT p.name SEPARATOR ', ') as product_names
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      JOIN users u ON o.user_id = u.id
      WHERE p.seller_id = ?
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT 20
    `, [sellerId]);

    console.log(`✅ Found ${ordersResult.length} orders for seller`);
    
    if (ordersResult.length > 0) {
      console.log('\n📋 Sample orders:');
      ordersResult.slice(0, 3).forEach(order => {
        console.log(`  - Order #${order.order_number}: ${order.status} - $${order.total_amount} (${order.buyer_name})`);
      });
    }

    // 6. Test status filtering
    console.log('\n🔍 Testing status filtering...');
    const [pendingOrders] = await connection.execute(`
      SELECT COUNT(DISTINCT o.id) as count
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      WHERE p.seller_id = ? AND o.status = 'PENDING'
    `, [sellerId]);

    console.log(`✅ Found ${pendingOrders[0].count} pending orders`);

    // 7. Generate JWT token for frontend testing
    const token = jwt.sign(
      { 
        id: sellerId, 
        role: 'seller',
        name: sellers[0].name,
        email: sellers[0].email
      }, 
      process.env.JWT_SECRET || 'adminafricandealsdomainpassword', 
      { expiresIn: '7d' }
    );

    console.log('\n🔐 JWT Token for frontend testing:');
    console.log(`Bearer ${token}`);

    console.log('\n🎉 Orders API test completed successfully!');
    console.log('\nTo test the frontend:');
    console.log('1. Copy the JWT token above');
    console.log('2. Open your browser and go to http://localhost:3002/seller/orders.html');
    console.log('3. Open browser console and run: localStorage.setItem("authToken", "PASTE_TOKEN_HERE")');
    console.log('4. Refresh the page to see the orders');
    console.log('5. Test filtering and status updates');

    // 8. Clean up test data (optional - comment out to keep test data)
    console.log('\n🧹 Cleaning up test data...');
    for (const order of createdOrders) {
      await connection.execute('DELETE FROM order_items WHERE order_id = ?', [order.id]);
      await connection.execute('DELETE FROM orders WHERE id = ?', [order.id]);
    }
    console.log('✅ Test data cleaned up');

  } catch (error) {
    console.error('❌ Error testing orders API:', error);
  } finally {
    await connection.end();
  }
}

testOrdersAPI();