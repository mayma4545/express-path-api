/**
 * File Upload Service
 * Handles image uploads for 360° panoramas and campus maps
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

const MEDIA_DIR = path.join(__dirname, '../../media');

// Configure storage for different upload types
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        let uploadDir;
        
        if (file.fieldname === 'image360') {
            uploadDir = path.join(MEDIA_DIR, '360_images');
        } else if (file.fieldname === 'blueprint_image') {
            uploadDir = path.join(MEDIA_DIR, 'campus_maps');
        } else {
            uploadDir = path.join(MEDIA_DIR, 'uploads');
        }

        // Ensure directory exists
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

// File filter for images
const imageFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'), false);
    }
};

// Create multer upload middleware
const upload = multer({
    storage,
    fileFilter: imageFilter,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    }
});

/**
 * Get relative path for media file
 * @param {string} fullPath - Full path to file
 * @returns {string} - Relative path from media directory
 */
function getRelativePath(fullPath) {
    return path.relative(MEDIA_DIR, fullPath);
}

/**
 * Delete file from media directory
 * @param {string} relativePath - Relative path to file
 */
async function deleteFile(relativePath) {
    if (!relativePath) return;

    const filepath = path.join(MEDIA_DIR, relativePath);
    try {
        await fs.unlink(filepath);
    } catch (error) {
        console.log(`File not found: ${filepath}`);
    }
}

/**
 * Save base64 image to file
 * @param {string} base64Data - Base64 encoded image data
 * @param {string} filename - Filename to save as
 * @param {string} subdir - Subdirectory within media
 * @returns {string} - Relative path to saved file
 */
async function saveBase64Image(base64Data, filename, subdir = '360_images') {
    const uploadDir = path.join(MEDIA_DIR, subdir);
    await fs.mkdir(uploadDir, { recursive: true });

    const buffer = Buffer.from(base64Data, 'base64');
    const filepath = path.join(uploadDir, filename);
    await fs.writeFile(filepath, buffer);

    return path.join(subdir, filename);
}

module.exports = {
    upload,
    getRelativePath,
    deleteFile,
    saveBase64Image,
    MEDIA_DIR
};
