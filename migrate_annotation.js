require('dotenv').config();
const { sequelize } = require('./src/models');

async function migrate() {
  await sequelize.authenticate();
  const [rows] = await sequelize.query(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='nodes' AND COLUMN_NAME='annotation'"
  );
  if (rows.length > 0) {
    console.log('Column annotation already exists — nothing to do.');
  } else {
    await sequelize.query('ALTER TABLE nodes ADD COLUMN annotation FLOAT NULL');
    console.log('Migration done: annotation column added to nodes table.');
  }
  process.exit(0);
}

migrate().catch(e => { console.error(e.message); process.exit(1); });
