/**
 * test_room401_image_update.js
 *
 * Standalone test: finds Room 401 in the DB, uploads a small solid-colour
 * test image to Cloudinary (same path the real app uses), updates the DB
 * record, then re-reads the DB row to confirm the stored URL is a fresh
 * Cloudinary URL.
 *
 * Run from express-path-api/:
 *   node test_room401_image_update.js
 *
 * No HTTP server needs to be running.
 */

'use strict';

require('dotenv').config();

const { saveBase64Hybrid, deleteFileHybrid } = require('./src/services/upload.hybrid');

// ── Inline the same Sequelize model setup the rest of the app uses ──────────
const { Sequelize, DataTypes } = require('sequelize');

const getSSLConfig = () => {
  if (process.env.DB_SSL !== 'true') return false;
  const ssl = { rejectUnauthorized: false };
  if (
    process.env.DB_CA_CERT &&
    process.env.DB_CA_CERT.trim() !== '' &&
    process.env.DB_CA_CERT.includes('BEGIN CERTIFICATE')
  ) {
    ssl.ca = process.env.DB_CA_CERT.replace(/\\n/g, '\n');
    ssl.rejectUnauthorized = true;
  }
  return ssl;
};

const sequelize = new Sequelize(
  process.env.DB_NAME || 'defaultdb',
  process.env.DB_USER || 'avnadmin',
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 11343,
    dialect: 'mysql',
    dialectOptions: { ssl: getSSLConfig(), connectTimeout: 60000 },
    logging: false,
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
  }
);

const Nodes = sequelize.define(
  'Nodes',
  {
    node_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    node_code: { type: DataTypes.STRING(100) },
    name: { type: DataTypes.STRING(255) },
    building: { type: DataTypes.STRING(255) },
    floor_level: { type: DataTypes.INTEGER },
    type_of_node: { type: DataTypes.STRING(50) },
    description: { type: DataTypes.TEXT },
    map_x: { type: DataTypes.FLOAT },
    map_y: { type: DataTypes.FLOAT },
    annotation: { type: DataTypes.FLOAT },
    image360: { type: DataTypes.STRING(500), field: 'image360' },
  },
  {
    tableName: 'nodes',
    timestamps: false,
  }
);

// ── Use an existing 360 image from the media folder as the test payload ──────
const fs_sync = require('fs');
const path = require('path');
const TEST_IMAGE_PATH = path.join(__dirname, 'media/360_images/D-F1-AN4T_360.jpg');
const TINY_RED_JPEG_BASE64 = fs_sync.readFileSync(TEST_IMAGE_PATH, { encoding: 'base64' });

// ── Main test ────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n======================================================');
  console.log(' Room 401 — Cloudinary Image Update Test');
  console.log('======================================================\n');

  // 1. Connect to DB
  console.log('1. Connecting to MySQL database…');
  await sequelize.authenticate();
  console.log('   ✅ Connected.\n');

  // 2. Find Room 401
  console.log('2. Searching for a node whose name contains "401"…');
  const { Op } = require('sequelize');
  const node = await Nodes.findOne({
    where: { name: { [Op.like]: '%401%' } },
    order: [['node_id', 'ASC']],
  });

  if (!node) {
    console.error('   ❌ No node with "401" in its name found in the database.');
    console.error('      Check the DB or try a different name fragment.');
    process.exit(1);
  }

  console.log(`   ✅ Found: "${node.name}" (node_id=${node.node_id}, code=${node.node_code})`);
  console.log(`   Current image360 URL in DB: ${node.image360 || '(none)'}\n`);

  const oldUrl = node.image360 || null;

  // 3. Upload test image to Cloudinary
  const timestamp = Date.now();
  const filename = `${node.node_code}_360_${timestamp}.jpg`;
  console.log(`3. Uploading test image to Cloudinary as "${filename}"…`);
  console.log('   (This may take a few seconds on first run)\n');

  const { cloudinaryUrl, localPath } = await saveBase64Hybrid(
    TINY_RED_JPEG_BASE64,
    filename,
    '360_images'
  );

  console.log(`\n   ✅ Cloudinary upload succeeded!`);
  console.log(`   ┌─────────────────────────────────────────────────────`);
  console.log(`   │  NEW CLOUDINARY URL:`);
  console.log(`   │  ${cloudinaryUrl}`);
  console.log(`   └─────────────────────────────────────────────────────\n`);

  // 4. Update the DB record
  console.log('4. Writing new URL to database…');
  await node.update({ image360: cloudinaryUrl });
  console.log('   ✅ DB updated.\n');

  // 5. Re-read from DB to confirm
  console.log('5. Re-reading node from DB to confirm stored URL…');
  await node.reload();
  const storedUrl = node.image360;

  if (storedUrl === cloudinaryUrl) {
    console.log('   ✅ Confirmed — DB now stores the new Cloudinary URL.\n');
  } else {
    console.error('   ❌ Mismatch! DB stores a different URL than what was uploaded.');
    console.error(`      Expected: ${cloudinaryUrl}`);
    console.error(`      Got:      ${storedUrl}`);
  }

  // 6. Clean up old image from Cloudinary (best-effort, matches real app behaviour)
  if (oldUrl && oldUrl !== cloudinaryUrl) {
    console.log('6. Deleting old Cloudinary image (clean-up)…');
    await deleteFileHybrid(null, oldUrl);
    console.log('   ✅ Old image removed.\n');
  } else {
    console.log('6. No old Cloudinary image to delete (node had no previous image).\n');
  }

  // 7. Final summary
  console.log('======================================================');
  console.log(' RESULT SUMMARY');
  console.log('======================================================');
  console.log(` Node:          ${node.name} (id=${node.node_id})`);
  console.log(` Old URL:       ${oldUrl || '(none)'}`);
  console.log(` New URL in DB: ${storedUrl}`);
  console.log('');
  console.log(' Open the URL below in a browser to verify the image');
  console.log(' was actually saved in Cloudinary:');
  console.log('');
  console.log(` >>> ${storedUrl}`);
  console.log('======================================================\n');

  await sequelize.close();
}

main().catch((err) => {
  console.error('\n❌ Test failed with error:', err.message || err);
  console.error(err.stack || '');
  process.exit(1);
});
