// Camera Follow System - For smooth GPS navigation
// Follows the user's position during active navigation

let isFollowingGPS = false;
let followDistance = 70; // meters behind (closer for more immersive view)
let followHeight = 80;   // meters above (lower for over-the-shoulder)
let followSmoothing = 0.12; // slightly smoother
let lookAheadDistance = 80; // look further ahead
let lateralOffset = 10; // meters to the right for a slight angle
let previousPosition = null;
let movementDirection = new THREE.Vector3(0, 0, -1);
let lastNonZeroDirection = new THREE.Vector3(0, 0, -1);
let cameraFollowAnimationId = null;
let lastLookAt = null;

// Call this every frame when following
function cameraFollowTick() {
    if (!isFollowingGPS) return;
    updateCameraPosition(true);
    cameraFollowAnimationId = requestAnimationFrame(cameraFollowTick);
}

function enableGPSFollow() {
    console.log("📷 Enabling Google-like camera follow");
    if (!window.camera || !window.controls) {
        console.error("Camera or controls not found. Cannot enable GPS follow.");
        return false;
    }
    isFollowingGPS = true;
    if (window.controls) window.controls.enabled = false;
    animateCameraToFollowPosition();
    if (!cameraFollowAnimationId) cameraFollowTick();
    const followToggle = document.getElementById('cameraFollowToggle');
    if (followToggle) followToggle.checked = true;
    return true;
}

function disableGPSFollow() {
    console.log("📷 Disabling camera follow");
    isFollowingGPS = false;
    if (window.controls) window.controls.enabled = true;
    if (cameraFollowAnimationId) {
        cancelAnimationFrame(cameraFollowAnimationId);
        cameraFollowAnimationId = null;
    }
    const followToggle = document.getElementById('cameraFollowToggle');
    if (followToggle) followToggle.checked = false;
    return true;
}

function toggleGPSFollow() {
    if (isFollowingGPS) {
        return disableGPSFollow();
    } else {
        return enableGPSFollow();
    }
}

// Animate camera from current to follow position
function animateCameraToFollowPosition() {
    const camera = window.camera;
    const gpsMarker = window.gpsMarker;
    if (!camera || !gpsMarker) return;
    const markerPosition = new THREE.Vector3();
    gpsMarker.getWorldPosition(markerPosition);
    const direction = calculateMovementDirection(markerPosition);
    const offset = getCameraOffset(direction);
    const targetCameraPosition = markerPosition.clone().add(offset);
    const lookAtPoint = getLookAtPoint(markerPosition, direction);
    const startPos = camera.position.clone();
    const startLook = lastLookAt ? lastLookAt.clone() : markerPosition.clone();
    const duration = 800;
    const startTime = performance.now();
    function animate() {
        const now = performance.now();
        const t = Math.min(1, (now - startTime) / duration);
        camera.position.lerpVectors(startPos, targetCameraPosition, t);
        const lerpedLook = startLook.clone().lerp(lookAtPoint, t);
        camera.lookAt(lerpedLook);
        lastLookAt = lerpedLook.clone();
        if (t < 1 && isFollowingGPS) {
            requestAnimationFrame(animate);
        }
    }
    animate();
}

// Calculate movement direction based on current and previous positions
function calculateMovementDirection(currentPosition) {
    if (!previousPosition) {
        previousPosition = currentPosition.clone();
        return lastNonZeroDirection.clone();
    }
    const movementThreshold = 0.5;
    const distance = currentPosition.distanceTo(previousPosition);
    if (distance > movementThreshold) {
        const newDirection = new THREE.Vector3()
            .subVectors(currentPosition, previousPosition)
            .normalize();
        newDirection.y = 0;
        if (newDirection.lengthSq() > 0.001) {
            movementDirection.lerp(newDirection, 0.4);
            movementDirection.normalize();
            lastNonZeroDirection.copy(movementDirection);
            previousPosition.copy(currentPosition);
        }
    }
    // If stopped, use last non-zero direction
    return lastNonZeroDirection.clone();
}

