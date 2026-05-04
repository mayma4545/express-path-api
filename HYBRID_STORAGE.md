# Hybrid Storage System - Local Backup + Cloudinary

## Overview
The application now uses a **hybrid storage approach** that saves images in two locations:
1. **Local filesystem** (`media/` folder) - For backup and redundancy
2. **Cloudinary cloud** - For fast CDN delivery to clients

This ensures you have local backups while still benefiting from Cloudinary's CDN performance.

## How It Works

### Upload Flow
```
User uploads image
    ↓
1. Save to local disk (media/360_images/timestamp.jpg)
    ↓
2. Upload same file to Cloudinary
    ↓
3. Store Cloudinary URL in database
    ↓
Client receives Cloudinary URL for fast delivery
```

### File Locations

#### Local Storage (Backup)
```
express-record/
└── media/
    ├── 360_images/      # 360° panoramic images
    │   ├── 1285.jpg
    │   ├── 1286.jpg
    │   └── ...
    ├── qrcodes/         # QR codes (generated and saved locally)
    │   ├── qr_BLDG-1.png
    │   └── ...
    └── campus_maps/     # Campus blueprint images
        └── campus_map.jpg
```

#### Cloud Storage (CDN Delivery)
```
Cloudinary: dir9ljc5q
└── campus-navigator/
    ├── 360-images/      # Same images as local
    ├── qrcodes/         # Same QR codes as local
    └── campus-maps/     # Same maps as local
```

## Database Storage

The database stores **Cloudinary URLs** (not local paths) for client delivery:

```javascript
{
  "node_code": "BLDG-1",
  "image360": "https://res.cloudinary.com/dir9ljc5q/image/upload/v1764690621/campus-navigator/360-images/abc123.jpg",
  "qrcode": "https://res.cloudinary.com/dir9ljc5q/image/upload/v1764690621/campus-navigator/qrcodes/qr_BLDG-1.png"
}
```

## Code Implementation

### Service: `src/services/upload.hybrid.js`

#### Key Functions

**`saveFileHybrid(file, subfolder)`**
- Saves uploaded file to local `media/{subfolder}/`
- Uploads same file to Cloudinary
- Returns both local path and Cloudinary URL

```javascript
const { cloudinaryUrl } = await saveFileHybrid(req.file, '360_images');
// Local: media/360_images/1234567890.jpg
// Cloud: https://res.cloudinary.com/dir9ljc5q/...
```

**`saveBase64Hybrid(base64Data, filename, subfolder)`**
- Decodes base64 image data
- Saves to local filesystem
- Uploads to Cloudinary
- Used by mobile API for base64 uploads

```javascript
const { cloudinaryUrl } = await saveBase64Hybrid(
    base64Data, 
    'node_360.jpg', 
    '360_images'
);
```

**`deleteFileHybrid(localPath, cloudinaryUrl)`**
- Deletes from Cloudinary (by URL)
- Deletes from local filesystem (optional)
- Safe - won't crash if files don't exist

```javascript
await deleteFileHybrid(null, node.image360); // Only delete from Cloudinary
```

### Routes Updated

#### Web Routes (`src/routes/web.js`)

**Node Create**
```javascript
router.post('/nodes/create', upload360Hybrid.single('image_360'), async (req, res) => {
    const node = await Nodes.create({ /* ... */ });
    
    if (req.file) {
        const { cloudinaryUrl } = await saveFileHybrid(req.file, '360_images');
        await node.update({ image360: cloudinaryUrl });
    }
});
```

**Node Edit**
```javascript
router.post('/nodes/:node_id/edit', upload360Hybrid.single('image_360'), async (req, res) => {
    if (req.file) {
        // Delete old from Cloudinary
        if (node.image360) await deleteFileHybrid(null, node.image360);
        
        // Save new to both local and Cloudinary
        const { cloudinaryUrl } = await saveFileHybrid(req.file, '360_images');
        updateData.image360 = cloudinaryUrl;
    }
});
```

**Node Delete**
```javascript
router.post('/nodes/:node_id/delete', async (req, res) => {
    // Delete from both local and Cloudinary
    if (node.image360) await deleteFileHybrid(null, node.image360);
    if (node.qrcode) await deleteQRCode(node.qrcode);
    await node.destroy();
});
```

#### Mobile API Routes (`src/routes/mobileApi.js`)

**Base64 Upload (React Native)**
```javascript
router.post('/admin/nodes/create', requireAuth, async (req, res) => {
    const { image360_base64 } = req.body;
    
    if (image360_base64) {
        const { cloudinaryUrl } = await saveBase64Hybrid(
            image360_base64,
            `${node.node_code}_360.jpg`,
            '360_images'
        );
        await node.update({ image360: cloudinaryUrl });
    }
});
```

