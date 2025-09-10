const mysql = require('mysql2/promise');

async function setupPartnersPromotionsDatabase() {
  let connection;
  
  try {
    console.log('🔌 Setting up Partners & Promotions database tables...');
    
    // Create connection
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'add_physical_product',
      port: 3333
    });

    console.log('✅ Connected to database');

    // Partners table
    const partnersTableSQL = `
      CREATE TABLE IF NOT EXISTS partners (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        logo_url VARCHAR(500),
        link VARCHAR(500) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        display_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_by INT,
        INDEX idx_active (is_active),
        INDEX idx_display_order (display_order),
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `;

    // Promotions table
    const promotionsTableSQL = `
      CREATE TABLE IF NOT EXISTS promotions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        image_url VARCHAR(500),
        link VARCHAR(500),
        promotion_type VARCHAR(100) DEFAULT 'Special Offer',
        discount_percentage DECIMAL(5,2),
        valid_from DATETIME,
        valid_until DATETIME,
        is_active BOOLEAN DEFAULT TRUE,
        display_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_by INT,
        INDEX idx_active (is_active),
        INDEX idx_display_order (display_order),
        INDEX idx_valid_dates (valid_from, valid_until),
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `;

    // Other Services table
    const servicesTableSQL = `
      CREATE TABLE IF NOT EXISTS other_services (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        icon VARCHAR(100),
        link VARCHAR(500) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        display_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_by INT,
        INDEX idx_active (is_active),
        INDEX idx_display_order (display_order),
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `;

    // Execute table creation
    console.log('📝 Creating partners table...');
    await connection.execute(partnersTableSQL);
    console.log('✅ Partners table created successfully');

    console.log('📝 Creating promotions table...');
    await connection.execute(promotionsTableSQL);
    console.log('✅ Promotions table created successfully');

    console.log('📝 Creating other_services table...');
    await connection.execute(servicesTableSQL);
    console.log('✅ Other services table created successfully');

    // Insert sample data
    console.log('📝 Inserting sample data...');

    // Sample partners
    const samplePartners = [
      {
        name: 'MTN Rwanda',
        description: 'Leading mobile network operator in Rwanda providing mobile money services, data, and voice solutions.',
        logo_url: '/public/images/partners/mtn-logo.png',
        link: 'https://www.mtn.rw'
      },
      {
        name: 'Bank of Kigali',
        description: 'Premier financial institution offering comprehensive banking and payment solutions across East Africa.',
        logo_url: '/public/images/partners/bok-logo.png',
        link: 'https://www.bk.rw'
      },
      {
        name: 'AC Group',
        description: 'Leading logistics and delivery service provider ensuring fast and secure delivery across Rwanda.',
        logo_url: '/public/images/partners/ac-group-logo.png',
        link: 'https://www.acgroup.rw'
      }
    ];

    for (const partner of samplePartners) {
      try {
        await connection.execute(
          'INSERT IGNORE INTO partners (name, description, logo_url, link) VALUES (?, ?, ?, ?)',
          [partner.name, partner.description, partner.logo_url, partner.link]
        );
        console.log(`✅ Added partner: ${partner.name}`);
      } catch (error) {
        console.log(`⚠️  Partner ${partner.name} already exists or error occurred`);
      }
    }

    // Sample promotions
    const samplePromotions = [
      {
        title: 'New Year Special - 50% Off All Electronics',
        description: 'Kick off the new year with amazing deals on all electronic items. Limited time offer with free delivery across Rwanda.',
        image_url: '/public/images/promotions/new-year-electronics.jpg',
        link: '/public/index.html?category=electronics',
        promotion_type: 'Seasonal Sale',
        discount_percentage: 50.00,
        valid_until: '2025-01-31 23:59:59'
      },
      {
        title: 'Free Delivery Weekend',
        description: 'Enjoy free delivery on all orders above RWF 50,000 this weekend. No minimum quantity required.',
        image_url: '/public/images/promotions/free-delivery.jpg',
        promotion_type: 'Delivery Offer',
        valid_until: '2025-02-02 23:59:59'
      }
    ];

    for (const promotion of samplePromotions) {
      try {
        await connection.execute(
          'INSERT IGNORE INTO promotions (title, description, image_url, link, promotion_type, discount_percentage, valid_until) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [promotion.title, promotion.description, promotion.image_url, promotion.link, promotion.promotion_type, promotion.discount_percentage, promotion.valid_until]
        );
        console.log(`✅ Added promotion: ${promotion.title}`);
      } catch (error) {
        console.log(`⚠️  Promotion ${promotion.title} already exists or error occurred`);
      }
    }

    // Sample other services
    const sampleServices = [
      {
        name: 'Mobile Money Integration',
        description: 'Seamless mobile money payments with MTN Mobile Money and Airtel Money',
        icon: '📱',
        link: '/public/mobile-money.html'
      },
      {
        name: 'Express Delivery',
        description: 'Same-day delivery within Kigali and next-day delivery nationwide',
        icon: '🚀',
        link: '/public/express-delivery.html'
      },
      {
        name: 'Business Solutions',
        description: 'Bulk ordering and B2B solutions for businesses and organizations',
        icon: '🏢',
        link: '/public/business-solutions.html'
      },
      {
        name: 'Customer Support',
        description: '24/7 customer support via WhatsApp, phone, and live chat',
        icon: '🎧',
        link: '/public/customer-support.html'
      }
    ];

    for (const service of sampleServices) {
      try {
        await connection.execute(
          'INSERT IGNORE INTO other_services (name, description, icon, link) VALUES (?, ?, ?, ?)',
          [service.name, service.description, service.icon, service.link]
        );
        console.log(`✅ Added service: ${service.name}`);
      } catch (error) {
        console.log(`⚠️  Service ${service.name} already exists or error occurred`);
      }
    }

    console.log('🎉 Partners & Promotions database setup completed successfully!');

  } catch (error) {
    console.error('❌ Error setting up Partners & Promotions database:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run if executed directly
if (require.main === module) {
  setupPartnersPromotionsDatabase()
    .then(() => {
      console.log('✅ Setup completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Setup failed:', error);
      process.exit(1);
    });
}

module.exports = setupPartnersPromotionsDatabase;