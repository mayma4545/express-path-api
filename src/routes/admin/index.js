const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const router = express.Router();

// Middleware to get unread activity count
router.use(async (req, res, next) => {
    try {
        const { EventSystemActivityLog } = require('../../models');
        if (EventSystemActivityLog) {
            const unreadCount = await EventSystemActivityLog.count({ where: { is_read: false } });
            res.locals.unreadActivityCount = unreadCount;
        } else {
            res.locals.unreadActivityCount = 0;
        }
        next();
    } catch (e) {
        console.error('Middleware error:', e);
        res.locals.unreadActivityCount = 0;
        next();
    }
});

const { Event, Category, Nodes, AppUser, Organizer, sequelize } = require('../../models');
const { uploadBufferToCloudinary, imageFilter } = require('../../services/cloudinary');

const uploadOrganizerAvatar = multer({
    storage: multer.memoryStorage(),
    fileFilter: imageFilter,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 10 * 1024 * 1024
    }
});

// Redirect /admin to /admin/dashboard
router.get('/', (req, res) => {
    res.redirect('/admin/dashboard');
});

// Admin Dashboard - City Overview
router.get('/dashboard', async (req, res) => {
    try {
        const { Op } = require('sequelize');
        const { EventSystemActivityLog, OrganizerNotification, EventAnalytics, Organizer } = require('../../models');
        const [
            totalEvents, totalCategories, totalUsers, totalOrganizers,
            ongoingEvents, upcomingEvents, mostVisitedEvents,
            recentActivities, notifications,
            ongoingCount, upcomingCount
        ] = await Promise.all([
            Event.count(),
            Category.count(),
            AppUser.count(),
            Organizer.count(),
            Event.findAll({ 
                where: { is_ongoing: true }, 
                order: [['created_at', 'DESC']], 
                limit: 3 
            }),
            Event.findAll({ 
                where: { 
                    is_ongoing: false, 
                    // using >= today logic 
                }, 
                order: [['created_at', 'DESC']], // using fallback order because we didn't sanitize start_date specifically
                limit: 3 
            }),
            Event.findAll({ 
                order: [['created_at', 'DESC']], // Fallback to newly created for now
                limit: 3 
            }),
            EventSystemActivityLog.findAll({
                include: [{ model: Organizer, as: 'organizer_actor', attributes: ['id', 'name'] }],
                order: [['occurred_at', 'DESC']],
                limit: 5
            }),
            OrganizerNotification.findAll({
                order: [['created_at', 'DESC']],
                limit: 6
            }),
            Event.count({ where: { is_ongoing: true } }),
            Event.count({ where: { is_ongoing: false } })
        ]);

        res.render('admin/dashboard', {
            title: 'Admin Dashboard | Masbate City',
            totalEvents,
            totalCategories,
            totalUsers,
            totalOrganizers,
            ongoingEvents,
            upcomingEvents,
            mostVisitedEvents,
            recentActivities,
            notifications,
            ongoingCount,
            upcomingCount,
            currentPath: '/admin/dashboard'
        });
    } catch (error) {
        console.error('Admin Dashboard error:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

// Organizers Management (List of Organizer requests/accounts)
router.get('/organizers', async (req, res) => {
    try {
        const organizers = await Organizer.findAll({
            include: [{ model: AppUser, as: 'account', required: false }],
            order: [['created_at', 'DESC']]
        });
        
        res.render('admin/organizers', {
            title: 'Organizers Management | Admin',
            organizers,
            currentPath: '/admin/organizers'
        });
    } catch (error) {
        console.error('Admin Organizers error:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

// View Organizer Profile
router.get('/organizers/:id', async (req, res) => {
    try {
        const organizer = await Organizer.findByPk(req.params.id, {
            include: [{ model: AppUser, as: 'account' }]
        });

        if (!organizer) {
            return res.status(404).render('error', { title: 'Not Found', message: 'Organizer not found.' });
        }

        const events = await Event.findAll({
            where: { organizer_id: organizer.id },
            include: ['category'],
            order: [['event_date', 'DESC']]
        });

        res.render('admin/organizer_profile', {
            title: `${organizer.name} Profile | Admin`,
            organizer,
            events,
            currentPath: '/admin/organizers'
        });
    } catch (error) {
        console.error('Admin Organizer Profile error:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

// Create organizer
router.post('/organizers', uploadOrganizerAvatar.single('avatar_image'), async (req, res) => {
    try {
        const {
            name,
            description,
            email,
            password
        } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).render('error', {
                title: 'Invalid Organizer',
                message: 'Organizer name is required.'
            });
        }

        if (!email || !email.trim()) {
            return res.status(400).render('error', {
                title: 'Invalid Organizer Account',
                message: 'Email is required for organizer login.'
            });
        }

        if (!password || password.length < 8) {
            return res.status(400).render('error', {
                title: 'Invalid Organizer Account',
                message: 'Password must be at least 8 characters long.'
            });
        }

        const nameParts = name.trim().split(' ');
        const first_name = nameParts[0] || 'Organizer';
        const last_name = nameParts.slice(1).join(' ') || 'Account';

        const safeRating = 0; // Default rating for new organizers

        const emailValue = email.trim().toLowerCase();
        const existingAccount = await AppUser.findOne({ where: { email: emailValue } });
        if (existingAccount) {
            return res.status(409).render('error', {
                title: 'Duplicate Account',
                message: 'An app account with that email already exists.'
            });
        }

        let avatarUrl = null;
        if (req.file && req.file.buffer) {
            avatarUrl = await uploadBufferToCloudinary(req.file.buffer, 'campus-navigator/organizers');
        }

        const passwordHash = await bcrypt.hash(password, 10);

        await sequelize.transaction(async (transaction) => {
            const appUser = await AppUser.create({
                first_name: first_name.trim(),
                last_name: last_name.trim(),
                email: emailValue,
                password_hash: passwordHash,
                avatar_url: avatarUrl
            }, { transaction });

            await Organizer.create({
                user_id: appUser.id,
                name: name.trim(),
                avatar_url: avatarUrl,
                description: description ? description.trim() : null,
                average_rating: safeRating,
                status: 'approved'
            }, { transaction });
        });

        res.redirect('/admin/organizers');
    } catch (error) {
        console.error('Create organizer error:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

// Edit organizer
router.post('/organizers/:id/edit', uploadOrganizerAvatar.single('avatar_image'), async (req, res) => {
    try {
        const organizerId = req.params.id;
        const {
            name,
            description,
            email,
            password
        } = req.body;

        const organizer = await Organizer.findByPk(organizerId, { include: ['account'] });
        if (!organizer) {
            return res.status(404).render('error', { title: 'Not Found', message: 'Organizer not found.' });
        }

        if (!name || !name.trim()) {
            return res.status(400).render('error', { title: 'Invalid Input', message: 'Organizer name is required.' });
        }
        
        if (!email || !email.trim()) {
            return res.status(400).render('error', { title: 'Invalid Input', message: 'Email is required.' });
        }

        if (password && password.length > 0 && password.length < 8) {
            return res.status(400).render('error', { title: 'Invalid Input', message: 'Password must be at least 8 characters long.' });
        }

        const emailValue = email.trim().toLowerCase();
        
        if (organizer.account && organizer.account.email !== emailValue) {
            const existingAccount = await AppUser.findOne({ where: { email: emailValue } });
            if (existingAccount) {
                return res.status(409).render('error', { title: 'Duplicate Email', message: 'Email already in use.' });
            }
        }

        let avatarUrl = organizer.avatar_url;
        if (req.file && req.file.buffer) {
            avatarUrl = await uploadBufferToCloudinary(req.file.buffer, 'campus-navigator/organizers');
        }

        await sequelize.transaction(async (transaction) => {
            if (organizer.account) {
                const userUpdates = { email: emailValue };
                if (password && password.length >= 8) {
                    userUpdates.password_hash = await bcrypt.hash(password, 10);
                }
                
                if (avatarUrl !== organizer.avatar_url) {
                   userUpdates.avatar_url = avatarUrl;
                }

                const nameParts = name.trim().split(' ');
                userUpdates.first_name = nameParts[0] || 'Organizer';
                userUpdates.last_name = nameParts.slice(1).join(' ') || 'Account';

                await AppUser.update(userUpdates, { 
                    where: { id: organizer.user_id },
                    transaction 
                });
            }

            await Organizer.update({
                name: name.trim(),
                description: description ? description.trim() : null,
                avatar_url: avatarUrl
            }, {
                where: { id: organizerId },
                transaction
            });
        });

        res.redirect('/admin/organizers');
    } catch (error) {
        console.error('Edit organizer error:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

// Approve organizer
router.post('/organizers/:id/approve', async (req, res) => {
    try {
        const organizerId = req.params.id;
        const organizer = await Organizer.findByPk(organizerId, { include: ['account'] });
        
        if (!organizer) {
            return res.status(404).render('error', { title: 'Not Found', message: 'Organizer not found.' });
        }

        organizer.status = 'approved';
        await organizer.save();

        // Send Approval Email
        if (organizer.account && organizer.account.email) {
            try {
                const { sendEmail } = require('../../services/mailer');
                const mailText = `Congratulations ${organizer.name}!\n\nYour organizer account has been approved by the OhSee administrators. You can now log in and start creating events.\n\nWelcome to the platform!`;
                const mailHtml = `
                    <div style="font-family: sans-serif; color: #333;">
                        <h2 style="color: #1DA1F2;">Account Approved!</h2>
                        <p>Hello <strong>${organizer.name}</strong>,</p>
                        <p>We are happy to inform you that your organizer account on <strong>OhSee</strong> has been <strong>approved</strong>.</p>
                        <p>You can now log in to the organizer portal using your credentials and start publishing events.</p>
                        <div style="margin: 20px 0;">
                            <a href="${process.env.BASE_URL || 'http://localhost:3000'}/organizer/login" style="background: #1DA1F2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Login to Portal</a>
                        </div>
                        <p>Welcome aboard!</p>
                    </div>
                `;
                await sendEmail(organizer.account.email, 'Account Approved - OhSee Organizer', mailText, mailHtml);
            } catch (mailErr) {
                console.error('Approval email error:', mailErr);
            }
        }

        res.redirect('/admin/organizers?approved=true');
    } catch (error) {
        console.error('Approve organizer error:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

// Reject organizer
router.post('/organizers/:id/reject', async (req, res) => {
    try {
        const organizerId = req.params.id;
        const organizer = await Organizer.findByPk(organizerId);
        
        if (!organizer) {
            return res.status(404).render('error', { title: 'Not Found', message: 'Organizer not found.' });
        }

        organizer.status = 'rejected';
        await organizer.save();

        res.redirect('/admin/organizers?rejected=true');
    } catch (error) {
        console.error('Reject organizer error:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

// Delete organizer
router.post('/organizers/:id/delete', async (req, res) => {
    try {
        const organizerId = req.params.id;
        const organizer = await Organizer.findByPk(organizerId);
        
        if (!organizer) {
            return res.status(404).render('error', { title: 'Not Found', message: 'Organizer not found.' });
        }

        await sequelize.transaction(async (transaction) => {
            // Delete associated user account
            await AppUser.destroy({
                where: { id: organizer.user_id },
                transaction
            });
            // Delete organizer profile
            await Organizer.destroy({
                where: { id: organizerId },
                transaction
            });
        });

        res.redirect('/admin/organizers');
    } catch (error) {
        console.error('Delete organizer error:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

// Moderation of Events
router.get('/events', async (req, res) => {
    try {
        let events;
        try {
            events = await Event.findAll({ include: ['category', 'organizer'] });
        } catch (e) {
             events = await Event.findAll({
                include: [
                    { model: Category, as: 'category', required: false },
                    { model: Organizer, as: 'organizer', required: false }
                ]
             });
        }
        res.render('admin/events', {
            title: 'Event Moderation | Admin',
            events,
            currentPath: '/admin/events'
        });
    } catch (error) {
        console.error('Admin Events error:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

// Admin Event Details
router.get('/events/:id', async (req, res) => {
    try {
        const eventId = req.params.id;
        const event = await Event.findByPk(eventId, {
            include: [
                { model: Category, as: 'category' },
                { model: Organizer, as: 'organizer' }
            ]
        });

        if (!event) {
            return res.status(404).render('error', { title: 'Not Found', message: 'Event not found.' });
        }

        res.render('admin/event_details', {
            title: `${event.title || event.name} | Admin`,
            event,
            currentPath: '/admin/events'
        });
    } catch (error) {
        console.error('Admin Event Details error:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

router.get('/activity', async (req, res) => {
    try {
        const { EventSystemActivityLog, Organizer } = require('../../models');
        let activities = [];
        if (EventSystemActivityLog) {
            activities = await EventSystemActivityLog.findAll({
                include: [{ model: Organizer, as: 'organizer_actor', attributes: ['id', 'name'] }],
                order: [['occurred_at', 'DESC']]
            });
        }
        res.render('admin/activity', {
            title: 'Activity Log | Admin',
            currentPath: '/admin/activity',
            activities
        });
    } catch (error) {
        console.error('Admin Activity error:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

// Mark activity as read
router.post('/activity/:id/read', async (req, res) => {
    try {
        const { EventSystemActivityLog } = require('../../models');
        if (EventSystemActivityLog) {
            await EventSystemActivityLog.update({ is_read: true }, { where: { id: req.params.id } });
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Mark read error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/reports', async (req, res) => {
    try {
        res.render('admin/report', {
            title: 'Reports | Admin',
            currentPath: '/admin/reports'
        });
    } catch (error) {
        console.error('Admin Reports error:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

module.exports = router;