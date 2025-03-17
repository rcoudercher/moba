import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import Minion, { GameObjectWithHealth } from './Minion';

interface Lane {
  name: string;
  allySpawn: THREE.Vector3;
  enemySpawn: THREE.Vector3;
}

interface MinionSpawnerProps {
  scene: THREE.Scene;
  lanes: Lane[];
  spawnInterval?: number; // in milliseconds
  minionsPerWave?: number;
  bases?: {
    allyBase?: THREE.Group & GameObjectWithHealth;
    enemyBase?: THREE.Group & GameObjectWithHealth;
  };
  onMinionCountChange?: (allyCount: number, enemyCount: number) => void;
  gameOver?: boolean;
}

const MinionSpawner: React.FC<MinionSpawnerProps> = ({
  scene,
  lanes,
  spawnInterval = 30000, // Default: 30 seconds
  minionsPerWave = 4,
  bases,
  onMinionCountChange,
  gameOver = false
}) => {
  const [nextSpawnTime, setNextSpawnTime] = useState<number>(spawnInterval / 1000);
  const [allyMinions, setAllyMinions] = useState<number>(0);
  const [enemyMinions, setEnemyMinions] = useState<number>(0);
  const [minions, setMinions] = useState<React.ReactNode[]>([]);
  
  // Use refs to track timers so we can clear them in cleanup
  const spawnTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Function to spawn a wave of minions
  const spawnMinionWave = () => {
    if (gameOver) return;
    
    // Reset the next spawn timer
    setNextSpawnTime(spawnInterval / 1000);
    
    // Track new minions
    let newAllyMinions = 0;
    let newEnemyMinions = 0;
    const newMinions: React.ReactNode[] = [];
    
    // Spawn minions for each lane
    lanes.forEach(lane => {
      // Spawn ally minions per lane
      for (let i = 0; i < minionsPerWave; i++) {
        // Add some random offset to prevent minions from stacking
        const offsetX = (Math.random() - 0.5) * 2;
        const offsetZ = (Math.random() - 0.5) * 2;
        const spawnPos = new THREE.Vector3(
          lane.allySpawn.x + offsetX,
          0,
          lane.allySpawn.z + offsetZ
        );
        
        newAllyMinions++;
        
        // Determine if this minion should target the monument directly
        const shouldTargetMonument = Math.random() < 0.05; // 5% chance
        
        // Create the minion component
        const targetPosition = shouldTargetMonument && bases?.enemyBase 
          ? bases.enemyBase.position.clone() 
          : undefined;
        
        // Render the minion component
        const handleDestroy = () => {
          setAllyMinions(prev => Math.max(0, prev - 1));
        };
        
        // Add minion to the list
        newMinions.push(
          <Minion
            key={`ally-${lane.name}-${Date.now()}-${i}`}
            position={spawnPos}
            team="ally"
            scene={scene}
            targetPosition={targetPosition}
            bases={bases}
            onDestroy={handleDestroy}
          />
        );
      }
      
      // Spawn enemy minions per lane
      for (let i = 0; i < minionsPerWave; i++) {
        // Add some random offset to prevent minions from stacking
        const offsetX = (Math.random() - 0.5) * 2;
        const offsetZ = (Math.random() - 0.5) * 2;
        const spawnPos = new THREE.Vector3(
          lane.enemySpawn.x + offsetX,
          0,
          lane.enemySpawn.z + offsetZ
        );
        
        newEnemyMinions++;
        
        // Determine if this minion should target the monument directly
        const shouldTargetMonument = Math.random() < 0.05; // 5% chance
        
        // Create the minion component
        const targetPosition = shouldTargetMonument && bases?.allyBase 
          ? bases.allyBase.position.clone() 
          : undefined;
        
        // Render the minion component
        const handleDestroy = () => {
          setEnemyMinions(prev => Math.max(0, prev - 1));
        };
        
        // Add minion to the list
        newMinions.push(
          <Minion
            key={`enemy-${lane.name}-${Date.now()}-${i}`}
            position={spawnPos}
            team="enemy"
            scene={scene}
            targetPosition={targetPosition}
            bases={bases}
            onDestroy={handleDestroy}
          />
        );
      }
    });
    
    // Update minion counts
    setAllyMinions(prev => prev + newAllyMinions);
    setEnemyMinions(prev => prev + newEnemyMinions);
    
    // Add new minions to the state
    setMinions(prev => [...prev, ...newMinions]);
  };
  
  // Set up spawn interval
  useEffect(() => {
    // Spawn initial wave
    spawnMinionWave();
    
    // Set up recurring spawns
    spawnTimerRef.current = setInterval(spawnMinionWave, spawnInterval);
    
    // Set up timer countdown
    countdownTimerRef.current = setInterval(() => {
      setNextSpawnTime(prev => Math.max(0, prev - 1));
    }, 1000);
    
    // Cleanup function
    return () => {
      if (spawnTimerRef.current) {
        clearInterval(spawnTimerRef.current);
      }
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, [scene, lanes, spawnInterval, gameOver]);
  
  // Report minion counts when they change
  useEffect(() => {
    if (onMinionCountChange) {
      onMinionCountChange(allyMinions, enemyMinions);
    }
  }, [allyMinions, enemyMinions, onMinionCountChange]);
  
  return (
    <>
      {minions}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        color: '#F7FF00',
        fontSize: '16px',
        fontFamily: 'monospace',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        padding: '8px 12px',
        borderRadius: '8px',
        textShadow: '1px 1px 1px rgba(0,0,0,0.5)'
      }}>
        Next Spawn: {nextSpawnTime}s
      </div>
    </>
  );
};

export default MinionSpawner; 