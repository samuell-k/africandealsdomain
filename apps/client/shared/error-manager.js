/**
 * Centralized Error Management System
 * Provides consistent error handling and user notifications across the platform
 * Usage: ErrorManager.handleAPIError(error) or ErrorManager.showNotification(message, type)
 */

class ErrorManager {
  /**
   * Show user notification with consistent styling
   * @param {string} message - Message to display
   * @param {string} type - Notification type (success, error, warning, info)
   * @param {number} duration - Duration in milliseconds (default: 5000)
   */
  static showNotification(message, type = 'info', duration = 5000) {
    // Remove existing notifications to avoid spam
    const existing = document.querySelectorAll('.error-manager-notification');
    existing.forEach(notification => notification.remove());
    
    const notification = document.createElement('div');
    notification.className = 'error-manager-notification fixed top-4 right-4 z-50 max-w-sm';
    
    const typeConfig = {
      success: {
        bgColor: 'bg-green-500',
        icon: 'fas fa-check-circle',
        textColor: 'text-white'
      },
      error: {
        bgColor: 'bg-red-500', 
        icon: 'fas fa-exclamation-circle',
        textColor: 'text-white'
      },
      warning: {
        bgColor: 'bg-yellow-500',
        icon: 'fas fa-exclamation-triangle', 
        textColor: 'text-black'
      },
      info: {
        bgColor: 'bg-blue-500',
        icon: 'fas fa-info-circle',
        textColor: 'text-white'
      }
    };
    
    const config = typeConfig[type] || typeConfig.info;
    
    notification.innerHTML = `
      <div class="${config.bgColor} ${config.textColor} p-4 rounded-lg shadow-lg animate-slide-in">
        <div class="flex items-start justify-between">
          <div class="flex items-start">
            <i class="${config.icon} mt-1 mr-3 text-lg"></i>
            <div class="flex-1">
              <p class="text-sm font-medium leading-tight">${message}</p>
            </div>
          </div>
          <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                  class="${config.textColor} hover:opacity-70 ml-4 flex-shrink-0">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    `;
    
    // Add CSS for animation if not already present
    if (!document.getElementById('error-manager-styles')) {
      const style = document.createElement('style');
      style.id = 'error-manager-styles';
      style.textContent = `
        .animate-slide-in {
          animation: slideIn 0.3s ease-out;
        }
        
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        .animate-slide-out {
          animation: slideOut 0.3s ease-in forwards;
        }
        
        @keyframes slideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Auto-remove after duration with animation
    if (duration > 0) {
      setTimeout(() => {
        if (notification.parentElement) {
          const content = notification.querySelector('div > div');
          content.classList.remove('animate-slide-in');
          content.classList.add('animate-slide-out');
          
          setTimeout(() => {
            if (notification.parentElement) {
              notification.remove();
            }
          }, 300);
        }
      }, duration);
    }
  }
  
  /**
   * Handle API errors with user-friendly messages
   * @param {Error} error - The error object
   * @param {string} userMessage - Custom user message (optional)
   * @param {string} context - Additional context for logging
   */
  static handleAPIError(error, userMessage = null, context = '') {
    console.error('[API ERROR]', error, context);
                
                // Enhanced error logging
                const errorInfo = {
                    message: '[API ERROR]',
                    error: error, context,
                    timestamp: new Date().toISOString(),
                    file: 'error-manager.js'
                };
                
                console.error('Error details:', errorInfo);
showNotification('[API ERROR]', 'error');

// Enhanced error logging
if (error, context && error, context.message) {
    console.error('Error details:', error, context.message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error details:',
                    error: error, context.message,
                    timestamp: new Date().toISOString(),
                    file: 'error-manager.js'
                };
                
                console.error('Error details:', errorInfo);
}
    
    let message = userMessage;
    
    // Extract meaningful error messages from common HTTP status codes
    if (error.message) {
      if (error.message.includes('401')) {
        message = 'Your session has expired. Please login again.';
        // Trigger logout after showing message
        setTimeout(() => {
          if (window.AuthManager) {
            window.AuthManager.logout();
          }
        }, 2000);
      } else if (error.message.includes('403')) {
        message = 'You do not have permission to perform this action.';
      } else if (error.message.includes('404')) {
        message = 'The requested resource was not found.';
      } else if (error.message.includes('429')) {
        message = 'Too many requests. Please wait a moment and try again.';
      } else if (error.message.includes('500')) {
        message = 'Server error. Please try again later or contact support.';
      } else if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
        message = 'Network error. Please check your connection and try again.';
      }
    }
    
    // Use default message if no specific message determined
    if (!message) {
      message = 'An unexpected error occurred. Please try again.';
    }
    
    this.showNotification(message, 'error', 8000); // Longer duration for errors
    
    // Log to monitoring service in production
    this.logToMonitoring(error, context, message);
  }
  
  /**
   * Handle form validation errors
   * @param {Object} validationErrors - Object with field names and error messages
   */
  static handleValidationErrors(validationErrors) {
    // Clear existing validation errors
    document.querySelectorAll('.validation-error').forEach(el => el.remove());
    
    let firstErrorField = null;
    
    Object.keys(validationErrors).forEach(fieldName => {
      const field = document.querySelector(`[name="${fieldName}"]`);
      if (field) {
        // Add error styling to field
        field.classList.add('border-red-500', 'border-2');
        
        // Create error message element
        const errorElement = document.createElement('div');
        errorElement.className = 'validation-error text-red-500 text-xs mt-1';
        errorElement.textContent = validationErrors[fieldName];
        
        // Insert error message after the field
        field.parentNode.insertBefore(errorElement, field.nextSibling);
        
        // Track first error field for focusing
        if (!firstErrorField) {
          firstErrorField = field;
        }
        
        // Remove error styling when user starts typing
        field.addEventListener('input', function() {
          this.classList.remove('border-red-500', 'border-2');
          const errorMsg = this.parentNode.querySelector('.validation-error');
          if (errorMsg) {
            errorMsg.remove();
          }
        }, { once: true });
      }
    });
    
    // Focus first error field and show notification
    if (firstErrorField) {
      firstErrorField.focus();
      this.showNotification('Please correct the highlighted errors', 'warning', 5000);
    }
  }
  
  /**
   * Show loading state
   * @param {string} message - Loading message
   * @param {HTMLElement} element - Element to show loading on (optional)
   */
  static showLoading(message = 'Loading...', element = null) {
    const loadingId = 'error-manager-loading';
    
    // Remove existing loading
    const existingLoading = document.getElementById(loadingId);
    if (existingLoading) {
      existingLoading.remove();
    }
    
    const loading = document.createElement('div');
    loading.id = loadingId;
    
    if (element) {
      // Show loading on specific element
      element.style.position = 'relative';
      loading.className = 'absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10';
    } else {
      // Show global loading
      loading.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    }
    
    loading.innerHTML = `
      <div class="bg-white p-6 rounded-lg shadow-lg flex items-center">
        <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-3"></div>
        <span class="text-gray-700">${message}</span>
      </div>
    `;
    
    if (element) {
      element.appendChild(loading);
    } else {
      document.body.appendChild(loading);
    }
    
    return loading;
  }
  
  /**
   * Hide loading state
   */
  static hideLoading() {
    const loading = document.getElementById('error-manager-loading');
    if (loading) {
      loading.remove();
    }
  }
  
  /**
   * Show confirmation dialog
   * @param {string} message - Confirmation message
   * @param {Function} onConfirm - Callback for confirmation
   * @param {Function} onCancel - Callback for cancellation (optional)
   */
  static showConfirmation(message, onConfirm, onCancel = null) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    
    modal.innerHTML = `
      <div class="bg-white p-6 rounded-lg shadow-lg max-w-md mx-4">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Confirmation</h3>
        <p class="text-gray-600 mb-6">${message}</p>
        <div class="flex justify-end space-x-3">
          <button class="cancel-btn px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50" onclick="handleCancel()">
            Cancel
          /button>
          <button class="confirm-btn px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600" onclick="showNotification('Feature in development', 'info')">
            Confirm
          /button>
        </div>
      </div>
    `;
    
    // Handle cancel
    modal.querySelector('.cancel-btn').onclick = () => {
      modal.remove();
      if (onCancel) onCancel();
    };
    
    // Handle confirm
    modal.querySelector('.confirm-btn').onclick = () => {
      modal.remove();
      onConfirm();
    };
    
    // Close on background click
    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.remove();
        if (onCancel) onCancel();
      }
    };
    
    document.body.appendChild(modal);
  }
  
  /**
   * Log errors to monitoring service
   * @param {Error} error - The error object
   * @param {string} context - Additional context
   * @param {string} userMessage - User-facing message
   */
  static logToMonitoring(error, context = '', userMessage = '') {
    // In production, integrate with error monitoring service like Sentry, LogRocket, etc.
    const errorData = {
      message: error.message || error,
      stack: error.stack || '',
      context,
      userMessage,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      userId: window.currentAuth?.user?.id || 'anonymous',
      userRole: window.currentAuth?.user?.role || 'unknown'
    };
    
    // For now, log to console in development and send to server in production
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.error('[ERROR MONITORING]', errorData);
                
                // Enhanced error logging
                const errorInfo = {
                    message: '[ERROR MONITORING]',
                    error: errorData,
                    timestamp: new Date().toISOString(),
                    file: 'error-manager.js'
                };
                
                console.error('Error details:', errorInfo);
showNotification('[ERROR MONITORING]', 'error');

// Enhanced error logging
if (errorData && errorData.message) {
    console.error('Error details:', errorData.message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error details:',
                    error: errorData.message,
                    timestamp: new Date().toISOString(),
                    file: 'error-manager.js'
                };
                
                console.error('Error details:', errorInfo);
}
    } else {
      // Send to error logging endpoint
      fetch('/api/errors/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorData)
      }).catch(logError => {
        console.error('[ERROR LOGGING FAILED]', logError);
                
                // Enhanced error logging
                const errorInfo = {
                    message: '[ERROR LOGGING FAILED]',
                    error: logError,
                    timestamp: new Date().toISOString(),
                    file: 'error-manager.js'
                };
                
                console.error('Error details:', errorInfo);
showNotification('[ERROR LOGGING FAILED]', 'error');

// Enhanced error logging
if (logError && logError.message) {
    console.error('Error details:', logError.message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error details:',
                    error: logError.message,
                    timestamp: new Date().toISOString(),
                    file: 'error-manager.js'
                };
                
                console.error('Error details:', errorInfo);
}
      });
    }
  }
  
  /**
   * Initialize global error handlers
   */
  static initializeGlobalErrorHandlers() {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      console.error('[UNHANDLED PROMISE REJECTION]', event.reason);
                
                // Enhanced error logging
                const errorInfo = {
                    message: '[UNHANDLED PROMISE REJECTION]',
                    error: event.reason,
                    timestamp: new Date().toISOString(),
                    file: 'error-manager.js'
                };
                
                console.error('Error details:', errorInfo);
showNotification('[UNHANDLED PROMISE REJECTION]', 'error');

// Enhanced error logging
if (event.reason && event.reason.message) {
    console.error('Error details:', event.reason.message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error details:',
                    error: event.reason.message,
                    timestamp: new Date().toISOString(),
                    file: 'error-manager.js'
                };
                
                console.error('Error details:', errorInfo);
}
      this.logToMonitoring(event.reason, 'unhandled_promise_rejection');
    });
    
    // Handle JavaScript errors
    window.addEventListener('error', (event) => {
      console.error('[JAVASCRIPT ERROR]', event.error);
                
                // Enhanced error logging
                const errorInfo = {
                    message: '[JAVASCRIPT ERROR]',
                    error: event.error,
                    timestamp: new Date().toISOString(),
                    file: 'error-manager.js'
                };
                
                console.error('Error details:', errorInfo);
showNotification('[JAVASCRIPT ERROR]', 'error');

// Enhanced error logging
if (event.error && event.error.message) {
    console.error('Error details:', event.error.message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error details:',
                    error: event.error.message,
                    timestamp: new Date().toISOString(),
                    file: 'error-manager.js'
                };
                
                console.error('Error details:', errorInfo);
}
      this.logToMonitoring(event.error, 'javascript_error');
    });
    
    // Handle network errors on images and other resources
    document.addEventListener('error', (event) => {
      if (event.target !== window) {
        console.warn('[RESOURCE ERROR]', event.target.src || event.target.href);
        // Don't show notifications for resource errors, just log them
        this.logToMonitoring(new Error(`Resource load failed: ${event.target.src || event.target.href}`), 'resource_error');
      }
    }, true);
  }
}

// Make ErrorManager available globally
window.ErrorManager = ErrorManager;

// Initialize global error handlers when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    ErrorManager.initializeGlobalErrorHandlers();
  });
} else {
  ErrorManager.initializeGlobalErrorHandlers();
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ErrorManager;
}