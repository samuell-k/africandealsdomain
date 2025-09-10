const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkMessagesTable() {
    console.log('🔍 Checking messages table structure...');
    
    try {
        const pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'add_physical_product',
            port: process.env.DB_PORT || 3333,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        // Check if messages table exists
        console.log('\n📋 Checking if messages table exists...');
        const [tables] = await pool.query(`
            SELECT TABLE_NAME 
            FROM information_schema.TABLES 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'messages'
        `, [process.env.DB_NAME || 'african_deals_physical_products']);
        
        if (tables.length === 0) {
            console.log('❌ Messages table does not exist');
            
            // Check for similar table names
            console.log('\n🔍 Looking for similar table names...');
            const [similarTables] = await pool.query(`
                SELECT TABLE_NAME 
                FROM information_schema.TABLES 
                WHERE TABLE_SCHEMA = ? AND TABLE_NAME LIKE '%message%'
            `, [process.env.DB_NAME || 'add_physical_product']);
            
            if (similarTables.length > 0) {
                console.log('📋 Found similar tables:');
                similarTables.forEach(table => {
                    console.log(`   - ${table.TABLE_NAME}`);
                });
            } else {
                console.log('❌ No similar tables found');
            }
            
            // Create messages table
            console.log('\n🔨 Creating messages table...');
            await pool.query(`
                CREATE TABLE messages (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    sender_id INT NOT NULL,
                    receiver_id INT NOT NULL,
                    message TEXT NOT NULL,
                    message_type ENUM('text', 'image', 'location', 'system') DEFAULT 'text',
                    order_id INT NULL,
                    is_read BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_sender (sender_id),
                    INDEX idx_receiver (receiver_id),
                    INDEX idx_order (order_id),
                    INDEX idx_created (created_at)
                )
            `);
            console.log('✅ Messages table created successfully');
            
        } else {
            console.log('✅ Messages table exists');
            
            // Get table structure
            console.log('\n📋 Messages table structure:');
            const [columns] = await pool.query(`
                SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
                FROM information_schema.COLUMNS 
                WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'messages'
                ORDER BY ORDINAL_POSITION
            `, [process.env.DB_NAME || 'add_physical_product']);
            
            columns.forEach(col => {
                console.log(`   ${col.COLUMN_NAME}: ${col.DATA_TYPE} ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'} ${col.COLUMN_DEFAULT ? `DEFAULT ${col.COLUMN_DEFAULT}` : ''}`);
            });
        }
        
        // Test a simple insert
        console.log('\n🧪 Testing message insert...');
        try {
            await pool.query(`
                INSERT INTO messages (sender_id, receiver_id, message, message_type, order_id, created_at)
                VALUES (1, 2, 'Test message', 'text', 1, NOW())
            `);
            console.log('✅ Test message insert successful');
            
            // Clean up test message
            await pool.query(`DELETE FROM messages WHERE message = 'Test message' AND sender_id = 1 AND receiver_id = 2`);
            console.log('✅ Test message cleaned up');
            
        } catch (insertError) {
            console.log('❌ Test message insert failed:', insertError.message);
        }
        
        await pool.end();
        
    } catch (error) {
        console.error('❌ Database check failed:', error.message);
    }
}

checkMessagesTable();