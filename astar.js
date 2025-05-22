// astar.js

class AStarPathfinder {
    constructor(graph) {
        this.graph = graph;
        this.pointMap = new Map();
        for (const point of graph.points) {
            this.pointMap.set(point.id, point);
        }
        this.neighbors = new Map();
        for (const conn of graph.connections) {
            if (!this.neighbors.has(conn.from)) this.neighbors.set(conn.from, []);
            if (!this.neighbors.has(conn.to)) this.neighbors.set(conn.to, []);
            this.neighbors.get(conn.from).push({ id: conn.to, cost: conn.cost });
            this.neighbors.get(conn.to).push({ id: conn.from, cost: conn.cost });
        }
    }
// in AStarPathfinder
findNearestPointWorld(position) {
    let nearestId = null;
    let minDist   = Infinity;
  
    for (const node of this.graph.points) {
      // project into world space
      const worldPos = transformGraphPoint(node);
      const d = position.distanceTo(worldPos);
      if (d < minDist) {
        minDist   = d;
        nearestId = node.id;
      }
    }
  
    return nearestId;
  }
  

    findPath(startId, endId) {
        const openSet = new Set([startId]);
        const cameFrom = new Map();
        const gScore = new Map(this.graph.points.map(p => [p.id, Infinity]));
        const fScore = new Map(this.graph.points.map(p => [p.id, Infinity]));

        gScore.set(startId, 0);
        fScore.set(startId, this.heuristic(startId, endId));

        while (openSet.size > 0) {
            let current = [...openSet].reduce((a, b) => fScore.get(a) < fScore.get(b) ? a : b);
            if (current === endId) {
                return this.reconstructPath(cameFrom, current);
            }

            openSet.delete(current);
            for (const neighbor of this.neighbors.get(current) || []) {
                const tentativeG = gScore.get(current) + neighbor.cost;
                if (tentativeG < gScore.get(neighbor.id)) {
                    cameFrom.set(neighbor.id, current);
                    gScore.set(neighbor.id, tentativeG);
                    fScore.set(neighbor.id, tentativeG + this.heuristic(neighbor.id, endId));
                    if (!openSet.has(neighbor.id)) {
                        openSet.add(neighbor.id);
                    }
                }
            }
        }
        console.warn("No valid path found between buildings. They might be in disconnected areas.");
        return null;
    }

    heuristic(aId, bId) {
        const a = this.pointMap.get(aId).position;
        const b = this.pointMap.get(bId).position;
        return Math.sqrt(
            (a.x - b.x) ** 2 +
            (a.y - b.y) ** 2 +
            (a.z - b.z) ** 2
        );
    }

    reconstructPath(cameFrom, current) {
        const path = [current];
        while (cameFrom.has(current)) {
            current = cameFrom.get(current);
            path.unshift(current);
        }
        return path;
    }
}

// Add variables to track path display state
let isPathShrinkMode = false;
let fullPathPoints = [];
let fullPath = null;
const PREVIEW_DISTANCE = 100; // Distance ahead to show in shrink mode

// Make variables accessible globally
window.isPathShrinkMode = isPathShrinkMode;
window.fullPathPoints = fullPathPoints;
window.fullPath = fullPath;

// Make key functions globally accessible
window.visualizePath = visualizePath;
window.getShrunkPath = getShrunkPath;
window.togglePathDisplay = togglePathDisplay;
window.updatePathVisualization = updatePathVisualization;
window.clearPath = clearPath;
window.findPathBetweenBuildings = findPathBetweenBuildings;
window.findBuildingByName = findBuildingByName;

function findPathBetweenBuildings(startName, endName) {
    const startObj = findBuildingByName(startName);
    const endObj = findBuildingByName(endName);

    if (!startObj || !endObj) {
        console.warn("Buildings not found:", startName, endName);
        return null;
    }

    const startPos = new THREE.Vector3();
    const endPos = new THREE.Vector3();
    new THREE.Box3().setFromObject(startObj).getCenter(startPos);
    new THREE.Box3().setFromObject(endObj).getCenter(endPos);

    console.log('Start position:', startPos);
    console.log('End position:', endPos);

    const startId = pathfinder.findNearestPointWorld(startPos);
    const endId = pathfinder.findNearestPointWorld(endPos);

    console.log('Nearest graph point IDs:', startId, endId);

    const path = pathfinder.findPath(startId, endId);
    console.log('Computed path:', path);

    fullPath = path; // Store full path for toggling
    window.fullPath = path; // Make it globally accessible

    if (path) {
        visualizePath(path);
    }

    return path;
}

function findBuildingByName(name) {
    let found = null;
    model.traverse((obj) => {
        if (obj.userData.isInteractiveBuilding && obj.name === name) {
            found = obj;
        }
    });
    return found;
}

