/**
 * Comprehensive Test Suite for Local Market Home Page
 * Tests functionality, error handling, console logging, and user experience
 */

class LocalMarketTester {
  constructor() {
    this.testResults = [];
    this.startTime = Date.now();
    
    console.log('🧪 Starting Comprehensive Local Market Test Suite...');
    console.log('═══════════════════════════════════════════════════');
  }

  // Test Results Tracking
  logTest(testName, passed, message, details = {}) {
    const result = {
      test: testName,
      passed,
      message,
      details,
      timestamp: new Date().toISOString()
    };
    
    this.testResults.push(result);
    
    const icon = passed ? '✅' : '❌';
    const status = passed ? 'PASS' : 'FAIL';
    
    console.log(`${icon} [${status}] ${testName}: ${message}`);
    
    if (details && Object.keys(details).length > 0) {
      console.log('   Details:', details);
    }
    
    return passed;
  }

  // 1. HTML Structure Tests
  testHtmlStructure() {
    console.log('\n📋 Testing HTML Structure...');
    
    const criticalElements = [
      'checkout-modal',
      'checkout-content', 
      'header',
      'main',
      'mobile-search-bar',
      'category-filter',
      'sort-filter',
      'price-range'
    ];
    
    criticalElements.forEach(elementId => {
      const element = document.getElementById(elementId);
      this.logTest(
        `HTML Element: ${elementId}`,
        !!element,
        element ? 'Element found' : 'Element missing',
        { elementId }
      );
    });

    // Test checkout modal structure
    const checkoutModal = document.getElementById('checkout-modal');
    if (checkoutModal) {
      const modalClasses = checkoutModal.className;
      this.logTest(
        'Checkout Modal Classes',
        modalClasses.includes('fixed') && modalClasses.includes('hidden'),
        'Modal has proper positioning and visibility classes',
        { classes: modalClasses }
      );
    }
  }

  // 2. JavaScript Function Tests
  testJavaScriptFunctions() {
    console.log('\n🔧 Testing JavaScript Functions...');
    
    const requiredFunctions = [
      'logout',
      'closeMobileNav', 
      'showToast',
      'switchTab',
      'openSupportModal',
      'trackOrder',
      'trackError'
    ];
    
    requiredFunctions.forEach(funcName => {
      const func = window[funcName];
      this.logTest(
        `Function: ${funcName}`,
        typeof func === 'function',
        typeof func === 'function' ? 'Function available' : 'Function missing',
        { type: typeof func }
      );
    });

    // Test toast functionality
    try {
      window.showToast('Test message', 'info', 1000);
      this.logTest(
        'Toast Function Execution',
        true,
        'Toast function executed without errors'
      );
    } catch (error) {
      this.logTest(
        'Toast Function Execution',
        false,
        'Toast function threw an error',
        { error: error.message }
      );
    }
  }

  // 3. Error Handling Tests
  testErrorHandling() {
    console.log('\n🛡️ Testing Error Handling...');
    
    // Test global error tracking
    if (window.trackError) {
      try {
        window.trackError('test_error', 'This is a test error', { testData: 'test' });
        this.logTest(
          'Error Tracking Function',
          true,
          'Error tracking function works correctly'
        );
      } catch (error) {
        this.logTest(
          'Error Tracking Function', 
          false,
          'Error tracking function failed',
          { error: error.message }
        );
      }
    }

    // Test localStorage error handling
    try {
      localStorage.setItem('test-key', 'test-value');
      const retrieved = localStorage.getItem('test-key');
      localStorage.removeItem('test-key');
      
      this.logTest(
        'LocalStorage Operations',
        retrieved === 'test-value',
        'LocalStorage read/write operations working'
      );
    } catch (error) {
      this.logTest(
        'LocalStorage Operations',
        false,
        'LocalStorage operations failed',
        { error: error.message }
      );
    }
  }

  // 4. Console Logging Tests
  testConsoleLogging() {
    console.log('\n📊 Testing Console Logging...');
    
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    
    let logCount = 0;
    let errorCount = 0;
    let warnCount = 0;
    
    // Intercept console methods to count calls
    console.log = (...args) => {
      logCount++;
      originalConsoleLog.apply(console, args);
    };
    
    console.error = (...args) => {
      errorCount++;
      originalConsoleError.apply(console, args);
    };
    
    console.warn = (...args) => {
      warnCount++;
      originalConsoleWarn.apply(console, args);
    };
    
    // Trigger some functions that should log
    try {
      if (window.showToast) window.showToast('Test logging', 'info');
      if (window.trackError) window.trackError('test', 'test message');
    } catch (e) {
      // Expected for testing
    }
    
    // Restore original console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError; 
    console.warn = originalConsoleWarn;
    
    this.logTest(
      'Console Logging Activity',
      (logCount + errorCount + warnCount) > 0,
      `Detected ${logCount} logs, ${errorCount} errors, ${warnCount} warnings`,
      { logCount, errorCount, warnCount }
    );
  }

