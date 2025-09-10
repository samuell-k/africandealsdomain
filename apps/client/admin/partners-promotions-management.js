// Global state
let partners = [];
let promotions = [];
let services = [];
let currentTab = 'partners';
let editingId = null;

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    initializeAuth();
    loadAllData();
    setupEventListeners();
});

// Authentication check
function initializeAuth() {
    const token = localStorage.getItem('adminToken');
    if (!token) {
        window.location.href = '/auth/auth-admin.html';
        return;
    }
    
    // Display current user
    const adminData = JSON.parse(localStorage.getItem('adminData') || '{}');
    const userElement = document.getElementById('current-user');
    if (userElement) {
        userElement.textContent = `Welcome, ${adminData.username || 'Admin'}`;
    }
}

// Logout function
function logout() {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminData');
    window.location.href = '/auth/auth-admin.html';
}

// Tab switching
function switchTab(tab) {
    currentTab = tab;
    
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`${tab}-tab`).classList.add('active');
    
    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tab}-content`).classList.add('active');
    
    // Load data if needed
    switch(tab) {
        case 'partners':
            if (partners.length === 0) loadPartners();
            break;
        case 'promotions':
            if (promotions.length === 0) loadPromotions();
            break;
        case 'services':
            if (services.length === 0) loadServices();
            break;
    }
}

// Load all data
function loadAllData() {
    loadPartners();
    loadPromotions();
    loadServices();
}

// API helper function
async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('adminToken');
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };
    
    // Handle FormData
    if (options.body instanceof FormData) {
        delete defaultOptions.headers['Content-Type'];
    }
    
    const response = await fetch(endpoint, {
        ...defaultOptions,
        ...options
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
}

// =============== PARTNERS FUNCTIONS ===============

async function loadPartners() {
    try {
        showLoading('partners');
        const data = await apiRequest('/api/admin/partners');
        partners = data.partners || [];
        renderPartners();
        hideLoading('partners');
    } catch (error) {
        console.error('Error loading partners:', error);
        showError('Failed to load partners');
        hideLoading('partners');
    }
}

function renderPartners() {
    const tbody = document.getElementById('partners-tbody');
    if (partners.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-4 text-center text-gray-500">
                    No partners found. <button onclick="openPartnerModal()" class="text-blue-600 hover:underline">Add the first partner</button>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = partners.map(partner => `
        <tr>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                    ${partner.logo_url ? `
                        <img src="${partner.logo_url}" alt="${partner.name}" class="w-12 h-12 object-contain rounded-lg mr-3">
                    ` : `
                        <div class="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center mr-3">
                            <i class="fas fa-building text-gray-400"></i>
                        </div>
                    `}
                    <div>
                        <div class="text-sm font-medium text-gray-900">${partner.name}</div>
                        <div class="text-sm text-gray-500">
                            <a href="${partner.link}" target="_blank" class="text-blue-600 hover:underline">
                                ${partner.link}
                            </a>
                        </div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4">
                <div class="text-sm text-gray-900 max-w-xs truncate">${partner.description || 'No description'}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    partner.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }">
                    ${partner.is_active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${partner.display_order}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button onclick="editPartner(${partner.id})" class="text-blue-600 hover:text-blue-900 mr-3">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deletePartner(${partner.id})" class="text-red-600 hover:text-red-900">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function openPartnerModal(partnerId = null) {
    editingId = partnerId;
    const modal = document.getElementById('partner-modal');
    const title = document.getElementById('partner-modal-title');
    const submitText = document.getElementById('partner-submit-text');
    
    if (partnerId) {
        const partner = partners.find(p => p.id === partnerId);
        title.textContent = 'Edit Partner';
        submitText.textContent = 'Update Partner';
        
        // Fill form
        document.getElementById('partner-id').value = partner.id;
        document.getElementById('partner-name').value = partner.name;
        document.getElementById('partner-description').value = partner.description || '';
        document.getElementById('partner-link').value = partner.link;
        document.getElementById('partner-order').value = partner.display_order;
        document.getElementById('partner-status').value = partner.is_active ? 'true' : 'false';
        
        // Show current logo
        if (partner.logo_url) {
            const preview = document.getElementById('partner-logo-preview');
            preview.querySelector('img').src = partner.logo_url;
            preview.classList.remove('hidden');
        }
    } else {
        title.textContent = 'Add Partner';
        submitText.textContent = 'Save Partner';
        document.getElementById('partner-form').reset();
        document.getElementById('partner-logo-preview').classList.add('hidden');
    }
    
    modal.classList.remove('hidden');
}

