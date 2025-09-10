const mysql = require('mysql2/promise');
require('dotenv').config();

async function simpleSetup() {
    let connection;
    
    try {
        console.log('🚀 Starting simple setup...');
        
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'add_physical_product',
            port: process.env.DB_PORT || 3306
        });
        
        console.log('✅ Connected to database');
        
        // Create agent_types table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS agent_types (
                id INT PRIMARY KEY AUTO_INCREMENT,
                type_code VARCHAR(50) UNIQUE NOT NULL,
                type_name VARCHAR(100) NOT NULL,
                description TEXT,
                commission_rate DECIMAL(5,2) DEFAULT 0.00,
                requirements JSON,
                benefits JSON,
                is_active BOOLEAN DEFAULT TRUE,
                display_order INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ agent_types table created');
        
        // Insert agent types
        await connection.execute(`
            INSERT IGNORE INTO agent_types (type_code, type_name, description, commission_rate, requirements, benefits, display_order) VALUES
            ('fast_delivery', 'Fast Delivery Agent', 'Agents who handle quick delivery services within the city', 5.00, '["Valid ID", "Smartphone", "Transportation"]', '["Flexible hours", "Competitive rates", "Performance bonuses"]', 1),
            ('pickup_delivery', 'Pickup & Delivery Agent', 'Agents who handle pickup from sellers and delivery to pickup sites', 7.50, '["Valid ID", "Vehicle", "Smartphone", "GPS capability"]', '["Higher commission", "Route optimization", "Fuel allowance"]', 2),
            ('site_manager', 'Pickup Site Manager', 'Agents who manage pickup sites and handle customer collections', 10.00, '["Valid ID", "Management experience", "Customer service skills"]', '["Fixed location", "Management role", "Staff supervision"]', 3)
        `);
        console.log('✅ Agent types inserted');
        
        // Create agent_applications table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS agent_applications (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT,
                application_ref VARCHAR(50) UNIQUE NOT NULL,
                agent_type VARCHAR(50) NOT NULL,
                status ENUM('pending', 'under_review', 'approved', 'rejected', 'cancelled') DEFAULT 'pending',
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                email VARCHAR(255) NOT NULL,
                phone VARCHAR(20) NOT NULL,
                date_of_birth DATE,
                gender ENUM('male', 'female', 'other'),
                id_type VARCHAR(50),
                id_number VARCHAR(100),
                street_address TEXT,
                city VARCHAR(100),
                state VARCHAR(100),
                country VARCHAR(100),
                postal_code VARCHAR(20),
                latitude DECIMAL(10, 8),
                longitude DECIMAL(11, 8),
                bank_name VARCHAR(100),
                account_number VARCHAR(50),
                account_holder VARCHAR(100),
                routing_number VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                reviewed_at TIMESTAMP NULL,
                reviewed_by INT,
                review_notes TEXT,
                rejection_reason VARCHAR(255),
                INDEX idx_status (status),
                INDEX idx_agent_type (agent_type),
                INDEX idx_email (email),
                INDEX idx_created_at (created_at)
            )
        `);
        console.log('✅ agent_applications table created');
        
        // Create agent_application_documents table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS agent_application_documents (
                id INT PRIMARY KEY AUTO_INCREMENT,
                application_id INT NOT NULL,
                document_type VARCHAR(50) NOT NULL,
                filename VARCHAR(255) NOT NULL,
                original_name VARCHAR(255) NOT NULL,
                file_path VARCHAR(500) NOT NULL,
                file_size INT NOT NULL,
                mime_type VARCHAR(100) NOT NULL,
                is_verified BOOLEAN DEFAULT FALSE,
                verified_by INT,
                verified_at TIMESTAMP NULL,
                verification_notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (application_id) REFERENCES agent_applications(id) ON DELETE CASCADE,
                INDEX idx_application_id (application_id),
                INDEX idx_document_type (document_type),
                INDEX idx_is_verified (is_verified)
            )
        `);
        console.log('✅ agent_application_documents table created');
        
        console.log('🎉 Simple setup completed successfully!');
        
    } catch (error) {
        console.error('❌ Setup failed:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

simpleSetup();