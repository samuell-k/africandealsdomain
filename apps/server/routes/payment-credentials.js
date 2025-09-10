const express = require('express');
const router = express.Router();
const db = require('../db.js');
const { requireAuth, requireRole } = require('../middleware/auth.js');

console.log('🔧 [PAYMENT CREDENTIALS] Loading payment credentials routes...');

// Enhanced error handling middleware
const enhancedErrorHandler = (routeHandler) => {
    return async (req, res, next) => {
        const startTime = Date.now();
        
        try {
            console.log(`📡 [PAYMENT-CREDENTIALS] ${req.method} ${req.originalUrl}`);
            console.log(`👤 [PAYMENT-CREDENTIALS] User: ${req.user?.email || 'unknown'} (Role: ${req.user?.role || 'unknown'})`);
            
            await routeHandler(req, res, next);
            
            const duration = Date.now() - startTime;
            console.log(`⚡ [PAYMENT-CREDENTIALS] Request completed in ${duration}ms`);
            
        } catch (error) {
            const duration = Date.now() - startTime;
            
            console.error(`❌ [PAYMENT-CREDENTIALS] ERROR in ${req.method} ${req.originalUrl}`);
            console.error(`⏱️ [PAYMENT-CREDENTIALS] Failed after ${duration}ms`);
            console.error(`💥 [PAYMENT-CREDENTIALS] Error details:`, {
                message: error.message,
                stack: error.stack,
                sql: error.sql || 'N/A',
                sqlMessage: error.sqlMessage || 'N/A'
            });
            
            // Save error to database for tracking
            try {
                await db.execute(`
                    INSERT INTO system_logs (level, message, details, created_at)
                    VALUES (?, ?, ?, NOW())
                `, [
                    'error',
                    `Payment Credentials API Error: ${req.method} ${req.originalUrl}`,
                    JSON.stringify({
                        error: error.message,
                        stack: error.stack,
                        user: req.user?.email || 'unknown',
                        userAgent: req.headers['user-agent'],
                        ip: req.ip
                    })
                ]);
            } catch (logError) {
                console.error('Failed to log error to database:', logError);
            }
            
            res.status(error.status || 500).json({
                success: false,
                message: error.message || 'Internal server error',
                error: process.env.NODE_ENV === 'development' ? error : 'An unexpected error occurred'
            });
        }
    };
};

// Create payment credentials table if it doesn't exist
const initializePaymentCredentialsTable = async () => {
    try {
        console.log('🔧 [PAYMENT-CREDENTIALS] Initializing payment credentials table...');
        
        await db.execute(`
            CREATE TABLE IF NOT EXISTS payment_credentials (
                id INT PRIMARY KEY AUTO_INCREMENT,
                credential_type ENUM('mobile_money', 'bank_transfer') NOT NULL,
                provider VARCHAR(50) NOT NULL,
                credential_data JSON NOT NULL,
                is_enabled BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                created_by INT,
                updated_by INT,
                UNIQUE KEY unique_provider (credential_type, provider),
                FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
                FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
            )
        `);
        
        console.log('✅ [PAYMENT-CREDENTIALS] Payment credentials table initialized');
        
        // Insert default credentials if table is empty
        const [existingCredentials] = await db.execute('SELECT COUNT(*) as count FROM payment_credentials');
        
        if (existingCredentials[0].count === 0) {
            console.log('🔧 [PAYMENT-CREDENTIALS] Inserting default payment credentials...');
            
            const defaultCredentials = [
                // Mobile Money Credentials
                {
                    type: 'mobile_money',
                    provider: 'mtn',
                    data: {
                        phone: '+250 788 123 456',
                        account_name: 'African Deals Domain',
                        ussd_code: '*182*8*1#'
                    }
                },
                {
                    type: 'mobile_money',
                    provider: 'airtel',
                    data: {
                        phone: '+250 733 456 789',
                        account_name: 'African Deals Domain',
                        ussd_code: '*500*2*1#'
                    }
                },
                {
                    type: 'mobile_money',
                    provider: 'tigo',
                    data: {
                        phone: '+250 722 789 012',
                        account_name: 'African Deals Domain',
                        ussd_code: '*505#'
                    }
                },
                // Bank Transfer Credentials
                {
                    type: 'bank_transfer',
                    provider: 'primary',
                    data: {
                        bank_name: 'Bank of Kigali',
                        account_name: 'African Deals Domain Ltd',
                        account_number: '00123456789',
                        swift_code: 'BKGLRWRW',
                        branch: 'Kigali Main Branch'
                    }
                },
                {
                    type: 'bank_transfer',
                    provider: 'secondary',
                    data: {
                        bank_name: 'Equity Bank Rwanda',
                        account_name: 'African Deals Domain Ltd',
                        account_number: '40012345678',
                        swift_code: 'EQBLRWRW',
                        branch: 'Kigali City Branch'
                    }
                }
            ];
            
            for (const credential of defaultCredentials) {
                await db.execute(`
                    INSERT INTO payment_credentials (credential_type, provider, credential_data, is_enabled)
                    VALUES (?, ?, ?, ?)
                `, [credential.type, credential.provider, JSON.stringify(credential.data), true]);
            }
            
            console.log('✅ [PAYMENT-CREDENTIALS] Default payment credentials inserted');
        }
        
    } catch (error) {
        console.error('❌ [PAYMENT-CREDENTIALS] Error initializing payment credentials table:', error);
        throw error;
    }
};

