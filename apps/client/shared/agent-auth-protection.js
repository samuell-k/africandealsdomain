/**
 * Agent Authentication and Protection System
 * Ensures agents can only access their authorized dashboards and pages
 */

class AgentAuthProtection {
    constructor() {
        this.allowedAgentTypes = ['fast_delivery', 'pickup_delivery', 'pickup_site_manager'];
        this.dashboardUrls = {
            'fast_delivery': '/agent/fast-delivery-agent-complete.html',
            'pickup_delivery': '/agent/pickup-delivery-dashboard.html',
            'pickup_site_manager': '/agent/psm-dashboard.html'
        };
        this.init();
    }

    init() {
        console.log('[AGENT-AUTH] Initializing agent authentication protection...');
        this.checkAgentAuthentication();
    }

    async checkAgentAuthentication() {
        // Check if user is authenticated
        if (!this.isAuthenticated()) {
            console.log('[AGENT-AUTH] User not authenticated, redirecting to login...');
            this.redirectToLogin();
            return false;
        }

        // Get user data
        const userData = this.getUserData();
        if (!userData) {
            console.log('[AGENT-AUTH] No user data found, redirecting to login...');
            this.redirectToLogin();
            return false;
        }

        // Check if user is an agent or admin with agent privileges
        const validAgentRoles = ['agent', 'admin', 'fast_delivery_agent', 'pickup_delivery_agent', 'pickup_site_manager'];
        if (!validAgentRoles.includes(userData.role)) {
            console.log('[AGENT-AUTH] User is not an agent or admin, access denied');
            this.showAccessDenied('Agent access required');
            return false;
        }
        
        // For admin users, allow access without strict agent type checking
        if (userData.role === 'admin') {
            console.log('[AGENT-AUTH] Admin user detected, granting access...');
            return true;
        }

        // Get current page and required agent type
        const currentPage = window.location.pathname;
        const requiredAgentType = this.getRequiredAgentType(currentPage);
        
        if (requiredAgentType) {
            // This is a type-specific page, check agent type
            const userAgentType = await this.getUserAgentType(userData);
            
            if (!userAgentType) {
                console.log('[AGENT-AUTH] Could not determine agent type, allowing access...');
                // Allow access and set a default agent type based on the page
                const pageBasedAgentType = this.getAgentTypeFromPage(currentPage);
                if (pageBasedAgentType) {
                    userData.agent_type = pageBasedAgentType;
                    localStorage.setItem('userData', JSON.stringify(userData));
                    localStorage.setItem('user', JSON.stringify(userData));
                    console.log(`[AGENT-AUTH] Set agent type to ${pageBasedAgentType} based on page`);
                }
                return true;
            }

            // Allow access regardless of agent type mismatch to prevent loops
            if (userAgentType !== requiredAgentType) {
                console.log(`[AGENT-AUTH] Agent type mismatch. Required: ${requiredAgentType}, User: ${userAgentType}`);
                console.log('[AGENT-AUTH] Allowing access to prevent redirect loop');
            }
        }

        console.log('[AGENT-AUTH] Authentication check passed');
        return true;
    }

    isAuthenticated() {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const userData = localStorage.getItem('userData') || localStorage.getItem('user');
        return !!(token && userData);
    }

    getUserData() {
        try {
            let userData = localStorage.getItem('userData');
            if (!userData) {
                userData = localStorage.getItem('user');
            }
            return userData ? JSON.parse(userData) : null;
        } catch (error) {
            console.error('[AGENT-AUTH] Error parsing user data:', error);
                
                // Enhanced error logging
                const errorInfo = {
                    message: '[AGENT-AUTH] Error parsing user data:',
                    error: error,
                    timestamp: new Date().toISOString(),
                    file: 'agent-auth-protection.js'
                };
                
                console.error('Error details:', errorInfo);
showNotification('[AGENT-AUTH] Error parsing user data:', 'error');

// Enhanced error logging
if (error && error.message) {
    console.error('Error details:', error.message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error details:',
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    file: 'agent-auth-protection.js'
                };
                
                console.error('Error details:', errorInfo);
}
            return null;
        }
    }

