-- SQLite schema for Mr. Chooks POS
-- Create with: sqlite3 mrchooks.db < db/schema.sqlite.sql

PRAGMA foreign_keys = ON;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('admin','employee')),
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  price NUMERIC NOT NULL CHECK (price >= 0),
  cost NUMERIC NOT NULL CHECK (cost >= 0),
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_products_name ON products (lower(name));

-- Inventory (one row per product)
CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  beginning INTEGER NOT NULL DEFAULT 0 CHECK (beginning >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id)
);

-- Sales (header)
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  employee_id TEXT REFERENCES users(id),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash','GCash')),
  gcash_reference TEXT,
  date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  subtotal NUMERIC NOT NULL CHECK (subtotal >= 0),
  discount_total NUMERIC NOT NULL DEFAULT 0 CHECK (discount_total >= 0),
  total NUMERIC NOT NULL CHECK (total >= 0),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales (date);
CREATE INDEX IF NOT EXISTS idx_sales_payment_method ON sales (payment_method);

-- Sale items
CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price NUMERIC NOT NULL CHECK (price >= 0),
  cost NUMERIC NOT NULL CHECK (cost >= 0),
  discount NUMERIC NOT NULL DEFAULT 0 CHECK (discount >= 0),
  total NUMERIC NOT NULL CHECK (total >= 0)
);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items (sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items (product_id);

-- Discounts
CREATE TABLE IF NOT EXISTS discounts (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('whole_chicken','pwd','senior')),
  id_number TEXT,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  employee_name TEXT
);
CREATE INDEX IF NOT EXISTS idx_discounts_date ON discounts (date);
CREATE INDEX IF NOT EXISTS idx_discounts_type ON discounts (type);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  remarks TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses (date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses (category);

-- Deliveries
CREATE TABLE IF NOT EXISTS deliveries (
  id TEXT PRIMARY KEY,
  date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  driver TEXT NOT NULL,
  remarks TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_deliveries_date ON deliveries (date);

-- Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  po_number TEXT NOT NULL,
  supplier TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Pending','Ordered','Received','Cancelled')),
  date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total NUMERIC NOT NULL CHECK (total >= 0),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_po_number ON purchase_orders (lower(po_number));
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders (status);
CREATE INDEX IF NOT EXISTS idx_po_date ON purchase_orders (date);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id TEXT PRIMARY KEY,
  po_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC NOT NULL CHECK (unit_cost >= 0),
  total NUMERIC NOT NULL CHECK (total >= 0)
);
CREATE INDEX IF NOT EXISTS idx_poi_po ON purchase_order_items (po_id);

-- Losses
CREATE TABLE IF NOT EXISTS losses (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  reason TEXT NOT NULL,
  remarks TEXT,
  cost NUMERIC NOT NULL CHECK (cost >= 0),
  date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_losses_date ON losses (date);
CREATE INDEX IF NOT EXISTS idx_losses_product ON losses (product_id);

-- Unsold products
CREATE TABLE IF NOT EXISTS unsold_products (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price NUMERIC NOT NULL CHECK (price > 0),
  reason TEXT NOT NULL,
  date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  recorded_by TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_unsold_date ON unsold_products (date);

-- Settings (key/value JSON)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed settings
INSERT OR IGNORE INTO settings (key, value) VALUES
 ('business', '{"businessName":"Mr. Chooks","currency":"₱","taxRate":0}'),
 ('thresholds', '{"lowStock":10,"mediumStock":25}'),
 ('payments', '{"methods":["Cash","GCash"],"maxDiscount":20}');


