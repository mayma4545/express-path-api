/**
 * Organizer Account Migration
 *
 * Goals:
 * 1. Add organizers.user_id foreign key to app_users.id
 * 2. Backfill missing organizer accounts for existing organizers
 * 3. Keep organizer and account data aligned for organizer portal login
 */

require('dotenv').config();

const bcrypt = require('bcryptjs');
const { DataTypes } = require('sequelize');
const { sequelize, Organizer, AppUser } = require('../models');

const DEFAULT_PASSWORD = process.env.ORGANIZER_DEFAULT_PASSWORD || 'organizer123';

const tableHasColumn = async (queryInterface, tableName, columnName) => {
  const table = await queryInterface.describeTable(tableName);
  return Boolean(table[columnName]);
};

const ensureOrganizerUserIdColumn = async (queryInterface) => {
  const hasColumn = await tableHasColumn(queryInterface, 'organizers', 'user_id');

  if (!hasColumn) {
    await queryInterface.addColumn('organizers', 'user_id', {
      type: DataTypes.INTEGER,
      allowNull: true
    });
    console.log('Added organizers.user_id column');
  } else {
    console.log('organizers.user_id already exists');
  }
};

const ensureOrganizerUserIdIndex = async (queryInterface) => {
  const indexes = await queryInterface.showIndex('organizers');
  const hasUniqueIndex = indexes.some((idx) =>
    idx.unique && idx.fields && idx.fields.length === 1 && idx.fields[0].attribute === 'user_id'
  );

  if (!hasUniqueIndex) {
    await queryInterface.addIndex('organizers', ['user_id'], {
      unique: true,
      name: 'organizers_user_id_unique'
    });
    console.log('Added unique index organizers_user_id_unique');
  } else {
    console.log('Unique index for organizers.user_id already exists');
  }
};

const ensureOrganizerForeignKey = async (queryInterface) => {
  const sql = `
    SELECT CONSTRAINT_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'organizers'
      AND COLUMN_NAME = 'user_id'
      AND REFERENCED_TABLE_NAME = 'app_users'
    LIMIT 1;
  `;

  const [rows] = await sequelize.query(sql);
  if (rows.length > 0) {
    console.log('Foreign key from organizers.user_id to app_users.id already exists');
    return;
  }

  await queryInterface.addConstraint('organizers', {
    fields: ['user_id'],
    type: 'foreign key',
    name: 'fk_organizers_user_id_app_users_id',
    references: {
      table: 'app_users',
      field: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  });

  console.log('Added foreign key fk_organizers_user_id_app_users_id');
};

const splitName = (fullName) => {
  const clean = (fullName || 'Organizer').trim();
  const parts = clean.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: 'Account' };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ')
  };
};

const sanitizeEmailPart = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '') || 'organizer';

const uniqueEmailForOrganizer = async (name, organizerId) => {
  const base = sanitizeEmailPart(name);
  let email = `${base}.${organizerId}@organizer.local`;
  let suffix = 1;

  while (await AppUser.findOne({ where: { email } })) {
    email = `${base}.${organizerId}.${suffix}@organizer.local`;
    suffix += 1;
  }

  return email;
};

const backfillOrganizerAccounts = async () => {
  const organizersWithoutAccount = await Organizer.findAll({
    where: { user_id: null },
    order: [['id', 'ASC']]
  });

  if (organizersWithoutAccount.length === 0) {
    console.log('No organizers need account backfill');
    return;
  }

  console.log(`Backfilling accounts for ${organizersWithoutAccount.length} organizer(s)`);

  for (const organizer of organizersWithoutAccount) {
    const email = await uniqueEmailForOrganizer(organizer.name, organizer.id);
    const { firstName, lastName } = splitName(organizer.name);
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    const account = await AppUser.create({
      first_name: firstName,
      last_name: lastName,
      email,
      password_hash: passwordHash,
      avatar_url: organizer.avatar_url || null
    });

    organizer.user_id = account.id;
    await organizer.save();

    console.log(`Linked organizer #${organizer.id} (${organizer.name}) to account ${email}`);
  }

  console.log(`Default generated password for backfilled organizer accounts: ${DEFAULT_PASSWORD}`);
};

async function run() {
  try {
    await sequelize.authenticate();
    const queryInterface = sequelize.getQueryInterface();

    await ensureOrganizerUserIdColumn(queryInterface);
    await ensureOrganizerUserIdIndex(queryInterface);
    await ensureOrganizerForeignKey(queryInterface);
    await backfillOrganizerAccounts();

    console.log('Organizer account migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Organizer account migration failed:', error);
    process.exit(1);
  }
}

run();
