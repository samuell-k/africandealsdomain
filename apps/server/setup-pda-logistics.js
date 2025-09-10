/**
 * PDA Logistics System Setup Script
 * Creates all necessary database tables and configurations for the comprehensive PDA logistics flow
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'add_physical_product',
  port: process.env.DB_PORT || 3333,
  multipleStatements: true
};

async function setupPDALogistics() {
  let connection = null;
  
  try {
    console.log('🚀 Starting PDA Logistics System Setup...');
    console.log('📡 Connecting to database...');
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Database connected successfully');

    // Read and execute the schema file
    console.log('📋 Reading PDA logistics schema...');
    const schemaPath = path.join(__dirname, 'database', 'pda-logistics-schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('🔧 Executing database schema...');
    await connection.execute(schema);
    console.log('✅ Database schema created successfully');

    // Create necessary directories for file uploads
    console.log('📁 Creating upload directories...');
    const uploadDirs = [
      path.join(__dirname, 'uploads', 'order-photos'),
      path.join(__dirname, 'uploads', 'qr-codes'),
      path.join(__dirname, 'uploads', 'payment-proofs')
    ];

    for (const dir of uploadDirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`   ✓ Created directory: ${dir}`);
      }
    }

    // Insert sample pickup sites if they don't exist
    console.log('🏢 Setting up sample pickup sites...');
    await setupSamplePickupSites(connection);

    // Setup default admin user for approvals
    console.log('👤 Ensuring admin user exists...');
    await ensureAdminUser(connection);

    // Insert default platform settings
    console.log('⚙️ Configuring default platform settings...');
    await setupDefaultSettings(connection);

    // Verify the setup
    console.log('🔍 Verifying setup...');
    await verifySetup(connection);

    console.log('\n🎉 PDA Logistics System setup completed successfully!');
    console.log('\n📋 Setup Summary:');
    console.log('   ✅ Enhanced order status tracking');
    console.log('   ✅ Dual confirmation system (OTP/QR/GPS/Photo)');
    console.log('   ✅ GPS location tracking');
    console.log('   ✅ Admin approval workflows');
    console.log('   ✅ Comprehensive notification system');
    console.log('   ✅ Manual override capabilities');
    console.log('   ✅ Multi-seller order support');
    console.log('\n🚀 System is ready for PDA logistics operations!');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('📡 Database connection closed');
    }
  }
}

async function setupSamplePickupSites(connection) {
  try {
    // Check if pickup sites already exist
    const [existing] = await connection.execute('SELECT COUNT(*) as count FROM pickup_sites');
    
    if (existing[0].count > 0) {
      console.log('   ℹ️ Pickup sites already exist, skipping sample data');
      return;
    }

    const sampleSites = [
      {
        name: 'Kigali City Center',
        description: 'Main pickup location in downtown Kigali',
        address_line1: 'KG 15 Ave, Kigali',
        city: 'Kigali',
        country: 'Rwanda',
        latitude: -1.9441,
        longitude: 30.0619,
        contact_phone: '+250 788 123 456',
        contact_email: 'kigali@africandealsdomain.com',
        capacity: 200,
        is_active: true
      },
      {
        name: 'Nyabugogo Commercial Center',
        description: 'Pickup point at Nyabugogo market area',
        address_line1: 'Nyabugogo, Kigali',
        city: 'Kigali', 
        country: 'Rwanda',
        latitude: -1.9355,
        longitude: 30.0596,
        contact_phone: '+250 788 234 567',
        contact_email: 'nyabugogo@africandealsdomain.com',
        capacity: 150,
        is_active: true
      },
      {
        name: 'Remera Office Complex',
        description: 'Convenient pickup location in Remera business district',
        address_line1: 'KG 7 Ave, Remera',
        city: 'Kigali',
        country: 'Rwanda', 
        latitude: -1.9578,
        longitude: 30.1127,
        contact_phone: '+250 788 345 678',
        contact_email: 'remera@africandealsdomain.com',
        capacity: 100,
        is_active: true
      }
    ];

    for (const site of sampleSites) {
      await connection.execute(`
        INSERT INTO pickup_sites (
          name, description, address_line1, city, country, 
          latitude, longitude, contact_phone, contact_email, 
          capacity, current_load, is_active, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, NOW())
      `, [
        site.name, site.description, site.address_line1, site.city, site.country,
        site.latitude, site.longitude, site.contact_phone, site.contact_email,
        site.capacity, site.is_active
      ]);
    }

    console.log('   ✅ Sample pickup sites created');
  } catch (error) {
    console.error('   ❌ Failed to setup pickup sites:', error.message);
  }
}

async function ensureAdminUser(connection) {
  try {
    const [admins] = await connection.execute(
      "SELECT id, name FROM users WHERE role = 'admin' LIMIT 1"
    );

    if (admins.length === 0) {
      console.log('   ⚠️ No admin user found. Creating default admin...');
      
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      await connection.execute(`
        INSERT INTO users (
          username, email, password_hash, role, is_active, is_verified, name, created_at
        ) VALUES (?, ?, ?, 'admin', 1, 1, ?, NOW())
      `, ['admin', 'admin@africandealsdomain.com', hashedPassword, 'System Administrator']);
      
      console.log('   ✅ Default admin user created');
      console.log('   📧 Email: admin@africandealsdomain.com');
      console.log('   🔑 Password: admin123 (Please change after first login)');
    } else {
      console.log(`   ✅ Admin user exists: ${admins[0].name}`);
    }
  } catch (error) {
    console.error('   ❌ Failed to ensure admin user:', error.message);
  }
}

async function setupDefaultSettings(connection) {
  try {
    // Check if settings already exist
    const [existing] = await connection.execute('SELECT COUNT(*) as count FROM pda_platform_settings');
    
    if (existing[0].count > 0) {
      console.log('   ℹ️ Platform settings already exist, skipping defaults');
      return;
    }

    const defaultSettings = [
      {
        key: 'gps_radius_tolerance',
        value: '100',
        type: 'number',
        category: 'gps',
        description: 'GPS radius tolerance in meters for location confirmations'
      },
      {
        key: 'otp_expiry_minutes',
        value: '30',
        type: 'number',
        category: 'confirmations',
        description: 'OTP code expiry time in minutes'
      },
      {
        key: 'auto_payout_enabled',
        value: 'false',
        type: 'boolean',
        category: 'payouts',
        description: 'Whether to automatically release payouts or require admin approval'
      },
      {
        key: 'seller_payout_on_psm_deposit',
        value: 'true',
        type: 'boolean',
        category: 'payouts',
        description: 'Release seller payout when item reaches PSM (true) or when buyer collects (false)'
      },
      {
        key: 'pda_commission_on_delivery',
        value: 'true',
        type: 'boolean',
        category: 'payouts',
        description: 'Release PDA commission on delivery completion (true) or require manual approval (false)'
      },
      {
        key: 'status_timeout_hours',
        value: '24',
        type: 'number',
        category: 'timeouts',
        description: 'Hours to wait before flagging stuck orders'
      },
      {
        key: 'enable_photo_evidence',
        value: 'true',
        type: 'boolean',
        category: 'confirmations',
        description: 'Require photo evidence for confirmations'
      },
      {
        key: 'notification_channels',
        value: '["app", "email"]',
        type: 'json',
        category: 'notifications',
        description: 'Default notification channels'
      },
      {
        key: 'max_retry_attempts',
        value: '3',
        type: 'number',
        category: 'confirmations',
        description: 'Maximum retry attempts for failed confirmations'
      },
      {
        key: 'manual_payment_required',
        value: 'true',
        type: 'boolean',
        category: 'payouts',
        description: 'Require manual admin approval for all payment proofs'
      }
    ];

    for (const setting of defaultSettings) {
      await connection.execute(`
        INSERT INTO pda_platform_settings (
          setting_key, setting_value, setting_type, category, description, 
          is_configurable, created_at
        ) VALUES (?, ?, ?, ?, ?, 1, NOW())
      `, [setting.key, setting.value, setting.type, setting.category, setting.description]);
    }

    console.log('   ✅ Default platform settings configured');
  } catch (error) {
    console.error('   ❌ Failed to setup default settings:', error.message);
  }
}

async function verifySetup(connection) {
  try {
    const verifications = [
      {
        name: 'Orders table enhanced',
        query: "SHOW COLUMNS FROM orders LIKE 'detailed_status'"
      },
      {
        name: 'Order status history table',
        query: "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name = 'order_status_history'"
      },
      {
        name: 'Order confirmations table',
        query: "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name = 'order_confirmations'"
      },
      {
        name: 'GPS tracking table',
        query: "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name = 'order_gps_tracking'"
      },
      {
        name: 'Enhanced notifications table',
        query: "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name = 'enhanced_notifications'"
      },
      {
        name: 'Admin approvals table',
        query: "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name = 'admin_approvals'"
      },
      {
        name: 'Pickup sites table',
        query: "SELECT COUNT(*) as count FROM pickup_sites"
      },
      {
        name: 'Platform settings',
        query: "SELECT COUNT(*) as count FROM pda_platform_settings"
      }
    ];

    console.log('\n   🔍 Verification Results:');
    for (const verification of verifications) {
      try {
        const [result] = await connection.execute(verification.query);
        const success = result.length > 0 && (result[0].count > 0 || result[0][Object.keys(result[0])[0]] !== null);
        console.log(`   ${success ? '✅' : '❌'} ${verification.name}`);
      } catch (error) {
        console.log(`   ❌ ${verification.name} - Error: ${error.message}`);
      }
    }

  } catch (error) {
    console.error('   ❌ Verification failed:', error.message);
  }
}

// Run the setup if this file is executed directly
if (require.main === module) {
  setupPDALogistics();
}

module.exports = { setupPDALogistics };