const mysql = require('mysql2/promise');

async function checkTables() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'add_physical_product',
    port: 3333
  });

  try {
    console.log('=== PROMOTIONS TABLE ===');
    const [promotions] = await connection.execute('SHOW COLUMNS FROM promotions');
    console.log(promotions);
    
    console.log('\n=== PARTNERS TABLE ===');
    const [partners] = await connection.execute('SHOW COLUMNS FROM partners');
    console.log(partners);
    
    console.log('\n=== OTHER_SERVICES TABLE ===');
    const [services] = await connection.execute('SHOW COLUMNS FROM other_services');
    console.log(services);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

checkTables();