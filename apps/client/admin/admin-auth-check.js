
// Admin Authentication and Security Check
(function() {
    'use strict';
    
    // Lightweight logger to help diagnose redirect causes (stores last 50 entries)
    function debugLog(message, meta = {}) {
        try {
            const entry = { time: new Date().toISOString(), message, meta };
            const logs = JSON.parse(localStorage.getItem('adminAuthLogs') || '[]');
            logs.push(entry);
            while (logs.length > 50) logs.shift();
            localStorage.setItem('adminAuthLogs', JSON.stringify(logs));
            console.debug('[AdminAuth]', message, meta);
        } catch (_) {}
    }

    // Check if user is authenticated and has admin role
    function checkAdminAuth() {
        const token = localStorage.getItem('adminToken') || localStorage.getItem('token') || localStorage.getItem('authToken');
        const userData = localStorage.getItem('user') || localStorage.getItem('userData') || localStorage.getItem('adminUser');
        let userRole = null;
        
        try {
            if (userData) {
                const user = JSON.parse(userData);
                userRole = (user && user.role) ? String(user.role).toLowerCase() : null;
            }
        } catch (error) {
            console.error('Error parsing user data:', error);
            debugLog('user_data_parse_error', { error: String(error) });
            // Don't nuke tokens on parse error; attempt server verification instead
            userRole = null;
        }
        
        const currentPath = window.location.pathname;

        // If offline, do not redirect; show a toast and wait for reconnection
        if (typeof navigator !== 'undefined' && navigator && navigator.onLine === false) {
            debugLog('offline_detected_skip_verify', { path: currentPath });
            try {
                const toast = document.getElementById('errorToast');
                const msg = document.getElementById('errorMessage');
                if (toast && msg) {
                    msg.textContent = 'You are offline. Some features may be limited until reconnection.';
                    toast.classList.remove('hidden');
                    setTimeout(() => toast.classList.add('hidden'), 4000);
                }
            } catch (_) {}
            window.addEventListener('online', () => {
                const latestToken = localStorage.getItem('adminToken') || localStorage.getItem('token') || localStorage.getItem('authToken');
                if (latestToken) verifyTokenWithServer(latestToken);
            }, { once: true });
            return true;
        }
        
        // Skip auth check for auth pages and public assets
        if (currentPath.includes('login.html') || currentPath.includes('auth-admin.html') || currentPath.startsWith('/public/')) {
            return true;
        }
        
        // If no token at all, redirect to login (with loop guard)
        if (!token) {
            debugLog('redirect_no_token', { path: currentPath });
            redirectToLogin('no_token');
            return false;
        }
        
        // Always verify with server in background and allow page to proceed
        // This avoids local-storage mismatch causing loops
        verifyTokenWithServer(token);
        
        // If we have a local role and it's not admin, still don't hard-block here
        // Server verification will handle redirect on 401/403 or insufficient permissions
        return true;
    }
    
    async function verifyTokenWithServer(token) {
        try {
            const response = await fetch('/api/auth/verify', {
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            });
            
            if (!response.ok) {
                // Handle auth failures with a single silent refresh attempt before redirecting
                if (response.status === 401 || response.status === 403) {
                    debugLog('verify_unauthorized', { status: response.status });
                    const lastRefreshTry = Number(localStorage.getItem('adminLastSilentRefreshAt') || '0');
                    const now = Date.now();
                    if (now - lastRefreshTry > 10000) { // at most once per 10s
                        localStorage.setItem('adminLastSilentRefreshAt', String(now));
                        try {
                            const newToken = await refreshToken(token);
                            if (newToken) {
                                // Retry verification with the new token
                                await verifyTokenWithServer(newToken);
                                return; // stop here, do not fallthrough to redirect
                            }
                        } catch (e) { debugLog('silent_refresh_failed', { error: String(e) }); }
                    }
                    throw new Error('Unauthorized');
                }
                // For other errors (e.g., 5xx, network), do not disrupt current session
                console.warn('[AUTH] Token verify non-auth error:', response.status, response.statusText);
                // If server temporarily returns 5xx, back off and retry after a short delay (non-blocking)
                if (response.status >= 500) {
                    setTimeout(() => {
                        try {
                            const latestToken = localStorage.getItem('adminToken') || localStorage.getItem('token') || localStorage.getItem('authToken');
                            if (latestToken) verifyTokenWithServer(latestToken);
                        } catch (_) {}
                    }, 5000);
                }
                return;
            }
            
            const data = await response.json();
            if (!data.user || String(data.user.role).toLowerCase() !== 'admin') {
                debugLog('verify_non_admin_role', { user: data.user });
                // Do not redirect immediately; show warning and allow UI to render minimal content
                try {
                    const toast = document.getElementById('errorToast');
                    const msg = document.getElementById('errorMessage');
                    if (toast && msg) {
                        msg.textContent = 'Signed in but not as admin. Some admin features are disabled.';
                        toast.classList.remove('hidden');
                        setTimeout(() => toast.classList.add('hidden'), 4000);
                    }
                } catch (_) {}
                return;
            }
            
            // Save token expiry for scheduled refresh
            if (data.tokenExpiry) {
                localStorage.setItem('tokenExpiry', data.tokenExpiry);
                const expiryTime = new Date(data.tokenExpiry).getTime();
                const currentTime = Date.now();
                const twoDaysInMs = 2 * 24 * 60 * 60 * 1000;
                
                // Non-blocking auto-refresh if within 2 days
                if (expiryTime - currentTime < twoDaysInMs) {
                    console.log('[AUTH] Token expiring soon, refreshing silently...');
                    refreshToken(token);
                }
            }
            
            // Update user info and ensure consistent format
            localStorage.setItem('userInfo', JSON.stringify(data));
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('userData', JSON.stringify(data.user));
            localStorage.setItem('userRole', data.user.role);
            
        } catch (error) {
            console.error('Auth verification failed:', error);
            // Only clear and redirect for explicit auth failures
            const msg = (error && error.message) ? error.message.toLowerCase() : '';
            if (msg.includes('unauthorized') || msg.includes('insufficient permissions')) {
                clearAuthData();
                redirectToLogin();
            } else {
                // Network or non-auth errors: do not disrupt session
                console.warn('[AUTH] Verify failed due to non-auth issue; keeping session.');
            }
        }
    }
    
    async function refreshToken(currentToken) {
        try {
            console.log('[AUTH] 🔄 Refreshing admin token...');
            
            const response = await fetch('/api/auth/refresh-token', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + currentToken,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Token refresh failed');
            }
            
            const data = await response.json();
            if (data.success && data.token) {
                // Update all token storage locations
                localStorage.setItem('adminToken', data.token);
                localStorage.setItem('token', data.token);
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                localStorage.setItem('userData', JSON.stringify(data.user));
                localStorage.setItem('userRole', data.user.role);
                
                // Persist token expiry if provided
                if (data.expiresIn || data.token) {
                    try {
                        const parts = data.token.split('.');
                        if (parts.length === 3) {
                            const payload = JSON.parse(atob(parts[1]));
                            if (payload && payload.exp) {
                                const expIso = new Date(payload.exp * 1000).toISOString();
                                localStorage.setItem('tokenExpiry', expIso);
                            }
                        }
                    } catch (_) {}
                }
                
                console.log('[AUTH] ✅ Token refreshed successfully, expires in:', data.expiresIn);
                return data.token; // return new token for callers to use immediately
            } else {
                throw new Error('Invalid refresh response');
            }
            
        } catch (error) {
            console.error('[AUTH] ❌ Token refresh failed:', error);
            // Don't clear auth data immediately, let normal verification handle it
            return null;
        }
    }
    
    function redirectToLogin(reason = 'unknown') {
        // Avoid redirect loop: if already on auth page, do nothing
        const path = window.location.pathname;
        if (path.includes('auth-admin.html') || path.includes('login.html')) return;
        
        // Prevent multiple rapid redirects
        const lastRedirectAt = Number(localStorage.getItem('adminLastRedirectAt') || '0');
        const now = Date.now();
        if (now - lastRedirectAt < 3000) {
            console.warn('[AUTH] Skipping rapid repeat redirect');
            debugLog('skip_repeat_redirect', { path, reason });
            return;
        }
        localStorage.setItem('adminLastRedirectAt', String(now));
        
        debugLog('redirect_to_login', { path, reason });
        const currentUrl = encodeURIComponent(window.location.href);
        window.location.href = `/auth/auth-admin.html?redirect=${currentUrl}`;
    }
    
    function clearAuthData() {
        localStorage.removeItem('token');
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        localStorage.removeItem('userData');
        localStorage.removeItem('userInfo');
        localStorage.removeItem('userRole');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('adminToken'); // Keep for backward compatibility
    }
    
    // Setup logout functionality
    function setupLogout() {
        const logoutButtons = document.querySelectorAll('[data-logout], .logout-btn');
        logoutButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                logout();
            });
        });
    }
    
    async function logout() {
        try {
            const token = localStorage.getItem('adminToken') || localStorage.getItem('token') || localStorage.getItem('authToken');
            if (token) {
                await fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + token
                    }
                });
            }
        } catch (error) {
            console.error('Logout request failed:', error);
        } finally {
            clearAuthData();
            window.location.href = '/auth/auth-admin.html';
        }
    }
    
    // Setup session timeout warning
    function setupSessionTimeout() {
        let warningTimer;
        let refreshTimer;
        let logoutTimer;
        
        function scheduleFromExpiry() {
            // Use server-provided expiry if available
            const expiryIso = localStorage.getItem('tokenExpiry');
            const userRole = localStorage.getItem('userRole');
            if (!expiryIso || userRole !== 'admin') return; // only schedule for admin long-lived tokens
            
            const expiry = new Date(expiryIso).getTime();
            const now = Date.now();
            if (isNaN(expiry) || expiry <= now) return;
            
            // Clear previous timers
            clearTimeout(warningTimer);
            clearTimeout(refreshTimer);
            clearTimeout(logoutTimer);
            
            // Schedule silent refresh at T-2 days
            const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
            const refreshIn = Math.max(0, expiry - now - twoDaysMs);
            refreshTimer = setTimeout(() => {
                const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
                if (token) refreshToken(token);
            }, refreshIn);
            
            // Optional non-blocking warning toast at T-2 days (no confirm)
            warningTimer = setTimeout(() => {
                try {
                    const toast = document.getElementById('successToast');
                    const msg = document.getElementById('successMessage');
                    if (toast && msg) {
                        msg.textContent = 'Admin session will refresh soon to keep you signed in.';
                        toast.classList.remove('hidden');
                        setTimeout(() => toast.classList.add('hidden'), 3000);
                    }
                } catch (e) {}
            }, refreshIn);
            
            // Safety logout right at expiry (rare if refresh works)
            const logoutIn = Math.max(0, expiry - now);
            logoutTimer = setTimeout(() => {
                logout();
            }, logoutIn);
        }
        
        // Update timers whenever we get a new expiry
        window.addEventListener('storage', (e) => {
            if (e.key === 'tokenExpiry') scheduleFromExpiry();
        });
        
        // Also schedule on load and on user activity extend nothing (non-blocking)
        scheduleFromExpiry();
    }
    
    // Initialize security features
    document.addEventListener('DOMContentLoaded', function() {
        if (checkAdminAuth()) {
            setupLogout();
            setupSessionTimeout();
        }
    });
    
    // Utility function to format dates
    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    // Export functions for global use
    window.AdminAuth = {
        checkAuth: checkAdminAuth,
        logout: logout,
        verifyToken: verifyTokenWithServer,
        refreshToken: refreshToken,
        formatDate: formatDate
    };
    
    // Add lowercase alias for backward compatibility
    window.adminAuth = window.AdminAuth;
})();
