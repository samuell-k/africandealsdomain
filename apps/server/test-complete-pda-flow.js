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

async function testCompletePDAFlow() {
    console.log('🧪 Testing Complete PDA Flow...');
    
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
        
        console.log('📋 Available orders response:', availableOrdersResponse.statusCode);
        if (availableOrdersResponse.statusCode === 200) {
            const orders = availableOrdersResponse.body.orders || [];
            console.log(`✅ Found ${orders.length} available orders`);
            
            if (orders.length > 0) {
                const orderId = orders[0].id;
                console.log(`📦 Testing with order ID: ${orderId}`);
                
                // Step 3: Accept the order
                console.log('\n🤝 Step 3: Accept the order...');
                const acceptResponse = await makeRequest({
                    hostname: 'localhost',
                    port: 3001,
                    path: `/api/pickup-delivery-agent/accept-pickup/${orderId}`,
                    method: 'POST',
                    headers: { 
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json' 
                    }
                }, {
                    estimated_pickup_time: new Date(Date.now() + 30 * 60 * 1000).toISOString()
                });
                
                console.log('📋 Accept order response:', acceptResponse.statusCode);
                if (acceptResponse.statusCode === 200) {
                    console.log('✅ Order accepted successfully');
                    
                    // Step 4: Check active orders
                    console.log('\n📋 Step 4: Check active orders...');
                    const activeOrdersResponse = await makeRequest({
                        hostname: 'localhost',
                        port: 3001,
                        path: '/api/pickup-delivery-agent/active-orders',
                        method: 'GET',
                        headers: { 
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json' 
                        }
                    });
                    
                    console.log('📋 Active orders response:', activeOrdersResponse.statusCode);
                    if (activeOrdersResponse.statusCode === 200) {
                        const activeOrders = activeOrdersResponse.body.orders || [];
                        console.log(`✅ Found ${activeOrders.length} active orders`);
                        
                        const acceptedOrder = activeOrders.find(order => order.id === orderId);
                        if (acceptedOrder) {
                            console.log('🎉 SUCCESS: Order appears in active orders!');
                            console.log(`📦 Order ${orderId} status: ${acceptedOrder.status}`);
                            
                            // Step 5: Test order status update
                            console.log('\n🚚 Step 5: Update order status to PDA_EN_ROUTE_TO_SELLER...');
                            const statusUpdateResponse = await makeRequest({
                                hostname: 'localhost',
                                port: 3001,
                                path: `/api/pickup-delivery-agent/orders/${orderId}/status`,
                                method: 'PUT',
                                headers: { 
                                    'Authorization': `Bearer ${token}`,
                                    'Content-Type': 'application/json' 
                                }
                            }, {
                                status: 'PDA_EN_ROUTE_TO_SELLER',
                                notes: 'PDA is on the way to seller'
                            });
                            
                            console.log('📋 Status update response:', statusUpdateResponse.statusCode);
                            if (statusUpdateResponse.statusCode === 200) {
                                console.log('✅ Status updated successfully');
                                
                                // Step 6: Verify status update
                                console.log('\n🔍 Step 6: Verify status update...');
                                const verifyResponse = await makeRequest({
                                    hostname: 'localhost',
                                    port: 3001,
                                    path: `/api/pickup-delivery-agent/order-details/${orderId}`,
                                    method: 'GET',
                                    headers: { 
                                        'Authorization': `Bearer ${token}`,
                                        'Content-Type': 'application/json' 
                                    }
                                });
                                
                                if (verifyResponse.statusCode === 200) {
                                    console.log(`✅ Order status verified: ${verifyResponse.body.order.status}`);
                                    console.log('🎉 COMPLETE SUCCESS: All PDA operations working!');
                                } else {
                                    console.log('❌ Failed to verify status update');
                                }
                            } else {
                                console.log('❌ Failed to update status:', statusUpdateResponse.body);
                            }
                        } else {
                            console.log('❌ ISSUE: Accepted order not found in active orders');
                        }
                    } else {
                        console.log('❌ Failed to get active orders:', activeOrdersResponse.body);
                    }
                } else {
                    console.log('❌ Failed to accept order:', acceptResponse.body);
                }
            } else {
                console.log('⚠️ No available orders to test with');
            }
        } else {
            console.log('❌ Failed to get available orders:', availableOrdersResponse.body);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testCompletePDAFlow();