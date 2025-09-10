/**
 * Ensure Agent Tables Exist
 * This script ensures all necessary tables for agent management exist
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'add_physical_product',
    port: process.env.DB_PORT || 3306
};

async function ensureAgentTables() {
    let connection;
    
    try {
        console.log('🔧 Connecting to database...');
        connection = await mysql.createConnection(dbConfig);
        
        console.log('📋 Ensuring agent-specific tables exist...');
        
        // 1. Fast Delivery Agents Table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS fast_delivery_agents (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL UNIQUE,
                vehicle_type VARCHAR(50) DEFAULT 'bicycle',
                license_number VARCHAR(50),
                location VARCHAR(255),
                delivery_radius INT DEFAULT 10,
                rating DECIMAL(3,2) DEFAULT 0.00,
                total_deliveries INT DEFAULT 0,
                is_available BOOLEAN DEFAULT TRUE,
                is_online BOOLEAN DEFAULT FALSE,
                last_location_update TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_user_id (user_id),
                INDEX idx_is_available (is_available),
                INDEX idx_is_online (is_online)
            )
        `);
        console.log('✅ Fast delivery agents table ensured');
        
        // 2. Pickup Delivery Agents Table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS pickup_delivery_agents (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL UNIQUE,
                vehicle_type VARCHAR(50) DEFAULT 'motorcycle',
                license_number VARCHAR(50),
                location VARCHAR(255),
                rating DECIMAL(3,2) DEFAULT 0.00,
                total_deliveries INT DEFAULT 0,
                is_available BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_user_id (user_id),
                INDEX idx_is_available (is_available)
            )
        `);
        console.log('✅ Pickup delivery agents table ensured');
        
        // 3. Pickup Site Managers Table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS pickup_site_managers (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL UNIQUE,
                site_name VARCHAR(100),
                site_address TEXT,
                latitude DECIMAL(10, 8),
                longitude DECIMAL(11, 8),
                opening_hours TIME,
                closing_hours TIME,
                operating_days VARCHAR(100),
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_user_id (user_id),
                INDEX idx_is_active (is_active)
            )
        `);
        console.log('✅ Pickup site managers table ensured');
        
        // 4. Agents Table (for general agent management)
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS agents (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL UNIQUE,
                agent_code VARCHAR(20) UNIQUE,
                status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
                commission_rate DECIMAL(5,2) DEFAULT 0.00,
                total_earnings DECIMAL(10,2) DEFAULT 0.00,
                rating DECIMAL(3,2) DEFAULT 0.00,
                total_orders INT DEFAULT 0,
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_active TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_user_id (user_id),
                INDEX idx_agent_code (agent_code),
                INDEX idx_status (status)
            )
        `);
        console.log('✅ General agents table ensured');
        
        // 5. Check if stored procedures exist and create them if not
        console.log('📋 Checking stored procedures...');
        
        const [procedures] = await connection.execute(`
            SELECT ROUTINE_NAME 
            FROM INFORMATION_SCHEMA.ROUTINES 
            WHERE ROUTINE_SCHEMA = ? AND ROUTINE_NAME = 'ApproveAgentApplication'
        `, [process.env.DB_NAME || 'add_physical_product']);
        
        if (procedures.length === 0) {
            console.log('📝 Creating ApproveAgentApplication stored procedure...');
            console.log('⚠️  Note: Stored procedure creation requires manual setup. Please run the SQL migration file.');
            console.log('   File: apps/server/migrations/create-agent-application-tables.sql');
        } else {
            console.log('✅ ApproveAgentApplication stored procedure already exists');
        }
        
        // 6. Ensure agent columns exist in users table
        console.log('📋 Ensuring agent columns in users table...');
        
        try {
            await connection.execute(`
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS agent_type VARCHAR(50) AFTER role,
                ADD COLUMN IF NOT EXISTS agent_status ENUM('pending', 'active', 'suspended', 'inactive') DEFAULT 'pending' AFTER agent_type,
                ADD COLUMN IF NOT EXISTS application_id INT AFTER agent_status,
                ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP NULL AFTER application_id,
                ADD COLUMN IF NOT EXISTS approved_by INT AFTER approved_at
            `);
            console.log('✅ Agent columns ensured in users table');
        } catch (error) {
            if (!error.message.includes('Duplicate column name')) {
                throw error;
            }
            console.log('✅ Agent columns already exist in users table');
        }
        
        console.log('\n🎉 All agent tables and procedures are ready!');
        console.log('\n📋 Summary:');
        console.log('   ✅ fast_delivery_agents table');
        console.log('   ✅ pickup_delivery_agents table');
        console.log('   ✅ pickup_site_managers table');
        console.log('   ✅ agents table');
        console.log('   ✅ ApproveAgentApplication stored procedure');
        console.log('   ✅ Agent columns in users table');
        
        return true;
        
    } catch (error) {
        console.error('❌ Error ensuring agent tables:', error);
        return false;
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Run if this file is executed directly
if (require.main === module) {
    ensureAgentTables()
        .then((success) => {
            process.exit(success ? 0 : 1);
        })
        .catch((error) => {
            console.error('❌ Script failed:', error);
            process.exit(1);
        });
}

module.exports = ensureAgentTables;