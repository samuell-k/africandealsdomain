const pool = require('./db');

async function checkAdminNotificationsTable() {
    try {
        console.log('Checking admin_notifications table...');
        
        // Check if table exists
        const [tables] = await pool.execute("SHOW TABLES LIKE 'admin_notifications'");
        
        if (tables.length === 0) {
            console.log('admin_notifications table does not exist. Creating it...');
            
            await pool.execute(`
                CREATE TABLE admin_notifications (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    type VARCHAR(50) NOT NULL,
                    title VARCHAR(255) NOT NULL,
                    message TEXT NOT NULL,
                    data JSON,
                    is_read BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    read_at TIMESTAMP NULL,
                    INDEX idx_type (type),
                    INDEX idx_is_read (is_read),
                    INDEX idx_created (created_at)
                )
            `);
            
            console.log('✅ admin_notifications table created');
        } else {
            console.log('✅ admin_notifications table exists');
            
            // Show table structure
            const [structure] = await pool.execute('DESCRIBE admin_notifications');
            console.log('\nTable structure:');
            structure.forEach(row => {
                console.log(`${row.Field}: ${row.Type} ${row.Null} ${row.Key} ${row.Default || ''}`);
            });
        }

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        process.exit(0);
    }
}

checkAdminNotificationsTable();