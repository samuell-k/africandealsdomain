const mysql = require('mysql2/promise');

async function checkCampaigns() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'add_physical_product',
    port: 3333
  });

  try {
    console.log('=== PROMOTIONAL CAMPAIGNS ===');
    const [campaigns] = await connection.execute('SELECT * FROM promotional_campaigns');
    console.log('Number of campaigns:', campaigns.length);
    campaigns.forEach((campaign, index) => {
      console.log(`${index + 1}. ${campaign.title} - Active: ${campaign.is_active} - Valid Until: ${campaign.valid_until}`);
    });
    
    console.log('\n=== DISCOUNT CODES (PROMOTIONS) ===');
    const [promotions] = await connection.execute('SELECT * FROM promotions');
    console.log('Number of discount codes:', promotions.length);
    promotions.forEach((promo, index) => {
      console.log(`${index + 1}. ${promo.code} - ${promo.title} - Status: ${promo.status}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

checkCampaigns();