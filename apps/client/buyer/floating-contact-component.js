/**
 * Floating Contact Component for Buyer Pages
 * Provides WhatsApp contact icon and dynamic messages
 */

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    whatsappNumber: '+250788910639', // Updated with correct WhatsApp business number
    messageInterval: 15000, // Show message every 15 seconds
    messageDisplayTime: 8000, // Show message for 8 seconds
    maxMessages: 3, // Maximum messages to cycle through
    animationDuration: 300
  };

  // Dynamic messages that will be shown
  const DYNAMIC_MESSAGES = [
    {
      text: "🛍️ Need help finding the perfect product?",
      icon: "🛍️",
      action: "Find Products"
    },
    {
      text: "💬 Have questions? Chat with our support team!",
      icon: "💬",
      action: "Get Help"
    },
    {
      text: "🚚 Check shipping options to your location",
      icon: "🚚",
      action: "Shipping Info"
    },
    {
      text: "⭐ Special deals available! Ask us about them!",
      icon: "⭐",
      action: "View Deals"
    },
    {
      text: "🔔 Get notifications for new products & offers",
      icon: "🔔",
      action: "Subscribe"
    }
  ];

  // Component state
  let isMessageVisible = false;
  let currentMessageIndex = 0;
  let messageInterval = null;
  let hideTimeout = null;
  let componentInitialized = false;

  // Initialize the floating contact component
  function initFloatingContact() {
    if (componentInitialized) return;
    
    console.log('[FLOATING-CONTACT] Initializing floating contact component...');
    
    // Create the main container
    createFloatingContainer();
    
    // Create WhatsApp button
    createWhatsAppButton();
    
    // Create message display
    createMessageDisplay();
    
    // Start message cycle
    startMessageCycle();
    
    // Add styles
    addComponentStyles();
    
    componentInitialized = true;
    console.log('[FLOATING-CONTACT] Component initialized successfully');
  }

  // Create the main floating container
  function createFloatingContainer() {
    const container = document.createElement('div');
    container.id = 'floating-contact-container';
    container.className = 'floating-contact-container';
    
    document.body.appendChild(container);
  }

  // Create WhatsApp contact button
  function createWhatsAppButton() {
    const container = document.getElementById('floating-contact-container');
    
    const whatsappBtn = document.createElement('div');
    whatsappBtn.id = 'whatsapp-floating-btn';
    whatsappBtn.className = 'whatsapp-floating-btn';
    whatsappBtn.innerHTML = `
      <div class="whatsapp-btn-content">
        <svg width="28" height="28" viewBox="0 0 32 32" fill="white">
          <path d="M26.6667 15.7333C26.6667 22.2667 21.5333 27.4 15 27.4C12.9333 27.4 10.9333 26.8 9.2 25.7333L4 27.4L5.66667 22.2C4.53333 20.4 4 18.3333 4 16C4 9.46667 9.13333 4.33334 15.6667 4.33334C22.2 4.33334 26.6667 9.2 26.6667 15.7333ZM15.6667 6.66667C10.4 6.66667 6.33333 10.7333 6.33333 16C6.33333 18 7.06667 19.8667 8.33333 21.3333L7.33333 24.6667L10.8 23.6667C12.2667 24.6667 13.9333 25.0667 15.6667 25.0667C20.9333 25.0667 25 21 25 15.7333C25 10.4667 20.9333 6.66667 15.6667 6.66667Z"/>
        </svg>
        <div class="whatsapp-pulse"></div>
      </div>
    `;
    
    whatsappBtn.addEventListener('click', openWhatsAppChat);
    container.appendChild(whatsappBtn);
  }

  // Create message display area
  function createMessageDisplay() {
    const container = document.getElementById('floating-contact-container');
    
    const messageDisplay = document.createElement('div');
    messageDisplay.id = 'floating-message-display';
    messageDisplay.className = 'floating-message-display hidden';
    
    container.appendChild(messageDisplay);
  }

  // Start the message cycle
  function startMessageCycle() {
    // Show first message after 5 seconds
    setTimeout(() => {
      showNextMessage();
    }, 5000);
    
    // Then cycle through messages
    messageInterval = setInterval(() => {
      if (!isMessageVisible) {
        showNextMessage();
      }
    }, CONFIG.messageInterval);
  }

  // Show the next message in the cycle
  function showNextMessage() {
    if (isMessageVisible) return;
    
    const message = DYNAMIC_MESSAGES[currentMessageIndex];
    displayMessage(message);
    
    currentMessageIndex = (currentMessageIndex + 1) % DYNAMIC_MESSAGES.length;
  }

  // Display a specific message
  function displayMessage(message) {
    const messageDisplay = document.getElementById('floating-message-display');
    
    messageDisplay.innerHTML = `
      <div class="message-content">
        <button class="message-close" onclick="hideFloatingMessage()">&times;</button>
        <div class="message-body">
          <span class="message-icon">${message.icon}</span>
          <span class="message-text">${message.text}</span>
        </div>
        <div class="message-actions">
          <button class="message-action-btn" onclick="handleMessageAction('${message.action}')">${message.action}</button>
        </div>
      </div>
    `;
    
    // Show message
    messageDisplay.classList.remove('hidden');
    setTimeout(() => {
      messageDisplay.classList.add('show');
    }, 50);
    
    isMessageVisible = true;
    
    // Auto-hide after specified time
    hideTimeout = setTimeout(() => {
      hideFloatingMessage();
    }, CONFIG.messageDisplayTime);
    
    console.log('[FLOATING-CONTACT] Showing message:', message.text);
  }

  // Hide the floating message
  function hideFloatingMessage() {
    const messageDisplay = document.getElementById('floating-message-display');
    
    if (messageDisplay) {
      messageDisplay.classList.remove('show');
      setTimeout(() => {
        messageDisplay.classList.add('hidden');
      }, CONFIG.animationDuration);
    }
    
    isMessageVisible = false;
    
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }
  }

  // Handle message action clicks
  function handleMessageAction(action) {
    console.log('[FLOATING-CONTACT] Action clicked:', action);
    
    switch (action) {
      case 'Find Products':
        window.location.href = '/buyer/product-list.html';
        break;
      case 'Get Help':
        openWhatsAppChat('I need help with your platform. Can you assist me?');
        break;
      case 'Shipping Info':
        openWhatsAppChat('I would like to know about shipping options and costs to my location.');
        break;
      case 'View Deals':
        openWhatsAppChat('I heard you have special deals available. Can you tell me more?');
        break;
      case 'Subscribe':
        openWhatsAppChat('I would like to receive notifications about new products and special offers.');
        break;
      default:
        openWhatsAppChat();
    }
    
    hideFloatingMessage();
  }

  // Open WhatsApp chat
  function openWhatsAppChat(customMessage = null) {
    const defaultMessage = "Hi! I'm interested in your products and services. Can you help me?";
    const message = customMessage || defaultMessage;
    
    // Get current page context for better message
    const currentPage = window.location.pathname;
    let contextMessage = message;
    
    if (currentPage.includes('product-detail')) {
      const urlParams = new URLSearchParams(window.location.search);
      const productId = urlParams.get('id');
      if (productId) {
        contextMessage = `Hi! I'm interested in product ID: ${productId}. ${message}`;
      }
    }
    
    const whatsappUrl = `https://wa.me/${CONFIG.whatsappNumber.replace(/[^\d]/g, '')}?text=${encodeURIComponent(contextMessage)}`;
    window.open(whatsappUrl, '_blank');
    
    console.log('[FLOATING-CONTACT] Opening WhatsApp chat with message:', contextMessage);
  }

  // Add component styles
  function addComponentStyles() {
    if (document.getElementById('floating-contact-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'floating-contact-styles';
    styles.textContent = `
      .floating-contact-container {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 10px;
      }

      .whatsapp-floating-btn {
        position: relative;
        width: 60px;
        height: 60px;
        background: linear-gradient(135deg, #25d366 0%, #128c7e 100%);
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 4px 20px rgba(37, 211, 102, 0.4);
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .whatsapp-floating-btn:hover {
        transform: translateY(-2px) scale(1.05);
        box-shadow: 0 8px 30px rgba(37, 211, 102, 0.6);
      }

      .whatsapp-btn-content {
        position: relative;
        z-index: 2;
      }

      .whatsapp-pulse {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 60px;
        height: 60px;
        border: 3px solid #25d366;
        border-radius: 50%;
        animation: pulse 2s infinite;
        opacity: 0.7;
      }

      @keyframes pulse {
        0% {
          transform: translate(-50%, -50%) scale(1);
          opacity: 0.7;
        }
        50% {
          transform: translate(-50%, -50%) scale(1.3);
          opacity: 0.3;
        }
        100% {
          transform: translate(-50%, -50%) scale(1.6);
          opacity: 0;
        }
      }

      .floating-message-display {
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        max-width: 300px;
        margin-right: 10px;
        transform: translateY(20px);
        opacity: 0;
        transition: all 0.3s ease;
        border: 1px solid #e5e7eb;
      }

      .floating-message-display.show {
        transform: translateY(0);
        opacity: 1;
      }

      .floating-message-display.hidden {
        display: none;
      }

      .message-content {
        position: relative;
        padding: 16px;
      }

      .message-close {
        position: absolute;
        top: 8px;
        right: 8px;
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #6b7280;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: all 0.2s ease;
      }

      .message-close:hover {
        background: #f3f4f6;
        color: #374151;
      }

      .message-body {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
        padding-right: 20px;
      }

      .message-icon {
        font-size: 20px;
        flex-shrink: 0;
      }

      .message-text {
        font-size: 14px;
        color: #374151;
        line-height: 1.4;
      }

      .message-actions {
        display: flex;
        gap: 8px;
      }

      .message-action-btn {
        background: #25d366;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .message-action-btn:hover {
        background: #128c7e;
        transform: translateY(-1px);
      }

      /* Mobile responsive */
      @media (max-width: 768px) {
        .floating-contact-container {
          bottom: 15px;
          right: 15px;
        }

        .whatsapp-floating-btn {
          width: 50px;
          height: 50px;
        }

        .whatsapp-floating-btn svg {
          width: 24px;
          height: 24px;
        }

        .whatsapp-pulse {
          width: 50px;
          height: 50px;
        }

        .floating-message-display {
          max-width: 260px;
          margin-right: 5px;
        }

        .message-text {
          font-size: 13px;
        }
      }

      /* Animation for smooth entrance */
      @keyframes slideInUp {
        from {
          transform: translateY(100px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }

      .floating-contact-container {
        animation: slideInUp 0.5s ease-out;
      }
    `;
    
    document.head.appendChild(styles);
  }

  // Public API
  window.FloatingContact = {
    init: initFloatingContact,
    showMessage: displayMessage,
    hideMessage: hideFloatingMessage,
    openWhatsApp: openWhatsAppChat
  };

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFloatingContact);
  } else {
    initFloatingContact();
  }

  // Make hideFloatingMessage globally available for the close button
  window.hideFloatingMessage = hideFloatingMessage;
  window.handleMessageAction = handleMessageAction;

})();