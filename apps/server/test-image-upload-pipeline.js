/**
 * Comprehensive Image Upload Pipeline Test
 * Tests the complete flow: Upload -> Database Save -> API Fetch -> Display
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function testImageUploadPipeline() {
  console.log('🧪 TESTING IMAGE UPLOAD PIPELINE\n');
  
  let connection;
  try {
    // Connect to database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'add_physical_product',
      port: process.env.DB_PORT || 3333
    });
    
    console.log('✅ Database connected successfully');
    
    // Test 1: Check if tables exist and have correct structure
    console.log('\n📊 TESTING DATABASE TABLES STRUCTURE:');
    
    try {
      const [partnersCols] = await connection.execute('DESCRIBE partners');
      console.log('✅ Partners table exists');
      console.log('   Columns:', partnersCols.map(col => `${col.Field} (${col.Type})`).join(', '));
      
      const hasLogoUrl = partnersCols.some(col => col.Field === 'logo_url');
      console.log('   logo_url column:', hasLogoUrl ? '✅ EXISTS' : '❌ MISSING');
    } catch (error) {
      console.log('❌ Partners table issue:', error.message);
    }
    
    try {
      const [servicesCols] = await connection.execute('DESCRIBE other_services');
      console.log('✅ Other services table exists');
      console.log('   Columns:', servicesCols.map(col => `${col.Field} (${col.Type})`).join(', '));
      
      const hasImageUrl = servicesCols.some(col => col.Field === 'image_url');
      console.log('   image_url column:', hasImageUrl ? '✅ EXISTS' : '❌ MISSING');
    } catch (error) {
      console.log('❌ Other services table issue:', error.message);
    }
    
    try {
      const [promotionsCols] = await connection.execute('DESCRIBE promotional_campaigns');
      console.log('✅ Promotional campaigns table exists');
      console.log('   Columns:', promotionsCols.map(col => `${col.Field} (${col.Type})`).join(', '));
      
      const hasImageUrl = promotionsCols.some(col => col.Field === 'image_url');
      console.log('   image_url column:', hasImageUrl ? '✅ EXISTS' : '❌ MISSING');
    } catch (error) {
      console.log('❌ Promotional campaigns table issue:', error.message);
    }
    
    // Test 2: Check current database content
    console.log('\n📋 CURRENT DATABASE CONTENT:');
    
    const [partners] = await connection.execute('SELECT id, name, logo_url FROM partners ORDER BY id');
    console.log('\nPartners:');
    partners.forEach(partner => {
      console.log(`  - ID ${partner.id}: ${partner.name}`);
      console.log(`    Logo URL: ${partner.logo_url || 'NULL'}`);
      if (partner.logo_url) {
        const fullPath = path.join(__dirname, partner.logo_url.replace('/uploads/', 'uploads/'));
        const exists = fs.existsSync(fullPath);
        console.log(`    File exists: ${exists ? '✅ YES' : '❌ NO'} (${fullPath})`);
      }
    });
    
    const [services] = await connection.execute('SELECT id, name, image_url, icon FROM other_services ORDER BY id');
    console.log('\nOther Services:');
    services.forEach(service => {
      console.log(`  - ID ${service.id}: ${service.name}`);
      console.log(`    Image URL: ${service.image_url || 'NULL'}`);
      console.log(`    Icon: ${service.icon || 'NULL'}`);
      if (service.image_url) {
        const fullPath = path.join(__dirname, service.image_url.replace('/uploads/', 'uploads/'));
        const exists = fs.existsSync(fullPath);
        console.log(`    File exists: ${exists ? '✅ YES' : '❌ NO'} (${fullPath})`);
      }
    });
    
    const [promotions] = await connection.execute('SELECT id, title, image_url FROM promotional_campaigns ORDER BY id');
    console.log('\nPromotional Campaigns:');
    promotions.forEach(promotion => {
      console.log(`  - ID ${promotion.id}: ${promotion.title}`);
      console.log(`    Image URL: ${promotion.image_url || 'NULL'}`);
      if (promotion.image_url) {
        const fullPath = path.join(__dirname, promotion.image_url.replace('/uploads/', 'uploads/'));
        const exists = fs.existsSync(fullPath);
        console.log(`    File exists: ${exists ? '✅ YES' : '❌ NO'} (${fullPath})`);
      }
    });
    
    // Test 3: Check file system structure
    console.log('\n📁 CHECKING FILE SYSTEM STRUCTURE:');
    
    const uploadsDir = path.join(__dirname, 'uploads');
    console.log(`Upload directory: ${uploadsDir}`);
    console.log(`Exists: ${fs.existsSync(uploadsDir) ? '✅ YES' : '❌ NO'}`);
    
    if (fs.existsSync(uploadsDir)) {
      const subdirs = ['partners-promotions', 'other-services', 'products'];
      subdirs.forEach(subdir => {
        const subdirPath = path.join(uploadsDir, subdir);
        const exists = fs.existsSync(subdirPath);
        console.log(`  ${subdir}/: ${exists ? '✅ EXISTS' : '❌ MISSING'}`);
        
        if (exists) {
          const files = fs.readdirSync(subdirPath);
          console.log(`    Files: ${files.length} (${files.slice(0, 3).join(', ')}${files.length > 3 ? '...' : ''})`);
        }
      });
    }
    
    console.log('\n🎯 PIPELINE ANALYSIS:');
    console.log('=====================');
    
    // Analyze upload/display discrepancies
    let issuesFound = 0;
    
    // Check partners
    partners.forEach(partner => {
      if (partner.logo_url) {
        const fullPath = path.join(__dirname, partner.logo_url.replace('/uploads/', 'uploads/'));
        if (!fs.existsSync(fullPath)) {
          console.log(`❌ BROKEN PARTNER LOGO: ${partner.name} -> ${partner.logo_url}`);
          console.log(`   Expected file: ${fullPath}`);
          issuesFound++;
        }
      }
    });
    
    // Check services
    services.forEach(service => {
      if (service.image_url) {
        const fullPath = path.join(__dirname, service.image_url.replace('/uploads/', 'uploads/'));
        if (!fs.existsSync(fullPath)) {
          console.log(`❌ BROKEN SERVICE IMAGE: ${service.name} -> ${service.image_url}`);
          console.log(`   Expected file: ${fullPath}`);
          issuesFound++;
        }
      }
    });
    
    // Check promotions
    promotions.forEach(promotion => {
      if (promotion.image_url) {
        const fullPath = path.join(__dirname, promotion.image_url.replace('/uploads/', 'uploads/'));
        if (!fs.existsSync(fullPath)) {
          console.log(`❌ BROKEN PROMOTION IMAGE: ${promotion.title} -> ${promotion.image_url}`);
          console.log(`   Expected file: ${fullPath}`);
          issuesFound++;
        }
      }
    });
    
    if (issuesFound === 0) {
      console.log('✅ NO BROKEN IMAGE PATHS FOUND');
    } else {
      console.log(`⚠️  Found ${issuesFound} broken image path(s)`);
    }
    
    console.log('\n💡 NEXT STEPS:');
    console.log('===============');
    if (issuesFound > 0) {
      console.log('1. Check multer upload configuration');
      console.log('2. Verify file upload destinations');
      console.log('3. Test actual file upload through admin interface');
      console.log('4. Check server static file serving configuration');
    } else {
      console.log('1. Test actual image upload through admin interface');
      console.log('2. Check browser developer tools for 404 errors');
      console.log('3. Verify frontend image URL processing');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n📝 Database connection closed');
    }
  }
}

// Run the test
testImageUploadPipeline().catch(console.error);