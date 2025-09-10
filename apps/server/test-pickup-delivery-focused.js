/**
 * Focused Test for Pickup Delivery Agent Dashboard Issues
 * Addresses the specific 404 errors and login/access issues
 */

const puppeteer = require('puppeteer');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

class FocusedPickupDeliveryTest {
    constructor() {
        this.browser = null;
        this.page = null;
        this.connection = null;
        this.testAgent = null;
        this.testResults = [];
        this.serverPort = 3001;
    }

    // Initialize test environment
    async init() {
        console.log('🚀 Initializing Focused Test Environment...');
        
        try {
            // Setup database connection
            this.connection = await mysql.createConnection({
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME || 'add_physical_product',
                port: process.env.DB_PORT || 3306
            });

            // Create test agent
            await this.createTestAgent();
            
            // Launch browser
            this.browser = await puppeteer.launch({
                headless: false,
                devtools: true,
                defaultViewport: { width: 1920, height: 1080 },
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            this.page = await this.browser.newPage();
            
            // Track all requests and responses
            this.page.on('request', request => {
                console.log(`📤 REQUEST: ${request.method()} ${request.url()}`);
            });

            this.page.on('response', response => {
                const status = response.status();
                const url = response.url();
                if (status >= 400) {
                    console.log(`❌ RESPONSE ERROR: ${status} ${url}`);
                } else {
                    console.log(`✅ RESPONSE OK: ${status} ${url}`);
                }
            });

            this.page.on('console', msg => {
                const type = msg.type();
                const text = msg.text();
                console.log(`🖥️ CONSOLE [${type.toUpperCase()}]: ${text}`);
            });

            console.log('✅ Focused test environment initialized');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize:', error.message);
            return false;
        }
    }

    // Create test pickup delivery agent
    async createTestAgent() {
        console.log('🔧 Creating test pickup delivery agent...');
        
        const testAgentData = {
            name: 'Focused Test PDA Agent',
            email: 'focused.pda.test@example.com',
            phone: '+1999777666',
            password: 'FocusedPDATest123!',
            role: 'agent'
        };

        try {
            // Create user
            const hashedPassword = await bcrypt.hash(testAgentData.password, 10);
            
            await this.connection.execute(`
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
                    ) VALUES (?, 'motorcycle', 'FOCUSED-TEST-001', 'Test Location', 4.9, 25, TRUE, NOW())
                    ON DUPLICATE KEY UPDATE
                    vehicle_type = VALUES(vehicle_type),
                    is_available = TRUE,
                    rating = 4.9,
                    total_deliveries = 25
                `, [userId]);

                console.log(`✅ Test agent created: ${testAgentData.name} (ID: ${userId})`);
                return true;
            }
        } catch (error) {
            console.error('❌ Failed to create test agent:', error.message);
            return false;
        }
    }

    // Test complete login flow
    async testCompleteLoginFlow() {
        console.log('\\n🔐 Testing Complete Login Flow...');
        
        try {
            // Step 1: Navigate to login page
            console.log('Step 1: Navigating to login page...');
            await this.page.goto(`http://localhost:${this.serverPort}/login.html`, {
                waitUntil: 'networkidle0',
                timeout: 30000
            });

            // Step 2: Wait for login form
            console.log('Step 2: Waiting for login form...');
            await this.page.waitForSelector('#loginForm', { timeout: 10000 });

            // Step 3: Fill login form
            console.log('Step 3: Filling login form...');
            await this.page.type('#email', this.testAgent.email);
            await this.page.type('#password', this.testAgent.password);

            // Step 4: Submit login
            console.log('Step 4: Submitting login...');
            await this.page.click('button[type="submit"]');
            
            // Step 5: Wait for response
            console.log('Step 5: Waiting for login response...');
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Step 6: Check current URL
            const currentUrl = this.page.url();
            console.log(`Step 6: Current URL after login: ${currentUrl}`);

            // Step 7: Navigate to pickup delivery dashboard
            console.log('Step 7: Navigating to pickup delivery dashboard...');
            await this.page.goto(`http://localhost:${this.serverPort}/agent/pickup-delivery-dashboard.html`, {
                waitUntil: 'networkidle0',
                timeout: 30000
            });

            // Step 8: Check if dashboard loads
            console.log('Step 8: Checking if dashboard loads...');
            const dashboardUrl = this.page.url();
            console.log(`Dashboard URL: ${dashboardUrl}`);

            // Step 9: Wait for dashboard elements
            console.log('Step 9: Waiting for dashboard elements...');
            try {
                await this.page.waitForSelector('#agent-name', { timeout: 10000 });
                console.log('✅ Dashboard loaded successfully');
                return true;
            } catch (error) {
                console.log('❌ Dashboard elements not found');
                
                // Take screenshot for debugging
                await this.page.screenshot({ path: 'dashboard-error.png', fullPage: true });
                console.log('📸 Screenshot saved as dashboard-error.png');
                
                return false;
            }

        } catch (error) {
            console.error('❌ Login flow failed:', error.message);
            return false;
        }
    }

    // Test API endpoints directly
    async testAPIEndpoints() {
        console.log('\\n🔌 Testing API Endpoints Directly...');
        
        // Create JWT token for testing
        const token = jwt.sign(
            { 
                id: this.testAgent.id,
                userId: this.testAgent.id, 
                email: this.testAgent.email, 
                role: this.testAgent.role 
            },
            process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
            { expiresIn: '2h' }
        );

        const apiEndpoints = [
            '/api/pickup-delivery-agent/profile',
            '/api/pickup-delivery-agent/stats',
            '/api/pickup-delivery-agent/available-orders',
            '/api/pickup-delivery-agent/active-orders',
            '/api/pickup-delivery-agent/order-history'
        ];

        for (const endpoint of apiEndpoints) {
            try {
                console.log(`Testing ${endpoint}...`);
                
                const response = await this.page.evaluate(async (url, authToken) => {
                    try {
                        const response = await fetch(url, {
                            headers: {
                                'Authorization': `Bearer ${authToken}`,
                                'Content-Type': 'application/json'
                            }
                        });
                        return {
                            status: response.status,
                            statusText: response.statusText,
                            data: await response.json()
                        };
                    } catch (error) {
                        return { error: error.message };
                    }
                }, endpoint, token);

                if (response.status === 200) {
                    console.log(`✅ ${endpoint}: SUCCESS`);
                    console.log(`   Response: ${JSON.stringify(response.data).substring(0, 100)}...`);
                } else {
                    console.log(`❌ ${endpoint}: FAILED (${response.status} ${response.statusText})`);
                    console.log(`   Error: ${JSON.stringify(response.data)}`);
                }
            } catch (error) {
                console.log(`❌ ${endpoint}: ERROR - ${error.message}`);
            }
        }
    }

    // Test dashboard functionality step by step
    async testDashboardFunctionality() {
        console.log('\\n🎛️ Testing Dashboard Functionality Step by Step...');
        
        try {
            // Ensure we're on the dashboard
            const currentUrl = this.page.url();
            if (!currentUrl.includes('pickup-delivery-dashboard')) {
                await this.page.goto(`http://localhost:${this.serverPort}/agent/pickup-delivery-dashboard.html`, {
                    waitUntil: 'networkidle0',
                    timeout: 30000
                });
            }

            // Test 1: Check if page title is correct
            const title = await this.page.title();
            console.log(`Page title: ${title}`);

            // Test 2: Check if navigation is present
            const nav = await this.page.$('nav');
            console.log(`Navigation present: ${nav ? 'Yes' : 'No'}`);

            // Test 3: Check if agent info section is present
            const agentInfo = await this.page.$('#agent-name');
            console.log(`Agent info present: ${agentInfo ? 'Yes' : 'No'}`);

            // Test 4: Check if stats cards are present
            const statsCards = await this.page.$$('.bg-white.rounded-lg.shadow-md');
            console.log(`Stats cards found: ${statsCards.length}`);

            // Test 5: Check if tabs are present
            const tabs = await this.page.$$('.tab-button');
            console.log(`Tab buttons found: ${tabs.length}`);

            // Test 6: Try to click on each tab
            const tabSelectors = [
                'button[onclick*="available"]',
                'button[onclick*="active"]', 
                'button[onclick*="history"]',
                'button[onclick*="enhanced"]'
            ];

            for (let i = 0; i < tabSelectors.length; i++) {
                try {
                    const tabButton = await this.page.$(tabSelectors[i]);
                    if (tabButton) {
                        console.log(`Tab ${i + 1}: Found and clicking...`);
                        await tabButton.click();
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        console.log(`Tab ${i + 1}: Clicked successfully`);
                    } else {
                        console.log(`Tab ${i + 1}: Button not found`);
                    }
                } catch (error) {
                    console.log(`Tab ${i + 1}: Error - ${error.message}`);
                }
            }

            return true;
        } catch (error) {
            console.error('❌ Dashboard functionality test failed:', error.message);
            return false;
        }
    }

    // Test resource loading
    async testResourceLoading() {
        console.log('\\n📦 Testing Resource Loading...');
        
        const resources = [
            '/shared/universal-navigation.js',
            '/shared/auth-utils.js',
            '/shared/agent-auth-protection.js',
            '/agent/pickup-delivery-dashboard-functions.js'
        ];

        for (const resource of resources) {
            try {
                const response = await this.page.goto(`http://localhost:${this.serverPort}${resource}`, {
                    waitUntil: 'networkidle0',
                    timeout: 10000
                });

                if (response.ok()) {
                    console.log(`✅ ${resource}: Loaded successfully (${response.status()})`);
                } else {
                    console.log(`❌ ${resource}: Failed to load (${response.status()})`);
                }
            } catch (error) {
                console.log(`❌ ${resource}: Error - ${error.message}`);
            }
        }

        // Go back to dashboard
        await this.page.goto(`http://localhost:${this.serverPort}/agent/pickup-delivery-dashboard.html`, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });
    }

    // Run all focused tests
    async runAllTests() {
        console.log('🎯 Starting Focused Integration Tests\\n');
        
        const testMethods = [
            'testCompleteLoginFlow',
            'testResourceLoading',
            'testAPIEndpoints',
            'testDashboardFunctionality'
        ];

        for (const method of testMethods) {
            try {
                await this[method]();
                console.log(`\\n${'='.repeat(60)}\\n`);
            } catch (error) {
                console.error(`❌ ${method} failed:`, error.message);
            }
        }

        console.log('🏁 Focused tests completed');
    }

    // Cleanup
    async cleanup() {
        console.log('\\n🧹 Cleaning up...');
        
        try {
            if (this.browser) {
                await this.browser.close();
            }
            if (this.connection) {
                await this.connection.end();
            }
            console.log('✅ Cleanup completed');
        } catch (error) {
            console.error('❌ Cleanup failed:', error.message);
        }
    }
}

// Run the focused tests
async function runFocusedTests() {
    const tester = new FocusedPickupDeliveryTest();
    
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
    runFocusedTests().catch(console.error);
}

module.exports = FocusedPickupDeliveryTest;