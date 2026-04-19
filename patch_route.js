const fs = require('fs');
let c = fs.readFileSync('src/routes/organizer/index.js', 'utf8');

const regex = /router\.post\('\/events\/:id\/update'[\\s\\S]*?await event\.update\(updateData\);\s*res\.redirect\(\\/organizer\/events\/\$\{event\.id\}\\);\s*\} catch \(error\) \{/m;

const replacement = \outer.post('/events/:id/update', requireOrganizerAuth, multer({ storage: memoryStorage }).single('image'), async (req, res) => {
    try {
        const organizerId = req.session.organizerAuth.organizerId;
        const event = await Event.findOne({ 
            where: { id: req.params.id, organizer_id: organizerId }
        });
        
        if (!event) {
            return res.status(404).render('error', { title: 'Not Found', message: 'Event not found' });
        }
        
        const { title, description, venue, event_date, end_date, start_time, end_time, capacity, category_id, is_ongoing, tags, latitude, longitude, recurrence_type, recurrence_end_date, day_of_week, day_of_month } = req.body;
        
        let tagsToSave = event.tags; // keep existing if no tags sent
        if (tags !== undefined) {
            tagsToSave = Array.isArray(tags) ? tags.join(', ') : tags;
        }

        let calculatedEventDate = event_date || event.event_date;
        let finalEndDate = end_date && end_date.trim() ? end_date : calculatedEventDate;

        if (recurrence_type && recurrence_type !== 'once' && recurrence_type !== 'none') {
            if (recurrence_type === 'daily') {
                calculatedEventDate = new Date().toISOString().split('T')[0];
                finalEndDate = calculatedEventDate;
            } else if (recurrence_type === 'weekly' && day_of_week !== undefined) {
                const targetDay = parseInt(day_of_week, 10);
                const today = new Date();
                let daysUntilNext = targetDay - today.getDay();
                if (daysUntilNext < 0) daysUntilNext += 7;
                const nextDate = new Date(today.getTime() + daysUntilNext * 24 * 60 * 60 * 1000);
                calculatedEventDate = nextDate.toISOString().split('T')[0];
                finalEndDate = calculatedEventDate;
            } else if (recurrence_type === 'monthly' && day_of_month !== undefined) {
                const targetDay = parseInt(day_of_month, 10);
                const today = new Date();
                let nextDate = new Date(today.getFullYear(), today.getMonth(), targetDay);
                if (nextDate < today) {
                    nextDate = new Date(today.getFullYear(), today.getMonth() + 1, targetDay);
                }
                if (nextDate.getDate() !== targetDay) {
                    nextDate = new Date(nextDate.getFullYear(), nextDate.getMonth(), 0);
                }
                calculatedEventDate = nextDate.toISOString().split('T')[0];
                finalEndDate = calculatedEventDate;
            }
        }
        
        const updateData = {
            title: title || event.title,
            name: title || event.name,
            description: description !== undefined ? description : event.description,
            venue: venue || event.venue,
            event_date: calculatedEventDate,
            end_date: finalEndDate,
            start_time: start_time || event.start_time,
            end_time: end_time || event.end_time,
            is_ongoing: is_ongoing === 'true' || is_ongoing === 'on' || is_ongoing === '1',
            tags: tagsToSave,
            recurrence_type: recurrence_type === 'once' ? 'none' : (recurrence_type || event.recurrence_type),
            recurrence_end_date: recurrence_end_date && recurrence_type !== 'once' && recurrence_type !== 'none' ? recurrence_end_date : null
        };

        if (capacity) updateData.capacity = parseInt(capacity, 10);
        if (category_id) updateData.category_id = parseInt(category_id, 10);
        if (latitude) updateData.latitude = parseFloat(latitude);
        if (longitude) updateData.longitude = parseFloat(longitude);
        
        if (req.file && req.file.buffer) {
            updateData.image_url = await uploadBufferToCloudinary(req.file.buffer, 'campus-navigator/event-posters');
        }

        await event.update(updateData);
        
        res.redirect(\/organizer/events/\\);
    } catch (error) {\;

c = c.replace(regex, replacement);

fs.writeFileSync('src/routes/organizer/index.js', c, 'utf8');
console.log('Update route patched!');
