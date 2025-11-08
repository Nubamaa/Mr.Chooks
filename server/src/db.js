import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths relative to the server directory
const DB_PATH = path.resolve(__dirname, '..', 'mrchooks.db');
const SCHEMA_PATH = path.resolve(__dirname, '..', '..', 'db', 'schema.sqlite.sql');

// Expected tables from schema
const EXPECTED_TABLES = [
  'users', 'products', 'inventory', 'sales', 'sale_items', 'discounts',
  'expenses', 'deliveries', 'purchase_orders', 'purchase_order_items',
  'losses', 'unsold_products', 'settings'
];

function verifyTables(db) {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
  const tableNames = tables.map(t => t.name);
  const missing = EXPECTED_TABLES.filter(t => !tableNames.includes(t));
  
  if (missing.length > 0) {
    console.warn(`Missing tables: ${missing.join(', ')}`);
    return false;
  }
  return true;
}

export function getDb() {
  const dbExists = fs.existsSync(DB_PATH);
  const db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON');
  
  // Check if database is empty or missing tables
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
  const needsInit = tables.length === 0 || !verifyTables(db);
  
  if (!dbExists || needsInit) {
    if (!fs.existsSync(SCHEMA_PATH)) {
      throw new Error(`Schema file not found at: ${SCHEMA_PATH}\nPlease ensure the schema file exists.`);
    }
    
    try {
      const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
      db.exec(schema);
      
      // Verify all tables were created
      if (verifyTables(db)) {
        console.log('✓ Database initialized successfully with all tables');
      } else {
        console.warn('⚠ Database initialized but some tables may be missing');
      }
    } catch (error) {
      throw new Error(`Failed to initialize database: ${error.message}`);
    }
  }
  
  return db;
}

export function withTx(db, fn) {
  const tx = db.transaction(fn);
  return tx();
}


