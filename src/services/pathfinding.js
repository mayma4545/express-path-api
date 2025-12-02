/**
 * A* Pathfinding Algorithm for Campus Navigation
 * Mirrors Django pathfinding.py implementation
 * 
 * Features:
 * - Edge distances (actual cost)
 * - Compass angles for directional awareness
 * - Staircase detection (is_staircase flag)
 * - Active/inactive edges (is_active flag)
 */

const { Nodes, Edges } = require('../models');

class PathFinder {
    constructor() {
        this.nodesCache = new Map();
        this.graph = new Map();
        this.initialized = false;
    }

    /**
     * Build adjacency list from database edges
     */
    async buildGraph() {
        this.nodesCache.clear();
        this.graph.clear();

        // Cache all nodes
        const nodes = await Nodes.findAll();
        for (const node of nodes) {
            this.nodesCache.set(node.node_id, node.toJSON());
            this.graph.set(node.node_id, []);
        }

        // Build adjacency list from active edges
        const edges = await Edges.findAll({
            where: { is_active: true },
            include: [
                { model: Nodes, as: 'from_node' },
                { model: Nodes, as: 'to_node' }
            ]
        });

        for (const edge of edges) {
            const fromId = edge.from_node_id;
            const toId = edge.to_node_id;

            // Add forward edge
            if (this.graph.has(fromId)) {
                this.graph.get(fromId).push({
                    to: toId,
                    distance: edge.distance,
                    compass_angle: edge.compass_angle,
                    is_staircase: edge.is_staircase,
                    edge_id: edge.edge_id
                });
            }

            // Add reverse edge (bidirectional)
            const reverseAngle = (edge.compass_angle + 180) % 360;
            if (this.graph.has(toId)) {
                this.graph.get(toId).push({
                    to: fromId,
                    distance: edge.distance,
                    compass_angle: reverseAngle,
                    is_staircase: edge.is_staircase,
                    edge_id: edge.edge_id
                });
            }
        }

        this.initialized = true;
    }

    /**
     * Heuristic for A*: Estimate distance using floor difference
     * Assumes ~4 meters per floor level
     */
    heuristic(nodeAId, nodeBId) {
        const nodeA = this.nodesCache.get(nodeAId);
        const nodeB = this.nodesCache.get(nodeBId);

        if (!nodeA || !nodeB) return 0.0;

        const floorDiff = Math.abs(nodeA.floor_level - nodeB.floor_level);
        return floorDiff * 4.0; // Assume 4 meters per floor
    }

    /**
     * Find shortest path using A* algorithm
     * @param {string} startCode - Starting node code
     * @param {string} goalCode - Destination node code
     * @param {boolean} avoidStairs - If true, avoid edges with is_staircase=True
     * @returns {Object} Path details or error message
     */
    async findPath(startCode, goalCode, avoidStairs = false) {
        if (!this.initialized) {
            await this.buildGraph();
        }

        // Find start and goal nodes
        const startNode = await Nodes.findOne({ where: { node_code: startCode } });
        const goalNode = await Nodes.findOne({ where: { node_code: goalCode } });

        if (!startNode) {
            return { error: `Start node not found: ${startCode}` };
        }
        if (!goalNode) {
            return { error: `Goal node not found: ${goalCode}` };
        }

        const startId = startNode.node_id;
        const goalId = goalNode.node_id;

        // A* data structures
        const openSet = new MinHeap();
        openSet.push(0, startId);

        const cameFrom = new Map(); // {node_id: {prev: previous_node_id, edge: edge_info}}
        const gScore = new Map([[startId, 0]]);
        const fScore = new Map([[startId, this.heuristic(startId, goalId)]]);
        const visited = new Set();

        while (!openSet.isEmpty()) {
            const { value: currentId } = openSet.pop();

            if (visited.has(currentId)) continue;
            visited.add(currentId);

            // Goal reached
            if (currentId === goalId) {
                return this.reconstructPath(cameFrom, startId, goalId, gScore.get(goalId));
            }

            // Explore neighbors
            const neighbors = this.graph.get(currentId) || [];
            for (const edgeInfo of neighbors) {
                const neighborId = edgeInfo.to;

                // Skip stairs if requested
                if (avoidStairs && edgeInfo.is_staircase) continue;

                // Calculate tentative g_score
                const tentativeG = gScore.get(currentId) + edgeInfo.distance;

                if (!gScore.has(neighborId) || tentativeG < gScore.get(neighborId)) {
                    // Better path found
                    cameFrom.set(neighborId, { prev: currentId, edge: edgeInfo });
                    gScore.set(neighborId, tentativeG);
                    const f = tentativeG + this.heuristic(neighborId, goalId);
                    fScore.set(neighborId, f);
                    openSet.push(f, neighborId);
                }
            }
        }

        return { error: 'No path found between the specified nodes' };
    }

