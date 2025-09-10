// Script to fix the incomplete HTML file ending
const fs = require('fs');
const path = require('path');

const filePath = 'f:\\african_deal_domain\\frican_deals_domainRealUpdated\\african_deals_physical_products\\apps\\client\\grocery\\local-market-home-signed.html';

try {
  // Read the current file content
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Check if the file ends with the incomplete "// R"
  if (content.endsWith('      // R')) {
    // Replace the incomplete ending with the proper ending
    content = content.replace(/      \/\/ R$/, `      // Ready state - all functions loaded
      console.log('Local Market page fully loaded and ready');
      
    });

  </script>
</body>
</html>`);
    
    // Write the fixed content back to the file
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ HTML file ending fixed successfully!');
  } else {
    console.log('ℹ️  File ending appears to be correct already.');
  }
} catch (error) {
  console.error('❌ Error fixing HTML file:', error.message);
}