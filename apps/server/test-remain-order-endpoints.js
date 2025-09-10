/**
 * Test script for remaining order endpoints
 * Tests the data structure fixes and endpoint functionality
 */

const http = require('http');
const jwt = require('jsonwebtoken');

// Test configuration
const PORT = 3002; // Server is running on port 3002
const BASE_URL = `http://localhost:${PORT}`;

// Mock admin token for testing (you'll need to replace with actual token)
const createTestToken = () => {
    return jwt.sign(
        { id: 1, email: 'admin@test.com', role: 'admin' },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '1h' }
    );
};

// HTTP request helper
const makeRequest = (path, method = 'GET', data = null) => {
    return new Promise((resolve, reject) => {
        const token = createTestToken();
        const url = new URL(path, BASE_URL);
        
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        };

        const req = http.request(options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(responseData);
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data: jsonData
                    });
                } catch (error) {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data: responseData
                    });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (data && method !== 'GET') {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
};

// Test functions
async function testOrdersEndpoint() {
    console.log('🧪 Testing GET /api/admin/orders endpoint...');
    
    try {
        const response = await makeRequest('/api/admin/orders?page=1&limit=10');
        
        console.log(`Status: ${response.statusCode}`);
        console.log('Response structure check:');
        
        if (response.data) {
            console.log(`- success: ${response.data.success ? '✅' : '❌'}`);
            console.log(`- orders property exists: ${response.data.orders !== undefined ? '✅' : '❌'}`);
            console.log(`- pagination property exists: ${response.data.pagination !== undefined ? '✅' : '❌'}`);
            
            if (response.data.orders && Array.isArray(response.data.orders)) {
                console.log(`- orders is array: ✅`);
                console.log(`- orders count: ${response.data.orders.length}`);
                
                if (response.data.orders.length > 0) {
                    const firstOrder = response.data.orders[0];
                    console.log('First order structure:');
                    console.log(`  - id: ${firstOrder.id || 'Missing'}`);
                    console.log(`  - total_amount (type): ${typeof firstOrder.total_amount} (${firstOrder.total_amount})`);
                    console.log(`  - total_amount.toFixed test: ${typeof firstOrder.total_amount === 'number' && !isNaN(firstOrder.total_amount) ? '✅' : '❌'}`);
                    console.log(`  - user_name: ${firstOrder.user_name || 'Missing'}`);
                    console.log(`  - status: ${firstOrder.status || 'Missing'}`);
                    console.log(`  - item_count: ${firstOrder.item_count || 'Missing'}`);
                }
            } else {
                console.log(`- orders is array: ❌`);
            }
            
            if (response.data.pagination) {
                console.log('Pagination structure:');
                console.log(`  - current_page: ${response.data.pagination.current_page}`);
                console.log(`  - total: ${response.data.pagination.total}`);
                console.log(`  - total_pages: ${response.data.pagination.total_pages}`);
            }
        }
        
        return response.statusCode === 200 && response.data.success && response.data.orders;
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return false;
    }
}

async function testOrderStatsEndpoint() {
    console.log('\\n🧪 Testing GET /api/admin/orders/stats/summary endpoint...');
    
    try {
        const response = await makeRequest('/api/admin/orders/stats/summary');
        
        console.log(`Status: ${response.statusCode}`);
        
        if (response.data && response.data.success) {
            console.log('✅ Stats endpoint working');
            console.log('Stats structure:');
            if (response.data.stats) {
                console.log(`  - by_status: ${Array.isArray(response.data.stats.by_status) ? '✅' : '❌'}`);
                console.log(`  - total_orders (type): ${typeof response.data.stats.total_orders}`);
                console.log(`  - total_revenue (type): ${typeof response.data.stats.total_revenue}`);
                console.log(`  - recent_orders: ${response.data.stats.recent_orders}`);
            }
        }
        
        return response.statusCode === 200 && response.data.success;
        
    } catch (error) {
        console.error('❌ Stats test failed:', error.message);
        return false;
    }
}

async function testHealthCheck() {
    console.log('🧪 Testing server health...');
    
    try {
        const response = await makeRequest('/api/health');
        console.log(`Health check: ${response.statusCode === 200 ? '✅' : '❌'}`);
        return response.statusCode === 200;
    } catch (error) {
        console.error('❌ Health check failed:', error.message);
        return false;
    }
}

// Run all tests
async function runTests() {
    console.log('🧪 Starting endpoint tests for remain-order-endpoints.js\\n');
    console.log('='.repeat(60));
    
    const results = {
        health: await testHealthCheck(),
        orders: await testOrdersEndpoint(), 
        stats: await testOrderStatsEndpoint()
    };
    
    console.log('\\n' + '='.repeat(60));
    console.log('📊 Test Results Summary:');
    console.log(`Health Check: ${results.health ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Orders Endpoint: ${results.orders ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Stats Endpoint: ${results.stats ? '✅ PASS' : '❌ FAIL'}`);
    
    const totalTests = Object.keys(results).length;
    const passedTests = Object.values(results).filter(Boolean).length;
    
    console.log(`\\nOverall: ${passedTests}/${totalTests} tests passed`);
    console.log(passedTests === totalTests ? '🎉 All tests passed!' : '⚠️ Some tests failed');
    
    process.exit(passedTests === totalTests ? 0 : 1);
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('\\n🛑 Test interrupted');
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error.message);
    process.exit(1);
});

// Start tests
console.log('⏳ Waiting 2 seconds for server to be ready...');
setTimeout(runTests, 2000);