// Lighting system for Karyavattom campus visualization
// This file contains all lighting-related functionality extracted from app.js

/**
 * Sets up all lighting for the scene
 */
function setupLighting() {
    // Clear any existing lights first
    scene.children.forEach(child => {
        if (child.isLight) scene.remove(child);
    });
    
    // Enhanced ambient light with warmer tone
    const ambientLight = new THREE.AmbientLight(0xfffaf0, 0.25);
    scene.add(ambientLight);

    // Main directional light (sun) with improved settings
    const sunLight = new THREE.DirectionalLight(0xfffaf0, 1.2);
    sunLight.position.set(100, 200, 100);
    sunLight.castShadow = true;
    
    // Enhanced shadow quality
    sunLight.shadow.mapSize.width = 4096;
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 1000;
    
    // Adjust shadow camera frustum for better coverage
    const shadowSize = 500;
    sunLight.shadow.camera.left = -shadowSize;
    sunLight.shadow.camera.right = shadowSize;
    sunLight.shadow.camera.top = shadowSize;
    sunLight.shadow.camera.bottom = -shadowSize;
    
    // Improved shadow quality settings
    sunLight.shadow.radius = 2.5;
    sunLight.shadow.bias = -0.0001;
    sunLight.shadow.normalBias = 0.02;
    sunLight.shadow.blurSamples = 25;
    scene.add(sunLight);

    // Secondary fill light with cooler tone for contrast
    const fillLight = new THREE.DirectionalLight(0xc2d1e8, 0.35);
    fillLight.position.set(-100, 50, -100);
    fillLight.castShadow = true;
    fillLight.shadow.mapSize.width = 2048;
    fillLight.shadow.mapSize.height = 2048;
    fillLight.shadow.radius = 1.5;
    scene.add(fillLight);

    // Enhanced hemisphere light for better ambient occlusion
    const hemisphereLight = new THREE.HemisphereLight(0x90c0ff, 0x556b2f, 0.45);
    scene.add(hemisphereLight);

    // Add subtle rim light for better edge definition
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.15);
    rimLight.position.set(0, 100, -200);
    scene.add(rimLight);

    // Add subtle point lights for local illumination
    const pointLight1 = new THREE.PointLight(0xfffaf0, 0.3, 100);
    pointLight1.position.set(50, 30, 50);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xfffaf0, 0.3, 100);
    pointLight2.position.set(-50, 30, -50);
    scene.add(pointLight2);
}

/**
 * Sets up the environment mapping for the scene
 */
function setupEnvironment() {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    
    const color1 = new THREE.Color(0x88ccff);
    const color2 = new THREE.Color(0xffffff);
    
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 1;
    const context = canvas.getContext('2d');
    context.fillStyle = color1.getStyle();
    context.fillRect(0, 0, 1, 1);
    context.fillStyle = color2.getStyle();
    context.fillRect(1, 0, 1, 1);
    
    const envTexture = new THREE.CanvasTexture(canvas);
    envTexture.needsUpdate = true;
    
    const envMap = pmremGenerator.fromEquirectangular(envTexture).texture;
    scene.environment = envMap;
    
    pmremGenerator.dispose();
}

/**
 * Updates scene lighting based on time of day
 * @param {number} hour - Hour of the day (0-24)
 */
function updateLightingForTimeOfDay(hour) {
    // Get the main directional light
    let sunLight;
    scene.traverse(child => {
        if (child.isDirectionalLight && child.intensity >= 0.8) {
            sunLight = child;
        }
    });
    
    if (!sunLight) return;
    
    // Normalize hour to 0-24 range
    hour = hour % 24;
    
    // Calculate sun position based on time
    const angle = ((hour - 6) / 12) * Math.PI; // Noon at PI/2
    const height = Math.sin(angle);
    const distance = 200;
    
    sunLight.position.x = Math.cos(angle) * distance;
    sunLight.position.y = Math.max(height, 0.1) * distance; // Keep sun slightly above horizon
    sunLight.position.z = Math.sin(angle + Math.PI/4) * distance; // Add offset for angle
    
    // Adjust light color and intensity based on time
    if (hour >= 5 && hour < 8) { // Sunrise
        sunLight.color.setHex(0xffd7a8);
        sunLight.intensity = 0.8;
    } else if (hour >= 8 && hour < 16) { // Day
        sunLight.color.setHex(0xfffaf0);
        sunLight.intensity = 1.0;
    } else if (hour >= 16 && hour < 19) { // Sunset
        sunLight.color.setHex(0xffa075);
        sunLight.intensity = 0.8;
    } else { // Night
        sunLight.color.setHex(0x334455);
        sunLight.intensity = 0.3;
    }
    
    // Adjust scene ambient light
    scene.traverse(child => {
        if (child.isAmbientLight) {
            if (hour >= 5 && hour < 19) { // Daytime
                child.intensity = 0.3;
            } else { // Nighttime
                child.intensity = 0.1;
            }
        }
        
        if (child.isHemisphereLight) {
            if (hour >= 5 && hour < 19) { // Daytime
                child.intensity = 0.4;
            } else { // Nighttime
                child.intensity = 0.2;
            }
        }
    });
}
