/**
 * QR Code Generation Service - Cloudinary Version
 * Generates QR codes for nodes and uploads to Cloudinary
 */

const QRCode = require('qrcode');
const { uploadQRCode, deleteFromCloudinary } = require('./cloudinary');

/**
 * Generate QR code for a node and upload to Cloudinary
 * @param {object} node - Node object with node_code, name, building
 * @returns {Promise<string>} Cloudinary URL of QR code
 */
async function generateQRCode(node) {
    try {
        // Create QR code data with node information
        const qrData = JSON.stringify({
            node_code: node.node_code,
            name: node.name,
            building: node.building,
            node_id: node.node_id || node.id
        });

        // Generate QR code as buffer
        const qrBuffer = await QRCode.toBuffer(qrData, {
            errorCorrectionLevel: 'M',
            type: 'png',
            width: 300,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });

        // Upload to Cloudinary
        const filename = `qr_${node.node_code}`;
        const cloudinaryUrl = await uploadQRCode(qrBuffer, filename);

        console.log(`✅ QR code generated and uploaded: ${node.node_code}`);
        return cloudinaryUrl;
    } catch (error) {
        console.error('QR code generation error:', error);
        throw new Error(`Failed to generate QR code: ${error.message}`);
    }
}

/**
 * Delete QR code from Cloudinary
 * @param {string} qrcodeUrl - Cloudinary URL of QR code
 * @returns {Promise<void>}
 */
async function deleteQRCode(qrcodeUrl) {
    try {
        if (qrcodeUrl) {
            await deleteFromCloudinary(qrcodeUrl);
        }
    } catch (error) {
        console.error('QR code deletion error:', error);
        // Don't throw, just log
    }
}

module.exports = {
    generateQRCode,
    deleteQRCode
};
