const db = require('./db.js');

async function fixSystemLogs() {
  try {
    console.log('🔧 Fixing system_logs table...');
    
    // Check if level column exists
    try {
      await db.execute('SELECT level FROM system_logs LIMIT 1');
      console.log('✅ level column already exists');
    } catch (error) {
      if (error.code === 'ER_BAD_FIELD_ERROR') {
        console.log('➕ Adding level column...');
        await db.execute('ALTER TABLE system_logs ADD COLUMN level ENUM("info", "warning", "error", "debug") DEFAULT "info"');
        console.log('✅ level column added');
      } else {
        throw error;
      }
    }
    
    // Check if details column exists
    try {
      await db.execute('SELECT details FROM system_logs LIMIT 1');
      console.log('✅ details column already exists');
    } catch (error) {
      if (error.code === 'ER_BAD_FIELD_ERROR') {
        console.log('➕ Adding details column...');
        await db.execute('ALTER TABLE system_logs ADD COLUMN details JSON');
        console.log('✅ details column added');
      } else {
        throw error;
      }
    }
    
    // Add indexes if they don't exist
    try {
      await db.execute('CREATE INDEX idx_level ON system_logs(level)');
      console.log('✅ level index created');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('✅ level index already exists');
      } else {
        throw error;
      }
    }
    
    try {
      await db.execute('CREATE INDEX idx_created ON system_logs(created_at)');
      console.log('✅ created_at index created');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('✅ created_at index already exists');
      } else {
        throw error;
      }
    }
    
    console.log('🎉 System logs table fixed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing system logs:', error);
  } finally {
    process.exit();
  }
}

fixSystemLogs(); 