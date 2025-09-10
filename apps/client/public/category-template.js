/**
 * Category Template - Shared JavaScript component for category-specific product browsing
 * Provides reusable functionality for all category pages
 */

class CategoryTemplate {
    constructor(categorySlug, options = {}) {
        this.categorySlug = categorySlug;
        this.options = {
            primaryColor: 'blue',
            itemsPerPage: 12,
            enableSpecificationFilters: true,
            enablePriceFilter: true,
            enableSubcategoryFilter: true,
            customFilters: [],
            ...options
        };
        
        this.currentPage = 1;
        this.currentFilters = {
            subcategory: '',
            search: '',
            min_price: '',
            max_price: '',
            sort_by: 'created_at',
            sort_order: 'DESC',
            specifications: {}
        };
        
        this.subcategories = [];
        this.categorySchema = null;
        this.isGridView = true;
        
        this.init();
    }

    // Initialize the category template
    init() {
        this.loadCategorySchema();
        this.loadSubcategories();
        this.loadProducts();
        this.setupEventListeners();
        this.setupCustomStyles();
    }

    // Load category schema for dynamic filtering
    async loadCategorySchema() {
        try {
            const response = await fetch(`/api/categories/${this.categorySlug}/schema`);
            const data = await response.json();
            
            if (data.success) {
                this.categorySchema = data.category;
            }
        } catch (error) {
            console.error('Error loading category schema:', error);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error loading category schema:',
                    error: error,
                    timestamp: new Date().toISOString(),
                    file: 'category-template.js'
                };
                
                console.error('Error details:', errorInfo);
showNotification('Error loading category schema:', 'error');

// Enhanced error logging
if (error && error.message) {
    console.error('Error details:', error.message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error details:',
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    file: 'category-template.js'
                };
                
                console.error('Error details:', errorInfo);
}
        }
    }

    // Load subcategories
    async loadSubcategories() {
        try {
            const response = await fetch(`/api/categories/${this.categorySlug}/subcategories`);
            const data = await response.json();
            
            if (data.success) {
                this.subcategories = data.subcategories;
                if (this.options.enableSubcategoryFilter) {
                    this.displaySubcategoryFilters(data.subcategories);
                }
            }
        } catch (error) {
            console.error('Error loading subcategories:', error);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error loading subcategories:',
                    error: error,
                    timestamp: new Date().toISOString(),
                    file: 'category-template.js'
                };
                
                console.error('Error details:', errorInfo);
showNotification('Error loading subcategories:', 'error');

// Enhanced error logging
if (error && error.message) {
    console.error('Error details:', error.message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error details:',
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    file: 'category-template.js'
                };
                
                console.error('Error details:', errorInfo);
}
        }
    }

    // Display subcategory filters
    displaySubcategoryFilters(subcategories) {
        const container = document.getElementById('subcategoryFilters');
        if (!container) return;
        
        subcategories.forEach(subcategory => {
            const label = document.createElement('label');
            label.className = 'flex items-center';
            label.innerHTML = `
                <input type="radio" name="subcategory" value="${subcategory.slug}" class="mr-2">
                <span class="text-sm text-gray-700">${subcategory.name}</span>
            `;
            container.appendChild(label);
        });
    }

    // Load products
    async loadProducts() {
        try {
            this.showLoading();
            
            const params = new URLSearchParams({
                page: this.currentPage,
                limit: this.options.itemsPerPage,
                ...this.currentFilters,
                specifications: JSON.stringify(this.currentFilters.specifications)
            });

            const response = await try {
                        const response = await fetch(`/api/products/category/${this.categorySlug}?${params}`);
                        if (!response.ok) {
                            console.error('Error thrown:', `HTTP ${response.status}: ${response.statusText}`);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error thrown:',
                    error: `HTTP ${response.status}: ${response.statusText}`,
                    timestamp: new Date().toISOString(),
                    file: 'category-template.js'
                };
                
                console.error('Error details:', errorInfo);
                showNotification(`HTTP ${response.status}: ${response.statusText}`, 'error');
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                        }
                        return response;
                    } catch (error) {
                        console.error('API Error:', error);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'API Error:',
                    error: error,
                    timestamp: new Date().toISOString(),
                    file: 'category-template.js'
                };
                
                console.error('Error details:', errorInfo);
showNotification('API Error:', 'error');

// Enhanced error logging
if (error && error.message) {
    console.error('Error details:', error.message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error details:',
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    file: 'category-template.js'
                };
                
                console.error('Error details:', errorInfo);
}
                        showNotification('Operation failed. Please try again.', 'error');
                        throw error;
                    };
            const data = await response.json();
            
            this.hideLoading();
            
            if (data.success) {
                this.displayProducts(data.products);
                this.displayPagination(data.pagination);
                this.updateResultsCount(data.pagination.total);
                
                if (this.options.enableSpecificationFilters) {
                    this.loadSpecificationFilters(data.products);
                }
            } else {
                this.showEmptyState();
            }
        } catch (error) {
            this.hideLoading();
            console.error('Error loading products:', error);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error loading products:',
                    error: error,
                    timestamp: new Date().toISOString(),
                    file: 'category-template.js'
                };
                
                console.error('Error details:', errorInfo);
