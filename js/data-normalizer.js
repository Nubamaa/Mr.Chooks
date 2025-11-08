// Data Normalization Utility
// Converts API responses (snake_case) to frontend format (camelCase)
// and transforms data structures to match frontend expectations

class DataNormalizer {
    // Convert snake_case object keys to camelCase
    static toCamelCase(obj) {
        if (obj === null || obj === undefined) return obj;
        if (Array.isArray(obj)) {
            return obj.map(item => this.toCamelCase(item));
        }
        if (typeof obj !== 'object') return obj;
        
        const camelObj = {};
        for (const [key, value] of Object.entries(obj)) {
            const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
            camelObj[camelKey] = this.toCamelCase(value);
        }
        return camelObj;
    }

    // Normalize product data
    static normalizeProduct(product) {
        const normalized = this.toCamelCase(product);
        // Ensure consistent field names
        normalized.isActive = normalized.isActive !== 0 && normalized.isActive !== false;
        return normalized;
    }

    // Normalize inventory data and join with products
    static normalizeInventory(inventory, products) {
        return inventory.map(inv => {
            const normalized = this.toCamelCase(inv);
            const product = products.find(p => p.id === normalized.productId || p.id === normalized.product_id);
            if (product) {
                normalized.productId = product.id;
                normalized.productName = product.name;
            }
            // Handle both field name formats
            if (normalized.product_id && !normalized.productId) {
                normalized.productId = normalized.product_id;
            }
            return normalized;
        });
    }

    // Normalize sales data - flatten sale items into individual records
    static normalizeSales(sales) {
        const normalized = [];
        
        sales.forEach(sale => {
            const saleBase = this.toCamelCase(sale);
            
            // If sale has items array (transaction-based), flatten it
            if (saleBase.items && Array.isArray(saleBase.items)) {
                saleBase.items.forEach(item => {
                    normalized.push({
                        id: `${saleBase.id}_${item.id || Math.random()}`,
                        saleId: saleBase.id,
                        date: saleBase.date,
                        productId: item.productId || item.product_id,
                        productName: item.productName || item.product_name,
                        quantity: item.quantity || 0,
                        price: item.price || 0,
                        cost: item.cost || 0,
                        discount: item.discount || 0,
                        total: item.total || (item.quantity * item.price),
                        profit: (item.price - (item.cost || 0)) * item.quantity,
                        paymentMethod: saleBase.paymentMethod || saleBase.payment_method,
                        gcashReference: saleBase.gcashReference || saleBase.gcash_reference,
                        employee: saleBase.employeeId ? this.getEmployeeName(saleBase.employeeId) : saleBase.employee || 'N/A',
                        employeeId: saleBase.employeeId || saleBase.employee_id,
                        createdAt: saleBase.createdAt || saleBase.created_at,
                        // Discount info from sale level
                        discountTotal: saleBase.discountTotal || saleBase.discount_total || 0,
                        subtotal: saleBase.subtotal || 0
                    });
                });
            } else {
                // Already flat structure, just normalize field names
                normalized.push({
                    ...saleBase,
                    productId: saleBase.productId || saleBase.product_id,
                    productName: saleBase.productName || saleBase.product_name,
                    paymentMethod: saleBase.paymentMethod || saleBase.payment_method,
                    gcashReference: saleBase.gcashReference || saleBase.gcash_reference,
                    employee: saleBase.employee || 'N/A',
                    employeeId: saleBase.employeeId || saleBase.employee_id
                });
            }
        });
        
        return normalized;
    }

    // Normalize expense data
    static normalizeExpense(expense) {
        return this.toCamelCase(expense);
    }

    // Normalize delivery data
    static normalizeDelivery(delivery) {
        return this.toCamelCase(delivery);
    }

    // Normalize loss data
    static normalizeLoss(loss) {
        const normalized = this.toCamelCase(loss);
        normalized.productId = normalized.productId || normalized.product_id;
        normalized.productName = normalized.productName || normalized.product_name;
        return normalized;
    }

    // Normalize purchase order data
    static normalizePurchaseOrder(po) {
        const normalized = this.toCamelCase(po);
        // Handle items if present
        if (normalized.items && Array.isArray(normalized.items)) {
            normalized.items = normalized.items.map(item => ({
                ...this.toCamelCase(item),
                productId: item.productId || item.product_id,
                productName: item.productName || item.product_name
            }));
            // For backward compatibility, extract first item's product info
            if (normalized.items.length > 0) {
                normalized.productId = normalized.items[0].productId;
                normalized.productName = normalized.items[0].productName;
                normalized.quantity = normalized.items[0].quantity;
                normalized.unitCost = normalized.items[0].unitCost || normalized.items[0].unit_cost;
            }
        }
        normalized.poNumber = normalized.poNumber || normalized.po_number;
        return normalized;
    }

    // Helper to get employee name (placeholder - would need user data)
    static getEmployeeName(employeeId) {
        // This would ideally fetch from users API
        // For now, return a placeholder
        return employeeId ? `Employee ${employeeId}` : 'N/A';
    }

    // Normalize all data types
    static normalize(data, type, products = []) {
        switch (type) {
            case 'product':
            case 'products':
                return Array.isArray(data) 
                    ? data.map(p => this.normalizeProduct(p))
                    : this.normalizeProduct(data);
            case 'inventory':
                return this.normalizeInventory(data, products);
            case 'sale':
            case 'sales':
                return this.normalizeSales(data);
            case 'expense':
            case 'expenses':
                return Array.isArray(data)
                    ? data.map(e => this.normalizeExpense(e))
                    : this.normalizeExpense(data);
            case 'delivery':
            case 'deliveries':
                return Array.isArray(data)
                    ? data.map(d => this.normalizeDelivery(d))
                    : this.normalizeDelivery(data);
            case 'loss':
            case 'losses':
                return Array.isArray(data)
                    ? data.map(l => this.normalizeLoss(l))
                    : this.normalizeLoss(data);
            case 'purchaseOrder':
            case 'purchaseOrders':
                return Array.isArray(data)
                    ? data.map(po => this.normalizePurchaseOrder(po))
                    : this.normalizePurchaseOrder(data);
            case 'unsold':
            case 'unsoldProducts':
                return Array.isArray(data)
                    ? data.map(u => this.normalizeUnsold(u))
                    : this.normalizeUnsold(data);
            default:
                return this.toCamelCase(data);
        }
    }

    normalizeUnsold(unsold) {
        return {
            ...this.toCamelCase(unsold),
            productName: unsold.product_name || unsold.productName,
            recordedBy: unsold.recorded_by || unsold.recordedBy
        };
    }
}

