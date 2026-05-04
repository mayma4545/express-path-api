/**
 * Seed Events Script
 * Creates sample events for testing
 */

const { Event, Nodes, sequelize } = require('../models');

async function seedEvents() {
  try {
    console.log('🌱 Starting event seeding...\n');

    // Get first 6 nodes for testing
    const nodes = await Nodes.findAll({ limit: 6 });
    
    if (nodes.length < 6) {
      console.error('❌ Error: Need at least 6 nodes in database');
      console.log('Please add nodes first before seeding events');
      process.exit(1);
    }

    console.log(`Found ${nodes.length} nodes:`);
    nodes.forEach(n => console.log(`  - ${n.node_code}: ${n.name}`));
    console.log('');

    // Clear existing test events (optional)
    const existingCount = await Event.count();
    if (existingCount > 0) {
      console.log(`Found ${existingCount} existing events`);
      console.log('Clearing existing events...');
      await Event.destroy({ where: {}, truncate: true });
      console.log('✅ Cleared\n');
    }

    // Sample events
    const events = [
      {
        event_name: 'Career Fair 2024',
        description: 'Annual career fair with 50+ employers from tech, finance, and healthcare industries. Great networking opportunity!',
        category: 'Career',
        node_id: nodes[0].node_id,
        start_datetime: new Date('2024-12-01T09:00:00'),
        end_datetime: new Date('2024-12-01T17:00:00'),
        is_active: true,
        is_featured: true,
      },
      {
        event_name: 'AI & Machine Learning Workshop',
        description: 'Introduction to Machine Learning using Python and TensorFlow. Hands-on coding session.',
        category: 'Workshop',
        node_id: nodes[1].node_id,
        start_datetime: new Date('2024-12-05T14:00:00'),
        end_datetime: new Date('2024-12-05T16:00:00'),
        is_active: true,
        is_featured: false,
      },
      {
        event_name: 'Inter-Department Basketball Tournament',
        description: 'Join us for an exciting basketball tournament. Teams from all departments compete for the championship trophy.',
        category: 'Sports',
        node_id: nodes[2].node_id,
        start_datetime: new Date('2024-12-10T10:00:00'),
        end_datetime: new Date('2024-12-10T15:00:00'),
        is_active: true,
        is_featured: false,
      },
      {
        event_name: 'Cultural Night 2024',
        description: 'Celebrate diversity with music, dance, and food from around the world. Traditional performances and international cuisine.',
        category: 'Cultural',
        node_id: nodes[3].node_id,
        start_datetime: new Date('2024-12-15T18:00:00'),
        end_datetime: new Date('2024-12-15T22:00:00'),
        is_active: true,
        is_featured: true,
      },
      {
        event_name: 'Web Development Bootcamp',
        description: 'Learn HTML, CSS, and JavaScript in this intensive 3-day bootcamp. Build your own website!',
        category: 'Academic',
        node_id: nodes[4].node_id,
        start_datetime: new Date('2024-12-18T09:00:00'),
        end_datetime: new Date('2024-12-20T17:00:00'),
        is_active: true,
        is_featured: true,
      },
      {
        event_name: 'Graduation Ceremony 2023',
        description: 'Past event - Graduation ceremony for Class of 2023',
        category: 'Academic',
        node_id: nodes[5].node_id,
        start_datetime: new Date('2023-06-15T10:00:00'),
        end_datetime: new Date('2023-06-15T14:00:00'),
        is_active: true,
        is_featured: false,
      },
      {
        event_name: 'Inactive Test Event',
        description: 'This event is inactive and should not be visible to users',
        category: 'Other',
        node_id: nodes[0].node_id,
        start_datetime: new Date('2024-12-25T10:00:00'),
        end_datetime: new Date('2024-12-25T12:00:00'),
        is_active: false,
        is_featured: false,
      },
      {
        event_name: 'Upcoming Conference',
        description: 'Annual technology conference with keynote speakers and panel discussions',
        category: 'Conference',
        node_id: nodes[1].node_id,
        start_datetime: new Date('2025-01-15T09:00:00'),
        end_datetime: new Date('2025-01-17T17:00:00'),
        is_active: true,
        is_featured: true,
      },
      {
        event_name: 'Social Mixer',
        description: 'Meet new people and make friends at our casual social gathering',
        category: 'Social',
        node_id: nodes[2].node_id,
        start_datetime: new Date('2024-12-08T17:00:00'),
        end_datetime: new Date('2024-12-08T20:00:00'),
        is_active: true,
        is_featured: false,
      },
      {
        event_name: 'Health & Wellness Fair',
        description: 'Free health screenings, fitness demos, and wellness resources',
        category: 'Other',
        node_id: nodes[3].node_id,
        start_datetime: new Date('2024-12-12T10:00:00'),
        end_datetime: new Date('2024-12-12T16:00:00'),
        is_active: true,
        is_featured: false,
      },
    ];

    console.log('Creating events...\n');

    let created = 0;
    for (const eventData of events) {
      const event = await Event.create(eventData);
      const nodeInfo = nodes.find(n => n.node_id === eventData.node_id);
      
      console.log(`✅ Created: "${event.event_name}"`);
      console.log(`   Category: ${event.category}`);
      console.log(`   Location: ${nodeInfo.name} (${nodeInfo.node_code})`);
      console.log(`   Date: ${event.start_datetime.toLocaleDateString()}`);
      console.log(`   Active: ${event.is_active ? 'Yes' : 'No'}`);
      console.log(`   Featured: ${event.is_featured ? 'Yes' : 'No'}`);
      console.log('');
      
      created++;
    }

    console.log(`\n✅ Successfully created ${created} events!\n`);
    
    // Summary
    const stats = {
      total: await Event.count(),
      active: await Event.count({ where: { is_active: true } }),
      featured: await Event.count({ where: { is_featured: true } }),
      past: await Event.count({
        where: {
          end_datetime: {
            [require('sequelize').Op.lt]: new Date()
          }
        }
      })
    };

    console.log('📊 Event Statistics:');
    console.log(`   Total Events: ${stats.total}`);
    console.log(`   Active Events: ${stats.active}`);
    console.log(`   Featured Events: ${stats.featured}`);
    console.log(`   Past Events: ${stats.past}`);
    console.log('');
    
    console.log('🎉 Event seeding complete!');
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding events:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the seed function
seedEvents();
