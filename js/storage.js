// Enhanced Data Storage Management - No Default Data
const STORAGE_KEYS = {
    products: 'mrchooks-products',
    inventory: 'mrchooks-inventory',
    sales: 'mrchooks-sales',
    expenses: 'mrchooks-expenses',
    purchaseOrders: 'mrchooks-purchase-orders',
    losses: 'mrchooks-losses',
    settings: 'mrchooks-settings',
    deliveries: 'mrchooks-deliveries',
    discounts: 'mrchooks-discounts',
    poPayments: 'mrchooks-po-payments',
    unsoldProducts: 'mrchooks-unsold-products'
};

// Initialize empty data structure
function initializeEmptyData() {
    Object.entries(STORAGE_KEYS).forEach(([key, storageKey]) => {
        if (!localStorage.getItem(storageKey)) {
            localStorage.setItem(storageKey, JSON.stringify([]));
        }
    });
    
    // Initialize settings only
    if (!localStorage.getItem(STORAGE_KEYS.settings)) {
        const defaultSettings = {
            businessName: "Mr. Chooks",
            currency: "₱",
            taxRate: 0,
            lowStockThreshold: 10,
            mediumStockThreshold: 25,
            maxDiscount: 20,
            paymentMethods: ["Cash", "GCash"]
        };
        localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(defaultSettings));
    }
}

// Enhanced data validation
function validateProduct(product) {
    const errors = [];
    
    if (!product.name || product.name.trim().length === 0) {
        errors.push('Product name is required');
    }
    
    if (!product.price || product.price <= 0) {
        errors.push('Valid selling price is required');
    }
    
    if (!product.cost || product.cost <= 0) {
        errors.push('Valid cost price is required');
    }
    
    if (product.cost > product.price) {
        errors.push('Cost price cannot be higher than selling price');
    }
    
    return errors;
}

function validateSale(sale) {
    const errors = [];
    
    if (!sale.productId) {
        errors.push('Product is required');
    }
    
    if (!sale.quantity || sale.quantity <= 0) {
        errors.push('Valid quantity is required');
    }
    
    if (!sale.price || sale.price <= 0) {
        errors.push('Valid price is required');
    }
    
    if (sale.discount && sale.discount > 20) {
        errors.push('Discount cannot exceed ₱20');
    }
    
    if (sale.paymentMethod === 'GCash' && !sale.gcashReference) {
        errors.push('GCash reference ID is required for GCash payments');
    }
    
    return errors;
}

function validateDiscount(discount) {
    const errors = [];
    
    if (!discount.type) {
        errors.push('Discount type is required');
    }
    
    if ((discount.type === 'pwd' || discount.type === 'senior') && !discount.idNumber) {
        errors.push('ID number is required for PWD/Senior discounts');
    }
    
    if (!discount.amount || discount.amount <= 0) {
        errors.push('Valid discount amount is required');
    }
    
    if (discount.amount > 20) {
        errors.push('Discount cannot exceed ₱20');
    }
    
    return errors;
}

function validateDelivery(delivery) {
    const errors = [];
    
    if (!delivery.description || delivery.description.trim().length === 0) {
        errors.push('Description is required');
    }
    
    if (!delivery.amount || delivery.amount <= 0) {
        errors.push('Valid amount is required');
    }
    
    return errors;
}

// New data management functions
function getDataByDate(data, dateField, targetDate) {
    if (!targetDate) return data;
    
    return data.filter(item => {
        const itemDate = new Date(item[dateField]).toISOString().split('T')[0];
        return itemDate === targetDate;
    });
}

function getHistoricalData(data, dateField, startDate, endDate) {
    return data.filter(item => {
        const itemDate = new Date(item[dateField]);
        return itemDate >= new Date(startDate) && itemDate <= new Date(endDate);
    });
}

function calculatePOPaymentStatus(po, payments) {
    const poPayments = payments.filter(payment => payment.poId === po.id);
    const totalPaid = poPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const remaining = po.total - totalPaid;
    
    return {
        totalPaid,
        remaining,
        status: remaining <= 0 ? 'Paid' : remaining === po.total ? 'Unpaid' : 'Partial'
    };
}

function getDailySummary(date) {
    const sales = JSON.parse(localStorage.getItem(STORAGE_KEYS.sales) || '[]');
    const expenses = JSON.parse(localStorage.getItem(STORAGE_KEYS.expenses) || '[]');
    const deliveries = JSON.parse(localStorage.getItem(STORAGE_KEYS.deliveries) || '[]');
    const discounts = JSON.parse(localStorage.getItem(STORAGE_KEYS.discounts) || '[]');
    const unsoldProducts = JSON.parse(localStorage.getItem(STORAGE_KEYS.unsoldProducts) || '[]');
    
    const daySales = getDataByDate(sales, 'date', date);
    const dayExpenses = getDataByDate(expenses, 'date', date);
    const dayDeliveries = getDataByDate(deliveries, 'date', date);
    const dayDiscounts = getDataByDate(discounts, 'date', date);
    const dayUnsold = getDataByDate(unsoldProducts, 'date', date);
    
    const grossSales = daySales.reduce((sum, s) => sum + (s.quantity * s.price), 0);
    const totalDiscounts = dayDiscounts.reduce((sum, d) => sum + d.amount, 0);
    const netSales = grossSales - totalDiscounts;
    const totalExpenses = dayExpenses.reduce((sum, e) => sum + e.amount, 0);
    const deliveryProfit = dayDeliveries.reduce((sum, d) => sum + d.amount, 0);
    const unsoldLoss = dayUnsold.reduce((sum, u) => sum + (u.quantity * u.price), 0);
    
    return {
        date,
        grossSales,
        totalDiscounts,
        netSales,
        totalExpenses,
        deliveryProfit,
        unsoldLoss,
        netProfit: netSales - totalExpenses + deliveryProfit - unsoldLoss
    };
}

