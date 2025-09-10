/**
 * Local Market Frontend Buyer JavaScript
 * Comprehensive shopping cart and user interaction functionality
 */

// Initialize global variables - Fix ReferenceError
window.shoppingMenu = window.shoppingMenu || [];
window.allProducts = window.allProducts || [];
window.filteredProducts = window.filteredProducts || [];

// DOM Elements - Fix DOM not found issues
let menuItemCount, menuItemsList, menuTotalPrice, menuTotalDisplay;

// Initialize DOM elements when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('🔄 [FRONTEND] Initializing DOM elements...');
  
  try {
    menuItemCount = document.getElementById('menu-item-count') || { textContent: '0' };
    menuItemsList = document.getElementById('menu-items-list') || { innerHTML: '' };
    menuTotalPrice = document.getElementById('menu-total-price') || { textContent: '0' };
    menuTotalDisplay = document.getElementById('menu-total-display') || { textContent: '0' };
    
    console.log('✅ [FRONTEND] DOM elements initialized');
  } catch (error) {
    console.error('❌ [FRONTEND] Error initializing DOM elements:', error);
  }
});

// Enhanced Global Functions with Comprehensive Error Handling

// Product Management Functions
window.addToMenu = function(product, quantity = 1) {
  console.log('🛒 [CART] Adding to menu:', { product: product?.product_name, quantity });
  
  try {
    // Validation
    if (!product || typeof product !== 'object') {
      throw new TypeError('Invalid product object provided');
    }
    
    if (!product.product_id) {
      throw new TypeError('Product ID is required');
    }
    
    if (typeof quantity !== 'number' || quantity <= 0) {
      throw new TypeError('Quantity must be a positive number');
    }

    // Check if item already exists
    const existingItemIndex = window.shoppingMenu.findIndex(item => 
      item.product_id === product.product_id
    );

    if (existingItemIndex !== -1) {
      window.shoppingMenu[existingItemIndex].quantity += quantity;
      console.log('✅ [CART] Updated existing item quantity');
    } else {
      const newItem = {
        product_id: product.product_id,
        product_name: product.product_name || 'Unknown Product',
        price: parseFloat(product.price) || 0,
        quantity: quantity,
        unit_type: product.unit_type || 'unit',
        category_name: product.category_name || 'General',
        stock_quantity: product.stock_quantity || 0
      };
      window.shoppingMenu.push(newItem);
      console.log('✅ [CART] Added new item to menu');
    }

    renderMenu();
    window.showToast && window.showToast(
      `Added ${quantity} ${product.unit_type || 'unit'} of ${product.product_name || 'item'} to menu`, 
      'success'
    );
    
  } catch (error) {
    console.error('❌ [CART] Error adding to menu:', error);
    window.showToast && window.showToast('Error adding item to menu', 'error');
  }
};

// Remove from menu function
window.removeFromMenu = function(index) {
  console.log('🗑️ [CART] Removing item at index:', index);
  
  try {
    if (typeof index !== 'number' || index < 0 || index >= window.shoppingMenu.length) {
      throw new TypeError('Invalid index provided');
    }
    
    const removedItem = window.shoppingMenu.splice(index, 1)[0];
    console.log('✅ [CART] Removed item:', removedItem?.product_name);
    
    renderMenu();
    window.showToast && window.showToast('Item removed from menu', 'info');
    
  } catch (error) {
    console.error('❌ [CART] Error removing from menu:', error);
    window.showToast && window.showToast('Error removing item', 'error');
  }
};

// Save menu for later
window.saveMenuForLater = function() {
  console.log('💾 [CART] Saving menu for later...');
  
  try {
    if (window.shoppingMenu.length === 0) {
      window.showToast && window.showToast('Menu is empty, nothing to save', 'warning');
      return;
    }
    
    localStorage.setItem('savedMenu', JSON.stringify(window.shoppingMenu));
    console.log('✅ [CART] Menu saved successfully');
    window.showToast && window.showToast('Menu saved for later!', 'success');
    
  } catch (error) {
    console.error('❌ [CART] Error saving menu:', error);
    window.showToast && window.showToast('Error saving menu', 'error');
  }
};

