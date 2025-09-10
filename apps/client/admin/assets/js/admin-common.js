
// ===== AFRICAN DEALS DOMAIN - ADMIN UTILITIES ===== //

// Global configuration
window.ADMIN_CONFIG = {
    BRAND_PRIMARY: '#080b3b',
    BRAND_SECONDARY: '#3b82f6',
    BRAND_ACCENT: '#10b981',
    API_BASE: '/api',
    SOCKET_URL: window.location.origin
};

// Authentication utilities
window.AdminAuth = {
    getCurrentUser() {
        try {
            const userStr = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
            if (userStr && userStr !== 'null') {
                const user = JSON.parse(userStr);
                if (user && user.role) return user;
            }
            return null;
        } catch (e) {
            console.warn('Error getting current user:', e);
            return null;
        }
    },

    getToken() {
        return localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');
    },

    isAuthenticated() {
        const token = this.getToken();
        const user = this.getCurrentUser();
        return !!(token && user && user.role === 'admin');
    },

    hasPermission(permission) {
        const user = this.getCurrentUser();
        if (!user) return false;
        if (user.role === 'admin' || user.role === 'superadmin') return true;
        return user.permissions && (user.permissions.includes('all') || user.permissions.includes(permission));
    },

    redirectToLogin() {
        window.location.href = '/admin/login.html';
    },

    logout() {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('currentUser');
        sessionStorage.removeItem('adminToken');
        sessionStorage.removeItem('currentUser');
        this.redirectToLogin();
    }
};

// UI utilities
window.AdminUI = {
    showNotification(message, type = 'info', duration = 4000) {
        // Remove existing notifications
        document.querySelectorAll('.admin-notification').forEach(n => n.remove());

        const notification = document.createElement('div');
        notification.className = `admin-notification alert alert-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            min-width: 300px;
            max-width: 500px;
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;

        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span>${icons[type] || icons.info}</span>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" style="margin-left: auto; background: none; border: none; color: inherit; cursor: pointer; font-size: 18px;">&times;</button>
            </div>
        `;

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Auto remove
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, duration);

        return notification;
    },

    showLoading(show = true, message = 'Loading...') {
        let loader = document.getElementById('adminGlobalLoader');
        
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'adminGlobalLoader';
            loader.className = 'modal-overlay';
            loader.innerHTML = `
                <div class="modal" style="max-width: 300px;">
                    <div class="modal-body text-center">
                        <div style="width: 40px; height: 40px; border: 3px solid var(--neutral-200); border-top: 3px solid var(--brand-primary); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px;"></div>
                        <p id="loadingMessage">${message}</p>
                    </div>
                </div>
            `;
            
            // Add spin animation
            if (!document.getElementById('spinAnimation')) {
                const style = document.createElement('style');
                style.id = 'spinAnimation';
                style.textContent = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
                document.head.appendChild(style);
            }
            
            document.body.appendChild(loader);
        }

        const messageEl = loader.querySelector('#loadingMessage');
        if (messageEl) messageEl.textContent = message;

        loader.style.display = show ? 'flex' : 'none';
    },

    showModal(title, content, actions = []) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h3 class="modal-title">${title}</h3>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
                <div class="modal-footer">
                    ${actions.map(action => `<button class="btn ${action.class || 'btn-secondary'}" onclick="${action.onclick}">${action.text}</button>`).join('')}
                    <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Close</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        return modal;
    },

    confirmAction(message, onConfirm, onCancel = null) {
        const modal = this.showModal('Confirm Action', `<p>${message}</p>`, [
            {
                text: 'Confirm',
                class: 'btn-danger',
                onclick: `this.closest('.modal-overlay').remove(); (${onConfirm.toString()})();`
            }
        ]);

        return modal;
    }
};

