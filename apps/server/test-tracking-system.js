const mysql = require('mysql2/promise');
require('dotenv').config();

// Database connection
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'african_deals_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function testTrackingSystem() {
  console.log('🧪 Testing Order Tracking System...\n');

  try {
    // 1. Create test buyer
    console.log('1. Creating test buyer...');
    const [buyerResult] = await pool.query(`
      INSERT INTO users (username, email, password, role, is_verified, home_lat, home_lng, home_address)
      VALUES ('test_buyer', 'buyer@test.com', '$2b$10$hash', 'buyer', 1, -1.2921, 36.8219, 'Kigali, Rwanda')
      ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)
    `);
    const buyerId = buyerResult.insertId || (await pool.query('SELECT id FROM users WHERE email = "buyer@test.com"'))[0][0].id;
    console.log(`✅ Test buyer created with ID: ${buyerId}`);

    // 2. Create test agent
    console.log('2. Creating test agent...');
    const [agentUserResult] = await pool.query(`
      INSERT INTO users (username, email, password, role, is_verified)
      VALUES ('test_agent', 'agent@test.com', '$2b$10$hash', 'agent', 1)
      ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)
    `);
    const agentUserId = agentUserResult.insertId || (await pool.query('SELECT id FROM users WHERE email = "agent@test.com"'))[0][0].id;
    
    await pool.query(`
      INSERT INTO agents (user_id, first_name, last_name, phone, status, current_lat, current_lng, vehicle_type)
      VALUES (?, 'Test', 'Agent', '+250788610639', 'available', -1.2900, 36.8200, 'Motorcycle')
      ON DUPLICATE KEY UPDATE status = 'available'
    `, [agentUserId]);
    console.log(`✅ Test agent created with user ID: ${agentUserId}`);

    // 3. Create test product
    console.log('3. Creating test product...');
    const [productResult] = await pool.query(`
      INSERT INTO products (name, description, price, currency, seller_id, category_id, main_image, lat, lng, address)
      VALUES ('Test Product', 'A test product for tracking', 25.99, 'USD', ?, 1, 'test.jpg', -1.2950, 36.8250, 'Nyarugenge, Kigali')
      ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)
    `, [agentUserId]); // Using agent as seller for simplicity
    const productId = productResult.insertId || (await pool.query('SELECT id FROM products WHERE name = "Test Product" LIMIT 1'))[0][0].id;
    console.log(`✅ Test product created with ID: ${productId}`);

    // 4. Create test order
    console.log('4. Creating test order...');
    const orderNumber = 'TEST-' + Date.now();
    const [orderResult] = await pool.query(`
      INSERT INTO orders (user_id, order_number, total_amount, status, shipping_address, billing_address, payment_method, delivery_location)
      VALUES (?, ?, 25.99, 'pending', '{"address": "Kigali, Rwanda", "lat": -1.2921, "lng": 36.8219}', '{"address": "Kigali, Rwanda"}', 'cash', '{"address": "Kigali, Rwanda", "lat": -1.2921, "lng": 36.8219}')
    `, [buyerId, orderNumber]);
    const orderId = orderResult.insertId;
    console.log(`✅ Test order created with ID: ${orderId}, Order Number: ${orderNumber}`);

    // 5. Create order item
    await pool.query(`
      INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price)
      VALUES (?, ?, 1, 25.99, 25.99)
    `, [orderId, productId]);
    console.log(`✅ Order item created`);

    // 6. Test agent claiming order
    console.log('5. Testing agent claim order...');
    await pool.query(`
      UPDATE orders 
      SET agent_id = ?, status = 'shipped', tracking_status = 'assigned', updated_at = NOW()
      WHERE id = ?
    `, [agentUserId, orderId]);

    await pool.query(`
      INSERT INTO order_tracking (order_id, status, notes, created_at)
      VALUES (?, 'assigned', 'Order assigned to agent for testing', NOW())
    `, [orderId]);
    console.log(`✅ Order claimed by agent`);

    // 7. Test status updates
    console.log('6. Testing status updates...');
    const statusUpdates = ['picked_up', 'in_transit', 'delivered'];
    
    for (const status of statusUpdates) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between updates
      
      await pool.query(`
        UPDATE orders 
        SET status = ?, tracking_status = ?, updated_at = NOW()
        WHERE id = ?
      `, [status === 'delivered' ? 'delivered' : 'shipped', status, orderId]);

      await pool.query(`
        INSERT INTO order_tracking (order_id, status, notes, created_at)
        VALUES (?, ?, ?, NOW())
      `, [orderId, status, `Order ${status.replace('_', ' ')} - test update`]);
      
      console.log(`✅ Status updated to: ${status}`);
    }

    // 8. Verify final state
    console.log('7. Verifying final state...');
    const [finalOrder] = await pool.query(`
      SELECT o.*, u.username as buyer_name, a.first_name, a.last_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN agents ag ON o.agent_id = ag.user_id
      LEFT JOIN users a ON ag.user_id = a.id
      WHERE o.id = ?
    `, [orderId]);

    const [trackingHistory] = await pool.query(`
      SELECT * FROM order_tracking WHERE order_id = ? ORDER BY created_at ASC
    `, [orderId]);

    console.log('\n📊 FINAL TEST RESULTS:');
    console.log('='.repeat(50));
    console.log(`Order ID: ${finalOrder[0].id}`);
    console.log(`Order Number: ${finalOrder[0].order_number}`);
    console.log(`Buyer: ${finalOrder[0].buyer_name}`);
    console.log(`Agent: ${finalOrder[0].first_name} ${finalOrder[0].last_name}`);
    console.log(`Status: ${finalOrder[0].status}`);
    console.log(`Tracking Status: ${finalOrder[0].tracking_status}`);
    console.log(`Total Amount: $${finalOrder[0].total_amount}`);
    
    console.log('\n📋 Tracking History:');
    trackingHistory.forEach((track, index) => {
      console.log(`${index + 1}. ${track.status} - ${track.notes} (${track.created_at})`);
    });

    console.log('\n🎉 TEST COMPLETED SUCCESSFULLY!');
    console.log('\nYou can now:');
    console.log(`1. Login as buyer (buyer@test.com) and view order #${orderId}`);
    console.log(`2. Login as agent (agent@test.com) and manage orders`);
    console.log(`3. Test the tracking page: /buyer/order-tracking.html?orderId=${orderId}`);
    console.log(`4. Test the agent orders page: /agent/orders.html`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

// Run the test
testTrackingSystem();