const db = require('./db.js');
require('dotenv').config();

console.log('🔧 [PAYMENT-CREDENTIALS-SETUP] Starting payment credentials table setup...');

async function setupPaymentCredentialsTable() {
    try {
        console.log('✅ [PAYMENT-CREDENTIALS-SETUP] Using existing database connection');
        
        // Create payment_credentials table
        console.log('🔧 [PAYMENT-CREDENTIALS-SETUP] Creating payment_credentials table...');
        
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
        
        console.log('✅ [PAYMENT-CREDENTIALS-SETUP] Payment credentials table created successfully');
        
        // Check if table has data
        const [existingCredentials] = await db.execute('SELECT COUNT(*) as count FROM payment_credentials');
        
        if (existingCredentials[0].count === 0) {
            console.log('🔧 [PAYMENT-CREDENTIALS-SETUP] Inserting default payment credentials...');
            
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
                
                console.log(`✅ [PAYMENT-CREDENTIALS-SETUP] Inserted ${credential.type}/${credential.provider} credentials`);
            }
            
            console.log('✅ [PAYMENT-CREDENTIALS-SETUP] Default payment credentials inserted successfully');
        } else {
            console.log('ℹ️ [PAYMENT-CREDENTIALS-SETUP] Payment credentials already exist, skipping default insertion');
        }
        
        // Verify the setup
        const [allCredentials] = await db.execute(`
            SELECT credential_type, provider, is_enabled, created_at
            FROM payment_credentials
            ORDER BY credential_type, provider
        `);
        
        console.log('📊 [PAYMENT-CREDENTIALS-SETUP] Current payment credentials:');
        allCredentials.forEach(credential => {
            console.log(`   - ${credential.credential_type}/${credential.provider}: ${credential.is_enabled ? 'Enabled' : 'Disabled'}`);
        });
        
        console.log('✅ [PAYMENT-CREDENTIALS-SETUP] Payment credentials table setup completed successfully!');
        
    } catch (error) {
        console.error('❌ [PAYMENT-CREDENTIALS-SETUP] Error setting up payment credentials table:', error);
        throw error;
    }
}

// Run the setup
if (require.main === module) {
    setupPaymentCredentialsTable()
        .then(() => {
            console.log('🎉 [PAYMENT-CREDENTIALS-SETUP] Setup completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 [PAYMENT-CREDENTIALS-SETUP] Setup failed:', error);
            process.exit(1);
        });
}

module.exports = { setupPaymentCredentialsTable };