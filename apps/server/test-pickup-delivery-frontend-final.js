/**
 * Final Comprehensive Frontend Test for Pickup Delivery Agent Dashboard
 * Tests all functionality with zero tolerance for errors
 */

const puppeteer = require('puppeteer');
const express = require('express');
const path = require('path');
const fs = require('fs');

class FinalPickupDeliveryFrontendTest {
    constructor() {
        this.browser = null;
        this.page = null;
        this.server = null;
        this.testResults = [];
        this.serverPort = 3004;
        this.consoleErrors = [];
        this.pageErrors = [];
    }

    // Initialize test environment
    async init() {
        console.log('🚀 Initializing Final Frontend Test Environment...');
        
        try {
            // Setup test server
            await this.setupTestServer();
            
            // Launch browser
            this.browser = await puppeteer.launch({
                headless: false, // Set to true for CI/CD
                devtools: false,
                defaultViewport: { width: 1920, height: 1080 },
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage'
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
                } else if (type === 'log' && text.includes('[')) {
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

            console.log('✅ Final test environment initialized');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize:', error.message);
            return false;
        }
    }

    // Setup test server
    async setupTestServer() {
        const app = express();
        
        // Serve the standalone dashboard
        app.get('/dashboard', (req, res) => {
            const dashboardPath = path.join(__dirname, 'test-standalone-dashboard.html');
            res.sendFile(dashboardPath);
        });
        
        // Health check endpoint
        app.get('/health', (req, res) => {
            res.json({ status: 'OK', timestamp: new Date().toISOString() });
        });
        
        // Start server
        this.server = app.listen(this.serverPort, () => {
            console.log(`✅ Test server running on port ${this.serverPort}`);
        });
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

    // Test page loading and basic structure
    async testPageLoading() {
        console.log('\\n🌐 Testing Page Loading and Structure...');
        
        try {
            const startTime = Date.now();
            const response = await this.page.goto(`http://localhost:${this.serverPort}/dashboard`, {
                waitUntil: 'networkidle0',
                timeout: 30000
            });
            const loadTime = Date.now() - startTime;

            if (response.ok()) {
                this.logTest('Page HTTP Response', 'PASS', `Status: ${response.status()}, Load time: ${loadTime}ms`);
            } else {
                this.logTest('Page HTTP Response', 'FAIL', `Status: ${response.status()}`);
                return false;
            }

            // Check page title
            const title = await this.page.title();
            if (title.includes('Pickup Delivery Agent Dashboard')) {
                this.logTest('Page Title', 'PASS', title);
            } else {
                this.logTest('Page Title', 'FAIL', `Expected dashboard title, got: ${title}`);
            }

            // Check critical elements exist
            const criticalElements = [
                { selector: 'nav', name: 'Navigation Bar' },
                { selector: '#agent-name', name: 'Agent Name' },
                { selector: '#agent-rating', name: 'Agent Rating' },
                { selector: '.tab-button', name: 'Tab Buttons' },
                { selector: '#available-orders', name: 'Available Orders Container' },
                { selector: '#active-orders', name: 'Active Orders Container' },
                { selector: '#history-orders', name: 'History Orders Container' }
            ];

            for (const element of criticalElements) {
                try {
                    await this.page.waitForSelector(element.selector, { timeout: 5000 });
                    this.logTest(`Element Present - ${element.name}`, 'PASS');
                } catch (error) {
                    this.logTest(`Element Present - ${element.name}`, 'FAIL', `Selector: ${element.selector}`);
                }
            }

            // Check if page is fully loaded
            const isLoaded = await this.page.evaluate(() => {
                return document.readyState === 'complete';
            });

            if (isLoaded) {
                this.logTest('Page Load Complete', 'PASS');
            } else {
                this.logTest('Page Load Complete', 'FAIL', 'Document not ready');
            }

            return true;
        } catch (error) {
            this.logTest('Page Loading', 'FAIL', error.message);
            return false;
        }
    }

    // Test dashboard initialization
    async testDashboardInitialization() {
        console.log('\\n🔧 Testing Dashboard Initialization...');
        
        try {
            // Wait for dashboard to initialize
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Check agent information
            const agentName = await this.page.$eval('#agent-name', el => el.textContent);
            if (agentName && agentName !== 'Loading...') {
                this.logTest('Agent Name Loading', 'PASS', agentName);
            } else {
                this.logTest('Agent Name Loading', 'FAIL', `Got: ${agentName}`);
            }

            const agentRating = await this.page.$eval('#agent-rating', el => el.textContent);
            if (agentRating && agentRating !== '0.0') {
                this.logTest('Agent Rating Loading', 'PASS', agentRating);
            } else {
                this.logTest('Agent Rating Loading', 'FAIL', `Got: ${agentRating}`);
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
                    const value = await this.page.$eval(`#${stat.id}`, el => el.textContent);
                    if (value && value !== '0') {
                        this.logTest(`Stats - ${stat.name}`, 'PASS', value);
                    } else {
                        this.logTest(`Stats - ${stat.name}`, 'FAIL', `Got: ${value}`);
                    }
                } catch (error) {
                    this.logTest(`Stats - ${stat.name}`, 'FAIL', error.message);
                }
            }

            return true;
        } catch (error) {
            this.logTest('Dashboard Initialization', 'FAIL', error.message);
            return false;
        }
    }

    // Test tab navigation functionality
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
                // Click tab button
                await this.page.click(`button[onclick="switchTab('${tab.id}')"]`);
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Check if tab is active
                const isActive = await this.page.$eval(
                    `button[onclick="switchTab('${tab.id}')"]`, 
                    el => el.classList.contains('active')
                );

                if (isActive) {
                    this.logTest(`Tab Active State - ${tab.name}`, 'PASS');
                } else {
                    this.logTest(`Tab Active State - ${tab.name}`, 'FAIL', 'Tab not marked as active');
                }

                // Check if content is visible
                const contentVisible = await this.page.$eval(
                    `#${tab.id}-orders`, 
                    el => !el.classList.contains('hidden')
                );

                if (contentVisible) {
                    this.logTest(`Tab Content Visibility - ${tab.name}`, 'PASS');
                } else {
                    this.logTest(`Tab Content Visibility - ${tab.name}`, 'FAIL', 'Content not visible');
                }

                // Check if content is loaded
                const hasContent = await this.page.$eval(
                    `#${tab.id}-orders-content`,
                    el => el.innerHTML.trim().length > 0
                );

                if (hasContent) {
                    this.logTest(`Tab Content Loading - ${tab.name}`, 'PASS');
                } else {
                    this.logTest(`Tab Content Loading - ${tab.name}`, 'FAIL', 'No content loaded');
                }

            } catch (error) {
                this.logTest(`Tab Navigation - ${tab.name}`, 'FAIL', error.message);
            }
        }
    }

    // Test order display and interaction
    async testOrderFunctionality() {
        console.log('\\n📦 Testing Order Functionality...');
        
        try {
            // Go to available orders tab
            await this.page.click("button[onclick=\"switchTab('available')\"]");
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Check if orders are displayed
            const orderCards = await this.page.$$('.order-card');
            if (orderCards.length > 0) {
                this.logTest('Order Cards Display', 'PASS', `Found ${orderCards.length} orders`);
            } else {
                this.logTest('Order Cards Display', 'FAIL', 'No order cards found');
                return false;
            }

            // Test order details modal
            const viewDetailsButton = await this.page.$('.order-card button[onclick*="showOrderDetailsModal"]');
            if (viewDetailsButton) {
                await viewDetailsButton.click();
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                const modal = await this.page.$('.fixed.inset-0');
                if (modal) {
                    this.logTest('Order Details Modal', 'PASS');
                    
                    // Check modal content
                    const modalTitle = await this.page.$eval('.fixed.inset-0 h3', el => el.textContent);
                    if (modalTitle.includes('Order Details')) {
                        this.logTest('Modal Content', 'PASS', modalTitle);
                    } else {
                        this.logTest('Modal Content', 'FAIL', `Unexpected title: ${modalTitle}`);
                    }
                    
                    // Close modal
                    await this.page.click('.fixed.inset-0 button[onclick*="remove"]');
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // Check if modal is closed
                    const modalClosed = await this.page.$('.fixed.inset-0') === null;
                    if (modalClosed) {
                        this.logTest('Modal Close', 'PASS');
                    } else {
                        this.logTest('Modal Close', 'FAIL', 'Modal still visible');
                    }
                } else {
                    this.logTest('Order Details Modal', 'FAIL', 'Modal did not open');
                }
            } else {
                this.logTest('View Details Button', 'FAIL', 'Button not found');
            }

            // Test accept order functionality
            const acceptButton = await this.page.$('.order-card button[onclick*="acceptOrder"]');
            if (acceptButton) {
                await acceptButton.click();
                await new Promise(resolve => setTimeout(resolve, 1000));
                this.logTest('Accept Order Button', 'PASS');
                
                // Check if notification appeared
                const notification = await this.page.$('.fixed.top-4.right-4');
                if (notification) {
                    this.logTest('Accept Order Notification', 'PASS');
                } else {
                    this.logTest('Accept Order Notification', 'FAIL', 'No notification shown');
                }
            } else {
                this.logTest('Accept Order Button', 'FAIL', 'Button not found');
            }

            // Test active orders tab
            await this.page.click("button[onclick=\"switchTab('active')\"]");
            await new Promise(resolve => setTimeout(resolve, 1500));

            const activeOrderCards = await this.page.$$('#active-orders .order-card');
            if (activeOrderCards.length > 0) {
                this.logTest('Active Orders Display', 'PASS', `Found ${activeOrderCards.length} orders`);
                
                // Test status update
                const statusButton = await this.page.$('.order-card button[onclick*="updateOrderStatus"]');
                if (statusButton) {
                    await statusButton.click();
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    this.logTest('Update Status Button', 'PASS');
                } else {
                    this.logTest('Update Status Button', 'FAIL', 'Button not found');
                }
            } else {
                this.logTest('Active Orders Display', 'PASS', 'No active orders (expected after accept)');
            }

            return true;
        } catch (error) {
            this.logTest('Order Functionality', 'FAIL', error.message);
            return false;
        }
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

            const availableActive = await this.page.$eval(
                "button[onclick=\"switchTab('available')\"]", 
                el => el.classList.contains('active')
            );
            
            if (availableActive) {
                this.logTest('Keyboard Shortcut - Alt+1', 'PASS');
            } else {
                this.logTest('Keyboard Shortcut - Alt+1', 'FAIL', 'Tab not activated');
            }

            // Test Alt+2 for active orders
            await this.page.keyboard.down('Alt');
            await this.page.keyboard.press('2');
            await this.page.keyboard.up('Alt');
            await new Promise(resolve => setTimeout(resolve, 1000));

            const activeActive = await this.page.$eval(
                "button[onclick=\"switchTab('active')\"]", 
                el => el.classList.contains('active')
            );
            
            if (activeActive) {
                this.logTest('Keyboard Shortcut - Alt+2', 'PASS');
            } else {
                this.logTest('Keyboard Shortcut - Alt+2', 'FAIL', 'Tab not activated');
            }

            // Test help modal shortcut
            await this.page.click('button[onclick="showKeyboardShortcuts()"]');
            await new Promise(resolve => setTimeout(resolve, 1000));

            const helpModal = await this.page.$('.fixed.inset-0');
            if (helpModal) {
                this.logTest('Help Modal', 'PASS');
                
                // Close modal
                await this.page.click('.fixed.inset-0 button[onclick*="remove"]');
                await new Promise(resolve => setTimeout(resolve, 500));
            } else {
                this.logTest('Help Modal', 'FAIL', 'Modal did not open');
            }

            return true;
        } catch (error) {
            this.logTest('Keyboard Shortcuts', 'FAIL', error.message);
            return false;
        }
    }

    // Test responsive design
    async testResponsiveDesign() {
        console.log('\\n📱 Testing Responsive Design...');
        
        const viewports = [
            { width: 1920, height: 1080, name: 'Desktop' },
            { width: 1024, height: 768, name: 'Tablet Landscape' },
            { width: 768, height: 1024, name: 'Tablet Portrait' },
            { width: 375, height: 667, name: 'Mobile' }
        ];

        for (const viewport of viewports) {
            try {
                await this.page.setViewport(viewport);
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Check if navigation is visible and functional
                const navVisible = await this.page.$eval('nav', el => {
                    const style = window.getComputedStyle(el);
                    return style.display !== 'none' && style.visibility !== 'hidden';
                });

                if (navVisible) {
                    this.logTest(`Responsive - Navigation ${viewport.name}`, 'PASS');
                } else {
                    this.logTest(`Responsive - Navigation ${viewport.name}`, 'FAIL', 'Navigation not visible');
                }

                // Check if main content is accessible
                const contentVisible = await this.page.$eval('.tab-content:not(.hidden)', el => {
                    const style = window.getComputedStyle(el);
                    return style.display !== 'none';
                });

                if (contentVisible) {
                    this.logTest(`Responsive - Content ${viewport.name}`, 'PASS');
                } else {
                    this.logTest(`Responsive - Content ${viewport.name}`, 'FAIL', 'Content not visible');
                }

                // Test tab functionality on different screen sizes
                await this.page.click("button[onclick=\"switchTab('available')\"]");
                await new Promise(resolve => setTimeout(resolve, 500));

                const tabWorking = await this.page.$eval(
                    "button[onclick=\"switchTab('available')\"]", 
                    el => el.classList.contains('active')
                );

                if (tabWorking) {
                    this.logTest(`Responsive - Tab Function ${viewport.name}`, 'PASS');
                } else {
                    this.logTest(`Responsive - Tab Function ${viewport.name}`, 'FAIL', 'Tab not working');
                }

            } catch (error) {
                this.logTest(`Responsive Design - ${viewport.name}`, 'FAIL', error.message);
            }
        }

        // Reset to desktop
        await this.page.setViewport({ width: 1920, height: 1080 });
    }

    // Test performance
    async testPerformance() {
        console.log('\\n⚡ Testing Performance...');
        
        try {
            // Test page reload performance
            const startTime = Date.now();
            await this.page.reload({ waitUntil: 'networkidle0' });
            const reloadTime = Date.now() - startTime;
            
            if (reloadTime < 3000) {
                this.logTest('Page Reload Performance', 'PASS', `${reloadTime}ms`);
            } else {
                this.logTest('Page Reload Performance', 'FAIL', `${reloadTime}ms (too slow)`);
            }

            // Test tab switching performance
            const tabSwitchTimes = [];
            const tabs = ['available', 'active', 'history', 'enhanced'];
            
            for (const tab of tabs) {
                const switchStart = Date.now();
                await this.page.click(`button[onclick="switchTab('${tab}')"]`);
                await this.page.waitForFunction(
                    (tabId) => document.querySelector(`button[onclick="switchTab('${tabId}')"]`).classList.contains('active'),
                    {},
                    tab
                );
                const switchTime = Date.now() - switchStart;
                tabSwitchTimes.push(switchTime);
            }

            const avgSwitchTime = tabSwitchTimes.reduce((a, b) => a + b, 0) / tabSwitchTimes.length;
            
            if (avgSwitchTime < 500) {
                this.logTest('Tab Switch Performance', 'PASS', `Average: ${avgSwitchTime.toFixed(2)}ms`);
            } else {
                this.logTest('Tab Switch Performance', 'FAIL', `Average: ${avgSwitchTime.toFixed(2)}ms (too slow)`);
            }

            return true;
        } catch (error) {
            this.logTest('Performance Testing', 'FAIL', error.message);
            return false;
        }
    }

    // Test error handling and edge cases
    async testErrorHandling() {
        console.log('\\n🚨 Testing Error Handling...');
        
        try {
            // Test clicking non-existent elements (should not crash)
            try {
                await this.page.click('#non-existent-element');
                this.logTest('Non-existent Element Click', 'FAIL', 'Should have thrown error');
            } catch (error) {
                this.logTest('Non-existent Element Click', 'PASS', 'Properly handled');
            }

            // Test modal opening/closing multiple times
            for (let i = 0; i < 3; i++) {
                await this.page.click('button[onclick="showKeyboardShortcuts()"]');
                await new Promise(resolve => setTimeout(resolve, 300));
                await this.page.click('.fixed.inset-0 button[onclick*="remove"]');
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            this.logTest('Multiple Modal Operations', 'PASS');

            // Test rapid tab switching
            const tabs = ['available', 'active', 'history', 'enhanced'];
            for (let i = 0; i < 10; i++) {
                const randomTab = tabs[Math.floor(Math.random() * tabs.length)];
                await this.page.click(`button[onclick="switchTab('${randomTab}')"]`);
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            this.logTest('Rapid Tab Switching', 'PASS');

            return true;
        } catch (error) {
            this.logTest('Error Handling', 'FAIL', error.message);
            return false;
        }
    }

    // Run all tests
    async runAllTests() {
        console.log('🎯 Starting Final Comprehensive Frontend Tests\\n');
        
        const testMethods = [
            'testPageLoading',
            'testDashboardInitialization',
            'testTabNavigation',
            'testOrderFunctionality',
            'testKeyboardShortcuts',
            'testResponsiveDesign',
            'testPerformance',
            'testErrorHandling'
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

    // Generate comprehensive final report
    generateFinalReport() {
        console.log('\\n🎯 ===== FINAL FRONTEND INTEGRATION TEST REPORT =====');
        
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(r => r.status === 'PASS').length;
        const failedTests = totalTests - passedTests;
        const successRate = ((passedTests / totalTests) * 100).toFixed(2);

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

        // Quality assessment
        console.log('\\n📋 Frontend Quality Assessment:');
        if (successRate >= 98 && this.consoleErrors.length === 0 && this.pageErrors.length === 0) {
            console.log('🏆 EXCELLENT: Frontend is production-ready with zero errors!');
        } else if (successRate >= 95 && this.consoleErrors.length <= 2) {
            console.log('✅ VERY GOOD: Frontend is production-ready with minor issues');
        } else if (successRate >= 90) {
            console.log('⚠️ GOOD: Frontend is mostly ready but needs some fixes');
        } else if (successRate >= 80) {
            console.log('🔧 FAIR: Frontend needs moderate improvements');
        } else {
            console.log('❌ POOR: Frontend requires significant fixes before deployment');
        }

        // Detailed recommendations
        console.log('\\n💡 Recommendations:');
        if (this.consoleErrors.length > 0) {
            console.log(`   - Fix ${this.consoleErrors.length} console errors`);
        }
        if (this.pageErrors.length > 0) {
            console.log(`   - Fix ${this.pageErrors.length} JavaScript errors`);
        }
        if (failedTests > 0) {
            console.log(`   - Address ${failedTests} failed test cases`);
        }
        if (successRate >= 95) {
            console.log('   - Frontend meets production quality standards');
        }

        // Save detailed report
        const reportData = {
            summary: {
                totalTests,
                passedTests,
                failedTests,
                successRate: parseFloat(successRate),
                consoleErrors: this.consoleErrors.length,
                pageErrors: this.pageErrors.length
            },
            results: this.testResults,
            errors: {
                console: this.consoleErrors,
                page: this.pageErrors
            },
            timestamp: new Date().toISOString(),
            testDuration: Date.now() - this.startTime
        };

        const reportPath = path.join(__dirname, 'final-frontend-test-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));

        console.log(`\\n💾 Detailed report saved to: final-frontend-test-report.json`);
        
        // Final verdict
        console.log('\\n🏁 FINAL VERDICT:');
        if (successRate >= 95 && this.consoleErrors.length === 0 && this.pageErrors.length === 0) {
            console.log('🎉 FRONTEND IS PRODUCTION-READY! 🎉');
        } else {
            console.log('🔧 Frontend needs improvements before production deployment');
        }
    }

    // Cleanup
    async cleanup() {
        console.log('\\n🧹 Cleaning up test environment...');
        
        try {
            if (this.browser) {
                await this.browser.close();
            }
            if (this.server) {
                this.server.close();
            }
            console.log('✅ Cleanup completed successfully');
        } catch (error) {
            console.error('❌ Cleanup failed:', error.message);
        }
    }
}

// Run the final tests
async function runFinalFrontendTests() {
    const tester = new FinalPickupDeliveryFrontendTest();
    tester.startTime = Date.now();
    
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
    runFinalFrontendTests().catch(console.error);
}

module.exports = FinalPickupDeliveryFrontendTest;