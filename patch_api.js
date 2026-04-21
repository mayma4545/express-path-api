const fs = require('fs');
let code = fs.readFileSync('src/routes/api.js', 'utf-8');

code = code.replace(
    "EventLike, EventPhoto, Comment, CommentReaction, OrganizerNotification, UserNotification, AppUser }",
    "EventLike, EventBookmark, EventVisit, EventRating, EventAnalytics, EventPhoto, Comment, CommentReaction, OrganizerNotification, UserNotification, AppUser }"
);

const newRoutes = \
// Bookmark an event
router.post('/events/:id/bookmark', async (req, res) => {
    try {
        const eventId = req.params.id;
        const userId = req.body.user_id || req.query.user_id || (req.session.user && req.session.user.id) || (req.session.organizerAuth && req.session.organizerAuth.appUserId) || null;

        if (!userId) return res.status(401).json({ error: 'You must be logged in to bookmark an event' });

        const event = await Event.findByPk(eventId);
        if (!event) return res.status(404).json({ error: 'Event not found' });

        const existingBookmark = await EventBookmark.findOne({ where: { event_id: eventId, user_id: userId } });
        let bookmarked = false;

        if (existingBookmark) {
            await existingBookmark.destroy();
        } else {
            await EventBookmark.create({ event_id: eventId, user_id: userId });
            bookmarked = true;
        }

        res.json({ success: true, bookmarked });
    } catch (error) {
        console.error('Bookmark event error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Visit an event details page
router.post('/events/:id/visit', async (req, res) => {
    try {
        const eventId = req.params.id;
        const userId = req.body.user_id || req.query.user_id || (req.session.user && req.session.user.id) || (req.session.organizerAuth && req.session.organizerAuth.appUserId) || null;

        const event = await Event.findByPk(eventId);
        if (!event) return res.status(404).json({ error: 'Event not found' });

        await EventVisit.create({ event_id: eventId, user_id: userId });

        const [analytics] = await EventAnalytics.findOrCreate({ where: { event_id: eventId } });
        analytics.page_view_count = (analytics.page_view_count || 0) + 1;
        await analytics.save();

        res.json({ success: true, visits: analytics.page_view_count });
    } catch (error) {
        console.error('Visit event error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Rate an event
router.post('/events/:id/rate', async (req, res) => {
    try {
        const eventId = req.params.id;
        const userId = req.body.user_id || req.query.user_id || (req.session.user && req.session.user.id) || (req.session.organizerAuth && req.session.organizerAuth.appUserId) || null;
        let { rating } = req.body;
        
        if (!userId) return res.status(401).json({ error: 'You must be logged in to rate an event' });
        
        rating = parseInt(rating);
        if (isNaN(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: 'Valid rating between 1 and 5 is required' });

        const event = await Event.findByPk(eventId);
        if (!event) return res.status(404).json({ error: 'Event not found' });

        const [eventRating, created] = await EventRating.findOrCreate({
            where: { event_id: eventId, user_id: userId },
            defaults: { rating }
        });

        if (!created) {
            // Already rated: they can't rate again. Note: The prompt says "each user can rate an event once only".
            return res.status(400).json({ error: 'You have already rated this event', rating: eventRating.rating });
        }

        res.json({ success: true, rating });
    } catch (error) {
        console.error('Rate event error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get current user status for an event (liked, bookmarked, rating)
router.get('/events/:id/status', async (req, res) => {
    try {
        const eventId = req.params.id;
        const userId = req.query.user_id || (req.session.user && req.session.user.id) || (req.session.organizerAuth && req.session.organizerAuth.appUserId) || null;

        let status = { liked: false, bookmarked: false, rating: null };
        
        if (userId) {
            status.liked = !!(await EventLike.findOne({ where: { event_id: eventId, user_id: userId } }));
            status.bookmarked = !!(await EventBookmark.findOne({ where: { event_id: eventId, user_id: userId } }));
            const userRating = await EventRating.findOne({ where: { event_id: eventId, user_id: userId } });
            status.rating = userRating ? userRating.rating : null;
        }
        
        const countAnalytics = await EventAnalytics.findOne({ where: { event_id: eventId } });
        status.visits = countAnalytics ? countAnalytics.page_view_count : 0;
        
        // Calculate average rating
        const allRatings = await EventRating.findAll({ where: { event_id: eventId } });
        if (allRatings.length > 0) {
            const sum = allRatings.reduce((acc, r) => acc + r.rating, 0);
            status.avgRating = (sum / allRatings.length).toFixed(1);
            status.totalRatings = allRatings.length;
        } else {
            status.avgRating = 0;
            status.totalRatings = 0;
        }

        res.json(status);
    } catch (error) {
        console.error('Status event error:', error);
        res.status(500).json({ error: error.message });
    }
});
\;

code = code.replace("// Like an event", newRoutes + "\\n// Like an event");

fs.writeFileSync('src/routes/api.js', code);
