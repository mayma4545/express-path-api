# OC Mobile Campus Navigator

A comprehensive mobile-first campus navigation and management system designed for students and administrators.

## Project Overview

The **OC Mobile Campus Navigator** provides an interactive experience for users to explore campus facilities, departments, offices, and events. It features a modern, responsive user interface tailored for mobile devices and a robust administrative backend for data management.

### Key Technologies
- **Backend:** Node.js, Express.js
- **Database:** MySQL via Sequelize ORM
- **Frontend:** HTML5, Tailwind CSS (via CDN), Font Awesome
- **Architecture:** MVC (Models, Views/HTML, Controllers) with Express routing.

## Project Structure

- `server.js`: Application entry point.
- `models/`: Sequelize models defining the database schema (Campus, Department, Office, Program, Event, etc.).
- `routes/`: Express routers for API and HTML endpoints.
- `controllers/`: Logic for handling requests and interacting with models.
- `html/`:
    - `client/`: User-facing pages for navigating the campus.
    - `admin/`: Management pages for CRUD operations on campus data.
- `config/`: Database configuration and Sequelize initialization.
- `assets/`: Static assets including CSS and images.

## Getting Started

### Prerequisites
- Node.js installed.
- Access to a MySQL database (configured for SSL if using the default Aiven setup).

### Installation
1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables in a `.env` file (based on `config/db.js` requirements):
   ```env
   DB_NAME=your_db_name
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   DB_HOST=your_db_host
   DB_PORT=your_db_port
   DB_SSL_CA_PATH=path/to/ca-certificate.pem
   ```

### Running the Project
- **Production Mode:**
  ```bash
  npm start
  ```
- **Development Mode (with auto-reload):**
  ```bash
  npm run dev
  ```

## Development Conventions

- **Mobile First:** All UI components in the `html/` directory are designed with a mobile-first approach, constrained to a mobile aspect ratio on larger screens.
- **Routing:**
    - UI routes are managed in `routes/htmlRoutes.js`.
    - Data/API routes are managed in `routes/apiRoutes.js`.
- **Styling:** Tailwind CSS is preferred for styling. Avoid excessive borders and shadows to maintain a clean, modern aesthetic.
- **Database:** Use Sequelize models for all database interactions. Ensure new tables or associations are updated in `models/index.js`.
- **Admin UI:** Maintain consistency in the administrative suite by using the standard sidebar and modal patterns established in `html/admin/`.

## Key Files
- `database structure.md`: Contains the physical schema details and connection information.
- `setup-database.js`: Script for initializing or syncing the database schema.
- `server.js`: Sets up middleware, static file serving, and route integration.
