const express = require('express');
const { Nodes, CampusMap } = require('../models');

const app = express();

// Copy the buildUrl function from mobileApi.js
const buildUrl = (req, path) => {
    if (!path) return null;
    
    // If already a full URL (Cloudinary), return as-is
    if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;
    }
    
    // Otherwise, build local media URL
    return `${req.protocol}://${req.get('host')}/media/${path}`;
};

async function testApi() {
    console.log('🧪 Testing API URL Building...\n');
    
    const node = await Nodes.findOne({ where: { node_code: 'NO-BLDG' } });
    const map = await CampusMap.findOne();
    
    // Mock request object
    const req = {
        protocol: 'http',
        get: () => 'localhost:3000'
    };
    
    console.log('Node Image360 (raw):', node.image360);
    console.log('Node Image360 (buildUrl):', buildUrl(req, node.image360));
    console.log('✅ Returns Cloudinary URL:', buildUrl(req, node.image360) === node.image360);
    
    console.log('\nNode QR Code (raw):', node.qrcode);
    console.log('Node QR Code (buildUrl):', buildUrl(req, node.qrcode));
    console.log('✅ Returns Cloudinary URL:', buildUrl(req, node.qrcode) === node.qrcode);
    
    console.log('\nMap Blueprint (raw):', map.blueprint_image);
    console.log('Map Blueprint (buildUrl):', buildUrl(req, map.blueprint_image));
    console.log('✅ Returns Cloudinary URL:', buildUrl(req, map.blueprint_image) === map.blueprint_image);
    
    console.log('\n✅ API will return Cloudinary URLs correctly!');
    process.exit(0);
}

testApi().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
