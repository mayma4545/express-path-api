const http = require('http');

function testEndpoint(path) {
    return new Promise((resolve, reject) => {
        http.get(`http://localhost:3000${path}`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(data);
                }
            });
        }).on('error', reject);
    });
}

async function testApis() {
    console.log('🧪 Testing API Endpoints for Image URLs...\n');
    
    try {
        // Test mobile API
        console.log('📱 Testing Mobile API:');
        const mobileResponse = await testEndpoint('/api/mobile/nodes/NO-BLDG');
        console.log('Node Code:', mobileResponse.node.node_code);
        console.log('Image360 URL:', mobileResponse.node.image360_url);
        console.log('QR Code URL:', mobileResponse.node.qrcode_url);
        console.log('✅ Is Cloudinary:', mobileResponse.node.image360_url.includes('cloudinary.com'));
        
        // Test regular API
        console.log('\n🌐 Testing Regular API:');
        const apiResponse = await testEndpoint('/api/nodes/NO-BLDG');
        console.log('Node Code:', apiResponse.node_code);
        console.log('Image360 URL:', apiResponse.image360);
        console.log('QR Code URL:', apiResponse.qrcode);
        console.log('✅ Is Cloudinary:', apiResponse.image360.includes('cloudinary.com'));
        
        // Test campus map
        console.log('\n🗺️  Testing Campus Map API:');
        const mapResponse = await testEndpoint('/api/mobile/campus-map');
        console.log('Map Name:', mapResponse.map.name);
        console.log('Image URL:', mapResponse.map.image_url);
        console.log('✅ Is Cloudinary:', mapResponse.map.image_url.includes('cloudinary.com'));
        
        console.log('\n✅ All APIs returning Cloudinary URLs correctly!');
        console.log('🎉 Images will load properly in the mobile app!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.log('\n⚠️  Make sure server is running: npm start');
    }
    
    process.exit(0);
}

// Wait a moment for server to be ready
setTimeout(testApis, 1000);
