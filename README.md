# Express Record - Campus Navigation System

A fast, scalable Express.js backend for campus navigation with A* pathfinding algorithm.

## Features

- 🗺️ **A* Pathfinding**: Efficient shortest path algorithm with compass angle awareness
- 🔗 **Bidirectional Edges**: Automatic reverse edge creation with compass angle calculation
- 🪜 **Staircase Detection**: Special handling for vertical movement between floors
- 📸 **360° Panoramas**: Support for panoramic images with annotations
- 📱 **Mobile API**: REST API endpoints for React Native mobile app
- 🌐 **Web Dashboard**: Full CRUD operations through web interface
- ⚡ **Fast & Scalable**: Built with Express.js, Sequelize ORM, and SQLite

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Navigate to the project directory
cd express-record

# Install dependencies
npm install

# Initialize database and create admin user
npm run db:seed

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
| CORS_ORIGIN | * | CORS allowed origins |

## Database

The application uses SQLite by default. The database file is stored at `db.sqlite3`.

### Models

- **Nodes**: Campus locations with 360° image support
- **Edges**: Connections between nodes with distance and compass angle
- **Annotations**: Labels on 360° panorama images
- **CampusMap**: Campus blueprint image
- **User**: Admin users for authentication

## Performance Features

- **Compression**: Gzip compression for responses
- **Helmet**: Security headers
- **Connection Pooling**: SQLite connection pooling
- **Caching**: Pathfinder graph caching
- **Async/Await**: Non-blocking I/O operations

## License

MIT License
