// Enhanced Local Market Core (single module)
// - Robust DOM querying with optional chaining
// - Loads profile, categories, products with better error states
// - Grid/List view, search debounce, filters, pagination
// - Skeleton loaders, empty states, consistent notifications

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const state = {
  profile: null,
  categories: [],
  products: [],
  filtered: [],
  page: 1,
  perPage: 12,
  tab: 'nearby',
  view: 'grid', // 'grid' | 'list'
  search: '',
  filters: { category: '', maxPrice: 100000, availability: '' },
};

const els = {
  // header
  notificationRoot: $('#notification-root'),
  searchInput: $('#search-input'),
  mobileSearch: $('#mobile-search'),
  userMenuBtn: $('#user-menu-btn'),
  userMenu: $('#user-menu'),
  userName: $('#user-name'),
  switchProductsBtn: $('#switch-products-btn'),

  // tabs
  tabButtons: $$('.tab-btn'),

  // filters
  locationText: $('#location-text'),
  useLocationBtn: $('#use-location'),
  setLocationBtn: $('#set-location'),
  categoriesList: $('#categories-list'),
  categoryFilter: $('#category-filter'),
  priceRange: $('#price-range'),
  priceRangeValue: $('#price-range-value'),
  availabilityFilter: $('#availability-filter'),
  sortFilter: $('#sort-filter'),
  clearFiltersBtn: $('#clear-filters'),

  // products
  productsCount: $('#products-count'),
  gridBtn: $('#grid-view-btn'),
  listBtn: $('#list-view-btn'),
  productsContainer: $('#products-container'),
  productsLoading: $('#products-loading'),
  pagination: $('#pagination'),
  prevPage: $('#prev-page'),
  nextPage: $('#next-page'),
  pageIndicator: $('#page-indicator'),

  // cart
  cartButton: $('#cart-button'),
  cartBadge: $('#cart-badge'),
  cartItems: $('#cart-items'),
  cartSubtotal: $('#cart-subtotal'),
  clearCartBtn: $('#clear-cart'),
  checkoutBtn: $('#checkout-btn'),
};

const cart = {
  items: [],
  add(item) {
    const existing = this.items.find(i => i.id === item.id);
    if (existing) existing.qty += item.qty || 1; else this.items.push({ ...item, qty: item.qty || 1 });
    this._sync();
  },
  remove(id) { this.items = this.items.filter(i => i.id !== id); this._sync(); },
  update(id, qty) { const it = this.items.find(i => i.id === id); if (it) { it.qty = Math.max(1, qty); this._sync(); } },
  clear() { this.items = []; this._sync(); },
  subtotal() { return this.items.reduce((s, i) => s + i.qty * (i.price || 0), 0); },
  _sync() { renderCart(); localStorage.setItem('lm_cart', JSON.stringify(this.items)); },
  load() { try { this.items = JSON.parse(localStorage.getItem('lm_cart')||'[]')||[]; } catch { this.items = []; } renderCart(); },
};

function formatPrice(v){ return new Intl.NumberFormat('en-RW').format(Math.round(Number(v)||0)); }
function debounce(fn, ms=300){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }

function notify(message, type='info'){
  const root = els.notificationRoot; if (!root) return;
  const wrapper = document.createElement('div');
  const bg = type==='success' ? 'bg-green-600' : type==='error' ? 'bg-red-600' : type==='warning' ? 'bg-yellow-600' : 'bg-gray-900';
  const icon = type==='success' ? 'fa-circle-check' : type==='error' ? 'fa-triangle-exclamation' : type==='warning' ? 'fa-circle-exclamation' : 'fa-circle-info';
  wrapper.className = `text-white px-4 py-3 rounded-lg shadow notification-enter`;
  wrapper.innerHTML = `<i class="fa-solid ${icon} mr-2"></i><span>${message}</span>`;
  root.appendChild(wrapper);
  requestAnimationFrame(()=>wrapper.classList.add('notification-enter-active'));
  setTimeout(()=>{
    wrapper.classList.remove('notification-enter-active');
    wrapper.classList.add('notification-exit');
    requestAnimationFrame(()=>wrapper.classList.add('notification-exit-active'));
    setTimeout(()=>wrapper.remove(), 200);
  }, 3000);
}

