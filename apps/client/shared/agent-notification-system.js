/**
 * Agent Notification System
 * Comprehensive notification management for all agent types
 */

class AgentNotificationSystem {
    constructor() {
        this.notifications = [];
        this.socket = null;
        this.soundEnabled = true;
        this.init();
    }

    init() {
        console.log('[AGENT-NOTIFICATIONS] Initializing notification system...');
        this.createNotificationContainer();
        this.initializeSocket();
        this.loadNotificationPreferences();
    }

    createNotificationContainer() {
        // Create notification container if it doesn't exist
        if (!document.getElementById('agent-notification-container')) {
            const container = document.createElement('div');
            container.id = 'agent-notification-container';
            container.className = 'fixed top-4 right-4 z-50 space-y-2';
            container.style.maxWidth = '400px';
            document.body.appendChild(container);
        }
    }

    initializeSocket() {
        if (typeof io !== 'undefined') {
            this.socket = io();
            
            // Listen for various agent-specific events
            this.socket.on('new_order_assigned', (data) => {
                this.showNotification({
                    type: 'success',
                    title: 'New Order Assigned!',
                    message: `Order #${data.orderDetails?.order_number || data.orderId} has been assigned to you`,
                    action: {
                        text: 'View Order',
                        callback: () => this.viewOrder(data.orderId)
                    },
                    sound: true,
                    persistent: true
                });
            });

            this.socket.on('order_status_update', (data) => {
                this.showNotification({
                    type: 'info',
                    title: 'Order Status Updated',
                    message: `Order #${data.orderId} status: ${data.status}`,
                    sound: false
                });
            });

            this.socket.on('payment_received', (data) => {
                this.showNotification({
                    type: 'success',
                    title: 'Payment Received!',
                    message: `You earned $${data.amount} from order #${data.orderId}`,
                    sound: true
                });
            });

            this.socket.on('delivery_reminder', (data) => {
                this.showNotification({
                    type: 'warning',
                    title: 'Delivery Reminder',
                    message: `Order #${data.orderId} is scheduled for delivery soon`,
                    action: {
                        text: 'View Details',
                        callback: () => this.viewOrder(data.orderId)
                    },
                    persistent: true
                });
            });

            this.socket.on('system_message', (data) => {
                this.showNotification({
                    type: data.type || 'info',
                    title: data.title || 'System Message',
                    message: data.message,
                    persistent: data.persistent || false
                });
            });

            // Join agent-specific room
            const userData = this.getUserData();
            if (userData && userData.id) {
                this.socket.emit('join:user_room', { userId: userData.id });
            }
        }
    }

    loadNotificationPreferences() {
        const preferences = localStorage.getItem('agent_notification_preferences');
        if (preferences) {
            try {
                const prefs = JSON.parse(preferences);
                this.soundEnabled = prefs.soundEnabled !== false;
            } catch (error) {
                console.error('[AGENT-NOTIFICATIONS] Error loading preferences:', error);
            }
        }
    }

    saveNotificationPreferences() {
        const preferences = {
            soundEnabled: this.soundEnabled
        };
        localStorage.setItem('agent_notification_preferences', JSON.stringify(preferences));
    }

    showNotification(options) {
        const {
            type = 'info',
            title = 'Notification',
            message = '',
            action = null,
            sound = false,
            persistent = false,
            duration = 5000
        } = options;

        const notification = {
            id: Date.now() + Math.random(),
            type,
            title,
            message,
            action,
            persistent,
            timestamp: new Date()
        };

        this.notifications.unshift(notification);
        this.renderNotification(notification);

        // Play sound if enabled
        if (sound && this.soundEnabled) {
            this.playNotificationSound(type);
        }

        // Auto-remove non-persistent notifications
        if (!persistent) {
            setTimeout(() => {
                this.removeNotification(notification.id);
            }, duration);
        }

        // Limit total notifications
        if (this.notifications.length > 10) {
            const oldNotification = this.notifications.pop();
            this.removeNotificationElement(oldNotification.id);
        }
    }

