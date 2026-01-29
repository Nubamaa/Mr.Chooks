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
let db = null;

// Initialize database and store reference
getDb().then(database => {
  db = database;
  console.log('✓ Database initialized');
}).catch(err => {
  console.error('✗ Failed to initialize database:', err.message);
  process.exit(1);
});

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Calculate static path (parent directory where HTML, CSS, JS, assets are)
const staticPath = path.resolve(__dirname, '../..');

function ok(res, data) { return res.json({ ok: true, data }); }
function bad(res, message, status = 400) { return res.status(status).json({ ok: false, message }); }

// Health
app.get('/api/health', async (req, res) => {
  try {
    const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
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
app.get('/api/products', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM products ORDER BY name');
    ok(res, rows);
  } catch (e) {
    bad(res, e.message);
  }
});

app.post('/api/products', async (req, res) => {
  const { name, price, cost, description = '', is_active = 1 } = req.body || {};
  if (!name || price == null || cost == null) return bad(res, 'Missing fields');
  const id = nanoid();
  try {
    await db.run('INSERT INTO products (id, name, price, cost, description, is_active) VALUES (?,?,?,?,?,?)',
      [id, name, price, cost, description, is_active ? 1 : 0]);
    ok(res, { id });
  } catch (e) {
    bad(res, e.message);
  }
});

app.put('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  const { name, price, cost, description, is_active } = req.body || {};
  try {
    await db.run('UPDATE products SET name = COALESCE(?, name), price = COALESCE(?, price), cost = COALESCE(?, cost), description = COALESCE(?, description), is_active = COALESCE(?, is_active), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, price, cost, description, is_active == null ? undefined : (is_active ? 1 : 0), id]);
    ok(res, { success: true });
  } catch (e) {
    bad(res, e.message);
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM products WHERE id = ?', [req.params.id]);
    ok(res, { success: true });
  } catch (e) {
    bad(res, e.message);
  }
});

// Inventory
app.get('/api/inventory', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM inventory');
    ok(res, rows);
  } catch (e) {
    bad(res, e.message);
  }
});

app.put('/api/inventory/:productId', async (req, res) => {
  const { productId } = req.params;
  const { beginning = 0, stock = 0 } = req.body || {};
  try {
    const existing = await db.get('SELECT id FROM inventory WHERE product_id = ?', [productId]);
    if (existing) {
      await db.run('UPDATE inventory SET beginning=?, stock=?, updated_at=CURRENT_TIMESTAMP WHERE product_id=?',
        [beginning, stock, productId]);
      ok(res, { success: true });
    } else {
      const id = nanoid();
      await db.run('INSERT INTO inventory (id, product_id, beginning, stock) VALUES (?,?,?,?)',
        [id, productId, beginning, stock]);
      ok(res, { id });
    }
  } catch (e) {
    bad(res, e.message);
  }
});

app.delete('/api/inventory/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM inventory WHERE id = ?', [req.params.id]);
    ok(res, { success: true });
  } catch (e) {
    bad(res, e.message);
  }
});

// Expenses
app.get('/api/expenses', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM expenses ORDER BY date DESC');
    ok(res, rows);
  } catch (e) {
    bad(res, e.message);
  }
});

app.post('/api/expenses', async (req, res) => {
  const { date = new Date().toISOString(), category, description, amount, remarks = '' } = req.body || {};
  if (!category || !description || amount == null) return bad(res, 'Missing fields');
  const id = nanoid();
  try {
    await db.run('INSERT INTO expenses (id, date, category, description, amount, remarks) VALUES (?,?,?,?,?,?)',
      [id, date, category, description, amount, remarks]);
    ok(res, { id });
  } catch (e) {
    bad(res, e.message);
  }
});

app.delete('/api/expenses/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM expenses WHERE id = ?', [req.params.id]);
    ok(res, { success: true });
  } catch (e) {
    bad(res, e.message);
  }
});

