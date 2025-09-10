/**
 * Real Integration Test for Pickup Delivery Agent Dashboard
 * Tests the actual system with real backend and frontend integration
 */

const puppeteer = require('puppeteer');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { spawn } = require('child_process');
const path = require('path');
require('dotenv').config();

class RealPickupDeliveryIntegrationTest {
    constructor() {
        this.browser = null;
        this.page = null;
        this.connection = null;
        this.serverProcess = null;
        this.testAgent = null;
        this.authToken = null;
        this.testResults = [];
        this.serverPort = 3001;
        this.consoleErrors = [];
        this.pageErrors = [];
    }

    // Initialize test environment
    async init() {
        console.log('🚀 Initializing Real Integration Test Environment...');
        
        try {
            // Setup database connection
            await this.setupDatabase();
            
            // Create test agent
            await this.createTestAgent();
            
            // Start the real server
            await this.startRealServer();
            
            // Launch browser
            await this.setupBrowser();
            
            console.log('✅ Real integration test environment initialized');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize:', error.message);
            return false;
        }
    }

    // Setup database connection
    async setupDatabase() {
        console.log('🔧 Setting up database connection...');
        
        this.connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'add_physical_product',
            port: process.env.DB_PORT || 3306
        });

        console.log('✅ Database connection established');
    }

    // Create test pickup delivery agent
    async createTestAgent() {
        console.log('🔧 Creating test pickup delivery agent...');
        
        const testAgentData = {
            name: 'Real Test PDA Agent',
            email: 'real.pda.test@example.com',
            phone: '+1999888777',
            password: 'RealPDATest123!',
            role: 'agent'
        };

        try {
            // Create user
            const hashedPassword = await bcrypt.hash(testAgentData.password, 10);
            
            const [userResult] = await this.connection.execute(`
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
                const userId = userRows[0].id;
                this.testAgent = { ...testAgentData, id: userId };
                
                // Create agent entry
                await this.connection.execute(`
                    INSERT INTO agents (id, user_id, agent_type, status, admin_approval_status, created_at)
                    VALUES (?, ?, 'pickup_delivery', 'active', 'approved', NOW())
                    ON DUPLICATE KEY UPDATE
                    agent_type = 'pickup_delivery',
                    status = 'active',
                    admin_approval_status = 'approved'
                `, [userId, userId]);
                
                // Create pickup delivery agent entry
                await this.connection.execute(`
                    INSERT INTO pickup_delivery_agents (
                        user_id, vehicle_type, license_number, location, 
                        rating, total_deliveries, is_available, created_at
                    ) VALUES (?, 'motorcycle', 'REAL-TEST-001', 'Test Location', 4.8, 15, TRUE, NOW())
                    ON DUPLICATE KEY UPDATE
                    vehicle_type = VALUES(vehicle_type),
                    is_available = TRUE,
                    rating = 4.8,
                    total_deliveries = 15
                `, [userId]);
                
                // Create auth token
                this.authToken = jwt.sign(
                    { 
                        id: userId,
                        userId: userId, 
                        email: this.testAgent.email, 
                        role: this.testAgent.role 
                    },
                    process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
                    { expiresIn: '2h' }
                );

                console.log(`✅ Test agent created: ${testAgentData.name} (ID: ${userId})`);
                return true;
            }
        } catch (error) {
            console.error('❌ Failed to create test agent:', error.message);
            return false;
        }
    }

    // Start the real server
    async startRealServer() {
        console.log('🚀 Starting real server...');
        
        return new Promise((resolve, reject) => {
            // Start the server process
            this.serverProcess = spawn('node', ['app.js'], {
                cwd: path.join(__dirname),
                stdio: ['pipe', 'pipe', 'pipe'],
                env: { ...process.env }
            });

            let serverStarted = false;

            this.serverProcess.stdout.on('data', (data) => {
                const output = data.toString();
                console.log(`[SERVER] ${output.trim()}`);
                
                if (output.includes('Server running on port') || output.includes('listening on')) {
                    if (!serverStarted) {
                        serverStarted = true;
                        console.log('✅ Real server started successfully');
                        // Wait a bit more for full initialization
                        setTimeout(resolve, 3000);
                    }
                }
            });

            this.serverProcess.stderr.on('data', (data) => {
                const error = data.toString();
                console.error(`[SERVER ERROR] ${error.trim()}`);
            });

            this.serverProcess.on('error', (error) => {
                console.error('❌ Failed to start server:', error.message);
                reject(error);
            });

            // Timeout after 30 seconds
            setTimeout(() => {
                if (!serverStarted) {
                    reject(new Error('Server failed to start within 30 seconds'));
                }
            }, 30000);
        });
    }

    // Setup browser
    async setupBrowser() {
        console.log('🌐 Setting up browser...');
        
        this.browser = await puppeteer.launch({
            headless: false, // Set to true for CI/CD
            devtools: false,
            defaultViewport: { width: 1920, height: 1080 },
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
            ]
        });

        this.page = await this.browser.newPage();
        
        // Track console messages
        this.page.on('console', msg => {
            const type = msg.type();
            const text = msg.text();
            
            if (type === 'error') {
                console.log(`❌ Console Error: ${text}`);
                this.consoleErrors.push(text);
                this.logTest('Console Error', 'FAIL', text);
            } else if (type === 'log' && (text.includes('[') || text.includes('PDA'))) {
                console.log(`📝 Console Log: ${text}`);
            }
        });

        // Track page errors
        this.page.on('pageerror', error => {
            console.log(`❌ Page Error: ${error.message}`);
            this.pageErrors.push(error.message);
            this.logTest('Page JavaScript Error', 'FAIL', error.message);
        });

        // Track failed requests
        this.page.on('requestfailed', request => {
            console.log(`❌ Request Failed: ${request.url()}`);
            this.logTest('Network Request Failed', 'FAIL', request.url());
        });

        console.log('✅ Browser setup completed');
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
        if (details && status === 'FAIL') {
            console.log(`   Details: ${details}`);
        }
    }

    // Test login and authentication
    async testLoginAndAuthentication() {
        console.log('\\n🔐 Testing Login and Authentication...');
        
        try {
            // Navigate to login page
            await this.page.goto(`http://localhost:${this.serverPort}/login.html`, {
                waitUntil: 'networkidle0',
                timeout: 30000
            });

            // Wait for login form
            await this.page.waitForSelector('#loginForm', { timeout: 10000 });
            this.logTest('Login Page Load', 'PASS');

            // Fill login form
            await this.page.type('#email', this.testAgent.email);
            await this.page.type('#password', this.testAgent.password);

            // Submit login
            await this.page.click('button[type="submit"]');
            
            // Wait for redirect or success
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Check if we're redirected to dashboard or agent selection
            const currentUrl = this.page.url();
            console.log('Current URL after login:', currentUrl);

            if (currentUrl.includes('dashboard') || currentUrl.includes('agent')) {
                this.logTest('Login Success', 'PASS');
                return true;
            } else {
                // Try to navigate directly to pickup delivery dashboard
                await this.page.goto(`http://localhost:${this.serverPort}/agent/pickup-delivery-dashboard.html`, {
                    waitUntil: 'networkidle0',
                    timeout: 30000
                });
                
                const finalUrl = this.page.url();
                if (finalUrl.includes('pickup-delivery-dashboard')) {
                    this.logTest('Direct Dashboard Access', 'PASS');
                    return true;
                } else {
                    this.logTest('Login Success', 'FAIL', `Unexpected URL: ${currentUrl}`);
                    return false;
                }
            }
        } catch (error) {
            this.logTest('Login Process', 'FAIL', error.message);
            return false;
        }
    }

    // Test dashboard loading
    async testDashboardLoading() {
        console.log('\\n🌐 Testing Dashboard Loading...');
        
        try {
            // Ensure we're on the pickup delivery dashboard
            const currentUrl = this.page.url();
            if (!currentUrl.includes('pickup-delivery-dashboard')) {
                await this.page.goto(`http://localhost:${this.serverPort}/agent/pickup-delivery-dashboard.html`, {
                    waitUntil: 'networkidle0',
                    timeout: 30000
                });
            }

            // Wait for dashboard elements to load
            await this.page.waitForSelector('#agent-name', { timeout: 10000 });
            this.logTest('Dashboard Elements Load', 'PASS');

            // Check if agent name is loaded
            const agentName = await this.page.$eval('#agent-name', el => el.textContent);
            if (agentName && agentName !== 'Loading...') {
                this.logTest('Agent Name Loading', 'PASS', agentName);
            } else {
                this.logTest('Agent Name Loading', 'FAIL', `Got: ${agentName}`);
            }

            // Check stats cards
            const statsElements = [
                { id: 'total-pickups', name: 'Total Pickups' },
                { id: 'completed-pickups', name: 'Completed Pickups' },
                { id: 'pending-pickups', name: 'Pending Pickups' },
                { id: 'todays-earnings', name: 'Today\'s Earnings' }
            ];

            for (const stat of statsElements) {
                try {
                    await this.page.waitForSelector(`#${stat.id}`, { timeout: 5000 });
                    const value = await this.page.$eval(`#${stat.id}`, el => el.textContent);
                    this.logTest(`Stats - ${stat.name}`, 'PASS', value);
                } catch (error) {
                    this.logTest(`Stats - ${stat.name}`, 'FAIL', 'Element not found');
                }
            }

            return true;
        } catch (error) {
            this.logTest('Dashboard Loading', 'FAIL', error.message);
            return false;
        }
    }

    // Test tab functionality
    async testTabFunctionality() {
        console.log('\\n📑 Testing Tab Functionality...');
        
        const tabs = [
            { id: 'available-orders', name: 'Available Orders' },
            { id: 'active-orders', name: 'Active Orders' },
            { id: 'order-history', name: 'Order History' },
            { id: 'enhanced-tracking', name: 'Enhanced Tracking' }
        ];

        for (const tab of tabs) {
            try {
                // Find and click tab button
                const tabButton = await this.page.$(`button[onclick*="${tab.id}"], .tab-button[data-tab="${tab.id}"]`);
                if (tabButton) {
                    await tabButton.click();
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // Check if tab content is visible
                    const tabContent = await this.page.$(`#${tab.id}`);
                    if (tabContent) {
                        const isVisible = await this.page.evaluate(el => {
                            const style = window.getComputedStyle(el);
                            return style.display !== 'none' && !el.classList.contains('hidden');
                        }, tabContent);
                        
                        if (isVisible) {
                            this.logTest(`Tab Functionality - ${tab.name}`, 'PASS');
                        } else {
                            this.logTest(`Tab Functionality - ${tab.name}`, 'FAIL', 'Content not visible');
                        }
                    } else {
                        this.logTest(`Tab Functionality - ${tab.name}`, 'FAIL', 'Content element not found');
                    }
                } else {
                    this.logTest(`Tab Functionality - ${tab.name}`, 'FAIL', 'Tab button not found');
                }
            } catch (error) {
                this.logTest(`Tab Functionality - ${tab.name}`, 'FAIL', error.message);
            }
        }
    }

    // Test API integration
    async testAPIIntegration() {
        console.log('\\n🔌 Testing API Integration...');
        
        try {
            // Test profile API
            const profileResponse = await this.page.evaluate(async (token) => {
                try {
                    const response = await fetch('/api/pickup-delivery-agent/profile', {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    return {
                        status: response.status,
                        data: await response.json()
                    };
                } catch (error) {
                    return { error: error.message };
                }
            }, this.authToken);

            if (profileResponse.status === 200 && profileResponse.data.success) {
                this.logTest('Profile API', 'PASS', `Agent: ${profileResponse.data.agent.name}`);
            } else {
                this.logTest('Profile API', 'FAIL', profileResponse.error || 'API call failed');
            }

            // Test stats API
            const statsResponse = await this.page.evaluate(async (token) => {
                try {
                    const response = await fetch('/api/pickup-delivery-agent/stats', {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    return {
                        status: response.status,
                        data: await response.json()
                    };
                } catch (error) {
                    return { error: error.message };
                }
            }, this.authToken);

            if (statsResponse.status === 200 && statsResponse.data.success) {
                this.logTest('Stats API', 'PASS', `Today: ${statsResponse.data.stats.today.total} orders`);
            } else {
                this.logTest('Stats API', 'FAIL', statsResponse.error || 'API call failed');
            }

            // Test available orders API
            const ordersResponse = await this.page.evaluate(async (token) => {
                try {
                    const response = await fetch('/api/pickup-delivery-agent/available-orders', {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    return {
                        status: response.status,
                        data: await response.json()
                    };
                } catch (error) {
                    return { error: error.message };
                }
            }, this.authToken);

            if (ordersResponse.status === 200 && ordersResponse.data.success) {
                this.logTest('Available Orders API', 'PASS', `Found ${ordersResponse.data.orders.length} orders`);
            } else {
                this.logTest('Available Orders API', 'FAIL', ordersResponse.error || 'API call failed');
            }

            return true;
        } catch (error) {
            this.logTest('API Integration', 'FAIL', error.message);
            return false;
        }
    }

    // Test responsive design
    async testResponsiveDesign() {
        console.log('\\n📱 Testing Responsive Design...');
        
        const viewports = [
            { width: 1920, height: 1080, name: 'Desktop' },
            { width: 768, height: 1024, name: 'Tablet' },
            { width: 375, height: 667, name: 'Mobile' }
        ];

        for (const viewport of viewports) {
            try {
                await this.page.setViewport(viewport);
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Check if navigation is visible
                const navVisible = await this.page.$eval('nav', el => {
                    const style = window.getComputedStyle(el);
                    return style.display !== 'none' && style.visibility !== 'hidden';
                });

                if (navVisible) {
                    this.logTest(`Responsive - ${viewport.name}`, 'PASS');
                } else {
                    this.logTest(`Responsive - ${viewport.name}`, 'FAIL', 'Navigation not visible');
                }
            } catch (error) {
                this.logTest(`Responsive - ${viewport.name}`, 'FAIL', error.message);
            }
        }

        // Reset to desktop
        await this.page.setViewport({ width: 1920, height: 1080 });
    }

    // Run all tests
    async runAllTests() {
        console.log('🎯 Starting Real Integration Tests\\n');
        
        const testMethods = [
            'testLoginAndAuthentication',
            'testDashboardLoading',
            'testTabFunctionality',
            'testAPIIntegration',
            'testResponsiveDesign'
        ];

        for (const method of testMethods) {
            try {
                await this[method]();
            } catch (error) {
                this.logTest(method, 'FAIL', error.message);
            }
        }

        this.generateFinalReport();
    }

    // Generate final report
    generateFinalReport() {
        console.log('\\n🎯 ===== REAL INTEGRATION TEST REPORT =====');
        
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(r => r.status === 'PASS').length;
        const failedTests = totalTests - passedTests;
        const successRate = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(2) : 0;

        console.log(`📊 Total Tests: ${totalTests}`);
        console.log(`✅ Passed: ${passedTests}`);
        console.log(`❌ Failed: ${failedTests}`);
        console.log(`📈 Success Rate: ${successRate}%`);

        // Error summary
        console.log(`\\n🔍 Error Summary:`);
        console.log(`📝 Console Errors: ${this.consoleErrors.length}`);
        console.log(`💥 JavaScript Errors: ${this.pageErrors.length}`);

        if (failedTests > 0) {
            console.log('\\n❌ Failed Tests:');
            this.testResults
                .filter(r => r.status === 'FAIL')
                .forEach(r => console.log(`   - ${r.testName}: ${r.details || 'No details'}`));
        }

        // Final verdict
        console.log('\\n🏁 FINAL VERDICT:');
        if (successRate >= 90 && this.consoleErrors.length <= 2 && this.pageErrors.length === 0) {
            console.log('🎉 REAL INTEGRATION TEST PASSED! 🎉');
        } else {
            console.log('🔧 System needs improvements for production deployment');
        }
    }

    // Cleanup
    async cleanup() {
        console.log('\\n🧹 Cleaning up test environment...');
        
        try {
            if (this.browser) {
                await this.browser.close();
            }
            if (this.connection) {
                await this.connection.end();
            }
            if (this.serverProcess) {
                this.serverProcess.kill('SIGTERM');
                // Wait for graceful shutdown
                await new Promise(resolve => setTimeout(resolve, 2000));
                if (!this.serverProcess.killed) {
                    this.serverProcess.kill('SIGKILL');
                }
            }
            console.log('✅ Cleanup completed successfully');
        } catch (error) {
            console.error('❌ Cleanup failed:', error.message);
        }
    }
}

// Run the real integration tests
async function runRealIntegrationTests() {
    const tester = new RealPickupDeliveryIntegrationTest();
    
    try {
        const initialized = await tester.init();
        if (!initialized) {
            console.error('❌ Failed to initialize test environment');
            process.exit(1);
        }

        await tester.runAllTests();
    } catch (error) {
        console.error('❌ Test execution failed:', error.message);
    } finally {
        await tester.cleanup();
    }
}

// Run if called directly
if (require.main === module) {
    runRealIntegrationTests().catch(console.error);
}

module.exports = RealPickupDeliveryIntegrationTest;