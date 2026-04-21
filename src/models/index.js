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
    },
    profile_image: {
        type: DataTypes.TEXT('long'),
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
    },
    is_read: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
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
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    title: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    category_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'categories',
            key: 'id'
        }
    },
    organizer_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'organizers',
            key: 'id'
        }
    },
    venue: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    event_date: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    end_date: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    start_time: {
        type: DataTypes.TIME,
        allowNull: false
    },
    end_time: {
        type: DataTypes.TIME,
        allowNull: false
    },
    latitude: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: true
    },
    longitude: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: true
    },
    image_url: {
        type: DataTypes.STRING(500),
        allowNull: true
    },
    is_ongoing: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    status: {
        type: DataTypes.ENUM('draft', 'published', 'cancelled', 'completed'),
        defaultValue: 'published'
    },
    capacity: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    recurrence_type: {
        type: DataTypes.ENUM('none', 'daily', 'weekly', 'monthly', 'yearly', 'once'),
        defaultValue: 'none'
    },
    recurrence_end_date: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    tags: {
        type: DataTypes.STRING(255),
        allowNull: true
    }
}, {
    tableName: 'events',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// Category Model
const Category = sequelize.define('Category', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    color_hex: {
        type: DataTypes.STRING(10),
        allowNull: false
    }
}, {
    tableName: 'categories',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

// AppUser Model (renamed from Users to avoid admin conflict)
const AppUser = sequelize.define('AppUser', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    first_name: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    last_name: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    email: {
        type: DataTypes.STRING(255),
        unique: true,
        allowNull: false
    },
    password_hash: {
        type: DataTypes.STRING(255),
        allowNull: true // Changed to allow null for Google Sign-Up without password initially
    },
    avatar_url: {
        type: DataTypes.STRING(500),
        allowNull: true
    }
}, {
    tableName: 'app_users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// Organizer Model
const Organizer = sequelize.define('Organizer', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        unique: true,
        references: {
            model: 'app_users',
            key: 'id'
        }
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    address: {
        type: DataTypes.STRING(500),
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected'),
        defaultValue: 'pending'
    },
    avatar_url: {
        type: DataTypes.STRING(500),
        allowNull: true
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    average_rating: {
        type: DataTypes.DECIMAL(3, 2),
        defaultValue: 0.00
    }
}, {
    tableName: 'organizers',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

// Event Likes Model
const EventLike = sequelize.define('EventLike', {
    user_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        references: {
            model: 'app_users',
            key: 'id'
        }
    },
    event_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        references: {
            model: 'events',
            key: 'id'
        }
    }
}, {
    tableName: 'event_likes',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

// Event Photos Model
const EventPhoto = sequelize.define('EventPhoto', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    event_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'events',
            key: 'id'
        }
    },
    image_url: {
        type: DataTypes.STRING(500),
        allowNull: false
    },
    caption: {
        type: DataTypes.STRING(255),
        allowNull: true
    }
}, {
    tableName: 'event_photos',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

// Comments Model
const Comment = sequelize.define('Comment', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    event_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'events',
            key: 'id'
        }
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'app_users',
            key: 'id'
        }
    },
    parent_comment_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'comments',
            key: 'id'
        }
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false
    }
}, {
    tableName: 'comments',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// Comment Reactions Model
const CommentReaction = sequelize.define('CommentReaction', {
    user_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        references: {
            model: 'app_users',
            key: 'id'
        }
    },
    comment_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        references: {
            model: 'comments',
            key: 'id'
        }
    }
}, {
    tableName: 'comment_reactions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
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

// Event Attendee / RSVP Model
const EventAttendee = sequelize.define('EventAttendee', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    event_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'events',
            key: 'id'
        }
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'app_users',
            key: 'id'
        }
    },
    status: {
        type: DataTypes.ENUM('registered', 'attended', 'cancelled'),
        defaultValue: 'registered'
    },
    check_in_time: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'event_attendees',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// Event Analytics Model
