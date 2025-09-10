const http = require('http');

function makeRequest(options, data = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsedBody = body ? JSON.parse(body) : {};
                    resolve({
                        statusCode: res.statusCode,
                        body: parsedBody
                    });
                } catch (e) {
                    resolve({
                        statusCode: res.statusCode,
                        body: body
                    });
                }
            });
        });

        req.on('error', reject);
        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

async function testPDAMessaging() {
    console.log('🧪 Testing PDA Messaging System...');
    
    try {
        // Step 1: Login as PDA
        console.log('\n🔐 Step 1: Login as PDA...');
        const loginResponse = await makeRequest({
            hostname: 'localhost',
            port: 3001,
            path: '/api/auth/agent-login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            email: 'pda.test@example.com',
            password: 'testpass123'
        });
        
        if (loginResponse.statusCode !== 200) {
            console.log('❌ Login failed:', loginResponse.body);
            return;
        }
        
        const token = loginResponse.body.token;
        console.log('✅ Login successful');
        
        // Step 2: Get available orders
        console.log('\n📋 Step 2: Get available orders...');
        const availableOrdersResponse = await makeRequest({
            hostname: 'localhost',
            port: 3001,
            path: '/api/pickup-delivery-agent/available-orders',
            method: 'GET',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json' 
            }
        });
        
        if (availableOrdersResponse.statusCode !== 200) {
            console.log('❌ Failed to get available orders:', availableOrdersResponse.body);
            return;
        }
        
        const orders = availableOrdersResponse.body.orders || [];
        console.log(`✅ Found ${orders.length} available orders`);
        
        if (orders.length === 0) {
            console.log('⚠️ No available orders to test messaging with');
            return;
        }
        
        const orderId = orders[0].id;
        console.log(`📦 Testing messaging with order ID: ${orderId}`);
        
        // Step 3: Test message to buyer
        console.log('\n💬 Step 3: Send message to buyer...');
        const buyerMessageResponse = await makeRequest({
            hostname: 'localhost',
            port: 3001,
            path: '/api/pickup-delivery-agent/send-message',
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json' 
            }
        }, {
            order_id: orderId,
            recipient_type: 'buyer',
            message: 'Hello! I am your pickup delivery agent. I will be collecting your package soon.',
            message_type: 'text'
        });
        
        console.log('📋 Buyer message response status:', buyerMessageResponse.statusCode);
        if (buyerMessageResponse.statusCode === 200) {
            console.log('✅ Message to buyer sent successfully');
        } else {
            console.log('❌ Failed to send message to buyer:', buyerMessageResponse.body);
        }
        
        // Step 4: Test message to seller
        console.log('\n💬 Step 4: Send message to seller...');
        const sellerMessageResponse = await makeRequest({
            hostname: 'localhost',
            port: 3001,
            path: '/api/pickup-delivery-agent/send-message',
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json' 
            }
        }, {
            order_id: orderId,
            recipient_type: 'seller',
            message: 'Hello! I am the pickup delivery agent assigned to collect the package for this order.',
            message_type: 'text'
        });
        
        console.log('📋 Seller message response status:', sellerMessageResponse.statusCode);
        if (sellerMessageResponse.statusCode === 200) {
            console.log('✅ Message to seller sent successfully');
        } else {
            console.log('❌ Failed to send message to seller:', sellerMessageResponse.body);
        }
        
        // Step 5: Test invalid recipient type
        console.log('\n💬 Step 5: Test invalid recipient type...');
        const invalidMessageResponse = await makeRequest({
            hostname: 'localhost',
            port: 3001,
            path: '/api/pickup-delivery-agent/send-message',
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json' 
            }
        }, {
            order_id: orderId,
            recipient_type: 'admin',
            message: 'This should fail',
            message_type: 'text'
        });
        
        console.log('📋 Invalid message response status:', invalidMessageResponse.statusCode);
        if (invalidMessageResponse.statusCode === 400) {
            console.log('✅ Invalid recipient type correctly rejected');
        } else {
            console.log('❌ Invalid recipient type not handled properly:', invalidMessageResponse.body);
        }
        
        console.log('\n🎉 PDA Messaging test completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testPDAMessaging();