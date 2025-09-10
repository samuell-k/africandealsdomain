const http = require('http');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function simulateFrontendBehavior() {
  try {
    console.log('🖥️ Simulating Frontend Behavior...');
    console.log('='.repeat(50));

    // Step 1: Simulate user login and token storage
    console.log('🔐 Step 1: Simulating user authentication...');
    const token = jwt.sign(
      { 
        id: 3, // Using buyer ID 3 which has 17 orders according to our debug
        email: 'mugishasimplice4@gmail.com', 
        role: 'buyer' 
      },
      process.env.JWT_SECRET || 'adminafricandealsdomainpassword',
      { expiresIn: '24h' }
    );
    console.log('✅ Token generated (simulating localStorage.setItem)');

    // Step 2: Simulate the exact fetch call from the frontend
    console.log('\n📡 Step 2: Making HTTP request like the frontend...');
    
    const data = await new Promise((resolve, reject) => {
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

      const req = http.request(options, (res) => {
        console.log(`📊 Response status: ${res.statusCode}`);

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP error! status: ${res.statusCode}`));
          return;
        }

        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            const parsedData = JSON.parse(responseData);
            resolve(parsedData);
          } catch (parseError) {
            reject(new Error(`JSON parse error: ${parseError.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.end();
    });

    console.log('✅ Response received successfully');

    // Step 3: Simulate frontend processing
    console.log('\n🔄 Step 3: Processing response like frontend...');
    const orders = data.orders || [];
    console.log(`📦 Orders array length: ${orders.length}`);

    if (orders.length === 0) {
      console.log('⚠️ No orders found - this would show empty state');
      return;
    }

    // Step 4: Simulate order card creation
    console.log('\n🎨 Step 4: Simulating order card creation...');
    orders.forEach((order, index) => {
      console.log(`\n📋 Order Card ${index + 1}:`);
      console.log(`   Order Number: ${order.order_number || `Order #${order.id}`}`);
      console.log(`   Status: ${order.status}`);
      console.log(`   Amount: $${parseFloat(order.total_amount || 0).toFixed(2)}`);
      console.log(`   Created: ${new Date(order.created_at).toLocaleDateString()}`);
      console.log(`   Items: ${order.item_count}`);
      
      // Simulate shipping address parsing
      let shippingAddress = 'Address not available';
      try {
        if (order.shipping_address) {
          const address = typeof order.shipping_address === 'string' 
            ? JSON.parse(order.shipping_address) 
            : order.shipping_address;
          shippingAddress = `${address.address || ''}, ${address.city || ''}, ${address.country || ''}`.trim();
        }
      } catch (e) {
        console.log(`   ⚠️ Error parsing shipping address: ${e.message}`);
      }
      console.log(`   Shipping: ${shippingAddress}`);
      
      if (order.agent) {
        console.log(`   Agent: ${order.agent.name} (${order.agent.phone})`);
      } else {
        console.log(`   Agent: None assigned`);
      }
    });

    // Step 5: Simulate stats update
    console.log('\n📊 Step 5: Simulating stats update...');
    const totalOrders = orders.length;
    const pendingOrders = orders.filter(o => o.status === 'pending').length;
    const processingOrders = orders.filter(o => o.status === 'processing').length;
    const deliveredOrders = orders.filter(o => o.status === 'delivered').length;

    console.log(`   Total Orders: ${totalOrders}`);
    console.log(`   Pending: ${pendingOrders}`);
    console.log(`   Processing: ${processingOrders}`);
    console.log(`   Delivered: ${deliveredOrders}`);

    console.log('\n🎉 Frontend simulation completed successfully!');
    console.log('✅ API call works correctly');
    console.log('✅ Orders are being returned');
    console.log('✅ Order processing logic works');
    console.log('✅ No issues found in the data flow');

    console.log('\n🔍 Potential Issues to Check:');
    console.log('   1. Browser console for JavaScript errors');
    console.log('   2. Network tab to see if API calls are being made');
    console.log('   3. Check if authToken is properly stored in localStorage');
    console.log('   4. Verify the correct buyer is logged in');
    console.log('   5. Check if the orders.html page is loading correctly');

  } catch (error) {
    console.error('❌ Frontend simulation failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n🔧 Server Connection Issue:');
      console.log('   The server is not running on port 3001');
      console.log('   Start the server with: cd apps/server && npm start');
    } else if (error.message.includes('HTTP error')) {
      console.log('\n🔧 API Error:');
      console.log('   Check server logs for authentication or database issues');
    } else {
      console.log('\n🔧 Other Error:');
      console.log('   Check the error details above');
    }
  }
}

simulateFrontendBehavior();