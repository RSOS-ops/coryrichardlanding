// Import necessary Three.js modules
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// Helper Functions for Lasers
function getRandomPointOnSphere(center, radius) {
    const point = new THREE.Vector3(
        Math.random() * 2 - 1, // x in [-1, 1]
        Math.random() * 2 - 1, // y in [-1, 1]
        Math.random() * 2 - 1  // z in [-1, 1]
    );
    if (point.lengthSq() === 0) { // Avoid division by zero if random point is (0,0,0)
        point.x = 1; // Set to a default vector if (0,0,0)
    }
    point.normalize().multiplyScalar(radius).add(center);
    return point;
}

function getRandomVertex(verticesArray) {
    if (!verticesArray || verticesArray.length === 0) {
        console.warn("getRandomVertex: modelVertices array is empty or undefined. Returning default Vector3(0,0,0).");
        return new THREE.Vector3(); // Default target if no vertices
    }
    const randomIndex = Math.floor(Math.random() * verticesArray.length);
    return verticesArray[randomIndex].clone(); // Return a clone to avoid modifying original
}

// Clock for animation timing
const clock = new THREE.Clock();

// --- Configuration Parameters ---
const INVISIBLE_SPHERE_RADIUS = 10; // Radius for the invisible sphere where lasers originate
const CAMERA_ROTATION_THRESHOLD = THREE.MathUtils.degToRad(15); // Min camera rotation (radians) to be considered 'significant movement'
const CAMERA_POSITION_THRESHOLD = 0.1; // Min camera position change (world units) for 'significant movement'
const STILLNESS_LIMIT = 3.0; // Duration (seconds) camera must be 'still' to trigger laser jump

const BASE_PULSE_FREQUENCY = 0.5; // Base laser pulse frequency (cycles per second) when camera is still
const PULSE_FREQUENCY_SENSITIVITY = 5.0; // How much camera movement speed influences pulse frequency
const MIN_LASER_BRIGHTNESS = 0.3; // Minimum brightness for pulsing laser material (range 0-1)
const MAX_LASER_BRIGHTNESS = 1.0; // Maximum brightness for pulsing laser material (range 0-1)

// General Laser Properties
const MAX_LASER_LENGTH = 20; // Max length of a laser beam segment if it doesn't hit anything
const MAX_BOUNCES = 3; // Max number of times a laser can bounce
// --- End Configuration Parameters ---

// Camera Movement Tracking State
let previousCameraPosition = new THREE.Vector3(); // Stores camera position from the previous frame
let previousCameraQuaternion = new THREE.Quaternion(); // Stores camera orientation from the previous frame
let stillnessTimer = 0; // Accumulates time camera has been still

// Raycaster for Lasers
const laserRaycaster = new THREE.Raycaster();

// Camera Setup
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// Renderer Setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Controls Setup
let controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Lighting Setup
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

const directionalLightTarget = new THREE.Object3D();
directionalLightTarget.position.set(0, 0, 0);
scene.add(directionalLightTarget);
directionalLight.target = directionalLightTarget;

// Optional: Add a helper to visualize the DirectionalLight.
const directionalLightHelper = new THREE.DirectionalLightHelper(directionalLight, 0); // Using a size of 2 for the helper
scene.add(directionalLightHelper);

const spotLightDown = new THREE.SpotLight(0xffffff, 50);
spotLightDown.distance = 1; // Adjusted for potentially different model size
spotLightDown.angle = Math.PI / 8; // Adjusted for potentially different model size
spotLightDown.penumbra = 0.5;
spotLightDown.decay = 2;

const spotLightFace = new THREE.SpotLight();
spotLightFace.color.set(0xffffff);
spotLightFace.intensity = 50; // Adjusted intensity for the face spotlight GOOD VALUE IS 150 // spookyvalue 
spotLightFace.distance = 0.85;
spotLightFace.angle = Math.PI / 11.5;
spotLightFace.penumbra = 0.5;
spotLightFace.decay = 0.5;

// Model Setup & Loading
let model;
let modelVertices = []; // To store world coordinates of model vertices

