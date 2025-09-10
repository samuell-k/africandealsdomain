/**
 * Fast Delivery System Verification
 * Checks if the Fast Delivery Agent system is properly integrated and working
 */

const pool = require('./db');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const BASE_URL = 'http://localhost:3001';

class FastDeliverySystemVerification {
  constructor() {
    this.testResults = [];
  }

  log(message, status = 'INFO') {
    const timestamp = new Date().toISOString();
    const statusIcon = {
      'INFO': 'ℹ️',
      'SUCCESS': '✅',
      'ERROR': '❌',
      'WARNING': '⚠️'
    };
    
    console.log(`${statusIcon[status]} [${timestamp}] ${message}`);
    this.testResults.push({ timestamp, status, message });
  }

  async makeRequest(endpoint, options = {}, token = null) {
    const url = `${BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      const data = await response.json();
      return { response, data, success: response.ok };
    } catch (error) {
      return { response: null, data: { error: error.message }, success: false };
    }
  }

  async checkDatabaseTables() {
    this.log('Checking database tables...', 'INFO');

    try {
      // Check if required tables exist
      const requiredTables = [
        'users',
        'agents', 
        'grocery_orders',
        'grocery_order_items',
        'products',
        'categories'
      ];

      for (const table of requiredTables) {
        const [rows] = await pool.query(`SHOW TABLES LIKE '${table}'`);
        if (rows.length === 0) {
          this.log(`Missing required table: ${table}`, 'ERROR');
          return false;
        }
      }

      this.log('All required database tables exist', 'SUCCESS');

      // Check if grocery_orders has required columns for fast delivery
      const [columns] = await pool.query('DESCRIBE grocery_orders');
      const columnNames = columns.map(col => col.Field);
      
      const requiredColumns = [
        'agent_id',
        'delivery_code',
        'agent_assigned_at',
        'actual_pickup_time',
        'actual_delivery_time'
      ];

      const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));
      
      if (missingColumns.length > 0) {
        this.log(`Missing columns in grocery_orders: ${missingColumns.join(', ')}`, 'WARNING');
        this.log('Some features may not work properly', 'WARNING');
      } else {
        this.log('All required columns exist in grocery_orders table', 'SUCCESS');
      }

      return true;
    } catch (error) {
      this.log(`Database check failed: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async checkFastDeliveryRoute() {
    this.log('Checking fast delivery route registration...', 'INFO');

    try {
      // Try to access the route without authentication (should fail with 401)
      const { response, data } = await this.makeRequest('/api/fast-delivery-agent/profile');
      
      if (response && response.status === 401) {
        this.log('Fast delivery route is properly registered and protected', 'SUCCESS');
        return true;
      } else {
        this.log('Fast delivery route may not be properly configured', 'ERROR');
        return false;
      }
    } catch (error) {
      this.log(`Route check failed: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async checkExistingAgents() {
    this.log('Checking for existing fast delivery agents...', 'INFO');

    try {
      const [agents] = await pool.query(
        'SELECT COUNT(*) as count FROM agents WHERE agent_type = "fast_delivery"'
      );

      const agentCount = agents[0].count;
      
      if (agentCount > 0) {
        this.log(`Found ${agentCount} fast delivery agent(s) in database`, 'SUCCESS');
        
        // Get details of first agent
        const [agentDetails] = await pool.query(
          'SELECT a.*, u.email FROM agents a LEFT JOIN users u ON a.user_id = u.id WHERE a.agent_type = "fast_delivery" LIMIT 1'
        );
        
        if (agentDetails.length > 0) {
          const agent = agentDetails[0];
          this.log(`Sample agent: ID=${agent.id}, Email=${agent.email}, Status=${agent.status}`, 'INFO');
        }
        
        return true;
      } else {
        this.log('No fast delivery agents found in database', 'WARNING');
        this.log('You may need to create test agents or register new ones', 'INFO');
        return false;
      }
    } catch (error) {
      this.log(`Agent check failed: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async checkExistingOrders() {
    this.log('Checking for existing grocery orders...', 'INFO');

    try {
      const [orders] = await pool.query(
        'SELECT COUNT(*) as count FROM grocery_orders'
      );

      const orderCount = orders[0].count;
      
      if (orderCount > 0) {
        this.log(`Found ${orderCount} grocery order(s) in database`, 'SUCCESS');
        
        // Check for available orders (not assigned to agents)
        const [availableOrders] = await pool.query(
          'SELECT COUNT(*) as count FROM grocery_orders WHERE agent_id IS NULL AND status IN ("pending", "confirmed")'
        );
        
        const availableCount = availableOrders[0].count;
        this.log(`${availableCount} orders available for assignment`, 'INFO');
        
        return true;
      } else {
        this.log('No grocery orders found in database', 'WARNING');
        this.log('You may need to create test orders', 'INFO');
        return false;
      }
    } catch (error) {
      this.log(`Order check failed: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async testWithExistingAgent() {
    this.log('Testing API with existing agent...', 'INFO');

    try {
      // Get first fast delivery agent
      const [agents] = await pool.query(`
        SELECT a.*, u.id as user_id, u.email 
        FROM agents a 
        LEFT JOIN users u ON a.user_id = u.id 
        WHERE a.agent_type = "fast_delivery" 
        LIMIT 1
      `);

      if (agents.length === 0) {
        this.log('No fast delivery agents available for testing', 'WARNING');
        return false;
      }

      const agent = agents[0];
      
      // Generate token for the agent
      const token = jwt.sign(
        { id: agent.user_id, email: agent.email, role: 'agent' },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Test profile endpoint
      const { success: profileSuccess, data: profileData } = await this.makeRequest(
        '/api/fast-delivery-agent/profile',
        { method: 'GET' },
        token
      );

      if (profileSuccess) {
        this.log('Profile API endpoint working correctly', 'SUCCESS');
      } else {
        this.log(`Profile API failed: ${profileData.error}`, 'ERROR');
        return false;
      }

      // Test stats endpoint
      const { success: statsSuccess, data: statsData } = await this.makeRequest(
        '/api/fast-delivery-agent/stats',
        { method: 'GET' },
        token
      );

      if (statsSuccess) {
        this.log('Stats API endpoint working correctly', 'SUCCESS');
        this.log(`Agent stats: Today=${statsData.stats.today?.total || 0}, Active=${statsData.stats.active?.count || 0}`, 'INFO');
      } else {
        this.log(`Stats API failed: ${statsData.error}`, 'ERROR');
      }

      // Test available orders endpoint
      const { success: ordersSuccess, data: ordersData } = await this.makeRequest(
        '/api/fast-delivery-agent/available-orders',
        { method: 'GET' },
        token
      );

      if (ordersSuccess) {
        this.log('Available orders API endpoint working correctly', 'SUCCESS');
        this.log(`Available orders: ${ordersData.orders?.length || 0}`, 'INFO');
      } else {
        this.log(`Available orders API failed: ${ordersData.error}`, 'ERROR');
      }

      return true;
    } catch (error) {
      this.log(`API testing failed: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async checkFrontendFiles() {
    this.log('Checking frontend files...', 'INFO');

    const fs = require('fs');
    const path = require('path');

    try {
      const frontendPath = path.join(__dirname, '../client/agent/fast-delivery-agent-complete.html');
      
      if (fs.existsSync(frontendPath)) {
        this.log('Fast delivery agent frontend file exists', 'SUCCESS');
        
        // Check if file contains key functionality
        const content = fs.readFileSync(frontendPath, 'utf8');
        
        const requiredFeatures = [
          'FastDeliveryAgentDashboard',
          'loadAvailableOrders',
          'acceptOrder',
          'updateOrderStatus',
          'socket.io'
        ];

        const missingFeatures = requiredFeatures.filter(feature => !content.includes(feature));
        
        if (missingFeatures.length === 0) {
          this.log('All required frontend features are present', 'SUCCESS');
        } else {
          this.log(`Missing frontend features: ${missingFeatures.join(', ')}`, 'WARNING');
        }
        
        return true;
      } else {
        this.log('Fast delivery agent frontend file not found', 'ERROR');
        return false;
      }
    } catch (error) {
      this.log(`Frontend check failed: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async runVerification() {
    console.log('🔍 Fast Delivery System Verification');
    console.log('=' .repeat(60));

    const checks = [
      { name: 'Database Tables', fn: () => this.checkDatabaseTables() },
      { name: 'API Route Registration', fn: () => this.checkFastDeliveryRoute() },
      { name: 'Existing Agents', fn: () => this.checkExistingAgents() },
      { name: 'Existing Orders', fn: () => this.checkExistingOrders() },
      { name: 'API Functionality', fn: () => this.testWithExistingAgent() },
      { name: 'Frontend Files', fn: () => this.checkFrontendFiles() }
    ];

    let passedChecks = 0;
    let totalChecks = checks.length;

    for (const check of checks) {
      this.log(`\nRunning check: ${check.name}`, 'INFO');
      try {
        const result = await check.fn();
        if (result) {
          passedChecks++;
        }
      } catch (error) {
        this.log(`Check failed with error: ${error.message}`, 'ERROR');
      }
    }

    console.log('\n' + '=' .repeat(60));
    console.log(`📊 VERIFICATION RESULTS: ${passedChecks}/${totalChecks} checks passed`);

    if (passedChecks === totalChecks) {
      this.log('🎉 ALL CHECKS PASSED! Fast Delivery System is ready to use', 'SUCCESS');
      this.log('✅ Backend APIs are working', 'SUCCESS');
      this.log('✅ Database is properly configured', 'SUCCESS');
      this.log('✅ Frontend files are in place', 'SUCCESS');
      this.log('\n🚀 You can now access the Fast Delivery Agent dashboard at:', 'INFO');
      this.log('   http://localhost:3001/agent/fast-delivery-agent-complete.html', 'INFO');
    } else {
      this.log(`⚠️ ${totalChecks - passedChecks} checks failed. System may not work properly`, 'WARNING');
      
      if (passedChecks >= totalChecks * 0.7) {
        this.log('🔧 Most components are working. Minor issues detected', 'WARNING');
      } else {
        this.log('❌ Major issues detected. System needs attention', 'ERROR');
      }
    }

    // Provide recommendations
    console.log('\n📋 RECOMMENDATIONS:');
    
    if (passedChecks < totalChecks) {
      this.log('1. Run setup-local-market-test-data.js to create test data', 'INFO');
      this.log('2. Ensure the server is running on port 3001', 'INFO');
      this.log('3. Check database connection and credentials', 'INFO');
    }
    
    this.log('4. Create a fast delivery agent account to test the system', 'INFO');
    this.log('5. Create some grocery orders to test order assignment', 'INFO');

    return passedChecks === totalChecks;
  }
}

// Run verification
if (require.main === module) {
  const verification = new FastDeliverySystemVerification();
  verification.runVerification().then((success) => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('\n💥 Verification failed:', error);
    process.exit(1);
  });
}

module.exports = FastDeliverySystemVerification;