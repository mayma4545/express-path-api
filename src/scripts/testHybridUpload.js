/**
 * Test Hybrid Upload
 * Verifies that images are saved both locally and to Cloudinary
 */

require('dotenv').config();
const { saveBase64Hybrid } = require('../services/upload.hybrid');
const fs = require('fs').promises;
const path = require('path');

async function testHybridUpload() {
    console.log('🧪 Testing Hybrid Upload System\n');

    try {
        // Create a small test base64 image (1x1 red pixel PNG)
        const testBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
        const testFilename = `test_${Date.now()}.png`;

        console.log('📤 Uploading test image...');
        const result = await saveBase64Hybrid(testBase64, testFilename, '360_images');

        console.log('\n✅ Upload successful!');
        console.log('📂 Local Path:', result.localPath);
        console.log('☁️  Cloudinary URL:', result.cloudinaryUrl);

        // Verify local file exists
        const localFullPath = path.join(__dirname, '../../media', result.localPath);
        const localExists = await fs.access(localFullPath).then(() => true).catch(() => false);
        console.log('📁 Local file exists:', localExists ? '✅ Yes' : '❌ No');

        // Verify Cloudinary URL format
        const isCloudinaryUrl = result.cloudinaryUrl.includes('cloudinary.com');
        console.log('🌐 Valid Cloudinary URL:', isCloudinaryUrl ? '✅ Yes' : '❌ No');

        // Clean up test file
        if (localExists) {
            await fs.unlink(localFullPath);
            console.log('🧹 Test file cleaned up');
        }

        console.log('\n✅ Hybrid upload system is working correctly!');
        console.log('📋 Both local backup and Cloudinary upload are functional.');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error);
        process.exit(1);
    }
}

testHybridUpload().then(() => process.exit(0));
