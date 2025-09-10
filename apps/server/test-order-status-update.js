const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function testOrderStatusUpdate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'add_physical_product',
    port: process.env.DB_PORT || 3333
  });

  try {
    console.log('🧪 Testing Order Status Update functionality...\n');

    // 1. Check if we have sellers and buyers
    const [sellers] = await connection.execute('SELECT id, name, email FROM users WHERE role = "seller" LIMIT 1');
    const [buyers] = await connection.execute('SELECT id, name, email FROM users WHERE role = "buyer" LIMIT 1');
    
    if (sellers.length === 0) {
      console.log('❌ No sellers found, creating test seller...');
      const [result] = await connection.execute(`
        INSERT INTO users (name, email, password, role, phone, is_active) 
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        'Test Seller',
        'testseller@example.com',
        '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
        'seller',
        '+250788123456',
        1
      ]);
      sellers.push({ id: result.insertId, name: 'Test Seller', email: 'testseller@example.com' });
      console.log(`✅ Created test seller with ID: ${result.insertId}`);
    }

    if (buyers.length === 0) {
      console.log('❌ No buyers found, creating test buyer...');
      const [result] = await connection.execute(`
        INSERT INTO users (name, email, password, role, phone, is_active) 
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        'Test Buyer',
        'testbuyer@example.com',
        '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
        'buyer',
        '+250788123457',
        1
      ]);
      buyers.push({ id: result.insertId, name: 'Test Buyer', email: 'testbuyer@example.com' });
      console.log(`✅ Created test buyer with ID: ${result.insertId}`);
    }

    const sellerId = sellers[0].id;
    const buyerId = buyers[0].id;

    // 2. Check if we have a product for this seller
    let [products] = await connection.execute(`
      SELECT id, name, price FROM products WHERE seller_id = ? AND is_active = 1 LIMIT 1
    `, [sellerId]);

    if (products.length === 0) {
      console.log('❌ No products found, creating test product...');
      const [result] = await connection.execute(`
        INSERT INTO products (name, description, price, stock_quantity, seller_id, is_active, main_image, currency) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'Test Product',
        'A test product for order status testing',
        99.99,
        10,
        sellerId,
        1,
        'test-product.jpg',
        'USD'
      ]);
      products.push({ id: result.insertId, name: 'Test Product', price: 99.99 });
      console.log(`✅ Created test product with ID: ${result.insertId}`);
    }

    const productId = products[0].id;

    // 3. Create a test order
    console.log('\n📦 Creating test order...');
    const orderNumber = `TEST-${Date.now()}`;
    const [orderResult] = await connection.execute(`
      INSERT INTO orders (user_id, order_number, total_amount, status, payment_method, shipping_address, billing_address, created_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      buyerId,
      orderNumber,
      99.99,
      'pending',
      'credit_card',
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
      })
    ]);

    const orderId = orderResult.insertId;
    console.log(`✅ Created test order with ID: ${orderId}`);

    // 4. Create order item
    await connection.execute(`
      INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price) 
      VALUES (?, ?, ?, ?, ?)
    `, [orderId, productId, 1, 99.99, 99.99]);

    console.log(`✅ Created order item for product ID: ${productId}`);

    // 5. Test order status updates
    console.log('\n🔄 Testing order status updates...');
    
    const statusUpdates = [
      { status: 'PROCESSING', notes: 'Order is being processed' },
      { status: 'READY_FOR_PICKUP', notes: 'Order is ready for pickup' },
      { status: 'DELIVERED', notes: 'Order has been delivered successfully' },
      { status: 'COMPLETED', notes: 'Order has been completed' }
    ];

    for (const update of statusUpdates) {
      console.log(`\n  📝 Updating status to: ${update.status}`);
      
      // Update order status
      await connection.execute(`
        UPDATE orders 
        SET status = ?, notes = ?, updated_at = NOW()
        WHERE id = ?
      `, [update.status, update.notes, orderId]);

      // Verify the update
      const [updatedOrder] = await connection.execute(`
        SELECT status, notes, updated_at FROM orders WHERE id = ?
      `, [orderId]);

      if (updatedOrder[0].status === update.status) {
        console.log(`  ✅ Status updated to: ${update.status}`);
        console.log(`  📝 Notes: ${updatedOrder[0].notes}`);
      } else {
        console.log(`  ❌ Failed to update status to: ${update.status}`);
      }

      // Simulate a delay between updates
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 6. Test the seller order details query
    console.log('\n🔍 Testing seller order details query...');
    const [orderDetails] = await connection.execute(`
      SELECT DISTINCT
        o.id,
        o.order_number,
        o.total_amount,
        o.status,
        o.created_at,
        o.shipping_address,
        o.billing_address,
        o.payment_method,
        o.notes,
        u.id as buyer_id,
        u.name as buyer_name,
        u.email as buyer_email,
        u.phone as buyer_phone
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      JOIN users u ON o.user_id = u.id
      WHERE o.id = ? AND p.seller_id = ?
    `, [orderId, sellerId]);

    if (orderDetails.length > 0) {
      const order = orderDetails[0];
      console.log('✅ Order details query successful:');
      console.log(`  - Order ID: ${order.id}`);
      console.log(`  - Status: ${order.status}`);
      console.log(`  - Total: $${order.total_amount}`);
      console.log(`  - Buyer: ${order.buyer_name} (${order.buyer_email})`);
      console.log(`  - Notes: ${order.notes}`);
    } else {
      console.log('❌ Order details query failed');
    }

    // 7. Test order items query
    console.log('\n📋 Testing order items query...');
    const [orderItems] = await connection.execute(`
      SELECT 
        oi.id,
        oi.quantity,
        oi.unit_price,
        oi.total_price,
        p.id as product_id,
        p.name as product_name,
        p.description as product_description,
        p.main_image as product_image,
        p.price as product_price,
        p.currency as product_currency
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ? AND p.seller_id = ?
    `, [orderId, sellerId]);

    console.log(`✅ Found ${orderItems.length} order items:`);
    orderItems.forEach(item => {
      console.log(`  - ${item.product_name}: ${item.quantity}x $${item.unit_price} = $${item.total_price}`);
    });

    // 8. Generate test JWT token for API testing
    const token = jwt.sign(
      { id: sellerId, role: 'seller' }, 
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production', 
      { expiresIn: '7d' }
    );

    console.log('\n🔐 Test JWT Token for API testing:');
    console.log(`Bearer ${token.substring(0, 50)}...`);

    console.log('\n🎉 Order Status Update test completed successfully!');
    console.log('\nTo test the frontend:');
    console.log('1. Use the JWT token above in your browser localStorage as "authToken"');
    console.log('2. Navigate to /seller/orders.html');
    console.log(`3. Click on order #${orderId} to view details`);
    console.log('4. Test the status update functionality');
    console.log(`5. Server is running on port 3002`);

    // Clean up test data (optional)
    console.log('\n🧹 Cleaning up test data...');
    await connection.execute('DELETE FROM order_items WHERE order_id = ?', [orderId]);
    await connection.execute('DELETE FROM orders WHERE id = ?', [orderId]);
    console.log('✅ Test data cleaned up');

  } catch (error) {
    console.error('❌ Error testing order status update:', error);
  } finally {
    await connection.end();
  }
}

testOrderStatusUpdate();