async function safeJson(res){
  try { return await res.json(); } catch { return { success:false, error:'Invalid JSON' }; }
}

async function apiGet(endpoint){
  try {
    const url = endpoint.startsWith('http') ? endpoint : window.API_CONFIG?.getApiUrl?.(endpoint) || endpoint;
    const res = await window.API_CONFIG?.makeAuthenticatedRequest?.(url, { method:'GET' }) || await fetch(url);
    if (!res) throw new Error('No response');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await safeJson(res);
  } catch (e) {
    console.error('[API] GET error:', e);
    notify('Network error. Please try again.', 'error');
    return { success:false, error:String(e.message||e) };
  }
}

async function loadProfile(){
  const data = await apiGet('/api/auth/profile');
  if (data?.user){ state.profile = data.user; if (els.userName) els.userName.textContent = data.user.name || data.user.username || 'User'; }
  else { if (els.userName) els.userName.textContent = 'Guest'; }
}

async function loadCategories(){
  const data = await apiGet('/api/grocery/categories');
  if (Array.isArray(data?.categories)){
    state.categories = data.categories;
    renderCategories();
    renderCategoryFilter();
  } else {
    renderCategoriesError(data?.error || 'Failed to load categories');
  }
}

async function loadProducts(){
  setProductsBusy(true);
  const params = new URLSearchParams({ limit: state.perPage, offset: (state.page-1)*state.perPage });
  let data;
  if (state.tab === 'nearby') {
    const loc = getPersistedLocation();
    if (loc) { params.set('lat', String(loc.lat)); params.set('lng', String(loc.lng)); }
    const nearby = await apiGet(`/api/local-market/products/nearby?${params.toString()}`);
    data = (nearby?.success && Array.isArray(nearby.products)) ? nearby : await apiGet(`/api/local-market/products?${params.toString()}`);
  } else {
    data = await apiGet(`/api/local-market/products?${params.toString()}`);
  }
  if (data?.success && Array.isArray(data.products)){
    state.products = data.products.map(safeProduct);
    applyFilters();
  } else {
    state.products = []; state.filtered = [];
    renderProductsEmpty(data?.error || 'No products available');
  }
  setProductsBusy(false);
}

function safeProduct(p){
  return {
    id: p.id || p.product_id || cryptoRandom(),
    base_product_id: p.product_id || p.id || null,
    name: p.name || p.product_name || 'Unknown Product',
    description: p.description || 'No description available',
    price: Number(p.unit_price ?? p.price_per_unit ?? p.price ?? 0),
    unit: p.unit_type || p.unit || 'unit',
    stock: Number(p.stock_quantity ?? p.available_stock ?? p.stock ?? 0),
    image: p.main_image || p.image || '/public/images/placeholder-product.jpg',
    category: p.category || p.category_name || 'Uncategorized',
    seller_name: p.seller_name || 'Local Seller',
    seller_id: p.seller_id || null,
    rating: Number(p.rating ?? 0),
    reviews: Number(p.reviews_count ?? 0),
  };
}

function cryptoRandom(){ try { return crypto.getRandomValues(new Uint32Array(1))[0].toString(36); } catch { return Math.random().toString(36).slice(2); } }

function getPersistedLocation(){ try { return JSON.parse(localStorage.getItem('local_market_location')||'null'); } catch { return null; } }
function setPersistedLocation(lat,lng){ try { localStorage.setItem('local_market_location', JSON.stringify({ lat, lng, saved_at: Date.now() })); } catch {} }

function setProductsBusy(busy){ if (!els.productsContainer) return; els.productsContainer.setAttribute('aria-busy', String(busy)); if (els.productsLoading) els.productsLoading.classList.toggle('hidden', !busy); }

