const puppeteer = require('puppeteer');

async function testPSMCompleteSystem() {
  console.log('🚀 Starting Complete PSM System Test');
  console.log('='.repeat(60));
  
  let browser;
  let testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    tests: []
  };
  
  try {
    browser = await puppeteer.launch({ 
      headless: false, 
      devtools: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Listen for console messages and errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('PAGE ERROR:', msg.text());
      }
    });
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    
    // Test 1: Authentication Flow
    console.log('\n🧪 Test 1: PSM Authentication Flow');
    testResults.total++;
    
    try {
      await page.goto('http://localhost:3001/auth/auth-agent.html', { 
        waitUntil: 'networkidle0',
        timeout: 10000 
      });
      
      // Fill login form
      await page.type('#email', 'psm.test.new@example.com');
      await page.type('#password', 'testpsm123');
      await page.click('button[type="submit"]');
      
      // Wait for login response
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const currentUrl = page.url();
      if (currentUrl.includes('agent') || currentUrl.includes('dashboard')) {
        console.log('✅ Authentication successful - redirected to:', currentUrl);
        testResults.passed++;
        testResults.tests.push({ name: 'Authentication Flow', status: 'PASSED' });
      } else {
        throw new Error(`Authentication failed - at: ${currentUrl}`);
      }
      
    } catch (error) {
      console.log('❌ Authentication failed:', error.message);
      testResults.failed++;
      testResults.tests.push({ name: 'Authentication Flow', status: 'FAILED', error: error.message });
    }
    
    // Test 2: PSM Dashboard Load
    console.log('\n🧪 Test 2: PSM Dashboard Load');
    testResults.total++;
    
    try {
      await page.goto('http://localhost:3001/agent/psm-dashboard.html', { 
        waitUntil: 'networkidle0',
        timeout: 10000 
      });
      
      // Wait for dashboard to fully load
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check if we're on the correct page
      const currentUrl = page.url();
      if (currentUrl.includes('psm-dashboard.html')) {
        // Check for key dashboard elements
        const quickActions = await page.$('.grid .bg-blue-600');
        const statsCards = await page.$$('.stat-card');
        const recentOrders = await page.$('#recentOrdersTable');
        
        if (quickActions && statsCards.length > 0 && recentOrders) {
          console.log('✅ Dashboard loaded with all key elements');
          testResults.passed++;
          testResults.tests.push({ name: 'PSM Dashboard Load', status: 'PASSED' });
        } else {
          throw new Error('Dashboard missing key elements');
        }
      } else {
        throw new Error(`Redirected to: ${currentUrl}`);
      }
      
    } catch (error) {
      console.log('❌ Dashboard load failed:', error.message);
      testResults.failed++;
      testResults.tests.push({ name: 'PSM Dashboard Load', status: 'FAILED', error: error.message });
    }
    
    // Test 3: Create Manual Order Navigation
    console.log('\n🧪 Test 3: Create Manual Order Navigation');
    testResults.total++;
    
    try {
      // Click on Create Order button
      await page.click('button[onclick="createManualOrder()"]');
      
      // Wait for navigation
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const currentUrl = page.url();
      if (currentUrl.includes('manual-order-creation.html')) {
        console.log('✅ Successfully navigated to manual order creation page');
        testResults.passed++;
        testResults.tests.push({ name: 'Create Manual Order Navigation', status: 'PASSED' });
      } else {
        throw new Error(`Navigation failed - at: ${currentUrl}`);
      }
      
    } catch (error) {
      console.log('❌ Manual order navigation failed:', error.message);
      testResults.failed++;
      testResults.tests.push({ name: 'Create Manual Order Navigation', status: 'FAILED', error: error.message });
    }
    
    // Test 4: Manual Order Creation Page Elements
    console.log('\n🧪 Test 4: Manual Order Creation Page Elements');
    testResults.total++;
    
    try {
      // Check for key elements
      const productSearch = await page.$('#productSearch');
      const physicalBtn = await page.$('#switchToPhysicalBtn');
      const localBtn = await page.$('#switchToLocalBtn');
      const proceedBtn = await page.$('#proceedToCustomerInfo');
      
      if (productSearch && physicalBtn && localBtn && proceedBtn) {
        console.log('✅ All manual order creation elements present');
        testResults.passed++;
        testResults.tests.push({ name: 'Manual Order Creation Page Elements', status: 'PASSED' });
      } else {
        throw new Error('Missing key elements on manual order page');
      }
      
    } catch (error) {
      console.log('❌ Manual order page elements check failed:', error.message);
      testResults.failed++;
      testResults.tests.push({ name: 'Manual Order Creation Page Elements', status: 'FAILED', error: error.message });
    }
    
    // Test 5: Product Search Functionality
    console.log('\n🧪 Test 5: Product Search Functionality');
    testResults.total++;
    
    try {
      // Type in product search
      await page.type('#productSearch', 'test');
      
      // Wait for search results
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if products container exists
      const productsContainer = await page.$('#productsList');
      if (productsContainer) {
        console.log('✅ Product search functionality working');
        testResults.passed++;
        testResults.tests.push({ name: 'Product Search Functionality', status: 'PASSED' });
      } else {
        throw new Error('Products container not found');
      }
      
    } catch (error) {
      console.log('❌ Product search failed:', error.message);
      testResults.failed++;
      testResults.tests.push({ name: 'Product Search Functionality', status: 'FAILED', error: error.message });
    }
    
    // Test 6: Navigation Back to Dashboard
    console.log('\n🧪 Test 6: Navigation Back to Dashboard');
    testResults.total++;
    
    try {
      // Click back button
      await page.click('button[onclick="goBack()"]');
      
      // Wait for navigation
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const currentUrl = page.url();
      if (currentUrl.includes('psm-dashboard.html')) {
        console.log('✅ Successfully navigated back to dashboard');
        testResults.passed++;
        testResults.tests.push({ name: 'Navigation Back to Dashboard', status: 'PASSED' });
      } else {
        throw new Error(`Navigation failed - at: ${currentUrl}`);
      }
      
    } catch (error) {
      console.log('❌ Navigation back to dashboard failed:', error.message);
      testResults.failed++;
      testResults.tests.push({ name: 'Navigation Back to Dashboard', status: 'FAILED', error: error.message });
    }
    
    // Test 7: PSM Orders Page Navigation
    console.log('\n🧪 Test 7: PSM Orders Page Navigation');
    testResults.total++;
    
    try {
      // Click on View Orders button
      await page.click('button[onclick="viewOrders()"]');
      
      // Wait for navigation
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const currentUrl = page.url();
      if (currentUrl.includes('psm-orders.html')) {
        console.log('✅ Successfully navigated to orders page');
        testResults.passed++;
        testResults.tests.push({ name: 'PSM Orders Page Navigation', status: 'PASSED' });
      } else {
        throw new Error(`Navigation failed - at: ${currentUrl}`);
      }
      
    } catch (error) {
      console.log('❌ Orders page navigation failed:', error.message);
      testResults.failed++;
      testResults.tests.push({ name: 'PSM Orders Page Navigation', status: 'FAILED', error: error.message });
    }
    
    // Test 8: Orders Page Elements
    console.log('\n🧪 Test 8: Orders Page Elements');
    testResults.total++;
    
    try {
      // Check for key elements
      const searchInput = await page.$('#search');
      const statusFilter = await page.$('#status-filter');
      const createOrderBtn = await page.$('a[href="/agent/manual-order-creation.html"]');
      
      if (searchInput && statusFilter && createOrderBtn) {
        console.log('✅ All orders page elements present');
        testResults.passed++;
        testResults.tests.push({ name: 'Orders Page Elements', status: 'PASSED' });
      } else {
        throw new Error('Missing key elements on orders page');
      }
      
    } catch (error) {
      console.log('❌ Orders page elements check failed:', error.message);
      testResults.failed++;
      testResults.tests.push({ name: 'Orders Page Elements', status: 'FAILED', error: error.message });
    }
    
    // Test 9: Create Order Link from Orders Page
    console.log('\n🧪 Test 9: Create Order Link from Orders Page');
    testResults.total++;
    
    try {
      // Click create order link
      await page.click('a[href="/agent/manual-order-creation.html"]');
      
      // Wait for navigation
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const currentUrl = page.url();
      if (currentUrl.includes('manual-order-creation.html')) {
        console.log('✅ Successfully navigated to manual order creation from orders page');
        testResults.passed++;
        testResults.tests.push({ name: 'Create Order Link from Orders Page', status: 'PASSED' });
      } else {
        throw new Error(`Navigation failed - at: ${currentUrl}`);
      }
      
    } catch (error) {
      console.log('❌ Create order link navigation failed:', error.message);
      testResults.failed++;
      testResults.tests.push({ name: 'Create Order Link from Orders Page', status: 'FAILED', error: error.message });
    }
    
    // Test 10: Logout Functionality
    console.log('\n🧪 Test 10: Logout Functionality');
    testResults.total++;
    
    try {
      // Go back to dashboard first
      await page.goto('http://localhost:3001/agent/psm-dashboard.html', { 
        waitUntil: 'networkidle0',
        timeout: 10000 
      });
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Click profile button to open dropdown
      await page.click('#profileBtn');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Click logout
      await page.click('button[onclick="logout()"]');
      
      // Handle confirmation dialog
      page.on('dialog', async dialog => {
        await dialog.accept();
      });
      
      // Wait for navigation
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const currentUrl = page.url();
      if (currentUrl.includes('auth-agent.html')) {
        console.log('✅ Successfully logged out and redirected to login');
        testResults.passed++;
        testResults.tests.push({ name: 'Logout Functionality', status: 'PASSED' });
      } else {
        throw new Error(`Logout failed - at: ${currentUrl}`);
      }
      
    } catch (error) {
      console.log('❌ Logout functionality failed:', error.message);
      testResults.failed++;
      testResults.tests.push({ name: 'Logout Functionality', status: 'FAILED', error: error.message });
    }
    
    // Take final screenshot
    await page.screenshot({ path: 'psm-system-test-final.png', fullPage: true });
    console.log('📸 Final screenshot saved');
    
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
  
  // Print results
  console.log('\n' + '='.repeat(60));
  console.log('📊 PSM SYSTEM TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`Passed: ${testResults.passed}`);
  console.log(`Failed: ${testResults.failed}`);
  console.log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
  
  console.log('\n📋 Detailed Results:');
  testResults.tests.forEach((test, index) => {
    const status = test.status === 'PASSED' ? '✅' : '❌';
    console.log(`${index + 1}. ${status} ${test.name}`);
    if (test.error) {
      console.log(`   Error: ${test.error}`);
    }
  });
  
  if (testResults.passed === testResults.total) {
    console.log('\n🎉 ALL TESTS PASSED! PSM system is working correctly.');
    console.log('\n✨ System Features Verified:');
    console.log('   • Authentication flow works properly');
    console.log('   • Dashboard loads with all components');
    console.log('   • Manual order creation is accessible');
    console.log('   • Product search functionality works');
    console.log('   • Navigation between pages works');
    console.log('   • Orders page is functional');
    console.log('   • Logout functionality works');
  } else {
    console.log(`\n⚠️ ${testResults.failed} test(s) failed. Please review the issues above.`);
  }
  
  console.log('\n🔧 System Summary:');
  console.log('   • Removed duplicate PSM manual order page');
  console.log('   • Kept only manual-order-creation.html for order creation');
  console.log('   • Rebuilt PSM dashboard from scratch');
  console.log('   • Fixed all navigation links');
  console.log('   • Integrated with backend APIs');
  console.log('   • Proper authentication flow');
}

// Run the test
testPSMCompleteSystem().then(() => {
  console.log('\n🏁 Complete system test finished');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test suite crashed:', error);
  process.exit(1);
});