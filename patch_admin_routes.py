import re

with open('./src/routes/admin/index.js', 'r') as f:
    content = f.read()

middleware = """
// Middleware to get unread activity count
router.use(async (req, res, next) => {
    try {
        const { UserActivity } = require('../../models');
        const unreadCount = await UserActivity.count({ where: { is_read: false } });
        res.locals.unreadActivityCount = unreadCount;
        next();
    } catch (e) {
        console.error('Middleware error:', e);
        res.locals.unreadActivityCount = 0;
        next();
    }
});

"""

# Insert middleware after router definition
content = re.sub(r'(const router = express\.Router\(\);)', r'\1\n' + middleware, content, 1)

# Modify /activity route
activity_route_new = """router.get('/activity', async (req, res) => {
    try {
        const { UserActivity, User } = require('../../models');
        const activities = await UserActivity.findAll({
            include: [{ model: User, as: 'actor', attributes: ['id', 'username'] }],
            order: [['occurred_at', 'DESC']]
        });
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
        const { UserActivity } = require('../../models');
        await UserActivity.update({ is_read: true }, { where: { activity_id: req.params.id } });
        res.json({ success: true });
    } catch (error) {
        console.error('Mark read error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});"""

content = re.sub(r"router\.get\('/activity', async \(req, res\) => \{[\s\S]*?\}\);", activity_route_new, content)

with open('./src/routes/admin/index.js', 'w') as f:
    f.write(content)
