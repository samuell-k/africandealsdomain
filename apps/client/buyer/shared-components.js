// SharedComponents for Buyer Interface

// Utility to fetch and inject HTML from a component file
async function injectComponent(targetId, componentPath) {
  try {
    console.log(`Fetching component from: ${componentPath}`);
    const res = await fetch(componentPath);
    if (!res.ok) {
      console.error(`Component not found: ${componentPath}, status: ${res.status}`);
      throw new Error(`Component not found: ${componentPath}`);
    }
    const html = await res.text();
    const targetElement = document.getElementById(targetId);
    if (!targetElement) {
      console.error(`Target element not found: ${targetId}`);
      throw new Error(`Target element not found: ${targetId}`);
    }
    targetElement.innerHTML = html;
    console.log(`Component loaded successfully: ${componentPath}`);
  } catch (e) {
    console.error(`Failed to load component: ${componentPath}`, e);
    const targetElement = document.getElementById(targetId);
    if (targetElement) {
      targetElement.innerHTML = `<div class='text-red-500 text-xs'>Failed to load component: ${componentPath}<br>Error: ${e.message}</div>`;
    }
  }
}

// Utility: Get selected currency and rates from localStorage
function getSelectedCurrency() {
  const currency = localStorage.getItem('selectedCurrency') || 'RWF';
  return currency;
}
function getCurrencySymbol(currency) {
  const symbols = { USD: '$', RWF: 'FRw', EUR: '€', CNY: '¥', KES: 'Ksh', NGN: '₦' };
  return symbols[currency] || currency;
}
function getCurrencyRates() {
  try {
    return JSON.parse(localStorage.getItem('currencyRates')) || {};
  } catch { return {}; }
}

// Update all product prices in grid
function updateProductGridPrices() {
  const selectedCurrency = getSelectedCurrency();
  const rates = getCurrencyRates();
  const symbol = getCurrencySymbol(selectedCurrency);
  document.querySelectorAll('[data-base-price]').forEach(el => {
    const base = parseFloat(el.getAttribute('data-base-price'));
    if (!isNaN(base) && rates[selectedCurrency]) {
      const converted = (base * rates[selectedCurrency]).toFixed(2);
      el.textContent = `${symbol} ${converted}`;
    }
  });
  console.log('Updated product grid prices to', selectedCurrency, 'rate:', rates[selectedCurrency]);
}

// Render product grid with dynamic price conversion
function renderProductGrid(products) {
  const grid = document.getElementById('product-grid');
  if (!grid) return;
  const selectedCurrency = getSelectedCurrency();
  const rates = getCurrencyRates();
  const symbol = getCurrencySymbol(selectedCurrency);
  grid.innerHTML = products.map(p => {
    const base = parseFloat(p.price);
    let price = base;
    if (rates[selectedCurrency]) price = (base * rates[selectedCurrency]).toFixed(2);
    return `<div class="product-card bg-white rounded-xl shadow p-4 flex flex-col">
      <img src="${p.image_url}" alt="${p.name}" class="h-32 w-full object-cover rounded mb-2">
      <h3 class="font-bold text-lg mb-1">${p.name}</h3>
      <div class="text-gray-700 mb-2" data-base-price="${base}">${symbol} ${price}</div>
      <div class="text-xs text-gray-500 mb-2">MOQ: ${p.moq}</div>
      <div class="flex-1"></div>
      <button class="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition mt-2">Add to Cart</button>
    </div>`;
  }).join('');
  updateProductGridPrices();
}

// Fetch products and render grid
async function fetchAndRenderProductGrid() {
  const grid = document.getElementById('product-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="text-center text-gray-400 py-8">Loading products...</div>';
  try {
    const res = await fetch('/api/products');
    const products = await res.json();
    renderProductGrid(products);
  } catch (e) {
    grid.innerHTML = '<div class="text-center text-red-500 py-8">Failed to load products.</div>';
  }
}

// Listen for currency change and update prices
window.addEventListener('storage', function(e) {
  if (e.key === 'selectedCurrency' || e.key === 'currencyRates') {
    updateProductGridPrices();
  }
});

// Expose for buyers-home.html
window.updateProductGridPrices = updateProductGridPrices;
window.fetchAndRenderProductGrid = fetchAndRenderProductGrid;

// --- TRANSLATION SYSTEM ---
let translations = {};
let currentLang = localStorage.getItem('selectedLanguage') || 'en';

async function loadTranslations(lang) {
  try {
    const res = await fetch(`/public/i18n/${lang}.json`);
    if (!res.ok) throw new Error('Translation file not found');
    translations = await res.json();
    currentLang = lang;
    localStorage.setItem('selectedLanguage', lang);
    updateAllText();
  } catch (e) {
    if (lang !== 'en') {
      // fallback to English
      await loadTranslations('en');
    }
  }
}
function t(key) {
  return translations[key] || key;
}
function updateAllText() {
  // Update all elements with data-i18n attribute
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = t(key);
    } else {
      el.innerHTML = t(key);
    }
  });
  // Special: update document title if needed
  if (translations['welcome']) {
    document.title = t('welcome') + ' | African Deals Domain';
  }
}
// --- LANGUAGE SELECTOR HANDLER ---
function setupLanguageSelector() {
  const langSelect = document.getElementById('lang-select');
  if (langSelect) {
    langSelect.value = currentLang;
    langSelect.onchange = function() {
      loadTranslations(langSelect.value);
    };
  }
}
// --- INITIALIZE TRANSLATION ON LOAD ---
document.addEventListener('DOMContentLoaded', function() {
  loadTranslations(currentLang).then(setupLanguageSelector);
});

