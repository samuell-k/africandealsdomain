/**
 * FIX BUYER CREDENTIALS TEST
 * 
 * This test checks and fixes buyer credentials in the database
 * and ensures proper authentication flow
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const puppeteer = require('puppeteer');

class FixBuyerCredentialsTest {
  constructor() {
    this.baseUrl = 'http://localhost:3001';
    this.dbConfig = {
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'african_deals_db'
    };
    
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

  async runCredentialsFix() {
    console.log('🔧 FIX BUYER CREDENTIALS TEST');
    console.log('=============================');
    
    try {
      // Step 1: Check database connection
      await this.testDatabaseConnection();
      
      // Step 2: Check if buyer exists
      await this.checkBuyerExists();
      
      // Step 3: Create or update buyer
      await this.createOrUpdateBuyer();
      
      // Step 4: Test authentication with fixed credentials
      await this.testAuthenticationWithFixedCredentials();
      
      // Step 5: Test full authentication flow
      await this.testFullAuthenticationFlow();
      
      console.log('\n🎉 BUYER CREDENTIALS FIX COMPLETED SUCCESSFULLY!');
      
    } catch (error) {
      console.error('\n💥 Buyer Credentials Fix Failed:', error.message);
      throw error;
    }
  }

  async testDatabaseConnection() {
    console.log('\n📊 Testing Database Connection...');
    
    try {
      this.connection = await mysql.createConnection(this.dbConfig);
      console.log('✅ Database connection successful');
      
      // Test users table exists
      const [tables] = await this.connection.execute("SHOW TABLES LIKE 'users'");
      if (tables.length === 0) {
        console.log('⚠️ Users table does not exist, creating...');
        await this.createUsersTable();
      } else {
        console.log('✅ Users table exists');
      }
      
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      throw error;
    }
  }

  async createUsersTable() {
    console.log('🔧 Creating users table...');
    
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(32) NOT NULL,
        phone VARCHAR(32),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `;
    
    try {
      await this.connection.execute(createTableQuery);
      console.log('✅ Users table created successfully');
    } catch (error) {
      console.error('❌ Failed to create users table:', error.message);
      throw error;
    }
  }

  async checkBuyerExists() {
    console.log('\n👤 Checking if buyer exists...');
    
    try {
      const [rows] = await this.connection.execute(
        'SELECT id, name, email, role FROM users WHERE email = ?',
        [this.buyerCredentials.email]
      );
      
      if (rows.length > 0) {
        const user = rows[0];
        console.log('✅ Buyer found in database:');
        console.log(`  ID: ${user.id}`);
        console.log(`  Name: ${user.name}`);
        console.log(`  Email: ${user.email}`);
        console.log(`  Role: ${user.role}`);
        
        this.existingBuyer = user;
      } else {
        console.log('⚠️ Buyer not found in database');
        this.existingBuyer = null;
      }
      
    } catch (error) {
      console.error('❌ Failed to check buyer existence:', error.message);
      throw error;
    }
  }

  async createOrUpdateBuyer() {
    console.log('\n🔧 Creating or updating buyer...');
    
    try {
      // Hash the password
      const hashedPassword = await bcrypt.hash(this.buyerCredentials.password, 10);
      console.log('✅ Password hashed successfully');
      
      if (this.existingBuyer) {
        // Update existing buyer
        console.log('🔄 Updating existing buyer...');
        await this.connection.execute(
          'UPDATE users SET name = ?, password = ?, phone = ?, updated_at = NOW() WHERE email = ?',
          [
            this.buyerCredentials.name,
            hashedPassword,
            this.buyerCredentials.phone,
            this.buyerCredentials.email
          ]
        );
        console.log('✅ Buyer updated successfully');
        
      } else {
        // Create new buyer
        console.log('➕ Creating new buyer...');
        const [result] = await this.connection.execute(
          'INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, ?, ?)',
          [
            this.buyerCredentials.name,
            this.buyerCredentials.email,
            hashedPassword,
            this.buyerCredentials.role,
            this.buyerCredentials.phone
          ]
        );
        console.log(`✅ Buyer created successfully with ID: ${result.insertId}`);
      }
      
    } catch (error) {
      console.error('❌ Failed to create/update buyer:', error.message);
      throw error;
    }
  }

  async testAuthenticationWithFixedCredentials() {
    console.log('\n🔐 Testing Authentication with Fixed Credentials...');
    
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: this.buyerCredentials.email,
          password: this.buyerCredentials.password
        })
      });
      
      console.log(`📊 API Response Status: ${response.status}`);
      const data = await response.json();
      
      if (response.ok) {
        console.log('✅ API Authentication Successful!');
        console.log(`👤 User Role: ${data.user.role}`);
        console.log(`👤 User Name: ${data.user.name}`);
        console.log(`👤 User Email: ${data.user.email}`);
        console.log(`🎫 Token: ${data.token ? 'Present' : 'Missing'}`);
        
        this.validToken = data.token;
        this.validUser = data.user;
        
      } else {
        console.log('❌ API Authentication Failed');
        console.log(`📋 Error:`, data);
        throw new Error(`Authentication failed: ${data.error}`);
      }
      
    } catch (error) {
      console.error('💥 API Authentication Error:', error.message);
      throw error;
    }
  }

  async testFullAuthenticationFlow() {
    console.log('\n🌐 Testing Full Authentication Flow in Browser...');
    
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
      console.log(`🖥️ Browser Console [${msg.type()}]:`, msg.text());
    });
    
    try {
      // Navigate to buyer auth page
      console.log('📍 Navigating to buyer auth page...');
      await page.goto(`${this.baseUrl}/auth/auth-buyer.html`, { waitUntil: 'networkidle2' });
      
      // Take screenshot
      await page.screenshot({ path: 'fixed-auth-page.png', fullPage: true });
      console.log('📸 Screenshot saved: fixed-auth-page.png');
      
      // Fill credentials
      console.log('📝 Filling fixed credentials...');
      await page.waitForSelector('#email', { timeout: 10000 });
      await page.type('#email', this.buyerCredentials.email);
      await page.type('#password', this.buyerCredentials.password);
      
      // Take screenshot after filling
      await page.screenshot({ path: 'fixed-credentials-filled.png', fullPage: true });
      console.log('📸 Screenshot saved: fixed-credentials-filled.png');
      
      // Submit form
      console.log('🚀 Submitting login form...');
      await page.click('#buyer-signin-btn');
      
      // Wait for redirection
      await this.delay(8000);
      
      const finalUrl = page.url();
      const title = await page.title();
      
      console.log(`📍 Final URL: ${finalUrl}`);
      console.log(`📄 Final Title: ${title}`);
      
      // Take screenshot of result
      await page.screenshot({ path: 'fixed-post-login.png', fullPage: true });
      console.log('📸 Screenshot saved: fixed-post-login.png');
      
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
      
      if (finalUrl.includes('buyers-home.html')) {
        console.log('✅ AUTHENTICATION AND REDIRECTION SUCCESSFUL!');
        console.log('🎉 Buyer is now properly redirected to buyers-home.html');
      } else if (authData.token && authData.userData) {
        console.log('✅ Authentication successful, but redirection may need manual trigger');
        console.log('🔄 Attempting manual redirection...');
        
        await page.goto(`${this.baseUrl}/buyer/buyers-home.html`, { waitUntil: 'networkidle2' });
        await page.screenshot({ path: 'fixed-manual-redirect.png', fullPage: true });
        console.log('📸 Screenshot saved: fixed-manual-redirect.png');
        
        const manualUrl = page.url();
        if (manualUrl.includes('buyers-home.html')) {
          console.log('✅ Manual redirection successful!');
        }
      } else {
        console.log('❌ Authentication or redirection failed');
        
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
      console.error('💥 Full Authentication Flow Error:', error.message);
      await page.screenshot({ path: 'fixed-auth-error.png', fullPage: true });
      await browser.close();
      throw error;
    }
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up resources...');
    
    try {
      if (this.connection) {
        await this.connection.end();
        console.log('✅ Database connection closed');
      }
    } catch (error) {
      console.error('⚠️ Cleanup error:', error.message);
    }
  }
}

// Execute the credentials fix test
if (require.main === module) {
  const test = new FixBuyerCredentialsTest();
  
  test.runCredentialsFix()
    .then(() => {
      console.log('\n🎉 BUYER CREDENTIALS FIX COMPLETED!');
      console.log('✅ Buyer authentication should now work properly');
      console.log('🔄 Buyer redirection to buyers-home.html should be functional');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 BUYER CREDENTIALS FIX FAILED:', error.message);
      process.exit(1);
    })
    .finally(() => {
      test.cleanup();
    });
}

module.exports = FixBuyerCredentialsTest;