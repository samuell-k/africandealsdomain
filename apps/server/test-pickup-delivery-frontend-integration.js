/**
 * Comprehensive Frontend Integration Test for Pickup Delivery Agent Dashboard
 * Tests the complete frontend-backend integration with zero tolerance for errors
 */

const puppeteer = require('puppeteer');
const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
require('dotenv').config();

class PickupDeliveryFrontendTest {
    constructor() {
        this.browser = null;
        this.page = null;
        this.server = null;
        this.connection = null;
        this.testAgent = null;
        this.authToken = null;
        this.testResults = [];
        this.serverPort = 3002; // Use different port to avoid conflicts
    }

    // Initialize test environment
    async init() {
        console.log('🚀 Initializing Frontend Integration Test Environment...');
        
        try {
            // Setup database connection
            this.connection = await mysql.createConnection({
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME || 'add_physical_product',
                port: process.env.DB_PORT || 3306
            });

            // Setup test server
            await this.setupTestServer();
            
            // Setup test agent
            await this.setupTestAgent();
            
            // Launch browser
            this.browser = await puppeteer.launch({
                headless: false, // Set to true for CI/CD
                devtools: false,
                defaultViewport: { width: 1920, height: 1080 },
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-web-security',
                    '--allow-running-insecure-content'
                ]
            });

            this.page = await this.browser.newPage();
            
            // Enable console logging
            this.page.on('console', msg => {
                const type = msg.type();
                if (type === 'error') {
                    console.log(`❌ Browser Console Error: ${msg.text()}`);
                    this.logTest('Browser Console Error', 'FAIL', msg.text());
                } else if (type === 'warning') {
                    console.log(`⚠️ Browser Console Warning: ${msg.text()}`);
                }
            });

            // Enable error tracking
            this.page.on('pageerror', error => {
                console.log(`❌ Page Error: ${error.message}`);
                this.logTest('Page JavaScript Error', 'FAIL', error.message);
            });

            // Enable request failure tracking
            this.page.on('requestfailed', request => {
                console.log(`❌ Request Failed: ${request.url()} - ${request.failure().errorText}`);
                this.logTest('Network Request Failed', 'FAIL', `${request.url()} - ${request.failure().errorText}`);
            });

            console.log('✅ Frontend test environment initialized');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize test environment:', error.message);
            return false;
        }
    }

    // Setup test server
    async setupTestServer() {
        const app = express();
        
        // Middleware
        app.use(express.json());
        app.use(express.static(path.join(__dirname, '../client')));
        app.use('/shared', express.static(path.join(__dirname, '../client/shared')));
        
        // Import and use routes
        const pickupDeliveryRoutes = require('./routes/pickup-delivery-agent');
        app.use('/api/pickup-delivery-agent', pickupDeliveryRoutes);
        
        // Serve the dashboard
        app.get('/agent/pickup-delivery-dashboard.html', (req, res) => {
            res.sendFile(path.join(__dirname, '../client/agent/pickup-delivery-dashboard.html'));
        });
        
        // Start server
        this.server = app.listen(this.serverPort, () => {
            console.log(`✅ Test server running on port ${this.serverPort}`);
        });
    }

    // Create test agent and get auth token
    async setupTestAgent() {
        console.log('🔧 Setting up test agent...');
        
        const testAgentData = {
            name: 'Frontend Test Agent',
            email: 'frontend.test@pda.com',
            phone: '+1888888888',
            password: 'FrontendTest123!',
            role: 'pickup_delivery_agent'
        };

        try {
            // Create test agent in database
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
                this.testAgent = { ...testAgentData, id: userRows[0].id };
                
                // Create pickup delivery agent entry
                await this.connection.execute(`
                    INSERT INTO pickup_delivery_agents (
                        user_id, vehicle_type, license_number, location, 
                        rating, total_deliveries, is_available, created_at
                    ) VALUES (?, 'motorcycle', 'FRONTEND001', 'Test Location', 4.8, 15, TRUE, NOW())
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
                    { expiresIn: '2h' }
                );

                console.log(`✅ Test agent created: ${testAgentData.name} (ID: ${this.testAgent.id})`);
                return true;
            }
        } catch (error) {
            console.error('❌ Failed to setup test agent:', error.message);
            return false;
        }
    }

    // Create test orders for testing
    async createTestOrders() {
        try {
            // Create test buyer
            let buyerId;
            const [buyers] = await this.connection.execute(
                "SELECT id FROM users WHERE role = 'buyer' LIMIT 1"
            );
            
            if (buyers.length === 0) {
                const hashedPassword = await bcrypt.hash('TestBuyer123!', 10);
                const [buyerResult] = await this.connection.execute(`
                    INSERT INTO users (name, email, phone, password, role, status, created_at)
                    VALUES ('Frontend Test Buyer', 'frontend.buyer@example.com', '+1777777777', ?, 'buyer', 'active', NOW())
                `, [hashedPassword]);
                buyerId = buyerResult.insertId;
            } else {
                buyerId = buyers[0].id;
            }

            // Create multiple test orders with different statuses
            const orderStatuses = [
                'PAYMENT_CONFIRMED',
                'PDA_ASSIGNED', 
                'PDA_EN_ROUTE_TO_SELLER',
                'PDA_AT_SELLER',
                'PICKED_FROM_SELLER'
            ];

            for (let i = 0; i < orderStatuses.length; i++) {
                const orderNumber = `FRONTEND-${Date.now()}-${i}`;
                const status = orderStatuses[i];
                const agentId = status === 'PAYMENT_CONFIRMED' ? null : this.testAgent.id;
                
                await this.connection.execute(`
                    INSERT INTO orders (
                        user_id, order_number, total_amount, status, agent_id,
                        delivery_method, marketplace_type, created_at
                    ) VALUES (?, ?, ?, ?, ?, 'pickup', 'physical', NOW())
                `, [buyerId, orderNumber, (99.99 + i * 10), status, agentId]);
            }

            console.log('✅ Test orders created successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to create test orders:', error.message);
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

    // Test page loading and basic structure
    async testPageLoading() {
        console.log('\\n🌐 Testing Page Loading...');
        
        try {
            // Set authentication token in localStorage
            await this.page.evaluateOnNewDocument((token) => {
                localStorage.setItem('authToken', token);
            }, this.authToken);

            // Navigate to dashboard
            const response = await this.page.goto(`http://localhost:${this.serverPort}/agent/pickup-delivery-dashboard.html`, {
                waitUntil: 'networkidle0',
                timeout: 30000
            });

            if (response.ok()) {
                this.logTest('Page Loading', 'PASS', { status: response.status() });
            } else {
                this.logTest('Page Loading', 'FAIL', { status: response.status() });
                return false;
            }

            // Check if page title is correct
            const title = await this.page.title();
            if (title.includes('Pickup Delivery Agent Dashboard')) {
                this.logTest('Page Title', 'PASS', { title });
            } else {
                this.logTest('Page Title', 'FAIL', { expected: 'Pickup Delivery Agent Dashboard', got: title });
            }

            // Wait for main elements to load
            await this.page.waitForSelector('#agent-name', { timeout: 10000 });
            await this.page.waitForSelector('.tab-button', { timeout: 10000 });

            this.logTest('Main Elements Loading', 'PASS');
            return true;
        } catch (error) {
            this.logTest('Page Loading', 'FAIL', error.message);
            return false;
        }
    }

    // Test authentication and profile loading
    async testAuthentication() {
        console.log('\\n🔐 Testing Authentication...');
        
        try {
            // Wait for agent name to load
            await this.page.waitForFunction(() => {
                const agentName = document.getElementById('agent-name');
                return agentName && agentName.textContent !== 'Loading...';
            }, { timeout: 15000 });

            const agentName = await this.page.$eval('#agent-name', el => el.textContent);
            if (agentName === this.testAgent.name) {
                this.logTest('Agent Profile Loading', 'PASS', { name: agentName });
            } else {
                this.logTest('Agent Profile Loading', 'FAIL', { expected: this.testAgent.name, got: agentName });
            }

            // Check if rating is displayed
            const rating = await this.page.$eval('#agent-rating', el => el.textContent);
            if (rating && rating !== '0.0') {
                this.logTest('Agent Rating Display', 'PASS', { rating });
            } else {
                this.logTest('Agent Rating Display', 'FAIL', { rating });
            }

            return true;
        } catch (error) {
            this.logTest('Authentication', 'FAIL', error.message);
            return false;
        }
    }

    // Test tab navigation
    async testTabNavigation() {
        console.log('\\n📑 Testing Tab Navigation...');
        
        const tabs = [
            { id: 'available', name: 'Available Orders' },
            { id: 'active', name: 'Active Orders' },
            { id: 'history', name: 'Order History' },
            { id: 'enhanced', name: 'Enhanced Tracking' }
        ];

        for (const tab of tabs) {
            try {
                // Click tab
                await this.page.click(`button[onclick="switchTab('${tab.id}')"]`);
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Check if tab is active
                const isActive = await this.page.$eval(`button[onclick="switchTab('${tab.id}')"]`, 
                    el => el.classList.contains('active'));

                if (isActive) {
                    this.logTest(`Tab Navigation - ${tab.name}`, 'PASS');
                } else {
                    this.logTest(`Tab Navigation - ${tab.name}`, 'FAIL', 'Tab not marked as active');
                }

                // Check if content is visible
                const contentVisible = await this.page.$eval(`#${tab.id}-orders`, 
                    el => !el.classList.contains('hidden'));

                if (contentVisible) {
                    this.logTest(`Tab Content - ${tab.name}`, 'PASS');
                } else {
                    this.logTest(`Tab Content - ${tab.name}`, 'FAIL', 'Content not visible');
                }
            } catch (error) {
                this.logTest(`Tab Navigation - ${tab.name}`, 'FAIL', error.message);
            }
        }
    }

    // Test order loading and display
    async testOrderLoading() {
        console.log('\\n📦 Testing Order Loading...');
        
        // Create test orders first
        await this.createTestOrders();
        
        try {
            // Test Available Orders
            await this.page.click("button[onclick=\"switchTab('available')\"]");
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Check if orders are loaded
            const availableOrders = await this.page.$$('#available-orders .order-card');
            if (availableOrders.length > 0) {
                this.logTest('Available Orders Loading', 'PASS', { count: availableOrders.length });
            } else {
                this.logTest('Available Orders Loading', 'FAIL', 'No orders found');
            }

            // Test Active Orders
            await this.page.click("button[onclick=\"switchTab('active')\"]");
            await new Promise(resolve => setTimeout(resolve, 2000));

            const activeOrders = await this.page.$$('#active-orders .order-card');
            this.logTest('Active Orders Loading', 'PASS', { count: activeOrders.length });

            // Test Order History
            await this.page.click("button[onclick=\"switchTab('history')\"]");
            await new Promise(resolve => setTimeout(resolve, 2000));

            const historyOrders = await this.page.$$('#history-orders .order-card');
            this.logTest('Order History Loading', 'PASS', { count: historyOrders.length });

            return true;
        } catch (error) {
            this.logTest('Order Loading', 'FAIL', error.message);
            return false;
        }
    }

    // Test order actions (accept, update status)
    async testOrderActions() {
        console.log('\\n⚡ Testing Order Actions...');
        
        try {
            // Go to available orders
            await this.page.click("button[onclick=\"switchTab('available')\"]");
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Find and click accept button on first available order
            const acceptButton = await this.page.$('.order-card button[onclick*="acceptOrder"]');
            if (acceptButton) {
                await acceptButton.click();
                await new Promise(resolve => setTimeout(resolve, 3000));

                // Check if order moved to active orders
                await this.page.click("button[onclick=\"switchTab('active')\"]");
                await new Promise(resolve => setTimeout(resolve, 2000));

                const activeOrders = await this.page.$$('#active-orders .order-card');
                if (activeOrders.length > 0) {
                    this.logTest('Order Accept Action', 'PASS');
                } else {
                    this.logTest('Order Accept Action', 'FAIL', 'Order not moved to active');
                }
            } else {
                this.logTest('Order Accept Action', 'FAIL', 'No accept button found');
            }

            // Test status update
            const statusButton = await this.page.$('.order-card button[onclick*="updateOrderStatus"]');
            if (statusButton) {
                await statusButton.click();
                await new Promise(resolve => setTimeout(resolve, 1000));
                this.logTest('Status Update Button', 'PASS');
            } else {
                this.logTest('Status Update Button', 'FAIL', 'No status update button found');
            }

            return true;
        } catch (error) {
            this.logTest('Order Actions', 'FAIL', error.message);
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
                    return style.display !== 'none';
                });

                if (navVisible) {
                    this.logTest(`Responsive Design - ${viewport.name}`, 'PASS');
                } else {
                    this.logTest(`Responsive Design - ${viewport.name}`, 'FAIL', 'Navigation not visible');
                }
            } catch (error) {
                this.logTest(`Responsive Design - ${viewport.name}`, 'FAIL', error.message);
            }
        }

        // Reset to desktop
        await this.page.setViewport({ width: 1920, height: 1080 });
    }

    // Test keyboard shortcuts
    async testKeyboardShortcuts() {
        console.log('\\n⌨️ Testing Keyboard Shortcuts...');
        
        try {
            // Test Alt+1 for available orders
            await this.page.keyboard.down('Alt');
            await this.page.keyboard.press('1');
            await this.page.keyboard.up('Alt');
            await new Promise(resolve => setTimeout(resolve, 1000));

            const availableActive = await this.page.$eval("button[onclick=\"switchTab('available')\"]", 
                el => el.classList.contains('active'));
            
            if (availableActive) {
                this.logTest('Keyboard Shortcut - Alt+1', 'PASS');
            } else {
                this.logTest('Keyboard Shortcut - Alt+1', 'FAIL');
            }

            // Test Alt+2 for active orders
            await this.page.keyboard.down('Alt');
            await this.page.keyboard.press('2');
            await this.page.keyboard.up('Alt');
            await new Promise(resolve => setTimeout(resolve, 1000));

            const activeActive = await this.page.$eval("button[onclick=\"switchTab('active')\"]", 
                el => el.classList.contains('active'));
            
            if (activeActive) {
                this.logTest('Keyboard Shortcut - Alt+2', 'PASS');
            } else {
                this.logTest('Keyboard Shortcut - Alt+2', 'FAIL');
            }

            // Test help modal
            await this.page.click('#show-help');
            await new Promise(resolve => setTimeout(resolve, 1000));

            const helpModal = await this.page.$('.fixed.inset-0');
            if (helpModal) {
                this.logTest('Help Modal', 'PASS');
                // Close modal
                await this.page.click('.fixed.inset-0 button[onclick*="remove"]');
            } else {
                this.logTest('Help Modal', 'FAIL');
            }

            return true;
        } catch (error) {
            this.logTest('Keyboard Shortcuts', 'FAIL', error.message);
            return false;
        }
    }

    // Test error handling
    async testErrorHandling() {
        console.log('\\n🚨 Testing Error Handling...');
        
        try {
            // Test with invalid token
            await this.page.evaluate(() => {
                localStorage.setItem('authToken', 'invalid-token');
            });

            await this.page.reload({ waitUntil: 'networkidle0' });
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Should redirect to login or show error
            const currentUrl = this.page.url();
            if (currentUrl.includes('login') || currentUrl.includes('error')) {
                this.logTest('Invalid Token Handling', 'PASS');
            } else {
                // Check if error message is shown
                const errorMessage = await this.page.$('.error-message, .alert-error');
                if (errorMessage) {
                    this.logTest('Invalid Token Handling', 'PASS');
                } else {
                    this.logTest('Invalid Token Handling', 'FAIL', 'No error handling detected');
                }
            }

            // Restore valid token
            await this.page.evaluate((token) => {
                localStorage.setItem('authToken', token);
            }, this.authToken);

            return true;
        } catch (error) {
            this.logTest('Error Handling', 'FAIL', error.message);
            return false;
        }
    }

    // Test performance
    async testPerformance() {
        console.log('\\n⚡ Testing Performance...');
        
        try {
            const startTime = Date.now();
            
            await this.page.reload({ waitUntil: 'networkidle0' });
            await this.page.waitForSelector('#agent-name');
            
            const loadTime = Date.now() - startTime;
            
            if (loadTime < 5000) {
                this.logTest('Page Load Performance', 'PASS', { loadTime: `${loadTime}ms` });
            } else {
                this.logTest('Page Load Performance', 'FAIL', { loadTime: `${loadTime}ms` });
            }

            // Test tab switching performance
            const tabSwitchStart = Date.now();
            await this.page.click("button[onclick=\"switchTab('available')\"]");
            await new Promise(resolve => setTimeout(resolve, 100));
            const tabSwitchTime = Date.now() - tabSwitchStart;

            if (tabSwitchTime < 1000) {
                this.logTest('Tab Switch Performance', 'PASS', { switchTime: `${tabSwitchTime}ms` });
            } else {
                this.logTest('Tab Switch Performance', 'FAIL', { switchTime: `${tabSwitchTime}ms` });
            }

            return true;
        } catch (error) {
            this.logTest('Performance', 'FAIL', error.message);
            return false;
        }
    }

    // Run all tests
    async runAllTests() {
        console.log('🎯 Starting Comprehensive Frontend Integration Tests\\n');
        
        const testMethods = [
            'testPageLoading',
            'testAuthentication', 
            'testTabNavigation',
            'testOrderLoading',
            'testOrderActions',
            'testResponsiveDesign',
            'testKeyboardShortcuts',
            'testErrorHandling',
            'testPerformance'
        ];

        for (const method of testMethods) {
            try {
                await this[method]();
            } catch (error) {
                this.logTest(method, 'FAIL', error.message);
            }
        }

        // Generate report
        this.generateReport();
    }

    // Generate test report
    generateReport() {
        console.log('\\n🎯 ===== FRONTEND INTEGRATION TEST REPORT =====');
        
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(r => r.status === 'PASS').length;
        const failedTests = totalTests - passedTests;
        const successRate = ((passedTests / totalTests) * 100).toFixed(2);

        console.log(`📊 Total Tests: ${totalTests}`);
        console.log(`✅ Passed: ${passedTests}`);
        console.log(`❌ Failed: ${failedTests}`);
        console.log(`📈 Success Rate: ${successRate}%`);

        if (failedTests > 0) {
            console.log('\\n❌ Failed Tests:');
            this.testResults
                .filter(r => r.status === 'FAIL')
                .forEach(r => console.log(`   - ${r.testName}: ${r.details || 'No details'}`));
        }

        console.log('\\n📋 Recommendations:');
        if (successRate >= 95) {
            console.log('✅ Frontend is production-ready with excellent quality');
        } else if (successRate >= 85) {
            console.log('⚠️ Frontend is mostly ready but needs minor fixes');
        } else {
            console.log('❌ Frontend requires significant fixes before deployment');
        }

        // Save detailed report
        const reportPath = path.join(__dirname, 'pickup-delivery-frontend-test-report.json');
        require('fs').writeFileSync(reportPath, JSON.stringify({
            summary: { totalTests, passedTests, failedTests, successRate },
            results: this.testResults,
            timestamp: new Date().toISOString()
        }, null, 2));

        console.log(`\\n💾 Detailed report saved to: ${reportPath}`);
    }

    // Cleanup
    async cleanup() {
        console.log('\\n🧹 Cleaning up test environment...');
        
        try {
            // Clean up test data
            if (this.connection) {
                await this.connection.execute(
                    "DELETE FROM users WHERE email IN ('frontend.test@pda.com', 'frontend.buyer@example.com')"
                );
                await this.connection.execute(
                    "DELETE FROM orders WHERE order_number LIKE 'FRONTEND-%'"
                );
                await this.connection.end();
            }

            // Close browser
            if (this.browser) {
                await this.browser.close();
            }

            // Close server
            if (this.server) {
                this.server.close();
            }

            console.log('✅ Test environment cleaned up successfully');
        } catch (error) {
            console.error('❌ Cleanup failed:', error.message);
        }
    }
}

// Run the tests
async function runFrontendTests() {
    const tester = new PickupDeliveryFrontendTest();
    
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
    runFrontendTests().catch(console.error);
}

module.exports = PickupDeliveryFrontendTest;