function renderCategories(){
  if (!els.categoriesList) return;
  if (!state.categories.length){ renderCategoriesEmpty(); return; }
  els.categoriesList.innerHTML = state.categories.map(c=>`
    <button class="w-full text-left px-3 py-2 rounded hover:bg-gray-50 border border-gray-100" data-cat-id="${c.id}">
      <span class="text-sm text-gray-800">${c.name}</span>
    </button>
  `).join('');
  // click to filter
  els.categoriesList.addEventListener('click', (e)=>{
    const btn = e.target.closest('button[data-cat-id]');
    if (!btn) return;
    state.filters.category = String(btn.getAttribute('data-cat-id'));
    if (els.categoryFilter) els.categoryFilter.value = state.filters.category;
    applyFilters(true);
  });
}

function renderCategoriesEmpty(message='No categories available'){
  if (!els.categoriesList) return;
  els.categoriesList.innerHTML = `<p class="text-sm text-gray-500">${message}</p>`;
}

function renderCategoryFilter(){
  if (!els.categoryFilter) return;
  els.categoryFilter.innerHTML = '<option value="">All</option>' + state.categories.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
}

function applyFilters(resetPage=false){
  const q = state.search.trim().toLowerCase();
  let arr = state.products.filter(p=>
    (!q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)) &&
    (!state.filters.category || String(p.category_id||p.category) === String(state.filters.category) || p.category === state.filters.category) &&
    (p.price <= state.filters.maxPrice) &&
    (!state.filters.availability || (state.filters.availability==='in_stock' ? p.stock>0 : p.stock>0 && p.stock<=5))
  );
  // sort
  switch (els.sortFilter?.value) {
    case 'price_low': arr.sort((a,b)=>a.price-b.price); break;
    case 'price_high': arr.sort((a,b)=>b.price-a.price); break;
    case 'rating': arr.sort((a,b)=>b.rating-a.rating); break;
    case 'newest': arr.sort((a,b)=> (b.created_at||0) - (a.created_at||0)); break;
    default: arr.sort((a,b)=> String(a.name).localeCompare(String(b.name))); break;
  }
  state.filtered = arr;
  if (resetPage) state.page = 1;
  renderProducts();
  updateCountsAndPagination();
}

function renderProducts(){
  if (!els.productsContainer) return;
  const start = (state.page-1)*state.perPage;
  const slice = state.filtered.slice(start, start+state.perPage);
  if (!slice.length){
    renderProductsEmpty('No products match your criteria. Try adjusting filters.');
    return;
  }
  const grid = state.view==='grid';
  const cls = grid ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4';
  els.productsContainer.innerHTML = `<div class="${cls}">${slice.map(p=>productCard(p, grid)).join('')}</div>`;
  // bind add to cart and share
  els.productsContainer.querySelectorAll('[data-add]')?.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id = btn.getAttribute('data-add');
      const p = slice.find(x=>String(x.id)===String(id));
      if (!p) return;
      cart.add({ id: p.id, name: p.name, price: p.price });
      notify('Added to cart', 'success');
    });
  });
  els.productsContainer.querySelectorAll('[data-share]')?.forEach(btn=>{
    btn.addEventListener('click', ()=> shareProduct(btn.getAttribute('data-share'), btn.getAttribute('data-platform')));
  });
}

