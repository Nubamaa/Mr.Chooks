// Employee Kiosk Functionality
class EmployeeKiosk {
    constructor() {
        this.currentUser = requireAuth('employee');
        if (!this.currentUser) return;
        
        this.cart = [];
        this.selectedPaymentMethod = 'Cash';
        this.currentDiscount = null;
        this.products = [];
        this.selectedDiscountType = null;
        this.addToastCount = 0; // batch-added products counter
        this.addToastTimer = null; // timer to consolidate toasts
        this.toastGuards = {}; // throttle map for repeated errors
        this.apiBase = window.API_BASE_URL || 'http://localhost:3001';
        
        this.init();
    }
    
    async init() {
        this.setupEventListeners();
        this.updateTime();
        await this.loadProducts();
        await this.loadTodaySales();
        await this.loadUnsoldProducts();
        
        setInterval(() => this.updateTime(), 1000);
    }
    
    setupEventListeners() {
        // Logout
        document.getElementById('logout-btn').addEventListener('click', () => {
            logout();
        });
        
        // Product search
        document.getElementById('product-search').addEventListener('input', (e) => {
            this.filterProducts(e.target.value);
        });
        
        // Payment method selection
        document.querySelectorAll('.method-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetBtn = e.currentTarget;
                document.querySelectorAll('.method-btn').forEach(b => b.classList.remove('active'));
                targetBtn.classList.add('active');
                this.selectedPaymentMethod = targetBtn.dataset.method;
                
                // Show/hide GCash reference field
                const gcashRef = document.getElementById('gcash-reference');
                gcashRef.style.display = this.selectedPaymentMethod === 'GCash' ? 'block' : 'none';
            });
        });
        
        // Discount application
        document.getElementById('apply-discount').addEventListener('click', () => {
            this.openDiscountModal();
        });
        
        // Unsold products
        const recordUnsoldBtn = document.getElementById('record-unsold');
        if (recordUnsoldBtn) {
            recordUnsoldBtn.addEventListener('click', () => {
                this.openUnsoldModal();
            });
        }
        
        // Activity modal
        const activityToggle = document.getElementById('activity-toggle');
        const activityModal = document.getElementById('activity-modal');
        const closeActivityModal = document.getElementById('close-activity-modal');
        
        if (activityToggle && activityModal) {
            activityToggle.addEventListener('click', () => {
                activityModal.style.display = 'flex';
                this.loadTodaySalesModal();
                this.loadUnsoldProductsModal();
            });
        }
        
        if (closeActivityModal && activityModal) {
            closeActivityModal.addEventListener('click', () => {
                activityModal.style.display = 'none';
            });
        }
        
        // Activity modal close on background click
        if (activityModal) {
            activityModal.addEventListener('click', (e) => {
                if (e.target === activityModal) {
                    activityModal.style.display = 'none';
                }
            });
        }
        
        // Activity modal tab switching
        const activityTabBtns = document.querySelectorAll('#activity-modal .tab-btn');
        activityTabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                this.switchActivityModalTab(tab);
            });
        });
        
        // Record unsold from activity modal
        const activityRecordUnsoldBtn = document.getElementById('activity-record-unsold');
        if (activityRecordUnsoldBtn) {
            activityRecordUnsoldBtn.addEventListener('click', () => {
                this.openUnsoldModal();
            });
        }
        
        // Cart actions
        document.getElementById('clear-cart').addEventListener('click', () => {
            this.clearCart();
        });
        
        document.getElementById('complete-sale').addEventListener('click', () => {
            this.completeSale();
        });
        
        // Modal events
        this.setupModalEvents();
        
        // New sale button
        document.getElementById('new-sale-btn').addEventListener('click', () => {
            this.clearCart();
            this.closeModal('success-modal');
        });
        
        // Print receipt
        document.getElementById('print-receipt').addEventListener('click', () => {
            this.printReceipt();
        });

        // Global delegation for product-card clicks (ensures clicks always register)
        document.addEventListener('click', (e) => {
            const card = e.target.closest('.product-card-kiosk');
            if (card) {
                this.addToCart(card.dataset.id || card.getAttribute('data-id'));
            }
        });
        document.addEventListener('keydown', (e) => {
            if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('product-card-kiosk')) {
                e.preventDefault();
                const id = e.target.dataset.id || e.target.getAttribute('data-id');
                this.addToCart(id);
            }
        });

        // Cross-tab live updates: refresh products and sales when storage changes
        this.setupStorageSync();
    }
    
    setupModalEvents() {
        // Discount option buttons: delegation for reliable click and keyboard support
        const discountContainer = document.getElementById('discount-options') || document;
        const handleDiscountSelect = (buttonEl) => {
            document.querySelectorAll('.discount-option-btn').forEach(b => b.classList.remove('active'));
            buttonEl.classList.add('active');
            this.selectedDiscountType = buttonEl.dataset.type;
            const idField = document.getElementById('discount-id-field');
            const applyBtn = document.getElementById('apply-discount-btn');
            // All remaining options require ID
            idField.style.display = 'block';
            applyBtn.disabled = true;
            document.getElementById('discount-id').value = '';
            document.getElementById('id-usage-info').style.display = 'none';
        };
        discountContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.discount-option-btn');
            if (btn) handleDiscountSelect(btn);
        });
        document.querySelectorAll('.discount-option-btn').forEach(btn => {
            btn.setAttribute('tabindex', '0');
            btn.setAttribute('role', 'button');
            btn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleDiscountSelect(e.currentTarget);
                }
            });
        });
        
        // Real-time ID usage check
        document.getElementById('discount-id').addEventListener('input', (e) => {
            const idNumber = e.target.value.trim();
            const applyBtn = document.getElementById('apply-discount-btn');
            
            if (idNumber.length > 3) {
                this.checkIDUsage(idNumber);
                applyBtn.disabled = false;
            } else {
                document.getElementById('id-usage-info').textContent = '';
                applyBtn.disabled = true;
            }
        });
        
        document.getElementById('apply-discount-btn').addEventListener('click', () => {
            this.applyDiscount();
        });
        
        document.getElementById('cancel-discount').addEventListener('click', () => {
            this.closeModal('discount-modal');
        });
        
        // Unsold products modal
        document.getElementById('save-unsold').addEventListener('click', () => {
            this.saveUnsoldProduct();
        });
        
        document.getElementById('cancel-unsold').addEventListener('click', () => {
            this.closeModal('unsold-modal');
        });
        
        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) {
                    modal.classList.remove('active');
                }
            });
        });
        
        // Close modal on background click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
    }
    
    async checkIDUsage(idNumber) {
        if (!idNumber) return;
        
        const usageInfo = document.getElementById('id-usage-info');
        if (!usageInfo) return;
        
        try {
            // Load today's sales from API to check discounts
            const today = new Date().toISOString().split('T')[0];
            const sales = await api.getSales(today, today);
            const normalizedSales = DataNormalizer.normalize(sales, 'sales');
            
            // Check for discounts with this ID number in today's sales
            // Note: Discounts are part of sale data, need to check sale details
            const todayDiscounts = normalizedSales.filter(sale => {
                // This is a simplified check - in reality, we'd need to get sale details
                // For now, we'll check localStorage as fallback
                return false; // Placeholder
            });
            
            // Fallback to localStorage for now (discounts not in sale items)
            const discounts = JSON.parse(localStorage.getItem(STORAGE_KEYS.discounts) || '[]');
            const todayDiscountsLocal = discounts.filter(d => 
                d.idNumber === idNumber && d.date && d.date.startsWith(today)
            );
            
            if (todayDiscountsLocal.length === 0) {
                usageInfo.textContent = '✅ This ID has not been used today';
                usageInfo.style.color = 'var(--success-dark)';
            } else {
                usageInfo.textContent = `⚠️ This ID has been used ${todayDiscountsLocal.length} time(s) today`;
                usageInfo.style.color = 'var(--warning-dark)';
            }
        } catch (error) {
            console.error('Error checking ID usage:', error);
            // Fallback to localStorage
            const discounts = JSON.parse(localStorage.getItem(STORAGE_KEYS.discounts) || '[]');
            const today = new Date().toISOString().split('T')[0];
            const todayDiscounts = discounts.filter(d => 
                d.idNumber === idNumber && d.date && d.date.startsWith(today)
            );
            
            if (todayDiscounts.length === 0) {
                usageInfo.textContent = '✅ This ID has not been used today';
                usageInfo.style.color = 'var(--success-dark)';
            } else {
                usageInfo.textContent = `⚠️ This ID has been used ${todayDiscounts.length} time(s) today`;
                usageInfo.style.color = 'var(--warning-dark)';
            }
        }
    }
    
    updateTime() {
        const now = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        const dateStr = now.toLocaleDateString('en-US', options);
        document.getElementById('current-time').textContent = 
            dateStr + ' ' + now.toLocaleTimeString();
    }
    
    async loadProducts() {
        try {
            // Load products and inventory from API
            const [products, inventory] = await Promise.allSettled([
                api.getProducts(),
                api.getInventory()
            ]);
            
            // Normalize products from API
            const rawProducts = products.status === 'fulfilled' 
                ? products.value
                : JSON.parse(localStorage.getItem(STORAGE_KEYS.products) || '[]');
            
            this.products = DataNormalizer.normalize(rawProducts, 'products')
                .filter(p => p.isActive !== 0 && p.isActive !== false);
            
            // Normalize inventory from API using products for product names
            const rawInventory = inventory.status === 'fulfilled'
                ? inventory.value
                : JSON.parse(localStorage.getItem(STORAGE_KEYS.inventory) || '[]');
            
            this.inventory = DataNormalizer.normalizeInventory(rawInventory, this.products);
            
            // Sync to localStorage as backup
            this.saveData(STORAGE_KEYS.products, this.products);
            this.saveData(STORAGE_KEYS.inventory, this.inventory);
            
            this.renderProducts(this.products);
        } catch (error) {
            console.error('Error loading products:', error);
            // Fallback to localStorage
            const rawProducts = JSON.parse(localStorage.getItem(STORAGE_KEYS.products) || '[]');
            this.products = DataNormalizer.normalize(rawProducts, 'products')
                .filter(p => p.isActive !== false);
            this.renderProducts(this.products);
        }
    }
    
    saveData(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            return false;
        }
    }
    
    renderProducts(products) {
        const grid = document.getElementById('products-grid');
        
        if (!products.length) {
            grid.innerHTML = `
                <div class="empty">
                    <div class="empty-icon"><i class="fas fa-drumstick-bite"></i></div>
                    <div class="empty-text">No products available</div>
                </div>
            `;
            return;
        }
        
        grid.innerHTML = products.map(product => {
            // Handle both productId and product_id field names
            const inventoryItem = this.inventory.find(i => 
                (i.productId === product.id) || (i.product_id === product.id)
            );
            const stock = inventoryItem ? (inventoryItem.stock || 0) : 0;
            
            return `
                <div class="product-card-kiosk ${stock <= 0 ? 'out-of-stock' : stock < 10 ? 'low-stock' : ''}" data-id="${product.id}" tabindex="0" role="button" aria-label="Add ${product.name}" ${stock <= 0 ? 'aria-disabled="true"' : ''} ${stock <= 0 ? 'title="Out of stock"' : ''}>
                    <div class="product-name-kiosk">${product.name}</div>
                    <div class="product-price-kiosk">₱${product.price.toFixed(2)}</div>
                    <div class="product-stock-kiosk">Stock: ${stock}</div>
                </div>
            `;
        }).join('');

        // Note: click handling is attached once at document level in setupEventListeners
    }
    
    filterProducts(searchTerm) {
        const filtered = this.products.filter(product =>
            product.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        this.renderProducts(filtered);
    }
    
    addToCart(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;
        
        // Check inventory (handle both productId and product_id field names)
        const inventoryItem = this.inventory.find(i => 
            (i.productId === productId) || (i.product_id === productId)
        );
        if (!inventoryItem || (inventoryItem.stock || 0) <= 0) {
            this.showToastOnce(`no_stock_${productId}`, 'Product has no stock!', 'error', 1200);
            return;
        }
        
        const existingItem = this.cart.find(item => item.id === productId);
        const stock = inventoryItem.stock || 0;
        
        if (existingItem) {
            // Check if we have enough stock
            if (existingItem.quantity >= stock) {
                this.showToast('Not enough stock available!', 'error');
                return;
            }
            existingItem.quantity++;
        } else {
            this.cart.push({
                id: product.id,
                name: product.name,
                price: product.price,
                cost: product.cost || 0,
                quantity: 1
            });
        }
        
        // Auto-apply whole chicken discount if product is whole chicken
        if ((product.name.toLowerCase().includes('whole chicken') || 
             product.name.toLowerCase().includes('whole')) && !this.currentDiscount) {
            this.currentDiscount = {
                type: 'whole_chicken',
                idNumber: null,
                amount: 20
            };
            this.showToast('₱20 whole chicken discount applied automatically', 'success');
        }
        
        this.renderCart();
        // Batch success notifications: show a single toast summarizing added count
        this.batchAddToast();
    }
    
    removeFromCart(productId) {
        this.cart = this.cart.filter(item => item.id !== productId);
        this.renderCart();
    }
    
    updateQuantity(productId, change) {
        const item = this.cart.find(item => item.id === productId);
        if (!item) return;
        
        // Check inventory
        const inventory = JSON.parse(localStorage.getItem(STORAGE_KEYS.inventory) || '[]');
        const inventoryItem = inventory.find(i => i.productId === productId);
        
        const newQuantity = item.quantity + change;
        
        if (newQuantity <= 0) {
            this.removeFromCart(productId);
            return;
        }
        
        if (inventoryItem && newQuantity > inventoryItem.stock) {
            this.showToast('Not enough stock available!', 'error');
            return;
        }
        
        item.quantity = newQuantity;
        this.renderCart();
    }
    
    renderCart() {
        const container = document.getElementById('cart-items');
        
        if (this.cart.length === 0) {
            container.innerHTML = `
                <div class="empty">
                    <div class="empty-icon"><i class="fas fa-shopping-cart"></i></div>
                    <div class="empty-text">Cart is empty</div>
                </div>
            `;
        } else {
            container.innerHTML = this.cart.map(item => `
                <div class="cart-item">
                    <div class="cart-item-info">
                        <div class="cart-item-name">${item.name}</div>
                        <div class="cart-item-price">₱${item.price.toFixed(2)} each</div>
                    </div>
                    <div class="cart-item-controls">
                        <div class="quantity-controls">
                            <button class="quantity-btn" onclick="employeeKiosk.updateQuantity('${item.id}', -1)">
                                <i class="fas fa-minus"></i>
                            </button>
                            <span class="cart-item-quantity">${item.quantity}</span>
                            <button class="quantity-btn" onclick="employeeKiosk.updateQuantity('${item.id}', 1)">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                        <div class="cart-item-total">₱${(item.quantity * item.price).toFixed(2)}</div>
                        <div class="remove-item" onclick="employeeKiosk.removeFromCart('${item.id}')">
                            <i class="fas fa-times"></i>
                        </div>
                    </div>
                </div>
            `).join('');
        }
        
        this.updateCartSummary();
    }
    
    updateCartSummary() {
        const subtotal = this.cart.reduce((sum, item) => sum + (item.quantity * item.price), 0);
        const discountAmount = this.currentDiscount ? this.currentDiscount.amount : 0;
        const total = Math.max(0, subtotal - discountAmount);
        
        document.getElementById('cart-subtotal').textContent = `₱${subtotal.toFixed(2)}`;
        document.getElementById('discount-amount').textContent = `-₱${discountAmount.toFixed(2)}`;
        document.getElementById('cart-total').textContent = `₱${total.toFixed(2)}`;
        
        // Show/hide discount section based on whether discount is applied
        const discountSection = document.querySelector('.discount-section');
        if (this.currentDiscount) {
            discountSection.style.display = 'block';
            document.getElementById('apply-discount').textContent = 'Change Discount';
            
            // Show discount type badge
            let discountTypeText = '';
            switch(this.currentDiscount.type) {
                case 'whole_chicken':
                    discountTypeText = 'Whole Chicken';
                    break;
                case 'pwd':
                    discountTypeText = 'PWD';
                    break;
                case 'senior':
                    discountTypeText = 'Senior';
                    break;
            }
            
            // Add discount type display
            let discountTypeDisplay = document.getElementById('discount-type-display');
            if (!discountTypeDisplay) {
                discountTypeDisplay = document.createElement('div');
                discountTypeDisplay.id = 'discount-type-display';
                discountTypeDisplay.className = 'discount-type-badge';
                discountSection.appendChild(discountTypeDisplay);
            }
            discountTypeDisplay.innerHTML = `<span class="badge badge-info">${discountTypeText}</span>`;
            
        } else {
            discountSection.style.display = 'block'; // Always show the discount section
            document.getElementById('apply-discount').textContent = 'Apply Discount';
            
            // Remove discount type display if it exists
            const discountTypeDisplay = document.getElementById('discount-type-display');
            if (discountTypeDisplay) {
                discountTypeDisplay.remove();
            }
            
            // Reset discount amount display
            document.getElementById('discount-amount').textContent = '₱0.00';
        }
        
        this.updateCompleteButton();
    }
    
    updateCompleteButton() {
        const button = document.getElementById('complete-sale');
        button.disabled = this.cart.length === 0;
    }
    
    clearCart() {
        this.cart = [];
        this.currentDiscount = null;
        this.renderCart();
        document.getElementById('gcash-ref-id').value = '';
        this.updateCartSummary();
    }
    
    switchTab(tab) {
        // Update active tab button
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        
        // Update active tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tab}-tab`).classList.add('active');
    }
    
    openDiscountModal() {
        document.getElementById('discount-modal').classList.add('active');
        document.querySelectorAll('.discount-option-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById('discount-id-field').style.display = 'none';
        document.getElementById('discount-id').value = '';
        document.getElementById('id-usage-info').style.display = 'none';
        document.getElementById('apply-discount-btn').disabled = true;
        this.selectedDiscountType = null;
    }
    
    applyDiscount() {
        const idNumber = document.getElementById('discount-id').value.trim();
        const amount = 20; // Fixed amount
        
        if (!this.selectedDiscountType) {
            this.showToast('Please select a discount type', 'error');
            return;
        }
        
        if ((this.selectedDiscountType === 'pwd' || this.selectedDiscountType === 'senior') && !idNumber) {
            this.showToast('Please enter ID number', 'error');
            return;
        }
        
        const subtotal = this.cart.reduce((sum, item) => sum + (item.quantity * item.price), 0);
        if (amount > subtotal) {
            this.showToast('Subtotal must be at least ₱20 to apply discount', 'error');
            return;
        }
        
        this.currentDiscount = {
            type: this.selectedDiscountType,
            idNumber: idNumber,
            amount
        };
        
        this.updateCartSummary();
        this.closeModal('discount-modal');
        this.showToast('₱20.00 discount applied successfully', 'success');
    }
    
    openUnsoldModal() {
        this.updateUnsoldProductSelect();
        document.getElementById('unsold-modal').classList.add('active');
        document.getElementById('unsold-quantity').value = '';
        document.getElementById('unsold-price').value = '';
        document.getElementById('unsold-reason').value = 'quality';
    }
    
    updateUnsoldProductSelect() {
        const select = document.getElementById('unsold-product');
        const products = this.products;
        
        select.innerHTML = '<option value="">Select Product</option>' +
            products.map(p => `<option value="${p.id}" data-price="${p.price}">${p.name}</option>`).join('');
        
        // Set default price when product is selected
        select.addEventListener('change', (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            const price = selectedOption.dataset.price;
            if (price) {
                document.getElementById('unsold-price').value = price;
            }
        });
    }
    
    async saveUnsoldProduct() {
        const productId = document.getElementById('unsold-product').value;
        const quantity = parseInt(document.getElementById('unsold-quantity').value) || 0;
        const price = parseFloat(document.getElementById('unsold-price').value) || 0;
        const reason = document.getElementById('unsold-reason').value;
        
        if (!productId) {
            alert('Please select a product');
            return;
        }
        
        if (quantity <= 0) {
            alert('Please enter valid quantity');
            return;
        }
        
        if (price <= 0) {
            alert('Please enter valid price');
            return;
        }
        
        const product = this.products.find(p => p.id === productId);
        if (!product) {
            alert('Product not found');
            return;
        }
        
        const unsoldProducts = JSON.parse(localStorage.getItem(STORAGE_KEYS.unsoldProducts) || '[]');
        
        unsoldProducts.push({
            id: Utils.generateId(),
            productId,
            productName: product.name,
            quantity,
            price,
            reason,
            date: new Date().toISOString(),
            recordedBy: this.currentUser.name,
            createdAt: new Date().toISOString()
        });
        
        if (this.saveData(STORAGE_KEYS.unsoldProducts, unsoldProducts)) {
            this.showToast('Unsold product recorded successfully', 'success');
            this.closeModal('unsold-modal');
            this.loadUnsoldProducts();
            // API sync
            try {
                fetch(`${this.apiBase}/api/unsold`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ product_id: productId, product_name: product.name, quantity, price, reason, recorded_by: this.currentUser?.name })
                }).catch(()=>{});
            } catch (e) {}
        }
    }

    // Consolidate multiple add-to-cart clicks into a single success toast
    batchAddToast() {
        this.addToastCount++;
        if (this.addToastTimer) {
            clearTimeout(this.addToastTimer);
        }
        this.addToastTimer = setTimeout(() => {
            const count = this.addToastCount;
            const label = count === 1 ? 'product added to cart' : 'products added to cart';
            this.showToast(`${count} ${label}`, 'success');
            this.addToastCount = 0;
            this.addToastTimer = null;
        }, 400);
    }

    // Show a toast only once per cooldown window for a given key
    showToastOnce(key, message, type = 'info', cooldownMs = 1000) {
        const now = Date.now();
        const until = this.toastGuards[key] || 0;
        if (now < until) return;
        this.toastGuards[key] = now + cooldownMs;
        this.showToast(message, type);
    }

    setupStorageSync() {
        window.addEventListener('storage', (e) => {
            if (!e.key) return;
            if (e.key === STORAGE_KEYS.inventory || e.key === STORAGE_KEYS.products) {
                // Update product list and stock badges
                this.loadProducts();
            }
            if (e.key === STORAGE_KEYS.sales || e.key === STORAGE_KEYS.discounts) {
                // Update today sales list
                this.loadTodaySales();
            }
            if (e.key === STORAGE_KEYS.unsoldProducts) {
                this.loadUnsoldProducts().catch(() => {});
            }
        });
    }

    saveData(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error(`Failed to save data for key: ${key}`, e);
            this.showToast(`Error saving data. See console for details.`, 'error');
            return false;
        }
    }
    
    async loadUnsoldProducts() {
        const container = document.getElementById('unsold-products');
        if (!container) return;
        
        try {
            const unsoldProducts = await api.getUnsold();
            const normalized = DataNormalizer.normalize(unsoldProducts, 'unsold');
            const today = new Date().toISOString().split('T')[0];
            
            const todayUnsold = normalized.filter(item => 
                item.date && item.date.startsWith(today)
            );
            
            if (!todayUnsold.length) {
                container.innerHTML = `
                    <div class="empty">
                        <div class="empty-icon"><i class="fas fa-check-circle"></i></div>
                        <div class="empty-text">No unsold products today</div>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = todayUnsold.map(item => `
                <div class="unsold-item">
                    <div class="unsold-info">
                        <h4>${item.productName || item.product_name}</h4>
                        <div class="unsold-details">
                            Quantity: ${item.quantity} • Price: ₱${item.price.toFixed(2)} • ${this.getReasonText(item.reason)}
                        </div>
                    </div>
                    <div class="unsold-amount">
                        ₱${(item.quantity * item.price).toFixed(2)}
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error loading unsold products:', error);
            // Fallback to localStorage
            const unsoldProducts = JSON.parse(localStorage.getItem(STORAGE_KEYS.unsoldProducts) || '[]');
            const today = new Date().toISOString().split('T')[0];
            const todayUnsold = unsoldProducts.filter(item => item.date && item.date.startsWith(today));
            
            if (!todayUnsold.length) {
                container.innerHTML = `
                    <div class="empty">
                        <div class="empty-icon"><i class="fas fa-check-circle"></i></div>
                        <div class="empty-text">No unsold products today</div>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = todayUnsold.map(item => `
                <div class="unsold-item">
                    <div class="unsold-info">
                        <h4>${item.productName}</h4>
                        <div class="unsold-details">
                            Quantity: ${item.quantity} • Price: ₱${item.price.toFixed(2)} • ${this.getReasonText(item.reason)}
                        </div>
                    </div>
                    <div class="unsold-amount">
                        ₱${(item.quantity * item.price).toFixed(2)}
                    </div>
                </div>
            `).join('');
        }
    }
    
    getReasonText(reason) {
        const reasons = {
            'quality': 'Quality Issues',
            'excess': 'Excess Inventory',
            'other': 'Other'
        };
        return reasons[reason] || reason;
    }
    
    async loadTodaySales() {
        const container = document.getElementById('sales-list');
        if (!container) return;
        
        try {
            // Load sales from API
            const today = new Date().toISOString().split('T')[0];
            const sales = await api.getSales(today, today);
            
            // Normalize sales data
            const normalizedSales = DataNormalizer.normalize(sales, 'sales');
            
            // Filter to today and sort
            const todaySales = normalizedSales
                .filter(sale => sale.date && sale.date.startsWith(today))
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, 10);
            
            if (!todaySales.length) {
                container.innerHTML = `
                    <div class="empty">
                        <div class="empty-icon"><i class="fas fa-receipt"></i></div>
                        <div class="empty-text">No sales today</div>
                    </div>
                `;
                return;
            }
            
            // Group sales by transaction (saleId)
            const transactions = {};
            todaySales.forEach(sale => {
                const saleId = sale.saleId || sale.id;
                if (!transactions[saleId]) {
                    transactions[saleId] = {
                        id: saleId,
                        time: sale.date,
                        paymentMethod: sale.paymentMethod,
                        gcashReference: sale.gcashReference,
                        items: [],
                        total: 0,
                        employee: sale.employee || 'N/A'
                    };
                }
                transactions[saleId].items.push(sale);
                transactions[saleId].total += sale.total || (sale.quantity * sale.price);
            });
        
            container.innerHTML = Object.values(transactions).map(transaction => `
                <div class="sale-item">
                    <div class="sale-info">
                        <h4>₱${transaction.total.toFixed(2)}</h4>
                        <div class="sale-details">
                            ${new Date(transaction.time).toLocaleTimeString()} • 
                            ${transaction.paymentMethod}
                            ${transaction.gcashReference ? ` • Ref: ${transaction.gcashReference}` : ''} •
                            ${transaction.items.length} item(s)
                        </div>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error loading sales:', error);
            // Fallback to localStorage
            const sales = JSON.parse(localStorage.getItem(STORAGE_KEYS.sales) || '[]');
            const today = new Date().toISOString().split('T')[0];
            const todaySales = sales
                .filter(sale => sale.date && sale.date.startsWith(today))
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, 10);
            
            if (!todaySales.length) {
                container.innerHTML = `
                    <div class="empty">
                        <div class="empty-icon"><i class="fas fa-receipt"></i></div>
                        <div class="empty-text">No sales today</div>
                    </div>
                `;
                return;
            }
            
            // Group sales by transaction
            const transactions = {};
            todaySales.forEach(sale => {
                if (!transactions[sale.id]) {
                    transactions[sale.id] = {
                        id: sale.id,
                        time: sale.date,
                        paymentMethod: sale.paymentMethod,
                        gcashReference: sale.gcashReference,
                        items: [sale],
                        total: sale.total || 0,
                        employee: sale.employee || 'N/A'
                    };
                } else {
                    transactions[sale.id].items.push(sale);
                    transactions[sale.id].total += sale.total || 0;
                }
            });
            
            container.innerHTML = Object.values(transactions).map(transaction => `
                <div class="sale-item">
                    <div class="sale-info">
                        <h4>₱${transaction.total.toFixed(2)}</h4>
                        <div class="sale-details">
                            ${new Date(transaction.time).toLocaleTimeString()} • 
                            ${transaction.paymentMethod}
                            ${transaction.gcashReference ? ` • Ref: ${transaction.gcashReference}` : ''} •
                            ${transaction.items.length} item(s)
                        </div>
                    </div>
                </div>
            `).join('');
        }
    }
    
    async completeSale() {
        if (this.cart.length === 0) {
            this.showToast('Cart is empty!', 'error');
            return;
        }
        
        if (this.selectedPaymentMethod === 'GCash') {
            const gcashRef = document.getElementById('gcash-ref-id').value.trim();
            if (!gcashRef) {
                this.showToast('GCash reference ID is required', 'error');
                return;
            }
        }
        
        const subtotal = this.cart.reduce((sum, item) => sum + (item.quantity * item.price), 0);
        const discountAmount = this.currentDiscount ? this.currentDiscount.amount : 0;
        const total = Math.max(0, subtotal - discountAmount);
        
        // Check inventory before proceeding (use loaded inventory data)
        for (const cartItem of this.cart) {
            const inventoryItem = this.inventory.find(i => 
                (i.productId === cartItem.id) || (i.product_id === cartItem.id)
            );
            const stock = inventoryItem ? (inventoryItem.stock || 0) : 0;
            if (stock < cartItem.quantity) {
                this.showToast(`Insufficient stock for ${cartItem.name}! Available: ${stock}`, 'error');
                return;
            }
        }
        
        try {
            const now = new Date().toISOString();
            const payload = {
                payment_method: this.selectedPaymentMethod,
                gcash_reference: this.selectedPaymentMethod === 'GCash' ? document.getElementById('gcash-ref-id').value : null,
                date: now,
                items: this.cart.map(ci => ({
                    product_id: ci.id,
                    product_name: ci.name,
                    quantity: ci.quantity,
                    price: ci.price,
                    cost: ci.cost || 0
                })),
                discount: this.currentDiscount ? {
                    type: this.currentDiscount.type,
                    id_number: this.currentDiscount.idNumber,
                    amount: this.currentDiscount.amount,
                    employee_name: this.currentUser?.name
                } : null
            };
            
            // Create sale via API (API handles inventory update)
            await api.createSale(payload);
            
            // Refresh products and inventory from API to get updated stock
            await this.loadProducts();
            await this.loadTodaySales();
            
            // Show success modal
            this.showSuccessModal(total);
            this.clearCart();
        } catch (error) {
            console.error('Error completing sale:', error);
            this.showToast(`Failed to complete sale: ${error.message}`, 'error');
        }
    }
    
    showSuccessModal(total) {
        const summary = document.getElementById('sale-summary');
        const paymentMethod = document.querySelector('.method-btn.active').dataset.method;
        const gcashRef = paymentMethod === 'GCash' ? document.getElementById('gcash-ref-id').value : null;
        
        summary.innerHTML = `
            <div class="summary-row">
                <span>Total Amount:</span>
                <span>₱${total.toFixed(2)}</span>
            </div>
            <div class="summary-row">
                <span>Payment Method:</span>
                <span>${paymentMethod}</span>
            </div>
            ${gcashRef ? `
            <div class="summary-row">
                <span>GCash Reference:</span>
                <span>${gcashRef}</span>
            </div>
            ` : ''}
            <div class="summary-row">
                <span>Time:</span>
                <span>${new Date().toLocaleString()}</span>
            </div>
            ${this.currentDiscount ? `
            <div class="summary-row">
                <span>Discount Applied:</span>
                <span>${this.getDiscountTypeText(this.currentDiscount.type)} - ₱${this.currentDiscount.amount.toFixed(2)}</span>
            </div>
            ${this.currentDiscount.idNumber ? `
            <div class="summary-row">
                <span>ID Number:</span>
                <span>${this.currentDiscount.idNumber}</span>
            </div>
            ` : ''}
            ` : ''}
        `;
        
        this.openModal('success-modal');
    }
    
    getDiscountTypeText(type) {
        const types = {
            'whole_chicken': 'Whole Chicken',
            'pwd': 'PWD',
            'senior': 'Senior Citizen'
        };
        return types[type] || type;
    }
    
    printReceipt() {
        const receiptContent = this.generateReceiptContent();
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Receipt</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; max-width: 300px; margin: 0 auto; }
                        .receipt-header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
                        .receipt-items { margin: 20px 0; }
                        .receipt-item { display: flex; justify-content: space-between; margin: 5px 0; }
                        .receipt-total { font-weight: bold; border-top: 2px solid #000; padding-top: 10px; margin-top: 10px; }
                        .receipt-footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
                    </style>
                </head>
                <body>
                    ${receiptContent}
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    }
    
    generateReceiptContent() {
        const subtotal = this.cart.reduce((sum, item) => sum + (item.quantity * item.price), 0);
        const discountAmount = this.currentDiscount ? this.currentDiscount.amount : 0;
        const total = Math.max(0, subtotal - discountAmount);
        const paymentMethod = document.querySelector('.method-btn.active').dataset.method;
        const gcashRef = paymentMethod === 'GCash' ? document.getElementById('gcash-ref-id').value : null;
        
        let discountTypeText = '';
        let idNumberText = '';
        
        if (this.currentDiscount) {
            switch(this.currentDiscount.type) {
                case 'whole_chicken':
                    discountTypeText = 'Whole Chicken Discount';
                    break;
                case 'pwd':
                    discountTypeText = 'PWD Discount';
                    idNumberText = `PWD ID: ${this.currentDiscount.idNumber}`;
                    break;
                case 'senior':
                    discountTypeText = 'Senior Citizen Discount';
                    idNumberText = `Senior ID: ${this.currentDiscount.idNumber}`;
                    break;
            }
        }
        
        return `
            <div class="receipt-header">
                <h2>Mr. Chooks</h2>
                <p>Thank you for your purchase!</p>
                <p>${new Date().toLocaleString()}</p>
                <p>Server: ${this.currentUser.name}</p>
            </div>
            <div class="receipt-items">
                ${this.cart.map(item => `
                    <div class="receipt-item">
                        <span>${item.name} x${item.quantity}</span>
                        <span>₱${(item.quantity * item.price).toFixed(2)}</span>
                    </div>
                `).join('')}
            </div>
            <div style="border-top: 1px solid #ccc; padding-top: 10px;">
                <div class="receipt-item">
                    <span>Subtotal:</span>
                    <span>₱${subtotal.toFixed(2)}</span>
                </div>
                ${this.currentDiscount ? `
                <div class="receipt-item">
                    <span>${discountTypeText}:</span>
                    <span>-₱${discountAmount.toFixed(2)}</span>
                </div>
                ` : ''}
                <div class="receipt-item receipt-total">
                    <span>Total:</span>
                    <span>₱${total.toFixed(2)}</span>
                </div>
            </div>
            <div style="margin-top: 20px; text-align: center;">
                <p>Payment Method: ${paymentMethod}</p>
                ${gcashRef ? `<p>GCash Ref: ${gcashRef}</p>` : ''}
                ${idNumberText ? `<p>${idNumberText}</p>` : ''}
            </div>
            <div class="receipt-footer">
                <p>Thank you for choosing Mr. Chooks!</p>
            </div>
        `;
    }
    
    openModal(id) {
        document.getElementById(id).classList.add('active');
    }
    
    closeModal(id) {
        document.getElementById(id).classList.remove('active');
    }
    
    showToast(message, type = 'success') {
        // Create toast container if it doesn't exist
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        // Remove existing toasts of the same type to avoid piling up
        Array.from(container.querySelectorAll(`.toast.${type}`)).forEach(el => el.remove());
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-times-circle',
            warning: 'fa-exclamation-triangle'
        };
        
        const titles = {
            success: 'Success',
            error: 'Error',
            warning: 'Warning'
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
        
        container.appendChild(toast);
        
        // Auto remove after duration
        setTimeout(() => {
            if (toast.parentElement) {
                toast.style.animation = 'slideIn 0.3s ease reverse';
                setTimeout(() => toast.remove(), 300);
            }
        }, 3000);
    }

    // Slider View Functionality
    switchActivityModalTab(tabName) {
        // Remove active class from all tabs and contents in activity modal
        document.querySelectorAll('#activity-modal .tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('#activity-modal .tab-content').forEach(content => {
            content.classList.remove('active');
        });

        // Add active class to clicked tab
        document.querySelectorAll(`#activity-modal .tab-btn[data-tab="${tabName}"]`).forEach(btn => {
            btn.classList.add('active');
        });

        // Show corresponding content
        if (tabName === 'sales') {
            const salesTab = document.getElementById('activity-sales-tab');
            if (salesTab) {
                salesTab.classList.add('active');
            }
        } else if (tabName === 'unsold') {
            const unsoldTab = document.getElementById('activity-unsold-tab');
            if (unsoldTab) {
                unsoldTab.classList.add('active');
            }
        }
    }

    async loadTodaySalesModal() {
        const container = document.getElementById('activity-sales-list');
        if (!container) return;
        
        try {
            const today = new Date().toISOString().split('T')[0];
            const sales = await api.getSales(today, today);
            const normalizedSales = DataNormalizer.normalize(sales, 'sales');
            
            const todaySales = normalizedSales
                .filter(sale => sale.date && sale.date.startsWith(today))
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, 10);
            
            if (!todaySales.length) {
                container.innerHTML = `
                    <div class="empty">
                        <div class="empty-icon"><i class="fas fa-receipt"></i></div>
                        <div class="empty-text">No sales today</div>
                    </div>
                `;
                return;
            }
            
            const transactions = {};
            todaySales.forEach(sale => {
                const saleId = sale.saleId || sale.id;
                if (!transactions[saleId]) {
                    transactions[saleId] = {
                        id: saleId,
                        time: sale.date,
                        paymentMethod: sale.paymentMethod,
                        gcashReference: sale.gcashReference,
                        items: [],
                        total: 0,
                        employee: sale.employee || 'N/A'
                    };
                }
                transactions[saleId].items.push(sale);
                transactions[saleId].total += sale.total || (sale.quantity * sale.price);
            });
        
            // Store transactions for detail view
            this.currentTransactions = Object.values(transactions);

            container.innerHTML = this.currentTransactions.map((transaction, index) => `
                <div class="sale-item" data-transaction-index="${index}" style="cursor: pointer;">
                    <div class="sale-info">
                        <h4>₱${transaction.total.toFixed(2)}</h4>
                        <div class="sale-details">
                            ${new Date(transaction.time).toLocaleTimeString()} • 
                            ${transaction.paymentMethod}
                            ${transaction.gcashReference ? ` • Ref: ${transaction.gcashReference}` : ''} •
                            ${transaction.items.length} item(s)
                        </div>
                    </div>
                </div>
            `).join('');

            // Add click handlers to sale items
            container.querySelectorAll('.sale-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    const index = parseInt(e.currentTarget.dataset.transactionIndex);
                    this.showSaleDetails(this.currentTransactions[index]);
                });
            });
        } catch (error) {
            console.error('Error loading sales:', error);
        }
    }

    showSaleDetails(transaction) {
        const detailsContainer = document.getElementById('sale-details-content');
        const detailsModal = document.getElementById('sale-details-modal');
        const activityModal = document.getElementById('activity-modal');

        const itemsHtml = transaction.items.map(item => `
            <div style="display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid var(--border);">
                <div>
                    <div style="font-weight: 700;">${item.productName || item.product_name}</div>
                    <div style="font-size: 14px; color: var(--text-light);">Qty: ${item.quantity}</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-weight: 700;">₱${(item.quantity * item.price).toFixed(2)}</div>
                    <div style="font-size: 12px; color: var(--text-light);">₱${item.price.toFixed(2)} each</div>
                </div>
            </div>
        `).join('');

        detailsContainer.innerHTML = `
            <div style="margin-bottom: 20px;">
                <h3 style="font-size: 28px; font-weight: 800; color: var(--primary); margin-bottom: 10px;">₱${transaction.total.toFixed(2)}</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                    <div>
                        <div style="font-size: 12px; color: var(--text-light); text-transform: uppercase;"><i class="fas fa-clock"></i> Time</div>
                        <div style="font-weight: 700; font-size: 16px;">${new Date(transaction.time).toLocaleTimeString()}</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: var(--text-light); text-transform: uppercase;">
                            ${transaction.paymentMethod === 'GCash' ? '<i class="fas fa-mobile-alt"></i>' : '<i class="fas fa-money-bill"></i>'} 
                            Payment Method
                        </div>
                        <div style="font-weight: 700; font-size: 16px;">${transaction.paymentMethod}</div>
                    </div>
                    ${transaction.paymentMethod === 'GCash' && transaction.gcashReference ? `
                        <div style="grid-column: 1 / -1;">
                            <div style="font-size: 12px; color: var(--text-light); text-transform: uppercase;"><i class="fas fa-link"></i> GCash Reference Number</div>
                            <div style="font-weight: 700; font-size: 16px; padding: 8px 12px; background: var(--bg-secondary); border-radius: 6px; border-left: 4px solid var(--accent-orange);">${transaction.gcashReference}</div>
                        </div>
                    ` : ''}
                    <div>
                        <div style="font-size: 12px; color: var(--text-light); text-transform: uppercase;"><i class="fas fa-user"></i> Employee</div>
                        <div style="font-weight: 700; font-size: 16px;">${transaction.employee}</div>
                    </div>
                </div>
            </div>

            <div style="border: 2px solid var(--border); border-radius: 8px; overflow: hidden;">
                <div style="padding: 15px; background: var(--bg-secondary); font-weight: 700; border-bottom: 2px solid var(--border);">
                    Items (${transaction.items.length})
                </div>
                ${itemsHtml}
            </div>
        `;

        activityModal.style.display = 'none';
        detailsModal.style.display = 'flex';

        // Setup back button
        const backBtn = document.getElementById('back-to-activity');
        if (backBtn) {
            backBtn.onclick = () => {
                detailsModal.style.display = 'none';
                activityModal.style.display = 'flex';
            };
        }

        const closeBtn = document.getElementById('close-sale-details-modal');
        if (closeBtn) {
            closeBtn.onclick = () => {
                detailsModal.style.display = 'none';
                activityModal.style.display = 'flex';
            };
        }
    }

    async loadUnsoldProductsModal() {
        const container = document.getElementById('activity-unsold-products');
        if (!container) return;
        
        try {
            const unsoldProducts = await api.getUnsold();
            const normalized = DataNormalizer.normalize(unsoldProducts, 'unsold');
            const today = new Date().toISOString().split('T')[0];
            
            const todayUnsold = normalized.filter(item => 
                item.date && item.date.startsWith(today)
            );
            
            if (!todayUnsold.length) {
                container.innerHTML = `
                    <div class="empty">
                        <div class="empty-icon"><i class="fas fa-check-circle"></i></div>
                        <div class="empty-text">No unsold products today</div>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = todayUnsold.map(item => `
                <div class="unsold-item">
                    <div class="unsold-info">
                        <h4>${item.productName || item.product_name}</h4>
                        <div class="unsold-details">
                            Quantity: ${item.quantity} • Price: ₱${item.price.toFixed(2)} • ${this.getReasonText(item.reason)}
                        </div>
                    </div>
                    <div class="unsold-amount">
                        ₱${(item.quantity * item.price).toFixed(2)}
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error loading unsold products:', error);
        }
    }
}

// Initialize employee kiosk when page loads
let employeeKiosk;
document.addEventListener('DOMContentLoaded', () => {
    employeeKiosk = new EmployeeKiosk();
});