// Laser Global Variables
// const laserOffset1 = new THREE.Vector3(-0.8, 0.8, -1); // Top-left - REMOVED
// const laserOffset2 = new THREE.Vector3(0.8, 0.8, -1);  // Top-right - REMOVED
// const laserOffset3 = new THREE.Vector3(-0.8, -0.8, -1);// Bottom-left - REMOVED
// const laserOffset4 = new THREE.Vector3(0.8, -0.8, -1); // Bottom-right - REMOVED

// Laser 1
let laserLine; // THREE.Line object
let laserOrigin1; // THREE.Vector3 - Current origin of the laser
let initialLaserDirection1; // THREE.Vector3 - Current direction of the laser
let laserTargetVertex1; // THREE.Vector3 - Target vertex on the model
let laserPulseIntensity1 = 1.0; // Current pulse intensity (0-1)

// Laser 2
let laserLine2;
let laserOrigin2;
let initialLaserDirection2;
let laserTargetVertex2;
let laserPulseIntensity2 = 1.0;
const laserMaterial2 = new THREE.LineBasicMaterial({ color: 0xff0000 }); // Red laser for the second laser

// Laser 3
let laserLine3;
let laserOrigin3;
let initialLaserDirection3;
let laserTargetVertex3;
let laserPulseIntensity3 = 1.0;
const laserMaterial3 = new THREE.LineBasicMaterial({ color: 0xff0000 }); // Red laser for the third laser

// Laser 4
let laserLine4;
let laserOrigin4;
let initialLaserDirection4;
let laserTargetVertex4;
let laserPulseIntensity4 = 1.0;
const laserMaterial4 = new THREE.LineBasicMaterial({ color: 0xff0000 }); // Red laser for the fourth laser

const interactiveObjects = []; // To store objects the laser can hit (currently just the model)

function adjustCameraForModel() {
    if (!model) return;

    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center); // Get the actual center of the model

    // Reposition model to origin
    model.position.sub(center);
    scene.add(model); // Add model to scene *after* repositioning

    if (size.x === 0 && size.y === 0 && size.z === 0) return;

    const modelHeight = size.y;
    const fovInRadians = THREE.MathUtils.degToRad(camera.fov);
    let cameraZ = (modelHeight / 2) / Math.tan(fovInRadians / 2);
    cameraZ *= 2; // Original adjustment for 50% canvas height
    cameraZ *= 2; // Double the distance again, making the model appear half as tall.
    camera.position.set(0, 0, cameraZ);

    // Update controls target to look at the model's new origin (0,0,0)
    controls.target.set(0, 0, 0);
    controls.update();
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
}

const gltfLoader = new GLTFLoader();
const modelUrl = 'HoodedCory_NewStart_NewHood_DecimatedCreasedHood-1.glb';

// Laser Line Setup
const laserMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 }); // Red laser
const points = [];
// points.push(laserOrigin.clone()); // laserOrigin will be undefined here
// points.push(laserOrigin.clone().add(initialLaserDirection.clone().multiplyScalar(MAX_LASER_LENGTH))); // Initial straight line
const laserGeometry = new THREE.BufferGeometry().setFromPoints(points);
laserLine = new THREE.Line(laserGeometry, laserMaterial);
scene.add(laserLine);

// Second Laser Line Setup
const points2 = [];
// points2.push(laserOrigin2.clone()); // laserOrigin2 will be undefined here
// points2.push(laserOrigin2.clone().add(initialLaserDirection2.clone().multiplyScalar(MAX_LASER_LENGTH)));
const laserGeometry2 = new THREE.BufferGeometry().setFromPoints(points2);
laserLine2 = new THREE.Line(laserGeometry2, laserMaterial2);
scene.add(laserLine2);

// Third Laser Line Setup
const points3 = [];
// points3.push(laserOrigin3.clone()); // laserOrigin3 will be undefined here
// points3.push(laserOrigin3.clone().add(initialLaserDirection3.clone().multiplyScalar(MAX_LASER_LENGTH)));
const laserGeometry3 = new THREE.BufferGeometry().setFromPoints(points3);
laserLine3 = new THREE.Line(laserGeometry3, laserMaterial3);
scene.add(laserLine3);

// Fourth Laser Line Setup
const points4 = [];
// points4.push(laserOrigin4.clone()); // laserOrigin4 will be undefined here
// points4.push(laserOrigin4.clone().add(initialLaserDirection4.clone().multiplyScalar(MAX_LASER_LENGTH)));
const laserGeometry4 = new THREE.BufferGeometry().setFromPoints(points4);
laserLine4 = new THREE.Line(laserGeometry4, laserMaterial4);
scene.add(laserLine4);

