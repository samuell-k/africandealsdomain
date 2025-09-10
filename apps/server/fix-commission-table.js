const pool = require('./db');

async function fixCommissionTable() {
  try {
    console.log('Fixing commission settings table...');
    
    // Drop and recreate the table
    await pool.execute('DROP TABLE IF EXISTS commission_settings');
    console.log('✅ Dropped existing commission_settings table');
    
    // Create commission_settings table with proper structure
    await pool.execute(`
      CREATE TABLE commission_settings (
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
    console.log('✅ Commission settings table created successfully');
    
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
      `, [type, rate, desc]);
    }
    console.log('✅ Default commission settings inserted');
    
    // Display current settings
    const [settings] = await pool.execute('SELECT * FROM commission_settings ORDER BY setting_type');
    console.log('\n📋 Commission Settings:');
    settings.forEach(setting => {
      console.log(`  ${setting.setting_type}: ${(setting.commission_rate * 100).toFixed(2)}% - ${setting.description}`);
    });
    
    console.log('\n🎉 Commission settings table fixed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing commission table:', error);
  } finally {
    process.exit(0);
  }
}

fixCommissionTable();