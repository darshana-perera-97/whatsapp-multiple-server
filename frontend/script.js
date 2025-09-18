// API Configuration
const API_BASE_URL = 'http://localhost:5050/api';

// Global State
let currentUser = null;
let qrCodeInterval = null;

// DOM Elements
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const dashboard = document.getElementById('dashboard');
const navMenu = document.getElementById('navMenu');
const logoutBtn = document.getElementById('logoutBtn');

// Initialize App
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is already logged in
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showDashboard();
    } else {
        showLogin();
    }

    // Set up form event listeners
    setupFormListeners();
});

// Form Event Listeners
function setupFormListeners() {
    // Login form
    document.getElementById('loginFormElement').addEventListener('submit', handleLogin);
    
    // Register form
    document.getElementById('registerFormElement').addEventListener('submit', handleRegister);
}

// Show/Hide Functions
function showLogin() {
    hideAllSections();
    loginForm.style.display = 'flex';
    updateNavigation(false);
}

function showRegister() {
    hideAllSections();
    registerForm.style.display = 'flex';
    updateNavigation(false);
}

function showDashboard() {
    hideAllSections();
    dashboard.style.display = 'block';
    updateNavigation(true);
    
    if (currentUser) {
        displayUserInfo();
        checkWhatsAppStatus();
    }
}

function hideAllSections() {
    loginForm.style.display = 'none';
    registerForm.style.display = 'none';
    dashboard.style.display = 'none';
}

function updateNavigation(isLoggedIn) {
    const navLinks = navMenu.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        if (link.id === 'logoutBtn') {
            link.style.display = isLoggedIn ? 'block' : 'none';
        } else {
            link.style.display = isLoggedIn ? 'none' : 'block';
        }
    });
}

// User Authentication
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE_URL}/users/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.user;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            showToast('Login successful!', 'success');
            showDashboard();
        } else {
            showToast(data.message || 'Login failed', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
        console.error('Login error:', error);
    } finally {
        hideLoading();
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    // Validate passwords match
    if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }
    
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE_URL}/users/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('Registration successful! Please login.', 'success');
            showLogin();
            // Clear form
            document.getElementById('registerFormElement').reset();
        } else {
            showToast(data.message || 'Registration failed', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
        console.error('Registration error:', error);
    } finally {
        hideLoading();
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    showToast('Logged out successfully', 'info');
    showLogin();
    
    // Clear any ongoing QR code checks
    if (qrCodeInterval) {
        clearInterval(qrCodeInterval);
        qrCodeInterval = null;
    }
}

// Dashboard Functions
function displayUserInfo() {
    if (currentUser) {
        document.getElementById('userEmail').textContent = currentUser.email;
        document.getElementById('userId').textContent = currentUser.userId;
        document.getElementById('userCreatedAt').textContent = new Date(currentUser.createdAt).toLocaleDateString();
    }
}

async function checkWhatsAppStatus() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/users/${currentUser.userId}/whatsapp/status`);
        const data = await response.json();
        
        updateWhatsAppStatus(data);
    } catch (error) {
        console.error('Error checking WhatsApp status:', error);
        updateWhatsAppStatus({ status: 'error', message: 'Failed to check status' });
    }
}

function updateWhatsAppStatus(data) {
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    const connectionInfo = document.getElementById('connectionInfo');
    const qrCodeCard = document.getElementById('qrCodeCard');
    const getQrBtn = document.getElementById('getQrBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');
    
    // Update status indicator
    statusIndicator.className = 'status-indicator';
    
    if (data.status === 'connected') {
        statusIndicator.classList.add('connected');
        statusText.textContent = 'Connected';
        
        // Show connection info
        document.getElementById('whatsappName').textContent = data.connectionInfo.name;
        document.getElementById('whatsappPhone').textContent = data.connectionInfo.phone;
        document.getElementById('whatsappPlatform').textContent = data.connectionInfo.platform;
        connectionInfo.style.display = 'block';
        
        // Hide QR code, show disconnect button
        qrCodeCard.style.display = 'none';
        getQrBtn.style.display = 'none';
        disconnectBtn.style.display = 'inline-flex';
        
    } else if (data.status === 'disconnected') {
        statusIndicator.classList.add('disconnected');
        statusText.textContent = 'Disconnected';
        
        // Hide connection info and disconnect button
        connectionInfo.style.display = 'none';
        qrCodeCard.style.display = 'none';
        getQrBtn.style.display = 'inline-flex';
        disconnectBtn.style.display = 'none';
        
    } else {
        statusIndicator.classList.add('checking');
        statusText.textContent = 'Checking...';
    }
}

async function getQRCode() {
    if (!currentUser) return;
    
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE_URL}/users/${currentUser.userId}/whatsapp/qr`);
        const data = await response.json();
        
        if (response.ok) {
            if (data.status === 'qr_ready') {
                displayQRCode(data.qrCode);
                showToast('QR code generated. Scan with your WhatsApp app.', 'info');
                
                // Start checking status periodically
                startStatusCheck();
            } else if (data.status === 'connected') {
                showToast('WhatsApp is already connected!', 'success');
                checkWhatsAppStatus();
            }
        } else {
            showToast(data.message || 'Failed to get QR code', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
        console.error('Error getting QR code:', error);
    } finally {
        hideLoading();
    }
}

function displayQRCode(qrCodeDataURL) {
    const qrCodeDisplay = document.getElementById('qrCodeDisplay');
    const qrCodeCard = document.getElementById('qrCodeCard');
    
    qrCodeDisplay.innerHTML = `<img src="${qrCodeDataURL}" alt="WhatsApp QR Code">`;
    qrCodeCard.style.display = 'block';
}

function startStatusCheck() {
    // Check status every 3 seconds
    qrCodeInterval = setInterval(async () => {
        await checkWhatsAppStatus();
        
        // Stop checking if connected
        const statusText = document.getElementById('statusText').textContent;
        if (statusText === 'Connected') {
            clearInterval(qrCodeInterval);
            qrCodeInterval = null;
        }
    }, 3000);
}

async function disconnectWhatsApp() {
    if (!currentUser) return;
    
    if (!confirm('Are you sure you want to disconnect your WhatsApp account?')) {
        return;
    }
    
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE_URL}/users/${currentUser.userId}/whatsapp/disconnect`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('WhatsApp disconnected successfully', 'success');
            checkWhatsAppStatus();
        } else {
            showToast(data.message || 'Failed to disconnect', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
        console.error('Error disconnecting WhatsApp:', error);
    } finally {
        hideLoading();
    }
}

// Utility Functions
function showLoading() {
    document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = getToastIcon(type);
    toast.innerHTML = `
        <i class="${icon}"></i>
        <span>${message}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    // Remove toast after 5 seconds
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

function getToastIcon(type) {
    switch (type) {
        case 'success':
            return 'fas fa-check-circle';
        case 'error':
            return 'fas fa-exclamation-circle';
        case 'warning':
            return 'fas fa-exclamation-triangle';
        case 'info':
        default:
            return 'fas fa-info-circle';
    }
}

// Export functions for global access
window.showLogin = showLogin;
window.showRegister = showRegister;
window.logout = logout;
window.getQRCode = getQRCode;
window.checkWhatsAppStatus = checkWhatsAppStatus;
window.disconnectWhatsApp = disconnectWhatsApp;
