const mysql = require('mysql2/promise');

async function checkAgentsTable() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'add_physical_product',
      port: 3333
    });
    
    console.log('Checking agents table structure...');
    
    // Check agents table columns
    const [columns] = await connection.execute('DESCRIBE agents');
    console.log('\nAgents table columns:');
    columns.forEach(col => {
      console.log(`  ${col.Field}: ${col.Type} (${col.Null === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // Show sample data
    console.log('\nSample agents data:');
    const [agents] = await connection.execute('SELECT * FROM agents LIMIT 3');
    if (agents.length > 0) {
      console.log(agents);
    } else {
      console.log('No agents found');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkAgentsTable();