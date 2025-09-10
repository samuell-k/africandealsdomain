/**
 * Authentication Utilities
 * Handles user authentication state across all pages
 */

class AuthUtils {
  constructor() {
    // Use consistent localStorage keys with auth-check.js
    this.token = localStorage.getItem('authToken');
    this.user = this.getUser();
    this.init();
  }

  init() {
    // Check if this is a fresh login - if so, don't do automatic auth checks
    const freshLogin = sessionStorage.getItem('freshLogin');
    const loginTimestamp = sessionStorage.getItem('loginTimestamp');
    
    if (freshLogin && loginTimestamp) {
      const timeSinceLogin = Date.now() - parseInt(loginTimestamp);
      
      // If login was within last 10 seconds, skip automatic auth checks
      if (timeSinceLogin < 10000) {
        console.log('[AUTH-UTILS] Fresh login detected, skipping automatic auth checks...');
        // Still set up token validation but delay it
        setTimeout(() => {
          this.setupTokenValidation();
        }, 5000);
        return;
      }
    }
    
    // Check authentication on page load (only if not fresh login)
    this.checkAuthState();
    
    // Set up periodic token validation
    this.setupTokenValidation();
  }

  getUser() {
    try {
      // Use consistent localStorage key with auth-check.js
      const userData = localStorage.getItem('userData');
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('[AUTH-UTILS] Error parsing user data:', error);
      if (typeof showNotification === 'function') {
        showNotification('Error parsing user data', 'error');
      }
      return null;
    }
  }

  isAuthenticated() {
    return !!(this.token && this.user);
  }

  getUserRole() {
    if (!this.user || typeof this.user !== 'object') {
      return null;
    }
    return this.user.role || null;
  }

  getUserName() {
    if (!this.user || typeof this.user !== 'object') {
      return 'User';
    }
    return this.user.name || 'User';
  }

  getUserEmail() {
    if (!this.user || typeof this.user !== 'object') {
      return '';
    }
    return this.user.email || '';
  }

  getUserId() {
    if (!this.user || typeof this.user !== 'object') {
      return null;
    }
    return this.user.id || null;
  }

  checkAuthState() {
    if (!this.isAuthenticated()) {
      console.log('[AUTH-UTILS] User not authenticated');
      return false;
    }
    
    // Validate token if authenticated
    this.validateToken();
    return true;
  }

  setupTokenValidation() {
    // Validate token every 5 minutes
    setInterval(() => {
      if (this.isAuthenticated()) {
        this.validateToken();
      }
    }, 5 * 60 * 1000);
  }

  async validateToken() {
    try {
      const response = await fetch('/api/auth/validate', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn('[AUTH-UTILS] Token validation failed:', response.status);
        return false;
      }

      const data = await response.json();
      return data.valid === true;
    } catch (error) {
      console.error('[AUTH-UTILS] Token validation error:', error);
      return false;
    }
  }

  logout() {
    // Clear all auth data
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    sessionStorage.removeItem('freshLogin');
    sessionStorage.removeItem('loginTimestamp');
    
    // Redirect to login page
    const currentRole = this.getUserRole() || 'buyer';
    window.location.href = `/auth/auth-${currentRole}.html`;
  }

  // Helper method for API requests
  async fetchWithAuth(url, options = {}) {
    try {
      // Ensure headers exist
      options.headers = options.headers || {};
      
      // Add auth token if available
      if (this.token) {
        options.headers['Authorization'] = `Bearer ${this.token}`;
      }
      
      // Add content type if not specified
      if (!options.headers['Content-Type']) {
        options.headers['Content-Type'] = 'application/json';
      }
      
      // Make the request
      const response = await fetch(url, options);
      
      // Handle response
      if (!response.ok) {
        console.error('[AUTH-UTILS] API request failed:', response.status, response.statusText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Parse response based on content type
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        return await response.text();
      }
    } catch (error) {
      console.error('[AUTH-UTILS] API request error:', error);
      throw error;
    }
  }
}

// Initialize auth utils if not already initialized
if (typeof window !== 'undefined' && !window.authUtils) {
  window.authUtils = new AuthUtils();
}