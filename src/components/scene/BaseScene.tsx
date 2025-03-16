import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { KeyBinding, defaultKeyBindings } from '../../config/keyBindings';
import Minimap from './Minimap';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';

// Import environment components
import { createSky } from './environment/Sky';
import createTower, { Tower, GameObjectWithHealth } from './Tower';

// Define interface for minions
interface Minion extends THREE.Group, GameObjectWithHealth {
  health: number;
  maxHealth: number;
  team: 'ally' | 'enemy';
  speed: number;
  targetPosition: THREE.Vector3;
  isDestroyed: boolean;
  update: () => void;
  attackTarget: THREE.Object3D | null;
  attackCooldown: number;
  attackRange: number;
  damage: number;
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

// Function to create a health bar using sprites
const createHealthBar = (width: number, height: number, position: THREE.Vector3, yOffset: number): THREE.Group => {
  const group = new THREE.Group();
  
  // Create a canvas for the health bar
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 8;
  const context = canvas.getContext('2d');
  if (!context) return group;
  
  // Draw background (gray)
  context.fillStyle = '#444444';
  context.fillRect(0, 0, 64, 8);
  
  // Draw health (green)
  context.fillStyle = '#00ff00';
  context.fillRect(0, 0, 64, 8);
  
  // Create sprite texture
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  
  // Create sprite material
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true
  });
  
  // Create sprite
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(width, height, 1);
  
  // Position the sprite
  sprite.position.y = yOffset;
  
  // Add to group
  group.add(sprite);
  
  // Store reference to the canvas and context for updates
  group.userData.canvas = canvas;
  group.userData.context = context;
  group.userData.texture = texture;
  group.userData.sprite = sprite;
  
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
  
  // Store the objective in userData for collision detection
  base.userData.objective = objective;
  base.userData.objectiveRadius = 3; // Radius of the objective cylinder
  
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
    
    // Get canvas context
    const context = base.healthBar.userData.context as CanvasRenderingContext2D;
    const canvas = base.healthBar.userData.canvas as HTMLCanvasElement;
    const texture = base.healthBar.userData.texture as THREE.CanvasTexture;
    
    if (!context || !canvas || !texture) return;
    
    // Clear canvas
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background (gray)
    context.fillStyle = '#444444';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw health with color based on percentage
    if (healthPercent > 0.6) {
      context.fillStyle = '#00ff00'; // Green
    } else if (healthPercent > 0.3) {
      context.fillStyle = '#ffff00'; // Yellow
    } else {
      context.fillStyle = '#ff0000'; // Red
    }
    
    const healthWidth = Math.max(1, Math.floor(canvas.width * healthPercent));
    context.fillRect(0, 0, healthWidth, canvas.height);
    
    // Update texture
    texture.needsUpdate = true;
    
    // Make health bar always face camera
    const sprite = base.healthBar.userData.sprite as THREE.Sprite;
    if (sprite) {
      sprite.center.set(0.5, 0);
    }
  };
  
  // Initialize health bar
  base.updateHealthBar();
  
  return base;
};

