// Centralized API Client
class ApiClient {
    constructor() {
        // Use API_BASE_URL if set, otherwise detect from current location
        // In production (Render), use current origin; in development, use localhost:3001
        if (window.API_BASE_URL) {
            this.baseUrl = window.API_BASE_URL;
        } else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            this.baseUrl = 'http://localhost:3001';
        } else {
            // Production: use current origin (e.g., https://mr-chooks.onrender.com)
            this.baseUrl = window.location.origin;
        }
        this.defaultHeaders = {
            'Content-Type': 'application/json'
        };
    }

    async request(path, options = {}) {
        const url = `${this.baseUrl}${path}`;
        const config = {
            headers: { ...this.defaultHeaders, ...options.headers },
            ...options
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || `API error: ${response.statusText}`);
            }
            
            return data;
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('Network error: Unable to connect to server');
            }
            throw error;
        }
    }

    // GET requests
    async get(path) {
        return this.request(path, { method: 'GET' });
    }

    // POST requests
    async post(path, body) {
        return this.request(path, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    }

    // PUT requests
    async put(path, body) {
        return this.request(path, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
    }

    // DELETE requests
    async delete(path) {
        return this.request(path, { method: 'DELETE' });
    }

    // Health check
    async health() {
        return this.get('/api/health');
    }

    // Products
    async getProducts() {
        const response = await this.get('/api/products');
        return response.data || [];
    }

    async createProduct(product) {
        const response = await this.post('/api/products', product);
        return response.data;
    }

    async updateProduct(id, product) {
        const response = await this.put(`/api/products/${id}`, product);
        return response.data;
    }

    async deleteProduct(id) {
        const response = await this.delete(`/api/products/${id}`);
        return response.data;
    }

    // Inventory
    async getInventory() {
        const response = await this.get('/api/inventory');
        return response.data || [];
    }

    async updateInventory(productId, inventory) {
        const response = await this.put(`/api/inventory/${productId}`, inventory);
        return response.data;
    }

    // Sales
    async getSales(startDate, endDate) {
        let path = '/api/sales';
        if (startDate || endDate) {
            const params = new URLSearchParams();
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
            path += `?${params.toString()}`;
        }
        const response = await this.get(path);
        return response.data || [];
    }

    async getSale(id) {
        const response = await this.get(`/api/sales/${id}`);
        return response.data;
    }

    async createSale(sale) {
        const response = await this.post('/api/sales', sale);
        return response.data;
    }

    // Expenses
    async getExpenses() {
        const response = await this.get('/api/expenses');
        return response.data || [];
    }

    async createExpense(expense) {
        const response = await this.post('/api/expenses', expense);
        return response.data;
    }

    async deleteExpense(id) {
        const response = await this.delete(`/api/expenses/${id}`);
        return response.data;
    }

    // Deliveries
    async getDeliveries() {
        const response = await this.get('/api/deliveries');
        return response.data || [];
    }

    async createDelivery(delivery) {
        const response = await this.post('/api/deliveries', delivery);
        return response.data;
    }

    async deleteDelivery(id) {
        const response = await this.delete(`/api/deliveries/${id}`);
        return response.data;
    }

    // Losses
    async getLosses() {
        const response = await this.get('/api/losses');
        return response.data || [];
    }

    async createLoss(loss) {
        const response = await this.post('/api/losses', loss);
        return response.data;
    }

    // Unsold Products
    async getUnsold() {
        const response = await this.get('/api/unsold');
        return response.data || [];
    }

    async createUnsold(unsold) {
        const response = await this.post('/api/unsold', unsold);
        return response.data;
    }

    // Purchase Orders
    async getPurchaseOrders() {
        const response = await this.get('/api/purchase-orders');
        return response.data || [];
    }

    async getPurchaseOrder(id) {
        const response = await this.get(`/api/purchase-orders/${id}`);
        return response.data;
    }

    async createPurchaseOrder(po) {
        const response = await this.post('/api/purchase-orders', po);
        return response.data;
    }

    async updatePurchaseOrder(id, po) {
        const response = await this.put(`/api/purchase-orders/${id}`, po);
        return response.data;
    }

    async deletePurchaseOrder(id) {
        const response = await this.delete(`/api/purchase-orders/${id}`);
        return response.data;
    }

    // Settings
    async getSettings() {
        const response = await this.get('/api/settings');
        return response.data || {};
    }

    async getSetting(key) {
        const response = await this.get(`/api/settings/${key}`);
        return response.data;
    }

    async updateSetting(key, value) {
        const response = await this.put(`/api/settings/${key}`, { value });
        return response.data;
    }
}

// Create global instance
const api = new ApiClient();

