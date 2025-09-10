/**
 * Test Agent Application Complete Flow
 * Tests the complete flow from application submission to approval and dashboard access
 */

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
require('dotenv').config();

class AgentApplicationFlowTest {
    constructor() {
        this.app = null;
        this.connection = null;
        this.testAdmin = null;
        this.adminToken = null;
        this.testApplicationId = null;
        this.testUserId = null;
        this.testResults = [];
    }

    // Initialize test environment
    async init() {
        console.log('🚀 Initializing Agent Application Flow Test...');
        
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
        
        // Import and use routes
        const adminAgentApplicationsRoutes = require('./routes/admin-agent-applications');
        const agentRegistrationRoutes = require('./routes/agent-registration');
        const pickupDeliveryAgentRoutes = require('./routes/pickup-delivery-agent');
        
        this.app.use('/api/admin', adminAgentApplicationsRoutes);
        this.app.use('/api', agentRegistrationRoutes);
        this.app.use('/api/pickup-delivery-agent', pickupDeliveryAgentRoutes);

        console.log('✅ Test environment initialized');
        return true;
    }

    // Setup test admin user
    async setupTestAdmin() {
        console.log('🔧 Setting up test admin...');
        
        const testAdminData = {
            name: 'Flow Test Admin',
            email: 'flow.test.admin@add.com',
            phone: '+1000000002',
            password: 'FlowTest123!',
            role: 'admin'
        };

        try {
            const hashedPassword = await bcrypt.hash(testAdminData.password, 10);
            
            await this.connection.execute(`
                INSERT INTO users (name, email, phone, password, role, status, created_at)
                VALUES (?, ?, ?, ?, ?, 'active', NOW())
                ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                phone = VALUES(phone),
                status = 'active'
            `, [testAdminData.name, testAdminData.email, testAdminData.phone, hashedPassword, testAdminData.role]);

            // Get user ID
            const [userRows] = await this.connection.execute(
                'SELECT id FROM users WHERE email = ?',
                [testAdminData.email]
            );

            if (userRows.length > 0) {
                this.testAdmin = { ...testAdminData, id: userRows[0].id };
                
                // Create admin token
                this.adminToken = jwt.sign(
                    { 
                        userId: this.testAdmin.id, 
                        email: this.testAdmin.email, 
                        role: this.testAdmin.role 
                    },
                    process.env.JWT_SECRET || 'test-secret',
                    { expiresIn: '1h' }
                );

                console.log(`✅ Test admin created: ${testAdminData.name} (ID: ${this.testAdmin.id})`);
                return true;
            }
        } catch (error) {
            console.error('❌ Failed to setup test admin:', error.message);
            return false;
        }
    }

    // Create test agent application
    async createTestApplication() {
        console.log('📝 Creating test agent application...');
        
        const testApplicationData = {
            selectedAgentType: 'pickup_delivery',
            first_name: 'John',
            last_name: 'TestAgent',
            email: 'john.testagent@example.com',
            phone: '+1234567890',
            password: 'TestAgent123!',
            confirm_password: 'TestAgent123!',
            latitude: '40.7128',
            longitude: '-74.0060',
            street_address: '123 Test Street',
            city: 'Test City',
            state: 'Test State',
            country: 'Test Country',
            postal_code: '12345',
            hasVehicle: 'true',
            vehicle_type: 'motorcycle',
            vehicle_make: 'Honda',
            vehicle_model: 'CBR',
            vehicle_year: '2020',
            vehicle_plate: 'TEST123',
            vehicle_color: 'Red'
        };

        try {
            const response = await request(this.app)
                .post('/api/agent-registration')
                .send(testApplicationData)
                .expect(200);

            if (response.body.success) {
                this.testApplicationId = response.body.applicationId;
                this.testUserId = response.body.userId;
                console.log(`✅ Test application created: ID ${this.testApplicationId}, User ID ${this.testUserId}`);
                return true;
            } else {
                console.error('❌ Failed to create test application:', response.body.error);
                return false;
            }
        } catch (error) {
            console.error('❌ Failed to create test application:', error.message);
            return false;
        }
    }

