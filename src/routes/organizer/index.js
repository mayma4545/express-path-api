const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const router = express.Router();
const { sequelize, Event, Category, Nodes, Organizer, AppUser, EventAttendee, EventAnalytics, EventRating, EventBookmark, EventVisit, Comment, EventAnnouncement, EventPhoto, EventSystemActivityLog, OrganizerNotification, EventLike, CommentReaction, UserNotification, User, Sequelize } = require('../../models');
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

// Middleware to inject sessionAuth into all templates in this router
router.use((req, res, next) => {
    res.locals.sessionAuth = req.session.organizerAuth || null;
    next();
});

// Redirect /organizer to /organizer/dashboard
router.get('/', (req, res) => {
    if (req.session.adminAuth) {
        return res.redirect('/admin/dashboard');
    }
    if (req.session.organizerAuth && req.session.organizerAuth.organizerId) {
        return res.redirect('/organizer/dashboard');
    }
    return res.redirect('/organizer/login');
});

// Organizer signup view
router.get('/signup', (req, res) => {
    if (req.session.adminAuth) return res.redirect('/admin/dashboard');
    if (req.session.organizerAuth && req.session.organizerAuth.organizerId) {
        return res.redirect('/organizer/dashboard');
    }

    return res.render('organizer/signup', {
        title: 'Register as Organizer'
    });
});

