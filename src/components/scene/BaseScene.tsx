import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { KeyBinding, defaultKeyBindings } from '../../config/keyBindings';
import Minimap from './Minimap';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';

// Import environment components
import { createSky } from './environment/Sky';

// Define interfaces for game objects with health
interface GameObjectWithHealth {
  health: number;
  maxHealth: number;
  healthBar?: THREE.Group;
  takeDamage: (amount: number) => void;
  updateHealthBar: () => void;
  isDestroyed: boolean;
}

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

// Function to create a lane
const createLane = (start: THREE.Vector3, end: THREE.Vector3, width: number): THREE.Mesh => {
  // For straight lanes (horizontal or vertical)
  if (start.x === end.x || start.z === end.z) {
    const isHorizontal = start.z === end.z;
    const length = isHorizontal 
      ? Math.abs(end.x - start.x) 
      : Math.abs(end.z - start.z);
    
    const laneGeometry = new THREE.PlaneGeometry(isHorizontal ? length : width, isHorizontal ? width : length);
    const laneMaterial = new THREE.MeshStandardMaterial({
      color: 0x808080,
      roughness: 0.8,
      metalness: 0.2
    });
    
    const lane = new THREE.Mesh(laneGeometry, laneMaterial);
    
    // Position at the center point
    if (isHorizontal) {
      lane.position.set(
        (start.x + end.x) / 2,
        0.1, // Slightly above ground
        start.z
      );
      // No rotation needed for horizontal lanes
    } else {
      lane.position.set(
        start.x,
        0.1, // Slightly above ground
        (start.z + end.z) / 2
      );
      // Rotate for vertical lanes
      lane.rotation.y = Math.PI / 2;
    }
    
    lane.receiveShadow = true;
    return lane;
  } 
  // For diagonal lanes
  else {
    // Calculate length of the lane
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    
    // Create lane geometry
    const laneGeometry = new THREE.PlaneGeometry(length, width);
    const laneMaterial = new THREE.MeshStandardMaterial({
      color: 0x808080,
      roughness: 0.8,
      metalness: 0.2
    });
    
    const lane = new THREE.Mesh(laneGeometry, laneMaterial);
    
    // Position at the midpoint
    const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    lane.position.copy(midpoint);
    lane.position.y = 0.1; // Slightly above ground
    
    // Calculate rotation to align with direction
    const angle = Math.atan2(direction.z, direction.x);
    lane.rotation.y = -angle + Math.PI / 2;
    
    lane.receiveShadow = true;
    return lane;
  }
};

// Function to create a health bar
const createHealthBar = (width: number, height: number, position: THREE.Vector3, yOffset: number): THREE.Group => {
  const group = new THREE.Group();
  
  // Background bar (gray)
  const bgGeometry = new THREE.PlaneGeometry(width, height);
  const bgMaterial = new THREE.MeshBasicMaterial({ 
    color: 0x444444,
    side: THREE.DoubleSide
  });
  const bgBar = new THREE.Mesh(bgGeometry, bgMaterial);
  
  // Health bar (green)
  const healthGeometry = new THREE.PlaneGeometry(width, height);
  const healthMaterial = new THREE.MeshBasicMaterial({ 
    color: 0x00ff00,
    side: THREE.DoubleSide
  });
  const healthBar = new THREE.Mesh(healthGeometry, healthMaterial);
  
  // Position the bars
  bgBar.position.set(0, 0, 0.01); // Slightly in front to avoid z-fighting
  healthBar.position.set(0, 0, 0);
  
  // Add to group
  group.add(bgBar);
  group.add(healthBar);
  
  // Position the group
  group.position.copy(position);
  group.position.y += yOffset;
  
  // Rotate to face up
  group.rotation.x = -Math.PI / 2;
  
  // Store reference to the health bar for updates
  group.userData.healthBar = healthBar;
  
  return group;
};