function closePartnerModal() {
    document.getElementById('partner-modal').classList.add('hidden');
    document.getElementById('partner-form').reset();
    document.getElementById('partner-logo-preview').classList.add('hidden');
    editingId = null;
}

function editPartner(id) {
    openPartnerModal(id);
}

async function deletePartner(id) {
    if (!confirm('Are you sure you want to delete this partner?')) return;
    
    try {
        await apiRequest(`/api/admin/partners/${id}`, {
            method: 'DELETE'
        });
        showSuccess('Partner deleted successfully');
        loadPartners();
    } catch (error) {
        console.error('Error deleting partner:', error);
        showError('Failed to delete partner');
    }
}

// =============== PROMOTIONS FUNCTIONS ===============

async function loadPromotions() {
    try {
        showLoading('promotions');
        const data = await apiRequest('/api/admin/promotional-campaigns');
        promotions = data.promotions || [];
        renderPromotions();
        hideLoading('promotions');
    } catch (error) {
        console.error('Error loading promotions:', error);
        showError('Failed to load promotions');
        hideLoading('promotions');
    }
}

function renderPromotions() {
    const tbody = document.getElementById('promotions-tbody');
    if (promotions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-4 text-center text-gray-500">
                    No promotions found. <button onclick="openPromotionModal()" class="text-green-600 hover:underline">Add the first promotion</button>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = promotions.map(promotion => `
        <tr>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                    ${promotion.image_url ? `
                        <img src="${promotion.image_url}" alt="${promotion.title}" class="w-16 h-12 object-cover rounded-lg mr-3">
                    ` : `
                        <div class="w-16 h-12 bg-gray-200 rounded-lg flex items-center justify-center mr-3">
                            <i class="fas fa-image text-gray-400"></i>
                        </div>
                    `}
                    <div>
                        <div class="text-sm font-medium text-gray-900">${promotion.title}</div>
                        <div class="text-sm text-gray-500 max-w-xs truncate">${promotion.description}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                    ${promotion.promotion_type || 'Special Offer'}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${promotion.discount_percentage ? `${promotion.discount_percentage}%` : 'N/A'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${promotion.valid_until ? new Date(promotion.valid_until).toLocaleDateString() : 'No expiry'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    promotion.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }">
                    ${promotion.is_active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button onclick="editPromotion(${promotion.id})" class="text-blue-600 hover:text-blue-900 mr-3">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deletePromotion(${promotion.id})" class="text-red-600 hover:text-red-900">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function openPromotionModal(promotionId = null) {
    editingId = promotionId;
    const modal = document.getElementById('promotion-modal');
    const title = document.getElementById('promotion-modal-title');
    const submitText = document.getElementById('promotion-submit-text');
    
    if (promotionId) {
        const promotion = promotions.find(p => p.id === promotionId);
        title.textContent = 'Edit Promotion';
        submitText.textContent = 'Update Promotion';
        
        // Fill form
        document.getElementById('promotion-id').value = promotion.id;
        document.getElementById('promotion-title').value = promotion.title;
        document.getElementById('promotion-description').value = promotion.description || '';
        document.getElementById('promotion-link').value = promotion.link || '';
        document.getElementById('promotion-type').value = promotion.promotion_type || '';
        document.getElementById('promotion-discount').value = promotion.discount_percentage || '';
        document.getElementById('promotion-order').value = promotion.display_order;
        document.getElementById('promotion-status').value = promotion.is_active ? 'true' : 'false';
        
        // Handle dates
        if (promotion.valid_from) {
            document.getElementById('promotion-valid-from').value = formatDatetimeLocal(promotion.valid_from);
        }
        if (promotion.valid_until) {
            document.getElementById('promotion-valid-until').value = formatDatetimeLocal(promotion.valid_until);
        }
        
        // Show current image if exists
        if (promotion.image_url) {
            const preview = document.getElementById('promotion-image-preview');
            const previewImg = document.getElementById('promotion-image-preview-img');
            const imageInfo = document.getElementById('promotion-image-info');
            const dropZone = document.getElementById('promotion-image-drop-zone');
            
            previewImg.src = promotion.image_url.startsWith('http') ? promotion.image_url : `${window.location.origin}${promotion.image_url}`;
            preview.classList.remove('hidden');
            imageInfo.textContent = 'Current promotional image';
            dropZone.classList.add('hidden');
        }
    } else {
        title.textContent = 'Add Promotion';
        submitText.textContent = 'Save Promotion';
        document.getElementById('promotion-form').reset();
        
        // Reset image upload UI
        const preview = document.getElementById('promotion-image-preview');
        const previewImg = document.getElementById('promotion-image-preview-img');
        const imageInfo = document.getElementById('promotion-image-info');
        const dropZone = document.getElementById('promotion-image-drop-zone');
        
        preview.classList.add('hidden');
        previewImg.src = '';
        imageInfo.textContent = '';
        dropZone.classList.remove('hidden');
    }
    
    modal.classList.remove('hidden');
}

function closePromotionModal() {
    document.getElementById('promotion-modal').classList.add('hidden');
    document.getElementById('promotion-form').reset();
    
    // Reset image upload UI
    const preview = document.getElementById('promotion-image-preview');
    const previewImg = document.getElementById('promotion-image-preview-img');
    const imageInfo = document.getElementById('promotion-image-info');
    const dropZone = document.getElementById('promotion-image-drop-zone');
    
    preview.classList.add('hidden');
    previewImg.src = '';
    imageInfo.textContent = '';
    dropZone.classList.remove('hidden');
    
    editingId = null;
}

function editPromotion(id) {
    openPromotionModal(id);
}

async function deletePromotion(id) {
    if (!confirm('Are you sure you want to delete this promotion?')) return;
    
    try {
        await apiRequest(`/api/admin/promotional-campaigns/${id}`, {
            method: 'DELETE'
        });
        showSuccess('Promotion deleted successfully');
        loadPromotions();
    } catch (error) {
        console.error('Error deleting promotion:', error);
        showError('Failed to delete promotion');
    }
}

// =============== SERVICES FUNCTIONS ===============

async function loadServices() {
    try {
        showLoading('services');
        const data = await apiRequest('/api/admin/other-services');
        services = data.services || [];
        renderServices();
        hideLoading('services');
    } catch (error) {
        console.error('Error loading services:', error);
        showError('Failed to load services');
        hideLoading('services');
    }
}

function renderServices() {
    const tbody = document.getElementById('services-tbody');
    if (services.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-4 text-center text-gray-500">
                    No services found. <button onclick="openServiceModal()" class="text-purple-600 hover:underline">Add the first service</button>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = services.map(service => `
        <tr>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                    <div class="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mr-3 overflow-hidden">
                        ${service.image_url ? 
                            `<img src="${service.image_url}" alt="${service.name}" class="w-full h-full object-cover rounded-lg" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                             <div class="w-full h-full flex items-center justify-center text-2xl" style="display: none;">${service.icon || '🔗'}</div>` 
                            : 
                            `<div class="text-2xl">${service.icon || '🔗'}</div>`
                        }
                    </div>
                    <div>
                        <div class="text-sm font-medium text-gray-900">${service.name}</div>
                        <div class="text-sm text-gray-500">
                            <a href="${service.link}" target="_blank" class="text-blue-600 hover:underline">
                                ${service.link}
                            </a>
                        </div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4">
                <div class="text-sm text-gray-900 max-w-xs truncate">${service.description || 'No description'}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-center">
                <div class="w-8 h-8 mx-auto bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                    ${service.image_url ? 
                        `<img src="${service.image_url}" alt="${service.name}" class="w-full h-full object-cover rounded-lg" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                         <div class="w-full h-full flex items-center justify-center text-lg" style="display: none;">${service.icon || '🔗'}</div>` 
                        : 
                        `<div class="text-lg">${service.icon || '🔗'}</div>`
                    }
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    service.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }">
                    ${service.is_active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${service.display_order}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button onclick="editService(${service.id})" class="text-blue-600 hover:text-blue-900 mr-3">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteService(${service.id})" class="text-red-600 hover:text-red-900">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function openServiceModal(serviceId = null) {
    editingId = serviceId;
    const modal = document.getElementById('service-modal');
    const title = document.getElementById('service-modal-title');
    const submitText = document.getElementById('service-submit-text');
    
    // Setup image upload functionality
    setupServiceImageUpload();
    
    if (serviceId) {
        const service = services.find(s => s.id === serviceId);
        title.textContent = 'Edit Service';
        submitText.textContent = 'Update Service';
        
        // Fill form
        document.getElementById('service-id').value = service.id;
        document.getElementById('service-name').value = service.name;
        document.getElementById('service-description').value = service.description || '';
        document.getElementById('service-icon').value = service.icon || '';
        document.getElementById('service-link').value = service.link;
        document.getElementById('service-order').value = service.display_order;
        document.getElementById('service-status').value = service.is_active ? 'true' : 'false';
        
        // Show existing image if available
        if (service.image_url) {
            const previewImg = document.getElementById('service-image-preview-img');
            const imagePreview = document.getElementById('service-image-preview');
            const imageInfo = document.getElementById('service-image-info');
            const dropZone = document.getElementById('service-image-drop-zone');
            
            previewImg.src = service.image_url;
            imagePreview.classList.remove('hidden');
            imageInfo.textContent = 'Current service image';
            dropZone.classList.add('hidden');
        }
    } else {
        title.textContent = 'Add Service';
        submitText.textContent = 'Save Service';
        document.getElementById('service-form').reset();
        
        // Reset image upload UI
        const preview = document.getElementById('service-image-preview');
        const previewImg = document.getElementById('service-image-preview-img');
        const imageInfo = document.getElementById('service-image-info');
        const dropZone = document.getElementById('service-image-drop-zone');
        
        preview.classList.add('hidden');
        previewImg.src = '';
        imageInfo.textContent = '';
        dropZone.classList.remove('hidden');
    }
    
    modal.classList.remove('hidden');
}

function closeServiceModal() {
    document.getElementById('service-modal').classList.add('hidden');
    document.getElementById('service-form').reset();
    
    // Reset image upload UI
    const preview = document.getElementById('service-image-preview');
    const previewImg = document.getElementById('service-image-preview-img');
    const imageInfo = document.getElementById('service-image-info');
    const dropZone = document.getElementById('service-image-drop-zone');
    
    if (preview) preview.classList.add('hidden');
    if (previewImg) previewImg.src = '';
    if (imageInfo) imageInfo.textContent = '';
    if (dropZone) dropZone.classList.remove('hidden');
    
    editingId = null;
}

function editService(id) {
    openServiceModal(id);
}

async function deleteService(id) {
    if (!confirm('Are you sure you want to delete this service?')) return;
    
    try {
        await apiRequest(`/api/admin/other-services/${id}`, {
            method: 'DELETE'
        });
        showSuccess('Service deleted successfully');
        loadServices();
    } catch (error) {
        console.error('Error deleting service:', error);
        showError('Failed to delete service');
    }
}

// =============== FORM HANDLERS ===============

function setupEventListeners() {
    // Partner form
    document.getElementById('partner-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        await handlePartnerSubmit();
    });
    
    // Promotion form
    document.getElementById('promotion-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        await handlePromotionSubmit();
    });
    
    // Service form
    document.getElementById('service-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        await handleServiceSubmit();
    });
    
    // File preview handlers
    document.getElementById('partner-logo').addEventListener('change', function(e) {
        handleFilePreview(e, 'partner-logo-preview');
    });
    
    document.getElementById('promotion-image').addEventListener('change', function(e) {
        handleFilePreview(e, 'promotion-image-preview');
    });
}

