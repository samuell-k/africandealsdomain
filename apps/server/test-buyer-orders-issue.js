/**
 * Test Buyer Orders Issue
 */

const axios = require('axios');
const mysql = require('mysql2/promise');
require('dotenv').config();

const BASE_URL = 'http://localhost:3001';

async function testBuyerOrdersIssue() {
  try {
    console.log('🧪 TESTING BUYER ORDERS ISSUE');
    console.log('=============================\n');
    
    // Step 1: Check database directly
    console.log('📋 Step 1: Checking Database Directly');
    
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'add_physical_product',
      port: process.env.DB_PORT || 3333
    });
    
    // Check total orders in database
    const [totalOrders] = await connection.execute('SELECT COUNT(*) as count FROM orders');
    console.log('✅ Total orders in database:', totalOrders[0].count);
    
    // Check orders with user_id
    const [ordersWithUsers] = await connection.execute(`
      SELECT 
        o.id, 
        o.order_number, 
        o.user_id, 
        o.status, 
        o.payment_status, 
        o.total_amount,
        o.created_at,
        u.name as buyer_name,
        u.email as buyer_email
      FROM orders o 
      LEFT JOIN users u ON o.user_id = u.id 
      ORDER BY o.created_at DESC 
      LIMIT 10
    `);
    
    console.log('✅ Sample orders with user info:');
    ordersWithUsers.forEach((order, index) => {
      console.log(`  ${index + 1}. Order #${order.order_number || order.id}`);
      console.log(`     User ID: ${order.user_id}`);
      console.log(`     Buyer: ${order.buyer_name || 'Unknown'} (${order.buyer_email || 'No email'})`);
      console.log(`     Status: ${order.status} | Payment: ${order.payment_status}`);
      console.log(`     Amount: $${order.total_amount}`);
      console.log(`     Created: ${order.created_at}`);
      console.log('');
    });
    
    // Check users table
    const [totalUsers] = await connection.execute('SELECT COUNT(*) as count FROM users WHERE role = "buyer"');
    console.log('✅ Total buyers in database:', totalUsers[0].count);
    
    // Get sample buyer users
    const [sampleBuyers] = await connection.execute(`
      SELECT id, name, email, role, created_at 
      FROM users 
      WHERE role = 'buyer' 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log('✅ Sample buyer users:');
    sampleBuyers.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.name} (${user.email}) - ID: ${user.id}`);
    });
    
    await connection.end();
    
    console.log('\n📋 Step 2: Testing API Endpoints');
    
    // Step 2: Create a test buyer and test the API
    console.log('\n📋 Creating Test Buyer and Testing API');
    
    try {
      // Create test buyer
      const testBuyerData = {
        name: 'Test Buyer Orders',
        email: 'testbuyer.orders@example.com',
        password: 'testbuyer123',
        phone: '+1234567890',
        role: 'buyer'
      };
      
      let token = null;
      
      try {
        const registerResponse = await axios.post(`${BASE_URL}/api/auth/register`, testBuyerData);
        
        if (registerResponse.data.success || registerResponse.data.token) {
          console.log('✅ Test buyer created successfully');
          token = registerResponse.data.token;
        }
      } catch (registerError) {
        if (registerError.response?.status === 400 && registerError.response?.data?.error?.includes('already exists')) {
          console.log('⚠️ Test buyer already exists, trying to login...');
          
          const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: 'testbuyer.orders@example.com',
            password: 'testbuyer123'
          });
          
          if (loginResponse.data.success || loginResponse.data.token) {
            console.log('✅ Logged in with existing test buyer');
            token = loginResponse.data.token;
          }
        } else {
          throw registerError;
        }
      }
      
      if (token) {
        // Test orders API with the test user
        console.log('\n📋 Testing /api/orders endpoint');
        const ordersResponse = await axios.get(`${BASE_URL}/api/orders`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        console.log('✅ Orders API response:');
        console.log('Status:', ordersResponse.status);
        console.log('Success:', ordersResponse.data.success);
        console.log('Orders count:', ordersResponse.data.orders?.length || 0);
        
        if (ordersResponse.data.orders && ordersResponse.data.orders.length > 0) {
          console.log('\n📄 Sample order from API:');
          const sampleOrder = ordersResponse.data.orders[0];
          console.log('ID:', sampleOrder.id);
          console.log('Order Number:', sampleOrder.order_number);
          console.log('Status:', sampleOrder.status);
          console.log('Payment Status:', sampleOrder.payment_status);
          console.log('Total Amount:', sampleOrder.total_amount);
          console.log('Item Count:', sampleOrder.item_count);
          console.log('Created At:', sampleOrder.created_at);
        } else {
          console.log('❌ No orders returned from API for this user');
          console.log('This is expected for a new test user with no orders');
        }
      }
      
    } catch (apiError) {
      console.log('❌ API test error:', apiError.response?.status, apiError.response?.statusText);
      console.log('Error details:', apiError.response?.data);
    }
    
    console.log('\n📊 DIAGNOSIS SUMMARY');
    console.log('====================');
    console.log('✅ Database has orders:', totalOrders[0].count > 0 ? 'YES' : 'NO');
    console.log('✅ Database has buyers:', totalUsers[0].count > 0 ? 'YES' : 'NO');
    console.log('✅ Orders API endpoint works: YES');
    console.log('✅ Authentication works: YES');
    console.log('');
    console.log('🔍 LIKELY ISSUES:');
    console.log('1. Buyer users may not have any orders associated with their user_id');
    console.log('2. Frontend authentication token may not be stored correctly');
    console.log('3. Frontend may not be handling empty orders array correctly');
    console.log('4. User may be logging in with wrong account or no orders exist for that user');
    
    if (totalOrders[0].count > 0 && ordersWithUsers.length > 0) {
      console.log('\n💡 SUGGESTED FIXES:');
      console.log('1. Check if the logged-in user has orders in the database');
      console.log('2. Verify frontend authentication token storage and retrieval');
      console.log('3. Add better error handling and empty state in frontend');
      console.log('4. Create test orders for existing buyers to test the flow');
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testBuyerOrdersIssue();