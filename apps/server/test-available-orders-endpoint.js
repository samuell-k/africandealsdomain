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

async function testAvailableOrdersEndpoint() {
    console.log('🧪 Testing Available Orders Endpoint...');
    
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
        
        // Step 2: Test available orders endpoint with detailed logging
        console.log('\n📋 Step 2: Test available orders endpoint...');
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
        
        console.log('📋 Available orders response status:', availableOrdersResponse.statusCode);
        console.log('📋 Available orders response body:', JSON.stringify(availableOrdersResponse.body, null, 2));
        
        if (availableOrdersResponse.statusCode === 200) {
            const orders = availableOrdersResponse.body.orders || [];
            console.log(`✅ Found ${orders.length} available orders`);
            
            if (orders.length > 0) {
                console.log('📦 First few orders:');
                orders.slice(0, 3).forEach(order => {
                    console.log(`  - Order ${order.id}: $${order.total_amount} (${order.status})`);
                });
            }
        } else {
            console.log('❌ Failed to get available orders');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testAvailableOrdersEndpoint();