async function handlePartnerSubmit() {
    const formData = new FormData();
    const form = document.getElementById('partner-form');
    
    // Add all form fields to FormData
    for (const element of form.elements) {
        if (element.name && element.type !== 'file') {
            formData.append(element.name, element.value);
        }
    }
    
    // Add file if selected
    const logoFile = document.getElementById('partner-logo').files[0];
    if (logoFile) {
        formData.append('logo', logoFile);
    }
    
    try {
        const url = editingId ? `/api/admin/partners/${editingId}` : '/api/admin/partners';
        const method = editingId ? 'PUT' : 'POST';
        
        await apiRequest(url, {
            method: method,
            body: formData
        });
        
        showSuccess(`Partner ${editingId ? 'updated' : 'created'} successfully`);
        closePartnerModal();
        loadPartners();
    } catch (error) {
        console.error('Error saving partner:', error);
        showError(`Failed to ${editingId ? 'update' : 'create'} partner`);
    }
}

async function handlePromotionSubmit() {
    const formData = new FormData();
    const form = document.getElementById('promotion-form');
    
    // Add all form fields to FormData
    for (const element of form.elements) {
        if (element.name && element.type !== 'file') {
            formData.append(element.name, element.value);
        }
    }
    
    // Add file if selected
    const imageFile = document.getElementById('promotion-image').files[0];
    if (imageFile) {
        formData.append('image', imageFile);
    }
    
    try {
        const url = editingId ? `/api/admin/promotional-campaigns/${editingId}` : '/api/admin/promotional-campaigns';
        const method = editingId ? 'PUT' : 'POST';
        
        // Show loading state
        const submitBtn = document.querySelector('#promotion-form button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = '⏳ Uploading...';
        submitBtn.disabled = true;
        
        const response = await apiRequest(url, {
            method: method,
            body: formData
        });
        
        showSuccess(`🎉 Promotion ${editingId ? 'updated' : 'created'} successfully! Image uploaded and ready.`);
        closePromotionModal();
        loadPromotions();
        
        // Reset button
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        
    } catch (error) {
        console.error('Error saving promotion:', error);
        
        // Show specific error message
        let errorMessage = `Failed to ${editingId ? 'update' : 'create'} promotion`;
        if (error.message.includes('413')) {
            errorMessage = 'File too large! Please choose an image smaller than 5MB.';
        } else if (error.message.includes('415')) {
            errorMessage = 'Invalid file format! Please upload a valid image file.';
        } else if (error.message.includes('network')) {
            errorMessage = 'Network error! Please check your connection and try again.';
        }
        
        showError(`❌ ${errorMessage}`);
        
        // Reset button
        const submitBtn = document.querySelector('#promotion-form button[type="submit"]');
        if (submitBtn) {
            submitBtn.textContent = editingId ? 'Update Promotion' : 'Save Promotion';
            submitBtn.disabled = false;
        }
    }
}

async function handleServiceSubmit() {
    const form = document.getElementById('service-form');
    const formData = new FormData(form);
    
    // Debug: Log form data before sending
    console.log('Form data being sent:');
    for (let [key, value] of formData.entries()) {
        console.log(`${key}: ${value}`);
    }
    
    // Ensure is_active is properly converted
    const statusValue = document.getElementById('service-status').value;
    formData.set('is_active', statusValue === 'true' ? 'true' : 'false');
    
    console.log('Final is_active value:', formData.get('is_active'));
    
    try {
        const url = editingId ? `/api/admin/other-services/${editingId}` : '/api/admin/other-services';
        const method = editingId ? 'PUT' : 'POST';
        
        // Show loading state
        const submitBtn = document.querySelector('#service-form button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = editingId ? '⏳ Updating...' : '⏳ Creating...';
        submitBtn.disabled = true;
        
        await apiRequest(url, {
            method: method,
            body: formData
        });
        
        showSuccess(`🎉 Service ${editingId ? 'updated' : 'created'} successfully! Status preserved.`);
        closeServiceModal();
        loadServices();
        
        // Reset button
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        
    } catch (error) {
        console.error('Error saving service:', error);
        
        let errorMessage = `Failed to ${editingId ? 'update' : 'create'} service`;
        if (error.message.includes('413')) {
            errorMessage = 'File too large! Please choose an image smaller than 5MB.';
        } else if (error.message.includes('415')) {
            errorMessage = 'Invalid file format! Please upload a valid image file.';
        }
        
        showError(`❌ ${errorMessage}`);
        
        // Reset button
        const submitBtn = document.querySelector('#service-form button[type="submit"]');
        if (submitBtn) {
            submitBtn.textContent = editingId ? 'Update Service' : 'Create Service';
            submitBtn.disabled = false;
        }
    }
}

// =============== SERVICE IMAGE UPLOAD FUNCTIONS ===============

function setupServiceImageUpload() {
    const dropZone = document.getElementById('service-image-drop-zone');
    const imageInput = document.getElementById('service-image-input');
    const imagePreview = document.getElementById('service-image-preview');
    const previewImg = document.getElementById('service-image-preview-img');
    const removeBtn = document.getElementById('service-remove-image');
    const imageInfo = document.getElementById('service-image-info');
    
    if (!dropZone || !imageInput) return;
    
    // Click to upload
    dropZone.addEventListener('click', () => imageInput.click());
    
    // File input change
    imageInput.addEventListener('change', handleServiceFileSelect);
    
    // Drag and drop events
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('border-purple-500', 'bg-purple-50');
    });
    
    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-purple-500', 'bg-purple-50');
    });
    
    dropZone.addEventListener('drop', handleServiceFileDrop);
    
    // Remove image
    if (removeBtn) {
        removeBtn.addEventListener('click', removeServiceImage);
    }
    
    function handleServiceFileSelect(e) {
        const file = e.target.files[0];
        if (file) processServiceFile(file);
    }
    
    function handleServiceFileDrop(e) {
        e.preventDefault();
        dropZone.classList.remove('border-purple-500', 'bg-purple-50');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            const dt = new DataTransfer();
            dt.items.add(file);
            imageInput.files = dt.files;
            processServiceFile(file);
        }
    }

    function processServiceFile(file) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
            showError('❌ Please select a valid image file (PNG, JPG, GIF, SVG)');
            removeServiceImage();
            return;
        }

        // Validate file size (5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            showError(`❌ File too large! Size: ${formatFileSize(file.size)}. Maximum allowed: 5MB`);
            removeServiceImage();
            return;
        }

        // Show success feedback for valid file
        showSuccess(`✅ Service image selected: ${file.name} (${formatFileSize(file.size)})`);
        
        // Auto-hide success message after 3 seconds
        setTimeout(() => {
            const toasts = document.querySelectorAll('#toast-container .bg-green-500');
            toasts.forEach(toast => toast.remove());
        }, 3000);

        // Show preview
        const reader = new FileReader();
        reader.onload = function(e) {
            previewImg.src = e.target.result;
            imagePreview.classList.remove('hidden');
            imageInfo.textContent = `${file.name} (${formatFileSize(file.size)})`;
            dropZone.classList.add('hidden');
        };
        reader.readAsDataURL(file);
    }
    
    function removeServiceImage() {
        imageInput.value = '';
        imagePreview.classList.add('hidden');
        previewImg.src = '';
        imageInfo.textContent = '';
        dropZone.classList.remove('hidden');
    }
}

