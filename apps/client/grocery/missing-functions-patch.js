// Missing functions patch for local-market-home-signed.html
// This file contains all the missing functions that should be added to the main file

// Guard against duplicate global declarations
window.currentStoryData = window.currentStoryData || null;
window.currentPostId = window.currentPostId || null;

// Proceed to checkout function
window.proceedToCheckout = async function() {
  try {
    if (shoppingMenu.length === 0) {
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
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Choose Location on Map (Optional)</label>
            <div id="location-map" class="h-48 bg-gray-100 rounded-lg border border-gray-300 relative">
              <div class="absolute inset-0 flex items-center justify-center">
                <div class="text-center">
                  <i class="fas fa-map-marker-alt text-3xl text-gray-400 mb-2"></i>
                  <p class="text-sm text-gray-500">Click to select location</p>
                </div>
              </div>
            </div>
            <input type="hidden" id="selected-lat">
            <input type="hidden" id="selected-lng">
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
  
  // Initialize map for location selection
  setTimeout(() => {
    initLocationMap();
  }, 100);
  
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

// Initialize location selection map
function initLocationMap() {
  const mapContainer = document.getElementById('location-map');
  if (!mapContainer || typeof L === 'undefined') return;
  
  try {
    // Clear existing content
    mapContainer.innerHTML = '';
    
    // Create map
    const map = L.map('location-map').setView([-1.9441, 30.0619], 13); // Kigali center
    
    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    let marker = null;
    
    // Handle map clicks
    map.on('click', function(e) {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      
      // Remove existing marker
      if (marker) {
        map.removeLayer(marker);
      }
      
      // Add new marker
      marker = L.marker([lat, lng]).addTo(map);
      
      // Store coordinates
      document.getElementById('selected-lat').value = lat;
      document.getElementById('selected-lng').value = lng;
      
      showNotification('Location selected!', 'success');
    });
    
  } catch (error) {
    console.error('Error initializing location map:', error);
    mapContainer.innerHTML = `
      <div class="absolute inset-0 flex items-center justify-center">
        <div class="text-center">
          <i class="fas fa-exclamation-triangle text-3xl text-yellow-500 mb-2"></i>
          <p class="text-sm text-gray-500">Map unavailable</p>
        </div>
      </div>
    `;
  }
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
  const lat = document.getElementById('selected-lat').value;
  const lng = document.getElementById('selected-lng').value;
  
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
    coordinates: lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null,
    fullAddress: `${village}, ${sector}, ${district}, ${province}${detailedAddress ? ', ' + detailedAddress : ''}`
  };
}

// Show enhanced payment modal with app payment details
function showPaymentModal(deliveryInfo) {
  const total = shoppingMenu.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
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
              <span>Items (${shoppingMenu.length})</span>
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
            <div class="bg-white rounded-lg p-3 border border-blue-200">
              <div class="font-semibold text-blue-800 mb-1">Bank Transfer</div>
              <div class="text-gray-600">Bank of Kigali: 00012345678901</div>
              <div class="text-xs text-gray-500">Account: African Deals Domain Ltd</div>
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
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Payment Screenshot (Optional)</label>
            <input type="file" id="payment-screenshot" accept="image/*" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500">
            <p class="text-xs text-gray-500 mt-1">Upload a screenshot of your payment confirmation</p>
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

// Submit order with payment proof (no mock data)
async function submitOrderWithPayment(deliveryInfo, modal) {
  try {
    const submitBtn = modal.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Submitting...';
    submitBtn.disabled = true;
    
    // Collect payment data
    const paymentData = {
      payment_method: document.getElementById('payment-method').value,
      transaction_id: document.getElementById('transaction-id').value,
      payment_phone: document.getElementById('payment-phone').value,
      amount: document.getElementById('payment-amount').value,
      proof_image: null // File upload handling would go here
    };
    
    // Prepare order data
    const orderData = {
      items: shoppingMenu.map(item => ({
        product_id: item.id,
        product_name: item.name,
        quantity: item.quantity,
        price: item.price,
        seller_id: item.seller_id,
        seller_name: item.seller_name
      })),
      delivery_info: {
        delivery_address: deliveryInfo.fullAddress,
        buyer_name: deliveryInfo.fullName,
        buyer_phone: deliveryInfo.phone,
        emergency_contact: deliveryInfo.emergencyContact,
        province: deliveryInfo.province,
        district: deliveryInfo.district,
        sector: deliveryInfo.sector,
        village: deliveryInfo.village,
        detailed_address: deliveryInfo.detailedAddress,
        coordinates: deliveryInfo.coordinates
      },
      totals: {
        products_total: shoppingMenu.reduce((sum, item) => sum + (item.price * item.quantity), 0),
        platform_fee: 0,
        packaging_fee: 0,
        delivery_fee: 0,
        grand_total: shoppingMenu.reduce((sum, item) => sum + (item.price * item.quantity), 0)
      }
    };
    
    // Submit order to backend
    const token = localStorage.getItem('token');
    const orderResponse = await fetch('/api/local-market-orders/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(orderData)
    });
    
    if (!orderResponse.ok) {
      throw new Error('Failed to create order');
    }
    
    const orderResult = await orderResponse.json();
    const orderId = orderResult.order_id;
    
    // Submit payment proof
    const paymentResponse = await fetch(`/api/local-market-orders/orders/${orderId}/payment-proof`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(paymentData)
    });
    
    if (!paymentResponse.ok) {
      throw new Error('Failed to submit payment proof');
    }
    
    // Process referral commissions if applicable
    await processReferralCommissions(orderId, orderData.totals.grand_total);
    
    // Clear shopping menu
    shoppingMenu.length = 0;
    renderMenu();
    
    // Close modal and show success
    modal.remove();
    showOrderSuccessModal(orderId);
    
  } catch (error) {
    console.error('Error submitting order:', error);
    showNotification('Error submitting order: ' + error.message, 'error');
    
    // Reset button
    const submitBtn = modal.querySelector('button[type="submit"]');
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
  }
}

// Process referral commissions for share & earn
async function processReferralCommissions(orderId, orderAmount) {
  try {
    const referralCode = localStorage.getItem('referral_code') || sessionStorage.getItem('referral_code');
    if (!referralCode) return;
    
    const token = localStorage.getItem('token');
    await fetch('/api/referrals/process-order-commission', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        referral_code: referralCode,
        order_id: orderId,
        order_amount: orderAmount,
        marketplace_type: 'local_grocery'
      })
    });
    
  } catch (error) {
    console.error('Error processing referral commission:', error);
    // Don't fail the order if referral processing fails
  }
}

