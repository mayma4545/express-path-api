const { sequelize } = require('./models');

async function syncDatabase() {
    try {
        console.log('Connecting to database and syncing models...');
        await sequelize.sync({ alter: true });
        console.log('All tables synced successfully with Sequelize!');
    } catch (error) {
        console.error('Error syncing tables:', error);
    } finally {
        process.exit();
    }
}

syncDatabase();