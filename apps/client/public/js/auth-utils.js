/**
 * Authentication Utilities
 * Handles authentication checks, token management, and logout functionality
 */

class AuthUtils {
    constructor() {
        this.baseUrl = window.location.origin;
        this.token = localStorage.getItem('authToken');
        this.userData = null;
        
        // Load user data from localStorage
        const storedUserData = localStorage.getItem('userData');
        if (storedUserData) {
            try {
                this.userData = JSON.parse(storedUserData);
            } catch (e) {
                console.warn('Invalid user data in localStorage');
                localStorage.removeItem('userData');
            }
        }
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return !!this.token && !!this.userData;
    }

    /**
     * Get current user data
     */
    getCurrentUser() {
        return this.userData;
    }

    /**
     * Get authentication token
     */
    getToken() {
        return this.token;
    }

    /**
     * Set authentication data
     */
    setAuthData(token, userData) {
        this.token = token;
        this.userData = userData;
        localStorage.setItem('authToken', token);
        localStorage.setItem('userData', JSON.stringify(userData));
    }

    /**
     * Clear authentication data
     */
    clearAuthData() {
        this.token = null;
        this.userData = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        sessionStorage.clear();
    }

    /**
     * Make authenticated API request
     */
    async makeAuthenticatedRequest(url, options = {}) {
        // Handle both relative and absolute URLs
        const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
        
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const response = await fetch(fullUrl, {
            ...options,
            headers
        });

        // Handle authentication errors
        if (response.status === 401 || response.status === 403) {
            console.warn('Authentication failed, redirecting to login');
            this.logout();
            return null;
        }

        return response;
    }

    /**
     * Verify token with server
     */
    async verifyToken() {
        if (!this.token) {
            return false;
        }

        try {
            const response = await this.makeAuthenticatedRequest('/api/auth/verify');
            
            if (!response || !response.ok) {
                return false;
            }

            const data = await response.json();
            if (data.success && data.user) {
                // Update user data with fresh data from server
                this.userData = data.user;
                localStorage.setItem('userData', JSON.stringify(data.user));
                return true;
            }

            return false;
        } catch (error) {
            console.error('Token verification failed:', error);
            
            // Enhanced error logging
            const errorInfo = {
                message: 'Token verification failed:',
                error: error,
                timestamp: new Date().toISOString(),
                file: 'auth-utils.js'
            };
            
            console.error('Error details:', errorInfo);
            
            // Show notification if function exists
            if (typeof showNotification === 'function') {
                showNotification('Token verification failed', 'error');
            }
            
            return false;
        }
    }

    /**
     * Check if user has required role
     */
    hasRole(requiredRole) {
        return this.userData && this.userData.role === requiredRole;
    }

    /**
     * Check if user has required agent type
     */
    hasAgentType(requiredAgentType) {
        return this.userData && 
               this.userData.role === 'agent' && 
               this.userData.agent_type === requiredAgentType;
    }

    /**
     * Perform authentication check for dashboard
     */
    async checkDashboardAuth(requiredRole, requiredAgentType = null) {
        console.log('🔐 Checking dashboard authentication...');
        
        // Check if we have basic auth data
        if (!this.isAuthenticated()) {
            console.warn('No authentication data found');
            this.redirectToLogin();
            return false;
        }

        // Verify token with server
        const tokenValid = await this.verifyToken();
        if (!tokenValid) {
            console.warn('Token verification failed');
            this.redirectToLogin();
            return false;
        }

        // Check role
        if (!this.hasRole(requiredRole)) {
            console.warn(`Required role: ${requiredRole}, User role: ${this.userData.role}`);
            this.redirectToLogin();
            return false;
        }

        // Check agent type if required
        if (requiredAgentType && !this.hasAgentType(requiredAgentType)) {
            console.warn(`Required agent type: ${requiredAgentType}, User agent type: ${this.userData.agent_type}`);
            this.redirectToLogin();
            return false;
        }

        console.log('✅ Authentication check passed');
        return true;
    }

