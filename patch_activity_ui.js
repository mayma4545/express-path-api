const fs = require('fs');
let content = fs.readFileSync('./src/views/admin/activity.ejs', 'utf8');

const oldSub = "let sub = (a.organizer_actor ? a.organizer_actor.name : 'System') + (a.module ? ' · ' + a.module : '');";
const newSub = `
        let extraInfo = '';
        if (a.metadata && a.metadata.title) {
            extraInfo = ' · ' + a.metadata.title;
        } else if (a.target_type === 'Event' && a.target_id) {
            extraInfo = ' · Event ID ' + a.target_id;
        }
        let sub = (a.organizer_actor ? a.organizer_actor.name : 'System') + extraInfo;
`;
content = content.replace(oldSub, newSub);

fs.writeFileSync('./src/views/admin/activity.ejs', content);
