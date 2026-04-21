const fs = require('fs');

let code = fs.readFileSync('src/models/index.js', 'utf-8');

const newModels = \
// EventBookmark Model
const EventBookmark = sequelize.define('EventBookmark', {
    user_id: { type: DataTypes.INTEGER, primaryKey: true, references: { model: 'app_users', key: 'id' } },
    event_id: { type: DataTypes.INTEGER, primaryKey: true, references: { model: 'events', key: 'id' } }
}, { tableName: 'event_bookmarks', timestamps: true, createdAt: 'created_at', updatedAt: false });

// EventVisit Model
const EventVisit = sequelize.define('EventVisit', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    event_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'events', key: 'id' } },
    user_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'app_users', key: 'id' } } // Optional if they are a guest
}, { tableName: 'event_visits', timestamps: true, createdAt: 'created_at', updatedAt: false });

// EventRating Model
const EventRating = sequelize.define('EventRating', {
    user_id: { type: DataTypes.INTEGER, primaryKey: true, references: { model: 'app_users', key: 'id' } },
    event_id: { type: DataTypes.INTEGER, primaryKey: true, references: { model: 'events', key: 'id' } },
    rating: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, max: 5 } }
}, { tableName: 'event_ratings', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });
\;

code = code.replace("// Event Likes Model", newModels + "\\n// Event Likes Model");

const newAssociations = \
// Bookmark Associations
AppUser.belongsToMany(Event, { through: EventBookmark, foreignKey: 'user_id', as: 'bookmarked_events' });
Event.belongsToMany(AppUser, { through: EventBookmark, foreignKey: 'event_id', as: 'bookmarked_by_users' });
EventBookmark.belongsTo(AppUser, { foreignKey: 'user_id', as: 'user' });
EventBookmark.belongsTo(Event, { foreignKey: 'event_id', as: 'event' });

// Visit Associations
EventVisit.belongsTo(Event, { foreignKey: 'event_id', as: 'event', onDelete: 'CASCADE' });
Event.hasMany(EventVisit, { foreignKey: 'event_id', as: 'visits', onDelete: 'CASCADE' });
EventVisit.belongsTo(AppUser, { foreignKey: 'user_id', as: 'user', onDelete: 'SET NULL' });
AppUser.hasMany(EventVisit, { foreignKey: 'user_id', as: 'event_visits', onDelete: 'SET NULL' });

// Rating Associations
EventRating.belongsTo(Event, { foreignKey: 'event_id', as: 'event', onDelete: 'CASCADE' });
Event.hasMany(EventRating, { foreignKey: 'event_id', as: 'ratings', onDelete: 'CASCADE' });
EventRating.belongsTo(AppUser, { foreignKey: 'user_id', as: 'user', onDelete: 'CASCADE' });
AppUser.hasMany(EventRating, { foreignKey: 'user_id', as: 'ratings', onDelete: 'CASCADE' });
\;

code = code.replace("Event.belongsToMany(AppUser, { through: EventLike, foreignKey: 'event_id', as: 'liked_by_users' });", 
"Event.belongsToMany(AppUser, { through: EventLike, foreignKey: 'event_id', as: 'liked_by_users' });\\n" + newAssociations);

code = code.replace("    EventLike,", "    EventLike,\\n    EventBookmark,\\n    EventVisit,\\n    EventRating,");

fs.writeFileSync('src/models/index.js', code);
