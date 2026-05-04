/**
 * Super Admin Features Migration Script
 *
 * Creates/updates tables for:
 * - user profiles
 * - user status (online + login/logout tracking)
 * - user activities audit log
 * - node visit analytics
 *
 * Also seeds/updates a required super admin account:
 * username: superadmin
 * password: superadmin123
 */

require('dotenv').config();

const bcrypt = require('bcryptjs');
const { DataTypes } = require('sequelize');
const {
    sequelize,
    User,
    UserProfile,
    UserStatus,
    UserActivity
} = require('../models');

const SUPERADMIN_USERNAME = 'superadmin';
const SUPERADMIN_PASSWORD = 'superadmin123';

const tableExists = async (queryInterface, tableName) => {
    try {
        await queryInterface.describeTable(tableName);
        return true;
    } catch (error) {
        return false;
    }
};

const ensureColumn = async (queryInterface, tableName, columnName, definition) => {
    const columns = await queryInterface.describeTable(tableName);
    if (!columns[columnName]) {
        await queryInterface.addColumn(tableName, columnName, definition);
        console.log(`  + Added column ${tableName}.${columnName}`);
    }
};

const ensureUsersTableColumns = async (queryInterface) => {
    console.log('• Ensuring users table has admin role columns...');

    await ensureColumn(queryInterface, 'users', 'is_staff', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    });

    await ensureColumn(queryInterface, 'users', 'is_superuser', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    });
};

const ensureUserProfilesTable = async (queryInterface) => {
    const exists = await tableExists(queryInterface, 'user_profiles');

    if (!exists) {
        console.log('• Creating table user_profiles...');
        await queryInterface.createTable('user_profiles', {
            profile_id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                unique: true,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            full_name: {
                type: DataTypes.STRING(255),
                allowNull: false
            },
            age: {
                type: DataTypes.INTEGER,
                allowNull: true
            },
            department: {
                type: DataTypes.STRING(255),
                allowNull: true
            },
            email: {
                type: DataTypes.STRING(255),
                allowNull: true,
                unique: true
            },
            phone: {
                type: DataTypes.STRING(50),
                allowNull: true
            },
            position: {
                type: DataTypes.STRING(120),
                allowNull: true
            },
            created_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            },
            updated_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            }
        });
    } else {
        console.log('• Table user_profiles already exists, checking columns...');
        await ensureColumn(queryInterface, 'user_profiles', 'full_name', {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: 'Unknown User'
        });
        await ensureColumn(queryInterface, 'user_profiles', 'age', {
            type: DataTypes.INTEGER,
            allowNull: true
        });
        await ensureColumn(queryInterface, 'user_profiles', 'department', {
            type: DataTypes.STRING(255),
            allowNull: true
        });
        await ensureColumn(queryInterface, 'user_profiles', 'email', {
            type: DataTypes.STRING(255),
            allowNull: true,
            unique: true
        });
        await ensureColumn(queryInterface, 'user_profiles', 'phone', {
            type: DataTypes.STRING(50),
            allowNull: true
        });
        await ensureColumn(queryInterface, 'user_profiles', 'position', {
            type: DataTypes.STRING(120),
            allowNull: true
        });
    }
};

const ensureUserStatusTable = async (queryInterface) => {
    const exists = await tableExists(queryInterface, 'user_status');

    if (!exists) {
        console.log('• Creating table user_status...');
        await queryInterface.createTable('user_status', {
            status_id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                unique: true,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            is_online: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false
            },
            last_login_at: {
                type: DataTypes.DATE,
                allowNull: true
            },
            last_logout_at: {
                type: DataTypes.DATE,
                allowNull: true
            },
            last_activity_at: {
                type: DataTypes.DATE,
                allowNull: true
            },
            created_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            },
            updated_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            }
        });
    } else {
        console.log('• Table user_status already exists, checking columns...');
        await ensureColumn(queryInterface, 'user_status', 'is_online', {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        });
        await ensureColumn(queryInterface, 'user_status', 'last_login_at', {
            type: DataTypes.DATE,
            allowNull: true
        });
        await ensureColumn(queryInterface, 'user_status', 'last_logout_at', {
            type: DataTypes.DATE,
            allowNull: true
        });
        await ensureColumn(queryInterface, 'user_status', 'last_activity_at', {
            type: DataTypes.DATE,
            allowNull: true
        });
    }
};

