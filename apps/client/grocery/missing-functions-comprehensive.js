/**
 * Comprehensive Missing Functions for Local Market
 * This file contains ALL missing JavaScript functions needed for the local market page
 */

// Prevent double initialization
if (window.__COMPREHENSIVE_FUNCTIONS_INIT__) {
  console.debug('comprehensive functions already initialized');
} else {
  window.__COMPREHENSIVE_FUNCTIONS_INIT__ = true;

// Core Global Functions
console.log('[COMPREHENSIVE] Initializing all missing functions...');

// 1. TAB SWITCHING FUNCTIONALITY
window.switchTab = function(tabName) {
  console.log('[TAB] Switching to:', tabName);
  
  // Hide all tab panels
  const panels = ['browse-content', 'cart-content', 'orders-panel', 'profile-panel'];
  panels.forEach(panelId => {
    const panel = document.getElementById(panelId);
    if (panel) {
      panel.classList.add('hidden');
    }
  });
  
  // Remove active state from all tab buttons
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.classList.remove('gradient-bg', 'text-white');
    btn.classList.add('bg-gray-100', 'text-gray-700');
    btn.setAttribute('aria-selected', 'false');
  });
  
  // Handle specific tabs
  switch(tabName) {
    case 'browse':
      const browseContent = document.getElementById('browse-content');
      if (browseContent) browseContent.classList.remove('hidden');
      
      const browseTab = document.getElementById('tab-browse');
      if (browseTab) {
        browseTab.classList.remove('bg-gray-100', 'text-gray-700');
        browseTab.classList.add('gradient-bg', 'text-white');
        browseTab.setAttribute('aria-selected', 'true');
      }
      break;
      
    case 'cart':
      let cartContent = document.getElementById('cart-content');
      if (!cartContent) {
        // Create cart content dynamically if it doesn't exist
        const mainContent = document.querySelector('main');
        if (mainContent) {
          cartContent = document.createElement('section');
          cartContent.id = 'cart-content';
          cartContent.className = 'col-span-1 lg:col-span-4 hidden';
          cartContent.role = 'tabpanel';
          cartContent.setAttribute('aria-labelledby', 'tab-cart');
          cartContent.innerHTML = `
            <div class="bg-white rounded-2xl shadow-lg p-6">
              <div class="flex items-center justify-between mb-6">
                <div>
                  <h2 class="text-2xl font-bold text-gray-800">Shopping Cart</h2>
                  <p class="text-sm text-gray-600">Review your selected items</p>
                </div>
                <button class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm" onclick="switchTab('browse')">
                  <i class="fas fa-arrow-left mr-2"></i>Continue Shopping
                </button>
              </div>
              <div id="cart-items-container" class="space-y-4">
                <div class="text-center py-8 text-gray-500">
                  <i class="fas fa-shopping-cart text-4xl text-gray-300 mb-4"></i>
                  <p>Your cart is empty</p>
                  <button onclick="switchTab('browse')" class="mt-4 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700">
                    Start Shopping
                  </button>
                </div>
              </div>
              <div id="cart-summary" class="mt-6 border-t pt-6 hidden">
                <div class="flex justify-between text-lg font-bold mb-4">
                  <span>Total:</span>
                  <span id="cart-total">0 RWF</span>
                </div>
                <button id="checkout-btn" onclick="proceedToCheckout()" class="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-semibold">
                  Proceed to Checkout
                </button>
              </div>
            </div>
          `;
          mainContent.appendChild(cartContent);
        }
      }
      if (cartContent) cartContent.classList.remove('hidden');
      
      const cartTab = document.getElementById('tab-cart');
      if (cartTab) {
        cartTab.classList.remove('bg-gray-100', 'text-gray-700');
        cartTab.classList.add('gradient-bg', 'text-white');
        cartTab.setAttribute('aria-selected', 'true');
      }
      
      // Load cart items
      loadCartItems();
      break;
      
    case 'orders':
      const ordersPanel = document.getElementById('orders-panel');
      if (ordersPanel) ordersPanel.classList.remove('hidden');
      
      const ordersTab = document.getElementById('tab-orders');
      if (ordersTab) {
        ordersTab.classList.remove('bg-gray-100', 'text-gray-700');
        ordersTab.classList.add('gradient-bg', 'text-white');
        ordersTab.setAttribute('aria-selected', 'true');
      }
      
      // Load orders
      loadUserOrders();
      break;
      
    case 'profile':
      const profilePanel = document.getElementById('profile-panel');
      if (profilePanel) profilePanel.classList.remove('hidden');
      
      const profileTab = document.getElementById('tab-profile');
      if (profileTab) {
        profileTab.classList.remove('bg-gray-100', 'text-gray-700');
        profileTab.classList.add('gradient-bg', 'text-white');
        profileTab.setAttribute('aria-selected', 'true');
      }
      
      // Load profile
      loadUserProfile();
      break;
  }
  
  // Close user dropdown if open
  const dropdown = document.getElementById('user-dropdown');
  if (dropdown) {
    dropdown.classList.add('hidden');
  }
};