// Organizer signup submit
router.post('/signup', async (req, res) => {
    try {
        const { name, email, password, address, description } = req.body;

        if (!name || !email || !password) {
            return res.status(400).render('error', {
                title: 'Registration Error',
                message: 'Name, Email and Password are required.'
            });
        }

        const emailValue = email.trim().toLowerCase();
        const existingAccount = await AppUser.findOne({ where: { email: emailValue } });
        
        if (existingAccount) {
            return res.status(409).render('error', {
                title: 'Duplicate Account',
                message: 'An account with that email already exists.'
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const nameParts = name.trim().split(' ');
        const first_name = nameParts[0] || 'Organizer';
        const last_name = nameParts.slice(1).join(' ') || 'Account';

        await sequelize.transaction(async (transaction) => {
            const appUser = await AppUser.create({
                first_name,
                last_name,
                email: emailValue,
                password_hash: passwordHash
            }, { transaction });

            await Organizer.create({
                user_id: appUser.id,
                name: name.trim(),
                address: address ? address.trim() : null,
                description: description ? description.trim() : null,
                status: 'pending'
            }, { transaction });
        });

        // Send "Under Review" email
        try {
            const mailText = `Hello ${name},\n\nThank you for registering as an organizer on OhSee. Your account is currently under review by our administrators. You will receive another email once your account has been approved.\n\nThank you for your patience!`;
            const mailHtml = `
                <div style="font-family: sans-serif; color: #333;">
                    <h2 style="color: #1DA1F2;">Registration Received!</h2>
                    <p>Hello <strong>${name}</strong>,</p>
                    <p>Thank you for registering as an organizer on <strong>OhSee</strong>.</p>
                    <p>Your account is currently <strong>under review</strong> by our administrators. This usually takes 24-48 hours.</p>
                    <p>You will receive another email notification once your account has been approved and you can start creating events.</p>
                    <br>
                    <p>Thank you for your patience!</p>
                </div>
            `;
            await sendEmail(emailValue, 'Account Under Review - OhSee Organizer', mailText, mailHtml);
        } catch (mailError) {
            console.error('Email sending error:', mailError);
        }

        return res.render('organizer/signup_success', {
            title: 'Registration Received',
            name: name.trim(),
            email: emailValue
        });
    } catch (error) {
        console.error('Organizer registration error:', error);
        return res.status(500).render('error', { title: 'Error', message: error.message });
    }
});

// Organizer login view
router.get('/login', (req, res) => {
    if (req.session.adminAuth) return res.redirect('/admin/dashboard');
    if (req.session.organizerAuth && req.session.organizerAuth.organizerId) {
        return res.redirect('/organizer/dashboard');
    }

    let error = req.query.error || null;
    if (error === 'admin_required') {
        error = 'Authentication required. Please login with your admin credentials.';
    }

    return res.render('organizer/login', {
        title: 'Organizer Login',
        error: error
    });
});

// Organizer login submit
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).render('error', {
                title: 'Login Error',
                message: 'Email/Username and password are required.'
            });
        }

        const identifier = email.trim().toLowerCase();

        // 1. Check for Admin Login (admin4545)
        if (identifier === 'admin4545') {
            const admin = await User.findOne({ where: { username: 'admin4545' } });
            if (admin) {
                const isValid = await bcrypt.compare(password, admin.password);
                if (isValid) {
                    req.session.adminAuth = {
                        userId: admin.id,
                        username: admin.username,
                        is_staff: admin.is_staff,
                        is_superuser: admin.is_superuser
                    };
                    return res.redirect('/admin/dashboard');
                }
            }
        }

        // 2. Regular Organizer Login
        const account = await AppUser.findOne({
            where: { email: identifier }
        });

        if (!account) {
            return res.render('organizer/login', {
                title: 'Organizer Login',
                error: 'Invalid email or password.'
            });
        }

        const isValid = await bcrypt.compare(password, account.password_hash);
        if (!isValid) {
            return res.render('organizer/login', {
                title: 'Organizer Login',
                error: 'Invalid email or password.'
            });
        }

        const organizer = await Organizer.findOne({ where: { user_id: account.id } });
        if (!organizer) {
            return res.render('organizer/login', {
                title: 'Organizer Login',
                error: 'This account is not linked to an organizer profile.'
            });
        }

        if (organizer.status === 'pending') {
            return res.render('organizer/login', {
                title: 'Organizer Login',
                error: 'Your account is currently under review by our administrators.'
            });
        }

        if (organizer.status === 'rejected') {
            return res.render('organizer/login', {
                title: 'Organizer Login',
                error: 'Your organizer account application has been rejected.'
            });
        }

        req.session.organizerAuth = {
            appUserId: account.id,
            organizerId: organizer.id,
            organizerName: organizer.name,
            email: account.email,
            avatarUrl: organizer.avatar_url
        };

        try {
            await EventSystemActivityLog.create({
                organizer_id: organizer.id,
                activity_type: 'LOGIN',
                target_type: 'System',
                target_id: account.id.toString(),
                metadata: { email: account.email }
            });
        } catch(e) { console.error('Log error', e); }

        return res.redirect('/organizer/dashboard?loginSuccess=true');
    } catch (error) {
        console.error('Organizer login error:', error);
        return res.render('organizer/login', { title: 'Organizer Login', error: 'An unexpected error occurred. Please try again.' });
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

        const [totalMyEvents, activeEventsCount, events, activeEventsList, upcomingEventsList, unreadNotifs, totalUnreadCount] = await Promise.all([
            Event.count({ where: { organizer_id: organizer.id } }),
            Event.count({ where: { organizer_id: organizer.id, is_ongoing: true } }),
            Event.findAll({ where: { organizer_id: organizer.id }, attributes: ['id', 'title', 'status', 'is_ongoing', 'start_time', 'capacity'], order: [['start_time', 'ASC']] }),
            Event.findAll({ where: { organizer_id: organizer.id, is_ongoing: true }, order: [['start_time', 'ASC']] }),
            Event.findAll({ where: { organizer_id: organizer.id, status: 'published', is_ongoing: false }, order: [['start_time', 'ASC']], limit: 5 }),
            OrganizerNotification.findAll({
                where: { organizer_id: organizer.id, is_read: false },
                order: [['created_at', 'DESC']]
            }),
            OrganizerNotification.count({
                where: { organizer_id: organizer.id, is_read: false }
            })
        ]);

        // Compute metrics
        const allOrganizerEvents = await Event.findAll({ 
            where: { organizer_id: organizer.id },
            attributes: ['id']
        });
        const allEventIds = allOrganizerEvents.map(e => e.id);

        let totalVisits = 0;
        let totalNavigationHits = 0;
        let totalRatingSum = 0;
        let totalRatingCount = 0;

        if (allEventIds.length > 0) {
            const [analyticsList, ratingsList] = await Promise.all([
                EventAnalytics.findAll({ where: { event_id: { [Op.in]: allEventIds } } }),
                EventRating.findAll({ where: { event_id: { [Op.in]: allEventIds } } })
            ]);

            analyticsList.forEach(a => {
                totalVisits += (a.page_view_count || 0);
                totalNavigationHits += (a.navigation_count || 0);
            });

            ratingsList.forEach(r => {
                totalRatingSum += r.rating;
                totalRatingCount++;
            });
        }

        const averageRating = totalRatingCount > 0 ? (totalRatingSum / totalRatingCount).toFixed(1) : "0.0";

        // Restore missing logic
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

        // Entry velocity (still useful to keep for "Recent Visit" context if needed, but user wants total)
        let entryVelocity = 0;
        for (const ev of activeEventsList) {
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
                totalVisits,
                navigationHits: totalNavigationHits,
                averageRating,
                totalRatingCount,
                alerts: totalUnreadCount,
                entryVelocity // keeping for fallback or additional context
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
        const { Event, EventAnalytics, EventRating, EventAttendee, EventLike, EventBookmark, Category } = require('../../models');
        
        // Basic stats
        const [totalEvents, activeEvents, finishedEvents] = await Promise.all([
            Event.count({ where: { organizer_id: organizerId } }),
            Event.count({ where: { organizer_id: organizerId, is_ongoing: true } }),
            Event.count({ where: { organizer_id: organizerId, [Op.or]: [{status: 'completed'}, {is_ongoing: false}] } })
        ]);

        // Aggregate Analytics
        const allEvents = await Event.findAll({
            where: { organizer_id: organizerId },
            include: [
                { model: EventAnalytics, as: 'analytics' },
                { model: EventRating, as: 'ratings' },
                { model: Category, as: 'category' },
                { model: AppUser, as: 'liked_by_users' },
                { model: EventBookmark, as: 'bookmarks' },
                { model: EventAttendee, as: 'attendees' },
                { model: Comment, as: 'comments' },
                { model: EventVisit, as: 'visits' }
            ]
        });

        let totalViews = 0;
        let totalScans = 0;
        let totalNavigations = 0;
        let totalRatingSum = 0;
        let totalRatingCount = 0;
        let totalLikes = 0;
        let totalBookmarks = 0;
        let totalAttendees = 0;
        let totalComments = 0;
        
        const ratingDistribution = [0, 0, 0, 0, 0];
        const categoryCounts = {};
        const eventPerformance = []; 

        allEvents.forEach(e => {
            if (e.category) {
                categoryCounts[e.category.name] = (categoryCounts[e.category.name] || 0) + 1;
            }

            if (e.analytics) {
                totalViews += (e.analytics.page_view_count || 0);
                totalScans += (e.analytics.scan_count || 0);
                totalNavigations += (e.analytics.navigation_count || 0);
            } else if (e.visits) {
                totalViews += e.visits.length;
            }

            totalLikes += (e.liked_by_users ? e.liked_by_users.length : 0);
            totalBookmarks += (e.bookmarks ? e.bookmarks.length : 0);
            totalComments += (e.comments ? e.comments.length : 0);
            
            const checkins = e.attendees ? e.attendees.filter(a => a.status === 'attending').length : 0;
            totalAttendees += checkins;

            eventPerformance.push({
                title: e.title,
                score: ((e.analytics?.page_view_count || 0) * 0.4) + (checkins * 0.6),
                views: e.analytics?.page_view_count || 0,
                checkins: checkins
            });

            if (e.ratings && e.ratings.length > 0) {
                e.ratings.forEach(r => {
                    totalRatingSum += r.rating;
                    totalRatingCount++;
                    if (r.rating >= 1 && r.rating <= 5) ratingDistribution[r.rating - 1]++;
                });
            }
        });

        // Top 5 Events by combined performance score
        const topEvents = eventPerformance
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);

        const avgRating = totalRatingCount > 0 ? (totalRatingSum / totalRatingCount).toFixed(1) : "0.0";
        const conversionRate = totalViews > 0 ? ((totalAttendees / totalViews) * 100).toFixed(1) : 0;

        res.render('organizer/analytics', {
            title: 'Intelligence Hub | Organizer',
            totalEvents,
            activeEvents,
            finishedEvents,
            metrics: {
                totalViews,
                totalScans,
                totalNavigations,
                avgRating,
                totalRatingCount,
                totalLikes,
                totalBookmarks,
                totalAttendees,
                totalComments,
                conversionRate
            },
            charts: {
                categoryLabels: JSON.stringify(Object.keys(categoryCounts)),
                categoryValues: JSON.stringify(Object.values(categoryCounts)),
                topEventsLabels: JSON.stringify(topEvents.map(te => te.title)),
                topEventsViews: JSON.stringify(topEvents.map(te => te.views)),
                topEventsCheckins: JSON.stringify(topEvents.map(te => te.checkins)),
                ratingDistribution: JSON.stringify(ratingDistribution)
            }
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
        
        try {
            await EventSystemActivityLog.create({
                organizer_id: organizerId,
                activity_type: 'CREATE_EVENT',
                target_type: 'Event',
                target_id: title,
                metadata: { title: title }
            });
        } catch(e) { console.error('Log error', e); }
        
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
            include: [
                'category', 
                { model: EventAnnouncement, as: 'announcements', required: false },
                { model: EventAnalytics, as: 'analytics', required: false },
                { model: EventBookmark, as: 'bookmarks', required: false }
            ]
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

// Delete Event
router.delete('/events/:id/delete', requireOrganizerAuth, async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const organizerId = req.session.organizerAuth.organizerId;
        const event = await Event.findOne({ 
            where: { id: req.params.id, organizer_id: organizerId },
            transaction: t
        });
        
        if (!event) {
            await t.rollback();
            return res.status(404).json({ success: false, message: 'Event not found or unauthorized' });
        }
        
        // Log the activity
        if (EventSystemActivityLog) {
            await EventSystemActivityLog.create({
                organizer_id: organizerId,
                activity_type: 'delete_event',
                target_type: 'event',
                target_id: event.id.toString(),
                metadata: { title: event.title }
            }, { transaction: t });
        }

        const eventId = event.id;

        // 1. Delete dependent data that directly references event_id
        await EventBookmark.destroy({ where: { event_id: eventId }, transaction: t });
        await EventLike.destroy({ where: { event_id: eventId }, transaction: t });
        await EventAttendee.destroy({ where: { event_id: eventId }, transaction: t });
        await EventAnalytics.destroy({ where: { event_id: eventId }, transaction: t });
        await EventRating.destroy({ where: { event_id: eventId }, transaction: t });
        await EventVisit.destroy({ where: { event_id: eventId }, transaction: t });
        await EventPhoto.destroy({ where: { event_id: eventId }, transaction: t });
        await EventAnnouncement.destroy({ where: { event_id: eventId }, transaction: t });
        await OrganizerNotification.destroy({ where: { event_id: eventId }, transaction: t });
        await UserNotification.destroy({ where: { event_id: eventId }, transaction: t });

        // 2. Handle comments (and their reactions)
        const comments = await Comment.findAll({ 
            where: { event_id: eventId }, 
            attributes: ['id'],
            transaction: t 
        });
        const commentIds = comments.map(c => c.id);
        if (commentIds.length > 0) {
            // Delete reactions to these comments
            await CommentReaction.destroy({ 
                where: { comment_id: commentIds }, 
                transaction: t 
            });
            // Delete the comments themselves (including replies since they also have event_id)
            await Comment.destroy({ 
                where: { event_id: eventId }, 
                transaction: t 
            });
        }

        // 3. Finally delete the event
        await event.destroy({ transaction: t });
        
        await t.commit();
        res.json({ success: true, message: 'Event deleted successfully' });
    } catch (error) {
        if (t) await t.rollback();
        console.error('Delete event error:', error);
        res.status(500).json({ success: false, message: error.message });
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
            await sequelize.transaction(async (t) => {
                // Delete all dependent data for all selected events
                await EventBookmark.destroy({ where: { event_id: validEventIds }, transaction: t });
                await EventLike.destroy({ where: { event_id: validEventIds }, transaction: t });
                await EventAttendee.destroy({ where: { event_id: validEventIds }, transaction: t });
                await EventAnalytics.destroy({ where: { event_id: validEventIds }, transaction: t });
                await EventRating.destroy({ where: { event_id: validEventIds }, transaction: t });
                await EventVisit.destroy({ where: { event_id: validEventIds }, transaction: t });
                await EventPhoto.destroy({ where: { event_id: validEventIds }, transaction: t });
                await EventAnnouncement.destroy({ where: { event_id: validEventIds }, transaction: t });
                await OrganizerNotification.destroy({ where: { event_id: validEventIds }, transaction: t });
                await UserNotification.destroy({ where: { event_id: validEventIds }, transaction: t });

                // Comments and their reactions
                const comments = await Comment.findAll({ 
                    where: { event_id: validEventIds }, 
                    attributes: ['id'], 
                    transaction: t 
                });
                const commentIds = comments.map(c => c.id);
                if (commentIds.length > 0) {
                    await CommentReaction.destroy({ where: { comment_id: commentIds }, transaction: t });
                    await Comment.destroy({ where: { event_id: validEventIds }, transaction: t });
                }

                // Finally delete the events
                await Event.destroy({ where: { id: validEventIds }, transaction: t });
            });
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
        const organizerId = req.session.organizerAuth.organizerId;
        const notif = await OrganizerNotification.findOne({
            where: {
                id: req.params.id,
                organizer_id: organizerId
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

// Mark All Notifications as Read
router.post('/notifications/mark-all-read', requireOrganizerAuth, async (req, res) => {
    try {
        const organizerId = req.session.organizerAuth.organizerId;
        await OrganizerNotification.update(
            { is_read: true },
            { where: { organizer_id: organizerId, is_read: false } }
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ error: 'Failed to update notifications' });
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

// Update Organizer Avatar (AJAX)
router.post('/avatar/update', requireOrganizerAuth, multer({ storage: memoryStorage }).single('avatar'), async (req, res) => {
    try {
        const organizerId = req.session.organizerAuth.organizerId;
        
        if (!req.file || !req.file.buffer) {
            return res.status(400).json({ success: false, message: 'No image file provided' });
        }

        const imageUrl = await uploadBufferToCloudinary(req.file.buffer, 'campus-navigator/organizer-avatars');
        
        const organizer = await Organizer.findByPk(organizerId);
        if (!organizer) {
            return res.status(404).json({ success: false, message: 'Organizer not found' });
        }

        organizer.avatar_url = imageUrl;
        await organizer.save();

        // Update session as well
        req.session.organizerAuth.avatarUrl = imageUrl;

        res.json({ success: true, avatar_url: imageUrl });
    } catch (error) {
        console.error('Error updating avatar:', error);
        res.status(500).json({ success: false, message: error.message });
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

// Get organizer notifications (JSON API)
router.get('/api/notifications', requireOrganizerAuth, async (req, res) => {
    try {
        const organizerId = req.session.organizerAuth.organizerId;
        const { OrganizerNotification } = require('../../models');

        const notifications = await OrganizerNotification.findAll({
            where: { organizer_id: organizerId },
            order: [['created_at', 'DESC']]
        });

        const unreadCount = await OrganizerNotification.count({
            where: { organizer_id: organizerId, is_read: false }
        });

        res.json({ notifications, unreadCount });
    } catch (error) {
        console.error('Error fetching notifications API:', error);
        res.status(500).json({ error: error.message });
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
