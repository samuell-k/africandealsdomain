const puppeteer = require('puppeteer');

async function testPSMSimple() {
  console.log('🚀 Starting Simple PSM Test');
  
  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: false, 
      devtools: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Listen for console messages and errors
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    
    console.log('📱 Testing server connection first...');
    
    try {
      await page.goto('http://localhost:3001/api/health', { 
        waitUntil: 'networkidle0',
        timeout: 5000 
      });
      console.log('✅ Server is responding');
    } catch (error) {
      console.log('❌ Server connection failed:', error.message);
      return;
    }
    
    console.log('📱 Navigating to agent auth page...');
    await page.goto('http://localhost:3001/auth/auth-agent.html', { 
      waitUntil: 'networkidle0',
      timeout: 10000 
    });
    
    console.log('✅ Auth page loaded');
    console.log('🔍 Current URL:', page.url());
    
    // Take a screenshot
    await page.screenshot({ path: 'auth-page-test.png', fullPage: true });
    console.log('📸 Screenshot saved as auth-page-test.png');
    
    // Check if login form exists
    const loginForm = await page.$('form');
    console.log('📝 Login form exists:', !!loginForm);
    
    // Wait for user to manually login or continue
    console.log('⏳ Waiting 10 seconds for manual interaction...');
    await page.waitForTimeout(10000);
    
    console.log('🔍 Final URL:', page.url());
    await page.screenshot({ path: 'final-state-test.png', fullPage: true });
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
testPSMSimple().then(() => {
  console.log('🏁 Test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test crashed:', error);
  process.exit(1);
});