// Initialize table on module load
initializePaymentCredentialsTable().catch(console.error);

// GET /api/admin/payment-credentials/public - Get public payment credentials (No auth required)
router.get('/payment-credentials/public', enhancedErrorHandler(async (req, res) => {
    console.log('📋 [PAYMENT-CREDENTIALS] Fetching public payment credentials...');
    
    try {
        const [credentials] = await db.execute(`
            SELECT credential_type, provider, credential_data, is_enabled, updated_at
            FROM payment_credentials
            WHERE is_enabled = true
            ORDER BY credential_type, provider
        `);
        
        // Structure the credentials for frontend consumption
        const structuredCredentials = {
            mobile_money: {},
            bank_transfer: {}
        };
        
        credentials.forEach(credential => {
            const data = JSON.parse(credential.credential_data);
            structuredCredentials[credential.credential_type][credential.provider] = {
                ...data,
                enabled: credential.is_enabled
            };
        });
        
        // Get the latest update timestamp
        const [latestUpdate] = await db.execute(`
            SELECT MAX(updated_at) as last_updated
            FROM payment_credentials
        `);
        
        console.log('✅ [PAYMENT-CREDENTIALS] Public payment credentials fetched successfully');
        
        res.json({
            success: true,
            message: 'Payment credentials retrieved successfully',
            credentials: structuredCredentials,
            last_updated: latestUpdate[0].last_updated
        });
        
    } catch (error) {
        console.error('❌ [PAYMENT-CREDENTIALS] Error fetching public payment credentials:', error);
        throw error;
    }
}));

// GET /api/admin/payment-credentials - Get all payment credentials (Authenticated endpoint)
router.get('/payment-credentials', requireAuth, enhancedErrorHandler(async (req, res) => {
    console.log('📋 [PAYMENT-CREDENTIALS] Fetching payment credentials...');
    
    try {
        const [credentials] = await db.execute(`
            SELECT credential_type, provider, credential_data, is_enabled, updated_at
            FROM payment_credentials
            WHERE is_enabled = true
            ORDER BY credential_type, provider
        `);
        
        // Structure the credentials for frontend consumption
        const structuredCredentials = {
            mobile_money: {},
            bank_transfer: {}
        };
        
        credentials.forEach(credential => {
            const data = JSON.parse(credential.credential_data);
            structuredCredentials[credential.credential_type][credential.provider] = {
                ...data,
                enabled: credential.is_enabled
            };
        });
        
        // Get the latest update timestamp
        const [latestUpdate] = await db.execute(`
            SELECT MAX(updated_at) as last_updated
            FROM payment_credentials
        `);
        
        console.log('✅ [PAYMENT-CREDENTIALS] Payment credentials fetched successfully');
        
        res.json({
            success: true,
            message: 'Payment credentials retrieved successfully',
            credentials: structuredCredentials,
            last_updated: latestUpdate[0].last_updated
        });
        
    } catch (error) {
        console.error('❌ [PAYMENT-CREDENTIALS] Error fetching payment credentials:', error);
        throw error;
    }
}));