showNotification('Error loading products:', 'error');

// Enhanced error logging
if (error && error.message) {
    console.error('Error details:', error.message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error details:',
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    file: 'category-template.js'
                };
                
                console.error('Error details:', errorInfo);
}
            this.showEmptyState();
        }
    }

    // Display products
    displayProducts(products) {
        const container = document.getElementById('productsContainer');
        if (!container) return;
        
        if (products.length === 0) {
            this.showEmptyState();
            return;
        }
        
        this.hideEmptyState();
        container.innerHTML = '';
        
        products.forEach(product => {
            const productCard = this.createProductCard(product);
            container.appendChild(productCard);
        });
    }

    // Create product card (can be overridden by specific categories)
    createProductCard(product) {
        const div = document.createElement('div');
        div.className = 'bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow cursor-pointer';
        div.onclick = () => this.showProductModal(product.id);
        
        const specifications = product.specifications || {};
        const primarySpec = this.getPrimarySpecification(specifications);
        
        div.innerHTML = `
            <div class="aspect-w-16 aspect-h-12 bg-gray-200 rounded-t-lg overflow-hidden">
                <img src="${product.main_image ? `/uploads/${product.main_image}` : '/placeholder-image.jpg'}" 
                     alt="${product.name}" 
                     class="w-full h-48 object-cover">
            </div>
            <div class="p-4">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-medium text-${this.options.primaryColor}-600 bg-${this.options.primaryColor}-100 px-2 py-1 rounded-full">
                        ${product.sub_category_name || this.categorySchema?.name || 'Product'}
                    </span>
                    ${specifications.brand ? `<span class="text-xs text-gray-500">${specifications.brand}</span>` : ''}
                </div>
                <h3 class="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">${product.name}</h3>
                <p class="text-sm text-gray-600 mb-3 line-clamp-2">${product.description}</p>
                
                ${primarySpec ? `
                    <div class="space-y-1 mb-3">
                        ${Object.entries(primarySpec).map(([key, value]) => `
                            <div class="flex justify-between text-xs text-gray-600">
                                <span>${this.formatSpecName(key)}:</span>
                                <span class="font-medium">${value}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                
                <div class="flex items-center justify-between">
                    <div>
                        <span class="text-2xl font-bold text-gray-900">$${parseFloat(product.price).toFixed(2)}</span>
                        <div class="text-xs text-gray-500">by ${product.seller_name}</div>
                    </div>
                    <button class="bg-${this.options.primaryColor}-600 text-white px-4 py-2 rounded-lg hover:bg-${this.options.primaryColor}-700 transition-colors text-sm" onclick="showNotification('Feature in development', 'info')">
                        i class="fas fa-cart-plus mr-1"></i>Add to Cart
                    </button>
                </div>
            </div>
        `;
        
        return div;
    }

    // Get primary specifications to display on card
    getPrimarySpecification(specifications) {
        const primaryKeys = this.getPrimarySpecKeys();
        const primary = {};
        
        primaryKeys.forEach(key => {
            if (specifications[key]) {
                primary[key] = specifications[key];
            }
        });
        
        return Object.keys(primary).length > 0 ? primary : null;
    }

    // Get primary specification keys (can be overridden)
    getPrimarySpecKeys() {
        switch (this.categorySlug) {
            case 'electronics':
                return ['model', 'ram', 'storage'];
            case 'clothing':
                return ['size', 'color', 'material'];
            case 'furniture':
                return ['material', 'dimensions', 'color'];
            case 'books':
                return ['author', 'format', 'language'];
            case 'sports':
                return ['brand', 'sport_type', 'size'];
            default:
                return ['brand', 'model', 'size'];
        }
    }

    // Load specification filters
    loadSpecificationFilters(products) {
        const container = document.getElementById('specFiltersContainer');
        if (!container || !this.categorySchema) return;
        
        const specs = {};
        
        // Collect all unique specification values
        products.forEach(product => {
            if (product.specifications) {
                Object.entries(product.specifications).forEach(([key, value]) => {
                    if (!specs[key]) specs[key] = new Set();
                    if (value) specs[key].add(value);
                });
            }
        });
        
        // Clear existing filters
        container.innerHTML = '';
        
        // Create filters based on schema
        if (this.categorySchema.fields) {
            this.categorySchema.fields.forEach(field => {
                if (specs[field.name] && specs[field.name].size > 1) {
                    const filterDiv = this.createSpecificationFilter(field, specs[field.name]);
                    container.appendChild(filterDiv);
                }
            });
        }
    }

    // Create specification filter
    createSpecificationFilter(field, values) {
        const filterDiv = document.createElement('div');
        
        if (field.type === 'select' && field.options) {
            // Use predefined options for select fields
            filterDiv.innerHTML = `
                <label class="block text-sm font-medium text-gray-700 mb-2">${field.label}</label>
                <select class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" data-spec="${field.name}">
                    <option value="">All ${field.label}</option>
                    ${field.options.map(option => 
                        `<option value="${option}">${option}</option>`
                    ).join('')}
                </select>
            `;
        } else {
            // Use actual values from products
            filterDiv.innerHTML = `
                <label class="block text-sm font-medium text-gray-700 mb-2">${field.label}</label>
                <select class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" data-spec="${field.name}">
                    <option value="">All ${field.label}</option>
                    ${Array.from(values).sort().map(value => 
                        `<option value="${value}">${value}</option>`
                    ).join('')}
                </select>
            `;
        }
        
        const select = filterDiv.querySelector('select');
        select.addEventListener('change', (e) => this.handleSpecificationFilter(e));
        
        return filterDiv;
    }

    // Handle specification filter change
    handleSpecificationFilter(event) {
        const specKey = event.target.dataset.spec;
        const value = event.target.value;
        
        if (value) {
            this.currentFilters.specifications[specKey] = value;
        } else {
            delete this.currentFilters.specifications[specKey];
        }
        
        this.currentPage = 1;
        this.loadProducts();
    }

    // Show product modal
    async showProductModal(productId) {
        try {
            const response = await fetch(`/api/products/${productId}`);
            const data = await response.json();
            
            if (data.success) {
                this.displayProductModal(data.product);
                document.getElementById('productModal').classList.remove('hidden');
            }
        } catch (error) {
            console.error('Error loading product details:', error);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error loading product details:',
                    error: error,
                    timestamp: new Date().toISOString(),
                    file: 'category-template.js'
                };
                
                console.error('Error details:', errorInfo);
showNotification('Error loading product details:', 'error');

// Enhanced error logging
if (error && error.message) {
    console.error('Error details:', error.message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error details:',
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    file: 'category-template.js'
                };
                
                console.error('Error details:', errorInfo);
}
        }
    }

    // Display product in modal
    displayProductModal(product) {
        const modalContent = document.getElementById('modalContent');
        if (!modalContent) return;
        
        const specifications = product.specifications || {};
        
        modalContent.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <img src="${product.main_image ? `/uploads/${product.main_image}` : '/placeholder-image.jpg'}" 
                         alt="${product.name}" 
                         class="w-full h-64 object-cover rounded-lg">
                    ${product.gallery_images && product.gallery_images.length > 0 ? `
                        <div class="grid grid-cols-4 gap-2 mt-4">
                            ${product.gallery_images.slice(0, 4).map(img => 
                                `<img src="/uploads/${img}" class="w-full h-16 object-cover rounded border">`
                            ).join('')}
                        </div>
                    ` : ''}
                </div>
                <div>
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">${product.name}</h2>
                    <p class="text-gray-600 mb-6">${product.description}</p>
                    
                    <div class="space-y-4 mb-6">
                        <div class="flex justify-between">
                            <span class="text-gray-600">Price:</span>
                            <span class="text-2xl font-bold text-${this.options.primaryColor}-600">$${parseFloat(product.price).toFixed(2)}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Seller:</span>
                            <span class="font-medium">${product.seller_name}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Stock:</span>
                            <span class="font-medium">${product.stock_quantity} available</span>
                        </div>
                    </div>
                    
                    <!-- Specifications -->
                    ${Object.keys(specifications).length > 0 ? `
                        <div class="border-t pt-6">
                            <h3 class="text-lg font-semibold text-gray-900 mb-4">Specifications</h3>
                            <div class="grid grid-cols-2 gap-4">
                                ${Object.entries(specifications).map(([key, value]) => `
                                    <div>
                                        <span class="text-sm text-gray-600">${this.formatSpecName(key)}:</span>
                                        <span class="text-sm font-medium text-gray-900 ml-2">${value}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="flex space-x-4 mt-8">
                        <button class="flex-1 bg-${this.options.primaryColor}-600 text-white py-3 rounded-lg hover:bg-${this.options.primaryColor}-700 transition-colors" onclick="showNotification('Feature in development', 'info')">
                            i class="fas fa-cart-plus mr-2"></i>Add to Cart
                        </button>
                        <button class="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg hover:bg-gray-300 transition-colors" onclick="showNotification('Feature in development', 'info')">
                            i class="fas fa-heart mr-2"></i>Add to Wishlist
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // Setup event listeners
    setupEventListeners() {
        // Filter toggle for mobile
        const filterToggle = document.getElementById('filterToggle');
        if (filterToggle) {
            filterToggle.addEventListener('click', () => this.toggleFilters());
        }
        
        // Search
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce((e) => this.handleSearch(e), 500));
        }
        
        // Sort
        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => this.handleSort(e));
        }
        
        // Price filter
        const applyPriceFilter = document.getElementById('applyPriceFilter');
        if (applyPriceFilter) {
            applyPriceFilter.addEventListener('click', () => this.applyPriceFilter());
        }
        
        // View toggle
        const gridView = document.getElementById('gridView');
        const listView = document.getElementById('listView');
        if (gridView && listView) {
            gridView.addEventListener('click', () => this.setView('grid'));
            listView.addEventListener('click', () => this.setView('list'));
        }
        
        // Modal
        const closeModal = document.getElementById('closeModal');
        if (closeModal) {
            closeModal.addEventListener('click', () => this.closeModal());
        }
        
        // Subcategory filters (delegated)
        const subcategoryFilters = document.getElementById('subcategoryFilters');
        if (subcategoryFilters) {
            subcategoryFilters.addEventListener('change', (e) => this.handleSubcategoryFilter(e));
        }
    }

    // Event handlers
    handleSearch(event) {
        this.currentFilters.search = event.target.value;
        this.currentPage = 1;
        this.loadProducts();
    }

    handleSort(event) {
        const [sortBy, sortOrder] = event.target.value.split(':');
        this.currentFilters.sort_by = sortBy;
        this.currentFilters.sort_order = sortOrder;
        this.currentPage = 1;
        this.loadProducts();
    }

    applyPriceFilter() {
        const minPrice = document.getElementById('minPrice')?.value || '';
        const maxPrice = document.getElementById('maxPrice')?.value || '';
        
        this.currentFilters.min_price = minPrice;
        this.currentFilters.max_price = maxPrice;
        this.currentPage = 1;
        this.loadProducts();
    }

    handleSubcategoryFilter(event) {
        if (event.target.type === 'radio') {
            this.currentFilters.subcategory = event.target.value;
            this.currentPage = 1;
            this.loadProducts();
        }
    }

    // Display pagination
    displayPagination(pagination) {
        const container = document.getElementById('pagination');
        if (!container) return;
        
        if (pagination.pages <= 1) {
            container.innerHTML = '';
            return;
        }
        
        let paginationHTML = '';
        
        // Previous button
        if (pagination.page > 1) {
            paginationHTML += `
                <button onclick="categoryTemplate.changePage(${pagination.page - 1})" class="px-3 py-2 border border-gray-300 rounded-l-lg hover:bg-gray-50">
                    <i class="fas fa-chevron-left"></i>
                </button>
            `;
        }
        
        // Page numbers
        const startPage = Math.max(1, pagination.page - 2);
        const endPage = Math.min(pagination.pages, pagination.page + 2);
        
        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <button onclick="categoryTemplate.changePage(${i})" class="px-3 py-2 border-t border-b border-gray-300 ${
                    i === pagination.page ? `bg-${this.options.primaryColor}-600 text-white` : 'hover:bg-gray-50'
                }">
                    ${i}
                </button>
            `;
        }
        
        // Next button
        if (pagination.page < pagination.pages) {
            paginationHTML += `
                <button onclick="categoryTemplate.changePage(${pagination.page + 1})" class="px-3 py-2 border border-gray-300 rounded-r-lg hover:bg-gray-50">
                    <i class="fas fa-chevron-right"></i>
                </button>
            `;
        }
        
        container.innerHTML = `<div class="flex">${paginationHTML}</div>`;
    }

    // Change page
    changePage(page) {
        this.currentPage = page;
        this.loadProducts();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Update results count
    updateResultsCount(total) {
        const resultsCount = document.getElementById('resultsCount');
        if (resultsCount) {
            resultsCount.textContent = `Showing ${total} ${this.categorySchema?.name || 'products'}`;
        }
    }

    // Toggle filters on mobile
    toggleFilters() {
        const sidebar = document.getElementById('filterSidebar');
        if (sidebar) {
            sidebar.classList.toggle('hidden');
        }
    }

    // Set view mode
    setView(viewMode) {
        this.isGridView = viewMode === 'grid';
        
        const gridBtn = document.getElementById('gridView');
        const listBtn = document.getElementById('listView');
        const container = document.getElementById('productsContainer');
        
        if (gridBtn && listBtn && container) {
            if (this.isGridView) {
                gridBtn.className = `px-3 py-2 bg-${this.options.primaryColor}-600 text-white rounded-l-lg`;
                listBtn.className = 'px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-r-lg';
                container.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';
            } else {
                gridBtn.className = 'px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-l-lg';
                listBtn.className = `px-3 py-2 bg-${this.options.primaryColor}-600 text-white rounded-r-lg`;
                container.className = 'space-y-4';
            }
        }
        
        this.loadProducts(); // Reload to apply new layout
    }

    // Close modal
    closeModal() {
        const modal = document.getElementById('productModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    // Setup custom styles for the category
    setupCustomStyles() {
        // Inject custom CSS for the primary color
        const style = document.createElement('style');
        style.textContent = `
            .text-${this.options.primaryColor}-600 { color: var(--${this.options.primaryColor}-600, #2563eb); }
            .bg-${this.options.primaryColor}-600 { background-color: var(--${this.options.primaryColor}-600, #2563eb); }
            .bg-${this.options.primaryColor}-100 { background-color: var(--${this.options.primaryColor}-100, #dbeafe); }
            .hover\\:bg-${this.options.primaryColor}-700:hover { background-color: var(--${this.options.primaryColor}-700, #1d4ed8); }
            .focus\\:ring-${this.options.primaryColor}-500:focus { --tw-ring-color: var(--${this.options.primaryColor}-500, #3b82f6); }
            .focus\\:border-${this.options.primaryColor}-500:focus { border-color: var(--${this.options.primaryColor}-500, #3b82f6); }
        `;
        document.head.appendChild(style);
    }

    // Utility functions
    showLoading() {
        const loadingState = document.getElementById('loadingState');
        const productsContainer = document.getElementById('productsContainer');
        
        if (loadingState) loadingState.classList.remove('hidden');
        if (productsContainer) productsContainer.classList.add('hidden');
    }

    hideLoading() {
        const loadingState = document.getElementById('loadingState');
        const productsContainer = document.getElementById('productsContainer');
        
        if (loadingState) loadingState.classList.add('hidden');
        if (productsContainer) productsContainer.classList.remove('hidden');
    }

    showEmptyState() {
        const emptyState = document.getElementById('emptyState');
        const productsContainer = document.getElementById('productsContainer');
        
        if (emptyState) emptyState.classList.remove('hidden');
        if (productsContainer) productsContainer.classList.add('hidden');
    }

    hideEmptyState() {
        const emptyState = document.getElementById('emptyState');
        const productsContainer = document.getElementById('productsContainer');
        
        if (emptyState) emptyState.classList.add('hidden');
        if (productsContainer) productsContainer.classList.remove('hidden');
    }

    formatSpecName(specKey) {
        return specKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    debounce(func, wait) {
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
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CategoryTemplate;
} else {
    window.CategoryTemplate = CategoryTemplate;
}