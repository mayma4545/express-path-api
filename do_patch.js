const fs = require('fs');

let c = fs.readFileSync('src/views/organizer/add_event.ejs', 'utf8');

c = c.replace(
  '<form action="/organizer/events/add" method="POST"', 
  '<form action="<%= typeof event !== \'undefined\' && event ? \'/organizer/events/\' + event.id + \'/update\' : \'/organizer/events/add\' %>" method="POST"'
);

c = c.replace(
  '<h1 class="text-xl font-bold tracking-tight text-textMain">Create Event</h1>',
  '<h1 class="text-xl font-bold tracking-tight text-textMain"><%= typeof event !== \'undefined\' && event ? \'Edit Event\' : \'Create Event\' %></h1>'
);

c = c.replace(
  'name="title" required placeholder="e.g. Annual Tech Symposium"',
  'name="title" required value="<%= typeof event !== \'undefined\' && event ? event.title : \'\' %>" placeholder="e.g. Annual Tech Symposium"'
);

c = c.replace(
  'placeholder="What\\'s this event about?" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/50 text-sm placeholder:text-slate-400 resize-none"></textarea>',
  'placeholder="What\\'s this event about?" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/50 text-sm placeholder:text-slate-400 resize-none"><%= typeof event !== \'undefined\' && event ? event.description : \'\' %></textarea>'
);

c = c.replace(
  '<input type="date" name="event_date" id="event-start-date" required class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/50 text-sm">',
  '<input type="date" name="event_date" id="event-start-date" value="<%= typeof event !== \'undefined\' && event && event.event_date ? event.event_date : \'\' %>" required class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/50 text-sm">'
);

c = c.replace(
  '<input type="date" name="end_date" id="event-end-date" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/50 text-sm">',
  '<input type="date" name="end_date" id="event-end-date" value="<%= typeof event !== \'undefined\' && event && event.end_date ? event.end_date : \'\' %>" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/50 text-sm">'
);

c = c.replace(
  '<input type="time" name="start_time" required class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/50 text-sm">',
  '<input type="time" name="start_time" value="<%= typeof event !== \'undefined\' && event ? event.start_time : \'\' %>" required class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/50 text-sm">'
);

c = c.replace(
  '<input type="time" name="end_time" required class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/50 text-sm">',
  '<input type="time" name="end_time" value="<%= typeof event !== \'undefined\' && event ? event.end_time : \'\' %>" required class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/50 text-sm">'
);

c = c.replace(
  '<input type="number" name="capacity" placeholder="e.g. 100"',
  '<input type="number" name="capacity" value="<%= typeof event !== \'undefined\' && event ? event.capacity : \'\' %>" placeholder="e.g. 100"'
);

c = c.replace(
  '<input type="text" id="venue-input" name="venue" required placeholder=',
  '<input type="text" id="venue-input" name="venue" required value="<%= typeof event !== \'undefined\' && event ? event.venue : \'\' %>" placeholder='
);

c = c.replace(
  '<input type="hidden" name="latitude" id="latitude">',
  '<input type="hidden" name="latitude" id="latitude" value="<%= typeof event !== \'undefined\' && event ? event.latitude : \'\' %>">'
);

c = c.replace(
  '<input type="hidden" name="longitude" id="longitude">',
  '<input type="hidden" name="longitude" id="longitude" value="<%= typeof event !== \'undefined\' && event ? event.longitude : \'\' %>">'
);

c = c.replace(
  '>\\r\\n          Create Event\\r\\n        </button>',
  '>\\r\\n          <%= typeof event !== \'undefined\' && event ? \'Update Event\' : \'Create Event\' %>\\r\\n        </button>'
);

c = c.replace(
  '>\\n          Create Event\\n        </button>',
  '>\\n          <%= typeof event !== \'undefined\' && event ? \'Update Event\' : \'Create Event\' %>\\n        </button>'
);


const script = 
  <% if (typeof event !== 'undefined' && event) { %>
  <script>
    document.addEventListener('DOMContentLoaded', () => {
      const categorySelect = document.querySelector('select[name="category_id"]');
      if (categorySelect && "<%= event.category_id %>") {
        categorySelect.value = "<%= event.category_id %>";
      }

      const recType = document.getElementById('recurrence-type');
      if (recType && "<%= event.recurrence_type %>") {
        recType.value = "<%= event.recurrence_type %>";
      }

      const tagsStr = "<%= event.tags || '' %>";
      if (tagsStr) {
        const eventTags = tagsStr.split(',').map(t => t.trim());
        const tagInputs = document.querySelectorAll('input[name="tags"]');
        tagInputs.forEach(input => {
          if (eventTags.includes(input.value)) {
            input.checked = true;
          }
        });
      }
      
      const endRec = document.getElementById('recurrence-end-date');
      if (endRec && "<%= event.recurrence_end_date %>") {
        endRec.value = "<%= event.recurrence_end_date %>";
      }
    });
  </script>
  <% } %>
;

c = c.replace('</main>', script + '\\n</main>');

fs.writeFileSync('src/views/organizer/add_event.ejs', c, 'utf8');
console.log('Done patch');
