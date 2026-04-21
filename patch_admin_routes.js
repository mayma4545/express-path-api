const fs = require('fs');

let content = fs.readFileSync('./src/routes/admin/index.js', 'utf8');

// Replace middleware UserActivity
content = content.replace(/const { UserActivity } = require\('\.\.\/\.\.\/models'\);/g, 'const { EventSystemActivityLog } = require(\'../../models\');');
content = content.replace(/UserActivity/g, 'EventSystemActivityLog');
content = content.replace(/activity_id/g, 'id');
content = content.replace(/actor/g, 'organizer_actor');
content = content.replace(/attributes: \['id', 'username'\]/g, 'attributes: [\'id\', \'name\']');

fs.writeFileSync('./src/routes/admin/index.js', content);
console.log('Admin routes updated to use EventSystemActivityLog');
