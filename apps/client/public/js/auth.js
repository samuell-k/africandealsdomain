/**
 * Authentication utilities for admin and user interfaces
 * This file provides authentication functions used across the platform
 */

// Initialize auth utilities
const authUtils = new AuthUtils();

/**
 * Check admin authentication
 */
async function checkAdminAuth() {
    console.log('🔐 Checking admin authentication...');
    
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    if (!token) {
        console.warn('No authentication token found');
        redirectToLogin();
        return false;
    }

    try {
        const response = await fetch('/api/auth/verify', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Authentication verification failed');
        }

        const data = await response.json();
        
        if (data.success && data.user) {
            // Check if user is admin
            if (data.user.role !== 'admin') {
                console.warn('User is not an admin');
                redirectToLogin();
                return false;
            }

            // Store user data
            localStorage.setItem('userData', JSON.stringify(data.user));
            console.log('✅ Admin authentication verified');
            return true;
        } else {
            throw new Error('Invalid authentication response');
        }
    } catch (error) {
        console.error('Admin authentication check failed:', error);
        redirectToLogin();
        return false;
    }
}

/**
 * Check user authentication (for buyers, sellers, agents)
 */
async function checkUserAuth() {
    console.log('🔐 Checking user authentication...');
    
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    if (!token) {
        console.warn('No authentication token found');
        redirectToLogin();
        return false;
    }

    try {
        const response = await fetch('/api/auth/verify', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Authentication verification failed');
        }

        const data = await response.json();
        
        if (data.success && data.user) {
            // Store user data
            localStorage.setItem('userData', JSON.stringify(data.user));
            console.log('✅ User authentication verified');
            return data.user;
        } else {
            throw new Error('Invalid authentication response');
        }
    } catch (error) {
        console.error('User authentication check failed:', error);
        redirectToLogin();
        return false;
    }
}

/**
 * Get current user data
 */
function getCurrentUser() {
    const userData = localStorage.getItem('userData');
    if (userData) {
        try {
            return JSON.parse(userData);
        } catch (error) {
            console.error('Error parsing user data:', error);
            return null;
        }
    }
    return null;
}

/**
 * Get authentication token
 */
function getAuthToken() {
    return localStorage.getItem('token') || localStorage.getItem('authToken');
}

/**
 * Make authenticated API request
 */
async function makeAuthenticatedRequest(url, options = {}) {
    const token = getAuthToken();
    
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    // Handle authentication errors
    if (response.status === 401 || response.status === 403) {
        console.warn('Authentication failed, redirecting to login');
        logout();
        return null;
    }

    return response;
}

/**
 * Logout function
 */
async function logout() {
    console.log('🚪 Logging out user...');
    
    try {
        const token = getAuthToken();
        if (token) {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
        }
    } catch (error) {
        console.warn('Logout API call failed:', error);
    }

    // Clear local storage
    localStorage.removeItem('token');
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    sessionStorage.clear();
    
    // Redirect to login
    redirectToLogin();
}

/**
 * Redirect to login page
 */
function redirectToLogin() {
    console.log('🔄 Redirecting to login page...');
    
    // Determine the correct login page based on current path
    const currentPath = window.location.pathname;
    let loginUrl = '/auth/auth-agent.html';
    
    if (currentPath.includes('/admin/')) {
        loginUrl = '/auth/auth-agent.html'; // Admin login
    } else if (currentPath.includes('/buyer/')) {
        loginUrl = '/auth/auth-agent.html'; // Buyer login
    } else if (currentPath.includes('/seller/')) {
        loginUrl = '/auth/auth-agent.html'; // Seller login
    }
    
    window.location.href = loginUrl;
}

/**
 * Show error message
 */
function showError(message) {
    console.error('Error:', message);
    
    // Try to use existing notification system
    if (typeof showNotification === 'function') {
        showNotification(message, 'error');
        return;
    }
    
    if (typeof showToast === 'function') {
        showToast(message, 'error');
        return;
    }
    
    // Fallback to alert
    alert('Error: ' + message);
}

/**
 * Show success message
 */
function showSuccess(message) {
    console.log('Success:', message);
    
    // Try to use existing notification system
    if (typeof showNotification === 'function') {
        showNotification(message, 'success');
        return;
    }
    
    if (typeof showToast === 'function') {
        showToast(message, 'success');
        return;
    }
    
    // Fallback to alert
    alert('Success: ' + message);
}

/**
 * Format currency
 */
function formatCurrency(amount, currency = 'RWF') {
    if (typeof amount !== 'number') {
        amount = parseFloat(amount) || 0;
    }
    
    return new Intl.NumberFormat('en-RW', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(amount);
}

/**
 * Format price (simple version)
 */
function formatPrice(amount) {
    if (typeof amount !== 'number') {
        amount = parseFloat(amount) || 0;
    }
    
    return amount.toLocaleString('en-RW');
}

/**
 * Initialize authentication on page load
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Auth.js loaded and ready');
    
    // Set up global logout handlers
    const logoutButtons = document.querySelectorAll('[onclick="logout()"], .logout-btn');
    logoutButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            logout();
        });
    });
});

// Export functions for global use
window.checkAdminAuth = checkAdminAuth;
window.checkUserAuth = checkUserAuth;
window.getCurrentUser = getCurrentUser;
window.getAuthToken = getAuthToken;
window.makeAuthenticatedRequest = makeAuthenticatedRequest;
window.logout = logout;
window.redirectToLogin = redirectToLogin;
window.showError = showError;
window.showSuccess = showSuccess;
window.formatCurrency = formatCurrency;
window.formatPrice = formatPrice;