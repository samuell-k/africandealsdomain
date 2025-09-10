const axios = require('axios');

async function testProductsAPI() {
  console.log('🧪 Testing Local Market Products API...\n');

  try {
    const response = await axios.get('http://localhost:3001/api/local-market/products?limit=8', {
      timeout: 10000
    });

    console.log('✅ API Response successful!');
    console.log('Status:', response.status);
    console.log('Products found:', response.data.products?.length || 0);
    
    if (response.data.products && response.data.products.length > 0) {
      console.log('\n📦 Sample products:');
      response.data.products.slice(0, 3).forEach((product, index) => {
        console.log(`${index + 1}. ${product.product_name}`);
        console.log(`   Price: ${product.unit_price} ${product.currency}`);
        console.log(`   Stock: ${product.available_stock}`);
        console.log(`   Brand: ${product.brand || 'N/A'}`);
        console.log(`   Category: ${product.category_name || 'N/A'}`);
        console.log(`   Seller: ${product.seller?.name || 'N/A'}`);
        console.log('');
      });
    } else {
      console.log('⚠️ No products found');
    }

    // Test categories endpoint
    console.log('🏷️ Testing categories endpoint...');
    const categoriesResponse = await axios.get('http://localhost:3001/api/local-market/categories', {
      timeout: 10000
    });
    
    console.log('Categories found:', categoriesResponse.data.categories?.length || 0);
    if (categoriesResponse.data.categories && categoriesResponse.data.categories.length > 0) {
      console.log('Sample categories:');
      categoriesResponse.data.categories.slice(0, 5).forEach(cat => {
        console.log(`- ${cat.name} (${cat.product_count} products)`);
      });
    }

  } catch (error) {
    console.log('❌ API Test failed:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    } else {
      console.log('Error:', error.message);
    }
  }
}

testProductsAPI();