    /**
     * Reconstruct path from cameFrom map
     */
    reconstructPath(cameFrom, startId, goalId, totalDistance) {
        const path = [];
        let currentId = goalId;

        while (currentId !== startId) {
            if (!cameFrom.has(currentId)) break;

            const { prev, edge } = cameFrom.get(currentId);
            const node = this.nodesCache.get(currentId);

            path.push({
                node_id: node.node_id,
                node_code: node.node_code,
                name: node.name,
                building: node.building,
                floor_level: node.floor_level,
                type: node.type_of_node,
                image360: node.image360 || null,
                map_x: node.map_x !== null ? parseFloat(node.map_x) : null,
                map_y: node.map_y !== null ? parseFloat(node.map_y) : null,
                distance_from_prev: edge.distance,
                compass_angle: edge.compass_angle,
                is_staircase: edge.is_staircase
            });

            currentId = prev;
        }

        // Add start node
        const startNode = this.nodesCache.get(startId);
        path.push({
            node_id: startNode.node_id,
            node_code: startNode.node_code,
            name: startNode.name,
            building: startNode.building,
            floor_level: startNode.floor_level,
            type: startNode.type_of_node,
            image360: startNode.image360 || null,
            map_x: startNode.map_x !== null ? parseFloat(startNode.map_x) : null,
            map_y: startNode.map_y !== null ? parseFloat(startNode.map_y) : null,
            distance_from_prev: 0,
            compass_angle: null,
            is_staircase: false
        });

        path.reverse();

        return {
            success: true,
            path,
            total_distance: Math.round(totalDistance * 100) / 100,
            num_nodes: path.length,
            start: path[0],
            goal: path[path.length - 1]
        };
    }

    /**
     * Get turn-by-turn directions with compass headings
     */
    async getDirections(startCode, goalCode, avoidStairs = false) {
        const result = await this.findPath(startCode, goalCode, avoidStairs);

        if (result.error) return result;

        // Add human-readable directions
        const directions = [];
        for (let i = 0; i < result.path.length; i++) {
            const step = result.path[i];
            if (i === 0) {
                directions.push(`Start at ${step.name} (${step.building}, Floor ${step.floor_level})`);
            } else {
                const compassDir = step.compass_angle !== null 
                    ? this.compassToDirection(step.compass_angle) 
                    : 'forward';
                const stairInfo = step.is_staircase ? ' via stairs' : '';
                const angle = step.compass_angle !== null ? step.compass_angle.toFixed(0) : '0';
                directions.push(
                    `Go ${compassDir} (${angle}°) for ${step.distance_from_prev.toFixed(1)}m${stairInfo} to ${step.name}`
                );
            }
        }

        result.directions = directions;
        return result;
    }

    /**
     * Convert compass angle to human-readable direction
     */
    compassToDirection(angle) {
        const directions = [
            'North', 'North-Northeast', 'Northeast', 'East-Northeast',
            'East', 'East-Southeast', 'Southeast', 'South-Southeast',
            'South', 'South-Southwest', 'Southwest', 'West-Southwest',
            'West', 'West-Northwest', 'Northwest', 'North-Northwest'
        ];
        const index = Math.floor((angle + 11.25) / 22.5) % 16;
        return directions[index];
    }

    /**
     * Reset pathfinder (useful after database changes)
     */
    reset() {
        this.initialized = false;
        this.nodesCache.clear();
        this.graph.clear();
    }
}

/**
 * Min Heap implementation for priority queue
 */
class MinHeap {
    constructor() {
        this.heap = [];
    }

    push(priority, value) {
        this.heap.push({ priority, value });
        this.bubbleUp(this.heap.length - 1);
    }

    pop() {
        if (this.heap.length === 0) return null;
        if (this.heap.length === 1) return this.heap.pop();

        const min = this.heap[0];
        this.heap[0] = this.heap.pop();
        this.bubbleDown(0);
        return min;
    }

    isEmpty() {
        return this.heap.length === 0;
    }

    bubbleUp(index) {
        while (index > 0) {
            const parentIndex = Math.floor((index - 1) / 2);
            if (this.heap[parentIndex].priority <= this.heap[index].priority) break;
            [this.heap[parentIndex], this.heap[index]] = [this.heap[index], this.heap[parentIndex]];
            index = parentIndex;
        }
    }

    bubbleDown(index) {
        while (true) {
            const leftChild = 2 * index + 1;
            const rightChild = 2 * index + 2;
            let smallest = index;

            if (leftChild < this.heap.length && this.heap[leftChild].priority < this.heap[smallest].priority) {
                smallest = leftChild;
            }
            if (rightChild < this.heap.length && this.heap[rightChild].priority < this.heap[smallest].priority) {
                smallest = rightChild;
            }

            if (smallest === index) break;
            [this.heap[smallest], this.heap[index]] = [this.heap[index], this.heap[smallest]];
            index = smallest;
        }
    }
}

// Singleton instance
let pathfinderInstance = null;

function getPathfinder() {
    if (!pathfinderInstance) {
        pathfinderInstance = new PathFinder();
    }
    return pathfinderInstance;
}

function resetPathfinder() {
    if (pathfinderInstance) {
        pathfinderInstance.reset();
    }
    pathfinderInstance = null;
}

module.exports = {
    PathFinder,
    getPathfinder,
    resetPathfinder
};
