const mysql = require('mysql2/promise');

async function debugCampaigns() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'add_physical_product',
    port: 3333
  });

  try {
    console.log('=== DEBUGGING PROMOTIONAL CAMPAIGNS ===');
    const [campaigns] = await connection.execute('SELECT * FROM promotional_campaigns');
    
    campaigns.forEach((campaign, index) => {
      console.log(`\n${index + 1}. Campaign: ${campaign.title}`);
      console.log(`   - is_active: ${campaign.is_active}`);
      console.log(`   - valid_from: ${campaign.valid_from}`);
      console.log(`   - valid_until: ${campaign.valid_until}`);
      console.log(`   - NOW(): ${new Date().toISOString()}`);
    });
    
    // Test the exact query used by API
    console.log('\n=== TESTING API QUERY ===');
    const [result] = await connection.execute(`
      SELECT id, title, description, image_url, link, promotion_type, discount_percentage, valid_from, valid_until, created_at 
      FROM promotional_campaigns 
      WHERE is_active = TRUE 
      AND (valid_from IS NULL OR valid_from <= NOW()) 
      AND (valid_until IS NULL OR valid_until >= NOW()) 
      ORDER BY display_order ASC, created_at DESC
    `);
    
    console.log(`Found ${result.length} campaigns matching API criteria:`);
    result.forEach((campaign, index) => {
      console.log(`${index + 1}. ${campaign.title} - Valid until: ${campaign.valid_until}`);
    });
    
    // Let's also set valid_from dates for our campaigns
    console.log('\n=== FIXING VALID_FROM DATES ===');
    await connection.execute(`
      UPDATE promotional_campaigns 
      SET valid_from = '2025-01-01 00:00:00' 
      WHERE valid_from IS NULL
    `);
    console.log('✅ Set valid_from dates for campaigns');
    
    // Test again
    const [result2] = await connection.execute(`
      SELECT id, title, description, image_url, link, promotion_type, discount_percentage, valid_from, valid_until, created_at 
      FROM promotional_campaigns 
      WHERE is_active = TRUE 
      AND (valid_from IS NULL OR valid_from <= NOW()) 
      AND (valid_until IS NULL OR valid_until >= NOW()) 
      ORDER BY display_order ASC, created_at DESC
    `);
    
    console.log(`\nAfter fix - Found ${result2.length} campaigns:`);
    result2.forEach((campaign, index) => {
      console.log(`${index + 1}. ${campaign.title}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

debugCampaigns();