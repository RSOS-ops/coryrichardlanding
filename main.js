// Import necessary Three.js modules
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// Clock for animation timing
const clock = new THREE.Clock();

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

// Laser Global Variables
const laserOffset1 = new THREE.Vector3(-0.8, 0.8, -1); // Top-left
const laserOffset2 = new THREE.Vector3(0.8, 0.8, -1);  // Top-right
const laserOffset3 = new THREE.Vector3(-0.8, -0.8, -1);// Bottom-left
const laserOffset4 = new THREE.Vector3(0.8, -0.8, -1); // Bottom-right

let laserLine;
let laserOrigin;
// const laserOrigin = new THREE.Vector3(Math.random() * 20 - 10, Math.random() * 20 - 10, Math.random() * 20 - 10);
let initialLaserDirection;
// const initialLaserDirection = new THREE.Vector3().subVectors(new THREE.Vector3(0,0,0), laserOrigin).normalize();

// Second Laser Global Variables
let laserLine2;
let laserOrigin2;
// const laserOrigin2 = new THREE.Vector3(Math.random() * 20 - 10, Math.random() * 20 - 10, Math.random() * 20 - 10);
let initialLaserDirection2;
// const initialLaserDirection2 = new THREE.Vector3().subVectors(new THREE.Vector3(0,0,0), laserOrigin2).normalize();
const laserMaterial2 = new THREE.LineBasicMaterial({ color: 0xff0000 }); // Red laser for the second laser

// Third Laser Global Variables
let laserLine3;
let laserOrigin3;
// const laserOrigin3 = new THREE.Vector3(Math.random() * 20 - 10, Math.random() * 20 - 10, Math.random() * 20 - 10);
let initialLaserDirection3;
// const initialLaserDirection3 = new THREE.Vector3().subVectors(new THREE.Vector3(0,0,0), laserOrigin3).normalize();
const laserMaterial3 = new THREE.LineBasicMaterial({ color: 0xff0000 }); // Red laser for the third laser

// Fourth Laser Global Variables
let laserLine4;
let laserOrigin4;
// const laserOrigin4 = new THREE.Vector3(Math.random() * 20 - 10, Math.random() * 20 - 10, Math.random() * 20 - 10);
let initialLaserDirection4;
// const initialLaserDirection4 = new THREE.Vector3().subVectors(new THREE.Vector3(0,0,0), laserOrigin4).normalize();
const laserMaterial4 = new THREE.LineBasicMaterial({ color: 0xff0000 }); // Red laser for the fourth laser

const interactiveObjects = []; // To store objects the laser can hit
const MAX_LASER_LENGTH = 20; // Max length if no hit
const MAX_BOUNCES = 3; // Max number of laser bounces

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
    },
    (xhr) => {
        console.log((xhr.loaded / xhr.total * 100) + '% loaded');
    },
    (error) => {
        console.error('An error occurred loading the GLB model:', error);
    }
);

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

// Animation Loop
function animate() {
    const deltaTime = clock.getDelta(); // Get time elapsed since last frame
    requestAnimationFrame(animate);

    if (controls.enableDamping) {
        controls.update();
    }

    if (model) { // Check if the model is loaded
    }

    // Update laser origins based on camera position and offsets
    const worldLaserOrigin1 = new THREE.Vector3();
    worldLaserOrigin1.copy(laserOffset1);
    worldLaserOrigin1.applyMatrix4(camera.matrixWorld);
    laserOrigin = worldLaserOrigin1;

    const worldLaserOrigin2 = new THREE.Vector3();
    worldLaserOrigin2.copy(laserOffset2);
    worldLaserOrigin2.applyMatrix4(camera.matrixWorld);
    laserOrigin2 = worldLaserOrigin2;

    const worldLaserOrigin3 = new THREE.Vector3();
    worldLaserOrigin3.copy(laserOffset3);
    worldLaserOrigin3.applyMatrix4(camera.matrixWorld);
    laserOrigin3 = worldLaserOrigin3;

    const worldLaserOrigin4 = new THREE.Vector3();
    worldLaserOrigin4.copy(laserOffset4);
    worldLaserOrigin4.applyMatrix4(camera.matrixWorld);
    laserOrigin4 = worldLaserOrigin4;

    // Update laser directions to point from new origins to control target
    const direction1 = new THREE.Vector3();
    direction1.subVectors(controls.target, laserOrigin).normalize();
    initialLaserDirection = direction1;

    const direction2 = new THREE.Vector3();
    direction2.subVectors(controls.target, laserOrigin2).normalize();
    initialLaserDirection2 = direction2;

    const direction3 = new THREE.Vector3();
    direction3.subVectors(controls.target, laserOrigin3).normalize();
    initialLaserDirection3 = direction3;

    const direction4 = new THREE.Vector3();
    direction4.subVectors(controls.target, laserOrigin4).normalize();
    initialLaserDirection4 = direction4;

    // Update all laser lines using the new reusable function
    if (laserOrigin && initialLaserDirection) { // Ensure origin and direction are calculated
        updateLaserLineGeometry(laserLine, laserOrigin, initialLaserDirection, laserRaycaster, interactiveObjects, MAX_BOUNCES, MAX_LASER_LENGTH);
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
