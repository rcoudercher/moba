import * as THREE from 'three';
import { GameObjectWithHealth } from './types/gameObjects';

// Function to create a health bar using sprites
export function createHealthBar (width: number, height: number, position: THREE.Vector3, yOffset: number): THREE.Group {
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
  }

export function createBase(position: THREE.Vector3, isEnemy: boolean): THREE.Group & GameObjectWithHealth {
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
