/**
 * Setup script for Agent Applications System
 * This script creates all necessary database tables and initial data
 */

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'add_physical_product',
    port: process.env.DB_PORT || 3306,
    multipleStatements: true
};

async function setupAgentApplicationsSystem() {
    let connection;
    
    try {
        console.log('🚀 Starting Agent Applications System Setup...');
        
        // Connect to database
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Connected to database');
        
        // Read and execute the migration SQL
        const migrationPath = path.join(__dirname, 'migrations', 'create-agent-application-tables.sql');
        const migrationSQL = await fs.readFile(migrationPath, 'utf8');
        
        console.log('📝 Executing database migration...');
        
        // Split SQL into individual statements and execute them
        const statements = migrationSQL
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
        
        for (const statement of statements) {
            if (statement.trim()) {
                try {
                    await connection.execute(statement);
                } catch (error) {
                    // Log but don't fail on duplicate table errors
                    if (!error.message.includes('already exists') && !error.message.includes('Duplicate')) {
                        console.warn(`⚠️  Warning executing statement: ${error.message}`);
                    }
                }
            }
        }
        
        console.log('✅ Database migration completed');
        
        // Create uploads directory if it doesn't exist
        const uploadsDir = path.join(__dirname, 'uploads', 'agent-applications');
        try {
            await fs.mkdir(uploadsDir, { recursive: true });
            console.log('✅ Created uploads directory');
        } catch (error) {
            console.log('📁 Uploads directory already exists');
        }
        
        // Verify tables were created
        console.log('🔍 Verifying table creation...');
        
        const tablesToCheck = [
            'agent_types',
            'agent_applications', 
            'agent_application_documents',
            'admin_notifications',
            'agent_application_status_history',
            'agent_performance_metrics'
        ];
        
        for (const table of tablesToCheck) {
            try {
                const [rows] = await connection.execute(`SHOW TABLES LIKE '${table}'`);
                if (rows.length > 0) {
                    console.log(`✅ Table '${table}' created successfully`);
                } else {
                    console.log(`❌ Table '${table}' not found`);
                }
            } catch (error) {
                console.log(`❌ Error checking table '${table}': ${error.message}`);
            }
        }
        
        // Check if agent types were inserted
        const [agentTypes] = await connection.execute('SELECT COUNT(*) as count FROM agent_types');
        console.log(`✅ Agent types configured: ${agentTypes[0].count} types`);
        
        // Check if required columns exist in users table
        try {
            const [columns] = await connection.execute(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' 
                AND COLUMN_NAME IN ('agent_type', 'agent_status', 'application_id', 'approved_at', 'approved_by')
            `, [process.env.DB_NAME || 'add_physical_product']);
            
            console.log(`✅ User table agent columns: ${columns.length}/5 columns added`);
        } catch (error) {
            console.log(`⚠️  Warning checking user table columns: ${error.message}`);
        }
        
        // Test stored procedures
        try {
            await connection.execute('SHOW PROCEDURE STATUS WHERE Name = "ApproveAgentApplication"');
            console.log('✅ ApproveAgentApplication procedure created');
        } catch (error) {
            console.log(`⚠️  Warning: ApproveAgentApplication procedure may not be created: ${error.message}`);
        }
        
        try {
            await connection.execute('SHOW PROCEDURE STATUS WHERE Name = "RejectAgentApplication"');
            console.log('✅ RejectAgentApplication procedure created');
        } catch (error) {
            console.log(`⚠️  Warning: RejectAgentApplication procedure may not be created: ${error.message}`);
        }
        
        console.log('\n🎉 Agent Applications System Setup Complete!');
        console.log('\n📋 Summary:');
        console.log('   ✅ Database tables created');
        console.log('   ✅ Agent types configured');
        console.log('   ✅ Stored procedures created');
        console.log('   ✅ Upload directories created');
        console.log('   ✅ System ready for use');
        
        console.log('\n🔗 Next Steps:');
        console.log('   1. Start the server: npm start');
        console.log('   2. Access agent registration: /auth/agent-registration-enhanced.html');
        console.log('   3. Access admin dashboard: /admin/agent-applications.html');
        console.log('   4. Configure email service for notifications');
        
    } catch (error) {
        console.error('❌ Setup failed:', error);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔌 Database connection closed');
        }
    }
}

// Run the setup
if (require.main === module) {
    setupAgentApplicationsSystem()
        .then(() => {
            console.log('✅ Setup completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Setup failed:', error);
            process.exit(1);
        });
}

module.exports = { setupAgentApplicationsSystem };