function productCard(p, grid=true){
  const image = p.image;
  const price = `${formatPrice(p.price)} RWF`;
  const stockText = p.stock<=0 ? 'Out of stock' : `${p.stock} ${p.unit} available`;
  const stockCls = p.stock<=0 ? 'text-red-500' : 'text-green-600';
  if (grid) {
    return `
      <div class="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden">
        <div class="relative">
          <img src="${image}" alt="${p.name}" class="w-full h-44 object-cover" onerror="this.src='/public/images/placeholder-product.jpg'" />
          <div class="absolute top-2 left-2 bg-green-600 text-white text-xs px-2 py-1 rounded">${p.category}</div>
          ${p.stock<=0 ? '<div class="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-1 rounded">Out</div>' : ''}
        </div>
        <div class="p-4 space-y-2">
          <h3 class="font-semibold text-gray-900 line-clamp-2">${p.name}</h3>
          <p class="text-sm text-gray-600 line-clamp-2">${p.description}</p>
          <div class="flex items-center justify-between">
            <div>
              <span class="text-2xl font-bold text-green-700">${price}</span>
              <span class="text-sm text-gray-500">/ ${p.unit}</span>
            </div>
            <p class="text-xs ${stockCls}">${stockText}</p>
          </div>
          <div class="flex items-center gap-2">
            <button data-add="${p.id}" class="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded disabled:opacity-50" ${p.stock<=0?'disabled':''}>Add</button>
            <div class="flex items-center gap-1">
              ${['whatsapp','facebook','twitter','telegram','copy'].map(platform=>`
                <button data-share="${p.id}" data-platform="${platform}" class="p-2 text-gray-600 hover:bg-gray-100 rounded" title="Share on ${platform}">
                  <i class="fa-brands ${iconFor(platform)}"></i>
                </button>`).join('')}
            </div>
          </div>
        </div>
      </div>`;
  }
  // list
  return `
    <div class="bg-white rounded-xl shadow border p-4 flex gap-4 items-start">
      <img src="${image}" alt="${p.name}" class="w-28 h-28 object-cover rounded" onerror="this.src='/public/images/placeholder-product.jpg'" />
      <div class="flex-1 min-w-0">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h3 class="font-semibold text-gray-900">${p.name}</h3>
            <p class="text-sm text-gray-600 line-clamp-2">${p.description}</p>
            <p class="mt-1 text-xs text-gray-500">Category: ${p.category} • Seller: ${p.seller_name}</p>
          </div>
          <div class="text-right">
            <div class="text-2xl font-bold text-green-700">${price}</div>
            <div class="text-xs ${stockCls}">${stockText}</div>
          </div>
        </div>
        <div class="mt-3 flex items-center gap-2">
          <button data-add="${p.id}" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded disabled:opacity-50" ${p.stock<=0?'disabled':''}>Add to cart</button>
          <div class="flex items-center gap-1">
            ${['whatsapp','facebook','twitter','telegram','copy'].map(platform=>`
              <button data-share="${p.id}" data-platform="${platform}" class="p-2 text-gray-600 hover:bg-gray-100 rounded" title="Share on ${platform}">
                <i class="fa-brands ${iconFor(platform)}"></i>
              </button>`).join('')}
          </div>
        </div>
      </div>
    </div>`;
}

function iconFor(platform){
  switch(platform){
    case 'whatsapp': return 'fa-whatsapp';
    case 'facebook': return 'fa-facebook';
    case 'twitter': return 'fa-x-twitter';
    case 'telegram': return 'fa-telegram';
    default: return 'fa-link';
  }
}

function renderProductsEmpty(message){
  els.productsContainer.innerHTML = `
    <div class="bg-white rounded-lg border p-10 text-center text-gray-600">
      <i class="fa-regular fa-face-frown text-5xl text-gray-300"></i>
      <h3 class="mt-3 text-lg font-semibold">Nothing to show</h3>
      <p class="text-sm">${message || 'Please adjust your filters or try again later.'}</p>
    </div>`;
}

function updateCountsAndPagination(){
  const total = state.filtered.length;
  if (els.productsCount) els.productsCount.textContent = `${total} product${total===1?'':'s'} found`;
  const totalPages = Math.max(1, Math.ceil(total / state.perPage));
  if (els.pageIndicator) els.pageIndicator.textContent = `Page ${state.page} of ${totalPages}`;
  if (els.prevPage) els.prevPage.disabled = state.page<=1;
  if (els.nextPage) els.nextPage.disabled = state.page>=totalPages;
}

