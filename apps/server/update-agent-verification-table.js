const mysql = require('mysql2/promise');
require('dotenv').config();

async function updateAgentVerificationTable() {
  console.log('🔄 Updating Agent Verification Table with Role-Specific Fields...\n');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'add_physical_product',
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connection established\n');

    // Add new columns to agent_verification table (MySQL doesn't support IF NOT EXISTS for columns)
    const alterQueries = [
      // Address fields for Rwanda
      'ALTER TABLE agent_verification ADD COLUMN province VARCHAR(100) AFTER country',
      'ALTER TABLE agent_verification ADD COLUMN district VARCHAR(100) AFTER province',
      'ALTER TABLE agent_verification ADD COLUMN sector VARCHAR(100) AFTER district',
      'ALTER TABLE agent_verification ADD COLUMN village VARCHAR(100) AFTER sector',
      
      // Vehicle information
      'ALTER TABLE agent_verification ADD COLUMN has_vehicle BOOLEAN DEFAULT FALSE AFTER license_plate',
      
      // Fast delivery specific fields
      'ALTER TABLE agent_verification ADD COLUMN work_zone VARCHAR(100) AFTER mobile_money',
      'ALTER TABLE agent_verification ADD COLUMN max_delivery_distance VARCHAR(20) AFTER work_zone',
      'ALTER TABLE agent_verification ADD COLUMN available_days JSON AFTER max_delivery_distance',
      'ALTER TABLE agent_verification ADD COLUMN work_start_time TIME AFTER available_days',
      'ALTER TABLE agent_verification ADD COLUMN work_end_time TIME AFTER work_start_time',
      
      // Transport delivery specific fields
      'ALTER TABLE agent_verification ADD COLUMN pickup_zone VARCHAR(100) AFTER work_end_time',
      'ALTER TABLE agent_verification ADD COLUMN delivery_zone VARCHAR(100) AFTER pickup_zone',
      'ALTER TABLE agent_verification ADD COLUMN transport_capacity VARCHAR(50) AFTER delivery_zone',
      'ALTER TABLE agent_verification ADD COLUMN max_orders_per_trip VARCHAR(20) AFTER transport_capacity',
      
      // Site manager specific fields
      'ALTER TABLE agent_verification ADD COLUMN site_name VARCHAR(200) AFTER max_orders_per_trip',
      'ALTER TABLE agent_verification ADD COLUMN site_type VARCHAR(50) AFTER site_name',
      'ALTER TABLE agent_verification ADD COLUMN opening_hours TIME AFTER site_type',
      'ALTER TABLE agent_verification ADD COLUMN closing_hours TIME AFTER opening_hours',
      'ALTER TABLE agent_verification ADD COLUMN operating_days JSON AFTER closing_hours'
    ];

    for (const query of alterQueries) {
      try {
        await connection.execute(query);
        console.log(`✅ ${query.split('ADD COLUMN IF NOT EXISTS')[1]?.split(' ')[0] || 'Column'} added successfully`);
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log(`ℹ️  Column already exists: ${query.split('ADD COLUMN IF NOT EXISTS')[1]?.split(' ')[0]}`);
        } else {
          console.error(`❌ Error with query: ${query}`);
          console.error(`   Error: ${error.message}`);
        }
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('                    UPDATE COMPLETE                        ');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Agent verification table updated with role-specific fields');
    console.log('\n📋 Added Fields:');
    console.log('   🇷🇼 Rwanda Address: province, district, sector, village');
    console.log('   🚗 Vehicle Info: has_vehicle flag');
    console.log('   🏃 Fast Delivery: work_zone, max_delivery_distance, available_days, work_hours');
    console.log('   🚚 Transport: pickup_zone, delivery_zone, transport_capacity, max_orders_per_trip');
    console.log('   🏢 Site Manager: site_name, site_type, opening_hours, closing_hours, operating_days');

  } catch (error) {
    console.error('💥 Error updating table:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🧹 Database connection closed');
    }
  }
}

updateAgentVerificationTable();