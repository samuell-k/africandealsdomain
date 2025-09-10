const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'add_physical_product',
    port: process.env.DB_PORT || 3306
};

async function fixTestUsers() {
    let connection;
    
    try {
        connection = await mysql.createConnection(dbConfig);
        
        console.log('🔧 Fixing test users...');
        
        // Fix PDA user role
        const [pdaResult] = await connection.query(
            'UPDATE users SET role = ? WHERE email = ?',
            ['agent', 'pda.test@example.com']
        );
        console.log('✅ Updated PDA user role to agent');
        
        // Fix agent statuses
        await connection.query(
            'UPDATE agents SET status = ? WHERE user_id IN (SELECT id FROM users WHERE email IN (?, ?))',
            ['active', 'pda.test@example.com', 'psm.test@example.com']
        );
        console.log('✅ Updated agent statuses to active');
        
        // Create PSM record for PSM test user
        const [psmUser] = await connection.query(
            'SELECT id FROM users WHERE email = ?',
            ['psm.test@example.com']
        );
        
        if (psmUser.length > 0) {
            const userId = psmUser[0].id;
            
            try {
                await connection.query(`
                    INSERT INTO pickup_site_managers (
                        user_id, site_name, site_address, site_coordinates, 
                        site_capacity, operating_hours, contact_phone, 
                        manager_level, is_active, status, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                    ON DUPLICATE KEY UPDATE
                        site_name = VALUES(site_name),
                        site_address = VALUES(site_address),
                        is_active = VALUES(is_active),
                        status = VALUES(status),
                        updated_at = NOW()
                `, [
                    userId,
                    'Test Pickup Site',
                    'KG 123 St, Kigali, Rwanda',
                    JSON.stringify({ lat: -1.9441, lng: 30.0619 }),
                    100,
                    'Mon-Fri 8AM-6PM',
                    '+250788123456',
                    'senior',
                    1,
                    'active'
                ]);
                console.log('✅ Created/Updated PSM record');
            } catch (psmError) {
                console.log('⚠️ PSM record creation failed:', psmError.message);
            }
        }
        
        console.log('🎉 Test users fixed successfully!');
        
    } catch (error) {
        console.error('❌ Error fixing test users:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

fixTestUsers();