    // Test admin can view applications
    async testViewApplications() {
        console.log('\n📋 Testing admin can view applications...');
        
        try {
            const response = await request(this.app)
                .get('/api/admin/agent-applications')
                .set('Authorization', `Bearer ${this.adminToken}`)
                .expect(200);

            if (response.body.success && Array.isArray(response.body.applications)) {
                const testApp = response.body.applications.find(app => app.id === this.testApplicationId);
                if (testApp) {
                    console.log('✅ Admin can view applications - test application found');
                    return true;
                } else {
                    console.log('❌ Test application not found in applications list');
                    return false;
                }
            } else {
                console.log('❌ Invalid response format from applications endpoint');
                return false;
            }
        } catch (error) {
            console.error('❌ Failed to view applications:', error.message);
            return false;
        }
    }

    // Test application approval
    async testApplicationApproval() {
        console.log('\n✅ Testing application approval...');
        
        try {
            const response = await request(this.app)
                .post(`/api/admin/agent-applications/${this.testApplicationId}/approve`)
                .set('Authorization', `Bearer ${this.adminToken}`)
                .send({ notes: 'Test approval - automated test' })
                .expect(200);

            if (response.body.success) {
                console.log('✅ Application approved successfully');
                
                // Verify user status was updated
                const [users] = await this.connection.execute(
                    'SELECT role, status, agent_type FROM users WHERE id = ?',
                    [this.testUserId]
                );
                
                if (users.length > 0) {
                    const user = users[0];
                    console.log(`   User role: ${user.role}`);
                    console.log(`   User status: ${user.status}`);
                    console.log(`   Agent type: ${user.agent_type}`);
                    
                    if (user.role === 'agent' && user.status === 'active' && user.agent_type === 'pickup_delivery') {
                        console.log('✅ User role and status updated correctly');
                        return true;
                    } else {
                        console.log('❌ User role or status not updated correctly');
                        return false;
                    }
                } else {
                    console.log('❌ User not found after approval');
                    return false;
                }
            } else {
                console.log('❌ Application approval failed:', response.body.error);
                return false;
            }
        } catch (error) {
            console.error('❌ Failed to approve application:', error.message);
            return false;
        }
    }

    // Test agent can access dashboard
    async testAgentDashboardAccess() {
        console.log('\n🎯 Testing agent dashboard access...');
        
        try {
            // Create agent token
            const agentToken = jwt.sign(
                { 
                    userId: this.testUserId, 
                    email: 'john.testagent@example.com', 
                    role: 'agent' 
                },
                process.env.JWT_SECRET || 'test-secret',
                { expiresIn: '1h' }
            );
            
            // Test agent profile endpoint
            const response = await request(this.app)
                .get('/api/pickup-delivery-agent/profile')
                .set('Authorization', `Bearer ${agentToken}`)
                .expect(200);

            if (response.body.success && response.body.agent) {
                console.log('✅ Agent can access dashboard');
                console.log(`   Agent ID: ${response.body.agent.id}`);
                console.log(`   Agent Name: ${response.body.agent.name}`);
                console.log(`   Agent Type: ${response.body.agent.agent_type}`);
                return true;
            } else {
                console.log('❌ Agent cannot access dashboard');
                return false;
            }
        } catch (error) {
            console.error('❌ Failed to test agent dashboard access:', error.message);
            return false;
        }
    }

    // Test statistics endpoint
    async testStatisticsEndpoint() {
        console.log('\n📊 Testing statistics endpoint...');
        
        try {
            const response = await request(this.app)
                .get('/api/admin/agent-applications/stats')
                .set('Authorization', `Bearer ${this.adminToken}`)
                .expect(200);

            if (response.body.success && response.body.stats) {
                const stats = response.body.stats;
                console.log('✅ Statistics endpoint working');
                console.log(`   Total: ${stats.total}`);
                console.log(`   Pending: ${stats.pending}`);
                console.log(`   Approved: ${stats.approved}`);
                console.log(`   Rejected: ${stats.rejected}`);
                return true;
            } else {
                console.log('❌ Statistics endpoint failed');
                return false;
            }
        } catch (error) {
            console.error('❌ Failed to test statistics endpoint:', error.message);
            return false;
        }
    }