// 2. MOBILE NAVIGATION
window.closeMobileNav = function() {
  const mobileNav = document.getElementById('mobile-nav');
  const mobileNavPanel = document.getElementById('mobile-nav-panel');
  
  if (mobileNavPanel) {
    mobileNavPanel.classList.add('translate-x-full');
  }
  
  setTimeout(() => {
    if (mobileNav) {
      mobileNav.classList.add('hidden');
    }
  }, 300);
};

window.openMobileNav = function() {
  const mobileNav = document.getElementById('mobile-nav');
  const mobileNavPanel = document.getElementById('mobile-nav-panel');
  
  if (mobileNav) {
    mobileNav.classList.remove('hidden');
  }
  
  setTimeout(() => {
    if (mobileNavPanel) {
      mobileNavPanel.classList.remove('translate-x-full');
    }
  }, 10);
};

// 3. MODAL FUNCTIONS
window.openSupportModal = function() {
  showNotification('Opening support modal...', 'info');
  // Create support modal if it doesn't exist
  let supportModal = document.getElementById('support-modal');
  if (!supportModal) {
    supportModal = document.createElement('div');
    supportModal.id = 'support-modal';
    supportModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    supportModal.innerHTML = `
      <div class="bg-white rounded-2xl max-w-md w-full p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-bold text-gray-800">Help & Support</h2>
          <button onclick="closeSupportModal()" class="text-gray-500 hover:text-gray-700">
            <i class="fas fa-times text-xl"></i>
          </button>
        </div>
        <div class="space-y-4">
          <p class="text-gray-600">How can we help you?</p>
          <div class="space-y-2">
            <button class="w-full text-left p-3 rounded-lg hover:bg-gray-50 border border-gray-200">
              <i class="fas fa-phone mr-3 text-green-600"></i>
              Call Support: +250 XXX XXX XXX
            </button>
            <button class="w-full text-left p-3 rounded-lg hover:bg-gray-50 border border-gray-200">
              <i class="fas fa-envelope mr-3 text-blue-600"></i>
              Email: support@africandealsdomain.com
            </button>
            <button class="w-full text-left p-3 rounded-lg hover:bg-gray-50 border border-gray-200">
              <i class="fas fa-comment mr-3 text-purple-600"></i>
              Live Chat (Coming Soon)
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(supportModal);
  }
  supportModal.classList.remove('hidden');
};

window.closeSupportModal = function() {
  const modal = document.getElementById('support-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
};

// 4. NOTIFICATION SYSTEM
window.showNotification = function(message, type = 'info', duration = 3000) {
  // Remove existing notifications
  const existingNotifications = document.querySelectorAll('.notification-toast');
  existingNotifications.forEach(n => n.remove());
  
  const notification = document.createElement('div');
  notification.className = `notification-toast fixed top-4 right-4 z-[9999] p-4 rounded-lg shadow-lg max-w-sm animate-slide-in`;
  
  let bgColor, textColor, icon;
  switch(type) {
    case 'success':
      bgColor = 'bg-green-500';
      textColor = 'text-white';
      icon = 'fas fa-check-circle';
      break;
    case 'error':
      bgColor = 'bg-red-500';
      textColor = 'text-white';
      icon = 'fas fa-exclamation-circle';
      break;
    case 'warning':
      bgColor = 'bg-yellow-500';
      textColor = 'text-white';
      icon = 'fas fa-exclamation-triangle';
      break;
    default:
      bgColor = 'bg-blue-500';
      textColor = 'text-white';
      icon = 'fas fa-info-circle';
  }
  
  notification.className += ` ${bgColor} ${textColor}`;
  notification.innerHTML = `
    <div class="flex items-center gap-3">
      <i class="${icon}"></i>
      <span>${message}</span>
      <button onclick="this.parentElement.parentElement.remove()" class="ml-2 hover:opacity-70">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  if (duration > 0) {
    setTimeout(() => {
      if (notification && notification.parentNode) {
        notification.remove();
      }
    }, duration);
  }
};

// 5. CART MANAGEMENT
window.loadCartItems = function() {
  const cartItems = getCartItems();
  const cartContainer = document.getElementById('cart-items-container');
  const cartSummary = document.getElementById('cart-summary');
  const cartTotal = document.getElementById('cart-total');
  
  if (!cartContainer) return;
  
  if (cartItems.length === 0) {
    cartContainer.innerHTML = `
      <div class="text-center py-8 text-gray-500">
        <i class="fas fa-shopping-cart text-4xl text-gray-300 mb-4"></i>
        <p>Your cart is empty</p>
        <button onclick="switchTab('browse')" class="mt-4 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700">
          Start Shopping
        </button>
      </div>
    `;
    if (cartSummary) cartSummary.classList.add('hidden');
    return;
  }
  
  let total = 0;
  let html = '';
  
  cartItems.forEach(item => {
    const itemTotal = item.price * item.quantity;
    total += itemTotal;
    
    html += `
      <div class="flex items-center gap-4 p-4 border border-gray-200 rounded-lg">
        <img src="${item.image || '/public/images/placeholder-product.jpg'}" alt="${item.name}" class="w-16 h-16 object-cover rounded">
        <div class="flex-1">
          <h3 class="font-semibold text-gray-800">${item.name}</h3>
          <p class="text-sm text-gray-600">${formatPrice(item.price)} RWF each</p>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="updateCartQuantity('${item.id}', ${item.quantity - 1})" class="w-8 h-8 flex items-center justify-center bg-gray-100 rounded text-gray-600 hover:bg-gray-200">
            <i class="fas fa-minus text-xs"></i>
          </button>
          <span class="px-3 py-1 bg-gray-50 rounded text-sm font-medium">${item.quantity}</span>
          <button onclick="updateCartQuantity('${item.id}', ${item.quantity + 1})" class="w-8 h-8 flex items-center justify-center bg-gray-100 rounded text-gray-600 hover:bg-gray-200">
            <i class="fas fa-plus text-xs"></i>
          </button>
        </div>
        <div class="text-right">
          <p class="font-semibold text-gray-800">${formatPrice(itemTotal)} RWF</p>
          <button onclick="removeFromCart('${item.id}')" class="text-red-500 hover:text-red-700 text-sm">
            <i class="fas fa-trash"></i> Remove
          </button>
        </div>
      </div>
    `;
  });
  
  cartContainer.innerHTML = html;
  
  if (cartTotal) {
    cartTotal.textContent = formatPrice(total) + ' RWF';
  }
  
  if (cartSummary) {
    cartSummary.classList.remove('hidden');
  }
  
  // Update cart badges
  updateCartBadges(cartItems);
};

// 6. ORDERS MANAGEMENT
window.loadUserOrders = function() {
  const ordersContent = document.getElementById('orders-panel-content');
  if (!ordersContent) return;
  
  // Simulate loading
  ordersContent.innerHTML = `
    <div class="text-center py-8 text-gray-500">
      <i class="fas fa-spinner loading-spinner text-2xl text-gray-400 mb-2"></i>
      <p>Loading your orders...</p>
    </div>
  `;
  
  // Simulate API call
  setTimeout(() => {
    const mockOrders = [
      {
        id: 'LM-001',
        date: '2024-01-15',
        status: 'delivered',
        total: 25000,
        items: ['Tomatoes', 'Onions', 'Rice']
      },
      {
        id: 'LM-002',
        date: '2024-01-10',
        status: 'pending',
        total: 18500,
        items: ['Bananas', 'Milk', 'Bread']
      }
    ];
    
    if (mockOrders.length === 0) {
      ordersContent.innerHTML = `
        <div class="text-center py-8 text-gray-500">
          <i class="fas fa-receipt text-4xl text-gray-300 mb-4"></i>
          <p>No orders found</p>
          <button onclick="switchTab('browse')" class="mt-4 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700">
            Start Shopping
          </button>
        </div>
      `;
      return;
    }
    
    let html = '';
    mockOrders.forEach(order => {
      const statusColor = order.status === 'delivered' ? 'text-green-600 bg-green-50' : 'text-yellow-600 bg-yellow-50';
      html += `
        <div class="border border-gray-200 rounded-lg p-4">
          <div class="flex justify-between items-start mb-3">
            <div>
              <h3 class="font-semibold text-gray-800">Order #${order.id}</h3>
              <p class="text-sm text-gray-600">${order.date}</p>
            </div>
            <span class="px-3 py-1 rounded-full text-sm font-medium ${statusColor}">
              ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}
            </span>
          </div>
          <p class="text-sm text-gray-600 mb-2">Items: ${order.items.join(', ')}</p>
          <div class="flex justify-between items-center">
            <span class="font-semibold text-lg">${formatPrice(order.total)} RWF</span>
            <button class="text-green-600 hover:text-green-700 text-sm font-medium">
              View Details
            </button>
          </div>
        </div>
      `;
    });
    
    ordersContent.innerHTML = html;
  }, 1000);
};

// 7. PROFILE MANAGEMENT
window.loadUserProfile = function() {
  const profileContent = document.getElementById('profile-panel-content');
  if (!profileContent) return;
  
  // Simulate loading
  profileContent.innerHTML = `
    <div class="text-center py-8 text-gray-500">
      <i class="fas fa-spinner loading-spinner text-2xl text-gray-400 mb-2"></i>
      <p>Loading your profile...</p>
    </div>
  `;
  
  // Get user info from token or localStorage
  const userInfo = getUserInfo();
  
  setTimeout(() => {
    profileContent.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
            <input type="text" value="${userInfo.name || 'User'}" class="w-full p-3 border border-gray-300 rounded-lg">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input type="email" value="${userInfo.email || 'user@example.com'}" class="w-full p-3 border border-gray-300 rounded-lg">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Phone</label>
            <input type="tel" value="${userInfo.phone || '+250 XXX XXX XXX'}" class="w-full p-3 border border-gray-300 rounded-lg">
          </div>
        </div>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Address</label>
            <textarea class="w-full p-3 border border-gray-300 rounded-lg" rows="3">${userInfo.address || 'Kigali, Rwanda'}</textarea>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Preferences</label>
            <div class="space-y-2">
              <label class="flex items-center">
                <input type="checkbox" class="mr-2">
                <span class="text-sm">Email notifications</span>
              </label>
              <label class="flex items-center">
                <input type="checkbox" class="mr-2">
                <span class="text-sm">SMS notifications</span>
              </label>
              <label class="flex items-center">
                <input type="checkbox" class="mr-2" checked>
                <span class="text-sm">Order updates</span>
              </label>
            </div>
          </div>
          <button class="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700">
            Save Changes
          </button>
        </div>
      </div>
    `;
  }, 1000);
};

// 8. UTILITY FUNCTIONS
window.formatPrice = function(price) {
  return new Intl.NumberFormat('en-RW').format(price);
};

window.getCartItems = function() {
  try {
    const items = localStorage.getItem('groceryCart');
    return items ? JSON.parse(items) : [];
  } catch (error) {
    console.error('Error getting cart items:', error);
    return [];
  }
};

window.updateCartQuantity = function(productId, newQuantity) {
  const cartItems = getCartItems();
  const itemIndex = cartItems.findIndex(item => item.id === productId);
  
  if (itemIndex > -1) {
    if (newQuantity <= 0) {
      cartItems.splice(itemIndex, 1);
      showNotification('Item removed from cart', 'info');
    } else {
      cartItems[itemIndex].quantity = newQuantity;
    }
    
    localStorage.setItem('groceryCart', JSON.stringify(cartItems));
    loadCartItems();
    updateCartBadges(cartItems);
  }
};

window.removeFromCart = function(productId) {
  updateCartQuantity(productId, 0);
};

window.updateCartBadges = function(cartItems) {
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  
  const badges = [
    'header-cart-badge',
    'tab-cart-badge', 
    'mobile-cart-badge'
  ];
  
  badges.forEach(badgeId => {
    const badge = document.getElementById(badgeId);
    if (badge) {
      if (totalItems > 0) {
        badge.textContent = totalItems;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
  });
};

window.getUserInfo = function() {
  try {
    const userInfo = localStorage.getItem('userInfo');
    return userInfo ? JSON.parse(userInfo) : {};
  } catch (error) {
    return {};
  }
};

window.proceedToCheckout = function() {
  const cartItems = getCartItems();
  if (cartItems.length === 0) {
    showNotification('Your cart is empty', 'warning');
    return;
  }
  
  // Store checkout data
  const checkoutData = {
    items: cartItems,
    timestamp: Date.now()
  };
  
  sessionStorage.setItem('checkoutData', JSON.stringify(checkoutData));
  showNotification('Proceeding to checkout...', 'success');
  
  // Redirect to checkout page after a short delay
  setTimeout(() => {
    window.location.href = '/grocery/local-market-checkout.html';
  }, 1500);
};

// 9. LOGOUT FUNCTIONALITY
window.logout = function() {
  if (confirm('Are you sure you want to logout?')) {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userInfo');
    localStorage.removeItem('groceryCart');
    sessionStorage.clear();
    
    showNotification('Logging out...', 'info');
    setTimeout(() => {
      window.location.href = '/public/login.html';
    }, 1000);
  }
};

// 10. INITIALIZE EVENT LISTENERS
document.addEventListener('DOMContentLoaded', function() {
  console.log('[COMPREHENSIVE] DOM loaded, setting up event listeners...');
  
  // Tab buttons
  const tabButtons = document.querySelectorAll('[data-tab]');
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      const tabName = this.getAttribute('data-tab');
      switchTab(tabName);
    });
  });
  
  // Mobile menu toggle
  const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
  if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener('click', openMobileNav);
  }
  
  // User menu toggle
  const userMenuBtn = document.getElementById('user-menu-btn');
  if (userMenuBtn) {
    userMenuBtn.addEventListener('click', function() {
      const dropdown = document.getElementById('user-dropdown');
      if (dropdown) {
        dropdown.classList.toggle('hidden');
      }
    });
  }
  
  // Logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
  
  // Clear filters button
  const clearFiltersBtn = document.getElementById('clear-filters-btn');
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', function() {
      // Clear all filter inputs
      const filters = [
        'category-filter',
        'sort-filter', 
        'availability-filter',
        'delivery-time-filter',
        'mobile-search-bar',
        'header-search'
      ];
      
      filters.forEach(filterId => {
        const element = document.getElementById(filterId);
        if (element) {
          if (element.type === 'select-one') {
            element.selectedIndex = 0;
          } else {
            element.value = '';
          }
        }
      });
      
      const priceRange = document.getElementById('price-range');
      if (priceRange) {
        priceRange.value = priceRange.max;
        const priceValue = document.getElementById('price-range-value');
        if (priceValue) {
          priceValue.textContent = formatPrice(priceRange.max) + ' RWF';
        }
      }
      
      showNotification('Filters cleared', 'success');
      
      // Reload products if function exists
      if (typeof window.loadProducts === 'function') {
        window.loadProducts();
      }
    });
  }
  
  // Price range slider
  const priceRange = document.getElementById('price-range');
  const priceRangeValue = document.getElementById('price-range-value');
  if (priceRange && priceRangeValue) {
    priceRange.addEventListener('input', function() {
      priceRangeValue.textContent = formatPrice(this.value) + ' RWF';
    });
  }
  
  // Close dropdowns when clicking outside
  document.addEventListener('click', function(event) {
    const userMenuBtn = document.getElementById('user-menu-btn');
    const userDropdown = document.getElementById('user-dropdown');
    
    if (userMenuBtn && userDropdown && 
        !userMenuBtn.contains(event.target) && 
        !userDropdown.contains(event.target)) {
      userDropdown.classList.add('hidden');
    }
  });
  
  // Initialize cart display
  const cartItems = getCartItems();
  updateCartBadges(cartItems);
  
  console.log('[COMPREHENSIVE] All event listeners set up successfully');
});

// 11. CSS ANIMATIONS
const style = document.createElement('style');
style.textContent = `
  .animate-slide-in {
    animation: slideInRight 0.3s ease-out forwards;
  }
  
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  .loading-spinner {
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;
document.head.appendChild(style);

console.log('[COMPREHENSIVE] All missing functions initialized successfully!');

} // End of initialization check