import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createTower } from './Tower';

interface Character {
  model: THREE.Mesh;
  position: THREE.Vector3;
  direction: THREE.Vector3;
  targetPosition: THREE.Vector3 | null;
  speed: number;
  health: number;
  maxHealth: number;
}

const TestMap: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isControlsEnabled, setIsControlsEnabled] = useState(true);

  useEffect(() => {
    if (!mountRef.current) return;

    // Constants
    const MAP_SIZE = 100; // 100x100 map

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 50, 50);
    camera.lookAt(0, 0, 0);

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2.5; // Limit camera angle

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    scene.add(directionalLight);

    // Ground (100x100)
    const groundGeometry = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x7cfc00,
      roughness: 0.8,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Add map boundary outline
    const boundaryGeometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      -MAP_SIZE/2, 0, -MAP_SIZE/2,  // Start at top-left
      MAP_SIZE/2, 0, -MAP_SIZE/2,   // Top line
      MAP_SIZE/2, 0, -MAP_SIZE/2,   // Start at top-right
      MAP_SIZE/2, 0, MAP_SIZE/2,    // Right line
      MAP_SIZE/2, 0, MAP_SIZE/2,    // Start at bottom-right
      -MAP_SIZE/2, 0, MAP_SIZE/2,   // Bottom line
      -MAP_SIZE/2, 0, MAP_SIZE/2,   // Start at bottom-left
      -MAP_SIZE/2, 0, -MAP_SIZE/2   // Left line
    ]);
    boundaryGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    const boundaryMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
    const boundaryLines = new THREE.LineSegments(boundaryGeometry, boundaryMaterial);
    boundaryLines.position.y = 0.2; // Slightly above ground to be visible
    scene.add(boundaryLines);

    // Add a tower in the center
    const tower = createTower(
      new THREE.Vector3(0, 0, 0),  // Center of the map
      false,  // false = ally tower
      1000    // health
    );
    scene.add(tower);

    // Add player character
    const playerGeometry = new THREE.CylinderGeometry(0.5, 0.5, 2, 16);
    const playerMaterial = new THREE.MeshStandardMaterial({ color: 0x0000ff });
    const playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);
    playerMesh.castShadow = true;
    playerMesh.position.y = 1;
    scene.add(playerMesh);

    // Create character object
    const character: Character = {
      model: playerMesh,
      position: new THREE.Vector3(0, 1, 10),
      direction: new THREE.Vector3(0, 0, 0),
      targetPosition: null,
      speed: 0.15,
      health: 100,
      maxHealth: 100
    };

    // Update player position
    playerMesh.position.copy(character.position);

    // Create target indicator
    const indicatorGeometry = new THREE.CircleGeometry(0.5, 16);
    const indicatorMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x00ff00,
      transparent: true,
      opacity: 0.7
    });
    const targetIndicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
    targetIndicator.rotation.x = -Math.PI / 2; // Lay flat on ground
    targetIndicator.visible = false;
    scene.add(targetIndicator);

    // Right-click handler for movement
    const onMouseClick = (event: MouseEvent) => {
      if (event.button !== 2 || !isControlsEnabled) return; // Only handle right click
      
      event.preventDefault();
      
      // Create a raycaster
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
      );
      
      raycaster.setFromCamera(mouse, camera);
      
      // Check intersection with the ground plane
      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const intersectionPoint = new THREE.Vector3();
      raycaster.ray.intersectPlane(groundPlane, intersectionPoint);
      
      // Clamp the target position within map boundaries
      intersectionPoint.x = Math.max(-MAP_SIZE/2, Math.min(MAP_SIZE/2, intersectionPoint.x));
      intersectionPoint.z = Math.max(-MAP_SIZE/2, Math.min(MAP_SIZE/2, intersectionPoint.z));
      
      // Set new target position
      character.targetPosition = intersectionPoint;
      
      // Update target indicator position
      targetIndicator.position.copy(intersectionPoint);
      targetIndicator.position.y = 0.1; // Slightly above ground
      targetIndicator.visible = true;
      
      setTimeout(() => {
        targetIndicator.visible = false;
      }, 1000);
    };

    // Prevent context menu on right click
    const onContextMenu = (event: Event) => {
      event.preventDefault();
    };

    // Update movement
    const updateMovement = () => {
      if (character.targetPosition) {
        // Calculate direction to target
        const direction = new THREE.Vector3()
          .subVectors(character.targetPosition, character.position)
          .setY(0);
        
        // Check if we're close enough to stop
        if (direction.length() < 0.1) {
          character.targetPosition = null;
          character.direction.set(0, 0, 0);
        } else {
          // Normalize direction and set character movement
          direction.normalize();
          character.direction.copy(direction);
          character.model.rotation.y = Math.atan2(direction.x, direction.z);
        }
      }
      
      // Calculate new position
      const moveSpeed = character.speed;
      const newX = character.position.x + character.direction.x * moveSpeed;
      const newZ = character.position.z + character.direction.z * moveSpeed;
      
      // Create a new potential position
      const newPosition = new THREE.Vector3(newX, character.position.y, newZ);
      
      // Check if new position is within map boundaries
      if (
        newPosition.x >= -MAP_SIZE/2 && 
        newPosition.x <= MAP_SIZE/2 && 
        newPosition.z >= -MAP_SIZE/2 && 
        newPosition.z <= MAP_SIZE/2
      ) {
        // Update character position
        character.position.copy(newPosition);
        character.model.position.copy(character.position);
      }
    };

    // Handle window resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    // Add event listeners
    window.addEventListener('resize', handleResize);
    window.addEventListener('mousedown', onMouseClick);
    window.addEventListener('contextmenu', onContextMenu);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      updateMovement();
      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousedown', onMouseClick);
      window.removeEventListener('contextmenu', onContextMenu);
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [isControlsEnabled]);

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
};

export default TestMap; 