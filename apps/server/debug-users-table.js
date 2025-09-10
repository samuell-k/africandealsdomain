/**
 * Debug Users Table Structure
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

async function debugUsersTable() {
    let connection;
    
    try {
        console.log('🔧 Connecting to database...');
        connection = await mysql.createConnection(dbConfig);
        
        console.log('📋 Checking users table structure...');
        
        // Get table structure
        const [columns] = await connection.execute('DESCRIBE users');
        
        console.log('\n📊 Users table columns:');
        columns.forEach(col => {
            console.log(`   ${col.Field} - ${col.Type} - ${col.Null} - ${col.Key} - ${col.Default}`);
        });
        
        // Check if there are any test users
        const [users] = await connection.execute(
            "SELECT id, name, email, role, agent_type, status FROM users WHERE email LIKE '%testagent%' OR email LIKE '%test.admin%' LIMIT 5"
        );
        
        console.log('\n👥 Recent test users:');
        users.forEach(user => {
            console.log(`   ID: ${user.id}, Name: ${user.name}, Email: ${user.email}, Role: ${user.role}, Agent Type: ${user.agent_type}, Status: ${user.status}`);
        });
        
        return true;
        
    } catch (error) {
        console.error('❌ Error:', error);
        return false;
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Run if this file is executed directly
if (require.main === module) {
    debugUsersTable()
        .then((success) => {
            process.exit(success ? 0 : 1);
        })
        .catch((error) => {
            console.error('❌ Script failed:', error);
            process.exit(1);
        });
}

module.exports = debugUsersTable;