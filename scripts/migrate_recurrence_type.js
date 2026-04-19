/**
 * Migration Script: Update recurrence_type enum from 'none' to 'once'
 * 
 * This script:
 * 1. Updates all existing 'none' values to 'once' in the events table
 * 2. Modifies the enum column definition (if supported by your database)
 * 
 * Run with: npm run db:migrate:recurrence
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { sequelize, Event } = require('../src/models');

async function migrate() {
  try {
    console.log('Starting recurrence_type migration...');

    // Update all existing 'none' values to 'once'
    const updatedCount = await Event.update(
      { recurrence_type: 'once' },
      { where: { recurrence_type: 'none' } }
    );

    console.log(`✓ Updated ${updatedCount[0]} events with recurrence_type='none' to 'once'`);

    // Optional: Drop and recreate the column with new ENUM values
    // This is database-specific and depends on your MySQL version
    try {
      const query = `
        ALTER TABLE events 
        MODIFY COLUMN recurrence_type 
        ENUM('once', 'daily', 'weekly', 'monthly', 'yearly') 
        DEFAULT 'once' NOT NULL
      `;
      
      await sequelize.query(query);
      console.log('✓ Updated recurrence_type column definition');
    } catch (columnError) {
      console.warn('⚠ Could not modify column directly. This might require manual SQL.');
      console.warn('If you see enum errors, run this SQL manually:');
      console.warn(`ALTER TABLE events MODIFY COLUMN recurrence_type ENUM('once', 'daily', 'weekly', 'monthly', 'yearly') DEFAULT 'once' NOT NULL;`);
    }

    console.log('✓ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

migrate();
