import * as THREE from 'three';
import { TeamType } from './PositionRegistry';

// Event types
export type GameEventType = 
  | 'projectile_impact' 
  | 'entity_damaged'
  | 'entity_destroyed';

// Base event interface
export interface GameEvent {
  type: GameEventType;
  timestamp: number;
}

// Projectile impact event
export interface ProjectileImpactEvent extends GameEvent {
  type: 'projectile_impact';
  position: THREE.Vector3;
  radius: number;
  damage: number;
  sourceTeam: TeamType;
  sourceId: string;
}

// Entity damaged event
export interface EntityDamagedEvent extends GameEvent {
  type: 'entity_damaged';
  entityId: string;
  damage: number;
  health: number;
  maxHealth: number;
}

// Entity destroyed event
export interface EntityDestroyedEvent extends GameEvent {
  type: 'entity_destroyed';
  entityId: string;
  position: THREE.Vector3;
  team: TeamType;
}

// Event listener type
export type GameEventListener = (event: GameEvent) => void;

// Event system class
class GameEventSystem {
  private listeners: Map<GameEventType, Set<GameEventListener>>;
  
  constructor() {
    this.listeners = new Map();
  }
  
  // Add event listener
  addEventListener(type: GameEventType, listener: GameEventListener): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    
    this.listeners.get(type)!.add(listener);
  }
  
  // Remove event listener
  removeEventListener(type: GameEventType, listener: GameEventListener): void {
    if (this.listeners.has(type)) {
      this.listeners.get(type)!.delete(listener);
    }
  }
  
  // Dispatch event
  dispatchEvent(event: GameEvent): void {
    // Add timestamp if not provided
    if (!event.timestamp) {
      event.timestamp = Date.now();
    }
    
    // Get listeners for this event type
    const typeListeners = this.listeners.get(event.type);
    if (typeListeners) {
      // Call all listeners
      typeListeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error(`Error in event listener for ${event.type}:`, error);
        }
      });
    }
    
    // Debug log
    console.log(`Event dispatched: ${event.type}`, event);
  }
  
  // Clear all listeners
  clear(): void {
    this.listeners.clear();
  }
}

// Create singleton instance
export const gameEvents = new GameEventSystem();

export default gameEvents; 