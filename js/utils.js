// Utility Functions
class Utils {
    // Format currency
    static formatCurrency(amount, currency = '₱') {
        return `${currency}${parseFloat(amount || 0).toFixed(2)}`;
    }
    
    // Format date
    static formatDate(dateString, includeTime = true) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid Date';
        
        if (includeTime) {
            return date.toLocaleString();
        }
        return date.toLocaleDateString();
    }
    
    // Format number with commas
    static formatNumber(number) {
        return parseFloat(number || 0).toLocaleString('en-US');
    }
    
    // Calculate percentage
    static calculatePercentage(part, total) {
        if (!total || total === 0) return 0;
        return ((part / total) * 100).toFixed(1);
    }
    
    // Generate unique ID
    static generateId() {
        return Date.now() + Math.random().toString(36).substr(2, 9);
    }
    
    // Debounce function for search inputs
    static debounce(func, wait, immediate) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func(...args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func(...args);
        };
    }
    
    // Validate email
    static validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
    
    // Validate phone number (Philippines format)
    static validatePhone(phone) {
        const re = /^(09|\+639)\d{9}$/;
        return re.test(phone.replace(/\s/g, ''));
    }
    
    // Sanitize input
    static sanitizeInput(input) {
        if (!input) return '';
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    }
    
    // Download file
    static downloadFile(content, filename, contentType = 'text/plain') {
        const blob = new Blob([content], { type: contentType });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
    }
    
    // Copy to clipboard
    static copyToClipboard(text) {
        return new Promise((resolve, reject) => {
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(text).then(resolve).catch(reject);
            } else {
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    document.execCommand('copy');
                    resolve();
                } catch (err) {
                    reject(err);
                }
                document.body.removeChild(textArea);
            }
        });
    }
    
    // Get current date in YYYY-MM-DD format
    static getCurrentDate() {
        return new Date().toISOString().split('T')[0];
    }
    
    // Get current datetime in local format
    static getCurrentDateTime() {
        return new Date().toISOString().slice(0, 16);
    }
    
    // Calculate date range for filters
    static getDateRange(period) {
        const now = new Date();
        const start = new Date();
        
        switch (period) {
            case 'today':
                start.setHours(0, 0, 0, 0);
                break;
            case 'week':
                start.setDate(now.getDate() - 7);
                break;
            case 'month':
                start.setMonth(now.getMonth() - 1);
                break;
            case 'year':
                start.setFullYear(now.getFullYear() - 1);
                break;
            default:
                start.setFullYear(2000); // All time
        }
        
        return {
            start: start.toISOString(),
            end: now.toISOString()
        };
    }
    
    // Calculate age from date
    static calculateAge(birthDate) {
        if (!birthDate) return 0;
        const today = new Date();
        const birth = new Date(birthDate);
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        
        return age;
    }
    
    // Generate random color
    static generateColor() {
        return '#' + Math.floor(Math.random() * 16777215).toString(16);
    }
    
    // Format file size
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    // Check if value is empty
    static isEmpty(value) {
        if (value === null || value === undefined) return true;
        if (typeof value === 'string') return value.trim().length === 0;
        if (Array.isArray(value)) return value.length === 0;
        if (typeof value === 'object') return Object.keys(value).length === 0;
        return false;
    }
    
    // Deep clone object
    static deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }
    
    // Merge objects
    static mergeObjects(target, source) {
        for (const key in source) {
            if (source[key] instanceof Object && key in target) {
                Object.assign(source[key], this.mergeObjects(target[key], source[key]));
            }
        }
        return Object.assign(target || {}, source);
    }
}

// Toast notification system
class ToastManager {
    constructor() {
        this.container = document.getElementById('toast-container');
        if (!this.container) {
            this.createContainer();
        }
    }
    
    createContainer() {
        this.container = document.createElement('div');
        this.container.id = 'toast-container';
        this.container.className = 'toast-container';
        document.body.appendChild(this.container);
    }
    
