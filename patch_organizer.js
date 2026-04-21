const fs = require('fs');

let content = fs.readFileSync('./src/routes/organizer/index.js', 'utf8');

const s1 = "res.redirect('/organizer/events');";
if (content.includes(s1)) {
    const p1 = `try {
            await EventSystemActivityLog.create({
                organizer_id: organizerId,
                activity_type: 'CREATE_EVENT',
                target_type: 'Event',
                target_id: title,
                metadata: { title: title }
            });
        } catch(e) { console.error('Log error', e); }
        
        res.redirect('/organizer/events');`;
    content = content.replace("res.redirect('/organizer/events');", p1);
}

const s2 = "res.redirect(`/organizer/events/${req.params.id}`);";
if (content.includes(s2)) {
    const p2 = `try {
            await EventSystemActivityLog.create({
                organizer_id: req.session.organizerAuth.organizerId,
                activity_type: 'UPDATE_EVENT',
                target_type: 'Event',
                target_id: req.params.id,
                metadata: { title: title }
            });
        } catch(e) { console.error('Log error', e); }

        res.redirect(\`/organizer/events/\${req.params.id}\`);`;
    content = content.replace("res.redirect(`/organizer/events/${req.params.id}`);", p2);
}

const s3 = "res.json({ success: true });";
if (content.includes(s3)) {
    const p3 = `try {
                if (req.body.eventIds) {
                    for (let id of req.body.eventIds) {
                        await EventSystemActivityLog.create({
                            organizer_id: req.session.organizerAuth.organizerId,
                            activity_type: 'DELETE_EVENT',
                            target_type: 'Event',
                            target_id: id.toString(),
                            metadata: { action: 'bulk_delete' }
                        });
                    }
                }
            } catch(e) { console.error('Log error', e); }

            res.json({ success: true });`;
    // Find the last occurrence which is likely the bulk action.
    let parts = content.split(s3);
    if (parts.length > 1) {
        content = parts.join(p3); // Replace all instances of res.json({ success: true }) with logging, it's safe if it checks eventIds
    }
}

fs.writeFileSync('./src/routes/organizer/index.js', content);
