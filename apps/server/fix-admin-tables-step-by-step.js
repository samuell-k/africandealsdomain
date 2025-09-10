#!/usr/bin/env node

/**
 * STEP-BY-STEP ADMIN TABLE FIXER
 * Fixes each table creation issue individually
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

class StepByStepAdminFixer {
    constructor() {
        this.dbConnection = null;
        this.fixes = [];
    }

    async log(message, type = 'info') {
        console.log(`${type === 'error' ? '❌' : type === 'success' ? '✅' : '🔧'} ${message}`);
    }

    async connectToDatabase() {
        try {
            this.dbConnection = await mysql.createConnection({
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME || 'add_physical_product',
                port: parseInt(process.env.DB_PORT) || 3306
            });
            
            await this.log('Database connection established', 'success');
            return true;
        } catch (error) {
            await this.log(`Database connection failed: ${error.message}`, 'error');
            return false;
        }
    }

    async checkTableExists(tableName) {
        try {
            const [rows] = await this.dbConnection.execute(
                `SELECT COUNT(*) as count FROM information_schema.TABLES 
                 WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
                [process.env.DB_NAME || 'add_physical_product', tableName]
            );
            return rows[0].count > 0;
        } catch (error) {
            return false;
        }
    }

    async checkColumnExists(tableName, columnName) {
        try {
            const [rows] = await this.dbConnection.execute(
                `SELECT COUNT(*) as count FROM information_schema.COLUMNS 
                 WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
                [process.env.DB_NAME || 'add_physical_product', tableName, columnName]
            );
            return rows[0].count > 0;
        } catch (error) {
            return false;
        }
    }

    async createAdminApprovalsTable() {
        await this.log('Creating admin_approvals table...');
        
        try {
            const exists = await this.checkTableExists('admin_approvals');
            if (exists) {
                await this.log('admin_approvals table already exists', 'success');
                return true;
            }

            await this.dbConnection.execute(`
                CREATE TABLE admin_approvals (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    order_id INT NOT NULL,
                    approval_type ENUM('MANUAL_PAYMENT', 'SELLER_PAYOUT', 'ORDER_CANCELLATION', 'REFUND_REQUEST') NOT NULL,
                    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
                    requested_by INT NOT NULL,
                    reviewed_by INT NULL,
                    request_reason TEXT,
                    review_notes TEXT,
                    approved_at DATETIME NULL,
                    rejected_at DATETIME NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_order_id (order_id),
                    INDEX idx_status (status),
                    INDEX idx_approval_type (approval_type)
                )
            `);

            await this.log('✅ admin_approvals table created successfully', 'success');
            this.fixes.push('admin_approvals table created');
            return true;
        } catch (error) {
            await this.log(`❌ Error creating admin_approvals table: ${error.message}`, 'error');
            return false;
        }
    }

    async createOrderStatusHistoryTable() {
        await this.log('Creating order_status_history table...');
        
        try {
            const exists = await this.checkTableExists('order_status_history');
            if (exists) {
                await this.log('order_status_history table already exists', 'success');
                return true;
            }

            await this.dbConnection.execute(`
                CREATE TABLE order_status_history (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    order_id INT NOT NULL,
                    old_status VARCHAR(50),
                    new_status VARCHAR(50),
                    changed_by INT NOT NULL,
                    change_reason TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_order_id (order_id)
                )
            `);

            await this.log('✅ order_status_history table created successfully', 'success');
            this.fixes.push('order_status_history table created');
            return true;
        } catch (error) {
            await this.log(`❌ Error creating order_status_history table: ${error.message}`, 'error');
            return false;
        }
    }

    async createAdminSessionsTable() {
        await this.log('Creating admin_sessions table...');
        
        try {
            const exists = await this.checkTableExists('admin_sessions');
            if (exists) {
                await this.log('admin_sessions table already exists', 'success');
                return true;
            }

            await this.dbConnection.execute(`
                CREATE TABLE admin_sessions (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    user_id INT NOT NULL,
                    token_hash VARCHAR(255) NOT NULL,
                    expires_at DATETIME NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    ip_address VARCHAR(45),
                    user_agent TEXT,
                    is_active BOOLEAN DEFAULT TRUE,
                    INDEX idx_token_hash (token_hash),
                    INDEX idx_user_id (user_id),
                    INDEX idx_expires_at (expires_at)
                )
            `);

            await this.log('✅ admin_sessions table created successfully', 'success');
            this.fixes.push('admin_sessions table created');
            return true;
        } catch (error) {
            await this.log(`❌ Error creating admin_sessions table: ${error.message}`, 'error');
            return false;
        }
    }

    async enhancePaymentTransactionsTable() {
        await this.log('Enhancing payment_transactions table...');
        
        try {
            // Check what columns already exist
            const [columns] = await this.dbConnection.execute(`
                SELECT COLUMN_NAME FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'payment_transactions'
            `, [process.env.DB_NAME || 'add_physical_product']);

            const existingColumns = columns.map(c => c.COLUMN_NAME);
            await this.log(`Existing payment_transactions columns: ${existingColumns.join(', ')}`);

            // Add missing columns one by one
            const columnsToAdd = [
                { name: 'payment_method', type: 'VARCHAR(50) DEFAULT "mobile_money"' },
                { name: 'screenshot_url', type: 'VARCHAR(500)' },
                { name: 'admin_notes', type: 'TEXT' },
                { name: 'processed_at', type: 'DATETIME NULL' },
                { name: 'processed_by', type: 'INT NULL' }
            ];

            for (const column of columnsToAdd) {
                if (!existingColumns.includes(column.name)) {
                    try {
                        await this.dbConnection.execute(`
                            ALTER TABLE payment_transactions 
                            ADD COLUMN ${column.name} ${column.type}
                        `);
                        await this.log(`✅ Added column ${column.name} to payment_transactions`);
                        this.fixes.push(`Added ${column.name} column to payment_transactions`);
                    } catch (error) {
                        await this.log(`⚠️ Could not add column ${column.name}: ${error.message}`, 'warn');
                    }
                } else {
                    await this.log(`Column ${column.name} already exists`);
                }
            }

            return true;
        } catch (error) {
            await this.log(`❌ Error enhancing payment_transactions table: ${error.message}`, 'error');
            return false;
        }
    }

    async enhanceOrdersTable() {
        await this.log('Enhancing orders table...');
        
        try {
            // Check what columns already exist
            const [columns] = await this.dbConnection.execute(`
                SELECT COLUMN_NAME FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'orders'
            `, [process.env.DB_NAME || 'add_physical_product']);

            const existingColumns = columns.map(c => c.COLUMN_NAME);

            // Add missing columns one by one
            const columnsToAdd = [
                { name: 'manual_payment_approved', type: 'BOOLEAN DEFAULT FALSE' },
                { name: 'manual_payment_approved_by', type: 'INT NULL' },
                { name: 'manual_payment_approved_at', type: 'DATETIME NULL' },
                { name: 'payment_proof', type: 'TEXT' },
                { name: 'agent_id', type: 'INT NULL' }
            ];

            for (const column of columnsToAdd) {
                if (!existingColumns.includes(column.name)) {
                    try {
                        await this.dbConnection.execute(`
                            ALTER TABLE orders 
                            ADD COLUMN ${column.name} ${column.type}
                        `);
                        await this.log(`✅ Added column ${column.name} to orders`);
                        this.fixes.push(`Added ${column.name} column to orders`);
                    } catch (error) {
                        await this.log(`⚠️ Could not add column ${column.name}: ${error.message}`, 'warn');
                    }
                } else {
                    await this.log(`Column ${column.name} already exists`);
                }
            }

            return true;
        } catch (error) {
            await this.log(`❌ Error enhancing orders table: ${error.message}`, 'error');
            return false;
        }
    }

    async createTestAdminUser() {
        await this.log('Creating test admin user...');

        try {
            // Create or update admin user
            const hashedPassword = await bcrypt.hash('admin123', 10);
            
            // Check if admin user exists
            const [existingAdmin] = await this.dbConnection.execute(
                'SELECT id FROM users WHERE email = "admin@test.com" OR username = "admin"'
            );

            if (existingAdmin.length > 0) {
                await this.log('Admin user already exists, updating...', 'success');
                await this.dbConnection.execute(`
                    UPDATE users SET 
                    password = ?, role = 'admin', is_active = 1, is_verified = 1
                    WHERE id = ?
                `, [hashedPassword, existingAdmin[0].id]);
            } else {
                await this.dbConnection.execute(`
                    INSERT INTO users (username, email, password, role, is_active, is_verified, created_at)
                    VALUES ('admin', 'admin@test.com', ?, 'admin', 1, 1, NOW())
                `, [hashedPassword]);
                await this.log('✅ New admin user created');
            }

            // Get admin user ID
            const [adminUsers] = await this.dbConnection.execute(
                'SELECT id FROM users WHERE role = "admin" LIMIT 1'
            );

            if (adminUsers.length > 0) {
                const adminId = adminUsers[0].id;
                
                // Create admin authentication token
                const token = jwt.sign(
                    { 
                        userId: adminId, 
                        role: 'admin',
                        email: 'admin@test.com',
                        username: 'admin'
                    },
                    process.env.JWT_SECRET || 'your-secret-key',
                    { expiresIn: '24h' }
                );

                // Save token for testing (check if admin_sessions table exists)
                const sessionTableExists = await this.checkTableExists('admin_sessions');
                if (sessionTableExists) {
                    const tokenHash = require('crypto').createHash('sha256').update(token).digest('hex');
                    await this.dbConnection.execute(`
                        INSERT INTO admin_sessions (user_id, token_hash, expires_at, ip_address)
                        VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR), '127.0.0.1')
                    `, [adminId, tokenHash]);
                }

                await require('fs').promises.writeFile('../../test-admin-token.txt', token);
                
                await this.log(`✅ Admin user ready with ID: ${adminId}`, 'success');
                await this.log(`✅ Admin token saved to test-admin-token.txt`, 'success');
                
                this.fixes.push('Admin user created with authentication token');
                return token;
            }
        } catch (error) {
            await this.log(`❌ Error creating admin user: ${error.message}`, 'error');
        }
        
        return null;
    }

    async createTestData() {
        await this.log('Creating test approval data...');

        try {
            // Check if admin_approvals table exists
            const approvalTableExists = await this.checkTableExists('admin_approvals');
            if (!approvalTableExists) {
                await this.log('admin_approvals table not ready yet, skipping test data');
                return;
            }

            // Get some existing data
            const [orders] = await this.dbConnection.execute('SELECT id, total_amount FROM orders LIMIT 5');
            const [adminUsers] = await this.dbConnection.execute('SELECT id FROM users WHERE role = "admin" LIMIT 1');

            if (orders.length > 0 && adminUsers.length > 0) {
                const adminId = adminUsers[0].id;

                // Create some test approval requests
                for (let i = 0; i < Math.min(3, orders.length); i++) {
                    const order = orders[i];
                    
                    try {
                        await this.dbConnection.execute(`
                            INSERT IGNORE INTO admin_approvals (
                                order_id, approval_type, status, requested_by, 
                                request_reason, created_at
                            ) VALUES (?, ?, 'pending', ?, ?, NOW())
                        `, [
                            order.id,
                            i % 2 === 0 ? 'MANUAL_PAYMENT' : 'SELLER_PAYOUT',
                            adminId,
                            `Test approval request for order ${order.id} - Amount: $${order.total_amount}`
                        ]);
                        
                        await this.log(`✅ Created test approval for order ${order.id}`);
                    } catch (error) {
                        await this.log(`⚠️ Could not create approval for order ${order.id}: ${error.message}`, 'warn');
                    }
                }

                this.fixes.push('Test approval data created');
            }

            // Enhance existing payment transactions
            const paymentMethodExists = await this.checkColumnExists('payment_transactions', 'payment_method');
            if (paymentMethodExists) {
                await this.dbConnection.execute(`
                    UPDATE payment_transactions 
                    SET payment_method = 'mobile_money' 
                    WHERE payment_method IS NULL OR payment_method = ''
                `);
                await this.log('✅ Updated existing payment transactions');
            }

        } catch (error) {
            await this.log(`❌ Error creating test data: ${error.message}`, 'error');
        }
    }

    async verifyFixes() {
        await this.log('Verifying all fixes...');

        try {
            // Check table existence
            const tables = ['admin_approvals', 'order_status_history', 'admin_sessions'];
            for (const table of tables) {
                const exists = await this.checkTableExists(table);
                await this.log(`Table ${table}: ${exists ? '✅ EXISTS' : '❌ MISSING'}`);
            }

            // Check data counts
            const [users] = await this.dbConnection.execute('SELECT COUNT(*) as count FROM users');
            await this.log(`👥 Users: ${users[0].count} total`);

            const [payments] = await this.dbConnection.execute('SELECT COUNT(*) as count FROM payment_transactions');
            await this.log(`💳 Payment Transactions: ${payments[0].count} total`);

            const approvalTableExists = await this.checkTableExists('admin_approvals');
            if (approvalTableExists) {
                const [approvals] = await this.dbConnection.execute('SELECT COUNT(*) as count FROM admin_approvals');
                await this.log(`📋 Admin Approvals: ${approvals[0].count} total`);
            }

            // Test admin token
            try {
                const fs = require('fs').promises;
                const token = await fs.readFile('../../test-admin-token.txt', 'utf8');
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
                await this.log(`🔐 Admin token valid for: ${decoded.email}`, 'success');
            } catch (error) {
                await this.log(`⚠️ Admin token issue: ${error.message}`, 'warn');
            }

        } catch (error) {
            await this.log(`❌ Error during verification: ${error.message}`, 'error');
        }
    }

    async run() {
        console.log('🚀 STEP-BY-STEP ADMIN TABLE FIXES');
        console.log('='.repeat(50));

        const connected = await this.connectToDatabase();
        if (!connected) return;

        // Execute fixes step by step
        await this.createAdminApprovalsTable();
        await this.createOrderStatusHistoryTable();
        await this.createAdminSessionsTable();
        await this.enhancePaymentTransactionsTable();
        await this.enhanceOrdersTable();
        await this.createTestAdminUser();
        await this.createTestData();
        await this.verifyFixes();

        console.log('\n🎯 FIXES COMPLETED');
        console.log('='.repeat(30));
        console.log(`📊 Total Fixes Applied: ${this.fixes.length}`);
        this.fixes.forEach((fix, index) => {
            console.log(`  ${index + 1}. ${fix}`);
        });

        console.log('\n💡 NEXT STEPS:');
        console.log('  1. Start the server: cd apps/server && npm start');
        console.log('  2. Test admin APIs: node test-admin-apis.js');
        console.log('  3. Open admin pages in browser');
        console.log('  4. Login with admin@test.com / admin123');

        if (this.dbConnection) {
            await this.dbConnection.end();
        }
    }
}

// Main execution
async function main() {
    const fixer = new StepByStepAdminFixer();
    await fixer.run();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = StepByStepAdminFixer;