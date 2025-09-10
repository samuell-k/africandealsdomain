
// Admin Authentication Utilities
class AdminAuth {
  static getCurrentUser() {
    try {
      const token = localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');
      if (!token) return null;
      
      // For testing purposes, return a mock admin user
      return {
        id: 1,
        email: 'admin@admin.com',
        role: 'admin',
        name: 'Admin User'
      };
    } catch (error) {
      console.warn('Error getting current user:', error);
      return null;
    }
  }
  
  static getUserRole() {
    const user = this.getCurrentUser();
    return user ? user.role : null;
  }
  
  static isAuthenticated() {
    return this.getCurrentUser() !== null;
  }
  
  static requireAuth() {
    if (!this.isAuthenticated()) {
      window.location.href = '/admin/login.html';
      return false;
    }
    return true;
  }
  
  static logout() {
    localStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminToken');
    localStorage.removeItem('userRole');
    window.location.href = '/admin/login.html';
  }
}

// Safe DOM ready function
function safeReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback);
  } else {
    callback();
  }
}

// Safe element selector
function safeSelect(selector) {
  try {
    return document.querySelector(selector);
  } catch (error) {
    console.warn('Error selecting element:', selector, error);
    return null;
  }
}

// Safe event listener
function safeAddEventListener(element, event, callback) {
  if (element && typeof element.addEventListener === 'function') {
    element.addEventListener(event, callback);
    return true;
  }
  return false;
}

// Initialize admin authentication on page load
safeReady(() => {
  // Set admin name if element exists
  const adminNameEl = safeSelect('#admin-name');
  if (adminNameEl) {
    const user = AdminAuth.getCurrentUser();
    if (user) {
      adminNameEl.textContent = user.name || 'Admin';
    }
  }
  
  // Add logout functionality
  const logoutBtn = safeSelect('[onclick="logout()"]');
  if (logoutBtn) {
    logoutBtn.onclick = (e) => {
      e.preventDefault();
      AdminAuth.logout();
    };
  }
});

// Global logout function for backward compatibility
function logout() {
  AdminAuth.logout();
}
