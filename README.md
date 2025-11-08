# Mr. Chooks

A dual-system web application featuring an employee kiosk and an admin dashboard for managing sales, inventory, expenses, and business operations.

## Features

### Employee Kiosk
- Point-of-sale (POS) system
- Product browsing and cart management
- Discount system (Senior Citizen, PWD, etc.)
- GCash payment integration
- Real-time inventory checking
- Sales history viewing
- Unsold products tracking

### Admin Dashboard
- **Products Management**: Add, edit, and delete products
- **Inventory Tracking**: Monitor stock levels and update quantities
- **Sales Analytics**: View sales reports, daily reconciliation, and revenue tracking
- **Expense Management**: Track business expenses
- **Purchase Orders**: Manage purchase orders and deliveries
- **Loss Tracking**: Record product losses
- **Delivery Management**: Track incoming deliveries
- **Settings**: Configure business settings

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript (Vanilla JS)
- **Backend**: Node.js with Express
- **Database**: SQLite (better-sqlite3)
- **Authentication**: Local storage-based session management

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone https://github.com/Nubamaa/Mr.Chooks.git
cd Mr.Chooks
```

2. Install dependencies:
```bash
cd server
npm install
```

3. The database will be automatically initialized on first server start using the schema in `db/schema.sqlite.sql`.

## Running Locally

1. Start the server:
```bash
cd server
npm run dev    # Development mode with auto-reload
# or
npm start      # Production mode
```

2. Open your browser and navigate to:
   - **Admin Dashboard**: `http://localhost:3001`
   - **Employee Kiosk**: `http://localhost:3001/employee`
   - **Login Page**: `http://localhost:3001/login`

## Default Credentials

- **Admin**:
  - Username: `admin`
  - Password: `admin123`

- **Employee**:
  - Username: `employee`
  - Password: `employee123`

⚠️ **Important**: Change these credentials in production!

## Project Structure

```
mr-chooks/
├── assets/          # Images and static assets
├── css/             # Stylesheets
├── db/              # Database schema
├── js/              # Frontend JavaScript
│   ├── admin.js     # Admin dashboard logic
│   ├── employee.js  # Employee kiosk logic
│   ├── api.js       # API client
│   ├── auth.js      # Authentication
│   └── ...
├── server/          # Backend server
│   ├── src/
│   │   ├── server.js  # Express server
│   │   └── db.js      # Database connection
│   └── package.json
├── index.html       # Admin dashboard
├── employee.html    # Employee kiosk
└── login.html       # Login page
```

## API Endpoints

The server provides RESTful API endpoints for all data operations:

- `GET /api/products` - Get all products
- `POST /api/products` - Create a product
- `PUT /api/products/:id` - Update a product
- `DELETE /api/products/:id` - Delete a product
- `GET /api/inventory` - Get inventory
- `POST /api/inventory` - Update inventory
- `GET /api/sales` - Get sales (with optional date filters)
- `POST /api/sales` - Create a sale
- `GET /api/expenses` - Get expenses
- `POST /api/expenses` - Create expense
- `DELETE /api/expenses/:id` - Delete expense
- `GET /api/deliveries` - Get deliveries
- `POST /api/deliveries` - Create delivery
- `DELETE /api/deliveries/:id` - Delete delivery
- `GET /api/losses` - Get losses
- `POST /api/losses` - Create loss record
- `GET /api/unsold` - Get unsold products
- `POST /api/unsold` - Record unsold product
- `GET /api/purchase-orders` - Get purchase orders
- `POST /api/purchase-orders` - Create purchase order
- `PUT /api/purchase-orders/:id` - Update purchase order status
- `DELETE /api/purchase-orders/:id` - Delete purchase order
- `GET /api/settings` - Get settings
- `PUT /api/settings` - Update settings
- `GET /api/health` - Health check endpoint

## Deployment

### Recommended: Render

**Render is recommended over Vercel** for this application because:
- ✅ Supports persistent file storage (required for SQLite)
- ✅ Better suited for traditional Node.js applications
- ✅ Long-running processes supported
- ✅ Free tier available

#### Deploying to Render:

1. **Create a Render account** at [render.com](https://render.com)

2. **Create a new Web Service**:
   - Connect your GitHub repository: `https://github.com/Nubamaa/Mr.Chooks.git`
   - **Root Directory**: `server` (IMPORTANT: Set this to `server`)
   - **Environment**: `Node`
   - **Build Command**: `npm install` (the postinstall script will automatically rebuild better-sqlite3 for Linux)
   - **Start Command**: `npm start` (leave as default, or explicitly set this)
   - **Plan**: Free (or choose a paid plan)

3. **Environment Variables** (Optional - can leave empty):
   - No environment variables required
   - Render automatically provides `PORT` environment variable
   - Optional: `NODE_ENV` = `production` (not required)

4. **Important for SQLite**:
   - Render provides persistent disk storage, so your SQLite database will persist
   - The database file will be created automatically on first run in the `server` directory
   - Consider using a PostgreSQL database for production (requires schema migration)

**Note**: The key setting is **Root Directory: `server`**. This tells Render that your `package.json` is in the `server` folder, not the root.

### Alternative: Vercel (Not Recommended)

Vercel is **not recommended** for this app because:
- ❌ Serverless functions have read-only filesystem (except `/tmp`)
- ❌ SQLite requires persistent writable storage
- ❌ Better suited for frontend-only or serverless APIs with external databases

If you must use Vercel, you would need to:
- Migrate from SQLite to a cloud database (PostgreSQL, MongoDB, etc.)
- Refactor the database layer to use the cloud database
- Use Vercel's serverless functions for API routes

### Other Deployment Options

- **Railway**: Similar to Render, good for SQLite apps
- **Fly.io**: Supports persistent volumes
- **DigitalOcean App Platform**: Full-stack deployment support
- **Heroku**: Requires paid tier for persistent storage

## Development

### Database Schema

The database schema is defined in `db/schema.sqlite.sql`. The database is automatically initialized on server start if it doesn't exist.

### API Client

The frontend uses a centralized API client (`js/api.js`) that handles all backend communication. Data normalization is handled by `js/data-normalizer.js` to convert between API's snake_case and frontend's camelCase formats.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is private and proprietary.

## Support

For issues and questions, please open an issue on GitHub.
