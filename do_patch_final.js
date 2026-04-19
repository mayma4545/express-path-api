const fs = require('fs');

let c = fs.readFileSync('src/views/organizer/add_event.ejs', 'utf8');

c = c.replace(/<form action="\/organizer\/events\/add" method="POST"/g, '<form action="<%= typeof event !== \'undefined\' && event ? \'/organizer/events/\' + event.id + \'/update\' : \'/organizer/events/add\' %>" method="POST"');

c = c.replace(/>Create Event<\/h1>/g, '><%= typeof event !== \'undefined\' && event ? \'Edit Event\' : \'Create Event\' %></h1>');

c = c.replace(/name="title" required placeholder/g, 'name="title" required value="<%= typeof event !== \'undefined\' && event ? event.title : \'\' %>" placeholder');

c = c.replace(/><\/textarea>/g, '><%= typeof event !== \'undefined\' && event ? event.description : \'\' %></textarea>');

c = c.replace(/<input type="date" name="event_date" id="event-start-date" required/g, '<input type="date" name="event_date" id="event-start-date" value="<%= typeof event !== \'undefined\' && event && event.event_date ? event.event_date : \'\' %>" required');

c = c.replace(/<input type="date" name="end_date" id="event-end-date"/g, '<input type="date" name="end_date" id="event-end-date" value="<%= typeof event !== \'undefined\' && event && event.end_date ? event.end_date : \'\' %>"');

c = c.replace(/<input type="time" name="start_time" required/g, '<input type="time" name="start_time" value="<%= typeof event !== \'undefined\' && event ? event.start_time : \'\' %>" required');

c = c.replace(/<input type="time" name="end_time" required/g, '<input type="time" name="end_time" value="<%= typeof event !== \'undefined\' && event ? event.end_time : \'\' %>" required');

c = c.replace(/<input type="number" name="capacity" placeholder/g, '<input type="number" name="capacity" value="<%= typeof event !== \'undefined\' && event ? event.capacity : \'\' %>" placeholder');

c = c.replace(/<input type="text" id="venue-input" name="venue" required placeholder/g, '<input type="text" id="venue-input" name="venue" required value="<%= typeof event !== \'undefined\' && event ? event.venue : \'\' %>" placeholder');

c = c.replace(/<input type="hidden" name="latitude" id="latitude">/g, '<input type="hidden" name="latitude" id="latitude" value="<%= typeof event !== \'undefined\' && event ? event.latitude : \'\' %>">');

c = c.replace(/<input type="hidden" name="longitude" id="longitude">/g, '<input type="hidden" name="longitude" id="longitude" value="<%= typeof event !== \'undefined\' && event ? event.longitude : \'\' %>">');

c = c.replace(/>\s*Create Event\s*<\/button>/gm, '>\\n          <%= typeof event !== \'undefined\' && event ? \'Update Event\' : \'Create Event\' %>\\n        </button>');

const script = `
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
`;

c = c.replace('</main>', script + '\\n</main>');

fs.writeFileSync('src/views/organizer/add_event.ejs', c, 'utf8');
console.log('Done patch');