// POST /api/admin/payment-credentials - Update payment credentials (Admin only)
router.post('/payment-credentials', requireAuth, requireRole('admin'), enhancedErrorHandler(async (req, res) => {
    console.log('💾 [PAYMENT-CREDENTIALS] Updating payment credentials...');
    
    try {
        const { credentials } = req.body;
        
        if (!credentials) {
            return res.status(400).json({
                success: false,
                message: 'Payment credentials data is required'
            });
        }
        
        console.log('📦 [PAYMENT-CREDENTIALS] Received credentials:', credentials);
        
        try {
            // Update mobile money credentials
            if (credentials.mobile_money) {
                for (const [provider, data] of Object.entries(credentials.mobile_money)) {
                    const { enabled, ...credentialData } = data;
                    
                    // First try to update existing record
                    const [updateResult] = await db.execute(`
                        UPDATE payment_credentials 
                        SET credential_data = ?, is_enabled = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE credential_type = ? AND provider = ?
                    `, [JSON.stringify(credentialData), enabled, req.user.id, 'mobile_money', provider]);
                    
                    // If no rows were affected, insert new record
                    if (updateResult.affectedRows === 0) {
                        await db.execute(`
                            INSERT INTO payment_credentials (credential_type, provider, credential_data, is_enabled, updated_by)
                            VALUES (?, ?, ?, ?, ?)
                        `, ['mobile_money', provider, JSON.stringify(credentialData), enabled, req.user.id]);
                    }
                }
            }
            
            // Update bank transfer credentials
            if (credentials.bank_transfer) {
                for (const [provider, data] of Object.entries(credentials.bank_transfer)) {
                    const { enabled, ...credentialData } = data;
                    
                    // First try to update existing record
                    const [updateResult] = await db.execute(`
                        UPDATE payment_credentials 
                        SET credential_data = ?, is_enabled = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE credential_type = ? AND provider = ?
                    `, [JSON.stringify(credentialData), enabled, req.user.id, 'bank_transfer', provider]);
                    
                    // If no rows were affected, insert new record
                    if (updateResult.affectedRows === 0) {
                        await db.execute(`
                            INSERT INTO payment_credentials (credential_type, provider, credential_data, is_enabled, updated_by)
                            VALUES (?, ?, ?, ?, ?)
                        `, ['bank_transfer', provider, JSON.stringify(credentialData), enabled, req.user.id]);
                    }
                }
            }
            
            // Log the update
            await db.execute(`
                INSERT INTO system_logs (level, message, details, created_at)
                VALUES (?, ?, ?, NOW())
            `, [
                'info',
                'Payment credentials updated',
                JSON.stringify({
                    user: req.user.email,
                    action: 'update_payment_credentials',
                    timestamp: new Date().toISOString()
                })
            ]);
            
            console.log('✅ [PAYMENT-CREDENTIALS] Payment credentials updated successfully');
            
            res.json({
                success: true,
                message: 'Payment credentials updated successfully'
            });
            
        } catch (error) {
            console.error('❌ [PAYMENT-CREDENTIALS] Error during credential update:', error);
            throw error;
        }
        
    } catch (error) {
        console.error('❌ [PAYMENT-CREDENTIALS] Error updating payment credentials:', error);
        throw error;
    }
}));

