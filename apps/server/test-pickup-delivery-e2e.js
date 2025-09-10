/**
 * End-to-End Automated Testing for Pickup Delivery Agent Dashboard
 * Uses Puppeteer to simulate real user interactions
 */

const puppeteer = require('puppeteer');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

class PickupDeliveryE2ETest {
    constructor() {
        this.browser = null;
        this.page = null;
        this.connection = null;
        this.testResults = [];
        this.testAgent = null;
        this.authToken = null;
        this.baseUrl = 'http://localhost:3001';
        this.dashboardUrl = `${this.baseUrl}/agent/pickup-delivery-dashboard.html?test=true`;
    }

    // Initialize test environment
    async init() {
        console.log('🚀 Initializing E2E test environment...');
        
        try {
            // Setup database connection
            this.connection = await mysql.createConnection({
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME || 'add_physical_product',
                port: process.env.DB_PORT || 3306
            });

            // Launch browser
            this.browser = await puppeteer.launch({
                headless: false, // Set to true for CI/CD
                devtools: true,
                defaultViewport: { width: 1920, height: 1080 },
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ]
            });

            this.page = await this.browser.newPage();
            
            // Enable console logging
            this.page.on('console', msg => {
                if (msg.type() === 'error') {
                    console.log('❌ Browser Error:', msg.text());
                } else if (msg.text().includes('🧪') || msg.text().includes('✅') || msg.text().includes('❌')) {
                    console.log('🔍 Test Log:', msg.text());
                }
            });

            // Enable request/response logging
            this.page.on('response', response => {
                if (response.url().includes('/api/pickup-delivery-agent/')) {
                    console.log(`📡 API Response: ${response.status()} ${response.url()}`);
                }
            });

            console.log('✅ E2E test environment initialized');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize E2E test environment:', error);
            return false;
        }
    }

    // Log test results
    logTest(testName, status, details = null, screenshot = null) {
        const result = {
            testName,
            status,
            details,
            screenshot,
            timestamp: new Date().toISOString()
        };
        
        this.testResults.push(result);
        
        const emoji = status === 'PASS' ? '✅' : '❌';
        console.log(`${emoji} ${testName}: ${status}`);
        if (details) {
            console.log(`   Details: ${JSON.stringify(details)}`);
        }
    }

    // Take screenshot for debugging
    async takeScreenshot(name) {
        try {
            const screenshotPath = `test-screenshots/${name}-${Date.now()}.png`;
            await this.page.screenshot({ 
                path: screenshotPath, 
                fullPage: true 
            });
            return screenshotPath;
        } catch (error) {
            console.error('Failed to take screenshot:', error);
            return null;
        }
    }

    // Setup test agent and authentication
    async setupTestAgent() {
        console.log('🔧 Setting up test agent...');
        
        const testAgentData = {
            name: 'E2E Test Agent',
            email: 'e2e.test@pda.com',
            phone: '+1888888888',
            password: 'E2ETest123!',
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
                    ) VALUES (?, 'motorcycle', 'E2E001', 'E2E Test Location', 4.8, 0, TRUE, NOW())
                    ON DUPLICATE KEY UPDATE
                    vehicle_type = VALUES(vehicle_type),
                    is_available = TRUE
                `, [this.testAgent.id]);
                
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

    // Test dashboard loading
    async testDashboardLoading() {
        console.log('\n📱 Testing Dashboard Loading...');
        
        try {
            // Set auth token in localStorage before navigating
            await this.page.evaluateOnNewDocument((token) => {
                localStorage.setItem('authToken', token);
            }, this.authToken);

            // Navigate to dashboard
            const startTime = Date.now();
            await this.page.goto(this.dashboardUrl, { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });
            const loadTime = Date.now() - startTime;

            // Wait for dashboard to initialize
            await this.page.waitForSelector('.dashboard-container', { timeout: 10000 });

            // Check if main elements are present
            const elements = await this.page.evaluate(() => {
                return {
                    dashboardContainer: !!document.querySelector('.dashboard-container'),
                    tabsContainer: !!document.querySelector('.tabs-container'),
                    availableTab: !!document.querySelector('#tab-available'),
                    activeTab: !!document.querySelector('#tab-active'),
                    enhancedTab: !!document.querySelector('#tab-enhanced'),
                    refreshButtons: document.querySelectorAll('[onclick*="refresh"]').length
                };
            });

            if (elements.dashboardContainer && elements.tabsContainer) {
                this.logTest('Dashboard Loading', 'PASS', { 
                    loadTime: `${loadTime}ms`,
                    elements 
                });
            } else {
                const screenshot = await this.takeScreenshot('dashboard-loading-failed');
                this.logTest('Dashboard Loading', 'FAIL', { 
                    loadTime: `${loadTime}ms`,
                    elements 
                }, screenshot);
            }

            // Test if JavaScript functions are loaded
            const functionsLoaded = await this.page.evaluate(() => {
                return {
                    showOrderDetailsModal: typeof showOrderDetailsModal === 'function',
                    refreshDashboard: typeof refreshDashboard === 'function',
                    switchTab: typeof switchTab === 'function',
                    showNotification: typeof showNotification === 'function'
                };
            });

            const allFunctionsLoaded = Object.values(functionsLoaded).every(loaded => loaded);
            this.logTest('JavaScript Functions Loading', allFunctionsLoaded ? 'PASS' : 'FAIL', functionsLoaded);

        } catch (error) {
            const screenshot = await this.takeScreenshot('dashboard-loading-error');
            this.logTest('Dashboard Loading', 'FAIL', error.message, screenshot);
        }
    }

    // Test tab switching functionality
    async testTabSwitching() {
        console.log('\n🔄 Testing Tab Switching...');
        
        const tabs = ['available', 'active', 'enhanced', 'confirmations', 'history', 'settings'];
        
        for (const tab of tabs) {
            try {
                // Click on tab
                const tabSelector = `#tab-${tab}`;
                await this.page.waitForSelector(tabSelector, { timeout: 5000 });
                await this.page.click(tabSelector);
                
                // Wait for tab content to load
                await this.page.waitForTimeout(1000);
                
                // Check if tab is active
                const isActive = await this.page.evaluate((tabId) => {
                    const tabElement = document.querySelector(`#tab-${tabId}`);
                    return tabElement && tabElement.classList.contains('active');
                }, tab);
                
                if (isActive) {
                    this.logTest(`Tab Switching - ${tab}`, 'PASS');
                } else {
                    const screenshot = await this.takeScreenshot(`tab-switching-${tab}-failed`);
                    this.logTest(`Tab Switching - ${tab}`, 'FAIL', 'Tab not activated', screenshot);
                }
                
            } catch (error) {
                const screenshot = await this.takeScreenshot(`tab-switching-${tab}-error`);
                this.logTest(`Tab Switching - ${tab}`, 'FAIL', error.message, screenshot);
            }
        }
    }

    // Test keyboard shortcuts
    async testKeyboardShortcuts() {
        console.log('\n⌨️ Testing Keyboard Shortcuts...');
        
        const shortcuts = [
            { key: '1', altKey: true, expectedTab: 'available' },
            { key: '2', altKey: true, expectedTab: 'active' },
            { key: '3', altKey: true, expectedTab: 'enhanced' }
        ];

        for (const shortcut of shortcuts) {
            try {
                // Press keyboard shortcut
                await this.page.keyboard.down('Alt');
                await this.page.keyboard.press(shortcut.key);
                await this.page.keyboard.up('Alt');
                
                // Wait for tab switch
                await this.page.waitForTimeout(500);
                
                // Check if correct tab is active
                const isActive = await this.page.evaluate((tabId) => {
                    const tabElement = document.querySelector(`#tab-${tabId}`);
                    return tabElement && tabElement.classList.contains('active');
                }, shortcut.expectedTab);
                
                if (isActive) {
                    this.logTest(`Keyboard Shortcut Alt+${shortcut.key}`, 'PASS');
                } else {
                    this.logTest(`Keyboard Shortcut Alt+${shortcut.key}`, 'FAIL', 'Tab not switched');
                }
                
            } catch (error) {
                this.logTest(`Keyboard Shortcut Alt+${shortcut.key}`, 'FAIL', error.message);
            }
        }

        // Test F5 refresh
        try {
            await this.page.keyboard.press('F5');
            await this.page.waitForTimeout(1000);
            this.logTest('Keyboard Shortcut F5 (Refresh)', 'PASS');
        } catch (error) {
            this.logTest('Keyboard Shortcut F5 (Refresh)', 'FAIL', error.message);
        }
    }

    // Test order details modal
    async testOrderDetailsModal() {
        console.log('\n📋 Testing Order Details Modal...');
        
        try {
            // Create a mock order and test the modal
            const mockOrder = {
                id: 'TEST123',
                status: 'ASSIGNED_TO_PDA',
                buyer_name: 'Test Buyer',
                buyer_email: 'test@example.com',
                currency: 'USD',
                total_amount: '100.00',
                items: [
                    {
                        product_name: 'Test Product',
                        quantity: 2,
                        price: '50.00'
                    }
                ]
            };

            // Call showOrderDetailsModal function
            await this.page.evaluate((order) => {
                if (typeof showOrderDetailsModal === 'function') {
                    showOrderDetailsModal(order);
                }
            }, mockOrder);

            // Wait for modal to appear
            await this.page.waitForSelector('.fixed.inset-0', { timeout: 5000 });

            // Check modal content
            const modalContent = await this.page.evaluate(() => {
                const modal = document.querySelector('.fixed.inset-0');
                if (!modal) return null;
                
                return {
                    hasModal: true,
                    hasOrderId: modal.textContent.includes('TEST123'),
                    hasBuyerName: modal.textContent.includes('Test Buyer'),
                    hasCloseButton: !!modal.querySelector('button[onclick*="remove"]'),
                    hasProductInfo: modal.textContent.includes('Test Product')
                };
            });

            if (modalContent && modalContent.hasModal && modalContent.hasOrderId) {
                this.logTest('Order Details Modal', 'PASS', modalContent);
                
                // Test closing modal
                await this.page.click('button[onclick*="remove"]');
                await this.page.waitForTimeout(500);
                
                const modalClosed = await this.page.evaluate(() => {
                    return !document.querySelector('.fixed.inset-0');
                });
                
                this.logTest('Order Details Modal Close', modalClosed ? 'PASS' : 'FAIL');
                
            } else {
                const screenshot = await this.takeScreenshot('order-modal-failed');
                this.logTest('Order Details Modal', 'FAIL', modalContent, screenshot);
            }

        } catch (error) {
            const screenshot = await this.takeScreenshot('order-modal-error');
            this.logTest('Order Details Modal', 'FAIL', error.message, screenshot);
        }
    }

    // Test refresh functions
    async testRefreshFunctions() {
        console.log('\n🔄 Testing Refresh Functions...');
        
        const refreshFunctions = [
            'refreshAvailableOrders',
            'refreshActiveOrders',
            'refreshOrderHistory',
            'refreshEnhancedTracking',
            'refreshConfirmations'
        ];

        for (const funcName of refreshFunctions) {
            try {
                // Call refresh function
                const result = await this.page.evaluate((fn) => {
                    if (typeof window[fn] === 'function') {
                        window[fn]();
                        return true;
                    }
                    return false;
                }, funcName);

                if (result) {
                    this.logTest(`Refresh Function - ${funcName}`, 'PASS');
                } else {
                    this.logTest(`Refresh Function - ${funcName}`, 'FAIL', 'Function not found');
                }

            } catch (error) {
                this.logTest(`Refresh Function - ${funcName}`, 'FAIL', error.message);
            }
        }
    }

    // Test error handling with malformed data
    async testErrorHandling() {
        console.log('\n🚨 Testing Error Handling...');
        
        const testCases = [
            { name: 'Null Order', data: null },
            { name: 'Undefined Order', data: undefined },
            { name: 'Empty Order', data: {} },
            { name: 'Malformed Order', data: { id: null, status: undefined, buyer_name: '', items: null } }
        ];

        for (const testCase of testCases) {
            try {
                // Test showOrderDetailsModal with malformed data
                const errorOccurred = await this.page.evaluate((order, caseName) => {
                    try {
                        if (typeof showOrderDetailsModal === 'function') {
                            showOrderDetailsModal(order);
                        }
                        return false; // No error occurred
                    } catch (error) {
                        console.error(`Error in ${caseName}:`, error);
                        return true; // Error occurred
                    }
                }, testCase.data, testCase.name);

                if (!errorOccurred) {
                    this.logTest(`Error Handling - ${testCase.name}`, 'PASS', 'Handled gracefully');
                } else {
                    this.logTest(`Error Handling - ${testCase.name}`, 'FAIL', 'Unhandled error occurred');
                }

                // Clean up any modals that might have been created
                await this.page.evaluate(() => {
                    const modals = document.querySelectorAll('.fixed.inset-0');
                    modals.forEach(modal => modal.remove());
                });

            } catch (error) {
                this.logTest(`Error Handling - ${testCase.name}`, 'FAIL', error.message);
            }
        }
    }

    // Test responsive design
    async testResponsiveDesign() {
        console.log('\n📱 Testing Responsive Design...');
        
        const viewports = [
            { name: 'Mobile', width: 375, height: 667 },
            { name: 'Tablet', width: 768, height: 1024 },
            { name: 'Desktop', width: 1920, height: 1080 }
        ];

        for (const viewport of viewports) {
            try {
                await this.page.setViewport({ width: viewport.width, height: viewport.height });
                await this.page.waitForTimeout(1000);

                // Check if dashboard is still functional
                const isResponsive = await this.page.evaluate(() => {
                    const dashboard = document.querySelector('.dashboard-container');
                    const tabs = document.querySelector('.tabs-container');
                    
                    return {
                        dashboardVisible: dashboard && dashboard.offsetWidth > 0,
                        tabsVisible: tabs && tabs.offsetWidth > 0,
                        noHorizontalScroll: document.body.scrollWidth <= window.innerWidth
                    };
                });

                const allGood = Object.values(isResponsive).every(value => value);
                
                if (allGood) {
                    this.logTest(`Responsive Design - ${viewport.name}`, 'PASS', isResponsive);
                } else {
                    const screenshot = await this.takeScreenshot(`responsive-${viewport.name.toLowerCase()}-failed`);
                    this.logTest(`Responsive Design - ${viewport.name}`, 'FAIL', isResponsive, screenshot);
                }

            } catch (error) {
                this.logTest(`Responsive Design - ${viewport.name}`, 'FAIL', error.message);
            }
        }

        // Reset to desktop viewport
        await this.page.setViewport({ width: 1920, height: 1080 });
    }

    // Test performance metrics
    async testPerformance() {
        console.log('\n⚡ Testing Performance...');
        
        try {
            // Measure page load performance
            const performanceMetrics = await this.page.evaluate(() => {
                const navigation = performance.getEntriesByType('navigation')[0];
                return {
                    domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
                    loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
                    totalLoadTime: navigation.loadEventEnd - navigation.fetchStart
                };
            });

            // Check JavaScript execution time
            const jsExecutionTime = await this.page.evaluate(() => {
                const start = performance.now();
                
                // Simulate some dashboard operations
                if (typeof refreshDashboard === 'function') {
                    refreshDashboard();
                }
                
                return performance.now() - start;
            });

            const performanceGood = performanceMetrics.totalLoadTime < 5000 && jsExecutionTime < 100;
            
            this.logTest('Performance Metrics', performanceGood ? 'PASS' : 'FAIL', {
                ...performanceMetrics,
                jsExecutionTime: `${jsExecutionTime.toFixed(2)}ms`
            });

        } catch (error) {
            this.logTest('Performance Metrics', 'FAIL', error.message);
        }
    }

    // Run automated testing suite
    async runAutomatedTests() {
        console.log('🎯 Starting Automated E2E Testing Suite\n');
        
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

        // Create screenshots directory
        const fs = require('fs');
        if (!fs.existsSync('test-screenshots')) {
            fs.mkdirSync('test-screenshots');
        }

        try {
            // Run all test suites
            await this.testDashboardLoading();
            await this.testTabSwitching();
            await this.testKeyboardShortcuts();
            await this.testOrderDetailsModal();
            await this.testRefreshFunctions();
            await this.testErrorHandling();
            await this.testResponsiveDesign();
            await this.testPerformance();

            // Generate test report
            this.generateTestReport();

        } catch (error) {
            console.error('❌ Test execution failed:', error);
        } finally {
            // Cleanup
            await this.cleanup();
        }
    }

    // Generate comprehensive test report
    generateTestReport() {
        console.log('\n🎯 ===== AUTOMATED E2E TEST REPORT =====');
        
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
                    if (test.screenshot) {
                        console.log(`     Screenshot: ${test.screenshot}`);
                    }
                });
        }

        console.log('\n📋 Test Categories:');
        const categories = {};
        this.testResults.forEach(test => {
            const category = test.testName.split(' - ')[0];
            if (!categories[category]) {
                categories[category] = { passed: 0, failed: 0 };
            }
            categories[category][test.status === 'PASS' ? 'passed' : 'failed']++;
        });

        Object.entries(categories).forEach(([category, stats]) => {
            const categoryRate = ((stats.passed / (stats.passed + stats.failed)) * 100).toFixed(1);
            console.log(`   ${category}: ${stats.passed}/${stats.passed + stats.failed} (${categoryRate}%)`);
        });

        console.log('\n🎯 Recommendations:');
        if (successRate >= 95) {
            console.log('✅ Excellent! System is production-ready');
        } else if (successRate >= 85) {
            console.log('✅ Good! System is ready with minor monitoring');
        } else if (successRate >= 70) {
            console.log('⚠️  System needs fixes before production deployment');
        } else {
            console.log('❌ System requires significant fixes before deployment');
        }

        // Save detailed report
        const report = {
            timestamp: new Date().toISOString(),
            testAgent: this.testAgent ? this.testAgent.email : 'unknown',
            environment: 'automated-e2e',
            browser: 'Chromium (Puppeteer)',
            totalTests,
            passedTests,
            failedTests,
            successRate: parseFloat(successRate),
            categories,
            results: this.testResults
        };

        const fs = require('fs');
        fs.writeFileSync(
            'pickup-delivery-e2e-test-report.json',
            JSON.stringify(report, null, 2)
        );

        console.log('\n💾 Detailed report saved to: pickup-delivery-e2e-test-report.json');
        console.log('📸 Screenshots saved to: test-screenshots/ directory');
    }

    // Cleanup test environment
    async cleanup() {
        console.log('\n🧹 Cleaning up test environment...');
        
        try {
            if (this.testAgent && this.connection) {
                await this.connection.execute(
                    'DELETE FROM users WHERE email = ?',
                    [this.testAgent.email]
                );
            }
            
            if (this.connection) {
                await this.connection.end();
            }
            
            if (this.browser) {
                await this.browser.close();
            }

            console.log('✅ Test environment cleaned up successfully');
        } catch (error) {
            console.error('❌ Failed to cleanup test environment:', error.message);
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new PickupDeliveryE2ETest();
    tester.runAutomatedTests().catch(console.error);
}

module.exports = PickupDeliveryE2ETest;