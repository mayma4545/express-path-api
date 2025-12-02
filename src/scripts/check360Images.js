const { Nodes } = require('../models');

async function check360Images() {
    console.log('🔍 Checking 360° Image URLs...\n');
    
    try {
        // Get nodes with 360 images
        const nodes = await Nodes.findAll({
            where: { image360: { [require('sequelize').Op.ne]: null } },
            limit: 5
        });
        
        console.log(`Found ${nodes.length} nodes with 360° images:\n`);
        
        nodes.forEach(node => {
            console.log(`Node: ${node.node_code}`);
            console.log(`  Name: ${node.name}`);
            console.log(`  Image360: ${node.image360}`);
            console.log(`  Is URL: ${node.image360 ? (node.image360.startsWith('http') ? '✅' : '❌') : '❌'}`);
            console.log(`  Is Cloudinary: ${node.image360?.includes('cloudinary.com') ? '✅' : '❌'}`);
            console.log('');
        });
        
        // Check what mobile API would return
        const testNode = nodes[0];
        if (testNode) {
            console.log('\n📱 Mobile API Response Format:');
            const mockReq = {
                protocol: 'http',
                get: () => 'localhost:3000'
            };
            
            const buildUrl = (req, path) => {
                if (!path) return null;
                if (path.startsWith('http://') || path.startsWith('https://')) {
                    return path;
                }
                return `${req.protocol}://${req.get('host')}/media/${path}`;
            };
            
            console.log('image360_url:', buildUrl(mockReq, testNode.image360));
            console.log('has_360_image:', !!testNode.image360);
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

check360Images();
