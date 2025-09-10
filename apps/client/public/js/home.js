/**
 * Home Page JavaScript
 * Handles homepage functionality including product display, search, and navigation
 */

(function() {
    'use strict';

    // Global variables
    let currentProducts = [];
    let currentCategories = [];
    let selectedCurrency = localStorage.getItem('selectedCurrency') || 'RWF';
    let selectedLang = localStorage.getItem('selectedLang') || 'en';
    let currencyRates = JSON.parse(localStorage.getItem('currencyRates')) || { USD: 1, RWF: 1200, EUR: 0.9 };

    // Currency symbols
    const currencySymbols = {
        USD: '$',
        RWF: 'FRw',
        EUR: '€',
        KES: 'Ksh',
        NGN: '₦'
    };

    // Initialize page
    document.addEventListener('DOMContentLoaded', function() {
        initializeHomePage();
    });

    async function initializeHomePage() {
        try {
    // Load featured products
            await loadFeaturedProducts();
            
            // Load categories
            await loadCategories();
            
            // Setup search functionality
            setupSearch();
            
            // Setup currency and language switchers
            setupCurrencyLanguage();
            
            // Setup navigation
            setupNavigation();
            
            console.log('✅ Home page initialized successfully');
        
} catch (error) {
    console.error('Operation failed:', error);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Operation failed:',
                    error: error,
                    timestamp: new Date().toISOString(),
                    file: 'home.js'
                };
                
                console.error('Error details:', errorInfo);
showNotification('Operation failed:', 'error');

// Enhanced error logging
if (error && error.message) {
    console.error('Error details:', error.message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error details:',
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    file: 'home.js'
                };
                
                console.error('Error details:', errorInfo);
}
    showNotification('An error occurred. Please try again.', 'error');
    
    // Log error details for debugging
    if (error.response) {
        console.error('Response status:', error.response.status);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Response status:',
                    error: error.response.status,
                    timestamp: new Date().toISOString(),
                    file: 'home.js'
                };
                
                console.error('Error details:', errorInfo);
showNotification('Response status:', 'error');

// Enhanced error logging
if (error.response.status && error.response.status.message) {
    console.error('Error details:', error.response.status.message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error details:',
                    error: error.response.status.message,
                    timestamp: new Date().toISOString(),
                    file: 'home.js'
                };
                
                console.error('Error details:', errorInfo);
}
        console.error('Response data:', error.response.data);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Response data:',
                    error: error.response.data,
                    timestamp: new Date().toISOString(),
                    file: 'home.js'
                };
                
                console.error('Error details:', errorInfo);
showNotification('Response data:', 'error');

// Enhanced error logging
if (error.response.data && error.response.data.message) {
    console.error('Error details:', error.response.data.message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error details:',
                    error: error.response.data.message,
                    timestamp: new Date().toISOString(),
                    file: 'home.js'
                };
                
                console.error('Error details:', errorInfo);
}
    }
    
    throw error; // Re-throw to allow upstream handling
}
    }

    async function loadFeaturedProducts() {
        try {
            const response = await fetch('/api/products?featured=true&limit=12');
            if (response.ok) {
                const data = await response.json();
                currentProducts = data.products || data || [];
                displayProducts(currentProducts);
            } else {
                console.warn('Failed to load featured products');
                displayFallbackProducts();
            }
        } catch (error) {
            console.error('Error loading featured products:', error);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error loading featured products:',
                    error: error,
                    timestamp: new Date().toISOString(),
                    file: 'home.js'
                };
                
                console.error('Error details:', errorInfo);
showNotification('Error loading featured products:', 'error');

// Enhanced error logging
if (error && error.message) {
    console.error('Error details:', error.message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error details:',
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    file: 'home.js'
                };
                
                console.error('Error details:', errorInfo);
}
            displayFallbackProducts();
        }
    }

    async function loadCategories() {
        try {
            const response = await fetch('/api/categories');
            if (response.ok) {
                const data = await response.json();
                currentCategories = data.categories || data || [];
                displayCategories(currentCategories);
            } else {
                console.warn('Failed to load categories');
            }
        } catch (error) {
            console.error('Error loading categories:', error);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error loading categories:',
                    error: error,
                    timestamp: new Date().toISOString(),
                    file: 'home.js'
                };
                
                console.error('Error details:', errorInfo);
showNotification('Error loading categories:', 'error');

// Enhanced error logging
if (error && error.message) {
    console.error('Error details:', error.message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error details:',
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    file: 'home.js'
                };
                
                console.error('Error details:', errorInfo);
}
        }
    }

    function displayProducts(products) {
        const container = document.getElementById('featured-products');
        if (!container) return;

        if (!products || products.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500">No featured products available</p>';
            return;
        }

        container.innerHTML = products.map(product => `
            <div class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onclick="viewProduct(${product.id})">
                <div class="aspect-w-1 aspect-h-1 w-full overflow-hidden bg-gray-200">
                    <img src="${product.main_image || '/public/images/placeholder.jpg'}" 
                         alt="${product.name}" 
                         class="h-48 w-full object-cover object-center group-hover:opacity-75">
                </div>
                <div class="p-4">
                    <h3 class="text-sm font-medium text-gray-900 mb-2">${product.name}</h3>
                    <p class="text-sm text-gray-500 mb-2 line-clamp-2">${product.description || ''}</p>
                    <div class="flex items-center justify-between">
                        <span class="text-lg font-bold text-blue-600">
                            ${formatPrice(product.price)}
                        </span>
                        <button class="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
                                onclick="event.stopPropagation(); addToCart(${product.id})">
                            Add to Cart
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    function displayCategories(categories) {
        const container = document.getElementById('categories-grid');
        if (!container) return;

        if (!categories || categories.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500">No categories available</p>';
            return;
        }

        container.innerHTML = categories.slice(0, 8).map(category => `
            <div class="bg-white rounded-lg shadow-md p-6 text-center hover:shadow-lg transition-shadow cursor-pointer"
                 onclick="viewCategory(${category.id})">
                <div class="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                    </svg>
                </div>
                <h3 class="font-semibold text-gray-900">${category.name}</h3>
                <p class="text-sm text-gray-500 mt-1">${category.product_count || 0} products</p>
            </div>
        `).join('');
    }

    function displayFallbackProducts() {
        const container = document.getElementById('featured-products');
        if (!container) return;

        const fallbackProducts = [
            { id: 1, name: 'Sample Product 1', price: 29.99, main_image: '/public/images/placeholder.jpg' },
            { id: 2, name: 'Sample Product 2', price: 49.99, main_image: '/public/images/placeholder.jpg' },
            { id: 3, name: 'Sample Product 3', price: 19.99, main_image: '/public/images/placeholder.jpg' }
        ];

        displayProducts(fallbackProducts);
    }

    function setupSearch() {
        const searchInput = document.getElementById('search-input');
        const searchButton = document.getElementById('search-button');

        if (searchInput) {
            searchInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    performSearch();
                }
            });
        }

        if (searchButton) {
            searchButton.addEventListener('click', performSearch);
        }
    }

    function performSearch() {
        const searchInput = document.getElementById('search-input');
        if (!searchInput) return;

        const query = searchInput.value.trim();
        if (query) {
            window.location.href = `/public/search-results.html?q=${encodeURIComponent(query)}`;
        }
    }

    function setupCurrencyLanguage() {
        // Currency switcher
        const currencySelect = document.getElementById('currency-select');
        if (currencySelect) {
            currencySelect.value = selectedCurrency;
            currencySelect.addEventListener('change', function() {
                selectedCurrency = this.value;
                localStorage.setItem('selectedCurrency', selectedCurrency);
                updatePriceDisplay();
            });
        }

        // Language switcher
        const languageSelect = document.getElementById('language-select');
        if (languageSelect) {
            languageSelect.value = selectedLang;
            languageSelect.addEventListener('change', function() {
                selectedLang = this.value;
                localStorage.setItem('selectedLang', selectedLang);
                updateLanguageDisplay();
            });
        }
    }

    function setupNavigation() {
        // Mobile menu toggle
        const mobileMenuButton = document.getElementById('mobile-menu-button');
        const mobileMenu = document.getElementById('mobile-menu');

        if (mobileMenuButton && mobileMenu) {
            mobileMenuButton.addEventListener('click', function() {
                mobileMenu.classList.toggle('hidden');
            });
        }

        // Auth buttons
        const loginButton = document.getElementById('login-button');
        const registerButton = document.getElementById('register-button');

        if (loginButton) {
            loginButton.addEventListener('click', function() {
                window.location.href = '/auth/auth-buyer.html';
            });
        }

        if (registerButton) {
            registerButton.addEventListener('click', function() {
                window.location.href = '/auth/auth-buyer.html?mode=register';
            });
        }
    }

    function formatPrice(price) {
        if (!price) return 'N/A';
        
        const numPrice = parseFloat(price);
        const convertedPrice = convertCurrency(numPrice, 'USD', selectedCurrency);
        const symbol = currencySymbols[selectedCurrency] || selectedCurrency;
        
        return `${symbol}${convertedPrice.toFixed(2)}`;
    }

    function convertCurrency(amount, fromCurrency, toCurrency) {
        if (fromCurrency === toCurrency) return amount;
        
        const fromRate = currencyRates[fromCurrency] || 1;
        const toRate = currencyRates[toCurrency] || 1;
        
        return (amount / fromRate) * toRate;
    }

    function updatePriceDisplay() {
        // Re-display products with new currency
        displayProducts(currentProducts);
    }

    function updateLanguageDisplay() {
        // Update UI text based on selected language
        // This would typically involve loading language files
        console.log('Language changed to:', selectedLang);
    }

    // Global functions for onclick handlers
    window.viewProduct = function(productId) {
        window.location.href = `/public/product-detail.html?id=${productId}`;
    };

    window.viewCategory = function(categoryId) {
        window.location.href = `/public/products.html?category=${categoryId}`;
    };

    window.addToCart = function(productId) {
        const token = localStorage.getItem('token');
        if (!token) {
            alert('Please login to add items to cart');
            window.location.href = '/auth/auth-buyer.html';
            return;
        }

        // Add to cart logic
        fetch('/api/cart/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                product_id: productId,
                quantity: 1
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showNotification('Product added to cart!', 'success');
                updateCartCount();
            } else {
                showNotification('Failed to add product to cart', 'error');
            }
        })
        .catch(error => {
            console.error('Error adding to cart:', error);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error adding to cart:',
                    error: error,
                    timestamp: new Date().toISOString(),
                    file: 'home.js'
                };
                
                console.error('Error details:', errorInfo);
showNotification('Error adding to cart:', 'error');

// Enhanced error logging
if (error && error.message) {
    console.error('Error details:', error.message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error details:',
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    file: 'home.js'
                };
                
                console.error('Error details:', errorInfo);
}
            showNotification('Error adding product to cart', 'error');
        });
    };

    function showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
            type === 'success' ? 'bg-green-500' : 
            type === 'error' ? 'bg-red-500' : 'bg-blue-500'
        } text-white`;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    function updateCartCount() {
        const token = localStorage.getItem('token');
        if (!token) return;

        fetch('/api/cart/count', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => response.json())
        .then(data => {
            const cartCountElement = document.getElementById('cart-count');
            if (cartCountElement && data.count !== undefined) {
                cartCountElement.textContent = data.count;
                cartCountElement.style.display = data.count > 0 ? 'inline' : 'none';
            }
        })
        .catch(error => {
            console.error('Error updating cart count:', error);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error updating cart count:',
                    error: error,
                    timestamp: new Date().toISOString(),
                    file: 'home.js'
                };
                
                console.error('Error details:', errorInfo);
showNotification('Error updating cart count:', 'error');

// Enhanced error logging
if (error && error.message) {
    console.error('Error details:', error.message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error details:',
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    file: 'home.js'
                };
                
                console.error('Error details:', errorInfo);
}
        });
    }

    // Initialize cart count on page load
    updateCartCount();

})();