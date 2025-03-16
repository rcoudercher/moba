import * as THREE from 'three';

// Define interfaces for game objects with health
export interface GameObjectWithHealth {
  health: number;
  maxHealth: number;
  healthBar?: THREE.Group;
  takeDamage: (amount: number) => void;
  updateHealthBar: () => void;
  isDestroyed: boolean;
}

// Define interface for tower
export interface Tower extends THREE.Group, GameObjectWithHealth {
  team: 'ally' | 'enemy';
  shootingRange: number;
}

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

/**
 * Creates a tower with health, team affiliation, and shooting range
 * @param position - The position of the tower in the scene
 * @param isEnemy - Whether the tower belongs to the enemy team (red) or ally team (blue)
 * @param initialHealth - The initial health of the tower (default: 300)
 * @param shootingRange - The shooting range of the tower (default: 15)
 * @returns A Tower object with all necessary properties and methods
 */
export const createTower = (
  position: THREE.Vector3, 
  isEnemy: boolean, 
  initialHealth: number = 300,
  shootingRange: number = 15
): Tower => {
  const tower = new THREE.Group() as Tower;
  
  // Set tower properties
  tower.team = isEnemy ? 'enemy' : 'ally';
  tower.health = initialHealth;
  tower.maxHealth = initialHealth;
  tower.isDestroyed = false;
  tower.shootingRange = shootingRange;
  
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
  
  // Add shooting range indicator (dotted yellow circle)
  const segments = 64;
  const rangeGeometry = new THREE.BufferGeometry();
  
  // Create circle points
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const x = tower.shootingRange * Math.cos(theta);
    const z = tower.shootingRange * Math.sin(theta);
    points.push(new THREE.Vector3(x, 0, z));
  }
  
  rangeGeometry.setFromPoints(points);
  
  // Create dotted yellow line material
  const rangeMaterial = new THREE.LineDashedMaterial({
    color: 0xffff00,
    dashSize: 1,
    gapSize: 0.5,
    linewidth: 1
  });
  
  const rangeIndicator = new THREE.Line(rangeGeometry, rangeMaterial);
  rangeIndicator.position.copy(position);
  rangeIndicator.position.y = 0.2; // Slightly above ground
  
  // Compute line distances for dashed lines
  rangeIndicator.computeLineDistances();
  
  tower.add(rangeIndicator);
  
  // Create and add health bar
  const healthBarWidth = 5;
  const healthBarHeight = 0.5;
  const healthBarYOffset = 9; // Position above the tower
  tower.healthBar = createHealthBar(healthBarWidth, healthBarHeight, position, healthBarYOffset);
  tower.add(tower.healthBar);
  
  // Add methods for health management
  tower.takeDamage = (amount: number) => {
    if (tower.isDestroyed) return;
    
    tower.health -= amount;
    if (tower.health <= 0) {
      tower.health = 0;
      tower.isDestroyed = true;
      
      // Handle destruction
      // Create explosion effect
      const explosionGeometry = new THREE.SphereGeometry(3, 32, 32);
      const explosionMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        transparent: true,
        opacity: 0.8
      });
      const explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);
      explosion.position.copy(position);
      explosion.position.y = 4;
      tower.add(explosion);
      
      // Animate explosion and fade out
      let scale = 1;
      const expandExplosion = () => {
        if (scale < 3) {
          scale += 0.1;
          explosion.scale.set(scale, scale, scale);
          explosion.material.opacity -= 0.02;
          requestAnimationFrame(expandExplosion);
        } else {
          tower.remove(explosion);
        }
      };
      expandExplosion();
      
      // Make tower look damaged
      baseStructure.scale.y = 0.3; // Collapse it
      baseStructure.position.y = 1.5; // Lower it
      
      // Hide range indicator when destroyed
      rangeIndicator.visible = false;
    }
    
    tower.updateHealthBar();
  };
  
  tower.updateHealthBar = () => {
    if (!tower.healthBar) return;
    
    const healthPercent = tower.health / tower.maxHealth;
    const healthBar = tower.healthBar.userData.healthBar as THREE.Mesh;
    
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
  tower.updateHealthBar();
  
  // Set tower position
  tower.position.copy(position);
  
  return tower;
};

export default createTower; 