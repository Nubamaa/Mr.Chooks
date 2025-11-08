// Admin Dashboard Functionality
class AdminDashboard {
    constructor() {
        this.currentUser = requireAuth('admin');
        if (!this.currentUser) return;
        
        this.products = [];
        this.inventory = [];
        this.sales = [];
        this.expenses = [];
        this.purchaseOrders = [];
        this.losses = [];
        this.deliveries = [];
        this.activityPage = 1;
        this.activityPerPage = 15;
        
        this.init();
    }
    
    async init() {
        this.setupEventListeners();
        this.setDefaultDates();
        this.setDefaultPeriods();
        this.initCalendarIntegration();
        this.setupStorageSync();
        this.updateUserDisplay();
        
        // Load data from API
        await this.loadDataFromAPI();
        this.renderAll();
        this.hideLoading();
    }
    
    updateUserDisplay() {
        const user = getCurrentUser();
        if (user && document.getElementById('admin-name')) {
            const displayName = (user.name && user.name.trim()) || (user.username && user.username.trim()) || (user.role === 'admin' ? 'Admin' : 'User');
            document.getElementById('admin-name').textContent = displayName;
        }
    }
    
    // Load data from API (primary source)
    async loadDataFromAPI() {
        try {
            this.showLoading();
            
            // Load all data from API in parallel
            const [products, inventory, sales, expenses, purchaseOrders, losses, deliveries] = await Promise.allSettled([
                api.getProducts(),
                api.getInventory(),
                api.getSales(),
                api.getExpenses(),
                api.getPurchaseOrders(),
                api.getLosses(),
                api.getDeliveries()
            ]);

            // Normalize products first (needed for inventory normalization)
            this.products = products.status === 'fulfilled' 
                ? DataNormalizer.normalize(products.value, 'products')
                : [];

            // Normalize all data using the normalizer
            this.inventory = inventory.status === 'fulfilled' 
                ? DataNormalizer.normalizeInventory(inventory.value, this.products)
                : [];
            this.sales = sales.status === 'fulfilled' 
                ? DataNormalizer.normalize(sales.value, 'sales')
                : [];
            this.expenses = expenses.status === 'fulfilled' 
                ? DataNormalizer.normalize(expenses.value, 'expenses')
                : [];
            this.purchaseOrders = purchaseOrders.status === 'fulfilled' 
                ? DataNormalizer.normalize(purchaseOrders.value, 'purchaseOrders')
                : [];
            this.losses = losses.status === 'fulfilled' 
                ? DataNormalizer.normalize(losses.value, 'losses')
                : [];
            this.deliveries = deliveries.status === 'fulfilled' 
                ? DataNormalizer.normalize(deliveries.value, 'deliveries')
                : [];

            // Sync to localStorage as backup
            this.syncToLocalStorage();

            // Show errors if any
            const errors = [products, inventory, sales, expenses, purchaseOrders, losses, deliveries]
                .filter(r => r.status === 'rejected');
            if (errors.length > 0) {
                console.warn('Some data failed to load:', errors);
                this.showToast('Some data may be incomplete. Check console for details.', 'warning');
            }
        } catch (error) {
            console.error('Error loading data from API:', error);
            this.showToast('Failed to load data from server. Using cached data.', 'error');
            // Fallback to localStorage
            this.loadDataFromLocalStorage();
        }
    }

    // Refresh sales data from API
    async refreshSales() {
        try {
            const sales = await api.getSales();
            this.sales = DataNormalizer.normalize(sales, 'sales');
            // Update localStorage backup
            this.saveData(STORAGE_KEYS.sales, this.sales);
        } catch (error) {
            console.error('Error refreshing sales:', error);
            // Keep existing sales data on error
        }
    }

    // Fallback: Load from localStorage
    loadDataFromLocalStorage() {
        try {
            this.products = JSON.parse(localStorage.getItem(STORAGE_KEYS.products) || '[]');
            this.inventory = JSON.parse(localStorage.getItem(STORAGE_KEYS.inventory) || '[]');
            this.sales = JSON.parse(localStorage.getItem(STORAGE_KEYS.sales) || '[]');
            this.expenses = JSON.parse(localStorage.getItem(STORAGE_KEYS.expenses) || '[]');
            this.purchaseOrders = JSON.parse(localStorage.getItem(STORAGE_KEYS.purchaseOrders) || '[]');
            this.losses = JSON.parse(localStorage.getItem(STORAGE_KEYS.losses) || '[]');
            this.deliveries = JSON.parse(localStorage.getItem(STORAGE_KEYS.deliveries) || '[]');
        } catch (error) {
            console.error('Error loading data from localStorage:', error);
            this.products = []; this.inventory = []; this.sales = []; 
            this.expenses = []; this.purchaseOrders = []; this.losses = []; this.deliveries = [];
        }
    }

    // Sync current data to localStorage as backup
    syncToLocalStorage() {
        try {
            this.saveData(STORAGE_KEYS.products, this.products);
            this.saveData(STORAGE_KEYS.inventory, this.inventory);
            this.saveData(STORAGE_KEYS.sales, this.sales);
            this.saveData(STORAGE_KEYS.expenses, this.expenses);
            this.saveData(STORAGE_KEYS.purchaseOrders, this.purchaseOrders);
            this.saveData(STORAGE_KEYS.losses, this.losses);
            this.saveData(STORAGE_KEYS.deliveries, this.deliveries);
        } catch (error) {
            console.warn('Failed to sync to localStorage:', error);
        }
    }

    // Legacy method for compatibility
    loadData() {
        this.loadDataFromLocalStorage();
    }
    