// =============== UTILITY FUNCTIONS ===============

function handleFilePreview(event, previewId) {
    const file = event.target.files[0];
    const preview = document.getElementById(previewId);
    const img = preview.querySelector('img');
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            img.src = e.target.result;
            preview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    } else {
        preview.classList.add('hidden');
    }
}

function formatDatetimeLocal(dateString) {
    const date = new Date(dateString);
    return date.toISOString().slice(0, 16);
}

function showLoading(section) {
    document.getElementById(`${section}-loading`).classList.remove('hidden');
    document.getElementById(`${section}-table`).classList.add('hidden');
}

function hideLoading(section) {
    document.getElementById(`${section}-loading`).classList.add('hidden');
    document.getElementById(`${section}-table`).classList.remove('hidden');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `p-4 rounded-lg shadow-lg text-white mb-2 transition-all duration-300 ${
        type === 'success' ? 'bg-green-500' : 
        type === 'error' ? 'bg-red-500' : 
        'bg-blue-500'
    }`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

function showSuccess(message) {
    showToast(message, 'success');
}

function showError(message) {
    showToast(message, 'error');
}

// Close modals when clicking outside
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('fixed') && e.target.classList.contains('inset-0')) {
        closePartnerModal();
        closePromotionModal();
        closeServiceModal();
    }
});

