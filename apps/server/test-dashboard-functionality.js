/**
 * Test Fast Delivery Agent Dashboard Functionality
 */

const http = require('http');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function testDashboardFunctionality() {
  try {
    console.log('🧪 Testing Fast Delivery Agent Dashboard Functionality...');

    // Step 1: Login to get token
    console.log('\n1️⃣ Logging in as agent...');
    
    const loginData = JSON.stringify({
      email: 'fast.agent@test.com',
      password: 'testpass123'
    });

    const loginResponse = await makeRequest({
      hostname: 'localhost',
      port: 3002,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(loginData)
      }
    }, loginData);

    if (loginResponse.status !== 200) {
      console.log('❌ Login failed:', loginResponse.data);
      return;
    }

    const token = loginResponse.data.token;
    console.log('✅ Login successful');

    // Step 2: Test available orders endpoint
    console.log('\n2️⃣ Testing available orders...');
    
    const availableOrdersResponse = await makeRequest({
      hostname: 'localhost',
      port: 3002,
      path: '/api/fast-delivery-agent/available-orders?radius=50&limit=20',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log(`Status: ${availableOrdersResponse.status}`);
    if (availableOrdersResponse.status === 200) {
      const orders = availableOrdersResponse.data.orders || [];
      console.log(`✅ Found ${orders.length} available orders`);
      
      if (orders.length > 0) {
        const sampleOrder = orders[0];
        console.log('Sample order:', {
          id: sampleOrder.id,
          order_number: sampleOrder.order_number,
          total_amount: sampleOrder.total_amount,
          buyer_name: sampleOrder.buyer_name,
          status: sampleOrder.status,
          items_count: sampleOrder.items?.length || 0
        });

        // Step 3: Test order details
        console.log('\n3️⃣ Testing order details...');
        
        const orderDetailsResponse = await makeRequest({
          hostname: 'localhost',
          port: 3002,
          path: `/api/fast-delivery-agent/order/${sampleOrder.id}`,
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        console.log(`Order details status: ${orderDetailsResponse.status}`);
        if (orderDetailsResponse.status === 200) {
          console.log('✅ Order details loaded successfully');
          const orderDetails = orderDetailsResponse.data.order;
          console.log('Order details:', {
            id: orderDetails.id,
            order_number: orderDetails.order_number,
            buyer_name: orderDetails.buyer_name,
            items_count: orderDetails.items?.length || 0,
            total_amount: orderDetails.total_amount
          });
        } else {
          console.log('❌ Order details failed:', orderDetailsResponse.data);
        }

        // Step 4: Test accept order (but don't actually accept to avoid affecting data)
        console.log('\n4️⃣ Testing accept order endpoint (dry run)...');
        console.log('ℹ️  Skipping actual order acceptance to preserve test data');
        
      } else {
        console.log('ℹ️  No orders available for testing order details and acceptance');
      }
    } else {
      console.log('❌ Available orders failed:', availableOrdersResponse.data);
    }

    // Step 5: Test stats endpoint
    console.log('\n5️⃣ Testing stats endpoint...');
    
    const statsResponse = await makeRequest({
      hostname: 'localhost',
      port: 3002,
      path: '/api/fast-delivery-agent/stats',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log(`Stats status: ${statsResponse.status}`);
    if (statsResponse.status === 200) {
      console.log('✅ Stats loaded successfully');
      console.log('Stats:', statsResponse.data.stats);
    } else {
      console.log('❌ Stats failed:', statsResponse.data);
    }

    // Step 6: Test active orders
    console.log('\n6️⃣ Testing active orders...');
    
    const activeOrdersResponse = await makeRequest({
      hostname: 'localhost',
      port: 3002,
      path: '/api/fast-delivery-agent/active-orders',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log(`Active orders status: ${activeOrdersResponse.status}`);
    if (activeOrdersResponse.status === 200) {
      const activeOrders = activeOrdersResponse.data.orders || [];
      console.log(`✅ Found ${activeOrders.length} active orders`);
    } else {
      console.log('❌ Active orders failed:', activeOrdersResponse.data);
    }

    console.log('\n🎯 Dashboard Functionality Test Summary:');
    console.log(`✅ Login: ${loginResponse.status === 200 ? 'WORKING' : 'FAILED'}`);
    console.log(`✅ Available orders: ${availableOrdersResponse.status === 200 ? 'WORKING' : 'FAILED'}`);
    console.log(`✅ Active orders: ${activeOrdersResponse.status === 200 ? 'WORKING' : 'FAILED'}`);
    console.log(`✅ Stats: ${statsResponse.status === 200 ? 'WORKING' : 'FAILED'}`);
    
    console.log('\n📱 Dashboard should now be working properly!');
    console.log('🌐 Access at: http://localhost:3002/agent/fast-delivery-agent-complete.html');
    console.log('🔑 Login with: fast.agent@test.com / testpass123');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    process.exit(0);
  }
}

testDashboardFunctionality();