  // 5. UI Responsiveness Tests
  testUIResponsiveness() {
    console.log('\n📱 Testing UI Responsiveness...');
    
    // Test viewport meta tag
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    this.logTest(
      'Viewport Meta Tag',
      !!viewportMeta && viewportMeta.content.includes('width=device-width'),
      viewportMeta ? 'Responsive viewport meta tag found' : 'Viewport meta tag missing'
    );

    // Test responsive classes
    const responsiveElements = document.querySelectorAll('[class*="sm:"], [class*="md:"], [class*="lg:"]');
    this.logTest(
      'Responsive CSS Classes',
      responsiveElements.length > 0,
      `Found ${responsiveElements.length} elements with responsive classes`
    );

    // Test mobile navigation elements
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const mobileNav = document.getElementById('mobile-nav');
    
    this.logTest(
      'Mobile Navigation Elements',
      !!(mobileMenuToggle || mobileNav),
      'Mobile navigation elements available'
    );
  }

  // 6. Performance Tests
  testPerformance() {
    console.log('\n⚡ Testing Performance...');
    
    // Test script loading time
    const loadTime = Date.now() - this.startTime;
    this.logTest(
      'Script Load Time',
      loadTime < 5000,
      `Scripts loaded in ${loadTime}ms`,
      { loadTime }
    );

    // Test DOM elements count
    const elementCount = document.querySelectorAll('*').length;
    this.logTest(
      'DOM Complexity',
      elementCount < 5000,
      `DOM has ${elementCount} elements`,
      { elementCount }
    );

    // Test external dependencies
    const scriptTags = document.querySelectorAll('script[src]');
    const externalScripts = Array.from(scriptTags).filter(script => 
      script.src.includes('http') || script.src.includes('cdn')
    );
    
    this.logTest(
      'External Dependencies',
      externalScripts.length < 10,
      `Found ${externalScripts.length} external script dependencies`,
      { count: externalScripts.length }
    );
  }

  // 7. Accessibility Tests
  testAccessibility() {
    console.log('\n♿ Testing Accessibility...');
    
    // Test alt attributes on images
    const images = document.querySelectorAll('img');
    const imagesWithAlt = Array.from(images).filter(img => img.alt);
    
    this.logTest(
      'Image Alt Attributes',
      imagesWithAlt.length === images.length,
      `${imagesWithAlt.length}/${images.length} images have alt text`
    );

    // Test form labels
    const inputs = document.querySelectorAll('input, textarea, select');
    const labelsCount = document.querySelectorAll('label').length;
    
    this.logTest(
      'Form Labels',
      labelsCount >= inputs.length * 0.8, // Allow 80% threshold
      `Found ${labelsCount} labels for ${inputs.length} form inputs`
    );

    // Test keyboard navigation
    const focusableElements = document.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    this.logTest(
      'Focusable Elements',
      focusableElements.length > 0,
      `Found ${focusableElements.length} focusable elements`
    );
  }

  // 8. Security Tests
  testSecurity() {
    console.log('\n🔒 Testing Security...');
    
    // Test for inline JavaScript (should be minimal)
    const inlineScripts = document.querySelectorAll('script:not([src])');
    this.logTest(
      'Inline Scripts',
      inlineScripts.length < 5,
      `Found ${inlineScripts.length} inline script blocks`
    );

    // Test for external script domains
    const externalScripts = document.querySelectorAll('script[src]');
    const externalDomains = new Set();
    
    externalScripts.forEach(script => {
      try {
        const url = new URL(script.src);
        if (url.hostname !== window.location.hostname) {
          externalDomains.add(url.hostname);
        }
      } catch (e) {
        // Ignore relative URLs
      }
    });

    this.logTest(
      'External Script Domains',
      externalDomains.size < 5,
      `Scripts loaded from ${externalDomains.size} external domains`,
      { domains: Array.from(externalDomains) }
    );
  }

  // 9. Usability Tests
  testUsability() {
    console.log('\n👤 Testing Usability...');
    
    // Test search functionality elements
    const searchInputs = document.querySelectorAll('input[type="text"][placeholder*="search" i]');
    this.logTest(
      'Search Input Elements',
      searchInputs.length > 0,
      `Found ${searchInputs.length} search input elements`
    );

    // Test filter elements
    const filterSelects = document.querySelectorAll('#category-filter, #sort-filter');
    this.logTest(
      'Filter Controls',
      filterSelects.length >= 2,
      `Found ${filterSelects.length} filter controls`
    );

    // Test action buttons
    const actionButtons = document.querySelectorAll('button[onclick]');
    this.logTest(
      'Interactive Buttons',
      actionButtons.length > 5,
      `Found ${actionButtons.length} interactive buttons`
    );

    // Test loading states
    const loadingElements = document.querySelectorAll('.loading-spinner, .fa-spinner');
    this.logTest(
      'Loading Indicators',
      loadingElements.length > 0,
      `Found ${loadingElements.length} loading indicators`
    );
  }

