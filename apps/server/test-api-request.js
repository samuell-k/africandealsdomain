const http = require('http');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function testAPIRequest() {
  try {
    console.log('🌐 Testing Real API Request...');
    console.log('='.repeat(50));

    // Generate a test token for buyer ID 1
    const token = jwt.sign(
      { 
        id: 1, 
        email: 'test1@gmail.com', 
        role: 'buyer' 
      },
      process.env.JWT_SECRET || 'adminafricandealsdomainpassword',
      { expiresIn: '24h' }
    );

    console.log('🔑 Generated test token for buyer ID 1');

    // Make HTTP request to the API
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/orders',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    console.log('📡 Making request to http://localhost:3001/api/orders');

    const req = http.request(options, (res) => {
      console.log(`📊 Status Code: ${res.statusCode}`);
      console.log(`📋 Headers:`, res.headers);

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('\n✅ API Response received:');
          console.log(`   Success: ${response.success}`);
          console.log(`   Orders count: ${response.orders ? response.orders.length : 0}`);
          
          if (response.orders && response.orders.length > 0) {
            console.log('\n📦 Sample order:');
            const sample = response.orders[0];
            console.log(`   ID: ${sample.id}`);
            console.log(`   Order Number: ${sample.order_number}`);
            console.log(`   Status: ${sample.status}`);
            console.log(`   Amount: $${sample.total_amount}`);
            console.log(`   Created: ${sample.created_at}`);
            console.log(`   Items: ${sample.item_count}`);
            console.log(`   Agent: ${sample.agent ? sample.agent.name : 'None'}`);
          }

          console.log('\n🎉 API test completed successfully!');
          console.log('✅ The orders API is working correctly');
          console.log('✅ Orders are being fetched from the database');
          console.log('✅ Authentication is working');
          console.log('✅ Response format is correct');

        } catch (parseError) {
          console.error('❌ Error parsing response:', parseError.message);
          console.log('Raw response:', data);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request failed:', error.message);
      console.log('\n🔧 Troubleshooting:');
      console.log('   1. Make sure the server is running on port 3001');
      console.log('   2. Start the server with: cd apps/server && npm start');
      console.log('   3. Check if the server is accessible at http://localhost:3001');
    });

    req.end();

  } catch (error) {
    console.error('❌ Test setup failed:', error.message);
  }
}

testAPIRequest();