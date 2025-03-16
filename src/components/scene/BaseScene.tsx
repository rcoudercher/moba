import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { KeyBinding, defaultKeyBindings } from '../../config/keyBindings';
import Minimap from './Minimap';

// Import environment components
import { createSky } from './environment/Sky';

// Function to create a simple tree
const createTree = (position: THREE.Vector3): THREE.Group => {
  const tree = new THREE.Group();
  
  // Tree trunk (brown cylinder)
  const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, 2, 6);
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
  const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
  trunk.castShadow = true;
  trunk.position.y = 1;
  tree.add(trunk);
  
  // Tree leaves (green cone)
  const leavesGeometry = new THREE.ConeGeometry(1.5, 3, 6);
  const leavesMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x2E8B57,
    roughness: 0.8
  });
  const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
  leaves.castShadow = true;
  leaves.position.y = 3.5;
  tree.add(leaves);
  
  tree.position.copy(position);
  return tree;
};

// Function to create a simple bush
const createBush = (position: THREE.Vector3): THREE.Mesh => {
  const bushGeometry = new THREE.SphereGeometry(0.5, 8, 6);
  const bushMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x3B7A57,
    roughness: 0.8
  });
  const bush = new THREE.Mesh(bushGeometry, bushMaterial);
  bush.castShadow = true;
  bush.position.copy(position);
  bush.position.y = 0.5;
  return bush;
};

// Add new functions for creating map elements
const createLane = (start: THREE.Vector3, end: THREE.Vector3, width: number): THREE.Mesh => {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  const geometry = new THREE.PlaneGeometry(width, length);
  const material = new THREE.MeshStandardMaterial({ 
    color: 0x808080, // Gray color for the lane
    roughness: 0.8
  });
  
  const lane = new THREE.Mesh(geometry, material);
  lane.receiveShadow = true;
  
  // Position and rotate the lane
  // Calculate the midpoint between start and end
  const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  lane.position.copy(midpoint);
  lane.position.y = 0.1; // Slightly above ground to prevent z-fighting
  
  // Rotate the lane to align with the direction
  lane.rotation.x = -Math.PI / 2; // Make it flat on the ground
  
  // Calculate the angle between the direction vector and the x-axis
  const angle = Math.atan2(direction.z, direction.x);
  lane.rotation.z = -angle + Math.PI / 2; // Adjust rotation to align with direction
  
  return lane;
};

const createBase = (position: THREE.Vector3, isEnemy: boolean): THREE.Group => {
  const base = new THREE.Group();
  
  // Main structure - larger size but still low to the ground
  const baseGeometry = new THREE.CylinderGeometry(18, 22, 3, 8);
  const baseMaterial = new THREE.MeshStandardMaterial({ 
    color: isEnemy ? 0xff0000 : 0x0000ff,
    roughness: 0.7
  });
  const baseStructure = new THREE.Mesh(baseGeometry, baseMaterial);
  baseStructure.position.copy(position);
  baseStructure.position.y = 1.5; // Low to the ground
  baseStructure.castShadow = true;
  baseStructure.receiveShadow = true;
  
  base.add(baseStructure);
  
  // Add platform on top - thinner
  const platformGeometry = new THREE.CylinderGeometry(15, 15, 0.5, 8);
  const platformMaterial = new THREE.MeshStandardMaterial({
    color: isEnemy ? 0xff5555 : 0x5555ff,
    roughness: 0.5
  });
  const platform = new THREE.Mesh(platformGeometry, platformMaterial);
  platform.position.copy(position);
  platform.position.y = 3.25; // Top of the base
  platform.castShadow = true;
  platform.receiveShadow = true;
  base.add(platform);
  
  return base;
};

const createTower = (position: THREE.Vector3, isEnemy: boolean): THREE.Group => {
  const tower = new THREE.Group();
  
  // Tower base
  const baseGeometry = new THREE.CylinderGeometry(1, 1.5, 8, 8);
  const baseMaterial = new THREE.MeshStandardMaterial({ 
    color: isEnemy ? 0xdd0000 : 0x0000dd,
    roughness: 0.6
  });
  const baseStructure = new THREE.Mesh(baseGeometry, baseMaterial);
  baseStructure.position.copy(position);
  baseStructure.position.y = 4;
  baseStructure.castShadow = true;
  baseStructure.receiveShadow = true;
  
  tower.add(baseStructure);
  return tower;
};

