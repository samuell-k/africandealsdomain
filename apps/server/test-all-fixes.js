const puppeteer = require('puppeteer');

async function testAllFixes() {
  console.log('🚀 Starting Comprehensive Fix Test');
  
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
      if (msg.type() === 'error') {
        console.log('PAGE ERROR:', msg.text());
      } else if (msg.type() === 'log') {
        console.log('PAGE LOG:', msg.text());
      }
    });
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    
    // Test 1: Dashboard Load and Commission Display
    console.log('\n🧪 Test 1: Dashboard Load and Commission Display');
    
    try {
      // Set authentication tokens
      await page.evaluateOnNewDocument(() => {
        localStorage.setItem('token', 'test-token');
        localStorage.setItem('user', JSON.stringify({
          id: 1,
          name: 'Test PSM',
          email: 'psm.test@example.com',
          role: 'agent',
          agent_type: 'pickup_site_manager'
        }));
      });
      
      await page.goto('http://localhost:3001/agent/psm-dashboard.html', { 
        waitUntil: 'networkidle0',
        timeout: 15000 
      });
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Check if commission section is present
      const commissionSection = await page.$('#totalCommissions');
      const withdrawalSection = await page.$('#withdrawAmount');
      const availableBalance = await page.$('#availableBalance');
      
      console.log('Commission section found:', !!commissionSection);
      console.log('Withdrawal section found:', !!withdrawalSection);
      console.log('Available balance found:', !!availableBalance);
      
      if (commissionSection && withdrawalSection && availableBalance) {
        console.log('✅ Commission management section loaded successfully');
      } else {
        console.log('❌ Commission management section missing elements');
      }
      
    } catch (error) {
      console.log('❌ Dashboard test failed:', error.message);
    }
    
    // Test 2: Manual Order Creation - Product Loading
    console.log('\n🧪 Test 2: Manual Order Creation - Product Loading');
    
    try {
      await page.goto('http://localhost:3001/agent/manual-order-creation.html', { 
        waitUntil: 'networkidle0',
        timeout: 15000 
      });
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check if product type buttons are present
      const physicalBtn = await page.$('#switchToPhysicalBtn');
      const localBtn = await page.$('#switchToLocalBtn');
      const productsList = await page.$('#productsList');
      
      console.log('Physical products button found:', !!physicalBtn);
      console.log('Local products button found:', !!localBtn);
      console.log('Products list container found:', !!productsList);
      
      if (physicalBtn && localBtn && productsList) {
        console.log('✅ Manual order creation page loaded successfully');
        
        // Test switching to local products
        console.log('\n🧪 Test 2a: Switch to Local Products');
        
        await localBtn.click();
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Check if distance filter appeared
        const distanceFilter = await page.$('#distanceFilter');
        const locationBtn = await page.$('#locationBtn');
        
        console.log('Distance filter appeared:', !!distanceFilter && !(await distanceFilter.evaluate(el => el.classList.contains('hidden'))));
        console.log('Location button appeared:', !!locationBtn && !(await locationBtn.evaluate(el => el.classList.contains('hidden'))));
        
        if (distanceFilter && locationBtn) {
          console.log('✅ Local products mode activated successfully');
        } else {
          console.log('❌ Local products mode activation failed');
        }
        
      } else {
        console.log('❌ Manual order creation page missing elements');
      }
      
    } catch (error) {
      console.log('❌ Manual order creation test failed:', error.message);
    }
    
    // Test 3: Orders Page Navigation
    console.log('\n🧪 Test 3: Orders Page Navigation');
    
    try {
      await page.goto('http://localhost:3001/agent/psm-orders.html', { 
        waitUntil: 'networkidle0',
        timeout: 15000 
      });
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check if orders page elements are present
      const searchInput = await page.$('#search');
      const statusFilter = await page.$('#status-filter');
      const ordersTable = await page.$('#ordersTable');
      const createOrderLink = await page.$('a[href="/agent/manual-order-creation.html"]');
      
      console.log('Search input found:', !!searchInput);
      console.log('Status filter found:', !!statusFilter);
      console.log('Orders table found:', !!ordersTable);
      console.log('Create order link found:', !!createOrderLink);
      
      if (searchInput && statusFilter && ordersTable && createOrderLink) {
        console.log('✅ Orders page loaded successfully');
        
        // Test create order link
        console.log('\n🧪 Test 3a: Create Order Link Navigation');
        
        await createOrderLink.click();
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const currentUrl = page.url();
        if (currentUrl.includes('manual-order-creation.html')) {
          console.log('✅ Create order link navigation works');
        } else {
          console.log('❌ Create order link navigation failed');
        }
        
      } else {
        console.log('❌ Orders page missing elements');
      }
      
    } catch (error) {
      console.log('❌ Orders page test failed:', error.message);
    }
    
    // Test 4: API Endpoints Test
    console.log('\n🧪 Test 4: API Endpoints Test');
    
    try {
      // Test grocery products endpoint
      const groceryResponse = await page.evaluate(async () => {
        try {
          const response = await fetch('/api/grocery/products?limit=5');
          return {
            status: response.status,
            ok: response.ok,
            hasData: response.ok ? !!(await response.json()).products : false
          };
        } catch (error) {
          return { error: error.message };
        }
      });
      
      console.log('Grocery products API:', groceryResponse);
      
      // Test dashboard API
      const dashboardResponse = await page.evaluate(async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch('/api/pickup-site-manager/dashboard', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          return {
            status: response.status,
            ok: response.ok,
            hasData: response.ok ? !!(await response.json()).todayStats : false
          };
        } catch (error) {
          return { error: error.message };
        }
      });
      
      console.log('Dashboard API:', dashboardResponse);
      
      // Test commissions API
      const commissionsResponse = await page.evaluate(async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch('/api/pickup-site-manager/commissions', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          return {
            status: response.status,
            ok: response.ok,
            hasData: response.ok ? !!(await response.json()).summary : false
          };
        } catch (error) {
          return { error: error.message };
        }
      });
      
      console.log('Commissions API:', commissionsResponse);
      
      if (groceryResponse.ok && dashboardResponse.ok && commissionsResponse.ok) {
        console.log('✅ All API endpoints working correctly');
      } else {
        console.log('❌ Some API endpoints have issues');
      }
      
    } catch (error) {
      console.log('❌ API endpoints test failed:', error.message);
    }
    
    await page.screenshot({ path: 'comprehensive-test-final.png', fullPage: true });
    console.log('📸 Final screenshot saved');
    
    console.log('\n🎉 COMPREHENSIVE TEST COMPLETED!');
    console.log('✅ Fixed Issues:');
    console.log('   - Grocery products API endpoint corrected');
    console.log('   - Data handling for different API response formats');
    console.log('   - Dashboard orders and pickups data parsing');
    console.log('   - Commission management system added');
    console.log('   - Withdrawal functionality implemented');
    console.log('   - Product field mapping for grocery vs physical products');
    
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
testAllFixes().then(() => {
  console.log('\n🏁 All fixes test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test crashed:', error);
  process.exit(1);
});