const { User, sequelize } = require('./models');
const bcrypt = require('bcryptjs');

async function createAdmin() {
    try {
        await sequelize.sync(); // Ensure tables exist

        const username = 'admin4545';
        const password = 'japs4545Q';

        const existingUser = await User.findOne({ where: { username } });
        if (existingUser) {
            console.log('Admin user already exists.');
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await User.create({
            username,
            password: hashedPassword
        });

        console.log('Admin user created successfully!');
    } catch (error) {
        console.error('Error creating admin user:', error);
    } finally {
        process.exit();
    }
}

createAdmin();
