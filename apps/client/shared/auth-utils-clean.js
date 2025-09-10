/**
 * Authentication Utilities - Clean Version
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
      console.error('Error parsing user data:', error);
      return null;
    }
  }

  isAuthenticated() {
    return !!(this.token && this.user);
  }

  getToken() {
    return this.token || localStorage.getItem('authToken');
  }

  getUserData() {
    return this.user || this.getUser();
  }

  async checkAuthState() {
    if (!this.isAuthenticated()) {
      console.log('[AUTH-UTILS] User not authenticated');
      return false;
    }

    try {
      const isValid = await this.validateToken();
      if (!isValid) {
        console.log('[AUTH-UTILS] Token validation failed');
        this.logout();
        return false;
      }
      return true;
    } catch (error) {
      console.error('[AUTH-UTILS] Auth state check failed:', error);
      return false;
    }
  }

  async validateToken() {
    if (!this.token) {
      return false;
    }

    try {
      const response = await fetch('/api/auth/validate', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error('[AUTH] Token validation failed:', response.status);
        return false;
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('[AUTH] Expected JSON response but got:', contentType);
        throw new Error('Invalid response format - expected JSON');
      }

      const data = await response.json();
      
      if (data.success && data.user) {
        // Update user data if it has changed
        const currentUserData = JSON.stringify(this.user);
        const newUserData = JSON.stringify(data.user);
        
        if (currentUserData !== newUserData) {
          localStorage.setItem('userData', newUserData);
          this.user = data.user;
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[AUTH] Token validation error:', error);
      // Don't logout on network errors during page load
      if (document.readyState === 'complete' && !error.message.includes('fetch') && !error.message.includes('NetworkError')) {
        this.logout();
      }
      return false;
    }
  }

  setupTokenValidation() {
    // Validate token every 5 minutes
    setInterval(() => {
      this.validateToken().catch(error => {
        console.error('[AUTH] Periodic token validation failed:', error);
      });
    }, 5 * 60 * 1000);
  }

  logout() {
    console.log('[AUTH-UTILS] Logging out user...');
    
    // Clear all auth-related data
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.clear();
    
    // Redirect to login
    window.location.href = '/auth/login.html';
  }

  redirectToLogin() {
    console.log('[AUTH-UTILS] Redirecting to login...');
    window.location.href = '/auth/login.html';
  }

  showAccessDenied(message = 'Access denied') {
    console.error('[AUTH-UTILS] Access denied:', message);
    
    // Show error message
    if (typeof showNotification === 'function') {
      showNotification(message, 'error');
    } else {
      alert(message);
    }
    
    // Redirect after showing message
    setTimeout(() => {
      this.redirectToLogin();
    }, 2000);
  }

  // API request helper with authentication
  async makeAuthenticatedRequest(url, options = {}) {
    const token = this.getToken();
    if (!token) {
      throw new Error('No authentication token available');
    }

    const defaultOptions = {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const requestOptions = { ...defaultOptions, ...options };

    try {
      const response = await fetch(url, requestOptions);

      if (!response.ok) {
        console.error('[AUTH] Request failed:', response.status, response.statusText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else if (contentType && contentType.includes('text/html')) {
        console.error('[AUTH] Received HTML response instead of JSON from:', url);
        throw new Error('Unexpected HTML response from API');
      } else {
        return await response.text();
      }
    } catch (error) {
      console.error('[AUTH] Request error:', error);
      throw error;
    }
  }

  // Helper method for API calls
  async apiCall(endpoint, options = {}) {
    const baseUrl = window.location.origin;
    const url = endpoint.startsWith('/') ? `${baseUrl}${endpoint}` : `${baseUrl}/${endpoint}`;
    
    try {
      const response = await this.makeAuthenticatedRequest(url, options);
      return response;
    } catch (error) {
      console.error('API request error:', error);
      throw error;
    }
  }
}

// Global utility functions
function getAuthToken() {
  return localStorage.getItem('authToken');
}

function getUserData() {
  try {
    const userData = localStorage.getItem('userData');
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('Error parsing user data:', error);
    return null;
  }
}

function isAuthenticated() {
  return !!(getAuthToken() && getUserData());
}

function logout() {
  if (window.authUtils) {
    window.authUtils.logout();
  } else {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/auth/login.html';
  }
}

// Initialize auth utils when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  if (!window.authUtils) {
    window.authUtils = new AuthUtils();
  }
});

// Also initialize immediately if DOM is already loaded
if (document.readyState === 'loading') {
  // DOM is still loading
} else {
  // DOM is already loaded
  if (!window.authUtils) {
    window.authUtils = new AuthUtils();
  }
}