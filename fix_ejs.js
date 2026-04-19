const fs = require('fs');
const content = fs.readFileSync('src/views/organizer/event_details.ejs', 'utf-8');
const index = content.indexOf('</html>');
if (index > 0) {
    const newContent = content.substring(0, index + 7) + '\n';
    fs.writeFileSync('src/views/organizer/event_details.ejs', newContent);
    console.log('Fixed event_details.ejs!');
}
