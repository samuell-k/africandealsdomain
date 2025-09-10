const bcrypt = require('bcryptjs');
const db = require('./db.js');

async function testAdminLogin() {
  try {
    console.log('🔍 Testing admin login...');
    
    // 1. Check if admin user exists
    const [adminUsers] = await db.execute(
      'SELECT * FROM users WHERE email = ? AND role = "admin"',
      ['africandealsdomain@gmail.com']
    );
    
    if (adminUsers.length === 0) {
      console.log('❌ Admin user not found!');
      return;
    }
    
    const adminUser = adminUsers[0];
    console.log('✅ Admin user found:', {
      id: adminUser.id,
      name: adminUser.name,
      email: adminUser.email,
      role: adminUser.role,
      password_length: adminUser.password ? adminUser.password.length : 0
    });
    
    // 2. Test password verification
    const testPassword = 'SuperAdd@02';
    console.log('\n🔐 Testing password verification...');
    
    const isPasswordValid = await bcrypt.compare(testPassword, adminUser.password);
    console.log('Password verification result:', isPasswordValid);
    
    if (!isPasswordValid) {
      console.log('❌ Password verification failed!');
      console.log('Current password hash:', adminUser.password);
      
      // Try to create a new hash and compare
      const newHash = await bcrypt.hash(testPassword, 10);
      console.log('New password hash:', newHash);
      
      const newHashValid = await bcrypt.compare(testPassword, newHash);
      console.log('New hash verification:', newHashValid);
      
      // Update the password
      console.log('\n🔄 Updating admin password...');
      await db.execute(
        'UPDATE users SET password = ? WHERE id = ?',
        [newHash, adminUser.id]
      );
      console.log('✅ Admin password updated!');
      
      // Verify the update
      const [updatedUser] = await db.execute(
        'SELECT password FROM users WHERE id = ?',
        [adminUser.id]
      );
      
      const finalVerification = await bcrypt.compare(testPassword, updatedUser[0].password);
      console.log('Final password verification:', finalVerification);
    } else {
      console.log('✅ Password verification successful!');
    }
    
    // 3. Test the actual login process
    console.log('\n🚀 Testing login process...');
    
    // Simulate the login route logic
    const email = 'africandealsdomain@gmail.com';
    const password = 'SuperAdd@02';
    
    const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
    
    if (users.length === 0) {
      console.log('❌ User not found during login test');
      return;
    }
    
    const user = users[0];
    console.log('Found user:', {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    });
    
    const passwordMatch = await bcrypt.compare(password, user.password);
    console.log('Login password verification:', passwordMatch);
    
    if (passwordMatch) {
      console.log('✅ Login would be successful!');
      console.log('User data for token:', {
        id: user.id,
        role: user.role,
        name: user.name,
        email: user.email
      });
    } else {
      console.log('❌ Login would fail - password mismatch');
    }
    
  } catch (error) {
    console.error('❌ Error testing admin login:', error);
  } finally {
    process.exit();
  }
}

testAdminLogin(); 