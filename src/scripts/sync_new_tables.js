const { sequelize, Event, EventAttendee, EventAnalytics } = require('../models');

async function syncNewTables() {
    try {
        console.log('Authenticating database connection...');
        await sequelize.authenticate();
        
        console.log('Syncing Event table (alter: true to add new fields)...');
        await Event.sync({ alter: true });
        
        console.log('Syncing EventAttendee table...');
        await EventAttendee.sync({ alter: true });
        
        console.log('Syncing EventAnalytics table...');
        await EventAnalytics.sync({ alter: true });

        console.log('Successfully synced new models and fields.');
    } catch (error) {
        console.error('Error syncing:', error);
    } finally {
        await sequelize.close();
        process.exit();
    }
}

syncNewTables();
