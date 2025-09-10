/**
 * Local Market Core Functionality
 * Main JavaScript file for local market operations
 */

(function() {
  'use strict';

  // Global variables
  let allProducts = [];
  let filteredProducts = [];
  let shoppingMenu = [];
  let userLocation = { lat: -1.9441, lng: 30.0619 }; // Default Kigali
  // Load persisted location if available
  try {
    const saved = localStorage.getItem('local_market_location');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
        userLocation = parsed;
      }
    }
  } catch (_) {}
  let currentPage = 1;
  const productsPerPage = 12;
  let allCategories = [];
  
  // Make variables globally accessible
  window.allProducts = allProducts;
  window.filteredProducts = filteredProducts;
  window.shoppingMenu = shoppingMenu;

  // Debug logging
  function debugLog(...args) {
    if (window.location.search.includes('debug=true')) {
      console.debug('[LOCAL-MARKET]', ...args);
    }
  }

  // Utility functions
  function formatPrice(price) {
    return new Intl.NumberFormat('en-RW').format(price);
  }

  function persistLocation(lat, lng) {
    try {
      localStorage.setItem('local_market_location', JSON.stringify({ lat, lng, saved_at: Date.now() }));
    } catch (_) {}
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

  // Authentication check
  async function checkAuth() {
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    if (!token) {
      showNotification('Please log in to access Local Market', 'warning');
      setTimeout(() => {
        window.location.href = '/auth/login.html';
      }, 2000);
      return false;
    }

    // Setup location controls
    const useCurrentBtn = document.getElementById('use-current-location-btn');
    const chooseBtn = document.getElementById('choose-location-btn');
    if (useCurrentBtn) {
      useCurrentBtn.addEventListener('click', async () => {
        try {
          if (!navigator.geolocation) throw new Error('Geolocation not supported');
          navigator.geolocation.getCurrentPosition(pos => {
            userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            persistLocation(userLocation.lat, userLocation.lng);
            loadProducts(false);
            const indicator = document.getElementById('location-indicator');
            if (indicator) indicator.textContent = `Using current location: ${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`;
          }, err => {
            console.error('Geo error:', err);
            showNotification('Unable to access location permissions', 'error');
          }, { enableHighAccuracy: true });
        } catch (e) {
          console.error(e);
          showNotification('Geolocation not available', 'error');
        }
      });
    }

    if (chooseBtn) {
      chooseBtn.addEventListener('click', async () => {
        try {
          const lat = parseFloat(prompt('Enter latitude (e.g., -1.9441 for Kigali):', String(userLocation.lat)));
          const lng = parseFloat(prompt('Enter longitude (e.g., 30.0619 for Kigali):', String(userLocation.lng)));
          if (isNaN(lat) || isNaN(lng)) return;
          userLocation = { lat, lng };
          persistLocation(lat, lng);
          loadProducts(false);
          const indicator = document.getElementById('location-indicator');
          if (indicator) indicator.textContent = `Using chosen location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        } catch (e) {}
      });
    }

    return true;
  }

  // Load user data
  async function loadUserData() {
    try {
      const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
      if (!token) return;

      const response = await fetch('/api/auth/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const userData = await response.json();
        const userNameElement = document.getElementById('user-name');
        if (userNameElement && userData.user) {
          userNameElement.textContent = userData.user.name || userData.user.username || 'User';
        }
      }

      // Set location indicator text from saved location
      const indicator = document.getElementById('location-indicator');
      if (indicator && userLocation) {
        indicator.textContent = `Using location: ${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`;
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }

  // Load categories
  async function loadCategories() {
    try {
      const response = await fetch('/api/grocery/categories');
      const data = await response.json();
      
      if (data.success && data.categories) {
        allCategories = data.categories;
        populateCategoryFilter();
      }
    } catch (error) {
      console.error('Error loading categories:', error);
      showNotification('Error loading categories', 'error');
    }
  }

  function populateCategoryFilter() {
    const categoryFilter = document.getElementById('category-filter');
    if (!categoryFilter) return;

    categoryFilter.innerHTML = '<option value="">All Categories</option>';
    allCategories.forEach(category => {
      const option = document.createElement('option');
      option.value = category.id;
      option.textContent = category.name;
      categoryFilter.appendChild(option);
    });
  }

  // Load products with enhanced error handling and fallback data
  async function loadProducts(append = false) {
    try {
      const loadingIndicator = document.getElementById('loading-indicator') || document.getElementById('products-loading');
      if (loadingIndicator) {
        loadingIndicator.classList.remove('hidden');
      }

      const params = new URLSearchParams({
        limit: productsPerPage,
        offset: (currentPage - 1) * productsPerPage,
        lat: userLocation.lat,
        lng: userLocation.lng
      });

      let response, data;
      let apiWorking = false;

      // Try nearby products first
      try {
        response = await fetch(`/api/local-market/products/nearby?${params}`);
        data = await response.json();
        if (response.ok && data.success && Array.isArray(data.products)) {
          apiWorking = true;
        }
      } catch (nearbyError) {
        console.warn('Nearby products API failed:', nearbyError);
      }

      // Fallback to regular products if nearby fails
      if (!apiWorking) {
        try {
          response = await fetch(`/api/local-market/products?limit=${productsPerPage}&offset=${(currentPage-1)*productsPerPage}`);
          data = await response.json();
          if (response.ok && data.success && Array.isArray(data.products)) {
            apiWorking = true;
          }
        } catch (regularError) {
          console.warn('Regular products API failed:', regularError);
        }
      }

      // If both APIs fail, use fallback data
      if (!apiWorking) {
        console.warn('Both product APIs failed, using fallback data');
        data = {
          success: true,
          products: getFallbackProducts(),
          hasMore: false
        };
      }

      if (data.success && data.products) {
        if (append) {
          allProducts = [...allProducts, ...data.products];
        } else {
          allProducts = data.products;
          currentPage = 1;
        }
        
        filteredProducts = [...allProducts];
        renderProducts();
        updateProductsCount();
        updateLoadMoreButton(data.hasMore);
        
        if (!apiWorking) {
          showToast('Using demo data - API connection failed', 'warning');
        }
      } else {
        throw new Error(data.error || 'Failed to load products');
      }
    } catch (error) {
      console.error('Error loading products:', error);
      
      // Final fallback - use demo data
      if (allProducts.length === 0) {
        allProducts = getFallbackProducts();
        filteredProducts = [...allProducts];
        renderProducts();
        updateProductsCount();
        showToast('Using demo data - please check your connection', 'warning');
      } else {
        showToast('Error loading more products', 'error');
      }
    } finally {
      const loadingIndicator = document.getElementById('loading-indicator') || document.getElementById('products-loading');
      if (loadingIndicator) {
        loadingIndicator.classList.add('hidden');
      }
    }
  }

  // Fallback products data for when API is not available
  function getFallbackProducts() {
    return [
      {
        id: 1,
        product_name: 'Fresh Tomatoes',
        product_description: 'Locally grown fresh tomatoes, perfect for cooking and salads',
        price: 800,
        unit_type: 'kg',
        stock_quantity: 50,
        minimum_order: 1,
        maximum_order: 10,
        main_image: '/public/images/logo.png',
        images: [],
        category_id: 1,
        category_name: 'Vegetables',
        category_icon: 'fas fa-carrot',
        seller_id: 1,
        seller_name: 'Local Farm Market',
        seller_city: 'Kigali',
        seller_rating: 4.5,
        is_organic: true,
        is_local_produce: true
      },
      {
        id: 2,
        product_name: 'Fresh Bananas',
        product_description: 'Sweet and ripe bananas from local farms',
        price: 500,
        unit_type: 'bunch',
        stock_quantity: 30,
        minimum_order: 1,
        maximum_order: 5,
        main_image: '/public/images/logo.png',
        images: [],
        category_id: 2,
        category_name: 'Fruits',
        category_icon: 'fas fa-apple-alt',
        seller_id: 2,
        seller_name: 'Fruit Paradise',
        seller_city: 'Kigali',
        seller_rating: 4.8,
        is_organic: false,
        is_local_produce: true
      },
      {
        id: 3,
        product_name: 'Fresh Milk',
        product_description: 'Pure fresh milk from local dairy farms',
        price: 600,
        unit_type: 'liter',
        stock_quantity: 20,
        minimum_order: 1,
        maximum_order: 5,
        main_image: '/public/images/logo.png',
        images: [],
        category_id: 3,
        category_name: 'Dairy',
        category_icon: 'fas fa-glass-whiskey',
        seller_id: 3,
        seller_name: 'Dairy Fresh',
        seller_city: 'Kigali',
        seller_rating: 4.6,
        is_organic: true,
        is_local_produce: true
      },
      {
        id: 4,
        product_name: 'Whole Wheat Bread',
        product_description: 'Freshly baked whole wheat bread',
        price: 1200,
        unit_type: 'loaf',
        stock_quantity: 15,
        minimum_order: 1,
        maximum_order: 3,
        main_image: '/public/images/logo.png',
        images: [],
        category_id: 4,
        category_name: 'Bakery',
        category_icon: 'fas fa-bread-slice',
        seller_id: 4,
        seller_name: 'City Bakery',
        seller_city: 'Kigali',
        seller_rating: 4.3,
        is_organic: false,
        is_local_produce: true
      },
      {
        id: 5,
        product_name: 'Fresh Carrots',
        product_description: 'Crunchy and sweet carrots, rich in vitamins',
        price: 700,
        unit_type: 'kg',
        stock_quantity: 40,
        minimum_order: 1,
        maximum_order: 8,
        main_image: '/public/images/logo.png',
        images: [],
        category_id: 1,
        category_name: 'Vegetables',
        category_icon: 'fas fa-carrot',
        seller_id: 1,
        seller_name: 'Local Farm Market',
        seller_city: 'Kigali',
        seller_rating: 4.5,
        is_organic: true,
        is_local_produce: true
      },
      {
        id: 6,
        product_name: 'Fresh Eggs',
        product_description: 'Farm-fresh eggs from free-range chickens',
        price: 300,
        unit_type: 'dozen',
        stock_quantity: 25,
        minimum_order: 1,
        maximum_order: 5,
        main_image: '/public/images/logo.png',
        images: [],
        category_id: 3,
        category_name: 'Dairy',
        category_icon: 'fas fa-egg',
        seller_id: 3,
        seller_name: 'Dairy Fresh',
        seller_city: 'Kigali',
        seller_rating: 4.6,
        is_organic: true,
        is_local_produce: true
      }
    ];
  }

  // Render products with enhanced share buttons
  function renderProducts() {
    const productListings = document.getElementById('product-listings');
    if (!productListings) return;

    const startIndex = (currentPage - 1) * productsPerPage;
    const endIndex = startIndex + productsPerPage;
    const productsToShow = filteredProducts.slice(startIndex, endIndex);

    if (productsToShow.length === 0) {
      productListings.innerHTML = `
        <div class="col-span-full text-center py-12">
          <div class="text-gray-400 mb-4">
            <i class="fas fa-search text-6xl"></i>
          </div>
          <h3 class="text-xl font-semibold text-gray-600 mb-2">No products found</h3>
          <p class="text-gray-500">Try adjusting your filters or search terms</p>
        </div>
      `;
      return;
    }

    productListings.innerHTML = productsToShow.map(product => {
      // Ensure product has all required fields with fallbacks
      const safeProduct = {
        id: product.id || product.product_id || Math.random().toString(36).substr(2, 9),
        base_product_id: product.product_id || product.id || null,
        product_name: product.name || product.product_name || 'Unknown Product',
        description: product.description || 'No description available',
        price_per_unit: parseFloat(product.unit_price) || parseFloat(product.price_per_unit) || parseFloat(product.price) || 0,
        unit_type: product.unit_type || product.unit || 'unit',
        stock_quantity: parseInt(product.stock_quantity) || parseInt(product.available_stock) || parseInt(product.stock) || 0,
        main_image: product.main_image || product.image || '/public/images/placeholder-product.jpg',
        category: product.category || product.category_name || 'Uncategorized',
        seller_name: product.seller_name || 'Local Seller',
        seller_id: product.seller_id || null,
        rating: parseFloat(product.rating) || 0,
        reviews_count: parseInt(product.reviews_count) || 0
      };

      const isOutOfStock = safeProduct.stock_quantity <= 0;
      const stockStatus = isOutOfStock ? 'Out of Stock' : `${safeProduct.stock_quantity} ${safeProduct.unit_type} available`;
      const stockClass = isOutOfStock ? 'text-red-500' : 'text-green-600';

      return `
        <div class="product-card bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 border border-gray-100" 
             data-product-id="${safeProduct.id}">
          <div class="relative">
            <img src="${safeProduct.main_image}" 
                 alt="${safeProduct.product_name}" 
                 class="w-full h-48 object-cover cursor-pointer"
                 onerror="this.src='/public/images/placeholder-product.jpg'">
            ${isOutOfStock ? '<div class="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded-lg text-xs font-semibold">Out of Stock</div>' : ''}
            <div class="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded-lg text-xs font-semibold">
              ${safeProduct.category}
            </div>
          </div>
          
          <div class="p-4">
            <div class="mb-3">
              <h3 class="font-bold text-lg text-gray-800 mb-1 line-clamp-2">${safeProduct.product_name}</h3>
              <p class="text-sm text-gray-600 line-clamp-2">${safeProduct.description}</p>
            </div>
            
            <div class="flex items-center justify-between mb-3">
              <div>
                <span class="text-2xl font-bold text-green-600">${formatPrice(safeProduct.price_per_unit)} RWF</span>
                <span class="text-sm text-gray-500">/ ${safeProduct.unit_type}</span>
              </div>
              <div class="text-right">
                <div class="flex items-center gap-1 mb-1">
                  ${Array.from({length: 5}, (_, i) => 
                    `<i class="fas fa-star text-xs ${i < Math.floor(safeProduct.rating) ? 'text-yellow-400' : 'text-gray-300'}"></i>`
                  ).join('')}
                  <span class="text-xs text-gray-500 ml-1">(${safeProduct.reviews_count})</span>
                </div>
                <p class="text-xs ${stockClass} font-medium">${stockStatus}</p>
              </div>
            </div>
            
            <div class="mb-3">
              <p class="text-xs text-gray-500 mb-1">Sold by: ${safeProduct.seller_name}</p>
            </div>
            
            <!-- Enhanced Share Buttons -->
            <div class="flex items-center gap-2 mb-3 p-2 bg-gray-50 rounded-lg">
              <span class="text-xs text-gray-600 font-medium">Share:</span>
              <button onclick="shareProduct('${safeProduct.id}', 'whatsapp')" 
                      class="share-btn text-green-600 hover:bg-green-100 p-1 rounded transition-colors" 
                      title="Share on WhatsApp">
                <i class="fab fa-whatsapp text-sm"></i>
              </button>
              <button onclick="shareProduct('${safeProduct.id}', 'facebook')" 
                      class="share-btn text-blue-600 hover:bg-blue-100 p-1 rounded transition-colors" 
                      title="Share on Facebook">
                <i class="fab fa-facebook text-sm"></i>
              </button>
              <button onclick="shareProduct('${safeProduct.id}', 'twitter')" 
                      class="share-btn text-blue-400 hover:bg-blue-100 p-1 rounded transition-colors" 
                      title="Share on Twitter">
                <i class="fab fa-twitter text-sm"></i>
              </button>
              <button onclick="shareProduct('${safeProduct.id}', 'telegram')" 
                      class="share-btn text-blue-500 hover:bg-blue-100 p-1 rounded transition-colors" 
                      title="Share on Telegram">
                <i class="fab fa-telegram text-sm"></i>
              </button>
              <button onclick="shareProduct('${safeProduct.id}', 'copy_link')" 
                      class="share-btn text-gray-600 hover:bg-gray-200 p-1 rounded transition-colors" 
                      title="Copy Link">
                <i class="fas fa-link text-sm"></i>
              </button>
            </div>
            
            <div class="product-actions space-y-2">
              ${!isOutOfStock ? `
                <div class="flex items-center gap-2 mb-2">
                  <label class="text-sm font-medium text-gray-700">Qty:</label>
                  <input type="number" id="qty-${safeProduct.id}" min="1" max="${safeProduct.stock_quantity}" value="1" 
                         class="w-20 px-2 py-1 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-green-500">
                  <span class="text-sm text-gray-500">${safeProduct.unit_type}</span>
                </div>
                <button onclick="addToMenu('${safeProduct.id}')" 
                        class="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition-colors shadow-lg">
                  <i class="fas fa-plus mr-2"></i>Add to Menu
                </button>
              ` : `
                <button disabled class="w-full bg-gray-400 text-white font-semibold py-3 rounded-xl cursor-not-allowed">
                  <i class="fas fa-times mr-2"></i>Out of Stock
                </button>
              `}
              <button onclick="window.openGroceryProductModal && window.openGroceryProductModal('${safeProduct.id}')" 
                      class="view-details-btn w-full bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 font-semibold py-2 rounded-xl transition-colors">
                View Details
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Share product function
  window.shareProduct = async function(productId, platform) {
    try {
      // Use the existing referral system
      if (typeof window.handleShare === 'function') {
        await window.handleShare(productId, platform);
      } else {
        // Fallback sharing
        const product = allProducts.find(p => p.id === productId);
        if (!product) return;

        const shareUrl = `${window.location.origin}${window.location.pathname}?id=${productId}`;
        const shareText = `Check out ${product.product_name || product.name} for ${formatPrice(product.price_per_unit || product.unit_price)} RWF on African Deals Domain!`;

        if (platform === 'copy_link') {
          try {
            await navigator.clipboard.writeText(shareUrl);
            showNotification('Link copied to clipboard!', 'success');
          } catch (e) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = shareUrl;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showNotification('Link copied to clipboard!', 'success');
          }
        } else {
          let platformUrl = '';
          const encodedUrl = encodeURIComponent(shareUrl);
          const encodedText = encodeURIComponent(shareText);

          switch (platform) {
            case 'whatsapp':
              platformUrl = `https://wa.me/?text=${encodedText}%20${encodedUrl}`;
              break;
            case 'facebook':
              platformUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
              break;
            case 'twitter':
              platformUrl = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`;
              break;
            case 'telegram':
              platformUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
              break;
          }

          if (platformUrl) {
            window.open(platformUrl, '_blank', 'width=600,height=400');
          }
        }
      }
    } catch (error) {
      console.error('Error sharing product:', error);
      showNotification('Error sharing product', 'error');
    }
  };

  // Add to menu function
  window.addToMenu = function(productId) {
    try {
      const product = allProducts.find(p => p.id === productId);
      if (!product) {
        showNotification('Product not found', 'error');
        return;
      }

      const qtyInput = document.getElementById(`qty-${productId}`);
      const quantity = parseInt(qtyInput?.value) || 1;

      if (quantity <= 0) {
        showNotification('Please enter a valid quantity', 'warning');
        return;
      }

      const existingItem = shoppingMenu.find(item => item.id === productId);
      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        shoppingMenu.push({
          id: productId,
          name: product.product_name || product.name,
          price: parseFloat(product.price_per_unit) || parseFloat(product.unit_price) || parseFloat(product.price) || 0,
          unit: product.unit_type || product.unit || 'unit',
          quantity: quantity,
          image: product.main_image || product.image || '/public/images/placeholder-product.jpg',
          seller_id: product.seller_id || null
        });
      }

      renderMenu();
      debugLog('Product added to menu successfully', { productId, quantity, menuSize: shoppingMenu.length });
      
      // Show success feedback
      if (qtyInput) qtyInput.value = 1;
      const button = qtyInput?.parentElement?.nextElementSibling?.querySelector('button');
      if (button) {
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-check mr-2"></i>Added!';
        button.classList.add('bg-green-700');
        setTimeout(() => {
          button.innerHTML = originalText;
          button.classList.remove('bg-green-700');
        }, 1000);
      }
      
      showNotification('Product added to menu!', 'success');
    } catch (error) {
      console.error('Error adding product to menu:', error);
      showNotification('Error adding product to menu', 'error');
    }
  };

  // Remove from menu function
  window.removeFromMenu = function(index) {
    shoppingMenu.splice(index, 1);
    renderMenu();
  };

  // Render menu
  function renderMenu() {
    const menuItemCount = document.getElementById('menu-item-count');
    const menuItemsList = document.getElementById('menu-items-list');
    const costBreakdown = document.getElementById('cost-breakdown');
    const deliveryInfoSetup = document.getElementById('delivery-info-setup');
    const checkoutBtn = document.getElementById('checkout-btn');

    // Update all cart badges
    updateCartBadges(shoppingMenu.length);
    
    if (menuItemCount) menuItemCount.textContent = shoppingMenu.length;
    
    if (!menuItemsList) return;

    if (shoppingMenu.length === 0) {
      menuItemsList.innerHTML = '<p class="text-center text-gray-500 py-8">Your menu is empty.</p>';
      if (costBreakdown) costBreakdown.classList.add('hidden');
      if (deliveryInfoSetup) deliveryInfoSetup.classList.add('hidden');
      if (checkoutBtn) checkoutBtn.disabled = true;
      return;
    }

    menuItemsList.innerHTML = shoppingMenu.map((item, index) => `
      <div class="flex items-center gap-3 menu-item-enter">
        <img src="${item.image}" alt="${item.name}" class="w-12 h-12 rounded-lg object-cover">
        <div class="flex-1">
          <p class="font-semibold text-sm">${item.name}</p>
          <p class="text-xs text-gray-500">${item.quantity} ${item.unit} x ${formatPrice(item.price)} RWF</p>
        </div>
        <div class="text-sm font-bold">${formatPrice(item.quantity * item.price)} RWF</div>
        <button onclick="window.removeFromMenu(${index})" class="text-red-500 hover:text-red-700">
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>
    `).join('');

    updateTotals();
    if (costBreakdown) costBreakdown.classList.remove('hidden');
    if (deliveryInfoSetup) deliveryInfoSetup.classList.remove('hidden');
    if (checkoutBtn) checkoutBtn.disabled = false;
  }

  function updateTotals() {
    const productsTotal = shoppingMenu.reduce(
      (sum, item) => sum + (item.price * item.quantity), 0
    );
    const deliveryFee = 0; // Free delivery promotion
    const grandTotal = productsTotal + deliveryFee;

    const productsTotalEl = document.getElementById('products-total');
    const deliveryFeeEl = document.getElementById('delivery-fee');
    const grandTotalEl = document.getElementById('grand-total');

    if (productsTotalEl) productsTotalEl.textContent = formatPrice(productsTotal) + ' RWF';
    if (deliveryFeeEl) deliveryFeeEl.textContent = formatPrice(deliveryFee) + ' RWF';
    if (grandTotalEl) grandTotalEl.textContent = formatPrice(grandTotal) + ' RWF';
  }

  // Search and filter functions
  window.handleProductSearch = debounce(function(searchTerm) {
    if (!searchTerm || searchTerm.length < 2) {
      filteredProducts = [...allProducts];
    } else {
      const term = searchTerm.toLowerCase();
      filteredProducts = allProducts.filter(product => 
        (product.product_name || product.name || '').toLowerCase().includes(term) ||
        (product.description || '').toLowerCase().includes(term) ||
        (product.category || product.category_name || '').toLowerCase().includes(term)
      );
    }
    currentPage = 1;
    renderProducts();
    updateProductsCount();
  }, 300);

  window.applyFilters = function() {
    const categoryFilter = document.getElementById('category-filter');
    const sortFilter = document.getElementById('sort-filter');
    const priceRange = document.getElementById('price-range');
    const availabilityFilter = document.getElementById('availability-filter');
    const deliveryTimeFilter = document.getElementById('delivery-time-filter');

    let filtered = [...allProducts];

    // Category filter
    if (categoryFilter && categoryFilter.value) {
      filtered = filtered.filter(product => 
        product.category_id == categoryFilter.value || 
        (product.category || '').toLowerCase().includes(categoryFilter.options[categoryFilter.selectedIndex].text.toLowerCase())
      );
    }

    // Price filter
    if (priceRange && priceRange.value) {
      const maxPrice = parseFloat(priceRange.value);
      filtered = filtered.filter(product => {
        const price = parseFloat(product.price_per_unit) || parseFloat(product.unit_price) || parseFloat(product.price) || 0;
        return price <= maxPrice;
      });
    }

    // Availability filter
    if (availabilityFilter && availabilityFilter.value) {
      if (availabilityFilter.value === 'in-stock') {
        filtered = filtered.filter(product => {
          const stock = parseInt(product.stock_quantity) || parseInt(product.available_stock) || parseInt(product.stock) || 0;
          return stock > 0;
        });
      } else if (availabilityFilter.value === 'out-of-stock') {
        filtered = filtered.filter(product => {
          const stock = parseInt(product.stock_quantity) || parseInt(product.available_stock) || parseInt(product.stock) || 0;
          return stock <= 0;
        });
      }
    }

    // Advanced filters
    const showOutOfStock = document.getElementById('show-out-of-stock');
    if (showOutOfStock && !showOutOfStock.checked) {
      filtered = filtered.filter(product => {
        const stock = parseInt(product.stock_quantity) || parseInt(product.available_stock) || parseInt(product.stock) || 0;
        return stock > 0;
      });
    }

    // Sort
    if (sortFilter && sortFilter.value) {
      switch (sortFilter.value) {
        case 'name':
          filtered.sort((a, b) => (a.product_name || a.name || '').localeCompare(b.product_name || b.name || ''));
          break;
        case 'price_low':
          filtered.sort((a, b) => {
            const priceA = parseFloat(a.price_per_unit) || parseFloat(a.unit_price) || parseFloat(a.price) || 0;
            const priceB = parseFloat(b.price_per_unit) || parseFloat(b.unit_price) || parseFloat(b.price) || 0;
            return priceA - priceB;
          });
          break;
        case 'price_high':
          filtered.sort((a, b) => {
            const priceA = parseFloat(a.price_per_unit) || parseFloat(a.unit_price) || parseFloat(a.price) || 0;
            const priceB = parseFloat(b.price_per_unit) || parseFloat(b.unit_price) || parseFloat(b.price) || 0;
            return priceB - priceA;
          });
          break;
        case 'rating':
          filtered.sort((a, b) => (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0));
          break;
        case 'newest':
          filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
          break;
      }
    }

    filteredProducts = filtered;
    currentPage = 1;
    renderProducts();
    updateProductsCount();
  };

  function updateProductsCount() {
    const productsCount = document.getElementById('products-count');
    if (productsCount) {
      productsCount.textContent = `${filteredProducts.length} products found`;
    }
  }

  function updateLoadMoreButton(hasMore) {
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
      if (hasMore && filteredProducts.length > currentPage * productsPerPage) {
        loadMoreBtn.classList.remove('hidden');
        loadMoreBtn.innerHTML = 'Load More Products';
        loadMoreBtn.disabled = false;
      } else {
        loadMoreBtn.classList.add('hidden');
      }
    }
  }

  // Location functions
  function updateCurrentLocationDisplay() {
    const savedLocation = localStorage.getItem('userLocation');
    const locationIndicator = document.getElementById('location-indicator');
    
    if (savedLocation && locationIndicator) {
      try {
        const location = JSON.parse(savedLocation);
        locationIndicator.innerHTML = `
          <i class="fas fa-map-marker-alt text-green-600 mr-1"></i>
          <span class="text-sm">${location.address || `${location.lat?.toFixed(4)}, ${location.lng?.toFixed(4)}`}</span>
        `;
        userLocation = { lat: location.lat, lng: location.lng };
      } catch (error) {
        console.error('Error parsing saved location:', error);
      }
    }
  }

  // Load more products
  window.loadMoreProducts = function() {
    currentPage++;
    loadProducts(true);
  };

  // Initialize the page
  async function initializePage() {
    try {
      if (!(await checkAuth())) return;
      
      await loadUserData();
      await loadCategories();
      await loadProducts();
      updateCurrentLocationDisplay();
      setupEventListeners();
      debugLog('Page initialized successfully');
    } catch (error) {
      console.error('Error initializing page:', error);
      showNotification('Error loading page data', 'error');
    }
  }

  function setupEventListeners() {
    // Search functionality
    const headerSearch = document.getElementById('header-search');
    const mobileSearch = document.getElementById('mobile-search-bar');
    
    if (headerSearch) {
      headerSearch.addEventListener('input', debounce((e) => {
        handleProductSearch(e.target.value);
      }, 300));
    }
    
    if (mobileSearch) {
      mobileSearch.addEventListener('input', debounce((e) => {
        handleProductSearch(e.target.value);
      }, 300));
    }

    // Filter event listeners
    const categoryFilter = document.getElementById('category-filter');
    const sortFilter = document.getElementById('sort-filter');
    const priceRange = document.getElementById('price-range');
    const availabilityFilter = document.getElementById('availability-filter');
    const deliveryTimeFilter = document.getElementById('delivery-time-filter');

    if (categoryFilter) {
      categoryFilter.addEventListener('change', applyFilters);
    }
    
    if (sortFilter) {
      sortFilter.addEventListener('change', applyFilters);
    }
    
    if (priceRange) {
      priceRange.addEventListener('input', (e) => {
        const priceRangeValue = document.getElementById('price-range-value');
        if (priceRangeValue) {
          priceRangeValue.textContent = formatPrice(e.target.value) + ' RWF';
        }
      });
      priceRange.addEventListener('change', applyFilters);
    }
    
    if (availabilityFilter) {
      availabilityFilter.addEventListener('change', applyFilters);
    }
    
    if (deliveryTimeFilter) {
      deliveryTimeFilter.addEventListener('change', applyFilters);
    }

    // Advanced filters
    const advancedFilters = [
      'show-out-of-stock',
      'show-organic-only', 
      'show-local-only',
      'show-discounted'
    ];
    
    advancedFilters.forEach(filterId => {
      const filter = document.getElementById(filterId);
      if (filter) {
        filter.addEventListener('change', applyFilters);
      }
    });

    // Price range filters
    const minPriceFilter = document.getElementById('min-price-filter');
    const maxPriceFilter = document.getElementById('max-price-filter');
    
    if (minPriceFilter) {
      minPriceFilter.addEventListener('input', debounce(applyFilters, 500));
    }
    
    if (maxPriceFilter) {
      maxPriceFilter.addEventListener('input', debounce(applyFilters, 500));
    }
  }

  // Update all cart badges
  function updateCartBadges(count) {
    const badges = [
      'header-cart-badge',
      'cart-badge', 
      'tab-cart-badge',
      'mobile-cart-badge'
    ];
    
    badges.forEach(badgeId => {
      const badge = document.getElementById(badgeId);
      if (badge) {
        if (count > 0) {
          badge.textContent = count;
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }
      }
    });
  }

  // Toast notification function
  function showToast(message, type = 'info') {
    // Try to use existing toast function from main page (but avoid recursion)
    if (typeof window.showNotification === 'function') {
      window.showNotification(message, type);
      return;
    }
    
    // Fallback: create simple toast
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-white font-medium shadow-lg transition-all duration-300 ${
      type === 'error' ? 'bg-red-500' : 
      type === 'warning' ? 'bg-yellow-500' : 
      type === 'success' ? 'bg-green-500' : 'bg-blue-500'
    }`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  // Fallback products for when API is unavailable
  function getFallbackProducts() {
    return [
      {
        id: 'demo-1',
        product_name: 'Fresh Tomatoes',
        description: 'Locally grown fresh tomatoes',
        price_per_unit: 500,
        unit_type: 'kg',
        stock_quantity: 50,
        category: 'Vegetables',
        main_image: '/public/images/placeholder-product.jpg',
        seller_id: 'demo-seller-1'
      },
      {
        id: 'demo-2',
        product_name: 'Organic Bananas',
        description: 'Sweet organic bananas',
        price_per_unit: 800,
        unit_type: 'kg',
        stock_quantity: 30,
        category: 'Fruits',
        main_image: '/public/images/placeholder-product.jpg',
        seller_id: 'demo-seller-2'
      },
      {
        id: 'demo-3',
        product_name: 'Fresh Milk',
        description: 'Farm fresh milk',
        price_per_unit: 1200,
        unit_type: 'liter',
        stock_quantity: 20,
        category: 'Dairy',
        main_image: '/public/images/placeholder-product.jpg',
        seller_id: 'demo-seller-3'
      },
      {
        id: 'demo-4',
        product_name: 'White Rice',
        description: 'Premium white rice',
        price_per_unit: 1500,
        unit_type: 'kg',
        stock_quantity: 100,
        category: 'Grains',
        main_image: '/public/images/placeholder-product.jpg',
        seller_id: 'demo-seller-4'
      },
      {
        id: 'demo-5',
        product_name: 'Fresh Bread',
        description: 'Daily baked fresh bread',
        price_per_unit: 300,
        unit_type: 'loaf',
        stock_quantity: 25,
        category: 'Bakery',
        main_image: '/public/images/placeholder-product.jpg',
        seller_id: 'demo-seller-5'
      },
      {
        id: 'demo-6',
        product_name: 'Chicken Eggs',
        description: 'Farm fresh chicken eggs',
        price_per_unit: 200,
        unit_type: 'piece',
        stock_quantity: 60,
        category: 'Dairy',
        main_image: '/public/images/placeholder-product.jpg',
        seller_id: 'demo-seller-6'
      }
    ];
  }

  // Export functions to global scope
  window.loadProducts = loadProducts;
  window.renderProducts = renderProducts;
  window.renderMenu = renderMenu;
  window.applyFilters = applyFilters;
  window.handleProductSearch = handleProductSearch;
  window.updateCurrentLocationDisplay = updateCurrentLocationDisplay;
  window.formatPrice = formatPrice;
  window.debugLog = debugLog;
  window.showToast = showToast;
  window.getFallbackProducts = getFallbackProducts;

  // Start the application
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage);
  } else {
    initializePage();
  }

})();