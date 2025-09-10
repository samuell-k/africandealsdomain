const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function debugAPI() {
  try {
    console.log('🔍 Testing API endpoints...');
    
    // Test basic server health
    const healthRes = await fetch('http://localhost:3001/');
    console.log('Health check status:', healthRes.status);
    
    // Test active sites endpoint without auth
    const sitesRes = await fetch('http://localhost:3001/api/pickup-site-manager/active-sites');
    console.log('Active sites status:', sitesRes.status);
    const sitesText = await sitesRes.text();
    console.log('Active sites response:', sitesText);
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugAPI();