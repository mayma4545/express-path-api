const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { AppUser, Organizer, UserNotification } = require('../models');
const { sendEmail } = require('../services/mailer');
const { uploadAvatarHybrid, saveFileHybrid } = require('../services/upload.hybrid');

// Helper to detect JSON requests (handles fetch, AJAX, etc)
const isJson = (req) => {
    return req.xhr || 
           (req.headers.accept && req.headers.accept.indexOf('json') > -1) ||
           (req.headers['content-type'] && req.headers['content-type'].indexOf('json') > -1);
};

const requireUserAuth = (req, res, next) => {
    if (req.session && req.session.user) {
        return next();
    }
    if (isJson(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    res.redirect('/login');
};

// Helper to get Google settings
const getGoogleSettings = (req) => {
    if (!process.env.GOOGLE_CLIENT_ID) {
        console.log('[DEBUG] GOOGLE_CLIENT_ID not found in environment');
        return null;
    }
    
    // 1. Prioritize explicit redirect URI env vars
    let redirectUri = process.env.NODE_ENV === 'production' 
        ? process.env.GOOGLE_REDIRECT_URI_PROD 
        : process.env.GOOGLE_REDIRECT_URI_DEV;

    // 2. If no explicit URI, determine it dynamically
    if (!redirectUri) {
        const baseUrl = process.env.BASE_URL || (req ? `${req.protocol}://${req.get('host')}` : 'http://localhost:3000');
        // If it's localhost, we default to the trailing slash version which was working for you
        if (baseUrl.includes('localhost')) {
            redirectUri = `${baseUrl}/login/`;
        } else {
            redirectUri = `${baseUrl}/login`;
        }
    }

    return {
        client_id: process.env.GOOGLE_CLIENT_ID.trim(),
        client_secret: (process.env.GOOGLE_CLIENT_SECRET || '').trim(),
        auth_uri: process.env.GOOGLE_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
        token_uri: process.env.GOOGLE_TOKEN_URI || 'https://oauth2.googleapis.com/token',
        redirect_uri: redirectUri
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

        const { EventAnalytics, EventBookmark } = require('../models');
        const dbEvents = await Event.findAll({
            where,
            include: [{ model: Category, as: 'category' }, { model: EventAnalytics, as: 'analytics' }],
            order
        });

        // Fetch top 5 most visited events for Hot Events carousel
        const hotEvents = await Event.findAll({
            where: { status: 'published' },
            include: [
                { model: Category, as: 'category' },
                { 
                    model: EventAnalytics, 
                    as: 'analytics',
                    required: true
                }
            ],
            order: [[{ model: EventAnalytics, as: 'analytics' }, 'page_view_count', 'DESC']],
            limit: 5
        });

        // Get user's bookmarks if logged in
        let userBookmarks = [];
        if (req.session.userId) {
            const bookmarks = await EventBookmark.findAll({
                where: { user_id: req.session.userId },
                attributes: ['event_id']
            });
            userBookmarks = bookmarks.map(b => b.event_id);
        }
        
        res.render('client/home', { 
            dbEvents, 
            hotEvents,
            search: search || '', 
            sort: sort || 'date_asc',
            user: req.session.user || null,
            userBookmarks
        });
    } catch (error) {
        console.error('Error loading events:', error);
        res.render('client/home', { dbEvents: [], search: '', sort: 'date_asc', user: req.session.user || null, userBookmarks: [] });
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
        
        res.render('client/details', { 
            dbEvent,
            user: req.session.user || null
        });
    } catch (error) {
        console.error('Error loading event details:', error);
        res.redirect('/home');
    }
});

// Login view and Google OAuth Callback
router.get('/login', async (req, res) => {
    const { code, error, message } = req.query;
    const googleSettings = getGoogleSettings(req);

    // Handle Google OAuth error
    if (error && !message) {
        return res.render('client/login', { message: null, error: 'Google authentication failed or was cancelled.' });
    }

    // Handle Google OAuth callback successfully returning a code
    if (code) {
        if (!googleSettings) return res.redirect('/login?error=' + encodeURIComponent('Google Auth not configured'));

        try {
            const tokenResponse = await fetch(googleSettings.token_uri, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: googleSettings.client_id,
                    client_secret: googleSettings.client_secret,
                    code,
                    grant_type: 'authorization_code',
                    redirect_uri: googleSettings.redirect_uri
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

                if (flow === 'signup') {
                    // Email already exists - show error on signup page
                    return res.redirect('/signup?error=' + encodeURIComponent('Email already in use. Please log in.'));
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

// GET /signup/verify - Fallback for manual redirection
router.get('/signup/verify', (req, res) => {
    const { email } = req.query;
    if (!req.session.pendingUser || req.session.pendingUser.email !== email) {
        return res.redirect('/signup');
    }
    // Since the main signup page handles the OTP UI via JS, 
    // we redirect back to signup but with a flag or just let them stay on signup.
    // However, if they were redirected here, it means we need to show the OTP UI.
    // For simplicity, we redirect back to signup and the user will have to enter details again,
    // OR we can render the signup page and tell the JS to show OTP.
    res.render('client/signup', { 
        email: email,
        firstName: req.session.pendingUser.firstName,
        lastName: req.session.pendingUser.lastName,
        googleAuth: false,
        requiresOtp: true // Pass a flag to EJS
    });
});

// Manual Sign-up endpoint - Now triggers OTP
router.post('/signup', async (req, res) => {
    try {
        const { firstName, lastName, email, password } = req.body;
        
        if (!firstName || !lastName || !email || !password) {
            if (isJson(req)) {
                return res.status(400).json({ error: 'Missing required fields' });
            }
            return res.redirect('/signup?error=Missing required fields');
        }

        const existingUser = await AppUser.findOne({ where: { email } });
        if (existingUser) {
            if (isJson(req)) {
                return res.status(400).json({ error: 'Email already in use' });
            }
            return res.redirect('/signup?error=Email already in use');
        }

        // Generate a 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Store user data and OTP in session temporarily
        req.session.pendingUser = {
            firstName,
            lastName,
            email,
            password_hash: await bcrypt.hash(password, 10),
            otp,
            otpExpires: Date.now() + 10 * 60 * 1000 // 10 minutes
        };

        // Send OTP via email
        const mailText = `Your OTP for PAEMA registration is: ${otp}. It will expire in 10 minutes.`;
        const mailHtml = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
                <h2 style="color: #1DA1F2; text-align: center;">Verify Your Email</h2>
                <p>Hello <strong>${firstName}</strong>,</p>
                <p>Thank you for signing up for PAEMA. To complete your registration, please use the following One-Time Password (OTP):</p>
                <div style="background: #f8f9fa; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #333; margin: 20px 0; border-radius: 8px; border: 1px dashed #1DA1F2;">
                    ${otp}
                </div>
                <p style="color: #666; font-size: 14px;">This OTP will expire in <strong>10 minutes</strong>. If you did not request this, please ignore this email.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="text-align: center; color: #999; font-size: 12px;">&copy; 2026 PAEMA Campus Navigator</p>
            </div>
        `;
        
        await sendEmail(email, 'Your Verification Code - PAEMA', mailText, mailHtml);

        if (isJson(req)) {
            return res.json({ 
                success: true, 
                requiresOtp: true,
                message: 'OTP sent to your email.' 
            });
        }
        res.redirect('/signup/verify?email=' + encodeURIComponent(email));
    } catch (error) {
        console.error('Signup error:', error);
        const errorMessage = error.original?.sqlMessage || error.message || 'An error occurred during registration. Please try again.';
        
        if (isJson(req)) {
            return res.status(500).json({ error: errorMessage });
        }
        res.redirect('/signup?error=' + encodeURIComponent(errorMessage));
    }
});

// OTP Verification endpoint
router.post('/signup/verify-otp', async (req, res) => {
    try {
        const { otp } = req.body;
        const pendingUser = req.session.pendingUser;

        if (!pendingUser) {
            return res.status(400).json({ error: 'Session expired. Please sign up again.' });
        }

        if (Date.now() > pendingUser.otpExpires) {
            return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
        }

        if (otp !== pendingUser.otp) {
            return res.status(400).json({ error: 'Invalid OTP. Please try again.' });
        }

        // OTP is valid, create the user
        const user = await AppUser.create({
            first_name: pendingUser.firstName,
            last_name: pendingUser.lastName,
            email: pendingUser.email,
            password_hash: pendingUser.password_hash
        });

        // Send congratulatory email
        const welcomeText = `Congratulations ${pendingUser.firstName}! Your account has been successfully verified.`;
        const welcomeHtml = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <div style="background: #1DA1F2; width: 60px; height: 60px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: white; font-size: 30px;">✓</div>
                </div>
                <h2 style="color: #1DA1F2; text-align: center;">Registration Confirmed!</h2>
                <p>Hello <strong>${pendingUser.firstName}</strong>,</p>
                <p>Congratulations! Your email has been successfully verified, and your account is now active.</p>
                <p>You can now log in to PAEMA to explore campus maps, find events, and navigate Masbate City with ease.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="http://localhost:3000/login" style="background: #1DA1F2; color: white; padding: 12px 25px; text-decoration: none; font-weight: bold; border-radius: 25px; display: inline-block;">Login to Your Account</a>
                </div>
                <p>If you have any questions, feel free to reach out to our support team.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="text-align: center; color: #999; font-size: 12px;">&copy; 2026 PAEMA Campus Navigator</p>
            </div>
        `;
        
        await sendEmail(pendingUser.email, 'Welcome to PAEMA - Account Verified!', welcomeText, welcomeHtml);

        // Clear pending user from session
        delete req.session.pendingUser;

        return res.json({ 
            success: true, 
            message: 'Email verified successfully! You can now log in.' 
        });
    } catch (error) {
        console.error('OTP verification error:', error);
        return res.status(500).json({ error: 'An error occurred during verification.' });
    }
});

// Resend OTP endpoint
router.post('/signup/resend-otp', async (req, res) => {
    try {
        const pendingUser = req.session.pendingUser;

        if (!pendingUser) {
            return res.status(400).json({ error: 'No pending registration found.' });
        }

        // Generate new OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        pendingUser.otp = otp;
        pendingUser.otpExpires = Date.now() + 10 * 60 * 1000;
        req.session.pendingUser = pendingUser;

        // Send OTP via email
        const mailText = `Your new OTP for PAEMA registration is: ${otp}. It will expire in 10 minutes.`;
        const mailHtml = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
                <h2 style="color: #1DA1F2; text-align: center;">New Verification Code</h2>
                <p>Hello <strong>${pendingUser.firstName}</strong>,</p>
                <p>You requested a new verification code. Please use the following One-Time Password (OTP):</p>
                <div style="background: #f8f9fa; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #333; margin: 20px 0; border-radius: 8px; border: 1px dashed #1DA1F2;">
                    ${otp}
                </div>
                <p style="color: #666; font-size: 14px;">This OTP will expire in <strong>10 minutes</strong>.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="text-align: center; color: #999; font-size: 12px;">&copy; 2026 PAEMA Campus Navigator</p>
            </div>
        `;
        
        await sendEmail(pendingUser.email, 'New Verification Code - PAEMA', mailText, mailHtml);

        return res.json({ success: true, message: 'New OTP sent to your email.' });
    } catch (error) {
        console.error('Resend OTP error:', error);
        return res.status(500).json({ error: 'An error occurred while resending OTP.' });
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
    const googleSettings = getGoogleSettings(req);
    if (!googleSettings) return res.redirect('/login?error=Google Auth not configured');
    
    const { flow } = req.query; // 'login' or 'signup'
    if (flow) {
        req.session.authFlow = flow;
    }

    const params = new URLSearchParams({
        client_id: googleSettings.client_id,
        redirect_uri: googleSettings.redirect_uri,
        response_type: 'code',
        scope: 'email profile',
        access_type: 'offline',
        prompt: 'select_account'
    });
    
    res.redirect(`${googleSettings.auth_uri}?${params.toString()}`);
});

// Profile page
router.get('/profile', requireUserAuth, async (req, res) => {
    try {
        const { Event, AppUser, EventVisit, EventLike, EventBookmark, Comment, Category } = require('../models');
        const userId = req.session.userId || req.session.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const offset = (page - 1) * limit;

        const user = await AppUser.findByPk(userId);
        
        if (!user) {
            console.error('User not found in database for ID:', userId);
            return res.redirect('/login?message=' + encodeURIComponent('User session expired. Please log in again.'));
        }
        
        // 1. Get Bookmarks
        const bookmarkedEvents = await Event.findAll({
            include: [{ 
                model: EventBookmark, 
                as: 'bookmarks', 
                where: { user_id: userId },
                required: true 
            }]
        });

        // 2. Get Visit History with Pagination
        const { count, rows: visits } = await EventVisit.findAndCountAll({
            where: { user_id: userId },
            include: [{ 
                model: Event, 
                as: 'event',
                include: [{ model: Category, as: 'category' }]
            }],
            order: [['created_at', 'DESC']],
            limit,
            offset
        });

        // 3. For each visit, check for other activities
        const visitedEventsWithActivity = await Promise.all(visits.map(async (v) => {
            if (!v.event) return null;
            
            const eventId = v.event.id;
            const [hasLiked, hasBookmarked, comments] = await Promise.all([
                EventLike.findOne({ where: { event_id: eventId, user_id: userId } }),
                EventBookmark.findOne({ where: { event_id: eventId, user_id: userId } }),
                Comment.findAll({ where: { event_id: eventId, user_id: userId } })
            ]);

            return {
                ...v.event.toJSON(),
                visited_at: v.created_at,
                activity: {
                    liked: !!hasLiked,
                    bookmarked: !!hasBookmarked,
                    commentCount: comments.length
                }
            };
        }));

        const totalPages = Math.ceil(count / limit);
        
        res.render('client/profile', { 
            user, 
            bookmarkedEvents, 
            visitedEvents: visitedEventsWithActivity.filter(e => e !== null),
            pagination: {
                total: count,
                currentPage: page,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });
    } catch (error) {
        console.error('Error loading profile:', error);
        res.redirect('/home?error=' + encodeURIComponent('Could not load profile.'));
    }
});

// Update profile endpoint
router.post('/profile/update', requireUserAuth, (req, res, next) => {
    const { uploadAvatarHybrid } = require('../services/upload.hybrid');
    uploadAvatarHybrid.single('avatar')(req, res, next);
}, async (req, res) => {
    try {
        const { first_name, last_name } = req.body;
        const userId = req.session.userId || req.session.user.id;
        
        if (!first_name || !last_name) {
            return res.status(400).json({ success: false, error: 'First name and last name are required' });
        }

        const updateData = { first_name, last_name };

        // Handle Avatar Upload
        if (req.file) {
            const uploadResult = await saveFileHybrid(req.file, 'avatars');
            updateData.avatar_url = uploadResult.cloudinaryUrl;
        }

        await AppUser.update(
            updateData,
            { where: { id: userId } }
        );
        
        // Update session
        req.session.user.first_name = first_name;
        req.session.user.last_name = last_name;
        if (updateData.avatar_url) {
            req.session.user.avatar_url = updateData.avatar_url;
        }
        
        res.json({ success: true, message: 'Profile updated successfully', avatar_url: updateData.avatar_url });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ success: false, error: 'Failed to update profile' });
    }
});

// Security/Password update endpoint
router.post('/profile/security', requireUserAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await AppUser.findByPk(req.session.userId);

        if (user.password_hash) {
            const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
            if (!isMatch) {
                return res.status(400).json({ success: false, error: 'Current password is incorrect' });
            }
        }

        const password_hash = await bcrypt.hash(newPassword, 10);
        await AppUser.update({ password_hash }, { where: { id: req.session.userId } });

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        console.error('Security update error:', error);
        res.status(500).json({ success: false, error: 'Failed to update password' });
    }
});

// Bookmarks page
router.get('/bookmarks', requireUserAuth, async (req, res) => {
    try {
        const { EventBookmark, Event, Category } = require('../models');
        const bookmarks = await EventBookmark.findAll({
            where: { user_id: req.session.userId },
            include: [{ 
                model: Event, 
                as: 'event',
                include: [{ model: Category, as: 'category' }]
            }],
            order: [['created_at', 'DESC']]
        });
        
        // Map to format expected by the frontend
        const bookmarkedEvents = bookmarks.map(b => b.event).filter(e => e !== null);
        
        res.render('client/bookmarks', { dbEvents: bookmarkedEvents });
    } catch (error) {
        console.error('Error loading bookmarks:', error);
        res.render('client/bookmarks', { dbEvents: [] });
    }
});

// Notifications page
router.get('/notifications', requireUserAuth, async (req, res) => {
    try {
        const notifications = await UserNotification.findAll({
            where: { user_id: req.session.userId },
            include: [{ model: Event, as: 'event' }],
            order: [['created_at', 'DESC']]
        });
        
        res.render('client/notifications', { notifications });
        
        // Mark all as read after viewing
        await UserNotification.update(
            { is_read: true },
            { where: { user_id: req.session.userId, is_read: false } }
        );
    } catch (error) {
        console.error('Error loading notifications:', error);
        res.render('client/notifications', { notifications: [] });
    }
});

module.exports = router;