const createBase = (position: THREE.Vector3, isEnemy: boolean): THREE.Group & GameObjectWithHealth => {
  const base = new THREE.Group() as THREE.Group & GameObjectWithHealth;
  
  // Set health properties
  base.health = 1000;
  base.maxHealth = 1000;
  base.isDestroyed = false;
  
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
  
  // Add central objective structure (the main target to destroy)
  const objectiveGeometry = new THREE.CylinderGeometry(3, 3, 8, 8);
  const objectiveMaterial = new THREE.MeshStandardMaterial({
    color: isEnemy ? 0xff0000 : 0x0000ff,
    emissive: isEnemy ? 0x330000 : 0x000033,
    roughness: 0.3,
    metalness: 0.7
  });
  const objective = new THREE.Mesh(objectiveGeometry, objectiveMaterial);
  objective.position.copy(position);
  objective.position.y = 7; // Tall structure rising from the platform
  objective.castShadow = true;
  objective.receiveShadow = true;
  
  // Add glowing crystal on top of the objective
  const crystalGeometry = new THREE.OctahedronGeometry(1.5, 1);
  const crystalMaterial = new THREE.MeshStandardMaterial({
    color: isEnemy ? 0xff3333 : 0x3333ff,
    emissive: isEnemy ? 0xff0000 : 0x0000ff,
    emissiveIntensity: 0.5,
    roughness: 0.2,
    metalness: 0.8
  });
  const crystal = new THREE.Mesh(crystalGeometry, crystalMaterial);
  crystal.position.copy(position);
  crystal.position.y = 12; // On top of the objective
  crystal.castShadow = true;
  crystal.rotation.y = Math.PI / 4; // Rotate for better appearance
  
  // Add a point light inside the crystal for glow effect
  const crystalLight = new THREE.PointLight(isEnemy ? 0xff0000 : 0x0000ff, 1, 20);
  crystalLight.position.copy(position);
  crystalLight.position.y = 12;
  
  base.add(objective);
  base.add(crystal);
  base.add(crystalLight);
  
  // Create and add health bar
  const healthBarWidth = 10;
  const healthBarHeight = 1;
  const healthBarYOffset = 15; // Position above the crystal
  base.healthBar = createHealthBar(healthBarWidth, healthBarHeight, position, healthBarYOffset);
  base.add(base.healthBar);
  
  // Add methods for health management
  base.takeDamage = (amount: number) => {
    if (base.isDestroyed) return;
    
    base.health -= amount;
    if (base.health <= 0) {
      base.health = 0;
      base.isDestroyed = true;
      
      // Handle destruction
      crystal.visible = false;
      crystalLight.visible = false;
      
      // Create explosion effect
      const explosionGeometry = new THREE.SphereGeometry(5, 32, 32);
      const explosionMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        transparent: true,
        opacity: 0.8
      });
      const explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);
      explosion.position.copy(position);
      explosion.position.y = 7;
      base.add(explosion);
      
      // Animate explosion and fade out
      let scale = 1;
      const expandExplosion = () => {
        if (scale < 3) {
          scale += 0.1;
          explosion.scale.set(scale, scale, scale);
          explosion.material.opacity -= 0.02;
          requestAnimationFrame(expandExplosion);
        } else {
          base.remove(explosion);
        }
      };
      expandExplosion();
      
      // Make objective look damaged
      objective.material.color.set(0x555555);
      objective.material.emissive.set(0x000000);
      objective.scale.y = 0.5; // Collapse it a bit
      objective.position.y = 5; // Lower it
    }
    
    base.updateHealthBar();
  };
  
  base.updateHealthBar = () => {
    if (!base.healthBar) return;
    
    const healthPercent = base.health / base.maxHealth;
    const healthBar = base.healthBar.userData.healthBar as THREE.Mesh;
    
    // Update health bar scale
    healthBar.scale.x = Math.max(0.001, healthPercent); // Avoid zero scale
    
    // Update health bar color based on health percentage
    const healthBarMaterial = healthBar.material as THREE.MeshBasicMaterial;
    if (healthPercent > 0.6) {
      healthBarMaterial.color.set(0x00ff00); // Green
    } else if (healthPercent > 0.3) {
      healthBarMaterial.color.set(0xffff00); // Yellow
    } else {
      healthBarMaterial.color.set(0xff0000); // Red
    }
    
    // Position the health bar to align left
    healthBar.position.x = (healthBarWidth / 2) * (healthPercent - 1);
  };
  
  // Initialize health bar
  base.updateHealthBar();
  
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
  const [baseCoordinates, setBaseCoordinates] = useState({
    ally: { x: 0, y: 0 },
    enemy: { x: 0, y: 0 }
  });
  const [keyBindings, setKeyBindings] = useState<KeyBinding[]>(() => {
    const savedBindings = localStorage.getItem('keyBindings');
    return savedBindings ? JSON.parse(savedBindings) : defaultKeyBindings;
  });
  const [gameState, setGameState] = useState({
    allyBaseHealth: 1000,
    enemyBaseHealth: 1000,
    gameOver: false,
    winner: null as 'ally' | 'enemy' | null
  });
  
  // Reference to store the bases for resetting
  const basesRef = useRef<{
    allyBase?: THREE.Group & GameObjectWithHealth,
    enemyBase?: THREE.Group & GameObjectWithHealth
  }>({});
  
  // Function to reset the game
  const resetGame = useCallback(() => {
    // Reset game state
    setGameState({
      allyBaseHealth: 1000,
      enemyBaseHealth: 1000,
      gameOver: false,
      winner: null
    });
    
    // Reset bases if they exist
    if (basesRef.current.allyBase) {
      basesRef.current.allyBase.health = 1000;
      basesRef.current.allyBase.isDestroyed = false;
      basesRef.current.allyBase.updateHealthBar();
      
      // Find and restore crystal and objective
      basesRef.current.allyBase.children.forEach(child => {
        // Restore crystal
        if (child.type === 'Mesh' && (child as THREE.Mesh).geometry.type === 'OctahedronGeometry') {
          child.visible = true;
        }
        // Restore objective
        if (child.type === 'Mesh' && 
            (child as THREE.Mesh).geometry.type === 'CylinderGeometry' && 
            child.position.y > 5) {
          const objective = child as THREE.Mesh;
          const material = objective.material as THREE.MeshStandardMaterial;
          material.color.set(0x0000ff);
          material.emissive.set(0x000033);
          objective.scale.y = 1;
          objective.position.y = 7;
        }
        // Restore light
        if (child.type === 'PointLight') {
          child.visible = true;
        }
      });
    }
    
    if (basesRef.current.enemyBase) {
      basesRef.current.enemyBase.health = 1000;
      basesRef.current.enemyBase.isDestroyed = false;
      basesRef.current.enemyBase.updateHealthBar();
      
      // Find and restore crystal and objective
      basesRef.current.enemyBase.children.forEach(child => {
        // Restore crystal
        if (child.type === 'Mesh' && (child as THREE.Mesh).geometry.type === 'OctahedronGeometry') {
          child.visible = true;
        }
        // Restore objective
        if (child.type === 'Mesh' && 
            (child as THREE.Mesh).geometry.type === 'CylinderGeometry' && 
            child.position.y > 5) {
          const objective = child as THREE.Mesh;
          const material = objective.material as THREE.MeshStandardMaterial;
          material.color.set(0xff0000);
          material.emissive.set(0x330000);
          objective.scale.y = 1;
          objective.position.y = 7;
        }
        // Restore light
        if (child.type === 'PointLight') {
          child.visible = true;
        }
      });
    }
  }, []);
  
  // Define MAP_SIZE as a constant outside the useEffect
  const GAME_MAP_SIZE = 200; // Total size of the game map
  const PLAYABLE_AREA = 175; // Size of the playable area
  const LANE_SQUARE_SIZE = 145; // Size of the square formed by the lanes
  const INNER_SQUARE_SIZE = 140; // Size of the inner square (kept for reference but not used)
  const baseInset = 10; // How much to move bases inward - moved to component level
  
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
    
    // Create ground plane with simple color
    const groundGeometry = new THREE.PlaneGeometry(GAME_MAP_SIZE, GAME_MAP_SIZE);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x1a472a,
      roughness: 0.8,
      metalness: 0.0
    });
    
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    
    // Create lane paths with brown color
    // Create outer square lane (between lane square and inner square)
    const createLanePath = (outerSize: number, innerSize: number, y: number = 0.05): THREE.Mesh => {
      // Create outer and inner shapes for the lane
      const outerShape = new THREE.Shape();
      outerShape.moveTo(-outerSize/2, -outerSize/2);
      outerShape.lineTo(outerSize/2, -outerSize/2);
      outerShape.lineTo(outerSize/2, outerSize/2);
      outerShape.lineTo(-outerSize/2, outerSize/2);
      outerShape.lineTo(-outerSize/2, -outerSize/2);
      
      const innerShape = new THREE.Path();
      innerShape.moveTo(-innerSize/2, -innerSize/2);
      innerShape.lineTo(innerSize/2, -innerSize/2);
      innerShape.lineTo(innerSize/2, innerSize/2);
      innerShape.lineTo(-innerSize/2, innerSize/2);
      innerShape.lineTo(-innerSize/2, -innerSize/2);
      
      outerShape.holes.push(innerShape);
      
      const geometry = new THREE.ShapeGeometry(outerShape);
      const material = new THREE.MeshStandardMaterial({ 
        color: 0x8B4513, // Brown color for lanes
        roughness: 0.9,
        metalness: 0.1
      });
      
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = y;
      mesh.receiveShadow = true;
      
      return mesh;
    };
    
    // Add square lane path (between lane square and inner square)
    // Removed the squareLanePath mesh to eliminate the brown mesh on top and bottom lanes
    // const squareLanePath = createLanePath(LANE_SQUARE_SIZE, INNER_SQUARE_SIZE);
    // scene.add(squareLanePath);
    
    // Create map structure
    const mapStructure = new THREE.Group();
    
    // Calculate the intersection points of the diagonals with the lane square
    // For ally base (bottom-left intersection)
    const allyBasePos = new THREE.Vector3(-LANE_SQUARE_SIZE/2, 0, LANE_SQUARE_SIZE/2);
    
    // For enemy base (top-right intersection)
    const enemyBasePos = new THREE.Vector3(LANE_SQUARE_SIZE/2, 0, -LANE_SQUARE_SIZE/2);
    
    // Create bases - position them at the intersections of the diagonals with the lane square
    const allyBase = createBase(allyBasePos, false); // Bottom left
    const enemyBase = createBase(enemyBasePos, true); // Top right
    mapStructure.add(allyBase, enemyBase);
    
    // Store references to bases for resetting
    basesRef.current.allyBase = allyBase;
    basesRef.current.enemyBase = enemyBase;
    
    // Set base coordinates for debug display
    setBaseCoordinates({
      ally: { 
        x: allyBasePos.x, 
        y: allyBasePos.z // Bottom left in 2D coordinates
      },
      enemy: { 
        x: enemyBasePos.x, 
        y: enemyBasePos.z // Top right in 2D coordinates
      }
    });
    
    // Function to test damage on bases (for demonstration)
    const testDamage = () => {
      // Only for testing - in a real game, damage would come from player attacks
      if (Math.random() > 0.5) {
        allyBase.takeDamage(Math.random() * 10);
        setGameState(prev => ({
          ...prev,
          allyBaseHealth: allyBase.health
        }));
      } else {
        enemyBase.takeDamage(Math.random() * 10);
        setGameState(prev => ({
          ...prev,
          enemyBaseHealth: enemyBase.health
        }));
      }
      
      // Check for game over
      if (allyBase.isDestroyed) {
        setGameState(prev => ({
          ...prev,
          gameOver: true,
          winner: 'enemy'
        }));
      } else if (enemyBase.isDestroyed) {
        setGameState(prev => ({
          ...prev,
          gameOver: true,
          winner: 'ally'
        }));
      }
    };
    
    // Add event listener for testing damage (press 'D' key)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'd' || event.key === 'D') {
        testDamage();
      }
    };
    
    window.addEventListener('keydown', onKeyDown);
    
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
    const laneSquareMaterial = new THREE.LineDashedMaterial({ 
      color: 0xff0000, 
      linewidth: 2,
      dashSize: 3,
      gapSize: 2
    });
    const laneSquareLines = new THREE.LineSegments(laneSquareGeometry, laneSquareMaterial);
    laneSquareLines.position.y = 0.25; // Same height as the diagonal red lines
    
    // Compute line distances for dashed lines
    laneSquareLines.computeLineDistances();
    
    scene.add(laneSquareLines);

    // Add inner cyan square outline (5 units inside lane square)
    const innerCyanSize = LANE_SQUARE_SIZE - 10; // 5 units on each side
    const innerCyanGeometry = new THREE.BufferGeometry();
    const innerCyanVertices = new Float32Array([
      // Draw a square using lines
      -innerCyanSize/2, 0, -innerCyanSize/2,  // Start at top-left
      innerCyanSize/2, 0, -innerCyanSize/2,   // Top line
      innerCyanSize/2, 0, -innerCyanSize/2,   // Start at top-right
      innerCyanSize/2, 0, innerCyanSize/2,    // Right line
      innerCyanSize/2, 0, innerCyanSize/2,    // Start at bottom-right
      -innerCyanSize/2, 0, innerCyanSize/2,   // Bottom line
      -innerCyanSize/2, 0, innerCyanSize/2,   // Start at bottom-left
      -innerCyanSize/2, 0, -innerCyanSize/2   // Left line
    ]);
    innerCyanGeometry.setAttribute('position', new THREE.Float32BufferAttribute(innerCyanVertices, 3));
    const innerCyanMaterial = new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 1.5 });
    const innerCyanLines = new THREE.LineSegments(innerCyanGeometry, innerCyanMaterial);
    innerCyanLines.position.y = 0.16; // Slightly above the lane square lines
    scene.add(innerCyanLines);

    // Add outer cyan square outline (5 units outside lane square)
    const outerCyanSize = LANE_SQUARE_SIZE + 10; // 5 units on each side
    const outerCyanGeometry = new THREE.BufferGeometry();
    const outerCyanVertices = new Float32Array([
      // Draw a square using lines
      -outerCyanSize/2, 0, -outerCyanSize/2,  // Start at top-left
      outerCyanSize/2, 0, -outerCyanSize/2,   // Top line
      outerCyanSize/2, 0, -outerCyanSize/2,   // Start at top-right
      outerCyanSize/2, 0, outerCyanSize/2,    // Right line
      outerCyanSize/2, 0, outerCyanSize/2,    // Start at bottom-right
      -outerCyanSize/2, 0, outerCyanSize/2,   // Bottom line
      -outerCyanSize/2, 0, outerCyanSize/2,   // Start at bottom-left
      -outerCyanSize/2, 0, -outerCyanSize/2   // Left line
    ]);
    outerCyanGeometry.setAttribute('position', new THREE.Float32BufferAttribute(outerCyanVertices, 3));
    const outerCyanMaterial = new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 1.5 });
    const outerCyanLines = new THREE.LineSegments(outerCyanGeometry, outerCyanMaterial);
    outerCyanLines.position.y = 0.16; // Slightly above the lane square lines
    scene.add(outerCyanLines);

    // Add cross lines across the map
    const crossLinesGeometry = new THREE.BufferGeometry();
    const crossVertices = new Float32Array([
      // First diagonal line (bottom-left to top-right) - extended to map corners
      -PLAYABLE_AREA/2, 0, PLAYABLE_AREA/2,  // Start at bottom-left map corner
      PLAYABLE_AREA/2, 0, -PLAYABLE_AREA/2,  // End at top-right map corner
      
      // Second diagonal line (top-left to bottom-right) - extended to map corners
      -PLAYABLE_AREA/2, 0, -PLAYABLE_AREA/2,  // Start at top-left map corner
      PLAYABLE_AREA/2, 0, PLAYABLE_AREA/2,    // End at bottom-right map corner
    ]);
    crossLinesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(crossVertices, 3));
    const crossLinesMaterial = new THREE.LineDashedMaterial({ 
      color: 0xff0000, 
      linewidth: 2,
      dashSize: 3,
      gapSize: 2
    });
    const crossLines = new THREE.LineSegments(crossLinesGeometry, crossLinesMaterial);
    crossLines.position.y = 0.25; // Slightly above other lines to be visible
    
    // Compute line distances for dashed lines
    crossLines.computeLineDistances();
    
    scene.add(crossLines); // Add the diagonal lines

    // Add parallel blue lines to create bands around the diagonals
    const createParallelLine = (startPoint: THREE.Vector3, endPoint: THREE.Vector3, offset: number): THREE.Line => {
      // Calculate direction vector
      const direction = new THREE.Vector3().subVectors(endPoint, startPoint).normalize();
      
      // Calculate perpendicular vector (in XZ plane)
      const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x).normalize().multiplyScalar(offset);
      
      // Create offset points
      const offsetStart = new THREE.Vector3().addVectors(startPoint, perpendicular);
      const offsetEnd = new THREE.Vector3().addVectors(endPoint, perpendicular);
      
      // Create geometry
      const geometry = new THREE.BufferGeometry().setFromPoints([offsetStart, offsetEnd]);
      const material = new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 1.5 });
      
      return new THREE.Line(geometry, material);
    };
    
    // Diagonal (bottom-left to top-right) - extended to map corners
    const diagStart = new THREE.Vector3(-PLAYABLE_AREA/2, 0, PLAYABLE_AREA/2);
    const diagEnd = new THREE.Vector3(PLAYABLE_AREA/2, 0, -PLAYABLE_AREA/2);
    
    // Second diagonal (top-left to bottom-right) - extended to map corners
    const diag2Start = new THREE.Vector3(-PLAYABLE_AREA/2, 0, -PLAYABLE_AREA/2);
    const diag2End = new THREE.Vector3(PLAYABLE_AREA/2, 0, PLAYABLE_AREA/2);
    
    // Create parallel lines (5 units on each side for a total width of 10)
    const offset = 5;
    
    // Parallel lines for the first diagonal
    const diagLine1 = createParallelLine(diagStart, diagEnd, offset);
    const diagLine2 = createParallelLine(diagStart, diagEnd, -offset);
    
    // Parallel lines for the second diagonal
    const diag2Line1 = createParallelLine(diag2Start, diag2End, offset);
    const diag2Line2 = createParallelLine(diag2Start, diag2End, -offset);
    
    // Position slightly above ground but below the red lines
    diagLine1.position.y = 0.22;
    diagLine2.position.y = 0.22;
    diag2Line1.position.y = 0.22;
    diag2Line2.position.y = 0.22;
    
    // Add to scene
    scene.add(diagLine1);
    scene.add(diagLine2);
    scene.add(diag2Line1);
    scene.add(diag2Line2);

    // Create diagonal lane path
    const createDiagonalLanePath = (start: THREE.Vector3, end: THREE.Vector3, width: number, y: number = 0.05): THREE.Mesh => {
      // Calculate direction and length
      const direction = new THREE.Vector3().subVectors(end, start).normalize();
      const length = start.distanceTo(end);
      
      // Create lane geometry
      const geometry = new THREE.PlaneGeometry(length, width);
      const material = new THREE.MeshStandardMaterial({ 
        color: 0x8B4513, // Brown color for lanes
        roughness: 0.9,
        metalness: 0.1,
        side: THREE.DoubleSide
      });
      
      const mesh = new THREE.Mesh(geometry, material);
      
      // Position at midpoint
      const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
      mesh.position.copy(midpoint);
      mesh.position.y = y;
      
      // Calculate rotation to align with direction
      const angle = Math.atan2(direction.z, direction.x);
      mesh.rotation.y = -angle + Math.PI / 2;
      mesh.rotation.x = -Math.PI / 2;
      
      mesh.receiveShadow = true;
      
      return mesh;
    };
    
    // Add diagonal lane path - commented out to remove the 3D mesh
    // const diagPath = createDiagonalLanePath(diagStart, diagEnd, 10);
    // scene.add(diagPath);

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
      
      // Create a new potential position
      const newPosition = new THREE.Vector3(newX, character.position.y, newZ);
      
      // Check for collisions with bases
      const allyBasePos = new THREE.Vector3(-LANE_SQUARE_SIZE/2, 0, LANE_SQUARE_SIZE/2);
      const enemyBasePos = new THREE.Vector3(LANE_SQUARE_SIZE/2, 0, -LANE_SQUARE_SIZE/2);
      
      // Calculate distance to base centers
      const distToAllyBase = new THREE.Vector2(newPosition.x - allyBasePos.x, newPosition.z - allyBasePos.z).length();
      const distToEnemyBase = new THREE.Vector2(newPosition.x - enemyBasePos.x, newPosition.z - enemyBasePos.z).length();
      
      // Base properties
      const baseRadius = 18; // Radius of the base platform
      const baseHeight = 3.25; // Height of the base platform
      
      // Determine if character is on a base and adjust height
      let characterHeight = 0;
      
      // Check if on ally base
      if (distToAllyBase < baseRadius) {
        // Character is on the ally base - adjust height
        characterHeight = baseHeight;
      }
      // Check if on enemy base
      else if (distToEnemyBase < baseRadius) {
        // Character is on the enemy base - adjust height
        characterHeight = baseHeight;
      }
      
      // Update position - always allow movement, just adjust height when on a base
      character.position.x = Math.max(-PLAYABLE_AREA/2, Math.min(PLAYABLE_AREA/2, newX));
      character.position.z = Math.max(-PLAYABLE_AREA/2, Math.min(PLAYABLE_AREA/2, newZ));
      character.position.y = characterHeight; // Set height based on whether on a base
      
      // Update character model position
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
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [keyBindings, resetGame]);
  
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
      </div>
      
      {/* Debug block for base coordinates */}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        right: '10px',
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
          Player: X: {Math.round(playerPos.x)} Y: {Math.round(-playerPos.z)}
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
          Ally Base: X: {Math.round(baseCoordinates.ally.x)} Y: {Math.round(baseCoordinates.ally.y)}
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
          Enemy Base: X: {Math.round(baseCoordinates.enemy.x)} Y: {Math.round(baseCoordinates.enemy.y)}
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
          Lane Square: {LANE_SQUARE_SIZE}x{LANE_SQUARE_SIZE}
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
          Playable Area: {PLAYABLE_AREA}x{PLAYABLE_AREA}
        </div>
      </div>
      
      {/* Game over message with restart button */}
      {gameState.gameOver && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: 'white',
          fontSize: '36px',
          fontWeight: 'bold',
          textAlign: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          padding: '20px 40px',
          borderRadius: '10px',
          textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px'
        }}>
          <div>{gameState.winner === 'ally' ? 'Victory!' : 'Defeat!'}</div>
          <button 
            onClick={resetGame}
            style={{
              backgroundColor: '#4CAF50',
              border: 'none',
              color: 'white',
              padding: '15px 32px',
              textAlign: 'center',
              textDecoration: 'none',
              display: 'inline-block',
              fontSize: '16px',
              margin: '4px 2px',
              cursor: 'pointer',
              borderRadius: '8px',
              fontWeight: 'bold',
              boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
              transition: '0.3s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#45a049';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#4CAF50';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            Restart Game
          </button>
        </div>
      )}
      
      {/* Health status display */}
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '5px'
      }}>
        <div style={{
          color: '#00ffff',
          fontSize: '16px',
          fontFamily: 'monospace',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          padding: '8px 12px',
          borderRadius: '8px',
          textShadow: '1px 1px 1px rgba(0,0,0,0.5)'
        }}>
          Ally Base: {Math.round(gameState.allyBaseHealth)} / 1000
        </div>
        <div style={{
          color: '#ff5555',
          fontSize: '16px',
          fontFamily: 'monospace',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          padding: '8px 12px',
          borderRadius: '8px',
          textShadow: '1px 1px 1px rgba(0,0,0,0.5)'
        }}>
          Enemy Base: {Math.round(gameState.enemyBaseHealth)} / 1000
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