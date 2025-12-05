/**
 * Database Models - Sequelize ORM
 * Mirrors Django models for Campus Navigation System
 */

const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
const fs = require('fs');

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
            ssl: process.env.DB_SSL === 'true' ? {
                ca: fs.readFileSync(path.join(__dirname, '../../ca-certificate.pem')).toString()
            } : false,
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

// Define Associations with CASCADE delete
Edges.belongsTo(Nodes, { foreignKey: 'from_node_id', as: 'from_node', onDelete: 'CASCADE' });
Edges.belongsTo(Nodes, { foreignKey: 'to_node_id', as: 'to_node', onDelete: 'CASCADE' });
Nodes.hasMany(Edges, { foreignKey: 'from_node_id', as: 'from_edges', onDelete: 'CASCADE' });
Nodes.hasMany(Edges, { foreignKey: 'to_node_id', as: 'to_edges', onDelete: 'CASCADE' });

Annotation.belongsTo(Nodes, { foreignKey: 'panorama_id', as: 'panorama', onDelete: 'CASCADE' });
Annotation.belongsTo(Nodes, { foreignKey: 'target_node_id', as: 'target_node', onDelete: 'SET NULL' });
Nodes.hasMany(Annotation, { foreignKey: 'panorama_id', as: 'annotations', onDelete: 'CASCADE' });

module.exports = {
    sequelize,
    Sequelize,
    CampusMap,
    Nodes,
    Edges,
    Annotation,
    User
};
