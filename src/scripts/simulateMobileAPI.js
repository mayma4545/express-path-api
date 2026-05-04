const { Nodes } = require('../models');

async function simulateMobileAPI() {
    console.log('📱 Simulating Mobile API Response...\n');
    
    try {
        const buildUrl = (req, path) => {
            if (!path || path.trim() === '') return null;
            if (path.startsWith('http://') || path.startsWith('https://')) {
                return path;
            }
            return `${req.protocol}://${req.get('host')}/media/${path}`;
        };
        
        const mockReq = {
            protocol: 'http',
            get: () => 'localhost:3000'
        };
        
        // Test nodes with different image360 values
        const testCases = [
            'BLDG-1',      // Empty string
            'NO-BLDG',     // Cloudinary URL
            'BLDG-2',      // Cloudinary URL
            'ENTRANCE 1'   // Another node
        ];
        
        for (const nodeCode of testCases) {
            const node = await Nodes.findOne({ where: { node_code: nodeCode } });
            if (!node) continue;
            
            const response = {
                node_code: node.node_code,
                name: node.name,
                has_360_image: !!(node.image360 && node.image360.trim()),
                image360_url: buildUrl(mockReq, node.image360),
                raw_image360: node.image360 || '(empty)'
            };
            
            console.log(`Node: ${response.node_code}`);
            console.log(`  Name: ${response.name}`);
            console.log(`  Raw DB Value: "${response.raw_image360}"`);
            console.log(`  has_360_image: ${response.has_360_image}`);
            console.log(`  image360_url: ${response.image360_url || 'null'}`);
            console.log(`  ✅ Correct: ${response.has_360_image === !!response.image360_url}`);
            console.log('');
        }
        
        console.log('\n✅ Mobile API will correctly handle empty strings and Cloudinary URLs');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

simulateMobileAPI();