  // 10. Integration Tests
  testIntegration() {
    console.log('\n🔗 Testing Integration...');
    
    // Test external script references
    const scriptSources = [
      '/shared/auth-utils.js',
      '/grocery/missing-functions.js',
      '/grocery/local-market-referrals.js',
      '/grocery/local-market-product-modal.js',
      '/grocery/local-market-core.js'
    ];

    scriptSources.forEach(src => {
      const scriptElement = document.querySelector(`script[src="${src}"]`);
      this.logTest(
        `External Script: ${src}`,
        !!scriptElement,
        scriptElement ? 'Script reference found' : 'Script reference missing',
        { src }
      );
    });

    // Test CSS dependencies
    const cssLinks = document.querySelectorAll('link[rel="stylesheet"]');
    this.logTest(
      'CSS Dependencies',
      cssLinks.length > 0,
      `Found ${cssLinks.length} stylesheet dependencies`
    );
  }

  // Generate Test Report
  generateReport() {
    console.log('\n📊 TEST REPORT');
    console.log('═══════════════════════════════════════════════════');
    
    const passedTests = this.testResults.filter(test => test.passed);
    const failedTests = this.testResults.filter(test => !test.passed);
    const totalTests = this.testResults.length;
    const passRate = ((passedTests.length / totalTests) * 100).toFixed(1);
    
    console.log(`📈 Total Tests: ${totalTests}`);
    console.log(`✅ Passed: ${passedTests.length}`);
    console.log(`❌ Failed: ${failedTests.length}`);
    console.log(`📊 Pass Rate: ${passRate}%`);
    console.log(`⏱️ Test Duration: ${Date.now() - this.startTime}ms`);
    
    if (failedTests.length > 0) {
      console.log('\n❌ FAILED TESTS:');
      failedTests.forEach(test => {
        console.log(`   • ${test.test}: ${test.message}`);
      });
    }
    
    console.log('\n🎯 TEST RECOMMENDATIONS:');
    if (passRate >= 90) {
      console.log('✅ Excellent! System is production-ready.');
    } else if (passRate >= 75) {
      console.log('⚠️ Good but needs minor improvements.');
    } else if (passRate >= 50) {
      console.log('🔧 Requires significant improvements before production.');
    } else {
      console.log('🚨 Critical issues found. Major fixes required.');
    }
    
    // Store results in localStorage for later analysis
    try {
      localStorage.setItem('testResults', JSON.stringify({
        timestamp: new Date().toISOString(),
        results: this.testResults,
        summary: {
          total: totalTests,
          passed: passedTests.length,
          failed: failedTests.length,
          passRate: parseFloat(passRate)
        }
      }));
      console.log('💾 Test results saved to localStorage');
    } catch (error) {
      console.warn('⚠️ Could not save test results:', error.message);
    }
    
    return {
      totalTests,
      passedTests: passedTests.length,
      failedTests: failedTests.length,
      passRate: parseFloat(passRate),
      results: this.testResults
    };
  }

  // Run All Tests
  runAllTests() {
    console.log('🚀 Running comprehensive test suite...\n');
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.executeTests();
      });
    } else {
      this.executeTests();
    }
  }

  executeTests() {
    try {
      this.testHtmlStructure();
      this.testJavaScriptFunctions();
      this.testErrorHandling();
      this.testConsoleLogging();
      this.testUIResponsiveness();
      this.testPerformance();
      this.testAccessibility();
      this.testSecurity();
      this.testUsability();
      this.testIntegration();
      
      const report = this.generateReport();
      
      console.log('\n🎉 Comprehensive testing completed!');
      console.log('═══════════════════════════════════════════════════');
      
      return report;
    } catch (error) {
      console.error('🚨 Critical error during testing:', error);
      return { error: error.message, results: this.testResults };
    }
  }
}

// Auto-run tests when script loads
window.addEventListener('load', () => {
  setTimeout(() => {
    const tester = new LocalMarketTester();
    window.testReport = tester.runAllTests();
  }, 1000); // Wait 1 second for everything to load
});

// Export for manual testing
window.LocalMarketTester = LocalMarketTester;

console.log('🧪 Comprehensive test suite loaded. Tests will run automatically on page load.');