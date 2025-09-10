const http = require('http');

// Simple test to check login functionality
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

async function testSimpleLogin() {
    console.log('🧪 Testing Simple Agent Login...');
    
    try {
        // Test server connectivity first
        console.log('🔍 Testing server on port 3001...');
        const healthResponse = await makeRequest({
            hostname: 'localhost',
            port: 3001,
            path: '/api/health',
            method: 'GET'
        });
        
        console.log('📋 Health check response:', healthResponse.statusCode);
        
        // Test PDA login
        console.log('\n🚛 Testing PDA Login...');
        const pdaLoginResponse = await makeRequest({
            hostname: 'localhost',
            port: 3001,
            path: '/api/auth/agent-login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            email: 'pda.test@example.com',
            password: 'testpass123'
        });
        
        console.log('📋 PDA Login Response:', pdaLoginResponse.statusCode);
        if (pdaLoginResponse.statusCode === 200) {
            console.log('✅ PDA login successful');
            console.log('🔑 Token received:', pdaLoginResponse.body.token ? 'Yes' : 'No');
        } else {
            console.log('❌ PDA login failed');
            console.log('📋 Error:', pdaLoginResponse.body);
        }
        
        // Test PSM login
        console.log('\n🏪 Testing PSM Login...');
        const psmLoginResponse = await makeRequest({
            hostname: 'localhost',
            port: 3001,
            path: '/api/auth/agent-login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            email: 'psm.test@example.com',
            password: 'testpass123'
        });
        
        console.log('📋 PSM Login Response:', psmLoginResponse.statusCode);
        if (psmLoginResponse.statusCode === 200) {
            console.log('✅ PSM login successful');
            console.log('🔑 Token received:', psmLoginResponse.body.token ? 'Yes' : 'No');
        } else {
            console.log('❌ PSM login failed');
            console.log('📋 Error:', psmLoginResponse.body);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testSimpleLogin();