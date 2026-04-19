const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const router = express.Router();
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
        const [totalEvents, totalCategories, totalUsers, totalOrganizers] = await Promise.all([
            Event.count(),
            Category.count(),
            AppUser.count(),
            Organizer.count()
        ]);

        res.render('admin/dashboard', {
            title: 'Admin Dashboard | Masbate City',
            totalEvents,
            totalCategories,
            totalUsers,
            totalOrganizers,
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
                average_rating: safeRating
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
        res.render('admin/activity', {
            title: 'Activity Log | Admin',
            currentPath: '/admin/activity'
        });
    } catch (error) {
        console.error('Admin Activity error:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

router.get('/reports', async (req, res) => {
    try {
        res.render('admin/reports', {
            title: 'Reports | Admin',
            currentPath: '/admin/reports'
        });
    } catch (error) {
        console.error('Admin Reports error:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

module.exports = router;
