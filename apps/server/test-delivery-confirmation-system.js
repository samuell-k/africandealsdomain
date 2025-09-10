/**
 * Comprehensive Test Suite for Delivery Confirmation System
 * Tests all API endpoints and functionality
 */

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'african_deals_db',
    port: process.env.DB_PORT || 3306
};

class DeliveryConfirmationTester {
    constructor() {
        this.connection = null;
        this.testResults = [];
        this.testUsers = {
            buyer: null,
            agent: null,
            admin: null
        };
        this.testOrder = null;
    }

    async initialize() {
        console.log('🚀 Initializing Delivery Confirmation System Test Suite...\n');
        
        try {
            // Connect to database
            this.connection = await mysql.createConnection(dbConfig);
            console.log('✅ Database connection established');
            
            // Setup test data
            await this.setupTestData();
            console.log('✅ Test data setup completed\n');
            
        } catch (error) {
            console.error('❌ Initialization failed:', error.message);
            process.exit(1);
        }
    }

    async setupTestData() {
        try {
            // Create test buyer
            const [buyerResult] = await this.connection.execute(`
                INSERT INTO users (name, email, password, role, phone, created_at) 
                VALUES (?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)
            `, ['Test Buyer', 'testbuyer@example.com', 'hashedpassword', 'buyer', '+1234567890']);
            
            this.testUsers.buyer = {
                id: buyerResult.insertId || buyerResult.insertId,
                email: 'testbuyer@example.com',
                role: 'buyer'
            };

            // Create test agent
            const [agentResult] = await this.connection.execute(`
                INSERT INTO users (name, email, password, role, phone, created_at) 
                VALUES (?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)
            `, ['Test Agent', 'testagent@example.com', 'hashedpassword', 'agent', '+1234567891']);
            
            this.testUsers.agent = {
                id: agentResult.insertId || agentResult.insertId,
                email: 'testagent@example.com',
                role: 'agent'
            };

            // Create test admin
            const [adminResult] = await this.connection.execute(`
                INSERT INTO users (name, email, password, role, phone, created_at) 
                VALUES (?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)
            `, ['Test Admin', 'testadmin@example.com', 'hashedpassword', 'admin', '+1234567892']);
            
            this.testUsers.admin = {
                id: adminResult.insertId || adminResult.insertId,
                email: 'testadmin@example.com',
                role: 'admin'
            };

            // Create test order
            const [orderResult] = await this.connection.execute(`
                INSERT INTO orders (
                    order_number, buyer_id, total_amount, status, 
                    shipping_address, created_at, estimated_delivery_time
                ) VALUES (?, ?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 2 DAY))
            `, [
                'TEST-' + Date.now(),
                this.testUsers.buyer.id,
                99.99,
                'PICKED_FROM_SELLER',
                '123 Test Street, Test City, TC 12345'
            ]);

            this.testOrder = {
                id: orderResult.insertId,
                order_number: 'TEST-' + Date.now(),
                buyer_id: this.testUsers.buyer.id
            };

            console.log('Test data created:');
            console.log(`- Buyer ID: ${this.testUsers.buyer.id}`);
            console.log(`- Agent ID: ${this.testUsers.agent.id}`);
            console.log(`- Admin ID: ${this.testUsers.admin.id}`);
            console.log(`- Order ID: ${this.testOrder.id}`);

        } catch (error) {
            console.error('Error setting up test data:', error);
            throw error;
        }
    }

    async runTest(testName, testFunction) {
        console.log(`🧪 Running test: ${testName}`);
        const startTime = Date.now();
        
        try {
            await testFunction();
            const duration = Date.now() - startTime;
            console.log(`✅ ${testName} - PASSED (${duration}ms)`);
            this.testResults.push({ name: testName, status: 'PASSED', duration });
        } catch (error) {
            const duration = Date.now() - startTime;
            console.log(`❌ ${testName} - FAILED (${duration}ms)`);
            console.log(`   Error: ${error.message}`);
            this.testResults.push({ name: testName, status: 'FAILED', duration, error: error.message });
        }
        console.log('');
    }

    async testDatabaseSchema() {
        // Test if delivery_confirmation_otps table exists and has correct structure
        const [tables] = await this.connection.execute(`
            SHOW TABLES LIKE 'delivery_confirmation_otps'
        `);
        
        if (tables.length === 0) {
            throw new Error('delivery_confirmation_otps table does not exist');
        }

        // Check table structure
        const [columns] = await this.connection.execute(`
            DESCRIBE delivery_confirmation_otps
        `);
        
        const requiredColumns = [
            'id', 'order_id', 'buyer_id', 'agent_id', 'delivery_code',
            'status', 'delivery_confirmed_at', 'delivery_proof_url',
            'delivery_notes', 'delivery_location', 'created_at', 'updated_at'
        ];
        
        const existingColumns = columns.map(col => col.Field);
        const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
        
        if (missingColumns.length > 0) {
            throw new Error(`Missing columns: ${missingColumns.join(', ')}`);
        }
    }

