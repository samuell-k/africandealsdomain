/**
 * LIVE DATA LOADER UTILITY
 * 
 * Provides standardized methods for loading data from backend APIs
 * ensuring no mock data is used anywhere in the system.
 */

class LiveDataLoader {
    constructor() {
        this.baseURL = window.location.origin;
        this.token = localStorage.getItem('token');
    }
    
    /**
     * Make authenticated API request
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        const config = {
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };
        
        try {
            console.log(`🔄 API Request: ${options.method || 'GET'} ${endpoint}`);
            const response = await fetch(url, config);
            
            if (!response.ok) {
                console.error('Error thrown:', `API Error: ${response.status} ${response.statusText}`);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error thrown:',
                    error: `API Error: ${response.status} ${response.statusText}`,
                    timestamp: new Date().toISOString(),
                    file: 'live-data-loader.js'
                };
                
                console.error('Error details:', errorInfo);
                showNotification(`API Error: ${response.status} ${response.statusText}`, 'error');
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log(`✅ API Success: ${endpoint}`, data);
            return data;
            
        } catch (error) {
            console.error('❌ API Failed: ${endpoint}', error);
                
                // Enhanced error logging
                const errorInfo = {
                    message: '❌ API Failed: ${endpoint}',
                    error: error,
                    timestamp: new Date().toISOString(),
                    file: 'live-data-loader.js'
                };
                
                console.error('Error details:', errorInfo);
showNotification('❌ API Failed: ${endpoint}', 'error');

// Enhanced error logging
if (error && error.message) {
    console.error('Error details:', error.message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error details:',
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    file: 'live-data-loader.js'
                };
                
                console.error('Error details:', errorInfo);
}
            throw error;
        }
    }
    
    /**
     * Load user data
     */
    async loadUserData(userId) {
        return await this.request(`/api/users/${userId}`);
    }
    
    /**
     * Load products data
     */
    async loadProducts(filters = {}) {
        const params = new URLSearchParams(filters);
        return await this.request(`/api/products?${params}`);
    }
    
    /**
     * Load orders data
     */
    async loadOrders(filters = {}) {
        const params = new URLSearchParams(filters);
        return await this.request(`/api/orders?${params}`);
    }
    
    /**
     * Load analytics data
     */
    async loadAnalytics(type, period = '30d') {
        return await this.request(`/api/analytics/${type}?period=${period}`);
    }
    
    /**
     * Load payments data
     */
    async loadPayments(filters = {}) {
        const params = new URLSearchParams(filters);
        return await this.request(`/api/payments?${params}`);
    }
    
    /**
     * Generic data renderer
     */
    renderData(containerId, data, renderFunction) {
        const container = document.getElementById(containerId);
        if (container && renderFunction) {
            container.innerHTML = renderFunction(data);
        }
    }
    
    /**
     * Show loading state
     */
    showLoading(containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="flex items-center justify-center p-8">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span class="ml-2 text-gray-600">Loading live data...</span>
                </div>
            `;
        }
    }
    
    /**
     * Show error state
     */
    showError(containerId, message) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                    <i class="fas fa-exclamation-triangle text-red-500 mb-2"></i>
                    <p class="text-red-700">Error loading data: ${message}</p>
                    <button onclick="window.location.reload()" class="mt-2 text-blue-600 hover:underline">
                        Retry
                    </button>
                </div>
            `;
        }
    }
}

// Global instance
window.LiveDataLoader = new LiveDataLoader();

// Ensure no mock data warning
console.log('🚀 Live Data Loader initialized - NO MOCK DATA ALLOWED');
console.warn('⚠️  MOCK DATA DETECTION: Any hardcoded data should be replaced with API calls');