/**
 * Enhanced Pickup Delivery Agent Dashboard JavaScript
 * Complete functionality for PDA dashboard with backend integration
 */

// Configuration
const API_BASE_URL = window.location.origin;
const REFRESH_INTERVAL = 30000; // 30 seconds

// Global variables
let currentTab = 'available';
let autoRefreshInterval = null;
let socket = null;
let agentData = null;

// Initialize dashboard
async function initializeDashboard() {
    console.log('[PDA] Initializing dashboard...');
    
    try {
        // Check authentication
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        if (!token) {
            throw new Error('No authentication token found');
        }

        // Load agent profile
        await loadAgentProfile();
        
        // Load initial data
        await loadDashboardStats();
        await loadAvailableOrders();
        
        // Initialize Socket.IO
        initializeSocket();
        
        // Set up auto-refresh
        setupAutoRefresh();
        
        console.log('[PDA] Dashboard initialized successfully');
        showNotification('Dashboard loaded successfully', 'success');
        
    } catch (error) {
        console.error('[PDA] Dashboard initialization failed:', error);
        showNotification('Failed to load dashboard: ' + error.message, 'error');
        
        // Redirect to login if authentication failed
        if (error.message.includes('token') || error.message.includes('auth')) {
            setTimeout(() => {
                window.location.href = '/auth/auth-agent.html';
            }, 2000);
        }
    }
}

// Load agent profile
async function loadAgentProfile() {
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/api/pickup-delivery-agent/profile`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load agent profile');
        }

        const data = await response.json();
        if (data.success) {
            agentData = data.profile;
            updateAgentInfo(agentData);
        } else {
            throw new Error(data.error || 'Failed to load profile');
        }
    } catch (error) {
        console.error('[PDA] Error loading agent profile:', error);
        throw error;
    }
}

// Update agent info in UI
function updateAgentInfo(agent) {
    const elements = {
        'agent-name': agent.name || 'Unknown Agent',
        'agent-email': agent.email || 'No email',
        'agent-phone': agent.phone || 'No phone',
        'agent-rating': (agent.rating_stats?.average_rating || 0).toFixed(1),
        'agent-initials': getInitials(agent.name || 'PD')
    };

    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    });

    // Update status indicator
    const statusIndicator = document.getElementById('status-indicator');
    const agentStatus = document.getElementById('agent-status');
    if (statusIndicator && agentStatus) {
        if (agent.status === 'active') {
            statusIndicator.className = 'w-3 h-3 bg-green-500 rounded-full pulse-dot';
            agentStatus.textContent = 'Online';
        } else {
            statusIndicator.className = 'w-3 h-3 bg-red-500 rounded-full pulse-dot';
            agentStatus.textContent = 'Offline';
        }
    }
}

// Load dashboard statistics
async function loadDashboardStats() {
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/api/pickup-delivery-agent/stats`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load statistics');
        }

        const data = await response.json();
        if (data.success) {
            updateStatsCards(data.stats);
        } else {
            throw new Error(data.error || 'Failed to load stats');
        }
    } catch (error) {
        console.error('[PDA] Error loading stats:', error);
        showNotification('Failed to load statistics', 'error');
    }
}

// Update stats cards
function updateStatsCards(stats) {
    const updates = {
        'total-pickups': stats.today?.total || 0,
        'completed-pickups': stats.today?.completed || 0,
        'active-pickups': stats.active?.count || 0,
        'today-earnings': `${stats.today?.earnings || 0} FRW`
    };

    Object.entries(updates).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    });
}

// Load available orders
async function loadAvailableOrders() {
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/api/pickup-delivery-agent/available-orders`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load available orders');
        }

        const data = await response.json();
        if (data.success) {
            displayAvailableOrders(data.orders);
        } else {
            throw new Error(data.error || 'Failed to load orders');
        }
    } catch (error) {
        console.error('[PDA] Error loading available orders:', error);
        displayError('available-pickups-list', 'Failed to load available orders');
    }
}

// Load active orders
async function loadActiveOrders() {
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/api/pickup-delivery-agent/active-orders`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load active orders');
        }

        const data = await response.json();
        if (data.success) {
            displayActiveOrders(data.orders);
        } else {
            throw new Error(data.error || 'Failed to load active orders');
        }
    } catch (error) {
        console.error('[PDA] Error loading active orders:', error);
        displayError('active-pickups-list', 'Failed to load active orders');
    }
}

