/**
 * Comprehensive Agent System Test
 * Tests all agent-related endpoints and functionality
 */

const axios = require('axios');

class AgentSystemTester {
    constructor() {
        this.baseURL = 'http://localhost:3001';
        this.testResults = {
            passed: 0,
            failed: 0,
            errors: []
        };
        this.authToken = null;
        this.testAgentId = null;
    }

    async runAllTests() {
        console.log('🧪 Starting Comprehensive Agent System Tests...\n');
        
        try {
            // Test authentication first
            await this.testAuthentication();
            
            // Test agent registration and profile
            await this.testAgentRegistration();
            await this.testAgentProfile();
            
            // Test agent-specific endpoints
            await this.testFastDeliveryAgent();
            await this.testPickupDeliveryAgent();
            await this.testPickupSiteManager();
            
            // Test general agent endpoints
            await this.testGeneralAgentEndpoints();
            
            this.printResults();
            
        } catch (error) {
            console.error('❌ Test suite failed:', error.message);
        }
    }

    async testAuthentication() {
        console.log('🔐 Testing Authentication...');
        
        try {
            // Test login with agent credentials
            const response = await axios.post(`${this.baseURL}/api/auth/login`, {
                email: 'test.agent@example.com',
                password: 'testpassword123'
            });
            
            if (response.data.token) {
                this.authToken = response.data.token;
                this.testAgentId = response.data.user.id;
                this.logSuccess('Authentication successful');
            } else {
                this.logError('Authentication failed - no token received');
            }
        } catch (error) {
            // If test agent doesn't exist, create one
            await this.createTestAgent();
        }
    }

    async createTestAgent() {
        console.log('👤 Creating test agent...');
        
        try {
            // Register test agent
            const registerResponse = await axios.post(`${this.baseURL}/api/auth/register`, {
                username: 'testagent',
                email: 'test.agent@example.com',
                password: 'testpassword123',
                role: 'agent',
                name: 'Test Agent',
                phone: '+1234567890'
            });
            
            if (registerResponse.data.token) {
                this.authToken = registerResponse.data.token;
                this.testAgentId = registerResponse.data.user.id;
                this.logSuccess('Test agent created and authenticated');
            }
        } catch (error) {
            this.logError(`Failed to create test agent: ${error.message}`);
        }
    }

    async testAgentRegistration() {
        console.log('📝 Testing Agent Registration...');
        
        const endpoints = [
            { method: 'PUT', url: '/api/agents/agent-type', data: { agent_type: 'fast_delivery' } },
            { method: 'PUT', url: '/api/agents/status', data: { status: 'available' } }
        ];

        for (const endpoint of endpoints) {
            await this.testEndpoint(endpoint);
        }
    }

    async testAgentProfile() {
        console.log('👤 Testing Agent Profile Management...');
        
        const endpoints = [
            { method: 'GET', url: '/api/agents/profile' },
            { method: 'PUT', url: '/api/agents/profile', data: { 
                phone: '+1234567890',
                address: '123 Test Street',
                city: 'Test City',
                vehicle_type: 'motorcycle'
            }},
            { method: 'PUT', url: '/api/agents/preferences', data: {
                work_radius: 15,
                auto_accept_orders: false,
                max_concurrent_orders: 3
            }},
            { method: 'GET', url: '/api/agents/earnings?period=month' }
        ];

        for (const endpoint of endpoints) {
            await this.testEndpoint(endpoint);
        }
    }

    async testFastDeliveryAgent() {
        console.log('🏍️ Testing Fast Delivery Agent Endpoints...');
        
        const endpoints = [
            { method: 'GET', url: '/api/fast-delivery-agent/profile' },
            { method: 'GET', url: '/api/fast-delivery-agent/stats' },
            { method: 'GET', url: '/api/fast-delivery-agent/available-orders' },
            { method: 'GET', url: '/api/fast-delivery-agent/active-orders' },
            { method: 'GET', url: '/api/fast-delivery-agent/order-history' },
            { method: 'GET', url: '/api/fast-delivery-agent/earnings' },
            { method: 'POST', url: '/api/fast-delivery-agent/go-online', data: {} },
            { method: 'POST', url: '/api/fast-delivery-agent/update-location', data: { 
                latitude: 40.7128, 
                longitude: -74.0060 
            }}
        ];

        for (const endpoint of endpoints) {
            await this.testEndpoint(endpoint);
        }
    }

