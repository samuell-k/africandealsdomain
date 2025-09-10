/**
 * Real-World Pickup Delivery Agent Dashboard Testing Suite
 * This script tests the dashboard with actual database data and user interactions
 */

class PickupDeliveryDashboardTester {
    constructor() {
        this.testResults = [];
        this.currentUser = null;
        this.testOrders = [];
        this.apiBaseUrl = window.location.origin;
        this.authToken = null;
    }

    // Initialize testing environment
    async init() {
        console.log('🚀 Starting Real-World Dashboard Testing...');
        this.logTest('INIT', 'Testing environment initialized');
        
        // Check if we're on the correct page
        if (!window.location.pathname.includes('pickup-delivery-dashboard.html')) {
            this.logTest('ERROR', 'Not on pickup delivery dashboard page');
            return false;
        }

        // Check if required functions are loaded
        this.checkRequiredFunctions();
        
        // Test authentication
        await this.testAuthentication();
        
        // Test dashboard loading
        await this.testDashboardLoading();
        
        // Test with real database data
        await this.testWithRealData();
        
        // Test user interactions
        await this.testUserInteractions();
        
        // Test error scenarios
        await this.testErrorScenarios();
        
        // Generate test report
        this.generateTestReport();
        
        return true;
    }

    // Log test results
    logTest(type, message, data = null) {
        const timestamp = new Date().toISOString();
        const testResult = {
            timestamp,
            type,
            message,
            data,
            status: type === 'ERROR' ? 'FAILED' : 'PASSED'
        };
        
        this.testResults.push(testResult);
        
        const emoji = type === 'ERROR' ? '❌' : type === 'SUCCESS' ? '✅' : '📝';
        console.log(`${emoji} [${type}] ${message}`, data || '');
    }

    // Check if all required functions are available
    checkRequiredFunctions() {
        const requiredFunctions = [
            'showOrderDetailsModal',
            'refreshDashboard',
            'refreshAvailableOrders',
            'refreshActiveOrders',
            'refreshOrderHistory',
            'refreshEnhancedTracking',
            'refreshConfirmations',
            'showKeyboardShortcuts',
            'switchTab',
            'showNotification'
        ];

        let missingFunctions = [];
        
        requiredFunctions.forEach(funcName => {
            if (typeof window[funcName] !== 'function') {
                missingFunctions.push(funcName);
            }
        });

        if (missingFunctions.length > 0) {
            this.logTest('ERROR', 'Missing required functions', missingFunctions);
            return false;
        } else {
            this.logTest('SUCCESS', 'All required functions are available');
            return true;
        }
    }

    // Test authentication with real user data
    async testAuthentication() {
        try {
            // Check if auth token exists
            this.authToken = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
            
            if (!this.authToken) {
                this.logTest('ERROR', 'No authentication token found');
                return false;
            }

            // Verify token with server
            const response = await fetch(`${this.apiBaseUrl}/api/pickup-delivery-agent/profile`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                this.currentUser = await response.json();
                this.logTest('SUCCESS', 'Authentication successful', {
                    userId: this.currentUser.id,
                    name: this.currentUser.name,
                    role: this.currentUser.role
                });
                return true;
            } else {
                this.logTest('ERROR', 'Authentication failed', { status: response.status });
                return false;
            }
        } catch (error) {
            this.logTest('ERROR', 'Authentication error', error.message);
            return false;
        }
    }

