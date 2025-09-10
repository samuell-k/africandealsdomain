const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkDatabaseSchema() {
  console.log('🔍 ANALYZING DATABASE SCHEMA FOR IMAGE UPLOAD ISSUES...\n');
  
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'add_physical_product',
      port: process.env.DB_PORT || 3333
    });
    
    console.log('✅ Database connected');
    
    // Check partners table structure
    console.log('\n📊 PARTNERS TABLE SCHEMA:');
    try {
      const [partnersColumns] = await connection.execute('DESCRIBE partners');
      partnersColumns.forEach(col => {
        console.log(`  - ${col.Field}: ${col.Type} (${col.Null === 'YES' ? 'NULL' : 'NOT NULL'})`);
      });
    } catch (error) {
      console.error('❌ Partners table error:', error.message);
      
      // Try to create the table
      console.log('🔧 Creating partners table...');
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS partners (
          id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          logo_url VARCHAR(500),
          link VARCHAR(500),
          display_order INT DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_by INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Partners table created');
    }
    
    // Check other_services table structure  
    console.log('\n🛠️ OTHER_SERVICES TABLE SCHEMA:');
    try {
      const [servicesColumns] = await connection.execute('DESCRIBE other_services');
      servicesColumns.forEach(col => {
        console.log(`  - ${col.Field}: ${col.Type} (${col.Null === 'YES' ? 'NULL' : 'NOT NULL'})`);
      });
    } catch (error) {
      console.error('❌ Other_services table error:', error.message);
      
      // Try to create the table
      console.log('🔧 Creating other_services table...');
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS other_services (
          id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          icon VARCHAR(100),
          image_url VARCHAR(500),
          link VARCHAR(500),
          display_order INT DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_by INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Other_services table created');
    }
    
    // Check promotional_campaigns table structure
    console.log('\n🎯 PROMOTIONAL_CAMPAIGNS TABLE SCHEMA:');
    try {
      const [campaignsColumns] = await connection.execute('DESCRIBE promotional_campaigns');
      campaignsColumns.forEach(col => {
        console.log(`  - ${col.Field}: ${col.Type} (${col.Null === 'YES' ? 'NULL' : 'NOT NULL'})`);
      });
    } catch (error) {
      console.error('❌ Promotional_campaigns table error:', error.message);
      
      // Try to create the table
      console.log('🔧 Creating promotional_campaigns table...');
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS promotional_campaigns (
          id INT PRIMARY KEY AUTO_INCREMENT,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          image_url VARCHAR(500),
          promotion_type VARCHAR(100),
          discount_percentage DECIMAL(5,2),
          valid_until DATE,
          link VARCHAR(500),
          display_order INT DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_by INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Promotional_campaigns table created');
    }
    
    // Test the admin API queries
    console.log('\n🧪 TESTING ADMIN API QUERIES:');
    
    try {
      const [partners] = await connection.execute(
        'SELECT p.*, u.username as created_by_name FROM partners p LEFT JOIN users u ON p.created_by = u.id ORDER BY p.display_order ASC, p.created_at DESC'
      );
      console.log(`✅ Partners query successful - ${partners.length} records`);
    } catch (error) {
      console.error('❌ Partners query failed:', error.message);
      
      // Try simpler query
      try {
        const [simplePartners] = await connection.execute('SELECT * FROM partners ORDER BY id');
        console.log(`✅ Simple partners query successful - ${simplePartners.length} records`);
      } catch (simpleError) {
        console.error('❌ Simple partners query also failed:', simpleError.message);
      }
    }
    
    try {
      const [services] = await connection.execute(
        'SELECT s.*, u.username as created_by_name FROM other_services s LEFT JOIN users u ON s.created_by = u.id ORDER BY s.display_order ASC, s.created_at DESC'
      );
      console.log(`✅ Services query successful - ${services.length} records`);
    } catch (error) {
      console.error('❌ Services query failed:', error.message);
      
      // Try simpler query
      try {
        const [simpleServices] = await connection.execute('SELECT * FROM other_services ORDER BY id');
        console.log(`✅ Simple services query successful - ${simpleServices.length} records`);
      } catch (simpleError) {
        console.error('❌ Simple services query also failed:', simpleError.message);
      }
    }
    
    try {
      const [campaigns] = await connection.execute(
        'SELECT c.*, u.username as created_by_name FROM promotional_campaigns c LEFT JOIN users u ON c.created_by = u.id ORDER BY c.display_order ASC, c.created_at DESC'
      );
      console.log(`✅ Campaigns query successful - ${campaigns.length} records`);
    } catch (error) {
      console.error('❌ Campaigns query failed:', error.message);
      
      // Try simpler query
      try {
        const [simpleCampaigns] = await connection.execute('SELECT * FROM promotional_campaigns ORDER BY id');
        console.log(`✅ Simple campaigns query successful - ${simpleCampaigns.length} records`);
      } catch (simpleError) {
        console.error('❌ Simple campaigns query also failed:', simpleError.message);
      }
    }
    
    console.log('\n🎉 Database schema analysis complete!');
    
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    console.log('\n💡 Please check your database connection settings in .env file');
  } finally {
    if (connection) {
      await connection.end();
      console.log('📝 Database connection closed');
    }
  }
}

checkDatabaseSchema().catch(console.error);