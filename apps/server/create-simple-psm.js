const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'add_physical_product',
    port: process.env.DB_PORT || 3306
};

async function createSimplePSM() {
    let connection;
    
    try {
        connection = await mysql.createConnection(dbConfig);
        
        console.log('🔧 Creating simple PSM record...');
        
        // Get PSM user ID
        const [psmUser] = await connection.query(
            'SELECT id FROM users WHERE email = ?',
            ['psm.test@example.com']
        );
        
        if (psmUser.length === 0) {
            console.log('❌ PSM user not found');
            return;
        }
        
        const userId = psmUser[0].id;
        console.log('📋 PSM User ID:', userId);
        
        // Check table structure first
        const [columns] = await connection.query('DESCRIBE pickup_site_managers');
        console.log('📋 Table columns:', columns.map(col => col.Field).join(', '));
        
        // Create minimal PSM record
        try {
            await connection.query(`
                INSERT INTO pickup_site_managers (
                    user_id, site_name, site_address, is_active, status, created_at
                ) VALUES (?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                    site_name = VALUES(site_name),
                    is_active = VALUES(is_active),
                    status = VALUES(status),
                    updated_at = NOW()
            `, [
                userId,
                'Test Pickup Site',
                'KG 123 St, Kigali, Rwanda',
                1,
                'active'
            ]);
            console.log('✅ Created minimal PSM record');
        } catch (insertError) {
            console.log('❌ Insert failed:', insertError.message);
            
            // Try even simpler
            try {
                await connection.query(`
                    INSERT INTO pickup_site_managers (user_id, status, created_at) 
                    VALUES (?, ?, NOW())
                    ON DUPLICATE KEY UPDATE status = VALUES(status)
                `, [userId, 'active']);
                console.log('✅ Created basic PSM record');
            } catch (basicError) {
                console.log('❌ Basic insert failed:', basicError.message);
            }
        }
        
    } catch (error) {
        console.error('❌ Error creating PSM record:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

createSimplePSM();