// Load order history
async function loadOrderHistory() {
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/api/pickup-delivery-agent/order-history`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load order history');
        }

        const data = await response.json();
        if (data.success) {
            displayOrderHistory(data.orders, data.pagination);
        } else {
            throw new Error(data.error || 'Failed to load order history');
        }
    } catch (error) {
        console.error('[PDA] Error loading order history:', error);
        displayError('history-pickups-list', 'Failed to load order history');
    }
}

// Display available orders
function displayAvailableOrders(orders) {
    const container = document.getElementById('available-pickups-list');
    if (!container) return;

    if (orders.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-inbox text-4xl text-gray-300 mb-4"></i>
                <p class="text-gray-600">No available orders at the moment</p>
                <button onclick="refreshAvailableOrders()" class="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                    <i class="fas fa-refresh mr-2"></i>Refresh
                </button>
            </div>
        `;
        return;
    }

    const ordersHtml = orders.map(order => `
        <div class="order-card bg-white border border-gray-200 rounded-lg p-6 mb-4">
            <div class="flex justify-between items-start mb-4">
                <div>
                    <h4 class="text-lg font-semibold text-gray-900">Order #${order.id}</h4>
                    <p class="text-sm text-gray-600">${formatDate(order.created_at)}</p>
                </div>
                <div class="text-right">
                    <p class="text-lg font-bold text-green-600">${order.currency || 'FRW'} ${order.total_amount}</p>
                    <span class="status-badge status-${order.status.toLowerCase()} px-3 py-1 rounded-full text-sm font-medium border">
                        ${order.status}
                    </span>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                    <p class="text-sm text-gray-600">Buyer</p>
                    <p class="font-medium">${order.buyer_name || 'Unknown'}</p>
                    <p class="text-sm text-gray-500">${order.buyer_phone || ''}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Delivery Address</p>
                    <p class="text-sm">${order.delivery_address || 'Not specified'}</p>
                </div>
            </div>
            
            <div class="flex justify-between items-center">
                <button onclick="viewOrderDetails(${order.id})" class="text-blue-600 hover:text-blue-800 text-sm">
                    <i class="fas fa-eye mr-1"></i>View Details
                </button>
                <button onclick="acceptOrder(${order.id})" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm">
                    <i class="fas fa-check mr-2"></i>Accept Order
                </button>
            </div>
        </div>
    `).join('');

    container.innerHTML = ordersHtml;
}