function getProductPerformance(startDate, endDate) {
    const sales = JSON.parse(localStorage.getItem(STORAGE_KEYS.sales) || '[]');
    const products = JSON.parse(localStorage.getItem(STORAGE_KEYS.products) || '[]');
    
    const periodSales = getHistoricalData(sales, 'date', startDate, endDate);
    
    const productPerformance = {};
    
    periodSales.forEach(sale => {
        if (!productPerformance[sale.productId]) {
            const product = products.find(p => p.id === sale.productId);
            productPerformance[sale.productId] = {
                productName: product ? product.name : 'Unknown',
                unitsSold: 0,
                grossSales: 0,
                totalCost: 0,
                totalProfit: 0
            };
        }
        
        productPerformance[sale.productId].unitsSold += sale.quantity;
        productPerformance[sale.productId].grossSales += sale.quantity * sale.price;
        productPerformance[sale.productId].totalCost += sale.quantity * sale.cost;
        productPerformance[sale.productId].totalProfit += sale.profit;
    });
    
    return Object.values(productPerformance);
}

function getDiscountTracking(startDate, endDate) {
    const discounts = JSON.parse(localStorage.getItem(STORAGE_KEYS.discounts) || '[]');
    const sales = JSON.parse(localStorage.getItem(STORAGE_KEYS.sales) || '[]');
    
    const periodDiscounts = getHistoricalData(discounts, 'date', startDate, endDate);
    
    return periodDiscounts.map(discount => {
        const relatedSale = sales.find(s => s.id === discount.saleId);
        return {
            ...discount,
            saleTotal: relatedSale ? relatedSale.total : 0
        };
    });
}

// Enhanced export functionality
function exportAllData() {
    const data = {};
    const timestamp = new Date().toISOString().split('T')[0];
    
    Object.entries(STORAGE_KEYS).forEach(([key, storageKey]) => {
        data[key] = JSON.parse(localStorage.getItem(storageKey) || '[]');
    });
    
    data.exportDate = timestamp;
    data.version = '2.0';
    
    return data;
}

function importData(data) {
    try {
        Object.entries(data).forEach(([key, value]) => {
            if (STORAGE_KEYS[key]) {
                localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(value));
            }
        });
        return true;
    } catch (error) {
        console.error('Error importing data:', error);
        return false;
    }
}

// Backup and restore functions
function createBackup() {
    const backup = {
        timestamp: new Date().toISOString(),
        version: '2.0',
        data: exportAllData()
    };
    
    return JSON.stringify(backup);
}

function restoreBackup(backupString) {
    try {
        const backup = JSON.parse(backupString);
        
        if (!backup.data || !backup.timestamp) {
            throw new Error('Invalid backup format');
        }
        
        return importData(backup.data);
    } catch (error) {
        console.error('Error restoring backup:', error);
        return false;
    }
}

// Data cleanup functions
function cleanupOrphanedRecords() {
    // Remove inventory records for deleted products
    const products = JSON.parse(localStorage.getItem(STORAGE_KEYS.products) || '[]');
    const inventory = JSON.parse(localStorage.getItem(STORAGE_KEYS.inventory) || '[]');
    const sales = JSON.parse(localStorage.getItem(STORAGE_KEYS.sales) || '[]');
    
    const productIds = products.map(p => p.id);
    
    // Clean inventory
    const cleanedInventory = inventory.filter(item => productIds.includes(item.productId));
    localStorage.setItem(STORAGE_KEYS.inventory, JSON.stringify(cleanedInventory));
    
    // Clean sales
    const cleanedSales = sales.filter(sale => productIds.includes(sale.productId));
    localStorage.setItem(STORAGE_KEYS.sales, JSON.stringify(cleanedSales));
    
    return {
        inventoryRemoved: inventory.length - cleanedInventory.length,
        salesRemoved: sales.length - cleanedSales.length
    };
}

// Data statistics
function getDataStatistics() {
    const stats = {};
    
    Object.entries(STORAGE_KEYS).forEach(([key, storageKey]) => {
        if (key !== 'settings') {
            const data = JSON.parse(localStorage.getItem(storageKey) || '[]');
            stats[key] = data.length;
        }
    });
    
    return stats;
}

// Get active products for employee kiosk
function getActiveProducts() {
    const products = JSON.parse(localStorage.getItem(STORAGE_KEYS.products) || '[]');
    return products.filter(product => product.isActive !== false);
}

// Get product by ID
function getProductById(productId) {
    const products = JSON.parse(localStorage.getItem(STORAGE_KEYS.products) || '[]');
    return products.find(product => product.id === productId);
}

// Get inventory for product
function getInventoryForProduct(productId) {
    const inventory = JSON.parse(localStorage.getItem(STORAGE_KEYS.inventory) || '[]');
    return inventory.find(item => item.productId === productId);
}

// Initialize data when script loads
initializeEmptyData();