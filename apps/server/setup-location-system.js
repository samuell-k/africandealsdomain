const mysql = require('mysql2/promise');
const pool = require('./db');

async function setupLocationSystem() {
  try {
    console.log('🚀 Setting up comprehensive location and map tracking system...');

    // 1. Add location columns to users table
    const userColumns = [
      'ADD COLUMN IF NOT EXISTS home_lat DECIMAL(10, 8) NULL',
      'ADD COLUMN IF NOT EXISTS home_lng DECIMAL(11, 8) NULL', 
      'ADD COLUMN IF NOT EXISTS home_address TEXT NULL',
      'ADD COLUMN IF NOT EXISTS work_lat DECIMAL(10, 8) NULL',
      'ADD COLUMN IF NOT EXISTS work_lng DECIMAL(11, 8) NULL',
      'ADD COLUMN IF NOT EXISTS work_address TEXT NULL',
      'ADD COLUMN IF NOT EXISTS business_lat DECIMAL(10, 8) NULL',
      'ADD COLUMN IF NOT EXISTS business_lng DECIMAL(11, 8) NULL',
      'ADD COLUMN IF NOT EXISTS business_address TEXT NULL',
      'ADD COLUMN IF NOT EXISTS business_name VARCHAR(255) NULL',
      'ADD COLUMN IF NOT EXISTS custom_locations JSON NULL'
    ];

    for (const column of userColumns) {
      try {
        await pool.query(`ALTER TABLE users ${column}`);
      } catch (error) {
        if (!error.message.includes('Duplicate column name')) {
          console.warn(`⚠️ Warning adding user column: ${error.message}`);
        }
      }
    }

    // 2. Add location columns to products table
    const productColumns = [
      'ADD COLUMN IF NOT EXISTS lat DECIMAL(10, 8) NULL',
      'ADD COLUMN IF NOT EXISTS lng DECIMAL(11, 8) NULL',
      'ADD COLUMN IF NOT EXISTS address TEXT NULL'
    ];

    for (const column of productColumns) {
      try {
        await pool.query(`ALTER TABLE products ${column}`);
      } catch (error) {
        if (!error.message.includes('Duplicate column name')) {
          console.warn(`⚠️ Warning adding product column: ${error.message}`);
        }
      }
    }

    // 3. Create/update user_locations table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_locations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        role ENUM('buyer', 'seller', 'agent', 'admin') NOT NULL,
        lat DECIMAL(10, 8) NOT NULL,
        lng DECIMAL(11, 8) NOT NULL,
        address TEXT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        UNIQUE KEY unique_user_location (user_id),
        INDEX idx_role (role),
        INDEX idx_location (lat, lng),
        INDEX idx_updated (updated_at)
      )
    `);

    // 4. Create/update order_gps_history table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_gps_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        agent_id INT NOT NULL,
        lat DECIMAL(10, 8) NOT NULL,
        lng DECIMAL(11, 8) NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        INDEX idx_order_id (order_id),
        INDEX idx_agent_id (agent_id),
        INDEX idx_timestamp (timestamp),
        INDEX idx_location (lat, lng)
      )
    `);

    // 5. Create/update delivery_zones table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS delivery_zones (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        geojson JSON NOT NULL,
        base_price DECIMAL(8,2) DEFAULT 5.00,
        price_per_km DECIMAL(8,2) DEFAULT 1.50,
        is_active BOOLEAN DEFAULT TRUE,
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_name (name),
        INDEX idx_active (is_active)
      )
    `);

    // 6. Add delivery-related columns to orders table
    const orderColumns = [
      'ADD COLUMN IF NOT EXISTS delivery_lat DECIMAL(10, 8) NULL',
      'ADD COLUMN IF NOT EXISTS delivery_lng DECIMAL(11, 8) NULL',
      'ADD COLUMN IF NOT EXISTS delivery_address TEXT NULL',
      'ADD COLUMN IF NOT EXISTS pickup_lat DECIMAL(10, 8) NULL',
      'ADD COLUMN IF NOT EXISTS pickup_lng DECIMAL(11, 8) NULL',
      'ADD COLUMN IF NOT EXISTS pickup_address TEXT NULL',
      'ADD COLUMN IF NOT EXISTS delivery_confirmed_lat DECIMAL(10, 8) NULL',
      'ADD COLUMN IF NOT EXISTS delivery_confirmed_lng DECIMAL(11, 8) NULL',
      'ADD COLUMN IF NOT EXISTS delivery_confirmed_at TIMESTAMP NULL',
      'ADD COLUMN IF NOT EXISTS estimated_delivery_time INT NULL COMMENT "Estimated delivery time in minutes"'
    ];

    for (const column of orderColumns) {
      try {
        await pool.query(`ALTER TABLE orders ${column}`);
      } catch (error) {
        if (!error.message.includes('Duplicate column name')) {
          console.warn(`⚠️ Warning adding order column: ${error.message}`);
        }
      }
    }

    // 7. Insert sample location data for existing users
    console.log('📍 Adding sample location data...');
    
    // Sample locations around Nairobi, Kenya
    const sampleLocations = [
      { lat: -1.2921, lng: 36.8219, address: 'Nairobi CBD, Kenya' },
      { lat: -1.2864, lng: 36.8172, address: 'Westlands, Nairobi, Kenya' },
      { lat: -1.3031, lng: 36.7073, address: 'Karen, Nairobi, Kenya' },
      { lat: -1.2634, lng: 36.8084, address: 'Kilimani, Nairobi, Kenya' },
      { lat: -1.2441, lng: 36.8906, address: 'Eastlands, Nairobi, Kenya' }
    ];

    // Get existing users
    const [users] = await pool.query('SELECT id, role FROM users LIMIT 10');
    
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const location = sampleLocations[i % sampleLocations.length];
      
      // Add some variation to coordinates
      const lat = location.lat + (Math.random() - 0.5) * 0.01;
      const lng = location.lng + (Math.random() - 0.5) * 0.01;
      
      try {
        // Update user_locations
        await pool.query(
          `INSERT INTO user_locations (user_id, role, lat, lng, address) 
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE lat = ?, lng = ?, address = ?`,
          [user.id, user.role, lat, lng, location.address, lat, lng, location.address]
        );

        // Add home/work locations for buyers
        if (user.role === 'buyer') {
          const homeLat = lat + (Math.random() - 0.5) * 0.005;
          const homeLng = lng + (Math.random() - 0.5) * 0.005;
          const workLat = lat + (Math.random() - 0.5) * 0.005;
          const workLng = lng + (Math.random() - 0.5) * 0.005;
          
          await pool.query(
            'UPDATE users SET home_lat = ?, home_lng = ?, home_address = ?, work_lat = ?, work_lng = ?, work_address = ? WHERE id = ?',
            [homeLat, homeLng, 'Home - ' + location.address, workLat, workLng, 'Work - ' + location.address, user.id]
          );
        }

        // Add business locations for sellers
        if (user.role === 'seller') {
          await pool.query(
            'UPDATE users SET business_lat = ?, business_lng = ?, business_address = ?, business_name = ? WHERE id = ?',
            [lat, lng, 'Business - ' + location.address, `Business ${user.id}`, user.id]
          );
        }
      } catch (error) {
        console.warn(`⚠️ Warning adding location for user ${user.id}: ${error.message}`);
      }
    }

    // 8. Add location data to some products
    const [products] = await pool.query('SELECT id, seller_id FROM products LIMIT 20');
    
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const location = sampleLocations[i % sampleLocations.length];
      
      // Add some variation
      const lat = location.lat + (Math.random() - 0.5) * 0.01;
      const lng = location.lng + (Math.random() - 0.5) * 0.01;
      
      try {
        await pool.query(
          'UPDATE products SET lat = ?, lng = ?, address = ? WHERE id = ?',
          [lat, lng, 'Product Location - ' + location.address, product.id]
        );
      } catch (error) {
        console.warn(`⚠️ Warning adding location for product ${product.id}: ${error.message}`);
      }
    }

    // 9. Create sample delivery zones
    console.log('🗺️ Creating sample delivery zones...');
    
    const sampleZones = [
      {
        name: 'Nairobi CBD Zone',
        geojson: {
          type: 'Polygon',
          coordinates: [[
            [36.8100, -1.3000],
            [36.8300, -1.3000],
            [36.8300, -1.2800],
            [36.8100, -1.2800],
            [36.8100, -1.3000]
          ]]
        },
        base_price: 3.00,
        price_per_km: 1.00
      },
      {
        name: 'Westlands Zone',
        geojson: {
          type: 'Polygon',
          coordinates: [[
            [36.8000, -1.2900],
            [36.8200, -1.2900],
            [36.8200, -1.2700],
            [36.8000, -1.2700],
            [36.8000, -1.2900]
          ]]
        },
        base_price: 4.00,
        price_per_km: 1.25
      }
    ];

    for (const zone of sampleZones) {
      try {
        await pool.query(
          'INSERT IGNORE INTO delivery_zones (name, geojson, base_price, price_per_km) VALUES (?, ?, ?, ?)',
          [zone.name, JSON.stringify(zone.geojson), zone.base_price, zone.price_per_km]
        );
      } catch (error) {
        console.warn(`⚠️ Warning creating zone ${zone.name}: ${error.message}`);
      }
    }

    // 10. Add some GPS history for existing orders
    const [orders] = await pool.query('SELECT id, agent_id FROM orders WHERE agent_id IS NOT NULL LIMIT 5');
    
    for (const order of orders) {
      if (order.agent_id) {
        // Create a simple GPS trail
        const baseLocation = sampleLocations[0];
        for (let i = 0; i < 5; i++) {
          const lat = baseLocation.lat + (i * 0.001);
          const lng = baseLocation.lng + (i * 0.001);
          
          try {
            await pool.query(
              'INSERT INTO order_gps_history (order_id, agent_id, lat, lng, timestamp) VALUES (?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? MINUTE))',
              [order.id, order.agent_id, lat, lng, (5 - i) * 10]
            );
          } catch (error) {
            console.warn(`⚠️ Warning adding GPS history: ${error.message}`);
          }
        }
      }
    }

    // Get summary data
    const [userLocationCount] = await pool.query('SELECT COUNT(*) as count FROM user_locations');
    const [productLocationCount] = await pool.query('SELECT COUNT(*) as count FROM products WHERE lat IS NOT NULL');
    const [zoneCount] = await pool.query('SELECT COUNT(*) as count FROM delivery_zones');
    const [gpsHistoryCount] = await pool.query('SELECT COUNT(*) as count FROM order_gps_history');

    console.log('✅ Location and map tracking system setup completed successfully!');
    
    return {
      success: true,
      message: 'Location and map tracking system setup completed successfully',
      summary: {
        user_locations: userLocationCount[0].count,
        product_locations: productLocationCount[0].count,
        delivery_zones: zoneCount[0].count,
        gps_history_points: gpsHistoryCount[0].count,
        tables_created: [
          'user_locations',
          'order_gps_history', 
          'delivery_zones'
        ],
        tables_updated: [
          'users (added location columns)',
          'products (added location columns)',
          'orders (added delivery columns)'
        ]
      }
    };

  } catch (error) {
    console.error('❌ Setup failed:', error);
    throw error;
  }
}

// Run setup if called directly
if (require.main === module) {
  setupLocationSystem()
    .then(result => {
      console.log('🎉 Setup completed:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Setup failed:', error);
      process.exit(1);
    });
}

module.exports = setupLocationSystem;