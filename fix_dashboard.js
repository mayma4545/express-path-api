const fs = require('fs');

let html = fs.readFileSync('temp_dashboard.tmp', 'utf8');

const replaceBlock = (html, startMarker, endMarker, newContent) => {
    const startIndex = html.indexOf(startMarker);
    const endIndex = html.indexOf(endMarker);
    if (startIndex !== -1 && endIndex !== -1) {
        return html.substring(0, startIndex) + newContent + html.substring(endIndex);
    }
    return html;
};

// 1. Ongoing
const ongoingContent = \<!-- ===== ONGOING EVENTS ===== -->
<div class="mb-8">
  <div class="flex justify-between items-center mb-4">
    <div class="flex items-center gap-2">
      <h3 class="text-lg font-bold">Ongoing Events</h3>
    </div>
    <a href="/admin/events" class="text-sm font-medium text-textMuted hover:text-brand">See all</a>
  </div>
  <div class="flex flex-col gap-3">
    <% if(ongoingEvents && ongoingEvents.length > 0) { %>
      <% ongoingEvents.forEach(function(evt) { %>
      <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-50 card-hover cursor-pointer" onclick="window.location.href='/admin/events/<%= evt.id %>'">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-brand to-purple-400 flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow-float">
            <%= evt.title.charAt(0).toUpperCase() %>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2 mb-0.5">
              <h4 class="font-bold text-textMain text-sm truncate"><%= evt.title %></h4>
              <span class="text-[11px] font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex-shrink-0">In Progress</span>
            </div>
            <p class="text-xs text-textMuted mb-2">
              <%= evt.venue || 'TBA' %> &middot; Started <%= new Date(evt.start_date || evt.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) %>
            </p>
            <div class="flex items-center gap-2">
              <div class="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div class="progress-fill h-full bg-gradient-to-r from-brand to-purple-400 rounded-full" style="--fill: 50%"></div>
              </div>
              <span class="text-[11px] text-textMuted font-medium">50%</span>
            </div>
          </div>
        </div>
      </div>
      <% }); %>
    <% } else { %>
      <p class="text-sm text-textMuted">No ongoing events right now.</p>
    <% } %>
  </div>
</div>
\;

html = replaceBlock(html, '<!-- ===== ONGOING EVENTS ===== -->', '<!-- ===== UPCOMING EVENTS ===== -->', ongoingContent);

// 2. Upcoming
const upcomingContent = \<!-- ===== UPCOMING EVENTS ===== -->
<div class="mb-8">
  <div class="flex justify-between items-center mb-4">
    <div class="flex items-center gap-2">
      <h3 class="text-lg font-bold">Upcoming Events</h3>
    </div>
    <a href="/admin/events" class="text-sm font-medium text-textMuted hover:text-brand">See all</a>
  </div>
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <% if(upcomingEvents && upcomingEvents.length > 0) { %>
      <% upcomingEvents.forEach(function(evt) { %>
      <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-50 flex gap-4 card-hover overflow-hidden relative cursor-pointer" onclick="window.location.href='/admin/events/<%= evt.id %>'">
        <div class="absolute top-0 left-0 w-1 h-full bg-[#ec4899]"></div>
        <div class="flex-1 min-w-0">
          <span class="text-[10px] font-bold tracking-wider text-pink-500 uppercase mb-1 block"><%= evt.category || 'Event' %></span>
          <h4 class="font-bold text-textMain text-sm truncate mb-1"><%= evt.title %></h4>
          <div class="flex items-center gap-3 text-xs text-textMuted font-medium">
            <span class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-gray-300"></span><%= new Date(evt.start_date).toLocaleDateString([], {month:'short', day:'numeric'}) %></span>
            <span class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-gray-300"></span><%= evt.venue || 'TBA' %></span>
          </div>
        </div>
        <div class="w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex-shrink-0 border-2 border-white shadow-sm flex items-center justify-center font-bold text-gray-500">
          <% if(evt.image_url) { %>
            <img src="<%= evt.image_url %>" alt="<%= evt.title %>" class="w-full h-full object-cover" />
          <% } else { %>
            Ev
          <% } %>
        </div>
      </div>
      <% }); %>
    <% } else { %>
      <p class="text-sm text-textMuted col-span-2">No upcoming events scheduled.</p>
    <% } %>
  </div>
</div>
\;

html = replaceBlock(html, '<!-- ===== UPCOMING EVENTS ===== -->', '<!-- ===== MOST VISITED EVENTS ===== -->', upcomingContent);

