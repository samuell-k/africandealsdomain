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

async function testRegularLogin() {
    console.log('🧪 Testing Regular Login...');
    
    try {
        // Test regular login for PDA
        console.log('\n🚛 Testing PDA Regular Login...');
        const pdaLoginResponse = await makeRequest({
            hostname: 'localhost',
            port: 3001,
            path: '/api/auth/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            email: 'pda.test@example.com',
            password: 'testpass123'
        });
        
        console.log('📋 PDA Regular Login Response:', pdaLoginResponse.statusCode);
        if (pdaLoginResponse.statusCode === 200) {
            console.log('✅ PDA regular login successful');
        } else {
            console.log('❌ PDA regular login failed');
            console.log('📋 Error:', pdaLoginResponse.body);
        }
        
        // Test regular login for PSM
        console.log('\n🏪 Testing PSM Regular Login...');
        const psmLoginResponse = await makeRequest({
            hostname: 'localhost',
            port: 3001,
            path: '/api/auth/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            email: 'psm.test@example.com',
            password: 'testpass123'
        });
        
        console.log('📋 PSM Regular Login Response:', psmLoginResponse.statusCode);
        if (psmLoginResponse.statusCode === 200) {
            console.log('✅ PSM regular login successful');
        } else {
            console.log('❌ PSM regular login failed');
            console.log('📋 Error:', psmLoginResponse.body);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testRegularLogin();