// Deliveries
app.get('/api/deliveries', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM deliveries ORDER BY date DESC');
    ok(res, rows);
  } catch (e) {
    bad(res, e.message);
  }
});

app.post('/api/deliveries', async (req, res) => {
  const { date = new Date().toISOString(), description, amount, driver, remarks = '' } = req.body || {};
  if (!description || amount == null || !driver) return bad(res, 'Missing fields');
  const id = nanoid();
  try {
    await db.run('INSERT INTO deliveries (id, date, description, amount, driver, remarks) VALUES (?,?,?,?,?,?)',
      [id, date, description, amount, driver, remarks]);
    ok(res, { id });
  } catch (e) {
    bad(res, e.message);
  }
});

app.delete('/api/deliveries/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM deliveries WHERE id = ?', [req.params.id]);
    ok(res, { success: true });
  } catch (e) {
    bad(res, e.message);
  }
});

// Losses
app.get('/api/losses', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM losses ORDER BY date DESC');
    ok(res, rows);
  } catch (e) {
    bad(res, e.message);
  }
});

app.post('/api/losses', async (req, res) => {
  const { product_id, product_name, quantity, reason, remarks = '', cost, date = new Date().toISOString() } = req.body || {};
  if (!product_id || !product_name || !quantity || cost == null || !reason) return bad(res, 'Missing fields');
  try {
    await withTx(db, async () => {
      const id = nanoid();
      await db.run('INSERT INTO losses (id, product_id, product_name, quantity, reason, remarks, cost, date) VALUES (?,?,?,?,?,?,?,?)',
        [id, product_id, product_name, quantity, reason, remarks, cost, date]);
      const inv = await db.get('SELECT stock FROM inventory WHERE product_id=?', [product_id]);
      if (inv) {
        await db.run('UPDATE inventory SET stock = MAX(0, stock - ?), updated_at=CURRENT_TIMESTAMP WHERE product_id=?',
          [quantity, product_id]);
      }
    });
    ok(res, { ok: true });
  } catch (e) {
    bad(res, e.message);
  }
});

// Unsold
app.get('/api/unsold', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM unsold_products ORDER BY date DESC');
    ok(res, rows);
  } catch (e) {
    bad(res, e.message);
  }
});

app.post('/api/unsold', async (req, res) => {
  const { product_id, product_name, quantity, price, reason, recorded_by = '', date = new Date().toISOString() } = req.body || {};
  if (!product_id || !product_name || !quantity || !price || !reason) return bad(res, 'Missing fields');
  const id = nanoid();
  try {
    await db.run('INSERT INTO unsold_products (id, product_id, product_name, quantity, price, reason, date, recorded_by) VALUES (?,?,?,?,?,?,?,?)',
      [id, product_id, product_name, quantity, price, reason, date, recorded_by]);
    ok(res, { id });
  } catch (e) {
    bad(res, e.message);
  }
});

// Sales
app.get('/api/sales', async (req, res) => {
  const { startDate, endDate } = req.query;
  let query = 'SELECT * FROM sales ORDER BY date DESC';
  const params = [];
  
  try {
    if (startDate && endDate) {
      const start = startDate.includes('T') ? startDate : `${startDate}T00:00:00.000Z`;
      const end = endDate.includes('T') ? endDate : `${endDate}T23:59:59.999Z`;
      query = 'SELECT * FROM sales WHERE date >= ? AND date <= ? ORDER BY date DESC';
      params.push(start, end);
    } else if (startDate) {
      const start = startDate.includes('T') ? startDate : `${startDate}T00:00:00.000Z`;
      query = 'SELECT * FROM sales WHERE date >= ? ORDER BY date DESC';
      params.push(start);
    } else if (endDate) {
      const end = endDate.includes('T') ? endDate : `${endDate}T23:59:59.999Z`;
      query = 'SELECT * FROM sales WHERE date <= ? ORDER BY date DESC';
      params.push(end);
    }
    
    const sales = await db.all(query, params);
    
    // Include items and discounts for each sale
    const salesWithDetails = await Promise.all(sales.map(async sale => {
      const items = await db.all('SELECT * FROM sale_items WHERE sale_id = ?', [sale.id]);
      const discounts = await db.all('SELECT * FROM discounts WHERE sale_id = ?', [sale.id]);
      return { ...sale, items, discounts };
    }));
    
    ok(res, salesWithDetails);
  } catch (e) {
    bad(res, e.message);
  }
});

