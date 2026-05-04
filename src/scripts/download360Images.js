/**
 * Download 360° Images Script
 *
 * Downloads all 360° images from their stored URLs (Cloudinary or otherwise)
 * and saves them locally in media/360_images/ using the node name as the filename.
 *
 * Usage:
 *   node src/scripts/download360Images.js
 */

require('dotenv').config();

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Nodes } = require('../models');
const { Op } = require('sequelize');

// Destination folder (relative to project root)
const DEST_DIR = path.resolve(__dirname, '../../../media/360_images');

/**
 * Sanitize a node name into a safe filename (no special chars, spaces → underscores).
 * e.g. "Main Entrance / Lobby" → "Main_Entrance_Lobby"
 */
function sanitizeName(name) {
    return name
        .trim()
        .replace(/[\/\\:*?"<>|]/g, '')   // strip illegal filename chars
        .replace(/\s+/g, '_')             // spaces → underscores
        .replace(/_+/g, '_')              // collapse multiple underscores
        .replace(/^_|_$/g, '');           // trim leading/trailing underscores
}

/**
 * Extract the file extension from a URL.
 * Falls back to .jpg if none can be determined.
 */
function getExtension(url) {
    try {
        // Strip query string before checking extension
        const pathname = new URL(url).pathname;
        const ext = path.extname(pathname).toLowerCase();
        // Cloudinary sometimes serves images without extension — default to .jpg
        return ext && ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) ? ext : '.jpg';
    } catch {
        return '.jpg';
    }
}

/**
 * Download a single file from a URL and write it to destPath.
 * Returns a Promise that resolves with the number of bytes written.
 */
function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https://') ? https : http;

        const request = protocol.get(url, (response) => {
            // Follow redirects (up to 5 hops)
            if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307) {
                const redirectUrl = response.headers.location;
                if (!redirectUrl) {
                    return reject(new Error(`Redirect with no Location header from ${url}`));
                }
                return downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
            }

            if (response.statusCode !== 200) {
                return reject(new Error(`HTTP ${response.statusCode} for ${url}`));
            }

            const fileStream = fs.createWriteStream(destPath);
            let bytesWritten = 0;

            response.on('data', (chunk) => { bytesWritten += chunk.length; });
            response.pipe(fileStream);

            fileStream.on('finish', () => {
                fileStream.close();
                resolve(bytesWritten);
            });

            fileStream.on('error', (err) => {
                fs.unlink(destPath, () => {}); // clean up partial file
                reject(err);
            });
        });

        request.on('error', (err) => reject(err));
        request.setTimeout(30000, () => {
            request.destroy();
            reject(new Error(`Request timed out for ${url}`));
        });
    });
}

async function main() {
    console.log('📥  Download 360° Images\n');

    // Ensure destination directory exists
    if (!fs.existsSync(DEST_DIR)) {
        fs.mkdirSync(DEST_DIR, { recursive: true });
        console.log(`📁  Created directory: ${DEST_DIR}\n`);
    } else {
        console.log(`📁  Saving to: ${DEST_DIR}\n`);
    }

    // Fetch all nodes that have a 360° image URL
    let nodes;
    try {
        nodes = await Nodes.findAll({
            where: { image360: { [Op.not]: null } },
            attributes: ['node_id', 'node_code', 'name', 'image360'],
            order: [['name', 'ASC']],
        });
    } catch (err) {
        console.error('❌  Failed to query database:', err.message);
        process.exit(1);
    }

    if (nodes.length === 0) {
        console.log('⚠️   No nodes with 360° images found in the database.');
        process.exit(0);
    }

    console.log(`Found ${nodes.length} node(s) with 360° images.\n`);

    let downloaded = 0;
    let skipped = 0;
    let failed = 0;

    for (const node of nodes) {
        const { node_id, node_code, name, image360 } = node;
        const imageUrl = image360;

        if (!imageUrl || !imageUrl.startsWith('http')) {
            console.warn(`⚠️   [${node_code}] "${name}" — skipped (not a valid URL: ${imageUrl})`);
            skipped++;
            continue;
        }

        const safeName = sanitizeName(name) || sanitizeName(node_code) || `node_${node_id}`;
        const ext = getExtension(imageUrl);
        const fileName = `${safeName}${ext}`;
        const destPath = path.join(DEST_DIR, fileName);

        // Skip if file already exists
        if (fs.existsSync(destPath)) {
            console.log(`⏭️   [${node_code}] "${name}" — already exists as ${fileName}`);
            skipped++;
            continue;
        }

        process.stdout.write(`⬇️   [${node_code}] "${name}" → ${fileName} … `);

        try {
            const bytes = await downloadFile(imageUrl, destPath);
            const kb = (bytes / 1024).toFixed(1);
            console.log(`✅  (${kb} KB)`);
            downloaded++;
        } catch (err) {
            console.log(`❌  FAILED: ${err.message}`);
            failed++;
        }
    }

    console.log('\n─────────────────────────────────────');
    console.log(`✅  Downloaded : ${downloaded}`);
    console.log(`⏭️   Skipped    : ${skipped}`);
    console.log(`❌  Failed     : ${failed}`);
    console.log('─────────────────────────────────────\n');

    process.exit(failed > 0 ? 1 : 0);
}

main();
