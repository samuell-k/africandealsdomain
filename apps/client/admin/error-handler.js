
// JavaScript Error Handling Utility
class ErrorHandler {
  constructor() {
    this.setupGlobalErrorHandling();
  }

  setupGlobalErrorHandling() {
    // Handle uncaught errors
    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error || event.message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Global error:',
                    error: event.error || event.message,
                    timestamp: new Date().toISOString(),
                    file: 'error-handler.js'
                };
                
                console.error('Error details:', errorInfo);
showNotification('Global error:', 'error');

// Enhanced error logging
if (event.error || event.message && event.error || event.message.message) {
    console.error('Error details:', event.error || event.message.message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error details:',
                    error: event.error || event.message.message,
                    timestamp: new Date().toISOString(),
                    file: 'error-handler.js'
                };
                
                console.error('Error details:', errorInfo);
}
      this.logError('JavaScript Error', event.error?.message || event.message, event.filename, event.lineno);
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason || 'No reason provided');
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Unhandled promise rejection:',
                    error: event.reason || 'No reason provided',
                    timestamp: new Date().toISOString(),
                    file: 'error-handler.js'
                };
                
                console.error('Error details:', errorInfo);
showNotification('Unhandled promise rejection:', 'error');

// Enhanced error logging
if (event.reason || 'No reason provided' && event.reason || 'No reason provided'.message) {
    console.error('Error details:', event.reason || 'No reason provided'.message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error details:',
                    error: event.reason || 'No reason provided'.message,
                    timestamp: new Date().toISOString(),
                    file: 'error-handler.js'
                };
                
                console.error('Error details:', errorInfo);
}
      this.logError('Promise Rejection', event.reason?.message || event.reason, 'Promise', 0);
    });
  }

  logError(type, message, source, line) {
    const error = {
      type: type,
      message: message,
      source: source,
      line: line,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    // Store error locally
    const errors = JSON.parse(localStorage.getItem('adminErrors') || '[]');
    errors.push(error);
    
    // Keep only last 50 errors
    if (errors.length > 50) {
      errors.splice(0, errors.length - 50);
    }
    
    localStorage.setItem('adminErrors', JSON.stringify(errors));

    // Show user-friendly notification
    this.showErrorNotification(message);
  }

  showErrorNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-white bg-red-500 shadow-lg flex items-center gap-2';
    notification.innerHTML = `<span>⚠️</span><span>An error occurred. Please refresh the page.</span>`;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 5000);
  }

  // Safe function execution
  safeExecute(fn, context = null, ...args) {
    try {
      return fn.apply(context, args);
    } catch (error) {
      this.logError('Function Execution', error.message, 'SafeExecute', 0);
      return null;
    }
  }

  // Safe DOM manipulation
  safeQuerySelector(selector) {
    try {
      return document.querySelector(selector);
    } catch (error) {
      this.logError('DOM Query', error.message, 'querySelector', 0);
      return null;
    }
  }

  safeQuerySelectorAll(selector) {
    try {
      return document.querySelectorAll(selector);
    } catch (error) {
      this.logError('DOM Query', error.message, 'querySelectorAll', 0);
      return [];
    }
  }

  // Safe event listener
  safeAddEventListener(element, event, handler) {
    try {
      if (element && typeof element.addEventListener === 'function') {
        element.addEventListener(event, handler);
        return true;
      }
      return false;
    } catch (error) {
      this.logError('Event Listener', error.message, 'addEventListener', 0);
      return false;
    }
  }
}

// Initialize error handler
window.errorHandler = new ErrorHandler();

// Global safe functions
function safeExecute(fn, ...args) {
  return window.errorHandler.safeExecute(fn, null, ...args);
}

function safeQuery(selector) {
  return window.errorHandler.safeQuerySelector(selector);
}

function safeQueryAll(selector) {
  return window.errorHandler.safeQuerySelectorAll(selector);
}

function safeAddListener(element, event, handler) {
  return window.errorHandler.safeAddEventListener(element, event, handler);
}
