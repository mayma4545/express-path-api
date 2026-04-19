const fs = require('fs');
const path = require('path');
const dir = 'src/views/organizer';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ejs'));

files.forEach(f => {
  const filePath = path.join(dir, f);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace the profile link
  content = content.replace(/<a href="#"(?:[^>]*?)>\s*<div(?:[^>]*?)>\s*<svg(?:[^>]*?)>(?:[\s\S]*?)<\/svg>\s*<span(?:[^>]*?)><\/span>\s*<\/div>\s*<span class="text-\[10px\] font-semibold tracking-wide\">Profile<\/span>\s*<\/a>/, 
  `<a href="/organizer/profile" class="flex flex-col items-center justify-center gap-1 w-12 text-textMuted hover:text-textMain transition-colors relative group">
        <div class="p-1.5 rounded-full group-hover:bg-slate-100 transition-colors relative">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
          </svg>
        </div>
        <span class="text-[10px] font-semibold tracking-wide">Profile</span>
      </a>`);

  // Update Scanner to Event (did 'Event' earlier, sometimes it was "Events", let me make sure it says "Event" since user explicitly asked: "change the name of the scanner to event")
  content = content.replace(/>Events?<\/span>/g, '>Event</span>');

  fs.writeFileSync(filePath, content);
});
console.log('Fixed profile links');