// Load saved menu
window.loadSavedMenu = function() {
  console.log('📂 [CART] Loading saved menu...');
  
  try {
    const savedMenu = localStorage.getItem('savedMenu');
    if (savedMenu) {
      window.shoppingMenu = JSON.parse(savedMenu);
      renderMenu();
      console.log('✅ [CART] Saved menu loaded');
      window.showToast && window.showToast('Saved menu loaded!', 'success');
    } else {
      console.log('ℹ️ [CART] No saved menu found');
      window.showToast && window.showToast('No saved menu found', 'info');
    }
  } catch (error) {
    console.error('❌ [CART] Error loading saved menu:', error);
    window.showToast && window.showToast('Error loading saved menu', 'error');
  }
};

// Format price function
function formatPrice(price) {
  try {
    return Math.round(parseFloat(price) || 0).toLocaleString();
  } catch (error) {
    console.error('❌ [UTILITY] Error formatting price:', error);
    return '0';
  }
}

// Enhanced Menu Rendering Function
function renderMenu() {
  console.log('🔄 [CART] Rendering menu with', window.shoppingMenu.length, 'items');
  
  try {
    // Update item count
    if (menuItemCount) {
      menuItemCount.textContent = window.shoppingMenu.length;
    }
    
    // Clear and render items
    if (menuItemsList) {
      if (window.shoppingMenu.length === 0) {
        menuItemsList.innerHTML = '<p class="text-center text-gray-500 py-8">Your menu is empty.</p>';
      } else {
        menuItemsList.innerHTML = window.shoppingMenu.map((item, index) => {
          const itemTotal = (item.price || 0) * (item.quantity || 0);
          return `
            <div class="bg-white p-4 rounded-lg shadow-sm border mb-3">
              <div class="flex justify-between items-start">
                <div class="flex-1">
                  <h4 class="font-medium text-gray-800">${item.product_name || 'Unknown Product'}</h4>
                  <p class="text-sm text-gray-600">${item.category_name || 'General'}</p>
                  <p class="text-sm text-gray-500">
                    ${formatPrice(item.price)} RWF per ${item.unit_type || 'unit'}
                  </p>
                </div>
                <div class="text-right ml-4">
                  <p class="font-medium text-gray-800">${item.quantity || 0} ${item.unit_type || 'units'}</p>
                  <p class="text-green-600 font-semibold">${formatPrice(itemTotal)} RWF</p>
                  <button onclick="removeFromMenu(${index})" 
                          class="text-red-500 hover:text-red-700 text-sm mt-1">
                    Remove
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('');
      }
    }
    
    // Calculate and display total
    const totalPrice = window.shoppingMenu.reduce((sum, item) => {
      return sum + ((item.price || 0) * (item.quantity || 0));
    }, 0);
    
    if (menuTotalPrice) {
      menuTotalPrice.textContent = formatPrice(totalPrice);
    }
    
    if (menuTotalDisplay) {
      menuTotalDisplay.textContent = formatPrice(totalPrice);
    }
    
    console.log('✅ [CART] Menu rendered successfully, total:', formatPrice(totalPrice), 'RWF');
    
  } catch (error) {
    console.error('❌ [CART] Error rendering menu:', error);
    if (menuItemsList) {
      menuItemsList.innerHTML = '<p class="text-center text-red-500 py-8">Error loading menu items</p>';
    }
  }
}

// Product Search and Filter Functions
window.searchProducts = function(searchTerm = '') {
  console.log('🔍 [SEARCH] Searching products:', searchTerm);
  
  try {
    if (!Array.isArray(window.allProducts)) {
      console.warn('⚠️ [SEARCH] No products array found');
      return;
    }
    
    const term = searchTerm.toLowerCase().trim();
    
    if (!term) {
      window.filteredProducts = [...window.allProducts];
    } else {
      window.filteredProducts = window.allProducts.filter(product => {
        return (product.product_name && product.product_name.toLowerCase().includes(term)) ||
               (product.category_name && product.category_name.toLowerCase().includes(term)) ||
               (product.description && product.description.toLowerCase().includes(term));
      });
    }
    
    console.log('✅ [SEARCH] Found', window.filteredProducts.length, 'matching products');
    displayProducts();
    
  } catch (error) {
    console.error('❌ [SEARCH] Error searching products:', error);
    window.showToast && window.showToast('Error searching products', 'error');
  }
};

// Filter products by category
window.filterByCategory = function(category = '') {
  console.log('🏷️ [FILTER] Filtering by category:', category);
  
  try {
    if (!Array.isArray(window.allProducts)) {
      console.warn('⚠️ [FILTER] No products array found');
      return;
    }
    
    if (!category || category === 'all') {
      window.filteredProducts = [...window.allProducts];
    } else {
      window.filteredProducts = window.allProducts.filter(product => 
        product.category_name && product.category_name.toLowerCase() === category.toLowerCase()
      );
    }
    
    console.log('✅ [FILTER] Filtered to', window.filteredProducts.length, 'products');
    displayProducts();
    
  } catch (error) {
    console.error('❌ [FILTER] Error filtering products:', error);
    window.showToast && window.showToast('Error filtering products', 'error');
  }
};

// Sort products
window.sortProducts = function(sortBy = 'name') {
  console.log('📊 [SORT] Sorting products by:', sortBy);
  
  try {
    if (!Array.isArray(window.filteredProducts)) {
      console.warn('⚠️ [SORT] No filtered products array found');
      return;
    }
    
    const sortFunctions = {
      name: (a, b) => (a.product_name || '').localeCompare(b.product_name || ''),
      price_low: (a, b) => (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0),
      price_high: (a, b) => (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0),
      category: (a, b) => (a.category_name || '').localeCompare(b.category_name || ''),
      stock: (a, b) => (parseInt(b.stock_quantity) || 0) - (parseInt(a.stock_quantity) || 0)
    };
    
    if (sortFunctions[sortBy]) {
      window.filteredProducts.sort(sortFunctions[sortBy]);
      console.log('✅ [SORT] Products sorted successfully');
      displayProducts();
    } else {
      console.warn('⚠️ [SORT] Unknown sort option:', sortBy);
    }
    
  } catch (error) {
    console.error('❌ [SORT] Error sorting products:', error);
    window.showToast && window.showToast('Error sorting products', 'error');
  }
};

// Display products function
function displayProducts() {
  console.log('🖼️ [DISPLAY] Rendering', window.filteredProducts.length, 'products');
  
  try {
    const productsContainer = document.getElementById('products-container');
    if (!productsContainer) {
      console.warn('⚠️ [DISPLAY] Products container not found');
      return;
    }
    
    if (window.filteredProducts.length === 0) {
      productsContainer.innerHTML = `
        <div class="col-span-full text-center py-16">
          <div class="text-gray-400 mb-4">
            <i class="fas fa-search text-4xl"></i>
          </div>
          <h3 class="text-lg font-medium text-gray-900 mb-2">No products found</h3>
          <p class="text-gray-500">Try adjusting your search or filter criteria</p>
        </div>
      `;
      return;
    }
    
    productsContainer.innerHTML = window.filteredProducts.map(product => {
      const price = parseFloat(product.price) || 0;
      const stock = parseInt(product.stock_quantity) || 0;
      const isOutOfStock = stock <= 0;
      
      return `
        <div class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-all duration-300 product-card ${isOutOfStock ? 'opacity-60' : ''}" 
             data-product-id="${product.product_id}">
          <div class="relative">
            ${product.image_url ? `
              <img src="${product.image_url}" alt="${product.product_name}" 
                   class="w-full h-48 object-cover"
                   onerror="this.src='/public/images/placeholder-product.jpg'">
            ` : `
              <div class="w-full h-48 bg-gray-200 flex items-center justify-center">
                <i class="fas fa-image text-gray-400 text-3xl"></i>
              </div>
            `}
            ${isOutOfStock ? '<div class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center"><span class="text-white font-semibold">Out of Stock</span></div>' : ''}
            <div class="absolute top-2 right-2">
              <span class="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">
                ${product.category_name || 'General'}
              </span>
            </div>
          </div>
          <div class="p-4">
            <h3 class="font-semibold text-gray-800 mb-2 line-clamp-2">${product.product_name || 'Unknown Product'}</h3>
            <p class="text-gray-600 text-sm mb-2 line-clamp-2">${product.description || 'No description available'}</p>
            <div class="flex justify-between items-center mb-3">
              <span class="text-lg font-bold text-green-600">${formatPrice(price)} RWF</span>
              <span class="text-sm text-gray-500">per ${product.unit_type || 'unit'}</span>
            </div>
            <div class="flex justify-between items-center mb-3">
              <span class="text-sm text-gray-500">Stock: ${stock}</span>
              <span class="text-sm ${stock > 10 ? 'text-green-600' : stock > 0 ? 'text-yellow-600' : 'text-red-600'}">
                ${stock > 10 ? 'In Stock' : stock > 0 ? 'Low Stock' : 'Out of Stock'}
              </span>
            </div>
            <button onclick="window.addToMenu(${JSON.stringify(product).replace(/"/g, '&quot;')}, 1)" 
                    ${isOutOfStock ? 'disabled' : ''}
                    class="w-full py-2 px-4 rounded-lg font-medium transition-colors ${isOutOfStock ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white'}">
              ${isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
            </button>
          </div>
        </div>
      `;
    }).join('');
    
    console.log('✅ [DISPLAY] Products rendered successfully');
    
  } catch (error) {
    console.error('❌ [DISPLAY] Error displaying products:', error);
    const productsContainer = document.getElementById('products-container');
    if (productsContainer) {
      productsContainer.innerHTML = '<div class="col-span-full text-center py-16 text-red-500">Error loading products</div>';
    }
  }
}

// Event Listeners for Search and Filter
document.addEventListener('DOMContentLoaded', function() {
  // Search input handler
  const searchInput = document.getElementById('product-search') || document.getElementById('header-search');
  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', function(e) {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        window.searchProducts(e.target.value);
        window.logUserAction && window.logUserAction('search', { term: e.target.value });
      }, 300);
    });
  }
  
  // Category filter handler
  const categoryFilter = document.getElementById('category-filter');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', function(e) {
      window.filterByCategory(e.target.value);
      window.logUserAction && window.logUserAction('filter_category', { category: e.target.value });
    });
  }
  
  // Sort filter handler
  const sortFilter = document.getElementById('sort-filter');
  if (sortFilter) {
    sortFilter.addEventListener('change', function(e) {
      window.sortProducts(e.target.value);
      window.logUserAction && window.logUserAction('sort', { sortBy: e.target.value });
    });
  }
  
  console.log('✅ [FRONTEND] Event listeners initialized');
});

// Cart Update Function
window.updateCartCount = function() {
  console.log('🔄 [CART] Updating cart count...');
  try {
    const totalItems = window.shoppingMenu.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const cartElements = document.querySelectorAll('.cart-count, #cart-count, .cart-badge');
    
    cartElements.forEach(element => {
      if (element) {
        element.textContent = totalItems;
        element.style.display = totalItems > 0 ? 'inline' : 'none';
      }
    });
    
    console.log(`✅ [CART] Cart count updated: ${totalItems} items`);
  } catch (error) {
    console.error('❌ [CART] Error updating cart count:', error);
  }
};

// Tab Switching Function
window.switchTab = window.switchTab || function(tabName) {
  console.log('📋 [TAB] Switching to tab:', tabName);
  try {
    const tabs = document.querySelectorAll('.tab-content');
    const buttons = document.querySelectorAll('.tab-button, .tab-btn');
    
    tabs.forEach(tab => {
      tab.classList.remove('active');
      tab.style.display = 'none';
    });
    buttons.forEach(btn => {
      btn.classList.remove('active');
    });
    
    const targetTab = document.getElementById(tabName);
    const targetButton = document.querySelector(`[data-tab="${tabName}"]`);
    
    if (targetTab) {
      targetTab.classList.add('active');
      targetTab.style.display = 'block';
      console.log(`✅ [TAB] Tab '${tabName}' activated`);
    } else {
      console.warn(`⚠️ [TAB] Tab '${tabName}' not found`);
    }
    
    if (targetButton) {
      targetButton.classList.add('active');
    }
    
    // Special handling for cart tab
    if (tabName === 'cart') {
      renderMenu();
    }
    
    window.logUserAction && window.logUserAction('switch_tab', { tab: tabName });
  } catch (error) {
    console.error(`❌ [TAB] Error switching to tab '${tabName}':`, error);
  }
};

// Initialize the frontend
console.log('🎯 [FRONTEND] Local Market Frontend Buyer loaded successfully!');
console.log('🛒 [FRONTEND] Shopping cart functionality ready');
console.log('🔍 [FRONTEND] Search and filter functionality ready');
console.log('📋 [FRONTEND] Tab management functionality ready');