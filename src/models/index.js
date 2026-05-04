/**
 * Database Models - Sequelize ORM
 * Mirrors Django models for Campus Navigation System
 */

const { Sequelize, DataTypes } = require('sequelize');

// Helper function to get SSL CA certificate from environment
const getSSLConfig = () => {
    if (process.env.DB_SSL !== 'true') return false;
    
    // For Aiven and other MySQL providers with self-signed certificates
    const ssl = {
        rejectUnauthorized: false
    };
    
    if (process.env.DB_CA_CERT && 
        process.env.DB_CA_CERT.trim() !== '' && 
        process.env.DB_CA_CERT.includes('BEGIN CERTIFICATE')) {
        ssl.ca = process.env.DB_CA_CERT.replace(/\\n/g, '\n');
        ssl.rejectUnauthorized = true;
    }
    
    return ssl;
};

// Initialize Sequelize with MySQL (Aiven)
const sequelize = new Sequelize(
    process.env.DB_NAME || 'defaultdb',
    process.env.DB_USER || 'avnadmin',
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST || 'map-fernandezmayma-c63d.c.aivencloud.com',
        port: process.env.DB_PORT || 11343,
        dialect: 'mysql',
        dialectOptions: {
            ssl: getSSLConfig(),
            connectTimeout: 60000
        },
        logging: false,//process.env.NODE_ENV === 'development' ? console.log : false,
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

// CampusMap Model
const CampusMap = sequelize.define('CampusMap', {
    map_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(255),
        defaultValue: 'Campus Map'
    },
    blueprint_image: {
        type: DataTypes.STRING(500),
        allowNull: true
    },
    scale_meters_per_pixel: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'campus_maps',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// Nodes Model
const Nodes = sequelize.define('Nodes', {
    node_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    node_code: {
        type: DataTypes.STRING(255),
        unique: true,
        allowNull: false
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    building: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    floor_level: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    type_of_node: {
        type: DataTypes.STRING(255),
        defaultValue: 'room'
    },
    image360: {
        type: DataTypes.STRING(500),
        allowNull: true
    },
    qrcode: {
        type: DataTypes.STRING(500),
        allowNull: true
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    map_x: {
        type: DataTypes.FLOAT,
        allowNull: true,
        validate: {
            min: 0.0,
            max: 100.0
        }
    },
    map_y: {
        type: DataTypes.FLOAT,
        allowNull: true,
        validate: {
            min: 0.0,
            max: 100.0
        }
    },
    annotation: {
        type: DataTypes.FLOAT,
        allowNull: true,
        comment: 'Initial view angle (0-360°) for the 360° panorama viewer'
    }
}, {
    tableName: 'nodes',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

// Edges Model
const Edges = sequelize.define('Edges', {
    edge_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    from_node_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'nodes',
            key: 'node_id'
        }
    },
    to_node_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'nodes',
            key: 'node_id'
        }
    },
    distance: {
        type: DataTypes.FLOAT,
        allowNull: false,
        validate: {
            min: 0.0
        }
    },
    compass_angle: {
        type: DataTypes.FLOAT,
        allowNull: false,
        validate: {
            min: 0.0
        }
    },
    is_staircase: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'edges',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

// Annotation Model
const Annotation = sequelize.define('Annotation', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    panorama_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'nodes',
            key: 'node_id'
        }
    },
    target_node_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'nodes',
            key: 'node_id'
        }
    },
    label: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    yaw: {
        type: DataTypes.FLOAT,
        allowNull: false,
        validate: {
            min: -180.0,
            max: 180.0
        }
    },
    pitch: {
        type: DataTypes.FLOAT,
        allowNull: false,
        validate: {
            min: -90.0,
            max: 90.0
        }
    },
    visible_radius: {
        type: DataTypes.FLOAT,
        defaultValue: 10.0,
        validate: {
            min: 0.0,
            max: 180.0
        }
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'annotations',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        {
            unique: true,
            fields: ['panorama_id', 'yaw', 'pitch', 'label']
        }
    ]
});

// User Model (for admin authentication)
const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    username: {
        type: DataTypes.STRING(150),
        unique: true,
        allowNull: false
    },
    password: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    is_staff: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    is_superuser: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// User Profile Model (super admin managed extended user data)
