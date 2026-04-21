const fs = require('fs');

let content = fs.readFileSync('./src/views/admin/activity.ejs', 'utf8');

const oldAllLogs = content.substring(content.indexOf('const ALL_LOGS = ['), content.indexOf('];', content.indexOf('const ALL_LOGS = [')) + 2);

const newAllLogs = `const ALL_LOGS = <%- JSON.stringify(locals.activities ? locals.activities.map(a => {
        let icon = 'calendar';
        let iconClass = 'icon-blue';
        let badgeClass = 'badge-blue';
        
        let type = a.activity_type || 'System Action';
        let title = type.replace(/_/g, ' ');
        let sub = (a.actor ? a.actor.username : 'System') + (a.module ? ' · ' + a.module : '');
        let badge = a.target_type || 'Action';
        
        if (title.includes('CANCEL') || title.includes('DELETE') || title.includes('REJECT')) {
            icon = 'cancel'; iconClass = 'icon-red'; badgeClass = 'badge-red';
        } else if (title.includes('WARN') || title.includes('FLAG') || title.includes('ERROR')) {
            icon = 'warn'; iconClass = 'icon-amber'; badgeClass = 'badge-amber';
        } else if (title.includes('APPROVE') || title.includes('VERIFY') || title.includes('CREATE')) {
            icon = 'check'; iconClass = 'icon-green'; badgeClass = 'badge-green';
        } else if (title.includes('USER') || title.includes('LOGIN')) {
            icon = 'user';
        }
        
        let dateObj = new Date(a.occurred_at);
        let today = new Date();
        let yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        let day;
        if (dateObj.toDateString() === today.toDateString()) {
            day = 'Today';
        } else if (dateObj.toDateString() === yesterday.toDateString()) {
            day = 'Yesterday';
        } else {
            day = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
        
        let time = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        let organizer = a.actor ? a.actor.username : 'System';
        
        return {
            id: a.activity_id,
            is_read: a.is_read,
            day: day,
            icon: icon,
            iconClass: iconClass,
            title: title,
            sub: sub,
            badge: badge,
            badgeClass: badgeClass,
            time: time,
            organizer: organizer
        };
      }) : []) %>;

      function markAsRead(id, element) {
        if (!element.classList.contains('unread-log')) return;
        
        fetch('/admin/activity/' + id + '/read', { method: 'POST' })
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              element.classList.remove('unread-log');
              element.style.backgroundColor = '';
              const titleEl = element.querySelector('.log-title');
              if (titleEl) {
                titleEl.style.fontWeight = '';
                titleEl.style.color = '';
              }
              // Update badge count
              const badges = document.querySelectorAll('.activity-badge');
              badges.forEach(b => {
                let count = parseInt(b.innerText, 10);
                if (!isNaN(count) && count > 0) {
                    count--;
                    if (count === 0) {
                        b.style.display = 'none';
                    } else {
                        b.innerText = count;
                    }
                }
              });
              // Update in ALL_LOGS
              const log = ALL_LOGS.find(l => l.id === id);
              if (log) log.is_read = true;
            }
          })
          .catch(err => console.error(err));
      }
`;

content = content.replace(oldAllLogs, newAllLogs);

const oldRenderLogItemLoop = `map[day].forEach((l, i) => {
            html += \`
              <div class="log-item" style="animation-delay:\${i * 40}ms">
                <div class="log-icon \${l.iconClass}">\${ICONS[l.icon]}</div>
                <div class="log-body">
                  <div class="log-title">\${l.title}</div>
                  <div class="log-sub">\${l.sub}</div>
                </div>
                <div class="log-right">
                  <span class="log-badge \${l.badgeClass}">\${l.badge}</span>
                  <div class="log-time">\${l.time}</div>
                </div>
              </div>\`;
          });`;

const newRenderLogItemLoop = `map[day].forEach((l, i) => {
            const unreadClass = !l.is_read ? 'unread-log' : '';
            const unreadStyle = !l.is_read ? 'background-color: #eff6ff;' : '';
            const unreadTitleStyle = !l.is_read ? 'font-weight: 700; color: #1e3a8a;' : '';
            
            html += \`
              <div class="log-item \${unreadClass}" style="animation-delay:\${i * 40}ms; cursor: pointer; \${unreadStyle}" onclick="markAsRead(\${l.id}, this)">
                <div class="log-icon \${l.iconClass}">\${ICONS[l.icon] || ICONS.calendar}</div>
                <div class="log-body">
                  <div class="log-title" style="\${unreadTitleStyle}">\${l.title}</div>
                  <div class="log-sub">\${l.sub}</div>
                </div>
                <div class="log-right">
                  <span class="log-badge \${l.badgeClass}">\${l.badge}</span>
                  <div class="log-time">\${l.time}</div>
                </div>
              </div>\`;
          });`;

content = content.replace(oldRenderLogItemLoop, newRenderLogItemLoop);

fs.writeFileSync('./src/views/admin/activity.ejs', content);
console.log('activity.ejs successfully updated');