function visualizePath(path) {
    console.log('🔍 DIAGNOSTIC: visualizePath called with path:', path ? path.length + ' points' : 'null');
    
    // PERFORMANCE FIX: Add an early return check if we've already visualized this exact path recently
    if (window._lastVisualizedPath === path && window._lastVisualizationTime && 
        (Date.now() - window._lastVisualizationTime < 1000)) {
        console.log('⏩ Skipping redundant path visualization - same path was visualized recently');
        return;
    }
    
    // Store the path reference and time for future checks
    window._lastVisualizedPath = path;
    window._lastVisualizationTime = Date.now();
    
    console.log('  → Current thread:', setTimeout ? 'Main thread' : 'Worker thread');
    console.log('  → Global state:',
        'isPathShrinkMode:', window.isPathShrinkMode,
        'fullPath exists:', !!window.fullPath,
        'fullPathPoints length:', Array.isArray(window.fullPathPoints) ? window.fullPathPoints.length : 'N/A');
    
    if (!path || path.length < 2) {
        console.warn('⚠️ Path too short or missing, skipping visualization.');
        return;
    }

    // 1) Remove previous
    console.log('  → Removing previous path visualization');
    const GROUP_NAME = 'path-visual';
    const old = scene.getObjectByName(GROUP_NAME);
    if (old) {
        scene.remove(old);
        // PERFORMANCE FIX: Force garbage collection of the old path geometry
        if (old.children) {
            old.children.forEach(child => {
                if (child.geometry) {
                    child.geometry.dispose();
                }
                if (child.material) {
                    child.material.dispose();
                }
            });
        }
        console.log('  → Previous path removed and resources disposed');
    } else {
        console.log('  → No previous path found to remove');
    }

    // 2) Build raw world‐space v3s
    console.log('  → Building raw points from path IDs');
    let rawPoints;
    try {
        rawPoints = path.map(id => {
            const point = pathfinder.pointMap.get(id);
            if (!point || !point.position) {
                console.warn(`⚠️ Invalid point for ID ${id}`);
                return new THREE.Vector3(0, 0, 0); // Fallback
            }
            return new THREE.Vector3(point.position.x, point.position.y, point.position.z);
        });
        console.log('  → Raw points created:', rawPoints.length);
    } catch (err) {
        console.error('❌ Error creating raw points:', err);
        return;
    }

    // 3) Transform into scene coordinates
    console.log('  → Transforming points to scene coordinates');
    let points;
    try {
        points = rawPoints.map(v => transformGraphPoint({ position: v }));
        fullPathPoints = [...points]; // Store full path points for later
        window.fullPathPoints = fullPathPoints; // Make it globally accessible
        console.log('  → Points transformed:', points.length);
    } catch (err) {
        console.error('❌ Error transforming points:', err);
        return;
    }

    // Check if we should use shrink mode
    console.log('  → Shrink mode check:',
        'Active:', window.isPathShrinkMode,
        'Last position available:', window.lastPosition ? 'Yes' : 'No');

    // Determine which points to display based on shrink mode
    let displayPoints = points;
    try {
        if (window.isPathShrinkMode && window.lastPosition) {
            console.log('  → Attempting to get shrunk path');
            const shrunkPath = getShrunkPath(points);
            if (shrunkPath && shrunkPath.length > 0) {
                displayPoints = shrunkPath;
                console.log('  → Using shrunk path with points:', displayPoints.length);
            } else {
                console.warn('  → getShrunkPath returned empty path, using full path');
            }
        } else {
            console.log('  → Using full path with points:', displayPoints.length);
        }
    } catch (err) {
        console.error('❌ Error in path shrinking:', err);
        // Fallback to full path
        displayPoints = points;
    }

    // PERFORMANCE FIX: Limit the number of points to prevent performance issues
    if (displayPoints.length > 100) {
        console.log('⚠️ Path has too many points, optimizing by simplifying');
        
        // Very simple path simplification - take every nth point
        const stride = Math.ceil(displayPoints.length / 100);
        const simplifiedPoints = [];
        
        // Always include first and last point
        simplifiedPoints.push(displayPoints[0]);
        
        // Include points in between with stride
        for (let i = stride; i < displayPoints.length - stride; i += stride) {
            simplifiedPoints.push(displayPoints[i]);
        }
        
        // Always include last point
        if (displayPoints.length > 1) {
            simplifiedPoints.push(displayPoints[displayPoints.length - 1]);
        }
        
        displayPoints = simplifiedPoints;
        console.log(`  → Simplified path from ${points.length} to ${displayPoints.length} points`);
    }

    // 4) Create a smooth TubeGeometry
    console.log('  → Creating tube geometry');
    let curve, geo, mat, mesh;
    const radius = 1.0;   // thicker - MOVED OUTSIDE TRY BLOCK
    try {
        curve = new THREE.CatmullRomCurve3(displayPoints);
        
        // PERFORMANCE FIX: Reduce segment count for better performance
        // Calculate segments based on path length but with a lower multiplier and maximum
        const segments = Math.min(displayPoints.length * 4, 100);
        
        // PERFORMANCE FIX: Reduce radial segments for better performance
        const radial = 8;    // reduced from 16 for better performance
        
        geo = new THREE.TubeGeometry(curve, segments, radius, radial, false);
        mat = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.8,
            depthTest: true  // render on top
        });
        mat.depthWrite = false;

        mesh = new THREE.Mesh(geo, mat);
        mesh.renderOrder = 999;
        console.log('  → Tube geometry created with', segments, 'segments');
    } catch (err) {
        console.error('❌ Error creating geometry:', err);
        return;
    }

    // 5) Add direction arrows every few segments
    console.log('  → Creating direction arrows');
    let group;
    try {
        group = new THREE.Group();
        group.name = GROUP_NAME;
        group.add(mesh);

        const arrowLen = 3;
        const headLen = 1;
        const headWidth = 0.6;
        
        // PERFORMANCE FIX: Reduce number of arrows - increase skip factor
        // Calculate skip factor based on path length, placing at most 10 arrows
        const skipFactor = Math.max(1, Math.floor(displayPoints.length / 8));
        console.log('  → Arrow skip factor:', skipFactor);
        
        for (let i = 0; i < displayPoints.length - 1; i += skipFactor) {
            const from = displayPoints[i];
            const to = displayPoints[i + 1];
            const dir = new THREE.Vector3().subVectors(to, from).normalize();
            const arrow = new THREE.ArrowHelper(
                dir,
                from.clone().add(dir.clone().multiplyScalar(radius + 0.2)),
                arrowLen,
                0xff0000,
                headLen,
                headWidth
            );
            arrow.renderOrder = 1000;
            group.add(arrow);
        }
        console.log('  → Direction arrows created');
    } catch (err) {
        console.error('❌ Error creating direction arrows:', err);
        return;
    }

    // 6) Put it into the scene
    try {
        scene.add(group);
        console.log('✅ Path visualization added to scene');
    } catch (err) {
        console.error('❌ Error adding path to scene:', err);
    }
}

