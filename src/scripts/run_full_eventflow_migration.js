require('dotenv').config();
const { sequelize } = require('../models/index');

async function runMigration() {
    try {
        console.log('Connecting to the database...');
        await sequelize.authenticate();
        console.log('Connected successfully. Starting EventFlow schema creation...');

        // Disable foreign key checks to drop dependent tables first
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');

        // 1. Categories
        console.log('Creating categories table...');
        await sequelize.query('DROP TABLE IF EXISTS categories;');
        await sequelize.query(`
            CREATE TABLE categories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                color_hex VARCHAR(10) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 2. App Users (Renamed from users to preserve admin 'users' table)
        console.log('Creating app_users table...');
        await sequelize.query('DROP TABLE IF EXISTS app_users;');
        await sequelize.query(`
            CREATE TABLE app_users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                avatar_url VARCHAR(500),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            );
        `);

        // 3. Organizers
        console.log('Creating organizers table...');
        await sequelize.query('DROP TABLE IF EXISTS organizers;');
        await sequelize.query(`
            CREATE TABLE organizers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                avatar_url VARCHAR(500),
                description TEXT,
                average_rating DECIMAL(3, 2) DEFAULT 0.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 4. Events
        console.log('Creating events table...');
        await sequelize.query('DROP TABLE IF EXISTS events;');
        await sequelize.query(`
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
                CONSTRAINT fk_events_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
                CONSTRAINT fk_events_organizer FOREIGN KEY (organizer_id) REFERENCES organizers(id) ON DELETE CASCADE
            );
        `);

        // 5. Event Likes
        console.log('Creating event_likes table...');
        await sequelize.query('DROP TABLE IF EXISTS event_likes;');
        await sequelize.query(`
            CREATE TABLE event_likes (
                user_id INT NOT NULL,
                event_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, event_id),
                CONSTRAINT fk_likes_user FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE,
                CONSTRAINT fk_likes_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
            );
        `);

        // 6. Event Photos
        console.log('Creating event_photos table...');
        await sequelize.query('DROP TABLE IF EXISTS event_photos;');
        await sequelize.query(`
            CREATE TABLE event_photos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                event_id INT NOT NULL,
                image_url VARCHAR(500) NOT NULL,
                caption VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_photos_events FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
            );
        `);

        // 7. Comments
        console.log('Creating comments table...');
        await sequelize.query('DROP TABLE IF EXISTS comments;');
        await sequelize.query(`
            CREATE TABLE comments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                event_id INT NOT NULL,
                user_id INT NOT NULL,
                parent_comment_id INT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_comments_events FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
                CONSTRAINT fk_comments_users FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE,
                CONSTRAINT fk_comments_parents FOREIGN KEY (parent_comment_id) REFERENCES comments(id) ON DELETE CASCADE
            );
        `);

        // 8. Comment Reactions
        console.log('Creating comment_reactions table...');
        await sequelize.query('DROP TABLE IF EXISTS comment_reactions;');
        await sequelize.query(`
            CREATE TABLE comment_reactions (
                user_id INT NOT NULL,
                comment_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, comment_id),
                CONSTRAINT fk_reactions_users FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE,
                CONSTRAINT fk_reactions_comments FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
            );
        `);

        // 9. Indexes
        console.log('Adding Indexes...');
        await sequelize.query('CREATE INDEX idx_events_date ON events(event_date);');
        await sequelize.query('CREATE INDEX idx_events_category ON events(category_id);');
        await sequelize.query('CREATE INDEX idx_comments_event ON comments(event_id);');
        await sequelize.query('CREATE INDEX idx_comments_parent ON comments(parent_comment_id);');

        // Re-enable foreign key checks
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');

        console.log('Successfully created the full EventFlow schema in the Aiven DB!');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await sequelize.close();
    }
}

runMigration();