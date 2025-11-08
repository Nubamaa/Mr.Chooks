import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { nanoid } from 'nanoid';
import { getDb, withTx } from './db.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const db = getDb();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Calculate static path (parent directory where HTML, CSS, JS, assets are)
const staticPath = path.resolve(__dirname, '../..');

function ok(res, data) { return res.json({ ok: true, data }); }
function bad(res, message, status = 400) { return res.status(status).json({ ok: false, message }); }

// Health
app.get('/api/health', (req, res) => {
  try {
    // Test database connection
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
    ok(res, { 
      status: 'ok', 
      database: 'connected',
      tables: tables.length,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    bad(res, `Database error: ${e.message}`, 500);
  }
});

// Products
app.get('/api/products', (req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY name').all();
  ok(res, rows);
});

app.post('/api/products', (req, res) => {
  const { name, price, cost, description = '', is_active = 1 } = req.body || {};
  if (!name || price == null || cost == null) return bad(res, 'Missing fields');
  const id = nanoid();
  try {
    db.prepare('INSERT INTO products (id, name, price, cost, description, is_active) VALUES (?,?,?,?,?,?)')
      .run(id, name, price, cost, description, is_active ? 1 : 0);
    ok(res, { id });
  } catch (e) {
    bad(res, e.message);
  }
});

app.put('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const { name, price, cost, description, is_active } = req.body || {};
  const stmt = db.prepare('UPDATE products SET name = COALESCE(?, name), price = COALESCE(?, price), cost = COALESCE(?, cost), description = COALESCE(?, description), is_active = COALESCE(?, is_active), updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  const info = stmt.run(name, price, cost, description, is_active == null ? undefined : (is_active ? 1 : 0), id);
  ok(res, { changes: info.changes });
});

app.delete('/api/products/:id', (req, res) => {
  const info = db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  ok(res, { changes: info.changes });
});

// Inventory
app.get('/api/inventory', (req, res) => {
  const rows = db.prepare('SELECT * FROM inventory').all();
  ok(res, rows);
});

app.put('/api/inventory/:productId', (req, res) => {
  const { productId } = req.params;
  const { beginning = 0, stock = 0 } = req.body || {};
  const existing = db.prepare('SELECT id FROM inventory WHERE product_id = ?').get(productId);
  if (existing) {
    const info = db.prepare('UPDATE inventory SET beginning=?, stock=?, updated_at=CURRENT_TIMESTAMP WHERE product_id=?').run(beginning, stock, productId);
    ok(res, { changes: info.changes });
  } else {
    const id = nanoid();
    db.prepare('INSERT INTO inventory (id, product_id, beginning, stock) VALUES (?,?,?,?)').run(id, productId, beginning, stock);
    ok(res, { id });
  }
});

// Expenses
app.get('/api/expenses', (req, res) => {
  const rows = db.prepare('SELECT * FROM expenses ORDER BY date DESC').all();
  ok(res, rows);
});
app.post('/api/expenses', (req, res) => {
  const { date = new Date().toISOString(), category, description, amount, remarks = '' } = req.body || {};
  if (!category || !description || amount == null) return bad(res, 'Missing fields');
  const id = nanoid();
  db.prepare('INSERT INTO expenses (id, date, category, description, amount, remarks) VALUES (?,?,?,?,?,?)')
    .run(id, date, category, description, amount, remarks);
  ok(res, { id });
});

app.delete('/api/expenses/:id', (req, res) => {
  const info = db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);
  ok(res, { changes: info.changes });
});

// Deliveries
app.get('/api/deliveries', (req, res) => {
  const rows = db.prepare('SELECT * FROM deliveries ORDER BY date DESC').all();
  ok(res, rows);
});
app.post('/api/deliveries', (req, res) => {
  const { date = new Date().toISOString(), description, amount, driver, remarks = '' } = req.body || {};
  if (!description || amount == null || !driver) return bad(res, 'Missing fields');
  const id = nanoid();
  db.prepare('INSERT INTO deliveries (id, date, description, amount, driver, remarks) VALUES (?,?,?,?,?,?)')
    .run(id, date, description, amount, driver, remarks);
  ok(res, { id });
});

app.delete('/api/deliveries/:id', (req, res) => {
  const info = db.prepare('DELETE FROM deliveries WHERE id = ?').run(req.params.id);
  ok(res, { changes: info.changes });
});

// Losses
app.get('/api/losses', (req, res) => {
  const rows = db.prepare('SELECT * FROM losses ORDER BY date DESC').all();
  ok(res, rows);
});
app.post('/api/losses', (req, res) => {
  const { product_id, product_name, quantity, reason, remarks = '', cost, date = new Date().toISOString() } = req.body || {};
  if (!product_id || !product_name || !quantity || cost == null || !reason) return bad(res, 'Missing fields');
  withTx(db, () => {
    const id = nanoid();
    db.prepare('INSERT INTO losses (id, product_id, product_name, quantity, reason, remarks, cost, date) VALUES (?,?,?,?,?,?,?,?)')
      .run(id, product_id, product_name, quantity, reason, remarks, cost, date);
    const inv = db.prepare('SELECT stock FROM inventory WHERE product_id=?').get(product_id);
    if (inv) {
      db.prepare('UPDATE inventory SET stock = MAX(0, stock - ?), updated_at=CURRENT_TIMESTAMP WHERE product_id=?').run(quantity, product_id);
    }
  });
  ok(res, { ok: true });
});

// Unsold
app.get('/api/unsold', (req, res) => {
  const rows = db.prepare('SELECT * FROM unsold_products ORDER BY date DESC').all();
  ok(res, rows);
});
app.post('/api/unsold', (req, res) => {
  const { product_id, product_name, quantity, price, reason, recorded_by = '', date = new Date().toISOString() } = req.body || {};
  if (!product_id || !product_name || !quantity || !price || !reason) return bad(res, 'Missing fields');
  const id = nanoid();
  db.prepare('INSERT INTO unsold_products (id, product_id, product_name, quantity, price, reason, date, recorded_by) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, product_id, product_name, quantity, price, reason, date, recorded_by);
  ok(res, { id });
});

// Sales
app.get('/api/sales', (req, res) => {
  const { startDate, endDate } = req.query;
  let query = 'SELECT * FROM sales ORDER BY date DESC';
  const params = [];
  
  if (startDate && endDate) {
    query = 'SELECT * FROM sales WHERE date >= ? AND date <= ? ORDER BY date DESC';
    params.push(startDate, endDate);
  } else if (startDate) {
    query = 'SELECT * FROM sales WHERE date >= ? ORDER BY date DESC';
    params.push(startDate);
  } else if (endDate) {
    query = 'SELECT * FROM sales WHERE date <= ? ORDER BY date DESC';
    params.push(endDate);
  }
  
  const rows = params.length > 0 
    ? db.prepare(query).all(...params)
    : db.prepare(query).all();
  ok(res, rows);
});

app.get('/api/sales/:id', (req, res) => {
  const { id } = req.params;
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
  if (!sale) return bad(res, 'Sale not found', 404);
  
  const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id);
  const discounts = db.prepare('SELECT * FROM discounts WHERE sale_id = ?').all(id);
  
  ok(res, { ...sale, items, discounts });
});

app.post('/api/sales', (req, res) => {
  const { employee_id = null, payment_method, gcash_reference = null, items = [], discount = null, date = new Date().toISOString() } = req.body || {};
  if (!payment_method || !Array.isArray(items) || items.length === 0) return bad(res, 'Missing fields');
  try {
    const result = withTx(db, () => {
      const saleId = nanoid();
      let subtotal = 0;
      for (const it of items) {
        subtotal += it.quantity * it.price;
      }
      const discount_total = discount?.amount ? Number(discount.amount) : 0;
      const total = Math.max(0, subtotal - discount_total);
      db.prepare('INSERT INTO sales (id, employee_id, payment_method, gcash_reference, date, subtotal, discount_total, total) VALUES (?,?,?,?,?,?,?,?)')
        .run(saleId, employee_id, payment_method, gcash_reference, date, subtotal, discount_total, total);
      const insertItem = db.prepare('INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, price, cost, discount, total) VALUES (?,?,?,?,?,?,?,?,?)');
      for (const it of items) {
        const id = nanoid();
        const lineDiscount = discount_total * ((it.quantity * it.price) / subtotal);
        const lineTotal = it.quantity * it.price;
        insertItem.run(id, saleId, it.product_id, it.product_name, it.quantity, it.price, it.cost ?? 0, lineDiscount, lineTotal);
        // decrement inventory
        db.prepare('UPDATE inventory SET stock = stock - ?, updated_at=CURRENT_TIMESTAMP WHERE product_id=?')
          .run(it.quantity, it.product_id);
      }
      if (discount && discount.amount > 0) {
        const did = nanoid();
        db.prepare('INSERT INTO discounts (id, sale_id, type, id_number, amount, date, employee_name) VALUES (?,?,?,?,?,?,?)')
          .run(did, saleId, discount.type, discount.id_number ?? null, discount.amount, date, discount.employee_name ?? null);
      }
      return { saleId, subtotal, discount_total, total };
    });
    ok(res, result);
  } catch (e) {
    bad(res, e.message);
  }
});

// Purchase Orders
app.get('/api/purchase-orders', (req, res) => {
  const rows = db.prepare('SELECT * FROM purchase_orders ORDER BY date DESC').all();
  ok(res, rows);
});

app.get('/api/purchase-orders/:id', (req, res) => {
  const { id } = req.params;
  const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(id);
  if (!po) return bad(res, 'Purchase order not found', 404);
  
  const items = db.prepare('SELECT * FROM purchase_order_items WHERE po_id = ?').all(id);
  ok(res, { ...po, items });
});

app.post('/api/purchase-orders', (req, res) => {
  const { po_number, supplier, status = 'Pending', date = new Date().toISOString(), total = 0, items = [] } = req.body || {};
  if (!po_number || !supplier) return bad(res, 'Missing fields: po_number and supplier required');
  
  try {
    const result = withTx(db, () => {
      const id = nanoid();
      db.prepare('INSERT INTO purchase_orders (id, po_number, supplier, status, date, total) VALUES (?,?,?,?,?,?)')
        .run(id, po_number, supplier, status, date, total);
      
      if (items && items.length > 0) {
        const insertItem = db.prepare('INSERT INTO purchase_order_items (id, po_id, product_id, product_name, quantity, unit_cost, total) VALUES (?,?,?,?,?,?,?)');
        for (const it of items) {
          const itemId = nanoid();
          insertItem.run(itemId, id, it.product_id, it.product_name, it.quantity, it.unit_cost, it.total);
        }
      }
      
      return { id };
    });
    ok(res, result);
  } catch (e) {
    bad(res, e.message);
  }
});

app.put('/api/purchase-orders/:id', (req, res) => {
  const { id } = req.params;
  const { po_number, supplier, status, date, total, items } = req.body || {};
  
  try {
    withTx(db, () => {
      if (po_number || supplier || status || date || total != null) {
        const stmt = db.prepare('UPDATE purchase_orders SET po_number = COALESCE(?, po_number), supplier = COALESCE(?, supplier), status = COALESCE(?, status), date = COALESCE(?, date), total = COALESCE(?, total) WHERE id = ?');
        stmt.run(po_number, supplier, status, date, total, id);
      }
      
      if (items && Array.isArray(items)) {
        // Delete existing items and insert new ones
        db.prepare('DELETE FROM purchase_order_items WHERE po_id = ?').run(id);
        const insertItem = db.prepare('INSERT INTO purchase_order_items (id, po_id, product_id, product_name, quantity, unit_cost, total) VALUES (?,?,?,?,?,?,?)');
        for (const it of items) {
          const itemId = nanoid();
          insertItem.run(itemId, id, it.product_id, it.product_name, it.quantity, it.unit_cost, it.total);
        }
      }
    });
    ok(res, { success: true });
  } catch (e) {
    bad(res, e.message);
  }
});

app.delete('/api/purchase-orders/:id', (req, res) => {
  const info = db.prepare('DELETE FROM purchase_orders WHERE id = ?').run(req.params.id);
  ok(res, { changes: info.changes });
});

// Settings
app.get('/api/settings', (req, res) => {
  const rows = db.prepare('SELECT * FROM settings').all();
  const settings = {};
  rows.forEach(row => {
    try {
      settings[row.key] = JSON.parse(row.value);
    } catch (e) {
      settings[row.key] = row.value;
    }
  });
  ok(res, settings);
});

app.get('/api/settings/:key', (req, res) => {
  const { key } = req.params;
  const row = db.prepare('SELECT * FROM settings WHERE key = ?').get(key);
  if (!row) return bad(res, 'Setting not found', 404);
  
  try {
    const value = JSON.parse(row.value);
    ok(res, { key: row.key, value, updated_at: row.updated_at });
  } catch (e) {
    ok(res, { key: row.key, value: row.value, updated_at: row.updated_at });
  }
});

app.put('/api/settings/:key', (req, res) => {
  const { key } = req.params;
  const { value } = req.body || {};
  if (value == null) return bad(res, 'Missing value');
  
  const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
  const existing = db.prepare('SELECT key FROM settings WHERE key = ?').get(key);
  
  if (existing) {
    db.prepare('UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?').run(valueStr, key);
  } else {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(key, valueStr);
  }
  
  ok(res, { success: true });
});

// Serve static files (CSS, JS, assets) - must come after API routes
app.use(express.static(staticPath));

// Serve HTML pages
app.get('/', (req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(staticPath, 'login.html'));
});

app.get('/employee', (req, res) => {
  res.sendFile(path.join(staticPath, 'employee.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Mr. Chooks API listening on :${PORT}`);
});