// =============== IMAGE UPLOAD FUNCTIONALITY ===============

// Initialize image upload functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    setupImageUpload();
});

function setupImageUpload() {
    const dropZone = document.getElementById('promotion-image-drop-zone');
    const fileInput = document.getElementById('promotion-image');
    const preview = document.getElementById('promotion-image-preview');
    const previewImg = document.getElementById('promotion-image-preview-img');
    const removeBtn = document.getElementById('promotion-image-remove');
    const imageInfo = document.getElementById('promotion-image-info');

    if (!dropZone || !fileInput) return;

    // Click to upload
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    // File input change
    fileInput.addEventListener('change', handleFileSelect);

    // Drag and drop
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleFileDrop);

    // Remove image
    if (removeBtn) {
        removeBtn.addEventListener('click', removeImage);
    }

    function handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            processFile(file);
        }
    }

    function handleDragOver(e) {
        e.preventDefault();
        dropZone.classList.add('border-green-400', 'bg-green-50');
        dropZone.classList.remove('border-gray-300', 'bg-gray-50');
    }

    function handleDragLeave(e) {
        e.preventDefault();
        dropZone.classList.remove('border-green-400', 'bg-green-50');
        dropZone.classList.add('border-gray-300', 'bg-gray-50');
    }

    function handleFileDrop(e) {
        e.preventDefault();
        dropZone.classList.remove('border-green-400', 'bg-green-50');
        dropZone.classList.add('border-gray-300', 'bg-gray-50');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            
            // Set the file to the input element
            const dt = new DataTransfer();
            dt.items.add(file);
            fileInput.files = dt.files;
            
            processFile(file);
        }
    }

    function processFile(file) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
            showError('❌ Please select a valid image file (PNG, JPG, GIF, SVG)');
            removeImage();
            return;
        }

        // Validate file size (5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            showError(`❌ File too large! Size: ${formatFileSize(file.size)}. Maximum allowed: 5MB`);
            removeImage();
            return;
        }

        // Show success feedback for valid file
        showSuccess(`✅ Image selected: ${file.name} (${formatFileSize(file.size)})`);
        
        // Auto-hide success message after 3 seconds
        setTimeout(() => {
            const toasts = document.querySelectorAll('#toast-container .bg-green-500');
            toasts.forEach(toast => toast.remove());
        }, 3000);

        // Show preview
        const reader = new FileReader();
        reader.onload = function(e) {
            previewImg.src = e.target.result;
            preview.classList.remove('hidden');
            
            // Update file info
            const sizeStr = formatFileSize(file.size);
            imageInfo.textContent = `${file.name} (${sizeStr})`;
            
            // Hide drop zone
            dropZone.classList.add('hidden');
        };
        reader.readAsDataURL(file);
    }

    function removeImage() {
        // Clear file input
        fileInput.value = '';
        
        // Hide preview
        preview.classList.add('hidden');
        previewImg.src = '';
        imageInfo.textContent = '';
        
        // Show drop zone
        dropZone.classList.remove('hidden');
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}