gltfLoader.load(
    modelUrl,
    (gltf) => {
        model = gltf.scene;

        // Configure and attach the SpotLight to the model
        const spotLightDownTargetObject = new THREE.Object3D();
        model.add(spotLightDownTargetObject);
        spotLightDownTargetObject.position.set(0, 0, 0);

        spotLightDown.target = spotLightDownTargetObject;
        model.add(spotLightDown);

        // Optional: Add a helper to visualize the original SpotLight.
        const spotLightDownHelper = new THREE.SpotLightHelper(spotLightDown);
        scene.add(spotLightDownHelper);

        // Configure and attach the New SpotLight to the model
        const spotLightFaceTargetObject = new THREE.Object3D();
        model.add(spotLightFaceTargetObject); // Add target as a child of the model.
        spotLightFaceTargetObject.position.set(0, 0.4, 0.0); // Target position relative to the model.

        spotLightFace.target = spotLightFaceTargetObject; // Aim the new spotlight at this target.
        model.add(spotLightFace); // Add the new spotlight itself as a child of the model.
        // Position the new spotlight relative to the model's local coordinates.
        spotLightFace.position.set(0, -0.6, 0.5);

        // Optional: Add a helper to visualize the New SpotLight.
        const spotLightFaceHelper = new THREE.SpotLightHelper(spotLightFace);
        scene.add(spotLightFaceHelper);

        interactiveObjects.push(model); // Add model for laser interaction

        adjustCameraForModel(); // Call this after model is processed

        // Extract model vertices
        model.updateMatrixWorld(true); // Ensure world matrices are up-to-date
        model.traverse(function (child) {
            if (child.isMesh) {
                const positions = child.geometry.attributes.position;
                const worldMatrix = child.matrixWorld;
                for (let i = 0; i < positions.count; i++) {
                    const localVertex = new THREE.Vector3().fromBufferAttribute(positions, i);
                    const worldVertex = localVertex.applyMatrix4(worldMatrix);
                    modelVertices.push(worldVertex);
                }
            }
        });
        console.log('Extracted ' + modelVertices.length + ' vertices from the model.');

        initializeLasers(); // Initialize lasers now that model vertices are available
    },
    (xhr) => {
        console.log((xhr.loaded / xhr.total * 100) + '% loaded');
    },
    (error) => {
        console.error('An error occurred loading the GLB model:', error);
    }
);

function initializeLasers() {
    if (modelVertices.length === 0) {
        console.warn("initializeLasers called before model vertices were extracted. Lasers will use default initialization.");
        // Default initialization if vertices aren't ready
        laserOrigin1 = new THREE.Vector3(0,0,INVISIBLE_SPHERE_RADIUS); // Assign to laserOrigin1
        laserTargetVertex1 = new THREE.Vector3();

        laserOrigin2 = new THREE.Vector3(0,0,INVISIBLE_SPHERE_RADIUS);
        laserTargetVertex2 = new THREE.Vector3();

        laserOrigin3 = new THREE.Vector3(0,0,INVISIBLE_SPHERE_RADIUS);
        laserTargetVertex3 = new THREE.Vector3();

        laserOrigin4 = new THREE.Vector3(0,0,INVISIBLE_SPHERE_RADIUS);
        laserTargetVertex4 = new THREE.Vector3();

    } else {
        // Laser 1
        laserOrigin1 = getRandomPointOnSphere(controls.target, INVISIBLE_SPHERE_RADIUS);
        laserTargetVertex1 = getRandomVertex(modelVertices);

        // Laser 2
        laserOrigin2 = getRandomPointOnSphere(controls.target, INVISIBLE_SPHERE_RADIUS);
        laserTargetVertex2 = getRandomVertex(modelVertices);

        // Laser 3
        laserOrigin3 = getRandomPointOnSphere(controls.target, INVISIBLE_SPHERE_RADIUS);
        laserTargetVertex3 = getRandomVertex(modelVertices);

        // Laser 4
        laserOrigin4 = getRandomPointOnSphere(controls.target, INVISIBLE_SPHERE_RADIUS);
        laserTargetVertex4 = getRandomVertex(modelVertices);
    }

    // Common for all lasers, calculate initial directions
    if (laserOrigin1 && laserTargetVertex1) initialLaserDirection1 = new THREE.Vector3().subVectors(laserTargetVertex1, laserOrigin1).normalize(); // Use laserOrigin1
    else initialLaserDirection1 = new THREE.Vector3(0,0,-1);

    if (laserOrigin2 && laserTargetVertex2) initialLaserDirection2 = new THREE.Vector3().subVectors(laserTargetVertex2, laserOrigin2).normalize();
    else initialLaserDirection2 = new THREE.Vector3(0,0,-1);

    if (laserOrigin3 && laserTargetVertex3) initialLaserDirection3 = new THREE.Vector3().subVectors(laserTargetVertex3, laserOrigin3).normalize();
    else initialLaserDirection3 = new THREE.Vector3(0,0,-1);

    if (laserOrigin4 && laserTargetVertex4) initialLaserDirection4 = new THREE.Vector3().subVectors(laserTargetVertex4, laserOrigin4).normalize();
    else initialLaserDirection4 = new THREE.Vector3(0,0,-1);

    console.log("Lasers initialized.");
}

