const puppeteer = require('puppeteer');

async function testPSMBasic() {
  console.log('🚀 Starting Basic PSM Test');
  
  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: false, 
      devtools: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set up authentication tokens (using test PSM user)
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({
        id: 313,
        name: 'Test PSM',
        email: 'test.psm@example.com',
        role: 'agent',
        agent_type: 'pickup_site_manager'
      }));
    });
    
    console.log('📱 Navigating to PSM Manual Order page...');
    await page.goto('http://localhost:3001/agent/psm-manual-order.html', { 
      waitUntil: 'networkidle0',
      timeout: 10000 
    });
    
    // Wait a bit for any redirects
    await page.waitForTimeout(2000);
    
    console.log('🔍 Current URL:', page.url());
    
    // Check if we're still on the manual order page
    if (page.url().includes('psm-manual-order.html')) {
      console.log('✅ Page loaded successfully');
      
      // Check for form elements
      const formExists = await page.$('#manualOrderForm');
      console.log('📝 Manual Order Form exists:', !!formExists);
      
      const productSearchExists = await page.$('#productSearch');
      console.log('🔍 Product Search exists:', !!productSearchExists);
      
      const customerNameExists = await page.$('#customer_name');
      console.log('👤 Customer Name field exists:', !!customerNameExists);
      
      const submitButtonExists = await page.$('#createOrderBtn');
      console.log('🚀 Submit button exists:', !!submitButtonExists);
      
      // Take a screenshot
      await page.screenshot({ path: 'psm-manual-order-test.png', fullPage: true });
      console.log('📸 Screenshot saved as psm-manual-order-test.png');
      
    } else {
      console.log('❌ Page redirected to:', page.url());
      
      // Take a screenshot of where we ended up
      await page.screenshot({ path: 'psm-redirect-test.png', fullPage: true });
      console.log('📸 Redirect screenshot saved as psm-redirect-test.png');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
testPSMBasic().then(() => {
  console.log('🏁 Test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test crashed:', error);
  process.exit(1);
});