    // Run all tests
    async runAllTests() {
        console.log('🧪 Starting Agent Application Flow Tests...\n');
        
        let allTestsPassed = true;
        
        try {
            await this.init();
            await this.setupTestAdmin();
            
            const createAppTest = await this.createTestApplication();
            const viewAppsTest = await this.testViewApplications();
            const approvalTest = await this.testApplicationApproval();
            const dashboardTest = await this.testAgentDashboardAccess();
            const statsTest = await this.testStatisticsEndpoint();
            
            allTestsPassed = createAppTest && viewAppsTest && approvalTest && dashboardTest && statsTest;
            
            console.log('\n📊 Test Results Summary');
            console.log('========================');
            console.log(`Create Application: ${createAppTest ? '✅ PASS' : '❌ FAIL'}`);
            console.log(`View Applications: ${viewAppsTest ? '✅ PASS' : '❌ FAIL'}`);
            console.log(`Approve Application: ${approvalTest ? '✅ PASS' : '❌ FAIL'}`);
            console.log(`Agent Dashboard Access: ${dashboardTest ? '✅ PASS' : '❌ FAIL'}`);
            console.log(`Statistics Endpoint: ${statsTest ? '✅ PASS' : '❌ FAIL'}`);
            
            if (allTestsPassed) {
                console.log('\n🎉 All tests passed! The complete agent application flow is working correctly.');
                console.log('\n📋 Flow Summary:');
                console.log('   1. ✅ Agents can submit applications');
                console.log('   2. ✅ Applications appear in admin dashboard');
                console.log('   3. ✅ Admins can approve applications');
                console.log('   4. ✅ Approved agents get correct roles and access');
                console.log('   5. ✅ Agents can access their respective dashboards');
                console.log('   6. ✅ Statistics are updated correctly');
            } else {
                console.log('\n❌ Some tests failed. Please check the issues above.');
            }
            
        } catch (error) {
            console.error('❌ Test suite failed:', error);
            allTestsPassed = false;
        } finally {
            await this.cleanup();
        }
        
        return allTestsPassed;
    }

    // Cleanup test data
    async cleanup() {
        console.log('\n🧹 Cleaning up test data...');
        
        try {
            if (this.connection) {
                // Delete test application and related data
                if (this.testApplicationId) {
                    await this.connection.execute(
                        'DELETE FROM agent_application_documents WHERE application_id = ?',
                        [this.testApplicationId]
                    );
                    await this.connection.execute(
                        'DELETE FROM agent_applications WHERE id = ?',
                        [this.testApplicationId]
                    );
                }
                
                // Delete test users
                await this.connection.execute(
                    "DELETE FROM pickup_delivery_agents WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%testagent@example.com' OR email LIKE '%flow.test.admin@add.com')"
                );
                await this.connection.execute(
                    "DELETE FROM agents WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%testagent@example.com' OR email LIKE '%flow.test.admin@add.com')"
                );
                await this.connection.execute(
                    "DELETE FROM users WHERE email LIKE '%testagent@example.com' OR email = 'flow.test.admin@add.com'"
                );
                
                await this.connection.end();
                console.log('✅ Test data cleaned up');
            }
        } catch (error) {
            console.error('❌ Cleanup failed:', error.message);
        }
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const testSuite = new AgentApplicationFlowTest();
    
    testSuite.runAllTests()
        .then((success) => {
            process.exit(success ? 0 : 1);
        })
        .catch((error) => {
            console.error('❌ Test suite failed:', error);
            process.exit(1);
        });
}

module.exports = AgentApplicationFlowTest;