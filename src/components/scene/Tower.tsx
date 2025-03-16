import * as THREE from 'three';

// Interface for objects with health
export interface GameObjectWithHealth extends THREE.Object3D {
  health: number;
  maxHealth: number;
  isDestroyed: boolean;
  healthBar?: THREE.Group;
  takeDamage: (amount: number) => void;
  updateHealthBar: () => void;
}

// Tower interface
export interface Tower extends THREE.Group, GameObjectWithHealth {
  team: 'ally' | 'enemy';
  shootingRange: number;
  attackCooldown: number;
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
  
  // Rotate to face camera
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
 * @returns A Tower object with all necessary properties and methods
 */
export const createTower = (
  position: THREE.Vector3, 
  isEnemy: boolean, 
  initialHealth: number = 300
): Tower => {
  const tower = new THREE.Group() as Tower;
  
  // Set tower properties
  tower.health = initialHealth;
  tower.maxHealth = initialHealth;
  tower.isDestroyed = false;
  tower.team = isEnemy ? 'enemy' : 'ally';
  tower.shootingRange = 15;
  tower.attackCooldown = 0;
  
  // Create tower base
  const baseGeometry = new THREE.CylinderGeometry(1.5, 2, 2, 8);
  const baseMaterial = new THREE.MeshStandardMaterial({ 
    color: isEnemy ? 0xff0000 : 0x0000ff,
    roughness: 0.7
  });
  const base = new THREE.Mesh(baseGeometry, baseMaterial);
  base.position.y = 1;
  base.castShadow = true;
  base.receiveShadow = true;
  tower.add(base);
  
  // Create tower middle section
  const middleGeometry = new THREE.CylinderGeometry(1.2, 1.5, 4, 8);
  const middleMaterial = new THREE.MeshStandardMaterial({ 
    color: isEnemy ? 0xdd0000 : 0x0000dd,
    roughness: 0.6
  });
  const middle = new THREE.Mesh(middleGeometry, middleMaterial);
  middle.position.y = 4;
  middle.castShadow = true;
  middle.receiveShadow = true;
  tower.add(middle);
  
  // Create tower top
  const topGeometry = new THREE.CylinderGeometry(1.5, 1.2, 1, 8);
  const topMaterial = new THREE.MeshStandardMaterial({ 
    color: isEnemy ? 0xbb0000 : 0x0000bb,
    roughness: 0.5
  });
  const top = new THREE.Mesh(topGeometry, topMaterial);
  top.position.y = 6.5;
  top.castShadow = true;
  top.receiveShadow = true;
  tower.add(top);
  
  // Create shooting range indicator (dotted yellow circle)
  const segments = 64;
  const shootingRange = 15;
  
  // Create a circle geometry
  const rangeGeometry = new THREE.BufferGeometry();
  const rangeVertices = [];
  
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const x = shootingRange * Math.cos(theta);
    const z = shootingRange * Math.sin(theta);
    rangeVertices.push(x, 0, z);
  }
  
  rangeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(rangeVertices, 3));
  
  // Create dashed line material
  const rangeMaterial = new THREE.LineDashedMaterial({
    color: 0xffff00,
    dashSize: 1,
    gapSize: 0.5,
  });
  
  // Create the line
  const rangeIndicator = new THREE.Line(rangeGeometry, rangeMaterial);
  rangeIndicator.position.y = 0.2; // Slightly above ground
  rangeIndicator.computeLineDistances(); // Required for dashed lines
  tower.add(rangeIndicator);
  
  // Store shooting range in userData for game logic
  tower.userData.shootingRange = shootingRange;
  
  // Create and add health bar
  const healthBarWidth = 3;
  const healthBarHeight = 0.3;
  const healthBarYOffset = 8; // Position above the tower
  
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
      const explosionGeometry = new THREE.SphereGeometry(2, 32, 32);
      const explosionMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        transparent: true,
        opacity: 0.8
      });
      const explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);
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
      [base, middle, top].forEach(part => {
        (part.material as THREE.MeshStandardMaterial).color.set(0x555555);
        (part.material as THREE.MeshStandardMaterial).emissive.set(0x000000);
      });
      
      // Collapse the tower a bit
      middle.scale.y = 0.5;
      middle.position.y = 3;
      top.visible = false;
      
      // Hide range indicator
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