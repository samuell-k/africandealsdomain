/**
 * Setup Commission Settings Table and Default Values
 */

const pool = require('./db');

async function setupCommissionSettings() {
  try {

    console.log('📊 Setting up commission settings...');

    // Create commission_settings table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS commission_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        setting_type VARCHAR(50) NOT NULL UNIQUE,
        commission_rate DECIMAL(5,4) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_setting_type (setting_type),
        INDEX idx_active (is_active)
      )
    `);
    console.log('✅ Commission settings table created');

    // Insert default commission settings
    const defaultSettings = [
      {
        setting_type: 'fast_delivery_agent',
        commission_rate: 0.70, // 70% of platform commission
        description: 'Fast delivery agents get 70% of the platform commission (20% of product price)'
      },
      {
        setting_type: 'pickup_delivery_agent',
        commission_rate: 0.60, // 60% of platform commission
        description: 'Pickup delivery agents get 60% of the platform commission'
      },
      {
        setting_type: 'platform_commission',
        commission_rate: 0.21, // 21% of product price
        description: 'Default platform commission rate (21% of product price)'
      },
      {
        setting_type: 'platform_maintenance',
        commission_rate: 0.01, // 1% of product price
        description: 'Platform maintenance fee (1% of product price)'
      }
    ];

    for (const setting of defaultSettings) {
      await pool.execute(`
        INSERT INTO commission_settings (setting_type, commission_rate, description)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
        commission_rate = VALUES(commission_rate),
        description = VALUES(description),
        updated_at = CURRENT_TIMESTAMP
      `, [setting.setting_type, setting.commission_rate, setting.description]);
    }

    console.log('✅ Default commission settings inserted');

    // Add agent_commission column to orders table if it doesn't exist
    try {
      await pool.execute(`
        ALTER TABLE orders 
        ADD COLUMN agent_commission DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN platform_commission DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN delivery_code VARCHAR(10),
        ADD COLUMN agent_id INT,
        ADD COLUMN agent_assigned_at TIMESTAMP NULL,
        ADD COLUMN delivery_type ENUM('standard', 'fast_delivery', 'pickup') DEFAULT 'standard'
      `);
      console.log('✅ Orders table updated with commission columns');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ Commission columns already exist in orders table');
      } else {
        console.warn('⚠️ Could not add commission columns:', error.message);
      }
    }

    // Add platform_commission_rate column to products table if it doesn't exist
    try {
      await pool.execute(`
        ALTER TABLE products 
        ADD COLUMN platform_commission_rate DECIMAL(5,4) DEFAULT 0.21
      `);
      console.log('✅ Products table updated with commission rate column');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ Platform commission rate column already exists in products table');
      } else {
        console.warn('⚠️ Could not add platform commission rate column:', error.message);
      }
    }

    // Update existing products with default commission rate
    await pool.execute(`
      UPDATE products 
      SET platform_commission_rate = 0.21 
      WHERE platform_commission_rate IS NULL OR platform_commission_rate = 0
    `);
    console.log('✅ Updated existing products with default commission rate');

    console.log('🎉 Commission settings setup completed successfully!');

    // Display current settings
    const [settings] = await pool.execute('SELECT * FROM commission_settings ORDER BY setting_type');
    console.log('\n📋 Current Commission Settings:');
    settings.forEach(setting => {
      console.log(`  ${setting.setting_type}: ${(setting.commission_rate * 100).toFixed(2)}% - ${setting.description}`);
    });

  } catch (error) {
    console.error('❌ Error setting up commission settings:', error);
    throw error;
  }
}

// Run the setup
if (require.main === module) {
  setupCommissionSettings()
    .then(() => {
      console.log('\n✅ Commission settings setup completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Setup failed:', error);
      process.exit(1);
    });
}

module.exports = setupCommissionSettings;