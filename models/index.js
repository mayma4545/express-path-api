const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// --- Define Models ---

const Campus = sequelize.define('Campus', {
    name: { type: DataTypes.STRING, allowNull: false },
    location: DataTypes.STRING,
    about: DataTypes.TEXT
}, { tableName: 'campus', timestamps: false });

const CampusPhoto = sequelize.define('CampusPhoto', {
    image_url: DataTypes.STRING
}, { tableName: 'campus_photos', timestamps: false });

const Department = sequelize.define('Department', {
    name: { type: DataTypes.STRING, allowNull: false },
    description: DataTypes.TEXT,
    image_url: DataTypes.STRING
}, { tableName: 'department', timestamps: false });

const Facility = sequelize.define('Facility', {
    name: { type: DataTypes.STRING, allowNull: false },
    type: DataTypes.STRING,
    image_url: DataTypes.STRING,
    department_id: DataTypes.INTEGER
}, { tableName: 'facilities', timestamps: false });

const Photo = sequelize.define('Photo', {
    image_url: DataTypes.STRING,
    type: DataTypes.STRING,
    department_id: DataTypes.INTEGER
}, { tableName: 'photos', timestamps: false });

const Event = sequelize.define('Event', {
    name: { type: DataTypes.STRING, allowNull: false },
    about: DataTypes.TEXT,
    start_date: DataTypes.DATEONLY,
    end_date: DataTypes.DATEONLY,
    start_time: DataTypes.STRING,
    end_time: DataTypes.STRING,
    venue: DataTypes.STRING,
    event_organizer_name: DataTypes.STRING,
    event_organizer_image_url: DataTypes.STRING
}, { tableName: 'events', timestamps: false });

const EventPhoto = sequelize.define('EventPhoto', {
    image_url: DataTypes.STRING,
    type: DataTypes.STRING
}, { tableName: 'event_photos', timestamps: false });

const Program = sequelize.define('Program', {
    description_name: DataTypes.STRING,
    code_name: DataTypes.STRING,
    image_url: DataTypes.STRING
}, { tableName: 'programs', timestamps: false });

const HeadOfficer = sequelize.define('HeadOfficer', {
    fullname: { type: DataTypes.STRING, allowNull: false },
    position: DataTypes.STRING,
    image_url: DataTypes.STRING
}, { tableName: 'heads_officers', timestamps: false });

const Staff = sequelize.define('Staff', {
    fullname: { type: DataTypes.STRING, allowNull: false },
    position: DataTypes.STRING,
    image_url: DataTypes.STRING,
    department_id: DataTypes.INTEGER,
    offices_id: DataTypes.INTEGER
}, { tableName: 'staff', timestamps: false });

const Office = sequelize.define('Office', {
    name: { type: DataTypes.STRING, allowNull: false },
    about: DataTypes.TEXT
}, { tableName: 'offices', timestamps: false });

const OfficePhoto = sequelize.define('OfficePhoto', {
    type: DataTypes.STRING,
    image_url: DataTypes.STRING
}, { tableName: 'offices_photos', timestamps: false });

const FacilityPhoto = sequelize.define('FacilityPhoto', {
    image_url: DataTypes.STRING,
    facility_id: DataTypes.INTEGER
}, { tableName: 'facility_photos', timestamps: false });

const User = sequelize.define('User', {
    username: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false }
}, { tableName: 'users', timestamps: false });

const Navigation = sequelize.define('Navigation', {
    node_id: DataTypes.INTEGER,
    type: DataTypes.STRING,
    image_url: DataTypes.STRING,
    directional_text: DataTypes.TEXT,
    step_order: { type: DataTypes.INTEGER, defaultValue: 0 }
}, { tableName: 'navigation', timestamps: false });

// --- Define Associations (Relationships) ---

// Campus -> CampusPhotos
Campus.hasMany(CampusPhoto, { foreignKey: 'campus_id', onDelete: 'CASCADE' });
CampusPhoto.belongsTo(Campus, { foreignKey: 'campus_id' });

// Campus -> Department
Campus.hasMany(Department, { foreignKey: 'campus_id', onDelete: 'SET NULL' });
Department.belongsTo(Campus, { foreignKey: 'campus_id' });

// Campus -> Offices
Campus.hasMany(Office, { foreignKey: 'campus_id', onDelete: 'SET NULL' });
Office.belongsTo(Campus, { foreignKey: 'campus_id' });

// Department -> Facilities
Department.hasMany(Facility, { foreignKey: 'department_id', onDelete: 'CASCADE' });
Facility.belongsTo(Department, { foreignKey: 'department_id' });

// Department -> Photos
Department.hasMany(Photo, { foreignKey: 'department_id', onDelete: 'CASCADE' });
Photo.belongsTo(Department, { foreignKey: 'department_id' });

// Department -> Events
Department.hasMany(Event, { foreignKey: 'department_id', onDelete: 'SET NULL' });
Event.belongsTo(Department, { foreignKey: 'department_id' });

// Department -> Programs
Department.hasMany(Program, { foreignKey: 'department_id', onDelete: 'CASCADE' });
Program.belongsTo(Department, { foreignKey: 'department_id' });

// Department -> HeadOfficers
Department.hasMany(HeadOfficer, { foreignKey: 'department_id', onDelete: 'CASCADE' });
HeadOfficer.belongsTo(Department, { foreignKey: 'department_id' });

// Office -> HeadOfficers
Office.hasMany(HeadOfficer, { foreignKey: 'offices_id', onDelete: 'CASCADE' });
HeadOfficer.belongsTo(Office, { foreignKey: 'offices_id' });

// Event -> EventPhotos
Event.hasMany(EventPhoto, { foreignKey: 'event_id', onDelete: 'CASCADE' });
EventPhoto.belongsTo(Event, { foreignKey: 'event_id' });

// Office -> OfficePhotos
Office.hasMany(OfficePhoto, { foreignKey: 'offices_id', as: 'OfficePhotos', onDelete: 'CASCADE' });
OfficePhoto.belongsTo(Office, { foreignKey: 'offices_id' });

// Office -> Staff
Office.hasMany(Staff, { foreignKey: 'offices_id', as: 'Staff', onDelete: 'CASCADE' });
Staff.belongsTo(Office, { foreignKey: 'offices_id' });

// Facility -> FacilityPhotos
Facility.hasMany(FacilityPhoto, { foreignKey: 'facility_id', as: 'FacilityPhotos', onDelete: 'CASCADE' });
FacilityPhoto.belongsTo(Facility, { foreignKey: 'facility_id' });

// Department -> Staff
Department.hasMany(Staff, { foreignKey: 'department_id', as: 'Staff', onDelete: 'CASCADE' });
Staff.belongsTo(Department, { foreignKey: 'department_id' });

module.exports = {
    sequelize,
    Campus,
    CampusPhoto,
    Department,
    Facility,
    Photo,
    Event,
    EventPhoto,
    Program,
    HeadOfficer,
    Staff,
    Office,
    OfficePhoto,
    FacilityPhoto,
    Navigation,
    User
};
