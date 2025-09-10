const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'add_physical_product',
    port: process.env.DB_PORT || 3306
};

async function checkPDATable() {
    let connection;
    
    try {
        connection = await mysql.createConnection(dbConfig);
        
        console.log('🔍 Checking pickup_delivery_agents table...');
        
        // Check if table exists
        const [tables] = await connection.query("SHOW TABLES LIKE 'pickup_delivery_agents'");
        
        if (tables.length === 0) {
            console.log('❌ pickup_delivery_agents table does not exist');
            
            // Create the table with correct structure
            await connection.query(`
                CREATE TABLE pickup_delivery_agents (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    rating DECIMAL(3,2) DEFAULT 5.00,
                    total_deliveries INT DEFAULT 0,
                    successful_deliveries INT DEFAULT 0,
                    current_location JSON,
                    status ENUM('online', 'offline', 'busy') DEFAULT 'offline',
                    trust_level ENUM('new', 'bronze', 'silver', 'gold', 'platinum') DEFAULT 'new',
                    vehicle_type VARCHAR(50),
                    license_number VARCHAR(50),
                    emergency_contact VARCHAR(255),
                    emergency_phone VARCHAR(20),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    UNIQUE KEY unique_user (user_id)
                )
            `);
            console.log('✅ Created pickup_delivery_agents table');
        } else {
            console.log('✅ pickup_delivery_agents table exists');
            
            // Show table structure
            const [columns] = await connection.query("DESCRIBE pickup_delivery_agents");
            console.log('📋 Table structure:');
            columns.forEach(col => {
                console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `(${col.Key})` : ''}`);
            });
        }
        
        // Get PDA user ID
        const [pdaUser] = await connection.query(
            'SELECT id, name, email, role, agent_type FROM users WHERE email = ?',
            ['pda.test@example.com']
        );
        
        if (pdaUser.length === 0) {
            console.log('❌ PDA user not found');
            return;
        }
        
        const userId = pdaUser[0].id;
        console.log('📋 PDA User:', pdaUser[0]);
        
        // Check if PDA record exists
        const [pdaRecord] = await connection.query(
            'SELECT * FROM pickup_delivery_agents WHERE user_id = ?',
            [userId]
        );
        
        if (pdaRecord.length === 0) {
            console.log('❌ No PDA record found, creating one...');
            
            // Create PDA record
            await connection.query(`
                INSERT INTO pickup_delivery_agents (
                    user_id, rating, total_deliveries, successful_deliveries,
                    status, trust_level, vehicle_type, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
            `, [
                userId,
                4.8,
                25,
                23,
                'offline',
                'silver',
                'motorcycle'
            ]);
            console.log('✅ Created PDA record');
        } else {
            console.log('✅ PDA record exists:', pdaRecord[0]);
        }
        
        // Also check agents table
        const [agentRecord] = await connection.query(
            'SELECT * FROM agents WHERE user_id = ?',
            [userId]
        );
        
        if (agentRecord.length > 0) {
            console.log('📋 Agent record:', agentRecord[0]);
            
            // Update agent type if needed
            if (agentRecord[0].agent_type !== 'pickup_delivery') {
                await connection.query(
                    'UPDATE agents SET agent_type = ? WHERE user_id = ?',
                    ['pickup_delivery', userId]
                );
                console.log('✅ Updated agent type to pickup_delivery');
            }
        } else {
            console.log('❌ No agent record found');
        }
        
        console.log('🎉 PDA setup check completed!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

checkPDATable();