    saveData(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Error saving data:', error);
            this.showToast(`Failed to save ${key}. Please check storage and try again.`, 'error');
            return false;
        }
    }
    
    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.id !== 'logout-nav') {
                item.addEventListener('click', () => {
                    const view = item.getAttribute('data-view');
                    this.switchView(view);
                });
            }
        });
        
        // Logout
        document.getElementById('logout-nav').addEventListener('click', () => {
            logout();
        });
        
        // Modal close on background click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });
        
        // Product Management
        document.getElementById('add-product').addEventListener('click', () => {
            this.showProductModal();
        });
        
        document.getElementById('product-form').addEventListener('submit', (e) => this.handleProductSubmit(e));
        
        // Inventory Management
        document.getElementById('update-inventory').addEventListener('click', () => {
            if (!this.products.length) {
                this.showToast('Please add products first', 'warning');
                return;
            }
            this.updateInventoryProductSelect();
            this.openModal('inventory-modal');
        });
        
        document.getElementById('inventory-form').addEventListener('submit', (e) => this.handleInventorySubmit(e));
        
        // Loss Management
        document.getElementById('record-loss').addEventListener('click', () => {
            if (!this.products.length) {
                this.showToast('Please add products first', 'warning');
                return;
            }
            this.updateLossProductSelect();
            this.openModal('loss-modal');
        });
        
        document.getElementById('loss-form').addEventListener('submit', (e) => this.handleLossSubmit(e));
        
        // Expense Management
        document.getElementById('add-expense').addEventListener('click', () => {
            this.openModal('expense-modal');
        });
        
        document.getElementById('expense-form').addEventListener('submit', (e) => this.handleExpenseSubmit(e));
        
        // Delivery Management
        document.getElementById('add-delivery').addEventListener('click', () => {
            this.openModal('delivery-modal');
        });

        document.getElementById('delivery-form').addEventListener('submit', (e) => this.handleDeliverySubmit(e));

        // Purchase Order Management
        document.getElementById('add-po').addEventListener('click', () => {
            if (!this.products.length) {
                this.showToast('Please add products first', 'warning');
                return;
            }
            this.updatePOProductSelect();
            this.openModal('po-modal');
        });
        
        document.getElementById('po-form').addEventListener('submit', (e) => this.handlePOSubmit(e));
        document.getElementById('po-quantity').addEventListener('input', () => this.updatePOTotal());
        document.getElementById('po-unit-cost').addEventListener('input', () => this.updatePOTotal());
        
        // Dashboard
        document.getElementById('dashboard-period').addEventListener('change', () => this.updateDashboard());
        document.getElementById('low-stock-alerts').addEventListener('click', e => {
            if (e.target.classList.contains('restock-btn')) {
                const productId = e.target.dataset.productId;
                this.switchView('inventory');
                // TODO: Highlight the product in the inventory table
            }
        });
        
        // Initialize all filter events
        this.initializeFilters();
        
        // Export buttons
        this.setupExportHandlers();
    }
    
    setupExportHandlers() {
        const exports = {
            'export-products': () => this.exportProducts(),
            'export-inventory': () => this.exportInventory(),
            'export-sales': () => this.exportSales(),
            'export-expenses': () => this.exportExpenses(),
            'export-pos': () => this.exportPurchaseOrders(),
            'export-deliveries': () => this.exportDeliveries(),
            'export-report': () => this.exportReport(),
            'export-reconciliation': () => this.exportReconciliation()
        };
        
        Object.entries(exports).forEach(([id, handler]) => {
            const element = document.getElementById(id);
            if (element) element.addEventListener('click', handler);
        });
    }
    
    initializeFilters() {
        const filters = {
            'product-search': () => this.renderProducts(),
            'inventory-search': () => this.renderInventory(),
            'inventory-filter': () => this.renderInventory(),
            'sales-search': () => this.renderSales(),
            'sales-period': () => this.renderSales(),
            'sales-payment-method': () => this.renderSales(),
            'sales-employee': () => this.renderSales(),
            'expenses-search': () => this.renderExpenses(),
            'expenses-category': () => this.renderExpenses(),
            'expenses-period': () => this.renderExpenses(),
            'po-search': () => this.renderPurchaseOrders(),
            'po-status': () => this.renderPurchaseOrders(),
            'delivery-search': () => this.renderDeliveries(),
            'delivery-period': () => this.renderDeliveries(),
            'dashboard-period': () => this.updateDashboard(),
            'report-period': () => this.renderReports(),
            'reconciliation-date': () => this.renderDailyReconciliation()
        };
        
        Object.entries(filters).forEach(([id, handler]) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', handler);
                if (id.includes('search')) {
                    element.addEventListener('input', handler);
                }
            }
        });
    }
    
    setDefaultDates() {
        const now = new Date();
        const dateTimeString = now.toISOString().slice(0, 16);
        const dateString = now.toISOString().slice(0, 10);

        const dateTimeElements = ['expense-date', 'inventory-date', 'loss-date', 'po-date'];
        dateTimeElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.value = dateTimeString;
        });

        const dateElements = ['dashboard-date', 'products-date', 'sales-date', 'reconciliation-date', 'delivery-date', 'reports-date'];
        dateElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.value = dateString;
        });
    }

    setDefaultPeriods() {
        const periodIds = ['dashboard-period', 'sales-period', 'expenses-period', 'delivery-period', 'report-period'];
        periodIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.value = 'today';
                const event = new Event('change');
                el.dispatchEvent(event);
            }
        });
    }

    initCalendarIntegration() {
        try {
            if (!window.calendarModal) {
                window.calendarModal = new CalendarModal();
            }
        } catch (e) {
            // CalendarModal not available; skip integration gracefully
            return;
        }

        this.globalDate = new Date().toISOString().slice(0, 10);
        this.applyGlobalDate(this.globalDate);

        // Convert known date-only inputs to modal-driven text fields
        const knownDateOnlyIds = ['reconciliation-date', 'reports-date', 'delivery-date'];
        knownDateOnlyIds.forEach(id => this.convertInputToModalDate(id));

        // Also convert any input that looks like the dashboard date (placeholder mm/dd/yyyy)
        document.querySelectorAll('input[placeholder="mm/dd/yyyy"]').forEach(el => {
            this.prepareDateInputForModal(el);
        });
    }

    applyGlobalDate(dateString) {
        this.globalDate = dateString;
        // Update date-only inputs
        ['reconciliation-date', 'delivery-date', 'reports-date'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (el.dataset.modalDate === 'true') {
                    el.value = this.formatDisplayDate(dateString);
                } else {
                    el.value = dateString;
                }
                // Enhance UX: show full day in tooltip
                el.title = this.formatLongDate(dateString);
            }
        });
        // Update any dashboard date-like input by placeholder
        document.querySelectorAll('input[placeholder="mm/dd/yyyy"]').forEach(el => {
            el.value = this.formatDisplayDate(dateString);
            el.title = this.formatLongDate(dateString);
        });
        // Update date-time inputs (keep current time)
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const dateTime = `${dateString}T${hh}:${mm}`;
        ['expense-date', 'inventory-date', 'loss-date', 'po-date'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = dateTime;
        });

        // Trigger views to reflect the selected date
        this.renderDailyReconciliation();
        this.renderDeliveries();
        this.renderReports();
        this.updateDashboard();

        // Update visible day labels if present
        this.updateDayIndicators(dateString);
    }

    setupStorageSync() {
        // Live-reload UI when other tabs modify storage (sales, inventory, products, etc.)
        window.addEventListener('storage', (e) => {
            const keysToWatch = new Set([
                STORAGE_KEYS.sales,
                STORAGE_KEYS.inventory,
                STORAGE_KEYS.products,
                STORAGE_KEYS.expenses,
                STORAGE_KEYS.purchaseOrders,
                STORAGE_KEYS.losses,
                STORAGE_KEYS.deliveries,
                STORAGE_KEYS.discounts
            ]);
            if (!keysToWatch.has(e.key)) return;
            // Re-load in-memory data and refresh affected views
            this.loadData();
            switch (e.key) {
                case STORAGE_KEYS.sales:
                    this.renderSales();
                    this.updateDashboard();
                    this.renderReports();
                    this.renderDailyReconciliation();
                    break;
                case STORAGE_KEYS.inventory:
                case STORAGE_KEYS.products:
                    this.renderProducts();
                    this.renderInventory();
                    this.updateDashboard();
                    break;
                case STORAGE_KEYS.expenses:
                    this.renderExpenses();
                    this.updateDashboard();
                    this.renderReports();
                    break;
                case STORAGE_KEYS.purchaseOrders:
                    this.renderPurchaseOrders();
                    break;
                case STORAGE_KEYS.losses:
                    this.renderInventory();
                    this.updateDashboard();
                    break;
                case STORAGE_KEYS.deliveries:
                    this.renderDeliveries();
                    this.updateDashboard();
                    break;
                case STORAGE_KEYS.discounts:
                    this.renderSales();
                    this.renderReports();
                    break;
            }
        });
    }

    formatDisplayDate(isoDate) {
        const [y, m, d] = isoDate.split('-');
        return `${m}/${d}/${y}`;
    }

    formatLongDate(isoDate) {
        const date = new Date(`${isoDate}T00:00:00`);
        return date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }

    updateDayIndicators(dateString) {
        const longDate = this.formatLongDate(dateString);
        const ids = ['dashboard-day-label', 'reports-day-label', 'delivery-day-label', 'recon-day-label'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = longDate;
        });
        // Optional: elements with class
        document.querySelectorAll('.day-label').forEach(el => {
            el.textContent = longDate;
        });
    }

    prepareDateInputForModal(el) {
        // Turn native date dropdown off and use modal
        el.type = 'text';
        el.setAttribute('readonly', 'readonly');
        el.dataset.modalDate = 'true';
        el.value = this.formatDisplayDate(this.globalDate);
        const openModal = (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.calendarModal.open((selected) => {
                this.applyGlobalDate(selected);
            }, this.globalDate);
        };
        el.addEventListener('click', openModal);
        el.addEventListener('focus', openModal);
    }

    convertInputToModalDate(id) {
        const el = document.getElementById(id);
        if (!el) return;
        this.prepareDateInputForModal(el);
    }
    
    switchView(view) {
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        document.querySelector(`[data-view="${view}"]`).classList.add('active');
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(`${view}-view`).classList.add('active');
        
        const viewHandlers = {
            'dashboard': () => this.updateDashboard(),
            'products': () => this.renderProducts(),
            'inventory': () => this.renderInventory(),
            'sales': async () => {
                await this.refreshSales();
                this.renderSales();
            },
            'expenses': () => this.renderExpenses(),
            'purchase-orders': () => this.renderPurchaseOrders(),
            'reports': () => this.renderReports(),
            'daily-reconciliation': () => this.renderDailyReconciliation(),
            'delivery': () => this.renderDeliveries()
        };
        
        if (viewHandlers[view]) {
            viewHandlers[view]();
        }
    }

    // Delivery Management
    async handleDeliverySubmit(e) {
        e.preventDefault();
        this.showLoading();

        const description = document.getElementById('delivery-description').value;
        const amount = parseFloat(document.getElementById('delivery-amount').value) || 0;
        const driver = document.getElementById('delivery-driver').value;
        const remarks = document.getElementById('delivery-remarks').value;
        const date = document.getElementById('delivery-date').value;

        if (!description || amount <= 0 || !driver || !date) {
            this.showToast('Please fill all required fields', 'error');
            this.hideLoading();
            return;
        }

        try {
            const result = await api.createDelivery({ description, amount, driver, remarks, date });
            
            // Update local data (normalized format)
            this.deliveries.push({
                id: result.id || Utils.generateId(),
                description,
                amount,
                driver,
                remarks,
                date,
                createdAt: new Date().toISOString()
            });
            
            // Sync to localStorage
            this.saveData(STORAGE_KEYS.deliveries, this.deliveries);
            
            this.showToast('Delivery added successfully');
            this.renderDeliveries();
            this.updateDashboard();
            this.closeModal('delivery-modal');
            document.getElementById('delivery-form').reset();
            this.setDefaultDates();
        } catch (error) {
            console.error('Error saving delivery:', error);
            this.showToast(`Failed to save delivery: ${error.message}`, 'error');
        }
        this.hideLoading();
    }

    async deleteDelivery(id) {
        if (!confirm('Delete this delivery record?')) return;

        this.showLoading();
        try {
            await api.deleteDelivery(id);
            
            // Update local data
            this.deliveries = this.deliveries.filter(d => d.id !== id);
            this.saveData(STORAGE_KEYS.deliveries, this.deliveries);
            
            this.showToast('Delivery record deleted');
            this.renderDeliveries();
            this.updateDashboard();
        } catch (error) {
            console.error('Error deleting delivery:', error);
            this.showToast(`Failed to delete delivery: ${error.message}`, 'error');
        }
        this.hideLoading();
    }

    renderDeliveries() {
        const tbody = document.querySelector('#delivery-table tbody');
        if (!tbody) return;

        const search = document.getElementById('delivery-search')?.value.toLowerCase() || '';
        const period = document.getElementById('delivery-period')?.value || 'today';

        let filtered = this.filterByPeriod(this.deliveries, 'date', period);

        filtered = filtered.filter(d =>
            (d.description || '').toLowerCase().includes(search) ||
            (d.driver || '').toLowerCase().includes(search) ||
            (d.remarks || '').toLowerCase().includes(search)
        );

        if (!filtered.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6">
                        <div class="empty">
                            <div class="empty-icon"><i class="fas fa-truck"></i></div>
                            <div class="empty-text">${search ? 'No deliveries match your search' : 'No deliveries recorded'}</div>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filtered.sort((a, b) => new Date(b.date) - new Date(a.date)).map(d => `
            <tr>
                <td>${new Date(d.date).toLocaleString()}</td>
                <td>${d.description}</td>
                <td><strong>₱${d.amount.toFixed(2)}</strong></td>
                <td>${d.driver}</td>
                <td>${d.remarks || '-'}</td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="adminDashboard.deleteDelivery('${d.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }
    
    exportDeliveries() {
        const csv = this.convertToCSV(this.deliveries, ['date', 'description', 'amount', 'driver', 'remarks']);
        this.downloadCSV(csv, 'deliveries.csv');
        this.showToast('Deliveries exported successfully');
    }
    
    // UI Helper Methods
    showLoading() {
        document.getElementById('loading').classList.add('active');
    }
    
    hideLoading() {
        document.getElementById('loading').classList.remove('active');
    }
    
    showToast(message, type = 'success', title = '') {
        showToast(message, type, title);
    }
    
    openModal(id) {
        document.getElementById(id).classList.add('active');
    }
    
    closeModal(id) {
        document.getElementById(id).classList.remove('active');
    }
    
    // Product Management
    showProductModal(productId = null) {
        if (productId) {
            const product = this.products.find(p => p.id === productId);
            if (product) {
                document.getElementById('product-modal-title').textContent = 'Edit Product';
                document.getElementById('product-edit-id').value = product.id;
                document.getElementById('product-name').value = product.name;
                document.getElementById('product-price').value = product.price;
                document.getElementById('product-cost').value = product.cost;
                document.getElementById('product-description').value = product.description || '';
            }
        } else {
            document.getElementById('product-modal-title').textContent = 'Add Product';
            document.getElementById('product-form').reset();
            document.getElementById('product-edit-id').value = '';
        }
        this.openModal('product-modal');
    }
    
    async handleProductSubmit(e) {
        e.preventDefault();
        this.showLoading();
        
        const id = document.getElementById('product-edit-id').value;
        const name = document.getElementById('product-name').value;
        const price = parseFloat(document.getElementById('product-price').value) || 0;
        const cost = parseFloat(document.getElementById('product-cost').value) || 0;
        const description = document.getElementById('product-description').value || '';
        
        if (!name || price <= 0 || cost <= 0) {
            this.showToast('Please fill all required fields with valid values', 'error');
            this.hideLoading();
            return;
        }
        
        try {
            const productData = { name, price, cost, description, is_active: 1 };
            let productId = id;
            
            if (id) {
                // Update existing product
                await api.updateProduct(id, productData);
                const existing = this.products.find(p => p.id === id);
                if (existing) {
                    existing.name = name;
                    existing.price = price;
                    existing.cost = cost;
                    existing.description = description;
                    existing.updatedAt = new Date().toISOString();
                }
                this.showToast('Product updated successfully');
            } else {
                // Create new product - API returns the ID
                const result = await api.createProduct(productData);
                productId = result.id;
                
                const newProduct = {
                    id: productId,
                    name: name,
                    price: price,
                    cost: cost,
                    description: description,
                    isActive: true,
                    createdAt: new Date().toISOString()
                };
                this.products.push(newProduct);
                this.showToast('Product added successfully');
            }
            
            // Sync to localStorage
            this.saveData(STORAGE_KEYS.products, this.products);
            this.renderProducts();
            this.closeModal('product-modal');
            document.getElementById('product-form').reset();
        } catch (error) {
            console.error('Error saving product:', error);
            this.showToast(`Failed to ${id ? 'update' : 'create'} product: ${error.message}`, 'error');
        }
        this.hideLoading();
    }
    
    async deleteProduct(id) {
        if (!confirm('Delete this product? Related inventory and sales records will also be removed.')) return;
        
        this.showLoading();
        try {
            await api.deleteProduct(id);
            
            // Update local data
            this.products = this.products.filter(p => p.id !== id);
            this.inventory = this.inventory.filter(i => i.productId !== id);
            // Note: Sales are not filtered here as they should remain for historical records
            
            // Sync to localStorage
            this.saveData(STORAGE_KEYS.products, this.products);
            this.saveData(STORAGE_KEYS.inventory, this.inventory);
            
            this.showToast('Product deleted successfully');
            this.renderAll();
        } catch (error) {
            console.error('Error deleting product:', error);
            this.showToast(`Failed to delete product: ${error.message}`, 'error');
        }
        this.hideLoading();
    }
    
    renderProducts() {
        const grid = document.getElementById('products-grid');
        const search = document.getElementById('product-search')?.value.toLowerCase() || '';
        
        const filtered = this.products.filter(p =>
            p.name.toLowerCase().includes(search) ||
            (p.description && p.description.toLowerCase().includes(search))
        );
        
        if (!filtered.length) {
            grid.innerHTML = `
                <div class="empty">
                    <div class="empty-icon"><i class="fas fa-drumstick-bite"></i></div>
                    <div class="empty-text">${search ? 'No products match your search' : 'No products yet. Add your first product to get started.'}</div>
                    ${!search ? `<button class="btn btn-primary" onclick="adminDashboard.showProductModal()">
                        <i class="fas fa-plus"></i> Add Product
                    </button>` : ''}
                </div>
            `;
            return;
        }
        
        grid.innerHTML = filtered.map(p => {
            const profit = p.price - p.cost;
            const margin = (profit / p.price * 100).toFixed(1);
            const soldCount = this.sales.filter(s => s.productId === p.id).reduce((sum, s) => sum + s.quantity, 0);
            
            return `
                <div class="product-card">
                    <div class="product-header">
                        <div class="product-name">${p.name}</div>
                        <div class="product-price">₱${p.price.toFixed(2)}</div>
                    </div>
                    <div class="product-info">
                        <div class="product-row">
                            <span class="product-label">Cost:</span>
                            <span class="product-value">₱${p.cost.toFixed(2)}</span>
                        </div>
                        <div class="product-row">
                            <span class="product-label">Profit/Unit:</span>
                            <span class="product-value positive">₱${profit.toFixed(2)}</span>
                        </div>
                        <div class="product-row">
                            <span class="product-label">Profit Margin:</span>
                            <span class="product-value positive">${margin}%</span>
                        </div>
                        <div class="product-row">
                            <span class="product-label">Units Sold:</span>
                            <span class="product-value">${soldCount}</span>
                        </div>
                        ${p.description ? `<div class="product-row" style="margin-top: 8px;"><span class="product-label" style="font-size: 13px; color: var(--text-light);">${p.description}</span></div>` : ''}
                    </div>
                    <div class="product-actions">
                        <button class="btn btn-secondary btn-sm" onclick="adminDashboard.showProductModal('${p.id}')">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="adminDashboard.deleteProduct('${p.id}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // Inventory Management
    updateInventoryProductSelect() {
        const select = document.getElementById('inventory-product');
        if (select) {
            select.innerHTML = '<option value="">Select Product</option>' +
                this.products.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        }
    }
    
    updateLossProductSelect() {
        const select = document.getElementById('loss-product');
        if (select) {
            select.innerHTML = '<option value="">Select Product</option>' +
                this.products.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        }
    }
    
    async handleInventorySubmit(e) {
        e.preventDefault();
        this.showLoading();
        
        const productId = document.getElementById('inventory-product').value;
        const product = this.products.find(p => p.id === productId);
        const beginning = parseInt(document.getElementById('inventory-beginning').value) || 0;
        const stock = parseInt(document.getElementById('inventory-stock').value) || 0;
        
        if (!product) {
            this.showToast('Product not found', 'error');
            this.hideLoading();
            return;
        }
        
        if (beginning < 0 || stock < 0) {
            this.showToast('Stock values cannot be negative', 'error');
            this.hideLoading();
            return;
        }
        
        try {
            const result = await api.updateInventory(productId, { beginning, stock });
            
            // Update local data (normalized format)
            const existingIndex = this.inventory.findIndex(i => i.productId === productId);
            const nowIso = new Date().toISOString();
            const product = this.products.find(p => p.id === productId);
            
            if (existingIndex !== -1) {
                const item = this.inventory[existingIndex];
                item.beginning = beginning;
                item.stock = stock;
                item.updatedAt = nowIso;
                // Always ensure productName is set when product exists
                if (product) {
                    item.productName = product.name;
                }
            } else {
                this.inventory.push({
                    id: result.id || Utils.generateId(),
                    productId: productId,
                    productName: product ? product.name : '',
                    beginning,
                    stock,
                    updatedAt: nowIso
                });
            }
            
            // Sync to localStorage
            this.saveData(STORAGE_KEYS.inventory, this.inventory);
            this.showToast(existingIndex !== -1 ? 'Inventory updated successfully' : 'Inventory record created');
            this.renderInventory();
            this.updateDashboard();
            this.closeModal('inventory-modal');
            document.getElementById('inventory-form').reset();
            this.setDefaultDates();
        } catch (error) {
            console.error('Error saving inventory:', error);
            this.showToast(`Failed to save inventory: ${error.message}`, 'error');
        }
        this.hideLoading();
    }
    
    async handleLossSubmit(e) {
        e.preventDefault();
        this.showLoading();
        
        const productId = document.getElementById('loss-product').value;
        const product = this.products.find(p => p.id === productId);
        const quantity = parseInt(document.getElementById('loss-quantity').value) || 0;
        const reason = document.getElementById('loss-reason').value;
        const remarks = document.getElementById('loss-remarks').value;
        const date = document.getElementById('loss-date').value;
        const cost = (product?.cost || 0) * quantity;
        
        if (!product) {
            this.showToast('Product not found', 'error');
            this.hideLoading();
            return;
        }
        
        if (quantity <= 0) {
            this.showToast('Please enter a valid quantity', 'error');
            this.hideLoading();
            return;
        }
        
        try {
            await api.createLoss({
                product_id: productId,
                product_name: product.name,
                quantity,
                reason,
                remarks,
                cost,
                date
            });
            
            // Update local data (normalized format)
            this.losses.push({
                id: Utils.generateId(),
                productId: productId,
                productName: product.name,
                quantity,
                reason,
                remarks,
                cost,
                date,
                createdAt: new Date().toISOString()
            });
            
            // Update inventory locally (API already handles this)
            const inventoryItem = this.inventory.find(i => i.productId === productId);
            if (inventoryItem) {
                inventoryItem.stock = Math.max(0, (inventoryItem.stock || 0) - quantity);
                inventoryItem.updatedAt = new Date().toISOString();
            }
            
            // Sync to localStorage
            this.saveData(STORAGE_KEYS.inventory, this.inventory);
            this.saveData(STORAGE_KEYS.losses, this.losses);
            
            this.showToast('Loss recorded successfully');
            this.renderInventory();
            this.updateDashboard();
            this.closeModal('loss-modal');
            document.getElementById('loss-form').reset();
            this.setDefaultDates();
        } catch (error) {
            console.error('Error recording loss:', error);
            this.showToast(`Failed to record loss: ${error.message}`, 'error');
        }
        this.hideLoading();
    }
    
    async deleteInventory(id) {
        if (!confirm('Delete this inventory record?')) return;
        
        this.showLoading();
        try {
            await api.deleteInventory(id);
            this.inventory = this.inventory.filter(i => i.id !== id);
            this.saveData(STORAGE_KEYS.inventory, this.inventory);
            this.showToast('Inventory record deleted');
            this.renderInventory();
            this.updateDashboard();
        } catch (error) {
            console.error('Error deleting inventory:', error);
            this.showToast(`Failed to delete inventory: ${error.message}`, 'error');
        }
        this.hideLoading();
    }
    
    renderInventory() {
        const tbody = document.querySelector('#inventory-table tbody');
        if (!tbody) return;
        
        const search = document.getElementById('inventory-search')?.value.toLowerCase() || '';
        const filter = document.getElementById('inventory-filter')?.value || 'all';
        
        let filtered = this.inventory.filter(i =>
            (i.productName || '').toLowerCase().includes(search)
        );
        
        if (filter !== 'all') {
            filtered = filtered.filter(i => {
                if (filter === 'low') return i.stock < 10;
                if (filter === 'medium') return i.stock >= 10 && i.stock < 25;
                if (filter === 'good') return i.stock >= 25;
                return true;
            });
        }
        
        if (!filtered.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6">
                        <div class="empty">
                            <div class="empty-icon"><i class="fas fa-boxes"></i></div>
                            <div class="empty-text">${search || filter !== 'all' ? 'No inventory matches your filters' : 'No inventory data yet'}</div>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = filtered.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).map(i => {
            let stockStatus = 'badge-success';
            let stockText = 'Good Stock';
            let rowClass = '';
            
            if (i.stock < 10) {
                stockStatus = 'badge-danger';
                stockText = 'Low Stock';
                rowClass = 'low-stock';
            } else if (i.stock < 25) {
                stockStatus = 'badge-warning';
                stockText = 'Medium Stock';
            }
            
            // Find product name if missing
            const productName = i.productName || (() => {
                const prod = this.products.find(p => p.id === i.productId || p.id === i.product_id);
                return prod ? prod.name : 'Unknown Product';
            })();
            
            return `
                <tr class="${rowClass}">
                    <td><strong>${productName}</strong></td>
                    <td>${i.beginning}</td>
                    <td><strong>${i.stock}</strong></td>
                    <td><span class="badge ${stockStatus}">${stockText}</span></td>
                    <td>${i.updatedAt ? new Date(i.updatedAt).toLocaleString() : 'N/A'}</td>
                    <td>
                        <button class="btn btn-danger btn-sm" onclick="adminDashboard.deleteInventory('${i.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    // Sales Management (Read Only)
    renderSales() {
        const tbody = document.querySelector('#sales-table tbody');
        if (!tbody) return;
        
        const search = document.getElementById('sales-search')?.value.toLowerCase() || '';
        const period = document.getElementById('sales-period')?.value || 'today';
        const paymentMethod = document.getElementById('sales-payment-method')?.value || 'all';
        const employeeFilter = document.getElementById('sales-employee')?.value || 'all';
        
        let filtered = this.filterByPeriod(this.sales, 'date', period);
        filtered = filtered.filter(s =>
            (s.productName || '').toLowerCase().includes(search)
        );
        
        if (paymentMethod !== 'all') {
            filtered = filtered.filter(s => s.paymentMethod === paymentMethod);
        }
        
        if (employeeFilter !== 'all') {
            filtered = filtered.filter(s => s.employee === employeeFilter);
        }
        
        if (!filtered.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9">
                        <div class="empty">
                            <div class="empty-icon"><i class="fas fa-cash-register"></i></div>
                            <div class="empty-text">${search ? 'No sales match your search' : 'No sales recorded'}</div>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = filtered.sort((a, b) => new Date(b.date) - new Date(a.date)).map(s => `
            <tr>
                <td>${new Date(s.date).toLocaleString()}</td>
                <td><strong>${s.productName}</strong></td>
                <td>${s.quantity}</td>
                <td>₱${s.price.toFixed(2)}</td>
                <td>₱${s.discount.toFixed(2)}</td>
                <td><strong>₱${s.total.toFixed(2)}</strong></td>
                <td><span class="badge badge-info">${s.paymentMethod}</span></td>
                <td><span class="badge badge-success">₱${s.profit.toFixed(2)}</span></td>
                <td>${s.employee || 'N/A'}</td>
            </tr>
        `).join('');
        
        // Update employee filter options
        this.updateEmployeeFilter();
    }
    
    updateEmployeeFilter() {
        const select = document.getElementById('sales-employee');
        if (!select) return;
        
        const employees = [...new Set(this.sales.map(s => s.employee).filter(e => e))];
        
        select.innerHTML = '<option value="all">All</option>' +
            employees.map(emp => `<option value="${emp}">${emp}</option>`).join('');
    }
    
    // Expense Management
    async handleExpenseSubmit(e) {
        e.preventDefault();
        this.showLoading();
        
        const amount = parseFloat(document.getElementById('expense-amount').value) || 0;
        const category = document.getElementById('expense-category').value;
        const description = document.getElementById('expense-description').value;
        
        if (amount <= 0 || !category || !description) {
            this.showToast('Please fill all required fields with valid values', 'error');
            this.hideLoading();
            return;
        }
        
        try {
            const date = document.getElementById('expense-date').value;
            const remarks = document.getElementById('expense-remarks').value || '';
            const result = await api.createExpense({ date, category, description, amount, remarks });
            
            // Update local data (normalized format)
            this.expenses.push({
                id: result.id || Date.now(),
                date: date,
                category: category,
                description: description,
                amount: amount,
                remarks: remarks,
                createdAt: new Date().toISOString()
            });
            
            // Sync to localStorage
            this.saveData(STORAGE_KEYS.expenses, this.expenses);
            
            this.showToast('Expense added successfully');
            this.renderExpenses();
            this.updateDashboard();
            this.closeModal('expense-modal');
            document.getElementById('expense-form').reset();
            this.setDefaultDates();
        } catch (error) {
            console.error('Error saving expense:', error);
            this.showToast(`Failed to save expense: ${error.message}`, 'error');
        }
        this.hideLoading();
    }
    
    async deleteExpense(id) {
        if (!confirm('Delete this expense?')) return;
        
        this.showLoading();
        try {
            await api.deleteExpense(id);
            
            // Update local data
            this.expenses = this.expenses.filter(e => e.id !== id);
            this.saveData(STORAGE_KEYS.expenses, this.expenses);
            
            this.showToast('Expense deleted successfully');
            this.renderExpenses();
            this.updateDashboard();
        } catch (error) {
            console.error('Error deleting expense:', error);
            this.showToast(`Failed to delete expense: ${error.message}`, 'error');
        }
        this.hideLoading();
    }
    
    renderExpenses() {
        const tbody = document.querySelector('#expenses-table tbody');
        if (!tbody) return;
        
        const search = document.getElementById('expenses-search')?.value.toLowerCase() || '';
        const category = document.getElementById('expenses-category')?.value || 'all';
        const period = document.getElementById('expenses-period')?.value || 'today';
        
        let filtered = this.filterByPeriod(this.expenses, 'date', period);
        
        if (category !== 'all') {
            filtered = filtered.filter(e => e.category === category);
        }
        
        filtered = filtered.filter(e =>
            (e.description || '').toLowerCase().includes(search) ||
            (e.category || '').toLowerCase().includes(search) ||
            (e.remarks || '').toLowerCase().includes(search)
        );
        
        if (!filtered.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6">
                        <div class="empty">
                            <div class="empty-icon"><i class="fas fa-receipt"></i></div>
                            <div class="empty-text">${search || category !== 'all' ? 'No expenses match your filters' : 'No expenses recorded'}</div>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = filtered.sort((a, b) => new Date(b.date) - new Date(a.date)).map(e => `
            <tr>
                <td>${new Date(e.date).toLocaleString()}</td>
                <td><span class="badge badge-info">${e.category}</span></td>
                <td>${e.description}</td>
                <td><strong>₱${e.amount.toFixed(2)}</strong></td>
                <td>${e.remarks || '-'}</td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="adminDashboard.deleteExpense(${e.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }
    
    // Purchase Orders Management
    updatePOProductSelect() {
        const select = document.getElementById('po-product');
        if (select) {
            select.innerHTML = '<option value="">Select Product</option>' +
                this.products.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        }
    }
    
    updatePOTotal() {
        const quantity = parseFloat(document.getElementById('po-quantity').value) || 0;
        const unitCost = parseFloat(document.getElementById('po-unit-cost').value) || 0;
        const total = quantity * unitCost;
        const totalElement = document.getElementById('po-total');
        if (totalElement) totalElement.value = '₱' + total.toFixed(2);
    }
    
    async handlePOSubmit(e) {
        e.preventDefault();
        this.showLoading();
        
        const poNumber = document.getElementById('po-number').value;
        const supplier = document.getElementById('po-supplier').value;
        const productId = document.getElementById('po-product').value;
        const product = this.products.find(p => p.id === productId);
        const quantity = parseInt(document.getElementById('po-quantity').value) || 0;
        const unitCost = parseFloat(document.getElementById('po-unit-cost').value) || 0;
        const status = document.getElementById('po-status-select').value;
        const date = document.getElementById('po-date').value;
        const total = quantity * unitCost;
        
        if (!product) {
            this.showToast('Product not found', 'error');
            this.hideLoading();
            return;
        }
        
        if (quantity <= 0 || unitCost <= 0) {
            this.showToast('Please enter valid quantity and unit cost', 'error');
            this.hideLoading();
            return;
        }
        
        try {
            const result = await api.createPurchaseOrder({
                po_number: poNumber,
                supplier,
                status,
                date,
                total,
                items: [{
                    product_id: productId,
                    product_name: product.name,
                    quantity,
                    unit_cost: unitCost,
                    total
                }]
            });
            
            // Update local data (normalized format)
            this.purchaseOrders.push({
                id: result.id || Utils.generateId(),
                poNumber: poNumber,
                supplier,
                productId: productId,
                productName: product.name,
                quantity,
                unitCost: unitCost,
                total,
                status,
                date,
                createdAt: new Date().toISOString()
            });
            
            // Sync to localStorage
            this.saveData(STORAGE_KEYS.purchaseOrders, this.purchaseOrders);
            
            this.showToast('Purchase Order created successfully');
            this.renderPurchaseOrders();
            this.closeModal('po-modal');
            document.getElementById('po-form').reset();
            this.setDefaultDates();
        } catch (error) {
            console.error('Error creating purchase order:', error);
            this.showToast(`Failed to create purchase order: ${error.message}`, 'error');
        }
        this.hideLoading();
    }
    
    async updatePOStatus(id, status) {
        this.showLoading();
        try {
            const po = this.purchaseOrders.find(p => p.id === id);
            if (po) {
                await api.updatePurchaseOrder(id, { status });
                po.status = status;
                po.updatedAt = new Date().toISOString();
                
                this.saveData(STORAGE_KEYS.purchaseOrders, this.purchaseOrders);
                this.showToast('PO status updated successfully');
                this.renderPurchaseOrders();
            }
        } catch (error) {
            console.error('Error updating PO status:', error);
            this.showToast(`Failed to update PO status: ${error.message}`, 'error');
        }
        this.hideLoading();
    }
    
    async deletePO(id) {
        if (!confirm('Delete this purchase order?')) return;
        
        this.showLoading();
        try {
            await api.deletePurchaseOrder(id);
            this.purchaseOrders = this.purchaseOrders.filter(p => p.id !== id);
            this.saveData(STORAGE_KEYS.purchaseOrders, this.purchaseOrders);
            this.showToast('Purchase Order deleted successfully');
            this.renderPurchaseOrders();
        } catch (error) {
            console.error('Error deleting PO:', error);
            this.showToast(`Failed to delete purchase order: ${error.message}`, 'error');
        }
        this.hideLoading();
    }
    
    renderPurchaseOrders() {
        const tbody = document.querySelector('#po-table tbody');
        if (!tbody) return;
        
        const search = document.getElementById('po-search')?.value.toLowerCase() || '';
        const status = document.getElementById('po-status')?.value || 'all';
        
        let filtered = this.purchaseOrders.filter(po =>
            (po.poNumber || '').toLowerCase().includes(search) ||
            (po.supplier || '').toLowerCase().includes(search) ||
            (po.productName || '').toLowerCase().includes(search)
        );
        
        if (status !== 'all') {
            filtered = filtered.filter(po => po.status === status);
        }
        
        if (!filtered.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9">
                        <div class="empty">
                            <div class="empty-icon"><i class="fas fa-file-invoice"></i></div>
                            <div class="empty-text">${search || status !== 'all' ? 'No purchase orders match your filters' : 'No purchase orders yet'}</div>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = filtered.sort((a, b) => new Date(b.date) - new Date(a.date)).map(po => {
            let statusBadge = 'badge-info';
            if (po.status === 'Received') statusBadge = 'badge-success';
            if (po.status === 'Cancelled') statusBadge = 'badge-danger';
            if (po.status === 'Pending') statusBadge = 'badge-warning';
            
            return `
                <tr>
                    <td><strong>${po.poNumber}</strong></td>
                    <td>${new Date(po.date).toLocaleDateString()}</td>
                    <td>${po.supplier}</td>
                    <td>${po.productName}</td>
                    <td>${po.quantity}</td>
                    <td>₱${po.unitCost.toFixed(2)}</td>
                    <td><strong>₱${po.total.toFixed(2)}</strong></td>
                    <td><span class="badge ${statusBadge}">${po.status}</span></td>
            <td>
                <div class="btn-group">
                    <select class="form-control" style="width: auto; display: inline-block; margin-right: 5px;" onchange="adminDashboard.updatePOStatus('${po.id}', this.value)">
                                <option value="Pending" ${po.status === 'Pending' ? 'selected' : ''}>Pending</option>
                                <option value="Ordered" ${po.status === 'Ordered' ? 'selected' : ''}>Ordered</option>
                                <option value="Received" ${po.status === 'Received' ? 'selected' : ''}>Received</option>
                                <option value="Cancelled" ${po.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                            </select>
                    <button class="btn btn-danger btn-sm" onclick="adminDashboard.deletePO('${po.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    // Daily Reconciliation
    createDailyReconciliation() {
        const date = document.getElementById('reconciliation-date').value;
        if (!date) {
            this.showToast('Please select a date', 'warning');
            return;
        }
        
        this.showToast('Daily reconciliation calculated', 'success');
        this.renderDailyReconciliation();
    }
    
    renderDailyReconciliation() {
        const date = document.getElementById('reconciliation-date').value;
        if (!date) return;
        
        const daySales = this.sales.filter(s => s.date.startsWith(date));
        const dayExpenses = this.expenses.filter(e => e.date.startsWith(date));
        
        const grossSales = daySales.reduce((sum, s) => sum + (s.quantity * s.price), 0) || 0;
        const totalDiscounts = daySales.reduce((sum, s) => sum + (s.discount || 0), 0) || 0;
        const netSales = grossSales - totalDiscounts;
        const totalExpenses = dayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
        
        // Calculate inventory values
        const beginningValue = this.inventory.reduce((sum, i) => sum + (i.beginning * (this.products.find(p => p.id === i.productId)?.cost || 0)), 0) || 0;
        const endingValue = this.inventory.reduce((sum, i) => sum + (i.stock * (this.products.find(p => p.id === i.productId)?.cost || 0)), 0) || 0;
        
        // Update summary stats
        const elements = {
            'recon-beginning-value': beginningValue,
            'recon-ending-value': endingValue,
            'recon-gross-sales': grossSales,
            'recon-net-sales': netSales
        };
        
        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = `₱${value.toFixed(2)}`;
        });
        
        // Render expenses breakdown
        this.renderReconExpenses(dayExpenses);
        
        // Render payment method breakdown
        this.renderReconPayments(daySales);
    }
    
    renderReconExpenses(dayExpenses) {
        const tbody = document.querySelector('#recon-expenses-table tbody');
        if (!tbody) return;
        
        if (!dayExpenses.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3">
                        <div class="empty">
                            <div class="empty-icon"><i class="fas fa-receipt"></i></div>
                            <div class="empty-text">No expenses for selected date</div>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        const categoryTotals = {};
        dayExpenses.forEach(e => {
            if (!categoryTotals[e.category]) {
                categoryTotals[e.category] = { amount: 0, count: 0 };
            }
            categoryTotals[e.category].amount += e.amount;
            categoryTotals[e.category].count++;
        });
        
        tbody.innerHTML = Object.entries(categoryTotals).map(([category, data]) => `
            <tr>
                <td><strong>${category}</strong></td>
                <td>₱${data.amount.toFixed(2)}</td>
                <td>${data.count} transactions</td>
            </tr>
        `).join('');
    }
    
    renderReconPayments(daySales) {
        const tbody = document.querySelector('#recon-payments-table tbody');
        if (!tbody) return;
        
        if (!daySales.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4">
                        <div class="empty">
                            <div class="empty-icon"><i class="fas fa-credit-card"></i></div>
                            <div class="empty-text">No sales for selected date</div>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        const paymentTotals = {};
        daySales.forEach(s => {
            if (!paymentTotals[s.paymentMethod]) {
                paymentTotals[s.paymentMethod] = { amount: 0, count: 0, employees: new Set() };
            }
            paymentTotals[s.paymentMethod].amount += s.total;
            paymentTotals[s.paymentMethod].count++;
            if (s.employee) paymentTotals[s.paymentMethod].employees.add(s.employee);
        });
        
        tbody.innerHTML = Object.entries(paymentTotals).map(([method, data]) => `
            <tr>
                <td><strong>${method}</strong></td>
                <td>₱${data.amount.toFixed(2)}</td>
                <td>${data.count} transactions</td>
                <td>${Array.from(data.employees).join(', ') || 'N/A'}</td>
            </tr>
        `).join('');
    }
    
    // Dashboard
    getStatsForPeriod(periodOrDate) {
        let filteredSales;
        let filteredExpenses;

        if (['today', 'week', 'month', 'year'].includes(periodOrDate)) {
            filteredSales = this.filterByPeriod(this.sales, 'date', periodOrDate);
            filteredExpenses = this.filterByPeriod(this.expenses, 'date', periodOrDate);
        } else { // Assumes it's a date string for reconciliation
            filteredSales = this.sales.filter(s => s.date.startsWith(periodOrDate));
            filteredExpenses = this.expenses.filter(e => e.date.startsWith(periodOrDate));
        }

        const grossSales = filteredSales.reduce((sum, s) => sum + (s.quantity * s.price), 0) || 0;
        const totalDiscounts = filteredSales.reduce((sum, s) => sum + (s.discount || 0), 0) || 0;
        const netSales = grossSales - totalDiscounts;
        const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
        const netProfit = netSales - totalExpenses;

        return {
            grossSales,
            totalDiscounts,
            netSales,
            totalExpenses,
            netProfit,
            filteredSales,
            filteredExpenses
        };
    }

    updateDashboard() {
        const period = document.getElementById('dashboard-period')?.value || 'today';
        const stats = this.getStatsForPeriod(period);
        
        const elements = {
            'stat-gross-sales': stats.grossSales,
            'stat-net-sales': stats.netSales,
            'stat-expenses': stats.totalExpenses,
            'stat-profit': stats.netProfit
        };
        
        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = `₱${value.toFixed(2)}`;
        });
        
        this.renderLowStockAlerts();
        this.renderActivity();
    }
    
    renderLowStockAlerts() {
        const container = document.getElementById('low-stock-alerts');
        if (!container) return;
        
        const lowStock = this.inventory.filter(i => i.stock < 10);
        
        if (!lowStock.length) {
            container.innerHTML = `
                <div class="empty">
                    <div class="empty-icon"><i class="fas fa-check-circle"></i></div>
                    <div class="empty-text">All products are well stocked</div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>Current Stock</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${lowStock.map(i => `
                            <tr class="low-stock">
                                <td><strong>${i.productName}</strong></td>
                                <td>${i.stock}</td>
                                <td><span class="badge badge-danger">Low Stock</span></td>
                                <td>
                                    <button class="btn btn-primary btn-sm restock-btn" data-product-id="${i.productId}">
                                        Restock
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    renderActivity() {
        const tbody = document.querySelector('#activity-table tbody');
        if (!tbody) return;
        
        const activities = this.getActivities();
        
        if (!activities.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5">
                        <div class="empty">
                            <div class="empty-icon"><i class="fas fa-clipboard-list"></i></div>
                            <div class="empty-text">No activity yet</div>
                        </div>
                    </td>
                </tr>
            `;
            this.renderActivityPagination(0);
            return;
        }
        
        const startIndex = (this.activityPage - 1) * this.activityPerPage;
        const endIndex = startIndex + this.activityPerPage;
        const paginatedActivities = activities.slice(startIndex, endIndex);
        
        tbody.innerHTML = paginatedActivities.map(a => `
            <tr>
                <td>${new Date(a.date).toLocaleString()}</td>
                <td><span class="badge ${a.badge}">${a.type}</span></td>
                <td>${a.description}</td>
                <td><strong>${a.amount !== 0 ? (a.amount > 0 ? '+' : '') + '₱' + Math.abs(a.amount).toFixed(2) : '-'}</strong></td>
                <td>${a.employee}</td>
            </tr>
        `).join('');
        
        this.renderActivityPagination(activities.length);
    }

    getActivities() {
        const activities = [];
        
        this.sales.forEach(s => {
            activities.push({
                date: s.date,
                type: 'Sale',
                description: `${s.productName} (${s.quantity} units)`,
                amount: s.total,
                badge: 'badge-success',
                employee: s.employee || 'N/A'
            });
        });
        
        this.expenses.forEach(e => {
            activities.push({
                date: e.date,
                type: 'Expense',
                description: `${e.category}: ${e.description}`,
                amount: -e.amount,
                badge: 'badge-danger',
                employee: 'Admin'
            });
        });
        
        this.purchaseOrders.forEach(po => {
            activities.push({
                date: po.date,
                type: 'Purchase Order',
                description: `PO ${po.poNumber} for ${po.productName}`,
                amount: -po.total,
                badge: 'badge-info',
                employee: 'Admin'
            });
        });
        
        this.losses.forEach(l => {
            activities.push({
                date: l.date,
                type: 'Loss',
                description: `${l.productName} (${l.quantity} units) - ${l.reason}`,
                amount: -l.cost,
                badge: 'badge-warning',
                employee: 'Admin'
            });
        });
        
        activities.sort((a, b) => new Date(b.date) - new Date(a.date));
        return activities;
    }

    renderActivityPagination(totalActivities) {
        const paginationContainer = document.getElementById('activity-pagination');
        if (!paginationContainer) return;

        const totalPages = Math.ceil(totalActivities / this.activityPerPage);
        if (totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }

        let paginationHTML = '<ul class="pagination">';
        for (let i = 1; i <= totalPages; i++) {
            paginationHTML += `<li class="page-item ${i === this.activityPage ? 'active' : ''}"><a class="page-link" href="#" data-page="${i}">${i}</a></li>`;
        }
        paginationHTML += '</ul>';
        paginationContainer.innerHTML = paginationHTML;

        paginationContainer.addEventListener('click', e => {
            e.preventDefault();
            if (e.target.matches('.page-link')) {
                this.activityPage = parseInt(e.target.dataset.page);
                this.renderActivity();
            }
        });
    }
    
    // Reports
    renderReports() {
        const period = document.getElementById('report-period')?.value || 'today';
        const filteredSales = this.filterByPeriod(this.sales, 'date', period);
        const filteredExpenses = this.filterByPeriod(this.expenses, 'date', period);
        
        const grossSales = filteredSales.reduce((sum, s) => sum + (s.quantity * s.price), 0) || 0;
        const totalDiscounts = filteredSales.reduce((sum, s) => sum + (s.discount || 0), 0) || 0;
        const netSales = grossSales - totalDiscounts;
        const totalCost = filteredSales.reduce((sum, s) => sum + (s.cost * s.quantity), 0) || 0;
        const totalProfit = filteredSales.reduce((sum, s) => sum + s.profit, 0) || 0;
        const margin = netSales > 0 ? (totalProfit / netSales * 100).toFixed(1) : 0;
        const avgSale = filteredSales.length > 0 ? (netSales / filteredSales.length) : 0;
        
        // Best selling product
        const productSales = {};
        filteredSales.forEach(s => {
            if (!productSales[s.productName]) {
                productSales[s.productName] = {
                    units: 0,
                    grossSales: 0,
                    discounts: 0
                };
            }
            productSales[s.productName].units += s.quantity;
            productSales[s.productName].grossSales += s.quantity * s.price;
            productSales[s.productName].discounts += s.discount;
        });
        
        let bestProduct = '-';
        let maxSales = 0;
        for (const [name, data] of Object.entries(productSales)) {
            if (data.units > maxSales) {
                maxSales = data.units;
                bestProduct = `${name} (${data.units})`;
            }
        }
        
        const reportElements = {
            'report-best-product': bestProduct,
            'report-avg-sale': `₱${avgSale.toFixed(2)}`,
            'report-margin': `${margin}%`,
            'report-transactions': filteredSales.length
        };
        
        Object.entries(reportElements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
        
        this.renderProductReport(filteredSales);
        this.renderExpenseReport(filteredExpenses);
    }
    
    renderProductReport(filteredSales) {
        const tbody = document.querySelector('#report-products-table tbody');
        if (!tbody) return;
        
        if (!filteredSales.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8">
                        <div class="empty">
                            <div class="empty-icon"><i class="fas fa-chart-pie"></i></div>
                            <div class="empty-text">No data available for selected period</div>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        const productData = {};
        
        filteredSales.forEach(s => {
            if (!productData[s.productName]) {
                productData[s.productName] = {
                    units: 0,
                    grossSales: 0,
                    discounts: 0,
                    cost: 0,
                    profit: 0
                };
            }
            productData[s.productName].units += s.quantity;
            productData[s.productName].grossSales += s.quantity * s.price;
            productData[s.productName].discounts += s.discount;
            productData[s.productName].cost += s.cost * s.quantity;
            productData[s.productName].profit += s.profit;
        });
        
        const rows = Object.entries(productData).map(([name, data]) => ({
            name,
            ...data,
            netSales: data.grossSales - data.discounts,
            margin: data.netSales > 0 ? ((data.profit / data.netSales) * 100).toFixed(1) : '0.0'
        }));
        
        rows.sort((a, b) => b.netSales - a.netSales);
        
        tbody.innerHTML = rows.map(row => `
            <tr>
                <td><strong>${row.name}</strong></td>
                <td>${row.units}</td>
                <td>₱${row.grossSales.toFixed(2)}</td>
                <td>₱${row.discounts.toFixed(2)}</td>
                <td>₱${row.netSales.toFixed(2)}</td>
                <td>₱${row.cost.toFixed(2)}</td>
                <td><strong>₱${row.profit.toFixed(2)}</strong></td>
                <td><span class="badge badge-success">${row.margin}%</span></td>
            </tr>
        `).join('');
    }
    
    renderExpenseReport(filteredExpenses) {
        const tbody = document.querySelector('#report-expenses-table tbody');
        if (!tbody) return;
        
        if (!filteredExpenses.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4">
                        <div class="empty">
                            <div class="empty-icon"><i class="fas fa-chart-pie"></i></div>
                            <div class="empty-text">No expenses for selected period</div>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        const categoryData = {};
        let totalExpenses = 0;
        
        filteredExpenses.forEach(e => {
            if (!categoryData[e.category]) {
                categoryData[e.category] = {
                    count: 0,
                    amount: 0
                };
            }
            categoryData[e.category].count++;
            categoryData[e.category].amount += e.amount;
            totalExpenses += e.amount;
        });
        
        const rows = Object.entries(categoryData).map(([category, data]) => ({
            category,
            ...data,
            percentage: totalExpenses > 0 ? (data.amount / totalExpenses * 100).toFixed(1) : 0
        }));
        
        rows.sort((a, b) => b.amount - a.amount);
        
        tbody.innerHTML = rows.map(row => `
            <tr>
                <td><span class="badge badge-info">${row.category}</span></td>
                <td>${row.count}</td>
                <td><strong>₱${row.amount.toFixed(2)}</strong></td>
                <td>${row.percentage}%</td>
            </tr>
        `).join('');
    }
    
    // Utility Methods
    filterByPeriod(items, dateField, period) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        return items.filter(item => {
            const itemDate = new Date(item[dateField]);
            
            if (period === 'today') {
                return itemDate >= today;
            } else if (period === 'week') {
                const weekAgo = new Date(today);
                weekAgo.setDate(weekAgo.getDate() - 7);
                return itemDate >= weekAgo;
            } else if (period === 'month') {
                const monthAgo = new Date(today);
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                return itemDate >= monthAgo;
            } else if (period === 'year') {
                const yearAgo = new Date(today);
                yearAgo.setFullYear(yearAgo.getFullYear() - 1);
                return itemDate >= yearAgo;
            }
            return true;
        });
    }
    
    // Export Functions
    exportProducts() {
        const csv = this.convertToCSV(this.products, ['id', 'name', 'price', 'cost', 'description']);
        this.downloadCSV(csv, 'products.csv');
        this.showToast('Products exported successfully');
    }
    
    exportInventory() {
        const csv = this.convertToCSV(this.inventory, ['productName', 'beginning', 'stock', 'updatedAt']);
        this.downloadCSV(csv, 'inventory.csv');
        this.showToast('Inventory exported successfully');
    }
    
    exportSales() {
        const csv = this.convertToCSV(this.sales, ['date', 'productName', 'quantity', 'price', 'discount', 'total', 'paymentMethod', 'profit', 'employee']);
        this.downloadCSV(csv, 'sales.csv');
        this.showToast('Sales exported successfully');
    }
    
    exportExpenses() {
        const csv = this.convertToCSV(this.expenses, ['date', 'category', 'description', 'amount', 'remarks']);
        this.downloadCSV(csv, 'expenses.csv');
        this.showToast('Expenses exported successfully');
    }
    
    exportPurchaseOrders() {
        const csv = this.convertToCSV(this.purchaseOrders, ['poNumber', 'date', 'supplier', 'productName', 'quantity', 'unitCost', 'total', 'status']);
        this.downloadCSV(csv, 'purchase-orders.csv');
        this.showToast('Purchase Orders exported successfully');
    }
    
    exportReport() {
        const period = document.getElementById('report-period')?.value || 'today';
        const stats = this.getStatsForPeriod(period);
        
        let report = `Mr. Chooks Business Report\n`;
        report += `Period: ${period}\n`;
        report += `Generated: ${new Date().toLocaleString()}\n\n`;
        report += `Summary:\n`;
        report += `Gross Sales: ₱${stats.grossSales.toFixed(2)}\n`;
        report += `Discounts: ₱${stats.totalDiscounts.toFixed(2)}\n`;
        report += `Net Sales: ₱${stats.netSales.toFixed(2)}\n`;
        report += `Total Expenses: ₱${stats.totalExpenses.toFixed(2)}\n`;
        report += `Net Profit: ₱${stats.netProfit.toFixed(2)}\n\n`;
        
        this.downloadText(report, `report-${period}-${Utils.generateId()}.txt`);
        this.showToast('Report exported successfully');
    }
    
    exportReconciliation() {
        const date = document.getElementById('reconciliation-date').value;
        if (!date) {
            this.showToast('Please select a date first', 'warning');
            return;
        }
        
        const stats = this.getStatsForPeriod(date);
        
        let report = `Mr. Chooks Daily Reconciliation\n`;
        report += `Date: ${date}\n`;
        report += `Generated: ${new Date().toLocaleString()}\n\n`;
        report += `Daily Summary:\n`;
        report += `Gross Sales: ₱${stats.grossSales.toFixed(2)}\n`;
        report += `Discounts: ₱${stats.totalDiscounts.toFixed(2)}\n`;
        report += `Net Sales: ₱${stats.netSales.toFixed(2)}\n`;
        report += `Total Expenses: ₱${stats.totalExpenses.toFixed(2)}\n\n`;
        
        report += `Sales by Payment Method:\n`;
        const paymentTotals = {};
        stats.filteredSales.forEach(s => {
            if (!paymentTotals[s.paymentMethod]) {
                paymentTotals[s.paymentMethod] = { amount: 0, count: 0 };
            }
            paymentTotals[s.paymentMethod].amount += s.total;
            paymentTotals[s.paymentMethod].count++;
        });
        
        for (const [method, data] of Object.entries(paymentTotals)) {
            report += `${method}: ₱${data.amount.toFixed(2)} (${data.count} transactions)\n`;
        }
        
        report += `\nExpenses by Category:\n`;
        const categoryTotals = {};
        stats.filteredExpenses.forEach(e => {
            if (!categoryTotals[e.category]) {
                categoryTotals[e.category] = { amount: 0, count: 0 };
            }
            categoryTotals[e.category].amount += e.amount;
            categoryTotals[e.category].count++;
        });
        
        for (const [category, data] of Object.entries(categoryTotals)) {
            report += `${category}: ₱${data.amount.toFixed(2)} (${data.count} transactions)\n`;
        }
        
        this.downloadText(report, `reconciliation-${date}.txt`);
        this.showToast('Reconciliation exported successfully');
    }
    
    convertToCSV(data, fields) {
        if (!data.length) return '';
        
        const header = fields.join(',');
        const rows = data.map(item =>
            fields.map(field => {
                const value = item[field] !== undefined ? item[field] : '';
                return `"${value}"`;
            }).join(',')
        );
        
        return [header, ...rows].join('\n');
    }
    
    downloadCSV(csv, filename) {
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
    }
    
    downloadText(text, filename) {
        const blob = new Blob([text], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
    }
    
    // Render All Views
    renderAll() {
        this.renderProducts();
        this.renderInventory();
        this.renderSales();
        this.renderExpenses();
        this.renderDeliveries();
        this.renderPurchaseOrders();
        this.updateDashboard();
        this.renderReports();
        this.renderDailyReconciliation();
    }
}

// Initialize admin dashboard
let adminDashboard;
document.addEventListener('DOMContentLoaded', () => {
    adminDashboard = new AdminDashboard();
});