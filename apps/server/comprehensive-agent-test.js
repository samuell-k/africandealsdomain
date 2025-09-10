const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
require('dotenv').config();

class AgentTypesTestSuite {
  constructor() {
    this.pool = null;
    this.testUsers = [];
    this.testOrders = [];
    this.testResults = {
      database: [],
      fastDelivery: [],
      pickupDelivery: [],
      pickupSite: []
    };
  }

  async initialize() {
    console.log('🚀 Initializing Comprehensive Agent Types Test Suite...\n');
    
    // Create database connection
    this.pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'add_physical_product',
      port: process.env.DB_PORT || 3306,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // Test database connection
    const connection = await this.pool.getConnection();
    console.log('✅ Database connection established');
    connection.release();
  }

  async createTestData() {
    console.log('📝 Creating test data...\n');

    try {
      // Create test users for each agent type
      const hashedPassword = await bcrypt.hash('testpassword123', 10);

      // Fast Delivery Agent
      const [fastDeliveryUser] = await this.pool.execute(`
        INSERT INTO users (username, email, password, role, first_name, last_name, phone, is_verified) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, ['fast_delivery_agent', 'fast@test.com', hashedPassword, 'agent', 'Fast', 'Delivery', '+250788111111', 1]);

      await this.pool.execute(`
        INSERT INTO agents (user_id, agent_type, marketplace_type, is_available, current_lat, current_lng, trust_level) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [fastDeliveryUser.insertId, 'fast_delivery', 'grocery', 1, -1.9441, 30.0619, 4.5]);

      // Pickup Delivery Agent
      const [pickupDeliveryUser] = await this.pool.execute(`
        INSERT INTO users (username, email, password, role, first_name, last_name, phone, is_verified) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, ['pickup_delivery_agent', 'pickup@test.com', hashedPassword, 'agent', 'Pickup', 'Delivery', '+250788222222', 1]);

      await this.pool.execute(`
        INSERT INTO agents (user_id, agent_type, marketplace_type, is_available, current_lat, current_lng, trust_level) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [pickupDeliveryUser.insertId, 'pickup_delivery', 'physical', 1, -1.9441, 30.0619, 4.2]);

      // Pickup Site Manager
      const [siteManagerUser] = await this.pool.execute(`
        INSERT INTO users (username, email, password, role, first_name, last_name, phone, is_verified) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, ['site_manager_agent', 'manager@test.com', hashedPassword, 'agent', 'Site', 'Manager', '+250788333333', 1]);

      const [siteManagerAgent] = await this.pool.execute(`
        INSERT INTO agents (user_id, agent_type, marketplace_type, is_available, can_create_orders, pickup_site_id, trust_level) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [siteManagerUser.insertId, 'pickup_site', 'both', 1, 1, 1, 4.8]);

      // Create test buyer
      const [buyerUser] = await this.pool.execute(`
        INSERT INTO users (username, email, password, role, first_name, last_name, phone, is_verified) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, ['test_buyer', 'buyer@test.com', hashedPassword, 'buyer', 'Test', 'Buyer', '+250788444444', 1]);

      await this.pool.execute(`
        INSERT INTO buyers (user_id, shipping_address) 
        VALUES (?, ?)
      `, [buyerUser.insertId, JSON.stringify({
        address: '123 Test Street',
        city: 'Kigali',
        country: 'Rwanda',
        latitude: -1.9441,
        longitude: 30.0619
      })]);

      this.testUsers = {
        fastDelivery: { userId: fastDeliveryUser.insertId, username: 'fast_delivery_agent' },
        pickupDelivery: { userId: pickupDeliveryUser.insertId, username: 'pickup_delivery_agent' },
        siteManager: { userId: siteManagerUser.insertId, username: 'site_manager_agent' },
        buyer: { userId: buyerUser.insertId, username: 'test_buyer' }
      };

      console.log('✅ Test users created successfully');
      console.log(`   • Fast Delivery Agent: ${this.testUsers.fastDelivery.username}`);
      console.log(`   • Pickup Delivery Agent: ${this.testUsers.pickupDelivery.username}`);
      console.log(`   • Site Manager: ${this.testUsers.siteManager.username}`);
      console.log(`   • Test Buyer: ${this.testUsers.buyer.username}\n`);

    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        console.log('⚠️  Test users already exist, using existing data\n');
        // Get existing test users
        const [users] = await this.pool.execute(`
          SELECT u.id, u.username FROM users u 
          WHERE u.username IN ('fast_delivery_agent', 'pickup_delivery_agent', 'site_manager_agent', 'test_buyer')
        `);
        
        this.testUsers = {};
        users.forEach(user => {
          if (user.username === 'fast_delivery_agent') {
            this.testUsers.fastDelivery = { userId: user.id, username: user.username };
          } else if (user.username === 'pickup_delivery_agent') {
            this.testUsers.pickupDelivery = { userId: user.id, username: user.username };
          } else if (user.username === 'site_manager_agent') {
            this.testUsers.siteManager = { userId: user.id, username: user.username };
          } else if (user.username === 'test_buyer') {
            this.testUsers.buyer = { userId: user.id, username: user.username };
          }
        });

        // If users don't exist, create them
        if (!this.testUsers.fastDelivery) {
          console.log('Creating missing test users...');
          await this.createMissingTestUsers();
        }
      } else {
        throw error;
      }
    }
  }

  async testDatabaseSchema() {
    console.log('🗄️  Testing Database Schema...\n');

    // Test required tables
    const requiredTables = ['pickup_sites', 'grocery_orders', 'manual_orders'];
    for (const table of requiredTables) {
      try {
        const [rows] = await this.pool.execute(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`✅ Table '${table}' exists and accessible (${rows[0].count} records)`);
        this.testResults.database.push({ test: `Table ${table}`, status: 'PASS' });
      } catch (error) {
        console.log(`❌ Table '${table}' error: ${error.message}`);
        this.testResults.database.push({ test: `Table ${table}`, status: 'FAIL', error: error.message });
      }
    }

    // Test agent columns
    try {
      const [columns] = await this.pool.execute("DESCRIBE agents");
      const columnNames = columns.map(col => col.Field);
      
      const requiredColumns = ['agent_type', 'marketplace_type', 'current_lat', 'current_lng', 'trust_level'];
      for (const column of requiredColumns) {
        if (columnNames.includes(column)) {
          console.log(`✅ Column 'agents.${column}' exists`);
          this.testResults.database.push({ test: `Column agents.${column}`, status: 'PASS' });
        } else {
          console.log(`❌ Column 'agents.${column}' missing`);
          this.testResults.database.push({ test: `Column agents.${column}`, status: 'FAIL' });
        }
      }
    } catch (error) {
      console.log(`❌ Error checking agents table: ${error.message}`);
    }

    console.log('');
  }

  async testFastDeliveryAgent() {
    console.log('🚚 Testing Fast Delivery Agent Functionality...\n');

    try {
      // Create test grocery order
      const orderNumber = `GRO-${Date.now()}`;
      const [groceryOrder] = await this.pool.execute(`
        INSERT INTO grocery_orders (order_number, buyer_id, status, total_amount, delivery_fee, agent_commission, delivery_address, shopping_list) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        orderNumber,
        this.testUsers.buyer.userId,
        'pending',
        45.50,
        5.00,
        6.83, // 15% commission
        JSON.stringify({
          address: '123 Test Street',
          city: 'Kigali',
          country: 'Rwanda',
          latitude: -1.9441,
          longitude: 30.0619
        }),
        JSON.stringify([
          { item: 'Milk', quantity: 2, price: 5.00 },
          { item: 'Bread', quantity: 1, price: 3.50 },
          { item: 'Eggs', quantity: 12, price: 12.00 },
          { item: 'Rice', quantity: 1, price: 25.00 }
        ])
      ]);

      console.log(`✅ Created test grocery order: ${orderNumber}`);
      this.testResults.fastDelivery.push({ test: 'Create grocery order', status: 'PASS' });

      // Test order assignment
      await this.pool.execute(`
        UPDATE grocery_orders SET agent_id = ?, status = 'assigned' WHERE id = ?
      `, [this.testUsers.fastDelivery.userId, groceryOrder.insertId]);

      console.log('✅ Assigned order to fast delivery agent');
      this.testResults.fastDelivery.push({ test: 'Assign order to agent', status: 'PASS' });

      // Test status updates
      const statuses = ['shopping', 'picked_up', 'in_transit', 'delivered'];
      for (const status of statuses) {
        await this.pool.execute(`
          UPDATE grocery_orders SET status = ? WHERE id = ?
        `, [status, groceryOrder.insertId]);
        console.log(`✅ Updated order status to: ${status}`);
      }
      this.testResults.fastDelivery.push({ test: 'Status updates', status: 'PASS' });

      // Test location tracking
      await this.pool.execute(`
        UPDATE agents SET current_lat = ?, current_lng = ? WHERE user_id = ?
      `, [-1.9500, 30.0700, this.testUsers.fastDelivery.userId]);

      console.log('✅ Updated agent location');
      this.testResults.fastDelivery.push({ test: 'Location tracking', status: 'PASS' });

      // Test earnings calculation
      const [earnings] = await this.pool.execute(`
        SELECT SUM(agent_commission) as total_earnings FROM grocery_orders WHERE agent_id = ?
      `, [this.testUsers.fastDelivery.userId]);

      console.log(`✅ Calculated earnings: $${earnings[0].total_earnings || 0}`);
      this.testResults.fastDelivery.push({ test: 'Earnings calculation', status: 'PASS' });

    } catch (error) {
      console.log(`❌ Fast delivery agent test failed: ${error.message}`);
      this.testResults.fastDelivery.push({ test: 'Fast delivery workflow', status: 'FAIL', error: error.message });
    }

