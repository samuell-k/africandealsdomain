const puppeteer = require('puppeteer');

async function testPSMFinal() {
  console.log('🚀 Starting PSM Final Test');
  
  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: false, 
      devtools: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Listen for console messages and errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('PAGE ERROR:', msg.text());
      }
    });
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    
    // Test 1: Direct Dashboard Access
    console.log('\n🧪 Test 1: Direct Dashboard Access');
    
    try {
      // Set authentication tokens first
      await page.evaluateOnNewDocument(() => {
        localStorage.setItem('token', 'test-token');
        localStorage.setItem('user', JSON.stringify({
          id: 1,
          name: 'Test PSM',
          email: 'psm.test.new@example.com',
          role: 'agent',
          agent_type: 'pickup_site_manager'
        }));
      });
      
      await page.goto('http://localhost:3001/agent/psm-dashboard.html', { 
        waitUntil: 'networkidle0',
        timeout: 15000 
      });
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const currentUrl = page.url();
      console.log('Dashboard URL:', currentUrl);
      
      if (currentUrl.includes('psm-dashboard.html')) {
        console.log('✅ Dashboard loaded successfully');
        
        // Test 2: Check dashboard elements
        console.log('\n🧪 Test 2: Check dashboard elements');
        const quickActions = await page.$$('.bg-blue-600');
        const statsCards = await page.$$('.stat-card');
        
        console.log(`Found ${quickActions.length} quick action buttons`);
        console.log(`Found ${statsCards.length} stat cards`);
        
        if (quickActions.length > 0 && statsCards.length > 0) {
          console.log('✅ Dashboard elements found');
          
          // Test 3: Manual Order Creation Navigation
          console.log('\n🧪 Test 3: Manual Order Creation Navigation');
          
          // Find and click the create order button
          const createOrderButtons = await page.$$('button[onclick*="createManualOrder"]');
          console.log(`Found ${createOrderButtons.length} create order buttons`);
          
          if (createOrderButtons.length > 0) {
            await createOrderButtons[0].click();
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            const newUrl = page.url();
            console.log('After clicking create order:', newUrl);
            
            if (newUrl.includes('manual-order-creation.html')) {
              console.log('✅ Successfully navigated to manual order creation');
              
              // Test 4: Check manual order page elements
              console.log('\n🧪 Test 4: Check manual order page elements');
              
              const productSearch = await page.$('#productSearch');
              const physicalBtn = await page.$('#switchToPhysicalBtn');
              const localBtn = await page.$('#switchToLocalBtn');
              const goBackBtn = await page.$('button[onclick="goBack()"]');
              
              console.log('Product search found:', !!productSearch);
              console.log('Physical button found:', !!physicalBtn);
              console.log('Local button found:', !!localBtn);
              console.log('Go back button found:', !!goBackBtn);
              
              if (productSearch && physicalBtn && localBtn && goBackBtn) {
                console.log('✅ All manual order elements found');
                
                // Test 5: Go back functionality
                console.log('\n🧪 Test 5: Go back functionality');
                
                await goBackBtn.click();
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                const backUrl = page.url();
                console.log('After going back:', backUrl);
                
                if (backUrl.includes('psm-dashboard.html')) {
                  console.log('✅ Go back functionality works');
                  
                  // Test 6: Orders page navigation
                  console.log('\n🧪 Test 6: Orders page navigation');
                  
                  const viewOrdersButtons = await page.$$('button[onclick*="viewOrders"]');
                  console.log(`Found ${viewOrdersButtons.length} view orders buttons`);
                  
                  if (viewOrdersButtons.length > 0) {
                    await viewOrdersButtons[0].click();
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    
                    const ordersUrl = page.url();
                    console.log('Orders page URL:', ordersUrl);
                    
                    if (ordersUrl.includes('psm-orders.html')) {
                      console.log('✅ Successfully navigated to orders page');
                      
                      // Test 7: Orders page elements
                      console.log('\n🧪 Test 7: Orders page elements');
                      
                      const searchInput = await page.$('#search');
                      const statusFilter = await page.$('#status-filter');
                      const createOrderLink = await page.$('a[href="/agent/manual-order-creation.html"]');
                      
                      console.log('Search input found:', !!searchInput);
                      console.log('Status filter found:', !!statusFilter);
                      console.log('Create order link found:', !!createOrderLink);
                      
                      if (searchInput && statusFilter && createOrderLink) {
                        console.log('✅ All orders page elements found');
                        
                        // Test 8: Create order link from orders page
                        console.log('\n🧪 Test 8: Create order link from orders page');
                        
                        await createOrderLink.click();
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        
                        const finalUrl = page.url();
                        console.log('Final URL:', finalUrl);
                        
                        if (finalUrl.includes('manual-order-creation.html')) {
                          console.log('✅ Create order link works from orders page');
                          console.log('\n🎉 ALL TESTS PASSED! PSM system is fully functional.');
                        } else {
                          console.log('❌ Create order link failed');
                        }
                      } else {
                        console.log('❌ Some orders page elements missing');
                      }
                    } else {
                      console.log('❌ Failed to navigate to orders page');
                    }
                  } else {
                    console.log('❌ No view orders buttons found');
                  }
                } else {
                  console.log('❌ Go back functionality failed');
                }
              } else {
                console.log('❌ Some manual order elements missing');
              }
            } else {
              console.log('❌ Failed to navigate to manual order creation');
            }
          } else {
            console.log('❌ No create order buttons found');
          }
        } else {
          console.log('❌ Dashboard elements missing');
        }
      } else {
        console.log('❌ Dashboard failed to load');
      }
      
    } catch (error) {
      console.log('❌ Test failed:', error.message);
    }
    
    await page.screenshot({ path: 'psm-final-test.png', fullPage: true });
    console.log('📸 Screenshot saved');
    
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
testPSMFinal().then(() => {
  console.log('\n🏁 PSM Final test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test crashed:', error);
  process.exit(1);
});