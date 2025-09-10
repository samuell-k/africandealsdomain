/**
 * Amazing Buyer Navigation System
 * Complete navigation with currency conversion, language switching, and location features
 * Designed to make users want to return with engaging UI/UX
 */

class AmazingBuyerNavigation {
  constructor() {
    this.currentUser = this.getCurrentUser();
    this.currentLanguage = localStorage.getItem('preferred_language') || 'en';
    this.currentCurrency = localStorage.getItem('preferred_currency') || 'RWF';
    this.currentCountry = localStorage.getItem('preferred_country') || 'Rwanda';
    this.exchangeRates = {};
    this.cartCount = 0;
    this.messageCount = 0;
    this.isInitialized = false;
    
    // Language translations
    this.translations = {
      'en': {
        'welcome': 'Welcome back! 🎉',
        'dashboard': 'Dashboard',
        'products': 'Products',
        'categories': 'Categories',
        'cart': 'Cart',
        'orders': 'My Orders',
        'wishlist': 'Favorites',
        'messages': 'Messages',
        'profile': 'Profile',
        'settings': 'Settings',
        'logout': 'Sign Out',
        'deliverto': 'Deliver to',
        'choose': 'Choose Location',
        'language_currency': 'Language & Currency',
        'save': 'Save',
        'search_placeholder': 'Search for products...',
        'notifications': 'Notifications',
        'account': 'My Account',
        'support': 'Help & Support'
      },
      'fr': {
        'welcome': 'Bon retour! 🎉',
        'dashboard': 'Tableau de bord',
        'products': 'Produits',
        'categories': 'Catégories',
        'cart': 'Panier',
        'orders': 'Mes Commandes',
        'wishlist': 'Favoris',
        'messages': 'Messages',
        'profile': 'Profil',
        'settings': 'Paramètres',
        'logout': 'Déconnexion',
        'deliverto': 'Livrer à',
        'choose': 'Choisir l\'emplacement',
        'language_currency': 'Langue et Devise',
        'save': 'Enregistrer',
        'search_placeholder': 'Rechercher des produits...',
        'notifications': 'Notifications',
        'account': 'Mon Compte',
        'support': 'Aide & Support'
      },
      'rw': {
        'welcome': 'Murakaza neza! 🎉',
        'dashboard': 'Ikibaho',
        'products': 'Ibicuruzwa',
        'categories': 'Ibyiciro',
        'cart': 'Agakabaho',
        'orders': 'Amateka y\'Ibicuruzwa',
        'wishlist': 'Ibyifuzo',
        'messages': 'Ubutumwa',
        'profile': 'Umwirondoro',
        'settings': 'Amagenamiterere',
        'logout': 'Sohoka',
        'deliverto': 'Ohereza kuri',
        'choose': 'Hitamo Ahantu',
        'language_currency': 'Ururimi n\'Amafaranga',
        'save': 'Kubika',
        'search_placeholder': 'Shakisha ibicuruzwa...',
        'notifications': 'Amakuru',
        'account': 'Konti Yanjye',
        'support': 'Ubufasha'
      },
      'sw': {
        'welcome': 'Karibu tena! 🎉',
        'dashboard': 'Dashibodi',
        'products': 'Bidhaa',
        'categories': 'Aina',
        'cart': 'Kikapu',
        'orders': 'Maagizo Yangu',
        'wishlist': 'Vipendwa',
        'messages': 'Ujumbe',
        'profile': 'Wasifu',
        'settings': 'Mipangilio',
        'logout': 'Ondoka',
        'deliverto': 'Peleka kwa',
        'choose': 'Chagua Eneo',
        'language_currency': 'Lugha na Fedha',
        'save': 'Hifadhi',
        'search_placeholder': 'Tafuta bidhaa...',
        'notifications': 'Arifa',
        'account': 'Akaunti Yangu',
        'support': 'Msaada'
      },
      'ar': {
        'welcome': 'أهلاً بعودتك! 🎉',
        'dashboard': 'لوحة التحكم',
        'products': 'المنتجات',
        'categories': 'الفئات',
        'cart': 'السلة',
        'orders': 'طلباتي',
        'wishlist': 'المفضلة',
        'messages': 'الرسائل',
        'profile': 'الملف الشخصي',
        'settings': 'الإعدادات',
        'logout': 'تسجيل الخروج',
        'deliverto': 'التسليم إلى',
        'choose': 'اختر الموقع',
        'language_currency': 'اللغة والعملة',
        'save': 'حفظ',
        'search_placeholder': 'البحث عن منتجات...',
        'notifications': 'الإشعارات',
        'account': 'حسابي',
        'support': 'المساعدة والدعم'
      },
      'ha': {
        'welcome': 'Barka da zuwa! 🎉',
        'dashboard': 'Dashboard',
        'products': 'Kayayyaki',
        'categories': 'Nau\'i',
        'cart': 'Kwando',
        'orders': 'Umarnina',
        'wishlist': 'Abubuwan da nake so',
        'messages': 'Saƙonni',
        'profile': 'Bayani',
        'settings': 'Saitituna',
        'logout': 'Fita',
        'deliverto': 'Kai ga',
        'choose': 'Zaɓi Wuri',
        'language_currency': 'Harshe da Kuɗi',
        'save': 'Adana',
        'search_placeholder': 'Nemo kayayyaki...',
        'notifications': 'Sanarwa',
        'account': 'Asusuna',
        'support': 'Taimako'
      },
      'yo': {
        'welcome': 'Kaabo pada! 🎉',
        'dashboard': 'Ojú-iṣẹ́',
        'products': 'Àwọn ọjà',
        'categories': 'Àwọn ìpín',
        'cart': 'Àpótí',
        'orders': 'Àwọn àṣẹ mi',
        'wishlist': 'Àwọn ayanfẹ́',
        'messages': 'Àwọn iṣẹ́',
        'profile': 'Àkọsílẹ̀',
        'settings': 'Àwọn ètò',
        'logout': 'Jade',
        'deliverto': 'Fi ránṣẹ́ sí',
        'choose': 'Yan ibì',
        'language_currency': 'Èdè àti owó',
        'save': 'Fi pamọ́',
        'search_placeholder': 'Wá àwọn ọjà...',
        'notifications': 'Àwọn ìmọ̀',
        'account': 'Àkọọlẹ̀ mi',
        'support': 'Ìrànlọ́wọ́'
      }
    };

    // Country data with flags and currencies
    this.countries = {
      'Rwanda': { flag: '🇷🇼', currency: 'RWF', code: 'RW' },
      'Kenya': { flag: '🇰🇪', currency: 'KES', code: 'KE' },
      'Uganda': { flag: '🇺🇬', currency: 'UGX', code: 'UG' },
      'Tanzania': { flag: '🇹🇿', currency: 'TZS', code: 'TZ' },
      'Nigeria': { flag: '🇳🇬', currency: 'NGN', code: 'NG' },
      'Ghana': { flag: '🇬🇭', currency: 'GHS', code: 'GH' },
      'South Africa': { flag: '🇿🇦', currency: 'ZAR', code: 'ZA' },
      'Egypt': { flag: '🇪🇬', currency: 'EGP', code: 'EG' },
      'Morocco': { flag: '🇲🇦', currency: 'MAD', code: 'MA' },
      'Ethiopia': { flag: '🇪🇹', currency: 'ETB', code: 'ET' },
      'United States': { flag: '🇺🇸', currency: 'USD', code: 'US' },
      'United Kingdom': { flag: '🇬🇧', currency: 'GBP', code: 'GB' },
      'European Union': { flag: '🇪🇺', currency: 'EUR', code: 'EU' }
    };

    this.init();
  }