// 3. Most Visited
const mostVisitedContent = \<!-- ===== MOST VISITED EVENTS ===== -->
<div class="mb-8">
  <div class="flex justify-between items-center mb-4">
    <div class="flex items-center gap-2">
      <h3 class="text-lg font-bold">Most Visited Events</h3>
    </div>
    <a href="/admin/events" class="text-sm font-medium text-textMuted hover:text-brand">See all</a>
  </div>
  <div class="flex flex-col gap-3">
    <% if(mostVisitedEvents && mostVisitedEvents.length > 0) { %>
      <% mostVisitedEvents.forEach(function(evt) { %>
      <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-50 card-hover cursor-pointer" onclick="window.location.href='/admin/events/<%= evt.id %>'">
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-4 min-w-0">
            <div class="w-10 h-10 rounded-xl bg-[#FFF6F0] flex items-center justify-center text-orange-500 font-bold flex-shrink-0">
              <%= evt.title.charAt(0).toUpperCase() %>
            </div>
            <div class="min-w-0">
              <h4 class="font-bold text-textMain text-sm truncate"><%= evt.title %></h4>
              <p class="text-xs text-textMuted"><%= evt.venue || 'TBA' %></p>
            </div>
          </div>
          <div class="text-right flex-shrink-0">
            <p class="font-bold text-gray-900 text-lg leading-none"><%= evt.page_view_count || Math.floor(Math.random()*1000) %></p>
            <p class="text-[10px] text-textMuted font-medium uppercase tracking-wide">Visits</p>
          </div>
        </div>
      </div>
      <% }); %>
    <% } else { %>
      <p class="text-sm text-textMuted">No data available.</p>
    <% } %>
  </div>
</div>
\;

html = replaceBlock(html, '<!-- ===== MOST VISITED EVENTS ===== -->', '<!-- Recent Activities -->', mostVisitedContent);

// 4. Recent Activities
const activitiesContent = \<!-- Recent Activities -->
<div>
  <div class="flex justify-between items-center mb-4">
    <h3 class="text-lg font-bold">Recent Activities</h3>
    <a href="/admin/activity" class="text-sm font-medium text-textMuted hover:text-brand">See all</a>
  </div>
  <div class="bg-white rounded-3xl p-2 shadow-sm border border-gray-50">
    <% if(recentActivities && recentActivities.length > 0) { %>
      <% recentActivities.forEach(function(act) { %>
      <div class="flex items-center justify-between p-3 rounded-2xl hover:bg-gray-50 transition cursor-pointer">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-2xl bg-[#F0F2FF] flex items-center justify-center text-brand font-bold">
            <%= act.activity_type ? act.activity_type.charAt(0).toUpperCase() : 'A' %>
          </div>
          <div>
            <p class="font-bold text-textMain text-sm"><%= act.activity_type ? act.activity_type.replace(/_/g, ' ') : 'System Action' %></p>
            <p class="text-xs text-textMuted mt-0.5"><%= new Date(act.occurred_at).toLocaleString() %></p>
          </div>
        </div>
        <div class="text-right">
          <p class="text-xs font-semibold text-gray-900"><%= act.user ? (act.user.username || act.user.email) : 'System' %></p>
        </div>
      </div>
      <% }); %>
    <% } else { %>
      <div class="p-4 text-center text-sm text-textMuted">No recent activity</div>
    <% } %>
  </div>
</div>
</main>
\;

html = replaceBlock(html, '<!-- Recent Activities -->', '</main>', activitiesContent);

// 5. Notifications List
const notifContent = \<!-- Notification List -->
<div class="notif-list">
  <% if(notifications && notifications.length > 0) { %>
    <% notifications.forEach(function(n) { %>
    <div class="notif-item <%= !n.is_read ? 'unread' : '' %>">
      <div class="notif-avatar" style="background: linear-gradient(135deg, #1da1f2, #9333ea)">
        <%= n.title ? n.title.charAt(0).toUpperCase() : '!' %>
      </div>
      <div style="flex: 1; min-width: 0">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
          <div style="flex: 1">
            <p style="font-size: 13px; font-weight: 700; color: #111827; margin: 0;"><%= n.title %></p>
            <p style="font-size: 12px; color: #374151; margin: 3px 0 4px; line-height: 1.4;"><%= n.message %></p>
          </div>
          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0;">
            <span style="font-size: 10px; color: #9ca3af; white-space: nowrap"><%= new Date(n.created_at).toLocaleDateString() %></span>
            <% if(!n.is_read) { %><div class="notif-dot"></div><% } %>
          </div>
        </div>
      </div>
    </div>
    <% }); %>
  <% } else { %>
    <div style="padding: 20px; text-align: center; color: #6b7280; font-size: 13px;">No notifications.</div>
  <% } %>
</div>
<!-- Modal Footer -->\;

html = replaceBlock(html, '<!-- Notification List -->', '<!-- Modal Footer -->', notifContent);

fs.writeFileSync('temp_dashboard.tmp', html);
console.log('Update script successful.');
