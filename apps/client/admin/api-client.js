// API Client for Admin Dashboard
class APIClient {
    constructor() {
        this.baseURL = window.location.origin;
        this.token = localStorage.getItem('adminToken') || localStorage.getItem('token');
    }

    // Get authentication headers
    getAuthHeaders() {
        // Always read the freshest token from storage to avoid staleness
        const latestToken = localStorage.getItem('adminToken') || localStorage.getItem('token') || localStorage.getItem('authToken');
        if (latestToken) this.token = latestToken;
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        
        return headers;
    }

    // Make authenticated request
    async makeAuthenticatedRequest(endpoint, options = {}) {
        try {
            const url = `${this.baseURL}${endpoint}`;
            const config = {
                headers: this.getAuthHeaders(),
                ...options
            };

            console.log(`🌐 API Request: ${options.method || 'GET'} ${endpoint}`);
            
            let response = await fetch(url, config);
            
            // If unauthorized, try silent refresh once and retry
            if (response.status === 401 || response.status === 403) {
                const lastTry = Number(localStorage.getItem('adminApiSilentRefreshAt') || '0');
                const now = Date.now();
                if (now - lastTry > 10000) {
                    localStorage.setItem('adminApiSilentRefreshAt', String(now));
                    try {
                        // Attempt to refresh using the admin-auth-check helper if present
                        if (window.AdminAuth && typeof window.AdminAuth.refreshToken === 'function') {
                            const currentToken = this.token;
                            const newToken = await window.AdminAuth.refreshToken(currentToken);
                            if (newToken) {
                                this.updateToken(newToken);
                                config.headers = this.getAuthHeaders();
                                response = await fetch(url, config);
                            }
                        }
                    } catch (_) {}
                }
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log(`✅ API Response: ${endpoint}`, data);
            
            return data;
            
        } catch (error) {
            console.error(`❌ API Error: ${endpoint}`, error);
            throw error;
        }
    }

    // GET request
    async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        
        return this.makeAuthenticatedRequest(url, {
            method: 'GET'
        });
    }

    // POST request
    async post(endpoint, data = {}) {
        return this.makeAuthenticatedRequest(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // PUT request
    async put(endpoint, data = {}) {
        return this.makeAuthenticatedRequest(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    // DELETE request
    async delete(endpoint) {
        return this.makeAuthenticatedRequest(endpoint, {
            method: 'DELETE'
        });
    }

    // Upload file
    async uploadFile(endpoint, formData) {
        try {
            const url = `${this.baseURL}${endpoint}`;
            const headers = {};
            
            if (this.token) {
                headers['Authorization'] = `Bearer ${this.token}`;
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
            
        } catch (error) {
            console.error(`❌ Upload Error: ${endpoint}`, error);
            throw error;
        }
    }

    // Download file
    async downloadFile(endpoint, filename) {
        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, {
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
        } catch (error) {
            console.error(`❌ Download Error: ${endpoint}`, error);
            throw error;
        }
    }

    // Batch requests
    async batch(requests) {
        try {
            const promises = requests.map(req => 
                this.makeAuthenticatedRequest(req.endpoint, req.options)
            );
            
            return await Promise.all(promises);
            
        } catch (error) {
            console.error('❌ Batch Request Error:', error);
            throw error;
        }
    }

    // Health check
    async healthCheck() {
        try {
            return await this.get('/api/admin/health');
        } catch (error) {
            console.error('❌ Health Check Failed:', error);
            return { success: false, error: error.message };
        }
    }

    // Update token
    updateToken(newToken) {
        this.token = newToken;
        localStorage.setItem('adminToken', newToken);
    }

    // Clear token
    clearToken() {
        this.token = null;
        localStorage.removeItem('adminToken');
        localStorage.removeItem('token');
    }
}

// Create global instance
const apiClient = new APIClient();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = APIClient;
}