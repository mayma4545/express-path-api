const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { AppUser } = require('../models');
const { sendEmail } = require('../services/mailer');

// Load Google settings based on provided json
const ObjectEnvGoogle = {
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    auth_uri: process.env.GOOGLE_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
    token_uri: process.env.GOOGLE_TOKEN_URI || 'https://oauth2.googleapis.com/token',
    redirect_uris: [
        process.env.GOOGLE_REDIRECT_URI_PROD || 'https://express-path-api.onrender.com/',
        process.env.GOOGLE_REDIRECT_URI_DEV || 'http://localhost:3000/login/'
    ]
};
let googleSecrets = process.env.GOOGLE_CLIENT_ID ? ObjectEnvGoogle : null;

// Landing page (was index.html)
router.get('/', (req, res) => {
    res.render('client/index');
});
router.get('/index', (req, res) => {
    res.redirect('/');
});

// Home/Events page (was home.html)
router.get('/home', async (req, res) => {
    try {
        const { Event, Category } = require('../models');
        const dbEvents = await Event.findAll({
            where: {
                status: 'published'
            },
            include: [{ model: Category, as: 'category' }],
            order: [['event_date', 'ASC']]
        });
        res.render('client/home', { dbEvents });
    } catch (error) {
        console.error('Error loading events:', error);
        res.render('client/home', { dbEvents: [] });
    }
});

// Details view
router.get('/details', async (req, res) => {
    try {
        const { Event, Category, Nodes, Organizer } = require('../models');
        const eventId = req.query.id;
        
        if (!eventId) {
            return res.redirect('/home');
        }
        
        const dbEvent = await Event.findByPk(eventId, {
            include: [
                { model: Category, as: 'category' },
                { model: Organizer, as: 'organizer' }
            ]
        });
        
        if (!dbEvent) {
            return res.redirect('/home');
        }
        
        res.render('client/details', { dbEvent });
    } catch (error) {
        console.error('Error loading event details:', error);
        res.redirect('/home');
    }
});

