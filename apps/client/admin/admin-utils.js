// Admin Utilities - Shared functions for all admin pages
// This file contains common utilities used across admin pages

class AdminUtils {
    constructor() {
        this.init();
    }

    init() {
        console.log('🛠️ Admin Utils initializing...');
        this.setupGlobalErrorHandler();
        this.setupKeyboardShortcuts();
    }

    // Setup global error handler
    setupGlobalErrorHandler() {
        window.addEventListener('error', (event) => {
            console.error('Global error caught:', event.error);
            this.logError('JavaScript Error', event.error);
        });

        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.logError('Promise Rejection', event.reason);
        });
    }

    // Setup keyboard shortcuts
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + R for refresh
            if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
                e.preventDefault();
                this.refreshCurrentPage();
            }
            
            // Ctrl/Cmd + L for logout
            if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
                e.preventDefault();
                if (window.adminAuth) {
                    window.adminAuth.logout();
                }
            }
        });
    }

    // Log error to console and potentially to server
    logError(type, error) {
        const errorInfo = {
            type: type,
            message: error.message || error,
            stack: error.stack,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent
        };

        console.error('Error logged:', errorInfo);

        // Optionally send to server for logging
        this.sendErrorToServer(errorInfo).catch(e => {
            console.warn('Failed to send error to server:', e);
        });
    }

    // Send error to server
    async sendErrorToServer(errorInfo) {
        try {
            if (window.adminAuth) {
                await window.adminAuth.makeAuthenticatedRequest('/api/admin/logs/error', {
                    method: 'POST',
                    body: JSON.stringify(errorInfo)
                });
            }
        } catch (e) {
            // Silently fail - don't want error logging to cause more errors
        }
    }

    // Refresh current page data
    refreshCurrentPage() {
        console.log('🔄 Refreshing current page...');
        
        // Try to call page-specific refresh functions
        if (typeof window.loadDashboardData === 'function') {
            window.loadDashboardData();
        } else if (typeof window.loadUsers === 'function') {
            window.loadUsers();
        } else if (typeof window.loadApprovals === 'function') {
            window.loadApprovals();
        } else {
            // Fallback to page reload
            window.location.reload();
        }
    }

    // Create loading spinner HTML
    createLoadingSpinner(message = 'Loading...') {
        return `
            <div class="text-center py-8">
                <div class="loading-spinner mx-auto mb-4"></div>
                <p class="text-white/70">${message}</p>
            </div>
        `;
    }

    // Create empty state HTML
    createEmptyState(icon, title, message, actionButton = null) {
        return `
            <div class="text-center py-12">
                <div class="text-white/70">
                    <i class="fas fa-${icon} text-4xl mb-4"></i>
                    <h3 class="text-lg font-semibold mb-2">${title}</h3>
                    <p class="text-sm text-white/50 mb-4">${message}</p>
                    ${actionButton || ''}
                </div>
            </div>
        `;
    }

    // Create error state HTML
    createErrorState(message, retryFunction = null) {
        const retryButton = retryFunction ? 
            `<button onclick="${retryFunction}" class="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg">
                <i class="fas fa-refresh mr-2"></i>Try Again
            </button>` : '';

        return `
            <div class="text-center py-12">
                <div class="text-white/70">
                    <i class="fas fa-exclamation-triangle text-4xl mb-4 text-red-400"></i>
                    <h3 class="text-lg font-semibold mb-2">Error Loading Data</h3>
                    <p class="text-sm text-white/50 mb-4">${message}</p>
                    ${retryButton}
                </div>
            </div>
        `;
    }

    // Format file size
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Validate email
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Validate phone number
    isValidPhone(phone) {
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
    }

    // Sanitize HTML to prevent XSS
    sanitizeHtml(str) {
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    }

    // Copy text to clipboard
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showToast('Copied to clipboard!', 'success');
            return true;
        } catch (err) {
            console.error('Failed to copy text: ', err);
            this.showToast('Failed to copy to clipboard', 'error');
            return false;
        }
    }

    // Show toast notification
    showToast(message, type = 'info', duration = 3000) {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white transform transition-all duration-300 translate-x-full`;
        
        // Set background color based on type
        const bgColors = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            warning: 'bg-yellow-500',
            info: 'bg-blue-500'
        };
        
        toast.classList.add(bgColors[type] || bgColors.info);
        toast.textContent = message;
        
        // Add to DOM
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => {
            toast.classList.remove('translate-x-full');
        }, 100);
        
        // Remove after duration
        setTimeout(() => {
            toast.classList.add('translate-x-full');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, duration);
    }

    // Confirm dialog
    async confirmDialog(message, title = 'Confirm Action') {
        return new Promise((resolve) => {
            const result = confirm(`${title}\n\n${message}`);
            resolve(result);
        });
    }

    // Prompt dialog
    async promptDialog(message, defaultValue = '') {
        return new Promise((resolve) => {
            const result = prompt(message, defaultValue);
            resolve(result);
        });
    }

    // Generate random ID
    generateId(prefix = 'id') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Throttle function
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // Deep clone object
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        if (typeof obj === 'object') {
            const clonedObj = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    clonedObj[key] = this.deepClone(obj[key]);
                }
            }
            return clonedObj;
        }
    }

    // Get URL parameters
    getUrlParams() {
        const params = {};
        const urlSearchParams = new URLSearchParams(window.location.search);
        for (const [key, value] of urlSearchParams) {
            params[key] = value;
        }
        return params;
    }

    // Update URL without reload
    updateUrl(params) {
        const url = new URL(window.location);
        Object.keys(params).forEach(key => {
            if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
                url.searchParams.set(key, params[key]);
            } else {
                url.searchParams.delete(key);
            }
        });
        window.history.replaceState({}, '', url);
    }

    // Export data as CSV
    exportToCSV(data, filename = 'export.csv') {
        if (!data || data.length === 0) {
            this.showToast('No data to export', 'warning');
            return;
        }

        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => 
                headers.map(header => {
                    const value = row[header];
                    // Escape commas and quotes
                    if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                        return `"${value.replace(/"/g, '""')}"`;
                    }
                    return value;
                }).join(',')
            )
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.showToast('Data exported successfully!', 'success');
    }
}

// Initialize admin utils when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.adminUtils = new AdminUtils();
    console.log('✅ Admin Utils initialized');
});

// Make it globally available
window.AdminUtils = AdminUtils;