// Show order success modal
function showOrderSuccessModal(orderId) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl max-w-md w-full text-center p-8">
      <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <i class="fas fa-check text-3xl text-green-600"></i>
      </div>
      <h3 class="text-2xl font-bold text-gray-800 mb-4">Order Submitted!</h3>
      <p class="text-gray-600 mb-6">Your order <strong>${orderId}</strong> has been submitted successfully. An agent will contact you shortly to confirm and arrange delivery.</p>
      <div class="space-y-3">
        <button onclick="showMyOrders(); this.closest('.fixed').remove();" class="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-medium">
          <i class="fas fa-receipt mr-2"></i>
          View My Orders
        </button>
        <button onclick="this.closest('.fixed').remove()" class="w-full border border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50 font-medium">
          Continue Shopping
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
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
        <button onclick="shareToTwitter('${productId}', '${productName}')" class="w-full flex items-center justify-center gap-3 bg-blue-400 text-white py-3 rounded-lg hover:bg-blue-500">
          <i class="fab fa-twitter text-xl"></i>
          Share on Twitter
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

// Share to WhatsApp
window.shareToWhatsApp = async function(productId, productName) {
  const shareUrl = await generateShareUrl(productId, 'whatsapp');
  const message = `Check out this amazing product: ${productName} on African Deals Domain Local Market! 🛒✨ ${shareUrl}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
};

// Share to Facebook
window.shareToFacebook = async function(productId, productName) {
  const shareUrl = await generateShareUrl(productId, 'facebook');
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
};

// Share to Twitter
window.shareToTwitter = async function(productId, productName) {
  const shareUrl = await generateShareUrl(productId, 'twitter');
  const message = `Check out ${productName} on African Deals Domain Local Market! 🛒`;
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
};

// Copy share link
window.copyShareLink = async function(productId, productName) {
  const shareUrl = await generateShareUrl(productId, 'copy_link');
  try {
    await navigator.clipboard.writeText(shareUrl);
    showNotification('Share link copied to clipboard!', 'success');
  } catch (error) {
    console.error('Error copying to clipboard:', error);
    showNotification('Error copying link', 'error');
  }
};

// Generate share URL with referral code
async function generateShareUrl(productId, platform) {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/referrals/generate-product-share', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        product_id: productId,
        share_platform: platform,
        marketplace_type: 'local_grocery'
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to generate share URL');
    }
    
    const result = await response.json();
    return result.share_url;
    
  } catch (error) {
    console.error('Error generating share URL:', error);
    // Fallback URL
    return `${window.location.origin}/grocery/local-market-home-signed.html?product=${productId}&ref=share`;
  }
}

// Location modal functions
window.openLocationSettings = function() {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl max-w-md w-full p-6">
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-xl font-bold text-gray-800">Location Settings</h3>
        <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600">
          <i class="fas fa-times text-xl"></i>
        </button>
      </div>
      
      <div class="space-y-4">
        <button onclick="getCurrentLocation(); this.closest('.fixed').remove();" class="w-full flex items-center gap-3 p-4 border border-gray-300 rounded-lg hover:bg-gray-50">
          <i class="fas fa-crosshairs text-green-600"></i>
          <div class="text-left">
            <div class="font-medium">Use Current Location</div>
            <div class="text-sm text-gray-500">Automatically detect your location</div>
          </div>
        </button>
        
        <button onclick="showManualLocationInput(); this.closest('.fixed').remove();" class="w-full flex items-center gap-3 p-4 border border-gray-300 rounded-lg hover:bg-gray-50">
          <i class="fas fa-map-marker-alt text-blue-600"></i>
          <div class="text-left">
            <div class="font-medium">Enter Manually</div>
            <div class="text-sm text-gray-500">Type your address</div>
          </div>
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
};

// Get current location
window.getCurrentLocation = function() {
  if (!navigator.geolocation) {
    showNotification('Geolocation is not supported by this browser', 'error');
    return;
  }
  
  const locationIndicator = document.getElementById('location-indicator');
  locationIndicator.innerHTML = '<i class="fas fa-spinner loading-spinner mr-1"></i>Getting location...';
  
  navigator.geolocation.getCurrentPosition(
    function(position) {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      
      // Reverse geocode to get address
      reverseGeocode(lat, lng);
    },
    function(error) {
      console.error('Error getting location:', error);
      locationIndicator.innerHTML = '<i class="fas fa-exclamation-triangle mr-1"></i>Location unavailable';
      showNotification('Unable to get your location', 'error');
    }
  );
};

// Reverse geocode coordinates to address
async function reverseGeocode(lat, lng) {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
    const data = await response.json();
    
    const address = data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    const locationIndicator = document.getElementById('location-indicator');
    locationIndicator.innerHTML = `<i class="fas fa-map-marker-alt mr-1"></i>${address.substring(0, 50)}...`;
    
    // Store coordinates
    localStorage.setItem('user_location', JSON.stringify({ lat, lng, address }));
    
    showNotification('Location updated successfully!', 'success');
    
  } catch (error) {
    console.error('Error reverse geocoding:', error);
    const locationIndicator = document.getElementById('location-indicator');
    locationIndicator.innerHTML = `<i class="fas fa-map-marker-alt mr-1"></i>${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

console.log('Missing functions patch loaded successfully');