const mysql = require('mysql2/promise');

async function fixCampaignDates() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'add_physical_product',
    port: 3333
  });

  try {
    console.log('=== FIXING CAMPAIGN DATES ===');
    
    // Update the New Year campaign to be valid for the next 30 days
    const newValidUntil = new Date();
    newValidUntil.setDate(newValidUntil.getDate() + 30);
    
    const validFrom = new Date();
    validFrom.setDate(validFrom.getDate() - 1); // Started yesterday
    
    await connection.execute(`
      UPDATE promotional_campaigns 
      SET valid_from = ?, valid_until = ?
      WHERE title LIKE ?
    `, [
      validFrom.toISOString().slice(0, 19).replace('T', ' '),
      newValidUntil.toISOString().slice(0, 19).replace('T', ' '),
      '%New Year Special%'
    ]);
    
    console.log(`✅ Updated New Year campaigns - Valid until: ${newValidUntil.toDateString()}`);
    
    // Add Free Delivery campaign that was missing
    const freeDeliveryValidUntil = new Date();
    freeDeliveryValidUntil.setDate(freeDeliveryValidUntil.getDate() + 7); // Valid for next week
    
    try {
      await connection.execute(`
        INSERT INTO promotional_campaigns 
        (title, description, image_url, promotion_type, valid_from, valid_until, is_active, display_order) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'Free Delivery Weekend - No Charges!',
        'Enjoy free delivery on all orders above RWF 50,000 this weekend. No minimum quantity required.',
        '/public/images/promotions/free-delivery.svg',
        'Delivery Offer',
        validFrom.toISOString().slice(0, 19).replace('T', ' '),
        freeDeliveryValidUntil.toISOString().slice(0, 19).replace('T', ' '),
        1,
        1
      ]);
      console.log('✅ Added Free Delivery campaign');
    } catch (error) {
      console.log('ℹ️  Free Delivery campaign already exists or error:', error.message);
    }
    
    // Test the query again
    console.log('\n=== TESTING API QUERY AGAIN ===');
    const [result] = await connection.execute(`
      SELECT id, title, description, image_url, link, promotion_type, discount_percentage, valid_from, valid_until, created_at 
      FROM promotional_campaigns 
      WHERE is_active = TRUE 
      AND (valid_from IS NULL OR valid_from <= NOW()) 
      AND (valid_until IS NULL OR valid_until >= NOW()) 
      ORDER BY display_order ASC, created_at DESC
    `);
    
    console.log(`Found ${result.length} active campaigns:`);
    result.forEach((campaign, index) => {
      console.log(`${index + 1}. ${campaign.title}`);
      console.log(`   Valid from: ${campaign.valid_from}`);
      console.log(`   Valid until: ${campaign.valid_until}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

fixCampaignDates();