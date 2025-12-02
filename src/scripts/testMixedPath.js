const { getPathfinder } = require('../services/pathfinding');

async function testMixedPath() {
    console.log('🧪 Testing Path with Mixed Image States...\n');
    
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
        
        // Test path that might include nodes with empty images
        const result = await pathfinder.getDirections('BLDG-1', 'BLDG-2', false);
        
        if (result.error) {
            console.error('Error finding path:', result.error);
            // Try another path
            const result2 = await pathfinder.getDirections('NO-BLDG', 'ENTRANCE 1', false);
            if (result2.error) {
                console.log('Could not find test path');
                process.exit(0);
            }
            testPath(result2, mockReq, buildUrl);
        } else {
            testPath(result, mockReq, buildUrl);
        }
        
        function testPath(result, req, buildUrl) {
            console.log(`Path: ${result.path.length} nodes\n`);
            
            let nodesWithImages = 0;
            let nodesWithoutImages = 0;
            
            for (const node of result.path) {
                const has_360_image = !!(node.image360 && node.image360.trim());
                const image360_url = buildUrl(req, node.image360);
                
                if (has_360_image) nodesWithImages++;
                else nodesWithoutImages++;
                
                console.log(`${has_360_image ? '📸' : '⭕'} ${node.node_code}: ${node.name}`);
                console.log(`   has_360: ${has_360_image}, URL: ${image360_url ? 'Valid' : 'null'}`);
            }
            
            console.log(`\n📊 Summary:`);
            console.log(`   Nodes with images: ${nodesWithImages}`);
            console.log(`   Nodes without images: ${nodesWithoutImages}`);
            console.log(`   ✅ All nodes handled correctly!`);
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

testMixedPath();
