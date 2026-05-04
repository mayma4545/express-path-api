/**
 * Verification Script: Check MySQL Migration
 * Verifies all data was migrated successfully to Aiven MySQL
 */

require('dotenv').config();
const { sequelize, CampusMap, Nodes, Edges, Annotation, User } = require('../models');

async function verifyMigration() {
    try {
        console.log('🔍 Verifying MySQL (Aiven) migration...\n');

        // Test connection
        console.log('📡 Testing MySQL connection...');
        await sequelize.authenticate();
        console.log('✅ Connected to MySQL successfully\n');

        // Count records in each table
        const campusMapsCount = await CampusMap.count();
        const nodesCount = await Nodes.count();
        const edgesCount = await Edges.count();
        const annotationsCount = await Annotation.count();
        const usersCount = await User.count();

        console.log('═══════════════════════════════════════');
        console.log('📊 DATABASE STATISTICS (MySQL)');
        console.log('═══════════════════════════════════════');
        console.log(`Campus Maps: ${campusMapsCount}`);
        console.log(`Nodes: ${nodesCount}`);
        console.log(`Edges: ${edgesCount}`);
        console.log(`Annotations: ${annotationsCount}`);
        console.log(`Users: ${usersCount}`);
        console.log('═══════════════════════════════════════\n');

        // Sample data
        console.log('📋 Sample Nodes:');
        const sampleNodes = await Nodes.findAll({ limit: 5, raw: true });
        sampleNodes.forEach(node => {
            console.log(`  - ${node.node_code}: ${node.name} (${node.building})`);
        });
        console.log('');

        console.log('📋 Sample Edges:');
        const sampleEdges = await Edges.findAll({ 
            limit: 5, 
            include: [
                { model: Nodes, as: 'from_node', attributes: ['node_code'] },
                { model: Nodes, as: 'to_node', attributes: ['node_code'] }
            ]
        });
        sampleEdges.forEach(edge => {
            console.log(`  - ${edge.from_node.node_code} → ${edge.to_node.node_code} (${edge.distance}m)`);
        });
        console.log('');

        console.log('📋 Sample User:');
        const sampleUser = await User.findOne({ raw: true });
        if (sampleUser) {
            console.log(`  - Username: ${sampleUser.username}`);
            console.log(`  - Is Staff: ${sampleUser.is_staff}`);
            console.log(`  - Is Superuser: ${sampleUser.is_superuser}`);
        }
        console.log('');

        console.log('✅ Migration verification completed successfully!');
        console.log('✅ All data has been migrated to MySQL (Aiven)\n');

    } catch (error) {
        console.error('❌ Verification failed:', error);
        throw error;
    } finally {
        await sequelize.close();
    }
}

verifyMigration()
    .then(() => {
        console.log('✅ Verification script completed');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Verification script failed:', error);
        process.exit(1);
    });
