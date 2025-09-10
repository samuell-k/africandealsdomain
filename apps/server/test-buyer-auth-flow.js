/**
 * Test Buyer Authentication Flow
 */

const http = require('http');

async function testBuyerAuthFlow() {
  try {
    console.log('🧪 TESTING BUYER AUTHENTICATION FLOW');
    console.log('====================================\n');
    
    const baseUrl = 'http://localhost:3001';
    
    // Test 1: Login with buyer credentials
    console.log('1. Testing buyer login...');
    
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'testbuyer@example.com',
        password: 'password123',
        role: 'buyer'
      })
    });
    
    if (!loginResponse.ok) {
      const errorData = await loginResponse.json();
      console.log('❌ Login failed:', errorData.error);
      return;
    }
    
    const loginData = await loginResponse.json();
    console.log('✅ Login successful!');
    console.log('   Token received:', !!loginData.token);
    console.log('   User role:', loginData.user.role);
    console.log('   User name:', loginData.user.name);
    
    // Test 2: Verify token with auth check
    console.log('\n2. Testing token validation...');
    
    const authCheckResponse = await fetch(`${baseUrl}/api/auth/check`, {
      headers: {
        'Authorization': `Bearer ${loginData.token}`
      }
    });
    
    if (!authCheckResponse.ok) {
      console.log('❌ Token validation failed');
      return;
    }
    
    const authData = await authCheckResponse.json();
    console.log('✅ Token validation successful!');
    console.log('   Validated user role:', authData.role);
    console.log('   Validated user ID:', authData.id);
    
    // Test 3: Access buyer-specific endpoint (orders)
    console.log('\n3. Testing buyer orders endpoint...');
    
    const ordersResponse = await fetch(`${baseUrl}/api/orders`, {
      headers: {
        'Authorization': `Bearer ${loginData.token}`
      }
    });
    
    if (!ordersResponse.ok) {
      const errorData = await ordersResponse.json();
      console.log('❌ Orders endpoint failed:', errorData.error);
      return;
    }
    
    const ordersData = await ordersResponse.json();
    console.log('✅ Orders endpoint accessible!');
    console.log('   Orders count:', ordersData.orders ? ordersData.orders.length : 0);
    
    // Test 4: Test profile endpoint
    console.log('\n4. Testing profile endpoint...');
    
    const profileResponse = await fetch(`${baseUrl}/api/auth/profile`, {
      headers: {
        'Authorization': `Bearer ${loginData.token}`
      }
    });
    
    if (!profileResponse.ok) {
      console.log('❌ Profile endpoint failed');
      return;
    }
    
    const profileData = await profileResponse.json();
    console.log('✅ Profile endpoint accessible!');
    console.log('   Profile user name:', profileData.user.name);
    console.log('   Profile user email:', profileData.user.email);
    
    console.log('\n🎉 ALL AUTHENTICATION TESTS PASSED!');
    console.log('\n📋 Summary:');
    console.log('✅ Buyer can login successfully');
    console.log('✅ Token is valid and can be verified');
    console.log('✅ Buyer can access orders endpoint');
    console.log('✅ Buyer can access profile endpoint');
    console.log('\n🔗 Next steps:');
    console.log('1. Open browser to http://localhost:3001/auth/auth-buyer.html');
    console.log('2. Login with: testbuyer@example.com / password123');
    console.log('3. Should redirect to buyer dashboard');
    console.log('4. Navigate to orders page to test the fixed authentication');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Wait a bit for server to start, then run test
setTimeout(testBuyerAuthFlow, 3000);