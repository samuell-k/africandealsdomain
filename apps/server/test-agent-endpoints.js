/**
 * Test Fast Delivery Agent API Endpoints with Authentication
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

async function testAgentEndpoints() {
  try {
    console.log('🧪 Testing Fast Delivery Agent API Endpoints...');

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
    console.log('✅ Login successful, got token');

    // Step 2: Test available orders endpoint
    console.log('\n2️⃣ Testing available orders endpoint...');
    
    const availableOrdersResponse = await makeRequest({
      hostname: 'localhost',
      port: 3002,
      path: '/api/fast-delivery-agent/available-orders?radius=5&limit=20',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log(`Status: ${availableOrdersResponse.status}`);
    if (availableOrdersResponse.status === 200) {
      console.log('✅ Available orders endpoint working');
      console.log(`Found ${availableOrdersResponse.data.orders?.length || 0} orders`);
      if (availableOrdersResponse.data.orders?.length > 0) {
        console.log('Sample order:', {
          id: availableOrdersResponse.data.orders[0].id,
          order_number: availableOrdersResponse.data.orders[0].order_number,
          total_amount: availableOrdersResponse.data.orders[0].total_amount,
          buyer_name: availableOrdersResponse.data.orders[0].buyer_name,
          items_count: availableOrdersResponse.data.orders[0].items?.length || 0
        });
      }
    } else {
      console.log('❌ Available orders endpoint failed:', availableOrdersResponse.data);
    }

    // Step 3: Test active orders endpoint
    console.log('\n3️⃣ Testing active orders endpoint...');
    
    const activeOrdersResponse = await makeRequest({
      hostname: 'localhost',
      port: 3002,
      path: '/api/fast-delivery-agent/active-orders',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log(`Status: ${activeOrdersResponse.status}`);
    if (activeOrdersResponse.status === 200) {
      console.log('✅ Active orders endpoint working');
      console.log(`Found ${activeOrdersResponse.data.orders?.length || 0} active orders`);
    } else {
      console.log('❌ Active orders endpoint failed:', activeOrdersResponse.data);
    }

    // Step 4: Test stats endpoint
    console.log('\n4️⃣ Testing stats endpoint...');
    
    const statsResponse = await makeRequest({
      hostname: 'localhost',
      port: 3002,
      path: '/api/fast-delivery-agent/stats',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log(`Status: ${statsResponse.status}`);
    if (statsResponse.status === 200) {
      console.log('✅ Stats endpoint working');
      console.log('Stats:', statsResponse.data.stats);
    } else {
      console.log('❌ Stats endpoint failed:', statsResponse.data);
    }

    console.log('\n🎯 API Endpoints Test Summary:');
    console.log('✅ Authentication working');
    console.log(`✅ Available orders: ${availableOrdersResponse.status === 200 ? 'WORKING' : 'FAILED'}`);
    console.log(`✅ Active orders: ${activeOrdersResponse.status === 200 ? 'WORKING' : 'FAILED'}`);
    console.log(`✅ Stats: ${statsResponse.status === 200 ? 'WORKING' : 'FAILED'}`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    process.exit(0);
  }
}

testAgentEndpoints();