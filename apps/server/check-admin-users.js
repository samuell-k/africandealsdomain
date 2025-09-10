/**
 * Check Admin Users in Database
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkAdminUsers() {
  try {
    console.log('🔍 Connecting to database...');
    
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'add_physical_product',
      port: process.env.DB_PORT || 3333
    });
    
    console.log('✅ Connected to database');
    
    // Check for admin users
    const [adminUsers] = await connection.execute(`
      SELECT id, username, email, role, first_name, last_name, created_at
      FROM users 
      WHERE role = 'admin' OR role = 'super_admin'
      ORDER BY created_at DESC
    `);
    
    console.log('\n👥 Admin Users Found:');
    if (adminUsers.length === 0) {
      console.log('❌ No admin users found in database');
      
      // Create a test admin user
      console.log('\n🔧 Creating test admin user...');
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      await connection.execute(`
        INSERT INTO users (username, email, password, role, first_name, last_name, created_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
      `, ['admin', 'admin@example.com', hashedPassword, 'admin', 'Test', 'Admin']);
      
      console.log('✅ Test admin user created:');
      console.log('   Email: admin@example.com');
      console.log('   Password: admin123');
      
    } else {
      adminUsers.forEach((user, index) => {
        console.log(`${index + 1}. ID: ${user.id}`);
        console.log(`   Username: ${user.username}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Name: ${user.first_name} ${user.last_name}`);
        console.log(`   Created: ${user.created_at}`);
        console.log('');
      });
    }
    
    await connection.end();
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
  }
}

checkAdminUsers();