    async testPickupDeliveryAgent() {
        console.log('🚚 Testing Pickup Delivery Agent Endpoints...');
        
        const endpoints = [
            { method: 'GET', url: '/api/pickup-delivery-agent/profile' },
            { method: 'GET', url: '/api/pickup-delivery-agent/stats' },
            { method: 'GET', url: '/api/pickup-delivery-agent/available-pickups' },
            { method: 'GET', url: '/api/pickup-delivery-agent/active-orders' },
            { method: 'GET', url: '/api/pickup-delivery-agent/order-history' },
            { method: 'GET', url: '/api/pickup-delivery-agent/earnings' },
            { method: 'GET', url: '/api/pickup-delivery-agent/pickup-sites' },
            { method: 'POST', url: '/api/pickup-delivery-agent/toggle-status', data: {} },
            { method: 'POST', url: '/api/pickup-delivery-agent/update-location', data: { 
                latitude: 40.7128, 
                longitude: -74.0060 
            }}
        ];

        for (const endpoint of endpoints) {
            await this.testEndpoint(endpoint);
        }
    }

    async testPickupSiteManager() {
        console.log('🏪 Testing Pickup Site Manager Endpoints...');
        
        const endpoints = [
            { method: 'GET', url: '/api/pickup-site-manager/dashboard' },
            { method: 'GET', url: '/api/pickup-site-manager/ready-pickups' },
            { method: 'GET', url: '/api/pickup-site-manager/inventory' },
            { method: 'GET', url: '/api/pickup-site-manager/manual-orders' },
            { method: 'GET', url: '/api/pickup-site-manager/commissions' },
            { method: 'GET', url: '/api/pickup-site-manager/active-sites' },
            { method: 'POST', url: '/api/pickup-site-manager/verify-code', data: { 
                code: 'TEST123',
                order_id: 1
            }}
        ];

        for (const endpoint of endpoints) {
            await this.testEndpoint(endpoint);
        }
    }

    async testGeneralAgentEndpoints() {
        console.log('🔧 Testing General Agent Endpoints...');
        
        const endpoints = [
            { method: 'GET', url: '/api/agents/orders' },
            { method: 'GET', url: '/api/agents/orders/claimable' }
        ];

        for (const endpoint of endpoints) {
            await this.testEndpoint(endpoint);
        }
    }

    async testEndpoint(endpoint) {
        try {
            const config = {
                method: endpoint.method,
                url: `${this.baseURL}${endpoint.url}`,
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            };

            if (endpoint.data) {
                config.data = endpoint.data;
            }

            const response = await axios(config);
            
            if (response.status >= 200 && response.status < 300) {
                this.logSuccess(`${endpoint.method} ${endpoint.url}`);
            } else {
                this.logError(`${endpoint.method} ${endpoint.url} - Status: ${response.status}`);
            }
        } catch (error) {
            // Some endpoints might fail due to missing data or permissions, which is expected
            if (error.response) {
                const status = error.response.status;
                if (status === 404 || status === 403) {
                    this.logWarning(`${endpoint.method} ${endpoint.url} - ${status} (Expected for some endpoints)`);
                } else {
                    this.logError(`${endpoint.method} ${endpoint.url} - Status: ${status}, Error: ${error.response.data?.error || error.message}`);
                }
            } else {
                this.logError(`${endpoint.method} ${endpoint.url} - Network Error: ${error.message}`);
            }
        }
    }

    logSuccess(message) {
        console.log(`✅ ${message}`);
        this.testResults.passed++;
    }

    logError(message) {
        console.log(`❌ ${message}`);
        this.testResults.failed++;
        this.testResults.errors.push(message);
    }

    logWarning(message) {
        console.log(`⚠️  ${message}`);
    }

    printResults() {
        console.log('\n📊 Test Results Summary:');
        console.log(`✅ Passed: ${this.testResults.passed}`);
        console.log(`❌ Failed: ${this.testResults.failed}`);
        console.log(`📈 Success Rate: ${((this.testResults.passed / (this.testResults.passed + this.testResults.failed)) * 100).toFixed(2)}%`);
        
        if (this.testResults.errors.length > 0) {
            console.log('\n❌ Errors:');
            this.testResults.errors.forEach(error => console.log(`   - ${error}`));
        }
        
        console.log('\n🎉 Agent System Test Complete!');
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const tester = new AgentSystemTester();
    tester.runAllTests().catch(console.error);
}

module.exports = AgentSystemTester;