const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { AppUser, Organizer } = require('../models');
const { sendEmail } = require('../services/mailer');

// Helper to get Google settings
const getGoogleSettings = () => {
    if (!process.env.GOOGLE_CLIENT_ID) {
        console.log('[DEBUG] GOOGLE_CLIENT_ID not found in environment');
        return null;
    }
    
    return {
        client_id: process.env.GOOGLE_CLIENT_ID.trim(),
        client_secret: (process.env.GOOGLE_CLIENT_SECRET || '').trim(),
        auth_uri: process.env.GOOGLE_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
        token_uri: process.env.GOOGLE_TOKEN_URI || 'https://oauth2.googleapis.com/token',
        redirect_uris: [
            process.env.GOOGLE_REDIRECT_URI_PROD || 'https://express-path-api.onrender.com/',
            process.env.GOOGLE_REDIRECT_URI_DEV || 'http://localhost:3000/login/'
        ]
    };
};

console.log('[DEBUG] Google Auth configured:', !!process.env.GOOGLE_CLIENT_ID);

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
        const { search, sort } = req.query;
        
        let where = { status: 'published' };
        
        // Basic server-side filtering if search is provided
        if (search) {
            const { Op } = require('sequelize');
            where[Op.or] = [
                { title: { [Op.like]: `%${search}%` } },
                { description: { [Op.like]: `%${search}%` } },
                { venue: { [Op.like]: `%${search}%` } }
            ];
        }

        let order = [['event_date', 'ASC']];
        if (sort === 'date_desc') order = [['event_date', 'DESC']];
        if (sort === 'title_asc') order = [['title', 'ASC']];
        if (sort === 'title_desc') order = [['title', 'DESC']];

        const dbEvents = await Event.findAll({
            where,
            include: [{ model: Category, as: 'category' }],
            order
        });
        
        res.render('client/home', { 
            dbEvents, 
            search: search || '', 
            sort: sort || 'date_asc' 
        });
    } catch (error) {
        console.error('Error loading events:', error);
        res.render('client/home', { dbEvents: [], search: '', sort: 'date_asc' });
    }
});

// Details view
router.get('/details', async (req, res) => {
    try {
        const { Event, Category, Nodes } = require('../models');
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
    const googleSettings = getGoogleSettings();

    // Handle Google OAuth error
    if (error && !message) {
        return res.render('client/login', { message: null, error: 'Google authentication failed or was cancelled.' });
    }

    // Handle Google OAuth callback successfully returning a code
    if (code) {
        if (!googleSettings) return res.redirect('/login?error=' + encodeURIComponent('Google Auth not configured'));

        const isProd = process.env.NODE_ENV === 'production';
        const redirectUri = isProd ? googleSettings.redirect_uris[0] : googleSettings.redirect_uris[1];

        try {
            const tokenResponse = await fetch(googleSettings.token_uri, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: googleSettings.client_id,
                    client_secret: googleSettings.client_secret,
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
            const email = userInfo.email;

            // Check if user exists and is not an organizer
            const user = await AppUser.findOne({
                where: { email },
                include: [{ model: Organizer, as: 'organizer_profile' }]
            });

            const flow = req.session.authFlow || 'login';
            delete req.session.authFlow;

            if (user) {
                // If user is an organizer, they shouldn't log in through the client portal
                if (user.organizer_profile) {
                    return res.redirect('/login?error=' + encodeURIComponent('Invalid user account'));
                }

                // Auto-login existing non-organizer user
                req.session.user = {
                    id: user.id,
                    email: user.email,
                    first_name: user.first_name,
                    last_name: user.last_name
                };
                req.session.userId = user.id;

                return res.redirect('/home');
            } else {
                // User doesn't exist
                if (flow === 'signup') {
                    // Save Google profile to session for registration
                    req.session.googleAuth = {
                        email: userInfo.email,
                        firstName: userInfo.given_name || '',
                        lastName: userInfo.family_name || ''
                    };
                    return res.redirect('/signup/google-pwd');
                } else {
                    // Email not registered — show generic error on login page
                    return res.redirect('/login?error=' + encodeURIComponent('Invalid user account'));
                }
            }
        } catch (err) {
            console.error('Google Auth Error:', err);
            return res.redirect('/login?error=Failed to authenticate with Google');
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

        const user = await AppUser.findOne({ 
            where: { email },
            include: [{ model: Organizer, as: 'organizer_profile' }]
        });

        if (!user) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }

        // If user has an organizer profile, they shouldn't log in here
        if (user.organizer_profile) {
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
    // Clear session from server
    req.session.destroy((err) => {
        if (err) {
            console.error('Session destruction error:', err);
        }
        
        // Clear session cookie
        res.clearCookie('connect.sid'); // Default express-session cookie name
        
        // Instruct browser to clear all security cache/storage
        res.set('Clear-Site-Data', '"cache", "cookies", "storage", "executionContexts"');
        
        // Redirect back to landing page (root)
        res.redirect('/');
    });
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
    const googleSettings = getGoogleSettings();
    if (!googleSettings) return res.redirect('/login?error=Google Auth not configured');
    
    const { flow } = req.query; // 'login' or 'signup'
    if (flow) {
        req.session.authFlow = flow;
    }

    // Select the appropriate redirect URI
    const isProd = process.env.NODE_ENV === 'production';
    const redirectUri = isProd ? googleSettings.redirect_uris[0] : googleSettings.redirect_uris[1];
    
    const params = new URLSearchParams({
        client_id: googleSettings.client_id,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'email profile',
        access_type: 'offline',
        prompt: 'select_account'
    });
    
    res.redirect(`${googleSettings.auth_uri}?${params.toString()}`);
});

module.exports = router;