// Login view and Google OAuth Callback
router.get('/login', async (req, res) => {
    const { code, error, message } = req.query;

    // Handle Google OAuth error
    if (error && !message) {
        return res.render('client/login', { message: null, error: 'Google authentication failed or was cancelled.' });
    }

    // Handle Google OAuth callback successfully returning a code
    if (code) {
        if (!googleSecrets) return res.redirect('/signup?error=Google Auth not configured');

        const isProd = process.env.NODE_ENV === 'production';
        const redirectUri = isProd ? googleSecrets.redirect_uris[0] : googleSecrets.redirect_uris[1];

        try {
            const tokenResponse = await fetch(googleSecrets.token_uri, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: googleSecrets.client_id,
                    client_secret: googleSecrets.client_secret,
                    code,
                    grant_type: 'authorization_code',
                    redirect_uri: redirectUri
                })
            });
            
            const tokenData = await tokenResponse.json();
            if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);
            
            const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${tokenData.access_token}` }
            });
            
            const userInfo = await userInfoResponse.json();
            
            // Save Google profile to session
            req.session.googleAuth = {
                email: userInfo.email,
                firstName: userInfo.given_name || '',
                lastName: userInfo.family_name || ''
            };
            
            // Redirect to new password setup form
            return res.redirect('/signup/google-pwd');
        } catch (err) {
            console.error('Google Auth Error:', err);
            return res.redirect('/signup?error=Failed to authenticate with Google');
        }
    }

    res.render('client/login', { message: req.query.message, error: req.query.error });
});

// Login endpoint
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Missing email or password' });
        }

        const user = await AppUser.findOne({ where: { email } });
        if (!user) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }

        // Store user in session
        req.session.user = {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name
        };
        req.session.userId = user.id;

        res.json({ success: true, message: 'Logged in successfully' });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Logout endpoint
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/home');
});

// Signup view
router.get('/signup', (req, res) => {
    const { googleAuth, firstName, lastName, email } = req.query;
    res.render('client/signup', { 
        googleAuth: googleAuth === 'true', 
        firstName: firstName || '', 
        lastName: lastName || '', 
        email: email || '',
        message: req.query.message,
        error: req.query.error
    });
});

// Map view
router.get('/map', (req, res) => {
    res.render('client/map');
});

// Manual Sign-up endpoint
router.post('/signup', async (req, res) => {
    try {
        const { firstName, lastName, email, password } = req.body;
        
        if (!firstName || !lastName || !email || !password) {
            return res.redirect('/signup?error=Missing required fields');
        }

        const existingUser = await AppUser.findOne({ where: { email } });
        if (existingUser) {
            return res.redirect('/signup?error=Email already in use');
        }

        const password_hash = await bcrypt.hash(password, 10);

        await AppUser.create({
            first_name: firstName,
            last_name: lastName,
            email,
            password_hash
        });

        res.redirect('/login?message=Registration successful. You can now log in.');
    } catch (error) {
        console.error('Signup error:', error);
        const errorMessage = error.original?.sqlMessage || error.message || 'An error occurred during registration. Please try again.';
        res.redirect('/signup?error=' + encodeURIComponent(errorMessage));
    }
});

// Google Sign-up Password Collection Route
router.get('/signup/google-pwd', (req, res) => {
    if (!req.session.googleAuth) {
        return res.redirect('/signup?error=Google authentication session expired. Please try again.');
    }
    res.render('client/google_password', {
        email: req.session.googleAuth.email,
        firstName: req.session.googleAuth.firstName,
        lastName: req.session.googleAuth.lastName,
        error: req.query.error
    });
});

// Handle Google Sign-up Password Submission
router.post('/signup/google-pwd', async (req, res) => {
    try {
        if (!req.session.googleAuth) {
            return res.redirect('/signup?error=Google authentication session expired. Please try again.');
        }

        const { password, confirmPassword } = req.body;
        const { email, firstName, lastName } = req.session.googleAuth;

        if (!password || password !== confirmPassword) {
            return res.redirect('/signup/google-pwd?error=Passwords do not match or are empty.');
        }

        const existingUser = await AppUser.findOne({ where: { email } });
        if (existingUser) {
            return res.redirect('/signup?error=Email already in use. Please log in.');
        }

        const password_hash = await bcrypt.hash(password, 10);

        await AppUser.create({
            first_name: firstName,
            last_name: lastName,
            email,
            password_hash
        });

        // Clear session data
        delete req.session.googleAuth;

        // Send welcome email
        const mailText = `Welcome to PAEMA, ${firstName}!\n\nYour account has been successfully created. You can now log in using your email address and the password you just set.\n\nThank you for joining us!`;
        const mailHtml = `<p>Welcome to PAEMA, <strong>${firstName}</strong>!</p><p>Your account has been successfully created. You can now log in using your email address and the password you just set.</p><p>Thank you for joining us!</p>`;
        
        await sendEmail(email, 'Welcome to PAEMA!', mailText, mailHtml);

        res.redirect('/login?message=Account created successfully. Welcome to PAEMA!');
    } catch (error) {
        console.error('Google signup password error:', error);
        const errorMessage = error.original?.sqlMessage || (error.errors ? error.errors.map(e => e.message).join(', ') : error.message || 'An error occurred while creating your account.');
        res.redirect('/signup/google-pwd?error=' + encodeURIComponent(errorMessage));
    }
});

// Google OAuth Authorization Redirection
router.get('/auth/google', (req, res) => {
    if (!googleSecrets) return res.redirect('/signup?error=Google Auth not configured');
    
    // Select the appropriate redirect URI
    const isProd = process.env.NODE_ENV === 'production';
    const redirectUri = isProd ? googleSecrets.redirect_uris[0] : googleSecrets.redirect_uris[1];
    
    const params = new URLSearchParams({
        client_id: googleSecrets.client_id,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'email profile',
        access_type: 'offline',
        prompt: 'consent'
    });
    
    res.redirect(`${googleSecrets.auth_uri}?${params.toString()}`);
});

module.exports = router;
