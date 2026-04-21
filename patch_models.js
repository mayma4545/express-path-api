const fs = require('fs');

let content = fs.readFileSync('./src/models/index.js', 'utf8');

const newModel = `
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

`;

if (!content.includes('EventSystemActivityLog')) {
    // Inject near the bottom, before module.exports
    content = content.replace('module.exports = {', newModel + '\nmodule.exports = {\n    EventSystemActivityLog,');
    fs.writeFileSync('./src/models/index.js', content);
    console.log('Model added.');
} else {
    console.log('Model already exists.');
}
