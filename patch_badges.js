const fs = require('fs');

const files = fs.readdirSync('./src/views/admin').filter(f => f.endsWith('.ejs'));

files.forEach(file => {
    let content = fs.readFileSync(`./src/views/admin/${file}`, 'utf8');
    
    // Add relative to desktop sidebar
    content = content.replace(/(<a\s+href="\/admin\/activity"[\s\S]*?class="[^"]*?p-3 rounded-xl[^"]*?")/g, (match) => {
        if (!match.includes('relative')) {
            return match.replace(/class="/, 'class="relative ');
        }
        return match;
    });

    // Add badge to desktop sidebar
    content = content.replace(/(<a\s+href="\/admin\/activity"[\s\S]*?class="[^"]*?p-3 rounded-xl[^"]*?"[\s\S]*?)(<\/a>)/g, (match, p1, p2) => {
        if (!match.includes('<% if(locals.unreadActivityCount')) {
            const badge = `\n  <% if(locals.unreadActivityCount > 0) { %>\n    <span class="absolute top-2 right-2 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-red-500 rounded-full activity-badge" id="desktop-activity-badge"><%= locals.unreadActivityCount %></span>\n  <% } %>\n`;
            return p1 + badge + p2;
        }
        return match;
    });

    // Add relative to bottom nav
    content = content.replace(/(<a\s+href="\/admin\/activity"[\s\S]*?class="[^"]*?flex flex-col items-center[^"]*?")/g, (match) => {
        if (!match.includes('relative')) {
            return match.replace(/class="/, 'class="relative ');
        }
        return match;
    });

    // Add badge to bottom nav
    content = content.replace(/(<a\s+href="\/admin\/activity"[\s\S]*?class="[^"]*?flex flex-col items-center[^"]*?"[\s\S]*?)(<\/a>)/g, (match, p1, p2) => {
        if (!match.includes('<% if(locals.unreadActivityCount')) {
            const badge = `\n  <% if(locals.unreadActivityCount > 0) { %>\n    <span class="absolute top-0 right-2 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-red-500 rounded-full activity-badge" id="mobile-activity-badge"><%= locals.unreadActivityCount %></span>\n  <% } %>\n`;
            return p1 + badge + p2;
        }
        return match;
    });

    fs.writeFileSync(`./src/views/admin/${file}`, content);
});
console.log("Badges patched.");