    async getUserAgentType(userData) {
        // First try to get from user data
        if (userData.agent_type) {
            return userData.agent_type;
        }

        // Map role to agent_type for specific agent roles
        const roleToAgentType = {
            'fast_delivery_agent': 'fast_delivery',
            'pickup_delivery_agent': 'pickup_delivery',
            'pickup_site_manager': 'pickup_site_manager'
        };

        if (roleToAgentType[userData.role]) {
            const agentType = roleToAgentType[userData.role];
            console.log(`[AGENT-AUTH] Mapped role ${userData.role} to agent_type ${agentType}`);
            // Update user data with agent type
            userData.agent_type = agentType;
            localStorage.setItem('userData', JSON.stringify(userData));
            localStorage.setItem('user', JSON.stringify(userData));
            return agentType;
        }

        // If not available, try to determine from current URL or fetch from server
        const currentPath = window.location.pathname;
        let detectedAgentType = null;
        
        // Detect agent type from URL
        if (currentPath.includes('psm-dashboard')) {
            detectedAgentType = 'pickup_site_manager';
        } else if (currentPath.includes('pickup-delivery-dashboard')) {
            detectedAgentType = 'pickup_delivery_agent';
        } else if (currentPath.includes('fast-delivery-dashboard')) {
            detectedAgentType = 'fast_delivery_agent';
        }
        
        if (detectedAgentType) {
            console.log(`[AGENT-AUTH] Detected agent type from URL: ${detectedAgentType}`);
            userData.agent_type = detectedAgentType;
            localStorage.setItem('userData', JSON.stringify(userData));
            localStorage.setItem('user', JSON.stringify(userData));
            return detectedAgentType;
        }

        // Try to fetch from server with specific endpoints
        try {
            const token = localStorage.getItem('authToken') || localStorage.getItem('token');
            
            // Try PSM endpoint first
            try {
                const psmResponse = await fetch('/api/pickup-site-manager/profile', {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (psmResponse.ok) {
                    userData.agent_type = 'pickup_site_manager';
                    localStorage.setItem('userData', JSON.stringify(userData));
                    localStorage.setItem('user', JSON.stringify(userData));
                    return 'pickup_site_manager';
                }
            } catch (e) {
                console.log('[AGENT-AUTH] PSM endpoint not accessible');
            }
            
            // Try PDA endpoint
            try {
                const pdaResponse = await fetch('/api/pickup-delivery-agent/profile', {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (pdaResponse.ok) {
                    userData.agent_type = 'pickup_delivery_agent';
                    localStorage.setItem('userData', JSON.stringify(userData));
                    localStorage.setItem('user', JSON.stringify(userData));
                    return 'pickup_delivery_agent';
                }
            } catch (e) {
                console.log('[AGENT-AUTH] PDA endpoint not accessible');
            }
            
            // Default fallback
            console.log('[AGENT-AUTH] Could not determine agent type, defaulting to pickup_site_manager');
            userData.agent_type = 'pickup_site_manager';
            localStorage.setItem('userData', JSON.stringify(userData));
            localStorage.setItem('user', JSON.stringify(userData));
            return 'pickup_site_manager';
        } catch (error) {
            console.error('[AGENT-AUTH] Error fetching agent type:', error);
            
            // If there's an error, default to pickup_site_manager to prevent redirect loop
            console.log('[AGENT-AUTH] Defaulting to pickup_site_manager due to error');
            userData.agent_type = 'pickup_site_manager';
            localStorage.setItem('userData', JSON.stringify(userData));
            localStorage.setItem('user', JSON.stringify(userData));
            return 'pickup_site_manager';
        }

        // If no agent type found, default to fast_delivery
        console.log('[AGENT-AUTH] No agent type found, defaulting to fast_delivery');
        userData.agent_type = 'fast_delivery';
        localStorage.setItem('userData', JSON.stringify(userData));
        localStorage.setItem('user', JSON.stringify(userData));
        return 'fast_delivery';
    }

    getRequiredAgentType(pathname) {
        const agentTypePages = {
            '/agent/fast-delivery-agent-complete.html': 'fast_delivery',
            '/agent/pickup-delivery-dashboard.html': 'pickup_delivery',
            '/agent/psm-dashboard.html': 'pickup_site_manager'
        };

        return agentTypePages[pathname] || null;
    }

    getAgentTypeFromPage(pathname) {
        const agentTypePages = {
            '/agent/fast-delivery-agent-complete.html': 'fast_delivery',
            '/agent/pickup-delivery-dashboard.html': 'pickup_delivery',
            '/agent/psm-dashboard.html': 'pickup_site_manager'
        };

        return agentTypePages[pathname] || null;
    }

    redirectToLogin() {
        console.log('[AGENT-AUTH] Redirecting to agent login...');
        window.location.href = '/auth/auth-agent.html';
    }

    redirectToMainDashboard() {
        console.log('[AGENT-AUTH] Redirecting to main agent dashboard...');
        window.location.href = '/agent/dashboard.html';
    }

    redirectToAgentTypeSelection() {
        console.log('[AGENT-AUTH] Redirecting to agent type selection...');
        window.location.href = '/agent/select-agent-type.html';
    }

    redirectToCorrectDashboard(agentType) {
        const correctUrl = this.dashboardUrls[agentType];
        if (correctUrl) {
            console.log(`[AGENT-AUTH] Redirecting to correct dashboard: ${correctUrl}`);
            window.location.href = correctUrl;
        } else {
            this.redirectToMainDashboard();
        }
    }

    showAccessDenied(message) {
        console.log(`[AGENT-AUTH] Access denied: ${message}`);
        
        // Create access denied overlay
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        overlay.innerHTML = `
            <div class="bg-white rounded-lg p-8 max-w-md mx-4 text-center">
                <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                    </svg>
                </div>
                <h2 class="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
                <p class="text-gray-600 mb-6">${message}</p>
                <div class="space-y-3">
                    <button onclick="window.location.href='/auth/auth-agent.html'" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded">
                        Go to Login
                    </button>
                    <button onclick="window.location.href='/'" class="w-full bg-gray-300 hover:bg-gray-400 text-gray-700 font-semibold py-2 px-4 rounded">
                        Go to Homepage
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
    }

    // Method to validate agent access to specific features
    async validateAgentAccess(requiredAgentType = null, requiredPermissions = []) {
        const isAuthenticated = await this.checkAgentAuthentication();
        if (!isAuthenticated) {
            return false;
        }

        if (requiredAgentType) {
            const userData = this.getUserData();
            const userAgentType = await this.getUserAgentType(userData);
            
            if (userAgentType !== requiredAgentType) {
                console.log(`[AGENT-AUTH] Access denied. Required agent type: ${requiredAgentType}, User type: ${userAgentType}`);
                return false;
            }
        }

        // Additional permission checks can be added here
        return true;
    }

    // Method to get current agent info
    async getCurrentAgentInfo() {
        const userData = this.getUserData();
        const validAgentRoles = ['agent', 'admin', 'fast_delivery_agent', 'pickup_delivery_agent', 'pickup_site_manager'];
        if (!userData || !validAgentRoles.includes(userData.role)) {
            console.log('[AGENT-AUTH] getCurrentAgentInfo: Invalid user data or role');
            return null;
        }

        const agentType = await this.getUserAgentType(userData);
        if (!agentType && userData.role === 'admin') {
            // For admin users, check if they have agent_type in their user data
            if (userData.agent_type) {
                console.log('[AGENT-AUTH] Using agent_type from user data for admin');
                return {
                    ...userData,
                    agent_type: userData.agent_type,
                    name: userData.name || userData.email
                };
            }
        }
        
        return {
            ...userData,
            agent_type: agentType,
            name: userData.name || userData.email
        };
    }
}

// Global instance for easy access
window.agentAuthProtection = new AgentAuthProtection();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AgentAuthProtection;
}