-- Admin demo data dump for organizers/events UI
-- Import manually if needed: mysql -u <user> -p <db_name> < src/scripts/admin_demo_dump.sql

INSERT INTO categories (name, color_hex, created_at)
VALUES
  ('Conference', '#6366F1', NOW()),
  ('Workshop', '#0EA5E9', NOW()),
  ('Community', '#10B981', NOW()),
  ('Academic', '#F59E0B', NOW())
ON DUPLICATE KEY UPDATE color_hex = VALUES(color_hex);

INSERT INTO organizers (name, avatar_url, description, average_rating, created_at)
VALUES
  ('Tech Guild Masbate', 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=300&h=300&fit=crop', 'Community-driven organizer for developer and startup events in Masbate.', 4.80, NOW()),
  ('Campus Events Council', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&h=300&fit=crop', 'Official student-led organizer handling university programs and fairs.', 4.60, NOW()),
  ('Creative Youth Hub', 'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?w=300&h=300&fit=crop', 'Arts, media, and culture initiatives focused on youth development.', 4.70, NOW())
ON DUPLICATE KEY UPDATE
  avatar_url = VALUES(avatar_url),
  description = VALUES(description),
  average_rating = VALUES(average_rating);

INSERT INTO events (
  title,
  category_id,
  organizer_id,
  venue,
  description,
  event_date,
  start_time,
  end_time,
  latitude,
  longitude,
  image_url,
  is_ongoing,
  created_at,
  updated_at
)
SELECT
  'Masbate Tech Summit 2026',
  c.id,
  o.id,
  'Auditorium A',
  'A full-day summit on AI, web platforms, and startup innovation.',
  DATE_ADD(CURDATE(), INTERVAL 3 DAY),
  '09:00:00',
  '17:00:00',
  12.36810000,
  123.61910000,
  'https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&h=800&fit=crop',
  0,
  NOW(),
  NOW()
FROM categories c
JOIN organizers o ON o.name = 'Tech Guild Masbate'
WHERE c.name = 'Conference'
  AND NOT EXISTS (SELECT 1 FROM events e WHERE e.title = 'Masbate Tech Summit 2026');

INSERT INTO events (
  title,
  category_id,
  organizer_id,
  venue,
  description,
  event_date,
  start_time,
  end_time,
  latitude,
  longitude,
  image_url,
  is_ongoing,
  created_at,
  updated_at
)
SELECT
  'Student Leadership Workshop',
  c.id,
  o.id,
  'Room 401',
  'Leadership and project execution workshop for student organizations.',
  DATE_ADD(CURDATE(), INTERVAL 5 DAY),
  '13:00:00',
  '16:00:00',
  12.36920000,
  123.62040000,
  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&h=800&fit=crop',
  0,
  NOW(),
  NOW()
FROM categories c
JOIN organizers o ON o.name = 'Campus Events Council'
WHERE c.name = 'Workshop'
  AND NOT EXISTS (SELECT 1 FROM events e WHERE e.title = 'Student Leadership Workshop');

INSERT INTO events (
  title,
  category_id,
  organizer_id,
  venue,
  description,
  event_date,
  start_time,
  end_time,
  latitude,
  longitude,
  image_url,
  is_ongoing,
  created_at,
  updated_at
)
SELECT
  'Creative Culture Night',
  c.id,
  o.id,
  'Open Grounds',
  'Music, visual arts, and live performances by local youth artists.',
  DATE_ADD(CURDATE(), INTERVAL 8 DAY),
  '18:00:00',
  '21:00:00',
  12.36740000,
  123.62120000,
  'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200&h=800&fit=crop',
  0,
  NOW(),
  NOW()
FROM categories c
JOIN organizers o ON o.name = 'Creative Youth Hub'
WHERE c.name = 'Community'
  AND NOT EXISTS (SELECT 1 FROM events e WHERE e.title = 'Creative Culture Night');
