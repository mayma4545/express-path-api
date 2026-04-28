require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');

const htmlRoutes = require('./routes/htmlRoutes');
const apiRoutes = require('./routes/apiRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for session management
app.use(session({
    secret: 'campus-navigator-secret', // Replace with a strong secret in production
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Middleware for parsing JSON and urlencoded form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets (CSS, JS, Images)
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Use API routes
app.use('/api', apiRoutes);

// Use HTML routes
app.use('/', htmlRoutes);

// Fallback for any other HTML files directly in the frontend folder if needed
app.use(express.static(path.join(__dirname, 'html')));

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
