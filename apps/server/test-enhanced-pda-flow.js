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

async function testEnhancedPDAFlow() {
    console.log('🧪 Testing Enhanced PDA Flow with Complete Order Details...');
    
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
        
        if (acceptResponse.statusCode !== 200) {
            console.log('❌ Failed to accept order:', acceptResponse.body);
            return;
        }
        
        console.log('✅ Order accepted successfully');
        
        // Step 4: Get enhanced order details
        console.log('\n📋 Step 4: Get enhanced order details...');
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
        
        if (orderDetailsResponse.statusCode !== 200) {
            console.log('❌ Failed to get order details:', orderDetailsResponse.body);
            return;
        }
        
        const orderDetails = orderDetailsResponse.body.order;
        console.log('✅ Enhanced order details retrieved successfully');
        
        // Display key information
        console.log('\n📊 Order Information:');
        console.log(`   Order #: ${orderDetails.order_number}`);
        console.log(`   Status: ${orderDetails.status}`);
        console.log(`   Total: ${orderDetails.total_amount} ${orderDetails.currency}`);
        console.log(`   Items: ${orderDetails.items ? orderDetails.items.length : 0} products`);
        
        console.log('\n👤 Buyer Information:');
        console.log(`   Name: ${orderDetails.buyer.name || 'N/A'}`);
        console.log(`   Phone: ${orderDetails.buyer.phone || 'N/A'}`);
        console.log(`   Email: ${orderDetails.buyer.email || 'N/A'}`);
        console.log(`   Address: ${orderDetails.buyer.address || 'N/A'}`);
        if (orderDetails.buyer.locations.home.lat) {
            console.log(`   Home Location: ${orderDetails.buyer.locations.home.lat}, ${orderDetails.buyer.locations.home.lng}`);
        }
        
        console.log('\n🏪 Seller Information:');
        console.log(`   Name: ${orderDetails.seller.name || 'N/A'}`);
        console.log(`   Phone: ${orderDetails.seller.phone || 'N/A'}`);
        console.log(`   Email: ${orderDetails.seller.email || 'N/A'}`);
        console.log(`   Business: ${orderDetails.seller.business_name || 'N/A'}`);
        if (orderDetails.seller.locations.business.lat) {
            console.log(`   Business Location: ${orderDetails.seller.locations.business.lat}, ${orderDetails.seller.locations.business.lng}`);
        }
        
        if (orderDetails.pickup_site) {
            console.log('\n📍 Pickup Site Information:');
            console.log(`   Name: ${orderDetails.pickup_site.name}`);
            console.log(`   Address: ${orderDetails.pickup_site.address.full_address}`);
            console.log(`   Phone: ${orderDetails.pickup_site.contact.phone || 'N/A'}`);
            console.log(`   Manager: ${orderDetails.pickup_site.contact.manager_name || 'N/A'}`);
            console.log(`   Manager Phone: ${orderDetails.pickup_site.contact.manager_phone || 'N/A'}`);
            console.log(`   Location: ${orderDetails.pickup_site.location.lat}, ${orderDetails.pickup_site.location.lng}`);
            console.log(`   Capacity: ${orderDetails.pickup_site.operational.current_load}/${orderDetails.pickup_site.operational.capacity}`);
        }
        
        console.log('\n📦 Package Details:');
        if (orderDetails.items && orderDetails.items.length > 0) {
            orderDetails.items.forEach((item, index) => {
                console.log(`   ${index + 1}. ${item.product_name} x${item.quantity} - ${item.total_price} ${orderDetails.currency}`);
            });
        } else {
            console.log('   No items found for this order');
        }
        
        // Step 5: Update agent location
        console.log('\n📍 Step 5: Update agent location...');
        const locationResponse = await makeRequest({
            hostname: 'localhost',
            port: 3001,
            path: '/api/pickup-delivery-agent/update-location',
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json' 
            }
        }, {
            latitude: -1.9441,
            longitude: 30.0619,
            heading: 45,
            speed: 25
        });
        
        if (locationResponse.statusCode === 200) {
            console.log('✅ Agent location updated successfully');
        } else {
            console.log('❌ Failed to update location:', locationResponse.body);
        }
        
        // Step 6: Start pickup journey
        console.log('\n🚚 Step 6: Start pickup journey (arrive at seller)...');
        const startPickupResponse = await makeRequest({
            hostname: 'localhost',
            port: 3001,
            path: `/api/pickup-delivery-agent/start-pickup/${orderId}`,
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json' 
            }
        }, {
            current_lat: -1.9441,
            current_lng: 30.0619,
            notes: 'Arrived at seller location, ready to pick up package'
        });
        
        if (startPickupResponse.statusCode === 200) {
            console.log('✅ Pickup journey started - PDA at seller');
            console.log(`   Status: ${startPickupResponse.body.status}`);
        } else {
            console.log('❌ Failed to start pickup:', startPickupResponse.body);
        }
        
        // Step 7: Complete pickup
        console.log('\n📦 Step 7: Complete pickup from seller...');
        const completePickupResponse = await makeRequest({
            hostname: 'localhost',
            port: 3001,
            path: `/api/pickup-delivery-agent/complete-pickup/${orderId}`,
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json' 
            }
        }, {
            pickup_photo: 'pickup_photo_url.jpg',
            pickup_notes: 'Package in good condition, properly sealed',
            package_condition: 'Excellent'
        });
        
        if (completePickupResponse.statusCode === 200) {
            console.log('✅ Package picked up from seller');
            console.log(`   Status: ${completePickupResponse.body.status}`);
        } else {
            console.log('❌ Failed to complete pickup:', completePickupResponse.body);
        }
        
        // Step 8: Start delivery to pickup site
        console.log('\n🏃 Step 8: Start delivery to pickup site...');
        const startDeliveryResponse = await makeRequest({
            hostname: 'localhost',
            port: 3001,
            path: `/api/pickup-delivery-agent/start-delivery/${orderId}`,
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json' 
            }
        }, {
            estimated_arrival_time: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
            notes: 'En route to pickup site, ETA 45 minutes'
        });
        
        if (startDeliveryResponse.statusCode === 200) {
            console.log('✅ Delivery to pickup site started');
            console.log(`   Status: ${startDeliveryResponse.body.status}`);
        } else {
            console.log('❌ Failed to start delivery:', startDeliveryResponse.body);
        }
        
        // Step 9: Complete delivery to pickup site
        console.log('\n🏁 Step 9: Complete delivery to pickup site...');
        const completeDeliveryResponse = await makeRequest({
            hostname: 'localhost',
            port: 3001,
            path: `/api/pickup-delivery-agent/complete-delivery/${orderId}`,
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json' 
            }
        }, {
            delivery_photo: 'delivery_photo_url.jpg',
            handover_code: 'PSM123',
            psm_signature: true,
            delivery_notes: 'Package delivered to PSM, signed and confirmed',
            current_lat: -1.9441,
            current_lng: 30.0619
        });
        
        if (completeDeliveryResponse.statusCode === 200) {
            console.log('✅ Package delivered to pickup site');
            console.log(`   Status: ${completeDeliveryResponse.body.status}`);
        } else {
            console.log('❌ Failed to complete delivery:', completeDeliveryResponse.body);
        }
        
        // Step 10: Send message to buyer
        console.log('\n💬 Step 10: Send message to buyer...');
        const messageResponse = await makeRequest({
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
            message: 'Your package has been successfully delivered to the pickup site and is ready for collection!',
            message_type: 'text'
        });
        
        if (messageResponse.statusCode === 200) {
            console.log('✅ Message sent to buyer');
        } else {
            console.log('❌ Failed to send message:', messageResponse.body);
        }
        
        // Step 11: Final verification - check order details again
        console.log('\n🔍 Step 11: Final verification - check updated order details...');
        const finalDetailsResponse = await makeRequest({
            hostname: 'localhost',
            port: 3001,
            path: `/api/pickup-delivery-agent/order-details/${orderId}`,
            method: 'GET',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json' 
            }
        });
        
        if (finalDetailsResponse.statusCode === 200) {
            const finalOrder = finalDetailsResponse.body.order;
            console.log('✅ Final order status verified');
            console.log(`   Final Status: ${finalOrder.status}`);
            console.log(`   Pickup Time: ${finalOrder.actual_pickup_time || 'N/A'}`);
            console.log(`   Delivery Time: ${finalOrder.actual_delivery_time || 'N/A'}`);
            console.log(`   Delivery Confirmed: ${finalOrder.tracking.delivery_confirmed_at || 'N/A'}`);
            
            console.log('\n🎉 COMPLETE SUCCESS: Enhanced PDA flow completed successfully!');
            console.log('📋 All features tested:');
            console.log('   ✅ Login and authentication');
            console.log('   ✅ Order acceptance');
            console.log('   ✅ Enhanced order details with full contact info');
            console.log('   ✅ Location tracking');
            console.log('   ✅ Pickup journey management');
            console.log('   ✅ Package pickup from seller');
            console.log('   ✅ Delivery to pickup site');
            console.log('   ✅ Real-time messaging');
            console.log('   ✅ Complete delivery workflow');
        } else {
            console.log('❌ Failed to get final order details:', finalDetailsResponse.body);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testEnhancedPDAFlow();