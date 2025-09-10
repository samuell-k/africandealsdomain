const pool = require('./db');

async function checkTableStructure() {
  try {
    console.log('Checking referral_links table structure...');
    const [rows] = await pool.query('DESCRIBE referral_links');
    console.log('referral_links columns:');
    rows.forEach(row => {
      console.log(`  ${row.Field} - ${row.Type} - ${row.Null} - ${row.Key} - ${row.Default}`);
    });
    
    console.log('\nChecking referral_withdrawals table structure...');
    const [rows2] = await pool.query('DESCRIBE referral_withdrawals');
    console.log('referral_withdrawals columns:');
    rows2.forEach(row => {
      console.log(`  ${row.Field} - ${row.Type} - ${row.Null} - ${row.Key} - ${row.Default}`);
    });
    
    console.log('\nChecking order_items table structure...');
    const [rows3] = await pool.query('DESCRIBE order_items');
    console.log('order_items columns:');
    rows3.forEach(row => {
      console.log(`  ${row.Field} - ${row.Type} - ${row.Null} - ${row.Key} - ${row.Default}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkTableStructure();