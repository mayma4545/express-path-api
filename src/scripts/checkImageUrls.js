const { Nodes, CampusMap } = require('../models');

async function checkUrls() {
    try {
        console.log('🔍 Checking Image URLs...\n');
        
        const node = await Nodes.findOne({ where: { node_code: 'NO-BLDG' } });
        if (node) {
            console.log('Node:', node.node_code);
            console.log('Image360:', node.image360);
            console.log('QR Code:', node.qrcode);
            console.log('Is Cloudinary:', node.image360?.includes('cloudinary.com') ? '✅' : '❌');
        }
        
        const map = await CampusMap.findOne();
        if (map) {
            console.log('\nCampus Map:', map.name);
            console.log('Blueprint:', map.blueprint_image);
            console.log('Is Cloudinary:', map.blueprint_image?.includes('cloudinary.com') ? '✅' : '❌');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkUrls();