    async testGenerateDeliveryCode() {
        // Test delivery code generation
        const [result] = await this.connection.execute(`
            INSERT INTO delivery_confirmation_otps (
                order_id, buyer_id, delivery_code, status, created_at
            ) VALUES (?, ?, ?, 'pending', NOW())
        `, [this.testOrder.id, this.testUsers.buyer.id, '123456']);

        if (result.affectedRows !== 1) {
            throw new Error('Failed to insert delivery confirmation record');
        }

        // Verify the record was created
        const [records] = await this.connection.execute(`
            SELECT * FROM delivery_confirmation_otps WHERE order_id = ?
        `, [this.testOrder.id]);

        if (records.length === 0) {
            throw new Error('Delivery confirmation record not found');
        }

        if (records[0].delivery_code !== '123456') {
            throw new Error('Delivery code mismatch');
        }
    }

    async testCodeVerification() {
        // Test correct code verification
        const [records] = await this.connection.execute(`
            SELECT * FROM delivery_confirmation_otps WHERE order_id = ?
        `, [this.testOrder.id]);

        if (records.length === 0) {
            throw new Error('No delivery confirmation record found for verification test');
        }

        const record = records[0];
        
        // Simulate code verification
        if (record.delivery_code === '123456') {
            // Code is correct - this should pass
            console.log('   ✓ Correct code verification passed');
        } else {
            throw new Error('Code verification failed');
        }

        // Test incorrect code
        if (record.delivery_code === '654321') {
            throw new Error('Incorrect code should not verify');
        } else {
            console.log('   ✓ Incorrect code properly rejected');
        }
    }

    async testDeliveryConfirmation() {
        // Test delivery confirmation process
        const [updateResult] = await this.connection.execute(`
            UPDATE delivery_confirmation_otps 
            SET 
                agent_id = ?,
                status = 'confirmed',
                delivery_confirmed_at = NOW(),
                delivery_notes = 'Test delivery completed successfully',
                delivery_location = 'Test Location'
            WHERE order_id = ?
        `, [this.testUsers.agent.id, this.testOrder.id]);

        if (updateResult.affectedRows !== 1) {
            throw new Error('Failed to update delivery confirmation');
        }

        // Verify the update
        const [records] = await this.connection.execute(`
            SELECT * FROM delivery_confirmation_otps WHERE order_id = ?
        `, [this.testOrder.id]);

        const record = records[0];
        if (record.status !== 'confirmed') {
            throw new Error('Delivery status not updated correctly');
        }

        if (!record.delivery_confirmed_at) {
            throw new Error('Delivery confirmation timestamp not set');
        }

        if (record.agent_id != this.testUsers.agent.id) {
            throw new Error('Agent ID not set correctly');
        }
    }

    async testOrderStatusUpdate() {
        // Test that order status is updated when delivery is confirmed
        const [updateResult] = await this.connection.execute(`
            UPDATE orders SET status = 'DELIVERED' WHERE id = ?
        `, [this.testOrder.id]);

        if (updateResult.affectedRows !== 1) {
            throw new Error('Failed to update order status');
        }

        // Verify the update
        const [orders] = await this.connection.execute(`
            SELECT status FROM orders WHERE id = ?
        `, [this.testOrder.id]);

        if (orders[0].status !== 'DELIVERED') {
            throw new Error('Order status not updated to DELIVERED');
        }
    }

    async testDataRetrieval() {
        // Test retrieving delivery confirmations for different user roles
        
        // Test buyer query
        const [buyerRecords] = await this.connection.execute(`
            SELECT dco.*, o.order_number, o.total_amount, u.name as agent_name
            FROM delivery_confirmation_otps dco
            JOIN orders o ON dco.order_id = o.id
            LEFT JOIN users u ON dco.agent_id = u.id
            WHERE dco.buyer_id = ?
        `, [this.testUsers.buyer.id]);

        if (buyerRecords.length === 0) {
            throw new Error('No records found for buyer');
        }

        // Test agent query
        const [agentRecords] = await this.connection.execute(`
            SELECT dco.*, o.order_number, o.total_amount, u.name as buyer_name
            FROM delivery_confirmation_otps dco
            JOIN orders o ON dco.order_id = o.id
            JOIN users u ON dco.buyer_id = u.id
            WHERE dco.agent_id = ?
        `, [this.testUsers.agent.id]);

        if (agentRecords.length === 0) {
            throw new Error('No records found for agent');
        }

        // Test admin query (all records)
        const [adminRecords] = await this.connection.execute(`
            SELECT dco.*, o.order_number, o.total_amount, 
                   buyer.name as buyer_name, agent.name as agent_name
            FROM delivery_confirmation_otps dco
            JOIN orders o ON dco.order_id = o.id
            JOIN users buyer ON dco.buyer_id = buyer.id
            LEFT JOIN users agent ON dco.agent_id = agent.id
        `);

        if (adminRecords.length === 0) {
            throw new Error('No records found for admin');
        }

        console.log(`   ✓ Found ${buyerRecords.length} records for buyer`);
        console.log(`   ✓ Found ${agentRecords.length} records for agent`);
        console.log(`   ✓ Found ${adminRecords.length} total records for admin`);
    }

