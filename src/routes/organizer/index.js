const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const router = express.Router();
const { Event, Category, Nodes, Organizer, AppUser, EventAttendee, EventAnalytics, EventAnnouncement, EventPhoto } = require('../../models');
const { sendEmail } = require('../../services/mailer');
const { upload, uploadBufferToCloudinary } = require('../../services/cloudinary'); // Import uploadBufferToCloudinary function

// Create memory storage for temporary file handling
const memoryStorage = multer.memoryStorage();

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
        
        const { Op } = require('sequelize');
        const { OrganizerNotification, NodeVisitAnalytics } = require('../../models');

        // Check for events ending soon (within 30 mins) to notify organizer
        const thirtyMinsFromNow = new Date(Date.now() + 30 * 60 * 1000);
        const endingSoonEvents = await Event.findAll({
            where: {
                organizer_id: organizer.id,
                is_ongoing: true,
                end_time: {
                    [Op.lte]: thirtyMinsFromNow,
                    [Op.gt]: new Date()
                }
            }
        });

        for (const ev of endingSoonEvents) {
            // Ensure no duplicate 'ending_soon' notif exists for this event recently
            const existingNotif = await OrganizerNotification.findOne({
                where: {
                    organizer_id: organizer.id,
                    event_id: ev.id,
                    type: 'ending_soon',
                    created_at: { [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                }
            });

            if (!existingNotif) {
                await OrganizerNotification.create({
                    organizer_id: organizer.id,
                    event_id: ev.id,
                    type: 'ending_soon',
                    message: `Heads up! Your event "${ev.title}" is coming to an end soon.`
                });
            }
        }

        const [totalMyEvents, activeEventsCount, events, activeEventsList, upcomingEventsList, unreadNotifs] = await Promise.all([
            Event.count({ where: { organizer_id: organizer.id } }),
            Event.count({ where: { organizer_id: organizer.id, is_ongoing: true } }),
            Event.findAll({ where: { organizer_id: organizer.id }, attributes: ['id', 'title', 'status', 'is_ongoing', 'start_time', 'capacity'], order: [['start_time', 'ASC']] }),
            Event.findAll({ where: { organizer_id: organizer.id, is_ongoing: true }, order: [['start_time', 'ASC']] }),
            Event.findAll({ where: { organizer_id: organizer.id, status: 'published', is_ongoing: false }, order: [['start_time', 'ASC']], limit: 5 }),
            OrganizerNotification.findAll({
                where: { organizer_id: organizer.id, is_read: false },
                order: [['created_at', 'DESC']],
                limit: 10
            })
        ]);

        // Compute metrics
        let totalRSVP = 0;
        let totalActual = 0;
        let activeEventIds = activeEventsList.map(e => e.id);
        let livePathHits = 0; // node_id was removed from events, so this remains 0 for now
        let entryVelocity = 0;

        for (const ev of activeEventsList) {
            if (ev.capacity && ev.capacity > 0) totalRSVP += ev.capacity;
            
            // Get actual attendees
            const attendeeCount = await EventAttendee.count({ where: { event_id: ev.id, status: 'attending' } });
            totalActual += attendeeCount;

            // Get live A* path hits from node visit analytics? There is no node_id in event. 
            // Query event_analytics for scan_count and views?
            const analytics = await EventAnalytics.findOne({ where: { event_id: ev.id } });
            if (analytics) {
                livePathHits += analytics.scan_count || 0;
                livePathHits += analytics.view_count_360 || 0;
            }

            // check entry velocity: attendees checked in the last hour
            const recentAttendees = await EventAttendee.count({
                where: {
                    event_id: ev.id,
                    status: 'attending',
                    check_in_time: {
                        [Op.gte]: new Date(Date.now() - 60 * 60 * 1000)
                    }
                }
            });
            entryVelocity += recentAttendees;
        }
        
        // Ensure some defaults if 0 RSVP
        if (totalRSVP === 0 && activeEventsList.length > 0) totalRSVP = 200;

        const eventsByStatus = { upcoming: 0, ongoing: 0, completed: 0, cancelled: 0 };
        const eventsPerMonth = Array(12).fill(0);
        
        events.forEach(e => {
            if (e.is_ongoing) {
                eventsByStatus.ongoing++;
            } else if (e.status === 'published' || e.status === 'draft') {
                eventsByStatus.upcoming++;
            } else if (e.status === 'completed') {
                eventsByStatus.completed++;
            } else if (e.status === 'cancelled') {
                eventsByStatus.cancelled++;
            }
            if (e.start_time) {
                const month = new Date(e.start_time).getMonth();
                eventsPerMonth[month]++;
            }
        });

        // Generate activity feed from notifications
        let activityFeed = unreadNotifs.map(n => {
            let color = 'bg-brand';
            if (n.type === 'comment') color = 'bg-blue-500';
            else if (n.type === 'like') color = 'bg-pink-500';
            else if (n.type === 'visit') color = 'bg-emerald-500';
            else if (n.type === 'ending_soon') color = 'bg-yellow-500';

            return {
                id: n.id,
                eventName: n.type.toUpperCase(),
                message: n.message,
                time: new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                color,
                eventId: n.event_id,
                type: n.type
            };
        });

        // Fallback feed
        if (activityFeed.length === 0) {
            if (activeEventsList.length > 0) {
                 activityFeed = activeEventsList.slice(0, 2).map(e => ({
                    eventName: e.title,
                    message: `Monitoring active event`,
                    time: 'Just Now',
                    color: 'bg-emerald-500',
                    eventId: e.id,
                    type: 'monitoring'
                 }));
            } else {
                 activityFeed = [
                    { eventName: 'System', message: 'Ready for new events', time: 'Just Now', color: 'bg-emerald-500', eventId: null, type: 'system' }
                ];
            }
        }

        res.render('organizer/dashboard', {
            title: 'Organizer Dashboard | Masbate City',
            organizer,
            totalMyEvents,
            activeEvents: activeEventsCount,
            activeEventsList,
            upcomingEventsList,
            activityFeed: activityFeed.slice(0, 5),
            eventsByStatus: JSON.stringify(eventsByStatus),
            eventsPerMonth: JSON.stringify(eventsPerMonth),
            dashboardMetrics: {
                entryVelocity,
                livePathHits,
                totalRSVP,
                totalActual,
                alerts: unreadNotifs.length
            }
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
        const { Op } = require('sequelize');
        
        const totalEvents = await Event.count({ where: { organizer_id: organizerId } });
        const activeEvents = await Event.count({ where: { organizer_id: organizerId, is_ongoing: true } });
        const finishedEvents = await Event.count({
            where: { organizer_id: organizerId, [Op.or]: [{status: 'completed'}, {is_ongoing: false}] }
        });

        const eventsWithTags = await Event.findAll({
            where: { organizer_id: organizerId },
            attributes: ['tags']
        });
        
        let tagCounts = {};
        eventsWithTags.forEach(e => {
            if (e.tags) {
                let eventTags = e.tags.split(',').map(tag => tag.trim()).filter(t => t);
                eventTags.forEach(tag => {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                });
            }
        });

        // Top 5 or 10 tags
        const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
        const tagLabels = sortedTags.map(t => t[0]);
        const tagData = sortedTags.map(t => t[1]);
        
        res.render('organizer/analytics', {
            title: 'Analytics | Organizer',
            totalEvents,
            activeEvents,
            finishedEvents,
            tagLabels: JSON.stringify(tagLabels),
            tagData: JSON.stringify(tagData)
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
router.post('/events/add', requireOrganizerAuth, multer({ storage: memoryStorage }).single('image'), async (req, res) => {
    try {
        const organizerId = req.session.organizerAuth.organizerId;
        const { title, description, venue, event_date, end_date, start_time, end_time, capacity, category_id, tags, latitude, longitude, recurrence_type, recurrence_end_date, day_of_week, day_of_month } = req.body;
        
        console.log("FILES IN ADD EVENT:", req.file);

        let image_url = null;
        if (req.file && req.file.buffer) {
            image_url = await uploadBufferToCloudinary(req.file.buffer, 'campus-navigator/event-posters');
        }
        
        let tagsToSave = null;
        if (tags) {
            // multer might return a string or an array depending on how many checkboxes are selected
            tagsToSave = Array.isArray(tags) ? tags.join(', ') : tags;
        }

        let calculatedEventDate = event_date;
        let finalEndDate = end_date && end_date.trim() ? end_date : event_date;

        if (recurrence_type === 'daily') {
            calculatedEventDate = new Date().toISOString().split('T')[0];
            finalEndDate = calculatedEventDate;
        } else if (recurrence_type === 'weekly' && day_of_week !== undefined) {
            const targetDay = parseInt(day_of_week, 10);
            const today = new Date();
            let daysUntilNext = targetDay - today.getDay();
            if (daysUntilNext < 0) daysUntilNext += 7;
            const nextDate = new Date(today.getTime() + daysUntilNext * 24 * 60 * 60 * 1000);
            calculatedEventDate = nextDate.toISOString().split('T')[0];
            finalEndDate = calculatedEventDate;
        } else if (recurrence_type === 'monthly' && day_of_month !== undefined) {
            const targetDay = parseInt(day_of_month, 10);
            const today = new Date();
            let nextDate = new Date(today.getFullYear(), today.getMonth(), targetDay);
            if (nextDate < today) {
                // If the target day has already passed this month, move to next month
                nextDate = new Date(today.getFullYear(), today.getMonth() + 1, targetDay);
            }
            // Handle edge case where month doesn't have the target day (e.g. Feb 30)
            if (nextDate.getDate() !== targetDay) {
                // It rolled over, so set to last day of the intended month
                nextDate = new Date(nextDate.getFullYear(), nextDate.getMonth(), 0);
            }
            calculatedEventDate = nextDate.toISOString().split('T')[0];
            finalEndDate = calculatedEventDate;
        }

        await Event.create({
            title,
            description: description || null,
            venue,
            event_date: calculatedEventDate,
            end_date: finalEndDate,
            start_time,
            end_time,
            image_url,
            capacity: capacity ? parseInt(capacity, 10) : null,
            category_id: category_id ? parseInt(category_id, 10) : null,
            tags: tagsToSave,
            latitude: latitude ? parseFloat(latitude) : null,
            longitude: longitude ? parseFloat(longitude) : null,
            organizer_id: organizerId,
            status: 'published',
            is_ongoing: true,
            recurrence_type: recurrence_type === 'once' ? 'none' : (recurrence_type || 'none'),
            recurrence_end_date: recurrence_end_date && recurrence_type !== 'once' && recurrence_type !== 'none' ? recurrence_end_date : null
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
            include: ['category', { model: EventAnnouncement, as: 'announcements', required: false, order: [['created_at', 'DESC']] }]
        });
        
        if (!event) {
            return res.status(404).render('error', { title: 'Not Found', message: 'Event not found or unauthorized' });
        }
        
        // ensure announcements array is sorted descending
        if (event.announcements) {
            event.announcements.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        } else {
            event.announcements = [];
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

// Post Announcement
router.post('/events/:id/announcement', requireOrganizerAuth, async (req, res) => {
    try {
        const organizerId = req.session.organizerAuth.organizerId;
        const event = await Event.findOne({ 
            where: { id: req.params.id, organizer_id: organizerId }
        });
        
        if (!event) {
            return res.status(404).send('Event not found or unauthorized');
        }

        const { title, body } = req.body;
        if (!title || !body) {
            return res.status(400).send('Title and body required');
        }

        await EventAnnouncement.create({
            event_id: event.id,
            title,
            body
        });

        res.redirect(`/organizer/events/${event.id}?tab=announcement`);
    } catch (error) {
        console.error('Post announcement error:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

// Upload Photo to Gallery
router.post('/events/:id/photos', requireOrganizerAuth, multer({ storage: memoryStorage }).array('photos', 10), async (req, res) => {
    try {
        const organizerId = req.session.organizerAuth.organizerId;
        const event = await Event.findOne({ 
            where: { id: req.params.id, organizer_id: organizerId }
        });
        
        if (!event) {
            return res.status(404).send('Event not found or unauthorized');
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).send('At least one photo is required');
        }

        console.log('Processing', req.files.length, 'files');

        const photoPromises = req.files.map(async (file) => {
            try {
                // Upload file buffer directly to Cloudinary using upload stream
                const cloudinaryUrl = await uploadBufferToCloudinary(file.buffer, 'campus-navigator/event-photos');
                
                console.log('Uploaded to Cloudinary:', cloudinaryUrl);

                return EventPhoto.create({
                    event_id: event.id,
                    image_url: cloudinaryUrl
                });
            } catch (uploadError) {
                console.error('Error uploading single file:', uploadError);
                throw uploadError;
            }
        });

        const results = await Promise.all(photoPromises);
        console.log('Saved', results.length, 'photos to database');

        res.redirect(`/organizer/events/${event.id}?tab=gallery`);
    } catch (error) {
        console.error('Upload photo error:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

// Edit Event GET
router.get('/events/:id/edit', requireOrganizerAuth, async (req, res) => {
    try {
        const organizerId = req.session.organizerAuth.organizerId;
        const event = await Event.findOne({ 
            where: { id: req.params.id, organizer_id: organizerId }
        });
        
        if (!event) {
            return res.status(404).render('error', { title: 'Not Found', message: 'Event not found' });
        }

        const categories = await Category.findAll();
        
        res.render('organizer/add_event', {
            title: 'Edit Event | Organizer',
            event,
            categories
        });
    } catch (error) {
        console.error('Edit event view error:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

// Update Event
router.post('/events/:id/update', requireOrganizerAuth, multer({ storage: memoryStorage }).single('image'), async (req, res) => {
    try {
        const organizerId = req.session.organizerAuth.organizerId;
        const event = await Event.findOne({ 
            where: { id: req.params.id, organizer_id: organizerId }
        });
        
        if (!event) {
            return res.status(404).render('error', { title: 'Not Found', message: 'Event not found' });
        }
        
        const { title, description, venue, event_date, end_date, start_time, end_time, capacity, category_id, is_ongoing, tags, latitude, longitude, recurrence_type, recurrence_end_date, day_of_week, day_of_month } = req.body;
        
        let tagsToSave = event.tags;
        if (tags !== undefined) {
            tagsToSave = Array.isArray(tags) ? tags.join(', ') : tags;
        }

        let calculatedEventDate = event_date || event.event_date;
        let finalEndDate = end_date && end_date.trim() ? end_date : calculatedEventDate;

        if (recurrence_type && recurrence_type !== 'once' && recurrence_type !== 'none') {
            if (recurrence_type === 'daily') {
                calculatedEventDate = new Date().toISOString().split('T')[0];
                finalEndDate = calculatedEventDate;
            } else if (recurrence_type === 'weekly' && day_of_week !== undefined) {
                const targetDay = parseInt(day_of_week, 10);
                const today = new Date();
                let daysUntilNext = targetDay - today.getDay();
                if (daysUntilNext < 0) daysUntilNext += 7;
                const nextDate = new Date(today.getTime() + daysUntilNext * 24 * 60 * 60 * 1000);
                calculatedEventDate = nextDate.toISOString().split('T')[0];
                finalEndDate = calculatedEventDate;
            } else if (recurrence_type === 'monthly' && day_of_month !== undefined) {
                const targetDay = parseInt(day_of_month, 10);
                const today = new Date();
                let nextDate = new Date(today.getFullYear(), today.getMonth(), targetDay);
                if (nextDate < today) {
                    nextDate = new Date(today.getFullYear(), today.getMonth() + 1, targetDay);
                }
                if (nextDate.getDate() !== targetDay) {
                    nextDate = new Date(nextDate.getFullYear(), nextDate.getMonth(), 0);
                }
                calculatedEventDate = nextDate.toISOString().split('T')[0];
                finalEndDate = calculatedEventDate;
            }
        }
        
        const updateData = {
            title: title || event.title,
            name: title || event.name,
            description: description !== undefined ? description : event.description,
            venue: venue || event.venue,
            event_date: calculatedEventDate,
            end_date: finalEndDate,
            start_time: start_time || event.start_time,
            end_time: end_time || event.end_time,
            is_ongoing: is_ongoing === 'true' || is_ongoing === 'on' || is_ongoing === '1',
            tags: tagsToSave,
            recurrence_type: recurrence_type === 'once' ? 'none' : (recurrence_type || event.recurrence_type),
            recurrence_end_date: recurrence_end_date && recurrence_type !== 'once' && recurrence_type !== 'none' ? recurrence_end_date : null
        };

        if (capacity) updateData.capacity = parseInt(capacity, 10);
        if (category_id) updateData.category_id = parseInt(category_id, 10);
        if (latitude) updateData.latitude = parseFloat(latitude);
        if (longitude) updateData.longitude = parseFloat(longitude);
        
        if (req.file && req.file.buffer) {
            updateData.image_url = await uploadBufferToCloudinary(req.file.buffer, 'campus-navigator/event-posters');
        }

        await event.update(updateData);
        res.redirect(`/organizer/events/${event.id}`);
    } catch (error) {
        console.error('Update event error:', error);
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
// Notification Read Endpoint
router.post('/notifications/:id/read', requireOrganizerAuth, async (req, res) => {
    try {
        const notif = await OrganizerNotification.findOne({
            where: {
                id: req.params.id,
                organizer_id: req.organizer.id
            }
        });
        
        if (notif) {
            await notif.update({ is_read: true });
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Notification not found' });
        }
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: 'Failed to update notification' });
    }
});

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


// Organizer Account Details Route
router.get('/account', requireOrganizerAuth, async (req, res) => {
    try {
        const organizerId = req.session.organizerAuth.organizerId;
        const organizer = await Organizer.findByPk(organizerId, { 
            include: [{ model: AppUser, as: 'account' }] 
        });
        
        if (!organizer) {
            return res.redirect('/organizer/login');
        }

        res.render('organizer/account_details', {
            title: 'Account Details | Organizer',
            organizer,
            sessionAuth: req.session.organizerAuth
        });
    } catch (error) {
        console.error('Error loading account details:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

// Organizer Account Updates
router.post('/account/update', requireOrganizerAuth, async (req, res) => {
    try {
        const organizerId = req.session.organizerAuth.organizerId;
        const { first_name, last_name, name, description } = req.body;

        const organizer = await Organizer.findByPk(organizerId, { 
            include: [{ model: AppUser, as: 'account' }] 
        });

        if (!organizer) {
            return res.redirect('/organizer/login');
        }

        // Update AppUser
        if (organizer.account) {
            organizer.account.first_name = first_name || organizer.account.first_name;
            organizer.account.last_name = last_name || organizer.account.last_name;
            await organizer.account.save();
        }

        // Update Organizer details
        organizer.name = name || organizer.name;
        organizer.description = description !== undefined ? description : organizer.description;
        await organizer.save();

        // Update session name if it changed
        req.session.organizerAuth.organizerName = organizer.name;

        res.redirect('/organizer/profile?updated=true');
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).render('error', { title: 'Error', message: 'Failed to update profile.' });
    }
});

// Organizer Profile Page
router.get('/profile', requireOrganizerAuth, async (req, res) => {
    try {
        const organizerId = req.session.organizerAuth.organizerId;
        const organizer = await Organizer.findByPk(organizerId, { 
            include: [{ model: AppUser, as: 'account', attributes: ['email', 'first_name', 'last_name'] }] 
        });
        if (!organizer) {
            return res.redirect('/organizer/login');
        }
        res.render('organizer/profile', {
            title: 'Organizer Profile | Masbate City',
            organizer,
            sessionAuth: req.session.organizerAuth
        });
    } catch (error) {
        console.error('Error loading profile page:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

// Organizer Notifications Page
router.get('/notifications', requireOrganizerAuth, async (req, res) => {
    try {
        res.render('organizer/notifications', {
            title: 'Notifications | Organizer',
            sessionAuth: req.session.organizerAuth
        });
    } catch (error) {
        console.error('Error loading notifications page:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

// Organizer Notifications Updates (Placeholder)
router.post('/notifications/update', requireOrganizerAuth, async (req, res) => {
    try {
        // Will add preferences to db later if needed, for now just update memory/session
        res.redirect('/organizer/profile?updated=true');
    } catch (error) {
        console.error('Error updating notifications:', error);
        res.status(500).render('error', { title: 'Error', message: 'Failed to update notification settings.' });
    }
});

// Organizer Security Page
router.get('/security', requireOrganizerAuth, async (req, res) => {
    try {
        res.render('organizer/security', {
            title: 'Security | Organizer',
            sessionAuth: req.session.organizerAuth
        });
    } catch (error) {
        console.error('Error loading security page:', error);
        res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

// Organizer Security Updates (Password Change)
router.post('/security/update', requireOrganizerAuth, async (req, res) => {
    try {
        const appUserId = req.session.organizerAuth.appUserId;
        const { current_password, new_password, confirm_password } = req.body;

        if (new_password !== confirm_password) {
            return res.status(400).render('error', { title: 'Error', message: 'Passwords do not match.' });
        }

        const account = await AppUser.findByPk(appUserId);
        if (!account) return res.redirect('/organizer/login');

        const isValid = await bcrypt.compare(current_password, account.password_hash);
        if (!isValid) {
            return res.status(400).render('error', { title: 'Error', message: 'Incorrect current password.' });
        }

        account.password_hash = await bcrypt.hash(new_password, 10);
        await account.save();

        res.redirect('/organizer/profile?updated=true');
    } catch (error) {
        console.error('Error updating password:', error);
        res.status(500).render('error', { title: 'Error', message: 'Failed to update security settings.' });
    }
});

module.exports = router;
