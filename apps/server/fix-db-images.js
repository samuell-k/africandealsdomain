const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixDatabaseImages() {
  console.log('🔧 Fixing database image paths...\n');
  
  let connection;
  try {
    // Connect to database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'african_deals_domain'
    });
    
    console.log('✅ Database connected');
    
    // Check current partners data
    console.log('\n📊 CURRENT PARTNERS DATA:');
    const [currentPartners] = await connection.execute('SELECT id, name, logo_url FROM partners');
    currentPartners.forEach(partner => {
      console.log(`  - ID ${partner.id}: ${partner.name} = ${partner.logo_url || 'NULL'}`);
    });
    
    // Update partners with proper image paths
    console.log('\n🔄 UPDATING PARTNERS...');
    
    // Update partners to use the existing sample image
    await connection.execute(`
      UPDATE partners 
      SET logo_url = '/uploads/partners-promotions/sample-promotion.svg'
      WHERE id IN (1, 2, 3)
    `);
    
    // Check current services data
    console.log('\n📊 CURRENT SERVICES DATA:');
    const [currentServices] = await connection.execute('SELECT id, name, image_url, icon FROM other_services');
    currentServices.forEach(service => {
      console.log(`  - ID ${service.id}: ${service.name} = image: ${service.image_url || 'NULL'}, icon: ${service.icon}`);
    });
    
    // Update services to use fallback or proper paths
    console.log('\n🔄 UPDATING SERVICES...');
    await connection.execute(`
      UPDATE other_services 
      SET image_url = NULL, icon = CASE 
        WHEN id = 1 THEN '💼'
        WHEN id = 2 THEN '📱'
        WHEN id = 3 THEN '🌐'
        WHEN id = 4 THEN '🎯'
        ELSE '🔗'
      END
      WHERE id IN (1, 2, 3, 4)
    `);
    
    // Check promotional campaigns
    console.log('\n📊 CURRENT PROMOTIONAL CAMPAIGNS:');
    const [currentPromotions] = await connection.execute('SELECT id, title, image_url FROM promotional_campaigns');
    currentPromotions.forEach(promotion => {
      console.log(`  - ID ${promotion.id}: ${promotion.title} = ${promotion.image_url || 'NULL'}`);
    });
    
    // Update promotional campaigns
    console.log('\n🔄 UPDATING PROMOTIONAL CAMPAIGNS...');
    await connection.execute(`
      UPDATE promotional_campaigns 
      SET image_url = '/uploads/partners-promotions/sample-promotion.svg'
      WHERE id = 1
    `);
    
    // Verify updates
    console.log('\n✅ VERIFICATION - UPDATED DATA:');
    
    const [updatedPartners] = await connection.execute('SELECT id, name, logo_url FROM partners');
    console.log('\nPartners:');
    updatedPartners.forEach(partner => {
      console.log(`  ✓ ${partner.name}: ${partner.logo_url}`);
    });
    
    const [updatedServices] = await connection.execute('SELECT id, name, image_url, icon FROM other_services');
    console.log('\nOther Services:');
    updatedServices.forEach(service => {
      console.log(`  ✓ ${service.name}: ${service.image_url || 'No image'} (icon: ${service.icon})`);
    });
    
    const [updatedPromotions] = await connection.execute('SELECT id, title, image_url FROM promotional_campaigns');
    console.log('\nPromotional Campaigns:');
    updatedPromotions.forEach(promotion => {
      console.log(`  ✓ ${promotion.title}: ${promotion.image_url}`);
    });
    
    console.log('\n🎉 Database image paths fixed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing database images:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('📝 Database connection closed');
    }
  }
}

// Run the fix
fixDatabaseImages();