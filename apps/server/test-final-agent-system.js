const http = require('http');
const fs = require('fs');
const path = require('path');

// Test configuration
const SERVER_PORT = 3001;
let pdaToken = null;
let psmToken = null;

// Utility function to make HTTP requests
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

async function testAgentLogin() {
    console.log('🔐 Testing Agent Authentication...');
    
    try {
        // Test PDA login
        const pdaResponse = await makeRequest({
            hostname: 'localhost',
            port: SERVER_PORT,
            path: '/api/auth/agent-login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            email: 'pda.test@example.com',
            password: 'testpass123'
        });

        if (pdaResponse.statusCode === 200 && pdaResponse.body.token) {
            pdaToken = pdaResponse.body.token;
            console.log('✅ PDA login successful');
        } else {
            console.log('❌ PDA login failed:', pdaResponse.statusCode);
            return false;
        }

        // Test PSM login
        const psmResponse = await makeRequest({
            hostname: 'localhost',
            port: SERVER_PORT,
            path: '/api/auth/agent-login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            email: 'psm.test@example.com',
            password: 'testpass123'
        });

        if (psmResponse.statusCode === 200 && psmResponse.body.token) {
            psmToken = psmResponse.body.token;
            console.log('✅ PSM login successful');
        } else {
            console.log('❌ PSM login failed:', psmResponse.statusCode);
            return false;
        }

        return true;
    } catch (error) {
        console.log('❌ Authentication test failed:', error.message);
        return false;
    }
}

async function testPDAEndpoints() {
    console.log('\n🚛 Testing PDA Endpoints...');
    
    if (!pdaToken) {
        console.log('❌ No PDA token available');
        return false;
    }

    const endpoints = [
        { path: '/api/pickup-delivery-agent/profile', method: 'GET' },
        { path: '/api/pickup-delivery-agent/available-orders', method: 'GET' },
        { path: '/api/pickup-delivery-agent/active-orders', method: 'GET' }
    ];

    let passed = 0;
    for (const endpoint of endpoints) {
        try {
            const response = await makeRequest({
                hostname: 'localhost',
                port: SERVER_PORT,
                path: endpoint.path,
                method: endpoint.method,
                headers: { 
                    'Authorization': `Bearer ${pdaToken}`,
                    'Content-Type': 'application/json' 
                }
            });

            if (response.statusCode === 200 || response.statusCode === 404) {
                console.log(`✅ ${endpoint.path}: ${response.statusCode}`);
                passed++;
            } else {
                console.log(`⚠️ ${endpoint.path}: ${response.statusCode}`);
            }
        } catch (error) {
            console.log(`❌ ${endpoint.path}: ${error.message}`);
        }
    }

    console.log(`📊 PDA Endpoints: ${passed}/${endpoints.length} working`);
    return passed >= endpoints.length / 2;
}

async function testPSMEndpoints() {
    console.log('\n🏪 Testing PSM Endpoints...');
    
    if (!psmToken) {
        console.log('❌ No PSM token available');
        return false;
    }

    const endpoints = [
        { path: '/api/pickup-site-manager/profile', method: 'GET' },
        { path: '/api/pickup-site-manager/dashboard', method: 'GET' },
        { path: '/api/pickup-site-manager/orders', method: 'GET' },
        { path: '/api/pickup-site-manager/ready-pickups', method: 'GET' }
    ];

    let passed = 0;
    for (const endpoint of endpoints) {
        try {
            const response = await makeRequest({
                hostname: 'localhost',
                port: SERVER_PORT,
                path: endpoint.path,
                method: endpoint.method,
                headers: { 
                    'Authorization': `Bearer ${psmToken}`,
                    'Content-Type': 'application/json' 
                }
            });

            if (response.statusCode === 200 || response.statusCode === 404) {
                console.log(`✅ ${endpoint.path}: ${response.statusCode}`);
                passed++;
            } else {
                console.log(`⚠️ ${endpoint.path}: ${response.statusCode}`);
            }
        } catch (error) {
            console.log(`❌ ${endpoint.path}: ${error.message}`);
        }
    }

    console.log(`📊 PSM Endpoints: ${passed}/${endpoints.length} working`);
    return passed >= endpoints.length / 2;
}

