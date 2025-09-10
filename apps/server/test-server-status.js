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

async function testServerStatus() {
    console.log('🔍 Testing Server Status...');
    
    try {
        // Test health endpoint
        const healthResponse = await makeRequest({
            hostname: 'localhost',
            port: 3001,
            path: '/api/health',
            method: 'GET'
        });
        
        console.log('📋 Health check:', healthResponse.statusCode);
        
        // Test login
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
        
        console.log('📋 PDA Login:', loginResponse.statusCode);
        
        if (loginResponse.statusCode === 200) {
            const token = loginResponse.body.token;
            
            // Test PSM verify code with correct data
            const verifyResponse = await makeRequest({
                hostname: 'localhost',
                port: 3001,
                path: '/api/pickup-site-manager/verify-code',
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json' 
                }
            }, { verification_code: 'PK001' });
            
            console.log('📋 PSM Verify Code:', verifyResponse.statusCode, verifyResponse.body);
        }
        
    } catch (error) {
        console.error('❌ Server test failed:', error.message);
    }
}

testServerStatus();