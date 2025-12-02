/**
 * Seed Data Script
 * Creates initial admin user and sample data
 */

const bcrypt = require('bcryptjs');
const { sequelize, User, Nodes, Edges, CampusMap } = require('../models');

async function seedData() {
    try {
        console.log('🔄 Seeding database...');
        
        await sequelize.authenticate();
        console.log('✅ Database connection established');
        
        // Don't alter tables, just sync
        await sequelize.sync({ alter: false });
        
        // Create admin user if not exists
        const existingAdmin = await User.findOne({ where: { username: 'admin' } });
        if (!existingAdmin) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await User.create({
                username: 'admin',
                password: hashedPassword,
                is_staff: true,
                is_superuser: true
            });
            console.log('✅ Admin user created (username: admin, password: admin123)');
        } else {
            console.log('ℹ️ Admin user already exists');
        }
        
        // Check if we have any nodes
        const nodeCount = await Nodes.count();
        if (nodeCount === 0) {
            console.log('ℹ️ No nodes found. You can add nodes through the web interface.');
        } else {
            console.log(`ℹ️ Found ${nodeCount} existing nodes`);
        }
        
        console.log('🎉 Seed complete!');
        console.log('\n📝 Default credentials:');
        console.log('   Username: admin');
        console.log('   Password: admin123');
        console.log('\n⚠️  Change these credentials in production!');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Seed failed:', error);
        process.exit(1);
    }
}

seedData();
