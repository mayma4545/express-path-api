/**
 * Express.js Campus Navigation System
 * A* Pathfinding with Compass Directions & 360° Panorama Support
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const session = require('express-session');

const { sequelize } = require('./models');
const webRoutes = require('./routes/web');
const apiRoutes = require('./routes/api');
const mobileApiRoutes = require('./routes/mobileApi');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disable for development
    crossOriginEmbedderPolicy: false
}));

// Performance middleware
app.use(compression());

// CORS configuration
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'campus-navigator-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use('/static', express.static(path.join(__dirname, 'public')));
app.use('/media', express.static(path.join(__dirname, '../media')));

// Flash messages middleware
app.use((req, res, next) => {
    res.locals.messages = req.session.messages || [];
    req.session.messages = [];
    res.locals.user = req.session.user || null;
    next();
});

// Helper function to add flash messages
app.use((req, res, next) => {
    req.flash = (type, message) => {
        if (!req.session.messages) {
            req.session.messages = [];
        }
        req.session.messages.push({ type, message });
    };
    next();
});

// Routes
app.use('/', webRoutes);
app.use('/api', apiRoutes);
app.use('/api/mobile', mobileApiRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).render('error', {
        title: 'Page Not Found',
        message: 'The page you are looking for does not exist.'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    
    if (req.path.startsWith('/api')) {
        return res.status(500).json({
            success: false,
            error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
        });
    }
    
    res.status(500).render('error', {
        title: 'Server Error',
        message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
    });
});

// Database sync and server start
async function startServer() {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connection established');
        
        // Only sync without altering existing tables (safe for production)
        await sequelize.sync({ alter: false });
        console.log('✅ Database models synchronized');
        
        app.listen(PORT,'0.0.0.0', () => {
            console.log(`🗺️  Campus Navigator running at http://localhost:${PORT}`);
            console.log(`📱 Mobile API available at http://localhost:${PORT}/api/mobile`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

module.exports = app;
