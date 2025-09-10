const puppeteer = require('puppeteer');

async function testPSMQuickFix() {
  console.log('🚀 Starting PSM Quick Fix Test');
  
  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: false, 
      devtools: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Listen for console messages and errors
    page.on('console', msg => {
      console.log(`PAGE LOG [${msg.type()}]:`, msg.text());
    });
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    
    // Test 1: Login
    console.log('\n🧪 Test 1: Login');
    await page.goto('http://localhost:3001/auth/auth-agent.html', { 
      waitUntil: 'networkidle0',
      timeout: 10000 
    });
    
    await page.type('#email', 'psm.test.new@example.com');
    await page.type('#password', 'testpsm123');
    await page.click('button[type="submit"]');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('✅ Login completed');
    
    // Test 2: Dashboard Load
    console.log('\n🧪 Test 2: Dashboard Load');
    await page.goto('http://localhost:3001/agent/psm-dashboard.html', { 
      waitUntil: 'networkidle0',
      timeout: 10000 
    });
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('✅ Dashboard loaded');
    
    // Test 3: Check viewOrders button
    console.log('\n🧪 Test 3: Check viewOrders button');
    const viewOrdersButtons = await page.$$('button[onclick="viewOrders()"]');
    console.log(`Found ${viewOrdersButtons.length} viewOrders buttons`);
    
    if (viewOrdersButtons.length > 0) {
      console.log('✅ viewOrders button found, clicking...');
      await viewOrdersButtons[0].click();
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const currentUrl = page.url();
      console.log('Current URL after click:', currentUrl);
      
      if (currentUrl.includes('psm-orders.html')) {
        console.log('✅ Successfully navigated to orders page');
        
        // Test 4: Check orders page elements
        console.log('\n🧪 Test 4: Check orders page elements');
        const searchInput = await page.$('#search');
        const statusFilter = await page.$('#status-filter');
        const dateFilter = await page.$('#date-filter');
        
        console.log('Search input found:', !!searchInput);
        console.log('Status filter found:', !!statusFilter);
        console.log('Date filter found:', !!dateFilter);
        
        if (searchInput && statusFilter && dateFilter) {
          console.log('✅ All key elements found on orders page');
        } else {
          console.log('❌ Some elements missing on orders page');
        }
        
        // Test 5: Check create order link
        console.log('\n🧪 Test 5: Check create order link');
        const createOrderLink = await page.$('a[href="/agent/manual-order-creation.html"]');
        console.log('Create order link found:', !!createOrderLink);
        
        if (createOrderLink) {
          console.log('✅ Create order link found, clicking...');
          await createOrderLink.click();
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          const newUrl = page.url();
          console.log('URL after clicking create order:', newUrl);
          
          if (newUrl.includes('manual-order-creation.html')) {
            console.log('✅ Successfully navigated to manual order creation');
            
            // Test 6: Check goBack function
            console.log('\n🧪 Test 6: Check goBack function');
            const goBackButton = await page.$('button[onclick="goBack()"]');
            console.log('Go back button found:', !!goBackButton);
            
            if (goBackButton) {
              console.log('✅ Go back button found, clicking...');
              await goBackButton.click();
              await new Promise(resolve => setTimeout(resolve, 3000));
              
              const backUrl = page.url();
              console.log('URL after going back:', backUrl);
              
              if (backUrl.includes('psm-dashboard.html')) {
                console.log('✅ Successfully navigated back to dashboard');
              } else {
                console.log('❌ Failed to navigate back to dashboard');
              }
            }
          }
        }
      }
    } else {
      console.log('❌ No viewOrders buttons found');
    }
    
    await page.screenshot({ path: 'psm-quick-fix-test.png', fullPage: true });
    console.log('📸 Screenshot saved');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
testPSMQuickFix().then(() => {
  console.log('\n🏁 Quick fix test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test crashed:', error);
  process.exit(1);
});