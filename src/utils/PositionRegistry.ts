import * as THREE from 'three';

// Entity types
export type EntityType = 'player' | 'tower' | 'minion';
export type TeamType = 'red' | 'blue';

// Entity data interface
export interface EntityData {
  position: THREE.Vector3;
  team: TeamType;
  type: EntityType;
  health?: number;
  maxHealth?: number;
  isAlive: boolean;
}

// Position Registry class
class PositionRegistry {
  private entities: Map<string, EntityData>;

  constructor() {
    this.entities = new Map();
  }

  // Register a new entity
  register(id: string, data: EntityData): void {
    this.entities.set(id, {
      ...data,
      position: data.position.clone(), // Clone to avoid reference issues
    });
  }

  // Update an entity's position
  updatePosition(id: string, position: THREE.Vector3): void {
    const entity = this.entities.get(id);
    if (entity) {
      entity.position.copy(position);
    }
  }

  // Update entity metadata (health, team, etc.)
  updateMetadata(id: string, metadata: Partial<EntityData>): void {
    const entity = this.entities.get(id);
    if (entity) {
      Object.assign(entity, metadata);
    }
  }

  // Remove an entity
  remove(id: string): void {
    this.entities.delete(id);
  }

  // Get all entities in range of a position
  getEntitiesInRange(
    position: THREE.Vector3,
    range: number,
    team?: TeamType
  ): Array<[string, EntityData]> {
    return Array.from(this.entities.entries())
      .filter(([id, entity]) => {
        // Skip entities that aren't alive
        if (!entity.isAlive) return false;
        
        // Skip entities on the same team if team is specified
        if (team && entity.team === team) return false;
        
        // Check if in range
        const distance = position.distanceTo(entity.position);
        return distance <= range;
      })
      .sort(([idA, a], [idB, b]) => {
        // Sort by type (players first)
        if (a.type !== b.type) {
          return a.type === 'player' ? -1 : b.type === 'player' ? 1 : 0;
        }
        
        // Then by health (if available)
        if (a.health !== undefined && b.health !== undefined) {
          return a.health - b.health;
        }
        
        return 0;
      });
  }

  // Get a specific entity
  getEntity(id: string): EntityData | undefined {
    return this.entities.get(id);
  }

  // Get all entities
  getAllEntities(): Map<string, EntityData> {
    return this.entities;
  }

  // Debug: log all entities
  debugLog(): void {
    console.log('Position Registry Contents:');
    this.entities.forEach((data, id) => {
      console.log(`${id}: ${data.type} (${data.team}) at ${data.position.x.toFixed(2)}, ${data.position.z.toFixed(2)}`);
    });
  }
}

// Create a singleton instance
export const positionRegistry = new PositionRegistry();

export default positionRegistry; 