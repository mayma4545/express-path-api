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
const { logger, requestLogger } = require('./utils/logger');
const { apiLimiter } = require('./middleware/rateLimiter');
const { SESSION } = require('./utils/constants');

const app = express();
const PORT = process.env.PORT || 3000;

// Validate required environment variables
if (!process.env.SESSION_SECRET && process.env.NODE_ENV === 'production') {
    logger.error('SESSION_SECRET environment variable is required in production');
    process.exit(1);
}

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disable for development
    crossOriginEmbedderPolicy: false
}));

// Performance middleware
app.use(compression());

// Request logging
app.use(requestLogger);

// CORS configuration
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));

// Rate limiting for API routes
app.use('/api', apiLimiter);

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Session configuration
const sessionSecret = process.env.SESSION_SECRET || 'dev-secret-change-in-production';
app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: SESSION.MAX_AGE_MS
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
    logger.error('Request error', { error: err.message, stack: err.stack, path: req.path });

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
        logger.info('Database connection established');

        // Only sync without altering existing tables (safe for production)
        await sequelize.sync({ alter: false });
        logger.info('Database models synchronized');

        app.listen(PORT, '0.0.0.0', () => {
            logger.info(`Campus Navigator running at http://localhost:${PORT}`);
            logger.info(`Mobile API available at http://localhost:${PORT}/api/mobile`);
        });
    } catch (error) {
        logger.error('Failed to start server', { error: error.message, stack: error.stack });
        process.exit(1);
    }
}

startServer();

module.exports = app;