// Display active orders
function displayActiveOrders(orders) {
    const container = document.getElementById('active-pickups-list');
    if (!container) return;

    if (orders.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-clipboard-list text-4xl text-gray-300 mb-4"></i>
                <p class="text-gray-600">No active orders</p>
            </div>
        `;
        return;
    }

    const ordersHtml = orders.map(order => `
        <div class="order-card bg-white border border-gray-200 rounded-lg p-6 mb-4">
            <div class="flex justify-between items-start mb-4">
                <div>
                    <h4 class="text-lg font-semibold text-gray-900">Order #${order.id}</h4>
                    <p class="text-sm text-gray-600">${formatDate(order.created_at)}</p>
                </div>
                <div class="text-right">
                    <p class="text-lg font-bold text-green-600">${order.currency || 'FRW'} ${order.total_amount}</p>
                    <span class="status-badge status-${order.status.toLowerCase()} px-3 py-1 rounded-full text-sm font-medium border">
                        ${order.status}
                    </span>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                    <p class="text-sm text-gray-600">Buyer</p>
                    <p class="font-medium">${order.buyer_name || 'Unknown'}</p>
                    <p class="text-sm text-gray-500">${order.buyer_phone || ''}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Items</p>
                    <p class="text-sm">${order.items_summary || 'No items'}</p>
                </div>
            </div>
            
            <div class="flex justify-between items-center">
                <div class="flex space-x-2">
                    <button onclick="viewOrderDetails(${order.id})" class="text-blue-600 hover:text-blue-800 text-sm">
                        <i class="fas fa-eye mr-1"></i>Details
                    </button>
                    <button onclick="sendMessage(${order.id})" class="text-green-600 hover:text-green-800 text-sm">
                        <i class="fas fa-message mr-1"></i>Message
                    </button>
                </div>
                <div class="flex space-x-2">
                    ${getStatusActionButtons(order)}
                </div>
            </div>
        </div>
    `).join('');

    container.innerHTML = ordersHtml;
}

// Display order history
function displayOrderHistory(orders, pagination) {
    const container = document.getElementById('history-pickups-list');
    if (!container) return;

    if (orders.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-history text-4xl text-gray-300 mb-4"></i>
                <p class="text-gray-600">No order history</p>
            </div>
        `;
        return;
    }

    const ordersHtml = orders.map(order => `
        <div class="order-card bg-white border border-gray-200 rounded-lg p-6 mb-4">
            <div class="flex justify-between items-start mb-4">
                <div>
                    <h4 class="text-lg font-semibold text-gray-900">Order #${order.id}</h4>
                    <p class="text-sm text-gray-600">Completed: ${formatDate(order.updated_at)}</p>
                </div>
                <div class="text-right">
                    <p class="text-lg font-bold text-green-600">${order.currency || 'FRW'} ${order.total_amount}</p>
                    <span class="status-badge status-${order.status.toLowerCase()} px-3 py-1 rounded-full text-sm font-medium border">
                        ${order.status}
                    </span>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                    <p class="text-sm text-gray-600">Buyer</p>
                    <p class="font-medium">${order.buyer_name || 'Unknown'}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Commission Earned</p>
                    <p class="font-medium text-green-600">${order.agent_commission || 0} FRW</p>
                </div>
            </div>
            
            <div class="flex justify-between items-center">
                <button onclick="viewOrderDetails(${order.id})" class="text-blue-600 hover:text-blue-800 text-sm">
                    <i class="fas fa-eye mr-1"></i>View Details
                </button>
            </div>
        </div>
    `).join('');

    container.innerHTML = ordersHtml;

    // Add pagination if needed
    if (pagination && pagination.totalPages > 1) {
        const paginationHtml = createPaginationHtml(pagination);
        container.innerHTML += paginationHtml;
    }
}

// Get status action buttons
function getStatusActionButtons(order) {
    const status = order.status;
    
    switch (status) {
        case 'ASSIGNED_TO_PDA':
            return `<button onclick="updateOrderStatus(${order.id}, 'PDA_EN_ROUTE_TO_SELLER')" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm">
                        <i class="fas fa-route mr-1"></i>En Route to Seller
                    </button>`;
        
        case 'PDA_EN_ROUTE_TO_SELLER':
            return `<button onclick="updateOrderStatus(${order.id}, 'PDA_AT_SELLER')" class="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-sm">
                        <i class="fas fa-map-marker-alt mr-1"></i>Arrived at Seller
                    </button>`;
        
        case 'PDA_AT_SELLER':
            return `<button onclick="updateOrderStatus(${order.id}, 'PICKED_FROM_SELLER')" class="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-sm">
                        <i class="fas fa-box mr-1"></i>Picked from Seller
                    </button>`;
        
        case 'PICKED_FROM_SELLER':
            return `<button onclick="updateOrderStatus(${order.id}, 'EN_ROUTE_TO_PSM')" class="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm">
                        <i class="fas fa-truck mr-1"></i>En Route to PSM
                    </button>`;
        
        case 'EN_ROUTE_TO_PSM':
            return `<button onclick="updateOrderStatus(${order.id}, 'DELIVERED_TO_PSM')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-sm">
                        <i class="fas fa-warehouse mr-1"></i>Delivered to PSM
                    </button>`;
        
        case 'DELIVERED_TO_PSM':
            return `<button onclick="updateOrderStatus(${order.id}, 'READY_FOR_PICKUP')" class="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm">
                        <i class="fas fa-bell mr-1"></i>Ready for Pickup
                    </button>`;
        
        default:
            return '';
    }
}