function renderCart(){
  if (!els.cartItems) return;
  if (!cart.items.length){ els.cartItems.innerHTML = '<p class="text-sm text-gray-500">Your cart is empty.</p>'; }
  else {
    els.cartItems.innerHTML = cart.items.map(i=>`
      <div class="flex items-center justify-between gap-2">
        <div class="min-w-0">
          <p class="text-sm text-gray-800 truncate">${i.name}</p>
          <p class="text-xs text-gray-500">RWF ${formatPrice(i.price)} x
            <input type="number" min="1" value="${i.qty}" data-qty="${i.id}" class="w-14 ml-1 border rounded px-1 py-0.5" />
          </p>
        </div>
        <div class="flex items-center gap-2">
          <strong class="text-gray-900">RWF ${formatPrice(i.qty*i.price)}</strong>
          <button class="text-red-600 p-2" data-remove="${i.id}" title="Remove"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>`).join('');
    els.cartItems.querySelectorAll('[data-remove]')?.forEach(b=>b.addEventListener('click',()=>cart.remove(b.getAttribute('data-remove'))));
    els.cartItems.querySelectorAll('[data-qty]')?.forEach(inp=>inp.addEventListener('change',()=>cart.update(inp.getAttribute('data-qty'), Number(inp.value)||1)));
  }
  if (els.cartSubtotal) els.cartSubtotal.textContent = `RWF ${formatPrice(cart.subtotal())}`;
  if (els.checkoutBtn) els.checkoutBtn.disabled = cart.items.length===0;
  if (els.cartBadge) {
    if (cart.items.length>0){ els.cartBadge.textContent = String(cart.items.reduce((s,i)=>s+i.qty,0)); els.cartBadge.classList.remove('hidden'); }
    else { els.cartBadge.classList.add('hidden'); }
  }
}

function shareProduct(productId, platform){
  const p = state.products.find(x=>String(x.id)===String(productId));
  if (!p) return;
  const url = location.origin + '/apps/client/grocery/local-market-home-enhanced.html#p=' + encodeURIComponent(productId);
  const text = `Check out ${p.name} on Local Market: ${url}`;
  try {
    if (platform==='copy'){
      navigator.clipboard?.writeText?.(url);
      notify('Link copied to clipboard', 'success');
      return;
    }
    const map = {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    };
    const shareUrl = map[platform];
    if (shareUrl) window.open(shareUrl, '_blank', 'noopener,noreferrer');
  } catch (e) { notify('Unable to share', 'error'); }
}

