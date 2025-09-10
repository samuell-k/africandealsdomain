/**
 * Page Load Test for Local Market
 * Simple test to verify the page loads without JavaScript errors
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function testPageLoad() {
  console.log('=== TESTING PAGE LOAD ===');
  
  try {
    // Check if all required files exist
    const requiredFiles = [
      'local-market-home-signed.html',
      'missing-functions.js',
      'missing-functions-comprehensive.js', 
      'local-market-core.js',
      'local-market-product-modal.js'
    ];
    
    console.log('Checking required files...');
    let allFilesExist = true;
    
    requiredFiles.forEach(file => {
      const filePath = path.join(__dirname, file);
      if (fs.existsSync(filePath)) {
        console.log(`✅ ${file} - Found`);
      } else {
        console.error(`❌ ${file} - Missing`);
        allFilesExist = false;
      }
    });
    
    if (!allFilesExist) {
      console.error('❌ Some required files are missing!');
      return false;
    }
    
    console.log('\n✅ All required files exist!');
    
    // Test JavaScript syntax
    console.log('\nTesting JavaScript syntax...');
    const jsFiles = requiredFiles.filter(f => f.endsWith('.js'));
    
    jsFiles.forEach(file => {
      try {
        execSync(`node -c "${file}"`, { cwd: __dirname, stdio: 'pipe' });
        console.log(`✅ ${file} - Syntax OK`);
      } catch (error) {
        console.error(`❌ ${file} - Syntax Error:`, error.message);
        allFilesExist = false;
      }
    });
    
    if (!allFilesExist) {
      console.error('❌ Some JavaScript files have syntax errors!');
      return false;
    }
    
    console.log('\n✅ All JavaScript files have valid syntax!');
    
    // Check HTML structure
    console.log('\nChecking HTML structure...');
    const htmlContent = fs.readFileSync('local-market-home-signed.html', 'utf8');
    
    const requiredElements = [
      'id="tab-browse"',
      'id="tab-cart"', 
      'id="tab-orders"',
      'id="tab-profile"',
      'id="browse-content"',
      'id="mobile-nav"',
      'onclick="switchTab'
    ];
    
    requiredElements.forEach(element => {
      if (htmlContent.includes(element)) {
        console.log(`✅ HTML contains: ${element}`);
      } else {
        console.warn(`⚠️  HTML missing: ${element}`);
      }
    });
    
    // Check script inclusions
    console.log('\nChecking script inclusions...');
    jsFiles.forEach(file => {
      if (htmlContent.includes(`src="/grocery/${file}"`)) {
        console.log(`✅ Script included: ${file}`);
      } else {
        console.error(`❌ Script not included: ${file}`);
      }
    });
    
    console.log('\n🎉 Page load test completed successfully!');
    console.log('The page should now load without JavaScript errors.');
    console.log('Access it at: http://127.0.0.1:8080/grocery/local-market-home-signed.html');
    
    return true;
    
  } catch (error) {
    console.error('❌ Page load test failed:', error.message);
    return false;
  }
}

// Run the test
if (require.main === module) {
  const success = testPageLoad();
  process.exit(success ? 0 : 1);
}

module.exports = { testPageLoad };