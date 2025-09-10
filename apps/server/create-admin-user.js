const bcrypt = require('bcryptjs');
const db = require('./db.js');

async function createAdminUser() {
  try {
    console.log('🔧 Creating admin user...');
    
    // Check if admin user already exists
    const [existingUsers] = await db.execute(
      'SELECT * FROM users WHERE email = ? OR role = "admin"',
      ['africandealsdomain@gmail.com']
    );
    
    if (existingUsers.length > 0) {
      console.log('⚠️ Admin user already exists:');
      existingUsers.forEach(user => {
        console.log(`- ID: ${user.id}, Name: ${user.name}, Email: ${user.email}, Role: ${user.role}`);
      });
      
      // Update the password to use bcryptjs
      console.log('🔄 Updating admin password to use bcryptjs...');
      const hashedPassword = await bcrypt.hash('SuperAdd@02', 10);
      await db.execute(
        'UPDATE users SET password = ? WHERE email = ?',
        [hashedPassword, 'africandealsdomain@gmail.com']
      );
      console.log('✅ Admin password updated successfully!');
      return;
    }
    
    // Hash the password with bcryptjs
    const hashedPassword = await bcrypt.hash('SuperAdd@02', 10);
    
    // Create admin user
    const [result] = await db.execute(
      `INSERT INTO users (name, email, password, role, created_at) 
       VALUES (?, ?, ?, 'admin', NOW())`,
      ['African Deals Domain', 'africandealsdomain@gmail.com', hashedPassword]
    );
    
    console.log('✅ Admin user created successfully!');
    console.log('📋 Login Details:');
    console.log('- Name: African Deals Domain');
    console.log('- Email: africandealsdomain@gmail.com');
    console.log('- Password: SuperAdd@02');
    console.log('- Role: admin');
    console.log('- User ID:', result.insertId);
    
    // Verify the user was created
    const [newUser] = await db.execute(
      'SELECT id, name, email, role FROM users WHERE id = ?',
      [result.insertId]
    );
    
    if (newUser.length > 0) {
      console.log('\n🔍 Verification - Admin user details:');
      console.log(newUser[0]);
    }
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  } finally {
    process.exit();
  }
}

createAdminUser(); 