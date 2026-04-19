const fs = require('fs');
const path = require('path');
const dir = 'src/views/organizer';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ejs'));

const alertsHtml = `<a href="#" class="flex flex-col items-center justify-center gap-1 w-12 text-textMuted hover:text-textMain transition-colors relative group">
        <div class="p-1.5 rounded-full group-hover:bg-slate-100 transition-colors relative">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
          <span class="absolute top-1.5 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
        </div>
        <span class="text-[10px] font-semibold tracking-wide">Alerts</span>
      </a>`;

const profileHtml = `<a href="/organizer/profile" class="flex flex-col items-center justify-center gap-1 w-12 text-textMuted hover:text-textMain transition-colors relative group">
        <div class="p-1.5 rounded-full group-hover:bg-slate-100 transition-colors relative">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
          </svg>
        </div>
        <span class="text-[10px] font-semibold tracking-wide">Profile</span>
      </a>`;

files.forEach(f => {
  const filePath = path.join(dir, f);
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/>Scanner<\/span>/g, '>Event</span>');
  content = content.replace(alertsHtml, profileHtml);
  
  // also change some text if they are not using exactly the same html block structure
  content = content.replace(/>Alerts<\/span>/g, '>Profile</span>');
  
  fs.writeFileSync(filePath, content);
});

console.log('Fixed navigation in organizer EJS files');
