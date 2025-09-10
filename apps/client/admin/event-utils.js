
// Safe Event Handling Utilities
class EventUtils {
  static safeAddEventListener(selector, event, callback) {
    const element = document.querySelector(selector);
    if (element && typeof element.addEventListener === 'function') {
      element.addEventListener(event, callback);
      return true;
    }
    return false;
  }
  
  static safeAddEventListeners(selector, event, callback) {
    const elements = document.querySelectorAll(selector);
    let count = 0;
    elements.forEach(element => {
      if (element && typeof element.addEventListener === 'function') {
        element.addEventListener(event, callback);
        count++;
      }
    });
    return count;
  }
  
  static safeClick(selector, callback) {
    return this.safeAddEventListener(selector, 'click', callback);
  }
  
  static safeSubmit(selector, callback) {
    return this.safeAddEventListener(selector, 'submit', callback);
  }
  
  static safeChange(selector, callback) {
    return this.safeAddEventListener(selector, 'change', callback);
  }
  
  static waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }
      
      const observer = new MutationObserver((mutations, obs) => {
        const element = document.querySelector(selector);
        if (element) {
          obs.disconnect();
          resolve(element);
        }
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
      }, timeout);
    });
  }
}

// Initialize safe event handling
document.addEventListener('DOMContentLoaded', () => {
  // Add safe event listeners for common elements
  EventUtils.safeClick('.logout-btn, [onclick*="logout"]', (e) => {
    e.preventDefault();
    if (typeof logout === 'function') {
      logout();
    } else if (typeof AdminAuth !== 'undefined') {
      AdminAuth.logout();
    }
  });
  
  // Safe form submissions
  EventUtils.safeAddEventListeners('form', 'submit', (e) => {
    const form = e.target;
    if (form.checkValidity && !form.checkValidity()) {
      e.preventDefault();
      form.reportValidity();
    }
  });
});
