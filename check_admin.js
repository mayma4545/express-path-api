const { User, sequelize } = require('./src/models');

async function checkAdmin() {
    try {
        await sequelize.authenticate();
        const admin = await User.findOne({ where: { username: 'admin' } });
        
        if (admin) {
            console.log('\n✅ Admin user found:');
            console.log(JSON.stringify({
                id: admin.id,
                username: admin.username,
                is_staff: admin.is_staff,
                is_superuser: admin.is_superuser
            }, null, 2));
        } else {
            console.log('\n❌ No admin user found in database');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkAdmin();