// Get the relevant portion of the path based on user's current position
function getShrunkPath(fullPoints) {
    console.log("🔍 DIAGNOSTIC: getShrunkPath called with", fullPoints.length, "points");
    
    if (!window.lastPosition || fullPoints.length < 2) {
        console.warn("⚠️ Cannot shrink path: missing position or path");
        return fullPoints;
    }
    
    // Get user's current position
    let userPos;
    try {
        if (window.lastPosition.coords) {
            // Real GPS position
            const worldPos = window.geoToWorld(window.lastPosition.coords.latitude, window.lastPosition.coords.longitude);
            userPos = new THREE.Vector3(worldPos.x, 0, worldPos.z);
        } else {
            // Simulation position
            userPos = new THREE.Vector3(window.lastPosition.x, 0, window.lastPosition.z);
        }
    } catch (err) {
        console.error("❌ Error getting user position:", err);
        return fullPoints;
    }
    
    // Find closest point on path to user
    let closestIndex = 0;
    let minDistance = Infinity;
    
    for (let i = 0; i < fullPoints.length; i++) {
        const point = fullPoints[i];
        const distance = userPos.distanceTo(point);
        if (distance < minDistance) {
            minDistance = distance;
            closestIndex = i;
        }
    }
    
    // Keep a few points behind for context, but show all points ahead
    const startIndex = Math.max(0, closestIndex - 3); // Keep 3 points behind
    const endIndex = fullPoints.length - 1; // Show all points ahead
    
    // Return the relevant portion of the path
    return fullPoints.slice(startIndex, endIndex + 1);
}

// Toggle between full path and shrunk path
function togglePathDisplay() {
    window.isPathShrinkMode = !window.isPathShrinkMode;
    isPathShrinkMode = window.isPathShrinkMode;
    
    console.log("Toggle path display - Shrink mode:", window.isPathShrinkMode);
    
    // Redraw path with new mode if we have a path
    if (window.fullPath) {
        visualizePath(window.fullPath);
    }
    
    // Return the new state for UI updates
    return window.isPathShrinkMode;
}

// Update path visualization based on user position
function updatePathVisualization() {
    if (window.fullPath && window.isPathShrinkMode) {
        console.log("Updating path visualization based on user position");
        visualizePath(window.fullPath);
    }
}

// Clear any existing path visualization
function clearPath() {
    // Remove the path visualization group if it exists
    const GROUP_NAME = 'path-visual';
    if (scene) {
        const old = scene.getObjectByName(GROUP_NAME);
        if (old) scene.remove(old);
    }
    // Optionally clear any path state variables if needed
    if (typeof pathLine !== 'undefined') pathLine = null;
    if (typeof currentPath !== 'undefined') currentPath = null;
    fullPath = null;
    fullPathPoints = [];
    window.fullPath = null;
    window.fullPathPoints = [];
    console.log('Path cleared');
}