app.get('/api/sales/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const sale = await db.get('SELECT * FROM sales WHERE id = ?', [id]);
    if (!sale) return bad(res, 'Sale not found', 404);
    
    const items = await db.all('SELECT * FROM sale_items WHERE sale_id = ?', [id]);
    const discounts = await db.all('SELECT * FROM discounts WHERE sale_id = ?', [id]);
    
    ok(res, { ...sale, items, discounts });
  } catch (e) {
    bad(res, e.message);
  }
});

app.post('/api/sales', async (req, res) => {
  const { employee_id = null, payment_method, gcash_reference = null, items = [], discount = null, date = new Date().toISOString() } = req.body || {};
  if (!payment_method || !Array.isArray(items) || items.length === 0) return bad(res, 'Missing fields');
  try {
    const result = await withTx(db, async () => {
      const saleId = nanoid();
      let subtotal = 0;
      for (const it of items) {
        subtotal += it.quantity * it.price;
      }
      const discount_total = discount?.amount ? Number(discount.amount) : 0;
      const total = Math.max(0, subtotal - discount_total);
      await db.run('INSERT INTO sales (id, employee_id, payment_method, gcash_reference, date, subtotal, discount_total, total) VALUES (?,?,?,?,?,?,?,?)',
        [saleId, employee_id, payment_method, gcash_reference, date, subtotal, discount_total, total]);
      
      for (const it of items) {
        const id = nanoid();
        const lineDiscount = discount_total * ((it.quantity * it.price) / subtotal);
        const lineTotal = it.quantity * it.price;
        await db.run('INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, price, cost, discount, total) VALUES (?,?,?,?,?,?,?,?,?)',
          [id, saleId, it.product_id, it.product_name, it.quantity, it.price, it.cost ?? 0, lineDiscount, lineTotal]);
        // decrement inventory
        await db.run('UPDATE inventory SET stock = stock - ?, updated_at=CURRENT_TIMESTAMP WHERE product_id=?',
          [it.quantity, it.product_id]);
      }
      if (discount && discount.amount > 0) {
        const did = nanoid();
        await db.run('INSERT INTO discounts (id, sale_id, type, id_number, amount, date, employee_name) VALUES (?,?,?,?,?,?,?)',
          [did, saleId, discount.type, discount.id_number ?? null, discount.amount, date, discount.employee_name ?? null]);
      }
      return { saleId, subtotal, discount_total, total };
    });
    ok(res, result);
  } catch (e) {
    bad(res, e.message);
  }
});

// Purchase Orders
app.get('/api/purchase-orders', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM purchase_orders ORDER BY date DESC');
    ok(res, rows);
  } catch (e) {
    bad(res, e.message);
  }
});

app.get('/api/purchase-orders/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const po = await db.get('SELECT * FROM purchase_orders WHERE id = ?', [id]);
    if (!po) return bad(res, 'Purchase order not found', 404);
    
    const items = await db.all('SELECT * FROM purchase_order_items WHERE po_id = ?', [id]);
    ok(res, { ...po, items });
  } catch (e) {
    bad(res, e.message);
  }
});

