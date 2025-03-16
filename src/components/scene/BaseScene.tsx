import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { KeyBinding, defaultKeyBindings } from '../../config/keyBindings';

// Import environment components
import { createSky } from './environment/Sky';

// Function to create a simple tree
const createTree = (position: THREE.Vector3): THREE.Group => {
  const tree = new THREE.Group();
  
  // Tree trunk (brown cylinder)
  const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, 2, 8);
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
  const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
  trunk.castShadow = true;
  trunk.position.y = 1;
  tree.add(trunk);
  
  // Tree leaves (green cone)
  const leavesGeometry = new THREE.ConeGeometry(1.5, 3, 8);
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
  lane.position.copy(start).add(direction.multiplyScalar(0.5));
  lane.position.y = 0.1; // Slightly above ground to prevent z-fighting
  lane.rotation.x = -Math.PI / 2;
  lane.rotation.z = -Math.atan2(direction.z, direction.x);
  
  return lane;
};

const createBase = (position: THREE.Vector3, isEnemy: boolean): THREE.Group => {
  const base = new THREE.Group();
  
  // Main structure
  const baseGeometry = new THREE.CylinderGeometry(8, 10, 6, 8);
  const baseMaterial = new THREE.MeshStandardMaterial({ 
    color: isEnemy ? 0xff0000 : 0x0000ff,
    roughness: 0.7
  });
  const baseStructure = new THREE.Mesh(baseGeometry, baseMaterial);
  baseStructure.position.copy(position);
  baseStructure.position.y = 3;
  baseStructure.castShadow = true;
  baseStructure.receiveShadow = true;
  
  base.add(baseStructure);
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
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
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
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
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
    const MAP_SIZE = 100; // Square map size
    
    // Create bases
    const allyBase = createBase(new THREE.Vector3(-MAP_SIZE/2, 0, MAP_SIZE/2), false); // Bottom left
    const enemyBase = createBase(new THREE.Vector3(MAP_SIZE/2, 0, -MAP_SIZE/2), true); // Top right
    mapStructure.add(allyBase, enemyBase);
    
    // Create lanes
    // Mid lane (diagonal)
    const midLane = createLane(
      new THREE.Vector3(-MAP_SIZE/2, 0, MAP_SIZE/2),
      new THREE.Vector3(MAP_SIZE/2, 0, -MAP_SIZE/2),
      12
    );
    
    // Top lane (through corner)
    const topLane = createLane(
      new THREE.Vector3(-MAP_SIZE/2, 0, MAP_SIZE/2), // Start at ally base
      new THREE.Vector3(-MAP_SIZE/2, 0, -MAP_SIZE/2), // Go to top left corner
      12
    );
    const topLane2 = createLane(
      new THREE.Vector3(-MAP_SIZE/2, 0, -MAP_SIZE/2),
      new THREE.Vector3(MAP_SIZE/2, 0, -MAP_SIZE/2), // To enemy base
      12
    );
    
    // Bottom lane (through corner)
    const botLane = createLane(
      new THREE.Vector3(-MAP_SIZE/2, 0, MAP_SIZE/2), // Start at ally base
      new THREE.Vector3(MAP_SIZE/2, 0, MAP_SIZE/2), // Go to bottom right corner
      12
    );
    const botLane2 = createLane(
      new THREE.Vector3(MAP_SIZE/2, 0, MAP_SIZE/2),
      new THREE.Vector3(MAP_SIZE/2, 0, -MAP_SIZE/2), // To enemy base
      12
    );
    
    mapStructure.add(midLane, topLane, topLane2, botLane, botLane2);
    
    // Add towers along lanes
    const towerPositions = [
      // Mid lane towers
      { pos: new THREE.Vector3(-30, 0, 30), enemy: false },
      { pos: new THREE.Vector3(0, 0, 0), enemy: false },
      { pos: new THREE.Vector3(30, 0, -30), enemy: true },
      // Top lane towers
      { pos: new THREE.Vector3(-45, 0, 0), enemy: false },
      { pos: new THREE.Vector3(-45, 0, -45), enemy: false },
      { pos: new THREE.Vector3(0, 0, -45), enemy: true },
      // Bottom lane towers
      { pos: new THREE.Vector3(0, 0, 45), enemy: false },
      { pos: new THREE.Vector3(45, 0, 45), enemy: false },
      { pos: new THREE.Vector3(45, 0, 0), enemy: true },
    ];
    
    towerPositions.forEach(({ pos, enemy }) => {
      const tower = createTower(pos, enemy);
      mapStructure.add(tower);
    });
    
    scene.add(mapStructure);

    // Create minimap
    const minimapSize = 150; // pixels
    const minimapCamera = new THREE.OrthographicCamera(
      -MAP_SIZE/2, MAP_SIZE/2,
      -MAP_SIZE/2, MAP_SIZE/2,
      1, 1000
    );
    minimapCamera.position.set(0, 100, 0);
    minimapCamera.lookAt(0, 0, 0);
    
    // Create a separate scene for minimap
    const minimapScene = new THREE.Scene();
    minimapScene.background = new THREE.Color(0x1a472a); // Same as ground color
    
    // Add lighting for minimap
    const minimapLight = new THREE.DirectionalLight(0xffffff, 1);
    minimapLight.position.set(0, 1, 0);
    minimapScene.add(minimapLight);
    minimapScene.add(new THREE.AmbientLight(0xffffff, 1));
    
    // Add simplified versions of map elements to minimap scene
    const minimapGround = ground.clone();
    minimapScene.add(minimapGround);
    
    // Add lanes to minimap
    const minimapLanes = mapStructure.clone();
    minimapScene.add(minimapLanes);
    
    // Create a special marker for the minimap
    const minimapMarker = new THREE.Mesh(
      new THREE.CircleGeometry(3, 32),
      new THREE.MeshBasicMaterial({ 
        color: 0x00ff00,
        side: THREE.DoubleSide
      })
    );
    minimapMarker.rotation.x = -Math.PI / 2;
    minimapMarker.position.y = 1;
    minimapScene.add(minimapMarker);
    
    const minimapRenderer = new THREE.WebGLRenderer({ antialias: true });
    minimapRenderer.setSize(minimapSize, minimapSize);
    minimapRenderer.domElement.style.position = 'absolute';
    minimapRenderer.domElement.style.bottom = '20px';
    minimapRenderer.domElement.style.left = '20px';
    minimapRenderer.domElement.style.border = '2px solid #666';
    minimapRenderer.domElement.style.borderRadius = '5px';
    mountRef.current?.appendChild(minimapRenderer.domElement);
    
    // Mouse movement and pointer lock
    let euler = new THREE.Euler(0, 0, 0, 'YXZ');
    let prevTime = performance.now();
    
    // Update mouse movement handler for MOBA-style camera
    const onMouseMove = (event: MouseEvent) => {
      // Disable mouse look - camera angle is fixed in MOBA-style games
      return;
    };
    
    // Add right-click handler for movement
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
      
      // Clamp position within map boundaries
      character.position.x = Math.max(-MAP_SIZE/2, Math.min(MAP_SIZE/2, newX));
      character.position.z = Math.max(-MAP_SIZE/2, Math.min(MAP_SIZE/2, newZ));
      character.model.position.set(character.position.x, character.position.y + 1, character.position.z);
      
      // Update camera position to follow character
      camera.position.x = character.position.x + cameraOffset.x;
      camera.position.y = character.position.y + cameraOffset.y;
      camera.position.z = character.position.z + cameraOffset.z;
      camera.lookAt(character.position);
      
      // If character hits boundary, clear target position
      if (
        character.position.x === -MAP_SIZE/2 || 
        character.position.x === MAP_SIZE/2 ||
        character.position.z === -MAP_SIZE/2 || 
        character.position.z === MAP_SIZE/2
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
      
      // Update minimap marker position
      minimapMarker.position.x = character.position.x;
      minimapMarker.position.z = character.position.z;
      
      // Update player position state
      setPlayerPos({ x: character.position.x, z: character.position.z });
      
      // Render main view
      renderer.render(scene, camera);
      
      // Render minimap with its own scene
      minimapRenderer.render(minimapScene, minimapCamera);
      
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
      mountRef.current?.removeChild(minimapRenderer.domElement);
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
    </div>
  );
};

export default BaseScene; 