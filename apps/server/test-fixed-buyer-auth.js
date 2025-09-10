/**
 * TEST FIXED BUYER AUTHENTICATION
 * 
 * This test verifies that the buyer authentication now works without redirect loops
 */

const puppeteer = require('puppeteer');

class TestFixedBuyerAuth {
  constructor() {
    this.baseUrl = 'http://localhost:3001';
    this.buyerCredentials = {
      email: 'nyirabakundamarie@gmail.com',
      password: 'nyirabakundamarie@gmail.com'
    };
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async runTest() {
    console.log('🧪 TESTING FIXED BUYER AUTHENTICATION');
    console.log('=====================================');
    console.log('🔍 Verifying that buyer can login and stay on dashboard');
    
    try {
      const browser = await puppeteer.launch({
        headless: false,
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--window-size=1366,768'
        ],
        defaultViewport: { width: 1366, height: 768 }
      });

      const page = await browser.newPage();
      
      // Track all console messages for debugging
      const consoleMessages = [];
      page.on('console', msg => {
        const message = msg.text();
        consoleMessages.push(message);
        if (message.includes('[AUTH]') || message.includes('🔄') || message.includes('👤')) {
          console.log(`🖥️ ${message}`);
        }
      });
      
      // Track URL changes
      const urlHistory = [];
      page.on('framenavigated', frame => {
        if (frame === page.mainFrame()) {
          const url = frame.url();
          urlHistory.push({
            url: url,
            timestamp: Date.now()
          });
          console.log(`📍 Navigation: ${url}`);
        }
      });
      
      try {
        // Step 1: Navigate to login page
        console.log('\n📍 Step 1: Navigating to buyer login page...');
        await page.goto(`${this.baseUrl}/auth/auth-buyer.html`, { waitUntil: 'networkidle2' });
        
        // Step 2: Fill credentials
        console.log('📝 Step 2: Filling login credentials...');
        await page.waitForSelector('#email', { timeout: 10000 });
        await page.type('#email', this.buyerCredentials.email);
        await page.type('#password', this.buyerCredentials.password);
        
        await page.screenshot({ path: 'test-fixed-login.png', fullPage: true });
        console.log('📸 Screenshot: test-fixed-login.png');
        
        // Step 3: Submit login
        console.log('🚀 Step 3: Submitting login form...');
        await page.click('#buyer-signin-btn');
        
        // Step 4: Wait and monitor for 20 seconds
        console.log('⏳ Step 4: Monitoring authentication flow for 20 seconds...');
        const startTime = Date.now();
        let finalUrl = '';
        
        while (Date.now() - startTime < 20000) {
          finalUrl = page.url();
          await this.delay(1000);
        }
        
        await page.screenshot({ path: 'test-fixed-final.png', fullPage: true });
        console.log('📸 Screenshot: test-fixed-final.png');
        
        // Step 5: Check authentication state
        const authState = await page.evaluate(() => ({
          token: localStorage.getItem('authToken'),
          userData: localStorage.getItem('userData'),
          freshLogin: sessionStorage.getItem('freshLogin'),
          loginTimestamp: sessionStorage.getItem('loginTimestamp')
        }));
        
        console.log('\n📊 AUTHENTICATION STATE:');
        console.log(`💾 Token: ${authState.token ? 'Present' : 'Missing'}`);
        console.log(`💾 User Data: ${authState.userData ? 'Present' : 'Missing'}`);
        console.log(`🔄 Fresh Login Flag: ${authState.freshLogin || 'None'}`);
        console.log(`⏰ Login Timestamp: ${authState.loginTimestamp || 'None'}`);
        
        if (authState.userData) {
          try {
            const user = JSON.parse(authState.userData);
            console.log(`👤 User: ${user.name} (${user.role})`);
          } catch (e) {
            console.log('⚠️ User data is not valid JSON');
          }
        }
        
        // Step 6: Analyze results
        console.log('\n📊 URL HISTORY:');
        urlHistory.forEach((entry, index) => {
          console.log(`  ${index + 1}. ${entry.url}`);
        });
        
        const uniqueUrls = [...new Set(urlHistory.map(entry => entry.url))];
        const hasLoop = urlHistory.length > 10;
        const staysOnDashboard = finalUrl.includes('buyers-home.html');
        const redirectsBackToAuth = finalUrl.includes('auth-buyer.html');
        
        console.log('\n🎯 RESULTS ANALYSIS:');
        console.log(`📊 Total URL Changes: ${urlHistory.length}`);
        console.log(`📊 Unique URLs: ${uniqueUrls.length}`);
        console.log(`🔄 Has Redirect Loop: ${hasLoop ? 'YES (ISSUE)' : 'NO (GOOD)'}`);
        console.log(`🏠 Stays on Dashboard: ${staysOnDashboard ? 'YES (SUCCESS)' : 'NO'}`);
        console.log(`🔙 Redirects Back to Auth: ${redirectsBackToAuth ? 'YES (ISSUE)' : 'NO (GOOD)'}`);
        console.log(`📍 Final URL: ${finalUrl}`);
        
        // Step 7: Final verdict
        console.log('\n🏆 FINAL VERDICT:');
        if (staysOnDashboard && !hasLoop && authState.token && authState.userData) {
          console.log('✅ SUCCESS: Buyer authentication is working perfectly!');
          console.log('✅ User can login and stay on dashboard');
          console.log('✅ No redirect loops detected');
          console.log('✅ Authentication state is properly maintained');
        } else if (!hasLoop && authState.token && authState.userData) {
          console.log('✅ PARTIAL SUCCESS: Authentication works but may need dashboard access adjustment');
          console.log('✅ No redirect loops (major improvement)');
          console.log('✅ Authentication state is maintained');
        } else if (redirectsBackToAuth) {
          console.log('❌ ISSUE PERSISTS: Still redirecting back to auth page');
          console.log('🔍 Need to investigate authentication validation on dashboard');
        } else {
          console.log('❌ AUTHENTICATION FAILED: Login process not working');
        }
        
        await browser.close();
        
      } catch (error) {
        await page.screenshot({ path: 'test-fixed-error.png', fullPage: true });
        await browser.close();
        throw error;
      }
      
    } catch (error) {
      console.error('\n💥 Test Failed:', error.message);
      throw error;
    }
  }
}

// Execute the test
if (require.main === module) {
  const test = new TestFixedBuyerAuth();
  
  test.runTest()
    .then(() => {
      console.log('\n🎉 BUYER AUTHENTICATION TEST COMPLETED!');
      console.log('📊 Check the results above and screenshots for details');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 BUYER AUTHENTICATION TEST FAILED:', error.message);
      process.exit(1);
    });
}

module.exports = TestFixedBuyerAuth;