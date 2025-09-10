const mysql = require('mysql2/promise');

async function updatePromotionImages() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'add_physical_product',
    port: 3333
  });

  try {
    console.log('Updating promotional campaign images to use SVG files...');
    
    // Update New Year campaign image
    await connection.execute(
      'UPDATE promotional_campaigns SET image_url = ? WHERE title LIKE ?',
      ['/public/images/promotions/new-year-electronics.svg', '%New Year Special%']
    );
    console.log('✅ Updated New Year campaign image');
    
    // Update Free Delivery campaign image
    await connection.execute(
      'UPDATE promotional_campaigns SET image_url = ? WHERE title LIKE ?',
      ['/public/images/promotions/free-delivery.svg', '%Free Delivery%']
    );
    console.log('✅ Updated Free Delivery campaign image');
    
    console.log('🎉 All promotional campaign images updated successfully!');

  } catch (error) {
    console.error('❌ Error updating promotional campaign images:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

updatePromotionImages()
  .then(() => {
    console.log('✅ Promotional image update completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Promotional image update failed:', error);
    process.exit(1);
  });