const mysql = require('mysql2/promise');

async function fixPromotionsTable() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'add_physical_product',
    port: 3333
  });

  try {
    // Drop the table we just created (it conflicts with existing promotions table)
    console.log('Dropping conflicting table...');
    await connection.execute('DROP TABLE IF EXISTS promotions');
    
    // Create the promotional_campaigns table instead
    console.log('Creating promotional_campaigns table...');
    const promotionalCampaignsSQL = `
      CREATE TABLE IF NOT EXISTS promotional_campaigns (
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

    await connection.execute(promotionalCampaignsSQL);
    console.log('✅ Promotional campaigns table created successfully');

    // Insert sample data
    console.log('Inserting sample promotional campaigns...');
    const sampleCampaigns = [
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

    for (const campaign of sampleCampaigns) {
      try {
        await connection.execute(
          'INSERT IGNORE INTO promotional_campaigns (title, description, image_url, link, promotion_type, discount_percentage, valid_until) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [campaign.title, campaign.description, campaign.image_url, campaign.link, campaign.promotion_type, campaign.discount_percentage, campaign.valid_until]
        );
        console.log(`✅ Added campaign: ${campaign.title}`);
      } catch (error) {
        console.log(`⚠️  Campaign ${campaign.title} already exists or error occurred`);
      }
    }

    console.log('🎉 Promotional campaigns setup completed successfully!');

  } catch (error) {
    console.error('❌ Error fixing promotions table:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

fixPromotionsTable()
  .then(() => {
    console.log('✅ Setup completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  });