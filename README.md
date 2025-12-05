# Express Record - Campus Navigation System

A fast, scalable Express.js backend for campus navigation with A* pathfinding algorithm.

## Features

- 🗺️ **A* Pathfinding**: Efficient shortest path algorithm with compass angle awareness
- 🔗 **Bidirectional Edges**: Automatic reverse edge creation with compass angle calculation
- 🪜 **Staircase Detection**: Special handling for vertical movement between floors
- 📸 **360° Panoramas**: Support for panoramic images with annotations
- 📱 **Mobile API**: REST API endpoints for React Native mobile app
- 🌐 **Web Dashboard**: Full CRUD operations through web interface
- ⚡ **Fast & Scalable**: Built with Express.js, Sequelize ORM, and MySQL (Aiven.io)
- ☁️ **Cloud Storage**: Cloudinary integration for images with hybrid local backup
- 🔒 **Secure**: SSL-enabled MySQL database with encrypted connections

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- MySQL database (Aiven.io or any MySQL server)

### Installation

```bash
# Navigate to the project directory
cd express-record

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your MySQL credentials

# Test database connection
npm run db:test:mysql

# Start the server
npm start

# Or for development with auto-reload
npm run dev
```

### Access

- **Web Dashboard**: http://localhost:3000
- **Mobile API**: http://localhost:3000/api/mobile

### Default Admin Credentials

- Username: `admin`
- Password: `admin123`

⚠️ **Change these credentials in production!**

## API Endpoints

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/mobile/nodes` | List all nodes |
| GET | `/api/mobile/nodes/:id` | Get node details |
| GET | `/api/mobile/buildings` | List all buildings |
| GET | `/api/mobile/campus-map` | Get active campus map |
| POST | `/api/mobile/find-path` | Find path between nodes |
| GET | `/api/mobile/edges` | List all edges |
| GET | `/api/mobile/annotations` | List all annotations |

### Admin Endpoints (Requires Authentication)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/mobile/admin/login` | Admin login |
| POST | `/api/mobile/admin/nodes/create` | Create node |
| PUT | `/api/mobile/admin/nodes/:id/update` | Update node |
| DELETE | `/api/mobile/admin/nodes/:id/delete` | Delete node |
| POST | `/api/mobile/admin/edges/create` | Create edge |
| PUT | `/api/mobile/admin/edges/:id/update` | Update edge |
| DELETE | `/api/mobile/admin/edges/:id/delete` | Delete edge |
| POST | `/api/mobile/admin/annotations/create` | Create annotation |
| PUT | `/api/mobile/admin/annotations/:id/update` | Update annotation |
| DELETE | `/api/mobile/admin/annotations/:id/delete` | Delete annotation |

## Web Routes

| Route | Description |
|-------|-------------|
| `/` | Dashboard |
| `/nodes` | Nodes list |
| `/nodes/create` | Create node |
| `/nodes/:id/edit` | Edit node |
| `/edges` | Edges list |
| `/edges/create` | Create edge |
| `/annotations` | Annotations list |
| `/pathfinding` | Pathfinding test page |
| `/map-viewer` | Campus map viewer |

## Project Structure

```
express-record/
├── src/
│   ├── server.js           # Main Express application
│   ├── models/
│   │   └── index.js        # Sequelize models
│   ├── routes/
│   │   ├── web.js          # Web routes
│   │   ├── api.js          # Internal API routes
│   │   └── mobileApi.js    # Mobile app API routes
│   ├── services/
│   │   ├── pathfinding.js  # A* pathfinding algorithm
│   │   ├── qrcode.js       # QR code generation
│   │   └── upload.js       # File upload handling
│   ├── views/              # EJS templates
│   ├── public/             # Static files (CSS, JS)
│   └── scripts/            # Database scripts
├── media/                  # Uploaded files
│   ├── 360_images/
│   ├── campus_maps/
│   └── qrcodes/
├── package.json
└── README.md
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |
| NODE_ENV | development | Environment |
| SESSION_SECRET | (random) | Session encryption key |
| DB_HOST | - | MySQL host (Aiven.io) |
| DB_PORT | 11343 | MySQL port |
| DB_NAME | defaultdb | Database name |
| DB_USER | - | MySQL username |
| DB_PASSWORD | - | MySQL password |
| DB_SSL | true | Enable SSL connection |
| CLOUDINARY_CLOUD_NAME | - | Cloudinary cloud name |
| CLOUDINARY_API_KEY | - | Cloudinary API key |
| CLOUDINARY_API_SECRET | - | Cloudinary API secret |

## Database

The application uses **MySQL (Aiven.io)** for data storage with SSL encryption.

### Database Scripts

```bash
# Test database connection and functionality
npm run db:test:mysql

# Verify migration and data integrity
npm run db:verify:mysql

# Migrate from SQLite to MySQL (if needed)
npm run db:migrate:mysql
```

### Models

- **Nodes**: Campus locations with 360° image support
- **Edges**: Connections between nodes with distance and compass angle
- **Annotations**: Labels on 360° panorama images
- **CampusMap**: Campus blueprint image
- **User**: Admin users for authentication

### Current Statistics

- **Nodes**: 37 navigation points
- **Edges**: 81 bidirectional connections
- **360° Images**: 34 panoramic images on Cloudinary

## Cloud Storage

All images are stored on **Cloudinary** with local backup:
- **360° Images**: High-resolution panoramic photos
- **QR Codes**: Generated for each node
- **Campus Maps**: Blueprint images

See `CLOUDINARY_INTEGRATION.md` for details.

## Performance Features

- **Compression**: Gzip compression for responses
- **Helmet**: Security headers
- **Connection Pooling**: MySQL connection pooling
- **SSL Encryption**: Secure database connections
- **CDN**: Cloudinary CDN for fast image delivery
- **Caching**: Pathfinder graph caching
- **Async/Await**: Non-blocking I/O operations

## Documentation

- **[MYSQL_MIGRATION.md](MYSQL_MIGRATION.md)** - Complete MySQL migration guide
- **[MYSQL_QUICKSTART.md](MYSQL_QUICKSTART.md)** - Quick reference for MySQL operations
- **[CLOUDINARY_INTEGRATION.md](CLOUDINARY_INTEGRATION.md)** - Cloud storage setup
- **[HYBRID_STORAGE.md](HYBRID_STORAGE.md)** - Dual storage implementation

## License

MIT License
