const db = require('./db');

async function fixUserToAgent() {
    console.log('🔧 Fixing user role to agent...\n');

    try {
        const email = 'nyiranzabonimpajosiane@gmail.com';
        
        // Check current user status
        console.log('1. Checking current user status...');
        const [users] = await db.query('SELECT id, name, email, role FROM users WHERE email = ?', [email]);
        
        if (users.length === 0) {
            console.log('❌ User not found');
            return;
        }
        
        const user = users[0];
        console.log('   - Current user:', user);
        
        // Update role to agent
        console.log('\n2. Updating role to agent...');
        await db.query(
            'UPDATE users SET role = ? WHERE email = ?',
            ['agent', email]
        );
        
        console.log('✅ Role updated to agent');
        
        // Verify the change
        console.log('\n3. Verifying the change...');
        const [updatedUsers] = await db.query('SELECT id, name, email, role FROM users WHERE email = ?', [email]);
        const updatedUser = updatedUsers[0];
        console.log('   - Updated user:', updatedUser);
        
        console.log('\n🎯 User role successfully changed to agent!');
        console.log(`   - Email: ${updatedUser.email}`);
        console.log(`   - Role: ${updatedUser.role}`);
        console.log(`   - Name: ${updatedUser.name}`);
        
    } catch (error) {
        console.error('❌ Error fixing user role:', error.message);
    } finally {
        process.exit(0);
    }
}

fixUserToAgent();