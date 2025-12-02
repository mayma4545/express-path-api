/**
 * Cloudinary Upload Service
 * Handles image uploads to Cloudinary cloud storage
 */

require('dotenv').config();
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Validate Cloudinary configuration
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.warn('⚠️  Cloudinary credentials not configured. Image uploads will fail.');
}

// Configure Cloudinary Storage for 360° images
const image360Storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'campus-navigator/360-images',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        resource_type: 'image'
    }
});

// Configure Cloudinary Storage for campus maps
const campusMapStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'campus-navigator/campus-maps',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        resource_type: 'image'
    }
});

// Configure Cloudinary Storage for QR codes
const qrcodeStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'campus-navigator/qrcodes',
        allowed_formats: ['png'],
        resource_type: 'image'
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

// Create multer upload middleware for 360 images
const upload360 = multer({
    storage: image360Storage,
    fileFilter: imageFilter,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB default
    }
});

// Create multer upload middleware for campus maps
const uploadCampusMap = multer({
    storage: campusMapStorage,
    fileFilter: imageFilter,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024
    }
});

// Generic upload middleware (chooses storage based on field name)
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, '/tmp'),
        filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
    }),
    fileFilter: imageFilter,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024
    }
});

/**
 * Upload image to Cloudinary
 * @param {Buffer|string} file - File buffer or path
 * @param {string} folder - Cloudinary folder path
 * @param {object} options - Additional Cloudinary upload options
 * @returns {Promise<string>} Cloudinary URL
 */
async function uploadToCloudinary(file, folder = 'campus-navigator/uploads', options = {}) {
    try {
        const result = await cloudinary.uploader.upload(file, {
            folder: folder,
            resource_type: 'image',
            quality: 'auto',
            fetch_format: 'auto',
            ...options
        });
        
        return result.secure_url;
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        throw new Error(`Failed to upload to Cloudinary: ${error.message}`);
    }
}

/**
 * Upload base64 image to Cloudinary
 * @param {string} base64Data - Base64 encoded image data
 * @param {string} filename - Filename for the image
 * @param {string} subfolder - Subfolder within campus-navigator (e.g., '360-images', 'campus-maps')
 * @returns {Promise<string>} Cloudinary URL
 */
async function uploadBase64ToCloudinary(base64Data, filename, subfolder = 'uploads') {
    try {
        // Ensure base64 data has the proper prefix
        let base64String = base64Data;
        if (!base64String.startsWith('data:')) {
            base64String = `data:image/jpeg;base64,${base64String}`;
        }

        const result = await cloudinary.uploader.upload(base64String, {
            folder: `campus-navigator/${subfolder}`,
            public_id: filename.replace(/\.[^/.]+$/, ''), // Remove extension
            resource_type: 'image',
            quality: 'auto',
            fetch_format: 'auto'
        });

        return result.secure_url;
    } catch (error) {
        console.error('Base64 upload error:', error);
        throw new Error(`Failed to upload base64 image: ${error.message}`);
    }
}

/**
 * Upload QR code to Cloudinary
 * @param {Buffer} buffer - QR code image buffer
 * @param {string} filename - Filename for the QR code
 * @returns {Promise<string>} Cloudinary URL
 */
async function uploadQRCode(buffer, filename) {
    try {
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: 'campus-navigator/qrcodes',
                    public_id: filename.replace(/\.[^/.]+$/, ''), // Remove extension
                    resource_type: 'image',
                    format: 'png'
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result.secure_url);
                }
            );
            
            uploadStream.end(buffer);
        });
    } catch (error) {
        console.error('QR code upload error:', error);
        throw new Error(`Failed to upload QR code: ${error.message}`);
    }
}

/**
 * Delete image from Cloudinary
 * @param {string} imageUrl - Cloudinary image URL
 * @returns {Promise<void>}
 */
async function deleteFromCloudinary(imageUrl) {
    try {
        if (!imageUrl || !imageUrl.includes('cloudinary.com')) {
            return; // Not a Cloudinary URL, skip
        }

        // Extract public ID from URL
        const parts = imageUrl.split('/');
        const filename = parts[parts.length - 1];
        const folder = parts.slice(parts.indexOf('campus-navigator'), -1).join('/');
        const publicId = `${folder}/${filename.split('.')[0]}`;

        await cloudinary.uploader.destroy(publicId);
        console.log(`✅ Deleted from Cloudinary: ${publicId}`);
    } catch (error) {
        console.error('Cloudinary delete error:', error);
        // Don't throw error, just log it
    }
}

/**
 * Get Cloudinary URL from uploaded file
 * @param {object} file - Multer file object
 * @returns {string} Cloudinary URL
 */
function getCloudinaryUrl(file) {
    if (!file) return null;
    
    // If using CloudinaryStorage, URL is in file.path
    if (file.path && file.path.includes('cloudinary.com')) {
        return file.path;
    }
    
    // If file has cloudinary result
    if (file.secure_url) {
        return file.secure_url;
    }
    
    return null;
}

module.exports = {
    cloudinary,
    upload,
    upload360,
    uploadCampusMap,
    uploadToCloudinary,
    uploadBase64ToCloudinary,
    uploadQRCode,
    deleteFromCloudinary,
    getCloudinaryUrl,
    imageFilter
};
