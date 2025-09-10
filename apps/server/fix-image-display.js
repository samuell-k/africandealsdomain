const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'african_deals_domain'
};

async function fixImageDisplay() {
  console.log('🔧 Starting Image Display Fix Process...\n');
  
  let connection;
  try {
    // Connect to database
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Database connected successfully');
    
    // Fix Partners Images
    console.log('\n📋 FIXING PARTNERS IMAGES...');
    
    // Update partners to use existing sample images and correct paths
    const updatePartnersSQL = `
      UPDATE partners 
      SET logo_url = CASE 
        WHEN id = 1 THEN '/uploads/partners-promotions/sample-promotion.svg'
        WHEN id = 2 THEN '/public/images/partners/bok-logo.svg'
        WHEN id = 3 THEN '/public/images/partners/ac-group-logo.svg'
        ELSE logo_url
      END
      WHERE id IN (1, 2, 3)
    `;
    
    await connection.execute(updatePartnersSQL);
    console.log('✅ Partners image paths updated');
    
    // Fix Other Services Images
    console.log('\n📋 FIXING OTHER SERVICES IMAGES...');
    
    // Update services to have proper fallback handling
    const updateServicesSQL = `
      UPDATE other_services 
      SET image_url = CASE 
        WHEN id = 1 THEN '/uploads/partners-promotions/sample-promotion.svg'
        ELSE NULL
      END
      WHERE id IN (1, 2, 3, 4)
    `;
    
    await connection.execute(updateServicesSQL);
    console.log('✅ Other services image paths updated');
    
    // Fix Promotional Campaigns
    console.log('\n📋 FIXING PROMOTIONAL CAMPAIGNS IMAGES...');
    
    const updatePromotionsSQL = `
      UPDATE promotional_campaigns 
      SET image_url = '/uploads/partners-promotions/sample-promotion.svg'
      WHERE id = 1
    `;
    
    await connection.execute(updatePromotionsSQL);
    console.log('✅ Promotional campaigns image paths updated');
    
    // Verify the updates
    console.log('\n📊 VERIFYING UPDATES...');
    
    const [partners] = await connection.execute('SELECT id, name, logo_url FROM partners');
    console.log('Partners:');
    partners.forEach(partner => {
      console.log(`  - ${partner.name}: ${partner.logo_url}`);
    });
    
    const [services] = await connection.execute('SELECT id, name, image_url, icon FROM other_services');
    console.log('\nOther Services:');
    services.forEach(service => {
      console.log(`  - ${service.name}: ${service.image_url || 'No image (using icon: ' + service.icon + ')'}`);
    });
    
    const [promotions] = await connection.execute('SELECT id, title, image_url FROM promotional_campaigns');
    console.log('\nPromotional Campaigns:');
    promotions.forEach(promotion => {
      console.log(`  - ${promotion.title}: ${promotion.image_url}`);
    });
    
  } catch (error) {
    console.error('❌ Error fixing image display:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('📝 Database connection closed');
    }
  }
}

// Enhanced frontend image handling function
function generateImageHandlingScript() {
  const script = `
/**
 * Enhanced Image URL Processing Function
 * Handles image paths for partners, services, and promotions
 */
function processImageUrl(imageUrl, type = 'general') {
  if (!imageUrl) return null;
  
  // If already a complete URL, return as is
  if (imageUrl.startsWith('http')) {
    return imageUrl;
  }
  
  // If starts with /, make it relative to server
  if (imageUrl.startsWith('/')) {
    return imageUrl;
  }
  
  // Otherwise, assume it's a relative path and prepend /uploads/
  return '/uploads/' + imageUrl;
}

/**
 * Image Error Handler - Shows fallback when image fails to load
 */
function handleImageError(imgElement, fallbackType, name) {
  imgElement.style.display = 'none';
  
  // Create fallback element
  const fallback = document.createElement('div');
  fallback.className = imgElement.className.replace(/w-\\d+|h-\\d+/g, '') + 
    ' bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center';
  
  switch(fallbackType) {
    case 'partner':
      fallback.innerHTML = \`<span class="text-white font-bold text-lg">\${name.charAt(0)}</span>\`;
      break;
    case 'service':
      fallback.innerHTML = \`<span class="text-white text-2xl">🔗</span>\`;
      break;
    case 'promotion':
      fallback.innerHTML = \`<span class="text-white text-2xl">🎯</span>\`;
      break;
    default:
      fallback.innerHTML = \`<span class="text-white text-xl">📷</span>\`;
  }
  
  // Insert fallback after the image
  imgElement.parentNode.insertBefore(fallback, imgElement.nextSibling);
}

/**
 * Initialize image error handlers for existing images
 */
function initializeImageHandlers() {
  // Partner images
  document.querySelectorAll('img[alt*="partner" i], img[src*="partner"]').forEach(img => {
    img.onerror = () => handleImageError(img, 'partner', img.alt || 'Partner');
  });
  
  // Service images  
  document.querySelectorAll('img[alt*="service" i], img[src*="service"]').forEach(img => {
    img.onerror = () => handleImageError(img, 'service', img.alt || 'Service');
  });
  
  // Promotion images
  document.querySelectorAll('img[alt*="promotion" i], img[src*="promotion"]').forEach(img => {
    img.onerror = () => handleImageError(img, 'promotion', img.alt || 'Promotion');
  });
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeImageHandlers);
} else {
  initializeImageHandlers();
}
`;
  
  return script;
}

// Run the fix
if (require.main === module) {
  fixImageDisplay()
    .then(() => {
      console.log('\n🎉 Image display fix completed successfully!');
      console.log('\n📝 Frontend Image Handling Script:');
      console.log('Copy this script to your frontend files for enhanced image handling:');
      console.log('\n' + generateImageHandlingScript());
    })
    .catch(err => {
      console.error('💥 Fix failed:', err);
      process.exit(1);
    });
}

module.exports = { fixImageDisplay, generateImageHandlingScript };