const mysql = require('mysql2/promise');

async function cleanupDuplicateCampaigns() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'add_physical_product',
    port: 3333
  });

  try {
    console.log('=== CLEANING UP DUPLICATE CAMPAIGNS ===');
    
    // Keep the most recent New Year campaign and delete others
    const [campaigns] = await connection.execute(`
      SELECT id, title, created_at 
      FROM promotional_campaigns 
      WHERE title LIKE '%New Year Special%' 
      ORDER BY created_at DESC
    `);
    
    if (campaigns.length > 1) {
      console.log(`Found ${campaigns.length} duplicate New Year campaigns`);
      
      // Keep the first one (most recent) and delete the rest
      const keepId = campaigns[0].id;
      const deleteIds = campaigns.slice(1).map(c => c.id);
      
      for (const deleteId of deleteIds) {
        await connection.execute('DELETE FROM promotional_campaigns WHERE id = ?', [deleteId]);
        console.log(`✅ Deleted duplicate campaign with ID: ${deleteId}`);
      }
    }
    
    console.log('\n=== FINAL CAMPAIGN LIST ===');
    const [finalCampaigns] = await connection.execute(`
      SELECT id, title, promotion_type, valid_until 
      FROM promotional_campaigns 
      WHERE is_active = TRUE 
      ORDER BY display_order ASC, created_at DESC
    `);
    
    finalCampaigns.forEach((campaign, index) => {
      console.log(`${index + 1}. ${campaign.title} (${campaign.promotion_type}) - Valid until: ${campaign.valid_until}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

cleanupDuplicateCampaigns();