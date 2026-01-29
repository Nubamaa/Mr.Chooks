import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use persistent disk in production (Render), local in development
const dbDir = process.env.NODE_ENV === 'production' && fs.existsSync('/var/data') 
  ? '/var/data' 
  : path.resolve(__dirname, '..');
const DB_PATH = path.join(dbDir, 'mrchooks.db');
const SCHEMA_PATH = path.resolve(__dirname, '..', '..', 'db', 'schema.sqlite.sql');

// Expected tables from schema
const EXPECTED_TABLES = [
  'users', 'products', 'inventory', 'sales', 'sale_items', 'discounts',
  'expenses', 'deliveries', 'purchase_orders', 'purchase_order_items',
  'losses', 'unsold_products', 'settings'
];

let db = null;

function promisifyDb(database) {
  return {
    run(sql, params = []) {
      return new Promise((resolve, reject) => {
        database.run(sql, params, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    },
    all(sql, params = []) {
      return new Promise((resolve, reject) => {
        database.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });
    },
    get(sql, params = []) {
      return new Promise((resolve, reject) => {
        database.get(sql, params, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    },
    exec(sql) {
      return new Promise((resolve, reject) => {
        database.exec(sql, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  };
}

async function verifyTables(promisedDb) {
  try {
    const tables = await promisedDb.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    const tableNames = tables.map(t => t.name);
    const missing = EXPECTED_TABLES.filter(t => !tableNames.includes(t));
    
    if (missing.length > 0) {
      console.warn(`Missing tables: ${missing.join(', ')}`);
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}

export async function getDb() {
  if (db) return db;
  
  const dbExists = fs.existsSync(DB_PATH);
  const database = new sqlite3.Database(DB_PATH);
  const promisedDb = promisifyDb(database);
  
  // Enable foreign keys
  await promisedDb.run('PRAGMA foreign_keys = ON');
  
  // Check if database is empty or missing tables
  const tables = await promisedDb.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
  const needsInit = tables.length === 0 || !(await verifyTables(promisedDb));
  
  if (!dbExists || needsInit) {
    if (!fs.existsSync(SCHEMA_PATH)) {
      throw new Error(`Schema file not found at: ${SCHEMA_PATH}\nPlease ensure the schema file exists.`);
    }
    
    try {
      const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
      await promisedDb.exec(schema);
      
      // Verify all tables were created
      if (await verifyTables(promisedDb)) {
        console.log('✓ Database initialized successfully with all tables');
      } else {
        console.warn('⚠ Database initialized but some tables may be missing');
      }
    } catch (error) {
      throw new Error(`Failed to initialize database: ${error.message}`);
    }
  }
  
  // Store both the raw database and promisified version
  db = promisedDb;
  db._rawDb = database;
  
  return db;
}

export function withTx(database, fn) {
  // sqlite3 doesn't have built-in transaction support like better-sqlite3
  // We'll handle this by wrapping BEGIN/COMMIT/ROLLBACK
  return new Promise(async (resolve, reject) => {
    try {
      await database.run('BEGIN TRANSACTION');
      const result = await fn(database);
      await database.run('COMMIT');
      resolve(result);
    } catch (error) {
      await database.run('ROLLBACK');
      reject(error);
    }
  });
}


