const fs = require('fs');
const path = require('path');

// Ensure upload directories exist
const uploadsDir = path.join(__dirname, 'uploads');
const partnersPromotionsDir = path.join(uploadsDir, 'partners-promotions');

console.log('Creating upload directories...');

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('✅ Created uploads directory');
}

if (!fs.existsSync(partnersPromotionsDir)) {
    fs.mkdirSync(partnersPromotionsDir, { recursive: true });
    console.log('✅ Created partners-promotions directory');
}

// Create a sample SVG image for testing
const sampleSvg = `<svg width="400" height="200" viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="400" height="200" fill="url(#grad)" rx="10"/>
  <text x="200" y="60" font-family="Arial, sans-serif" font-size="32" font-weight="bold" text-anchor="middle" fill="#FFF">SAMPLE</text>
  <text x="200" y="90" font-family="Arial, sans-serif" font-size="20" text-anchor="middle" fill="#FFF">Test Image</text>
  <text x="200" y="120" font-family="Arial, sans-serif" font-size="16" text-anchor="middle" fill="#FFF">Upload Successful!</text>
  <text x="200" y="150" font-family="Arial, sans-serif" font-size="12" text-anchor="middle" fill="#FFF">✅ File Upload System Working</text>
</svg>`;

const sampleImagePath = path.join(partnersPromotionsDir, 'sample-promotion.svg');
fs.writeFileSync(sampleImagePath, sampleSvg);

console.log('✅ Created sample promotional image');
console.log(`📁 Upload directory: ${uploadsDir}`);
console.log(`📁 Partners & Promotions: ${partnersPromotionsDir}`);
console.log(`🖼️ Sample image: ${sampleImagePath}`);
console.log('🚀 Image upload system is ready!');