const BaseScene = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isControlsEnabled, setIsControlsEnabled] = useState(true);
  const [fps, setFps] = useState<number>(0);
  const [playerPos, setPlayerPos] = useState({ x: 0, z: 0 });
  const [keyBindings, setKeyBindings] = useState<KeyBinding[]>(() => {
    const savedBindings = localStorage.getItem('keyBindings');
    return savedBindings ? JSON.parse(savedBindings) : defaultKeyBindings;
  });
  
  // Define MAP_SIZE as a constant outside the useEffect
  const LANE_SQUARE_SIZE = 160; // Size of the square formed by the lanes (increased from 150)
  const PLAYABLE_AREA = 180; // Size of the playable area (reduced from 200)
  
  useEffect(() => {
    // Scene setup
    const scene = new THREE.Scene();
    
    // Create sky and sun
    const { sky, sun } = createSky(scene);
    
    // Camera setup
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    const cameraOffset = new THREE.Vector3(0, 30, 30); // Higher and further back
    camera.position.copy(cameraOffset);
    camera.lookAt(new THREE.Vector3(0, 0, 0));
    camera.rotation.x = -Math.PI / 3; // Steeper angle for better map view
    
    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    
    mountRef.current?.appendChild(renderer.domElement);
    
    // Character setup
    const character = {
      position: new THREE.Vector3(0, 0, 0),
      velocity: new THREE.Vector3(),
      direction: new THREE.Vector3(),
      speed: 0.15,
      jumpHeight: 0.2,
      isOnGround: true,
      gravity: 0.01,
      targetPosition: null as THREE.Vector3 | null,
      model: (() => {
        // Simple character representation
        const geometry = new THREE.CylinderGeometry(0.5, 0.5, 2, 8);
        const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.position.y = 1;
        return mesh;
      })(),
      keys: {
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        sprint: false
      }
    };
    
    // Create target indicator
    const targetIndicator = (() => {
      const geometry = new THREE.RingGeometry(0.5, 0.7, 32);
      const material = new THREE.MeshBasicMaterial({ 
        color: 0xffff00,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2; // Lay flat on the ground
      mesh.visible = false;
      return mesh;
    })();
    
    scene.add(targetIndicator);
    scene.add(character.model);
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    
    // Main directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffcc, 1.2);
    directionalLight.position.copy(sun.position).normalize();
    directionalLight.castShadow = true;
    
    // Optimize shadow map
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 100;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    directionalLight.shadow.bias = -0.001;
    
    scene.add(directionalLight);
    
    // Create ground plane (darker for jungle areas)
    const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x1a472a, // Darker green for jungle
      roughness: 0.8,
      metalness: 0.0
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    
    // Create map structure
    const mapStructure = new THREE.Group();
    
    // Create bases - position them at the corners of the lane square
    const allyBase = createBase(new THREE.Vector3(-LANE_SQUARE_SIZE/2, 0, LANE_SQUARE_SIZE/2), false); // Bottom left
    const enemyBase = createBase(new THREE.Vector3(LANE_SQUARE_SIZE/2, 0, -LANE_SQUARE_SIZE/2), true); // Top right
    mapStructure.add(allyBase, enemyBase);
    
    // Create lanes
    // Mid lane (diagonal)
    const midLane = createLane(
      new THREE.Vector3(-LANE_SQUARE_SIZE/2, 0, LANE_SQUARE_SIZE/2),
      new THREE.Vector3(LANE_SQUARE_SIZE/2, 0, -LANE_SQUARE_SIZE/2),
      12
    );
    
    // Top lane (through corner)
    // First segment: from ally base to top-left corner
    const topLane1 = createLane(
      new THREE.Vector3(-LANE_SQUARE_SIZE/2 + 5, 0, LANE_SQUARE_SIZE/2), // Slightly offset from base
      new THREE.Vector3(-LANE_SQUARE_SIZE/2 + 5, 0, -LANE_SQUARE_SIZE/2 + 5), // Slightly offset from corner
      12
    );
    
    // Second segment: from top-left corner to enemy base
    const topLane2 = createLane(
      new THREE.Vector3(-LANE_SQUARE_SIZE/2 + 5, 0, -LANE_SQUARE_SIZE/2 + 5), // Slightly offset from corner
      new THREE.Vector3(LANE_SQUARE_SIZE/2, 0, -LANE_SQUARE_SIZE/2 + 5), // Slightly offset from enemy base
      12
    );
    
    // Bottom lane (through corner)
    // First segment: from ally base to bottom-right corner
    const botLane1 = createLane(
      new THREE.Vector3(-LANE_SQUARE_SIZE/2 + 5, 0, LANE_SQUARE_SIZE/2 - 5), // Slightly offset from base
      new THREE.Vector3(LANE_SQUARE_SIZE/2 - 5, 0, LANE_SQUARE_SIZE/2 - 5), // Slightly offset from corner
      12
    );
    
    // Second segment: from bottom-right corner to enemy base
    const botLane2 = createLane(
      new THREE.Vector3(LANE_SQUARE_SIZE/2 - 5, 0, LANE_SQUARE_SIZE/2 - 5), // Slightly offset from corner
      new THREE.Vector3(LANE_SQUARE_SIZE/2 - 5, 0, -LANE_SQUARE_SIZE/2), // Slightly offset from enemy base
      12
    );
    
    mapStructure.add(midLane, topLane1, topLane2, botLane1, botLane2);
    
    // Add towers along lanes
    const towerPositions = [
      // Mid lane towers
      { pos: new THREE.Vector3(-LANE_SQUARE_SIZE/4, 0, LANE_SQUARE_SIZE/4), enemy: false },
      { pos: new THREE.Vector3(0, 0, 0), enemy: false },
      { pos: new THREE.Vector3(LANE_SQUARE_SIZE/4, 0, -LANE_SQUARE_SIZE/4), enemy: true },
      // Top lane towers
      { pos: new THREE.Vector3(-LANE_SQUARE_SIZE/3, 0, 0), enemy: false },
      { pos: new THREE.Vector3(-LANE_SQUARE_SIZE/3, 0, -LANE_SQUARE_SIZE/3), enemy: false },
      { pos: new THREE.Vector3(0, 0, -LANE_SQUARE_SIZE/3), enemy: true },
      // Bottom lane towers
      { pos: new THREE.Vector3(0, 0, LANE_SQUARE_SIZE/3), enemy: false },
      { pos: new THREE.Vector3(LANE_SQUARE_SIZE/3, 0, LANE_SQUARE_SIZE/3), enemy: false },
      { pos: new THREE.Vector3(LANE_SQUARE_SIZE/3, 0, 0), enemy: true },
    ];
    
    towerPositions.forEach(({ pos, enemy }) => {
      const tower = createTower(pos, enemy);
      mapStructure.add(tower);
    });
    
    scene.add(mapStructure);
    
    // Add map boundary outline (showing the playable area)
    const boundaryGeometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      // Draw a square using lines
      -PLAYABLE_AREA/2, 0, -PLAYABLE_AREA/2,  // Start at top-left
      PLAYABLE_AREA/2, 0, -PLAYABLE_AREA/2,   // Top line
      PLAYABLE_AREA/2, 0, -PLAYABLE_AREA/2,   // Start at top-right
      PLAYABLE_AREA/2, 0, PLAYABLE_AREA/2,    // Right line
      PLAYABLE_AREA/2, 0, PLAYABLE_AREA/2,    // Start at bottom-right
      -PLAYABLE_AREA/2, 0, PLAYABLE_AREA/2,   // Bottom line
      -PLAYABLE_AREA/2, 0, PLAYABLE_AREA/2,   // Start at bottom-left
      -PLAYABLE_AREA/2, 0, -PLAYABLE_AREA/2   // Left line
    ]);
    boundaryGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    const boundaryMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
    const boundaryLines = new THREE.LineSegments(boundaryGeometry, boundaryMaterial);
    boundaryLines.position.y = 0.2; // Slightly above ground to be visible
    scene.add(boundaryLines);
    
    // Add lane square outline
    const laneSquareGeometry = new THREE.BufferGeometry();
    const laneSquareVertices = new Float32Array([
      // Draw a square using lines
      -LANE_SQUARE_SIZE/2, 0, -LANE_SQUARE_SIZE/2,  // Start at top-left
      LANE_SQUARE_SIZE/2, 0, -LANE_SQUARE_SIZE/2,   // Top line
      LANE_SQUARE_SIZE/2, 0, -LANE_SQUARE_SIZE/2,   // Start at top-right
      LANE_SQUARE_SIZE/2, 0, LANE_SQUARE_SIZE/2,    // Right line
      LANE_SQUARE_SIZE/2, 0, LANE_SQUARE_SIZE/2,    // Start at bottom-right
      -LANE_SQUARE_SIZE/2, 0, LANE_SQUARE_SIZE/2,   // Bottom line
      -LANE_SQUARE_SIZE/2, 0, LANE_SQUARE_SIZE/2,   // Start at bottom-left
      -LANE_SQUARE_SIZE/2, 0, -LANE_SQUARE_SIZE/2   // Left line
    ]);
    laneSquareGeometry.setAttribute('position', new THREE.Float32BufferAttribute(laneSquareVertices, 3));
    const laneSquareMaterial = new THREE.LineBasicMaterial({ color: 0xaaaaaa, linewidth: 1 });
    const laneSquareLines = new THREE.LineSegments(laneSquareGeometry, laneSquareMaterial);
    laneSquareLines.position.y = 0.15; // Slightly above ground but below the boundary
    scene.add(laneSquareLines);
    
    // Add trees around the border to create a natural boundary
    const borderTrees = new THREE.Group();
    
    // Function to check if a position is in the border area
    const isInBorderArea = (x: number, z: number) => {
      const absX = Math.abs(x);
      const absZ = Math.abs(z);
      const laneHalf = LANE_SQUARE_SIZE / 2;
      const playableHalf = PLAYABLE_AREA / 2;
      
      // Check if the position is outside the lane square but inside the playable area
      return (absX > laneHalf - 5 && absX < playableHalf) || 
             (absZ > laneHalf - 5 && absZ < playableHalf);
    };
    
    // Create shared geometries for instancing
    const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, 2, 6);
    const leavesGeometry = new THREE.ConeGeometry(1.5, 3, 6);
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const leavesMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x2E8B57,
      roughness: 0.8
    });
    
    // Add less dense trees around the border (increased spacing, reduced probability)
    for (let i = -PLAYABLE_AREA/2; i <= PLAYABLE_AREA/2; i += 8) { // Increased spacing from 5 to 8
      for (let j = -PLAYABLE_AREA/2; j <= PLAYABLE_AREA/2; j += 8) { // Increased spacing from 5 to 8
        if (isInBorderArea(i, j) && Math.random() < 0.5) { // Reduced chance from 0.7 to 0.5
          const treePosition = new THREE.Vector3(i, 0, j);
          const treeScale = 0.8 + Math.random() * 0.4;
          const tree = createTree(treePosition);
          tree.scale.set(treeScale, treeScale, treeScale);
          borderTrees.add(tree);
        }
      }
    }
    
    scene.add(borderTrees);

    // Mouse movement and pointer lock
    let euler = new THREE.Euler(0, 0, 0, 'YXZ');
    let prevTime = performance.now();
    
    // Update mouse movement handler for MOBA-style camera
    const onMouseMove = (event: MouseEvent) => {
      // Disable mouse look - camera angle is fixed in MOBA-style games
      return;
    };
    
    // Update right-click handler for movement
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
      
      // Clamp the target position within playable area boundaries
      intersectionPoint.x = Math.max(-PLAYABLE_AREA/2, Math.min(PLAYABLE_AREA/2, intersectionPoint.x));
      intersectionPoint.z = Math.max(-PLAYABLE_AREA/2, Math.min(PLAYABLE_AREA/2, intersectionPoint.z));
      
      // Set new target position
      character.targetPosition = intersectionPoint;
      
      // Update target indicator position
      targetIndicator.position.copy(intersectionPoint);
      targetIndicator.position.y = 0.1;
      targetIndicator.visible = true;
      
      setTimeout(() => {
        targetIndicator.visible = false;
      }, 1000);
    };
    
    // Prevent context menu on right click
    const onContextMenu = (event: Event) => {
      event.preventDefault();
    };
    
    const onWindowResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    
    // Update movement controls for MOBA-style movement
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
      const moveSpeed = character.keys.sprint ? character.speed * 1.5 : character.speed;
      const newX = character.position.x + character.direction.x * moveSpeed;
      const newZ = character.position.z + character.direction.z * moveSpeed;
      
      // Clamp position within playable area boundaries
      character.position.x = Math.max(-PLAYABLE_AREA/2, Math.min(PLAYABLE_AREA/2, newX));
      character.position.z = Math.max(-PLAYABLE_AREA/2, Math.min(PLAYABLE_AREA/2, newZ));
      character.model.position.set(character.position.x, character.position.y + 1, character.position.z);
      
      // Update camera position to follow character
      camera.position.x = character.position.x + cameraOffset.x;
      camera.position.y = character.position.y + cameraOffset.y;
      camera.position.z = character.position.z + cameraOffset.z;
      camera.lookAt(character.position);
      
      // If character hits boundary, clear target position
      if (
        character.position.x === -PLAYABLE_AREA/2 || 
        character.position.x === PLAYABLE_AREA/2 ||
        character.position.z === -PLAYABLE_AREA/2 || 
        character.position.z === PLAYABLE_AREA/2
      ) {
        character.targetPosition = null;
        character.direction.set(0, 0, 0);
      }
    };
    
    // Update animation loop
    const animate = () => {
      const time = performance.now();
      const delta = (time - prevTime) / 1000;
      
      updateMovement();
      
      // Update player position state
      setPlayerPos({ x: character.position.x, z: character.position.z });
      
      // Render main view
      renderer.render(scene, camera);
      
      // Update FPS counter
      setFps(Math.round(1 / delta));
      prevTime = time;
      
      requestAnimationFrame(animate);
    };
    
    // Update event listeners (remove pointer lock)
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseClick);
    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('resize', onWindowResize);
    
    animate();
    
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseClick);
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('resize', onWindowResize);
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, [keyBindings]);
  
  return (
    <div 
      ref={mountRef} 
      style={{ 
        width: '100%', 
        height: '100%',
        cursor: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'32\' height=\'32\' viewBox=\'0 0 32 32\'><circle cx=\'16\' cy=\'16\' r=\'8\' stroke=\'white\' stroke-width=\'2\' fill=\'none\'/><circle cx=\'16\' cy=\'16\' r=\'2\' fill=\'white\'/></svg>") 16 16, auto',
        position: 'relative'
      }}
      onMouseDown={(e) => {
        if (e.button === 2) { // Right click
          e.currentTarget.style.cursor = 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'32\' height=\'32\' viewBox=\'0 0 32 32\'><circle cx=\'16\' cy=\'16\' r=\'8\' stroke=\'%23ffff00\' stroke-width=\'2\' fill=\'none\'/><circle cx=\'16\' cy=\'16\' r=\'2\' fill=\'%23ffff00\'/></svg>") 16 16, auto';
        }
      }}
      onMouseUp={(e) => {
        if (e.button === 2) { // Right click release
          e.currentTarget.style.cursor = 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'32\' height=\'32\' viewBox=\'0 0 32 32\'><circle cx=\'16\' cy=\'16\' r=\'8\' stroke=\'white\' stroke-width=\'2\' fill=\'none\'/><circle cx=\'16\' cy=\'16\' r=\'2\' fill=\'white\'/></svg>") 16 16, auto';
        }
      }}
    >
      {!isControlsEnabled && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: 'white',
          fontSize: '24px',
          textAlign: 'center',
          userSelect: 'none',
          cursor: 'pointer'
        }}>
          Click to start
        </div>
      )}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '5px'
      }}>
        <div style={{
          color: '#F7FF00',
          fontSize: '16px',
          fontFamily: 'monospace',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          padding: '8px 12px',
          borderRadius: '8px',
          textShadow: '1px 1px 1px rgba(0,0,0,0.5)'
        }}>
          FPS: {fps}
        </div>
        <div style={{
          color: '#F7FF00',
          fontSize: '16px',
          fontFamily: 'monospace',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          padding: '8px 12px',
          borderRadius: '8px',
          textShadow: '1px 1px 1px rgba(0,0,0,0.5)'
        }}>
          X: {Math.round(playerPos.x)} Y: {Math.round(-playerPos.z)}
        </div>
      </div>
      
      {/* Add Minimap component */}
      <Minimap 
        playerPosition={playerPos} 
        mapSize={LANE_SQUARE_SIZE} 
        lanes={[]}
      />
    </div>
  );
};

export default BaseScene; 