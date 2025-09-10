const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'add_physical_product',
    port: process.env.DB_PORT || 3306
};

async function resetTestPasswords() {
    let connection;
    
    try {
        connection = await mysql.createConnection(dbConfig);
        
        console.log('🔧 Resetting test user passwords...');
        
        const newPassword = 'testpass123';
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Update PDA password
        const [pdaResult] = await connection.query(
            'UPDATE users SET password = ? WHERE email = ?',
            [hashedPassword, 'pda.test@example.com']
        );
        console.log('✅ Updated PDA password:', pdaResult.affectedRows, 'rows affected');
        
        // Update PSM password
        const [psmResult] = await connection.query(
            'UPDATE users SET password = ? WHERE email = ?',
            [hashedPassword, 'psm.test@example.com']
        );
        console.log('✅ Updated PSM password:', psmResult.affectedRows, 'rows affected');
        
        // Verify the users exist and have correct roles
        const [users] = await connection.query(`
            SELECT id, name, email, role, phone 
            FROM users 
            WHERE email IN ('pda.test@example.com', 'psm.test@example.com')
        `);
        
        console.log('\n📋 Test users after password reset:');
        for (const user of users) {
            console.log(`   ${user.email}: ID=${user.id}, Role=${user.role}, Name=${user.name}`);
        }
        
        console.log('\n🎉 Password reset completed! New password: testpass123');
        
    } catch (error) {
        console.error('❌ Error resetting passwords:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

resetTestPasswords();