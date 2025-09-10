/**
 * Product Share System - Frontend Component
 * Handles product sharing with referral codes across social media platforms
 */

class ProductShareSystem {
    constructor() {
        this.baseUrl = window.location.origin;
        this.apiUrl = `${this.baseUrl}/api`;
        this.currentUser = this.getCurrentUser();
        this.init();
    }

    init() {
        this.addShareButtonsToProducts();
        this.setupEventListeners();
        this.trackReferralClicks();
    }

    getCurrentUser() {
        const token = localStorage.getItem('token');
        if (!token) return null;
        
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload;
        } catch (error) {
            console.error('Error parsing token:', error);
            return null;
        }
    }

    addShareButtonsToProducts() {
        // Add share buttons to all product cards
        const productCards = document.querySelectorAll('.product-card, .product-item, [data-product-id]');
        
        productCards.forEach(card => {
            if (card.querySelector('.share-button')) return; // Already has share button
            
            const productId = card.dataset.productId || card.querySelector('[data-product-id]')?.dataset.productId;
            if (!productId) return;

            const shareButton = this.createShareButton(productId);
            
            // Find the best place to insert the share button
            const actionArea = card.querySelector('.product-actions, .card-footer, .product-info');
            if (actionArea) {
                actionArea.appendChild(shareButton);
            } else {
                card.appendChild(shareButton);
            }
        });
    }

    createShareButton(productId) {
        const shareButton = document.createElement('button');
        shareButton.className = 'share-button btn btn-outline-primary btn-sm';
        shareButton.innerHTML = `
            <i class="fas fa-share-alt"></i> Share & Earn $50
        `;
        shareButton.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.openShareModal(productId);
        };
        
        return shareButton;
    }

    async openShareModal(productId) {
        if (!this.currentUser) {
            this.showLoginPrompt();
            return;
        }

        // Get product details
        const product = await this.getProductDetails(productId);
        if (!product) {
            alert('Product not found');
            return;
        }

        const modal = this.createShareModal(product);
        document.body.appendChild(modal);
        
        // Show modal
        const bootstrapModal = new bootstrap.Modal(modal);
        bootstrapModal.show();
        
        // Remove modal when hidden
        modal.addEventListener('hidden.bs.modal', () => {
            modal.remove();
        });
    }

    createShareModal(product) {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-share-alt text-primary"></i>
                            Share & Earn $50 Commission
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <!-- Product Preview -->
                        <div class="row mb-4">
                            <div class="col-md-4">
                                <img src="/uploads/${product.main_image || 'placeholder.jpg'}" 
                                     class="img-fluid rounded" alt="${product.name}">
                            </div>
                            <div class="col-md-8">
                                <h6>${product.name}</h6>
                                <p class="text-muted">${product.description?.substring(0, 100)}...</p>
                                <h5 class="text-success">$${product.price}</h5>
                            </div>
                        </div>

                        <!-- Earning Info -->
                        <div class="alert alert-success">
                            <i class="fas fa-dollar-sign"></i>
                            <strong>Earn $50</strong> when someone registers and buys this product using your link!
                        </div>

                        <!-- Share Platforms -->
                        <h6>Choose Platform to Share:</h6>
                        <div class="row g-3" id="share-platforms">
                            <div class="col-6 col-md-4">
                                <button class="btn btn-primary w-100 share-platform-btn" data-platform="facebook">
                                    <i class="fab fa-facebook-f"></i> Facebook
                                </button>
                            </div>
                            <div class="col-6 col-md-4">
                                <button class="btn btn-info w-100 share-platform-btn" data-platform="twitter">
                                    <i class="fab fa-twitter"></i> Twitter
                                </button>
                            </div>
                            <div class="col-6 col-md-4">
                                <button class="btn btn-success w-100 share-platform-btn" data-platform="whatsapp">
                                    <i class="fab fa-whatsapp"></i> WhatsApp
                                </button>
                            </div>
                            <div class="col-6 col-md-4">
                                <button class="btn btn-primary w-100 share-platform-btn" data-platform="telegram">
                                    <i class="fab fa-telegram"></i> Telegram
                                </button>
                            </div>
                            <div class="col-6 col-md-4">
                                <button class="btn btn-primary w-100 share-platform-btn" data-platform="linkedin">
                                    <i class="fab fa-linkedin"></i> LinkedIn
                                </button>
                            </div>
                            <div class="col-6 col-md-4">
                                <button class="btn btn-secondary w-100 share-platform-btn" data-platform="email">
                                    <i class="fas fa-envelope"></i> Email
                                </button>
                            </div>
                        </div>

                        <!-- Copy Link Section -->
                        <div class="mt-4">
                            <h6>Or Copy Your Referral Link:</h6>
                            <div class="input-group">
                                <input type="text" class="form-control" id="referral-link" readonly 
                                       placeholder="Click a platform above to generate your link">
                                <button class="btn btn-outline-secondary" type="button" id="copy-link-btn" disabled>
                                    <i class="fas fa-copy"></i> Copy
                                </button>
                            </div>
                        </div>

                        <!-- Share Statistics -->
                        <div class="mt-4" id="share-stats" style="display: none;">
                            <h6>Your Sharing Performance:</h6>
                            <div class="row text-center">
                                <div class="col-4">
                                    <div class="border rounded p-2">
                                        <div class="h5 mb-0" id="clicks-count">0</div>
                                        <small class="text-muted">Clicks</small>
                                    </div>
                                </div>
                                <div class="col-4">
                                    <div class="border rounded p-2">
                                        <div class="h5 mb-0" id="registrations-count">0</div>
                                        <small class="text-muted">Registrations</small>
                                    </div>
                                </div>
                                <div class="col-4">
                                    <div class="border rounded p-2">
                                        <div class="h5 mb-0" id="earnings-count">$0</div>
                                        <small class="text-muted">Earned</small>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        <a href="/buyer/referrals" class="btn btn-primary">
                            <i class="fas fa-chart-line"></i> View All Earnings
                        </a>
                    </div>
                </div>
            </div>
        `;

        // Setup platform buttons
        modal.querySelectorAll('.share-platform-btn').forEach(btn => {
            btn.onclick = () => this.shareToPlat form(product.id, btn.dataset.platform, modal);
        });

        // Setup copy button
        modal.querySelector('#copy-link-btn').onclick = () => this.copyReferralLink(modal);

        return modal;
    }

    async shareToPlat form(productId, platform, modal) {
        try {
            // Show loading
            const btn = modal.querySelector(`[data-platform="${platform}"]`);
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
            btn.disabled = true;

            // Generate share link
            const response = await fetch(`${this.apiUrl}/referrals/share-product`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    product_id: productId,
                    platform: platform
                })
            });

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to generate share link');
            }

            // Update referral link input
            const linkInput = modal.querySelector('#referral-link');
            linkInput.value = data.share_url;
            modal.querySelector('#copy-link-btn').disabled = false;

            // Open platform-specific share URL
            if (platform === 'copy_link') {
                this.copyToClipboard(data.share_url);
                this.showToast('Link copied to clipboard!', 'success');
            } else {
                window.open(data.platform_url, '_blank', 'width=600,height=400');
            }

            // Load and show statistics
            this.loadShareStatistics(productId, modal);

            // Restore button
            btn.innerHTML = originalText;
            btn.disabled = false;

        } catch (error) {
            console.error('Share error:', error);
            alert('Failed to generate share link: ' + error.message);
            
            // Restore button
            const btn = modal.querySelector(`[data-platform="${platform}"]`);
            btn.innerHTML = btn.innerHTML.replace('<i class="fas fa-spinner fa-spin"></i> Generating...', originalText);
            btn.disabled = false;
        }
    }

    async loadShareStatistics(productId, modal) {
        try {
            const response = await fetch(`${this.apiUrl}/referrals/earnings`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const data = await response.json();
            if (data.success) {
                // Find statistics for this product
                const productShare = data.product_shares.find(ps => ps.product_id == productId);
                if (productShare) {
                    modal.querySelector('#clicks-count').textContent = productShare.clicks_count;
                    modal.querySelector('#registrations-count').textContent = productShare.registrations_count;
                    modal.querySelector('#earnings-count').textContent = `$${productShare.total_earnings}`;
                    modal.querySelector('#share-stats').style.display = 'block';
                }
            }
        } catch (error) {
            console.error('Failed to load share statistics:', error);
        }
    }

    copyReferralLink(modal) {
        const linkInput = modal.querySelector('#referral-link');
        if (!linkInput.value) {
            alert('Please select a platform first to generate your referral link');
            return;
        }

        this.copyToClipboard(linkInput.value);
        this.showToast('Referral link copied to clipboard!', 'success');
    }

    copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text);
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        }
    }

    async getProductDetails(productId) {
        try {
            const response = await fetch(`${this.apiUrl}/products/${productId}`);
            const data = await response.json();
            return data.success ? data.product : null;
        } catch (error) {
            console.error('Failed to get product details:', error);
            return null;
        }
    }

    showLoginPrompt() {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Login Required</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p>You need to be logged in to share products and earn commissions.</p>
                        <p><strong>Join now and start earning $50 for each successful referral!</strong></p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <a href="/login" class="btn btn-primary">Login</a>
                        <a href="/register" class="btn btn-success">Register Now</a>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bootstrapModal = new bootstrap.Modal(modal);
        bootstrapModal.show();

        modal.addEventListener('hidden.bs.modal', () => {
            modal.remove();
        });
    }

    trackReferralClicks() {
        // Check if current page has referral code in URL
        const urlParams = new URLSearchParams(window.location.search);
        const referralCode = urlParams.get('ref');
        
        if (referralCode) {
            // Generate or get session ID
            let sessionId = localStorage.getItem('referral_session_id');
            if (!sessionId) {
                sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                localStorage.setItem('referral_session_id', sessionId);
            }

            // Store referral data in localStorage for persistence
            const referralData = {
                referral_code: referralCode,
                product_id: this.getProductIdFromUrl(),
                session_id: sessionId,
                clicked_at: new Date().toISOString(),
                current_url: window.location.href
            };
            localStorage.setItem('referral_data', JSON.stringify(referralData));

            // Track the click
            fetch(`${this.apiUrl}/referrals/track-click`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    referral_code: referralCode,
                    product_id: referralData.product_id,
                    session_id: sessionId
                })
            }).then(response => response.json())
            .then(data => {
                if (data.success && data.redirect_url) {
                    // Store the intended redirect URL
                    localStorage.setItem('referral_redirect_url', data.redirect_url);
                    console.log('✅ Referral click tracked, redirect URL stored:', data.redirect_url);
                }
            }).catch(error => {
                console.error('Failed to track referral click:', error);
            });

            // Show referral banner
            this.showReferralBanner(referralCode);
        }
    }

    getProductIdFromUrl() {
        // Extract product ID from URL patterns like /product/123 or /products/123
        const pathParts = window.location.pathname.split('/');
        const productIndex = pathParts.findIndex(part => part === 'product' || part === 'products');
        return productIndex !== -1 && pathParts[productIndex + 1] ? pathParts[productIndex + 1] : null;
    }

    showReferralBanner(referralCode) {
        // Don't show banner if user is already logged in
        if (this.currentUser) return;

        const banner = document.createElement('div');
        banner.className = 'alert alert-success alert-dismissible fade show position-fixed';
        banner.style.cssText = 'top: 20px; right: 20px; z-index: 1050; max-width: 400px;';
        banner.innerHTML = `
            <i class="fas fa-gift"></i>
            <strong>Special Offer!</strong> 
            Register now using this referral link and get special bonuses!
            <div class="mt-2">
                <a href="/register?ref=${referralCode}" class="btn btn-sm btn-light me-2">Register Now</a>
                <a href="/login?ref=${referralCode}" class="btn btn-sm btn-outline-light">Login</a>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        document.body.appendChild(banner);

        // Auto-hide after 10 seconds
        setTimeout(() => {
            if (banner.parentNode) {
                banner.remove();
            }
        }, 10000);
    }

    showToast(message, type = 'info') {
        // Create toast container if it doesn't exist
        let toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
            document.body.appendChild(toastContainer);
        }

        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-white bg-${type} border-0`;
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;

        toastContainer.appendChild(toast);
        const bootstrapToast = new bootstrap.Toast(toast);
        bootstrapToast.show();

        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
    }

    setupEventListeners() {
        // Re-add share buttons when new products are loaded (for dynamic content)
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1) { // Element node
                            const productCards = node.querySelectorAll ? 
                                node.querySelectorAll('.product-card, .product-item, [data-product-id]') : [];
                            
                            productCards.forEach(card => {
                                if (!card.querySelector('.share-button')) {
                                    const productId = card.dataset.productId || 
                                        card.querySelector('[data-product-id]')?.dataset.productId;
                                    if (productId) {
                                        const shareButton = this.createShareButton(productId);
                                        const actionArea = card.querySelector('.product-actions, .card-footer, .product-info');
                                        if (actionArea) {
                                            actionArea.appendChild(shareButton);
                                        } else {
                                            card.appendChild(shareButton);
                                        }
                                    }
                                }
                            });
                        }
                    });
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
}

// Initialize the product share system when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.productShareSystem = new ProductShareSystem();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProductShareSystem;
}