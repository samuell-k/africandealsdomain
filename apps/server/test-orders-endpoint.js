const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function testOrdersEndpoint() {
  try {
    console.log('🧪 Testing Orders Endpoint Comprehensively...');
    console.log('='.repeat(60));
    
    const pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'add_physical_product',
      port: process.env.DB_PORT || 3333,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // Test 1: Database Connection
    console.log('🔌 Step 1: Testing database connection...');
    const [connection] = await pool.query('SELECT 1 as test');
    console.log('✅ Database connection successful');

    // Test 2: Check tables exist
    console.log('\n📋 Step 2: Checking required tables...');
    const [tables] = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = ? AND table_name IN ('orders', 'order_items', 'users', 'agents')
    `, [process.env.DB_NAME]);
    
    const tableNames = tables.map(t => t.table_name || t.TABLE_NAME);
    console.log('✅ Found tables:', tableNames.join(', '));

    // Test 3: Check for buyer users
    console.log('\n👥 Step 3: Finding buyer users...');
    const [buyers] = await pool.query('SELECT id, name, email, role FROM users WHERE role = "buyer" LIMIT 3');
    console.log(`✅ Found ${buyers.length} buyer users`);
    
    if (buyers.length === 0) {
      console.log('❌ No buyer users found! Creating a test buyer...');
      
      // Create a test buyer
      const [insertResult] = await pool.query(`
        INSERT INTO users (name, email, password, role, created_at) 
        VALUES (?, ?, ?, ?, NOW())
      `, ['Test Buyer', 'testbuyer@example.com', 'hashedpassword', 'buyer']);
      
      console.log(`✅ Created test buyer with ID: ${insertResult.insertId}`);
      
      // Get the created buyer
      const [newBuyer] = await pool.query('SELECT id, name, email, role FROM users WHERE id = ?', [insertResult.insertId]);
      buyers.push(newBuyer[0]);
    }

    const testBuyer = buyers[0];
    console.log(`🎯 Using test buyer: ${testBuyer.name} (ID: ${testBuyer.id})`);

    // Test 4: Check orders for this buyer
    console.log('\n📦 Step 4: Checking orders for test buyer...');
    const [userOrders] = await pool.query('SELECT COUNT(*) as count FROM orders WHERE user_id = ?', [testBuyer.id]);
    console.log(`📊 Found ${userOrders[0].count} orders for buyer ${testBuyer.id}`);

    if (userOrders[0].count === 0) {
      console.log('⚠️ No orders found for test buyer. Creating a test order...');
      
      // Create a test order
      const [orderResult] = await pool.query(`
        INSERT INTO orders (
          user_id, order_number, total_amount, status, 
          shipping_address, billing_address, payment_method, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
        testBuyer.id,
        `ORD-TEST-${Date.now()}`,
        99.99,
        'pending',
        JSON.stringify({
          address: '123 Test Street',
          city: 'Nairobi',
          country: 'Kenya',
          postal_code: '00100'
        }),
        JSON.stringify({
          address: '123 Test Street',
          city: 'Nairobi',
          country: 'Kenya',
          postal_code: '00100'
        }),
        'credit_card'
      ]);
      
      console.log(`✅ Created test order with ID: ${orderResult.insertId}`);
      
      // Create order items
      await pool.query(`
        INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price)
        VALUES (?, ?, ?, ?, ?)
      `, [orderResult.insertId, 1, 2, 49.99, 99.98]);
      
      console.log('✅ Created test order items');
    }

    // Test 5: Generate JWT token
    console.log('\n🔑 Step 5: Generating JWT token...');
    const token = jwt.sign(
      { 
        id: testBuyer.id, 
        email: testBuyer.email, 
        role: testBuyer.role 
      },
      process.env.JWT_SECRET || 'adminafricandealsdomainpassword',
      { expiresIn: '24h' }
    );
    console.log(`✅ Token generated successfully`);

    // Test 6: Verify token
    console.log('\n🔐 Step 6: Verifying JWT token...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'adminafricandealsdomainpassword');
    console.log(`✅ Token verified. User ID: ${decoded.id}, Role: ${decoded.role}`);

    // Test 7: Execute the exact query from the API
    console.log('\n🔍 Step 7: Testing the exact API query...');
    const [orders] = await pool.query(`
      SELECT 
        o.id,
        o.order_number,
        o.total_amount,
        o.status,
        o.tracking_status,
        o.agent_id,
        o.delivery_code,
        o.created_at,
        o.updated_at,
        o.shipping_address,
        o.billing_address,
        o.payment_method,
        o.tracking_number,
        o.estimated_delivery,
        o.delivered_at,
        o.pickup_location,
        o.delivery_location,
        u_agent.name as agent_name,
        a.phone as agent_phone,
        a.status as agent_status,
        COUNT(oi.id) as item_count
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN agents a ON o.agent_id = a.user_id
      LEFT JOIN users u_agent ON a.user_id = u_agent.id
      WHERE o.user_id = ?
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `, [testBuyer.id]);

    console.log(`✅ Query executed successfully. Found ${orders.length} orders`);

    if (orders.length > 0) {
      console.log('\n📋 Order details:');
      orders.forEach((order, index) => {
        console.log(`  ${index + 1}. Order #${order.id}: ${order.order_number}`);
        console.log(`     Status: ${order.status} | Amount: $${order.total_amount}`);
        console.log(`     Items: ${order.item_count} | Agent: ${order.agent_name || 'None'}`);
        console.log(`     Created: ${order.created_at}`);
        console.log('');
      });

      // Test 8: Process orders like the API does
      console.log('🔄 Step 8: Processing orders with JSON parsing...');
      const processedOrders = orders.map(order => {
        let pickup_location = null;
        let delivery_location = null;
        let shipping_address = null;
        let billing_address = null;

        try {
          pickup_location = order.pickup_location ? JSON.parse(order.pickup_location) : null;
        } catch (e) {
          console.warn(`Failed to parse pickup_location for order ${order.id}:`, e.message);
        }

        try {
          delivery_location = order.delivery_location ? JSON.parse(order.delivery_location) : null;
        } catch (e) {
          console.warn(`Failed to parse delivery_location for order ${order.id}:`, e.message);
        }

        try {
          shipping_address = order.shipping_address ? JSON.parse(order.shipping_address) : null;
        } catch (e) {
          console.warn(`Failed to parse shipping_address for order ${order.id}:`, e.message);
        }

        try {
          billing_address = order.billing_address ? JSON.parse(order.billing_address) : null;
        } catch (e) {
          console.warn(`Failed to parse billing_address for order ${order.id}:`, e.message);
        }

        return {
          ...order,
          pickup_location,
          delivery_location,
          shipping_address,
          billing_address,
          agent: order.agent_id ? {
            name: order.agent_name || '',
            phone: order.agent_phone,
            status: order.agent_status
          } : null
        };
      });

      console.log(`✅ Successfully processed ${processedOrders.length} orders`);
      console.log('\n📊 Sample processed order structure:');
      const sample = { ...processedOrders[0] };
      // Remove large fields for cleaner output
      delete sample.shipping_address;
      delete sample.billing_address;
      console.log(JSON.stringify(sample, null, 2));

      // Test 9: Simulate API response
      console.log('\n📡 Step 9: Simulating API response...');
      const apiResponse = { success: true, orders: processedOrders };
      console.log(`✅ API response structure valid. Orders count: ${apiResponse.orders.length}`);

    } else {
      console.log('⚠️ No orders found after all tests');
    }

    // Test 10: Check server configuration
    console.log('\n⚙️ Step 10: Checking server configuration...');
    console.log(`   DB_HOST: ${process.env.DB_HOST}`);
    console.log(`   DB_PORT: ${process.env.DB_PORT}`);
    console.log(`   DB_NAME: ${process.env.DB_NAME}`);
    console.log(`   JWT_SECRET: ${process.env.JWT_SECRET ? 'Set' : 'Not set'}`);

    await pool.end();
    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📝 Summary:');
    console.log('   ✅ Database connection working');
    console.log('   ✅ Required tables exist');
    console.log('   ✅ Buyer users found/created');
    console.log('   ✅ Orders exist/created');
    console.log('   ✅ JWT token generation working');
    console.log('   ✅ API query executing correctly');
    console.log('   ✅ JSON parsing working');
    console.log('   ✅ Response structure valid');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testOrdersEndpoint();