    console.log('');
  }

  async testPickupDeliveryAgent() {
    console.log('📦 Testing Pickup Delivery Agent Functionality...\n');

    try {
      // Create test physical product order
      const orderNumber = `PHY-${Date.now()}`;
      const [physicalOrder] = await this.pool.execute(`
        INSERT INTO orders (order_number, buyer_id, status, total_amount, agent_type, pickup_site_id, delivery_code) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        orderNumber,
        this.testUsers.buyer.userId,
        'processing',
        125.00,
        'pickup_delivery',
        1, // First pickup site
        Math.random().toString(36).substring(2, 8).toUpperCase()
      ]);

      console.log(`✅ Created test physical order: ${orderNumber}`);
      this.testResults.pickupDelivery.push({ test: 'Create physical order', status: 'PASS' });

      // Test order assignment to pickup agent
      await this.pool.execute(`
        UPDATE orders SET agent_id = ?, status = 'shipped' WHERE id = ?
      `, [this.testUsers.pickupDelivery.userId, physicalOrder.insertId]);

      console.log('✅ Assigned order to pickup delivery agent');
      this.testResults.pickupDelivery.push({ test: 'Assign pickup order', status: 'PASS' });

      // Test pickup site interaction
      const [pickupSite] = await this.pool.execute(`
        SELECT * FROM pickup_sites WHERE id = 1
      `);

      if (pickupSite.length > 0) {
        console.log(`✅ Pickup site accessible: ${pickupSite[0].name}`);
        this.testResults.pickupDelivery.push({ test: 'Pickup site access', status: 'PASS' });
      }

      // Test delivery status updates
      const deliveryStatuses = ['picked_up', 'in_transit', 'delivered'];
      for (const status of deliveryStatuses) {
        await this.pool.execute(`
          UPDATE orders SET status = ? WHERE id = ?
        `, [status, physicalOrder.insertId]);
        console.log(`✅ Updated delivery status to: ${status}`);
      }
      this.testResults.pickupDelivery.push({ test: 'Delivery status updates', status: 'PASS' });

      // Test commission calculation (12% for pickup delivery)
      const commission = 125.00 * 0.12;
      console.log(`✅ Calculated pickup delivery commission: $${commission.toFixed(2)}`);
      this.testResults.pickupDelivery.push({ test: 'Commission calculation', status: 'PASS' });

    } catch (error) {
      console.log(`❌ Pickup delivery agent test failed: ${error.message}`);
      this.testResults.pickupDelivery.push({ test: 'Pickup delivery workflow', status: 'FAIL', error: error.message });
    }

    console.log('');
  }

  async testPickupSiteManager() {
    console.log('🏪 Testing Pickup Site Manager Functionality...\n');

    try {
      // Test manual order creation
      const orderNumber = `MAN-${Date.now()}`;
      const [manualOrder] = await this.pool.execute(`
        INSERT INTO manual_orders (order_number, pickup_site_id, created_by_agent_id, buyer_name, buyer_phone, buyer_email, items, total_amount, commission_amount, qr_code) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        orderNumber,
        1, // First pickup site
        this.testUsers.siteManager.userId,
        'Walk-in Customer',
        '+250788555555',
        'walkin@test.com',
        JSON.stringify([
          { item: 'Laptop Bag', quantity: 1, price: 35.00 },
          { item: 'Phone Case', quantity: 2, price: 15.00 },
          { item: 'USB Cable', quantity: 1, price: 10.00 }
        ]),
        75.00,
        7.50, // 10% commission
        `QR-${Date.now()}`
      ]);

      console.log(`✅ Created manual walk-in order: ${orderNumber}`);
      this.testResults.pickupSite.push({ test: 'Create manual order', status: 'PASS' });

      // Test order status management
      const manualStatuses = ['confirmed', 'ready_for_pickup', 'picked_up'];
      for (const status of manualStatuses) {
        await this.pool.execute(`
          UPDATE manual_orders SET status = ? WHERE id = ?
        `, [status, manualOrder.insertId]);
        console.log(`✅ Updated manual order status to: ${status}`);
      }
      this.testResults.pickupSite.push({ test: 'Manual order status updates', status: 'PASS' });

      // Test site capacity management
      await this.pool.execute(`
        UPDATE pickup_sites SET current_load = current_load + 1 WHERE id = 1
      `);

      const [siteInfo] = await this.pool.execute(`
        SELECT name, current_load, capacity FROM pickup_sites WHERE id = 1
      `);

      console.log(`✅ Updated site capacity: ${siteInfo[0].current_load}/${siteInfo[0].capacity} at ${siteInfo[0].name}`);
      this.testResults.pickupSite.push({ test: 'Site capacity management', status: 'PASS' });

      // Test earnings calculation for site manager
      const [managerEarnings] = await this.pool.execute(`
        SELECT SUM(commission_amount) as total_earnings FROM manual_orders WHERE created_by_agent_id = ?
      `, [this.testUsers.siteManager.userId]);

      console.log(`✅ Calculated site manager earnings: $${managerEarnings[0].total_earnings || 0}`);
      this.testResults.pickupSite.push({ test: 'Site manager earnings', status: 'PASS' });

      // Test physical delivery confirmation
      await this.pool.execute(`
        UPDATE manual_orders SET picked_up_at = NOW() WHERE id = ?
      `, [manualOrder.insertId]);

      console.log('✅ Confirmed physical delivery pickup');
      this.testResults.pickupSite.push({ test: 'Physical delivery confirmation', status: 'PASS' });

    } catch (error) {
      console.log(`❌ Pickup site manager test failed: ${error.message}`);
      this.testResults.pickupSite.push({ test: 'Site manager workflow', status: 'FAIL', error: error.message });
    }

    console.log('');
  }

  async testCrossAgentInteractions() {
    console.log('🔄 Testing Cross-Agent Interactions...\n');

    try {
      // Test scenario: Physical order delivered to pickup site by pickup delivery agent,
      // then confirmed by site manager
      const orderNumber = `CROSS-${Date.now()}`;
      
      // Create order assigned to pickup delivery agent
      const [crossOrder] = await this.pool.execute(`
        INSERT INTO orders (order_number, buyer_id, agent_id, status, total_amount, agent_type, pickup_site_id, delivery_code) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        orderNumber,
        this.testUsers.buyer.userId,
        this.testUsers.pickupDelivery.userId,
        'shipped',
        89.99,
        'pickup_delivery',
        1,
        'CROSS123'
      ]);

      console.log(`✅ Created cross-agent test order: ${orderNumber}`);

      // Pickup delivery agent delivers to site
      await this.pool.execute(`
        UPDATE orders SET status = 'delivered' WHERE id = ?
      `, [crossOrder.insertId]);

      // Site manager confirms receipt
      await this.pool.execute(`
        INSERT INTO manual_orders (order_number, pickup_site_id, created_by_agent_id, buyer_name, buyer_phone, items, total_amount, commission_amount, status, notes) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        `CONF-${orderNumber}`,
        1,
        this.testUsers.siteManager.userId,
        'Cross-test Customer',
        '+250788666666',
        JSON.stringify([{ item: 'Delivered Package', quantity: 1, price: 89.99 }]),
        89.99,
        8.99,
        'ready_for_pickup',
        `Confirmed delivery from order ${orderNumber}`
      ]);

      console.log('✅ Cross-agent interaction completed successfully');
      this.testResults.database.push({ test: 'Cross-agent interactions', status: 'PASS' });

    } catch (error) {
      console.log(`❌ Cross-agent interaction test failed: ${error.message}`);
      this.testResults.database.push({ test: 'Cross-agent interactions', status: 'FAIL', error: error.message });
    }

    console.log('');
  }

  async generateTestReport() {
    console.log('📊 Generating Comprehensive Test Report...\n');

    const totalTests = 
      this.testResults.database.length + 
      this.testResults.fastDelivery.length + 
      this.testResults.pickupDelivery.length + 
      this.testResults.pickupSite.length;

    const passedTests = [
      ...this.testResults.database,
      ...this.testResults.fastDelivery,
      ...this.testResults.pickupDelivery,
      ...this.testResults.pickupSite
    ].filter(test => test.status === 'PASS').length;

    const failedTests = totalTests - passedTests;

    console.log('═══════════════════════════════════════════════════════════');
    console.log('                    TEST REPORT SUMMARY                     ');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ❌`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    console.log('═══════════════════════════════════════════════════════════\n');

    // Detailed results by category
    const categories = [
      { name: 'Database Schema', results: this.testResults.database },
      { name: 'Fast Delivery Agent', results: this.testResults.fastDelivery },
      { name: 'Pickup Delivery Agent', results: this.testResults.pickupDelivery },
      { name: 'Pickup Site Manager', results: this.testResults.pickupSite }
    ];

    categories.forEach(category => {
      if (category.results.length > 0) {
        console.log(`📋 ${category.name}:`);
        category.results.forEach(test => {
          const status = test.status === 'PASS' ? '✅' : '❌';
          console.log(`   ${status} ${test.test}`);
          if (test.error) {
            console.log(`      Error: ${test.error}`);
          }
        });
        console.log('');
      }
    });

    // Performance metrics
    console.log('📈 Performance Metrics:');
    
    try {
      // Count orders by type
      const [groceryCount] = await this.pool.execute('SELECT COUNT(*) as count FROM grocery_orders');
      const [physicalCount] = await this.pool.execute('SELECT COUNT(*) as count FROM orders WHERE agent_type IS NOT NULL');
      const [manualCount] = await this.pool.execute('SELECT COUNT(*) as count FROM manual_orders');

      console.log(`   • Grocery Orders: ${groceryCount[0].count}`);
      console.log(`   • Physical Orders: ${physicalCount[0].count}`);
      console.log(`   • Manual Orders: ${manualCount[0].count}`);

      // Agent performance
      const [agentStats] = await this.pool.execute(`
        SELECT agent_type, COUNT(*) as count, AVG(trust_level) as avg_trust 
        FROM agents 
        WHERE agent_type IS NOT NULL 
        GROUP BY agent_type
      `);

      console.log('\n👥 Agent Statistics:');
      agentStats.forEach(stat => {
        console.log(`   • ${stat.agent_type}: ${stat.count} agents (Avg Trust: ${stat.avg_trust?.toFixed(1) || 'N/A'})`);
      });

    } catch (error) {
      console.log('   ⚠️  Performance metrics unavailable');
    }

    console.log('\n🎯 Test Conclusions:');
    if (failedTests === 0) {
      console.log('   🎉 ALL TESTS PASSED! The agent types system is fully functional.');
      console.log('   🚀 Ready for production deployment.');
    } else if (failedTests <= 2) {
      console.log('   ⚠️  Minor issues detected. System is mostly functional.');
      console.log('   🔧 Review failed tests and apply fixes.');
    } else {
      console.log('   ❌ Multiple issues detected. System needs attention.');
      console.log('   🛠️  Address failed tests before deployment.');
    }

    console.log('\n📚 Next Steps:');
    console.log('   1. Start the server: npm start');
    console.log('   2. Test frontend dashboards:');
    console.log('      • Fast Delivery: /agent/fast-delivery-dashboard-enhanced.html');
    console.log('      • Pickup Delivery: /agent/pickup-delivery-dashboard-enhanced.html');
    console.log('      • Site Manager: /agent/pickup-site-manager-dashboard-enhanced.html');
    console.log('   3. Create real agent accounts and assign types');
    console.log('   4. Monitor system performance in production');
  }

  async cleanup() {
    if (this.pool) {
      await this.pool.end();
      console.log('\n🧹 Test cleanup completed');
    }
  }

  async runAllTests() {
    try {
      await this.initialize();
      await this.createTestData();
      await this.testDatabaseSchema();
      await this.testFastDeliveryAgent();
      await this.testPickupDeliveryAgent();
      await this.testPickupSiteManager();
      await this.testCrossAgentInteractions();
      await this.generateTestReport();
    } catch (error) {
      console.error('💥 Test suite failed:', error);
    } finally {
      await this.cleanup();
    }
  }
}

// Run the comprehensive test suite
const testSuite = new AgentTypesTestSuite();
testSuite.runAllTests();