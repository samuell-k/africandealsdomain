/*
  Local Market Product Detail Modal
  - Adds a modal to view grocery product details without leaving the page
  - Non-intrusive: uses window.allProducts and existing addToMenu
  - Automatically wires up buttons with class .view-details-btn and data-product-id
*/
(function(){
  'use strict';

  function debug(...args){ if(window.location.search.includes('debug=true')) console.debug('[LM-MODAL]', ...args); }

  function findProductById(groceryId){
    if (!window.allProducts || !Array.isArray(window.allProducts)) return null;
    return window.allProducts.find(p => String(p.id) === String(groceryId));
  }

  function closeModal(modal){
    try {
      const el = modal && modal.nodeType ? modal : document.getElementById('lm-product-detail-modal');
      if (el) el.remove();
    } catch (e) { /* ignore */ }
  }

  function buildDetailRow(label, value){
    return `<div class="flex justify-between text-sm"><span class="text-gray-600">${label}</span><span class="font-medium">${value}</span></div>`;
  }

  function createProductDetailModal(product){
    const modal = document.createElement('div');
    modal.id = 'lm-product-detail-modal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';

    const price = Number(product.price_per_unit || product.unit_price || product.price || 0) || 0;
    const stock = Number(product.stock_quantity || product.available_stock || product.stock || 0) || 0;
    const unit = product.unit_type || product.unit || 'unit';

    modal.innerHTML = `
      <div class="bg-white rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl">
        <div class="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 class="text-2xl font-bold text-gray-800">${product.product_name || product.name || 'Product Details'}</h2>
          <button class="text-gray-500 hover:text-gray-700 text-2xl" data-close>&times;</button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
          <div>
            <img src="${product.main_image || '/public/images/placeholder-product.jpg'}" alt="${product.product_name || ''}" class="w-full h-64 object-cover rounded-lg">
          </div>
          <div class="space-y-3">
            <p class="text-sm text-gray-600">${product.description || 'No description available'}</p>
            <div class="bg-gray-50 p-4 rounded-lg space-y-2">
              ${buildDetailRow('Price', `${price.toLocaleString()} RWF / ${unit}`)}
              ${buildDetailRow('Available', `${stock} ${unit}`)}
              ${buildDetailRow('Category', product.category || product.category_name || 'Uncategorized')}
              ${buildDetailRow('Seller', product.seller_name || 'Unknown Seller')}
            </div>
            <div class="flex items-center gap-2">
              <label class="text-sm font-medium">Qty:</label>
              <input id="lm-modal-qty" type="number" min="1" value="1" max="${stock}" class="w-24 border border-gray-300 rounded-lg p-2 text-center focus:ring-2 focus:ring-green-500">
              <span class="text-sm text-gray-600">${unit}</span>
            </div>
            <div class="flex gap-3">
              <button id="lm-add-to-menu" class="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition-colors shadow-lg">
                <i class="fas fa-plus mr-2"></i>Add to Menu
              </button>
              <button id="lm-share-btn" class="px-4 py-3 rounded-xl bg-green-100 text-green-700 hover:bg-green-200">
                <i class="fas fa-share-alt"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    modal.addEventListener('click', (e)=>{
      if (e.target === modal || e.target.hasAttribute('data-close')) closeModal(modal);
    });

    // Wire up add to menu
    modal.querySelector('#lm-add-to-menu').addEventListener('click', ()=>{
      try {
        const qtyEl = modal.querySelector('#lm-modal-qty');
        const val = parseInt(qtyEl.value) || 1;
        // Set page qty input so existing addToMenu reads it
        const pageQty = document.getElementById(`qty-${product.id}`);
        if (pageQty) pageQty.value = String(val);
        if (typeof window.addToMenu === 'function') window.addToMenu(String(product.id));
      } catch (e) { debug('Add to menu from modal failed', e); }
    });

    // Share button (delegates to referrals script if available)
    modal.querySelector('#lm-share-btn').addEventListener('click', ()=>{
      try {
        // local-market-referrals.js exposes share via handleShare if attached to buttons in card
        // Here we simulate by clicking first share btn inside the card if present
        const card = document.querySelector(`[data-product-id="${product.id}"]`);
        const shareBtn = card && card.querySelector('.product-actions button');
        if (shareBtn) shareBtn.click();
      } catch(e){ debug('Share from modal failed', e); }
    });

    document.body.appendChild(modal);
  }

  function openProductModalById(groceryId){
    const product = findProductById(groceryId);
    if (!product) return;
    createProductDetailModal(product);
  }

  function ensureCardAttributesAndButtons(root=document){
    // For each product card, ensure data-product-id exists and inject a View Details button
    root.querySelectorAll('.product-card:not([data-lm-aug])').forEach(card => {
      card.setAttribute('data-lm-aug','1');

      // Try to infer product id from qty input id pattern: qty-<id>
      let productId = null;
      const qtyInput = card.querySelector('input[id^="qty-"]');
      if (qtyInput) {
        const m = qtyInput.id.match(/^qty-(.+)$/);
        if (m) productId = m[1];
      }

      if (productId) {
        card.setAttribute('data-product-id', String(productId));
      }

      // Inject a button if not present
      if (!card.querySelector('.view-details-btn')) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'view-details-btn w-full mt-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 font-semibold py-2 rounded-xl transition-colors';
        btn.textContent = 'View details';
        btn.setAttribute('data-product-id', productId || '');

        // Prefer placing above Add to Menu button
        const addBtn = Array.from(card.querySelectorAll('button')).find(b => /add to menu/i.test(b.textContent || ''));
        if (addBtn && addBtn.parentElement) {
          addBtn.parentElement.insertBefore(btn, addBtn);
        } else {
          card.appendChild(btn);
        }
      }
    });
  }

  function attachHandlers(root=document){
    ensureCardAttributesAndButtons(root);

    // Buttons rendered by the page or injected above
    root.querySelectorAll('.view-details-btn[data-product-id]:not([data-lm-mdl])').forEach(btn => {
      btn.setAttribute('data-lm-mdl','1');
      btn.addEventListener('click', ()=> openProductModalById(btn.getAttribute('data-product-id')));
    });

    // Also enable clicking image to open modal
    root.querySelectorAll('[data-product-id] img:not([data-lm-mdl])').forEach(img => {
      img.setAttribute('data-lm-mdl','1');
      const card = img.closest('[data-product-id]');
      if (!card) return;
      img.style.cursor = 'pointer';
      img.addEventListener('click', ()=> openProductModalById(card.getAttribute('data-product-id')));
    });
  }

  const observer = new MutationObserver(muts => muts.forEach(m => m.addedNodes.forEach(n => {
    if (n.nodeType === 1) attachHandlers(n);
  })));

  function init(){
    try {
      attachHandlers();
      observer.observe(document.body, { childList: true, subtree: true });
      window.openGroceryProductModal = openProductModalById; // optional global
    } catch (e) { debug('init error', e); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();