// Reusable Laser Update Function
function updateLaserLineGeometry(laserLineObj, origin, direction, raycaster, interactiveObjectsArr, maxBounces, maxLaserLength) {
    const points = [];
    let currentOrigin = origin.clone();
    let currentDirection = direction.clone();

    points.push(currentOrigin.clone());

    for (let i = 0; i < maxBounces; i++) {
        raycaster.set(currentOrigin, currentDirection);
        const intersects = raycaster.intersectObjects(interactiveObjectsArr, true);

        if (intersects.length > 0) {
            const intersection = intersects[0];
            const impactPoint = intersection.point;
            points.push(impactPoint.clone());

            const surfaceNormal = intersection.face.normal.clone();
            const worldNormal = new THREE.Vector3();
            worldNormal.copy(surfaceNormal).transformDirection(intersection.object.matrixWorld);

            if (currentDirection.dot(worldNormal) > 0) {
                worldNormal.negate();
            }

            currentDirection.reflect(worldNormal);
            currentOrigin.copy(impactPoint).add(currentDirection.clone().multiplyScalar(0.001)); // Offset for next ray

            if (i === maxBounces - 1) { // If it's the last bounce, draw the final segment
                points.push(currentOrigin.clone().add(currentDirection.clone().multiplyScalar(maxLaserLength)));
            }
        } else {
            points.push(currentOrigin.clone().add(currentDirection.clone().multiplyScalar(maxLaserLength)));
            break;
        }
    }

    laserLineObj.geometry.setFromPoints(points);
    laserLineObj.geometry.attributes.position.needsUpdate = true;
}

const rotationSpeed = (2 * Math.PI) / 12; // Radians per second

function handleLaserJumpLogic() {
    if (modelVertices.length === 0) {
        // console.warn("handleLaserJumpLogic called before model vertices were extracted. Cannot update laser targets.");
        // Optionally, just jump origins if no vertices, or do nothing.
        // For now, let's only proceed if vertices are available for robust targeting.
        return;
    }

    // console.log("Lasers are JUMPING!"); // For debugging

    // Laser 1
    laserOrigin1 = getRandomPointOnSphere(controls.target, INVISIBLE_SPHERE_RADIUS);
    laserTargetVertex1 = getRandomVertex(modelVertices);
    if (laserOrigin1 && laserTargetVertex1 && initialLaserDirection1) { // Ensure all are valid before calculating direction
         initialLaserDirection1.subVectors(laserTargetVertex1, laserOrigin1).normalize();
    } else if (initialLaserDirection1) { // Fallback if origin/target somehow invalid but direction vector exists
        initialLaserDirection1.set(0,0,-1); // Default direction
    }

    // Laser 2
    laserOrigin2 = getRandomPointOnSphere(controls.target, INVISIBLE_SPHERE_RADIUS);
    laserTargetVertex2 = getRandomVertex(modelVertices);
    if (laserOrigin2 && laserTargetVertex2 && initialLaserDirection2) {
        initialLaserDirection2.subVectors(laserTargetVertex2, laserOrigin2).normalize();
    } else if (initialLaserDirection2) {
        initialLaserDirection2.set(0,0,-1);
    }

    // Laser 3
    laserOrigin3 = getRandomPointOnSphere(controls.target, INVISIBLE_SPHERE_RADIUS);
    laserTargetVertex3 = getRandomVertex(modelVertices);
    if (laserOrigin3 && laserTargetVertex3 && initialLaserDirection3) {
        initialLaserDirection3.subVectors(laserTargetVertex3, laserOrigin3).normalize();
    } else if (initialLaserDirection3) {
        initialLaserDirection3.set(0,0,-1);
    }

    // Laser 4
    laserOrigin4 = getRandomPointOnSphere(controls.target, INVISIBLE_SPHERE_RADIUS);
    laserTargetVertex4 = getRandomVertex(modelVertices);
    if (laserOrigin4 && laserTargetVertex4 && initialLaserDirection4) {
        initialLaserDirection4.subVectors(laserTargetVertex4, laserOrigin4).normalize();
    } else if (initialLaserDirection4) {
        initialLaserDirection4.set(0,0,-1);
    }
}

