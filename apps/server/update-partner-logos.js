const mysql = require('mysql2/promise');

async function updatePartnerLogos() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'add_physical_product',
    port: 3333
  });

  try {
    console.log('Updating partner logo URLs to use SVG files...');
    
    // Update MTN logo
    await connection.execute(
      'UPDATE partners SET logo_url = ? WHERE name = ?',
      ['/public/images/partners/mtn-logo.svg', 'MTN Rwanda']
    );
    console.log('✅ Updated MTN logo');
    
    // Update Bank of Kigali logo
    await connection.execute(
      'UPDATE partners SET logo_url = ? WHERE name = ?',
      ['/public/images/partners/bok-logo.svg', 'Bank of Kigali']
    );
    console.log('✅ Updated Bank of Kigali logo');
    
    // Update AC Group logo
    await connection.execute(
      'UPDATE partners SET logo_url = ? WHERE name = ?',
      ['/public/images/partners/ac-group-logo.svg', 'AC Group']
    );
    console.log('✅ Updated AC Group logo');
    
    console.log('🎉 All partner logos updated successfully!');

  } catch (error) {
    console.error('❌ Error updating partner logos:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

updatePartnerLogos()
  .then(() => {
    console.log('✅ Logo update completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Logo update failed:', error);
    process.exit(1);
  });