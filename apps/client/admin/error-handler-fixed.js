// JavaScript Error Handling Utility - Fixed Version
class ErrorHandler {
  constructor() {
    this.errors = [];
    this.maxErrors = 50;
    this.setupGlobalErrorHandling();
  }

  setupGlobalErrorHandling() {
    // Handle uncaught errors
    window.addEventListener('error', (event) => {
      this.logError('JavaScript Error', event.error?.message || event.message, event.filename, event.lineno);
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.logError('Promise Rejection', event.reason?.message || event.reason, 'Promise', 0);
    });

    // Handle console errors
    const originalConsoleError = console.error;
    console.error = (...args) => {
      this.logError('Console Error', args.join(' '), 'Console', 0);
      originalConsoleError.apply(console, args);
    };
  }

  logError(type, message, source, line) {
    const error = {
      type: type,
      message: String(message || 'Unknown error'),
      source: String(source || 'Unknown'),
      line: Number(line || 0),
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    this.errors.push(error);
    
    // Keep only last maxErrors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }
    
    // Store errors safely
    try {
      localStorage.setItem('adminErrors', JSON.stringify(this.errors));
    } catch (storageError) {
      console.warn('Could not store error in localStorage:', storageError);
    }

    // Show user-friendly notification for critical errors
    if (type === 'JavaScript Error' && !message.includes('Script error')) {
      this.showErrorNotification('A minor issue occurred. The page is still functional.');
    }
  }

  showErrorNotification(message) {
    // Avoid duplicate notifications
    if (document.querySelector('.error-notification')) {
      return;
    }

    const notification = document.createElement('div');
    notification.className = 'error-notification fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-white bg-orange-500 shadow-lg flex items-center gap-2 max-w-sm';
    notification.innerHTML = `
      <span>⚠️</span>
      <span class="text-sm">${message}</span>
      <button onclick="this.parentElement.remove()" class="ml-2 text-white hover:text-gray-200">×</button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
  }

  // Safe function execution
  safeExecute(fn, context = null, ...args) {
    try {
      if (typeof fn === 'function') {
        return fn.apply(context, args);
      }
      return null;
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
        element.addEventListener(event, (e) => {
          this.safeExecute(handler, null, e);
        });
        return true;
      }
      return false;
    } catch (error) {
      this.logError('Event Listener', error.message, 'addEventListener', 0);
      return false;
    }
  }

  // Safe async function wrapper
  safeAsync(asyncFn) {
    return async (...args) => {
      try {
        return await asyncFn(...args);
      } catch (error) {
        this.logError('Async Function', error.message, 'SafeAsync', 0);
        return null;
      }
    };
  }

  // Get error summary
  getErrorSummary() {
    const summary = {
      total: this.errors.length,
      byType: {},
      recent: this.errors.slice(-10)
    };

    this.errors.forEach(error => {
      summary.byType[error.type] = (summary.byType[error.type] || 0) + 1;
    });

    return summary;
  }

  // Clear errors
  clearErrors() {
    this.errors = [];
    try {
      localStorage.removeItem('adminErrors');
    } catch (error) {
      console.warn('Could not clear errors from localStorage:', error);
    }
  }
}

// Initialize error handler safely
let errorHandler;

function initializeErrorHandler() {
  try {
    if (!window.errorHandler) {
      window.errorHandler = new ErrorHandler();
      errorHandler = window.errorHandler;
    }
  } catch (error) {
    console.warn('Failed to initialize error handler:', error);
    // Fallback error handler
    window.errorHandler = {
      logError: () => {},
      safeExecute: (fn, context, ...args) => {
        try {
          return fn.apply(context, args);
        } catch (e) {
          return null;
        }
      },
      safeQuerySelector: (selector) => {
        try {
          return document.querySelector(selector);
        } catch (e) {
          return null;
        }
      },
      safeQuerySelectorAll: (selector) => {
        try {
          return document.querySelectorAll(selector);
        } catch (e) {
          return [];
        }
      }
    };
    errorHandler = window.errorHandler;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeErrorHandler);
} else {
  initializeErrorHandler();
}

// Global safe functions
function safeExecute(fn, ...args) {
  return window.errorHandler ? window.errorHandler.safeExecute(fn, null, ...args) : null;
}

function safeQuery(selector) {
  return window.errorHandler ? window.errorHandler.safeQuerySelector(selector) : document.querySelector(selector);
}

function safeQueryAll(selector) {
  return window.errorHandler ? window.errorHandler.safeQuerySelectorAll(selector) : document.querySelectorAll(selector);
}

function safeAddListener(element, event, handler) {
  return window.errorHandler ? window.errorHandler.safeAddEventListener(element, event, handler) : false;
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ErrorHandler;
}