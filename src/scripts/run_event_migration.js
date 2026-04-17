require('dotenv').config();
const { sequelize } = require('../models/index');

async function runMigration() {
    try {
        console.log('Connecting to the database...');
        await sequelize.authenticate();
        console.log('Connected successfully.');

        // Disable foreign key checks temporarily to drop existing table
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');

        console.log('Ensuring categories table exists...');
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS categories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL
            );
        `);

        console.log('Ensuring organizers table exists...');
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS organizers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL
            );
        `);

        console.log('Dropping existing events table...');
        await sequelize.query('DROP TABLE IF EXISTS events;');

        console.log('Creating new events table based on the specified schema...');
        // Adjusted for MySQL dialect. Replaced SERIAL with INT AUTO_INCREMENT.
        // Fixed category_id logic (ON DELETE SET NULL requires NULLable column, taking priority over NOT NULL constraint)
        const createEventsQuery = `
            CREATE TABLE events (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                category_id INT NULL,
                organizer_id INT NOT NULL,
                venue VARCHAR(255) NOT NULL,
                description TEXT,
                event_date DATE NOT NULL,
                start_time TIME NOT NULL,
                end_time TIME NOT NULL,
                latitude DECIMAL(10, 8),
                longitude DECIMAL(11, 8),
                image_url VARCHAR(500),
                is_ongoing BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_event_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
                CONSTRAINT fk_event_organizer FOREIGN KEY (organizer_id) REFERENCES organizers(id) ON DELETE CASCADE
            );
        `;
        await sequelize.query(createEventsQuery);

        console.log('Successfully altered the events table in the Aiven DB!');

        // Re-enable foreign key checks
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await sequelize.close();
    }
}

runMigration();