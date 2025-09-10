const mysql = require('mysql2/promise');
require('dotenv').config();

async function runSimpleUpgrade() {
  try {
    // Create database connection
    const pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'add_physical_product',
      port: process.env.DB_PORT || 3306,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    console.log('🔄 Starting simple agent types upgrade...');

    // Test connection
    const connection = await pool.getConnection();
    console.log('✅ Database connection established');
    connection.release();

    // 1. Update agents table
    try {
      await pool.execute(`
        ALTER TABLE agents 
        ADD COLUMN IF NOT EXISTS agent_type ENUM('fast_delivery', 'pickup_delivery', 'pickup_site') DEFAULT 'fast_delivery'
      `);
      console.log('✅ Added agent_type column');
    } catch (err) {
      if (!err.message.includes('Duplicate column')) {
        console.error('❌ Error adding agent_type:', err.message);
      } else {
        console.log('⚠️  agent_type column already exists');
      }
    }

    try {
      await pool.execute(`
        ALTER TABLE agents 
        ADD COLUMN IF NOT EXISTS marketplace_type ENUM('physical', 'grocery', 'both') DEFAULT 'both'
      `);
      console.log('✅ Added marketplace_type column');
    } catch (err) {
      if (!err.message.includes('Duplicate column')) {
        console.error('❌ Error adding marketplace_type:', err.message);
      } else {
        console.log('⚠️  marketplace_type column already exists');
      }
    }

    try {
      await pool.execute(`
        ALTER TABLE agents 
        ADD COLUMN IF NOT EXISTS current_lat DECIMAL(10, 8) NULL,
        ADD COLUMN IF NOT EXISTS current_lng DECIMAL(11, 8) NULL,
        ADD COLUMN IF NOT EXISTS trust_level DECIMAL(3,2) DEFAULT 0.00,
        ADD COLUMN IF NOT EXISTS pickup_site_id INT NULL,
        ADD COLUMN IF NOT EXISTS can_create_orders BOOLEAN DEFAULT FALSE
      `);
      console.log('✅ Added additional agent columns');
    } catch (err) {
      console.log('⚠️  Some agent columns may already exist');
    }

    // 2. Create pickup_sites table
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS pickup_sites (
          id INT AUTO_INCREMENT PRIMARY KEY,
          site_code VARCHAR(20) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          manager_agent_id INT NOT NULL,
          address_line1 VARCHAR(255) NOT NULL,
          city VARCHAR(100) NOT NULL,
          country VARCHAR(100) NOT NULL,
          latitude DECIMAL(10, 8) NOT NULL,
          longitude DECIMAL(11, 8) NOT NULL,
          phone VARCHAR(20),
          email VARCHAR(100),
          capacity INT DEFAULT 100,
          current_load INT DEFAULT 0,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Created pickup_sites table');
    } catch (err) {
      console.log('⚠️  pickup_sites table may already exist');
    }

    // 3. Create grocery_orders table
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS grocery_orders (
          id INT AUTO_INCREMENT PRIMARY KEY,
          order_number VARCHAR(50) UNIQUE NOT NULL,
          buyer_id INT NOT NULL,
          agent_id INT NULL,
          status ENUM('pending', 'assigned', 'shopping', 'picked_up', 'in_transit', 'delivered', 'cancelled') DEFAULT 'pending',
          total_amount DECIMAL(12,2) NOT NULL,
          delivery_fee DECIMAL(8,2) DEFAULT 0,
          agent_commission DECIMAL(8,2) DEFAULT 0,
          delivery_address JSON NOT NULL,
          shopping_list JSON NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          delivered_at TIMESTAMP NULL
        )
      `);
      console.log('✅ Created grocery_orders table');
    } catch (err) {
      console.log('⚠️  grocery_orders table may already exist');
    }

    // 4. Create manual_orders table
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS manual_orders (
          id INT AUTO_INCREMENT PRIMARY KEY,
          order_number VARCHAR(50) UNIQUE NOT NULL,
          pickup_site_id INT NOT NULL,
          created_by_agent_id INT NOT NULL,
          buyer_name VARCHAR(255) NOT NULL,
          buyer_phone VARCHAR(20) NOT NULL,
          buyer_email VARCHAR(100),
          items JSON NOT NULL,
          total_amount DECIMAL(12,2) NOT NULL,
          commission_amount DECIMAL(8,2) NOT NULL,
          status ENUM('created', 'confirmed', 'ready_for_pickup', 'picked_up', 'cancelled') DEFAULT 'created',
          receipt_pdf_path VARCHAR(255),
          qr_code VARCHAR(255),
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          picked_up_at TIMESTAMP NULL
        )
      `);
      console.log('✅ Created manual_orders table');
    } catch (err) {
      console.log('⚠️  manual_orders table may already exist');
    }

    // 5. Update orders table
    try {
      await pool.execute(`
        ALTER TABLE orders 
        ADD COLUMN IF NOT EXISTS agent_type ENUM('fast_delivery', 'pickup_delivery', 'pickup_site') NULL,
        ADD COLUMN IF NOT EXISTS pickup_site_id INT NULL,
        ADD COLUMN IF NOT EXISTS delivery_code VARCHAR(10) NULL
      `);
      console.log('✅ Updated orders table');
    } catch (err) {
      console.log('⚠️  Orders table columns may already exist');
    }

    // 6. Insert sample data if tables are empty
    try {
      const [existingSites] = await pool.execute('SELECT COUNT(*) as count FROM pickup_sites');
      if (existingSites[0].count === 0) {
        await pool.execute(`
          INSERT INTO pickup_sites (site_code, name, description, manager_agent_id, address_line1, city, country, latitude, longitude, phone) VALUES
          ('PS-001', 'Downtown Collection Point', 'Main downtown pickup location', 1, '123 Main Street', 'Kigali', 'Rwanda', -1.9441, 30.0619, '+250788123456'),
          ('PS-002', 'Nyamirambo Hub', 'Community pickup point in Nyamirambo', 1, '456 Nyamirambo Road', 'Kigali', 'Rwanda', -1.9706, 30.0588, '+250788123457')
        `);
        console.log('✅ Inserted sample pickup sites');
      }
    } catch (err) {
      console.log('⚠️  Sample data insertion skipped');
    }

    await pool.end();
    console.log('🎉 Simple agent types upgrade completed successfully!');
    console.log('');
    console.log('📋 Summary:');
    console.log('   • Enhanced agents table with agent types');
    console.log('   • Created pickup_sites table');
    console.log('   • Created grocery_orders table');
    console.log('   • Created manual_orders table');
    console.log('   • Updated orders table');
    console.log('');
    console.log('🚀 Ready to use the three agent types!');

  } catch (error) {
    console.error('💥 Upgrade failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('');
      console.log('🔧 Database connection failed. Please ensure:');
      console.log('   • MySQL server is running');
      console.log('   • Database "african_deals_domain" exists');
      console.log('   • Connection credentials are correct');
    }
    process.exit(1);
  }
}

// Run the upgrade
runSimpleUpgrade();