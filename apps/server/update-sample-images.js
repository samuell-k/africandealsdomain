const mysql = require('mysql2/promise');

async function updateSampleImages() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'add_physical_product',
    port: 3333
  });

  try {
    console.log('=== UPDATING PROMOTIONAL CAMPAIGN IMAGES ===');
    
    // Update the first campaign with the sample image
    await connection.execute(
      'UPDATE promotional_campaigns SET image_url = ? WHERE id = ?',
      ['/uploads/partners-promotions/sample-promotion.svg', 2]
    );
    console.log('✅ Updated first campaign with sample image');
    
    // Update the second campaign to show the current SVG
    await connection.execute(
      'UPDATE promotional_campaigns SET image_url = ? WHERE id = ?',
      ['/public/images/promotions/free-delivery.svg', 3]
    );
    console.log('✅ Updated second campaign with free delivery SVG');
    
    // Show current campaigns
    console.log('\n=== CURRENT PROMOTIONAL CAMPAIGNS ===');
    const [campaigns] = await connection.execute(
      'SELECT id, title, image_url, promotion_type FROM promotional_campaigns ORDER BY id'
    );
    
    campaigns.forEach((campaign, index) => {
      console.log(`${index + 1}. ${campaign.title}`);
      console.log(`   Type: ${campaign.promotion_type}`);
      console.log(`   Image: ${campaign.image_url}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

updateSampleImages();