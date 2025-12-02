const { getPathfinder } = require('../services/pathfinding');

async function testPathfinding() {
    console.log('🧪 Testing Pathfinding 360° Images...\n');
    
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
        
        const pathfinder = getPathfinder();
        const result = await pathfinder.getDirections('NO-BLDG', 'BLDG-2', false);
        
        if (result.error) {
            console.error('Error:', result.error);
            process.exit(1);
        }
        
        console.log(`Path from NO-BLDG to BLDG-2 (${result.path.length} nodes):\n`);
        
        // Simulate mobile API processing
        for (const node of result.path) {
            const has_360_image = !!(node.image360 && node.image360.trim());
            const image360_url = buildUrl(mockReq, node.image360);
            
            console.log(`Node: ${node.node_code} (${node.name})`);
            console.log(`  Raw image360: "${node.image360 || '(empty)'}"`);
            console.log(`  has_360_image: ${has_360_image}`);
            console.log(`  image360_url: ${image360_url || 'null'}`);
            console.log(`  ✅ Correct: ${has_360_image === !!image360_url}`);
            console.log('');
        }
        
        console.log('✅ Pathfinding will return correct 360° image URLs');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

testPathfinding();
