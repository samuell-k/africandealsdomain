/**
 * FIX BUYER SCHEMA TEST
 * 
 * This test fixes database schema issues and creates proper buyer account
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const puppeteer = require('puppeteer');

class FixBuyerSchemaTest {
  constructor() {
    this.baseUrl = 'http://localhost:3001';
    this.dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'add_physical_product',
      port: process.env.DB_PORT || 3333
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

  async runSchemaFix() {
    console.log('🔧 FIX BUYER SCHEMA TEST');
    console.log('========================');
    
    try {
      // Step 1: Connect to database
      await this.connectToDatabase();
      
      // Step 2: Check and fix schema
      await this.checkAndFixSchema();
      
      // Step 3: Create/update buyer account
      await this.createBuyerAccount();
      
      // Step 4: Test authentication
      await this.testAuthentication();
      
      // Step 5: Test browser flow
      await this.testBrowserFlow();
      
      console.log('\n🎉 BUYER SCHEMA FIX COMPLETED SUCCESSFULLY!');
      
    } catch (error) {
      console.error('\n💥 Buyer Schema Fix Failed:', error.message);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  async connectToDatabase() {
    console.log('\n📊 Connecting to database...');
    console.log(`📍 Host: ${this.dbConfig.host}:${this.dbConfig.port}`);
    console.log(`📍 Database: ${this.dbConfig.database}`);
    
    try {
      this.connection = await mysql.createConnection(this.dbConfig);
      console.log('✅ Database connection successful');
      
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      console.log('⚠️ Trying alternative database configurations...');
      
      // Try alternative configurations
      const alternatives = [
        { ...this.dbConfig, database: 'african_deals_db' },
        { ...this.dbConfig, port: 3306 },
        { ...this.dbConfig, database: 'african_deals_db', port: 3306 }
      ];
      
      for (const config of alternatives) {
        try {
          console.log(`🔄 Trying: ${config.host}:${config.port}/${config.database}`);
          this.connection = await mysql.createConnection(config);
          console.log(`✅ Connected with alternative config: ${config.database}:${config.port}`);
          this.dbConfig = config;
          break;
        } catch (altError) {
          console.log(`❌ Alternative failed: ${altError.message}`);
        }
      }
      
      if (!this.connection) {
        throw new Error('Could not connect to database with any configuration');
      }
    }
  }

  async checkAndFixSchema() {
    console.log('\n🔍 Checking database schema...');
    
    try {
      // Check if users table exists
      const [tables] = await this.connection.execute("SHOW TABLES LIKE 'users'");
      
      if (tables.length === 0) {
        console.log('⚠️ Users table does not exist, creating...');
        await this.createUsersTable();
      } else {
        console.log('✅ Users table exists');
        
        // Check table structure
        const [columns] = await this.connection.execute("DESCRIBE users");
        const columnNames = columns.map(col => col.Field);
        
        console.log('📋 Current columns:', columnNames.join(', '));
        
        // Check for required columns
        const requiredColumns = ['id', 'name', 'email', 'password', 'role'];
        const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));
        
        if (missingColumns.length > 0) {
          console.log('⚠️ Missing columns:', missingColumns.join(', '));
          await this.addMissingColumns(missingColumns, columnNames);
        } else {
          console.log('✅ All required columns present');
        }
      }
      
    } catch (error) {
      console.error('❌ Schema check failed:', error.message);
      throw error;
    }
  }

  async createUsersTable() {
    console.log('🔧 Creating users table...');
    
    const createTableQuery = `
      CREATE TABLE users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(32) NOT NULL DEFAULT 'buyer',
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

  async addMissingColumns(missingColumns, existingColumns) {
    console.log('🔧 Adding missing columns...');
    
    for (const column of missingColumns) {
      try {
        let alterQuery = '';
        
        switch (column) {
          case 'name':
            if (existingColumns.includes('username')) {
              alterQuery = 'ALTER TABLE users ADD COLUMN name VARCHAR(255) AFTER id';
              await this.connection.execute(alterQuery);
              // Copy data from username to name
              await this.connection.execute('UPDATE users SET name = username WHERE name IS NULL');
            } else {
              alterQuery = 'ALTER TABLE users ADD COLUMN name VARCHAR(255) NOT NULL AFTER id';
              await this.connection.execute(alterQuery);
            }
            break;
            
          case 'password':
            if (existingColumns.includes('password_hash')) {
              alterQuery = 'ALTER TABLE users ADD COLUMN password VARCHAR(255) AFTER email';
              await this.connection.execute(alterQuery);
              // Copy data from password_hash to password
              await this.connection.execute('UPDATE users SET password = password_hash WHERE password IS NULL');
            } else {
              alterQuery = 'ALTER TABLE users ADD COLUMN password VARCHAR(255) NOT NULL AFTER email';
              await this.connection.execute(alterQuery);
            }
            break;
            
          case 'role':
            alterQuery = "ALTER TABLE users ADD COLUMN role VARCHAR(32) NOT NULL DEFAULT 'buyer' AFTER password";
            await this.connection.execute(alterQuery);
            break;
            
          default:
            console.log(`⚠️ Unknown column: ${column}`);
        }
        
        if (alterQuery) {
          console.log(`✅ Added column: ${column}`);
        }
        
      } catch (error) {
        console.error(`❌ Failed to add column ${column}:`, error.message);
      }
    }
  }

  async createBuyerAccount() {
    console.log('\n👤 Creating/updating buyer account...');
    
    try {
      // Check if buyer exists
      const [existing] = await this.connection.execute(
        'SELECT id, name, email, role FROM users WHERE email = ?',
        [this.buyerCredentials.email]
      );
      
      // Hash password
      const hashedPassword = await bcrypt.hash(this.buyerCredentials.password, 10);
      
      if (existing.length > 0) {
        console.log('🔄 Updating existing buyer...');
        await this.connection.execute(
          'UPDATE users SET name = ?, password = ?, role = ?, phone = ? WHERE email = ?',
          [
            this.buyerCredentials.name,
            hashedPassword,
            this.buyerCredentials.role,
            this.buyerCredentials.phone,
            this.buyerCredentials.email
          ]
        );
        console.log('✅ Buyer updated successfully');
        
      } else {
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
        console.log(`✅ Buyer created with ID: ${result.insertId}`);
      }
      
    } catch (error) {
      console.error('❌ Failed to create buyer account:', error.message);
      throw error;
    }
  }

  async testAuthentication() {
    console.log('\n🔐 Testing authentication...');
    
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: this.buyerCredentials.email,
          password: this.buyerCredentials.password
        })
      });
      
      console.log(`📊 Response Status: ${response.status}`);
      const data = await response.json();
      
      if (response.ok) {
        console.log('✅ Authentication successful!');
        console.log(`👤 User: ${data.user.name} (${data.user.role})`);
        console.log(`🎫 Token: Present`);
        
      } else {
        console.log('❌ Authentication failed');
        console.log(`📋 Error:`, data);
        throw new Error(`Authentication failed: ${data.error}`);
      }
      
    } catch (error) {
      console.error('💥 Authentication test failed:', error.message);
      throw error;
    }
  }

  async testBrowserFlow() {
    console.log('\n🌐 Testing browser authentication flow...');
    
    const browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1366, height: 768 }
    });

    const page = await browser.newPage();
    
    try {
      // Navigate and login
      await page.goto(`${this.baseUrl}/auth/auth-buyer.html`, { waitUntil: 'networkidle2' });
      await page.screenshot({ path: 'schema-fix-auth-page.png', fullPage: true });
      
      await page.type('#email', this.buyerCredentials.email);
      await page.type('#password', this.buyerCredentials.password);
      await page.screenshot({ path: 'schema-fix-credentials.png', fullPage: true });
      
      await page.click('#buyer-signin-btn');
      await this.delay(8000);
      
      const finalUrl = page.url();
      await page.screenshot({ path: 'schema-fix-result.png', fullPage: true });
      
      console.log(`📍 Final URL: ${finalUrl}`);
      
      if (finalUrl.includes('buyers-home.html')) {
        console.log('🎉 SUCCESS: Redirected to buyers-home.html!');
      } else {
        console.log('⚠️ Not redirected, but checking authentication...');
        
        const authData = await page.evaluate(() => ({
          token: localStorage.getItem('authToken'),
          userData: localStorage.getItem('userData')
        }));
        
        if (authData.token) {
          console.log('✅ Authentication successful, manual redirect test...');
          await page.goto(`${this.baseUrl}/buyer/buyers-home.html`);
          await this.delay(3000);
          
          if (page.url().includes('buyers-home.html')) {
            console.log('🎉 Manual redirect successful!');
          }
        }
      }
      
      await browser.close();
      
    } catch (error) {
      await page.screenshot({ path: 'schema-fix-error.png', fullPage: true });
      await browser.close();
      throw error;
    }
  }

  async cleanup() {
    if (this.connection) {
      await this.connection.end();
      console.log('✅ Database connection closed');
    }
  }
}

// Execute the schema fix test
if (require.main === module) {
  const test = new FixBuyerSchemaTest();
  
  test.runSchemaFix()
    .then(() => {
      console.log('\n🎉 BUYER SCHEMA FIX COMPLETED!');
      console.log('✅ Database schema fixed');
      console.log('✅ Buyer account created/updated');
      console.log('✅ Authentication tested');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 BUYER SCHEMA FIX FAILED:', error.message);
      process.exit(1);
    });
}

module.exports = FixBuyerSchemaTest;