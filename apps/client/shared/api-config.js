/**
 * API Configuration for ADD Physical Products Platform
 * Handles dynamic port detection and fallback configuration
 */

// Dynamic API base URL with fallback ports
const API_BASE_URL = (() => {
    const currentPort = window.location.port;
    const currentHost = window.location.hostname;
    
    // If we're already on port 3001 or 3002, use that
    if (currentPort === '3001' || currentPort === '3002') {
        return `http://${currentHost}:${currentPort}`;
    }
    
    // Default fallback to 3001
    return `http://${currentHost}:3001`;
})();

// WebSocket URL configuration
const WS_BASE_URL = API_BASE_URL.replace('http', 'ws');

// Export for use in other scripts
window.API_CONFIG = {
    API_BASE_URL,
    WS_BASE_URL,
    
    // Helper function to get API URL with endpoint
    getApiUrl: (endpoint) => {
        return `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    },
    
    // Helper function to get WebSocket URL
    getWsUrl: () => {
        return WS_BASE_URL;
    },
    
    // Helper function to make authenticated requests
    makeAuthenticatedRequest: async (endpoint, options = {}) => {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
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
        
        const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
        
        try {
            const response = await fetch(url, mergedOptions);
            
            // Handle authentication errors
            if (response.status === 401 || response.status === 403) {
                console.error('[API] Authentication failed, redirecting to login');
                window.location.href = '/auth/auth-agent.html';
                return null;
            }
            
            return response;
        } catch (error) {
            console.error('[API] Request failed:', error);
            throw error;
        }
    }
};

console.log('[API-CONFIG] Initialized with base URL:', API_BASE_URL);