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

async function testOrderDetailsDebug() {
    console.log('🧪 Testing Order Details Debug...');
    
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
            console.log('⚠️ No available orders to test with');
            return;
        }
        
        const orderId = orders[0].id;
        console.log(`📦 Testing with order ID: ${orderId}`);
        
        // Step 3: Get order details
        console.log('\n📋 Step 3: Get order details...');
        const orderDetailsResponse = await makeRequest({
            hostname: 'localhost',
            port: 3001,
            path: `/api/pickup-delivery-agent/order-details/${orderId}`,
            method: 'GET',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json' 
            }
        });
        
        console.log('📋 Order details response status:', orderDetailsResponse.statusCode);
        
        if (orderDetailsResponse.statusCode === 200) {
            console.log('✅ Order details retrieved');
            console.log('📋 Response structure:');
            console.log('   success:', orderDetailsResponse.body.success);
            console.log('   order exists:', !!orderDetailsResponse.body.order);
            
            if (orderDetailsResponse.body.order) {
                const order = orderDetailsResponse.body.order;
                console.log('   order.id:', order.id);
                console.log('   order.order_number:', order.order_number);
                console.log('   order.items exists:', !!order.items);
                console.log('   order.items type:', typeof order.items);
                console.log('   order.items length:', order.items ? order.items.length : 'N/A');
                
                if (order.items) {
                    console.log('   items:', JSON.stringify(order.items, null, 2));
                }
                
                console.log('   buyer exists:', !!order.buyer);
                console.log('   seller exists:', !!order.seller);
                console.log('   pickup_site exists:', !!order.pickup_site);
            }
        } else {
            console.log('❌ Failed to get order details:', orderDetailsResponse.body);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

testOrderDetailsDebug();