const EventAnalytics = sequelize.define('EventAnalytics', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    event_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'events',
            key: 'id'
        }
    },
    scan_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    view_count_360: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    page_view_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
}, {
    tableName: 'event_analytics',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// Define Associations with CASCADE delete
Edges.belongsTo(Nodes, { foreignKey: 'from_node_id', as: 'from_node', onDelete: 'CASCADE' });
Edges.belongsTo(Nodes, { foreignKey: 'to_node_id', as: 'to_node', onDelete: 'CASCADE' });
Nodes.hasMany(Edges, { foreignKey: 'from_node_id', as: 'from_edges', onDelete: 'CASCADE' });
Nodes.hasMany(Edges, { foreignKey: 'to_node_id', as: 'to_edges', onDelete: 'CASCADE' });

Annotation.belongsTo(Nodes, { foreignKey: 'panorama_id', as: 'panorama', onDelete: 'CASCADE' });
Annotation.belongsTo(Nodes, { foreignKey: 'target_node_id', as: 'target_node', onDelete: 'SET NULL' });
Nodes.hasMany(Annotation, { foreignKey: 'panorama_id', as: 'annotations', onDelete: 'CASCADE' });

// Event associations are disabled because node_id was removed from the new schema
// Event.belongsTo(Nodes, { foreignKey: 'node_id', as: 'location', onDelete: 'CASCADE' });
// Nodes.hasMany(Event, { foreignKey: 'node_id', as: 'events', onDelete: 'CASCADE' });

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

Event.belongsTo(Category, { foreignKey: 'category_id', as: 'category', onDelete: 'SET NULL' });
Category.hasMany(Event, { foreignKey: 'category_id', as: 'events', onDelete: 'SET NULL' });

Event.belongsTo(Organizer, { foreignKey: 'organizer_id', as: 'organizer', onDelete: 'CASCADE' });
Organizer.hasMany(Event, { foreignKey: 'organizer_id', as: 'events', onDelete: 'CASCADE' });

Organizer.belongsTo(AppUser, { foreignKey: 'user_id', as: 'account', onDelete: 'SET NULL' });
AppUser.hasOne(Organizer, { foreignKey: 'user_id', as: 'organizer_profile', onDelete: 'SET NULL' });

AppUser.belongsToMany(Event, { through: EventLike, foreignKey: 'user_id', as: 'liked_events' });
Event.belongsToMany(AppUser, { through: EventLike, foreignKey: 'event_id', as: 'liked_by_users' });

EventPhoto.belongsTo(Event, { foreignKey: 'event_id', as: 'event', onDelete: 'CASCADE' });
Event.hasMany(EventPhoto, { foreignKey: 'event_id', as: 'photos', onDelete: 'CASCADE' });

Comment.belongsTo(Event, { foreignKey: 'event_id', as: 'event', onDelete: 'CASCADE' });
Event.hasMany(Comment, { foreignKey: 'event_id', as: 'comments', onDelete: 'CASCADE' });

Comment.belongsTo(AppUser, { foreignKey: 'user_id', as: 'user', onDelete: 'CASCADE' });
AppUser.hasMany(Comment, { foreignKey: 'user_id', as: 'comments', onDelete: 'CASCADE' });

Comment.belongsTo(Comment, { foreignKey: 'parent_comment_id', as: 'parent_comment', onDelete: 'CASCADE' });
Comment.hasMany(Comment, { foreignKey: 'parent_comment_id', as: 'replies', onDelete: 'CASCADE' });

AppUser.belongsToMany(Comment, { through: CommentReaction, foreignKey: 'user_id', as: 'reacted_comments' });
Comment.belongsToMany(AppUser, { through: CommentReaction, foreignKey: 'comment_id', as: 'reacted_by_users' });

// EventAttendee Associations
EventAttendee.belongsTo(Event, { foreignKey: 'event_id', as: 'event', onDelete: 'CASCADE' });
Event.hasMany(EventAttendee, { foreignKey: 'event_id', as: 'attendees', onDelete: 'CASCADE' });
EventAttendee.belongsTo(AppUser, { foreignKey: 'user_id', as: 'user', onDelete: 'CASCADE' });
AppUser.hasMany(EventAttendee, { foreignKey: 'user_id', as: 'attended_events', onDelete: 'CASCADE' });

// EventAnalytics Associations
EventAnalytics.belongsTo(Event, { foreignKey: 'event_id', as: 'event', onDelete: 'CASCADE' });
Event.hasOne(EventAnalytics, { foreignKey: 'event_id', as: 'analytics', onDelete: 'CASCADE' });

// EventAnnouncement Model
const EventAnnouncement = sequelize.define('EventAnnouncement', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    event_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'events',
            key: 'id'
        }
    },
    title: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    body: {
        type: DataTypes.TEXT,
        allowNull: false
    }
}, {
    tableName: 'event_announcements',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

// EventAnnouncement Associations
EventAnnouncement.belongsTo(Event, { foreignKey: 'event_id', as: 'event', onDelete: 'CASCADE' });
Event.hasMany(EventAnnouncement, { foreignKey: 'event_id', as: 'announcements', onDelete: 'CASCADE' });

// OrganizerNotification Model
const OrganizerNotification = sequelize.define('OrganizerNotification', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    organizer_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'organizers',
            key: 'id'
        }
    },
    event_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'events',
            key: 'id'
        }
    },
    user_type: {
        type: DataTypes.ENUM('organizer', 'admin'),
        defaultValue: 'organizer'
    },
    type: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    target_id: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    is_read: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    tableName: 'organizer_notifications',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

// OrganizerNotification Associations
OrganizerNotification.belongsTo(Organizer, { foreignKey: 'organizer_id', as: 'organizer', onDelete: 'CASCADE' });
Organizer.hasMany(OrganizerNotification, { foreignKey: 'organizer_id', as: 'notifications', onDelete: 'CASCADE' });

OrganizerNotification.belongsTo(Event, { foreignKey: 'event_id', as: 'event', onDelete: 'CASCADE' });
Event.hasMany(OrganizerNotification, { foreignKey: 'event_id', as: 'organizer_notifications', onDelete: 'CASCADE' });


// Event System Activity Log (tracks organizer actions)
const EventSystemActivityLog = sequelize.define('EventSystemActivityLog', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    organizer_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'organizers',
            key: 'id'
        }
    },
    activity_type: {
        type: DataTypes.STRING(50),
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
    is_read: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    occurred_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'event_system_activity_logs',
    timestamps: false
});

// Associations for EventSystemActivityLog
EventSystemActivityLog.belongsTo(Organizer, { foreignKey: 'organizer_id', as: 'organizer_actor', onDelete: 'SET NULL' });
Organizer.hasMany(EventSystemActivityLog, { foreignKey: 'organizer_id', as: 'event_system_activities', onDelete: 'SET NULL' });


module.exports = {
    EventSystemActivityLog,
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
    EventAttendee,
    EventAnalytics,
    Category,
    AppUser,
    Organizer,
    EventLike,
    EventPhoto,
    Comment,
    CommentReaction,
    Guest,
    EventAnnouncement,
    OrganizerNotification
};
