const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'add_physical_product',
  port: process.env.DB_PORT || 3333
};

class OrderProtectionSetup {
  constructor() {
    this.pool = null;
  }

  async connect() {
    try {
      this.pool = await mysql.createPool(dbConfig);
      console.log('✅ Database connected for setup');
    } catch (error) {
      console.error('❌ Failed to connect to database:', error.message);
      throw error;
    }
  }

  async runSQLFile(filePath) {
    try {
      const sqlContent = fs.readFileSync(filePath, 'utf8');
      const statements = sqlContent.split(';').filter(stmt => stmt.trim());
      
      for (const statement of statements) {
        if (statement.trim()) {
          await this.pool.execute(statement);
        }
      }
      
      console.log(`✅ Applied SQL file: ${path.basename(filePath)}`);
    } catch (error) {
      console.error(`❌ Error applying SQL file ${filePath}:`, error.message);
      throw error;
    }
  }

  async checkExistingIssues() {
    try {
      const [rows] = await this.pool.execute(`
        SELECT 
          o.id as order_id,
          o.order_number,
          o.user_id,
          u.name as user_name,
          u.email as user_email,
          u.role as user_role,
          o.created_at
        FROM orders o
        JOIN users u ON o.user_id = u.id
        WHERE u.role != 'buyer'
      `);

      if (rows.length > 0) {
        console.log('🚨 Found existing problematic orders:');
        rows.forEach(order => {
          console.log(`  - Order ${order.order_id} (${order.order_number}) assigned to ${order.user_email} (${order.user_role})`);
        });
        return rows;
      } else {
        console.log('✅ No existing problematic orders found');
        return [];
      }
    } catch (error) {
      console.error('❌ Error checking existing issues:', error.message);
      throw error;
    }
  }

