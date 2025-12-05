/**
 * Migration Script: SQLite to MySQL (Aiven)
 * Transfers all tables and data cleanly from SQLite to MySQL database
 */

const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Helper function to get SSL CA certificate from environment
const getSSLConfig = () => {
    if (process.env.DB_SSL !== 'true') return false;
    if (process.env.DB_CA_CERT) {
        // Replace escaped newlines with actual newlines
        return { ca: process.env.DB_CA_CERT.replace(/\\n/g, '\n') };
    }
    return { rejectUnauthorized: false };
};

// SQLite Connection (Source)
const sqliteSequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../../db.sqlite3'),
    logging: false
});

// MySQL Connection (Destination - Aiven)
const mysqlSequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'mysql',
        dialectOptions: {
            ssl: getSSLConfig(),
            connectTimeout: 60000
        },
        logging: false,
        pool: {
            max: 10,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        define: {
            charset: 'utf8mb4',
            collate: 'utf8mb4_unicode_ci'
        }
    }
);

// Define models for SQLite (Source)
const SQLiteModels = {};

SQLiteModels.CampusMap = sqliteSequelize.define('CampusMap', {
    map_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(255), defaultValue: 'Campus Map' },
    blueprint_image: { type: DataTypes.STRING(500), allowNull: true },
    scale_meters_per_pixel: { type: DataTypes.FLOAT, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: 'campus_maps', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

SQLiteModels.Nodes = sqliteSequelize.define('Nodes', {
    node_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    node_code: { type: DataTypes.STRING(255), unique: true, allowNull: false },
    name: { type: DataTypes.STRING(255), allowNull: false },
    building: { type: DataTypes.STRING(255), allowNull: false },
    floor_level: { type: DataTypes.INTEGER, allowNull: false },
    type_of_node: { type: DataTypes.STRING(255), defaultValue: 'room' },
    image360: { type: DataTypes.STRING(500), allowNull: true },
    qrcode: { type: DataTypes.STRING(500), allowNull: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    map_x: { type: DataTypes.FLOAT, allowNull: true },
    map_y: { type: DataTypes.FLOAT, allowNull: true }
}, { tableName: 'nodes', timestamps: true, createdAt: 'created_at', updatedAt: false });

SQLiteModels.Edges = sqliteSequelize.define('Edges', {
    edge_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    from_node_id: { type: DataTypes.INTEGER, allowNull: false },
    to_node_id: { type: DataTypes.INTEGER, allowNull: false },
    distance: { type: DataTypes.FLOAT, allowNull: false },
    compass_angle: { type: DataTypes.FLOAT, allowNull: false },
    is_staircase: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: 'edges', timestamps: true, createdAt: 'created_at', updatedAt: false });

SQLiteModels.Annotation = sqliteSequelize.define('Annotation', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    panorama_id: { type: DataTypes.INTEGER, allowNull: false },
    target_node_id: { type: DataTypes.INTEGER, allowNull: true },
    label: { type: DataTypes.STRING(255), allowNull: false },
    yaw: { type: DataTypes.FLOAT, allowNull: false },
    pitch: { type: DataTypes.FLOAT, allowNull: false },
    visible_radius: { type: DataTypes.FLOAT, defaultValue: 10.0 },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: 'annotations', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

SQLiteModels.User = sqliteSequelize.define('User', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    username: { type: DataTypes.STRING(150), unique: true, allowNull: false },
    password: { type: DataTypes.STRING(255), allowNull: false },
    is_staff: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_superuser: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { tableName: 'users', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

// Define models for MySQL (Destination)
const MySQLModels = {};

MySQLModels.CampusMap = mysqlSequelize.define('CampusMap', {
    map_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(255), defaultValue: 'Campus Map' },
    blueprint_image: { type: DataTypes.STRING(500), allowNull: true },
    scale_meters_per_pixel: { type: DataTypes.FLOAT, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: 'campus_maps', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

MySQLModels.Nodes = mysqlSequelize.define('Nodes', {
    node_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    node_code: { type: DataTypes.STRING(255), unique: true, allowNull: false },
    name: { type: DataTypes.STRING(255), allowNull: false },
    building: { type: DataTypes.STRING(255), allowNull: false },
    floor_level: { type: DataTypes.INTEGER, allowNull: false },
    type_of_node: { type: DataTypes.STRING(255), defaultValue: 'room' },
    image360: { type: DataTypes.STRING(500), allowNull: true },
    qrcode: { type: DataTypes.STRING(500), allowNull: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    map_x: { type: DataTypes.FLOAT, allowNull: true },
    map_y: { type: DataTypes.FLOAT, allowNull: true }
}, { tableName: 'nodes', timestamps: true, createdAt: 'created_at', updatedAt: false });

MySQLModels.Edges = mysqlSequelize.define('Edges', {
    edge_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    from_node_id: { type: DataTypes.INTEGER, allowNull: false },
    to_node_id: { type: DataTypes.INTEGER, allowNull: false },
    distance: { type: DataTypes.FLOAT, allowNull: false },
    compass_angle: { type: DataTypes.FLOAT, allowNull: false },
    is_staircase: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: 'edges', timestamps: true, createdAt: 'created_at', updatedAt: false });

MySQLModels.Annotation = mysqlSequelize.define('Annotation', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    panorama_id: { type: DataTypes.INTEGER, allowNull: false },
    target_node_id: { type: DataTypes.INTEGER, allowNull: true },
    label: { type: DataTypes.STRING(255), allowNull: false },
    yaw: { type: DataTypes.FLOAT, allowNull: false },
    pitch: { type: DataTypes.FLOAT, allowNull: false },
    visible_radius: { type: DataTypes.FLOAT, defaultValue: 10.0 },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: 'annotations', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

MySQLModels.User = mysqlSequelize.define('User', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    username: { type: DataTypes.STRING(150), unique: true, allowNull: false },
    password: { type: DataTypes.STRING(255), allowNull: false },
    is_staff: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_superuser: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { tableName: 'users', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

// Migration function
async function migrateData() {
    try {
        console.log('🔍 Starting migration from SQLite to MySQL (Aiven)...\n');

        // Test connections
        console.log('📡 Testing SQLite connection...');
        await sqliteSequelize.authenticate();
        console.log('✅ SQLite connected successfully\n');

        console.log('📡 Testing MySQL (Aiven) connection...');
        await mysqlSequelize.authenticate();
        console.log('✅ MySQL connected successfully\n');

        // Create tables in MySQL
        console.log('🏗️  Creating tables in MySQL...');
        await mysqlSequelize.sync({ force: true });
        console.log('✅ Tables created successfully\n');

        // Migrate CampusMaps
        console.log('📦 Migrating CampusMaps...');
        const campusMaps = await SQLiteModels.CampusMap.findAll({ raw: true });
        if (campusMaps.length > 0) {
            for (const map of campusMaps) {
                await MySQLModels.CampusMap.create(map);
            }
            console.log(`✅ Migrated ${campusMaps.length} campus map(s)\n`);
        } else {
            console.log('ℹ️  No campus maps to migrate\n');
        }

        // Migrate Nodes
        console.log('📦 Migrating Nodes...');
        const nodes = await SQLiteModels.Nodes.findAll({ raw: true });
        if (nodes.length > 0) {
            for (const node of nodes) {
                await MySQLModels.Nodes.create(node);
            }
            console.log(`✅ Migrated ${nodes.length} node(s)\n`);
        } else {
            console.log('ℹ️  No nodes to migrate\n');
        }

        // Migrate Edges
        console.log('📦 Migrating Edges...');
        const edges = await SQLiteModels.Edges.findAll({ raw: true });
        if (edges.length > 0) {
            for (const edge of edges) {
                await MySQLModels.Edges.create(edge);
            }
            console.log(`✅ Migrated ${edges.length} edge(s)\n`);
        } else {
            console.log('ℹ️  No edges to migrate\n');
        }

        // Migrate Annotations
        console.log('📦 Migrating Annotations...');
        const annotations = await SQLiteModels.Annotation.findAll({ raw: true });
        if (annotations.length > 0) {
            for (const annotation of annotations) {
                await MySQLModels.Annotation.create(annotation);
            }
            console.log(`✅ Migrated ${annotations.length} annotation(s)\n`);
        } else {
            console.log('ℹ️  No annotations to migrate\n');
        }

        // Migrate Users
        console.log('📦 Migrating Users...');
        const users = await SQLiteModels.User.findAll({ raw: true });
        if (users.length > 0) {
            for (const user of users) {
                await MySQLModels.User.create(user);
            }
            console.log(`✅ Migrated ${users.length} user(s)\n`);
        } else {
            console.log('ℹ️  No users to migrate\n');
        }

        // Summary
        console.log('═══════════════════════════════════════');
        console.log('🎉 MIGRATION COMPLETED SUCCESSFULLY!');
        console.log('═══════════════════════════════════════');
        console.log(`✅ Campus Maps: ${campusMaps.length}`);
        console.log(`✅ Nodes: ${nodes.length}`);
        console.log(`✅ Edges: ${edges.length}`);
        console.log(`✅ Annotations: ${annotations.length}`);
        console.log(`✅ Users: ${users.length}`);
        console.log('═══════════════════════════════════════\n');

        console.log('ℹ️  Database is now using MySQL (Aiven)');
        console.log('ℹ️  You can safely backup db.sqlite3 if needed\n');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        await sqliteSequelize.close();
        await mysqlSequelize.close();
    }
}

// Run migration
migrateData()
    .then(() => {
        console.log('✅ Migration script completed');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Migration script failed:', error);
        process.exit(1);
    });