app.post('/api/purchase-orders', async (req, res) => {
  const { po_number, supplier, status = 'Pending', date = new Date().toISOString(), total = 0, items = [] } = req.body || {};
  if (!po_number || !supplier) return bad(res, 'Missing fields: po_number and supplier required');
  
  try {
    const result = await withTx(db, async () => {
      const id = nanoid();
      await db.run('INSERT INTO purchase_orders (id, po_number, supplier, status, date, total) VALUES (?,?,?,?,?,?)',
        [id, po_number, supplier, status, date, total]);
      
      if (items && items.length > 0) {
        for (const it of items) {
          const itemId = nanoid();
          await db.run('INSERT INTO purchase_order_items (id, po_id, product_id, product_name, quantity, unit_cost, total) VALUES (?,?,?,?,?,?,?)',
            [itemId, id, it.product_id, it.product_name, it.quantity, it.unit_cost, it.total]);
        }
      }
      
      return { id };
    });
    ok(res, result);
  } catch (e) {
    bad(res, e.message);
  }
});

app.put('/api/purchase-orders/:id', async (req, res) => {
  const { id } = req.params;
  const { po_number, supplier, status, date, total, items } = req.body || {};
  
  try {
    await withTx(db, async () => {
      if (po_number || supplier || status || date || total != null) {
        await db.run('UPDATE purchase_orders SET po_number = COALESCE(?, po_number), supplier = COALESCE(?, supplier), status = COALESCE(?, status), date = COALESCE(?, date), total = COALESCE(?, total) WHERE id = ?',
          [po_number, supplier, status, date, total, id]);
      }
      
      if (items && Array.isArray(items)) {
        // Delete existing items and insert new ones
        await db.run('DELETE FROM purchase_order_items WHERE po_id = ?', [id]);
        for (const it of items) {
          const itemId = nanoid();
          await db.run('INSERT INTO purchase_order_items (id, po_id, product_id, product_name, quantity, unit_cost, total) VALUES (?,?,?,?,?,?,?)',
            [itemId, id, it.product_id, it.product_name, it.quantity, it.unit_cost, it.total]);
        }
      }
    });
    ok(res, { success: true });
  } catch (e) {
    bad(res, e.message);
  }
});

app.delete('/api/purchase-orders/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM purchase_orders WHERE id = ?', [req.params.id]);
    ok(res, { success: true });
  } catch (e) {
    bad(res, e.message);
  }
});

// Settings
app.get('/api/settings', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM settings');
    const settings = {};
    rows.forEach(row => {
      try {
        settings[row.key] = JSON.parse(row.value);
      } catch (e) {
        settings[row.key] = row.value;
      }
    });
    ok(res, settings);
  } catch (e) {
    bad(res, e.message);
  }
});

app.get('/api/settings/:key', async (req, res) => {
  const { key } = req.params;
  try {
    const row = await db.get('SELECT * FROM settings WHERE key = ?', [key]);
    if (!row) return bad(res, 'Setting not found', 404);
    
    try {
      const value = JSON.parse(row.value);
      ok(res, { key: row.key, value, updated_at: row.updated_at });
    } catch (e) {
      ok(res, { key: row.key, value: row.value, updated_at: row.updated_at });
    }
  } catch (e) {
    bad(res, e.message);
  }
});

app.put('/api/settings/:key', async (req, res) => {
  const { key } = req.params;
  const { value } = req.body || {};
  if (value == null) return bad(res, 'Missing value');
  
  try {
    const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
    const existing = await db.get('SELECT key FROM settings WHERE key = ?', [key]);
    
    if (existing) {
      await db.run('UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?', [valueStr, key]);
    } else {
      await db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, valueStr]);
    }
    
    ok(res, { success: true });
  } catch (e) {
    bad(res, e.message);
  }
});

// Serve static files (CSS, JS, assets) - must come after API routes
app.use(express.static(staticPath));

// Serve HTML pages
// For security/usability serve the login page at root so visiting the site
// doesn't immediately open the admin dashboard. The admin dashboard is
// still available at /admin for authenticated users (client-side auth).
app.get('/', (req, res) => {
  res.sendFile(path.join(staticPath, 'login.html'));
});

app.get('/admin', (req, res) => {
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