// Add health to the central monument in each base
const addHealthToMonument = (base: THREE.Group & GameObjectWithHealth) => {
  // Find the central objective (monument)
  const objective = base.userData.objective as THREE.Mesh;
  if (!objective) return;
  
  // Add health properties to the monument
  objective.userData.health = 500;
  objective.userData.maxHealth = 500;
  objective.userData.isDestroyed = false;
  
  // Create health bar for the monument
  const monumentHealthBarWidth = 4;
  const monumentHealthBarHeight = 0.4;
  const monumentHealthBarYOffset = 5; // Position above the monument
  
  const monumentHealthBar = createHealthBar(
    monumentHealthBarWidth, 
    monumentHealthBarHeight, 
    new THREE.Vector3(0, 0, 0), 
    monumentHealthBarYOffset
  );
  
  objective.add(monumentHealthBar);
  objective.userData.healthBar = monumentHealthBar;
  
  // Add update health bar method
  objective.userData.updateHealthBar = () => {
    const healthPercent = objective.userData.health / objective.userData.maxHealth;
    
    // Get canvas context
    const context = monumentHealthBar.userData.context as CanvasRenderingContext2D;
    const canvas = monumentHealthBar.userData.canvas as HTMLCanvasElement;
    const texture = monumentHealthBar.userData.texture as THREE.CanvasTexture;
    
    if (!context || !canvas || !texture) return;
    
    // Clear canvas
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background (gray)
    context.fillStyle = '#444444';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw health with color based on percentage
    if (healthPercent > 0.6) {
      context.fillStyle = '#00ff00'; // Green
    } else if (healthPercent > 0.3) {
      context.fillStyle = '#ffff00'; // Yellow
    } else {
      context.fillStyle = '#ff0000'; // Red
    }
    
    const healthWidth = Math.max(1, Math.floor(canvas.width * healthPercent));
    context.fillRect(0, 0, healthWidth, canvas.height);
    
    // Update texture
    texture.needsUpdate = true;
    
    // Make health bar always face camera
    const sprite = monumentHealthBar.userData.sprite as THREE.Sprite;
    if (sprite) {
      sprite.center.set(0.5, 0);
    }
  };
  
  // Add take damage method
  objective.userData.takeDamage = (amount: number) => {
    if (objective.userData.isDestroyed) return;
    
    objective.userData.health -= amount;
    if (objective.userData.health <= 0) {
      objective.userData.health = 0;
      objective.userData.isDestroyed = true;
      
      // Handle destruction visually
      (objective.material as THREE.MeshStandardMaterial).color.set(0x555555);
      (objective.material as THREE.MeshStandardMaterial).emissive.set(0x000000);
    }
    
    objective.userData.updateHealthBar();
  };
  
  // Initialize health bar
  objective.userData.updateHealthBar();
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
  const [minions, setMinions] = useState<Minion[]>([]);
  const [nextSpawnTime, setNextSpawnTime] = useState<number>(30);
  
  // Add player health state
  const [playerHealth, setPlayerHealth] = useState({
    current: 100,
    max: 100,
    respawnTimer: undefined as number | undefined
  });
  
  // Add monument health state
  const [monumentHealth, setMonumentHealth] = useState({
    ally: { current: 500, max: 500 },
    enemy: { current: 500, max: 500 }
  });
  
  // Reference to store the bases for resetting
  const basesRef = useRef<{
    allyBase?: THREE.Group & GameObjectWithHealth,
    enemyBase?: THREE.Group & GameObjectWithHealth
  }>({});
  
  // Reference to store the character
  const characterRef = useRef<{
    health: number,
    maxHealth: number,
    model?: THREE.Mesh
  }>({
    health: 100,
    maxHealth: 100
  });
  
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
  
  // Function to create a minion
  const createMinion = (position: THREE.Vector3, team: 'ally' | 'enemy'): Minion => {
    const minion = new THREE.Group() as Minion;
    
    // Set minion properties
    minion.health = 100;
    minion.maxHealth = 100;
    minion.team = team;
    minion.speed = 0.05;
    minion.isDestroyed = false;
    minion.attackTarget = null;
    minion.attackCooldown = 0;
    minion.attackRange = 5;
    minion.damage = 20;
    
    // Create minion body
    const bodyGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.8, 8);
    const bodyMaterial = new THREE.MeshStandardMaterial({ 
      color: team === 'ally' ? 0x0000ff : 0xff0000,
      roughness: 0.7
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.4;
    body.castShadow = true;
    minion.add(body);
    
    // Create minion head
    const headGeometry = new THREE.SphereGeometry(0.2, 8, 8);
    const headMaterial = new THREE.MeshStandardMaterial({ 
      color: team === 'ally' ? 0x5555ff : 0xff5555,
      roughness: 0.5
    });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 0.9;
    head.castShadow = true;
    minion.add(head);
    
    // Create health bar
    const healthBarWidth = 1;
    const healthBarHeight = 0.1;
    const healthBarYOffset = 1.5;
    minion.healthBar = createHealthBar(healthBarWidth, healthBarHeight, new THREE.Vector3(0, 0, 0), healthBarYOffset);
    minion.add(minion.healthBar);
    
    // Set minion position
    minion.position.copy(position);
    
    // Set target position based on team
    minion.targetPosition = team === 'ally' 
      ? new THREE.Vector3(LANE_SQUARE_SIZE/2, 0, -LANE_SQUARE_SIZE/2) // Enemy base
      : new THREE.Vector3(-LANE_SQUARE_SIZE/2, 0, LANE_SQUARE_SIZE/2); // Ally base
    
    // Add methods for health management
    minion.takeDamage = (amount: number) => {
      if (minion.isDestroyed) return;
      
      minion.health -= amount;
      if (minion.health <= 0) {
        minion.health = 0;
        minion.isDestroyed = true;
        
        // Create death effect
        const explosionGeometry = new THREE.SphereGeometry(0.5, 8, 8);
        const explosionMaterial = new THREE.MeshBasicMaterial({
          color: 0xffff00,
          transparent: true,
          opacity: 0.8
        });
        const explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);
        explosion.position.y = 0.5;
        minion.add(explosion);
        
        // Animate explosion and fade out
        let scale = 1;
        const expandExplosion = () => {
          if (scale < 2) {
            scale += 0.1;
            explosion.scale.set(scale, scale, scale);
            explosion.material.opacity -= 0.05;
            requestAnimationFrame(expandExplosion);
          } else {
            minion.visible = false;
            minion.removeFromParent();
          }
        };
        expandExplosion();
      }
      
      minion.updateHealthBar();
    };
    
    minion.updateHealthBar = () => {
      if (!minion.healthBar) return;
      
      const healthPercent = minion.health / minion.maxHealth;
      
      // Get canvas context
      const context = minion.healthBar.userData.context as CanvasRenderingContext2D;
      const canvas = minion.healthBar.userData.canvas as HTMLCanvasElement;
      const texture = minion.healthBar.userData.texture as THREE.CanvasTexture;
      
      if (!context || !canvas || !texture) return;
      
      // Clear canvas
      context.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw background (gray)
      context.fillStyle = '#444444';
      context.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw health with color based on percentage
      if (healthPercent > 0.6) {
        context.fillStyle = '#00ff00'; // Green
      } else if (healthPercent > 0.3) {
        context.fillStyle = '#ffff00'; // Yellow
      } else {
        context.fillStyle = '#ff0000'; // Red
      }
      
      const healthWidth = Math.max(1, Math.floor(canvas.width * healthPercent));
      context.fillRect(0, 0, healthWidth, canvas.height);
      
      // Update texture
      texture.needsUpdate = true;
      
      // Make health bar always face camera
      const sprite = minion.healthBar.userData.sprite as THREE.Sprite;
      if (sprite) {
        sprite.center.set(0.5, 0);
      }
    };
    
    // Initialize health bar
    minion.updateHealthBar();
    
    // Update function for minion movement and combat
    minion.update = () => {
      if (minion.isDestroyed) return;
      
      // Decrease attack cooldown if it's active
      if (minion.attackCooldown > 0) {
        minion.attackCooldown--;
      }
      
      // If we have a target and it's destroyed, clear it
      if (minion.attackTarget && 
          ((minion.attackTarget as any).isDestroyed || 
           !(minion.attackTarget as any).visible)) {
        minion.attackTarget = null;
      }
      
      // If we have a target, attack it
      if (minion.attackTarget && minion.attackCooldown <= 0) {
        // Face the target
        const targetDir = new THREE.Vector3()
          .subVectors(minion.attackTarget.position, minion.position)
          .setY(0)
          .normalize();
        
        minion.rotation.y = Math.atan2(targetDir.x, targetDir.z);
        
        // Attack
        if ((minion.attackTarget as any).takeDamage) {
          // Create projectile effect
          const projectileGeometry = new THREE.SphereGeometry(0.1, 8, 8);
          const projectileMaterial = new THREE.MeshBasicMaterial({
            color: minion.team === 'ally' ? 0x00ffff : 0xff00ff,
            transparent: true,
            opacity: 0.8
          });
          const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);
          projectile.position.copy(minion.position);
          projectile.position.y += 0.8; // Start at minion's head level
          
          // Add to scene
          const currentScene = minion.parent;
          if (currentScene) {
            currentScene.add(projectile);
          }
          
          // Animate projectile
          const startPos = projectile.position.clone();
          const endPos = minion.attackTarget.position.clone();
          endPos.y += 1; // Aim at upper body
          
          const animateProjectile = (progress: number) => {
            if (progress >= 1) {
              if (projectile.parent) {
                projectile.parent.remove(projectile);
              }
              // Deal damage when projectile hits
              (minion.attackTarget as any).takeDamage(minion.damage);
              return;
            }
            
            // Lerp position
            projectile.position.lerpVectors(startPos, endPos, progress);
            
            // Continue animation
            requestAnimationFrame(() => animateProjectile(progress + 0.1));
          };
          
          animateProjectile(0);
          
          // Set cooldown
          minion.attackCooldown = 60; // 60 frames = 1 second at 60fps
        }
        
        return; // Don't move while attacking
      }
      
      // Calculate direction to target
      const direction = new THREE.Vector3()
        .subVectors(minion.targetPosition, minion.position)
        .setY(0)
        .normalize();
      
      // Move towards target
      minion.position.x += direction.x * minion.speed;
      minion.position.z += direction.z * minion.speed;
      
      // Rotate to face direction
      minion.rotation.y = Math.atan2(direction.x, direction.z);
      
      // Check if on a base and adjust height
      const allyBasePos = new THREE.Vector3(-LANE_SQUARE_SIZE/2, 0, LANE_SQUARE_SIZE/2);
      const enemyBasePos = new THREE.Vector3(LANE_SQUARE_SIZE/2, 0, -LANE_SQUARE_SIZE/2);
      
      const distToAllyBase = new THREE.Vector2(minion.position.x - allyBasePos.x, minion.position.z - allyBasePos.z).length();
      const distToEnemyBase = new THREE.Vector2(minion.position.x - enemyBasePos.x, minion.position.z - enemyBasePos.z).length();
      
      const baseRadius = 18;
      const baseHeight = 3.25;
      const transitionZone = 5;
      
      // Adjust height based on position
      if (distToAllyBase < baseRadius - transitionZone) {
        minion.position.y = baseHeight;
      } else if (distToAllyBase < baseRadius) {
        const transitionProgress = 1 - ((distToAllyBase - (baseRadius - transitionZone)) / transitionZone);
        minion.position.y = baseHeight * transitionProgress;
      } else if (distToEnemyBase < baseRadius - transitionZone) {
        minion.position.y = baseHeight;
      } else if (distToEnemyBase < baseRadius) {
        const transitionProgress = 1 - ((distToEnemyBase - (baseRadius - transitionZone)) / transitionZone);
        minion.position.y = baseHeight * transitionProgress;
      } else {
        minion.position.y = 0;
      }
    };
    
    return minion;
  };
  
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
      position: new THREE.Vector3(-LANE_SQUARE_SIZE/2 + 5, 0, LANE_SQUARE_SIZE/2 - 5), // Start at blue base
      velocity: new THREE.Vector3(),
      direction: new THREE.Vector3(),
      speed: 0.15,
      jumpHeight: 0.2,
      isOnGround: true,
      gravity: 0.01,
      targetPosition: null as THREE.Vector3 | null,
      health: 100,
      maxHealth: 100,
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
    
    // Store character in ref for access in JSX
    characterRef.current = {
      health: character.health,
      maxHealth: character.maxHealth,
      model: character.model
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

    // Add health to monuments after creating bases
    addHealthToMonument(allyBase);
    addHealthToMonument(enemyBase);

    // Add ally tower on the middle lane, just before the inner cyan square
    const towerDirection = new THREE.Vector3().subVectors(enemyBasePos, allyBasePos).normalize();
    const innerSquareRadius = (LANE_SQUARE_SIZE - 10) / 2; // Half of the inner cyan square size
    
    // Simplified tower positioning - just two positions per side
    const outerTowerDistance = 60; // Further from center
    const innerTowerDistance = 21; // Closer to center
    
    // Add first ally tower (outer)
    const allyTower1Pos = new THREE.Vector3(
      -towerDirection.x * outerTowerDistance,
      0,
      -towerDirection.z * outerTowerDistance
    );
    const allyTower1 = createTower(allyTower1Pos, false, 300); // false = ally (blue)
    mapStructure.add(allyTower1);

    // Add second ally tower (inner)
    const allyTower2Pos = new THREE.Vector3(
      -towerDirection.x * innerTowerDistance,
      0,
      -towerDirection.z * innerTowerDistance
    );
    const allyTower2 = createTower(allyTower2Pos, false, 300); // false = ally (blue)
    mapStructure.add(allyTower2);

    // Add first enemy tower (outer)
    const enemyTower1Pos = new THREE.Vector3(
      towerDirection.x * outerTowerDistance,
      0,
      towerDirection.z * outerTowerDistance
    );
    const enemyTower1 = createTower(enemyTower1Pos, true, 300); // true = enemy (red)
    mapStructure.add(enemyTower1);

    // Add second enemy tower (inner)
    const enemyTower2Pos = new THREE.Vector3(
      towerDirection.x * innerTowerDistance,
      0,
      towerDirection.z * innerTowerDistance
    );
    const enemyTower2 = createTower(enemyTower2Pos, true, 300); // true = enemy (red)
    mapStructure.add(enemyTower2);

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
    
    // Define lane paths for minion spawning
    const lanes = [
      {
        name: 'top',
        allySpawn: new THREE.Vector3(-LANE_SQUARE_SIZE/2 + 5, 0, -LANE_SQUARE_SIZE/2 + 5),
        enemySpawn: new THREE.Vector3(LANE_SQUARE_SIZE/2 - 5, 0, -LANE_SQUARE_SIZE/2 + 5)
      },
      {
        name: 'mid',
        allySpawn: new THREE.Vector3(-LANE_SQUARE_SIZE/2 + 5, 0, LANE_SQUARE_SIZE/2 - 5),
        enemySpawn: new THREE.Vector3(LANE_SQUARE_SIZE/2 - 5, 0, -LANE_SQUARE_SIZE/2 + 5)
      },
      {
        name: 'bottom',
        allySpawn: new THREE.Vector3(-LANE_SQUARE_SIZE/2 + 5, 0, LANE_SQUARE_SIZE/2 - 5),
        enemySpawn: new THREE.Vector3(LANE_SQUARE_SIZE/2 - 5, 0, LANE_SQUARE_SIZE/2 - 5)
      }
    ];
    
    // Store all minions
    const minionsList: Minion[] = [];
    
    // Function to spawn a wave of minions
    const spawnMinionWave = () => {
      // Reset the next spawn timer
      setNextSpawnTime(30);
      
      // Spawn minions for each lane
      lanes.forEach(lane => {
        // Spawn 4 ally minions per lane
        for (let i = 0; i < 4; i++) {
          // Add some random offset to prevent minions from stacking
          const offsetX = (Math.random() - 0.5) * 2;
          const offsetZ = (Math.random() - 0.5) * 2;
          const spawnPos = new THREE.Vector3(
            lane.allySpawn.x + offsetX,
            0,
            lane.allySpawn.z + offsetZ
          );
          
          const minion = createMinion(spawnPos, 'ally');
          scene.add(minion);
          minionsList.push(minion);
        }
        
        // Spawn 4 enemy minions per lane
        for (let i = 0; i < 4; i++) {
          // Add some random offset to prevent minions from stacking
          const offsetX = (Math.random() - 0.5) * 2;
          const offsetZ = (Math.random() - 0.5) * 2;
          const spawnPos = new THREE.Vector3(
            lane.enemySpawn.x + offsetX,
            0,
            lane.enemySpawn.z + offsetZ
          );
          
          const minion = createMinion(spawnPos, 'enemy');
          scene.add(minion);
          minionsList.push(minion);
        }
      });
      
      // Update minions state
      setMinions([...minionsList]);
    };
    
    // Set up minion spawning interval
    const spawnInterval = setInterval(spawnMinionWave, 30000); // Spawn every 30 seconds
    
    // Set up timer update interval
    const timerInterval = setInterval(() => {
      setNextSpawnTime(prev => Math.max(0, prev - 1));
    }, 1000);
    
    // Spawn initial wave
    spawnMinionWave();
    
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
    
    // Function to test damage on towers (for demonstration)
    const testTowerDamage = () => {
      // Only for testing - in a real game, damage would come from player attacks
      allyTower1.takeDamage(Math.random() * 30);
      allyTower2.takeDamage(Math.random() * 30);
      enemyTower1.takeDamage(Math.random() * 30);
      enemyTower2.takeDamage(Math.random() * 30);
    };
    
    // Function to test damage on player (for demonstration)
    const testPlayerDamage = () => {
      // Only for testing - in a real game, damage would come from enemy attacks
      character.health -= Math.random() * 10;
      if (character.health < 0) character.health = 0;
      updatePlayerHealthBar();
    };
    
    // Function to test damage on monuments (for demonstration)
    const testMonumentDamage = () => {
      // Only for testing - in a real game, damage would come from player attacks
      if (allyBase.userData.objective && allyBase.userData.objective.userData.takeDamage) {
        allyBase.userData.objective.userData.takeDamage(Math.random() * 20);
        
        // Update state for UI
        setMonumentHealth(prev => ({
          ...prev,
          ally: {
            current: allyBase.userData.objective.userData.health,
            max: allyBase.userData.objective.userData.maxHealth
          }
        }));
      }
      
      if (enemyBase.userData.objective && enemyBase.userData.objective.userData.takeDamage) {
        enemyBase.userData.objective.userData.takeDamage(Math.random() * 20);
        
        // Update state for UI
        setMonumentHealth(prev => ({
          ...prev,
          enemy: {
            current: enemyBase.userData.objective.userData.health,
            max: enemyBase.userData.objective.userData.maxHealth
          }
        }));
      }
    };
    
    // Function to heal player (for demonstration)
    const healPlayer = (amount: number) => {
      character.health = Math.min(character.maxHealth, character.health + amount);
      updatePlayerHealthBar();
    };
    
    // Add event listener for testing damage (press 'D' key)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'd' || event.key === 'D') {
        testDamage();
      } else if (event.key === 't' || event.key === 'T') {
        testTowerDamage();
      } else if (event.key === 'p' || event.key === 'P') {
        testPlayerDamage();
      } else if (event.key === 'h' || event.key === 'H') {
        // Heal player (for testing)
        healPlayer(20);
      } else if (event.key === 'm' || event.key === 'M') {
        testMonumentDamage();
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
      
      // Check if the target is on a base to adjust the indicator height
      const allyBasePos = new THREE.Vector3(-LANE_SQUARE_SIZE/2, 0, LANE_SQUARE_SIZE/2);
      const enemyBasePos = new THREE.Vector3(LANE_SQUARE_SIZE/2, 0, -LANE_SQUARE_SIZE/2);
      
      // Calculate distance to base centers
      const distToAllyBase = new THREE.Vector2(intersectionPoint.x - allyBasePos.x, intersectionPoint.z - allyBasePos.z).length();
      const distToEnemyBase = new THREE.Vector2(intersectionPoint.x - enemyBasePos.x, intersectionPoint.z - enemyBasePos.z).length();
      
      // Base properties
      const baseRadius = 18; // Radius of the base platform
      const baseHeight = 3.25; // Height of the base platform
      const transitionZone = 5; // Width of the transition zone for smooth height change
      
      // Determine indicator height based on whether it's on a base
      let indicatorHeight = 0.1; // Default height slightly above ground
      
      // Check if on ally base or in transition zone
      if (distToAllyBase < baseRadius - transitionZone) {
        // Fully on the base
        indicatorHeight = baseHeight + 0.1; // Slightly above the base surface
      } else if (distToAllyBase < baseRadius) {
        // In the transition zone - calculate gradual height
        const transitionProgress = 1 - ((distToAllyBase - (baseRadius - transitionZone)) / transitionZone);
        indicatorHeight = (baseHeight * transitionProgress) + 0.1;
      }
      // Check if on enemy base or in transition zone (only if not already on ally base)
      else if (distToEnemyBase < baseRadius - transitionZone) {
        // Fully on the base
        indicatorHeight = baseHeight + 0.1; // Slightly above the base surface
      } else if (distToEnemyBase < baseRadius) {
        // In the transition zone - calculate gradual height
        const transitionProgress = 1 - ((distToEnemyBase - (baseRadius - transitionZone)) / transitionZone);
        indicatorHeight = (baseHeight * transitionProgress) + 0.1;
      }
      
      // Update target indicator position
      targetIndicator.position.copy(intersectionPoint);
      targetIndicator.position.y = indicatorHeight;
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
      const transitionZone = 5; // Width of the transition zone for smooth height change
      
      // Check for collisions with central towers
      let collisionWithTower = false;
      
      // Character collision radius
      const characterRadius = 0.5;
      
      // Check collision with ally base tower
      if (basesRef.current.allyBase && basesRef.current.allyBase.userData.objective) {
        const objectiveRadius = basesRef.current.allyBase.userData.objectiveRadius;
        const totalCollisionRadius = objectiveRadius + characterRadius;
        const distToAllyTower = new THREE.Vector2(newPosition.x - allyBasePos.x, newPosition.z - allyBasePos.z).length();
        
        if (distToAllyTower < totalCollisionRadius) {
          collisionWithTower = true;
        }
      }
      
      // Check collision with enemy base tower
      if (!collisionWithTower && basesRef.current.enemyBase && basesRef.current.enemyBase.userData.objective) {
        const objectiveRadius = basesRef.current.enemyBase.userData.objectiveRadius;
        const totalCollisionRadius = objectiveRadius + characterRadius;
        const distToEnemyTower = new THREE.Vector2(newPosition.x - enemyBasePos.x, newPosition.z - enemyBasePos.z).length();
        
        if (distToEnemyTower < totalCollisionRadius) {
          collisionWithTower = true;
        }
      }
      
      // Check for proximity to enemy towers and take damage if too close
      const checkTowerDamageToPlayer = () => {
        // Only check if player is alive
        if (character.health <= 0) return;
        
        // Check distance to enemy towers
        [enemyTower1, enemyTower2].forEach(tower => {
          if (tower.isDestroyed) return;
          
          const distToTower = character.position.distanceTo(tower.position);
          const towerAttackRange = tower.shootingRange;
          
          // If player is within tower attack range, take damage
          if (distToTower < towerAttackRange) {
            // Create projectile effect from tower to player
            const projectileGeometry = new THREE.SphereGeometry(0.2, 8, 8);
            const projectileMaterial = new THREE.MeshBasicMaterial({
              color: 0xff00ff,
              transparent: true,
              opacity: 0.8
            });
            const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);
            projectile.position.copy(tower.position);
            projectile.position.y += 5; // Start at tower's top
            scene.add(projectile);
            
            // Animate projectile
            const startPos = projectile.position.clone();
            const endPos = character.model.position.clone();
            endPos.y += 1; // Aim at upper body
            
            const animateProjectile = (progress: number) => {
              if (progress >= 1) {
                scene.remove(projectile);
                // Deal damage when projectile hits
                character.health -= 5; // Tower deals 5 damage per hit
                if (character.health < 0) character.health = 0;
                updatePlayerHealthBar();
                return;
              }
              
              // Lerp position
              projectile.position.lerpVectors(startPos, endPos, progress);
              
              // Continue animation
              requestAnimationFrame(() => animateProjectile(progress + 0.05));
            };
            
            animateProjectile(0);
            
            // Set tower cooldown
            tower.attackCooldown = 60; // 60 frames = 1 second at 60fps
          }
        });
        
        // Check distance to enemy minions
        minionsList.forEach(minion => {
          if (minion.isDestroyed || minion.team !== 'enemy') return;
          
          const distToMinion = character.position.distanceTo(minion.position);
          
          // If player is within minion attack range and minion is not attacking something else
          if (distToMinion < minion.attackRange && !minion.attackTarget) {
            // Set player as target
            minion.attackTarget = character.model;
            
            // If minion can attack (cooldown is 0)
            if (minion.attackCooldown <= 0) {
              // Create projectile effect
              const projectileGeometry = new THREE.SphereGeometry(0.1, 8, 8);
              const projectileMaterial = new THREE.MeshBasicMaterial({
                color: 0xff00ff,
                transparent: true,
                opacity: 0.8
              });
              const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);
              projectile.position.copy(minion.position);
              projectile.position.y += 0.8; // Start at minion's head level
              scene.add(projectile);
              
              // Animate projectile
              const startPos = projectile.position.clone();
              const endPos = character.model.position.clone();
              endPos.y += 1; // Aim at upper body
              
              const animateProjectile = (progress: number) => {
                if (progress >= 1) {
                  scene.remove(projectile);
                  // Deal damage when projectile hits
                  character.health -= minion.damage;
                  if (character.health < 0) character.health = 0;
                  updatePlayerHealthBar();
                  return;
                }
                
                // Lerp position
                projectile.position.lerpVectors(startPos, endPos, progress);
                
                // Continue animation
                requestAnimationFrame(() => animateProjectile(progress + 0.1));
              };
              
              animateProjectile(0);
              
              // Set cooldown
              minion.attackCooldown = 60; // 60 frames = 1 second at 60fps
            }
          }
        });
      };
      
      // Determine if character is on a base and adjust height
      let characterHeight = 0;
      
      // Check if on ally base or in transition zone
      if (distToAllyBase < baseRadius - transitionZone) {
        // Fully on the base
        characterHeight = baseHeight;
      } else if (distToAllyBase < baseRadius) {
        // In the transition zone - calculate gradual height
        const transitionProgress = 1 - ((distToAllyBase - (baseRadius - transitionZone)) / transitionZone);
        characterHeight = baseHeight * transitionProgress;
      }
      // Check if on enemy base or in transition zone (only if not already on ally base)
      else if (distToEnemyBase < baseRadius - transitionZone) {
        // Fully on the base
        characterHeight = baseHeight;
      } else if (distToEnemyBase < baseRadius) {
        // In the transition zone - calculate gradual height
        const transitionProgress = 1 - ((distToEnemyBase - (baseRadius - transitionZone)) / transitionZone);
        characterHeight = baseHeight * transitionProgress;
      }
      
      // Update position - allow movement if no collision with towers
      if (!collisionWithTower) {
        character.position.x = Math.max(-PLAYABLE_AREA/2, Math.min(PLAYABLE_AREA/2, newX));
        character.position.z = Math.max(-PLAYABLE_AREA/2, Math.min(PLAYABLE_AREA/2, newZ));
      } else {
        // If collision with tower, cancel target position
        character.targetPosition = null;
        character.direction.set(0, 0, 0);
      }
      
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
      
      // Check if player should take damage from enemy towers or minions
      checkTowerDamageToPlayer();
    };
    
    // Add tower shooting functionality
    const updateTowerAttacks = () => {
      // Check if ally towers can attack enemy minions
      [allyTower1, allyTower2].forEach(tower => {
        if (tower.isDestroyed || tower.attackCooldown > 0) return;
        
        // Find closest enemy minion within range
        let closestEnemy: Minion | null = null;
        let closestDistance = Infinity;
        
        minionsList.forEach(minion => {
          if (minion.isDestroyed || minion.team !== 'enemy') return;
          
          const distance = tower.position.distanceTo(minion.position);
          if (distance <= tower.shootingRange && distance < closestDistance) {
            closestEnemy = minion;
            closestDistance = distance;
          }
        });
        
        // Attack if enemy found
        if (closestEnemy) {
          // Create projectile effect
          const projectileGeometry = new THREE.SphereGeometry(0.2, 8, 8);
          const projectileMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.8
          });
          const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);
          projectile.position.copy(tower.position);
          projectile.position.y += 5; // Start at tower's top
          scene.add(projectile);
          
          // Animate projectile
          const startPos = projectile.position.clone();
          const endPos = (closestEnemy as THREE.Object3D).position.clone();
          endPos.y += 1; // Aim at upper body
          
          const animateProjectile = (progress: number) => {
            if (progress >= 1) {
              scene.remove(projectile);
              // Deal damage when projectile hits (2 shots to kill)
              closestEnemy!.takeDamage(50);
              return;
            }
            
            // Lerp position
            projectile.position.lerpVectors(startPos, endPos, progress);
            
            // Continue animation
            requestAnimationFrame(() => animateProjectile(progress + 0.05));
          };
          
          animateProjectile(0);
          
          // Set cooldown
          tower.attackCooldown = 45; // 45 frames = 0.75 seconds at 60fps
        }
      });
      
      // Check if enemy towers can attack ally minions
      [enemyTower1, enemyTower2].forEach(tower => {
        if (tower.isDestroyed || tower.attackCooldown > 0) return;
        
        // Find closest ally minion within range
        let closestEnemy: Minion | null = null;
        let closestDistance = Infinity;
        
        minionsList.forEach(minion => {
          if (minion.isDestroyed || minion.team !== 'ally') return;
          
          const distance = tower.position.distanceTo(minion.position);
          if (distance <= tower.shootingRange && distance < closestDistance) {
            closestEnemy = minion;
            closestDistance = distance;
          }
        });
        
        // Attack if enemy found
        if (closestEnemy) {
          // Create projectile effect
          const projectileGeometry = new THREE.SphereGeometry(0.2, 8, 8);
          const projectileMaterial = new THREE.MeshBasicMaterial({
            color: 0xff00ff,
            transparent: true,
            opacity: 0.8
          });
          const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);
          projectile.position.copy(tower.position);
          projectile.position.y += 5; // Start at tower's top
          scene.add(projectile);
          
          // Animate projectile
          const startPos = projectile.position.clone();
          const endPos = (closestEnemy as THREE.Object3D).position.clone();
          endPos.y += 1; // Aim at upper body
          
          const animateProjectile = (progress: number) => {
            if (progress >= 1) {
              scene.remove(projectile);
              // Deal damage when projectile hits (2 shots to kill)
              closestEnemy!.takeDamage(50);
              return;
            }
            
            // Lerp position
            projectile.position.lerpVectors(startPos, endPos, progress);
            
            // Continue animation
            requestAnimationFrame(() => animateProjectile(progress + 0.05));
          };
          
          animateProjectile(0);
          
          // Set cooldown
          tower.attackCooldown = 45; // 45 frames = 0.75 seconds at 60fps
        }
      });
      
      // Check if minions can attack enemies
      minionsList.forEach(minion => {
        if (minion.isDestroyed) return;
        
        // Skip if already has a target
        if (minion.attackTarget) return;
        
        // Find closest enemy (minion, tower, or base)
        let closestEnemy: THREE.Object3D | null = null;
        let closestDistance = Infinity;
        
        // Check enemy minions
        minionsList.forEach(otherMinion => {
          if (otherMinion.isDestroyed || otherMinion.team === minion.team) return;
          
          const distance = minion.position.distanceTo(otherMinion.position);
          if (distance <= minion.attackRange && distance < closestDistance) {
            closestEnemy = otherMinion;
            closestDistance = distance;
          }
        });
        
        // Check enemy towers
        const enemyTowers = minion.team === 'ally' 
          ? [enemyTower1, enemyTower2] as Tower[]
          : [allyTower1, allyTower2] as Tower[];
        
        enemyTowers.forEach(tower => {
          if (tower.isDestroyed) return;
          
          const distance = minion.position.distanceTo(tower.position);
          if (distance <= minion.attackRange && distance < closestDistance) {
            closestEnemy = tower;
            closestDistance = distance;
          }
        });
        
        // Check enemy base
        const targetBase = minion.team === 'ally' ? basesRef.current.enemyBase : basesRef.current.allyBase;
        if (targetBase) {
          const distanceToBase = minion.position.distanceTo(targetBase.position);
          
          if (distanceToBase <= minion.attackRange + 15 && distanceToBase < closestDistance) {
            closestEnemy = targetBase;
            closestDistance = distanceToBase;
          }
        }
        
        // Set target if found
        if (closestEnemy) {
          minion.attackTarget = closestEnemy;
        }
      });
    };
    
    // Update animation loop
    const animate = () => {
      const time = performance.now();
      const delta = (time - prevTime) / 1000;
      
      updateMovement();
      
      // Update tower attacks
      updateTowerAttacks();
      
      // Update all minions
      minionsList.forEach(minion => {
        minion.update();
      });
      
      // Decrease tower attack cooldowns
      [allyTower1, allyTower2, enemyTower1, enemyTower2].forEach(tower => {
        if (tower.attackCooldown > 0) {
          tower.attackCooldown--;
        }
      });
      
      // Check if player is dead
      if (character.health <= 0 && character.model.visible) {
        // Player is dead, show visual effect
        character.model.visible = false;
        
        // Create death explosion effect
        const explosionGeometry = new THREE.SphereGeometry(1, 16, 16);
        const explosionMaterial = new THREE.MeshBasicMaterial({
          color: 0xffff00,
          transparent: true,
          opacity: 0.8
        });
        const explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);
        explosion.position.copy(character.model.position);
        scene.add(explosion);
        
        // Animate explosion and fade out
        let scale = 1;
        const expandExplosion = () => {
          if (scale < 3) {
            scale += 0.1;
            explosion.scale.set(scale, scale, scale);
            explosion.material.opacity -= 0.02;
            requestAnimationFrame(expandExplosion);
          } else {
            scene.remove(explosion);
          }
        };
        expandExplosion();
        
        // Set respawn timer
        const respawnTime = 5; // 5 seconds
        let respawnTimer = respawnTime;
        
        // Update respawn timer display
        const updateRespawnTimer = () => {
          setPlayerHealth(prev => ({
            ...prev,
            respawnTimer: respawnTimer
          }));
          
          respawnTimer--;
          
          if (respawnTimer >= 0) {
            setTimeout(updateRespawnTimer, 1000);
          }
        };
        
        updateRespawnTimer();
        
        // Respawn player after 5 seconds
        setTimeout(() => {
          character.health = character.maxHealth;
          character.model.visible = true;
          // Respawn at blue base
          character.position.set(-LANE_SQUARE_SIZE/2 + 5, 0, LANE_SQUARE_SIZE/2 - 5);
          character.targetPosition = null;
          updatePlayerHealthBar();
          
          // Clear respawn timer
          setPlayerHealth(prev => ({
            ...prev,
            respawnTimer: undefined
          }));
        }, respawnTime * 1000);
      }
      
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
    
    // Add health bar to the player character
    const playerHealthBarWidth = 1.5;
    const playerHealthBarHeight = 0.15;
    const playerHealthBarYOffset = 3;
    const playerHealthBar = createHealthBar(playerHealthBarWidth, playerHealthBarHeight, character.position, playerHealthBarYOffset);
    character.model.add(playerHealthBar);

    // Function to update player health bar
    const updatePlayerHealthBar = () => {
      const healthPercent = character.health / character.maxHealth;
      
      // Get canvas context
      const context = playerHealthBar.userData.context as CanvasRenderingContext2D;
      const canvas = playerHealthBar.userData.canvas as HTMLCanvasElement;
      const texture = playerHealthBar.userData.texture as THREE.CanvasTexture;
      
      if (!context || !canvas || !texture) return;
      
      // Clear canvas
      context.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw background (gray)
      context.fillStyle = '#444444';
      context.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw health with color based on percentage
      if (healthPercent > 0.6) {
        context.fillStyle = '#00ff00'; // Green
      } else if (healthPercent > 0.3) {
        context.fillStyle = '#ffff00'; // Yellow
      } else {
        context.fillStyle = '#ff0000'; // Red
      }
      
      const healthWidth = Math.max(1, Math.floor(canvas.width * healthPercent));
      context.fillRect(0, 0, healthWidth, canvas.height);
      
      // Update texture
      texture.needsUpdate = true;
      
      // Make health bar always face camera
      const sprite = playerHealthBar.userData.sprite as THREE.Sprite;
      if (sprite) {
        sprite.center.set(0.5, 0);
      }
      
      // Update the state for UI, preserving the respawnTimer value
      setPlayerHealth(prev => ({
        ...prev,
        current: character.health,
        max: character.maxHealth
      }));
      
      // Update ref for access in JSX
      characterRef.current.health = character.health;
    };

    // Initialize player health bar
    updatePlayerHealthBar();

    // Add health to the central monument in each base
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseClick);
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('resize', onWindowResize);
      mountRef.current?.removeChild(renderer.domElement);
      window.removeEventListener('keydown', onKeyDown);
      clearInterval(spawnInterval);
      clearInterval(timerInterval);
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
        <div style={{
          color: '#F7FF00',
          fontSize: '16px',
          fontFamily: 'monospace',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          padding: '8px 12px',
          borderRadius: '8px',
          textShadow: '1px 1px 1px rgba(0,0,0,0.5)'
        }}>
          Next Spawn: {nextSpawnTime}s
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
      
      {/* Player health bar at the bottom of the screen */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '300px',
        height: '30px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: '5px',
        padding: '3px',
        border: '1px solid #444'
      }}>
        <div style={{
          width: `${(playerHealth.current / playerHealth.max) * 100}%`,
          height: '100%',
          backgroundColor: playerHealth.current > 60 ? '#00ff00' : playerHealth.current > 30 ? '#ffff00' : '#ff0000',
          borderRadius: '3px',
          transition: 'width 0.3s ease-in-out'
        }} />
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: 'white',
          fontWeight: 'bold',
          textShadow: '1px 1px 2px black'
        }}>
          {playerHealth.respawnTimer !== undefined ? 
            `Respawning in ${playerHealth.respawnTimer}...` : 
            `${Math.ceil(playerHealth.current)} / ${playerHealth.max}`
          }
        </div>
      </div>
      
      {/* Monument health display */}
      <div style={{
        position: 'absolute',
        bottom: '60px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'row',
        gap: '20px',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        padding: '5px 10px',
        borderRadius: '5px'
      }}>
        {/* Ally Monument Health */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#00ffff', fontSize: '12px', marginBottom: '3px' }}>Ally Monument</div>
          <div style={{
            width: '120px',
            height: '15px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            borderRadius: '3px',
            padding: '2px',
            border: '1px solid #444'
          }}>
            <div style={{
              width: `${(monumentHealth.ally.current / monumentHealth.ally.max) * 100}%`,
              height: '100%',
              backgroundColor: '#00ffff',
              borderRadius: '2px',
              transition: 'width 0.3s ease-in-out'
            }} />
          </div>
        </div>
        
        {/* Enemy Monument Health */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#ff5555', fontSize: '12px', marginBottom: '3px' }}>Enemy Monument</div>
          <div style={{
            width: '120px',
            height: '15px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            borderRadius: '3px',
            padding: '2px',
            border: '1px solid #444'
          }}>
            <div style={{
              width: `${(monumentHealth.enemy.current / monumentHealth.enemy.max) * 100}%`,
              height: '100%',
              backgroundColor: '#ff5555',
              borderRadius: '2px',
              transition: 'width 0.3s ease-in-out'
            }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BaseScene; 