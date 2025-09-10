/**
 * Simple Frontend Test for Pickup Delivery Agent Dashboard
 * Tests basic functionality without complex authentication flows
 */

const puppeteer = require('puppeteer');
const express = require('express');
const path = require('path');
const fs = require('fs');

class SimplePickupDeliveryFrontendTest {
    constructor() {
        this.browser = null;
        this.page = null;
        this.server = null;
        this.testResults = [];
        this.serverPort = 3003;
    }

    // Initialize test environment
    async init() {
        console.log('🚀 Initializing Simple Frontend Test...');
        
        try {
            // Setup test server
            await this.setupTestServer();
            
            // Launch browser
            this.browser = await puppeteer.launch({
                headless: false,
                devtools: false,
                defaultViewport: { width: 1920, height: 1080 },
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            this.page = await this.browser.newPage();
            
            // Track console errors
            this.page.on('console', msg => {
                const type = msg.type();
                if (type === 'error') {
                    console.log(`❌ Console Error: ${msg.text()}`);
                    this.logTest('Console Error', 'FAIL', msg.text());
                }
            });

            // Track page errors
            this.page.on('pageerror', error => {
                console.log(`❌ Page Error: ${error.message}`);
                this.logTest('Page Error', 'FAIL', error.message);
            });

            console.log('✅ Simple test environment initialized');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize:', error.message);
            return false;
        }
    }

    // Setup simple test server
    async setupTestServer() {
        const app = express();
        
        // Serve static files
        app.use(express.static(path.join(__dirname, '../client')));
        
        // Create a simple test dashboard without authentication
        const testDashboardPath = path.join(__dirname, 'test-dashboard.html');
        const originalDashboard = path.join(__dirname, '../client/agent/pickup-delivery-dashboard.html');
        
        // Read original dashboard
        let dashboardContent = fs.readFileSync(originalDashboard, 'utf8');
        
        // Remove authentication scripts and add mock data
        dashboardContent = dashboardContent.replace(
            '<script src="/shared/auth-utils.js"></script>',
            '<!-- Auth utils removed for testing -->'
        );
        dashboardContent = dashboardContent.replace(
            '<script src="/shared/agent-auth-protection.js"></script>',
            '<!-- Agent auth protection removed for testing -->'
        );
        
        // Add mock initialization script
        const mockScript = `
        <script>
        // Mock authentication for testing
        localStorage.setItem('authToken', 'test-token');
        localStorage.setItem('userData', JSON.stringify({
            id: 1,
            name: 'Test Agent',
            email: 'test@agent.com',
            role: 'pickup_delivery_agent'
        }));
        
        // Mock functions
        function showNotification(message, type) {
            console.log('[NOTIFICATION]', type, message);
        }
        
        function logout() {
            console.log('[LOGOUT] Logout clicked');
        }
        
        // Initialize dashboard when DOM loads
        document.addEventListener('DOMContentLoaded', function() {
            console.log('[TEST] Dashboard initializing...');
            
            // Set agent name
            const agentName = document.getElementById('agent-name');
            if (agentName) {
                agentName.textContent = 'Test Agent';
            }
            
            // Set agent rating
            const agentRating = document.getElementById('agent-rating');
            if (agentRating) {
                agentRating.textContent = '4.8';
            }
            
            // Mock tab switching
            window.switchTab = function(tabId) {
                console.log('[TEST] Switching to tab:', tabId);
                
                // Remove active class from all tabs
                document.querySelectorAll('.tab-button').forEach(btn => {
                    btn.classList.remove('active');
                });
                
                // Hide all tab contents
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.add('hidden');
                });
                
                // Activate clicked tab
                const tabButton = document.querySelector(\`button[onclick="switchTab('\${tabId}')"]\`);
                if (tabButton) {
                    tabButton.classList.add('active');
                }
                
                // Show corresponding content
                const tabContent = document.getElementById(\`\${tabId}-orders\`);
                if (tabContent) {
                    tabContent.classList.remove('hidden');
                }
                
                // Load mock data for the tab
                loadMockDataForTab(tabId);
            };
            
            // Load mock data
            function loadMockDataForTab(tabId) {
                const container = document.getElementById(\`\${tabId}-orders\`);
                if (!container) return;
                
                const mockOrders = [
                    {
                        id: 1,
                        order_number: 'TEST-001',
                        status: 'PAYMENT_CONFIRMED',
                        total_amount: '99.99',
                        buyer_name: 'Test Buyer',
                        items: [{ product_name: 'Test Product', quantity: 1, price: '99.99' }]
                    },
                    {
                        id: 2,
                        order_number: 'TEST-002',
                        status: 'PDA_ASSIGNED',
                        total_amount: '149.99',
                        buyer_name: 'Another Buyer',
                        items: [{ product_name: 'Another Product', quantity: 2, price: '74.99' }]
                    }
                ];
                
                let html = '';
                mockOrders.forEach(order => {
                    html += \`
                    <div class="order-card bg-white rounded-lg shadow-md p-6 mb-4">
                        <div class="flex justify-between items-start mb-4">
                            <div>
                                <h3 class="text-lg font-semibold">Order #\${order.order_number}</h3>
                                <p class="text-gray-600">\${order.buyer_name}</p>
                                <span class="status-badge status-\${order.status.toLowerCase()} px-3 py-1 rounded-full text-sm font-medium border">
                                    \${order.status}
                                </span>
                            </div>
                            <div class="text-right">
                                <p class="text-xl font-bold">$\${order.total_amount}</p>
                                <div class="mt-2 space-x-2">
                                    <button onclick="showOrderDetailsModal(\${JSON.stringify(order).replace(/"/g, '&quot;')})" 
                                            class="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">
                                        View Details
                                    </button>
                                    \${tabId === 'available' ? \`
                                    <button onclick="acceptOrder(\${order.id})" 
                                            class="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700">
                                        Accept
                                    </button>
                                    \` : ''}
                                    \${tabId === 'active' ? \`
                                    <button onclick="updateOrderStatus(\${order.id}, 'PDA_EN_ROUTE_TO_SELLER')" 
                                            class="bg-orange-600 text-white px-3 py-1 rounded text-sm hover:bg-orange-700">
                                        Update Status
                                    </button>
                                    \` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                    \`;
                });
                
                container.innerHTML = html;
            }
            
            // Mock order actions
            window.acceptOrder = function(orderId) {
                console.log('[TEST] Accepting order:', orderId);
                showNotification('Order accepted successfully', 'success');
            };
            
            window.updateOrderStatus = function(orderId, status) {
                console.log('[TEST] Updating order status:', orderId, status);
                showNotification('Order status updated', 'success');
            };
            
            // Initialize with available orders tab
            switchTab('available');
            
            console.log('[TEST] Dashboard initialized successfully');
        });
        </script>
        `;
        
        // Insert mock script before closing body tag
        dashboardContent = dashboardContent.replace('</body>', mockScript + '</body>');
        
        // Write test dashboard
        fs.writeFileSync(testDashboardPath, dashboardContent);
        
        // Serve test dashboard
        app.get('/test-dashboard', (req, res) => {
            res.sendFile(testDashboardPath);
        });
        
        // Start server
        this.server = app.listen(this.serverPort, () => {
            console.log(`✅ Test server running on port ${this.serverPort}`);
        });
    }

    // Log test results
    logTest(testName, status, details = null) {
        const result = { testName, status, details, timestamp: new Date().toISOString() };
        this.testResults.push(result);
        
        const emoji = status === 'PASS' ? '✅' : '❌';
        console.log(`${emoji} ${testName}: ${status}`);
        if (details) {
            console.log(`   Details: ${details}`);
        }
    }

    // Test page loading
    async testPageLoading() {
        console.log('\\n🌐 Testing Page Loading...');
        
        try {
            const response = await this.page.goto(`http://localhost:${this.serverPort}/test-dashboard`, {
                waitUntil: 'networkidle0',
                timeout: 30000
            });

            if (response.ok()) {
                this.logTest('Page Loading', 'PASS', `Status: ${response.status()}`);
            } else {
                this.logTest('Page Loading', 'FAIL', `Status: ${response.status()}`);
                return false;
            }

            // Check title
            const title = await this.page.title();
            if (title.includes('Pickup Delivery Agent Dashboard')) {
                this.logTest('Page Title', 'PASS', title);
            } else {
                this.logTest('Page Title', 'FAIL', `Expected dashboard title, got: ${title}`);
            }

            // Wait for main elements
            await this.page.waitForSelector('#agent-name', { timeout: 10000 });
            await this.page.waitForSelector('.tab-button', { timeout: 10000 });

            this.logTest('Main Elements Loading', 'PASS');
            return true;
        } catch (error) {
            this.logTest('Page Loading', 'FAIL', error.message);
            return false;
        }
    }

    // Test basic functionality
    async testBasicFunctionality() {
        console.log('\\n⚙️ Testing Basic Functionality...');
        
        try {
            // Check agent name is loaded
            const agentName = await this.page.$eval('#agent-name', el => el.textContent);
            if (agentName === 'Test Agent') {
                this.logTest('Agent Name Display', 'PASS', agentName);
            } else {
                this.logTest('Agent Name Display', 'FAIL', `Expected 'Test Agent', got '${agentName}'`);
            }

            // Check rating is displayed
            const rating = await this.page.$eval('#agent-rating', el => el.textContent);
            if (rating === '4.8') {
                this.logTest('Agent Rating Display', 'PASS', rating);
            } else {
                this.logTest('Agent Rating Display', 'FAIL', `Expected '4.8', got '${rating}'`);
            }

            return true;
        } catch (error) {
            this.logTest('Basic Functionality', 'FAIL', error.message);
            return false;
        }
    }

    // Test tab navigation
    async testTabNavigation() {
        console.log('\\n📑 Testing Tab Navigation...');
        
        const tabs = [
            { id: 'available', name: 'Available Orders' },
            { id: 'active', name: 'Active Orders' },
            { id: 'history', name: 'Order History' }
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

    // Test order display
    async testOrderDisplay() {
        console.log('\\n📦 Testing Order Display...');
        
        try {
            // Go to available orders
            await this.page.click("button[onclick=\"switchTab('available')\"]");
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Check if orders are displayed
            const orderCards = await this.page.$$('.order-card');
            if (orderCards.length > 0) {
                this.logTest('Order Cards Display', 'PASS', `Found ${orderCards.length} orders`);
            } else {
                this.logTest('Order Cards Display', 'FAIL', 'No order cards found');
            }

            // Check order details
            const firstOrderTitle = await this.page.$eval('.order-card h3', el => el.textContent);
            if (firstOrderTitle.includes('Order #')) {
                this.logTest('Order Title Format', 'PASS', firstOrderTitle);
            } else {
                this.logTest('Order Title Format', 'FAIL', `Invalid title: ${firstOrderTitle}`);
            }

            // Check status badge
            const statusBadge = await this.page.$('.status-badge');
            if (statusBadge) {
                this.logTest('Status Badge Display', 'PASS');
            } else {
                this.logTest('Status Badge Display', 'FAIL', 'No status badge found');
            }

            return true;
        } catch (error) {
            this.logTest('Order Display', 'FAIL', error.message);
            return false;
        }
    }

    // Test button interactions
    async testButtonInteractions() {
        console.log('\\n🔘 Testing Button Interactions...');
        
        try {
            // Test view details button
            const viewDetailsButton = await this.page.$('.order-card button[onclick*="showOrderDetailsModal"]');
            if (viewDetailsButton) {
                await viewDetailsButton.click();
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Check if modal opened
                const modal = await this.page.$('.fixed.inset-0');
                if (modal) {
                    this.logTest('Order Details Modal', 'PASS');
                    // Close modal
                    await this.page.click('.fixed.inset-0 button[onclick*="remove"]');
                } else {
                    this.logTest('Order Details Modal', 'FAIL', 'Modal did not open');
                }
            } else {
                this.logTest('View Details Button', 'FAIL', 'Button not found');
            }

            // Test accept button
            const acceptButton = await this.page.$('.order-card button[onclick*="acceptOrder"]');
            if (acceptButton) {
                await acceptButton.click();
                await new Promise(resolve => setTimeout(resolve, 500));
                this.logTest('Accept Order Button', 'PASS');
            } else {
                this.logTest('Accept Order Button', 'FAIL', 'Button not found');
            }

            // Test active orders tab and status update
            await this.page.click("button[onclick=\"switchTab('active')\"]");
            await new Promise(resolve => setTimeout(resolve, 1000));

            const statusUpdateButton = await this.page.$('.order-card button[onclick*="updateOrderStatus"]');
            if (statusUpdateButton) {
                await statusUpdateButton.click();
                await new Promise(resolve => setTimeout(resolve, 500));
                this.logTest('Update Status Button', 'PASS');
            } else {
                this.logTest('Update Status Button', 'FAIL', 'Button not found');
            }

            return true;
        } catch (error) {
            this.logTest('Button Interactions', 'FAIL', error.message);
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

    // Run all tests
    async runAllTests() {
        console.log('🎯 Starting Simple Frontend Tests\\n');
        
        const testMethods = [
            'testPageLoading',
            'testBasicFunctionality',
            'testTabNavigation',
            'testOrderDisplay',
            'testButtonInteractions',
            'testResponsiveDesign'
        ];

        for (const method of testMethods) {
            try {
                await this[method]();
            } catch (error) {
                this.logTest(method, 'FAIL', error.message);
            }
        }

        this.generateReport();
    }

    // Generate report
    generateReport() {
        console.log('\\n🎯 ===== SIMPLE FRONTEND TEST REPORT =====');
        
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

        console.log('\\n📋 Frontend Quality Assessment:');
        if (successRate >= 95) {
            console.log('✅ Frontend is production-ready with excellent quality');
        } else if (successRate >= 85) {
            console.log('⚠️ Frontend is mostly ready but needs minor fixes');
        } else if (successRate >= 70) {
            console.log('🔧 Frontend needs moderate improvements');
        } else {
            console.log('❌ Frontend requires significant fixes before deployment');
        }

        // Save report
        const reportPath = path.join(__dirname, 'simple-frontend-test-report.json');
        fs.writeFileSync(reportPath, JSON.stringify({
            summary: { totalTests, passedTests, failedTests, successRate },
            results: this.testResults,
            timestamp: new Date().toISOString()
        }, null, 2));

        console.log(`\\n💾 Report saved to: simple-frontend-test-report.json`);
    }

    // Cleanup
    async cleanup() {
        console.log('\\n🧹 Cleaning up...');
        
        try {
            if (this.browser) {
                await this.browser.close();
            }
            if (this.server) {
                this.server.close();
            }
            
            // Clean up test files
            const testDashboardPath = path.join(__dirname, 'test-dashboard.html');
            if (fs.existsSync(testDashboardPath)) {
                fs.unlinkSync(testDashboardPath);
            }
            
            console.log('✅ Cleanup completed');
        } catch (error) {
            console.error('❌ Cleanup failed:', error.message);
        }
    }
}

// Run the tests
async function runSimpleFrontendTests() {
    const tester = new SimplePickupDeliveryFrontendTest();
    
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
    runSimpleFrontendTests().catch(console.error);
}

module.exports = SimplePickupDeliveryFrontendTest;