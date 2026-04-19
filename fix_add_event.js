const fs = require('fs');
let c = fs.readFileSync('src/views/organizer/add_event.ejs', 'utf8');

c = c.replace('<form action="/organizer/events/add"', '<form action="<%= typeof event !== \\'undefined\\' && event ? \\'/organizer/events/\\' + event.id + \\'/update\\' : \\'/organizer/events/add\\' %>"');
c = c.replace('Create Event</h1>', '<%= typeof event !== \\'undefined\\' && event ? \\'Edit Event\\' : \\'Create Event\\' %></h1>');
c = c.replace('name="title" required placeholder=', 'name="title" required value="<%= typeof event !== \\'undefined\\' && event ? event.title : \\'\\' %>" placeholder=');
c = c.replace('></textarea>', '><%= typeof event !== \\'undefined\\' && event ? event.description : \\'\\' %></textarea>');
c = c.replace('id="recurrence-type"', 'id="recurrence-type" data-val="<%= typeof event !== \\'undefined\\' && event ? event.recurrence_type : \\'once\\' %>"');
c = c.replace('name="event_date"', 'name="event_date" value="<%= typeof event !== \\'undefined\\' && event && event.event_date ? event.event_date : \\'\\' %>"');
c = c.replace('name="end_date"', 'name="end_date" value="<%= typeof event !== \\'undefined\\' && event && event.end_date ? event.end_date : \\'\\' %>"');
c = c.replace('name="start_time"', 'name="start_time" value="<%= typeof event !== \\'undefined\\' && event ? event.start_time : \\'\\' %>"');
c = c.replace('name="end_time"', 'name="end_time" value="<%= typeof event !== \\'undefined\\' && event ? event.end_time : \\'\\' %>"');
c = c.replace('name="capacity"', 'name="capacity" value="<%= typeof event !== \\'undefined\\' && event ? event.capacity : \\'\\' %>"');
c = c.replace('id="venue-input" name="venue" required', 'id="venue-input" name="venue" required value="<%= typeof event !== \\'undefined\\' && event ? event.venue : \\'\\' %>"');
c = c.replace('id="latitude"', 'id="latitude" value="<%= typeof event !== \\'undefined\\' && event ? event.latitude : \\'\\' %>"');
c = c.replace('id="longitude"', 'id="longitude" value="<%= typeof event !== \\'undefined\\' && event ? event.longitude : \\'\\' %>"');
c = c.replace('>\\n          Create Event\\n        </button>', '>          <%= typeof event !== \\'undefined\\' && event ? \\'Update Event\\' : \\'Create Event\\' %>\\n        </button>');

// Script for setting category and tags
const scriptToAdd = 
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
      recType.dispatchEvent(new Event('change'));
    }

    const eventTags = "<%= event.tags || '' %>".split(',');
    const tagInputs = document.querySelectorAll('input[name="tags"]');
    tagInputs.forEach(input => {
      if (eventTags.includes(input.value)) {
        input.checked = true;
      }
    });
  });
</script>
<% } %>
;
c = c.replace('</main>', scriptToAdd + '\\n  </main>');

fs.writeFileSync('src/views/organizer/add_event.ejs', c, 'utf8');
console.log('saved');
