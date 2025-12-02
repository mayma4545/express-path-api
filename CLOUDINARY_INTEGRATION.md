# Cloudinary Integration Guide

## Overview
This Express application now uses **Cloudinary** for cloud-based image storage instead of local file storage. All images (360° images, QR codes, and campus maps) are uploaded to and served from Cloudinary.

## Configuration

### Environment Variables
Create a `.env` file with your Cloudinary credentials:

```env
CLOUDINARY_CLOUD_NAME=dir9ljc5q
CLOUDINARY_API_KEY=947544355558482
CLOUDINARY_API_SECRET=JmBJHjNTI7MJ597pr79X7xPZ9lE
```

**⚠️ IMPORTANT**: Never commit `.env` to version control. Use `.env.example` as a template.

### Cloudinary Folder Structure
Images are organized in Cloudinary with the following folder structure:

```
campus-navigator/
├── 360-images/      # 360° panoramic images
├── qrcodes/         # QR codes for navigation
└── campus-maps/     # Campus blueprint/map images
```

## Migration Status

### Successfully Migrated ✅
- **360° Images**: 24 out of 29 nodes (5 nodes had no images)
- **QR Codes**: 29 out of 29 nodes
- **Campus Maps**: 1 out of 1 maps

### Failed Migrations
The following nodes had empty/blank image360 fields (not actual failures):
- BLDG-1
- BLDG- 1  
- BLDG-DMST
- BLDG-STAIR1
- FIELD-D5

## Code Changes

### Updated Files

#### 1. Services
- **`src/services/cloudinary.js`** - Main Cloudinary service
  - `upload360` - Multer middleware for 360° image uploads
  - `uploadCampusMap` - Multer middleware for campus map uploads
  - `uploadToCloudinary()` - Generic file upload function
  - `uploadBase64ToCloudinary()` - Upload base64-encoded images (for mobile API)
  - `uploadQRCode()` - Upload QR code buffers
  - `deleteFromCloudinary()` - Delete images from Cloudinary
  - `getCloudinaryUrl()` - Extract Cloudinary URL from uploaded file

- **`src/services/qrcode.cloudinary.js`** - Updated QR code generation
  - Now uploads generated QR codes directly to Cloudinary
  - Returns Cloudinary URL instead of local path
  - `deleteQRCode()` uses Cloudinary deletion

#### 2. Routes
- **`src/routes/web.js`** - Web interface routes
  - Node create/edit/delete routes updated
  - Uses `upload360.single('image_360')` for file uploads
  - Uses `getCloudinaryUrl(req.file)` to get URLs
  - Uses `deleteFromCloudinary()` for deletions

- **`src/routes/mobileApi.js`** - Mobile API routes
  - Updated to use `uploadBase64ToCloudinary()` for mobile image uploads
  - Updated QR code service import
  - Uses Cloudinary deletion functions

#### 3. Scripts
- **`src/scripts/migrateToCloudinary.js`** - Migration script
  - Uploads all existing local images to Cloudinary
  - Updates database URLs from local paths to Cloudinary URLs
  - Provides detailed migration statistics

## Usage Examples

### Web Interface (Multipart Form Upload)

```javascript
// Node create route
router.post('/nodes/create', upload360.single('image_360'), async (req, res) => {
    const node = await Nodes.create({
        node_code: req.body.node_code,
        name: req.body.name,
        // ... other fields
    });

    // Handle image upload
    if (req.file) {
        const cloudinaryUrl = getCloudinaryUrl(req.file);
        await node.update({ image360: cloudinaryUrl });
    }

    // Generate QR code (automatically uploads to Cloudinary)
    const qrcodeUrl = await generateQRCode(node);
    await node.update({ qrcode: qrcodeUrl });
});
```

### Mobile API (Base64 Upload)

