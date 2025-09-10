/**
 * Missing Functions for Local Market Home Signed Page
 * This file contains all the missing JavaScript functions referenced in onclick handlers
 */

// Prevent double-initialization if this script is injected twice
if (window.__MISSING_FUNCTIONS_INIT__) {
  console.debug('missing-functions.js already initialized, skipping redefinition');
} else {
  window.__MISSING_FUNCTIONS_INIT__ = true;

// Missing Navigation Functions
function switchToPhysicalProducts() {
  showNotification('Switching to Physical Products...', 'info');
  setTimeout(() => {
    window.location.href = '/buyer/buyers-home.html';
  }, 1000);
}

function showMyOrders() {
  showNotification('Loading your orders...', 'info');
  setTimeout(() => {
    window.location.href = '/buyer/orders.html';
  }, 1000);
}

function showProfile() {
  try {
    // Close the dropdown first
    const dropdown = document.getElementById('user-dropdown');
    if (dropdown) {
      dropdown.classList.add('hidden');
    }
    
    // Create and show profile modal instead of redirecting
    showProfileModal();
    
  } catch (error) {
    console.error('Error showing profile:', error);
    showNotification('Error loading profile', 'error');
  }
}

function showHelpSupport() {
  showNotification('Opening help & support...', 'info');
  setTimeout(() => {
    window.location.href = '/buyer/support.html';
  }, 1000);
}

// User Menu Toggle
function toggleUserMenu() {
  const dropdown = document.getElementById('user-dropdown');
  if (dropdown) {
    dropdown.classList.toggle('hidden');
  }
}

// Close user menu when clicking outside
document.addEventListener('click', function(event) {
  const userMenuBtn = document.getElementById('user-menu-btn');
  const dropdown = document.getElementById('user-dropdown');
  
  if (userMenuBtn && dropdown && !userMenuBtn.contains(event.target) && !dropdown.contains(event.target)) {
    dropdown.classList.add('hidden');
  }
});

// Location Functions
function openLocationSettings() {
  showNotification('Opening location settings...', 'info');
  setTimeout(() => {
    window.location.href = '/grocery/location-settings.html';
  }, 1000);
}

function updateLocation() {
  openLocationSettings();
}

function getCurrentLocation() {
  if (!navigator.geolocation) {
    showNotification('Geolocation is not supported by this browser', 'error');
    return;
  }
  
  showNotification('Getting your current location...', 'info');
  
  navigator.geolocation.getCurrentPosition(
    async function(position) {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      
      try {
        // Save location without external API dependency
        const locationData = {
          lat: lat,
          lng: lng,
          address: `Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          timestamp: Date.now()
        };
        
        localStorage.setItem('userLocation', JSON.stringify(locationData));
        
        // Update location display if function exists
        if (typeof updateCurrentLocationDisplay === 'function') {
          updateCurrentLocationDisplay();
        }
        
        // Reload products if function exists
        if (typeof loadProducts === 'function') {
          loadProducts();
        }
        
        showNotification('Location updated successfully!', 'success');
      } catch (error) {
        console.error('Error saving location:', error);
        showNotification('Failed to save location', 'error');
      }
    },
    function(error) {
      console.error('Error getting location:', error);
      let message = 'Unable to get your location';
      
      switch(error.code) {
        case error.PERMISSION_DENIED:
          message = 'Location access denied. Please enable location services.';
          break;
        case error.POSITION_UNAVAILABLE:
          message = 'Location information unavailable.';
          break;
        case error.TIMEOUT:
          message = 'Location request timed out.';
          break;
      }
      
      showNotification(message, 'error');
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000 // 5 minutes
    }
  );
}

// Filter Functions
function clearAllFilters() {
  // Reset all filter inputs
  const categoryFilter = document.getElementById('category-filter');
  const sortFilter = document.getElementById('sort-filter');
  const priceRange = document.getElementById('price-range');
  const availabilityFilter = document.getElementById('availability-filter');
  const deliveryTimeFilter = document.getElementById('delivery-time-filter');
  const mobileSearch = document.getElementById('mobile-search-bar');
  const headerSearch = document.getElementById('header-search');
  
  if (categoryFilter) categoryFilter.value = '';
  if (sortFilter) sortFilter.value = 'name';
  if (priceRange) {
    priceRange.value = priceRange.max;
    const priceRangeValue = document.getElementById('price-range-value');
    if (priceRangeValue) {
      priceRangeValue.textContent = formatPrice(priceRange.max) + ' RWF';
    }
  }
  if (availabilityFilter) availabilityFilter.value = '';
  if (deliveryTimeFilter) deliveryTimeFilter.value = '';
  if (mobileSearch) mobileSearch.value = '';
  if (headerSearch) headerSearch.value = '';
  
  // Clear advanced filters
  const filterCheckboxes = [
    'show-out-of-stock',
    'show-organic-only', 
    'show-local-only',
    'show-discounted'
  ];
  
  filterCheckboxes.forEach(id => {
    const checkbox = document.getElementById(id);
    if (checkbox) checkbox.checked = false;
  });
  
  const minPriceFilter = document.getElementById('min-price-filter');
  const maxPriceFilter = document.getElementById('max-price-filter');
  if (minPriceFilter) minPriceFilter.value = '';
  if (maxPriceFilter) maxPriceFilter.value = '';
  
  // Clear stored filters
  localStorage.removeItem('productFilters');
  
  // Reload products if function exists
  if (typeof loadProducts === 'function') {
    loadProducts();
  }
  
  showNotification('All filters cleared', 'success');
}

// Product Loading Functions
function loadMoreProducts() {
  const currentPage = parseInt(sessionStorage.getItem('currentPage') || '1');
  const nextPage = currentPage + 1;
  
  sessionStorage.setItem('currentPage', nextPage.toString());
  
  // Show loading state
  const loadMoreBtn = document.getElementById('load-more-btn');
  if (loadMoreBtn) {
    loadMoreBtn.innerHTML = '<i class="fas fa-spinner loading-spinner mr-2"></i>Loading more...';
    loadMoreBtn.disabled = true;
  }
  
  // Load next page of products if function exists
  if (typeof loadProducts === 'function') {
    loadProducts(false); // false = append to existing products
  } else {
    showNotification('Loading more products...', 'info');
    setTimeout(() => {
      if (loadMoreBtn) {
        loadMoreBtn.innerHTML = 'Load More Products';
        loadMoreBtn.disabled = false;
      }
    }, 2000);
  }
}

// Checkout Functions
function secureCheckout() {
  const cartItems = getCartItems();
  
  if (cartItems.length === 0) {
    showNotification('Your cart is empty', 'warning');
    return;
  }
  
  // Validate user location
  const savedLocation = getSavedLocation();
  if (!savedLocation) {
    showNotification('Please set your delivery location first', 'warning');
    if (typeof openLocationSettings === 'function') {
      openLocationSettings();
    }
    return;
  }
  
  // Calculate totals
  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const deliveryFee = 0; // Free delivery promotion
  const total = subtotal + deliveryFee;
  
  // Store checkout data
  const checkoutData = {
    items: cartItems,
    subtotal: subtotal,
    deliveryFee: deliveryFee,
    total: total,
    deliveryLocation: savedLocation,
    timestamp: Date.now()
  };
  
  sessionStorage.setItem('checkoutData', JSON.stringify(checkoutData));
  
  // Redirect to checkout page
  showNotification('Proceeding to secure checkout...', 'success');
  setTimeout(() => {
    window.location.href = '/buyer/checkout.html';
  }, 1000);
}

// Proceed to checkout function for shopping menu
window.proceedToCheckout = async function() {
  try {
    if (typeof shoppingMenu !== 'undefined' && shoppingMenu.length === 0) {
      showNotification('Your menu is empty!', 'error');
      return;
    }

    // Show delivery location modal first
    showDeliveryLocationModal();
    
  } catch (error) {
    console.error('Error proceeding to checkout:', error);
    showNotification('Error proceeding to checkout', 'error');
  }
};

// Cart Management Functions
function getCartItems() {
  try {
    return JSON.parse(localStorage.getItem('groceryCart') || '[]');
  } catch (error) {
    console.error('Error getting cart items:', error);
    return [];
  }
}

function getSavedLocation() {
  try {
    return JSON.parse(localStorage.getItem('userLocation') || 'null');
  } catch (error) {
    console.error('Error getting saved location:', error);
    return null;
  }
}

function addToCart(productId, quantity = 1) {
  try {
    const cartItems = getCartItems();
    const existingItem = cartItems.find(item => item.id === productId);
    
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      // Get product details from the DOM or make API call
      const productCard = document.querySelector(`[data-product-id="${productId}"]`);
      if (productCard) {
        const productData = {
          id: productId,
          name: productCard.querySelector('.product-name')?.textContent || 'Unknown Product',
          price: parseFloat(productCard.querySelector('.product-price')?.textContent.replace(/[^\d.]/g, '') || '0'),
          image: productCard.querySelector('.product-image')?.src || '',
          quantity: quantity,
          addedAt: Date.now()
        };
        cartItems.push(productData);
      }
    }
    
    localStorage.setItem('groceryCart', JSON.stringify(cartItems));
    updateCartDisplay();
    showNotification('Added to cart!', 'success');
    
  } catch (error) {
    console.error('Error adding to cart:', error);
    showNotification('Failed to add to cart', 'error');
  }
}

function removeFromCart(productId) {
  try {
    const cartItems = getCartItems();
    const updatedItems = cartItems.filter(item => item.id !== productId);
    
    localStorage.setItem('groceryCart', JSON.stringify(updatedItems));
    updateCartDisplay();
    showNotification('Removed from cart', 'info');
    
  } catch (error) {
    console.error('Error removing from cart:', error);
    showNotification('Failed to remove from cart', 'error');
  }
}

function updateCartQuantity(productId, newQuantity) {
  try {
    const cartItems = getCartItems();
    const item = cartItems.find(item => item.id === productId);
    
    if (item) {
      if (newQuantity <= 0) {
        removeFromCart(productId);
      } else {
        item.quantity = newQuantity;
        localStorage.setItem('groceryCart', JSON.stringify(cartItems));
        updateCartDisplay();
      }
    }
    
  } catch (error) {
    console.error('Error updating cart quantity:', error);
    showNotification('Failed to update quantity', 'error');
  }
}

function updateCartDisplay() {
  const cartItems = getCartItems();
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  // Update menu item count
  const menuItemCount = document.getElementById('menu-item-count');
  if (menuItemCount) {
    menuItemCount.textContent = cartCount;
  }
  
  // Update cart count badge (if exists)
  const cartCountElements = document.querySelectorAll('.cart-count');
  cartCountElements.forEach(element => {
    element.textContent = cartCount;
    element.style.display = cartCount > 0 ? 'block' : 'none';
  });
  
  // Update totals
  const productsTotal = document.getElementById('products-total');
  const grandTotal = document.getElementById('grand-total');
  
  if (productsTotal) {
    productsTotal.textContent = formatPrice(cartTotal) + ' RWF';
  }
  
  if (grandTotal) {
    grandTotal.textContent = formatPrice(cartTotal) + ' RWF';
  }
  
  // Show/hide cost breakdown
  const costBreakdown = document.getElementById('cost-breakdown');
  const deliveryInfoSetup = document.getElementById('delivery-info-setup');
  
  if (costBreakdown) {
    if (cartCount > 0) {
      costBreakdown.classList.remove('hidden');
    } else {
      costBreakdown.classList.add('hidden');
    }
  }
  
  if (deliveryInfoSetup) {
    if (cartCount > 0) {
      deliveryInfoSetup.classList.remove('hidden');
    } else {
      deliveryInfoSetup.classList.add('hidden');
    }
  }
  
  // Update checkout button state
  const checkoutBtn = document.getElementById('checkout-btn');
  if (checkoutBtn) {
    checkoutBtn.disabled = cartCount === 0;
    if (cartCount > 0) {
      checkoutBtn.innerHTML = `<i class="fas fa-shopping-cart mr-2"></i>Confirm & Checkout (${cartCount} items)`;
    } else {
      checkoutBtn.innerHTML = `<i class="fas fa-shopping-cart mr-2"></i>Cart is Empty`;
    }
  }
  
  // Render cart items in sidebar
  renderCartItems();
}

function renderCartItems() {
  const cartItems = getCartItems();
  const cartContainer = document.getElementById('menu-items-list');
  
  if (!cartContainer) return;
  
  if (cartItems.length === 0) {
    cartContainer.innerHTML = `
      <p class="text-center text-gray-500 py-8">Your menu is empty. Add items to get started!</p>
    `;
    return;
  }
  
  cartContainer.innerHTML = cartItems.map(item => `
    <div class="menu-item-enter bg-gray-50 rounded-lg p-3 border border-gray-200">
      <div class="flex items-center justify-between mb-2">
        <h4 class="font-medium text-sm text-gray-800 truncate flex-1 mr-2">${item.name}</h4>
        <button onclick="removeFromCart('${item.id}')" 
                class="text-red-500 hover:text-red-700 text-xs">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <button onclick="updateCartQuantity('${item.id}', ${item.quantity - 1})" 
                  class="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs hover:bg-gray-300">
            <i class="fas fa-minus"></i>
          </button>
          <span class="text-sm font-medium w-8 text-center">${item.quantity}</span>
          <button onclick="updateCartQuantity('${item.id}', ${item.quantity + 1})" 
                  class="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-green-600">
            <i class="fas fa-plus"></i>
          </button>
        </div>
        <div class="text-right">
          <p class="text-green-600 font-semibold text-sm">${formatPrice(item.price * item.quantity)} RWF</p>
          <p class="text-xs text-gray-500">${formatPrice(item.price)} each</p>
        </div>
      </div>
    </div>
  `).join('');
}

// Utility Functions
function formatPrice(price) {
  return new Intl.NumberFormat('en-RW').format(price);
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Notification function (fallback if not defined elsewhere)
function showNotification(message, type = 'info') {
  // Try to use existing notification system first
  if (window.showNotification && window.showNotification !== showNotification) {
    return window.showNotification(message, type);
  }
  
  // Fallback notification system
  const notification = document.createElement('div');
  notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm transition-all duration-300 transform translate-x-full`;
  
  // Set colors based on type
  switch (type) {
    case 'success':
      notification.className += ' bg-green-500 text-white';
      break;
    case 'error':
      notification.className += ' bg-red-500 text-white';
      break;
    case 'warning':
      notification.className += ' bg-yellow-500 text-white';
      break;
    default:
      notification.className += ' bg-blue-500 text-white';
  }
  
  notification.innerHTML = `
    <div class="flex items-center gap-2">
      <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
      <span>${message}</span>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Animate in
  setTimeout(() => {
    notification.classList.remove('translate-x-full');
  }, 100);
  
  // Auto remove after 3 seconds
  setTimeout(() => {
    notification.classList.add('translate-x-full');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

// Profile Modal Function
function showProfileModal() {
  // Get current user data
  function getCurrentUser() {
    try {
      // Try to get user from localStorage or sessionStorage
      const userData = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
      if (userData) {
        return JSON.parse(userData);
      }

      // Try to get from auth token
      const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
      if (token) {
        try {
          // Decode JWT token to get user info (basic implementation)
          const payload = JSON.parse(atob(token.split('.')[1]));
          return {
            id: payload.userId || payload.id,
            name: payload.name || payload.username || 'User',
            email: payload.email || '',
            role: payload.role || 'buyer',
            address: payload.address || ''
          };
        } catch (e) {
          console.error('Error decoding token:', e);
        }
      }

      // Return default user object
      return {
        id: 'guest',
        name: 'Guest User',
        email: '',
        role: 'buyer',
        address: 'Location not set'
      };
    } catch (error) {
      console.error('Error getting current user:', error);
      return {
        id: 'guest',
        name: 'Guest User',
        email: '',
        role: 'buyer',
        address: 'Location not set'
      };
    }
  }

  const currentUser = getCurrentUser();
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
      <div class="p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-2xl font-bold text-gray-800">My Profile</h2>
          <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600">
            <i class="fas fa-times text-xl"></i>
          </button>
        </div>
        
        <div class="space-y-4">
          <div class="text-center mb-6">
            <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <i class="fas fa-user text-3xl text-green-600"></i>
            </div>
            <h3 class="text-xl font-semibold text-gray-800">${currentUser.name}</h3>
            <p class="text-sm text-gray-500">${currentUser.role || 'Buyer'}</p>
          </div>
          
          <div class="space-y-3">
            <div class="bg-gray-50 p-4 rounded-lg">
              <h4 class="font-semibold text-gray-700 mb-2">Email</h4>
              <p class="text-sm text-gray-600">${currentUser.email || 'Not provided'}</p>
            </div>
            
            <div class="bg-gray-50 p-4 rounded-lg">
              <h4 class="font-semibold text-gray-700 mb-2">Location</h4>
              <p class="text-sm text-gray-600">${currentUser.address || 'Location not set'}</p>
              <button onclick="openLocationSettings()" class="text-green-600 text-sm hover:underline mt-2">Update Location</button>
            </div>
          </div>
          
          <div class="pt-4 border-t border-gray-200">
            <button onclick="this.closest('.fixed').remove()" class="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

// Initialize cart display when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  updateCartDisplay();
});

// Make functions globally available
window.switchToPhysicalProducts = switchToPhysicalProducts;
window.showMyOrders = showMyOrders;
window.showProfile = showProfile;
window.showProfileModal = showProfileModal;
window.showHelpSupport = showHelpSupport;
window.toggleUserMenu = toggleUserMenu;
window.openLocationSettings = openLocationSettings;
window.updateLocation = updateLocation;
window.getCurrentLocation = getCurrentLocation;
window.clearAllFilters = clearAllFilters;
window.loadMoreProducts = loadMoreProducts;
window.secureCheckout = secureCheckout;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateCartQuantity = updateCartQuantity;
window.getCartItems = getCartItems;
window.getSavedLocation = getSavedLocation;
window.updateCartDisplay = updateCartDisplay;
window.renderCartItems = renderCartItems;
window.formatPrice = formatPrice;
window.debounce = debounce;

// Override showNotification if not already defined
if (!window.showNotification) {
  window.showNotification = showNotification;
}

// Show delivery location details modal
function showDeliveryLocationModal() {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
      <div class="p-6">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-xl font-bold text-gray-800">Delivery Location Details</h3>
          <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600">
            <i class="fas fa-times text-xl"></i>
          </button>
        </div>
        
        <form id="delivery-location-form" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
              <input type="text" id="buyer-full-name" required class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" placeholder="Enter your full name">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label>
              <input type="tel" id="buyer-phone" required class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" placeholder="+250 xxx xxx xxx">
            </div>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Emergency Contact (Optional)</label>
            <input type="tel" id="emergency-contact" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" placeholder="+250 xxx xxx xxx">
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Province *</label>
              <select id="province" required class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500">
                <option value="">Select Province</option>
                <option value="Kigali">Kigali</option>
                <option value="Northern">Northern</option>
                <option value="Southern">Southern</option>
                <option value="Eastern">Eastern</option>
                <option value="Western">Western</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">District *</label>
              <input type="text" id="district" required class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" placeholder="Enter district">
            </div>
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Sector *</label>
              <input type="text" id="sector" required class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" placeholder="Enter sector">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Village *</label>
              <input type="text" id="village" required class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" placeholder="Enter village">
            </div>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Detailed Address</label>
            <textarea id="detailed-address" rows="3" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" placeholder="House number, street name, landmarks..."></textarea>
          </div>
          
          <div class="flex gap-3 pt-4">
            <button type="button" onclick="this.closest('.fixed').remove()" class="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">
              Cancel
            </button>
            <button type="submit" class="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">
              Continue to Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Handle form submission
  document.getElementById('delivery-location-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const deliveryInfo = collectDeliveryInfo();
    if (deliveryInfo) {
      modal.remove();
      showPaymentModal(deliveryInfo);
    }
  });
}

// Collect delivery information from form
function collectDeliveryInfo() {
  const fullName = document.getElementById('buyer-full-name').value.trim();
  const phone = document.getElementById('buyer-phone').value.trim();
  const emergencyContact = document.getElementById('emergency-contact').value.trim();
  const province = document.getElementById('province').value;
  const district = document.getElementById('district').value.trim();
  const sector = document.getElementById('sector').value.trim();
  const village = document.getElementById('village').value.trim();
  const detailedAddress = document.getElementById('detailed-address').value.trim();
  
  // Validation
  if (!fullName || !phone || !province || !district || !sector || !village) {
    showNotification('Please fill in all required fields', 'error');
    return null;
  }
  
  return {
    fullName,
    phone,
    emergencyContact,
    province,
    district,
    sector,
    village,
    detailedAddress,
    fullAddress: `${village}, ${sector}, ${district}, ${province}${detailedAddress ? ', ' + detailedAddress : ''}`
  };
}

// Show enhanced payment modal with app payment details
function showPaymentModal(deliveryInfo) {
  const total = typeof shoppingMenu !== 'undefined' ? 
    shoppingMenu.reduce((sum, item) => sum + (item.price * item.quantity), 0) : 0;
  
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
      <div class="p-6">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-xl font-bold text-gray-800">Submit Payment Proof</h3>
          <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600">
            <i class="fas fa-times text-xl"></i>
          </button>
        </div>
        
        <!-- Order Summary -->
        <div class="bg-green-50 rounded-lg p-4 mb-6">
          <h4 class="font-semibold text-green-800 mb-2">Order Summary</h4>
          <div class="space-y-1 text-sm">
            <div class="flex justify-between">
              <span>Items</span>
              <span>${total.toFixed(0)} RWF</span>
            </div>
            <div class="flex justify-between text-green-600">
              <span>Delivery</span>
              <span>FREE</span>
            </div>
            <div class="flex justify-between text-green-600">
              <span>Packaging</span>
              <span>FREE</span>
            </div>
            <hr class="my-2">
            <div class="flex justify-between font-bold text-lg">
              <span>Total to Pay</span>
              <span>${total.toFixed(0)} RWF</span>
            </div>
          </div>
        </div>
        
        <!-- Payment Instructions -->
        <div class="bg-blue-50 rounded-lg p-4 mb-6">
          <h4 class="font-semibold text-blue-800 mb-3 flex items-center">
            <i class="fas fa-mobile-alt mr-2"></i>
            Payment Instructions
          </h4>
          <div class="space-y-3 text-sm">
            <div class="bg-white rounded-lg p-3 border border-blue-200">
              <div class="font-semibold text-blue-800 mb-1">MTN Mobile Money</div>
              <div class="text-gray-600">Dial: *182*1*1*${total.toFixed(0)}*0788123456#</div>
              <div class="text-xs text-gray-500">Account: African Deals Domain</div>
            </div>
            <div class="bg-white rounded-lg p-3 border border-blue-200">
              <div class="font-semibold text-blue-800 mb-1">Airtel Money</div>
              <div class="text-gray-600">Dial: *500*1*1*${total.toFixed(0)}*0732123456#</div>
              <div class="text-xs text-gray-500">Account: African Deals Domain</div>
            </div>
          </div>
        </div>
        
        <form id="payment-proof-form" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Payment Method *</label>
            <select id="payment-method" required class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500">
              <option value="">Select payment method</option>
              <option value="mtn_momo">MTN Mobile Money</option>
              <option value="airtel_money">Airtel Money</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="tigo_cash">Tigo Cash</option>
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Transaction ID *</label>
            <input type="text" id="transaction-id" required class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" placeholder="Enter transaction ID/reference">
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Phone Number Used *</label>
            <input type="tel" id="payment-phone" required class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" placeholder="+250 xxx xxx xxx">
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Amount Paid *</label>
            <input type="number" id="payment-amount" required value="${total.toFixed(0)}" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" readonly>
          </div>
          
          <div class="flex gap-3 pt-4">
            <button type="button" onclick="this.closest('.fixed').remove()" class="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">
              Cancel
            </button>
            <button type="submit" class="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">
              <i class="fas fa-paper-plane mr-2"></i>
              Submit Order
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Handle form submission
  document.getElementById('payment-proof-form').addEventListener('submit', function(e) {
    e.preventDefault();
    submitOrderWithPayment(deliveryInfo, modal);
  });
}

// Submit order with payment proof
async function submitOrderWithPayment(deliveryInfo, modal) {
  try {
    const submitBtn = modal.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Submitting...';
    submitBtn.disabled = true;
    
    // Get cart items (use cart items instead of shoppingMenu for consistency)
    const cartItems = getCartItems();
    if (cartItems.length === 0) {
      throw new Error('No items in cart');
    }
    
    // Collect payment data
    const paymentData = {
      payment_method: document.getElementById('payment-method').value,
      transaction_id: document.getElementById('transaction-id').value,
      payment_phone: document.getElementById('payment-phone').value,
      amount: parseFloat(document.getElementById('payment-amount').value)
    };
    
    // Calculate totals
    const productsTotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const deliveryFee = 0; // FREE delivery
    const grandTotal = productsTotal + deliveryFee;
    
    // Prepare order data for the existing orders API
    const orderData = {
      marketplace_type: 'local_grocery',
      delivery_type: 'home_delivery',
      items: cartItems.map(item => ({
        product_id: item.id,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity,
        seller_id: item.seller_id || null,
        category: item.category || 'grocery'
      })),
      shipping_address: {
        full_name: deliveryInfo.fullName,
        phone: deliveryInfo.phone,
        emergency_contact: deliveryInfo.emergencyContact,
        province: deliveryInfo.province,
        district: deliveryInfo.district,
        sector: deliveryInfo.sector,
        village: deliveryInfo.village,
        detailed_address: deliveryInfo.detailedAddress,
        full_address: deliveryInfo.fullAddress
      },
      billing_address: {
        full_name: deliveryInfo.fullName,
        phone: deliveryInfo.phone,
        province: deliveryInfo.province,
        district: deliveryInfo.district,
        sector: deliveryInfo.sector,
        village: deliveryInfo.village,
        detailed_address: deliveryInfo.detailedAddress
      },
      payment_method: paymentData.payment_method,
      payment_details: {
        transaction_id: paymentData.transaction_id,
        payment_phone: paymentData.payment_phone,
        amount_paid: paymentData.amount
      },
      totals: {
        subtotal: productsTotal,
        delivery_fee: deliveryFee,
        platform_fee: 0,
        total_amount: grandTotal
      },
      special_instructions: document.getElementById('delivery-instructions')?.value || '',
      referral_code: new URLSearchParams(window.location.search).get('ref') || null
    };
    
    // Submit order to backend using existing orders API
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    const orderResponse = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(orderData)
    });
    
    if (!orderResponse.ok) {
      const errorData = await orderResponse.json();
      throw new Error(errorData.message || 'Failed to create order');
    }
    
    const orderResult = await orderResponse.json();
    const orderId = orderResult.order_id || orderResult.id;
    const orderNumber = orderResult.order_number;
    
    // Handle file upload for payment proof if provided
    const paymentProofFile = document.getElementById('payment-proof-file').files[0];
    if (paymentProofFile) {
      const formData = new FormData();
      formData.append('payment_proof', paymentProofFile);
      formData.append('order_id', orderId);
      formData.append('payment_method', paymentData.payment_method);
      formData.append('transaction_id', paymentData.transaction_id);
      
      const uploadResponse = await fetch('/api/orders/payment-proof', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (!uploadResponse.ok) {
        console.warn('Failed to upload payment proof, but order was created');
      }
    }
    
    // Clear cart after successful order
    localStorage.removeItem('groceryCart');
    updateCartDisplay();
    
    // Close modal and show success
    modal.remove();
    showOrderSuccessModal(orderNumber || orderId);
    
    // Track referral if applicable
    const referralCode = new URLSearchParams(window.location.search).get('ref');
    if (referralCode) {
      trackReferralPurchase(referralCode, orderId, grandTotal);
    }
    
  } catch (error) {
    console.error('Error submitting order:', error);
    showNotification('Error submitting order: ' + error.message, 'error');
    
    // Reset button
    const submitBtn = modal.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  }
}

// Track referral purchase
async function trackReferralPurchase(referralCode, orderId, amount) {
  try {
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    await fetch('/api/referrals/track-purchase', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        referralCode: referralCode,
        orderId: orderId,
        purchaseAmount: amount,
        purchasedAt: new Date().toISOString()
      })
    });
  } catch (error) {
    console.error('Error tracking referral purchase:', error);
  }
}

// Show order success modal with tracking functionality
function showOrderSuccessModal(orderId) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl max-w-md w-full text-center p-8">
      <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <i class="fas fa-check text-3xl text-green-600"></i>
      </div>
      <h3 class="text-2xl font-bold text-gray-800 mb-4">Order Submitted Successfully!</h3>
      <p class="text-gray-600 mb-6">Your order <strong>#${orderId}</strong> has been submitted successfully. You can track your order status and delivery progress.</p>
      
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div class="flex items-center justify-center gap-2 text-blue-800 mb-2">
          <i class="fas fa-info-circle"></i>
          <span class="font-semibold">What's Next?</span>
        </div>
        <ul class="text-sm text-blue-700 text-left space-y-1">
          <li>• Agent will contact you for confirmation</li>
          <li>• Payment verification (if applicable)</li>
          <li>• Order preparation & packaging</li>
          <li>• FREE delivery to your location</li>
        </ul>
      </div>
      
      <div class="space-y-3">
        <button onclick="trackOrder('${orderId}'); this.closest('.fixed').remove();" class="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium">
          <i class="fas fa-truck mr-2"></i>
          Track This Order
        </button>
        <button onclick="showMyOrders(); this.closest('.fixed').remove();" class="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-medium">
          <i class="fas fa-receipt mr-2"></i>
          View All My Orders
        </button>
        <button onclick="this.closest('.fixed').remove()" class="w-full border border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50 font-medium">
          Continue Shopping
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

// Track specific order
function trackOrder(orderId) {
  showNotification('Loading order tracking...', 'info');
  setTimeout(() => {
    // Redirect to orders page with specific order highlighted
    window.location.href = `/buyer/orders.html?track=${orderId}`;
  }, 1000);
}

// Share & Earn functionality
window.shareProduct = function(productId, productName) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl max-w-md w-full p-6">
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-xl font-bold text-gray-800">Share & Earn</h3>
        <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600">
          <i class="fas fa-times text-xl"></i>
        </button>
      </div>
      
      <div class="text-center mb-6">
        <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <i class="fas fa-share-alt text-2xl text-green-600"></i>
        </div>
        <h4 class="font-semibold text-lg mb-2">Earn 50 RWF per referral!</h4>
        <p class="text-gray-600 text-sm">Share this product and earn commission when someone buys through your link.</p>
      </div>
      
      <div class="space-y-3">
        <button onclick="shareToWhatsApp('${productId}', '${productName}')" class="w-full flex items-center justify-center gap-3 bg-green-500 text-white py-3 rounded-lg hover:bg-green-600">
          <i class="fab fa-whatsapp text-xl"></i>
          Share on WhatsApp
        </button>
        <button onclick="shareToFacebook('${productId}', '${productName}')" class="w-full flex items-center justify-center gap-3 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700">
          <i class="fab fa-facebook text-xl"></i>
          Share on Facebook
        </button>
        <button onclick="copyShareLink('${productId}', '${productName}')" class="w-full flex items-center justify-center gap-3 border border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50">
          <i class="fas fa-copy text-xl"></i>
          Copy Link
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
};

// Share functions
window.shareToWhatsApp = function(productId, productName) {
  const shareUrl = `${window.location.origin}/grocery/local-market-home-signed.html?product=${productId}&ref=share`;
  const message = `Check out this amazing product: ${productName} on African Deals Domain Local Market! 🛒✨ ${shareUrl}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
};

window.shareToFacebook = function(productId, productName) {
  const shareUrl = `${window.location.origin}/grocery/local-market-home-signed.html?product=${productId}&ref=share`;
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
};

window.copyShareLink = async function(productId, productName) {
  const shareUrl = `${window.location.origin}/grocery/local-market-home-signed.html?product=${productId}&ref=share`;
  try {
    await navigator.clipboard.writeText(shareUrl);
    showNotification('Share link copied to clipboard!', 'success');
  } catch (error) {
    console.error('Error copying to clipboard:', error);
    showNotification('Error copying link', 'error');
  }
};

// Save Menu for Later functionality
function saveMenuForLater() {
  try {
    const cartItems = getCartItems();
    
    if (cartItems.length === 0) {
      showNotification('Your menu is empty!', 'warning');
      return;
    }
    
    // Save current menu to localStorage with timestamp
    const savedMenu = {
      items: cartItems,
      savedAt: Date.now(),
      totalItems: cartItems.reduce((sum, item) => sum + item.quantity, 0),
      totalAmount: cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    };
    
    localStorage.setItem('savedGroceryMenu', JSON.stringify(savedMenu));
    
    showNotification(`Menu saved! ${savedMenu.totalItems} items saved for later.`, 'success');
    
  } catch (error) {
    console.error('Error saving menu:', error);
    showNotification('Failed to save menu', 'error');
  }
}

// Load saved menu
function loadSavedMenu() {
  try {
    const savedMenu = localStorage.getItem('savedGroceryMenu');
    if (!savedMenu) {
      showNotification('No saved menu found', 'info');
      return;
    }
    
    const menuData = JSON.parse(savedMenu);
    const savedDate = new Date(menuData.savedAt).toLocaleDateString();
    
    // Show confirmation modal
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl max-w-md w-full p-6">
        <div class="text-center mb-6">
          <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i class="fas fa-bookmark text-2xl text-blue-600"></i>
          </div>
          <h3 class="text-xl font-bold text-gray-800 mb-2">Load Saved Menu?</h3>
          <p class="text-gray-600 text-sm">Found a saved menu from ${savedDate} with ${menuData.totalItems} items (${formatPrice(menuData.totalAmount)} RWF)</p>
        </div>
        
        <div class="space-y-3">
          <button onclick="restoreSavedMenu(); this.closest('.fixed').remove();" class="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium">
            <i class="fas fa-download mr-2"></i>
            Load Saved Menu
          </button>
          <button onclick="this.closest('.fixed').remove()" class="w-full border border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50 font-medium">
            Cancel
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
  } catch (error) {
    console.error('Error loading saved menu:', error);
    showNotification('Failed to load saved menu', 'error');
  }
}

// Restore saved menu to current cart
function restoreSavedMenu() {
  try {
    const savedMenu = localStorage.getItem('savedGroceryMenu');
    if (!savedMenu) return;
    
    const menuData = JSON.parse(savedMenu);
    
    // Clear current cart and load saved items
    localStorage.setItem('groceryCart', JSON.stringify(menuData.items));
    
    // Update display
    updateCartDisplay();
    
    showNotification(`Menu restored! ${menuData.totalItems} items loaded.`, 'success');
    
  } catch (error) {
    console.error('Error restoring saved menu:', error);
    showNotification('Failed to restore menu', 'error');
  }
}

// Clear menu function
function clearMenu() {
  try {
    const cartItems = getCartItems();
    
    if (cartItems.length === 0) {
      showNotification('Menu is already empty', 'info');
      return;
    }
    
    // Show confirmation modal
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl max-w-md w-full p-6">
        <div class="text-center mb-6">
          <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i class="fas fa-trash text-2xl text-red-600"></i>
          </div>
          <h3 class="text-xl font-bold text-gray-800 mb-2">Clear Menu?</h3>
          <p class="text-gray-600 text-sm">This will remove all ${cartItems.length} items from your menu. This action cannot be undone.</p>
        </div>
        
        <div class="space-y-3">
          <button onclick="confirmClearMenu(); this.closest('.fixed').remove();" class="w-full bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 font-medium">
            <i class="fas fa-trash mr-2"></i>
            Yes, Clear Menu
          </button>
          <button onclick="this.closest('.fixed').remove()" class="w-full border border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50 font-medium">
            Cancel
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
  } catch (error) {
    console.error('Error clearing menu:', error);
    showNotification('Failed to clear menu', 'error');
  }
}

// Confirm clear menu
function confirmClearMenu() {
  try {
    localStorage.removeItem('groceryCart');
    updateCartDisplay();
    showNotification('Menu cleared successfully', 'success');
  } catch (error) {
    console.error('Error confirming clear menu:', error);
    showNotification('Failed to clear menu', 'error');
  }
}

// Enhanced Share & Earn functionality with exact commission calculation
window.shareProduct = function(productId, productName, productPrice) {
  // Calculate exact commission based on commission service logic
  const basePrice = parseFloat(productPrice) || 0;
  const platformMargin = basePrice * 0.21; // 21% platform fee
  const referralCommission = platformMargin * 0.15; // 15% of platform margin for referrals
  
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl max-w-md w-full p-6">
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-xl font-bold text-gray-800">Share & Earn</h3>
        <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600">
          <i class="fas fa-times text-xl"></i>
        </button>
      </div>
      
      <div class="text-center mb-6">
        <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <i class="fas fa-share-alt text-2xl text-green-600"></i>
        </div>
        <h4 class="font-semibold text-lg mb-2">Earn ${formatPrice(referralCommission)} RWF per sale!</h4>
        <p class="text-gray-600 text-sm">Share "${productName}" and earn commission when someone buys through your referral link.</p>
        <div class="bg-green-50 border border-green-200 rounded-lg p-3 mt-4">
          <div class="text-sm text-green-800">
            <div class="flex justify-between">
              <span>Product Price:</span>
              <span>${formatPrice(basePrice)} RWF</span>
            </div>
            <div class="flex justify-between">
              <span>Your Commission:</span>
              <span class="font-bold">${formatPrice(referralCommission)} RWF</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="space-y-3">
        <button onclick="shareToWhatsApp('${productId}', '${productName}', ${referralCommission})" class="w-full flex items-center justify-center gap-3 bg-green-500 text-white py-3 rounded-lg hover:bg-green-600">
          <i class="fab fa-whatsapp text-xl"></i>
          Share on WhatsApp
        </button>
        <button onclick="shareToFacebook('${productId}', '${productName}', ${referralCommission})" class="w-full flex items-center justify-center gap-3 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700">
          <i class="fab fa-facebook text-xl"></i>
          Share on Facebook
        </button>
        <button onclick="copyShareLink('${productId}', '${productName}', ${referralCommission})" class="w-full flex items-center justify-center gap-3 border border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50">
          <i class="fas fa-copy text-xl"></i>
          Copy Referral Link
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
};

// Enhanced share functions with commission info
window.shareToWhatsApp = function(productId, productName, commission) {
  const currentUser = getCurrentUser();
  const referralCode = generateReferralCode(currentUser.id, productId);
  const shareUrl = `${window.location.origin}/grocery/local-market-home-signed.html?product=${productId}&ref=${referralCode}`;
  const message = `🛒 Check out this amazing product: *${productName}* on African Deals Domain Local Market!\n\n✨ Fresh • Fast • Local delivery\n💰 Great prices with FREE delivery\n\n👆 Shop now: ${shareUrl}\n\n#AfricanDealsLocal #FreshGroceries`;
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  
  // Track referral link generation
  trackReferralGeneration(productId, 'whatsapp', referralCode);
};

window.shareToFacebook = function(productId, productName, commission) {
  const currentUser = getCurrentUser();
  const referralCode = generateReferralCode(currentUser.id, productId);
  const shareUrl = `${window.location.origin}/grocery/local-market-home-signed.html?product=${productId}&ref=${referralCode}`;
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
  
  // Track referral link generation
  trackReferralGeneration(productId, 'facebook', referralCode);
};

window.copyShareLink = async function(productId, productName, commission) {
  const currentUser = getCurrentUser();
  const referralCode = generateReferralCode(currentUser.id, productId);
  const shareUrl = `${window.location.origin}/grocery/local-market-home-signed.html?product=${productId}&ref=${referralCode}`;
  
  try {
    await navigator.clipboard.writeText(shareUrl);
    showNotification(`Referral link copied! You'll earn ${formatPrice(commission)} RWF per sale.`, 'success');
    
    // Track referral link generation
    trackReferralGeneration(productId, 'copy', referralCode);
  } catch (error) {
    console.error('Error copying to clipboard:', error);
    showNotification('Error copying link', 'error');
  }
};

// Generate unique referral code
function generateReferralCode(userId, productId) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `${userId}_${productId}_${timestamp}_${random}`.toUpperCase();
}

// Track referral link generation
async function trackReferralGeneration(productId, platform, referralCode) {
  try {
    const currentUser = getCurrentUser();
    const response = await fetch('/api/referrals/track-generation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken') || sessionStorage.getItem('authToken')}`
      },
      body: JSON.stringify({
        userId: currentUser.id,
        productId: productId,
        platform: platform,
        referralCode: referralCode,
        generatedAt: new Date().toISOString()
      })
    });
    
    if (!response.ok) {
      console.warn('Failed to track referral generation');
    }
  } catch (error) {
    console.error('Error tracking referral generation:', error);
  }
}

// Get current user helper function
function getCurrentUser() {
  try {
    // Try to get user from localStorage or sessionStorage
    const userData = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
    if (userData) {
      return JSON.parse(userData);
    }

    // Try to get from auth token
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    if (token) {
      try {
        // Decode JWT token to get user info (basic implementation)
        const payload = JSON.parse(atob(token.split('.')[1]));
        return {
          id: payload.userId || payload.id,
          name: payload.name || payload.username || 'User',
          email: payload.email || '',
          role: payload.role || 'buyer',
          address: payload.address || ''
        };
      } catch (e) {
        console.error('Error decoding token:', e);
      }
    }

    // Return default user object
    return {
      id: 'guest_' + Date.now(),
      name: 'Guest User',
      email: '',
      role: 'buyer',
      address: 'Location not set'
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    return {
      id: 'guest_' + Date.now(),
      name: 'Guest User',
      email: '',
      role: 'buyer',
      address: 'Location not set'
    };
  }
}

// Add new functions to global scope
window.saveMenuForLater = saveMenuForLater;
window.loadSavedMenu = loadSavedMenu;
window.restoreSavedMenu = restoreSavedMenu;
window.clearMenu = clearMenu;
window.confirmClearMenu = confirmClearMenu;
window.generateReferralCode = generateReferralCode;
window.trackReferralGeneration = trackReferralGeneration;
window.trackReferralPurchase = trackReferralPurchase;
window.getCurrentUser = getCurrentUser;
window.trackOrder = trackOrder;
window.showDeliveryLocationModal = showDeliveryLocationModal;
window.collectDeliveryInfo = collectDeliveryInfo;
window.showPaymentModal = showPaymentModal;
window.submitOrderWithPayment = submitOrderWithPayment;
window.showOrderSuccessModal = showOrderSuccessModal;

console.log('Missing functions loaded successfully!');

} // end __MISSING_FUNCTIONS_INIT__ guard