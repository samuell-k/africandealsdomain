// Pickup Delivery Dashboard Functions
function showOrderDetailsModal(order) {
    var modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    
    var orderStatus = order && order.status ? order.status : 'Unknown';
    var orderStatusClass = orderStatus.toLowerCase().replace(/\s+/g, '_');
    var orderId = order && order.id ? order.id : 'N/A';
    var buyerName = order && order.buyer_name ? order.buyer_name : 'N/A';
    var buyerEmail = order && order.buyer_email ? order.buyer_email : '';
    var buyerPhone = order && order.buyer_phone ? order.buyer_phone : '';
    var currency = order && order.currency ? order.currency : 'USD';
    var totalAmount = order && order.total_amount ? order.total_amount : '0.00';
    var deliveryAddress = order && order.delivery_address ? order.delivery_address : 'Not specified';
    
    var itemsHtml = '';
    if (order && order.items && order.items.length > 0) {
        for (var i = 0; i < order.items.length; i++) {
            var item = order.items[i];
            var productName = item.product_name || 'Unknown Product';
            var quantity = item.quantity || 1;
            var price = item.price || '0.00';
            
            itemsHtml += '<div class="flex justify-between items-center p-2 bg-gray-50 rounded">';
            itemsHtml += '<div>';
            itemsHtml += '<p class="font-medium">' + productName + '</p>';
            itemsHtml += '<p class="text-sm text-gray-600">Qty: ' + quantity + '</p>';
            itemsHtml += '</div>';
            itemsHtml += '<p class="font-semibold">' + currency + ' ' + price + '</p>';
            itemsHtml += '</div>';
        }
    }
    
    modal.innerHTML = '<div class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">' +
        '<div class="flex justify-between items-center mb-4">' +
        '<h3 class="text-xl font-bold">Order Details #' + orderId + '</h3>' +
        '<button onclick="this.closest(\'.fixed\').remove()" class="text-gray-500 hover:text-gray-700">' +
        '<i class="fas fa-times text-xl"></i>' +
        '</button>' +
        '</div>' +
        '<div class="space-y-4">' +
        '<div class="grid grid-cols-2 gap-4">' +
        '<div>' +
        '<p class="text-sm text-gray-600">Status</p>' +
        '<span class="status-badge status-' + orderStatusClass + ' px-3 py-1 rounded-full text-sm font-medium border">' +
        orderStatus +
        '</span>' +
        '</div>' +
        '<div>' +
        '<p class="text-sm text-gray-600">Total Amount</p>' +
        '<p class="font-semibold">' + currency + ' ' + totalAmount + '</p>' +
        '</div>' +
        '</div>' +
        '<div>' +
        '<p class="text-sm text-gray-600">Buyer Information</p>' +
        '<p class="font-semibold">' + buyerName + '</p>' +
        '<p class="text-sm text-gray-500">' + buyerEmail + '</p>' +
        '<p class="text-sm text-gray-500">' + buyerPhone + '</p>' +
        '</div>' +
        '<div>' +
        '<p class="text-sm text-gray-600">Delivery Address</p>' +
        '<p class="text-sm">' + deliveryAddress + '</p>' +
        '</div>' +
        '<div>' +
        '<p class="text-sm text-gray-600">Order Items</p>' +
        '<div class="space-y-2">' +
        itemsHtml +
        '</div>' +
        '</div>' +
        '<div class="flex justify-end space-x-2 pt-4 border-t">' +
        '<button onclick="this.closest(\'.fixed\').remove()" class="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400">' +
        'Close' +
        '</button>' +
        '</div>' +
        '</div>' +
        '</div>';
    
    document.body.appendChild(modal);
}

function refreshDashboard() {
    console.log('[PDA] Refreshing dashboard...');
    if (typeof loadDashboard === 'function') {
        loadDashboard();
    }
    if (typeof loadEnhancedOrders === 'function') {
        loadEnhancedOrders();
    }
}

function refreshAvailableOrders() {
    if (typeof loadAvailablePickups === 'function') {
        loadAvailablePickups();
    }
    showNotification('Available orders refreshed', 'info');
}

function refreshActiveOrders() {
    if (typeof loadActiveOrders === 'function') {
        loadActiveOrders();
    }
    showNotification('Active orders refreshed', 'info');
}

function refreshOrderHistory() {
    if (typeof loadOrderHistory === 'function') {
        loadOrderHistory();
    }
    showNotification('Order history refreshed', 'info');
}

function refreshEnhancedTracking() {
    if (typeof loadEnhancedOrders === 'function') {
        loadEnhancedOrders();
    }
    showNotification('Enhanced tracking refreshed', 'info');
}

function refreshConfirmations() {
    showNotification('Confirmations refreshed', 'info');
}

function showKeyboardShortcuts() {
    var modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = '<div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">' +
        '<div class="flex justify-between items-center mb-4">' +
        '<h3 class="text-xl font-bold">Keyboard Shortcuts</h3>' +
        '<button onclick="this.closest(\'.fixed\').remove()" class="text-gray-500 hover:text-gray-700">' +
        '<i class="fas fa-times text-xl"></i>' +
        '</button>' +
        '</div>' +
        '<div class="space-y-2">' +
        '<div class="flex justify-between">' +
        '<span>Switch to Available Orders</span>' +
        '<kbd class="px-2 py-1 bg-gray-100 rounded text-sm">Alt + 1</kbd>' +
        '</div>' +
        '<div class="flex justify-between">' +
        '<span>Switch to Active Orders</span>' +
        '<kbd class="px-2 py-1 bg-gray-100 rounded text-sm">Alt + 2</kbd>' +
        '</div>' +
        '<div class="flex justify-between">' +
        '<span>Switch to Enhanced View</span>' +
        '<kbd class="px-2 py-1 bg-gray-100 rounded text-sm">Alt + 3</kbd>' +
        '</div>' +
        '<div class="flex justify-between">' +
        '<span>Refresh Current Tab</span>' +
        '<kbd class="px-2 py-1 bg-gray-100 rounded text-sm">F5</kbd>' +
        '</div>' +
        '</div>' +
        '<div class="flex justify-end mt-4">' +
        '<button onclick="this.closest(\'.fixed\').remove()" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">' +
        'Close' +
        '</button>' +
        '</div>' +
        '</div>';
    
    document.body.appendChild(modal);
}

// Event listeners
document.addEventListener('keydown', function(event) {
    if (event.altKey) {
        switch (event.key) {
            case '1':
                event.preventDefault();
                if (typeof switchTab === 'function') {
                    switchTab('available');
                }
                break;
            case '2':
                event.preventDefault();
                if (typeof switchTab === 'function') {
                    switchTab('active');
                }
                break;
            case '3':
                event.preventDefault();
                if (typeof switchTab === 'function') {
                    switchTab('enhanced');
                }
                break;
        }
    }
    
    if (event.key === 'F5') {
        event.preventDefault();
        refreshDashboard();
    }
});

document.addEventListener('DOMContentLoaded', function() {
    console.log('[PDA] Dashboard initializing...');
    if (typeof initializeDashboard === 'function') {
        initializeDashboard();
    }
});