  init() {
    if (this.isInitialized) return;
    
    this.loadExchangeRates();
    this.createNavigation();
    this.setupEventListeners();
    this.updateCartCount();
    this.updateMessageCount();
    this.startPeriodicUpdates();
    this.isInitialized = true;
  }

  getCurrentUser() {
    try {
      // Use consistent localStorage key
      return JSON.parse(localStorage.getItem('userData') || '{}');
    } catch {
      return {};
    }
  }

  t(key) {
    return this.translations[this.currentLanguage]?.[key] || this.translations['en'][key] || key;
  }

  async loadExchangeRates() {
    try {
      const response = await fetch('https://v6.exchangerate-api.com/v6/c5f524e323378439dad2a43f/latest/USD');
      const data = await response.json();
      
      if (data.result === 'success') {
        this.exchangeRates = data.conversion_rates;
        localStorage.setItem('exchange_rates', JSON.stringify(this.exchangeRates));
        localStorage.setItem('rates_updated', Date.now().toString());
      }
    } catch (error) {
      // Use cached rates if available
      const cachedRates = localStorage.getItem('exchange_rates');
      if (cachedRates) {
        this.exchangeRates = JSON.parse(cachedRates);
      }
    }
  }

  formatCurrency(amount, currency = this.currentCurrency) {
    const convertedAmount = this.convertCurrency(amount, 'USD', currency);
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: currency === 'RWF' ? 0 : 2
    });
    return formatter.format(convertedAmount);
  }

  convertCurrency(amount, from, to) {
    if (from === to) return amount;
    
    // Convert to USD first, then to target currency
    let usdAmount = amount;
    if (from !== 'USD') {
      usdAmount = amount / (this.exchangeRates[from] || 1);
    }
    
    if (to === 'USD') return usdAmount;
    return usdAmount * (this.exchangeRates[to] || 1);
  }

  createNavigation() {
    const navigationContainer = document.getElementById('navigation-container');
    if (!navigationContainer) return;

    const userName = this.currentUser.name || 'Valued Customer';
    const userInitial = userName.charAt(0).toUpperCase();

    navigationContainer.innerHTML = `
      <!-- Amazing Header Navigation -->
      <header class="nav-glass sticky top-0 z-50 border-b border-white/20">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between items-center h-16">
            
            <!-- Logo Section with Engaging Animation -->
            <div class="flex items-center space-x-4">
              <a href="/buyer/buyers-home.html" class="flex items-center space-x-3 group">
                <div class="relative">
                  <img src="/public/images/logo.png" alt="ADD" class="h-12 w-12 rounded-xl shadow-lg group-hover:scale-110 transition-all duration-500 ease-out">
                  <div class="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl opacity-0 group-hover:opacity-30 blur transition-all duration-500"></div>
                </div>
                <div class="hidden md:block">
                  <h1 class="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    African Deals
                  </h1>
                  <p class="text-xs text-gray-500 -mt-1">Premium Shopping</p>
                </div>
              </a>
            </div>

            <!-- Center Navigation with Smart Search -->
            <div class="hidden md:flex items-center space-x-6 flex-1 max-w-2xl mx-8">
              <div class="relative flex-1 max-w-lg">
                <div class="absolute inset-y-0 left-0 flex items-center pl-3">
                  <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                  </svg>
                </div>
                <input 
                  type="text" 
                  class="search-glass w-full pl-10 pr-4 py-3 rounded-2xl focus:outline-none focus:ring-0 text-sm placeholder-gray-500" 
                  placeholder="${this.t('search_placeholder')}"
                  id="smart-search"
                >
                <div id="search-suggestions" class="dropdown-menu absolute top-full left-0 right-0 mt-2 rounded-2xl hidden max-h-80 overflow-y-auto">
                  <!-- Search suggestions will appear here -->
                </div>
              </div>
            </div>

            <!-- Right Side Actions -->
            <div class="flex items-center space-x-2">
              
              <!-- Quick Access Icons -->
              <div class="hidden md:flex items-center space-x-1">
                
                <!-- Messages with Badge -->
                <a href="/buyer/messages.html" class="relative group">
                  <div class="flex items-center justify-center h-10 w-10 rounded-2xl hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-300">
                    <svg class="w-5 h-5 text-gray-600 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.418 8-9.879 8a9.86 9.86 0 01-4.121-.879L3 20l1.879-3.879A9.86 9.86 0 013 12C3 7.582 7.582 3 12 3s9 4.582 9 9z"></path>
                    </svg>
                  </div>
                  <span id="messages-badge" class="badge-bounce absolute -top-1 -right-1 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 shadow-lg ${this.messageCount > 0 ? '' : 'hidden'}">${this.messageCount}</span>
                </a>

                <!-- Cart with Badge -->
                <a href="/buyer/cart.html" class="relative group">
                  <div class="flex items-center justify-center h-10 w-10 rounded-2xl hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 transition-all duration-300">
                    <svg class="w-5 h-5 text-gray-600 group-hover:text-green-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4m-2.4 8L3 3H1m6 10a1 1 0 100 2 1 1 0 000-2zm10 0a1 1 0 100 2 1 1 0 000-2z"></path>
                    </svg>
                  </div>
                  <span id="cart-badge" class="badge-bounce absolute -top-1 -right-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 shadow-lg ${this.cartCount > 0 ? '' : 'hidden'}">${this.cartCount}</span>
                </a>

                <!-- Notifications -->
                <button class="relative group" onclick="showNotification('Feature in development', 'info')">
                  <div class="flex items-center justify-center h-10 w-10 rounded-2xl hover:bg-gradient-to-r hover:from-yellow-50 hover:to-orange-50 transition-all duration-300">
                    <svg class="w-5 h-5 text-gray-600 group-hover:text-yellow-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-5-5-5 5h5zm-2-12a3 3 0 100 6 3 3 0 000-6z"></path>
                    </svg>
                  </div>
                  <span class="absolute -top-1 -right-1 bg-gradient-to-r from-yellow-400 to-orange-400 text-white text-xs font-bold rounded-full px-1.5 py-0.5 shadow-lg pulse-slow">New</span>
                </button>
              </div>

              <!-- Location Selector -->
              <div class="relative">
                <button id="delivery-btn" class="flex items-center gap-2 px-3 py-2 rounded-2xl hover:bg-gradient-to-r hover:from-gray-50 hover:to-blue-50 transition-all duration-300 text-sm font-medium" onclick="showNotification('Feature in development', 'info')">
                  <span class="flag-emoji">${this.countries[this.currentCountry]?.flag || '🌍'}</span>
                  <div class="hidden sm:block text-left">
                    <div class="text-xs text-gray-500">${this.t('deliverto')}</div>
                    <div class="text-sm font-semibold text-gray-700 -mt-1">${this.currentCountry}</div>
                  </div>
                  <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </button>
                
                <div id="delivery-dropdown" class="dropdown-menu absolute right-0 mt-2 w-80 rounded-2xl p-4 hidden">
                  <div class="mb-3">
                    <h4 class="font-bold text-gray-800 mb-2 flex items-center gap-2">
                      <span>📍</span> ${this.t('deliverto')}
                    </h4>
                  </div>
                  
                  <div class="space-y-3">
                    <div>
                      <label class="block text-xs font-semibold text-gray-600 mb-1">Country</label>
                      <select id="country-select" class="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                        ${Object.entries(this.countries).map(([country, data]) => 
                          `<option value="${country}" ${country === this.currentCountry ? 'selected' : ''}>${data.flag} ${country}</option>`
                        ).join('')}
                      </select>
                    </div>
                    
                    <div>
                      <label class="block text-xs font-semibold text-gray-600 mb-1">City/Address</label>
                      <input id="manual-address" type="text" class="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" placeholder="Enter your city or address" />
                    </div>
                    
                    <button id="save-delivery" class="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-4 py-2 rounded-xl transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105" onclick="handleSave()">
                      ${this.t('save')}
                    /button>
                  </div>
                </div>
              </div>

              <!-- Language & Currency -->
              <div class="relative">
                <button id="currency-btn" class="flex items-center gap-2 px-3 py-2 rounded-2xl hover:bg-gradient-to-r hover:from-gray-50 hover:to-green-50 transition-all duration-300 text-sm font-medium" onclick="showNotification('Feature in development', 'info')">
                  <div class="currency-badge">${this.currentCurrency}</div>
                  <span class="hidden sm:inline text-gray-700">${this.currentLanguage.toUpperCase()}</span>
                  <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </button>
                
                <div id="currency-dropdown" class="dropdown-menu absolute right-0 mt-2 w-72 rounded-2xl p-4 hidden">
                  <h4 class="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <span>🌐</span> ${this.t('language_currency')}
                  </h4>
                  
                  <div class="space-y-3">
                    <div>
                      <label class="block text-xs font-semibold text-gray-600 mb-1">Language</label>
                      <select id="lang-select" class="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-green-500 focus:outline-none">
                        <option value="en" ${this.currentLanguage === 'en' ? 'selected' : ''}>🇺🇸 English</option>
                        <option value="fr" ${this.currentLanguage === 'fr' ? 'selected' : ''}>🇫🇷 Français</option>
                        <option value="rw" ${this.currentLanguage === 'rw' ? 'selected' : ''}>🇷🇼 Kinyarwanda</option>
                        <option value="sw" ${this.currentLanguage === 'sw' ? 'selected' : ''}>🇹🇿 Kiswahili</option>
                        <option value="ar" ${this.currentLanguage === 'ar' ? 'selected' : ''}>🇸🇦 العربية</option>
                        <option value="ha" ${this.currentLanguage === 'ha' ? 'selected' : ''}>🇳🇬 Hausa</option>
                        <option value="yo" ${this.currentLanguage === 'yo' ? 'selected' : ''}>🇳🇬 Yoruba</option>
                      </select>
                    </div>
                    
                    <div>
                      <label class="block text-xs font-semibold text-gray-600 mb-1">Currency</label>
                      <select id="currency-select" class="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-green-500 focus:outline-none">
                        ${Object.entries(this.countries).map(([country, data]) => 
                          `<option value="${data.currency}" ${data.currency === this.currentCurrency ? 'selected' : ''}>${data.flag} ${data.currency} (${country})</option>`
                        ).join('')}
                      </select>
                    </div>
                    
                    <button id="save-currency" class="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-4 py-2 rounded-xl transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105" onclick="handleSave()">
                      ${this.t('save')}
                    /button>
                  </div>
                </div>
              </div>

              <!-- User Profile -->
              <div class="relative">
                <button id="profile-btn" class="flex items-center gap-3 px-3 py-2 rounded-2xl hover:bg-gradient-to-r hover:from-gray-50 hover:to-purple-50 transition-all duration-300 group" onclick="showNotification('Feature in development', 'info')">
                  <div class="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300">
                    <span class="text-white font-bold text-lg">${userInitial}</span>
                  </div>
                  <div class="hidden md:block text-left">
                    <div class="text-xs text-gray-500">Welcome back!</div>
                    <div class="text-sm font-semibold text-gray-800 -mt-1">${userName.split(' ')[0]}</div>
                  </div>
                </button>
                
                <div id="profile-dropdown" class="dropdown-menu absolute right-0 mt-2 w-64 rounded-2xl p-4 hidden">
                  <div class="mb-4 text-center">
                    <div class="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-2">
                      <span class="text-white font-bold text-2xl">${userInitial}</span>
                    </div>
                    <h4 class="font-bold text-gray-800">${userName}</h4>
                    <p class="text-sm text-gray-600">${this.currentUser.email || ''}</p>
                  </div>
                  
                  <div class="space-y-1">
                    <a href="/buyer/orders.html" class="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gradient-to-r hover:from-blue-50 hover:to-blue-100 transition-all duration-200 text-sm font-medium text-gray-700 hover:text-blue-700">
                      <span>📋</span> ${this.t('orders')}
                    </a>
                    <a href="/buyer/wishlist.html" class="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gradient-to-r hover:from-pink-50 hover:to-pink-100 transition-all duration-200 text-sm font-medium text-gray-700 hover:text-pink-700">
                      <span>❤️</span> ${this.t('wishlist')}
                    </a>
                    <a href="/buyer/messages.html" class="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gradient-to-r hover:from-green-50 hover:to-green-100 transition-all duration-200 text-sm font-medium text-gray-700 hover:text-green-700">
                      <span>💬</span> ${this.t('messages')}
                    </a>
                    <a href="/buyer/profile.html" class="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gradient-to-r hover:from-purple-50 hover:to-purple-100 transition-all duration-200 text-sm font-medium text-gray-700 hover:text-purple-700">
                      <span>👤</span> ${this.t('account')}
                    </a>
                    <a href="/buyer/support.html" class="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gradient-to-r hover:from-yellow-50 hover:to-yellow-100 transition-all duration-200 text-sm font-medium text-gray-700 hover:text-yellow-700">
                      <span>🆘</span> ${this.t('support')}
                    </a>
                    <hr class="my-2 border-gray-200">
                    <button id="signout-btn" class="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gradient-to-r hover:from-red-50 hover:to-red-100 transition-all duration-200 text-sm font-medium text-gray-700 hover:text-red-700 w-full text-left" onclick="showNotification('Feature in development', 'info')">
                      span>🚪</span> ${this.t('logout')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <!-- Mobile Navigation Bar -->
      <div class="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <div class="grid grid-cols-5 py-2">
          <a href="/buyer/buyers-home.html" class="flex flex-col items-center justify-center py-2 text-xs">
            <div class="w-8 h-8 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center mb-1">
              <span class="text-white">🏠</span>
            </div>
            <span class="text-gray-700">${this.t('dashboard')}</span>
          </a>
          <a href="/buyer/products.html" class="flex flex-col items-center justify-center py-2 text-xs">
            <div class="w-8 h-8 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 flex items-center justify-center mb-1">
              <span class="text-white">🛍️</span>
            </div>
            <span class="text-gray-700">${this.t('products')}</span>
          </a>
          <a href="/buyer/cart.html" class="flex flex-col items-center justify-center py-2 text-xs relative">
            <div class="w-8 h-8 rounded-xl bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-center mb-1">
              <span class="text-white">🛒</span>
            </div>
            <span class="text-gray-700">${this.t('cart')}</span>
            <span id="mobile-cart-badge" class="absolute -top-1 right-4 bg-red-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 ${this.cartCount > 0 ? '' : 'hidden'}">${this.cartCount}</span>
          </a>
          <a href="/buyer/messages.html" class="flex flex-col items-center justify-center py-2 text-xs relative">
            <div class="w-8 h-8 rounded-xl bg-gradient-to-r from-yellow-500 to-yellow-600 flex items-center justify-center mb-1">
              <span class="text-white">💬</span>
            </div>
            <span class="text-gray-700">${this.t('messages')}</span>
            <span id="mobile-message-badge" class="absolute -top-1 right-4 bg-red-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 ${this.messageCount > 0 ? '' : 'hidden'}">${this.messageCount}</span>
          </a>
          <button id="mobile-profile-btn" class="flex flex-col items-center justify-center py-2 text-xs" onclick="showNotification('Feature in development', 'info')">
            <div class="w-8 h-8 rounded-xl bg-gradient-to-r from-pink-500 to-pink-600 flex items-center justify-center mb-1">
              <span class="text-white">${userInitial}</span>
            </div>
            <span class="text-gray-700">${this.t('profile')}</span>
          </button>
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    // Delivery location dropdown
    this.setupDropdownToggle('delivery-btn', 'delivery-dropdown');
    
    // Currency dropdown
    this.setupDropdownToggle('currency-btn', 'currency-dropdown');
    
    // Profile dropdown
    this.setupDropdownToggle('profile-btn', 'profile-dropdown');
    
    // Mobile profile
    this.setupDropdownToggle('mobile-profile-btn', 'profile-dropdown');

    // Save buttons
    this.setupSaveHandlers();
    
    // Smart search
    this.setupSmartSearch();
    
    // Sign out
    const signoutBtn = document.getElementById('signout-btn');
    if (signoutBtn) {
      signoutBtn.addEventListener('click', () => this.handleSignOut());
    }

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('[id$="-btn"]') && !e.target.closest('[id$="-dropdown"]')) {
        this.closeAllDropdowns();
      }
    });
  }

  setupDropdownToggle(buttonId, dropdownId) {
    const button = document.getElementById(buttonId);
    const dropdown = document.getElementById(dropdownId);
    
    if (button && dropdown) {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeAllDropdowns();
        dropdown.classList.toggle('hidden');
      });
    }
  }

  closeAllDropdowns() {
    const dropdowns = ['delivery-dropdown', 'currency-dropdown', 'profile-dropdown', 'search-suggestions'];
    dropdowns.forEach(id => {
      const element = document.getElementById(id);
      if (element) element.classList.add('hidden');
    });
  }

  setupSaveHandlers() {
    // Save delivery location
    const saveDeliveryBtn = document.getElementById('save-delivery');
    if (saveDeliveryBtn) {
      saveDeliveryBtn.addEventListener('click', () => {
        const country = document.getElementById('country-select')?.value;
        const address = document.getElementById('manual-address')?.value;
        
        if (country) {
          this.currentCountry = country;
          localStorage.setItem('preferred_country', country);
          
          // Update currency based on country
          const countryData = this.countries[country];
          if (countryData) {
            this.currentCurrency = countryData.currency;
            localStorage.setItem('preferred_currency', countryData.currency);
          }
        }
        
        if (address) {
          localStorage.setItem('delivery_address', address);
        }
        
        this.updateNavigationTexts();
        this.closeAllDropdowns();
        
        // Show success message
        this.showNotification('✅ Delivery location updated!', 'success');
      });
    }

    // Save language and currency
    const saveCurrencyBtn = document.getElementById('save-currency');
    if (saveCurrencyBtn) {
      saveCurrencyBtn.addEventListener('click', () => {
        const language = document.getElementById('lang-select')?.value;
        const currency = document.getElementById('currency-select')?.value;
        
        if (language) {
          this.currentLanguage = language;
          localStorage.setItem('preferred_language', language);
          document.documentElement.lang = language;
        }
        
        if (currency) {
          this.currentCurrency = currency;
          localStorage.setItem('preferred_currency', currency);
        }
        
        this.updateNavigationTexts();
        this.closeAllDropdowns();
        
        // Show success message
        this.showNotification('✅ Language & Currency updated!', 'success');
        
        // Reload page to apply language changes
        setTimeout(() => window.location.reload(), 1000);
      });
    }
  }

  setupSmartSearch() {
    const searchInput = document.getElementById('smart-search');
    const suggestions = document.getElementById('search-suggestions');
    
    if (searchInput && suggestions) {
      let searchTimeout;
      
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        
        if (query.length > 2) {
          searchTimeout = setTimeout(() => {
            this.performSmartSearch(query);
          }, 300);
        } else {
          suggestions.classList.add('hidden');
        }
      });

      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const query = e.target.value.trim();
          if (query) {
            window.location.href = `/buyer/products.html?search=${encodeURIComponent(query)}`;
          }
        }
      });
    }
  }

  async performSmartSearch(query) {
    try {
      // Simulate smart search - replace with actual API call
      const suggestions = [
        { type: 'product', name: `${query} - Electronics`, price: '$299', image: '/public/images/sample-product.jpg' },
        { type: 'product', name: `${query} - Fashion`, price: '$89', image: '/public/images/sample-product.jpg' },
        { type: 'category', name: `Browse ${query} Category`, icon: '📂' },
        { type: 'seller', name: `Top sellers for ${query}`, icon: '🏪' }
      ];

      this.displaySearchSuggestions(suggestions);
    } catch (error) {
      console.error('Search error:', error);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Search error:',
                    error: error,
                    timestamp: new Date().toISOString(),
                    file: 'amazing-buyer-navigation.js'
                };
                
                console.error('Error details:', errorInfo);
showNotification('Search error:', 'error');

// Enhanced error logging
if (error && error.message) {
    console.error('Error details:', error.message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error details:',
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    file: 'amazing-buyer-navigation.js'
                };
                
                console.error('Error details:', errorInfo);
}
    }
  }

  displaySearchSuggestions(suggestions) {
    const container = document.getElementById('search-suggestions');
    if (!container) return;

    container.innerHTML = suggestions.map(item => {
      if (item.type === 'product') {
        return `
          <div class="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer">
            <img src="${item.image}" alt="${item.name}" class="w-12 h-12 rounded-lg object-cover">
            <div class="flex-1">
              <h4 class="font-semibold text-sm text-gray-800">${item.name}</h4>
              <p class="text-sm text-green-600">${this.formatCurrency(item.price.replace('$', ''))}</p>
            </div>
          </div>
        `;
      } else {
        return `
          <div class="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer">
            <span class="text-2xl">${item.icon}</span>
            <span class="font-medium text-gray-800">${item.name}</span>
          </div>
        `;
      }
    }).join('');

    container.classList.remove('hidden');
  }

  updateNavigationTexts() {
    // Update all text elements with current language
    const elementsToUpdate = [
      { selector: '[data-i18n]', method: 'textContent' }
    ];

    elementsToUpdate.forEach(({ selector, method }) => {
      document.querySelectorAll(selector).forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (key) {
          element[method] = this.t(key);
        }
      });
    });

    // Update country/currency displays
    const deliveryBtn = document.getElementById('delivery-btn');
    const currencyBtn = document.getElementById('currency-btn');
    
    if (deliveryBtn) {
      const flag = this.countries[this.currentCountry]?.flag || '🌍';
      deliveryBtn.querySelector('.flag-emoji').textContent = flag;
      deliveryBtn.querySelector('div:last-child').textContent = this.currentCountry;
    }

    if (currencyBtn) {
      currencyBtn.querySelector('.currency-badge').textContent = this.currentCurrency;
      const langSpan = currencyBtn.querySelector('span');
      if (langSpan) langSpan.textContent = this.currentLanguage.toUpperCase();
    }
  }

  async updateCartCount() {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('/api/cart/count', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        this.cartCount = data.count || 0;
        this.updateBadge('cart-badge', this.cartCount);
        this.updateBadge('mobile-cart-badge', this.cartCount);
      }
    } catch (error) {
      console.error('Error updating cart count:', error);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error updating cart count:',
                    error: error,
                    timestamp: new Date().toISOString(),
                    file: 'amazing-buyer-navigation.js'
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
                    file: 'amazing-buyer-navigation.js'
                };
                
                console.error('Error details:', errorInfo);
}
    }
  }

  async updateMessageCount() {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('/api/messages/unread/count', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        this.messageCount = data.count || 0;
        this.updateBadge('messages-badge', this.messageCount);
        this.updateBadge('mobile-message-badge', this.messageCount);
      }
    } catch (error) {
      console.error('Error updating message count:', error);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error updating message count:',
                    error: error,
                    timestamp: new Date().toISOString(),
                    file: 'amazing-buyer-navigation.js'
                };
                
                console.error('Error details:', errorInfo);
showNotification('Error updating message count:', 'error');

// Enhanced error logging
if (error && error.message) {
    console.error('Error details:', error.message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error details:',
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    file: 'amazing-buyer-navigation.js'
                };
                
                console.error('Error details:', errorInfo);
}
    }
  }

  updateBadge(badgeId, count) {
    const badge = document.getElementById(badgeId);
    if (badge) {
      badge.textContent = count;
      if (count > 0) {
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
  }

  startPeriodicUpdates() {
    // Update counts every 30 seconds
    setInterval(() => {
      this.updateCartCount();
      this.updateMessageCount();
    }, 30000);

    // Update exchange rates every hour
    setInterval(() => {
      this.loadExchangeRates();
    }, 3600000);
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-20 right-4 z-50 px-6 py-3 rounded-2xl shadow-lg text-white font-semibold transform transition-all duration-500 translate-x-full`;
    
    switch (type) {
      case 'success':
        notification.className += ' bg-gradient-to-r from-green-500 to-green-600';
        break;
      case 'error':
        notification.className += ' bg-gradient-to-r from-red-500 to-red-600';
        break;
      default:
        notification.className += ' bg-gradient-to-r from-blue-500 to-blue-600';
    }
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.classList.remove('translate-x-full');
    }, 100);
    
    // Animate out and remove
    setTimeout(() => {
      notification.classList.add('translate-x-full');
      setTimeout(() => notification.remove(), 500);
    }, 3000);
  }

  handleSignOut() {
    if (confirm('Are you sure you want to sign out?')) {
      // Use consistent localStorage keys
      localStorage.removeItem('authToken');
      localStorage.removeItem('userData');
      // Also remove old keys for cleanup
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/auth/auth-buyer.html';
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new AmazingBuyerNavigation();
  });
} else {
  new AmazingBuyerNavigation();
}

// Export for use in other scripts
window.AmazingBuyerNavigation = AmazingBuyerNavigation;