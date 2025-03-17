import * as THREE from 'three';
import { createHealthBar } from '../../utils';
import { GameObjectWithHealth } from '../../types/gameObjects';

// Tower interface
export interface Tower extends THREE.Group, GameObjectWithHealth {
  team: 'ally' | 'enemy';
  shootingRange: number;
  attackCooldown: number;
}

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
    
    // Get canvas context
    const context = tower.healthBar.userData.context as CanvasRenderingContext2D;
    const canvas = tower.healthBar.userData.canvas as HTMLCanvasElement;
    const texture = tower.healthBar.userData.texture as THREE.CanvasTexture;
    
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
    const sprite = tower.healthBar.userData.sprite as THREE.Sprite;
    if (sprite) {
      sprite.center.set(0.5, 0);
    }
  };
  
  // Initialize health bar
  tower.updateHealthBar();
  
  // Set tower position
  tower.position.copy(position);
  
  return tower;
};

export default createTower; 