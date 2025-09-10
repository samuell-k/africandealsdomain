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

async function debugPDAProfile() {
    console.log('🔍 Debugging PDA Profile Endpoint...');
    
    try {
        // First, login to get token
        console.log('🔐 Logging in as PDA...');
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
            console.log('❌ Login failed:', loginResponse.statusCode, loginResponse.body);
            return;
        }

        const token = loginResponse.body.token;
        console.log('✅ Login successful, token received');
        console.log('📋 User info from login:', {
            id: loginResponse.body.user?.id,
            role: loginResponse.body.user?.role,
            agent_type: loginResponse.body.user?.agent_type
        });

        // Now try to access profile
        console.log('\n🔍 Accessing PDA profile...');
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

        console.log('📋 Profile response status:', profileResponse.statusCode);
        console.log('📋 Profile response body:', profileResponse.body);
        
        if (profileResponse.statusCode === 404) {
            console.log('\n🔍 Checking if middleware is the issue...');
            
            // Try dashboard-stats endpoint which uses the same middleware
            const statsResponse = await makeRequest({
                hostname: 'localhost',
                port: 3001,
                path: '/api/pickup-delivery-agent/dashboard-stats',
                method: 'GET',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json' 
                }
            });
            
            console.log('📋 Dashboard stats response:', statsResponse.statusCode);
            if (statsResponse.statusCode === 200) {
                console.log('✅ Dashboard stats works - middleware is OK');
                console.log('❌ Profile endpoint specifically has an issue');
            } else {
                console.log('❌ Dashboard stats also fails - middleware issue');
                console.log('📋 Stats error:', statsResponse.body);
            }
        }

    } catch (error) {
        console.error('❌ Debug failed:', error.message);
    }
}

debugPDAProfile();