const ensureUserActivitiesTable = async (queryInterface) => {
    const exists = await tableExists(queryInterface, 'user_activities');

    if (!exists) {
        console.log('• Creating table user_activities...');
        await queryInterface.createTable('user_activities', {
            activity_id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            activity_type: {
                type: DataTypes.STRING(50),
                allowNull: false
            },
            module: {
                type: DataTypes.STRING(100),
                allowNull: false
            },
            target_type: {
                type: DataTypes.STRING(100),
                allowNull: true
            },
            target_id: {
                type: DataTypes.STRING(100),
                allowNull: true
            },
            metadata: {
                type: DataTypes.JSON,
                allowNull: true
            },
            is_online: {
                type: DataTypes.BOOLEAN,
                allowNull: true
            },
            occurred_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            }
        });

        await queryInterface.addIndex('user_activities', ['user_id']);
        await queryInterface.addIndex('user_activities', ['activity_type']);
        await queryInterface.addIndex('user_activities', ['module']);
        await queryInterface.addIndex('user_activities', ['occurred_at']);
    } else {
        console.log('• Table user_activities already exists, checking columns...');
        await ensureColumn(queryInterface, 'user_activities', 'activity_type', {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: 'UNKNOWN'
        });
        await ensureColumn(queryInterface, 'user_activities', 'module', {
            type: DataTypes.STRING(100),
            allowNull: false,
            defaultValue: 'system'
        });
        await ensureColumn(queryInterface, 'user_activities', 'target_type', {
            type: DataTypes.STRING(100),
            allowNull: true
        });
        await ensureColumn(queryInterface, 'user_activities', 'target_id', {
            type: DataTypes.STRING(100),
            allowNull: true
        });
        await ensureColumn(queryInterface, 'user_activities', 'metadata', {
            type: DataTypes.JSON,
            allowNull: true
        });
        await ensureColumn(queryInterface, 'user_activities', 'is_online', {
            type: DataTypes.BOOLEAN,
            allowNull: true
        });
        await ensureColumn(queryInterface, 'user_activities', 'occurred_at', {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        });
    }
};

const ensureNodeVisitAnalyticsTable = async (queryInterface) => {
    const exists = await tableExists(queryInterface, 'node_visit_analytics');

    if (!exists) {
        console.log('• Creating table node_visit_analytics...');
        await queryInterface.createTable('node_visit_analytics', {
            visit_id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            node_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'nodes',
                    key: 'node_id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            source: {
                type: DataTypes.STRING(100),
                allowNull: false,
                defaultValue: 'mobile'
            },
            visited_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            }
        });

        await queryInterface.addIndex('node_visit_analytics', ['node_id']);
        await queryInterface.addIndex('node_visit_analytics', ['user_id']);
        await queryInterface.addIndex('node_visit_analytics', ['visited_at']);
    } else {
        console.log('• Table node_visit_analytics already exists, checking columns...');
        await ensureColumn(queryInterface, 'node_visit_analytics', 'source', {
            type: DataTypes.STRING(100),
            allowNull: false,
            defaultValue: 'mobile'
        });
        await ensureColumn(queryInterface, 'node_visit_analytics', 'visited_at', {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        });
    }
};

const ensureSuperAdminAccount = async () => {
    console.log(`• Ensuring super admin account (${SUPERADMIN_USERNAME})...`);

    const hashedPassword = await bcrypt.hash(SUPERADMIN_PASSWORD, 10);
    let superAdmin = await User.findOne({ where: { username: SUPERADMIN_USERNAME } });

    if (!superAdmin) {
        superAdmin = await User.create({
            username: SUPERADMIN_USERNAME,
            password: hashedPassword,
            is_staff: true,
            is_superuser: true
        });
        console.log('  + Super admin account created');
    } else {
        await superAdmin.update({
            password: hashedPassword,
            is_staff: true,
            is_superuser: true
        });
        console.log('  + Super admin account updated (password reset + role verified)');
    }

    const existingProfile = await UserProfile.findOne({ where: { user_id: superAdmin.id } });
    if (!existingProfile) {
        await UserProfile.create({
            user_id: superAdmin.id,
            full_name: 'Super Administrator',
            age: null,
            department: 'IT Administration',
            email: null,
            phone: null,
            position: 'System Administrator'
        });
        console.log('  + Super admin profile created');
    }

    const existingStatus = await UserStatus.findOne({ where: { user_id: superAdmin.id } });
    if (!existingStatus) {
        await UserStatus.create({
            user_id: superAdmin.id,
            is_online: false,
            last_activity_at: new Date()
        });
        console.log('  + Super admin status row created');
    }

    await UserActivity.create({
        user_id: superAdmin.id,
        activity_type: 'SYSTEM_SEED',
        module: 'users',
        target_type: 'user',
        target_id: String(superAdmin.id),
        metadata: {
            username: SUPERADMIN_USERNAME,
            note: 'Super admin account ensured by migration script'
        },
        is_online: false,
        occurred_at: new Date()
    });
};

async function runMigration() {
    const queryInterface = sequelize.getQueryInterface();

    try {
        console.log('Starting super admin features migration...');
        await sequelize.authenticate();
        console.log('Database connection established.');

        await ensureUsersTableColumns(queryInterface);
        await ensureUserProfilesTable(queryInterface);
        await ensureUserStatusTable(queryInterface);
        await ensureUserActivitiesTable(queryInterface);
        await ensureNodeVisitAnalyticsTable(queryInterface);

        await ensureSuperAdminAccount();

        console.log('Migration completed successfully.');
        console.log('Super admin credentials:');
        console.log(`  username: ${SUPERADMIN_USERNAME}`);
        console.log(`  password: ${SUPERADMIN_PASSWORD}`);

        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