    show(message, type = 'success', duration = 3000) {
        // Remove all existing toasts to prevent piling up - only show one at a time
        if (this.container) {
            const existingToasts = this.container.querySelectorAll('.toast');
            existingToasts.forEach(toast => {
                toast.style.animation = 'slideIn 0.3s ease reverse';
                setTimeout(() => {
                    if (toast.parentElement) {
                        toast.remove();
                    }
                }, 100);
            });
        }
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-times-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        
        const titles = {
            success: 'Success',
            error: 'Error',
            warning: 'Warning',
            info: 'Information'
        };
        
        toast.innerHTML = `
            <div class="toast-icon"><i class="fas ${icons[type]}"></i></div>
            <div class="toast-content">
                <div class="toast-title">${titles[type]}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        this.container.appendChild(toast);
        
        // Auto remove after duration
        setTimeout(() => {
            if (toast.parentElement) {
                toast.style.animation = 'slideIn 0.3s ease reverse';
                setTimeout(() => toast.remove(), 300);
            }
        }, duration);
        
        return toast;
    }
    
    success(message, duration) {
        return this.show(message, 'success', duration);
    }
    
    error(message, duration) {
        return this.show(message, 'error', duration);
    }
    
    warning(message, duration) {
        return this.show(message, 'warning', duration);
    }
    
    info(message, duration) {
        return this.show(message, 'info', duration);
    }
}

// Loading overlay manager
class LoadingManager {
    constructor() {
        this.overlay = document.getElementById('loading');
        if (!this.overlay) {
            this.createOverlay();
        }
    }
    
    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'loading';
        this.overlay.className = 'loading-overlay';
        this.overlay.innerHTML = '<div class="spinner"></div>';
        document.body.appendChild(this.overlay);
    }
    
    show() {
        this.overlay.classList.add('active');
    }
    
    hide() {
        this.overlay.classList.remove('active');
    }
    
    async withLoading(callback) {
        this.show();
        try {
            const result = await callback();
            return result;
        } finally {
            this.hide();
        }
    }
}

// Modal manager
class ModalManager {
    constructor() {
        this.activeModal = null;
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Close modal on ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activeModal) {
                this.close(this.activeModal);
            }
        });
        
        // Close modal on background click
        document.addEventListener('click', (e) => {
            if (this.activeModal && e.target.classList.contains('modal')) {
                this.close(this.activeModal);
            }
        });
    }
    
    open(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            // Close any currently active modal
            if (this.activeModal) {
                this.close(this.activeModal);
            }
            
            modal.classList.add('active');
            this.activeModal = modalId;
            
            // Focus first input if any
            const firstInput = modal.querySelector('input, select, textarea');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 100);
            }
        }
    }
    
    close(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            if (this.activeModal === modalId) {
                this.activeModal = null;
            }
        }
    }
    
    closeAll() {
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
        });
        this.activeModal = null;
    }
}

// Form validator
class FormValidator {
    constructor(formId) {
        this.form = document.getElementById(formId);
        this.errors = {};
        this.setupValidation();
    }
    
    setupValidation() {
        if (!this.form) return;
        
        // Add submit event listener
        this.form.addEventListener('submit', (e) => {
            if (!this.validate()) {
                e.preventDefault();
                this.showErrors();
            }
        });
        
        // Add input event listeners for real-time validation
        this.form.querySelectorAll('[data-validate]').forEach(input => {
            input.addEventListener('blur', () => {
                this.validateField(input);
                this.showFieldError(input);
            });
            
            input.addEventListener('input', () => {
                this.clearFieldError(input);
            });
        });
    }
    
    validate() {
        this.errors = {};
        let isValid = true;
        
        this.form.querySelectorAll('[data-validate]').forEach(field => {
            if (!this.validateField(field)) {
                isValid = false;
            }
        });
        
        return isValid;
    }
    
    validateField(field) {
        const value = field.value.trim();
        const rules = field.dataset.validate.split(' ');
        
        for (const rule of rules) {
            let fieldValid = true;
            let message = '';
            
            switch (rule) {
                case 'required':
                    if (!value) {
                        fieldValid = false;
                        message = 'This field is required';
                    }
                    break;
                    
                case 'email':
                    if (value && !Utils.validateEmail(value)) {
                        fieldValid = false;
                        message = 'Please enter a valid email address';
                    }
                    break;
                    
                case 'number':
                    if (value && isNaN(value)) {
                        fieldValid = false;
                        message = 'Please enter a valid number';
                    }
                    break;
                    
                case 'minlength':
                    const minLength = parseInt(field.dataset.minlength);
                    if (value && value.length < minLength) {
                        fieldValid = false;
                        message = `Minimum ${minLength} characters required`;
                    }
                    break;
                    
                case 'maxlength':
                    const maxLength = parseInt(field.dataset.maxlength);
                    if (value && value.length > maxLength) {
                        fieldValid = false;
                        message = `Maximum ${maxLength} characters allowed`;
                    }
                    break;
                    
                case 'min':
                    const min = parseFloat(field.dataset.min);
                    if (value && parseFloat(value) < min) {
                        fieldValid = false;
                        message = `Value must be at least ${min}`;
                    }
                    break;
                    
                case 'max':
                    const max = parseFloat(field.dataset.max);
                    if (value && parseFloat(value) > max) {
                        fieldValid = false;
                        message = `Value must be at most ${max}`;
                    }
                    break;
            }
            
            if (!fieldValid) {
                if (!this.errors[field.name]) {
                    this.errors[field.name] = [];
                }
                this.errors[field.name].push(message);
                return false;
            }
        }
        
        return true;
    }
    
    showErrors() {
        // Clear previous errors
        this.clearErrors();
        
        // Show new errors
        Object.entries(this.errors).forEach(([fieldName, messages]) => {
            const field = this.form.querySelector(`[name="${fieldName}"]`);
            if (field) {
                this.showFieldError(field, messages[0]);
            }
        });
        
        // Show general error message
        if (Object.keys(this.errors).length > 0) {
            const toast = new ToastManager();
            toast.error('Please fix the errors in the form');
        }
    }
    
    showFieldError(field, message = null) {
        if (!message) {
            const messages = this.errors[field.name];
            message = messages ? messages[0] : null;
        }
        
        if (message) {
            field.classList.add('error');
            
            let errorElement = field.parentNode.querySelector('.field-error');
            if (!errorElement) {
                errorElement = document.createElement('div');
                errorElement.className = 'field-error';
                field.parentNode.appendChild(errorElement);
            }
            
            errorElement.textContent = message;
        }
    }
    
    clearFieldError(field) {
        field.classList.remove('error');
        const errorElement = field.parentNode.querySelector('.field-error');
        if (errorElement) {
            errorElement.remove();
        }
        delete this.errors[field.name];
    }
    
    clearErrors() {
        this.form.querySelectorAll('.field-error').forEach(error => error.remove());
        this.form.querySelectorAll('.error').forEach(field => field.classList.remove('error'));
    }
}

// Initialize utility managers
const toastManager = new ToastManager();
const loadingManager = new LoadingManager();
const modalManager = new ModalManager();

// Global utility functions
function showToast(message, type = 'success', title = '') {
    return toastManager.show(message, type, 3000);
}

function showLoading() {
    loadingManager.show();
}

function hideLoading() {
    loadingManager.hide();
}

function openModal(modalId) {
    modalManager.open(modalId);
}

function closeModal(modalId) {
    modalManager.close(modalId);
}

function closeAllModals() {
    modalManager.closeAll();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        Utils,
        ToastManager,
        LoadingManager,
        ModalManager,
        FormValidator,
        showToast,
        showLoading,
        hideLoading,
        openModal,
        closeModal,
        closeAllModals
    };
}