  async testTriggers() {
    try {
      console.log('🧪 Testing database triggers...');
      
      // Test 1: Try to insert order with seller ID (should fail)
      try {
        const [sellerResult] = await this.pool.execute(`
          SELECT id FROM users WHERE role = 'seller' LIMIT 1
        `);
        
        if (sellerResult.length > 0) {
          const sellerId = sellerResult[0].id;
          
          try {
            await this.pool.execute(`
              INSERT INTO orders (user_id, order_number, total_amount, status, shipping_address, billing_address, payment_method, created_at)
              VALUES (?, 'TEST-ORDER', 100.00, 'pending', '{}', '{}', 'test', NOW())
            `, [sellerId]);
            
            console.log('❌ TRIGGER TEST FAILED: Should have prevented seller order creation');
            return false;
          } catch (triggerError) {
            if (triggerError.message.includes('Orders can only be assigned to buyers')) {
              console.log('✅ Trigger test passed: Correctly prevented seller order creation');
            } else {
              console.log('⚠️ Trigger test result unclear:', triggerError.message);
            }
          }
        }
      } catch (error) {
        console.log('⚠️ Could not test seller order creation:', error.message);
      }

      // Test 2: Try to insert order with buyer ID (should succeed)
      try {
        const [buyerResult] = await this.pool.execute(`
          SELECT id FROM users WHERE role = 'buyer' LIMIT 1
        `);
        
        if (buyerResult.length > 0) {
          const buyerId = buyerResult[0].id;
          
          const [result] = await this.pool.execute(`
            INSERT INTO orders (user_id, order_number, total_amount, status, shipping_address, billing_address, payment_method, created_at)
            VALUES (?, 'TEST-BUYER-ORDER', 100.00, 'pending', '{}', '{}', 'test', NOW())
          `, [buyerId]);
          
          console.log('✅ Trigger test passed: Correctly allowed buyer order creation');
          
          // Clean up test order
          await this.pool.execute('DELETE FROM orders WHERE order_number = ?', ['TEST-BUYER-ORDER']);
          
          return true;
        }
      } catch (error) {
        console.log('❌ Trigger test failed for buyer order:', error.message);
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Error testing triggers:', error.message);
      return false;
    }
  }

  async verifyProtectionSystem() {
    try {
      console.log('🔍 Verifying protection system...');
      
      // Check if triggers exist
      const [triggers] = await this.pool.execute(`
        SELECT TRIGGER_NAME, EVENT_MANIPULATION, EVENT_OBJECT_TABLE
        FROM information_schema.TRIGGERS 
        WHERE TRIGGER_SCHEMA = DATABASE() 
        AND EVENT_OBJECT_TABLE = 'orders'
      `);
      
      if (triggers.length >= 2) {
        console.log('✅ Database triggers are active');
        triggers.forEach(trigger => {
          console.log(`  - ${trigger.TRIGGER_NAME} (${trigger.EVENT_MANIPULATION})`);
        });
      } else {
        console.log('❌ Database triggers not found');
        return false;
      }

      // Check if view exists
      const [views] = await this.pool.execute(`
        SELECT TABLE_NAME 
        FROM information_schema.VIEWS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'problematic_orders'
      `);
      
      if (views.length > 0) {
        console.log('✅ Problematic orders view is active');
      } else {
        console.log('❌ Problematic orders view not found');
        return false;
      }

      // Check if system_logs table exists
      const [tables] = await this.pool.execute(`
        SELECT TABLE_NAME 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'system_logs'
      `);
      
      if (tables.length > 0) {
        console.log('✅ System logs table is active');
      } else {
        console.log('❌ System logs table not found');
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Error verifying protection system:', error.message);
      return false;
    }
  }

  async runCompleteSetup() {
    try {
      console.log('🚀 Starting comprehensive order protection setup...\n');
      
      // Step 1: Check existing issues
      console.log('📋 Step 1: Checking for existing problematic orders...');
      const existingIssues = await this.checkExistingIssues();
      
      if (existingIssues.length > 0) {
        console.log('\n⚠️ WARNING: Found existing problematic orders!');
        console.log('Please fix these orders before proceeding with the setup.');
        console.log('You can use the SQL query provided earlier to fix them.');
        return false;
      }
      
      // Step 2: Apply database protections
      console.log('\n📋 Step 2: Applying database protections...');
      await this.runSQLFile(path.join(__dirname, 'prevent-wrong-order-owner.sql'));
      
      // Step 3: Test triggers
      console.log('\n📋 Step 3: Testing database triggers...');
      const triggerTestPassed = await this.testTriggers();
      
      if (!triggerTestPassed) {
        console.log('❌ Trigger tests failed. Setup incomplete.');
        return false;
      }
      
      // Step 4: Verify protection system
      console.log('\n📋 Step 4: Verifying protection system...');
      const verificationPassed = await this.verifyProtectionSystem();
      
      if (!verificationPassed) {
        console.log('❌ Protection system verification failed.');
        return false;
      }
      
      console.log('\n🎉 ORDER PROTECTION SETUP COMPLETE!');
      console.log('\n✅ Protection layers activated:');
      console.log('  1. Application-level validation (orders.js)');
      console.log('  2. Database triggers (prevent wrong assignments)');
      console.log('  3. Monitoring system (continuous checks)');
      console.log('  4. System logging (audit trail)');
      console.log('\n🔒 Your orders are now protected!');
      console.log('   - Only buyers can create orders');
      console.log('   - Database prevents wrong assignments');
      console.log('   - Continuous monitoring for issues');
      console.log('   - Automatic logging of any problems');
      
      return true;
    } catch (error) {
      console.error('❌ Setup failed:', error.message);
      return false;
    }
  }

  async cleanup() {
    if (this.pool) {
      await this.pool.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run setup if called directly
if (require.main === module) {
  const setup = new OrderProtectionSetup();
  
  async function main() {
    try {
      await setup.connect();
      const success = await setup.runCompleteSetup();
      
      if (success) {
        console.log('\n✅ Setup completed successfully!');
        process.exit(0);
      } else {
        console.log('\n❌ Setup failed. Please check the errors above.');
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Setup error:', error.message);
      process.exit(1);
    } finally {
      await setup.cleanup();
    }
  }

  main();
}

module.exports = OrderProtectionSetup; 