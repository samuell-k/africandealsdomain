const mysql = require('mysql2/promise');

async function fixMobileMoneyIcon() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'add_physical_product',
    port: 3333
  });

  try {
    console.log('🔧 Fixing Mobile Money Integration icon...');
    
    // Update the icon from "4n" to a proper mobile money emoji
    const [result] = await connection.execute(
      'UPDATE other_services SET icon = ? WHERE name = ?',
      ['📱', 'Mobile Money Integration']
    );
    
    if (result.affectedRows > 0) {
      console.log('✅ Mobile Money Integration icon updated successfully!');
    } else {
      console.log('⚠️  No service found with name "Mobile Money Integration"');
    }
    
    // Let's also check what we have in the database
    const [services] = await connection.execute('SELECT * FROM other_services');
    console.log('\n📋 Current services in database:');
    services.forEach((service, index) => {
      console.log(`${index + 1}. ${service.name}: icon="${service.icon}", image="${service.image_url || 'None'}"`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

fixMobileMoneyIcon();