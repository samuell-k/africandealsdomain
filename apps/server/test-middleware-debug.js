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
                        body: parsedBody,
                        rawBody: body
                    });
                } catch (e) {
                    resolve({
                        statusCode: res.statusCode,
                        body: body,
                        rawBody: body
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

async function testMiddlewareDebug() {
    console.log('🧪 Testing Middleware Debug...');
    
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
        console.log('🔑 Token:', token.substring(0, 20) + '...');
        
        // Step 2: Test profile endpoint first (simpler endpoint)
        console.log('\n👤 Step 2: Test profile endpoint...');
        const profileResponse = await makeRequest({
            hostname: 'localhost',
            port: 3001,
            path: '/api/pickup-delivery-agent/profile',
            method: 'GET',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json' 
            }
        });
        
        console.log('👤 Profile response status:', profileResponse.statusCode);
        if (profileResponse.statusCode !== 200) {
            console.log('❌ Profile response:', profileResponse.rawBody);
        } else {
            console.log('✅ Profile endpoint works');
        }
        
        // Step 3: Test available orders endpoint
        console.log('\n📋 Step 3: Test available orders endpoint...');
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
        if (availableOrdersResponse.statusCode !== 200) {
            console.log('❌ Available orders response:', availableOrdersResponse.rawBody);
        } else {
            console.log('✅ Available orders endpoint works');
            console.log('📋 Response:', JSON.stringify(availableOrdersResponse.body, null, 2));
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testMiddlewareDebug();