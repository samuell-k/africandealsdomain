/**
 * Centralized Authentication Manager
 * Replaces duplicate authentication code throughout the system
 * Usage: AuthManager.initializeAuth('admin') or AuthManager.safeApiCall(url, options)
 */

class AuthManager {
  /**
   * Safely check authentication status
   * @returns {Object} Authentication result with user data and token
   */
  static safeAuthCheck() {
    try {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');
      
      if (!token || !userStr) {
        console.log('[AUTH] No token or user data found');
        return { isAuthenticated: false, user: null, token: null };
      }
      
      let user;
      try {
        user = JSON.parse(userStr);
      } catch (parseError) {
        console.error('[AUTH] Failed to parse user data:', parseError);
                
                // Enhanced error logging
                const errorInfo = {
                    message: '[AUTH] Failed to parse user data:',
                    error: parseError,
                    timestamp: new Date().toISOString(),
                    file: 'auth-manager.js'
                };
                
                console.error('Error details:', errorInfo);
showNotification('[AUTH] Failed to parse user data:', 'error');

// Enhanced error logging
if (parseError && parseError.message) {
    console.error('Error details:', parseError.message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error details:',
                    error: parseError.message,
                    timestamp: new Date().toISOString(),
                    file: 'auth-manager.js'
                };
                
                console.error('Error details:', errorInfo);
}
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        return { isAuthenticated: false, user: null, token: null };
      }
      
      if (!user || typeof user !== 'object' || !user.role) {
        console.log('[AUTH] Invalid user data structure');
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        return { isAuthenticated: false, user: null, token: null };
      }
      
      return { isAuthenticated: true, user, token };
    } catch (error) {
      console.error('[AUTH] Auth check failed:', error);
                
                // Enhanced error logging
                const errorInfo = {
                    message: '[AUTH] Auth check failed:',
                    error: error,
                    timestamp: new Date().toISOString(),
                    file: 'auth-manager.js'
                };
                
                console.error('Error details:', errorInfo);
showNotification('[AUTH] Auth check failed:', 'error');

// Enhanced error logging
if (error && error.message) {
    console.error('Error details:', error.message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error details:',
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    file: 'auth-manager.js'
                };
                
                console.error('Error details:', errorInfo);
}
      return { isAuthenticated: false, user: null, token: null };
    }
  }
  
  /**
   * Safely redirect to appropriate login page
   * @param {string} userType - Type of user (admin, seller, agent, buyer)
   */
  static safeRedirectToLogin(userType = null) {
    // Auto-detect user type from current path if not provided
    if (!userType) {
      const currentPath = window.location.pathname;
      if (currentPath.includes('/admin/')) {
        userType = 'admin';
      } else if (currentPath.includes('/seller/')) {
        userType = 'seller';
      } else if (currentPath.includes('/agent/')) {
        userType = 'agent';
      } else if (currentPath.includes('/buyer/')) {
        userType = 'buyer';
      } else {
        userType = 'admin'; // default
      }
    }
    
    const loginPages = {
      admin: '/auth/auth-admin.html',
      seller: '/auth/auth-seller.html',
      agent: '/auth/auth-agent.html',
      buyer: '/auth/auth-buyer.html'
    };
    
    const loginPage = loginPages[userType] || loginPages.admin;
    console.log(`[AUTH] Redirecting to login: ${loginPage}`);
    window.location.href = loginPage;
  }
  
  /**
   * Initialize authentication for a specific page type
   * @param {string} requiredRole - Required user role for this page
   * @returns {Object|boolean} Authentication result or false if failed
   */
  static initializeAuth(requiredRole = 'admin') {
    const authResult = this.safeAuthCheck();
    
    if (!authResult.isAuthenticated) {
      console.log('[AUTH] Not authenticated, redirecting to login');
      this.safeRedirectToLogin(requiredRole);
      return false;
    }
    
    // Check role permission
    if (authResult.user.role !== requiredRole) {
      console.log(`[AUTH] ${requiredRole} access required, current role:`, authResult.user.role);
      
      // Show user-friendly message
      const roleNames = {
        admin: 'Administrator',
        seller: 'Seller', 
        agent: 'Agent',
        buyer: 'Buyer'
      };
      
      alert(`${roleNames[requiredRole] || 'Special'} access required`);
      this.safeRedirectToLogin(requiredRole);
      return false;
    }
    
    console.log('[AUTH] Authentication successful:', authResult.user.role);
    
    // Update UI with user info
    this.updateUserInfo(authResult.user);
    
    // Store auth result globally for other scripts
    window.currentAuth = authResult;
    return authResult;
  }
  
  /**
   * Update user info in the UI
   * @param {Object} user - User data object
   */
  static updateUserInfo(user) {
    const userInfoElement = document.getElementById('userInfo');
    if (userInfoElement && user) {
      userInfoElement.textContent = `${user.name || 'User'} (${user.role || 'Unknown'})`;
    }
    
    // Update user name in various elements
    const userNameElements = document.querySelectorAll('.user-name');
    userNameElements.forEach(element => {
      element.textContent = user.name || 'User';
    });
    
    // Update role-specific elements
    const roleElements = document.querySelectorAll('.user-role');
    roleElements.forEach(element => {
      element.textContent = user.role || 'Unknown';
    });
  }
  