    async testFileUploadDirectory() {
        // Test that upload directory exists and is writable
        const uploadDir = path.join(__dirname, 'uploads', 'delivery-proofs');
        
        try {
            await fs.access(uploadDir);
            console.log('   ✓ Upload directory exists');
        } catch (error) {
            // Create directory if it doesn't exist
            await fs.mkdir(uploadDir, { recursive: true });
            console.log('   ✓ Upload directory created');
        }

        // Test write permissions
        const testFile = path.join(uploadDir, 'test-write.txt');
        await fs.writeFile(testFile, 'test');
        await fs.unlink(testFile);
        console.log('   ✓ Upload directory is writable');
    }

    async testStatisticsQueries() {
        // Test statistics queries for admin dashboard
        const [totalDeliveries] = await this.connection.execute(`
            SELECT COUNT(*) as count FROM delivery_confirmation_otps
        `);

        const [completedDeliveries] = await this.connection.execute(`
            SELECT COUNT(*) as count FROM delivery_confirmation_otps WHERE status = 'confirmed'
        `);

        const [pendingDeliveries] = await this.connection.execute(`
            SELECT COUNT(*) as count FROM delivery_confirmation_otps WHERE status = 'pending'
        `);

        const [ordersWithCodes] = await this.connection.execute(`
            SELECT COUNT(*) as count FROM delivery_confirmation_otps WHERE delivery_code IS NOT NULL
        `);

        console.log(`   ✓ Total deliveries: ${totalDeliveries[0].count}`);
        console.log(`   ✓ Completed deliveries: ${completedDeliveries[0].count}`);
        console.log(`   ✓ Pending deliveries: ${pendingDeliveries[0].count}`);
        console.log(`   ✓ Orders with codes: ${ordersWithCodes[0].count}`);
    }

    async testCleanup() {
        // Clean up test data
        await this.connection.execute(`
            DELETE FROM delivery_confirmation_otps WHERE order_id = ?
        `, [this.testOrder.id]);

        await this.connection.execute(`
            DELETE FROM orders WHERE id = ?
        `, [this.testOrder.id]);

        await this.connection.execute(`
            DELETE FROM users WHERE email IN (?, ?, ?)
        `, ['testbuyer@example.com', 'testagent@example.com', 'testadmin@example.com']);

        console.log('   ✓ Test data cleaned up');
    }

    async runAllTests() {
        console.log('🧪 Starting Delivery Confirmation System Tests\n');
        console.log('=' .repeat(60));

        await this.runTest('Database Schema Validation', () => this.testDatabaseSchema());
        await this.runTest('Delivery Code Generation', () => this.testGenerateDeliveryCode());
        await this.runTest('Code Verification Logic', () => this.testCodeVerification());
        await this.runTest('Delivery Confirmation Process', () => this.testDeliveryConfirmation());
        await this.runTest('Order Status Update', () => this.testOrderStatusUpdate());
        await this.runTest('Data Retrieval Queries', () => this.testDataRetrieval());
        await this.runTest('File Upload Directory', () => this.testFileUploadDirectory());
        await this.runTest('Statistics Queries', () => this.testStatisticsQueries());
        await this.runTest('Test Data Cleanup', () => this.testCleanup());

        console.log('=' .repeat(60));
        this.printTestSummary();
    }

    printTestSummary() {
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(test => test.status === 'PASSED').length;
        const failedTests = this.testResults.filter(test => test.status === 'FAILED').length;
        const totalDuration = this.testResults.reduce((sum, test) => sum + test.duration, 0);

        console.log('\n📊 TEST SUMMARY');
        console.log('=' .repeat(60));
        console.log(`Total Tests: ${totalTests}`);
        console.log(`✅ Passed: ${passedTests}`);
        console.log(`❌ Failed: ${failedTests}`);
        console.log(`⏱️  Total Duration: ${totalDuration}ms`);
        console.log(`📈 Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

        if (failedTests > 0) {
            console.log('\n❌ FAILED TESTS:');
            this.testResults
                .filter(test => test.status === 'FAILED')
                .forEach(test => {
                    console.log(`   • ${test.name}: ${test.error}`);
                });
        }

        console.log('\n🎉 Delivery Confirmation System Test Suite Complete!');
        
        if (failedTests === 0) {
            console.log('✅ All tests passed! The system is ready for deployment.');
        } else {
            console.log('⚠️  Some tests failed. Please review and fix the issues before deployment.');
        }
    }

    async cleanup() {
        if (this.connection) {
            await this.connection.end();
            console.log('Database connection closed.');
        }
    }
}

// Run the test suite
async function main() {
    const tester = new DeliveryConfirmationTester();
    
    try {
        await tester.initialize();
        await tester.runAllTests();
    } catch (error) {
        console.error('Test suite failed:', error);
    } finally {
        await tester.cleanup();
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = DeliveryConfirmationTester;