function wireEvents(){
  // menu
  els.userMenuBtn?.addEventListener('click',()=>{
    const open = !els.userMenu?.classList.contains('hidden');
    els.userMenu?.classList.toggle('hidden', open);
    els.userMenuBtn?.setAttribute('aria-expanded', String(!open));
  });
  document.addEventListener('click', (e)=>{
    if (!els.userMenuBtn?.contains(e.target) && !els.userMenu?.contains(e.target)) els.userMenu?.classList.add('hidden');
  });

  // search
  const onSearch = debounce((v)=>{ state.search = v; applyFilters(true); }, 300);
  els.searchInput?.addEventListener('input', e=>onSearch(e.target.value));
  els.mobileSearch?.addEventListener('input', e=>onSearch(e.target.value));

  // filters
  els.categoryFilter?.addEventListener('change', ()=>{ state.filters.category = els.categoryFilter.value; applyFilters(true); });
  els.priceRange?.addEventListener('input', ()=>{ state.filters.maxPrice = Number(els.priceRange.value||100000); if (els.priceRangeValue) els.priceRangeValue.textContent = `RWF ${formatPrice(state.filters.maxPrice)}`; applyFilters(true); });
  els.availabilityFilter?.addEventListener('change', ()=>{ state.filters.availability = els.availabilityFilter.value; applyFilters(true); });
  els.sortFilter?.addEventListener('change', ()=>applyFilters());
  els.clearFiltersBtn?.addEventListener('click', ()=>{ state.search=''; state.filters={ category:'', maxPrice:100000, availability:'' }; if (els.searchInput) els.searchInput.value=''; if (els.mobileSearch) els.mobileSearch.value=''; if (els.categoryFilter) els.categoryFilter.value=''; if (els.priceRange){ els.priceRange.value='100000'; } if (els.priceRangeValue){ els.priceRangeValue.textContent='RWF 100,000'; } if (els.availabilityFilter) els.availabilityFilter.value=''; applyFilters(true); });

  // view toggle
  els.gridBtn?.addEventListener('click', ()=>{ state.view='grid'; els.gridBtn.classList.add('bg-green-100','text-green-700'); els.listBtn?.classList.remove('bg-green-100','text-green-700'); renderProducts(); });
  els.listBtn?.addEventListener('click', ()=>{ state.view='list'; els.listBtn.classList.add('bg-green-100','text-green-700'); els.gridBtn?.classList.remove('bg-green-100','text-green-700'); renderProducts(); });

  // tabs
  els.tabButtons?.forEach(btn=>btn.addEventListener('click',()=>{
    const tab = btn.getAttribute('data-tab');
    if (tab==='favorites') { notify('Favorites coming soon', 'warning'); return; }
    state.tab = tab;
    els.tabButtons.forEach(b=>b.classList.toggle('border-green-600', b===btn));
    els.tabButtons.forEach(b=>b.classList.toggle('text-green-700', b===btn));
    els.tabButtons.forEach(b=>b.classList.toggle('border-transparent', b!==btn));
    els.tabButtons.forEach(b=>b.classList.toggle('text-gray-600', b!==btn));
    state.page = 1;
    loadProducts();
  }));

  // pagination
  els.prevPage?.addEventListener('click', ()=>{ if (state.page>1){ state.page--; renderProducts(); updateCountsAndPagination(); } });
  els.nextPage?.addEventListener('click', ()=>{ state.page++; renderProducts(); updateCountsAndPagination(); });

  // location
  els.useLocationBtn?.addEventListener('click', ()=>{
    if (!navigator.geolocation){ notify('Geolocation not supported', 'error'); return; }
    navigator.geolocation.getCurrentPosition((pos)=>{
      setPersistedLocation(pos.coords.latitude, pos.coords.longitude);
      els.locationText && (els.locationText.textContent = `Using current location: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
      state.page = 1; loadProducts();
    }, (err)=>{ console.error(err); notify('Unable to access location', 'error'); });
  });
  els.setLocationBtn?.addEventListener('click', ()=>{
    const lat = Number(prompt('Enter latitude:', '')); const lng = Number(prompt('Enter longitude:', ''));
    if (Number.isFinite(lat)&&Number.isFinite(lng)){ setPersistedLocation(lat,lng); els.locationText && (els.locationText.textContent = `Using chosen location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`); state.page=1; loadProducts(); }
  });

  // cart
  els.clearCartBtn?.addEventListener('click', ()=>{ cart.clear(); notify('Cart cleared','success'); });
  els.checkoutBtn?.addEventListener('click', ()=>{ if (!cart.items.length) return; notify('Proceeding to checkout...','info'); window.location.href = '/apps/client/grocery/local-market-checkout.html'; });
}

async function init(){
  try {
    cart.load();
    wireEvents();
    // set initial location label
    const loc = getPersistedLocation();
    if (loc && els.locationText) els.locationText.textContent = `Using location: ${Number(loc.lat).toFixed(4)}, ${Number(loc.lng).toFixed(4)}`;
    await Promise.allSettled([loadProfile(), loadCategories()]);
    await loadProducts();
    notify('Welcome to Local Market', 'success');
  } catch (e) {
    console.error(e);
    notify('Something went wrong initializing the page', 'error');
  }
}

init();