// Accept order
async function acceptOrder(orderId) {
    if (!confirm('Accept this order? You will be responsible for picking it up from the seller.')) {
        return;
    }

    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/api/pickup-delivery-agent/orders/${orderId}/accept`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                notes: 'Order accepted by PDA agent'
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to accept order');
        }

        const data = await response.json();
        if (data.success) {
            showNotification('Order accepted successfully!', 'success');
            await refreshCurrentTab();
        } else {
            throw new Error(data.error || 'Failed to accept order');
        }
    } catch (error) {
        console.error('[PDA] Error accepting order:', error);
        showNotification('Failed to accept order: ' + error.message, 'error');
    }
}

// Update order status
async function updateOrderStatus(orderId, newStatus, notes = '') {
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        
        // Get current location if available
        let location = null;
        if (navigator.geolocation) {
            try {
                const position = await getCurrentPosition();
                location = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                };
            } catch (e) {
                console.log('[PDA] Could not get location:', e);
            }
        }

        const response = await fetch(`${API_BASE_URL}/api/pickup-delivery-agent/orders/${orderId}/update-status`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: newStatus,
                notes: notes,
                location: location
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update order status');
        }

        const data = await response.json();
        if (data.success) {
            showNotification('Order status updated successfully!', 'success');
            await refreshCurrentTab();
        } else {
            throw new Error(data.error || 'Failed to update order status');
        }
    } catch (error) {
        console.error('[PDA] Error updating order status:', error);
        showNotification('Failed to update order status: ' + error.message, 'error');
    }
}

// Send message
async function sendMessage(orderId) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 class="text-lg font-semibold mb-4">Send Message</h3>
            
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Recipient</label>
                    <select id="recipient-type" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                        <option value="buyer">Buyer</option>
                        <option value="seller">Seller</option>
                    </select>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Message</label>
                    <textarea id="message-content" rows="4" class="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="Type your message here..."></textarea>
                </div>
            </div>
            
            <div class="flex space-x-3 mt-6">
                <button onclick="submitMessage(${orderId})" class="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                    Send Message
                </button>
                <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50">
                    Cancel
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Submit message
async function submitMessage(orderId) {
    const recipientType = document.getElementById('recipient-type').value;
    const messageContent = document.getElementById('message-content').value.trim();
    
    if (!messageContent) {
        showNotification('Please enter a message', 'error');
        return;
    }

    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/api/pickup-delivery-agent/send-message`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                order_id: orderId,
                recipient_type: recipientType,
                message: messageContent,
                message_type: 'text'
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to send message');
        }

        const data = await response.json();
        if (data.success) {
            showNotification('Message sent successfully!', 'success');
            document.querySelector('.fixed').remove();
        } else {
            throw new Error(data.error || 'Failed to send message');
        }
    } catch (error) {
        console.error('[PDA] Error sending message:', error);
        showNotification('Failed to send message: ' + error.message, 'error');
    }
}

// View order details
function viewOrderDetails(orderId) {
    // This would typically open a modal or navigate to a details page
    // For now, we'll show a simple notification
    showNotification(`Loading details for order #${orderId}...`, 'info');
    
    // You could implement a detailed modal here or navigate to a separate page
    // window.location.href = `/agent/order-details.html?id=${orderId}`;
}

// Tab switching
function switchTab(tabName) {
    // Update active tab
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`tab-${tabName}`).classList.add('active');

    // Show/hide tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    document.getElementById(`${tabName}-orders-tab`).classList.remove('hidden');

    currentTab = tabName;
    
    // Load tab data
    loadTabData(tabName);
}

// Load tab data
async function loadTabData(tabName) {
    switch (tabName) {
        case 'available':
            await loadAvailableOrders();
            break;
        case 'active':
            await loadActiveOrders();
            break;
        case 'history':
            await loadOrderHistory();
            break;
        case 'settings':
            // Load settings if needed
            break;
    }
}

