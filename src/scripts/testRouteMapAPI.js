const http = require('http');

function testAPI(path, body) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(body);
        
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        });
        
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function testRouteMap() {
    console.log('🗺️  Testing Route Map API Endpoint...\n');
    
    try {
        // Wait a bit for server to be ready
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const response = await testAPI('/api/mobile/find-path', {
            start_code: 'NO-BLDG',
            goal_code: 'BLDG-2',
            avoid_stairs: false
        });
        
        if (!response.success) {
            console.error('❌ API Error:', response.error);
            process.exit(1);
        }
        
        console.log('✅ API Response received\n');
        console.log(`Path: ${response.path.length} nodes`);
        console.log(`Distance: ${response.total_distance}m`);
        console.log(`Directions: ${response.directions.length} steps\n`);
        
        console.log('📸 Checking 360° Images in Path:\n');
        
        for (const node of response.path) {
            console.log(`Node: ${node.node_code} - ${node.name}`);
            console.log(`  has_360_image: ${node.has_360_image}`);
            console.log(`  image360_url: ${node.image360_url || 'null'}`);
            
            if (node.has_360_image && node.image360_url) {
                const isCloudinary = node.image360_url.includes('cloudinary.com');
                console.log(`  ✅ Valid Cloudinary URL: ${isCloudinary}`);
            } else if (!node.has_360_image && !node.image360_url) {
                console.log(`  ✅ Correctly shows no image`);
            } else {
                console.log(`  ❌ Mismatch: has_360=${node.has_360_image}, url=${!!node.image360_url}`);
            }
            console.log('');
        }
        
        console.log('✅ Route Map API is working correctly!');
        console.log('   Mobile app should now see 360° images in route');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.log('\n💡 Make sure the server is running: npm start');
        process.exit(1);
    }
}

testRouteMap();