// POST /api/admin/payment-credentials/test - Test payment credentials (Admin only)
router.post('/payment-credentials/test', requireAuth, requireRole('admin'), enhancedErrorHandler(async (req, res) => {
    console.log('🧪 [PAYMENT-CREDENTIALS] Testing payment credentials...');
    
    try {
        // Get current credentials
        const [credentials] = await db.execute(`
            SELECT credential_type, provider, credential_data, is_enabled
            FROM payment_credentials
            WHERE is_enabled = true
            ORDER BY credential_type, provider
        `);
        
        const testResults = {
            mobile_money: {},
            bank_transfer: {},
            summary: {
                total: credentials.length,
                passed: 0,
                failed: 0
            }
        };
        
        // Test each credential
        for (const credential of credentials) {
            const data = JSON.parse(credential.credential_data);
            const testResult = {
                provider: credential.provider,
                status: 'passed',
                message: 'Credential format is valid',
                checks: []
            };
            
            // Perform basic validation tests
            if (credential.credential_type === 'mobile_money') {
                // Test mobile money credentials
                if (!data.phone || !data.phone.match(/^\+\d{10,15}$/)) {
                    testResult.status = 'failed';
                    testResult.checks.push('Invalid phone number format');
                }
                
                if (!data.account_name || data.account_name.length < 3) {
                    testResult.status = 'failed';
                    testResult.checks.push('Account name too short');
                }
                
                if (!data.ussd_code || !data.ussd_code.match(/^\*\d+.*#$/)) {
                    testResult.status = 'failed';
                    testResult.checks.push('Invalid USSD code format');
                }
                
                testResults.mobile_money[credential.provider] = testResult;
                
            } else if (credential.credential_type === 'bank_transfer') {
                // Test bank transfer credentials
                if (!data.bank_name || data.bank_name.length < 3) {
                    testResult.status = 'failed';
                    testResult.checks.push('Bank name too short');
                }
                
                if (!data.account_name || data.account_name.length < 3) {
                    testResult.status = 'failed';
                    testResult.checks.push('Account name too short');
                }
                
                if (!data.account_number || data.account_number.length < 5) {
                    testResult.status = 'failed';
                    testResult.checks.push('Account number too short');
                }
                
                if (!data.swift_code || !data.swift_code.match(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/)) {
                    testResult.status = 'failed';
                    testResult.checks.push('Invalid SWIFT code format');
                }
                
                testResults.bank_transfer[credential.provider] = testResult;
            }
            
            // Update summary
            if (testResult.status === 'passed') {
                testResults.summary.passed++;
            } else {
                testResults.summary.failed++;
            }
        }
        
        // Log the test
        await db.execute(`
            INSERT INTO system_logs (level, message, details, created_at)
            VALUES (?, ?, ?, NOW())
        `, [
            'info',
            'Payment credentials tested',
            JSON.stringify({
                user: req.user.email,
                action: 'test_payment_credentials',
                results: testResults.summary,
                timestamp: new Date().toISOString()
            })
        ]);
        
        console.log('✅ [PAYMENT-CREDENTIALS] Payment credentials test completed');
        console.log('📊 [PAYMENT-CREDENTIALS] Test results:', testResults.summary);
        
        res.json({
            success: true,
            message: 'Payment credentials test completed',
            results: testResults
        });
        
    } catch (error) {
        console.error('❌ [PAYMENT-CREDENTIALS] Error testing payment credentials:', error);
        throw error;
    }
}));

// GET /api/admin/payment-credentials/admin - Get all payment credentials for admin (Admin only)
router.get('/payment-credentials/admin', requireAuth, requireRole('admin'), enhancedErrorHandler(async (req, res) => {
    console.log('📋 [PAYMENT-CREDENTIALS] Fetching payment credentials for admin...');
    
    try {
        const [credentials] = await db.execute(`
            SELECT 
                pc.*,
                u1.username as created_by_name,
                u2.username as updated_by_name
            FROM payment_credentials pc
            LEFT JOIN users u1 ON pc.created_by = u1.id
            LEFT JOIN users u2 ON pc.updated_by = u2.id
            ORDER BY pc.credential_type, pc.provider
        `);
        
        // Structure the credentials for admin consumption
        const structuredCredentials = {
            mobile_money: {},
            bank_transfer: {}
        };
        
        credentials.forEach(credential => {
            const data = JSON.parse(credential.credential_data);
            structuredCredentials[credential.credential_type][credential.provider] = {
                ...data,
                enabled: credential.is_enabled,
                created_at: credential.created_at,
                updated_at: credential.updated_at,
                created_by: credential.created_by_name,
                updated_by: credential.updated_by_name
            };
        });
        
        // Get the latest update timestamp
        const [latestUpdate] = await db.execute(`
            SELECT MAX(updated_at) as last_updated
            FROM payment_credentials
        `);
        
        console.log('✅ [PAYMENT-CREDENTIALS] Admin payment credentials fetched successfully');
        
        res.json({
            success: true,
            message: 'Payment credentials retrieved successfully',
            credentials: structuredCredentials,
            last_updated: latestUpdate[0].last_updated,
            total_credentials: credentials.length
        });
        
    } catch (error) {
        console.error('❌ [PAYMENT-CREDENTIALS] Error fetching admin payment credentials:', error);
        throw error;
    }
}));

// DELETE /api/admin/payment-credentials/:type/:provider - Delete specific payment credential (Admin only)
router.delete('/payment-credentials/:type/:provider', requireAuth, requireRole('admin'), enhancedErrorHandler(async (req, res) => {
    const { type, provider } = req.params;
    
    console.log(`🗑️ [PAYMENT-CREDENTIALS] Deleting payment credential: ${type}/${provider}`);
    
    try {
        const [result] = await db.execute(`
            DELETE FROM payment_credentials
            WHERE credential_type = ? AND provider = ?
        `, [type, provider]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Payment credential not found'
            });
        }
        
        // Log the deletion
        await db.execute(`
            INSERT INTO system_logs (level, message, details, created_at)
            VALUES (?, ?, ?, NOW())
        `, [
            'info',
            'Payment credential deleted',
            JSON.stringify({
                user: req.user.email,
                action: 'delete_payment_credential',
                credential_type: type,
                provider: provider,
                timestamp: new Date().toISOString()
            })
        ]);
        
        console.log('✅ [PAYMENT-CREDENTIALS] Payment credential deleted successfully');
        
        res.json({
            success: true,
            message: 'Payment credential deleted successfully'
        });
        
    } catch (error) {
        console.error('❌ [PAYMENT-CREDENTIALS] Error deleting payment credential:', error);
        throw error;
    }
}));

console.log('✅ [PAYMENT CREDENTIALS] Payment credentials routes loaded successfully');

module.exports = router;