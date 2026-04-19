const fs = require('fs');

let html = fs.readFileSync('src/views/organizer/event_details.ejs', 'utf8');

// 1. Remove left aside and mobile bottom pane
html = html.replace(/<aside class="hidden md:flex flex-col[\s\S]*?<\/aside>/, '');
html = html.replace(/<!-- Mobile Bottom Tab Pane -->[\s\S]*?<\/div>\s*<main/, '<main');

// 2. Remove sticky CTA at the bottom 
html = html.replace(/<!-- -- Sticky CTA.*?<\/div>\s*<\/main>/s, '</main>');

// 3. Add bottom navbar
const bottomNav = `
  <!-- 5. Bottom Navigation Tab Bar -->
  <div class="fixed bottom-0 w-full z-50 bg-white/95 backdrop-blur-xl border-t border-slate-200">
    <nav class="flex justify-between items-center px-6 py-3.5 max-w-lg mx-auto">
      <a href="/organizer/dashboard" class="flex flex-col items-center justify-center gap-1 w-12 text-textMuted hover:text-textMain transition-colors group">
        <div class="p-1.5 rounded-full group-hover:bg-slate-100 transition-colors">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
        </div>
        <span class="text-[10px] font-bold tracking-wide">Home</span>
      </a>
      
      <a href="/organizer/analytics" class="flex flex-col items-center justify-center gap-1 w-12 text-textMuted hover:text-textMain transition-colors group">
        <div class="p-1.5 rounded-full group-hover:bg-slate-100 transition-colors">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
        </div>
        <span class="text-[10px] font-semibold tracking-wide">Analytics</span>
      </a>
      
      <a href="/organizer/events/add" class="flex flex-col items-center justify-center gap-1 w-12 text-textMuted hover:text-textMain transition-colors group">
        <div class="p-1.5 rounded-full bg-brand text-white shadow-lg shadow-brand/30 hover:scale-105 transition-transform">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
        </div>
        <span class="text-[10px] font-semibold tracking-wide">Add</span>
      </a>
      
      <a href="/organizer/events" class="flex flex-col items-center justify-center gap-1 w-12 text-brand group transition-colors">
        <div class="p-1.5 rounded-full bg-brand-light transition-colors">
          <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>
        </div>
        <span class="text-[10px] font-semibold tracking-wide">Scanner</span>
      </a>
      
      <a href="#" class="flex flex-col items-center justify-center gap-1 w-12 text-textMuted hover:text-textMain transition-colors relative group">
        <div class="p-1.5 rounded-full group-hover:bg-slate-100 transition-colors relative">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
          <span class="absolute top-1.5 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
        </div>
        <span class="text-[10px] font-semibold tracking-wide">Alerts</span>
      </a>
    </nav>
  </div>
`;
html = html.replace('</main>', '</main>' + bottomNav);

// 4. Transform Edit button
html = html.replace(/<a href="\/v1\/events\/<%= event\.id %>\/edit"[^>]*>[\s\S]*?Edit\s*<\/a>/, 
  `<div class="flex items-center gap-2"><button id="headerEditBtn" type="button" onclick="toggleEditMode()" class="flex items-center gap-1.5 bg-brand text-white px-5 py-2.5 rounded-full text-sm font-bold shadow-soft hover:shadow-float hover:bg-brand-dark transition-all">
    <svg class="w-4 h-4 edit-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.5m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
    <span class="edit-text">Edit</span>
  </button>
  <button id="headerUpdateBtn" type="submit" form="editEventForm" class="hidden flex items-center gap-1.5 bg-green-500 text-white px-5 py-2.5 rounded-full text-sm font-bold shadow-soft hover:shadow-float hover:bg-green-600 transition-all">
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
    Update
  </button></div>`);

// Form wrapper
html = html.replace('<main class="max-w-4xl mx-auto md:p-8">', '<form id="editEventForm" action="/organizer/events/<%= event.id %>/update" method="POST" enctype="multipart/form-data" class="m-0 p-0"><main class="max-w-4xl mx-auto md:p-8 relative z-10 w-full mb-20">');
html = html.replace('</main>', '</main></form>');

// Title
html = html.replace('<h1 class="text-3xl md:text-5xl font-extrabold text-white leading-tight drop-shadow-lg"><%= event.title || event.name %></h1>',
  '<h1 class="static-display text-3xl md:text-5xl font-extrabold text-white leading-tight drop-shadow-lg"><%= event.title || event.name %></h1><input type="text" name="title" value="<%= event.title || event.name %>" class="editable-field hidden bg-white/20 text-white placeholder-white/70 border border-white/50 rounded flex w-full text-3xl md:text-5xl font-extrabold p-2">');

// Date
html = html.replace('<span class="font-bold text-sm"><%= event.event_date %></span>',
  '<span class="static-display font-bold text-sm"><%= event.event_date %></span><input type="date" name="event_date" value="<%= event.event_date %>" class="editable-field hidden bg-transparent border-b border-brand text-brand-dark px-1 outline-none text-sm font-bold">');

// Time
html = html.replace('<span class="font-bold text-sm"><%= event.start_time %> – <%= event.end_time || "Late" %></span>',
  '<span class="static-display font-bold text-sm"><%= event.start_time %> – <%= event.end_time || "Late" %></span><div class="editable-field hidden flex items-center gap-1"><input type="time" name="start_time" value="<%= event.start_time %>" class="bg-transparent border-b border-gray-400 text-gray-700 px-1 outline-none text-sm font-bold w-24"> <span class="text-gray-400">to</span> <input type="time" name="end_time" value="<%= event.end_time %>" class="bg-transparent border-b border-gray-400 text-gray-700 px-1 outline-none text-sm font-bold w-24"></div>');

// Venue
html = html.replace('<span class="font-bold text-sm"><%= event.venue %></span>',
  '<span class="static-display font-bold text-sm"><%= event.venue %></span><input type="text" name="venue" value="<%= event.venue %>" class="editable-field hidden bg-transparent border-b border-green-500 text-green-700 px-1 outline-none text-sm font-bold w-full max-w-[150px]">');

// Description
html = html.replace('<%= event.description || "No description provided." %>',
  '<span class="static-display"><%= event.description || "No description provided." %></span><textarea name="description" rows="4" class="editable-field hidden w-full bg-white border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-brand focus:border-brand"><%= event.description %></textarea>');

// Toggle logic
const toggleScript = `
    let isEditMode = false;
    function toggleEditMode() {
      isEditMode = !isEditMode;
      const editBtn = document.getElementById('headerEditBtn');
      const updateBtn = document.getElementById('headerUpdateBtn');
      const editableFields = document.querySelectorAll('.editable-field');
      const staticDisplays = document.querySelectorAll('.static-display');
      
      if (isEditMode) {
        editBtn.classList.replace('bg-brand', 'bg-gray-400');
        editBtn.classList.replace('hover:bg-brand-dark', 'hover:bg-gray-500');
        editBtn.querySelector('.edit-text').innerText = 'Cancel';
        updateBtn.classList.remove('hidden');
        
        editableFields.forEach(el => el.classList.remove('hidden'));
        staticDisplays.forEach(el => el.classList.add('hidden'));
      } else {
        editBtn.classList.replace('bg-gray-400', 'bg-brand');
        editBtn.classList.replace('hover:bg-gray-500', 'hover:bg-brand-dark');
        editBtn.querySelector('.edit-text').innerText = 'Edit';
        updateBtn.classList.add('hidden');
        
        editableFields.forEach(el => el.classList.add('hidden'));
        staticDisplays.forEach(el => el.classList.remove('hidden'));
      }
    }
  </script>`;
html = html.replace('</body>', '<script>' + toggleScript + '</body>');

fs.writeFileSync('src/views/organizer/event_details.ejs', html, 'utf8');
console.log('Successfully patched event_details.ejs');


