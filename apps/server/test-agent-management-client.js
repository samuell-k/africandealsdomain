/**
 * Unit Tests for Agent Management Client-Side Functions
 * 
 * Tests the JavaScript functions in the agent-management.html page
 * to ensure proper functionality of the admin interface.
 */

const { JSDOM } = require('jsdom');

// Create a mock DOM environment
const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<head>
    <title>Agent Management Tests</title>
</head>
<body>
    <!-- Mock HTML structure for testing -->
    <div id="pending-registrations" class="tab-content">
        <table>
            <tbody id="registrationsTableBody"></tbody>
        </table>
        <span id="pendingCount" style="display: none;"></span>
    </div>
    
    <div id="create-agent" class="tab-content hidden"></div>
    <div id="agent-types" class="tab-content hidden"></div>
    <div id="agent-performance" class="tab-content hidden"></div>
    
    <button class="tab-button" data-tab="pending-registrations">Pending</button>
    <button class="tab-button" data-tab="create-agent">Create</button>
    
    <select id="statusFilter"></select>
    <select id="agentTypeFilter"></select>
    <input type="date" id="dateFilter">
    <select id="createAgentType"></select>
</body>
</html>
`, { runScripts: "outside-only" });

// Set up the global environment
global.window = dom.window;
global.document = dom.window.document;
global.console = console;

// Mock functions that would be available in the browser
global.showLoading = function(show) {
    console.log(`Loading indicator: ${show ? 'shown' : 'hidden'}`);
};

global.showError = function(message) {
    console.log(`Error: ${message}`);
};

global.showNotification = function(message, type) {
    console.log(`Notification (${type}): ${message}`);
};

// Mock AdminAPI class
global.adminAPI = {
    async request(url, options = {}) {
        // Simulate different API responses based on URL
        if (url.includes('agent-registrations')) {
            return {
                success: true,
                data: [
                    {
                        id: 1,
                        first_name: 'Test',
                        last_name: 'Agent',
                        email: 'test@example.com',
                        phone: '+250788123456',
                        agent_type: 'fast_delivery',
                        verification_status: 'pending',
                        submitted_at: new Date().toISOString()
                    }
                ]
            };
        } else if (url.includes('agent-types')) {
            return {
                agentTypes: [
                    { type_code: 'fast_delivery', type_name: 'Fast Delivery' },
                    { type_code: 'pickup_delivery', type_name: 'Pickup Delivery' }
                ]
            };
        }
        return { success: true, data: [] };
    }
};

// Extract and execute the JavaScript functions from the HTML file
const fs = require('fs');
const path = require('path');

const htmlContent = fs.readFileSync(
    path.join(__dirname, '../client/admin/agent-management.html'), 
    'utf-8'
);

// Extract JavaScript code from the HTML file
const scriptMatch = htmlContent.match(/<script[^>]*>([\s\S]*?)<\/script>/g);
if (scriptMatch) {
    const jsCode = scriptMatch
        .map(script => script.replace(/<\/?script[^>]*>/g, ''))
        .join('\n');
    
    // Execute the JavaScript code in our mock environment
    eval(jsCode);
}

// Test Suite
class AgentManagementClientTests {
    constructor() {
        this.results = [];
    }

    addResult(testName, status, message) {
        this.results.push({
            name: testName,
            status,
            message,
            timestamp: new Date()
        });
    }

    // Test 1: Tab switching functionality works
    async testTabSwitching() {
        console.log('🧪 Testing: Tab switching functionality...');
        
        try {
            // Initial state check
            const initialTab = document.getElementById('pending-registrations');
            const createTab = document.getElementById('create-agent');
            
            // Switch to create-agent tab
            if (typeof switchTab === 'function') {
                switchTab('create-agent');
                
                // Check if tab switching worked
                if (createTab.classList.contains('active') && !createTab.classList.contains('hidden')) {
                    this.addResult('Tab switching functionality works', 'PASS', 'Tab switched successfully');
                } else {
                    this.addResult('Tab switching functionality works', 'FAIL', 'Tab switching did not work as expected');
                }
            } else {
                this.addResult('Tab switching functionality works', 'FAIL', 'switchTab function not found');
            }
        } catch (error) {
            this.addResult('Tab switching functionality works', 'FAIL', `Error: ${error.message}`);
        }
    }

    // Test 2: Agent registrations table updates
    async testRegistrationTableUpdates() {
        console.log('🧪 Testing: Agent registrations table updates...');
        
        try {
            if (typeof updateRegistrationsTable === 'function') {
                // Mock data
                global.agentRegistrations = [
                    {
                        id: 1,
                        first_name: 'John',
                        last_name: 'Doe',
                        email: 'john@example.com',
                        phone: '+250788123456',
                        agent_type: 'fast_delivery',
                        verification_status: 'pending',
                        submitted_at: new Date().toISOString()
                    }
                ];
                
                updateRegistrationsTable();
                
                const tableBody = document.getElementById('registrationsTableBody');
                if (tableBody && tableBody.innerHTML.includes('John Doe')) {
                    this.addResult('Agent registrations table updates', 'PASS', 'Table updated with registration data');
                } else {
                    this.addResult('Agent registrations table updates', 'FAIL', 'Table not updated correctly');
                }
            } else {
                this.addResult('Agent registrations table updates', 'FAIL', 'updateRegistrationsTable function not found');
            }
        } catch (error) {
            this.addResult('Agent registrations table updates', 'FAIL', `Error: ${error.message}`);
        }
    }

    // Test 3: Status badge classes correct
    testStatusBadgeClasses() {
        console.log('🧪 Testing: Status badge classes...');
        
        try {
            if (typeof getStatusBadgeClass === 'function') {
                const pendingClass = getStatusBadgeClass('pending');
                const approvedClass = getStatusBadgeClass('approved');
                const rejectedClass = getStatusBadgeClass('rejected');
                
                if (pendingClass.includes('yellow') && 
                    approvedClass.includes('green') && 
                    rejectedClass.includes('red')) {
                    this.addResult('Status badge classes correct', 'PASS', 'Badge classes are correct for all statuses');
                } else {
                    this.addResult('Status badge classes correct', 'FAIL', 'Badge classes are incorrect');
                }
            } else {
                this.addResult('Status badge classes correct', 'FAIL', 'getStatusBadgeClass function not found');
            }
        } catch (error) {
            this.addResult('Status badge classes correct', 'FAIL', `Error: ${error.message}`);
        }
    }

    // Test 4: Empty registration list display
    testEmptyRegistrationList() {
        console.log('🧪 Testing: Empty registration list display...');
        
        try {
            if (typeof updateRegistrationsTable === 'function') {
                // Set empty data
                global.agentRegistrations = [];
                
                updateRegistrationsTable();
                
                const tableBody = document.getElementById('registrationsTableBody');
                if (tableBody && tableBody.innerHTML.includes('No pending registrations found')) {
                    this.addResult('Empty registration list display', 'PASS', 'Empty state displayed correctly');
                } else {
                    this.addResult('Empty registration list display', 'FAIL', 'Empty state not displayed correctly');
                }
            } else {
                this.addResult('Empty registration list display', 'FAIL', 'updateRegistrationsTable function not found');
            }
        } catch (error) {
            this.addResult('Empty registration list display', 'FAIL', `Error: ${error.message}`);
        }
    }

    // Test 5: Filter functionality works correctly
    testFilterFunctionality() {
        console.log('🧪 Testing: Filter functionality...');
        
        try {
            if (typeof applyFilters === 'function') {
                // Setup mock data
                global.agentRegistrations = [
                    {
                        id: 1,
                        first_name: 'John',
                        last_name: 'Doe',
                        email: 'john@example.com',
                        phone: '+250788123456',
                        agent_type: 'fast_delivery',
                        verification_status: 'pending',
                        submitted_at: new Date().toISOString()
                    },
                    {
                        id: 2,
                        first_name: 'Jane',
                        last_name: 'Smith',
                        email: 'jane@example.com',
                        phone: '+250788123457',
                        agent_type: 'pickup_delivery',
                        verification_status: 'approved',
                        submitted_at: new Date().toISOString()
                    }
                ];
                
                // Test filtering (function exists)
                applyFilters();
                
                this.addResult('Filter functionality works correctly', 'PASS', 'Filter function executed without errors');
            } else {
                this.addResult('Filter functionality works correctly', 'FAIL', 'applyFilters function not found');
            }
        } catch (error) {
            this.addResult('Filter functionality works correctly', 'FAIL', `Error: ${error.message}`);
        }
    }

    // Test 6: Modal display registration details
    testModalDisplayRegistrationDetails() {
        console.log('🧪 Testing: Modal display registration details...');
        
        try {
            if (typeof showRegistrationModal === 'function') {
                const mockRegistration = {
                    id: 1,
                    first_name: 'John',
                    last_name: 'Doe',
                    email: 'john@example.com',
                    phone: '+250788123456',
                    agent_type: 'fast_delivery',
                    verification_status: 'pending',
                    submitted_at: new Date().toISOString(),
                    application_ref: 'APP-123-456'
                };
                
                showRegistrationModal(mockRegistration);
                
                const modal = document.getElementById('registrationModal');
                if (modal && modal.innerHTML.includes('John Doe')) {
                    this.addResult('Modal display registration details', 'PASS', 'Modal displayed with registration details');
                } else {
                    this.addResult('Modal display registration details', 'FAIL', 'Modal not displayed correctly');
                }
            } else {
                this.addResult('Modal display registration details', 'FAIL', 'showRegistrationModal function not found');
            }
        } catch (error) {
            this.addResult('Modal display registration details', 'FAIL', `Error: ${error.message}`);
        }
    }

    // Test 7: API error handling
    async testAPIErrorHandling() {
        console.log('🧪 Testing: API error handling...');
        
        try {
            if (typeof loadAgentRegistrations === 'function') {
                // Mock API to throw error
                const originalAPI = global.adminAPI;
                global.adminAPI = {
                    async request() {
                        throw new Error('Network error');
                    }
                };
                
                // This should handle the error gracefully
                await loadAgentRegistrations();
                
                // Restore original API
                global.adminAPI = originalAPI;
                
                this.addResult('API error handling', 'PASS', 'API errors handled gracefully');
            } else {
                this.addResult('API error handling', 'FAIL', 'loadAgentRegistrations function not found');
            }
        } catch (error) {
            this.addResult('API error handling', 'FAIL', `Error: ${error.message}`);
        }
    }

    // Test 8: Pending count updates correctly
    testPendingCountUpdates() {
        console.log('🧪 Testing: Pending count updates...');
        
        try {
            if (typeof updatePendingCount === 'function') {
                // Setup mock data
                global.agentRegistrations = [
                    { verification_status: 'pending' },
                    { verification_status: 'pending' },
                    { verification_status: 'approved' }
                ];
                
                updatePendingCount();
                
                const countElement = document.getElementById('pendingCount');
                if (countElement && countElement.textContent === '2') {
                    this.addResult('Pending count updates correctly', 'PASS', 'Pending count updated correctly');
                } else {
                    this.addResult('Pending count updates correctly', 'FAIL', `Expected count: 2, Got: ${countElement.textContent}`);
                }
            } else {
                this.addResult('Pending count updates correctly', 'FAIL', 'updatePendingCount function not found');
            }
        } catch (error) {
            this.addResult('Pending count updates correctly', 'FAIL', `Error: ${error.message}`);
        }
    }

    // Run all tests
    async runAllTests() {
        console.log('🧪 Starting Agent Management Client-Side Tests...\n');
        
        await this.testTabSwitching();
        await this.testRegistrationTableUpdates();
        this.testStatusBadgeClasses();
        this.testEmptyRegistrationList();
        this.testFilterFunctionality();
        this.testModalDisplayRegistrationDetails();
        await this.testAPIErrorHandling();
        this.testPendingCountUpdates();
        
        this.printResults();
    }

    // Print test results
    printResults() {
        const passed = this.results.filter(r => r.status === 'PASS').length;
        const failed = this.results.filter(r => r.status === 'FAIL').length;
        const total = this.results.length;
        
        console.log('\n📊 CLIENT-SIDE TEST REPORT');
        console.log('==========================');
        console.log(`Total Tests: ${total}`);
        console.log(`Passed: ${passed} ✅`);
        console.log(`Failed: ${failed} ❌`);
        console.log(`Success Rate: ${Math.round((passed / total) * 100)}%`);
        
        console.log('\nDetailed Results:');
        console.log('=================');
        
        this.results.forEach((result, index) => {
            const status = result.status === 'PASS' ? '✅' : '❌';
            console.log(`${index + 1}. ${status} ${result.name}`);
            console.log(`   Status: ${result.status}`);
            console.log(`   Message: ${result.message}`);
            console.log(`   Time: ${result.timestamp.toISOString()}`);
            console.log();
        });
        
        if (failed === 0) {
            console.log('🎉 All client-side tests completed successfully!');
        } else {
            console.log(`⚠️  ${failed} test(s) failed. Please check the implementation.`);
        }
    }
}

// Run the tests
async function runTests() {
    const testRunner = new AgentManagementClientTests();
    await testRunner.runAllTests();
}

// Execute tests if this file is run directly
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = AgentManagementClientTests;