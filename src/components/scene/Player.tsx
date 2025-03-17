import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export interface PlayerProps {
  scene: THREE.Scene;
  camera: THREE.Camera;
  initialPosition: THREE.Vector3;
  playableArea: number;
  onPositionChange?: (position: THREE.Vector3) => void;
  onHealthChange?: (health: number, maxHealth: number) => void;
  onDeath?: () => void;
  obstacles?: THREE.Object3D[];
}

export interface PlayerRef {
  position: THREE.Vector3;
  health: number;
  maxHealth: number;
  takeDamage: (amount: number) => void;
  heal: (amount: number) => void;
  teleportTo: (position: THREE.Vector3) => void;
  getObject: () => THREE.Object3D;
}

const Player = ({
  scene,
  camera,
  initialPosition,
  playableArea,
  onPositionChange,
  onHealthChange,
  onDeath,
  obstacles = []
}: PlayerProps) => {
  const playerRef = useRef<PlayerRef | null>(null);
  const isControlsEnabledRef = useRef(true);

  useEffect(() => {
    // Create player mesh
    const geometry = new THREE.CylinderGeometry(0.5, 0.5, 2, 8);
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    const playerMesh = new THREE.Mesh(geometry, material);
    playerMesh.castShadow = true;
    playerMesh.position.copy(initialPosition);
    playerMesh.position.y = 1; // Height offset
    scene.add(playerMesh);
    
    // Create target indicator
    const indicatorGeometry = new THREE.CircleGeometry(0.5, 16);
    const indicatorMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.7,
    });
    const targetIndicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
    targetIndicator.rotation.x = -Math.PI / 2;
    targetIndicator.visible = false;
    scene.add(targetIndicator);
    
    // Create health bar
    const healthBarGroup = new THREE.Group();
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 8;
    const context = canvas.getContext('2d');
    
    if (context) {
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
      sprite.scale.set(2, 0.25, 1);
      sprite.position.y = 2.5; // Position above player
      
      healthBarGroup.add(sprite);
      healthBarGroup.userData = {
        canvas,
        context,
        texture,
        sprite
      };
    }
    
    scene.add(healthBarGroup);
    
    // Player state
    const player = {
      mesh: playerMesh,
      position: initialPosition.clone(),
      direction: new THREE.Vector3(0, 0, 0),
      targetPosition: null as THREE.Vector3 | null,
      speed: 0.15,
      health: 100,
      maxHealth: 100,
      healthBar: healthBarGroup,
      isDestroyed: false
    };
    
    // Update health bar
    const updateHealthBar = () => {
      if (!player.healthBar) return;
      
      const healthPercent = player.health / player.maxHealth;
      
      // Get canvas context
      const context = player.healthBar.userData.context as CanvasRenderingContext2D;
      const canvas = player.healthBar.userData.canvas as HTMLCanvasElement;
      const texture = player.healthBar.userData.texture as THREE.CanvasTexture;
      
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
    };
    
    // Position health bar above player
    const updateHealthBarPosition = () => {
      if (player.healthBar) {
        player.healthBar.position.copy(player.position);
        player.healthBar.position.y = 2.5; // Above player
      }
    };
    
    // Right-click handler for movement
    const onMouseClick = (event: MouseEvent) => {
      if (event.button !== 2 || !isControlsEnabledRef.current || player.isDestroyed) return;
      
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
      intersectionPoint.x = Math.max(-playableArea/2, Math.min(playableArea/2, intersectionPoint.x));
      intersectionPoint.z = Math.max(-playableArea/2, Math.min(playableArea/2, intersectionPoint.z));
      
      // Set new target position
      player.targetPosition = intersectionPoint;
      
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
      if (player.isDestroyed) return;
      
      if (player.targetPosition) {
        // Calculate direction to target
        const direction = new THREE.Vector3()
          .subVectors(player.targetPosition, player.position)
          .setY(0);
        
        // Check if we're close enough to stop
        if (direction.length() < 0.1) {
          player.targetPosition = null;
          player.direction.set(0, 0, 0);
        } else {
          // Normalize direction and set character movement
          direction.normalize();
          player.direction.copy(direction);
          player.mesh.rotation.y = Math.atan2(direction.x, direction.z);
        }
      }
      
      // Calculate new position
      const moveSpeed = player.speed;
      const newX = player.position.x + player.direction.x * moveSpeed;
      const newZ = player.position.z + player.direction.z * moveSpeed;
      
      // Create a new potential position
      const newPosition = new THREE.Vector3(newX, player.position.y, newZ);
      
      // Check if new position is within playable area boundaries
      if (
        newPosition.x >= -playableArea/2 && 
        newPosition.x <= playableArea/2 && 
        newPosition.z >= -playableArea/2 && 
        newPosition.z <= playableArea/2
      ) {
        // Check for collisions with obstacles
        let canMove = true;
        const playerRadius = 0.5;
        
        for (const obstacle of obstacles) {
          if (obstacle.userData.radius) {
            // For circular obstacles
            const obstaclePos = new THREE.Vector3(
              obstacle.position.x,
              0,
              obstacle.position.z
            );
            const distance = new THREE.Vector2(
              newPosition.x - obstaclePos.x,
              newPosition.z - obstaclePos.z
            ).length();
            
            if (distance < playerRadius + obstacle.userData.radius) {
              canMove = false;
              break;
            }
          } else if (obstacle.userData.width && obstacle.userData.depth) {
            // For rectangular obstacles
            const minX = obstacle.position.x - obstacle.userData.width / 2 - playerRadius;
            const maxX = obstacle.position.x + obstacle.userData.width / 2 + playerRadius;
            const minZ = obstacle.position.z - obstacle.userData.depth / 2 - playerRadius;
            const maxZ = obstacle.position.z + obstacle.userData.depth / 2 + playerRadius;
            
            if (
              newPosition.x > minX &&
              newPosition.x < maxX &&
              newPosition.z > minZ &&
              newPosition.z < maxZ
            ) {
              canMove = false;
              break;
            }
          }
        }
        
        if (canMove) {
          // Update player position
          player.position.copy(newPosition);
          player.mesh.position.copy(player.position);
          player.mesh.position.y = 1; // Height offset
          
          // Update health bar position
          updateHealthBarPosition();
          
          // Notify parent component of position change
          if (onPositionChange) {
            onPositionChange(player.position.clone());
          }
        }
      }
    };
    
    // Damage and health methods
    const takeDamage = (amount: number) => {
      if (player.isDestroyed) return;
      
      player.health = Math.max(0, player.health - amount);
      updateHealthBar();
      
      if (onHealthChange) {
        onHealthChange(player.health, player.maxHealth);
      }
      
      // Visual feedback for damage
      player.mesh.material.color.set(0xff0000);
      setTimeout(() => {
        player.mesh.material.color.set(0x00ff00);
      }, 200);
      
      // Check for death
      if (player.health <= 0 && !player.isDestroyed) {
        player.isDestroyed = true;
        
        // Visual feedback for death
        player.mesh.visible = false;
        player.healthBar.visible = false;
        
        if (onDeath) {
          onDeath();
        }
      }
    };
    
    const heal = (amount: number) => {
      if (player.isDestroyed) return;
      
      player.health = Math.min(player.maxHealth, player.health + amount);
      updateHealthBar();
      
      if (onHealthChange) {
        onHealthChange(player.health, player.maxHealth);
      }
      
      // Visual feedback for healing
      player.mesh.material.color.set(0x00ffff);
      setTimeout(() => {
        player.mesh.material.color.set(0x00ff00);
      }, 200);
    };
    
    const respawn = () => {
      if (!player.isDestroyed) return;
      
      player.isDestroyed = false;
      player.health = player.maxHealth;
      player.position.copy(initialPosition);
      player.mesh.position.copy(initialPosition);
      player.mesh.position.y = 1;
      player.mesh.visible = true;
      player.healthBar.visible = true;
      player.direction.set(0, 0, 0);
      player.targetPosition = null;
      
      updateHealthBar();
      updateHealthBarPosition();
      
      if (onHealthChange) {
        onHealthChange(player.health, player.maxHealth);
      }
    };
    
    // Expose methods via ref
    playerRef.current = {
      position: player.position,
      health: player.health,
      maxHealth: player.maxHealth,
      takeDamage,
      heal,
      teleportTo: (position: THREE.Vector3) => {
        player.position.copy(position);
        player.mesh.position.copy(position);
        player.mesh.position.y = 1; // Height offset
        updateHealthBarPosition();
        
        if (onPositionChange) {
          onPositionChange(player.position.clone());
        }
      },
      getObject: () => playerMesh
    };
    
    // Event listeners
    window.addEventListener('mousedown', onMouseClick);
    window.addEventListener('contextmenu', onContextMenu);
    
    // Initial setup
    updateHealthBar();
    updateHealthBarPosition();
    
    // Animation frame update function
    const update = () => {
      updateMovement();
    };
    
    // Add to animation loop
    const animationId = setAnimationLoop(update);
    
    // Cleanup
    return () => {
      window.removeEventListener('mousedown', onMouseClick);
      window.removeEventListener('contextmenu', onContextMenu);
      cancelAnimationLoop(animationId);
      
      scene.remove(playerMesh);
      scene.remove(targetIndicator);
      scene.remove(healthBarGroup);
    };
  }, [scene, camera, initialPosition, playableArea, onPositionChange, onHealthChange, onDeath, obstacles]);
  
  // Helper function to manage animation loops
  const setAnimationLoop = (callback: () => void) => {
    const id = { value: 0 };
    
    const animate = () => {
      callback();
      id.value = requestAnimationFrame(animate);
    };
    
    id.value = requestAnimationFrame(animate);
    return id;
  };
  
  const cancelAnimationLoop = (id: { value: number }) => {
    cancelAnimationFrame(id.value);
  };
  
  // Expose the player ref
  return null;
};

export default Player; 