const UserProfile = sequelize.define('UserProfile', {
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
        }
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
    }
}, {
    tableName: 'user_profiles',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// User Status Model (online state + login timestamps)
const UserStatus = sequelize.define('UserStatus', {
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
        }
    },
    is_online: {
        type: DataTypes.BOOLEAN,
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
    }
}, {
    tableName: 'user_status',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// User Activity Model (tracks staff/superadmin actions)
const UserActivity = sequelize.define('UserActivity', {
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
        }
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
}, {
    tableName: 'user_activities',
    timestamps: false,
    indexes: [
        { fields: ['user_id'] },
        { fields: ['activity_type'] },
        { fields: ['module'] },
        { fields: ['occurred_at'] }
    ]
});

// Node Visit Analytics Model (for frequent destination analytics)
const NodeVisitAnalytics = sequelize.define('NodeVisitAnalytics', {
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
        }
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id'
        }
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
}, {
    tableName: 'node_visit_analytics',
    timestamps: false,
    indexes: [
        { fields: ['node_id'] },
        { fields: ['user_id'] },
        { fields: ['visited_at'] }
    ]
});

// Event Model
const Event = sequelize.define('Event', {
    event_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    event_name: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    category: {
        type: DataTypes.STRING(100),
        allowNull: true,
        validate: {
            isIn: [['Academic', 'Social', 'Sports', 'Career', 'Workshop', 'Conference', 'Cultural', 'Other']]
        }
    },
    node_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'nodes',
            key: 'node_id'
        }
    },
    start_datetime: {
        type: DataTypes.DATE,
        allowNull: true
    },
    end_datetime: {
        type: DataTypes.DATE,
        allowNull: true
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    is_featured: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    tableName: 'events',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// Guest Survey Model
const Guest = sequelize.define('Guest', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    display_type: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    guest_type: {
        type: DataTypes.STRING(255),
        allowNull: false
    }
}, {
    tableName: 'GUEST',
    timestamps: true
});

// Define Associations with CASCADE delete
Edges.belongsTo(Nodes, { foreignKey: 'from_node_id', as: 'from_node', onDelete: 'CASCADE' });
Edges.belongsTo(Nodes, { foreignKey: 'to_node_id', as: 'to_node', onDelete: 'CASCADE' });
Nodes.hasMany(Edges, { foreignKey: 'from_node_id', as: 'from_edges', onDelete: 'CASCADE' });
Nodes.hasMany(Edges, { foreignKey: 'to_node_id', as: 'to_edges', onDelete: 'CASCADE' });

Annotation.belongsTo(Nodes, { foreignKey: 'panorama_id', as: 'panorama', onDelete: 'CASCADE' });
Annotation.belongsTo(Nodes, { foreignKey: 'target_node_id', as: 'target_node', onDelete: 'SET NULL' });
Nodes.hasMany(Annotation, { foreignKey: 'panorama_id', as: 'annotations', onDelete: 'CASCADE' });

Event.belongsTo(Nodes, { foreignKey: 'node_id', as: 'location', onDelete: 'CASCADE' });
Nodes.hasMany(Event, { foreignKey: 'node_id', as: 'events', onDelete: 'CASCADE' });

User.hasOne(UserProfile, { foreignKey: 'user_id', as: 'profile', onDelete: 'CASCADE' });
UserProfile.belongsTo(User, { foreignKey: 'user_id', as: 'user', onDelete: 'CASCADE' });

User.hasOne(UserStatus, { foreignKey: 'user_id', as: 'status', onDelete: 'CASCADE' });
UserStatus.belongsTo(User, { foreignKey: 'user_id', as: 'user', onDelete: 'CASCADE' });

User.hasMany(UserActivity, { foreignKey: 'user_id', as: 'activities', onDelete: 'SET NULL' });
UserActivity.belongsTo(User, { foreignKey: 'user_id', as: 'actor', onDelete: 'SET NULL' });

User.hasMany(NodeVisitAnalytics, { foreignKey: 'user_id', as: 'node_visits', onDelete: 'SET NULL' });
NodeVisitAnalytics.belongsTo(User, { foreignKey: 'user_id', as: 'visitor', onDelete: 'SET NULL' });
Nodes.hasMany(NodeVisitAnalytics, { foreignKey: 'node_id', as: 'visits', onDelete: 'CASCADE' });
NodeVisitAnalytics.belongsTo(Nodes, { foreignKey: 'node_id', as: 'node', onDelete: 'CASCADE' });

module.exports = {
    sequelize,
    Sequelize,
    CampusMap,
    Nodes,
    Edges,
    Annotation,
    User,
    UserProfile,
    UserStatus,
    UserActivity,
    NodeVisitAnalytics,
    Event,
    Guest
};
