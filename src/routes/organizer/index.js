const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { Event, Category, Nodes, Organizer, AppUser, EventAttendee, EventAnalytics } = require('../../models');
const { sendEmail } = require('../../services/mailer');
const { upload } = require('../../services/cloudinary'); // Changed to this based on standard template

const requireOrganizerAuth = (req, res, next) => {
    if (!req.session.organizerAuth || !req.session.organizerAuth.organizerId) {
        return res.redirect('/organizer/login');
    }
    return next();
};

// Redirect /organizer to /organizer/dashboard
router.get('/', (req, res) => {
    if (req.session.organizerAuth && req.session.organizerAuth.organizerId) {
        return res.redirect('/organizer/dashboard');
    }
    return res.redirect('/organizer/login');
});

// Organizer login view
router.get('/login', (req, res) => {
    if (req.session.organizerAuth && req.session.organizerAuth.organizerId) {
        return res.redirect('/organizer/dashboard');
    }

    return res.render('organizer/login', {
        title: 'Organizer Login'
    });
});

// Organizer login submit
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).render('error', {
                title: 'Login Error',
                message: 'Email and password are required.'
            });
        }

        const account = await AppUser.findOne({
            where: { email: email.trim().toLowerCase() }
        });

        if (!account) {
            return res.status(401).render('error', {
                title: 'Login Failed',
                message: 'Invalid email or password.'
            });
        }

        const isValid = await bcrypt.compare(password, account.password_hash);
        if (!isValid) {
            return res.status(401).render('error', {
                title: 'Login Failed',
                message: 'Invalid email or password.'
            });
        }

        const organizer = await Organizer.findOne({ where: { user_id: account.id } });
        if (!organizer) {
            return res.status(403).render('error', {
                title: 'Access Denied',
                message: 'This account is not linked to an organizer profile.'
            });
        }

        req.session.organizerAuth = {
            appUserId: account.id,
            organizerId: organizer.id,
            organizerName: organizer.name,
            email: account.email
        };

        return res.redirect('/organizer/dashboard');
    } catch (error) {
        console.error('Organizer login error:', error);
        return res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

// Organizer logout
router.post('/logout', requireOrganizerAuth, (req, res) => {
    req.session.organizerAuth = null;
    return res.redirect('/organizer/login');
});

// Organizer Dashboard
router.get('/dashboard', requireOrganizerAuth, async (req, res) => {
    try {
        const organizer = await Organizer.findByPk(req.session.organizerAuth.organizerId);
        if (!organizer) {
            req.session.organizerAuth = null;
            return res.redirect('/organizer/login');
        }
        
        const [totalMyEvents, activeEvents, events] = await Promise.all([
            Event.count({ where: { organizer_id: organizer.id } }),
            Event.count({ where: { organizer_id: organizer.id, is_ongoing: true } }),
            Event.findAll({ where: { organizer_id: organizer.id }, attributes: ['status', 'start_time'], order: [['start_time', 'ASC']] })
        ]);

        const eventsByStatus = { upcoming: 0, ongoing: 0, completed: 0, cancelled: 0 };
        const eventsPerMonth = Array(12).fill(0);
        
        events.forEach(e => {
            if (eventsByStatus[e.status] !== undefined) {
                eventsByStatus[e.status]++;
            }
            if (e.start_time) {
                const month = new Date(e.start_time).getMonth();
                eventsPerMonth[month]++;
            }
        });

        res.render('organizer/dashboard', {
            title: 'Organizer Dashboard | Masbate City',
            organizer,
            totalMyEvents,
            activeEvents,
            eventsByStatus: JSON.stringify(eventsByStatus),
            eventsPerMonth: JSON.stringify(eventsPerMonth)
        });
    } catch (error) {
        console.error('Organizer Dashboard error:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

// Analytics Page
router.get('/analytics', requireOrganizerAuth, async (req, res) => {
    try {
        const organizerId = req.session.organizerAuth.organizerId;
        
        const totalEvents = await Event.count({ where: { organizer_id: organizerId } });
        const activeEvents = await Event.count({ where: { organizer_id: organizerId, is_ongoing: true } });
        
        res.render('organizer/analytics', {
            title: 'Analytics | Organizer',
            totalEvents,
            activeEvents
        });
    } catch (error) {
        console.error('Error loading analytics page:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

// Manage Planner's Events
router.get('/events', requireOrganizerAuth, async (req, res) => {
    try {
        const organizerId = req.session.organizerAuth.organizerId;
        const events = await Event.findAll({ 
            where: { organizer_id: organizerId },
            include: ['category']
        });
        
        res.render('organizer/events', {
            title: 'My Events | Organizer',
            events
        });
    } catch (error) {
        console.error('Organizer Events error:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

// Add Event View
router.get('/events/add', requireOrganizerAuth, async (req, res) => {
    try {
        const categories = await Category.findAll();
        res.render('organizer/add_event', {
            title: 'Add Event | Organizer',
            categories
        });
    } catch (error) {
        console.error('Add event view error:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

// Process Add Event
router.post('/events/add', requireOrganizerAuth, upload.single('image'), async (req, res) => {
    try {
        const organizerId = req.session.organizerAuth.organizerId;
        const { title, description, venue, event_date, start_time, end_time, capacity, category_id, latitude, longitude } = req.body;
        
        let image_url = null;
        if (req.file) {
            image_url = req.file.path; // from cloudinary or multer
        }
        
        await Event.create({
            title,
            description,
            venue,
            event_date,
            start_time,
            end_time,
            image_url,
            capacity: capacity || null,
            category_id: category_id || null,
            latitude: latitude || null,
            longitude: longitude || null,
            organizer_id: organizerId,
            status: 'published',
            is_ongoing: false
        });
        
        res.redirect('/organizer/events');
    } catch (error) {
        console.error('Add event error:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

// Organizer Event Details
router.get('/events/:id', requireOrganizerAuth, async (req, res) => {
    try {
        const organizerId = req.session.organizerAuth.organizerId;
        const event = await Event.findOne({ 
            where: { id: req.params.id, organizer_id: organizerId },
            include: ['category']
        });
        
        if (!event) {
            return res.status(404).render('error', { title: 'Not Found', message: 'Event not found or unauthorized' });
        }
        
        res.render('organizer/event_details', {
            title: 'Event Details | Organizer',
            event
        });
    } catch (error) {
        console.error('Organizer Event details error:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

// Get Event Attendees
router.get('/events/:id/attendees', requireOrganizerAuth, async (req, res) => {
    try {
        const organizerId = req.session.organizerAuth.organizerId;
        const event = await Event.findOne({ 
            where: { id: req.params.id, organizer_id: organizerId } 
        });
        
        if (!event) return res.status(404).json({ error: 'Event not found' });

        const attendees = await EventAttendee.findAll({
            where: { event_id: event.id },
            include: [{ model: AppUser, as: 'user', attributes: ['id', 'first_name', 'last_name', 'email'] }]
        });
        
        res.json({ attendees });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Bulk Actions on Events
router.post('/events/bulk-action', requireOrganizerAuth, async (req, res) => {
    try {
        const organizerId = req.session.organizerAuth.organizerId;
        const { action, eventIds } = req.body;

        if (!Array.isArray(eventIds) || eventIds.length === 0) {
            return res.status(400).json({ error: 'No events selected' });
        }

        // Verify ownership
        const events = await Event.findAll({
            where: { id: eventIds, organizer_id: organizerId }
        });

        if (events.length === 0) {
            return res.status(403).json({ error: 'Unauthorized or events not found' });
        }

        const validEventIds = events.map(e => e.id);

        if (action === 'delete') {
            await Event.destroy({ where: { id: validEventIds } });
        } else if (action === 'publish') {
            await Event.update({ status: 'published' }, { where: { id: validEventIds } });
        } else if (action === 'duplicate') {
            const newEvents = events.map(e => {
                const eventData = e.toJSON();
                delete eventData.id;
                eventData.title = `${eventData.title} (Copy)`;
                eventData.status = 'draft'; // Duplicates default to draft
                return eventData;
            });
            await Event.bulkCreate(newEvents);
        } else {
            return res.status(400).json({ error: 'Invalid action' });
        }

        res.json({ message: `Bulk ${action} successful`, success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Broadcast Message to Attendees
router.post('/events/:id/broadcast', requireOrganizerAuth, async (req, res) => {
    try {
        const organizerId = req.session.organizerAuth.organizerId;
        const { subject, message } = req.body;

        const event = await Event.findOne({ 
            where: { id: req.params.id, organizer_id: organizerId } 
        });

        if (!event) return res.status(404).json({ error: 'Event not found' });

        const attendees = await EventAttendee.findAll({
            where: { event_id: event.id },
            include: [{ model: AppUser, as: 'user' }]
        });

        if (attendees.length === 0) {
            return res.json({ message: 'No attendees to message', success: false });
        }

        const emails = attendees.map(a => a.user.email).filter(e => e);
        
        if (emails.length > 0) {
            // Trigger Mailer from previously created file
            await sendEmail(
                emails,
                `Update for ${event.title}: ${subject}`,
                message,
                `<p><strong>Message from Organizer of ${event.title}:</strong></p><p>${message.replace(/\\n/g, '<br>')}</p>`
            );
        }

        res.json({ message: `Broadcast sent to ${emails.length} attendees`, success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