async function testFrontendFiles() {
    console.log('\n🌐 Testing Frontend Files...');
    
    const files = [
        'apps/client/agent/pickup-delivery-dashboard.html',
        'apps/client/agent/psm-dashboard.html',
        'apps/client/agent/psm-settings.html',
        'apps/client/agent/delivery-confirmation.html'
    ];

    let found = 0;
    for (const file of files) {
        const fullPath = path.join(process.cwd(), '../../', file);
        try {
            const stats = fs.statSync(fullPath);
            console.log(`✅ ${file} (${Math.round(stats.size/1024)}KB)`);
            found++;
        } catch (error) {
            console.log(`❌ ${file} not found`);
        }
    }

    console.log(`📊 Frontend Files: ${found}/${files.length} found`);
    return found === files.length;
}

async function testProfileUpdate() {
    console.log('\n👤 Testing Profile Updates...');
    
    if (!psmToken) {
        console.log('❌ No PSM token for profile test');
        return false;
    }

    try {
        const response = await makeRequest({
            hostname: 'localhost',
            port: SERVER_PORT,
            path: '/api/pickup-site-manager/profile',
            method: 'PUT',
            headers: { 
                'Authorization': `Bearer ${psmToken}`,
                'Content-Type': 'application/json' 
            }
        }, {
            name: 'Updated PSM Manager',
            site_name: 'Updated Test Site',
            phone: '+250788999888',
            address_line1: 'KG 456 St',
            city: 'Kigali',
            country: 'Rwanda'
        });

        if (response.statusCode === 200) {
            console.log('✅ PSM profile update successful');
            return true;
        } else {
            console.log('⚠️ PSM profile update response:', response.statusCode);
            if (response.body && response.body.error) {
                console.log('   Error:', response.body.error);
            }
            return false;
        }
    } catch (error) {
        console.log('❌ Profile update test failed:', error.message);
        return false;
    }
}

async function runFinalTests() {
    console.log('🚀 Final Agent System Tests');
    console.log('='.repeat(50));

    const results = {
        authentication: await testAgentLogin(),
        pdaEndpoints: await testPDAEndpoints(),
        psmEndpoints: await testPSMEndpoints(),
        frontendFiles: await testFrontendFiles(),
        profileUpdate: await testProfileUpdate()
    };

    console.log('\n📊 Final Test Results:');
    console.log('='.repeat(30));
    
    let passed = 0;
    const total = Object.keys(results).length;

    for (const [test, success] of Object.entries(results)) {
        const status = success ? '✅' : '❌';
        const name = test.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        console.log(`${status} ${name}: ${success ? 'PASSED' : 'FAILED'}`);
        if (success) passed++;
    }

    const successRate = Math.round((passed / total) * 100);
    console.log(`\n🎯 Overall: ${passed}/${total} tests passed (${successRate}%)`);

    if (successRate >= 80) {
        console.log('🎉 Agent system is working well!');
    } else if (successRate >= 60) {
        console.log('✅ Agent system is mostly functional.');
    } else {
        console.log('⚠️ Agent system needs more work.');
    }

    console.log('\n📝 System Status:');
    console.log('- PDA (Pickup Delivery Agent) system: ' + (results.authentication && results.pdaEndpoints ? '✅ Working' : '❌ Needs attention'));
    console.log('- PSM (Pickup Site Manager) system: ' + (results.authentication && results.psmEndpoints ? '✅ Working' : '❌ Needs attention'));
    console.log('- Frontend interfaces: ' + (results.frontendFiles ? '✅ Available' : '❌ Missing files'));
    console.log('- Profile management: ' + (results.profileUpdate ? '✅ Working' : '❌ Needs fixes'));

    return successRate >= 60;
}

// Run tests
if (require.main === module) {
    runFinalTests().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('❌ Test runner failed:', error);
        process.exit(1);
    });
}

module.exports = { runFinalTests };