    /**
     * Logout user
     */
    async logout() {
        console.log('🚪 Logging out user...');
        
        try {
            // Call logout API
            await this.makeAuthenticatedRequest('/api/auth/logout', {
                method: 'POST'
            });
        } catch (error) {
            console.warn('Logout API call failed:', error);
        }

        // Clear local data
        this.clearAuthData();
        
        // Redirect to login
        this.redirectToLogin();
    }

    /**
     * Redirect to login page
     */
    redirectToLogin() {
        console.log('🔄 Redirecting to login page...');
        window.location.href = `${this.baseUrl}/auth/auth-agent.html`;
    }

    /**
     * Show authentication error
     */
    showAuthError(message = 'Authentication failed. Please login again.') {
        // Create error notification
        const errorDiv = document.createElement('div');
        errorDiv.className = 'auth-error-notification';
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #dc3545;
            color: white;
            padding: 15px 20px;
            border-radius: 5px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 10000;
            font-family: Arial, sans-serif;
            max-width: 300px;
        `;
        errorDiv.innerHTML = `
            <strong>Authentication Error</strong><br>
            ${message}
        `;

        document.body.appendChild(errorDiv);

        // Auto remove after 3 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 3000);
    }

    /**
     * Initialize dashboard authentication
     */
    async initializeDashboard(requiredRole, requiredAgentType = null) {
        console.log('🚀 Initializing dashboard authentication...');
        
        // Show loading state
        this.showLoadingState();

        try {
            const authValid = await this.checkDashboardAuth(requiredRole, requiredAgentType);
            
            if (authValid) {
                // Hide loading state
                this.hideLoadingState();
                
                // Update UI with user info
                this.updateUserInterface();
                
                // Set up logout handlers
                this.setupLogoutHandlers();
                
                console.log('✅ Dashboard initialized successfully');
                return true;
            } else {
                console.warn('❌ Dashboard authentication failed');
                return false;
            }
        } catch (error) {
            console.error('Dashboard initialization error:', error);
            
            // Enhanced error logging
            const errorInfo = {
                message: 'Dashboard initialization error:',
                error: error,
                timestamp: new Date().toISOString(),
                file: 'auth-utils.js'
            };
            
            console.error('Error details:', errorInfo);
            
            // Show notification if function exists
            if (typeof showNotification === 'function') {
                showNotification('Dashboard initialization error', 'error');
            }
            
            this.showAuthError('Failed to initialize dashboard. Please try again.');
            this.redirectToLogin();
            return false;
        }
    }

    /**
     * Show loading state
     */
    showLoadingState() {
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'auth-loading';
        loadingDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255,255,255,0.9);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            font-family: Arial, sans-serif;
        `;
        loadingDiv.innerHTML = `
            <div style="text-align: center;">
                <div style="border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 2s linear infinite; margin: 0 auto 20px;"></div>
                <p>Verifying authentication...</p>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
        document.body.appendChild(loadingDiv);
    }

    /**
     * Hide loading state
     */
    hideLoadingState() {
        const loadingDiv = document.getElementById('auth-loading');
        if (loadingDiv) {
            loadingDiv.remove();
        }
    }

    /**
     * Update user interface with user info
     */
    updateUserInterface() {
        if (!this.userData) return;

        // Update agent name displays
        const agentNameElements = document.querySelectorAll('#agent-name, .agent-name');
        agentNameElements.forEach(element => {
            element.textContent = this.userData.name;
        });

        // Update agent email displays
        const agentEmailElements = document.querySelectorAll('#agent-email, .agent-email');
        agentEmailElements.forEach(element => {
            element.textContent = this.userData.email;
        });

        // Update agent type displays
        const agentTypeElements = document.querySelectorAll('#agent-type, .agent-type');
        agentTypeElements.forEach(element => {
            const agentTypeText = this.userData.agent_type ? 
                this.userData.agent_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 
                'Agent';
            element.textContent = agentTypeText;
        });
    }

    /**
     * Set up logout button handlers
     */
    setupLogoutHandlers() {
        const logoutButtons = document.querySelectorAll('#logout-btn, .logout-btn, [data-action="logout"]');
        logoutButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        });
    }
}

// Create global instance
window.authUtils = new AuthUtils();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthUtils;
}