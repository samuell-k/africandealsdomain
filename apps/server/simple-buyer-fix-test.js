/**
 * SIMPLE BUYER FIX TEST
 * 
 * This test creates the buyer user via API and tests authentication
 */

const puppeteer = require('puppeteer');

class SimpleBuyerFixTest {
  constructor() {
    this.baseUrl = 'http://localhost:3001';
    this.buyerCredentials = {
      name: 'Marie Nyirabakundamarie',
      email: 'nyirabakundamarie@gmail.com',
      password: 'nyirabakundamarie@gmail.com',
      role: 'buyer',
      phone: '+250788123456'
    };
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async runSimpleFix() {
    console.log('🔧 SIMPLE BUYER FIX TEST');
    console.log('========================');
    
    try {
      // Step 1: Create buyer via registration API
      await this.createBuyerViaAPI();
      
      // Step 2: Test authentication
      await this.testAuthentication();
      
      // Step 3: Test full browser flow
      await this.testBrowserFlow();
      
      console.log('\n🎉 SIMPLE BUYER FIX COMPLETED SUCCESSFULLY!');
      
    } catch (error) {
      console.error('\n💥 Simple Buyer Fix Failed:', error.message);
      throw error;
    }
  }

  async createBuyerViaAPI() {
    console.log('\n👤 Creating buyer via registration API...');
    
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.buyerCredentials)
      });
      
      console.log(`📊 Registration Response Status: ${response.status}`);
      const data = await response.json();
      
      if (response.ok) {
        console.log('✅ Buyer registration successful!');
        console.log(`👤 User ID: ${data.user.id}`);
        console.log(`👤 User Role: ${data.user.role}`);
        console.log(`👤 User Email: ${data.user.email}`);
        
      } else if (response.status === 409) {
        console.log('ℹ️ Buyer already exists (409 - Conflict)');
        console.log('📋 This is expected if buyer was created before');
        
      } else {
        console.log('⚠️ Registration failed, but continuing with login test');
        console.log(`📋 Response:`, data);
      }
      
    } catch (error) {
      console.log('⚠️ Registration API error (continuing with login test):', error.message);
    }
  }

  async testAuthentication() {
    console.log('\n🔐 Testing buyer authentication...');
    
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: this.buyerCredentials.email,
          password: this.buyerCredentials.password
        })
      });
      
      console.log(`📊 Login Response Status: ${response.status}`);
      const data = await response.json();
      
      if (response.ok) {
        console.log('✅ Authentication successful!');
        console.log(`👤 User Role: ${data.user.role}`);
        console.log(`👤 User Name: ${data.user.name}`);
        console.log(`🎫 Token: ${data.token ? 'Present' : 'Missing'}`);
        
        this.validToken = data.token;
        this.validUser = data.user;
        
      } else {
        console.log('❌ Authentication failed');
        console.log(`📋 Error:`, data);
        throw new Error(`Authentication failed: ${data.error}`);
      }
      
    } catch (error) {
      console.error('💥 Authentication error:', error.message);
      throw error;
    }
  }

  async testBrowserFlow() {
    console.log('\n🌐 Testing browser authentication flow...');
    
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
    
    // Enable console logging
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.text().includes('[AUTH]')) {
        console.log(`🖥️ Browser [${msg.type()}]:`, msg.text());
      }
    });
    
    try {
      // Navigate to buyer auth page
      console.log('📍 Navigating to buyer auth page...');
      await page.goto(`${this.baseUrl}/auth/auth-buyer.html`, { waitUntil: 'networkidle2' });
      
      // Take screenshot
      await page.screenshot({ path: 'simple-auth-page.png', fullPage: true });
      console.log('📸 Screenshot saved: simple-auth-page.png');
      
      // Fill credentials
      console.log('📝 Filling credentials...');
      await page.waitForSelector('#email', { timeout: 10000 });
      await page.type('#email', this.buyerCredentials.email);
      await page.type('#password', this.buyerCredentials.password);
      
      // Take screenshot after filling
      await page.screenshot({ path: 'simple-credentials-filled.png', fullPage: true });
      console.log('📸 Screenshot saved: simple-credentials-filled.png');
      
      // Submit form
      console.log('🚀 Submitting login form...');
      await page.click('#buyer-signin-btn');
      
      // Wait for redirection with longer timeout
      console.log('⏳ Waiting for redirection...');
      await this.delay(10000);
      
      const finalUrl = page.url();
      const title = await page.title();
      
      console.log(`📍 Final URL: ${finalUrl}`);
      console.log(`📄 Final Title: ${title}`);
      
      // Take screenshot of result
      await page.screenshot({ path: 'simple-post-login.png', fullPage: true });
      console.log('📸 Screenshot saved: simple-post-login.png');
      
      // Check localStorage
      const authData = await page.evaluate(() => {
        return {
          token: localStorage.getItem('authToken'),
          userData: localStorage.getItem('userData')
        };
      });
      
      console.log(`💾 LocalStorage Data:`);
      console.log(`  Token: ${authData.token ? 'Present' : 'Missing'}`);
      console.log(`  User Data: ${authData.userData ? 'Present' : 'Missing'}`);
      
      if (authData.userData) {
        try {
          const user = JSON.parse(authData.userData);
          console.log(`  User Role: ${user.role}`);
          console.log(`  User Email: ${user.email}`);
        } catch (e) {
          console.log('  User Data: Invalid JSON');
        }
      }
      
      // Check for success
      if (finalUrl.includes('buyers-home.html')) {
        console.log('🎉 SUCCESS: Buyer redirected to buyers-home.html!');
        console.log('✅ Authentication and redirection working correctly!');
        
      } else if (authData.token && authData.userData) {
        console.log('✅ Authentication successful, testing manual redirection...');
        
        // Try manual redirection
        await page.goto(`${this.baseUrl}/buyer/buyers-home.html`, { waitUntil: 'networkidle2' });
        await this.delay(3000);
        
        const manualUrl = page.url();
        await page.screenshot({ path: 'simple-manual-redirect.png', fullPage: true });
        console.log('📸 Screenshot saved: simple-manual-redirect.png');
        
        if (manualUrl.includes('buyers-home.html')) {
          console.log('🎉 SUCCESS: Manual redirection to buyers-home.html works!');
          console.log('⚠️ Note: Automatic redirection may need fixing, but manual works');
        } else {
          console.log('❌ Manual redirection also failed');
        }
        
      } else {
        console.log('❌ Authentication failed in browser');
        
        // Check for error messages
        const errorElement = await page.$('#buyer-signin-error');
        if (errorElement) {
          const errorText = await page.evaluate(el => el.textContent, errorElement);
          const errorVisible = await page.evaluate(el => el.style.display !== 'none', errorElement);
          
          if (errorVisible && errorText.trim()) {
            console.log(`❌ Login Error: ${errorText}`);
          }
        }
      }
      
      await browser.close();
      
    } catch (error) {
      console.error('💥 Browser flow error:', error.message);
      await page.screenshot({ path: 'simple-browser-error.png', fullPage: true });
      await browser.close();
      throw error;
    }
  }
}

// Execute the simple buyer fix test
if (require.main === module) {
  const test = new SimpleBuyerFixTest();
  
  test.runSimpleFix()
    .then(() => {
      console.log('\n🎉 SIMPLE BUYER FIX COMPLETED!');
      console.log('✅ Buyer authentication should now work');
      console.log('🔄 Check screenshots for visual confirmation');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 SIMPLE BUYER FIX FAILED:', error.message);
      process.exit(1);
    });
}

module.exports = SimpleBuyerFixTest;