## Testing

### Test Hybrid Upload
```bash
node src/scripts/testHybridUpload.js
```

Expected output:
```
✅ Upload successful!
📂 Local Path: 360_images/test_1234567890.png
☁️  Cloudinary URL: https://res.cloudinary.com/...
📁 Local file exists: ✅ Yes
🌐 Valid Cloudinary URL: ✅ Yes
✅ Hybrid upload system is working correctly!
```

### Verify Files Exist

**Check local files:**
```bash
Get-ChildItem media/360_images
```

**Check database URLs:**
```bash
node -e "const {Nodes} = require('./src/models'); Nodes.findOne().then(n => console.log(n.image360))"
```

Should output Cloudinary URL:
```
https://res.cloudinary.com/dir9ljc5q/image/upload/...
```

## Benefits of Hybrid Approach

### ✅ Advantages

1. **Local Backup**
   - Full copy of all images on your server
   - Protection against Cloudinary issues
   - Easy migration if needed
   - Local access for debugging

2. **Cloud Delivery**
   - Fast CDN delivery worldwide
   - Automatic image optimization
   - Reduced server bandwidth
   - Mobile app gets optimized images

3. **Redundancy**
   - Two copies of every image
   - Protection against data loss
   - Can restore from local if Cloudinary fails

4. **Cost Optimization**
   - Cloudinary for public-facing delivery
   - Local storage for backups (no bandwidth cost)
   - Can switch between sources if needed

### ⚠️ Considerations

1. **Disk Space**
   - Local storage uses disk space
   - Plan for growing image library
   - Monitor disk usage

2. **Sync**
   - Ensure both uploads succeed
   - Handle partial failures gracefully
   - Current implementation prioritizes Cloudinary

3. **Deletion**
   - Deletes from Cloudinary first
   - Local files can accumulate if deletion fails
   - Consider cleanup script

## Disk Space Management

### Current Usage
```bash
# Check media folder size
Get-ChildItem media -Recurse | Measure-Object -Property Length -Sum
```

### Cleanup Old Files (Optional)
If you want to remove old local backups after they're safely in Cloudinary:

```javascript
// src/scripts/cleanupLocalBackups.js
// Remove local files older than 30 days
const fs = require('fs').promises;
const path = require('path');

const MAX_AGE_DAYS = 30;
const mediaDir = path.join(__dirname, '../../media/360_images');

// Implementation would check file age and remove old files
```

## Migration Status

All existing images were migrated to both local and Cloudinary:

- ✅ **360° Images**: 24 images backed up locally + uploaded to Cloudinary
- ✅ **QR Codes**: 29 codes backed up locally + uploaded to Cloudinary
- ✅ **Campus Maps**: 1 map backed up locally + uploaded to Cloudinary

## Troubleshooting

### Images Not Saving Locally
```bash
# Check directory permissions
Test-Path media/360_images -PathType Container

# Create directory if missing
New-Item -ItemType Directory -Path media/360_images -Force
```

### Cloudinary Upload Fails
- Check `.env` for correct credentials
- Verify internet connection
- Check Cloudinary dashboard for quota limits
- Local file still saved as backup

### Database Has Wrong URLs
```bash
# Verify URLs point to Cloudinary
node -e "const {Nodes} = require('./src/models'); Nodes.findAll().then(nodes => nodes.forEach(n => console.log(n.node_code, n.image360)))"
```

All URLs should start with `https://res.cloudinary.com/`

## Best Practices

1. **Regular Backups**
   - Backup `media/` folder regularly
   - Export Cloudinary images periodically
   - Keep database backups

2. **Monitor Disk Space**
   - Check available disk space weekly
   - Plan for growth (estimate 5-10MB per 360° image)

3. **Test Uploads**
   - Periodically test upload functionality
   - Verify both local and cloud copies exist

4. **Error Handling**
   - Monitor logs for upload failures
   - Retry failed uploads
   - Alert on persistent failures

## Summary

Your Express application now saves all uploaded images in **two locations**:

1. **Local**: `media/360_images/` - Backup copy on your server
2. **Cloud**: Cloudinary CDN - Fast delivery to mobile apps

The database stores Cloudinary URLs for client delivery, ensuring fast performance while maintaining local backups for safety.

**Test it:**
```bash
node src/scripts/testHybridUpload.js
```

**Result:** Every image upload creates both a local file AND a Cloudinary asset! 🎉
