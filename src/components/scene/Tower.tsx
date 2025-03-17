import * as THREE from 'three';
import { createHealthBar } from '../../utils';
import { GameObjectWithHealth } from '../../types/gameObjects';
import positionRegistry, { TeamType } from '../../utils/PositionRegistry';

// Tower interface
export interface Tower extends THREE.Group, GameObjectWithHealth {
  team: TeamType;
  shootingRange: number;
  attackCooldown: number;
  detectEnemies: () => void;
  startDetection: () => void;
  stopDetection: () => void;
  shootAt: (targetPosition: THREE.Vector3) => void;
}

/**
 * Creates a tower with health, team affiliation, and shooting range
 * @param position - The position of the tower in the scene
 * @param team - The team the tower belongs to ('red' or 'blue')
 * @param initialHealth - The initial health of the tower (default: 300)
 * @param shootingRange - The shooting range of the tower (default: 15)
 * @returns A Tower object with all necessary properties and methods
 */
export const createTower = (
  position: THREE.Vector3, 
  team: TeamType, 
  initialHealth: number = 300,
  shootingRange: number = 15
): Tower => {
  const tower = new THREE.Group() as Tower;
  
  // Set tower properties
  tower.health = initialHealth;
  tower.maxHealth = initialHealth;
  tower.isDestroyed = false;
  tower.team = team;
  tower.shootingRange = shootingRange;
  tower.attackCooldown = 0;
  
  // Create tower base
  const baseGeometry = new THREE.CylinderGeometry(1.5, 2, 2, 8);
  const baseMaterial = new THREE.MeshStandardMaterial({ 
    color: team === 'red' ? 0xff0000 : 0x0000ff,
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
    color: team === 'red' ? 0xdd0000 : 0x0000dd,
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
    color: team === 'red' ? 0xbb0000 : 0x0000bb,
    roughness: 0.5
  });
  const top = new THREE.Mesh(topGeometry, topMaterial);
  top.position.y = 6.5;
  top.castShadow = true;
  top.receiveShadow = true;
  tower.add(top);
  
  // Create shooting range indicator (dotted yellow circle)
  const segments = 64;
  
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
  tower.userData.rangeIndicator = rangeIndicator;
  tower.userData.detectionInterval = null;
  
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
      
      // Stop detection
      tower.stopDetection();
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
  
  // Enemy detection method
  tower.detectEnemies = () => {
    if (!(rangeIndicator.material instanceof THREE.LineDashedMaterial)) {
      return;
    }
    
    // Get tower position
    const towerPosition = tower.position.clone();
    
    // Query the position registry for entities in range
    const enemiesInRange = positionRegistry.getEntitiesInRange(
      towerPosition,
      tower.shootingRange,
      tower.team
    );
    
    // Change range indicator color based on detection
    if (enemiesInRange.length > 0) {
      // Change to red when enemies detected
      (rangeIndicator.material as THREE.LineDashedMaterial).color.set(0xff0000);
      
      // Log detection
      console.log('Tower detected enemies:', enemiesInRange);
      
      // Check if tower can shoot (not on cooldown)
      if (tower.attackCooldown <= 0) {
        // Get the first enemy (highest priority)
        const [targetId, targetData] = enemiesInRange[0];
        
        // Shoot at the enemy
        tower.shootAt(targetData.position.clone());
        
        // Set cooldown
        tower.attackCooldown = 2; // 2 seconds cooldown
      } else {
        // Reduce cooldown
        tower.attackCooldown -= 0.5; // 0.5 seconds per check (assuming 500ms interval)
      }
    } else {
      // Change back to yellow when no enemies
      (rangeIndicator.material as THREE.LineDashedMaterial).color.set(0xffff00);
      
      // Reduce cooldown even when no enemies
      if (tower.attackCooldown > 0) {
        tower.attackCooldown -= 0.5;
      }
    }
  };
  
  // Shoot projectile at target position
  tower.shootAt = (targetPosition: THREE.Vector3) => {
    // Create projectile
    const projectileGeometry = new THREE.SphereGeometry(0.5, 24, 24);
    const projectileMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 2,
      transparent: true,
      opacity: 0.9
    });
    const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);
    
    // Set initial position (from tower top)
    const startPosition = tower.position.clone();
    startPosition.y = 6.5; // Top of the tower
    projectile.position.copy(startPosition);
    
    // Add to scene
    tower.parent?.add(projectile);
    
    // Calculate direction and distance
    const direction = new THREE.Vector3().subVectors(targetPosition, startPosition).normalize();
    const distance = startPosition.distanceTo(targetPosition);
    
    // Add outer glow effect
    const glowGeometry = new THREE.SphereGeometry(0.8, 24, 24);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: team === 'red' ? 0xff8888 : 0x8888ff,
      transparent: true,
      opacity: 0.3
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    projectile.add(glow);
    
    // Add inner core glow
    const coreGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    projectile.add(core);
    
    // Projectile speed (units per second)
    const speed = 12; // Slightly slower to make it more visible
    
    // Calculate time to reach target
    const timeToTarget = distance / speed;
    
    // Animation variables
    let elapsedTime = 0;
    const animateProjectile = () => {
      // Time increment (assuming 60fps)
      const deltaTime = 1/60;
      elapsedTime += deltaTime;
      
      // Calculate progress (0 to 1)
      const progress = Math.min(elapsedTime / timeToTarget, 1);
      
      // Move projectile along path
      const newPosition = new THREE.Vector3().lerpVectors(
        startPosition,
        targetPosition,
        progress
      );
      projectile.position.copy(newPosition);
      
      // Pulse glow effect
      const pulseScale = 1 + 0.3 * Math.sin(elapsedTime * 12);
      glow.scale.set(pulseScale, pulseScale, pulseScale);
      
      // Rotate projectile for more dynamic effect
      projectile.rotation.x += 0.05;
      projectile.rotation.y += 0.05;
      
      // Continue animation until target reached
      if (progress < 1) {
        requestAnimationFrame(animateProjectile);
      } else {
        // Create impact effect
        const impactGeometry = new THREE.SphereGeometry(1.5, 24, 24);
        const impactMaterial = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.8
        });
        const impact = new THREE.Mesh(impactGeometry, impactMaterial);
        impact.position.copy(targetPosition);
        tower.parent?.add(impact);
        
        // Add colored outer impact based on team
        const outerImpactGeometry = new THREE.SphereGeometry(2, 24, 24);
        const outerImpactMaterial = new THREE.MeshBasicMaterial({
          color: team === 'red' ? 0xff5555 : 0x5555ff,
          transparent: true,
          opacity: 0.4
        });
        const outerImpact = new THREE.Mesh(outerImpactGeometry, outerImpactMaterial);
        impact.add(outerImpact);
        
        // Animate impact and remove
        let impactScale = 1;
        const animateImpact = () => {
          impactScale *= 0.9;
          impact.scale.set(impactScale, impactScale, impactScale);
          impact.material.opacity *= 0.9;
          
          if (impactScale > 0.1) {
            requestAnimationFrame(animateImpact);
          } else {
            tower.parent?.remove(impact);
          }
        };
        animateImpact();
        
        // Remove projectile
        tower.parent?.remove(projectile);
      }
    };
    
    // Start animation
    animateProjectile();
  };
  
  // Start detection interval
  tower.startDetection = () => {
    // Clear any existing interval
    tower.stopDetection();
    
    // Start a new detection interval
    tower.userData.detectionInterval = setInterval(() => {
      tower.detectEnemies();
    }, 500); // Check every 500ms
  };
  
  // Stop detection interval
  tower.stopDetection = () => {
    if (tower.userData.detectionInterval) {
      clearInterval(tower.userData.detectionInterval);
      tower.userData.detectionInterval = null;
    }
  };
  
  // Initialize health bar
  tower.updateHealthBar();
  
  // Set tower position
  tower.position.copy(position);
  
  return tower;
};

export default createTower; 