/**
 * Seed admin demo data for organizer/events pages.
 * Adds categories, organizers, and events using current schema fields.
 */

require('dotenv').config();

const { Category, Organizer, Event, sequelize } = require('../models');
const bcrypt = require('bcryptjs');
const { AppUser } = require('../models');

const categorySeeds = [
  { name: 'Conference', color_hex: '#6366F1' },
  { name: 'Workshop', color_hex: '#0EA5E9' },
  { name: 'Community', color_hex: '#10B981' },
  { name: 'Academic', color_hex: '#F59E0B' }
];

const organizerSeeds = [
  {
    name: 'Tech Guild Masbate',
    first_name: 'Tech',
    last_name: 'Guild',
    email: 'tech.guild.masbate@organizer.local',
    password: 'organizer123',
    avatar_url: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=300&h=300&fit=crop',
    description: 'Community-driven organizer for developer and startup events in Masbate.',
    average_rating: 4.8
  },
  {
    name: 'Campus Events Council',
    first_name: 'Campus',
    last_name: 'Council',
    email: 'campus.events@organizer.local',
    password: 'organizer123',
    avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&h=300&fit=crop',
    description: 'Official student-led organizer handling university programs and fairs.',
    average_rating: 4.6
  },
  {
    name: 'Creative Youth Hub',
    first_name: 'Creative',
    last_name: 'Hub',
    email: 'creative.hub@organizer.local',
    password: 'organizer123',
    avatar_url: 'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?w=300&h=300&fit=crop',
    description: 'Arts, media, and culture initiatives focused on youth development.',
    average_rating: 4.7
  }
];

async function findOrCreateCategory(seed) {
  const [category] = await Category.findOrCreate({
    where: { name: seed.name },
    defaults: seed
  });
  return category;
}

async function findOrCreateOrganizer(seed) {
  const passwordHash = await bcrypt.hash(seed.password, 10);
  const [account] = await AppUser.findOrCreate({
    where: { email: seed.email },
    defaults: {
      first_name: seed.first_name,
      last_name: seed.last_name,
      email: seed.email,
      password_hash: passwordHash,
      avatar_url: seed.avatar_url
    }
  });

  const [organizer] = await Organizer.findOrCreate({
    where: { name: seed.name },
    defaults: {
      name: seed.name,
      user_id: account.id,
      avatar_url: seed.avatar_url,
      description: seed.description,
      average_rating: seed.average_rating
    }
  });

  if (!organizer.user_id) {
    organizer.user_id = account.id;
    await organizer.save();
  }

  return organizer;
}

function dateParts(daysFromNow, startHour, endHour) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');

  return {
    event_date: `${yyyy}-${mm}-${dd}`,
    start_time: `${String(startHour).padStart(2, '0')}:00:00`,
    end_time: `${String(endHour).padStart(2, '0')}:00:00`
  };
}

async function run() {
  try {
    await sequelize.authenticate();

    const categories = {};
    for (const seed of categorySeeds) {
      const category = await findOrCreateCategory(seed);
      categories[seed.name] = category;
    }

    const organizers = {};
    for (const seed of organizerSeeds) {
      const organizer = await findOrCreateOrganizer(seed);
      organizers[seed.name] = organizer;
    }

    const eventSeeds = [
      {
        title: 'Masbate Tech Summit 2026',
        venue: 'Auditorium A',
        description: 'A full-day summit on AI, web platforms, and startup innovation.',
        image_url: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&h=800&fit=crop',
        category_name: 'Conference',
        organizer_name: 'Tech Guild Masbate',
        coords: { latitude: 12.3681, longitude: 123.6191 },
        time: dateParts(3, 9, 17)
      },
      {
        title: 'Student Leadership Workshop',
        venue: 'Room 401',
        description: 'Leadership and project execution workshop for student organizations.',
        image_url: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&h=800&fit=crop',
        category_name: 'Workshop',
        organizer_name: 'Campus Events Council',
        coords: { latitude: 12.3692, longitude: 123.6204 },
        time: dateParts(5, 13, 16)
      },
      {
        title: 'Creative Culture Night',
        venue: 'Open Grounds',
        description: 'Music, visual arts, and live performances by local youth artists.',
        image_url: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200&h=800&fit=crop',
        category_name: 'Community',
        organizer_name: 'Creative Youth Hub',
        coords: { latitude: 12.3674, longitude: 123.6212 },
        time: dateParts(8, 18, 21)
      }
    ];

    for (const seed of eventSeeds) {
      const exists = await Event.findOne({ where: { title: seed.title } });
      if (exists) {
        continue;
      }

      await Event.create({
        title: seed.title,
        venue: seed.venue,
        description: seed.description,
        image_url: seed.image_url,
        category_id: categories[seed.category_name].id,
        organizer_id: organizers[seed.organizer_name].id,
        latitude: seed.coords.latitude,
        longitude: seed.coords.longitude,
        event_date: seed.time.event_date,
        start_time: seed.time.start_time,
        end_time: seed.time.end_time,
        is_ongoing: false
      });
    }

    const [totalOrganizers, totalCategories, totalEvents] = await Promise.all([
      Organizer.count(),
      Category.count(),
      Event.count()
    ]);

    console.log('Admin demo data ready.');
    console.log(`Organizers: ${totalOrganizers}`);
    console.log(`Categories: ${totalCategories}`);
    console.log(`Events: ${totalEvents}`);

    process.exit(0);
  } catch (error) {
    console.error('Failed to seed admin demo data:', error.message);
    process.exit(1);
  }
}

run();
