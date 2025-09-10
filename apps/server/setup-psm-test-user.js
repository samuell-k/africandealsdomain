const mysql = require('mysql2/promise');
require('dotenv').config();

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'add_physical_product',
    port: process.env.DB_PORT || 3306
};

async function setupPSMTestUser() {
    let connection;
    
    try {
        console.log('🔧 Setting up PSM test user...');
        
        connection = await mysql.createConnection(dbConfig);
        
        // Test user details
        const testEmail = 'psm.test@example.com';
        
        // Find the test user
        const [users] = await connection.query(
            'SELECT id FROM users WHERE email = ?',
            [testEmail]
        );
        
        if (users.length === 0) {
            console.log('❌ Test user not found. Please run the test first to create the user.');
            return false;
        }
        
        const userId = users[0].id;
        console.log('📋 Found test user with ID:', userId);
        
        // Check if agent record already exists
        const [existingAgents] = await connection.query(
            'SELECT id FROM agents WHERE user_id = ? AND agent_type = ?',
            [userId, 'pickup_site_manager']
        );
        
        if (existingAgents.length > 0) {
            console.log('✅ PSM agent record already exists');
            return true;
        }
        
        // Create pickup site first (if not exists)
        let existingSites = [];
        try {
            [existingSites] = await connection.query(
                'SELECT id FROM pickup_sites WHERE name = ?',
                ['Test Pickup Site']
            );
        } catch (siteError) {
            console.log('📋 pickup_sites table may not exist, will create it');
            existingSites = [];
        }
        
        let pickupSiteId;
        if (existingSites.length === 0) {
            const [siteResult] = await connection.query(`
                INSERT INTO pickup_sites (
                    site_code, name, description, address_line1, city, country,
                    latitude, longitude, capacity, is_active, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                'TEST_PSM_001',
                'Test Pickup Site',
                'Test pickup site for PSM testing',
                'KG 123 St, Kigali',
                'Kigali',
                'Rwanda',
                -1.9441,
                30.0619,
                100,
                1,
                'active'
            ]);
            pickupSiteId = siteResult.insertId;
            console.log('✅ Created test pickup site with ID:', pickupSiteId);
        } else {
            pickupSiteId = existingSites[0].id;
            console.log('📋 Using existing pickup site with ID:', pickupSiteId);
        }
        
        // Create or update agent record
        try {
            const [agentResult] = await connection.query(`
                INSERT INTO agents (
                    user_id, agent_type, status, commission_settings, 
                    pickup_site_id, created_at
                ) VALUES (?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                    agent_type = VALUES(agent_type),
                    status = VALUES(status),
                    commission_settings = VALUES(commission_settings),
                    pickup_site_id = VALUES(pickup_site_id),
                    updated_at = NOW()
            `, [
                userId,
                'pickup_site_manager',
                'active',
                JSON.stringify({
                    pickup_site_id: pickupSiteId,
                    commission_rate: 5.0
                }),
                pickupSiteId
            ]);
            
            console.log('✅ Created/Updated PSM agent record');
        } catch (agentError) {
            console.log('⚠️ Agent record may already exist, continuing...');
        }
        
        // Create or update pickup site manager record
        try {
            const [psmResult] = await connection.query(`
                INSERT INTO pickup_site_managers (
                    user_id, site_name, site_address, site_coordinates, 
                    site_capacity, operating_hours, contact_phone, 
                    manager_level, is_active, status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                    site_name = VALUES(site_name),
                    site_address = VALUES(site_address),
                    site_coordinates = VALUES(site_coordinates),
                    site_capacity = VALUES(site_capacity),
                    operating_hours = VALUES(operating_hours),
                    contact_phone = VALUES(contact_phone),
                    manager_level = VALUES(manager_level),
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
            console.log('⚠️ PSM record may already exist, continuing...');
        }
        
        console.log('🎉 PSM test user setup completed successfully!');
        return true;
        
    } catch (error) {
        console.error('❌ Error setting up PSM test user:', error.message);
        
        // Try to create tables if they don't exist
        if (error.message.includes('Table') && error.message.includes("doesn't exist")) {
            console.log('🔧 Creating missing tables...');
            
            try {
                // Create agents table
                await connection.query(`
                    CREATE TABLE IF NOT EXISTS agents (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        user_id INT NOT NULL,
                        agent_type ENUM('fast_delivery', 'pickup_delivery', 'pickup_site_manager') NOT NULL,
                        status ENUM('pending', 'active', 'suspended', 'rejected') DEFAULT 'pending',
                        commission_settings JSON,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                        UNIQUE KEY unique_user_agent_type (user_id, agent_type)
                    )
                `);
                
                // Create pickup_sites table
                await connection.query(`
                    CREATE TABLE IF NOT EXISTS pickup_sites (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        site_name VARCHAR(255) NOT NULL,
                        site_type ENUM('store', 'office', 'warehouse', 'kiosk', 'home', 'other') DEFAULT 'store',
                        address_line1 VARCHAR(255) NOT NULL,
                        address_line2 VARCHAR(255),
                        district VARCHAR(100),
                        sector VARCHAR(100),
                        cell VARCHAR(100),
                        village VARCHAR(100),
                        province VARCHAR(100),
                        latitude DECIMAL(10, 8),
                        longitude DECIMAL(11, 8),
                        location_description TEXT,
                        capacity INT DEFAULT 50,
                        business_hours VARCHAR(255),
                        languages VARCHAR(255),
                        status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                    )
                `);
                
                // Create pickup_site_managers table
                await connection.query(`
                    CREATE TABLE IF NOT EXISTS pickup_site_managers (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        user_id INT NOT NULL,
                        pickup_site_id INT NOT NULL,
                        commission_rate DECIMAL(5,2) DEFAULT 5.00,
                        status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                        FOREIGN KEY (pickup_site_id) REFERENCES pickup_sites(id) ON DELETE CASCADE,
                        UNIQUE KEY unique_user_site (user_id, pickup_site_id)
                    )
                `);
                
                console.log('✅ Tables created successfully');
                
                // Retry the setup
                return await setupPSMTestUser();
                
            } catch (tableError) {
                console.error('❌ Error creating tables:', tableError.message);
                return false;
            }
        }
        
        return false;
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Run setup if called directly
if (require.main === module) {
    setupPSMTestUser().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { setupPSMTestUser };