// API utilities
window.AdminAPI = {
    async request(endpoint, options = {}) {
        const token = AdminAuth.getToken();
        
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` }),
                ...options.headers
            },
            ...options
        };

        try {
            const response = await fetch(`${ADMIN_CONFIG.API_BASE}${endpoint}`, config);
            
            if (response.status === 401) {
                AdminAuth.redirectToLogin();
                return null;
            }

            if (!response.ok) {
                console.error('Error thrown:', `HTTP ${response.status}: ${response.statusText}`);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error thrown:',
                    error: `HTTP ${response.status}: ${response.statusText}`,
                    timestamp: new Date().toISOString(),
                    file: 'admin-common.js'
                };
                
                console.error('Error details:', errorInfo);
                showNotification(`HTTP ${response.status}: ${response.statusText}`, 'error');
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API request failed:', error);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'API request failed:',
                    error: error,
                    timestamp: new Date().toISOString(),
                    file: 'admin-common.js'
                };
                
                console.error('Error details:', errorInfo);
showNotification('API request failed:', 'error');

// Enhanced error logging
if (error && error.message) {
    console.error('Error details:', error.message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error details:',
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    file: 'admin-common.js'
                };
                
                console.error('Error details:', errorInfo);
}
            AdminUI.showNotification('Network error. Please try again.', 'error');
            throw error;
        }
    },

    async get(endpoint) {
        return this.request(endpoint);
    },

    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    async delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE'
        });
    }
};

// Data utilities
window.AdminData = {
    formatCurrency(amount, currency = 'USD') {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency
        }).format(amount);
    },

    formatDate(date) {
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(date));
    },

    formatNumber(number) {
        return new Intl.NumberFormat('en-US').format(number);
    },

    truncateText(text, length = 50) {
        if (text.length <= length) return text;
        return text.substring(0, length) + '...';
    }
};

// Initialize admin panel
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    if (!AdminAuth.isAuthenticated() && !window.location.pathname.includes('login')) {
        AdminAuth.redirectToLogin();
        return;
    }

    // Initialize mobile menu
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const sidebar = document.querySelector('.admin-sidebar');
    
    if (mobileMenuToggle && sidebar) {
        mobileMenuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }

    // Initialize tooltips
    document.querySelectorAll('[data-tooltip]').forEach(element => {
        element.addEventListener('mouseenter', function() {
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.textContent = this.dataset.tooltip;
            tooltip.style.cssText = `
                position: absolute;
                background: var(--neutral-800);
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                z-index: 1000;
                pointer-events: none;
            `;
            document.body.appendChild(tooltip);
            
            const rect = this.getBoundingClientRect();
            tooltip.style.left = rect.left + 'px';
            tooltip.style.top = (rect.top - tooltip.offsetHeight - 5) + 'px';
        });
        
        element.addEventListener('mouseleave', function() {
            document.querySelectorAll('.tooltip').forEach(t => t.remove());
        });
    });

    // Initialize form validation
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', function(e) {
            const requiredFields = this.querySelectorAll('[required]');
            let isValid = true;

            requiredFields.forEach(field => {
                if (!field.value.trim()) {
                    field.style.borderColor = 'var(--brand-danger)';
                    isValid = false;
                } else {
                    field.style.borderColor = 'var(--neutral-200)';
                }
            });

            if (!isValid) {
                e.preventDefault();
                AdminUI.showNotification('Please fill in all required fields.', 'error');
            }
        });
    });

    // Auto-hide alerts
    document.querySelectorAll('.alert').forEach(alert => {
        setTimeout(() => {
            alert.style.opacity = '0';
            setTimeout(() => alert.remove(), 300);
        }, 5000);
    });

    console.log('✅ Admin panel initialized successfully');
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AdminAuth, AdminUI, AdminAPI, AdminData };
}

// Mobile menu functionality
document.addEventListener('DOMContentLoaded', function() {
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const sidebar = document.querySelector('.admin-sidebar');
    
    if (mobileMenuToggle && sidebar) {
        mobileMenuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
        
        // Close sidebar when clicking outside
        document.addEventListener('click', (e) => {
            if (!sidebar.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        });
        
        // Close sidebar on window resize if desktop
        window.addEventListener('resize', () => {
            if (window.innerWidth > 1024) {
                sidebar.classList.remove('open');
            }
        });
    }
});

// Enhanced table functionality
window.AdminTable = {
    makeResponsive() {
        const tables = document.querySelectorAll('table:not(.table-responsive table)');
        tables.forEach(table => {
            if (!table.parentElement.classList.contains('table-responsive')) {
                const wrapper = document.createElement('div');
                wrapper.className = 'table-responsive';
                table.parentNode.insertBefore(wrapper, table);
                wrapper.appendChild(table);
            }
        });
    },
    
    addSorting(tableId) {
        const table = document.getElementById(tableId);
        if (!table) return;
        
        const headers = table.querySelectorAll('th[data-sort]');
        headers.forEach(header => {
            header.style.cursor = 'pointer';
            header.addEventListener('click', () => {
                const sortKey = header.dataset.sort;
                const tbody = table.querySelector('tbody');
                const rows = Array.from(tbody.querySelectorAll('tr'));
                
                const isAscending = !header.classList.contains('sort-asc');
                
                // Remove sort classes from all headers
                headers.forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
                
                // Add sort class to current header
                header.classList.add(isAscending ? 'sort-asc' : 'sort-desc');
                
                // Sort rows
                rows.sort((a, b) => {
                    const aVal = a.querySelector(`[data-sort="${sortKey}"]`)?.textContent || '';
                    const bVal = b.querySelector(`[data-sort="${sortKey}"]`)?.textContent || '';
                    
                    if (isAscending) {
                        return aVal.localeCompare(bVal, undefined, { numeric: true });
                    } else {
                        return bVal.localeCompare(aVal, undefined, { numeric: true });
                    }
                });
                
                // Reorder DOM
                rows.forEach(row => tbody.appendChild(row));
            });
        });
    }
};

// Enhanced form functionality
window.AdminForm = {
    validate(formId) {
        const form = document.getElementById(formId);
        if (!form) return false;
        
        let isValid = true;
        const requiredFields = form.querySelectorAll('[required]');
        
        requiredFields.forEach(field => {
            const value = field.value.trim();
            const errorEl = field.parentElement.querySelector('.field-error');
            
            if (!value) {
                isValid = false;
                field.classList.add('error');
                if (!errorEl) {
                    const error = document.createElement('div');
                    error.className = 'field-error';
                    error.style.cssText = 'color: var(--brand-danger); font-size: var(--font-size-xs); margin-top: var(--spacing-1);';
                    error.textContent = 'This field is required';
                    field.parentElement.appendChild(error);
                }
            } else {
                field.classList.remove('error');
                if (errorEl) errorEl.remove();
            }
        });
        
        return isValid;
    },
    
    serialize(formId) {
        const form = document.getElementById(formId);
        if (!form) return {};
        
        const formData = new FormData(form);
        const data = {};
        
        for (let [key, value] of formData.entries()) {
            data[key] = value;
        }
        
        return data;
    }
};

// Initialize enhanced functionality
document.addEventListener('DOMContentLoaded', function() {
    // Make all tables responsive
    AdminTable.makeResponsive();
    
    // Add form validation styles
    const style = document.createElement('style');
    style.textContent = `
        .form-input.error, .form-select.error, .form-textarea.error {
            border-color: var(--brand-danger);
            box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
        }
        
        .sort-asc::after { content: ' ↑'; }
        .sort-desc::after { content: ' ↓'; }
    `;
    document.head.appendChild(style);
});
