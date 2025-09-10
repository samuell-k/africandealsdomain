/*
  Local Market Referral/Share Tracking
  - Adds share controls to grocery product cards
  - Generates referral links using existing /api/referrals endpoints
  - Tracks referral clicks on landing (via ref param)
  - Updates referral session on add-to-cart
  
  Non-intrusive: This script augments the page without removing existing features.
*/
(function(){
  'use strict';

  // ===== Utilities =====
  function debugLog(...args) {
    if (window.__DEBUG_LOCAL_MARKET_REFERRALS__) console.debug('[LM-REF]', ...args);
  }

  function showToast(message, type = 'info') {
    if (typeof window.showNotification === 'function') {
      window.showNotification(message, type);
    } else {
      console.log(`[${type.toUpperCase()}]`, message);
    }
  }

  function getAuthToken() {
    return (
      localStorage.getItem('authToken') ||
      localStorage.getItem('token') ||
      ''
    );
  }

  async function makeAuthRequest(url, options = {}) {
    // Prefer global helper if available
    if (typeof window.makeAuthenticatedRequest === 'function') {
      return window.makeAuthenticatedRequest(url, options);
    }
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    const token = getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const fetchOptions = Object.assign({}, options, { headers });
    return fetch(url, fetchOptions);
  }

  function generateSessionId() {
    // Simple UUID v4-ish
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function getUrlParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  function buildPlatformShareUrl(platform, shareLink, shareText) {
    const encodedUrl = encodeURIComponent(shareLink);
    const encodedText = encodeURIComponent(shareText || 'Check this out');
    switch (platform) {
      case 'facebook': return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
      case 'twitter': return `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`;
      case 'whatsapp': return `https://wa.me/?text=${encodedText}%20${encodedUrl}`;
      case 'telegram': return `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
      case 'linkedin': return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
      case 'email': return `mailto:?subject=${encodedText}&body=${encodedText}%20${encodedUrl}`;
      case 'copy_link':
      default: return shareLink;
    }
  }

  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
      }
      showToast('Link copied to clipboard!', 'success');
    } catch (e) { showToast('Failed to copy link', 'error'); }
  }

  // Cache mapping: grocery_product_id (gp.id) -> main product id (products.id)
  const productIdMap = new Map();

  async function resolveMainProductId(groceryProductId) {
    if (productIdMap.has(groceryProductId)) return productIdMap.get(groceryProductId);
    try {
      const res = await fetch(`/api/grocery/product/${groceryProductId}`);
      const data = await res.json();
      if (data && data.success && data.product && data.product.product_id) {
        productIdMap.set(groceryProductId, data.product.product_id);
        return data.product.product_id;
      }
    } catch (e) {
      console.error('Error resolving main product id:', e);
    }
    return null;
  }

  // ===== Referral Share Generation =====
  async function generateShareLinkForGrocery(groceryProductId, platform = 'copy_link') {
    try {
      const mainProductId = await resolveMainProductId(groceryProductId);
      if (!mainProductId) {
        showToast('Unable to prepare share link (product not found)', 'error');
        return null;
      }

      // Create referral share via existing backend
      const response = await makeAuthRequest('/api/referrals/share-product', {
        method: 'POST',
        body: JSON.stringify({ product_id: mainProductId, platform })
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to generate share link');
      }

      const referralCode = result.referral_code;
      const localShareUrl = `${window.location.origin}${window.location.pathname}?id=${encodeURIComponent(groceryProductId)}&ref=${encodeURIComponent(referralCode)}`;

      // Prefer product info from response if available
      const name = (result.product && (result.product.name || result.product.product_name)) || 'Great product on ADD';
      const price = result.product && (result.product.price || result.product.unit_price);
      const shareText = price ? `${name} for ${price} RWF` : `${name}`;

      return { referralCode, localShareUrl, shareText };
    } catch (error) {
      console.error('Share generation error:', error);
      showToast('Could not generate share link', 'error');
      return null;
    }
  }

  async function handleShare(groceryProductId, platform) {
    const shareData = await generateShareLinkForGrocery(groceryProductId, platform);
    if (!shareData) return;

    const { localShareUrl, shareText } = shareData;

    if (platform === 'copy_link') {
      await copyToClipboard(localShareUrl);
      return;
    }

    // Try Web Share API first
    if (navigator.share && (platform === 'whatsapp' || platform === 'telegram')) {
      try {
        await navigator.share({ title: 'African Deals Domain', text: shareText, url: localShareUrl });
        return;
      } catch (e) { /* user canceled or unsupported */ }
    }

    // Fallback to platform-specific URL
    const platformUrl = buildPlatformShareUrl(platform, localShareUrl, shareText);
    window.open(platformUrl, '_blank');
  }

  // ===== UI Enhancements (non-intrusive) =====
  function enhanceProductCards(root = document) {
    // Look for elements representing product cards with data-product-id
    const cards = root.querySelectorAll('[data-product-id]:not([data-referral-enhanced])');
    cards.forEach(card => {
      card.setAttribute('data-referral-enhanced', '1');
      const groceryProductId = card.getAttribute('data-product-id');
      if (!groceryProductId) return;

      // Create minimal share controls
      const shareContainer = document.createElement('div');
      shareContainer.className = 'flex gap-2 mt-2';

      const btnClasses = 'px-2 py-1 text-xs rounded bg-green-100 text-green-700 hover:bg-green-200 transition-colors';

      const platforms = [
        { key: 'whatsapp', label: 'WhatsApp' },
        { key: 'telegram', label: 'Telegram' },
        { key: 'facebook', label: 'Facebook' },
        { key: 'twitter', label: 'Twitter' },
        { key: 'copy_link', label: 'Copy' }
      ];

      platforms.forEach(p => {
        const b = document.createElement('button');
        b.className = btnClasses;
        b.type = 'button';
        b.textContent = p.label;
        b.addEventListener('click', () => handleShare(groceryProductId, p.key));
        shareContainer.appendChild(b);
      });

      // Append into card footer/action area if present; else append at end
      const actionArea = card.querySelector('.product-actions') || card.querySelector('.actions') || card;
      actionArea.appendChild(shareContainer);
    });
  }

  function setupMutationObserver() {
    const observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1) { // element
            enhanceProductCards(node);
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ===== Referral Landing Tracking =====
  async function trackReferralLanding() {
    const referralCode = getUrlParam('ref');
    if (!referralCode) return; // nothing to track

    // Persist session id for subsequent actions
    let sessionId = sessionStorage.getItem('referral_session_id');
    if (!sessionId) {
      sessionId = generateSessionId();
      sessionStorage.setItem('referral_session_id', sessionId);
    }
    sessionStorage.setItem('referral_code', referralCode);

    const groceryIdParam = getUrlParam('id'); // grocery product id
    let mainProductId = null;

    if (groceryIdParam) {
      mainProductId = await resolveMainProductId(groceryIdParam);
      if (mainProductId) sessionStorage.setItem('referral_main_product_id', String(mainProductId));
    }

    try {
      // Track click (no auth required)
      const body = { referral_code: referralCode, market: 'local', session_id: sessionId };
      if (mainProductId) body.product_id = mainProductId;

      const res = await fetch('/api/referrals/track-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      debugLog('Track click response', data);
    } catch (e) {
      console.error('Failed to track referral click:', e);
    }
  }

  // ===== Add-to-cart Session Update Hook =====
  function hookAddToMenuForReferral() {
    if (!window.addToMenu || window.__LM_REF_HOOKED__) return;
    window.__LM_REF_HOOKED__ = true;

    const originalAddToMenu = window.addToMenu;
    window.addToMenu = async function(groceryProductId) {
      try {
        // Call original behavior first
        originalAddToMenu.apply(this, arguments);

        const sessionId = sessionStorage.getItem('referral_session_id');
        const referralCode = sessionStorage.getItem('referral_code');
        if (!sessionId || !referralCode) return; // no active referral session

        // Resolve main product id
        const mainProductId = await resolveMainProductId(groceryProductId);
        if (!mainProductId) return;

        // Update referral session engagement
        await fetch('/api/referrals/session/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            status: 'engaged',
            action: 'add_to_cart',
            product_id: mainProductId,
            quantity: 1
          })
        });
      } catch (e) {
        console.error('Referral session update failed:', e);
      }
    };
  }

  // ===== Init =====
  function init() {
    try {
      enhanceProductCards();
      setupMutationObserver();
      trackReferralLanding();
      hookAddToMenuForReferral();
      debugLog('Local Market referrals initialized');
    } catch (e) {
      console.error('Local Market referrals init error:', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();