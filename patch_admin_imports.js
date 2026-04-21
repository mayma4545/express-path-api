const fs = require('fs');

let content = fs.readFileSync('./src/routes/admin/index.js', 'utf8');

// Replace User with Organizer in dashboard route
content = content.replace(
    /const { EventSystemActivityLog, OrganizerNotification, EventAnalytics, User } = require\('\.\.\/\.\.\/models'\);/,
    "const { EventSystemActivityLog, OrganizerNotification, EventAnalytics, Organizer } = require('../../models');"
);

// Replace User with Organizer in activity route
content = content.replace(
    /const { EventSystemActivityLog, User } = require\('\.\.\/\.\.\/models'\);/,
    "const { EventSystemActivityLog, Organizer } = require('../../models');"
);

fs.writeFileSync('./src/routes/admin/index.js', content);
