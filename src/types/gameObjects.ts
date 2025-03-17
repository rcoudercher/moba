import * as THREE from 'three';

// Interface for objects with health
export interface GameObjectWithHealth extends THREE.Object3D {
  health: number;
  maxHealth: number;
  isDestroyed: boolean;
  healthBar?: THREE.Object3D & { 
    userData: { 
      sprite?: THREE.Sprite, 
      context?: CanvasRenderingContext2D, 
      canvas?: HTMLCanvasElement, 
      texture?: THREE.CanvasTexture 
    } 
  };
  takeDamage: (amount: number) => void;
  updateHealthBar: () => void;
} 