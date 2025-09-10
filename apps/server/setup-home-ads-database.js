/**
 * Database Setup Script for Home Background Ads
 * Creates tables and inserts default data
 */
const db = require('./database');

async function setupHomeAdsDatabase() {
  try {
    console.log('🔧 Setting up Home Ads Database...');

    // Create home_ads table
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS home_ads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        subtitle TEXT,
        description TEXT,
        type ENUM('default', 'image', 'slideshow', 'video') NOT NULL DEFAULT 'default',
        content VARCHAR(500),
        is_active BOOLEAN DEFAULT TRUE,
        stats_active_sellers INT DEFAULT 500,
        stats_products INT DEFAULT 10000,
        stats_happy_customers INT DEFAULT 50000,
        stats_countries INT DEFAULT 7,
        button_text VARCHAR(100) DEFAULT 'Explore Products',
        button_link VARCHAR(500) DEFAULT '#discover',
        secondary_button_text VARCHAR(100) DEFAULT 'Join Free Today',
        secondary_button_link VARCHAR(500) DEFAULT '/auth/auth-buyer.html',
        background_color TEXT DEFAULT 'linear-gradient(135deg, #0e2038 0%, #23325c 50%, #1e3a8a 100%)',
        overlay_color VARCHAR(100) DEFAULT 'rgba(14, 32, 56, 0.1)',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_type (type),
        INDEX idx_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await db.execute(createTableQuery);
    console.log('✅ Home ads table created/verified');

    // Create settings table for active ad tracking
    const createSettingsQuery = `
      CREATE TABLE IF NOT EXISTS home_ads_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value VARCHAR(500),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await db.execute(createSettingsQuery);
    console.log('✅ Home ads settings table created/verified');

    // Check if default data exists
    const [existingAds] = await db.execute('SELECT COUNT(*) as count FROM home_ads');
    
    if (existingAds[0].count === 0) {
      console.log('📝 Inserting default home ads...');

      // Insert default home ads
      const defaultAds = [
        {
          title: 'Discover Amazing Products',
          subtitle: 'Connect with trusted African sellers and discover unique products from across the continent.',
          description: 'Secure payments • Fast delivery • 24/7 support',
          type: 'default',
          content: null,
          is_active: 1,
          stats_active_sellers: 500,
          stats_products: 10000,
          stats_happy_customers: 50000,
          stats_countries: 7,
          button_text: 'Explore Products',
          button_link: '#discover',
          secondary_button_text: 'Join Free Today',
          secondary_button_link: '/auth/auth-buyer.html',
          background_color: 'linear-gradient(135deg, #0e2038 0%, #23325c 50%, #1e3a8a 100%)',
          overlay_color: 'rgba(14, 32, 56, 0.1)'
        },
        {
          title: 'Amazing Video Background',
          subtitle: 'Experience our stunning video background',
          description: 'Dynamic video content • Professional quality • Perfect experience',
          type: 'video',
          content: 'home-ad-1757074538096-288410183.mp4',
          is_active: 1,
          stats_active_sellers: 650,
          stats_products: 15000,
          stats_happy_customers: 75000,
          stats_countries: 10,
          button_text: 'Watch & Explore',
          button_link: '#discover',
          secondary_button_text: 'Join Free Today',
          secondary_button_link: '/auth/auth-buyer.html',
          background_color: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          overlay_color: 'rgba(20, 30, 50, 0.6)'
        }
      ];

      const insertQuery = `
        INSERT INTO home_ads (
          title, subtitle, description, type, content, is_active,
          stats_active_sellers, stats_products, stats_happy_customers, stats_countries,
          button_text, button_link, secondary_button_text, secondary_button_link,
          background_color, overlay_color
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      for (const ad of defaultAds) {
        await db.execute(insertQuery, [
          ad.title, ad.subtitle, ad.description, ad.type, ad.content, ad.is_active,
          ad.stats_active_sellers, ad.stats_products, ad.stats_happy_customers, ad.stats_countries,
          ad.button_text, ad.button_link, ad.secondary_button_text, ad.secondary_button_link,
          ad.background_color, ad.overlay_color
        ]);
      }

      console.log('✅ Default home ads inserted');
    } else {
      console.log('ℹ️  Home ads already exist, skipping default data insertion');
    }

    // Set default active ad
    const [activeSetting] = await db.execute(
      'SELECT setting_value FROM home_ads_settings WHERE setting_key = ?',
      ['active_ad_id']
    );

    if (activeSetting.length === 0) {
      // Set first ad as active by default
      const [firstAd] = await db.execute(
        'SELECT id FROM home_ads WHERE is_active = 1 ORDER BY id ASC LIMIT 1'
      );
      
      if (firstAd.length > 0) {
        await db.execute(
          'INSERT INTO home_ads_settings (setting_key, setting_value) VALUES (?, ?)',
          ['active_ad_id', firstAd[0].id.toString()]
        );
        console.log(`✅ Set active ad ID to ${firstAd[0].id}`);
      }
    }

    // Verify setup
    const [allAds] = await db.execute('SELECT id, title, type, content FROM home_ads');
    const [activeAdSetting] = await db.execute(
      'SELECT setting_value FROM home_ads_settings WHERE setting_key = ?',
      ['active_ad_id']
    );

    console.log('\n📊 Home Ads Database Setup Complete!');
    console.log('════════════════════════════════════');
    console.log(`Total Ads: ${allAds.length}`);
    console.log(`Active Ad ID: ${activeAdSetting[0]?.setting_value || 'Not set'}`);
    console.log('\nAds in Database:');
    allAds.forEach(ad => {
      console.log(`  - ID ${ad.id}: ${ad.title} (${ad.type})`);
      if (ad.content) {
        console.log(`    Content: ${ad.content}`);
      }
    });

    console.log('\n🚀 Database ready for Home Background Ads system!');

  } catch (error) {
    console.error('❌ Error setting up home ads database:', error);
    throw error;
  }
}

// Helper function to check if video file exists
async function checkVideoFile() {
  const fs = require('fs');
  const path = require('path');
  
  const videoPath = path.join(__dirname, 'uploads/home-ads/home-ad-1757074538096-288410183.mp4');
  
  if (fs.existsSync(videoPath)) {
    console.log('✅ Video file exists: home-ad-1757074538096-288410183.mp4');
  } else {
    console.log('⚠️  Video file not found. Please ensure video file is in uploads/home-ads/');
  }
}

// Run setup if called directly
if (require.main === module) {
  setupHomeAdsDatabase()
    .then(() => {
      checkVideoFile();
      console.log('\n✅ Setup completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Setup failed:', error);
      process.exit(1);
    });
}

module.exports = { setupHomeAdsDatabase };