    renderNotification(notification) {
        const container = document.getElementById('agent-notification-container');
        if (!container) return;

        const notificationEl = document.createElement('div');
        notificationEl.id = `notification-${notification.id}`;
        notificationEl.className = `notification-item transform transition-all duration-300 ease-in-out translate-x-full opacity-0`;

        const typeClasses = {
            success: 'bg-green-500 border-green-600',
            error: 'bg-red-500 border-red-600',
            warning: 'bg-yellow-500 border-yellow-600',
            info: 'bg-blue-500 border-blue-600'
        };

        const typeIcons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };

        notificationEl.innerHTML = `
            <div class="flex items-start p-4 rounded-lg shadow-lg border-l-4 ${typeClasses[notification.type]} bg-white">
                <div class="flex-shrink-0">
                    <i class="${typeIcons[notification.type]} text-${notification.type === 'warning' ? 'yellow' : notification.type === 'error' ? 'red' : notification.type === 'success' ? 'green' : 'blue'}-600 text-xl"></i>
                </div>
                <div class="ml-3 flex-1">
                    <h4 class="text-sm font-semibold text-gray-900">${notification.title}</h4>
                    <p class="text-sm text-gray-700 mt-1">${notification.message}</p>
                    ${notification.action ? `
                        <button onclick="window.agentNotifications.handleAction('${notification.id}')" 
                                class="mt-2 text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded transition-colors">
                            ${notification.action.text}
                        </button>
                    ` : ''}
                    <div class="text-xs text-gray-500 mt-2">
                        ${notification.timestamp.toLocaleTimeString()}
                    </div>
                </div>
                <button onclick="window.agentNotifications.removeNotification('${notification.id}')" 
                        class="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-600">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        container.appendChild(notificationEl);

        // Animate in
        setTimeout(() => {
            notificationEl.classList.remove('translate-x-full', 'opacity-0');
        }, 100);
    }

    removeNotification(id) {
        this.notifications = this.notifications.filter(n => n.id !== id);
        this.removeNotificationElement(id);
    }

    removeNotificationElement(id) {
        const element = document.getElementById(`notification-${id}`);
        if (element) {
            element.classList.add('translate-x-full', 'opacity-0');
            setTimeout(() => {
                element.remove();
            }, 300);
        }
    }

    handleAction(notificationId) {
        const notification = this.notifications.find(n => n.id == notificationId);
        if (notification && notification.action && notification.action.callback) {
            notification.action.callback();
            this.removeNotification(notificationId);
        }
    }

    playNotificationSound(type) {
        try {
            // Create audio context for different notification sounds
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            // Different frequencies for different notification types
            const frequencies = {
                success: 800,
                error: 400,
                warning: 600,
                info: 500
            };

            oscillator.frequency.setValueAtTime(frequencies[type] || 500, audioContext.currentTime);
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        } catch (error) {
            console.warn('[AGENT-NOTIFICATIONS] Could not play sound:', error);
        }
    }

    viewOrder(orderId) {
        // This method should be overridden by each agent dashboard
        console.log('[AGENT-NOTIFICATIONS] View order:', orderId);
        // Default behavior - try to find and trigger order view
        if (window.agentDashboard && window.agentDashboard.viewOrderDetails) {
            window.agentDashboard.viewOrderDetails(orderId);
        }
    }

    getUserData() {
        try {
            const userData = localStorage.getItem('userData') || localStorage.getItem('user');
            return userData ? JSON.parse(userData) : null;
        } catch (error) {
            console.error('[AGENT-NOTIFICATIONS] Error getting user data:', error);
            return null;
        }
    }

    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        this.saveNotificationPreferences();
        
        this.showNotification({
            type: 'info',
            title: 'Sound Notifications',
            message: `Sound notifications ${this.soundEnabled ? 'enabled' : 'disabled'}`,
            duration: 2000
        });
    }

    clearAllNotifications() {
        this.notifications = [];
        const container = document.getElementById('agent-notification-container');
        if (container) {
            container.innerHTML = '';
        }
    }

    getNotificationCount() {
        return this.notifications.length;
    }

    // Test notification method for development
    testNotification() {
        this.showNotification({
            type: 'success',
            title: 'Test Notification',
            message: 'This is a test notification to verify the system is working',
            action: {
                text: 'Got it!',
                callback: () => console.log('Test notification action clicked')
            },
            sound: true
        });
    }
}

// Initialize global notification system
window.agentNotifications = new AgentNotificationSystem();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AgentNotificationSystem;
}