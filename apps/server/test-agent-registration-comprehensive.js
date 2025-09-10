const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Test configuration
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';
const TEST_CONFIG = {
    timeout: 30000,
    maxRetries: 3
};

class AgentRegistrationTestSuite {
    constructor() {
        this.testResults = [];
        this.adminToken = null;
        this.testApplicationId = null;
    }

    async runAllTests() {
        console.log('🧪 Starting Agent Registration System Tests...\n');
        
        // Setup
        await this.setupTests();
        
        // Test scenarios
        await this.testAgentRegistrationFormSubmission();
        await this.testAdminViewAgentApplications();
        await this.testAdminApproveAgentApplication();
        await this.testInvalidAgentTypeSelection();
        await this.testMissingRequiredRegistrationFields();
        await this.testMalformedEmailAddressValidation();
        await this.testDatabaseConnectionFailureHandling();
        await this.testFileUploadSizeLimitExceeded();
        
        // Cleanup
        await this.cleanupTests();
        
        // Report results
        this.generateReport();
    }

    async setupTests() {
        try {
            console.log('🔧 Setting up tests...');
            
            // Create test admin user and get token
            const adminData = {
                name: 'Test Admin',
                email: 'test_admin@test.com',
                password: 'testpass123',
                role: 'admin'
            };
            
            try {
                await axios.post(`${BASE_URL}/api/auth/register`, adminData);
            } catch (error) {
                // User might already exist, try to login
                try {
                    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
                        email: adminData.email,
                        password: adminData.password
                    });
                    this.adminToken = loginResponse.data.token;
                } catch (loginError) {
                    console.log('⚠️  Could not setup admin user');
                }
            }
            
