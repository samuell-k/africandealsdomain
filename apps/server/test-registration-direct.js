const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function testRegistrationDirect() {
  console.log('🧪 Testing Agent Registration Directly...\n');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'add_physical_product',
      port: process.env.DB_PORT || 3333
    });

    console.log('✅ Database connection established\n');

    // Test data
    const testData = {
      agent_type: 'fast_delivery',
      first_name: 'Test',
      last_name: 'Agent',
      email: `test.direct.${Date.now()}@example.com`,
      phone: '+250788123456',
      password: 'testpassword123',
      date_of_birth: '1990-01-01',
      gender: 'male',
      country: 'Rwanda',
      province: 'Kigali City',
      district: 'Gasabo',
      sector: 'Kimihurura',
      village: 'Test Village',
      street_address: '123 Test Street',
      city: 'Kigali',
      latitude: '-1.9441',
      longitude: '30.0619',
      id_type: 'national_id',
      work_zone: 'Kigali City Center',
      max_delivery_distance: '10km',
      work_start_time: '08:00',
      work_end_time: '18:00'
    };

    console.log('📝 Test data:', testData);

    // Hash password
    const hashedPassword = await bcrypt.hash(testData.password, 10);
    console.log('🔐 Password hashed');

    // Create user first
    const [userResult] = await connection.execute(`
      INSERT INTO users (username, email, password, role, first_name, last_name, phone, is_verified, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      testData.email.split('@')[0], // username from email
      testData.email,
      hashedPassword,
      'agent',
      testData.first_name,
      testData.last_name,
      testData.phone,
      0, // not verified initially
      1  // active
    ]);

    const userId = userResult.insertId;
    console.log('✅ User created with ID:', userId);

    // Generate agent code
    const generateAgentCode = () => {
      const timestamp = Date.now().toString().slice(-6);
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      return `AGT-${timestamp}${random}`;
    };

    const agentCode = generateAgentCode();
    console.log('🏷️ Generated agent code:', agentCode);

    // Determine marketplace type
    let marketplaceType = 'both';
    if (testData.agent_type === 'fast_delivery') {
      marketplaceType = 'grocery';
    } else if (testData.agent_type === 'pickup_delivery') {
      marketplaceType = 'physical';
    }

    // Prepare agent parameters
    const agentParams = [
      agentCode,
      userId,
      testData.first_name || '',
      testData.last_name || '',
      testData.email || '',
      testData.phone || null,
      testData.agent_type,
      testData.district || 'Rwanda',
      'pending_verification',
      'unverified',
      15.00,
      5.00,
      JSON.stringify(['deliver', 'pickup', 'track']),
      0,
      parseFloat(testData.latitude) || null,
      parseFloat(testData.longitude) || null,
      marketplaceType
    ];

    console.log('🔍 Agent parameters:');
    agentParams.forEach((param, index) => {
      console.log(`  [${index}]: ${param} (${typeof param}) ${param === undefined ? '⚠️ UNDEFINED' : '✅'}`);
    });

    // Insert agent
    const [agentResult] = await connection.execute(`
      INSERT INTO agents (
        agent_code, user_id, first_name, last_name, email, phone,
        agent_type, primary_territory, status, verification_status,
        commission_rate, bonus_rate, permissions, is_available,
        latitude, longitude, marketplace_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, agentParams);

    const agentId = agentResult.insertId;
    console.log('✅ Agent created with ID:', agentId);

    // Insert verification data
    await connection.execute(`
      INSERT INTO agent_verification (
        agent_id, user_id, verification_status, date_of_birth, gender,
        street_address, city, country, province, district, sector, village,
        latitude, longitude, id_type, work_zone, max_delivery_distance,
        work_start_time, work_end_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      agentId, userId, 'pending', testData.date_of_birth, testData.gender,
      testData.street_address, testData.city, testData.country, testData.province,
      testData.district, testData.sector, testData.village,
      parseFloat(testData.latitude), parseFloat(testData.longitude), testData.id_type,
      testData.work_zone, testData.max_delivery_distance, testData.work_start_time,
      testData.work_end_time
    ]);

    console.log('✅ Verification data inserted');

    // Create admin notification
    await connection.execute(`
      INSERT INTO admin_notifications (
        type, title, message, data, is_read, created_at
      ) VALUES (?, ?, ?, ?, ?, NOW())
    `, [
      'agent_registration',
      'New Agent Registration',
      `New ${testData.agent_type} agent registration from ${testData.first_name} ${testData.last_name}`,
      JSON.stringify({ agent_id: agentId, user_id: userId }),
      0
    ]);

    console.log('✅ Admin notification created');

    // Log system activity
    await connection.execute(`
      INSERT INTO system_logs (message, level, details)
      VALUES (?, ?, ?)
    `, [
      `Agent registration completed for ${testData.first_name} ${testData.last_name} (${testData.email})`,
      'info',
      JSON.stringify({
        agent_id: agentId,
        user_id: userId,
        agent_type: testData.agent_type,
        email: testData.email,
        action: 'agent_registered'
      })
    ]);

    console.log('✅ System log created');

    console.log('\n🎉 REGISTRATION SUCCESSFUL!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`✅ User ID: ${userId}`);
    console.log(`✅ Agent ID: ${agentId}`);
    console.log(`✅ Agent Code: ${agentCode}`);
    console.log(`✅ Agent Type: ${testData.agent_type}`);
    console.log(`✅ Marketplace: ${marketplaceType}`);
    console.log('✅ All database records created successfully');

  } catch (error) {
    console.error('❌ Registration failed:', error.message);
    console.error('Full error:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🧹 Database connection closed');
    }
  }
}

testRegistrationDirect();