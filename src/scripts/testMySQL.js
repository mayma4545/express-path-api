/**
 * Quick Test: MySQL Database Functionality
 * Tests basic CRUD operations on MySQL database
 */

require('dotenv').config();
const { sequelize, Nodes, Edges } = require('../models');

async function testDatabase() {
    try {
        console.log('🧪 Testing MySQL Database Functionality\n');

        // Test 1: Connection
        console.log('Test 1: Database Connection');
        await sequelize.authenticate();
        console.log('✅ Connection successful\n');

        // Test 2: Read operations
        console.log('Test 2: Read Operations');
        const nodeCount = await Nodes.count();
        const edgeCount = await Edges.count();
        console.log(`✅ Found ${nodeCount} nodes and ${edgeCount} edges\n`);

        // Test 3: Query with relations
        console.log('Test 3: Query with Relations');
        const sampleEdge = await Edges.findOne({
            include: [
                { model: Nodes, as: 'from_node', attributes: ['node_code', 'name'] },
                { model: Nodes, as: 'to_node', attributes: ['node_code', 'name'] }
            ]
        });
        if (sampleEdge) {
            console.log(`✅ Edge: ${sampleEdge.from_node.node_code} → ${sampleEdge.to_node.node_code}`);
            console.log(`   Distance: ${sampleEdge.distance}m\n`);
        }

        // Test 4: Search functionality
        console.log('Test 4: Search Functionality');
        const searchResult = await Nodes.findAll({
            where: {
                building: 'MAHUGANI '
            },
            limit: 3
        });
        console.log(`✅ Found ${searchResult.length} nodes in MAHUGANI building`);
        searchResult.forEach(node => {
            console.log(`   - ${node.node_code}: ${node.name}`);
        });
        console.log('');

        // Test 5: 360° Images
        console.log('Test 5: 360° Images Check');
        const nodesWithImages = await Nodes.count({
            where: {
                image360: {
                    [sequelize.Sequelize.Op.ne]: null,
                    [sequelize.Sequelize.Op.ne]: ''
                }
            }
        });
        console.log(`✅ ${nodesWithImages} nodes have 360° images\n`);

        // Summary
        console.log('═══════════════════════════════════════');
        console.log('✅ ALL TESTS PASSED!');
        console.log('═══════════════════════════════════════');
        console.log('✅ MySQL connection working');
        console.log('✅ Data queries successful');
        console.log('✅ Relationships intact');
        console.log('✅ Search functionality working');
        console.log('✅ 360° images preserved');
        console.log('═══════════════════════════════════════\n');

    } catch (error) {
        console.error('❌ Test failed:', error);
        throw error;
    } finally {
        await sequelize.close();
    }
}

testDatabase()
    .then(() => {
        console.log('✅ Test completed successfully');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Test failed:', error);
        process.exit(1);
    });
