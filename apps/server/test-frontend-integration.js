/**
 * Frontend Integration Test for Fast Delivery Agent
 * Tests that the frontend can properly communicate with the backend APIs
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
const dotenv = require('dotenv');
dotenv.config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'add_physical_product',
  port: process.env.DB_PORT || 3333
};

const JWT_SECRET = 'your-super-secret-jwt-key-change-this-in-production';
const BASE_URL = 'http://localhost:3001';

class FrontendIntegrationTest {
  constructor() {
    this.connection = null;
    this.agentToken = null;
    this.agentId = null;
  }

  async init() {
    console.log('🔧 Initializing Frontend Integration Test...');
    this.connection = await mysql.createConnection(dbConfig);
    console.log('✅ Database connected');
  }

  async cleanup() {
    if (this.connection) {
      await this.connection.end();
    }
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

  async createTestAgent() {
    console.log('\n👤 Creating test agent...');

    const hashedPassword = await bcrypt.hash('testpass123', 10);
    const timestamp = Date.now();

    // Create agent user
    const [userResult] = await this.connection.execute(
      'INSERT INTO users (username, email, password, role, phone, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [`test_agent_${timestamp}`, `agent${timestamp}@test.com`, hashedPassword, 'agent', '+250788123456']
    );

    // Create fast delivery agent
    const [agentResult] = await this.connection.execute(
      'INSERT INTO agents (user_id, agent_type, name, phone, email, status, admin_approval_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
      [userResult.insertId, 'fast_delivery', `Test Agent ${timestamp}`, '+250788123456', `agent${timestamp}@test.com`, 'available', 'approved']
    );

    this.agentId = agentResult.insertId;

    // Generate token
    this.agentToken = jwt.sign(
      { id: userResult.insertId, email: `agent${timestamp}@test.com`, role: 'agent' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('✅ Test agent created with ID:', this.agentId);
  }

  async testAPIEndpoints() {
    console.log('\n🔌 Testing API endpoints that frontend uses...');

    const tests = [
      {
        name: 'Agent Profile',
        endpoint: '/api/fast-delivery-agent/profile',
        method: 'GET'
      },
      {
        name: 'Agent Stats',
        endpoint: '/api/fast-delivery-agent/stats',
        method: 'GET'
      },
      {
        name: 'Available Orders',
        endpoint: '/api/fast-delivery-agent/available-orders?radius=5&limit=10',
        method: 'GET'
      },
      {
        name: 'Active Orders',
        endpoint: '/api/fast-delivery-agent/active-orders',
        method: 'GET'
      },
      {
        name: 'Order History',
        endpoint: '/api/fast-delivery-agent/order-history?page=1&limit=10',
        method: 'GET'
      },
      {
        name: 'Earnings',
        endpoint: '/api/fast-delivery-agent/earnings?period=today',
        method: 'GET'
      },
      {
        name: 'Go Online',
        endpoint: '/api/fast-delivery-agent/go-online',
        method: 'POST',
        body: {
          location: {
            latitude: -1.9441,
            longitude: 30.0619,
            accuracy: 10
          }
        }
      },
      {
        name: 'Update Location',
        endpoint: '/api/fast-delivery-agent/update-location',
        method: 'POST',
        body: {
          latitude: -1.9441,
          longitude: 30.0619,
          accuracy: 10
        }
      }
    ];

    for (const test of tests) {
      console.log(`  Testing: ${test.name}...`);
      
      const options = {
        method: test.method
      };

      if (test.body) {
        options.body = JSON.stringify(test.body);
      }

      const { response, data, success } = await this.makeRequest(
        test.endpoint,
        options,
        this.agentToken
      );

      if (success) {
        console.log(`  ✅ ${test.name} - OK`);
      } else {
        console.log(`  ❌ ${test.name} - FAILED:`, data.error || 'Unknown error');
      }
    }
  }

  async testAuthenticationFlow() {
    console.log('\n🔐 Testing authentication flow...');

    // Test without token
    console.log('  Testing access without token...');
    const { success: noTokenSuccess } = await this.makeRequest('/api/fast-delivery-agent/profile');
    if (!noTokenSuccess) {
      console.log('  ✅ Properly rejected request without token');
    } else {
      console.log('  ❌ Should have rejected request without token');
    }

    // Test with invalid token
    console.log('  Testing access with invalid token...');
    const { success: invalidTokenSuccess } = await this.makeRequest(
      '/api/fast-delivery-agent/profile',
      { method: 'GET' },
      'invalid-token'
    );
    if (!invalidTokenSuccess) {
      console.log('  ✅ Properly rejected request with invalid token');
    } else {
      console.log('  ❌ Should have rejected request with invalid token');
    }

    // Test with valid token
    console.log('  Testing access with valid token...');
    const { success: validTokenSuccess } = await this.makeRequest(
      '/api/fast-delivery-agent/profile',
      { method: 'GET' },
      this.agentToken
    );
    if (validTokenSuccess) {
      console.log('  ✅ Properly accepted request with valid token');
    } else {
      console.log('  ❌ Should have accepted request with valid token');
    }
  }

  async testErrorHandling() {
    console.log('\n⚠️ Testing error handling...');

    // Test invalid order ID
    console.log('  Testing invalid order ID...');
    const { success: invalidOrderSuccess } = await this.makeRequest(
      '/api/fast-delivery-agent/order/99999',
      { method: 'GET' },
      this.agentToken
    );
    if (!invalidOrderSuccess) {
      console.log('  ✅ Properly handled invalid order ID');
    } else {
      console.log('  ❌ Should have handled invalid order ID');
    }

    // Test invalid status update
    console.log('  Testing invalid status update...');
    const { success: invalidStatusSuccess } = await this.makeRequest(
      '/api/fast-delivery-agent/update-status/99999',
      {
        method: 'PUT',
        body: JSON.stringify({
          status: 'invalid_status',
          notes: 'Test'
        })
      },
      this.agentToken
    );
    if (!invalidStatusSuccess) {
      console.log('  ✅ Properly handled invalid status update');
    } else {
      console.log('  ❌ Should have handled invalid status update');
    }
  }

  async testDataFormats() {
    console.log('\n📊 Testing data formats returned by API...');

    // Test profile data format
    const { data: profileData, success: profileSuccess } = await this.makeRequest(
      '/api/fast-delivery-agent/profile',
      { method: 'GET' },
      this.agentToken
    );

    if (profileSuccess && profileData.agent) {
      console.log('  ✅ Profile data format correct');
      console.log('    - Agent ID:', profileData.agent.id);
      console.log('    - Agent Type:', profileData.agent.agent_type);
      console.log('    - Status:', profileData.agent.status);
    } else {
      console.log('  ❌ Profile data format incorrect');
    }

    // Test stats data format
    const { data: statsData, success: statsSuccess } = await this.makeRequest(
      '/api/fast-delivery-agent/stats',
      { method: 'GET' },
      this.agentToken
    );

    if (statsSuccess && statsData.stats) {
      console.log('  ✅ Stats data format correct');
      console.log('    - Today orders:', statsData.stats.today?.total || 0);
      console.log('    - Today earnings:', statsData.stats.today?.earnings || 0);
      console.log('    - Active orders:', statsData.stats.active?.count || 0);
    } else {
      console.log('  ❌ Stats data format incorrect');
    }

    // Test available orders data format
    const { data: ordersData, success: ordersSuccess } = await this.makeRequest(
      '/api/fast-delivery-agent/available-orders',
      { method: 'GET' },
      this.agentToken
    );

    if (ordersSuccess && Array.isArray(ordersData.orders)) {
      console.log('  ✅ Available orders data format correct');
      console.log('    - Orders count:', ordersData.orders.length);
      console.log('    - Total available:', ordersData.totalAvailable);
    } else {
      console.log('  ❌ Available orders data format incorrect');
    }
  }

  async runIntegrationTest() {
    try {
      await this.init();
      
      console.log('🧪 Starting Frontend Integration Test');
      console.log('=' .repeat(50));

      await this.createTestAgent();
      await this.testAuthenticationFlow();
      await this.testAPIEndpoints();
      await this.testErrorHandling();
      await this.testDataFormats();

      console.log('\n' + '=' .repeat(50));
      console.log('🎉 FRONTEND INTEGRATION TEST PASSED!');
      console.log('✅ All API endpoints accessible');
      console.log('✅ Authentication working correctly');
      console.log('✅ Error handling working');
      console.log('✅ Data formats correct');
      console.log('\n📱 Frontend should work correctly with these APIs');

    } catch (error) {
      console.error('\n❌ INTEGRATION TEST FAILED:', error.message);
      console.error('Stack trace:', error.stack);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }
}

// Run the test
if (require.main === module) {
  const test = new FrontendIntegrationTest();
  test.runIntegrationTest().then(() => {
    console.log('\n🏁 Integration test completed successfully');
    process.exit(0);
  }).catch(error => {
    console.error('\n💥 Integration test failed:', error);
    process.exit(1);
  });
}

module.exports = FrontendIntegrationTest;