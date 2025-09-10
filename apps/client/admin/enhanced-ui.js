
// Enhanced UI Components
class UIEnhancer {
  constructor() {
    this.init();
  }

  init() {
    this.enhanceButtons();
    this.enhanceTables();
    this.enhanceForms();
    this.enhanceModals();
    this.addLoadingStates();
    this.addTooltips();
  }

  enhanceButtons() {
    const buttons = document.querySelectorAll('button, .btn');
    buttons.forEach(button => {
      if (!button.classList.contains('enhanced')) {
        button.classList.add('enhanced');
        
        // Add loading state capability
        button.originalText = button.textContent;
        button.setLoading = function(loading = true) {
          if (loading) {
            this.disabled = true;
            this.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Loading...';
          } else {
            this.disabled = false;
            this.innerHTML = this.originalText;
          }
        };
        
        // Add click animation
        button.addEventListener('click', function() {
          this.style.transform = 'scale(0.95)';
          setTimeout(() => {
            this.style.transform = 'scale(1)';
          }, 150);
        });
      }
    });
  }

  enhanceTables() {
    const tables = document.querySelectorAll('table');
    tables.forEach(table => {
      if (!table.classList.contains('enhanced')) {
        table.classList.add('enhanced');
        
        // Add sorting capability
        const headers = table.querySelectorAll('th');
        headers.forEach((header, index) => {
          if (!header.classList.contains('no-sort')) {
            header.style.cursor = 'pointer';
            header.innerHTML += ' <i class="fas fa-sort text-xs ml-1"></i>';
            
            header.addEventListener('click', () => {
              this.sortTable(table, index);
            });
          }
        });
        
        // Add row hover effects
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
          row.addEventListener('mouseenter', function() {
            this.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
          });
          
          row.addEventListener('mouseleave', function() {
            this.style.backgroundColor = '';
          });
        });
      }
    });
  }

  sortTable(table, columnIndex) {
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    
    const sortedRows = rows.sort((a, b) => {
      const aText = a.cells[columnIndex].textContent.trim();
      const bText = b.cells[columnIndex].textContent.trim();
      
      // Try to parse as numbers
      const aNum = parseFloat(aText);
      const bNum = parseFloat(bText);
      
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return aNum - bNum;
      }
      
      return aText.localeCompare(bText);
    });
    
    // Clear tbody and append sorted rows
    tbody.innerHTML = '';
    sortedRows.forEach(row => tbody.appendChild(row));
  }

  enhanceForms() {
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
      if (!form.classList.contains('enhanced')) {
        form.classList.add('enhanced');
        
        // Add real-time validation
        const inputs = form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
          input.addEventListener('blur', () => {
            this.validateInput(input);
          });
          
          input.addEventListener('input', () => {
            this.clearValidationError(input);
          });
        });
        
        // Enhanced form submission
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          
          if (this.validateForm(form)) {
            const submitButton = form.querySelector('button[type="submit"]');
            if (submitButton && submitButton.setLoading) {
              submitButton.setLoading(true);
            }
            
            // Simulate form processing
            setTimeout(() => {
              if (submitButton && submitButton.setLoading) {
                submitButton.setLoading(false);
              }
              this.showNotification('Form submitted successfully!', 'success');
            }, 2000);
          }
        });
      }
    });
  }

  validateInput(input) {
    const value = input.value.trim();
    let isValid = true;
    let message = '';
    
    if (input.hasAttribute('required') && !value) {
      isValid = false;
      message = 'This field is required';
    } else if (input.type === 'email' && value && !this.isValidEmail(value)) {
      isValid = false;
      message = 'Please enter a valid email address';
    } else if (input.type === 'password' && value && value.length < 6) {
      isValid = false;
      message = 'Password must be at least 6 characters';
    }
    
    if (!isValid) {
      this.showValidationError(input, message);
    } else {
      this.clearValidationError(input);
    }
    
    return isValid;
  }

  validateForm(form) {
    const inputs = form.querySelectorAll('input, select, textarea');
    let isValid = true;
    
    inputs.forEach(input => {
      if (!this.validateInput(input)) {
        isValid = false;
      }
    });
    
    return isValid;
  }

  showValidationError(input, message) {
    this.clearValidationError(input);
    
    input.classList.add('border-red-500');
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'validation-error text-red-400 text-sm mt-1';
    errorDiv.textContent = message;
    
    input.parentNode.appendChild(errorDiv);
  }

  clearValidationError(input) {
    input.classList.remove('border-red-500');
    
    const errorDiv = input.parentNode.querySelector('.validation-error');
    if (errorDiv) {
      errorDiv.remove();
    }
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  enhanceModals() {
    const modals = document.querySelectorAll('.modal, [id*="modal"]');
    modals.forEach(modal => {
      if (!modal.classList.contains('enhanced')) {
        modal.classList.add('enhanced');
        
        // Add backdrop click to close
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            this.closeModal(modal);
          }
        });
        
        // Add escape key to close
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            this.closeModal(modal);
          }
        });
      }
    });
  }

  closeModal(modal) {
    modal.classList.add('hidden');
  }

  addLoadingStates() {
    // Add loading overlay capability
    if (!document.getElementById('loading-overlay')) {
      const overlay = document.createElement('div');
      overlay.id = 'loading-overlay';
      overlay.className = 'fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center';
      overlay.innerHTML = `
        <div class="glass-morphism rounded-2xl p-8 text-center">
          <i class="fas fa-spinner fa-spin text-4xl text-white mb-4"></i>
          <p class="text-white text-lg">Loading...</p>
        </div>
      `;
      document.body.appendChild(overlay);
    }
  }

  showLoading(show = true) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      if (show) {
        overlay.classList.remove('hidden');
      } else {
        overlay.classList.add('hidden');
      }
    }
  }

  addTooltips() {
    const elementsWithTooltips = document.querySelectorAll('[title], [data-tooltip]');
    elementsWithTooltips.forEach(element => {
      const tooltipText = element.getAttribute('title') || element.getAttribute('data-tooltip');
      if (tooltipText && !element.classList.contains('tooltip-enhanced')) {
        element.classList.add('tooltip-enhanced');
        element.removeAttribute('title'); // Remove default tooltip
        
        const tooltip = document.createElement('div');
        tooltip.className = 'absolute z-50 px-2 py-1 text-sm text-white bg-black rounded shadow-lg opacity-0 pointer-events-none transition-opacity duration-200';
        tooltip.textContent = tooltipText;
        
        element.style.position = 'relative';
        element.appendChild(tooltip);
        
        element.addEventListener('mouseenter', () => {
          tooltip.classList.remove('opacity-0');
        });
        
        element.addEventListener('mouseleave', () => {
          tooltip.classList.add('opacity-0');
        });
      }
    });
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    let bgColor = 'bg-blue-500';
    let icon = 'ℹ️';
    
    if (type === 'success') {
      bgColor = 'bg-green-500';
      icon = '✅';
    } else if (type === 'error') {
      bgColor = 'bg-red-500';
      icon = '❌';
    } else if (type === 'warning') {
      bgColor = 'bg-yellow-500';
      icon = '⚠️';
    }
    
    notification.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-white ${bgColor} shadow-lg flex items-center gap-2 transform translate-x-full transition-transform duration-300`;
    notification.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    
    document.body.appendChild(notification);
    
    // Slide in
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Slide out and remove
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 3000);
  }
}

// Initialize UI enhancer
document.addEventListener('DOMContentLoaded', () => {
  window.uiEnhancer = new UIEnhancer();
});

// Global notification function
function showNotification(message, type = 'info') {
  if (window.uiEnhancer) {
    window.uiEnhancer.showNotification(message, type);
  }
}

// Global loading function
function showLoading(show = true) {
  if (window.uiEnhancer) {
    window.uiEnhancer.showLoading(show);
  }
}
