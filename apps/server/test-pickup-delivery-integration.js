/**
 * Integration Test Suite for Pickup Delivery Agent Dashboard
 * Tests the complete flow from frontend to backend with real database
 */

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
require('dotenv').config();

class PickupDeliveryIntegrationTest {
    constructor() {
        this.app = null;
        this.connection = null;
        this.testAgent = null;
        this.authToken = null;
        this.testResults = [];
    }

    // Initialize test environment
    async init() {
        console.log('🚀 Initializing integration test environment...');
        
        // Setup database connection
        this.connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'add_physical_product',
            port: process.env.DB_PORT || 3306
        });

        // Setup Express app with routes
        this.app = express();
        this.app.use(express.json());
        
        // Import and use the pickup delivery agent routes
        const pickupDeliveryRoutes = require('./routes/pickup-delivery-agent');
        this.app.use('/api/pickup-delivery-agent', pickupDeliveryRoutes);

        console.log('✅ Integration test environment initialized');
        return true;
    }

    // Create test agent and get auth token
    async setupTestAgent() {
        console.log('🔧 Setting up test agent...');
        
        const testAgentData = {
            name: 'Integration Test Agent',
            email: 'integration.test@pda.com',
            phone: '+1999999999',
            password: 'IntegrationTest123!',
            role: 'pickup_delivery_agent'
        };

        try {
            // Create test agent in database
            const hashedPassword = await bcrypt.hash(testAgentData.password, 10);
            
            const [result] = await this.connection.execute(`
                INSERT INTO users (name, email, phone, password, role, status, created_at)
                VALUES (?, ?, ?, ?, ?, 'active', NOW())
                ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                phone = VALUES(phone),
                status = 'active'
            `, [testAgentData.name, testAgentData.email, testAgentData.phone, hashedPassword, testAgentData.role]);

            // Get user ID
            const [userRows] = await this.connection.execute(
                'SELECT id FROM users WHERE email = ?',
                [testAgentData.email]
            );

            if (userRows.length > 0) {
                this.testAgent = { ...testAgentData, id: userRows[0].id };
                
                // Create pickup delivery agent entry
                await this.connection.execute(`
                    INSERT INTO pickup_delivery_agents (
                        user_id, vehicle_type, license_number, location, 
                        rating, total_deliveries, is_available, created_at
                    ) VALUES (?, 'motorcycle', 'TEST001', 'Test Location', 4.5, 0, TRUE, NOW())
                    ON DUPLICATE KEY UPDATE
                    vehicle_type = VALUES(vehicle_type),
                    is_available = TRUE
                `, [this.testAgent.id]);
                
                // Create agents table entry (for foreign key constraint)
                await this.connection.execute(`
                    INSERT INTO agents (id, user_id, status, created_at)
                    VALUES (?, ?, 'active', NOW())
                    ON DUPLICATE KEY UPDATE
                    status = 'active'
                `, [this.testAgent.id, this.testAgent.id]);
                
                // Create auth token
                this.authToken = jwt.sign(
                    { 
                        userId: this.testAgent.id, 
                        email: this.testAgent.email, 
                        role: this.testAgent.role 
                    },
                    process.env.JWT_SECRET || 'test-secret',
                    { expiresIn: '1h' }
                );

                console.log(`✅ Test agent created: ${testAgentData.name} (ID: ${this.testAgent.id})`);
                return true;
            }
        } catch (error) {
            console.error('❌ Failed to setup test agent:', error.message);
            return false;
        }
    }

    // Log test results
    logTest(testName, status, details = null) {
        const result = {
            testName,
            status,
            details,
            timestamp: new Date().toISOString()
        };
        
        this.testResults.push(result);
        
        const emoji = status === 'PASS' ? '✅' : '❌';
        console.log(`${emoji} ${testName}: ${status}`);
        if (details) {
            console.log(`   Details: ${JSON.stringify(details)}`);
        }
    }

    // Test authentication endpoints
    async testAuthentication() {
        console.log('\n🔐 Testing Authentication...');
        
        // Test profile endpoint
        try {
            const response = await request(this.app)
                .get('/api/pickup-delivery-agent/profile')
                .set('Authorization', `Bearer ${this.authToken}`)
                .expect(200);

            if (response.body.success && response.body.agent && response.body.agent.id === this.testAgent.id) {
                this.logTest('Profile Endpoint', 'PASS', { userId: response.body.agent.id });
            } else {
                this.logTest('Profile Endpoint', 'FAIL', { expected: this.testAgent.id, got: response.body.agent?.id });
            }
        } catch (error) {
            this.logTest('Profile Endpoint', 'FAIL', error.message);
        }

        // Test invalid token
        try {
            await request(this.app)
                .get('/api/pickup-delivery-agent/profile')
                .set('Authorization', 'Bearer invalid-token')
                .expect(401);

            this.logTest('Invalid Token Rejection', 'PASS');
        } catch (error) {
            this.logTest('Invalid Token Rejection', 'FAIL', error.message);
        }

        // Test missing token
        try {
            await request(this.app)
                .get('/api/pickup-delivery-agent/profile')
                .expect(401);

            this.logTest('Missing Token Rejection', 'PASS');
        } catch (error) {
            this.logTest('Missing Token Rejection', 'FAIL', error.message);
        }
    }

    // Test order endpoints
    async testOrderEndpoints() {
        console.log('\n📦 Testing Order Endpoints...');
        
        // Test available orders
        try {
            const response = await request(this.app)
                .get('/api/pickup-delivery-agent/available-orders')
                .set('Authorization', `Bearer ${this.authToken}`)
                .expect(200);

            if (response.body.success && Array.isArray(response.body.orders)) {
                this.logTest('Available Orders Endpoint', 'PASS', { count: response.body.orders.length });
            } else {
                this.logTest('Available Orders Endpoint', 'FAIL', 'Response does not have orders array');
            }
        } catch (error) {
            this.logTest('Available Orders Endpoint', 'FAIL', error.message);
        }

        // Test active orders
        try {
            const response = await request(this.app)
                .get('/api/pickup-delivery-agent/active-orders')
                .set('Authorization', `Bearer ${this.authToken}`)
                .expect(200);

            if (response.body.success && Array.isArray(response.body.orders)) {
                this.logTest('Active Orders Endpoint', 'PASS', { count: response.body.orders.length });
            } else {
                this.logTest('Active Orders Endpoint', 'FAIL', 'Response does not have orders array');
            }
        } catch (error) {
            this.logTest('Active Orders Endpoint', 'FAIL', error.message);
        }

        // Test order history
        try {
            const response = await request(this.app)
                .get('/api/pickup-delivery-agent/order-history')
                .set('Authorization', `Bearer ${this.authToken}`)
                .expect(200);

            if (response.body.success && Array.isArray(response.body.orders)) {
                this.logTest('Order History Endpoint', 'PASS', { count: response.body.orders.length });
            } else {
                this.logTest('Order History Endpoint', 'FAIL', 'Response does not have orders array');
            }
        } catch (error) {
            this.logTest('Order History Endpoint', 'FAIL', error.message);
        }
    }

    // Test order status updates
    async testOrderStatusUpdates() {
        console.log('\n🔄 Testing Order Status Updates...');
        
        // First, create a test order
        const testOrder = await this.createTestOrder();
        if (!testOrder) {
            this.logTest('Test Order Creation', 'FAIL', 'Could not create test order');
            return;
        }

        // Test accepting an order
        try {
            const response = await request(this.app)
                .post(`/api/pickup-delivery-agent/orders/${testOrder.id}/accept`)
                .set('Authorization', `Bearer ${this.authToken}`)
                .expect(200);

            this.logTest('Accept Order', 'PASS', { orderId: testOrder.id });
        } catch (error) {
            this.logTest('Accept Order', 'FAIL', error.message);
        }

        // Test updating order status
        const statusUpdates = [
            'PDA_EN_ROUTE_TO_SELLER',
            'PDA_AT_SELLER',
            'PICKED_FROM_SELLER',
            'EN_ROUTE_TO_PSM'
        ];

        for (const status of statusUpdates) {
            try {
                const response = await request(this.app)
                    .put(`/api/pickup-delivery-agent/orders/${testOrder.id}/status`)
                    .set('Authorization', `Bearer ${this.authToken}`)
                    .send({ status })
                    .expect(200);

                this.logTest(`Update Status to ${status}`, 'PASS', { orderId: testOrder.id });
            } catch (error) {
                this.logTest(`Update Status to ${status}`, 'FAIL', error.message);
            }
        }
    }

    // Create a test order for testing
    async createTestOrder() {
        try {
            // Create test buyer if doesn't exist
            let buyerId;
            const [buyers] = await this.connection.execute(
                "SELECT id FROM users WHERE role = 'buyer' LIMIT 1"
            );
            
            if (buyers.length === 0) {
                const hashedPassword = await bcrypt.hash('TestBuyer123!', 10);
                const [buyerResult] = await this.connection.execute(`
                    INSERT INTO users (name, email, phone, password, role, status, created_at)
                    VALUES ('Test Buyer', 'test.buyer@example.com', '+1111111111', ?, 'buyer', 'active', NOW())
                `, [hashedPassword]);
                buyerId = buyerResult.insertId;
            } else {
                buyerId = buyers[0].id;
            }

            // Create test seller if doesn't exist
            let sellerId;
            const [sellers] = await this.connection.execute(
                "SELECT id FROM users WHERE role = 'seller' LIMIT 1"
            );
            
            if (sellers.length === 0) {
                const hashedPassword = await bcrypt.hash('TestSeller123!', 10);
                const [sellerResult] = await this.connection.execute(`
                    INSERT INTO users (name, email, phone, password, role, status, created_at)
                    VALUES ('Test Seller', 'test.seller@example.com', '+2222222222', ?, 'seller', 'active', NOW())
                `, [hashedPassword]);
                sellerId = sellerResult.insertId;
            } else {
                sellerId = sellers[0].id;
            }

            // Create test order with unique order number
            const orderNumber = `TEST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const [result] = await this.connection.execute(`
                INSERT INTO orders (
                    user_id, order_number, total_amount, status, 
                    delivery_method, marketplace_type, created_at
                ) VALUES (?, ?, 99.99, 'PAYMENT_CONFIRMED', 'pickup', 'physical', NOW())
            `, [buyerId, orderNumber]);

            return { id: result.insertId };
        } catch (error) {
            console.error('❌ Failed to create test order:', error.message);
            return null;
        }
    }

    // Test dashboard statistics
    async testDashboardStatistics() {
        console.log('\n📊 Testing Dashboard Statistics...');
        
        try {
            const response = await request(this.app)
                .get('/api/pickup-delivery-agent/stats')
                .set('Authorization', `Bearer ${this.authToken}`)
                .expect(200);

            const expectedFields = ['success', 'stats'];
            const hasAllFields = expectedFields.every(field => response.body.hasOwnProperty(field));

            if (hasAllFields) {
                this.logTest('Dashboard Statistics', 'PASS', response.body);
            } else {
                this.logTest('Dashboard Statistics', 'FAIL', 'Missing required fields');
            }
        } catch (error) {
            this.logTest('Dashboard Statistics', 'FAIL', error.message);
        }
    }

    // Test error handling
    async testErrorHandling() {
        console.log('\n🚨 Testing Error Handling...');
        
        // Test non-existent order
        try {
            await request(this.app)
                .get('/api/pickup-delivery-agent/orders/99999')
                .set('Authorization', `Bearer ${this.authToken}`)
                .expect(404);

            this.logTest('Non-existent Order Handling', 'PASS');
        } catch (error) {
            this.logTest('Non-existent Order Handling', 'FAIL', error.message);
        }

        // Test invalid status update
        try {
            const testOrder = await this.createTestOrder();
            if (testOrder) {
                await request(this.app)
                    .put(`/api/pickup-delivery-agent/orders/${testOrder.id}/status`)
                    .set('Authorization', `Bearer ${this.authToken}`)
                    .send({ status: 'INVALID_STATUS' })
                    .expect(400);

                this.logTest('Invalid Status Update Handling', 'PASS');
            }
        } catch (error) {
            this.logTest('Invalid Status Update Handling', 'FAIL', error.message);
        }
    }

    // Test performance with multiple requests
    async testPerformance() {
        console.log('\n⚡ Testing Performance...');
        
        const startTime = Date.now();
        const promises = [];
        
        // Make 10 concurrent requests
        for (let i = 0; i < 10; i++) {
            promises.push(
                request(this.app)
                    .get('/api/pickup-delivery-agent/available-orders')
                    .set('Authorization', `Bearer ${this.authToken}`)
            );
        }

        try {
            await Promise.all(promises);
            const endTime = Date.now();
            const duration = endTime - startTime;

            if (duration < 5000) { // Should complete within 5 seconds
                this.logTest('Performance Test (10 concurrent requests)', 'PASS', { duration: `${duration}ms` });
            } else {
                this.logTest('Performance Test (10 concurrent requests)', 'FAIL', { duration: `${duration}ms` });
            }
        } catch (error) {
            this.logTest('Performance Test (10 concurrent requests)', 'FAIL', error.message);
        }
    }

    // Run all integration tests
    async runAllTests() {
        console.log('🎯 Starting Pickup Delivery Agent Integration Tests\n');
        
        const initSuccess = await this.init();
        if (!initSuccess) {
            console.log('❌ Failed to initialize test environment');
            return;
        }

        const agentSetupSuccess = await this.setupTestAgent();
        if (!agentSetupSuccess) {
            console.log('❌ Failed to setup test agent');
            return;
        }

        // Run all test suites
        await this.testAuthentication();
        await this.testOrderEndpoints();
        await this.testOrderStatusUpdates();
        await this.testDashboardStatistics();
        await this.testErrorHandling();
        await this.testPerformance();

        // Generate test report
        this.generateTestReport();

        // Cleanup
        await this.cleanup();
    }

    // Generate comprehensive test report
    generateTestReport() {
        console.log('\n🎯 ===== INTEGRATION TEST REPORT =====');
        
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(test => test.status === 'PASS').length;
        const failedTests = this.testResults.filter(test => test.status === 'FAIL').length;
        const successRate = ((passedTests / totalTests) * 100).toFixed(2);

        console.log(`📊 Total Tests: ${totalTests}`);
        console.log(`✅ Passed: ${passedTests}`);
        console.log(`❌ Failed: ${failedTests}`);
        console.log(`📈 Success Rate: ${successRate}%`);

        if (failedTests > 0) {
            console.log('\n❌ Failed Tests:');
            this.testResults
                .filter(test => test.status === 'FAIL')
                .forEach(test => {
                    console.log(`   - ${test.testName}: ${test.details}`);
                });
        }

        console.log('\n📋 Recommendations:');
        if (successRate >= 90) {
            console.log('✅ System is ready for production deployment');
        } else if (successRate >= 70) {
            console.log('⚠️  System needs minor fixes before deployment');
        } else {
            console.log('❌ System requires significant fixes before deployment');
        }

        // Save detailed report
        const report = {
            timestamp: new Date().toISOString(),
            totalTests,
            passedTests,
            failedTests,
            successRate,
            results: this.testResults
        };

        require('fs').writeFileSync(
            'pickup-delivery-integration-test-report.json',
            JSON.stringify(report, null, 2)
        );

        console.log('\n💾 Detailed report saved to: pickup-delivery-integration-test-report.json');
    }

    // Cleanup test data
    async cleanup() {
        console.log('\n🧹 Cleaning up test data...');
        
        try {
            if (this.testAgent) {
                await this.connection.execute(
                    'DELETE FROM users WHERE email = ?',
                    [this.testAgent.email]
                );
            }
            
            // Clean up test orders
            await this.connection.execute(
                "DELETE FROM orders WHERE total_amount = 99.99 AND status IN ('PAYMENT_CONFIRMED', 'ASSIGNED_TO_PDA')"
            );

            console.log('✅ Test data cleaned up successfully');
        } catch (error) {
            console.error('❌ Failed to cleanup test data:', error.message);
        }

        if (this.connection) {
            await this.connection.end();
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new PickupDeliveryIntegrationTest();
    tester.runAllTests().catch(console.error);
}

module.exports = PickupDeliveryIntegrationTest;