// Animation Loop
function animate() {
    const deltaTime = clock.getDelta(); // Get time elapsed since last frame
    requestAnimationFrame(animate);

    if (controls.enableDamping) {
        controls.update();
    }

    // Initialize deltaRotation and deltaPosition to ensure they are defined in the animate scope
    let deltaRotation = 0;
    let deltaPosition = 0;

    // Camera stillness/movement detection
    if (camera && previousCameraPosition && previousCameraQuaternion) { // Ensure camera is available
        // Initialize previous states on the first valid frame
        if (previousCameraPosition.lengthSq() === 0 && previousCameraQuaternion.x === 0 && previousCameraQuaternion.y === 0 && previousCameraQuaternion.z === 0 && previousCameraQuaternion.w === 1) {
            previousCameraPosition.copy(camera.position);
            previousCameraQuaternion.copy(camera.quaternion);
        }

        // Calculate actual deltas if previous state is valid
        deltaRotation = previousCameraQuaternion.angleTo(camera.quaternion);
        deltaPosition = previousCameraPosition.distanceTo(camera.position);
        let hasCameraMovedSignificantly = false;

        if (deltaRotation > CAMERA_ROTATION_THRESHOLD || deltaPosition > CAMERA_POSITION_THRESHOLD) {
            stillnessTimer = 0;
            hasCameraMovedSignificantly = true;
            // console.log("Camera moved significantly: Rotation or Position delta exceeded threshold.");
        } else {
            stillnessTimer += deltaTime;
            if (stillnessTimer >= STILLNESS_LIMIT) {
                stillnessTimer = 0; // Reset timer
                hasCameraMovedSignificantly = true; // Trigger jump due to stillness
                // console.log("Stillness limit reached, triggering jump.");
            }
        }

        if (hasCameraMovedSignificantly) {
            if (typeof handleLaserJumpLogic === 'function') {
                handleLaserJumpLogic();
            } else {
                // This console log is useful if handleLaserJumpLogic is not yet defined
                // console.log("Camera moved significantly or stillness limit reached: handleLaserJumpLogic() would be called here.");
            }
        }

        // Update previous state for next frame
        previousCameraPosition.copy(camera.position);
        previousCameraQuaternion.copy(camera.quaternion);
    }


    if (model) { // Check if the model is loaded
    }

    // Camera-parenting logic for laser origins - REMOVED
    // const worldLaserOrigin1 = new THREE.Vector3();
    // worldLaserOrigin1.copy(laserOffset1);
    // worldLaserOrigin1.applyMatrix4(camera.matrixWorld);
    // laserOrigin = worldLaserOrigin1;
    //
    // const worldLaserOrigin2 = new THREE.Vector3();
    // worldLaserOrigin2.copy(laserOffset2);
    // worldLaserOrigin2.applyMatrix4(camera.matrixWorld);
    // laserOrigin2 = worldLaserOrigin2;
    //
    // const worldLaserOrigin3 = new THREE.Vector3();
    // worldLaserOrigin3.copy(laserOffset3);
    // worldLaserOrigin3.applyMatrix4(camera.matrixWorld);
    // laserOrigin3 = worldLaserOrigin3;
    //
    // const worldLaserOrigin4 = new THREE.Vector3();
    // worldLaserOrigin4.copy(laserOffset4);
    // worldLaserOrigin4.applyMatrix4(camera.matrixWorld);
    // laserOrigin4 = worldLaserOrigin4;

    // Update laser directions to point from new origins to control target
    // This will be updated in the next step based on new origin calculation method
    // For now, direction calculation is handled by initializeLasers and handleLaserJumpLogic
    // if (laserOrigin && controls.target) { // Temporary check
    //     const direction1 = new THREE.Vector3();
    //     direction1.subVectors(controls.target, laserOrigin).normalize();
    //     initialLaserDirection = direction1;
    // }
    // ... (similar for other lasers) ...


    // Laser Pulsing Logic
    // Note: deltaPosition and deltaRotation are available from the camera tracking logic block above
    let cameraSpeed = 0;
    if (deltaTime > 0) { // deltaTime is from clock.getDelta() at the start of animate()
        // Simple speed estimation based on change in position and rotation
        cameraSpeed = (deltaPosition / deltaTime) + (deltaRotation / deltaTime);
    }
    // Clamp cameraSpeed to prevent excessively fast pulsing, e.g., on first frame or after a lag spike
    cameraSpeed = Math.min(cameraSpeed, 10.0);

    const currentPulseFrequency = BASE_PULSE_FREQUENCY + (cameraSpeed * PULSE_FREQUENCY_SENSITIVITY);

    // Calculate a single pulse intensity to be used by all lasers for synchronization
    const sharedPulseIntensity = (Math.sin(clock.elapsedTime * currentPulseFrequency * Math.PI * 2) + 1) / 2; // Results in range [0, 1]

    // Assign to individual laser pulse intensities (can be used for other effects if needed)
    laserPulseIntensity1 = sharedPulseIntensity;
    laserPulseIntensity2 = sharedPulseIntensity;
    laserPulseIntensity3 = sharedPulseIntensity;
    laserPulseIntensity4 = sharedPulseIntensity;

    // Apply pulsing to laser materials by modulating color brightness
    const brightnessScalar = MIN_LASER_BRIGHTNESS + (sharedPulseIntensity * (MAX_LASER_BRIGHTNESS - MIN_LASER_BRIGHTNESS));

    if (laserLine.material) {
        laserLine.material.color.setHex(0xff0000).multiplyScalar(brightnessScalar);
    }
    if (laserLine2.material) {
        laserLine2.material.color.setHex(0xff0000).multiplyScalar(brightnessScalar);
    }
    if (laserLine3.material) {
        laserLine3.material.color.setHex(0xff0000).multiplyScalar(brightnessScalar);
    }
    if (laserLine4.material) {
        laserLine4.material.color.setHex(0xff0000).multiplyScalar(brightnessScalar);
    }

    // Update all laser lines using the new reusable function
    if (laserOrigin1 && initialLaserDirection1) { // Ensure origin and direction are calculated for laser 1
        updateLaserLineGeometry(laserLine, laserOrigin1, initialLaserDirection1, laserRaycaster, interactiveObjects, MAX_BOUNCES, MAX_LASER_LENGTH);
    }
    if (laserOrigin2 && initialLaserDirection2) {
        updateLaserLineGeometry(laserLine2, laserOrigin2, initialLaserDirection2, laserRaycaster, interactiveObjects, MAX_BOUNCES, MAX_LASER_LENGTH);
    }
    if (laserOrigin3 && initialLaserDirection3) {
        updateLaserLineGeometry(laserLine3, laserOrigin3, initialLaserDirection3, laserRaycaster, interactiveObjects, MAX_BOUNCES, MAX_LASER_LENGTH);
    }
    if (laserOrigin4 && initialLaserDirection4) {
        updateLaserLineGeometry(laserLine4, laserOrigin4, initialLaserDirection4, laserRaycaster, interactiveObjects, MAX_BOUNCES, MAX_LASER_LENGTH);
    }

    renderer.render(scene, camera);
}
animate();

// Event Listeners
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (model) {
        adjustCameraForModel();
    } else {
        camera.updateProjectionMatrix();
    }
});
