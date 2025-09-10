/**
 * Test API Endpoints for Fast Delivery Agent
 * Tests the API endpoints to ensure they're working correctly
 */

const pool = require('./db');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

class APIEndpointTester {
  constructor() {
    this.baseUrl = 'http://localhost:3002'; // Server is running on 3002
    this.agentToken = null;
    this.agentId = null;
  }

  log(message, status = 'INFO') {
    const statusIcon = {
      'INFO': 'ℹ️',
      'SUCCESS': '✅',
      'ERROR': '❌',
      'WARNING': '⚠️'
    };
    
    console.log(`${statusIcon[status]} ${message}`);
  }

  async makeRequest(endpoint, options = {}, token = null) {
    const url = `${this.baseUrl}${endpoint}`;
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

      let data;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = { error: await response.text() };
      }

      return { 
        response, 
        data, 
        success: response.ok,
        status: response.status,
        statusText: response.statusText
      };
    } catch (error) {
      return { 
        response: null, 
        data: { error: error.message }, 
        success: false,
        status: 0,
        statusText: 'Network Error'
      };
    }
  }

  async setupTestAgent() {
    this.log('Setting up test agent...', 'INFO');

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
        this.log('No fast delivery agents found. Creating test agent...', 'WARNING');
        
        // Create test agent
        const bcrypt = require('bcrypt');
        const hashedPassword = await bcrypt.hash('testpass123', 10);
        const timestamp = Date.now();

        // Create user
        const [userResult] = await pool.query(
          'INSERT INTO users (username, email, password, role, phone, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
          [`test_agent_${timestamp}`, `agent${timestamp}@test.com`, hashedPassword, 'agent', '+250788123456']
        );

        // Create agent
        const [agentResult] = await pool.query(
          'INSERT INTO agents (user_id, agent_type, name, phone, email, status, admin_approval_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
          [userResult.insertId, 'fast_delivery', `Test Agent ${timestamp}`, '+250788123456', `agent${timestamp}@test.com`, 'available', 'approved']
        );

        this.agentId = agentResult.insertId;
        
        // Generate token
        this.agentToken = jwt.sign(
          { id: userResult.insertId, email: `agent${timestamp}@test.com`, role: 'agent' },
          JWT_SECRET,
          { expiresIn: '1h' }
        );

        this.log('Test agent created successfully', 'SUCCESS');
      } else {
        const agent = agents[0];
        this.agentId = agent.id;
        
        // Generate token for existing agent
        this.agentToken = jwt.sign(
          { id: agent.user_id, email: agent.email, role: 'agent' },
          JWT_SECRET,
          { expiresIn: '1h' }
        );

        this.log(`Using existing agent: ${agent.email}`, 'SUCCESS');
      }

      return true;
    } catch (error) {
      this.log(`Failed to setup test agent: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async testEndpoint(name, endpoint, method = 'GET', body = null) {
    this.log(`Testing ${name}...`, 'INFO');

    const options = { method };
    if (body) {
      options.body = JSON.stringify(body);
    }

    const { success, data, status, statusText } = await this.makeRequest(
      endpoint,
      options,
      this.agentToken
    );

    if (success) {
      this.log(`✓ ${name} - OK (${status})`, 'SUCCESS');
      return true;
    } else {
      this.log(`✗ ${name} - FAILED (${status} ${statusText})`, 'ERROR');
      if (data.error) {
        this.log(`  Error: ${data.error}`, 'ERROR');
      }
      return false;
    }
  }

  async runTests() {
    try {
      console.log('🧪 Testing Fast Delivery Agent API Endpoints');
      console.log('=' .repeat(60));

      // Setup test agent
      const agentSetup = await this.setupTestAgent();
      if (!agentSetup) {
        this.log('Failed to setup test agent. Cannot continue.', 'ERROR');
        return false;
      }

      // Test endpoints
      const tests = [
        { name: 'Agent Profile', endpoint: '/api/fast-delivery-agent/profile' },
        { name: 'Agent Stats', endpoint: '/api/fast-delivery-agent/stats' },
        { name: 'Available Orders', endpoint: '/api/fast-delivery-agent/available-orders?radius=10&limit=20' },
        { name: 'Active Orders', endpoint: '/api/fast-delivery-agent/active-orders' },
        { name: 'Order History', endpoint: '/api/fast-delivery-agent/order-history?page=1&limit=10' },
        { name: 'Earnings', endpoint: '/api/fast-delivery-agent/earnings?period=today' },
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
        },
        { 
          name: 'Go Offline', 
          endpoint: '/api/fast-delivery-agent/go-offline',
          method: 'POST'
        }
      ];

      let passedTests = 0;
      let totalTests = tests.length;

      for (const test of tests) {
        const result = await this.testEndpoint(
          test.name,
          test.endpoint,
          test.method || 'GET',
          test.body || null
        );
        
        if (result) {
          passedTests++;
        }

        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log('\n' + '=' .repeat(60));
      console.log(`📊 TEST RESULTS: ${passedTests}/${totalTests} tests passed`);

      if (passedTests === totalTests) {
        this.log('🎉 ALL API TESTS PASSED!', 'SUCCESS');
        this.log('✅ All endpoints are working correctly', 'SUCCESS');
        this.log('✅ Authentication is working', 'SUCCESS');
        this.log('✅ Database operations are successful', 'SUCCESS');
        this.log('\n🔧 FRONTEND ISSUE DIAGNOSIS:', 'INFO');
        this.log('The APIs are working correctly on port 3002', 'INFO');
        this.log('The frontend might be trying to connect to port 3001', 'WARNING');
        this.log('\n💡 SOLUTION:', 'INFO');
        this.log('Access the frontend via: http://localhost:3002/agent/fast-delivery-agent-complete.html', 'INFO');
        this.log('This will ensure the frontend uses the correct port', 'INFO');
      } else {
        this.log(`⚠️ ${totalTests - passedTests} tests failed`, 'WARNING');
        this.log('Some API endpoints may have issues', 'WARNING');
      }

      return passedTests === totalTests;
    } catch (error) {
      this.log(`Test execution failed: ${error.message}`, 'ERROR');
      console.error('Stack trace:', error.stack);
      return false;
    }
  }
}

// Run the tests
if (require.main === module) {
  const tester = new APIEndpointTester();
  tester.runTests().then((success) => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('\n💥 API tests failed:', error);
    process.exit(1);
  });
}

module.exports = APIEndpointTester;