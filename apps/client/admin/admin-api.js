
// Unified Admin API Client
class UnifiedAdminAPI {
    constructor() {
        this.baseUrl = '/api/admin';
        this.token = localStorage.getItem('adminToken');
        this.refreshToken = localStorage.getItem('refreshToken');
    }
    
    async request(endpoint, options = {}) {
        const url = this.baseUrl + endpoint;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + this.token,
                ...options.headers
            },
            ...options
        };
        
        try {
            const response = await fetch(url, config);
            
            if (response.status === 401) {
                // Token expired, try to refresh
                const refreshed = await this.refreshAuthToken();
                if (refreshed) {
                    // Retry the request with new token
                    config.headers['Authorization'] = 'Bearer ' + this.token;
                    return await fetch(url, config);
                } else {
                    // Refresh failed, redirect to login
                    window.location.href = '/auth/auth-admin.html';
                    return;
                }
            }
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    }
    
    async refreshAuthToken() {
        try {
            const response = await fetch('/api/auth/refresh', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    refreshToken: this.refreshToken
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                this.token = data.token;
                localStorage.setItem('adminToken', data.token);
                return true;
            }
        } catch (error) {
            console.error('Token refresh failed:', error);
        }
        
        return false;
    }
    
    // Dashboard APIs
    async getDashboard() {
        return await this.request('/dashboard');
    }
    
    async getAnalytics(period = '30') {
        return await this.request(`/analytics?period=${period}`);
    }
    
    // User Management APIs
    async getUsers(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return await this.request(`/users?${queryString}`);
    }
    
    async updateUserStatus(userId, status, reason) {
        return await this.request(`/users/${userId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status, reason })
        });
    }
    
    // Agent Management APIs
    async getAgents(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return await this.request(`/agents?${queryString}`);
    }
    
    async approveAgent(agentId, reason) {
        return await this.request(`/agents/${agentId}/approve`, {
            method: 'POST',
            body: JSON.stringify({ reason })
        });
    }
    
    async rejectAgent(agentId, reason) {
        return await this.request(`/agents/${agentId}/reject`, {
            method: 'POST',
            body: JSON.stringify({ reason })
        });
    }
    
    // Product Management APIs
    async getProducts(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return await this.request(`/products?${queryString}`);
    }
    
    async approveProduct(productId) {
        return await this.request(`/products/${productId}/approve`, {
            method: 'POST'
        });
    }
    
    // Order Management APIs
    async getOrders(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return await this.request(`/orders?${queryString}`);
    }
    
    async updateOrderStatus(orderId, status) {
        return await this.request(`/orders/${orderId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
    }
    
    // Payment Management APIs
    async getPayments(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return await this.request(`/payments?${queryString}`);
    }
    
    async approvePayment(paymentId) {
        return await this.request(`/payments/${paymentId}/approve`, {
            method: 'POST'
        });
    }
    
    // Generic CRUD operations
    async create(endpoint, data) {
        return await this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
    
    async update(endpoint, data) {
        return await this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }
    
    async delete(endpoint) {
        return await this.request(endpoint, {
            method: 'DELETE'
        });
    }
    
    // System APIs
    async getSystemLogs(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return await this.request(`/system-logs?${queryString}`);
    }
    
    async healthCheck() {
        return await this.request('/health-check');
    }
}

// Export for global use
window.AdminAPI = UnifiedAdminAPI;
