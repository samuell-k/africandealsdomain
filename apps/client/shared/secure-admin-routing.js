
/**
 * SECURE ADMIN ROUTING
 * Obfuscates admin URLs to prevent exposure
 */

class SecureAdminRouting {
  constructor() {
    this.adminPaths = this.getObfuscatedAdminPaths();
  }

  getObfuscatedAdminPaths() {
    // Use obfuscated paths instead of obvious /admin/ URLs
    return {
      'admin-dashboard': '/sys/mgmt/dashboard.html',
      'admin-users': '/sys/mgmt/users.html',
      'admin-orders': '/sys/mgmt/orders.html',
      'admin-products': '/sys/mgmt/products.html',
      'admin-settings': '/sys/mgmt/settings.html'
    };
  }

  redirectToSecureAdmin(role, targetPage = 'dashboard') {
    if (role !== 'admin') {
      console.log('🚫 Unauthorized admin access attempt blocked');
      return false;
    }

    const securePath = this.adminPaths[`admin-${targetPage}`];
    if (securePath) {
      console.log('🔒 Redirecting to secure admin path');
      window.location.href = securePath;
      return true;
    }
    
    return false;
  }

  isSecureAdminPath(path) {
    return Object.values(this.adminPaths).includes(path);
  }
}

// Make available globally
window.SecureAdminRouting = SecureAdminRouting;