function getCameraOffset(direction) {
    // Google Maps: behind, above, and slightly to the right
    const behind = direction.clone().multiplyScalar(-followDistance);
    const right = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(lateralOffset);
    behind.y = followHeight;
    return behind.add(right);
}

function getLookAtPoint(markerPosition, direction) {
    // Look ahead in the direction of movement
    return markerPosition.clone().add(direction.clone().multiplyScalar(lookAheadDistance));
}

// Update camera position (called every frame when following)
function updateCameraPosition(isFrameUpdate = false) {
    if (!isFollowingGPS) return false;
    const camera = window.camera;
    const controls = window.controls;
    const gpsMarker = window.gpsMarker;
    if (!camera || !gpsMarker) return false;
    const markerPosition = new THREE.Vector3();
    gpsMarker.getWorldPosition(markerPosition);
    const direction = calculateMovementDirection(markerPosition);
    const offset = getCameraOffset(direction);
    const targetCameraPosition = markerPosition.clone().add(offset);
    const lookAtPoint = getLookAtPoint(markerPosition, direction);
    // Smoothly move camera
    if (isFrameUpdate) {
        camera.position.lerp(targetCameraPosition, followSmoothing);
        if (!lastLookAt) lastLookAt = lookAtPoint.clone();
        lastLookAt.lerp(lookAtPoint, followSmoothing);
        camera.lookAt(lastLookAt);
    } else {
        camera.position.copy(targetCameraPosition);
        camera.lookAt(lookAtPoint);
        lastLookAt = lookAtPoint.clone();
    }
    if (controls) {
        controls.target.lerp(markerPosition, followSmoothing);
    }
    return true;
}

// Add camera follow toggle button to UI
function addCameraFollowToggle() {
    // Check if we already have the navigation panel to add the control
    const navPanel = document.getElementById('navigationPanel');
    if (!navPanel) return;
    // Check if we already have GPS controls section
    let gpsControlsDiv = navPanel.querySelector('.gps-controls');
    // Create it if it doesn't exist
    if (!gpsControlsDiv) {
        gpsControlsDiv = document.createElement('div');
        gpsControlsDiv.className = 'gps-controls';
        gpsControlsDiv.style.marginTop = '15px';
        gpsControlsDiv.style.borderTop = '1px solid #ddd';
        gpsControlsDiv.style.paddingTop = '10px';
        navPanel.appendChild(gpsControlsDiv);
    }
    // Check if the toggle already exists
    if (document.getElementById('cameraFollowToggle')) return;
    // Add the camera follow toggle
    const followControl = document.createElement('div');
    followControl.innerHTML = `
        <label style="display: flex; align-items: center; cursor: pointer; margin-top: 8px;">
            <input type="checkbox" id="cameraFollowToggle" style="margin-right: 8px;">
            Camera Follow GPS
        </label>
    `;
    gpsControlsDiv.appendChild(followControl);
    // Add event listener
    const followToggle = document.getElementById('cameraFollowToggle');
    if (followToggle) {
        followToggle.addEventListener('change', function(e) {
            if (this.checked) {
                enableGPSFollow();
            } else {
                disableGPSFollow();
            }
        });
    }
}

// Optionally: advanced settings panel (not shown by default)
function setupFollowSettingsPanel() {
    // ... (unchanged, optional) ...
}

// Initialize when the page loads
window.addEventListener('load', initCameraFollowSystem);

function initCameraFollowSystem() {
    console.log("📷 Initializing Camera Follow System...");
    // Add camera follow toggle button to UI
    addCameraFollowToggle();
    console.log("✅ Camera Follow System initialized");
}

// Make functions available globally
window.cameraFollowSystem = {
    enable: enableGPSFollow,
    disable: disableGPSFollow,
    toggle: toggleGPSFollow,
    isFollowing: () => isFollowingGPS,
    setHeight: (height) => { followHeight = height; },
    setDistance: (distance) => { followDistance = distance; },
    setSmoothing: (smoothing) => { followSmoothing = smoothing; }
}; 