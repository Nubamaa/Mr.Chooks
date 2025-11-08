Mr. Chooks API (Node + SQLite)

Prereqs
- Node 18+
- SQLite (db/schema.sqlite.sql provided)

Setup
1) Install deps
   cd server && npm install
2) Ensure DB exists (one-time)
   sqlite3 ../mrchooks.db < ../db/schema.sqlite.sql
3) Run API
   npm run dev

Defaults
- Port: 3001
- DB file: ../mrchooks.db (auto-initializes if missing)

Endpoints (brief)
- GET  /api/health
- GET  /api/products
- POST /api/products
- PUT  /api/products/:id
- DELETE /api/products/:id
- GET  /api/inventory
- PUT  /api/inventory/:productId
- POST /api/sales  { items:[{product_id,product_name,quantity,price,cost}], payment_method, gcash_reference?, discount? }
- GET  /api/expenses  | POST /api/expenses
- GET  /api/deliveries | POST /api/deliveries
- GET  /api/losses     | POST /api/losses
- GET  /api/unsold     | POST /api/unsold

Notes
- Sales endpoint wraps inventory updates in a transaction.
- You can place a reverse-proxy or CORS is enabled for dev.


