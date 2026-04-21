/**
 * API Routes - Internal Web API
 * Mirrors Django views.py API endpoints
 */

const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Nodes, Edges, Annotation, CampusMap, EventAnnouncement, Event, EventLike, EventBookmark, EventVisit, EventRating, EventAnalytics, EventPhoto, Comment, CommentReaction, OrganizerNotification, UserNotification, AppUser } = require('../models');

const { getPathfinder } = require('../services/pathfinding');

// Find path between two nodes
router.post('/find-path', async (req, res) => {
    try {
        const { start, goal, avoid_stairs } = req.body;

        if (!start || !goal) {
            return res.status(400).json({ error: 'Start and goal codes required' });
        }

        const pathfinder = getPathfinder();
        const result = await pathfinder.getDirections(start, goal, avoid_stairs || false);

        res.json(result);
    } catch (error) {
        console.error('Find path error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get annotations for a panorama node
router.get('/annotations/:node_id', async (req, res) => {
    try {
        const annotations = await Annotation.findAll({
            where: {
                panorama_id: req.params.node_id,
                is_active: true
            },
            include: [{ model: Nodes, as: 'target_node' }]
        });

        const data = annotations.map(a => ({
            id: a.id,
            label: a.label,
            yaw: a.yaw,
            pitch: a.pitch,
            visible_radius: a.visible_radius,
            target_node: a.target_node ? {
                node_id: a.target_node.node_id,
                name: a.target_node.name,
                building: a.target_node.building
            } : null
        }));

        res.json({ annotations: data });
    } catch (error) {
        console.error('Get annotations error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get node details
router.get('/node-details/:node_id', async (req, res) => {
    try {
        const node = await Nodes.findByPk(req.params.node_id);
        
        if (!node) {
            return res.status(404).json({ error: 'Node not found' });
        }

        res.json({
            node_id: node.node_id,
            node_code: node.node_code,
            name: node.name,
            building: node.building,
            floor_level: node.floor_level,
            type_of_node: node.type_of_node,
            map_x: node.map_x !== null ? parseFloat(node.map_x) : null,
            map_y: node.map_y !== null ? parseFloat(node.map_y) : null,
            qrcode: node.qrcode || null,
            image360: node.image360 || null
        });
    } catch (error) {
        console.error('Get node details error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get graph visualization data
router.get('/graph-data', async (req, res) => {
    try {
        const [nodes, edges] = await Promise.all([
            Nodes.findAll(),
            Edges.findAll({
                where: { is_active: true },
                include: [
                    { model: Nodes, as: 'from_node' },
                    { model: Nodes, as: 'to_node' }
                ]
            })
        ]);

        const nodesData = nodes.map(n => ({
            id: n.node_id,
            code: n.node_code,
            name: n.name,
            building: n.building,
            floor: n.floor_level,
            type: n.type_of_node,
            map_x: n.map_x !== null ? parseFloat(n.map_x) : null,
            map_y: n.map_y !== null ? parseFloat(n.map_y) : null
        }));

        const edgesData = edges.map(e => ({
            id: e.edge_id,
            from: e.from_node_id,
            to: e.to_node_id,
            distance: e.distance,
            compass: e.compass_angle,
            staircase: e.is_staircase,
            active: e.is_active
        }));

        res.json({ nodes: nodesData, edges: edgesData });
    } catch (error) {
        console.error('Get graph data error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get event announcements
router.get('/events/:id/announcements', async (req, res) => {
    try {
        const announcements = await EventAnnouncement.findAll({
            where: { event_id: req.params.id },
            order: [['created_at', 'DESC']]
        });
        res.json({ announcements });
    } catch (error) {
        console.error('Get announcements error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get event photos
router.get('/events/:id/photos', async (req, res) => {
    try {
        const photos = await EventPhoto.findAll({
            where: { event_id: req.params.id },
            order: [['created_at', 'ASC']]
        });
        res.json({ photos });
    } catch (error) {
        console.error('Get photos error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get event comments
router.get('/events/:id/comments', async (req, res) => {
    try {
        const event = await Event.findByPk(req.params.id);
        if (!event) return res.status(404).json({ error: 'Event not found' });

        const comments = await Comment.findAll({
            where: { event_id: req.params.id },
            include: [
                { model: AppUser, as: 'user', attributes: ['id', 'first_name', 'last_name'] },
                { model: AppUser, as: 'reacted_by_users', attributes: ['id'] }
            ],
            order: [['created_at', 'ASC']]
        });
        res.json({ comments, organizer_id: event.organizer_id });
    } catch (error) {
        console.error('Get comments error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Like/Unlike a comment
router.post('/comments/:id/react', async (req, res) => {
    try {
        const commentId = req.params.id;
        let userId = req.body.user_id || req.query.user_id || (req.session.user && req.session.user.id) || null;
        
        if (!userId) {
            return res.status(401).json({ error: 'You must be logged in to react to a comment' });
        } else {
            const userExists = await AppUser.findByPk(userId);
            if (!userExists) {
                return res.status(401).json({ error: 'User does not exist' });
            }
        }
        
        const existing = await CommentReaction.findOne({
            where: { comment_id: commentId, user_id: userId }
        });
        
        if (existing) {
            await existing.destroy();
            res.json({ success: true, reacted: false });
        } else {
            await CommentReaction.create({ comment_id: commentId, user_id: userId });
            
            // Notify Organizer
            try {
                const comment = await Comment.findByPk(commentId, {
                    include: [{ model: Event, as: 'event' }]
                });
                if (comment && comment.event && comment.event.organizer_id) {
                    const user = await AppUser.findByPk(userId);
                    const userName = user ? `${user.first_name} ${user.last_name}` : 'A user';
                    await OrganizerNotification.create({
                        organizer_id: comment.event.organizer_id,
                        event_id: comment.event_id,
                        type: 'comment_reaction',
                        message: `${userName} liked a comment on your event "${comment.event.title}".`,
                        target_id: commentId.toString()
                    });

                    // Notify the comment owner if it's not the same user
                    if (comment.user_id && comment.user_id !== userId) {
                        await UserNotification.create({
                            user_id: comment.user_id,
                            event_id: comment.event_id,
                            type: 'reaction',
                            message: `${userName} liked your comment.`,
                            target_id: commentId.toString()
                        });
                    }
                }
            } catch (notifyError) {
                console.error('Error notifying organizer/user of comment reaction:', notifyError);
            }

            res.json({ success: true, reacted: true });
        }
    } catch (error) {
        console.error('React comment error:', error);
        res.status(500).json({ error: error.message });
    }
});

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
        const sessionID = req.sessionID;

        const event = await Event.findByPk(eventId);
        if (!event) return res.status(404).json({ error: 'Event not found' });

        // Uniqueness check: Use userId if logged in, otherwise use sessionID
        const whereClause = userId ? { event_id: eventId, user_id: userId } : { event_id: eventId, session_id: sessionID };
        
        // We need to ensure EventVisit table can handle session_id (adding it if not exists is handled by Sequelize sync usually, 
        // but for now we'll assume we can use it or fallback to a total count for anon)
        const [visit, created] = await EventVisit.findOrCreate({
            where: whereClause,
            defaults: { event_id: eventId, user_id: userId, session_id: userId ? null : sessionID }
        });

        if (created) {
            const [analytics] = await EventAnalytics.findOrCreate({ where: { event_id: eventId } });
            analytics.page_view_count = (analytics.page_view_count || 0) + 1;
            await analytics.save();
        }

        const currentAnalytics = await EventAnalytics.findOne({ where: { event_id: eventId } });
        res.json({ success: true, visits: currentAnalytics ? currentAnalytics.page_view_count : 0 });
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

// Like an event
router.post('/events/:id/like', async (req, res) => {
    try {
        const eventId = req.params.id;
        const userId = req.body.user_id || req.query.user_id || (req.session.user && req.session.user.id) || (req.session.organizerAuth && req.session.organizerAuth.appUserId) || null;

        const event = await Event.findByPk(eventId);
        if (!event) return res.status(404).json({ error: 'Event not found' });

        if (userId) {
            const [like, created] = await EventLike.findOrCreate({
                where: { event_id: eventId, user_id: userId }
            });
            
            if (created && event.organizer_id) {
                // Notify Organizer
                const user = await AppUser.findByPk(userId);
                const userName = user ? `${user.first_name} ${user.last_name}` : 'A user';
                await OrganizerNotification.create({
                    organizer_id: event.organizer_id,
                    event_id: eventId,
                    type: 'like',
                    message: `${userName} liked your event "${event.title}".`
                });
            }
        } else {
            return res.status(401).json({ error: 'You must be logged in to like an event' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Like event error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Comment on an event
router.post('/events/:id/comment', async (req, res) => {
    try {
        const eventId = req.params.id;
        const { text, parent_comment_id, user_id } = req.body;
        
        if (!text) return res.status(400).json({ error: 'Comment text required' });

        const event = await Event.findByPk(eventId);
        if (!event) return res.status(404).json({ error: 'Event not found' });

        let userId = user_id || (req.session.user && req.session.user.id) || (req.session.organizerAuth && req.session.organizerAuth.appUserId) || null;

        // Ensure user exists
        if (!userId) {
            return res.status(401).json({ error: 'You must be logged in to comment' });
        } else {
            const userExists = await AppUser.findByPk(userId);
            if (!userExists) {
                return res.status(401).json({ error: 'User does not exist' });
            }
        }

        const comment = await Comment.create({
            event_id: eventId,
            user_id: userId,
            parent_comment_id: parent_comment_id || null,
            content: text
        });

        if (event.organizer_id) {
            const user = userId ? await AppUser.findByPk(userId) : null;
            const userName = user ? `${user.first_name} ${user.last_name}` : 'A user';
            await OrganizerNotification.create({
                organizer_id: event.organizer_id,
                event_id: eventId,
                type: 'comment',
                message: `${userName} commented on your event "${event.title}": "${text.substring(0, 30)}..."`,
                target_id: comment.id.toString()
            });

            // If it's a reply, notify the parent comment owner
            if (parent_comment_id) {
                const parentComment = await Comment.findByPk(parent_comment_id);
                if (parentComment && parentComment.user_id && parentComment.user_id !== userId) {
                    await UserNotification.create({
                        user_id: parentComment.user_id,
                        event_id: eventId,
                        type: 'reply',
                        message: `${userName} replied to your comment.`,
                        target_id: comment.id.toString()
                    });
                }
            }
        }

        res.json({ success: true, comment });
    } catch (error) {
        console.error('Comment event error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