```javascript
// Mobile node create
router.post('/admin/nodes/create', requireAuth, async (req, res) => {
    const { image360_base64 } = req.body;
    
    const node = await Nodes.create({ /* ... */ });

    // Upload base64 image
    if (image360_base64) {
        const imageUrl = await uploadBase64ToCloudinary(
            image360_base64,
            `${node.node_code}_360.jpg`,
            '360-images'
        );
        await node.update({ image360: imageUrl });
    }
});
```

### Image Deletion

```javascript
// Delete node with images
router.post('/nodes/:node_id/delete', async (req, res) => {
    const node = await Nodes.findByPk(req.params.node_id);
    
    // Delete from Cloudinary
    if (node.image360) await deleteFromCloudinary(node.image360);
    if (node.qrcode) await deleteQRCode(node.qrcode);
    
    await node.destroy();
});
```

## Database Schema

The database now stores Cloudinary URLs instead of local paths:

```sql
-- Example node record
{
    "node_id": 1,
    "node_code": "NO-BLDG",
    "image360": "https://res.cloudinary.com/dir9ljc5q/image/upload/v1764689986/campus-navigator/360-images/l4kqoq2zt6gnvaljedv1.jpg",
    "qrcode": "https://res.cloudinary.com/dir9ljc5q/image/upload/v1764690189/campus-navigator/qrcodes/ioicx72oo6qff7fzcsrv.png"
}
```

## Migration Script

To migrate existing local images to Cloudinary:

```bash
node src/scripts/migrateToCloudinary.js
```

The script will:
1. Find all nodes/maps with local image paths
2. Upload each image to Cloudinary
3. Update database records with Cloudinary URLs
4. Provide detailed statistics

## Benefits

### 🚀 Performance
- Images served via Cloudinary's global CDN
- Automatic format optimization (WebP support)
- Automatic quality optimization
- Fast delivery worldwide

### 💾 Storage
- No local file storage needed
- Reduces server disk usage
- Automatic backup and redundancy

### 📱 Mobile-Friendly
- Supports base64 image uploads from React Native
- Optimized image delivery for mobile devices

### 🔧 Scalability
- No file system limitations
- Easy to scale horizontally
- Centralized image management

## Testing

### Verify Cloudinary URLs
```bash
# Check a node's URLs
node -e "const {Nodes} = require('./src/models'); \
  Nodes.findOne({where: {node_code: 'NO-BLDG'}}).then(node => { \
    console.log('Image360:', node.image360); \
    console.log('QR Code:', node.qrcode); \
  }).finally(() => process.exit())"
```

### Test Image Upload
1. Start the server: `npm start`
2. Login to admin dashboard: http://localhost:3000/login
3. Create a new node with an image
4. Verify the image URL contains `cloudinary.com`

## Troubleshooting

### Images Not Uploading
- Check `.env` file has correct Cloudinary credentials
- Verify `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- Check console for error messages

### Migration Errors
- Ensure local images exist in `media/` folders
- Check file permissions
- Verify database connection

### URL Format Issues
- Cloudinary URLs should start with: `https://res.cloudinary.com/`
- QR codes should be in PNG format
- 360° images should be in the `360-images` folder

## Security Notes

1. **Never commit `.env`** - Contains sensitive API credentials
2. Use `.env.example` as a template for team members
3. Cloudinary credentials should be kept secret
4. Consider using signed URLs for sensitive content
5. Implement rate limiting for upload endpoints

## Next Steps

- ✅ Migration completed
- ✅ All routes updated to use Cloudinary
- ✅ QR code generation integrated
- ⏳ Consider implementing image transformations (resizing, cropping)
- ⏳ Add signed URLs for protected content
- ⏳ Implement upload progress tracking
- ⏳ Add image validation and virus scanning

## Resources

- [Cloudinary Documentation](https://cloudinary.com/documentation)
- [Node.js SDK Guide](https://cloudinary.com/documentation/node_integration)
- [Image Transformation Guide](https://cloudinary.com/documentation/image_transformations)
