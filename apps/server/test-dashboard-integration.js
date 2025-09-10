/**
 * Test Dashboard Integration with Agent Applications
 * This script tests that the dashboard properly loads agent applications data
 */

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
require('dotenv').config();

class DashboardIntegrationTest {
    constructor() {
        this.app = null;
        this.connection = null;
        this.testAdmin = null;
        this.adminToken = null;
    }

    // Initialize test environment
    async init() {
        console.log('🚀 Initializing Dashboard Integration Test...');
        
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
        this.app.use('/api/admin', adminAgentApplicationsRoutes);

        console.log('✅ Test environment initialized');
        return true;
    }

    // Setup test admin user
    async setupTestAdmin() {
        console.log('🔧 Setting up test admin...');
        
        const testAdminData = {
            name: 'Dashboard Test Admin',
            email: 'dashboard.test.admin@add.com',
            phone: '+1000000001',
            password: 'DashboardTest123!',
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

    // Create test applications for testing
    async createTestApplications() {
        console.log('📝 Creating test applications...');
        
        const testApplications = [
            {
                agent_type: 'fast_delivery',
                status: 'pending',
                first_name: 'John',
                last_name: 'Doe',
                email: 'john.doe@test.com',
                phone: '+1234567890'
            },
            {
                agent_type: 'pickup_delivery',
                status: 'pending',
                first_name: 'Jane',
                last_name: 'Smith',
                email: 'jane.smith@test.com',
                phone: '+1234567891'
            },
            {
                agent_type: 'site_manager',
                status: 'approved',
                first_name: 'Bob',
                last_name: 'Johnson',
                email: 'bob.johnson@test.com',
                phone: '+1234567892'
            }
        ];

        try {
            for (const app of testApplications) {
                const applicationRef = `TEST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                
                await this.connection.execute(`
                    INSERT INTO agent_applications (
                        application_ref, agent_type, status, first_name, last_name, 
                        email, phone, latitude, longitude, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 40.7128, -74.0060, NOW())
                `, [applicationRef, app.agent_type, app.status, app.first_name, app.last_name, app.email, app.phone]);
            }
            
            console.log(`✅ Created ${testApplications.length} test applications`);
            return true;
        } catch (error) {
            console.error('❌ Failed to create test applications:', error.message);
            return false;
        }
    }

    // Test agent applications stats endpoint
    async testAgentApplicationsStats() {
        console.log('\n📊 Testing Agent Applications Stats Endpoint...');
        
        try {
            const response = await request(this.app)
                .get('/api/admin/agent-applications/stats')
                .set('Authorization', `Bearer ${this.adminToken}`)
                .expect(200);

            if (response.body.success && response.body.stats) {
                const stats = response.body.stats;
                console.log('✅ Agent Applications Stats:', {
                    total: stats.total,
                    pending: stats.pending,
                    approved: stats.approved,
                    rejected: stats.rejected,
                    today: stats.today,
                    week: stats.week,
                    month: stats.month
                });
                
                // Verify we have some data
                if (stats.total > 0) {
                    console.log('✅ Stats endpoint working correctly with data');
                    return true;
                } else {
                    console.log('⚠️  Stats endpoint working but no data found');
                    return true;
                }
            } else {
                console.log('❌ Invalid response format from stats endpoint');
                return false;
            }
        } catch (error) {
            console.error('❌ Agent Applications Stats test failed:', error.message);
            return false;
        }
    }

    // Test dashboard integration
    async testDashboardIntegration() {
        console.log('\n🔗 Testing Dashboard Integration...');
        
        // Test that the stats endpoint returns the expected format for dashboard
        try {
            const response = await request(this.app)
                .get('/api/admin/agent-applications/stats')
                .set('Authorization', `Bearer ${this.adminToken}`)
                .expect(200);

            if (response.body.success && response.body.stats) {
                const stats = response.body.stats;
                
                // Check required fields for dashboard
                const requiredFields = ['total', 'pending', 'approved', 'rejected'];
                const hasAllFields = requiredFields.every(field => stats.hasOwnProperty(field));
                
                if (hasAllFields) {
                    console.log('✅ Dashboard integration format correct');
                    console.log('   - Total applications:', stats.total);
                    console.log('   - Pending applications:', stats.pending);
                    console.log('   - Approved applications:', stats.approved);
                    console.log('   - Rejected applications:', stats.rejected);
                    return true;
                } else {
                    console.log('❌ Missing required fields for dashboard integration');
                    console.log('   Required:', requiredFields);
                    console.log('   Available:', Object.keys(stats));
                    return false;
                }
            } else {
                console.log('❌ Invalid response format');
                return false;
            }
        } catch (error) {
            console.error('❌ Dashboard integration test failed:', error.message);
            return false;
        }
    }

    // Test authentication
    async testAuthentication() {
        console.log('\n🔐 Testing Authentication...');
        
        // Test without token
        try {
            await request(this.app)
                .get('/api/admin/agent-applications/stats')
                .expect(401);
            console.log('✅ Correctly rejected request without token');
        } catch (error) {
            console.log('❌ Authentication test failed:', error.message);
            return false;
        }

        // Test with invalid token
        try {
            await request(this.app)
                .get('/api/admin/agent-applications/stats')
                .set('Authorization', 'Bearer invalid-token')
                .expect(401);
            console.log('✅ Correctly rejected invalid token');
        } catch (error) {
            console.log('❌ Authentication test failed:', error.message);
            return false;
        }

        // Test with valid token
        try {
            await request(this.app)
                .get('/api/admin/agent-applications/stats')
                .set('Authorization', `Bearer ${this.adminToken}`)
                .expect(200);
            console.log('✅ Correctly accepted valid admin token');
            return true;
        } catch (error) {
            console.log('❌ Authentication test failed:', error.message);
            return false;
        }
    }

    // Run all tests
    async runAllTests() {
        console.log('🧪 Starting Dashboard Integration Tests...\n');
        
        let allTestsPassed = true;
        
        try {
            await this.init();
            await this.setupTestAdmin();
            await this.createTestApplications();
            
            const authTest = await this.testAuthentication();
            const statsTest = await this.testAgentApplicationsStats();
            const integrationTest = await this.testDashboardIntegration();
            
            allTestsPassed = authTest && statsTest && integrationTest;
            
            console.log('\n📊 Test Results Summary');
            console.log('========================');
            console.log(`Authentication: ${authTest ? '✅ PASS' : '❌ FAIL'}`);
            console.log(`Stats Endpoint: ${statsTest ? '✅ PASS' : '❌ FAIL'}`);
            console.log(`Dashboard Integration: ${integrationTest ? '✅ PASS' : '❌ FAIL'}`);
            
            if (allTestsPassed) {
                console.log('\n🎉 All tests passed! Dashboard integration is working correctly.');
                console.log('\n📋 Next Steps:');
                console.log('   1. Start your server: npm start');
                console.log('   2. Access admin dashboard: http://localhost:3001/admin/dashboard.html');
                console.log('   3. Check that Agent Applications appears in sidebar');
                console.log('   4. Verify the stats card shows correct data');
                console.log('   5. Click on Agent Applications to access the management page');
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
                // Delete test applications
                await this.connection.execute(
                    "DELETE FROM agent_applications WHERE email LIKE '%test.com' OR application_ref LIKE 'TEST-%'"
                );
                
                // Delete test admin
                await this.connection.execute(
                    "DELETE FROM users WHERE email = 'dashboard.test.admin@add.com'"
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
    const testSuite = new DashboardIntegrationTest();
    
    testSuite.runAllTests()
        .then((success) => {
            process.exit(success ? 0 : 1);
        })
        .catch((error) => {
            console.error('❌ Test suite failed:', error);
            process.exit(1);
        });
}

module.exports = DashboardIntegrationTest;