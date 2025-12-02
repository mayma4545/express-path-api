/**
 * Migrate Local Images to Cloudinary
 * Uploads all existing local images to Cloudinary and updates database URLs
 */

require('dotenv').config();
const { sequelize, Nodes, CampusMap } = require('../models');
const { Op } = require('sequelize');
const { cloudinary, uploadToCloudinary, deleteFromCloudinary } = require('../services/cloudinary');
const { uploadQRCode } = require('../services/cloudinary');
const fs = require('fs').promises;
const path = require('path');

const MEDIA_DIR = path.join(__dirname, '../../media');

class ImageMigrator {
    constructor() {
        this.stats = {
            images_360: { total: 0, success: 0, failed: 0 },
            qrcodes: { total: 0, success: 0, failed: 0 },
            campus_maps: { total: 0, success: 0, failed: 0 },
            errors: []
        };
    }

    /**
     * Upload a local file to Cloudinary
     */
    async uploadFile(localPath, folder) {
        try {
            const fullPath = path.join(MEDIA_DIR, localPath);
            
            // Check if file exists
            try {
                await fs.access(fullPath);
            } catch {
                throw new Error(`File not found: ${fullPath}`);
            }

            // Upload to Cloudinary
            const result = await cloudinary.uploader.upload(fullPath, {
                folder: `campus-navigator/${folder}`,
                resource_type: 'image',
                quality: 'auto',
                fetch_format: 'auto'
            });

            return result.secure_url;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Migrate 360° images
     */
    async migrate360Images() {
        console.log('\n📸 Migrating 360° Images...');
        
        const nodes = await Nodes.findAll({
            where: {
                image360: { [Op.ne]: null }
            }
        });

        this.stats.images_360.total = nodes.length;

        for (const node of nodes) {
            try {
                // Skip if already a Cloudinary URL
                if (node.image360 && node.image360.includes('cloudinary.com')) {
                    console.log(`  ⏭️  Already migrated: ${node.node_code}`);
                    this.stats.images_360.success++;
                    continue;
                }

                console.log(`  📤 Uploading: ${node.node_code} - ${node.image360}`);
                
                const cloudinaryUrl = await this.uploadFile(node.image360, '360-images');
                
                await node.update({ image360: cloudinaryUrl });
                
                console.log(`  ✅ Success: ${node.node_code}`);
                this.stats.images_360.success++;
            } catch (error) {
                console.error(`  ❌ Failed: ${node.node_code} - ${error.message}`);
                this.stats.images_360.failed++;
                this.stats.errors.push({
                    type: '360_image',
                    node: node.node_code,
                    error: error.message
                });
            }
        }
    }

    /**
     * Migrate QR codes
     */
    async migrateQRCodes() {
        console.log('\n🔲 Migrating QR Codes...');
        
        const nodes = await Nodes.findAll({
            where: {
                qrcode: { [Op.ne]: null }
            }
        });

        this.stats.qrcodes.total = nodes.length;

        for (const node of nodes) {
            try {
                // Skip if already a Cloudinary URL
                if (node.qrcode && node.qrcode.includes('cloudinary.com')) {
                    console.log(`  ⏭️  Already migrated: ${node.node_code}`);
                    this.stats.qrcodes.success++;
                    continue;
                }

                console.log(`  📤 Uploading: ${node.node_code} - ${node.qrcode}`);
                
                const cloudinaryUrl = await this.uploadFile(node.qrcode, 'qrcodes');
                
                await node.update({ qrcode: cloudinaryUrl });
                
                console.log(`  ✅ Success: ${node.node_code}`);
                this.stats.qrcodes.success++;
            } catch (error) {
                console.error(`  ❌ Failed: ${node.node_code} - ${error.message}`);
                this.stats.qrcodes.failed++;
                this.stats.errors.push({
                    type: 'qrcode',
                    node: node.node_code,
                    error: error.message
                });
            }
        }
    }

    /**
     * Migrate campus maps
     */
    async migrateCampusMaps() {
        console.log('\n🗺️  Migrating Campus Maps...');
        
        const maps = await CampusMap.findAll({
            where: {
                blueprint_image: { [Op.ne]: null }
            }
        });

        this.stats.campus_maps.total = maps.length;

        for (const map of maps) {
            try {
                // Skip if already a Cloudinary URL
                if (map.blueprint_image && map.blueprint_image.includes('cloudinary.com')) {
                    console.log(`  ⏭️  Already migrated: ${map.name}`);
                    this.stats.campus_maps.success++;
                    continue;
                }

                console.log(`  📤 Uploading: ${map.name} - ${map.blueprint_image}`);
                
                const cloudinaryUrl = await this.uploadFile(map.blueprint_image, 'campus-maps');
                
                await map.update({ blueprint_image: cloudinaryUrl });
                
                console.log(`  ✅ Success: ${map.name}`);
                this.stats.campus_maps.success++;
            } catch (error) {
                console.error(`  ❌ Failed: ${map.name} - ${error.message}`);
                this.stats.campus_maps.failed++;
                this.stats.errors.push({
                    type: 'campus_map',
                    map: map.name,
                    error: error.message
                });
            }
        }
    }

    /**
     * Print migration summary
     */
    printSummary() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 Migration Summary');
        console.log('='.repeat(60));
        
        console.log('\n360° Images:');
        console.log(`  Total:   ${this.stats.images_360.total}`);
        console.log(`  Success: ${this.stats.images_360.success}`);
        console.log(`  Failed:  ${this.stats.images_360.failed}`);
        
        console.log('\nQR Codes:');
        console.log(`  Total:   ${this.stats.qrcodes.total}`);
        console.log(`  Success: ${this.stats.qrcodes.success}`);
        console.log(`  Failed:  ${this.stats.qrcodes.failed}`);
        
        console.log('\nCampus Maps:');
        console.log(`  Total:   ${this.stats.campus_maps.total}`);
        console.log(`  Success: ${this.stats.campus_maps.success}`);
        console.log(`  Failed:  ${this.stats.campus_maps.failed}`);
        
        if (this.stats.errors.length > 0) {
            console.log('\n⚠️  Errors:');
            this.stats.errors.forEach((err, i) => {
                console.log(`  ${i + 1}. [${err.type}] ${err.node || err.map}: ${err.error}`);
            });
        }
        
        console.log('\n' + '='.repeat(60));
    }

    /**
     * Run the migration
     */
    async run() {
        try {
            console.log('='.repeat(60));
            console.log('🚀 Cloudinary Image Migration');
            console.log('='.repeat(60));
            
            // Check Cloudinary configuration
            if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
                console.error('\n❌ Cloudinary credentials not configured in .env file');
                console.error('Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET');
                return false;
            }
            
            console.log(`\n✅ Cloudinary configured: ${process.env.CLOUDINARY_CLOUD_NAME}`);
            
            // Connect to database
            await sequelize.authenticate();
            console.log('✅ Database connected');
            
            // Run migrations
            await this.migrate360Images();
            await this.migrateQRCodes();
            await this.migrateCampusMaps();
            
            // Print summary
            this.printSummary();
            
            const totalSuccess = this.stats.images_360.success + this.stats.qrcodes.success + this.stats.campus_maps.success;
            const totalFailed = this.stats.images_360.failed + this.stats.qrcodes.failed + this.stats.campus_maps.failed;
            
            if (totalFailed === 0) {
                console.log('\n🎉 All images migrated successfully!');
            } else {
                console.log(`\n⚠️  Migration completed with ${totalFailed} errors`);
            }
            
            return true;
        } catch (error) {
            console.error('\n❌ Migration failed:', error);
            return false;
        } finally {
            await sequelize.close();
        }
    }
}

// Run migration if called directly
if (require.main === module) {
    const migrator = new ImageMigrator();
    migrator.run().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = ImageMigrator;
