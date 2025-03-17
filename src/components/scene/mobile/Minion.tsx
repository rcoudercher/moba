import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { createHealthBar } from '../../../utils';
import { GameObjectWithHealth } from '../../../types/gameObjects';

export interface MinionProps {
  position: THREE.Vector3;
  team: 'ally' | 'enemy';
  scene: THREE.Scene;
  targetPosition?: THREE.Vector3;
  onDestroy?: () => void;
  bases?: {
    allyBase?: THREE.Group & GameObjectWithHealth;
    enemyBase?: THREE.Group & GameObjectWithHealth;
  };
}

export interface Minion extends THREE.Group, GameObjectWithHealth {
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
  targetMonument: () => void;
}

const Minion: React.FC<MinionProps> = ({ 
  position, 
  team, 
  scene, 
  targetPosition, 
  onDestroy,
  bases
}) => {
  const minionRef = useRef<Minion | null>(null);
  
  useEffect(() => {
    if (!scene) return;
    
    // Create minion
    const minion = new THREE.Group() as Minion;
    minionRef.current = minion;
    
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
    
    // Set target position based on team or use provided target
    if (targetPosition) {
      minion.targetPosition = targetPosition.clone();
    } else {
      // Default target positions if none provided
      minion.targetPosition = team === 'ally' 
        ? new THREE.Vector3(75, 0, -75) // Enemy base (approximate)
        : new THREE.Vector3(-75, 0, 75); // Ally base (approximate)
    }
    
    // Add method to target the enemy monument
    minion.targetMonument = () => {
      if (!bases) return;
      
      const targetBase = minion.team === 'ally' ? bases.enemyBase : bases.allyBase;
      if (targetBase && targetBase.userData.objective) {
        minion.attackTarget = targetBase.userData.objective;
        
        // Set the target position to the monument
        minion.targetPosition = targetBase.position.clone();
        
        // Log for debugging
        console.log(`Minion ${minion.team} targeting monument`);
      }
    };
    
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
            if (minion.parent) {
              minion.removeFromParent();
            }
            if (onDestroy) {
              onDestroy();
            }
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
      
      // If no target, check if we're close to the enemy monument and target it
      if (!minion.attackTarget && bases) {
        const targetBase = minion.team === 'ally' ? bases.enemyBase : bases.allyBase;
        if (targetBase && targetBase.userData.objective) {
          const monument = targetBase.userData.objective;
          if (!monument.userData.isDestroyed) {
            const distanceToMonument = minion.position.distanceTo(monument.position);
            if (distanceToMonument <= minion.attackRange + 10) {
              minion.attackTarget = monument;
            }
          }
        }
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
        if ((minion.attackTarget as any).takeDamage || 
            ((minion.attackTarget as any).userData && (minion.attackTarget as any).userData.takeDamage)) {
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
              if ((minion.attackTarget as any).takeDamage) {
                (minion.attackTarget as any).takeDamage(minion.damage);
              } else if ((minion.attackTarget as any).userData && (minion.attackTarget as any).userData.takeDamage) {
                // Check if target is a monument and reduce damage
                const isMonument = (minion.attackTarget as any).userData && 
                                  ((minion.attackTarget as any).userData.team === 'ally' || 
                                   (minion.attackTarget as any).userData.team === 'enemy');
                
                // Apply reduced damage to monuments
                const damageAmount = isMonument ? minion.damage * 0.2 : minion.damage; // 80% reduction for monuments
                (minion.attackTarget as any).userData.takeDamage(damageAmount);
              }
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
      const allyBasePos = new THREE.Vector3(-75, 0, 75);
      const enemyBasePos = new THREE.Vector3(75, 0, -75);
      
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
    
    // Add minion to scene
    scene.add(minion);
    
    // Animation loop
    const animate = () => {
      if (minionRef.current && !minionRef.current.isDestroyed) {
        minionRef.current.update();
        requestAnimationFrame(animate);
      }
    };
    
    // Start animation
    animate();
    
    // Cleanup function
    return () => {
      if (minionRef.current && minionRef.current.parent) {
        minionRef.current.parent.remove(minionRef.current);
      }
    };
  }, [position, team, scene, targetPosition, bases, onDestroy]);
  
  return null; // This is a Three.js component, so it doesn't render any DOM elements
};

export default Minion; 