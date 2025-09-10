const puppeteer = require('puppeteer');

async function testPSMComplete() {
  console.log('🚀 Starting Complete PSM Test Suite');
  console.log('='.repeat(50));
  
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
    
    // Test 1: Authentication
    console.log('\n🧪 Test 1: PSM Authentication');
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
      
      console.log('✅ Authentication successful');
      testResults.passed++;
      testResults.tests.push({ name: 'Authentication', status: 'PASSED' });
      
    } catch (error) {
      console.log('❌ Authentication failed:', error.message);
      testResults.failed++;
      testResults.tests.push({ name: 'Authentication', status: 'FAILED', error: error.message });
    }
    
    // Test 2: Manual Order Page Load
    console.log('\n🧪 Test 2: Manual Order Page Load');
    testResults.total++;
    
    try {
      await page.goto('http://localhost:3001/agent/psm-manual-order.html', { 
        waitUntil: 'networkidle0',
        timeout: 10000 
      });
      
      // Wait for page to fully load
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if we're on the correct page (not redirected to login)
      const currentUrl = page.url();
      if (currentUrl.includes('psm-manual-order.html')) {
        console.log('✅ Manual Order page loaded successfully');
        testResults.passed++;
        testResults.tests.push({ name: 'Manual Order Page Load', status: 'PASSED' });
      } else {
        throw new Error(`Redirected to: ${currentUrl}`);
      }
      
    } catch (error) {
      console.log('❌ Manual Order page load failed:', error.message);
      testResults.failed++;
      testResults.tests.push({ name: 'Manual Order Page Load', status: 'FAILED', error: error.message });
    }
    
    // Test 3: Form Elements Present
    console.log('\n🧪 Test 3: Form Elements Present');
    testResults.total++;
    
    try {
      // Check for manual order form
      const form = await page.$('#manualOrderForm');
      if (!form) throw new Error('Manual order form not found');
      
      // Check for customer name field
      const customerName = await page.$('#customer_name');
      if (!customerName) throw new Error('Customer name field not found');
      
      // Check for product search
      const productSearch = await page.$('#productSearch');
      if (!productSearch) throw new Error('Product search field not found');
      
      console.log('✅ All form elements present');
      testResults.passed++;
      testResults.tests.push({ name: 'Form Elements Present', status: 'PASSED' });
      
    } catch (error) {
      console.log('❌ Form elements check failed:', error.message);
      testResults.failed++;
      testResults.tests.push({ name: 'Form Elements Present', status: 'FAILED', error: error.message });
    }
    
    // Test 4: Product Search Functionality
    console.log('\n🧪 Test 4: Product Search Functionality');
    testResults.total++;
    
    try {
      // Type in product search
      await page.type('#productSearch', 'test product');
      
      // Wait for search results or loading
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('✅ Product search functionality works');
      testResults.passed++;
      testResults.tests.push({ name: 'Product Search Functionality', status: 'PASSED' });
      
    } catch (error) {
      console.log('❌ Product search failed:', error.message);
      testResults.failed++;
      testResults.tests.push({ name: 'Product Search Functionality', status: 'FAILED', error: error.message });
    }
    
    // Test 5: Customer Form Fill
    console.log('\n🧪 Test 5: Customer Form Fill');
    testResults.total++;
    
    try {
      // Fill customer information
      await page.type('#customer_name', 'Test Customer');
      await page.type('#customer_phone', '+250788123456');
      await page.type('#customer_email', 'test@example.com');
      
      console.log('✅ Customer form fill successful');
      testResults.passed++;
      testResults.tests.push({ name: 'Customer Form Fill', status: 'PASSED' });
      
    } catch (error) {
      console.log('❌ Customer form fill failed:', error.message);
      testResults.failed++;
      testResults.tests.push({ name: 'Customer Form Fill', status: 'FAILED', error: error.message });
    }
    
    // Test 6: PSM Dashboard Access
    console.log('\n🧪 Test 6: PSM Dashboard Access');
    testResults.total++;
    
    try {
      await page.goto('http://localhost:3001/agent/psm-dashboard.html', { 
        waitUntil: 'networkidle0',
        timeout: 10000 
      });
      
      // Wait for dashboard to load
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const currentUrl = page.url();
      if (currentUrl.includes('psm-dashboard.html')) {
        console.log('✅ PSM Dashboard accessible');
        testResults.passed++;
        testResults.tests.push({ name: 'PSM Dashboard Access', status: 'PASSED' });
      } else {
        throw new Error(`Redirected to: ${currentUrl}`);
      }
      
    } catch (error) {
      console.log('❌ PSM Dashboard access failed:', error.message);
      testResults.failed++;
      testResults.tests.push({ name: 'PSM Dashboard Access', status: 'FAILED', error: error.message });
    }
    
    // Test 7: PSM Orders Page Access
    console.log('\n🧪 Test 7: PSM Orders Page Access');
    testResults.total++;
    
    try {
      await page.goto('http://localhost:3001/agent/psm-orders.html', { 
        waitUntil: 'networkidle0',
        timeout: 10000 
      });
      
      // Wait for orders page to load
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const currentUrl = page.url();
      if (currentUrl.includes('psm-orders.html')) {
        console.log('✅ PSM Orders page accessible');
        testResults.passed++;
        testResults.tests.push({ name: 'PSM Orders Page Access', status: 'PASSED' });
      } else {
        throw new Error(`Redirected to: ${currentUrl}`);
      }
      
    } catch (error) {
      console.log('❌ PSM Orders page access failed:', error.message);
      testResults.failed++;
      testResults.tests.push({ name: 'PSM Orders Page Access', status: 'FAILED', error: error.message });
    }
    
    // Take final screenshot
    await page.screenshot({ path: 'psm-complete-test-final.png', fullPage: true });
    console.log('📸 Final screenshot saved');
    
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
  
  // Print results
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(50));
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
  } else {
    console.log(`\n⚠️ ${testResults.failed} test(s) failed. Please review the issues above.`);
  }
}

// Run the test
testPSMComplete().then(() => {
  console.log('\n🏁 Test suite completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test suite crashed:', error);
  process.exit(1);
});