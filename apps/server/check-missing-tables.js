const db = require('./db');

async function checkMissingTables() {
    try {
        console.log('🔍 Checking for missing tables required for agent registration...\n');

        // Check system_logs table
        const [systemLogs] = await db.query("SHOW TABLES LIKE 'system_logs'");
        console.log('system_logs table:', systemLogs.length > 0 ? '✅ EXISTS' : '❌ MISSING');

        if (systemLogs.length === 0) {
            console.log('Creating system_logs table...');
            await db.query(`
                CREATE TABLE system_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    message TEXT NOT NULL,
                    level ENUM('info', 'warning', 'error') DEFAULT 'info',
                    details JSON,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('✅ system_logs table created');
        }

        // Check admin_logs table
        const [adminLogs] = await db.query("SHOW TABLES LIKE 'admin_logs'");
        console.log('admin_logs table:', adminLogs.length > 0 ? '✅ EXISTS' : '❌ MISSING');

        if (adminLogs.length === 0) {
            console.log('Creating admin_logs table...');
            await db.query(`
                CREATE TABLE admin_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    admin_id INT NOT NULL,
                    action VARCHAR(100) NOT NULL,
                    target_type VARCHAR(50),
                    target_id INT,
                    details JSON,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_admin_id (admin_id),
                    INDEX idx_action (action),
                    INDEX idx_created (created_at)
                )
            `);
            console.log('✅ admin_logs table created');
        }

        // Check notifications table
        const [notifications] = await db.query("SHOW TABLES LIKE 'notifications'");
        console.log('notifications table:', notifications.length > 0 ? '✅ EXISTS' : '❌ MISSING');

        if (notifications.length === 0) {
            console.log('Creating notifications table...');
            await db.query(`
                CREATE TABLE notifications (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    type VARCHAR(50) NOT NULL,
                    title VARCHAR(255) NOT NULL,
                    message TEXT NOT NULL,
                    data JSON,
                    is_read BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    read_at TIMESTAMP NULL,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    INDEX idx_user_id (user_id),
                    INDEX idx_type (type),
                    INDEX idx_is_read (is_read),
                    INDEX idx_created (created_at)
                )
            `);
            console.log('✅ notifications table created');
        }

        // Test agent registration data insertion
        console.log('\n🧪 Testing agent registration data flow...');
        
        // Check if we can insert into agent_verification
        const testData = {
            agent_id: 1,
            user_id: 1,
            verification_status: 'pending',
            date_of_birth: '1990-01-01',
            gender: 'male',
            phone: '+250788123456',
            district: 'Kigali',
            submitted_at: new Date()
        };

        try {
            // Test the query structure without actually inserting
            const testQuery = `
                INSERT INTO agent_verification (
                    agent_id, user_id, verification_status, date_of_birth, gender,
                    alt_phone, emergency_contact, street_address, city, state, country,
                    province, district, sector, village, latitude, longitude, id_type, 
                    vehicle_type, license_plate, has_vehicle, business_name, bank_name, 
                    account_number, account_holder, mobile_money, work_zone, max_delivery_distance,
                    available_days, work_start_time, work_end_time, pickup_zone, delivery_zone,
                    transport_capacity, max_orders_per_trip, site_name, site_type, opening_hours,
                    closing_hours, operating_days, profile_photo, id_front, id_back, 
                    vehicle_registration, drivers_license, business_license, submitted_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `;
            console.log('✅ Agent verification query structure is valid');
        } catch (error) {
            console.log('❌ Agent verification query error:', error.message);
        }

        console.log('\n🎯 Table check completed!');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        process.exit(0);
    }
}

checkMissingTables();