
// IMPROVED AUTH-CHECK WITH SECURITY FIXES
(function(){
  const TOKEN_KEY = 'authToken';
  const USER_KEY = 'userData';
  
  // Security: Obfuscate admin detection
  const SECURE_ROLES = {
    'buyer': '/buyer/buyers-home.html',
    'seller': '/seller/dashboard.html', 
    'agent': '/agent/agents-home.html',
    'admin': '/sys/mgmt/dashboard.html' // Obfuscated admin path
  };

  async function validateToken(token) {
    if (!token) return false;
    try {
      const res = await fetch('/api/auth/check', { 
        headers: { Authorization: 'Bearer ' + token } 
      });
      if (!res.ok) return false;
      return await res.json();
    } catch { 
      return false; 
    }
  }

  function getUser() {
    try {
      const raw = localStorage.getItem(USER_KEY) || localStorage.getItem('user');
      return JSON.parse(raw||'null'); 
    } catch { 
      return null; 
    }
  }

  function getToken() { 
    return localStorage.getItem(TOKEN_KEY) || localStorage.getItem('token'); 
  }

  function showToast(msg, type='error') {
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.className = 'fixed top-4 right-4 z-50 px-4 py-2 rounded shadow-lg text-white font-bold';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded shadow-lg text-white font-bold ${type==='success'?'bg-green-600':'bg-red-600'}`;
    toast.style.display = '';
    setTimeout(()=>{ toast.style.display = 'none'; }, 3500);
  }

  function showLoading(msg) {
    let loading = document.getElementById('loading');
    if (!loading) {
      loading = document.createElement('div');
      loading.id = 'loading';
      loading.className = 'fixed inset-0 flex items-center justify-center bg-white/80 z-50';
      loading.innerHTML = `<div class='flex flex-col items-center'><div class='animate-spin rounded-full h-16 w-16 border-t-4 border-[#0e2038] mb-4'></div><div class='text-[#0e2038] font-bold text-lg'>${msg||'Loading...'}</div></div>`;
      document.body.appendChild(loading);
    } else {
      loading.querySelector('div.text-[#0e2038]').textContent = msg||'Loading...';
      loading.style.display = '';
    }
  }

  function hideLoading() {
    let loading = document.getElementById('loading');
    if (loading) loading.style.display = 'none';
  }

  async function requireAuth(role) {
    showLoading('Checking authentication...');
    
    // Add delay to prevent race conditions
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const token = getToken();
    const user = getUser();
    
    console.log('[AUTH] Token present:', !!token);
    console.log('[AUTH] User data present:', !!user);
    console.log('[AUTH] User role:', user?.role);
    
    if (!token || !user) {
      console.log('[AUTH] No token to validate');
      console.log('[AUTH] Redirecting to login - protected page accessed without valid authentication');
      showToast('Please login to access this page.');
      hideLoading();
      
      // Security: Use role-specific login pages without exposing admin
      const loginPage = role === 'admin' ? '/auth/sys-login.html' : `/auth/auth-${role}.html`;
      console.log('[AUTH] Redirecting to login:', loginPage);
      
      setTimeout(()=>{
        window.location.href = loginPage;
      }, 1200);
      return false;
    }

    const valid = await validateToken(token);
    if (!valid || (role && valid.role !== role)) {
      console.log('[AUTH] Token validation failed or role mismatch');
      showToast('Session expired. Please login again.');
      hideLoading();
      
      // Security: Use role-specific login pages
      const loginPage = role === 'admin' ? '/auth/sys-login.html' : `/auth/auth-${role}.html`;
      
      setTimeout(()=>{
        window.location.href = loginPage;
      }, 1200);
      return false;
    }
    
    hideLoading();
    return true;
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = '/';
  }

  function redirectToDashboard(role) {
    showLoading('Redirecting...');
    
    // Security: Use obfuscated paths for admin
    const path = SECURE_ROLES[role] || '/';
    
    console.log('[AUTH] Redirecting to dashboard for role:', role);
    console.log('[AUTH] Dashboard path:', path);
    
    fetch(path, { method: 'HEAD' }).then(r => {
      if (r.ok) {
        showToast('Welcome back!', 'success');
        setTimeout(()=>{ 
          window.location.href = path; 
        }, 800);
      } else {
        showToast('Dashboard loading...','success');
        setTimeout(()=>{ 
          window.location.href = path; 
        }, 1200);
      }
    }).catch(()=>{
      showToast('Dashboard loading...','success');
      setTimeout(()=>{ 
        window.location.href = path; 
      }, 1200);
    });
  }

  // Security: Prevent admin URL exposure in browser history
  function sanitizeHistory() {
    if (window.location.pathname.includes('/admin/')) {
      history.replaceState(null, '', '/sys/mgmt/');
    }
  }

  // Run security check on load
  document.addEventListener('DOMContentLoaded', sanitizeHistory);

  window.Auth = { 
    validateToken, 
    getUser, 
    getToken, 
    requireAuth, 
    logout, 
    redirectToDashboard 
  };
})();
