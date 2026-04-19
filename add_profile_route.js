const fs = require('fs');
const path = 'src/routes/organizer/index.js';
let content = fs.readFileSync(path, 'utf8');

const profileRoute = `
// Organizer Profile Page
router.get('/profile', requireOrganizerAuth, async (req, res) => {
    try {
        const organizerId = req.session.organizerAuth.organizerId;
        const organizer = await Organizer.findByPk(organizerId, { 
            include: [{ model: AppUser, as: 'user', attributes: ['email', 'first_name', 'last_name'] }] 
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

module.exports = router;`;

if (!content.includes('/profile')) {
    content = content.replace('module.exports = router;', profileRoute);
    fs.writeFileSync(path, content);
}
console.log('Added profile route');