/**
 * QR Code Generation Service
 * Generates QR codes for nodes containing node information
 */

const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs').promises;

const QRCODE_DIR = path.join(__dirname, '../../media/qrcodes');

/**
 * Generate QR code for a node
 * @param {Object} node - Node object with node_code, name, building
 * @returns {string} - Path to generated QR code image
 */
async function generateQRCode(node) {
    // Ensure directory exists
    await fs.mkdir(QRCODE_DIR, { recursive: true });

    const qrData = JSON.stringify({
        node_code: node.node_code,
        name: node.name,
        building: node.building
    });

    const filename = `qr_${node.node_code}.png`;
    const filepath = path.join(QRCODE_DIR, filename);
    const relativePath = `qrcodes/${filename}`;

    await QRCode.toFile(filepath, qrData, {
        type: 'png',
        width: 300,
        margin: 4,
        color: {
            dark: '#000000',
            light: '#FFFFFF'
        },
        errorCorrectionLevel: 'L'
    });

    return relativePath;
}

/**
 * Delete QR code file
 * @param {string} qrcodePath - Relative path to QR code file
 */
async function deleteQRCode(qrcodePath) {
    if (!qrcodePath) return;

    const filepath = path.join(__dirname, '../../media', qrcodePath);
    try {
        await fs.unlink(filepath);
    } catch (error) {
        // File may not exist, ignore error
        console.log(`QR code file not found: ${filepath}`);
    }
}

module.exports = {
    generateQRCode,
    deleteQRCode
};
