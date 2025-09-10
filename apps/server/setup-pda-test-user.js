const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'add_physical_product',
    port: process.env.DB_PORT || 3306
};

async function setupPDATestUser() {
    let connection;
    
    try {
        connection = await mysql.createConnection(dbConfig);
        
        console.log('🔧 Setting up PDA test user...');
        
        // Get PDA user ID
        const [pdaUser] = await connection.query(
            'SELECT id FROM users WHERE email = ?',
            ['pda.test@example.com']
        );
        
        if (pdaUser.length === 0) {
            console.log('❌ PDA user not found');
            return;
        }
        
        const userId = pdaUser[0].id;
        console.log('📋 PDA User ID:', userId);
        
        // Update agent type in agents table
        await connection.query(`
            UPDATE agents 
            SET agent_type = 'pickup_delivery' 
            WHERE user_id = ? AND agent_type = 'pickup_delivery_agent'
        `, [userId]);
        console.log('✅ Updated agent type to pickup_delivery');
        
        // Check if pickup_delivery_agents table exists
        try {
            const [tables] = await connection.query("SHOW TABLES LIKE 'pickup_delivery_agents'");
            
            if (tables.length === 0) {
                // Create pickup_delivery_agents table
                await connection.query(`
                    CREATE TABLE pickup_delivery_agents (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        user_id INT NOT NULL,
                        name VARCHAR(255),
                        phone VARCHAR(20),
                        address VARCHAR(500),
                        city VARCHAR(100),
                        country VARCHAR(100),
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
            }
            
            // Create or update PDA record
            await connection.query(`
                INSERT INTO pickup_delivery_agents (
                    user_id, name, phone, address, city, country,
                    rating, total_deliveries, successful_deliveries,
                    status, trust_level, vehicle_type, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                    name = VALUES(name),
                    phone = VALUES(phone),
                    address = VALUES(address),
                    city = VALUES(city),
                    country = VALUES(country),
                    status = VALUES(status),
                    updated_at = NOW()
            `, [
                userId,
                'Test PDA Agent',
                '+250788123456',
                'KG 456 St, Kigali, Rwanda',
                'Kigali',
                'Rwanda',
                4.8,
                25,
                23,
                'offline',
                'silver',
                'motorcycle'
            ]);
            console.log('✅ Created/Updated PDA record');
            
        } catch (tableError) {
            console.log('⚠️ PDA table setup failed:', tableError.message);
        }
        
        console.log('🎉 PDA test user setup completed successfully!');
        
    } catch (error) {
        console.error('❌ Error setting up PDA test user:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

setupPDATestUser();