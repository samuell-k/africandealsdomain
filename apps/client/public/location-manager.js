/**
 * Location Manager - Shared JavaScript component for location and map functionality
 * Handles GPS tracking, map display, and location management across the platform
 */

class LocationManager {
    constructor(options = {}) {
        this.options = {
            mapContainerId: 'map',
            defaultCenter: [-1.2921, 36.8219], // Nairobi
            defaultZoom: 13,
            enableRealTimeTracking: false,
            trackingInterval: 30000, // 30 seconds
            ...options
        };
        
        this.map = null;
        this.currentLocationMarker = null;
        this.watchId = null;
        this.isTracking = false;
        this.markers = [];
        this.socket = null;
        
        this.init();
    }

    // Initialize the location manager
    init() {
        this.initializeMap();
        this.setupEventListeners();
        
        if (this.options.enableRealTimeTracking) {
            this.initializeSocket();
        }
    }

    // Initialize Leaflet map
    initializeMap() {
        if (!document.getElementById(this.options.mapContainerId)) {
            console.warn('Map container not found:', this.options.mapContainerId);
            return;
        }

        this.map = L.map(this.options.mapContainerId).setView(
            this.options.defaultCenter, 
            this.options.defaultZoom
        );

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);

        // Add click event for adding locations
        this.map.on('click', (e) => {
            this.onMapClick(e);
        });
    }

    // Initialize Socket.io for real-time updates
    initializeSocket() {
        if (typeof io !== 'undefined') {
            this.socket = io();
            
            this.socket.on('location_update', (data) => {
                this.onLocationUpdate(data);
            });
        }
    }

    // Setup event listeners
    setupEventListeners() {
        // Listen for custom events
        document.addEventListener('locationManager:getCurrentLocation', () => {
            this.getCurrentLocation();
        });
        
        document.addEventListener('locationManager:startTracking', () => {
            this.startRealTimeTracking();
        });
        
        document.addEventListener('locationManager:stopTracking', () => {
            this.stopRealTimeTracking();
        });
    }

    // Get user's current location
    getCurrentLocation(callback = null) {
        if (!navigator.geolocation) {
            this.showError('Geolocation is not supported by this browser');
            return;
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
        };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const location = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy
                };
                
                this.updateCurrentLocationMarker(location);
                this.map.setView([location.lat, location.lng], 15);
                
                if (callback) callback(location);
                this.dispatchEvent('locationFound', location);
            },
            (error) => {
                this.handleLocationError(error);
                if (callback) callback(null, error);
            },
            options
        );
    }

    // Start real-time location tracking
    startRealTimeTracking(orderId = null) {
        if (!navigator.geolocation) {
            this.showError('Geolocation is not supported');
            return;
        }

        if (this.isTracking) {
            return;
        }

        this.isTracking = true;
        
        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 30000
        };

        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                const locationData = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    speed: position.coords.speed,
                    heading: position.coords.heading,
                    order_id: orderId
                };
                
                this.updateCurrentLocationMarker(locationData);
                this.sendLocationUpdate(locationData);
                this.dispatchEvent('locationTracked', locationData);
            },
            (error) => {
                this.handleLocationError(error);
                this.stopRealTimeTracking();
            },
            options
        );

        this.dispatchEvent('trackingStarted');
    }

    // Stop real-time location tracking
    stopRealTimeTracking() {
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        
        this.isTracking = false;
        this.dispatchEvent('trackingStopped');
    }

    // Send location update to server
    sendLocationUpdate(locationData) {
        const token = localStorage.getItem('token');
        if (!token) return;

        fetch('/api/user-locations/realtime', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(locationData)
        })
        .catch(error => {
            console.error('Error sending location update:', error);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error sending location update:',
                    error: error,
                    timestamp: new Date().toISOString(),
                    file: 'location-manager.js'
                };
                
                console.error('Error details:', errorInfo);
showNotification('Error sending location update:', 'error');

// Enhanced error logging
if (error && error.message) {
    console.error('Error details:', error.message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error details:',
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    file: 'location-manager.js'
                };
                
                console.error('Error details:', errorInfo);
}
        });
    }

    // Update current location marker
    updateCurrentLocationMarker(location) {
        if (this.currentLocationMarker) {
            this.map.removeLayer(this.currentLocationMarker);
        }

        const icon = L.divIcon({
            className: 'current-location-marker',
            html: '<div class="w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-lg animate-pulse"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        });

        this.currentLocationMarker = L.marker([location.lat, location.lng], { icon })
            .addTo(this.map)
            .bindPopup('Your current location');
    }

    // Add a marker to the map
    addMarker(location, options = {}) {
        const markerOptions = {
            title: options.title || '',
            draggable: options.draggable || false,
            ...options
        };

        const marker = L.marker([location.lat, location.lng], markerOptions)
            .addTo(this.map);

        if (options.popup) {
            marker.bindPopup(options.popup);
        }

        if (options.onClick) {
            marker.on('click', options.onClick);
        }

        this.markers.push(marker);
        return marker;
    }

    // Remove a marker from the map
    removeMarker(marker) {
        if (marker) {
            this.map.removeLayer(marker);
            const index = this.markers.indexOf(marker);
            if (index > -1) {
                this.markers.splice(index, 1);
            }
        }
    }

    // Clear all markers
    clearMarkers() {
        this.markers.forEach(marker => {
            this.map.removeLayer(marker);
        });
        this.markers = [];
    }

    // Load and display saved locations
    async loadSavedLocations() {
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            const response = await fetch('/api/user-locations', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.displaySavedLocations(data.locations);
                return data.locations;
            }
        } catch (error) {
            console.error('Error loading saved locations:', error);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error loading saved locations:',
                    error: error,
                    timestamp: new Date().toISOString(),
                    file: 'location-manager.js'
                };
                
                console.error('Error details:', errorInfo);
showNotification('Error loading saved locations:', 'error');

// Enhanced error logging
if (error && error.message) {
    console.error('Error details:', error.message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error details:',
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    file: 'location-manager.js'
                };
                
                console.error('Error details:', errorInfo);
}
        }
        
        return [];
    }

    // Display saved locations on map
    displaySavedLocations(locations) {
        this.clearMarkers();
        
        locations.forEach(location => {
            const isPrimary = location.is_primary;
            const icon = L.divIcon({
                className: 'saved-location-marker',
                html: `<div class="w-6 h-6 ${isPrimary ? 'bg-red-600' : 'bg-blue-600'} rounded-full border-2 border-white shadow-lg flex items-center justify-center">
                    <i class="fas fa-map-marker-alt text-white text-xs"></i>
                </div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 24]
            });

            const marker = L.marker([location.latitude, location.longitude], { icon })
                .addTo(this.map)
                .bindPopup(`
                    <div class="p-2">
                        <strong>${location.address}</strong><br>
                        ${location.city}, ${location.country}
                        ${isPrimary ? '<br><span class="text-blue-600 text-sm">Primary Location</span>' : ''}
                        <br><button onclick="locationManager.centerOnLocation(${location.latitude}, ${location.longitude})" class="text-blue-600 text-sm mt-1">Center Map</button>
                    </div>
                `);

            this.markers.push(marker);
        });
    }

    // Center map on specific location
    centerOnLocation(lat, lng, zoom = 15) {
        this.map.setView([lat, lng], zoom);
    }

    // Save a new location
    async saveLocation(locationData) {
        const token = localStorage.getItem('token');
        if (!token) return false;

        try {
            const response = await fetch('/api/user-locations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(locationData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.dispatchEvent('locationSaved', locationData);
                return true;
            } else {
                this.showError(data.message || 'Failed to save location');
                return false;
            }
        } catch (error) {
            console.error('Error saving location:', error);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error saving location:',
                    error: error,
                    timestamp: new Date().toISOString(),
                    file: 'location-manager.js'
                };
                
                console.error('Error details:', errorInfo);
showNotification('Error saving location:', 'error');

// Enhanced error logging
if (error && error.message) {
    console.error('Error details:', error.message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error details:',
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    file: 'location-manager.js'
                };
                
                console.error('Error details:', errorInfo);
}
            this.showError('Failed to save location');
            return false;
        }
    }

    // Handle map click events
    onMapClick(e) {
        const location = {
            lat: e.latlng.lat,
            lng: e.latlng.lng
        };
        
        this.dispatchEvent('mapClicked', location);
    }

    // Handle incoming location updates
    onLocationUpdate(data) {
        if (data.userId && data.latitude && data.longitude) {
            // Update agent location marker
            this.updateAgentLocation(data);
            this.dispatchEvent('agentLocationUpdated', data);
        }
    }

    // Update agent location marker
    updateAgentLocation(data) {
        // Remove existing agent marker
        const existingMarker = this.markers.find(m => m.options.agentId === data.userId);
        if (existingMarker) {
            this.removeMarker(existingMarker);
        }

        // Add new agent marker
        const icon = L.divIcon({
            className: 'agent-location-marker',
            html: '<div class="w-6 h-6 bg-green-600 rounded-full border-2 border-white shadow-lg flex items-center justify-center animate-pulse"><i class="fas fa-motorcycle text-white text-xs"></i></div>',
            iconSize: [24, 24],
            iconAnchor: [12, 24]
        });

        const marker = L.marker([data.latitude, data.longitude], { 
            icon,
            agentId: data.userId
        })
        .addTo(this.map)
        .bindPopup(`
            <div class="p-2">
                <strong>Agent Location</strong><br>
                Updated: ${new Date(data.timestamp).toLocaleTimeString()}<br>
                ${data.accuracy ? `Accuracy: ${Math.round(data.accuracy)}m` : ''}
            </div>
        `);

        this.markers.push(marker);
    }

    // Handle location errors
    handleLocationError(error) {
        let message = 'Location error occurred';
        
        switch (error.code) {
            case error.PERMISSION_DENIED:
                message = 'Location access denied by user';
                break;
            case error.POSITION_UNAVAILABLE:
                message = 'Location information unavailable';
                break;
            case error.TIMEOUT:
                message = 'Location request timed out';
                break;
        }
        
        this.showError(message);
        this.dispatchEvent('locationError', { error, message });
    }

    // Show error message
    showError(message) {
        console.error('LocationManager:', message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'LocationManager:',
                    error: message,
                    timestamp: new Date().toISOString(),
                    file: 'location-manager.js'
                };
                
                console.error('Error details:', errorInfo);
showNotification('LocationManager:', 'error');

// Enhanced error logging
if (message && message.message) {
    console.error('Error details:', message.message);
                
                // Enhanced error logging
                const errorInfo = {
                    message: 'Error details:',
                    error: message.message,
                    timestamp: new Date().toISOString(),
                    file: 'location-manager.js'
                };
                
                console.error('Error details:', errorInfo);
}
        
        // Dispatch error event for UI handling
        this.dispatchEvent('error', { message });
    }

    // Dispatch custom events
    dispatchEvent(eventName, data = null) {
        const event = new CustomEvent(`locationManager:${eventName}`, {
            detail: data
        });
        document.dispatchEvent(event);
    }

    // Calculate distance between two points
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // Earth's radius in kilometers
        const dLat = this.toRadians(lat2 - lat1);
        const dLng = this.toRadians(lng2 - lng1);
        
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // Convert degrees to radians
    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    // Get map bounds
    getMapBounds() {
        return this.map ? this.map.getBounds() : null;
    }

    // Fit map to show all markers
    fitToMarkers() {
        if (this.markers.length > 0) {
            const group = new L.featureGroup(this.markers);
            this.map.fitBounds(group.getBounds().pad(0.1));
        }
    }

    // Destroy the location manager
    destroy() {
        this.stopRealTimeTracking();
        
        if (this.socket) {
            this.socket.disconnect();
        }
        
        if (this.map) {
            this.map.remove();
        }
        
        this.clearMarkers();
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LocationManager;
} else {
    window.LocationManager = LocationManager;
}

// Auto-initialize if map container exists
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('map') && typeof window.locationManager === 'undefined') {
        window.locationManager = new LocationManager();
    }
});