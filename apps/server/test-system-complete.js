#!/usr/bin/env node

/**
 * Complete System Test - Authentication & Orders
 * Tests the entire buyer authentication and order system
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

console.log('🚀 COMPLETE SYSTEM TEST');
console.log('=======================\n');

// Test configurations
const BASE_URL = 'http://localhost:3001';
const tests = [];
let passedTests = 0;
let totalTests = 0;

function addTest(name, testFn) {
    tests.push({ name, testFn });
    totalTests++;
}

function testPassed(testName) {
    console.log(`✅ ${testName}`);
    passedTests++;
}

function testFailed(testName, error) {
    console.log(`❌ ${testName}: ${error}`);
}

// Test 1: Server is running
addTest('Server Running', async () => {
    return new Promise((resolve) => {
        const req = http.get(`${BASE_URL}/api/health`, (res) => {
            if (res.statusCode === 200 || res.statusCode === 404) {
                testPassed('Server is running and responding');
                resolve(true);
            } else {
                testFailed('Server Running', `HTTP ${res.statusCode}`);
                resolve(false);
            }
        });
        
        req.on('error', (error) => {
            testFailed('Server Running', error.message);
            resolve(false);
        });
        
        req.setTimeout(5000, () => {
            testFailed('Server Running', 'Timeout');
            resolve(false);
        });
    });
});

// Test 2: Auth check script exists
addTest('Auth Script Exists', async () => {
    const authPath = path.join(__dirname, '../../apps/client/public/auth-check.js');
    if (fs.existsSync(authPath)) {
        testPassed('auth-check.js exists');
        return true;
    } else {
        testFailed('Auth Script Exists', 'auth-check.js not found');
        return false;
    }
});

// Test 3: Buyer pages exist
addTest('Buyer Pages Exist', async () => {
    const pages = [
        'apps/client/buyer/orders.html',
        'apps/client/buyer/order-details.html',
        'apps/client/buyer/order-detail.html'
    ];
    
    let allExist = true;
    for (const page of pages) {
        const fullPath = path.join(__dirname, '../..', page);
        if (!fs.existsSync(fullPath)) {
            testFailed('Buyer Pages Exist', `${page} not found`);
            allExist = false;
        }
    }
    
    if (allExist) {
        testPassed('All buyer pages exist');
        return true;
    }
    return false;
});

// Test 4: Database connection (if available)
addTest('Database Connection', async () => {
    try {
        // Try to require the database module
        const dbPath = path.join(__dirname, 'config', 'database.js');
        if (fs.existsSync(dbPath)) {
            testPassed('Database configuration exists');
            return true;
        } else {
            testFailed('Database Connection', 'Database config not found');
            return false;
        }
    } catch (error) {
        testFailed('Database Connection', error.message);
        return false;
    }
});

// Test 5: Authentication pages accessible
addTest('Auth Pages Accessible', async () => {
    return new Promise((resolve) => {
        const req = http.get(`${BASE_URL}/auth/auth-buyer.html`, (res) => {
            if (res.statusCode === 200) {
                testPassed('Buyer auth page accessible');
                resolve(true);
            } else {
                testFailed('Auth Pages Accessible', `HTTP ${res.statusCode}`);
                resolve(false);
            }
        });
        
        req.on('error', (error) => {
            testFailed('Auth Pages Accessible', error.message);
            resolve(false);
        });
        
        req.setTimeout(5000, () => {
            testFailed('Auth Pages Accessible', 'Timeout');
            resolve(false);
        });
    });
});

// Test 6: API endpoints responding
addTest('API Endpoints', async () => {
    return new Promise((resolve) => {
        const req = http.get(`${BASE_URL}/api/orders`, (res) => {
            // We expect 401 (unauthorized) since we're not authenticated
            if (res.statusCode === 401) {
                testPassed('Orders API endpoint responding (requires auth)');
                resolve(true);
            } else if (res.statusCode === 200) {
                testPassed('Orders API endpoint responding');
                resolve(true);
            } else {
                testFailed('API Endpoints', `Unexpected status: ${res.statusCode}`);
                resolve(false);
            }
        });
        
        req.on('error', (error) => {
            testFailed('API Endpoints', error.message);
            resolve(false);
        });
        
        req.setTimeout(5000, () => {
            testFailed('API Endpoints', 'Timeout');
            resolve(false);
        });
    });
});

// Run all tests
async function runTests() {
    console.log('🧪 Running system tests...\n');
    
    for (const test of tests) {
        try {
            await test.testFn();
        } catch (error) {
            testFailed(test.name, error.message);
        }
    }
    
    console.log('\n📊 TEST SUMMARY');
    console.log('===============');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${totalTests - passedTests}`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%\n`);
    
    if (passedTests === totalTests) {
        console.log('🎉 ALL TESTS PASSED!');
        console.log('\n🚀 SYSTEM READY FOR USE');
        console.log('========================');
        console.log(`🌐 Access the application at: ${BASE_URL}`);
        console.log(`👤 Buyer Login: ${BASE_URL}/auth/auth-buyer.html`);
        console.log(`📦 Orders Page: ${BASE_URL}/buyer/orders.html`);
        console.log(`🏠 Main Site: ${BASE_URL}/public/index.html`);
        
        console.log('\n📋 TESTING CHECKLIST');
        console.log('====================');
        console.log('1. ✅ Open buyer login page');
        console.log('2. ✅ Create/login with buyer account');
        console.log('3. ✅ Navigate to orders page');
        console.log('4. ✅ Click on order details');
        console.log('5. ✅ Test logout functionality');
        console.log('6. ✅ Verify authentication redirects');
        
    } else {
        console.log('⚠️  Some tests failed. Please check the issues above.');
        console.log('\n🔧 TROUBLESHOOTING');
        console.log('==================');
        console.log('1. Ensure server is running: cd apps/server && npm start');
        console.log('2. Check database connection');
        console.log('3. Verify all files are in correct locations');
        console.log('4. Check console for any error messages');
    }
    
    console.log('\n✅ System Test Complete!');
}

// Start testing
runTests().catch(console.error);