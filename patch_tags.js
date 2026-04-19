const fs = require('fs');

// Patch organizer event details
let orgHtml = fs.readFileSync('src/views/organizer/event_details.ejs', 'utf-8');
orgHtml = orgHtml.replace(
  /going: RAW_EVENT\.capacity \|\| 0,\s*organizer: RAW_EVENT\.organizer \? RAW_EVENT\.organizer\.name : "Organizer"\s*\};\s*\}/,
  \going: RAW_EVENT.capacity || 0,
        organizer: RAW_EVENT.organizer ? RAW_EVENT.organizer.name : "Organizer",
        tags: RAW_EVENT.tags || ""
      };
    }\
);

orgHtml = orgHtml.replace(
  /\/\/ tags\s*const tagContainer = document\.getElementById\('detail-tags'\);\s*\[ev\.category, 'My Event'\]\.forEach\(t => \{\s*const el = document\.createElement\('span'\);\s*el\.className = 'text-xs font-medium bg-gray-100 text-gray-500 px-3 py-1 rounded-full';\s*el\.textContent = t;\s*tagContainer\.appendChild\(el\);\s*\}\);/,
  \// tags
      const tagContainer = document.getElementById('detail-tags');
      const parsedTags = [ev.category];
      if (ev.tags) {
         parsedTags.push(...ev.tags.split(',').map(t => t.trim()).filter(Boolean));
      }
      [...new Set(parsedTags)].forEach(t => {
        if (!t || t.toLowerCase() === 'other') return;
        const el = document.createElement('span');
        el.className = 'text-xs font-medium bg-gray-100 text-gray-500 px-3 py-1 rounded-full';
        el.textContent = t;
        tagContainer.appendChild(el);
      });\
);

fs.writeFileSync('src/views/organizer/event_details.ejs', orgHtml, 'utf-8');
console.log('Organizer event details patched!');

// Patch client details
let clientHtml = fs.readFileSync('src/views/client/details.ejs', 'utf-8');

// Need to update tags array in client:
// // tags
// const tags = [ev.category, 'Community', 'Free Entry', '📍 Manila'];
// ...
clientHtml = clientHtml.replace(
  /\/\/ tags\s*const tags = \[ev\.category, 'Community', 'Free Entry', '📍 Manila'\];\s*const tagContainer = document\.getElementById\('detail-tags'\);\s*tags\.forEach\(t => \{\s*const el = document\.createElement\('span'\);\s*el\.className = 'text-xs font-medium bg-gray-100 text-gray-500 px-3 py-1 rounded-full';\s*el\.textContent = t;\s*tagContainer\.appendChild\(el\);\s*\}\);/,
  \// tags
      const tags = [ev.category];
      if (RAW_EVENT && RAW_EVENT.tags) {
        tags.push(...RAW_EVENT.tags.split(',').map(t => t.trim()).filter(Boolean));
      }
      const tagContainer = document.getElementById('detail-tags');
      [...new Set(tags)].forEach(t => {
        if (!t || t.toLowerCase() === 'other') return;
        const el = document.createElement('span');
        el.className = 'text-xs font-medium bg-gray-100 text-gray-500 px-3 py-1 rounded-full';
        el.textContent = t;
        tagContainer.appendChild(el);
      });\
);

fs.writeFileSync('src/views/client/details.ejs', clientHtml, 'utf-8');
console.log('Client event details patched!');
