/**
 * Test functionality for Local Market Page
 * This script checks if all required functions are available
 */

function testLocalMarketFunctions() {
  console.log('=== TESTING LOCAL MARKET FUNCTIONALITY ===');
  
  const requiredFunctions = [
    'switchTab',
    'closeMobileNav', 
    'openMobileNav',
    'openSupportModal',
    'closeSupportModal',
    'showNotification',
    'loadCartItems',
    'loadUserOrders', 
    'loadUserProfile',
    'formatPrice',
    'getCartItems',
    'updateCartQuantity',
    'removeFromCart',
    'updateCartBadges',
    'getUserInfo',
    'proceedToCheckout',
    'logout'
  ];
  
  const results = [];
  
  requiredFunctions.forEach(funcName => {
    const exists = typeof window[funcName] === 'function';
    results.push({
      function: funcName,
      exists: exists,
      status: exists ? '✅' : '❌'
    });
    
    if (exists) {
      console.log(`✅ ${funcName} - Available`);
    } else {
      console.error(`❌ ${funcName} - Missing`);
    }
  });
  
  const passedTests = results.filter(r => r.exists).length;
  const totalTests = results.length;
  
  console.log(`\n=== TEST RESULTS ===`);
  console.log(`Passed: ${passedTests}/${totalTests}`);
  console.log(`Success Rate: ${Math.round((passedTests/totalTests) * 100)}%`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All functions are available!');
    
    // Test some basic functionality
    console.log('\n=== TESTING BASIC FUNCTIONALITY ===');
    
    try {
      // Test cart functions
      const cartItems = getCartItems();
      console.log('✅ Cart items retrieved:', cartItems.length, 'items');
      
      // Test price formatting
      const price = formatPrice(1500);
      console.log('✅ Price formatting works:', price);
      
      // Test notifications
      showNotification('Test notification', 'success', 1000);
      console.log('✅ Notification system works');
      
      console.log('🎉 Basic functionality tests passed!');
      
    } catch (error) {
      console.error('❌ Basic functionality test failed:', error);
    }
    
  } else {
    console.error(`❌ Missing ${totalTests - passedTests} required functions`);
  }
  
  return {
    passed: passedTests,
    total: totalTests,
    success: passedTests === totalTests,
    results: results
  };
}

// Test DOM elements
function testRequiredElements() {
  console.log('\n=== TESTING REQUIRED DOM ELEMENTS ===');
  
  const requiredElements = [
    'tab-browse',
    'tab-cart', 
    'tab-orders',
    'tab-profile',
    'browse-content',
    'orders-panel',
    'profile-panel',
    'mobile-nav',
    'mobile-nav-panel',
    'user-dropdown',
    'user-menu-btn',
    'mobile-menu-toggle',
    'logout-btn',
    'clear-filters-btn',
    'price-range',
    'price-range-value'
  ];
  
  requiredElements.forEach(elementId => {
    const element = document.getElementById(elementId);
    if (element) {
      console.log(`✅ Element found: ${elementId}`);
    } else {
      console.warn(`⚠️  Element missing: ${elementId}`);
    }
  });
}

// Run tests when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      testLocalMarketFunctions();
      testRequiredElements();
    }, 500);
  });
} else {
  setTimeout(() => {
    testLocalMarketFunctions();
    testRequiredElements();
  }, 500);
}

// Export for manual testing
window.testLocalMarketFunctions = testLocalMarketFunctions;
window.testRequiredElements = testRequiredElements;