// --- CURRENCY SELECTOR HANDLER (remains as before) ---

// Global Message Notification System
class MessageNotificationService {
  constructor() {
    this.checkInterval = null;
    this.lastMessageCount = 0;
    this.isInitialized = false;
  }

  initialize() {
    if (this.isInitialized) return;
    
    // Check for new messages every 30 seconds
    this.checkInterval = setInterval(() => {
      this.checkForNewMessages();
    }, 30000);
    
    // Initial check
    this.checkForNewMessages();
    this.isInitialized = true;
  }

  async checkForNewMessages() {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('/api/messages/unread/count', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (data.success) {
        const currentCount = data.unread_count;
        
        // If we have new messages since last check
        if (currentCount > this.lastMessageCount && this.lastMessageCount > 0) {
          const newMessagesCount = currentCount - this.lastMessageCount;
          this.showNotification(newMessagesCount);
        }
        
        this.lastMessageCount = currentCount;
        
        // Update header badge
        this.updateHeaderBadge(currentCount);
      }
    } catch (error) {
      console.error('Error checking for new messages:', error);
    }
  }

  showNotification(count) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-bounce max-w-sm';
    notification.innerHTML = `
      <div class="flex items-center gap-3">
        <i class="fas fa-envelope text-lg"></i>
        <div>
          <div class="font-semibold">New Message${count > 1 ? 's' : ''}!</div>
          <div class="text-sm opacity-90">You have ${count} new message${count > 1 ? 's' : ''} from seller${count > 1 ? 's' : ''}</div>
        </div>
        <button onclick="this.parentElement.parentElement.remove()" class="ml-2 text-white hover:text-gray-200">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 8 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 8000);
  }

  updateHeaderBadge(count) {
    const messageBadge = document.getElementById('messages-badge');
    if (messageBadge) {
      messageBadge.textContent = count;
      messageBadge.classList.toggle('hidden', count === 0);
      
      if (count > 0) {
        messageBadge.classList.add('animate-pulse');
      } else {
        messageBadge.classList.remove('animate-pulse');
      }
    }
  }

  destroy() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isInitialized = false;
  }
}

// Global instance
window.messageNotificationService = new MessageNotificationService();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  // Only initialize if user is authenticated
  const token = localStorage.getItem('authToken'); // Fixed: use correct token key
  if (token) {
    window.messageNotificationService.initialize();
  }
});

window.SharedComponents = {
  // Render Header
  renderHeader: function(role) {
    injectComponent('main-header', '/buyer/components/header.html').then(() => {
      // Add interactivity for dropdowns, mobile menu, signout, etc.
      // Mobile menu toggle
      const btn = document.getElementById('mobile-menu-btn');
      const menu = document.getElementById('mobile-menu');
      if (btn && menu) {
        btn.onclick = () => menu.classList.toggle('hidden');
      }
      // Sign out
      const signoutBtn = document.getElementById('signout-btn');
      const mobileSignoutBtn = document.getElementById('mobile-signout-btn');
      [signoutBtn, mobileSignoutBtn].forEach(btn => {
        if (btn) btn.onclick = function() {
          localStorage.removeItem('userData'); // Fixed: use correct key
          localStorage.removeItem('authToken'); // Fixed: use correct key
          window.location.href = '/auth/auth-buyer.html'; // Fixed: use correct path
        };
      });
      // Profile name
      const user = JSON.parse(localStorage.getItem('userData')||'null'); // Fixed: use correct key
      if (user && user.name) {
        const profileName = document.getElementById('profile-name');
        if (profileName) profileName.textContent = user.name.split(' ')[0];
      }
      // Cart/messages badge
      const cart = JSON.parse(localStorage.getItem('cart')||'[]');
      const cartBadge = document.getElementById('cart-badge');
      if (cartBadge) {
        if (cart.length > 0) {
          cartBadge.textContent = cart.length;
          cartBadge.classList.remove('hidden');
        } else {
          cartBadge.classList.add('hidden');
        }
      }
      // Messages badge (placeholder)
      const messagesBadge = document.getElementById('messages-badge');
      if (messagesBadge) messagesBadge.classList.add('hidden');
    });
  },

  // Render Footer
  renderFooter: function() {
    injectComponent('main-footer', '/buyer/components/footer.html');
  },

  // Render Sidebar Filters
  renderSidebarFilters: function() {
    injectComponent('sidebar-filters', '/buyer/components/sidebar.html');
  },

  // Render Breadcrumb
  renderBreadcrumb: function(crumbs) {
    const el = document.getElementById('breadcrumb');
    if (!el) return;
    el.innerHTML = `<nav class="text-xs md:text-sm text-gray-500 mb-2"><ol class="flex flex-wrap gap-1">${crumbs.map((c,i) => `<li>${i>0 ? '<span class=\"mx-1\">&gt;</span>' : ''}<span class="${i===crumbs.length-1?'text-blue-700 font-bold':'hover:underline cursor-pointer'}">${c}</span></li>`).join('')}</ol></nav>`;
  },

  // Render Product Toolbar (sorting, search in category)
  renderProductToolbar: function() {
    const el = document.getElementById('product-toolbar');
    if (!el) return;
    el.innerHTML = `
      <div class="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-2">
        <div class="flex gap-2 items-center">
          <label class="font-semibold text-gray-700">Sort by:</label>
          <select id="sort-select" class="border rounded px-2 py-1 text-sm">
            <option value="relevance">Relevance</option>
            <option value="newest">Newest</option>
            <option value="price-low">Price Low–High</option>
            <option value="price-high">Price High–Low</option>
          </select>
        </div>
        <div class="flex gap-2 items-center">
          <input id="category-search" type="text" placeholder="Search in this category..." class="border rounded px-2 py-1 text-sm" />
          <button id="category-search-btn" class="bg-blue-600 text-white px-3 py-1 rounded text-sm">Search</button>
        </div>
      </div>
    `;
    // Add event listeners for sorting and search (to be implemented)
  },

  // --- PRODUCT GRID RENDERING ---
  renderProductGrid: async function(products) {
    const grid = document.getElementById('product-grid');
    if (!grid) return;
    if (!products || products.length === 0) {
      grid.innerHTML = '<div class="text-gray-400 text-center py-8">No products found.</div>';
      return;
    }
    // Get currency info from localStorage
    const selectedCurrency = localStorage.getItem('selectedCurrency') || 'RWF';
    const currencySymbol = { USD: '$', RWF: 'FRw', EUR: '€', CNY: '¥', KES: 'Ksh', NGN: '₦' }[selectedCurrency] || selectedCurrency;
    const rates = JSON.parse(localStorage.getItem('currencyRates') || '{}');
    const rate = rates[selectedCurrency] || 1;
    console.log('Rendering grid with currency:', selectedCurrency, 'rate:', rate);
    grid.innerHTML = products.map(p => `
      <div class="bg-white rounded-xl shadow p-4 flex flex-col items-center">
        <img src="${p.image_url}" alt="${p.name}" class="h-32 w-full object-contain mb-2 rounded" />
        <h3 class="font-bold text-lg mb-1">${p.name}</h3>
        <div class="text-blue-700 font-semibold mb-1" data-base-price="${p.price}">${currencySymbol} ${(p.price * rate).toFixed(2)}</div>
        <div class="text-xs text-gray-500 mb-2">MOQ: ${p.moq}</div>
        <button class="bg-blue-600 text-white px-4 py-1 rounded-lg mt-auto">Add to Cart</button>
      </div>
    `).join('');
  },

  // Render Product Gallery (detail page)
  renderProductGallery: async function(product) {
    const el = document.getElementById('product-gallery');
    if (!el) return;
    // If no product, fetch by id from URL
    if (!product || !product.id) {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');
      if (id) {
        try {
          const res = await fetch(`/api/products?id=${id}`);
          const products = await res.json();
          product = products && products.length ? products[0] : {};
        } catch { product = {}; }
      }
    }
    if (!product || !product.image_url) {
      el.innerHTML = '<div class="text-gray-400 text-center py-12">No image available.</div>';
      return;
    }
    el.innerHTML = `<img src="${product.image_url}" alt="${product.name}" class="rounded-xl w-full h-64 object-contain mb-2">`;
  },

  // Render Product Info (detail page)
  renderProductInfo: async function(product) {
    const el = document.getElementById('product-info');
    if (!el) return;
    // If no product, fetch by id from URL
    if (!product || !product.id) {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');
      if (id) {
        try {
          const res = await fetch(`/api/products?id=${id}`);
          const products = await res.json();
          product = products && products.length ? products[0] : {};
        } catch { product = {}; }
      }
    }
    if (!product || !product.name) {
      el.innerHTML = '<div class="text-gray-400 text-center py-12">Product not found.</div>';
      return;
    }
    el.innerHTML = `
      <h1 class="text-2xl font-bold text-blue-700 mb-2">${product.name}</h1>
      <div class="mb-2 text-lg font-semibold text-blue-700">Unit Price: RWF ${product.price} / piece</div>
      <div class="mb-2">MOQ: <span class="font-semibold">${product.moq}</span></div>
      <div class="mb-2">Customization: <span class="font-semibold">${product.customization || '-'}</span></div>
      <div class="mb-2 flex gap-2">
        <button class="bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition">Add to Cart</button>
        <button class="bg-white border border-blue-600 text-blue-600 px-4 py-2 rounded-lg shadow hover:bg-gray-100 transition">Contact Supplier</button>
      </div>
    `;
  },

  // Render Supplier Info (detail page)
  renderSupplierInfo: async function(product) {
    const el = document.getElementById('supplier-info');
    if (!el) return;
    // If no product, fetch by id from URL
    if (!product || !product.id) {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');
      if (id) {
        try {
          const res = await fetch(`/api/products?id=${id}`);
          const products = await res.json();
          product = products && products.length ? products[0] : {};
        } catch { product = {}; }
      }
    }
    if (!product || !product.supplier_name) {
      el.innerHTML = '<div class="text-gray-400 text-center py-12">Supplier info not found.</div>';
      return;
    }
    el.innerHTML = `
      <div class="font-bold text-lg mb-2">${product.supplier_name}</div>
      <div class="mb-1 text-sm">Country: <span class="font-semibold">${product.supplier_country || '-'}</span></div>
      <div class="mb-1 text-sm">Badges: ${(product.badges||[]).map(b=>`<span class='bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs ml-1'>${b}</span>`).join('')}</div>
      <div class="mb-1 text-sm">Location: <span class="font-semibold">-</span></div>
      <div class="mb-1 text-sm">Reviews: <span class="font-semibold">-</span></div>
    `;
  },

  // Render Product Tabs (detail page)
  renderProductTabs: function() {
    const el = document.getElementById('product-tabs');
    if (!el) return;
    el.innerHTML = `
      <div class="flex gap-4 border-b mb-4" id="detail-tabs">
        <button class="tab-active px-4 py-2 font-semibold" data-tab="description">Description</button>
        <button class="px-4 py-2 font-semibold" data-tab="reviews">Reviews</button>
        <button class="px-4 py-2 font-semibold" data-tab="company">Company</button>
        <button class="px-4 py-2 font-semibold" data-tab="shipping">Shipping</button>
        <button class="px-4 py-2 font-semibold" data-tab="certifications">Certifications</button>
      </div>
    `;
    // Tab switching logic
    const tabs = el.querySelectorAll('button');
    tabs.forEach(t => t.onclick = () => {
      tabs.forEach(b => b.classList.remove('tab-active'));
      t.classList.add('tab-active');
      window.SharedComponents.renderTabContent(t.dataset.tab);
    });
  },

  // Render Tab Content (detail page)
  renderTabContent: async function(tab, product) {
    const el = document.getElementById('tab-content');
    if (!el) return;
    // If no product, fetch by id from URL
    if (!product || !product.id) {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');
      if (id) {
        try {
          const res = await fetch(`/api/products?id=${id}`);
          const products = await res.json();
          product = products && products.length ? products[0] : {};
        } catch { product = {}; }
      }
    }
    if (!product) product = {};
    if (tab === 'description') {
      el.innerHTML = `<div>${product.description || 'No description available.'}</div>`;
    } else if (tab === 'reviews') {
      el.innerHTML = `<div class='text-gray-400'>No reviews yet.</div>`;
    } else if (tab === 'company') {
      el.innerHTML = `<div class='text-gray-400'>No company profile available.</div>`;
    } else if (tab === 'shipping') {
      el.innerHTML = `<div class='text-gray-400'>No shipping info available.</div>`;
    } else if (tab === 'certifications') {
      el.innerHTML = `<div class='text-gray-400'>No certifications info available.</div>`;
    }
  }
}; 