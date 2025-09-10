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

async function testOrderStructure() {
    console.log('🧪 Testing Order Structure...');
    
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
        console.log(`📦 Examining order ID: ${orderId}`);
        
        // Step 3: Get order details to see structure
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
        
        if (orderDetailsResponse.statusCode === 200) {
            const order = orderDetailsResponse.body.order;
            console.log('✅ Order details retrieved');
            console.log('\n📊 Order Structure:');
            console.log('   Basic fields:');
            console.log(`     id: ${order.id}`);
            console.log(`     user_id (buyer): ${order.user_id}`);
            console.log(`     seller_id: ${order.seller_id || 'NULL'}`);
            console.log(`     status: ${order.status}`);
            
            console.log('\n   Buyer info:');
            if (order.buyer) {
                console.log(`     buyer.name: ${order.buyer.name}`);
                console.log(`     buyer.email: ${order.buyer.email}`);
                console.log(`     buyer.phone: ${order.buyer.phone}`);
            }
            
            console.log('\n   Seller info:');
            if (order.seller) {
                console.log(`     seller.name: ${order.seller.name}`);
                console.log(`     seller.email: ${order.seller.email}`);
                console.log(`     seller.phone: ${order.seller.phone}`);
            } else {
                console.log('     No seller object found');
            }
            
            console.log('\n   Items info:');
            if (order.items && order.items.length > 0) {
                console.log(`     ${order.items.length} items found`);
                order.items.forEach((item, index) => {
                    console.log(`     Item ${index + 1}: ${item.product_name} (seller_id: ${item.seller_id || 'N/A'})`);
                });
            } else {
                console.log('     No items found');
            }
            
            // Check if we can find seller info from items
            if (order.items && order.items.length > 0) {
                const firstItem = order.items[0];
                if (firstItem.seller_id) {
                    console.log(`\n   💡 Seller ID found in items: ${firstItem.seller_id}`);
                }
            }
            
        } else {
            console.log('❌ Failed to get order details:', orderDetailsResponse.body);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testOrderStructure();