    // Test dashboard loading with real data
    async testDashboardLoading() {
        try {
            // Test loading available orders
            const availableResponse = await fetch(`${this.apiBaseUrl}/api/pickup-delivery-agent/available-orders`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (availableResponse.ok) {
                const availableOrders = await availableResponse.json();
                this.logTest('SUCCESS', 'Available orders loaded', { count: availableOrders.length });
                this.testOrders.push(...availableOrders);
            } else {
                this.logTest('ERROR', 'Failed to load available orders', { status: availableResponse.status });
            }

            // Test loading active orders
            const activeResponse = await fetch(`${this.apiBaseUrl}/api/pickup-delivery-agent/active-orders`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (activeResponse.ok) {
                const activeOrders = await activeResponse.json();
                this.logTest('SUCCESS', 'Active orders loaded', { count: activeOrders.length });
                this.testOrders.push(...activeOrders);
            } else {
                this.logTest('ERROR', 'Failed to load active orders', { status: activeResponse.status });
            }

            // Test loading order history
            const historyResponse = await fetch(`${this.apiBaseUrl}/api/pickup-delivery-agent/order-history`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (historyResponse.ok) {
                const orderHistory = await historyResponse.json();
                this.logTest('SUCCESS', 'Order history loaded', { count: orderHistory.length });
            } else {
                this.logTest('ERROR', 'Failed to load order history', { status: historyResponse.status });
            }

        } catch (error) {
            this.logTest('ERROR', 'Dashboard loading error', error.message);
        }
    }

    // Test with real database data
    async testWithRealData() {
        if (this.testOrders.length === 0) {
            this.logTest('ERROR', 'No test orders available from database');
            return;
        }

        // Test order details modal with real data
        const testOrder = this.testOrders[0];
        try {
            // Test showOrderDetailsModal function
            if (typeof showOrderDetailsModal === 'function') {
                showOrderDetailsModal(testOrder);
                
                // Check if modal was created
                setTimeout(() => {
                    const modal = document.querySelector('.fixed.inset-0');
                    if (modal) {
                        this.logTest('SUCCESS', 'Order details modal created successfully');
                        // Close modal after test
                        modal.remove();
                    } else {
                        this.logTest('ERROR', 'Order details modal not created');
                    }
                }, 100);
            }
        } catch (error) {
            this.logTest('ERROR', 'Order details modal test failed', error.message);
        }

        // Test with different order statuses
        const statusesToTest = ['ASSIGNED_TO_PDA', 'PDA_AT_SELLER', 'PICKED_FROM_SELLER', 'EN_ROUTE_TO_PSM'];
        statusesToTest.forEach(status => {
            const orderWithStatus = { ...testOrder, status: status };
            try {
                showOrderDetailsModal(orderWithStatus);
                setTimeout(() => {
                    const modal = document.querySelector('.fixed.inset-0');
                    if (modal) {
                        this.logTest('SUCCESS', `Modal works with status: ${status}`);
                        modal.remove();
                    }
                }, 50);
            } catch (error) {
                this.logTest('ERROR', `Modal failed with status: ${status}`, error.message);
            }
        });
    }

    // Test user interactions
    async testUserInteractions() {
        // Test tab switching
        const tabs = ['available', 'active', 'enhanced', 'confirmations', 'history', 'settings'];
        
        tabs.forEach(tab => {
            try {
                if (typeof switchTab === 'function') {
                    switchTab(tab);
                    
                    // Check if tab is active
                    const activeTab = document.querySelector(`#tab-${tab}`);
                    if (activeTab && activeTab.classList.contains('active')) {
                        this.logTest('SUCCESS', `Tab switching works: ${tab}`);
                    } else {
                        this.logTest('ERROR', `Tab switching failed: ${tab}`);
                    }
                } else {
                    this.logTest('ERROR', 'switchTab function not available');
                }
            } catch (error) {
                this.logTest('ERROR', `Tab switching error: ${tab}`, error.message);
            }
        });

        // Test refresh functions
        const refreshFunctions = [
            'refreshAvailableOrders',
            'refreshActiveOrders',
            'refreshOrderHistory',
            'refreshEnhancedTracking',
            'refreshConfirmations'
        ];

        refreshFunctions.forEach(funcName => {
            try {
                if (typeof window[funcName] === 'function') {
                    window[funcName]();
                    this.logTest('SUCCESS', `${funcName} executed successfully`);
                } else {
                    this.logTest('ERROR', `${funcName} function not available`);
                }
            } catch (error) {
                this.logTest('ERROR', `${funcName} execution failed`, error.message);
            }
        });

        // Test keyboard shortcuts
        this.testKeyboardShortcuts();
    }

    // Test keyboard shortcuts
    testKeyboardShortcuts() {
        const shortcuts = [
            { key: '1', altKey: true, expectedTab: 'available' },
            { key: '2', altKey: true, expectedTab: 'active' },
            { key: '3', altKey: true, expectedTab: 'enhanced' }
        ];

        shortcuts.forEach(shortcut => {
            try {
                const event = new KeyboardEvent('keydown', {
                    key: shortcut.key,
                    altKey: shortcut.altKey,
                    bubbles: true
                });
                
                document.dispatchEvent(event);
                
                // Check if correct tab is active
                setTimeout(() => {
                    const activeTab = document.querySelector(`#tab-${shortcut.expectedTab}`);
                    if (activeTab && activeTab.classList.contains('active')) {
                        this.logTest('SUCCESS', `Keyboard shortcut works: Alt+${shortcut.key}`);
                    } else {
                        this.logTest('ERROR', `Keyboard shortcut failed: Alt+${shortcut.key}`);
                    }
                }, 50);
            } catch (error) {
                this.logTest('ERROR', `Keyboard shortcut error: Alt+${shortcut.key}`, error.message);
            }
        });
    }

    // Test error scenarios
    async testErrorScenarios() {
        // Test with null/undefined order data
        try {
            showOrderDetailsModal(null);
            this.logTest('SUCCESS', 'Handles null order data gracefully');
        } catch (error) {
            this.logTest('ERROR', 'Failed to handle null order data', error.message);
        }

        try {
            showOrderDetailsModal(undefined);
            this.logTest('SUCCESS', 'Handles undefined order data gracefully');
        } catch (error) {
            this.logTest('ERROR', 'Failed to handle undefined order data', error.message);
        }

        // Test with malformed order data
        const malformedOrder = {
            id: null,
            status: undefined,
            buyer_name: '',
            items: null
        };

        try {
            showOrderDetailsModal(malformedOrder);
            this.logTest('SUCCESS', 'Handles malformed order data gracefully');
        } catch (error) {
            this.logTest('ERROR', 'Failed to handle malformed order data', error.message);
        }

        // Test API error scenarios
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/pickup-delivery-agent/nonexistent-endpoint`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 404) {
                this.logTest('SUCCESS', 'API correctly returns 404 for nonexistent endpoints');
            } else {
                this.logTest('ERROR', 'Unexpected response for nonexistent endpoint', { status: response.status });
            }
        } catch (error) {
            this.logTest('SUCCESS', 'Network error handled gracefully', error.message);
        }
    }

    // Generate comprehensive test report
    generateTestReport() {
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(test => test.status === 'PASSED').length;
        const failedTests = this.testResults.filter(test => test.status === 'FAILED').length;
        const successRate = ((passedTests / totalTests) * 100).toFixed(2);

        console.log('\n🎯 ===== PICKUP DELIVERY DASHBOARD TEST REPORT =====');
        console.log(`📊 Total Tests: ${totalTests}`);
        console.log(`✅ Passed: ${passedTests}`);
        console.log(`❌ Failed: ${failedTests}`);
        console.log(`📈 Success Rate: ${successRate}%`);
        console.log('\n📋 Detailed Results:');

        this.testResults.forEach((test, index) => {
            const emoji = test.status === 'PASSED' ? '✅' : '❌';
            console.log(`${emoji} ${index + 1}. [${test.type}] ${test.message}`);
            if (test.data) {
                console.log(`   Data:`, test.data);
            }
        });

        // Create visual report in the page
        this.createVisualReport(totalTests, passedTests, failedTests, successRate);

        // Save report to localStorage for later analysis
        localStorage.setItem('dashboardTestReport', JSON.stringify({
            timestamp: new Date().toISOString(),
            totalTests,
            passedTests,
            failedTests,
            successRate,
            results: this.testResults
        }));

        console.log('\n💾 Test report saved to localStorage as "dashboardTestReport"');
    }

    // Create visual test report in the page
    createVisualReport(totalTests, passedTests, failedTests, successRate) {
        const reportDiv = document.createElement('div');
        reportDiv.id = 'test-report';
        reportDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 300px;
            background: white;
            border: 2px solid #3B82F6;
            border-radius: 8px;
            padding: 16px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
            font-family: Arial, sans-serif;
            font-size: 14px;
        `;

        reportDiv.innerHTML = `
            <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 12px;">
                <h3 style="margin: 0; color: #1F2937;">🎯 Test Report</h3>
                <button onclick="this.parentElement.parentElement.remove()" style="background: #EF4444; color: white; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer;">×</button>
            </div>
            <div style="margin-bottom: 8px;">
                <strong>Total Tests:</strong> ${totalTests}
            </div>
            <div style="margin-bottom: 8px; color: #10B981;">
                <strong>✅ Passed:</strong> ${passedTests}
            </div>
            <div style="margin-bottom: 8px; color: #EF4444;">
                <strong>❌ Failed:</strong> ${failedTests}
            </div>
            <div style="margin-bottom: 12px;">
                <strong>Success Rate:</strong> ${successRate}%
            </div>
            <div style="background: #F3F4F6; padding: 8px; border-radius: 4px; font-size: 12px;">
                <div>Report saved to localStorage</div>
                <div>Check console for details</div>
            </div>
        `;

        document.body.appendChild(reportDiv);

        // Auto-remove after 30 seconds
        setTimeout(() => {
            if (document.getElementById('test-report')) {
                document.getElementById('test-report').remove();
            }
        }, 30000);
    }
}

// Auto-start testing when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit for the dashboard to initialize
    setTimeout(async () => {
        const tester = new PickupDeliveryDashboardTester();
        await tester.init();
    }, 2000);
});

// Export for manual testing
window.PickupDeliveryDashboardTester = PickupDeliveryDashboardTester;