  /**
   * Make authenticated API calls with proper error handling
   * @param {string} url - API endpoint URL
   * @param {Object} options - Fetch options
   * @returns {Promise} API response data
   */
  static async safeApiCall(url, options = {}) {
    const authResult = this.safeAuthCheck();
    
    if (!authResult.isAuthenticated) {
      console.log('[API] Not authenticated for API call');
      this.safeRedirectToLogin();
      return null;
    }
    
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authResult.token}`
      }
    };
    
    const mergedOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers
      }
    };
    
    try {
      const response = await fetch(url, mergedOptions);
      
      if (response.status === 401) {
        console.log('[API] Unauthorized - token expired');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        this.safeRedirectToLogin();
        return null;
      }
      
      if (!response.ok) {
        console.error('[API] Request failed:', response.status, response.statusText);
                
                // Enhanced error logging
                const errorInfo = {
                    message: '[API] Request failed:',
                    error: response.status, response.statusText,
                    timestamp: new Date().toISOString(),
                    file: 'auth-manager.js'
                };
                
                console.error('Error details:', errorInfo);
showNotification('[API] Request failed:', 'error');

// Enhanced error logging
if (response.status, response.statusText && response.status, response.statusText.message) {
    console.error('Error details:', response.status, response.statusText.message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error details:',
                    error: response.status, response.statusText.message,
                    timestamp: new Date().toISOString(),
                    file: 'auth-manager.js'
                };
                
                console.error('Error details:', errorInfo);
}
        console.error('Error thrown:', `HTTP ${response.status}: ${response.statusText}`);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error thrown:',
                    error: `HTTP ${response.status}: ${response.statusText}`,
                    timestamp: new Date().toISOString(),
                    file: 'auth-manager.js'
                };
                
                console.error('Error details:', errorInfo);
                showNotification(`HTTP ${response.status}: ${response.statusText}`, 'error');
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        return await response.text();
      }
    } catch (error) {
      console.error('[API] Request error:', error);
                
                // Enhanced error logging
                const errorInfo = {
                    message: '[API] Request error:',
                    error: error,
                    timestamp: new Date().toISOString(),
                    file: 'auth-manager.js'
                };
                
                console.error('Error details:', errorInfo);
showNotification('[API] Request error:', 'error');

// Enhanced error logging
if (error && error.message) {
    console.error('Error details:', error.message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error details:',
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    file: 'auth-manager.js'
                };
                
                console.error('Error details:', errorInfo);
}
      
      // Show user-friendly error message
      if (window.ErrorManager) {
        window.ErrorManager.handleAPIError(error);
      }
      
      throw error;
    }
  }
  
  /**
   * Logout user and redirect to login
   * @param {string} userType - User type for redirect
   */
  static logout(userType = null) {
    try {
      // Clear stored authentication data
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Clear any session data
      sessionStorage.clear();
      
      console.log('[AUTH] User logged out successfully');
      
      // Show success message if notification system is available
      if (window.ErrorManager) {
        window.ErrorManager.showNotification('Logged out successfully', 'success', 2000);
      }
      
      // Redirect to login after a short delay to show message
      setTimeout(() => {
        this.safeRedirectToLogin(userType);
      }, 1000);
      
    } catch (error) {
      console.error('[AUTH] Logout error:', error);
                
                // Enhanced error logging
                const errorInfo = {
                    message: '[AUTH] Logout error:',
                    error: error,
                    timestamp: new Date().toISOString(),
                    file: 'auth-manager.js'
                };
                
                console.error('Error details:', errorInfo);
showNotification('[AUTH] Logout error:', 'error');

// Enhanced error logging
if (error && error.message) {
    console.error('Error details:', error.message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error details:',
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    file: 'auth-manager.js'
                };
                
                console.error('Error details:', errorInfo);
}
      // Force redirect even if there's an error
      this.safeRedirectToLogin(userType);
    }
  }
  
  /**
   * Check if user has specific permission
   * @param {string} permission - Permission to check
   * @returns {boolean} Whether user has permission
   */
  static hasPermission(permission) {
    const authResult = this.safeAuthCheck();
    
    if (!authResult.isAuthenticated) {
      return false;
    }
    
    const { user } = authResult;
    
    // Admin has all permissions
    if (user.role === 'admin') {
      return true;
    }
    
    // Define role-based permissions
    const rolePermissions = {
      seller: [
        'manage_own_products',
        'view_own_orders',
        'update_own_profile',
        'view_own_analytics'
      ],
      agent: [
        'view_assigned_orders', 
        'update_delivery_status',
        'view_commission',
        'update_own_profile'
      ],
      buyer: [
        'place_orders',
        'view_own_orders',
        'manage_cart',
        'update_own_profile'
      ]
    };
    
    const userPermissions = rolePermissions[user.role] || [];
    return userPermissions.includes(permission);
  }
  
  /**
   * Get current user data
   * @returns {Object|null} Current user data or null if not authenticated
   */
  static getCurrentUser() {
    const authResult = this.safeAuthCheck();
    return authResult.isAuthenticated ? authResult.user : null;
  }
  
  /**
   * Get current authentication token
   * @returns {string|null} Current token or null if not authenticated
   */
  static getCurrentToken() {
    const authResult = this.safeAuthCheck();
    return authResult.isAuthenticated ? authResult.token : null;
  }
  
  /**
   * Initialize global logout functionality
   */
  static initializeGlobalLogout() {
    // Add logout functionality to logout buttons
    document.addEventListener('click', function(event) {
      if (event.target.matches('.logout-btn, [data-action="logout"]')) {
        event.preventDefault();
        AuthManager.logout();
      }
    });
    
    // Handle unauthorized responses globally
    window.addEventListener('unhandledrejection', function(event) {
      if (event.reason && event.reason.message && event.reason.message.includes('401')) {
        console.log('[AUTH] Global 401 handler - redirecting to login');
        AuthManager.logout();
      }
    });
  }
}

// Make AuthManager available globally
window.AuthManager = AuthManager;

// Initialize global logout functionality when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    AuthManager.initializeGlobalLogout();
  });
} else {
  AuthManager.initializeGlobalLogout();
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuthManager;
}