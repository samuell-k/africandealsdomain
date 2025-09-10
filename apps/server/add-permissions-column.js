const mysql = require('mysql2/promise');

async function addPermissionsColumn() {
  let connection;
     
  try {
    // Database connection
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'african_deals_db'
    });
  
    console.log('✅ Database connected');

    // Add permissions column to users table
    await connection.execute(`
      ALTER TABLE users 
      ADD COLUMN permissions JSON NULL 
      AFTER role
    `);

    console.log('✅ Permissions column added to users table');

    // Add some default permissions for existing users
    await connection.execute(`
      UPDATE users 
      SET permissions = '{"can_view": true, "can_edit": false, "can_delete": false, "can_manage_users": false, "can_manage_products": false, "can_manage_orders": false, "can_view_reports": false}'
      WHERE role = 'buyer'
    `);

    await connection.execute(`
      UPDATE users 
      SET permissions = '{"can_view": true, "can_edit": true, "can_delete": false, "can_manage_users": false, "can_manage_products": true, "can_manage_orders": true, "can_view_reports": true}'
      WHERE role = 'seller'
    `);

    await connection.execute(`
      UPDATE users 
      SET permissions = '{"can_view": true, "can_edit": true, "can_delete": false, "can_manage_users": false, "can_manage_products": false, "can_manage_orders": true, "can_view_reports": true}'
      WHERE role = 'agent'
    `);

    await connection.execute(`
      UPDATE users 
      SET permissions = '{"can_view": true, "can_edit": true, "can_delete": true, "can_manage_users": true, "can_manage_products": true, "can_manage_orders": true, "can_view_reports": true, "can_manage_admins": true}'
      WHERE role = 'admin'
    `);

    console.log('✅ Default permissions set for existing users');

    // Create admin permissions table for more granular control
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS admin_permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        admin_id INT NOT NULL,
        permission_key VARCHAR(100) NOT NULL,
        permission_value BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_admin_permission (admin_id, permission_key)
      )
    `);

    console.log('✅ Admin permissions table created');

    // Add some common permission keys
    const permissionKeys = [
      'user_management',
      'user_suspension',
      'user_deletion',
      'product_approval',
      'order_management',
      'financial_reports',
      'system_settings',
      'security_logs',
      'marketing_management',
      'support_management'
    ];

    for (const key of permissionKeys) {
      await connection.execute(`
        INSERT IGNORE INTO admin_permissions (admin_id, permission_key, permission_value)
        SELECT id, ?, TRUE
        FROM users 
        WHERE role = 'admin'
      `, [key]);
    }

    console.log('✅ Admin permission keys added');

    console.log('🎉 Permissions system setup completed successfully!');

  } catch (error) {
    console.error('❌ Error setting up permissions system:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the migration
addPermissionsColumn();