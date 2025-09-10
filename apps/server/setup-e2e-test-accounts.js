/**
 * Setup E2E Test Accounts
 * Creates all necessary test accounts for the comprehensive E2E test
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

class E2ETestAccountSetup {
  constructor() {
    this.dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'add_physical_product',
      port: process.env.DB_PORT || 3333
    };
  }

  async setup() {
    let connection;
    
    try {
      console.log('🔄 Setting up E2E test accounts...');
      
      connection = await mysql.createConnection(this.dbConfig);
      console.log('✅ Connected to database');

      // Create test accounts
      await this.createBuyerAccount(connection);
      await this.createSellerAccount(connection);
      await this.createAgentAccounts(connection);
      await this.createTestProducts(connection);
      await this.setupPaymentSettings(connection);

      console.log('\n🎉 E2E test accounts setup completed successfully!');
      
    } catch (error) {
      console.error('❌ Setup failed:', error);
      throw error;
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  }

  async createBuyerAccount(connection) {
    const email = 'nyirabakundamarie@gmail.com';
    const password = await bcrypt.hash(email, 10);
    
    try {
      // Check if buyer already exists
      const [existing] = await connection.execute('SELECT id FROM users WHERE email = ?', [email]);
      
      if (existing.length > 0) {
        console.log(`✅ Buyer account ${email} already exists`);
        return;
      }

      // Create buyer account
      await connection.execute(`
        INSERT INTO users (username, email, password_hash, role, is_active, is_verified, created_at)
        VALUES (?, ?, ?, 'buyer', TRUE, TRUE, NOW())
      `, ['nyirabakundamarie', email, password]);
      
      console.log(`✅ Buyer account created: ${email}`);
      
    } catch (error) {
      if (!error.message.includes('Duplicate entry')) {
        throw error;
      }
      console.log(`✅ Buyer account ${email} already exists`);
    }
  }

  async createSellerAccount(connection) {
    const email = 'networkcouf@gmail.com';
    const password = await bcrypt.hash(email, 10);
    
    try {
      // Check if seller already exists
      const [existing] = await connection.execute('SELECT id FROM users WHERE email = ?', [email]);
      
      if (existing.length > 0) {
        console.log(`✅ Seller account ${email} already exists`);
        return;
      }

      // Create seller account
      await connection.execute(`
        INSERT INTO users (username, email, password_hash, role, is_active, is_verified, created_at)
        VALUES (?, ?, ?, 'seller', TRUE, TRUE, NOW())
      `, ['networkcouf', email, password]);
      
      console.log(`✅ Seller account created: ${email}`);
      
    } catch (error) {
      if (!error.message.includes('Duplicate entry')) {
        throw error;
      }
      console.log(`✅ Seller account ${email} already exists`);
    }
  }

  async createAgentAccounts(connection) {
    const agents = [
      { email: 'nayisabamj@gmail.com', username: 'nayisabamj', type: 'fast_delivery' },
      { email: 'nyiranzabonimpajosiane@gmail.com', username: 'nyiranzabonimpajosiane', type: 'pickup_delivery' },
      { email: 'consoleenzasangamariya@gmail.com', username: 'consoleenzasangamariya', type: 'pickup_site_manager' }
    ];

    for (const agent of agents) {
      try {
        const password = await bcrypt.hash(agent.email, 10);
        
        // Check if agent user already exists
        const [existingUser] = await connection.execute('SELECT id FROM users WHERE email = ?', [agent.email]);
        
        let userId;
        
        if (existingUser.length > 0) {
          userId = existingUser[0].id;
          console.log(`✅ Agent user ${agent.email} already exists`);
        } else {
          // Create agent user account
          const [userResult] = await connection.execute(`
            INSERT INTO users (username, email, password_hash, role, is_active, is_verified, created_at)
            VALUES (?, ?, ?, 'agent', TRUE, TRUE, NOW())
          `, [agent.username, agent.email, password]);
          
          userId = userResult.insertId;
          console.log(`✅ Agent user created: ${agent.email}`);
        }
        
        // Check if agent record exists
        const [existingAgent] = await connection.execute('SELECT id FROM agents WHERE user_id = ?', [userId]);
        
        if (existingAgent.length === 0) {
          // Create agent record
          await connection.execute(`
            INSERT INTO agents (user_id, agent_type, status, commission_rate, created_at)
            VALUES (?, ?, 'active', 0.70, NOW())
          `, [userId, agent.type]);
          
          console.log(`✅ Agent record created: ${agent.email} (${agent.type})`);
        } else {
          console.log(`✅ Agent record ${agent.email} already exists`);
        }
        
      } catch (error) {
        if (!error.message.includes('Duplicate entry')) {
          console.error(`❌ Failed to create agent ${agent.email}:`, error.message);
        } else {
          console.log(`✅ Agent ${agent.email} already exists`);
        }
      }
    }
  }

  async createTestProducts(connection) {
    try {
      // Get seller ID
      const [seller] = await connection.execute('SELECT id FROM users WHERE email = ?', ['networkcouf@gmail.com']);
      
      if (seller.length === 0) {
        console.log('⚠️ Seller not found, skipping product creation');
        return;
      }
      
      const sellerId = seller[0].id;

      // Check if test products already exist
      const [existingProducts] = await connection.execute('SELECT id FROM products WHERE seller_id = ? LIMIT 1', [sellerId]);
      
      if (existingProducts.length > 0) {
        console.log('✅ Test products already exist');
        return;
      }

      // Create test physical products
      const products = [
        {
          name: 'Test Smartphone',
          description: 'High-quality smartphone for testing E2E flow',
          price: 299.99,
          category: 'Electronics'
        },
        {
          name: 'Test Laptop',
          description: 'Powerful laptop for development and testing',
          price: 899.99,
          category: 'Electronics'
        },
        {
          name: 'Test Headphones',
          description: 'Premium wireless headphones',
          price: 149.99,
          category: 'Electronics'
        }
      ];

      for (const product of products) {
        await connection.execute(`
          INSERT INTO products (seller_id, name, description, price, category, status, stock_quantity, created_at)
          VALUES (?, ?, ?, ?, ?, 'active', 10, NOW())
        `, [sellerId, product.name, product.description, product.price, product.category]);
      }
      
      console.log(`✅ Created ${products.length} test products for seller`);
      
    } catch (error) {
      console.error('❌ Failed to create test products:', error.message);
    }
  }

  async setupPaymentSettings(connection) {
    try {
      // Set up manual payment mode by default
      const settings = [
        ['manual_payment_enabled', 'true'],
        ['escrow_payment_enabled', 'false'],
        ['add_mobile_number', '+250788123456'],
        ['add_momo_code', 'ADD2024'],
        ['platform_commission_rate', '0.21'],
        ['fast_delivery_agent_rate', '0.70'],
        ['pickup_agent_rate', '0.25']
      ];

      for (const [key, value] of settings) {
        await connection.execute(`
          INSERT INTO platform_settings (setting_key, setting_value, created_at)
          VALUES (?, ?, NOW())
          ON DUPLICATE KEY UPDATE 
          setting_value = VALUES(setting_value),
          updated_at = NOW()
        `, [key, value]);
      }
      
      console.log('✅ Payment settings configured for manual mode');
      
    } catch (error) {
      console.error('❌ Failed to setup payment settings:', error.message);
    }
  }
}

// Run the setup
const setup = new E2ETestAccountSetup();

setup.setup().then(() => {
  console.log('\n🎉 E2E test accounts ready!');
  console.log('\n📋 Test Accounts Created:');
  console.log('👤 Buyer: nyirabakundamarie@gmail.com / nyirabakundamarie@gmail.com');
  console.log('🏪 Seller: networkcouf@gmail.com / networkcouf@gmail.com');
  console.log('🚚 Fast Delivery Agent: nayisabamj@gmail.com / nayisabamj@gmail.com');
  console.log('📦 Pickup Delivery Agent: nyiranzabonimpajosiane@gmail.com / nyiranzabonimpajosiane@gmail.com');
  console.log('🏢 Pickup Site Manager: consoleenzasangamariya@gmail.com / consoleenzasangamariya@gmail.com');
  console.log('👨‍💼 Admin: admin@addphysicalproducts.com / admin123');
  
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 Setup failed:', error);
  process.exit(1);
});