// Refresh functions
async function refreshCurrentTab() {
    await loadDashboardStats();
    await loadTabData(currentTab);
}

async function refreshAvailableOrders() {
    await loadAvailableOrders();
    showNotification('Available orders refreshed', 'info');
}

async function refreshActiveOrders() {
    await loadActiveOrders();
    showNotification('Active orders refreshed', 'info');
}

async function refreshOrderHistory() {
    await loadOrderHistory();
    showNotification('Order history refreshed', 'info');
}

// Initialize Socket.IO
function initializeSocket() {
    try {
        if (typeof io !== 'undefined') {
            socket = io();
            
            socket.on('connect', () => {
                console.log('[PDA] Socket.IO connected');
                
                // Join agent room
                if (agentData) {
                    socket.emit('user:login', {
                        id: agentData.user_id,
                        name: agentData.name,
                        role: 'agent'
                    });
                }
            });

            socket.on('disconnect', () => {
                console.log('[PDA] Socket.IO disconnected');
            });

            socket.on('order_status_update', (data) => {
                console.log('[PDA] Order status update received:', data);
                refreshCurrentTab();
                showNotification(`Order #${data.order_id} status updated`, 'info');
            });

            socket.on('new_message', (data) => {
                console.log('[PDA] New message received:', data);
                showNotification('New message received', 'info');
            });
        }
    } catch (error) {
        console.error('[PDA] Socket.IO initialization failed:', error);
    }
}

// Setup auto-refresh
function setupAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    
    autoRefreshInterval = setInterval(() => {
        refreshCurrentTab();
    }, REFRESH_INTERVAL);
}

// Utility functions
function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

function getCurrentPosition() {
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000
        });
    });
}

function displayError(containerId, message) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-exclamation-triangle text-4xl text-red-300 mb-4"></i>
                <p class="text-red-600">${message}</p>
                <button onclick="refreshCurrentTab()" class="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg">
                    <i class="fas fa-refresh mr-2"></i>Retry
                </button>
            </div>
        `;
    }
}

function createPaginationHtml(pagination) {
    // Simple pagination implementation
    let html = '<div class="flex justify-center mt-6"><div class="flex space-x-2">';
    
    for (let i = 1; i <= pagination.totalPages; i++) {
        const active = i === pagination.page ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50';
        html += `<button onclick="loadOrderHistory(${i})" class="${active} px-3 py-2 border border-gray-300 rounded-md">${i}</button>`;
    }
    
    html += '</div></div>';
    return html;
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm ${getNotificationClass(type)}`;
    notification.innerHTML = `
        <div class="flex items-center">
            <i class="fas ${getNotificationIcon(type)} mr-3"></i>
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-lg">&times;</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

function getNotificationClass(type) {
    const classes = {
        'success': 'bg-green-100 text-green-800 border border-green-200',
        'error': 'bg-red-100 text-red-800 border border-red-200',
        'warning': 'bg-yellow-100 text-yellow-800 border border-yellow-200',
        'info': 'bg-blue-100 text-blue-800 border border-blue-200'
    };
    return classes[type] || classes.info;
}

function getNotificationIcon(type) {
    const icons = {
        'success': 'fa-check-circle',
        'error': 'fa-exclamation-circle',
        'warning': 'fa-exclamation-triangle',
        'info': 'fa-info-circle'
    };
    return icons[type] || icons.info;
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('token');
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        window.location.href = '/auth/auth-agent.html';
    }
}

// Export functions for global access
window.initializeDashboard = initializeDashboard;
window.switchTab = switchTab;
window.acceptOrder = acceptOrder;
window.updateOrderStatus = updateOrderStatus;
window.sendMessage = sendMessage;
window.viewOrderDetails = viewOrderDetails;
window.refreshAvailableOrders = refreshAvailableOrders;
window.refreshActiveOrders = refreshActiveOrders;
window.refreshOrderHistory = refreshOrderHistory;
window.showNotification = showNotification;
window.logout = logout;