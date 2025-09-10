const pool = require('./db');

async function setupCommissionTable() {
  try {
    console.log('Setting up commission settings table...');
    
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
    
    // Insert default settings
    const defaultSettings = [
      ['fast_delivery_agent', 0.70, 'Fast delivery agents get 70% of the platform commission (20% of product price)'],
      ['pickup_delivery_agent', 0.60, 'Pickup delivery agents get 60% of the platform commission'],
      ['platform_commission', 0.21, 'Default platform commission rate (21% of product price)'],
      ['platform_maintenance', 0.01, 'Platform maintenance fee (1% of product price)']
    ];
    
    for (const [type, rate, desc] of defaultSettings) {
      await pool.execute(`
        INSERT INTO commission_settings (setting_type, commission_rate, description)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE 
        commission_rate = VALUES(commission_rate),
        description = VALUES(description),
        updated_at = CURRENT_TIMESTAMP
      `, [type, rate, desc]);
    }
    console.log('✅ Default commission settings inserted');
    
    // Check if products table has commission rate column
    try {
      const [columns] = await pool.query('SHOW COLUMNS FROM products LIKE "platform_commission_rate"');
      if (columns.length === 0) {
        await pool.execute(`
          ALTER TABLE products 
          ADD COLUMN platform_commission_rate DECIMAL(5,4) DEFAULT 0.21
        `);
        console.log('✅ Added platform_commission_rate column to products table');
      }
      
      // Update existing products with default commission rate
      await pool.execute(`
        UPDATE products 
        SET platform_commission_rate = 0.21 
        WHERE platform_commission_rate IS NULL OR platform_commission_rate = 0
      `);
      console.log('✅ Updated existing products with default commission rate');
      
    } catch (error) {
      console.log('⚠️ Could not update products table:', error.message);
    }
    
    // Display current settings
    const [settings] = await pool.execute('SELECT * FROM commission_settings ORDER BY setting_type');
    console.log('\n📋 Current Commission Settings:');
    settings.forEach(setting => {
      console.log(`  ${setting.setting_type}: ${(setting.commission_rate * 100).toFixed(2)}% - ${setting.description}`);
    });
    
    console.log('\n🎉 Commission settings setup completed!');
    
  } catch (error) {
    console.error('❌ Error setting up commission table:', error);
  } finally {
    process.exit(0);
  }
}

setupCommissionTable();