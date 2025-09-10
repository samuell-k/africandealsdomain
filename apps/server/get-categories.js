const mysql = require('mysql2/promise');
require('dotenv').config();

async function getCategories() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'add_physical_product',
      port: process.env.DB_PORT || 3306
    });

    const [categories] = await connection.execute(`
      SELECT id, name, parent_id, description 
      FROM categories 
      ORDER BY parent_id, name
    `);

    console.log('📋 Categories in database:\n');
    
    // Group by parent categories
    const parentCategories = categories.filter(cat => !cat.parent_id);
    const childCategories = categories.filter(cat => cat.parent_id);

    parentCategories.forEach(parent => {
      console.log(`🏷️  ${parent.name} (ID: ${parent.id})`);
      const children = childCategories.filter(child => child.parent_id === parent.id);
      children.forEach(child => {
        console.log(`   └── ${child.name} (ID: ${child.id})`);
      });
      console.log('');
    });

    // Also show any orphaned categories
    const orphaned = childCategories.filter(child => 
      !parentCategories.find(parent => parent.id === child.parent_id)
    );
    
    if (orphaned.length > 0) {
      console.log('🔍 Other categories:');
      orphaned.forEach(cat => {
        console.log(`   • ${cat.name} (ID: ${cat.id}, Parent: ${cat.parent_id})`);
      });
    }

    await connection.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

getCategories();