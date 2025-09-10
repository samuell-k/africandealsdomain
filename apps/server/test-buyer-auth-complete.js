#!/usr/bin/env node

/**
 * Complete Buyer Authentication Test Script
 * Tests all buyer pages for authentication issues
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 COMPREHENSIVE BUYER AUTHENTICATION TEST');
console.log('==========================================\n');

// Test configurations
const testPages = [
    {
        name: 'Orders Page',
        path: '/apps/client/buyer/orders.html',
        expectedAuth: 'Auth.requireAuth(\'buyer\')',
        expectedScripts: ['/public/auth-check.js'],
        expectedFunctions: ['loadUserInfo', 'loadOrders', 'handleApiError']
    },
    {
        name: 'Order Details Page',
        path: '/apps/client/buyer/order-details.html',
        expectedAuth: 'Auth.requireAuth(\'buyer\')',
        expectedScripts: ['/public/auth-check.js'],
        expectedFunctions: ['loadUserInfo', 'loadOrderDetails', 'handleApiError']
    },
    {
        name: 'Order Detail Page (Alternative)',
        path: '/apps/client/buyer/order-detail.html',
        expectedAuth: 'Auth.requireAuth(\'buyer\')',
        expectedScripts: ['/public/auth-check.js'],
        expectedFunctions: ['loadOrderDetails']
    }
];

// Test results
let totalTests = 0;
let passedTests = 0;
let failedTests = [];

function testPage(pageConfig) {
    console.log(`📋 Testing: ${pageConfig.name}`);
    console.log(`   File: ${pageConfig.path}`);
    
    const fullPath = path.join(__dirname, '../..', pageConfig.path);
    
    if (!fs.existsSync(fullPath)) {
        console.log(`   ❌ File not found: ${fullPath}`);
        failedTests.push(`${pageConfig.name}: File not found`);
        return;
    }
    
    const content = fs.readFileSync(fullPath, 'utf8');
    let pageTests = 0;
    let pagePassed = 0;
    
    // Test 1: Check for auth-check.js script inclusion
    pageTests++;
    totalTests++;
    if (content.includes('auth-check.js')) {
        console.log('   ✅ auth-check.js script included');
        pagePassed++;
        passedTests++;
    } else {
        console.log('   ❌ auth-check.js script missing');
        failedTests.push(`${pageConfig.name}: Missing auth-check.js script`);
    }
    
    // Test 2: Check for proper Auth.requireAuth usage
    pageTests++;
    totalTests++;
    if (content.includes(pageConfig.expectedAuth)) {
        console.log('   ✅ Proper Auth.requireAuth usage found');
        pagePassed++;
        passedTests++;
    } else {
        console.log('   ❌ Auth.requireAuth usage missing or incorrect');
        failedTests.push(`${pageConfig.name}: Missing or incorrect Auth.requireAuth`);
    }
    
    // Test 3: Check for Auth.getToken() usage instead of localStorage
    pageTests++;
    totalTests++;
    if (content.includes('Auth.getToken()') && !content.includes('localStorage.getItem(\'authToken\')')) {
        console.log('   ✅ Using Auth.getToken() instead of direct localStorage access');
        pagePassed++;
        passedTests++;
    } else if (content.includes('Auth.getToken()')) {
        console.log('   ⚠️  Using Auth.getToken() but also has direct localStorage access');
        pagePassed++;
        passedTests++;
    } else {
        console.log('   ❌ Not using Auth.getToken() - still using direct localStorage');
        failedTests.push(`${pageConfig.name}: Not using Auth.getToken()`);
    }
    
    // Test 4: Check for proper logout function
    pageTests++;
    totalTests++;
    if (content.includes('Auth.logout()')) {
        console.log('   ✅ Using Auth.logout() for logout functionality');
        pagePassed++;
        passedTests++;
    } else {
        console.log('   ❌ Not using Auth.logout() - may have custom logout');
        failedTests.push(`${pageConfig.name}: Not using Auth.logout()`);
    }
    
    // Test 5: Check for error handling
    pageTests++;
    totalTests++;
    if (content.includes('handleApiError')) {
        console.log('   ✅ Has handleApiError function for proper error handling');
        pagePassed++;
        passedTests++;
    } else {
        console.log('   ❌ Missing handleApiError function');
        failedTests.push(`${pageConfig.name}: Missing handleApiError function`);
    }
    
    // Test 6: Check for old authentication patterns (should not exist)
    pageTests++;
    totalTests++;
    const hasOldAuth = content.includes('window.location.href = \'/public/login.html\'') ||
                      content.includes('isAuthenticated()') ||
                      content.includes('checkAuthenticationStatus()');
    
    if (!hasOldAuth) {
        console.log('   ✅ No old authentication patterns found');
        pagePassed++;
        passedTests++;
    } else {
        console.log('   ❌ Old authentication patterns still present');
        failedTests.push(`${pageConfig.name}: Old authentication patterns found`);
    }
    
    console.log(`   📊 Page Score: ${pagePassed}/${pageTests} tests passed\n`);
}

// Run tests for all pages
testPages.forEach(testPage);

// Print summary
console.log('📊 TEST SUMMARY');
console.log('===============');
console.log(`Total Tests: ${totalTests}`);
console.log(`Passed: ${passedTests}`);
console.log(`Failed: ${totalTests - passedTests}`);
console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%\n`);

if (failedTests.length > 0) {
    console.log('❌ FAILED TESTS:');
    failedTests.forEach((test, index) => {
        console.log(`   ${index + 1}. ${test}`);
    });
    console.log('');
}

// Additional checks
console.log('🔍 ADDITIONAL CHECKS');
console.log('====================');

// Check if auth-check.js exists
const authCheckPath = path.join(__dirname, '../../apps/client/public/auth-check.js');
if (fs.existsSync(authCheckPath)) {
    console.log('✅ auth-check.js file exists');
    
    const authContent = fs.readFileSync(authCheckPath, 'utf8');
    if (authContent.includes('requireAuth') && authContent.includes('getToken')) {
        console.log('✅ auth-check.js has required functions');
    } else {
        console.log('❌ auth-check.js missing required functions');
    }
} else {
    console.log('❌ auth-check.js file not found');
}

// Check test orders exist
const testOrdersPath = path.join(__dirname, 'create-test-orders.js');
if (fs.existsSync(testOrdersPath)) {
    console.log('✅ Test orders script exists');
} else {
    console.log('❌ Test orders script not found');
}

console.log('\n🎯 RECOMMENDATIONS');
console.log('==================');

if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Authentication system is properly implemented.');
    console.log('\n📋 Next Steps:');
    console.log('1. Start the server: cd apps/server && npm start');
    console.log('2. Test login: http://localhost:3001/auth/auth-buyer.html');
    console.log('3. Test orders page: http://localhost:3001/buyer/orders.html');
    console.log('4. Test order details: Click on any order to view details');
} else {
    console.log('⚠️  Some tests failed. Please review the failed tests above.');
    console.log('\n🔧 Common fixes:');
    console.log('1. Add <script src="/public/auth-check.js"></script> to page head');
    console.log('2. Use Auth.requireAuth(\'buyer\') in initializePage()');
    console.log('3. Replace localStorage.getItem(\'authToken\') with Auth.getToken()');
    console.log('4. Use Auth.logout() instead of custom logout functions');
    console.log('5. Add handleApiError() function for proper error handling');
}

console.log('\n✅ Authentication Test Complete!');