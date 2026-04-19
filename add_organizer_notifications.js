const fs = require('fs');
const path = require('path');
const modelsFile = path.join(__dirname, 'src/models/index.js');
let content = fs.readFileSync(modelsFile, 'utf8');

const modelStr = \
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
    type: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: false
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

\;

if (!content.includes('const OrganizerNotification')) {
    content = content.replace('module.exports = {', modelStr + 'module.exports = {');
    content = content.replace('EventAnnouncement\\r\\n};', 'EventAnnouncement,\\r\\n    OrganizerNotification\\r\\n};');
    content = content.replace('EventAnnouncement\\n};', 'EventAnnouncement,\\n    OrganizerNotification\\n};');
    fs.writeFileSync(modelsFile, content);
    console.log('Added OrganizerNotification model to src/models/index.js');
}

const { sequelize, OrganizerNotification } = require('./src/models');
OrganizerNotification.sync({ alter: true }).then(() => {
    console.log('OrganizerNotification table created/altered in DB');
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});

