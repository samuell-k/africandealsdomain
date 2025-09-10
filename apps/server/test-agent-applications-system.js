/**
 * Test Suite for Agent Applications System
 * Tests the complete flow from registration to admin approval
 */

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();

class AgentApplicationsSystemTest {
    constructor() {
        this.app = null;
        this.connection = null;
        this.testResults = [];
        this.testAdmin = null;
        this.adminToken = null;
        this.testApplicationId = null;
        this.testApplicationRef = null;
    }

    // Initialize test environment
    async init() {
        console.log('🚀 Initializing Agent Applications System Test...');
        
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
        this.app.use(express.urlencoded({ extended: true }));
        
        // Import and use routes
        const agentRegistrationRoutes = require('./routes/agent-registration');
        const adminAgentApplicationsRoutes = require('./routes/admin-agent-applications');
        
        this.app.use('/api/auth', agentRegistrationRoutes);
        this.app.use('/api/admin', adminAgentApplicationsRoutes);

        console.log('✅ Test environment initialized');
        return true;
    }

    // Setup test admin user
    async setupTestAdmin() {
        console.log('🔧 Setting up test admin...');
        
        const testAdminData = {
            name: 'Test Admin',
            email: 'test.admin@add.com',
            phone: '+1000000000',
            password: 'TestAdmin123!',
            role: 'admin'
        };

        try {
            const hashedPassword = await bcrypt.hash(testAdminData.password, 10);
            
            const [result] = await this.connection.execute(`
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

    // Test agent types configuration endpoint
    async testAgentTypesConfig() {
        console.log('\n🔧 Testing Agent Types Configuration...');
        
        try {
            const response = await request(this.app)
                .get('/api/auth/agent-types-config')
                .expect(200);

            if (response.body.success && Array.isArray(response.body.data) && response.body.data.length > 0) {
                this.logTest('Agent Types Config Endpoint', 'PASS', { 
                    count: response.body.data.length,
                    types: response.body.data.map(t => t.type_code)
                });
            } else {
                this.logTest('Agent Types Config Endpoint', 'FAIL', 'No agent types returned');
            }
        } catch (error) {
            this.logTest('Agent Types Config Endpoint', 'FAIL', error.message);
        }
    }

    // Test agent registration
    async testAgentRegistration() {
        console.log('\n📝 Testing Agent Registration...');
        
        const registrationData = {
            selectedAgentType: 'pickup_delivery',
            first_name: 'Test',
            last_name: 'Agent',
            email: 'test.agent.system@example.com',
            phone: '+1234567890',
            date_of_birth: '1990-01-01',
            gender: 'male',
            id_type: 'national_id',
            id_number: 'TEST123456789',
            street_address: '123 Test Street',
            city: 'Test City',
            state: 'Test State',
            country: 'Test Country',
            postal_code: '12345',
            latitude: '40.7128',
            longitude: '-74.0060',
            bank_name: 'Test Bank',
            account_number: '1234567890',
            account_holder: 'Test Agent',
            routing_number: '123456789',
            pickup_zone: 'Zone A',
            delivery_zone: 'Zone B',
            transport_capacity: 'medium',
            max_orders_per_trip: '5',
            hasVehicle: 'true',
            vehicle_type: 'motorcycle',
            vehicle_make: 'Honda',
            vehicle_model: 'CB150',
            vehicle_year: '2020',
            vehicle_plate: 'TEST123',
            vehicle_color: 'Red',
            password: 'TestAgent123!',
            confirm_password: 'TestAgent123!'
        };

        try {
            const response = await request(this.app)
                .post('/api/auth/agent-registration')
                .send(registrationData)
                .expect(200);

            if (response.body.success && response.body.data.applicationRef) {
                this.testApplicationRef = response.body.data.applicationRef;
                this.logTest('Agent Registration', 'PASS', { 
                    applicationRef: this.testApplicationRef,
                    status: response.body.data.status
                });
            } else {
                this.logTest('Agent Registration', 'FAIL', response.body.error || 'No application reference returned');
            }
        } catch (error) {
            this.logTest('Agent Registration', 'FAIL', error.message);
        }
    }

    // Test admin endpoints
    async testAdminEndpoints() {
        console.log('\n👨‍💼 Testing Admin Endpoints...');
        
        // Test get all applications
        try {
            const response = await request(this.app)
                .get('/api/admin/agent-applications')
                .set('Authorization', `Bearer ${this.adminToken}`)
                .expect(200);

            if (response.body.success && Array.isArray(response.body.applications)) {
                this.logTest('Admin Get Applications', 'PASS', { 
                    count: response.body.applications.length,
                    pagination: response.body.pagination
                });
                
                // Store test application ID for further tests
                if (response.body.applications.length > 0) {
                    const testApp = response.body.applications.find(app => 
                        app.application_ref === this.testApplicationRef
                    );
                    if (testApp) {
                        this.testApplicationId = testApp.id;
                    }
                }
            } else {
                this.logTest('Admin Get Applications', 'FAIL', 'Invalid response format');
            }
        } catch (error) {
            this.logTest('Admin Get Applications', 'FAIL', error.message);
        }

        // Test get application statistics
        try {
            const response = await request(this.app)
                .get('/api/admin/agent-applications/stats')
                .set('Authorization', `Bearer ${this.adminToken}`)
                .expect(200);

            if (response.body.success && response.body.stats) {
                this.logTest('Admin Get Statistics', 'PASS', response.body.stats);
            } else {
                this.logTest('Admin Get Statistics', 'FAIL', 'Invalid response format');
            }
        } catch (error) {
            this.logTest('Admin Get Statistics', 'FAIL', error.message);
        }

        // Test get single application details
        if (this.testApplicationId) {
            try {
                const response = await request(this.app)
                    .get(`/api/admin/agent-applications/${this.testApplicationId}`)
                    .set('Authorization', `Bearer ${this.adminToken}`)
                    .expect(200);

                if (response.body.success && response.body.application) {
                    this.logTest('Admin Get Application Details', 'PASS', { 
                        applicationId: this.testApplicationId,
                        agentType: response.body.application.agent_type
                    });
                } else {
                    this.logTest('Admin Get Application Details', 'FAIL', 'Invalid response format');
                }
            } catch (error) {
                this.logTest('Admin Get Application Details', 'FAIL', error.message);
            }
        }
    }

    // Test application approval workflow
    async testApprovalWorkflow() {
        console.log('\n✅ Testing Application Approval Workflow...');
        
        if (!this.testApplicationId) {
            this.logTest('Application Approval', 'SKIP', 'No test application ID available');
            return;
        }

        // Test approval
        try {
            const response = await request(this.app)
                .post(`/api/admin/agent-applications/${this.testApplicationId}/approve`)
                .set('Authorization', `Bearer ${this.adminToken}`)
                .send({ notes: 'Test approval - automated test' })
                .expect(200);

            if (response.body.success) {
                this.logTest('Application Approval', 'PASS', { 
                    applicationId: this.testApplicationId,
                    message: response.body.message
                });
                
                // Verify the application status was updated
                await this.verifyApplicationStatus('approved');
                
                // Verify user was activated
                await this.verifyUserActivation();
                
            } else {
                this.logTest('Application Approval', 'FAIL', response.body.error || 'Approval failed');
            }
        } catch (error) {
            this.logTest('Application Approval', 'FAIL', error.message);
        }
    }

    // Test application rejection workflow
    async testRejectionWorkflow() {
        console.log('\n❌ Testing Application Rejection Workflow...');
        
        // Create another test application for rejection
        const rejectionTestData = {
            selectedAgentType: 'fast_delivery',
            first_name: 'Reject',
            last_name: 'Test',
            email: 'reject.test@example.com',
            phone: '+1987654321',
            latitude: '40.7128',
            longitude: '-74.0060',
            password: 'RejectTest123!',
            confirm_password: 'RejectTest123!'
        };

        try {
            // Create application to reject
            const createResponse = await request(this.app)
                .post('/api/auth/agent-registration')
                .send(rejectionTestData);

            if (createResponse.body.success) {
                // Get the application ID
                const appsResponse = await request(this.app)
                    .get('/api/admin/agent-applications')
                    .set('Authorization', `Bearer ${this.adminToken}`);

                const rejectApp = appsResponse.body.applications.find(app => 
                    app.email === rejectionTestData.email
                );

                if (rejectApp) {
                    // Test rejection
                    const rejectResponse = await request(this.app)
                        .post(`/api/admin/agent-applications/${rejectApp.id}/reject`)
                        .set('Authorization', `Bearer ${this.adminToken}`)
                        .send({ 
                            reason: 'incomplete_documents',
                            notes: 'Test rejection - automated test'
                        })
                        .expect(200);

                    if (rejectResponse.body.success) {
                        this.logTest('Application Rejection', 'PASS', { 
                            applicationId: rejectApp.id,
                            reason: 'incomplete_documents'
                        });
                    } else {
                        this.logTest('Application Rejection', 'FAIL', rejectResponse.body.error);
                    }
                } else {
                    this.logTest('Application Rejection', 'FAIL', 'Could not find rejection test application');
                }
            } else {
                this.logTest('Application Rejection', 'FAIL', 'Could not create rejection test application');
            }
        } catch (error) {
            this.logTest('Application Rejection', 'FAIL', error.message);
        }
    }

    // Verify application status
    async verifyApplicationStatus(expectedStatus) {
        try {
            const [applications] = await this.connection.execute(
                'SELECT status FROM agent_applications WHERE id = ?',
                [this.testApplicationId]
            );

            if (applications.length > 0 && applications[0].status === expectedStatus) {
                this.logTest('Application Status Verification', 'PASS', { 
                    expected: expectedStatus,
                    actual: applications[0].status
                });
            } else {
                this.logTest('Application Status Verification', 'FAIL', { 
                    expected: expectedStatus,
                    actual: applications[0]?.status || 'not found'
                });
            }
        } catch (error) {
            this.logTest('Application Status Verification', 'FAIL', error.message);
        }
    }

    // Verify user activation
    async verifyUserActivation() {
        try {
            const [users] = await this.connection.execute(`
                SELECT u.status, u.agent_type, u.agent_status 
                FROM users u
                JOIN agent_applications aa ON u.id = aa.user_id
                WHERE aa.id = ?
            `, [this.testApplicationId]);

            if (users.length > 0) {
                const user = users[0];
                if (user.status === 'active' && user.agent_type && user.agent_status === 'active') {
                    this.logTest('User Activation Verification', 'PASS', { 
                        status: user.status,
                        agentType: user.agent_type,
                        agentStatus: user.agent_status
                    });
                } else {
                    this.logTest('User Activation Verification', 'FAIL', { 
                        status: user.status,
                        agentType: user.agent_type,
                        agentStatus: user.agent_status
                    });
                }
            } else {
                this.logTest('User Activation Verification', 'FAIL', 'User not found');
            }
        } catch (error) {
            this.logTest('User Activation Verification', 'FAIL', error.message);
        }
    }

    // Test authentication and authorization
    async testAuthentication() {
        console.log('\n🔐 Testing Authentication and Authorization...');
        
        // Test without token
        try {
            await request(this.app)
                .get('/api/admin/agent-applications')
                .expect(401);

            this.logTest('Admin Auth - No Token', 'PASS', 'Correctly rejected request without token');
        } catch (error) {
            this.logTest('Admin Auth - No Token', 'FAIL', error.message);
        }

        // Test with invalid token
        try {
            await request(this.app)
                .get('/api/admin/agent-applications')
                .set('Authorization', 'Bearer invalid-token')
                .expect(401);

            this.logTest('Admin Auth - Invalid Token', 'PASS', 'Correctly rejected invalid token');
        } catch (error) {
            this.logTest('Admin Auth - Invalid Token', 'FAIL', error.message);
        }

        // Test with valid admin token
        try {
            await request(this.app)
                .get('/api/admin/agent-applications')
                .set('Authorization', `Bearer ${this.adminToken}`)
                .expect(200);

            this.logTest('Admin Auth - Valid Token', 'PASS', 'Correctly accepted valid admin token');
        } catch (error) {
            this.logTest('Admin Auth - Valid Token', 'FAIL', error.message);
        }
    }

    // Run all tests
    async runAllTests() {
        console.log('🧪 Starting Agent Applications System Tests...\n');
        
        try {
            await this.init();
            await this.setupTestAdmin();
            
            await this.testAgentTypesConfig();
            await this.testAgentRegistration();
            await this.testAuthentication();
            await this.testAdminEndpoints();
            await this.testApprovalWorkflow();
            await this.testRejectionWorkflow();
            
            this.printTestSummary();
            
        } catch (error) {
            console.error('❌ Test suite failed:', error);
            throw error;
        } finally {
            if (this.connection) {
                await this.connection.end();
            }
        }
    }

    // Print test summary
    printTestSummary() {
        console.log('\n📊 Test Summary');
        console.log('================');
        
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(r => r.status === 'PASS').length;
        const failedTests = this.testResults.filter(r => r.status === 'FAIL').length;
        const skippedTests = this.testResults.filter(r => r.status === 'SKIP').length;
        
        console.log(`Total Tests: ${totalTests}`);
        console.log(`✅ Passed: ${passedTests}`);
        console.log(`❌ Failed: ${failedTests}`);
        console.log(`⏭️  Skipped: ${skippedTests}`);
        console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
        
        if (failedTests > 0) {
            console.log('\n❌ Failed Tests:');
            this.testResults
                .filter(r => r.status === 'FAIL')
                .forEach(r => {
                    console.log(`   - ${r.testName}: ${r.details}`);
                });
        }
        
        console.log('\n🎉 Agent Applications System Test Complete!');
        
        if (failedTests === 0) {
            console.log('✅ All tests passed! The system is working correctly.');
        } else {
            console.log(`❌ ${failedTests} test(s) failed. Please review the issues above.`);
        }
    }

    // Cleanup test data
    async cleanup() {
        console.log('\n🧹 Cleaning up test data...');
        
        try {
            if (this.connection) {
                // Delete test applications
                await this.connection.execute(
                    "DELETE FROM agent_applications WHERE email LIKE '%test%' OR email LIKE '%example.com'"
                );
                
                // Delete test users
                await this.connection.execute(
                    "DELETE FROM users WHERE email LIKE '%test%' OR email LIKE '%example.com'"
                );
                
                console.log('✅ Test data cleaned up');
            }
        } catch (error) {
            console.error('❌ Cleanup failed:', error.message);
        }
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const testSuite = new AgentApplicationsSystemTest();
    
    testSuite.runAllTests()
        .then(async () => {
            console.log('\n🔄 Running cleanup...');
            await testSuite.cleanup();
            console.log('✅ Test suite completed successfully');
            process.exit(0);
        })
        .catch(async (error) => {
            console.error('❌ Test suite failed:', error);
            await testSuite.cleanup();
            process.exit(1);
        });
}

module.exports = AgentApplicationsSystemTest;