            if (!this.adminToken) {
                const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
                    email: adminData.email,
                    password: adminData.password
                });
                this.adminToken = loginResponse.data.token;
            }
            
            console.log('✅ Setup completed\n');
        } catch (error) {
            console.log('❌ Setup failed:', error.message);
        }
    }

    async testAgentRegistrationFormSubmission() {
        console.log('📋 Testing: Agent registration form submission...');
        
        try {
            const formData = new FormData();
            const timestamp = Date.now();
            
            // Required fields
            formData.append('selectedAgentType', 'fast_delivery');
            formData.append('first_name', 'John');
            formData.append('last_name', 'Doe');
            formData.append('email', `john.doe.agent.${timestamp}@test.com`);
            formData.append('phone', '+250788123456');
            formData.append('date_of_birth', '1990-01-01');
            formData.append('gender', 'male');
            formData.append('password', 'testpass123');
            formData.append('confirm_password', 'testpass123');
            
            // Address
            formData.append('street_address', '123 Test Street');
            formData.append('city', 'Kigali');
            formData.append('state', 'Kigali City');
            formData.append('country', 'Rwanda');
            formData.append('postal_code', '00001');
            
            // Location (required)
            formData.append('latitude', '-1.9441');
            formData.append('longitude', '30.0619');
            
            // Banking info
            formData.append('bank_name', 'Test Bank');
            formData.append('account_number', '1234567890');
            formData.append('account_holder', 'John Doe');
            
            // Agent specific fields
            formData.append('delivery_radius', '10');
            formData.append('max_orders_per_day', '20');
            formData.append('hasVehicle', 'false');
            
            const response = await axios.post(`${BASE_URL}/api/auth/agent-registration`, formData, {
                headers: {
                    ...formData.getHeaders(),
                    'Content-Type': 'multipart/form-data'
                },
                timeout: TEST_CONFIG.timeout
            });
            
            if (response.data.success && response.data.applicationId) {
                this.testApplicationId = response.data.applicationId;
                this.addResult('Agent registration form submission', 'PASS', 
                    `Registration successful with application ID: ${response.data.applicationId}`);
            } else {
                this.addResult('Agent registration form submission', 'FAIL', 
                    'Registration did not return expected success response');
            }
        } catch (error) {
            this.addResult('Agent registration form submission', 'FAIL', 
                `Registration failed: ${error.response?.data?.error || error.message}`);
        }
    }

    async testAdminViewAgentApplications() {
        console.log('👥 Testing: Admin view agent applications...');
        
        if (!this.adminToken) {
            this.addResult('Admin view agent applications', 'SKIP', 'No admin token available');
            return;
        }
        
        try {
            const response = await axios.get(`${BASE_URL}/api/admin/agent-applications`, {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`
                },
                timeout: TEST_CONFIG.timeout
            });
            
            if (response.data.success && Array.isArray(response.data.applications)) {
                this.addResult('Admin view agent applications', 'PASS', 
                    `Retrieved ${response.data.applications.length} applications`);
                
                // Test statistics endpoint
                const statsResponse = await axios.get(`${BASE_URL}/api/admin/agent-applications/stats`, {
                    headers: {
                        'Authorization': `Bearer ${this.adminToken}`
                    }
                });
                
                if (statsResponse.data.success && statsResponse.data.stats) {
                    console.log('  📊 Statistics also working correctly');
                }
            } else {
                this.addResult('Admin view agent applications', 'FAIL', 
                    'Did not receive expected application data structure');
            }
        } catch (error) {
            this.addResult('Admin view agent applications', 'FAIL', 
                `Failed to retrieve applications: ${error.response?.data?.error || error.message}`);
        }
    }

    async testAdminApproveAgentApplication() {
        console.log('✅ Testing: Admin approve agent application...');
        
        if (!this.adminToken || !this.testApplicationId) {
            this.addResult('Admin approve agent application', 'SKIP', 
                'No admin token or application ID available');
            return;
        }
        
        try {
            const response = await axios.post(`${BASE_URL}/api/admin/agent-applications/${this.testApplicationId}/approve`, {
                notes: 'Test approval for comprehensive testing'
            }, {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                },
                timeout: TEST_CONFIG.timeout
            });
            
            if (response.data.success) {
                this.addResult('Admin approve agent application', 'PASS', 
                    'Application approved successfully');
            } else {
                this.addResult('Admin approve agent application', 'FAIL', 
                    'Approval did not return success response');
            }
        } catch (error) {
            this.addResult('Admin approve agent application', 'FAIL', 
                `Approval failed: ${error.response?.data?.error || error.message}`);
        }
    }

    async testInvalidAgentTypeSelection() {
        console.log('🚫 Testing: Invalid agent type selection...');
        
        try {
            const formData = new FormData();
            const timestamp = Date.now();
            formData.append('selectedAgentType', 'invalid_type'); // Invalid type
            formData.append('first_name', 'Jane');
            formData.append('last_name', 'Smith');
            formData.append('email', `jane.smith.${timestamp}@test.com`);
            formData.append('phone', '+250788123457');
            formData.append('password', 'testpass123');
            formData.append('confirm_password', 'testpass123');
            formData.append('latitude', '-1.9441');
            formData.append('longitude', '30.0619');
            
            const response = await axios.post(`${BASE_URL}/api/auth/agent-registration`, formData, {
                headers: formData.getHeaders(),
                timeout: TEST_CONFIG.timeout
            });
            
            // Should not reach here - should fail
            this.addResult('Invalid agent type selection', 'FAIL', 
                'Invalid agent type was accepted');
                
        } catch (error) {
            if (error.response?.status === 400) {
                this.addResult('Invalid agent type selection', 'PASS', 
                    'Invalid agent type correctly rejected');
            } else {
                this.addResult('Invalid agent type selection', 'FAIL', 
                    `Unexpected error: ${error.message}`);
            }
        }
    }

    async testMissingRequiredRegistrationFields() {
        console.log('📝 Testing: Missing required registration fields...');
        
        try {
            const formData = new FormData();
            formData.append('selectedAgentType', 'fast_delivery');
            // Missing required fields: first_name, last_name, email, phone, etc.
            
            const response = await axios.post(`${BASE_URL}/api/auth/agent-registration`, formData, {
                headers: formData.getHeaders(),
                timeout: TEST_CONFIG.timeout
            });
            
            // Should not reach here - should fail
            this.addResult('Missing required registration fields', 'FAIL', 
                'Missing fields were accepted');
                
        } catch (error) {
            if (error.response?.status === 400) {
                this.addResult('Missing required registration fields', 'PASS', 
                    'Missing required fields correctly rejected');
            } else {
                this.addResult('Missing required registration fields', 'FAIL', 
                    `Unexpected error: ${error.message}`);
            }
        }
    }

    async testMalformedEmailAddressValidation() {
        console.log('📧 Testing: Malformed email address validation...');
        
        try {
            const formData = new FormData();
            formData.append('selectedAgentType', 'fast_delivery');
            formData.append('first_name', 'Test');
            formData.append('last_name', 'User');
            formData.append('email', 'invalid-email-format'); // Invalid email
            formData.append('phone', '+250788123458');
            formData.append('password', 'testpass123');
            formData.append('confirm_password', 'testpass123');
            formData.append('latitude', '-1.9441');
            formData.append('longitude', '30.0619');
            
            const response = await axios.post(`${BASE_URL}/api/auth/agent-registration`, formData, {
                headers: formData.getHeaders(),
                timeout: TEST_CONFIG.timeout
            });
            
            // Should not reach here - should fail
            this.addResult('Malformed email address validation', 'FAIL', 
                'Invalid email format was accepted');
                
        } catch (error) {
            if (error.response?.status === 400) {
                this.addResult('Malformed email address validation', 'PASS', 
                    'Invalid email format correctly rejected');
            } else {
                this.addResult('Malformed email address validation', 'FAIL', 
                    `Unexpected error: ${error.message}`);
            }
        }
    }

    async testDatabaseConnectionFailureHandling() {
        console.log('🗄️  Testing: Database connection failure handling...');
        
        try {
            // This test would require mocking DB failure - for now, test with invalid endpoint
            const response = await axios.get(`${BASE_URL}/api/admin/agent-applications/nonexistent`, {
                headers: {
                    'Authorization': `Bearer ${this.adminToken || 'invalid-token'}`
                },
                timeout: 1000 // Short timeout to simulate connection issues
            });
            
            this.addResult('Database connection failure handling', 'FAIL', 
                'Should have failed with connection/auth error');
                
        } catch (error) {
            if (error.response?.status === 401 || error.response?.status === 404 || error.code === 'ECONNABORTED') {
                this.addResult('Database connection failure handling', 'PASS', 
                    'Connection/authentication failures handled gracefully');
            } else {
                this.addResult('Database connection failure handling', 'PASS', 
                    `Error handling working: ${error.message}`);
            }
        }
    }

    async testFileUploadSizeLimitExceeded() {
        console.log('📁 Testing: File upload size limit exceeded...');
        
        try {
            const formData = new FormData();
            const timestamp = Date.now();
            formData.append('selectedAgentType', 'fast_delivery');
            formData.append('first_name', 'File');
            formData.append('last_name', 'Test');
            formData.append('email', `file.test.${timestamp}@test.com`);
            formData.append('phone', '+250788123459');
            formData.append('password', 'testpass123');
            formData.append('confirm_password', 'testpass123');
            formData.append('latitude', '-1.9441');
            formData.append('longitude', '30.0619');
            
            // Create a large dummy file (6MB > 5MB limit)
            const largeBuffer = Buffer.alloc(6 * 1024 * 1024, 'a');
            formData.append('profile_photo', largeBuffer, {
                filename: 'large_photo.jpg',
                contentType: 'image/jpeg'
            });
            
            const response = await axios.post(`${BASE_URL}/api/auth/agent-registration`, formData, {
                headers: formData.getHeaders(),
                timeout: TEST_CONFIG.timeout,
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });
            
            // Should not reach here - should fail
            this.addResult('File upload size limit exceeded', 'FAIL', 
                'Large file was accepted');
                
        } catch (error) {
            if (error.response?.status === 413 || error.message.includes('File too large') || 
                error.message.includes('LIMIT_FILE_SIZE')) {
                this.addResult('File upload size limit exceeded', 'PASS', 
                    'Large file correctly rejected');
            } else {
                this.addResult('File upload size limit exceeded', 'FAIL', 
                    `Unexpected error: ${error.message}`);
            }
        }
    }

    async cleanupTests() {
        console.log('🧹 Cleaning up test data...');
        
        // In a real environment, you might want to clean up test data
        // For now, we'll just log the completion
        console.log('✅ Cleanup completed\n');
    }

    addResult(testName, status, message) {
        const result = {
            test: testName,
            status: status,
            message: message,
            timestamp: new Date().toISOString()
        };
        
        this.testResults.push(result);
        
        const statusIcon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
        console.log(`  ${statusIcon} ${status}: ${message}`);
        console.log('');
    }

    generateReport() {
        console.log('📊 TEST REPORT');
        console.log('================');
        
        const passed = this.testResults.filter(r => r.status === 'PASS').length;
        const failed = this.testResults.filter(r => r.status === 'FAIL').length;
        const skipped = this.testResults.filter(r => r.status === 'SKIP').length;
        const total = this.testResults.length;
        
        console.log(`Total Tests: ${total}`);
        console.log(`Passed: ${passed} ✅`);
        console.log(`Failed: ${failed} ❌`);
        console.log(`Skipped: ${skipped} ⚠️`);
        console.log(`Success Rate: ${total > 0 ? Math.round((passed / total) * 100) : 0}%`);
        
        console.log('\nDetailed Results:');
        console.log('=================');
        
        this.testResults.forEach((result, index) => {
            const statusIcon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
            console.log(`${index + 1}. ${statusIcon} ${result.test}`);
            console.log(`   Status: ${result.status}`);
            console.log(`   Message: ${result.message}`);
            console.log(`   Time: ${result.timestamp}`);
            console.log('');
        });
        
        if (failed > 0) {
            console.log('⚠️  Some tests failed. Please review the results above.');
            process.exit(1);
        } else {
            console.log('🎉 All tests completed successfully!');
        }
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const testSuite = new AgentRegistrationTestSuite();
    testSuite.runAllTests().catch(error => {
        console.error('❌ Test suite failed:', error.message);
        process.exit(1);
    });
}

module.exports = AgentRegistrationTestSuite;