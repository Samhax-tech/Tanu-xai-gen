/**
 * Frontend JavaScript for Tanu Xai Session Generator
 * Handles user interaction and API communication
 */

let currentSessionId = null;
let statusCheckInterval = null;
let currentPairingCode = null;

// DOM Elements
const phoneForm = document.getElementById('phone-form');
const phoneInput = document.getElementById('phone-input');
const generateBtn = document.getElementById('generate-btn');
const phoneError = document.getElementById('phone-error');

const stepPhone = document.getElementById('step-phone');
const stepCode = document.getElementById('step-code');
const stepConnected = document.getElementById('step-connected');
const stepError = document.getElementById('step-error');

const pairingCodeEl = document.getElementById('pairing-code');
const statusText = document.getElementById('status-text');
const authSpinner = document.getElementById('auth-spinner');
const connectedInfo = document.getElementById('connected-info');
const errorMessage = document.getElementById('error-message');
const copyBtn = document.getElementById('copy-btn');

/**
 * Show a specific step
 */
function showStep(stepElement) {
    document.querySelectorAll('.step').forEach(step => {
        step.classList.remove('active');
    });
    stepElement.classList.add('active');
}

/**
 * Format pairing code as XXXX-XXXX
 */
function formatPairingCode(code) {
    if (!code || code.length !== 8) {
        return code;
    }
    return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/**
 * Copy pairing code to clipboard
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        if (copyBtn) {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = '✓ Copied!';
            copyBtn.disabled = true;
            setTimeout(() => {
                copyBtn.textContent = originalText;
                copyBtn.disabled = false;
            }, 2000);
        }
        return true;
    } catch (err) {
        console.error('Failed to copy:', err);
        return false;
    }
}

/**
 * Start session with phone number
 */
async function startSession(phoneNumber) {
    try {
        generateBtn.disabled = true;
        generateBtn.textContent = 'Creating session...';
        phoneError.textContent = '';

        const response = await fetch('/api/session/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ phoneNumber })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to start session');
        }

        currentSessionId = data.sessionId;
        
        // Request pairing code
        await requestPairingCode();

    } catch (error) {
        console.error('Start session error:', error);
        phoneError.textContent = error.message;
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate Pairing Code';
    }
}

/**
 * Request pairing code from server
 */
async function requestPairingCode() {
    try {
        generateBtn.textContent = 'Generating code...';
        
        const response = await fetch(`/api/session/${currentSessionId}/pairing-code`, {
            method: 'POST'
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || data.message || 'Failed to get pairing code');
        }

        // Store and display formatted pairing code
        currentPairingCode = data.pairingCode;
        pairingCodeEl.textContent = formatPairingCode(data.pairingCode);

        // Setup copy button
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                copyToClipboard(currentPairingCode);
            });
        }

        // Move to code step
        showStep(stepCode);

        // Start polling for status
        startStatusPolling();

    } catch (error) {
        console.error('Request pairing code error:', error);
        showError(error.message);
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate Pairing Code';
    }
}

/**
 * Poll session status
 */
async function checkStatus() {
    try {
        const response = await fetch(`/api/session/${currentSessionId}/status`);
        
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('Session not found');
            }
            throw new Error('Failed to get status');
        }

        const status = await response.json();

        updateStatusUI(status);

        if (status.status === 'connected') {
            stopStatusPolling();
            showConnected(status);
        } else if (status.status === 'failed' || status.status === 'logged_out') {
            stopStatusPolling();
            showError('Authentication failed or logged out. Please try again.');
        }

    } catch (error) {
        console.error('Status check error:', error);
        stopStatusPolling();
        showError(error.message);
    }
}

/**
 * Update status text based on session status
 */
function updateStatusUI(status) {
    const statusMessages = {
        'created': 'Initializing session...',
        'initializing': 'Initializing session...',
        'connecting': 'Connecting to WhatsApp...',
        'requesting_pairing_code': 'Requesting pairing code...',
        'waiting_for_auth': 'Waiting for authentication...',
        'authenticating': 'Authenticating...',
        'reconnecting': 'Reconnecting...',
        'connected': 'Connected!'
    };

    statusText.textContent = statusMessages[status.status] || 'Processing...';
}

/**
 * Show connected state
 */
function showConnected(status) {
    authSpinner.style.display = 'none';
    
    const phoneDisplay = status.phone ? `WhatsApp: ${status.phone}` : 'WhatsApp authenticated';
    connectedInfo.textContent = phoneDisplay;
    
    showStep(stepConnected);
}

/**
 * Show error state
 */
function showError(message) {
    errorMessage.textContent = message;
    showStep(stepError);
}

/**
 * Start status polling
 */
function startStatusPolling() {
    // Check immediately
    checkStatus();
    
    // Then poll every 3 seconds
    statusCheckInterval = setInterval(checkStatus, 3000);
}

/**
 * Stop status polling
 */
function stopStatusPolling() {
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        statusCheckInterval = null;
    }
}

/**
 * Validate phone number format on frontend
 */
function validatePhoneInput(phoneNumber) {
    const trimmed = phoneNumber.trim();
    
    if (!trimmed) {
        return 'Phone number is required';
    }

    // Remove non-digits except leading +
    const digitsOnly = trimmed.replace(/^\+/, '').replace(/\D/g, '');
    
    if (digitsOnly.length < 8) {
        return 'Phone number is too short. Include country code.';
    }
    
    if (digitsOnly.length > 15) {
        return 'Phone number is too long';
    }

    if (digitsOnly.startsWith('0')) {
        return 'Phone number must include country code (do not start with 0)';
    }

    return null;
}

// Event Listeners
phoneForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const phoneNumber = phoneInput.value.trim();
    const validationError = validatePhoneInput(phoneNumber);
    
    if (validationError) {
        phoneError.textContent = validationError;
        return;
    }

    await startSession(phoneNumber);
});

// Input formatting - allow only digits and leading +
phoneInput.addEventListener('input', (e) => {
    let value = e.target.value;
    
    // Allow only digits and one leading +
    if (value.startsWith('+')) {
        value = '+' + value.slice(1).replace(/[^\d]/g, '');
    } else {
        value = value.replace(/[^\d+]/g, '');
    }
    
    e.target.value = value;
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopStatusPolling();
});
