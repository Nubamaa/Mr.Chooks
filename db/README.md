Mr. Chooks Database

SQLite quickstart

1) Install SQLite (if not installed)
- Windows: winget install SQLite.sqlite
- macOS: brew install sqlite
- Linux: sudo apt-get install sqlite3

2) Create the database file using the schema

```bash
sqlite3 mrchooks.db < db/schema.sqlite.sql
```

3) Inspect tables

```bash
sqlite3 mrchooks.db ".tables"
```

4) Example: add an admin user (replace HASH with your real hash)

```sql
INSERT INTO users (id, role, name, email, password_hash)
VALUES ('admin-1', 'admin', 'Admin', 'admin@example.com', 'HASH');
```

Notes
- IDs are TEXT (use UUIDs or your existing Utils.generateId() when you build API).
- Inventory updates should happen in a transaction when recording sales, losses, or receiving POs.
- Settings table stores JSON as TEXT for portability.


