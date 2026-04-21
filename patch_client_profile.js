const fs = require('fs');
let code = fs.readFileSync('src/routes/client.js', 'utf-8');

// Replace the /profile route with one that fetches associations
const oldProfileRoute = \outer.get('/profile', requireUserAuth, async (req, res) => {
    try {
        const user = await AppUser.findByPk(req.session.user.id);
        res.render('client/profile', { user });
    } catch (error) {
        console.error('Error loading profile:', error);
        res.redirect('/home');
    }
});\;

const newProfileRoute = \outer.get('/profile', requireUserAuth, async (req, res) => {
    try {
        const { EventBookmark, EventVisit, EventRating, Event, EventAnalytics } = require('../models');
        const user = await AppUser.findByPk(req.session.user.id);
        
        let bookmarkedEvents = await Event.findAll({
            include: [{ model: EventBookmark, as: 'bookmarked_by_users', where: { user_id: user.id } }]
        });
        
        let visitedEvents = await Event.findAll({
            include: [{ model: EventVisit, as: 'visits', where: { user_id: user.id } }]
        });
        
        let myRatings = await EventRating.findAll({
            where: { user_id: user.id },
            include: [{ model: Event, as: 'event' }]
        });

        res.render('client/profile', { user, bookmarkedEvents, visitedEvents, myRatings });
    } catch (error) {
        console.error('Error loading profile:', error);
        res.redirect('/home');
    }
});\;

code = code.replace(/router\.get\('\\/profile', requireUserAuth, async \\(req, res\\) => \\{\\s*try \\{\\s*const user = await AppUser\\.findByPk\\(req\\.session\\.user\\.id\\);\\s*res\\.render\\('client\\/profile', \\{ user \\}\\);\\s*\\} catch \\(error\\) \\{\\s*console\\.error\\('Error loading profile:', error\\);\\s*res\\.redirect\\('\\/home'\\);\\s*\\}\\s*\\}\\);/, newProfileRoute);

fs.writeFileSync('src/routes/client.js', code);
