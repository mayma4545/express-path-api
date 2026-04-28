const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let folder = 'campus_navigator/others';
    if (req.originalUrl.includes('departments')) folder = 'campus_navigator/departments';
    if (req.originalUrl.includes('programs')) folder = 'campus_navigator/programs';
    if (req.originalUrl.includes('events')) folder = 'campus_navigator/events';
    if (req.originalUrl.includes('head-officers')) folder = 'campus_navigator/personnel';
    if (req.originalUrl.includes('staff')) folder = 'campus_navigator/personnel';
    if (req.originalUrl.includes('facilities')) folder = 'campus_navigator/facilities';
    if (req.originalUrl.includes('navigations')) folder = 'campus_navigator/navigations';
    
    return {
      folder: folder,
      allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    };
  },
});

const upload = multer({ storage: storage });

module.exports = { cloudinary, upload };
