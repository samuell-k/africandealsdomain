const mysql = require('mysql2/promise');
require('dotenv').config();

async function insertSampleData() {
  console.log('🚀 Inserting/Updating sample data with proper image paths...\n');
  
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
    
    // Insert/Update Partners with proper image paths
    console.log('\n🤝 INSERTING/UPDATING PARTNERS...');
    
    const partnersData = [
      {
        name: 'AC Group Rwanda',
        description: 'Leading technology and business solutions provider in East Africa',
        logo_url: '/public/images/partners/ac-group-logo.svg',
        link: 'https://acgroup.rw'
      },
      {
        name: 'Bank of Kigali',
        description: 'Premier financial services institution providing comprehensive banking solutions',
        logo_url: '/public/images/partners/bok-logo.svg', 
        link: 'https://bok.rw'
      },
      {
        name: 'MTN Rwanda',
        description: 'Leading telecommunications provider offering mobile and digital services',
        logo_url: '/public/images/partners/mtn-logo.svg',
        link: 'https://mtn.rw'
      }
    ];
    
    for (let i = 0; i < partnersData.length; i++) {
      const partner = partnersData[i];
      await connection.execute(`
        INSERT INTO partners (id, name, description, logo_url, link, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE 
        name = VALUES(name),
        description = VALUES(description),
        logo_url = VALUES(logo_url),
        link = VALUES(link),
        updated_at = NOW()
      `, [i + 1, partner.name, partner.description, partner.logo_url, partner.link]);
      
      console.log(`  ✓ ${partner.name}`);
    }
    
    // Insert/Update Other Services
    console.log('\n🛠️ INSERTING/UPDATING OTHER SERVICES...');
    
    const servicesData = [
      {
        name: 'Business Consulting',
        description: 'Professional business advisory and strategic planning services',
        icon: '💼',
        image_url: null,
        link: '/services/consulting'
      },
      {
        name: 'Digital Marketing',
        description: 'Comprehensive digital marketing and social media management',
        icon: '📱',
        image_url: null,
        link: '/services/marketing'
      },
      {
        name: 'Web Development',
        description: 'Custom website and application development services',
        icon: '🌐',
        image_url: null,
        link: '/services/web-development'
      },
      {
        name: 'Financial Services',
        description: 'Investment planning, loans, and financial advisory services',
        icon: '💰',
        image_url: null,
        link: '/services/financial'
      }
    ];
    
    for (let i = 0; i < servicesData.length; i++) {
      const service = servicesData[i];
      await connection.execute(`
        INSERT INTO other_services (id, name, description, icon, image_url, link, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE 
        name = VALUES(name),
        description = VALUES(description),
        icon = VALUES(icon),
        image_url = VALUES(image_url),
        link = VALUES(link),
        updated_at = NOW()
      `, [i + 1, service.name, service.description, service.icon, service.image_url, service.link]);
      
      console.log(`  ✓ ${service.name}`);
    }
    
    // Insert/Update Promotional Campaigns
    console.log('\n🎯 INSERTING/UPDATING PROMOTIONAL CAMPAIGNS...');
    
    const promotionsData = [
      {
        title: 'New Year Electronics Sale',
        description: 'Get amazing discounts on the latest electronics this New Year! Up to 50% off on smartphones, laptops, and home appliances.',
        image_url: '/public/images/promotions/new-year-electronics.svg',
        promotion_type: 'Sale',
        discount_percentage: 50,
        valid_until: '2024-02-15',
        link: '/promotions/new-year-electronics'
      },
      {
        title: 'Free Delivery Campaign',
        description: 'Enjoy free delivery on all orders above $50. Fast, reliable, and secure delivery to your doorstep.',
        image_url: '/public/images/promotions/free-delivery.svg',
        promotion_type: 'Free Delivery',
        discount_percentage: null,
        valid_until: '2024-03-31',
        link: '/promotions/free-delivery'
      }
    ];
    
    for (let i = 0; i < promotionsData.length; i++) {
      const promotion = promotionsData[i];
      await connection.execute(`
        INSERT INTO promotional_campaigns (id, title, description, image_url, promotion_type, discount_percentage, valid_until, link, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE 
        title = VALUES(title),
        description = VALUES(description),
        image_url = VALUES(image_url),
        promotion_type = VALUES(promotion_type),
        discount_percentage = VALUES(discount_percentage),
        valid_until = VALUES(valid_until),
        link = VALUES(link),
        updated_at = NOW()
      `, [i + 1, promotion.title, promotion.description, promotion.image_url, 
          promotion.promotion_type, promotion.discount_percentage, promotion.valid_until, promotion.link]);
      
      console.log(`  ✓ ${promotion.title}`);
    }
    
    // Verify the data
    console.log('\n✅ VERIFICATION - FINAL DATA:');
    
    const [partners] = await connection.execute('SELECT id, name, logo_url FROM partners ORDER BY id');
    console.log('\nPartners:');
    partners.forEach(partner => {
      console.log(`  ✓ ${partner.name}: ${partner.logo_url}`);
    });
    
    const [services] = await connection.execute('SELECT id, name, icon, image_url FROM other_services ORDER BY id');
    console.log('\nOther Services:');
    services.forEach(service => {
      console.log(`  ✓ ${service.name}: ${service.image_url || 'Using icon: ' + service.icon}`);
    });
    
    const [promotions] = await connection.execute('SELECT id, title, image_url FROM promotional_campaigns ORDER BY id');
    console.log('\nPromotional Campaigns:');
    promotions.forEach(promotion => {
      console.log(`  ✓ ${promotion.title}: ${promotion.image_url}`);
    });
    
    console.log('\n🎉 Sample data inserted/updated successfully!');
    console.log('📱 You can now test the website with proper images');
    
  } catch (error) {
    console.error('❌ Error inserting sample data:', error.message);
    if (error.code === 'ER_NO_SUCH_TABLE') {
      console.log('💡 Tip: Run the database setup scripts first to create the tables');
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('📝 Database connection closed');
    }
  }
}

// Run the data insertion
insertSampleData();