const db = require('./db.js');

async function fixAdminDatabase() {
  try {
    console.log('🔧 Fixing admin database issues...');
    
    // 1. Add reviews table
    console.log('📝 Creating reviews table...');
    await db.execute(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        product_id INT NOT NULL,
        rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_product (user_id, product_id),
        INDEX idx_user (user_id),
        INDEX idx_product (product_id),
        INDEX idx_rating (rating),
        INDEX idx_created (created_at)
      )
    `);
    console.log('✅ Reviews table created/verified');
    
    // 2. Add is_verified column to users table if it doesn't exist
    console.log('🔍 Checking for is_verified column...');
    try {
      await db.execute('SELECT is_verified FROM users LIMIT 1');
      console.log('✅ is_verified column already exists');
    } catch (error) {
      if (error.code === 'ER_BAD_FIELD_ERROR') {
        console.log('➕ Adding is_verified column to users table...');
        await db.execute('ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT TRUE');
        console.log('✅ is_verified column added');
      } else {
        throw error;
      }
    }
    
    // 3. Add system_logs table
    console.log('📊 Creating system_logs table...');
    await db.execute(`
      CREATE TABLE IF NOT EXISTS system_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        level ENUM('info', 'warning', 'error', 'debug') DEFAULT 'info',
        message TEXT NOT NULL,
        details JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_level (level),
        INDEX idx_created (created_at)
      )
    `);
    console.log('✅ System logs table created/verified');
    
    // 4. Add sample data for testing
    console.log('📦 Adding sample data...');
    
    // Check existing users and products
    const [users] = await db.execute('SELECT id FROM users ORDER BY id LIMIT 5');
    const [products] = await db.execute('SELECT id FROM products ORDER BY id LIMIT 5');
    
    console.log(`Found ${users.length} users and ${products.length} products`);
    
    // Add sample reviews if none exist and we have users/products
    const [reviewCount] = await db.execute('SELECT COUNT(*) as count FROM reviews');
    if (reviewCount[0].count === 0 && users.length > 0 && products.length > 0) {
      console.log('➕ Adding sample reviews...');
      
      const sampleReviews = [];
      for (let i = 0; i < Math.min(users.length, products.length, 4); i++) {
        const userId = users[i].id;
        const productId = products[i].id;
        const rating = Math.floor(Math.random() * 3) + 3; // 3-5 stars
        const comments = [
          'Excellent product! Very satisfied with the quality.',
          'Good product, fast delivery.',
          'Amazing quality, highly recommended!',
          'Great product, good value for money.'
        ];
        
        sampleReviews.push(`(${userId}, ${productId}, ${rating}, '${comments[i]}')`);
      }
      
      if (sampleReviews.length > 0) {
        await db.execute(`
          INSERT INTO reviews (user_id, product_id, rating, comment) VALUES
          ${sampleReviews.join(', ')}
        `);
        console.log('✅ Sample reviews added');
      }
    }
    
    // Add sample system logs
    const [logCount] = await db.execute('SELECT COUNT(*) as count FROM system_logs');
    if (logCount[0].count === 0) {
      console.log('➕ Adding sample system logs...');
      await db.execute(`
        INSERT INTO system_logs (level, message, details) VALUES
        ('info', 'Admin user logged in', '{"user_id": 5, "email": "africandealsdomain@gmail.com"}'),
        ('info', 'New order created', '{"order_id": 10, "user_id": 3, "amount": 3750}'),
        ('warning', 'Low stock alert', '{"product_id": 1, "current_stock": 5}'),
        ('info', 'New user registered', '{"user_id": 6, "role": "buyer"}')
      `);
      console.log('✅ Sample system logs added');
    }
    
    // 5. Update existing users to have is_verified = true
    console.log('✅ Updating existing users verification status...');
    await db.execute('UPDATE users SET is_verified = TRUE WHERE is_verified IS NULL');
    
    console.log('\n🎉 Admin database issues fixed successfully!');
    console.log('📋 Summary:');
    console.log('- ✅ Reviews table created/verified');
    console.log('- ✅ is_verified column added to users');
    console.log('- ✅ System logs table created/verified');
    console.log('- ✅ Sample data added for testing');
    
  } catch (error) {
    console.error('❌ Error fixing admin database:', error);
  } finally {
    process.exit();
  }
}

fixAdminDatabase(); 