/**
 * Hybrid Upload Service - Saves to both Local and Cloudinary
 * Provides backup by storing images locally while also uploading to cloud
 */

require('dotenv').config();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { uploadToCloudinary, deleteFromCloudinary } = require('./cloudinary');

const MEDIA_DIR = path.join(__dirname, '../../media');

/**
 * Ensure directory exists
 */
async function ensureDir(dirPath) {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
        if (error.code !== 'EEXIST') throw error;
    }
}

/**
 * Save file locally and upload to Cloudinary
 */
async function saveFileHybrid(file, subfolder) {
    try {
        // Create local directory
        const localDir = path.join(MEDIA_DIR, subfolder);
        await ensureDir(localDir);

        // Generate unique filename
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        const filename = `${timestamp}${ext}`;
        const localPath = path.join(localDir, filename);

        // Save file locally (backup)
        await fs.writeFile(localPath, file.buffer);
        console.log(`✅ Local backup saved: ${subfolder}/${filename}`);

        // Upload to Cloudinary
        const cloudinaryUrl = await uploadToCloudinary(
            localPath,
            `campus-navigator/${subfolder}`
        );
        console.log(`☁️  Cloudinary uploaded: ${cloudinaryUrl}`);

        return {
            localPath: `${subfolder}/${filename}`,
            cloudinaryUrl: cloudinaryUrl,
            filename: filename
        };
    } catch (error) {
        console.error('Hybrid save error:', error);
        throw error;
    }
}

/**
 * Save base64 image locally and to Cloudinary
 */
async function saveBase64Hybrid(base64Data, filename, subfolder) {
    try {
        // Decode base64
        let base64String = base64Data;
        if (base64String.startsWith('data:')) {
            base64String = base64String.split(',')[1];
        }
        const buffer = Buffer.from(base64String, 'base64');

        // Create local directory
        const localDir = path.join(MEDIA_DIR, subfolder);
        await ensureDir(localDir);

        // Save locally
        const localPath = path.join(localDir, filename);
        await fs.writeFile(localPath, buffer);
        console.log(`✅ Local backup saved: ${subfolder}/${filename}`);

        // Upload to Cloudinary
        const cloudinaryUrl = await uploadToCloudinary(
            localPath,
            `campus-navigator/${subfolder}`
        );
        console.log(`☁️  Cloudinary uploaded: ${cloudinaryUrl}`);

        return {
            localPath: `${subfolder}/${filename}`,
            cloudinaryUrl: cloudinaryUrl,
            filename: filename
        };
    } catch (error) {
        console.error('Base64 hybrid save error:', error);
        throw error;
    }
}

/**
 * Delete file from both local and Cloudinary
 */
async function deleteFileHybrid(localPath, cloudinaryUrl) {
    try {
        console.log(`🗑️  Hybrid delete initiated - Local: ${localPath || 'none'}, Cloud: ${cloudinaryUrl ? 'yes' : 'none'}`);
        
        // Delete from Cloudinary first
        if (cloudinaryUrl) {
            console.log(`☁️  Deleting from Cloudinary: ${cloudinaryUrl}`);
            await deleteFromCloudinary(cloudinaryUrl);
        }

        // Delete local file
        if (localPath) {
            const fullPath = path.join(MEDIA_DIR, localPath);
            try {
                await fs.unlink(fullPath);
                console.log(`✅ Local file deleted: ${localPath}`);
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    console.error('❌ Local file delete error:', error.message);
                } else {
                    console.log(`ℹ️  Local file not found (already deleted): ${localPath}`);
                }
            }
        }
        
        console.log(`✅ Hybrid deletion completed`);
    } catch (error) {
        console.error('❌ Hybrid delete error:', error.message);
        // Don't throw - deletion errors shouldn't break the app
    }
}

/**
 * Configure multer for memory storage (we'll handle file saving manually)
 */
const createUploadMiddleware = (fieldName = 'image') => {
    return multer({
        storage: multer.memoryStorage(),
        fileFilter: (req, file, cb) => {
            const allowedTypes = /jpeg|jpg|png|gif|webp/;
            const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
            const mimetype = allowedTypes.test(file.mimetype);

            if (extname && mimetype) {
                cb(null, true);
            } else {
                cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'), false);
            }
        },
        limits: {
            fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB
        }
    });
};

// Create upload middlewares
const upload360Hybrid = createUploadMiddleware('image_360');
const uploadMapHybrid = createUploadMiddleware('blueprint_image');

module.exports = {
    upload360Hybrid,
    uploadMapHybrid,
    saveFileHybrid,
    saveBase64Hybrid,
    deleteFileHybrid,
    ensureDir
};
