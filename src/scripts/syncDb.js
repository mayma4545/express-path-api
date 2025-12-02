/**
 * Database Sync Script
 * Run this to initialize or update the database schema
 */

const { sequelize } = require('../models');

async function syncDatabase() {
    try {
        console.log('🔄 Syncing database...');
        
        await sequelize.authenticate();
        console.log('✅ Database connection established');
        
        // Use alter: true to update existing tables without dropping data
        await sequelize.sync({ alter: true });
        console.log('✅ Database models synchronized');
        
        console.log('🎉 Database sync complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Database sync failed:', error);
        process.exit(1);
    }
}

syncDatabase();
