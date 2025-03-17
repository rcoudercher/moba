import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import Minimap from './Minimap';
import Player from './Player';

// Import environment components
import { createSky } from './environment/Sky';
import createTower, { Tower } from './Tower';
import { createBase, createHealthBar } from '../../utils';
import { MinionSpawner, MinionType } from './mobile';
import { GameObjectWithHealth } from '../../types/gameObjects';

export default function BaseScene() {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const [isControlsEnabled, setIsControlsEnabled] = useState(true);
  const [fps, setFps] = useState<number>(0);
  const [playerPos, setPlayerPos] = useState({ x: 0, z: 0 });
  const [baseCoordinates, setBaseCoordinates] = useState({
    ally: { x: 0, y: 0 },
    enemy: { x: 0, y: 0 }
  });

  const [gameState, setGameState] = useState({
    allyBaseHealth: 1000,
    enemyBaseHealth: 1000,
    gameOver: false,
    winner: null as 'ally' | 'enemy' | null
  });
  const [minions, setMinions] = useState<MinionType[]>([]);
  
  // Add player health state
  const [playerHealth, setPlayerHealth] = useState({
    current: 100,
    max: 100,
    respawnTimer: undefined as number | undefined
  });
  
  // Add monument health state
  const [monumentHealth, setMonumentHealth] = useState({
    ally: { current: 500, max: 500 },
    enemy: { current: 500, max: 500 }
  });
  
  // Reference to store the bases for resetting
  const basesRef = useRef<{
    allyBase?: THREE.Group & GameObjectWithHealth,
    enemyBase?: THREE.Group & GameObjectWithHealth
  }>({});
  
  // Reference to store the towers
  const towersRef = useRef<{
    allyTower1?: Tower,
    allyTower2?: Tower,
    enemyTower1?: Tower,
    enemyTower2?: Tower
  }>({});
  
  // Function to reset the game
  const resetGame = useCallback(() => {
    // Reset game state
    setGameState({
      allyBaseHealth: 1000,
      enemyBaseHealth: 1000,
      gameOver: false,
      winner: null
    });
    
    // Reset bases if they exist
    if (basesRef.current.allyBase) {
      basesRef.current.allyBase.health = 1000;
      basesRef.current.allyBase.isDestroyed = false;
      basesRef.current.allyBase.updateHealthBar();
      
      // Find and restore crystal and objective
      basesRef.current.allyBase.children.forEach(child => {
        // Restore crystal
        if (child.type === 'Mesh' && (child as THREE.Mesh).geometry.type === 'OctahedronGeometry') {
          child.visible = true;
        }
        // Restore objective
        if (child.type === 'Mesh' && 
            (child as THREE.Mesh).geometry.type === 'CylinderGeometry' && 
            child.position.y > 5) {
          const objective = child as THREE.Mesh;
          const material = objective.material as THREE.MeshStandardMaterial;
          material.color.set(0x0000ff);
          material.emissive.set(0x000033);
          objective.scale.y = 1;
          objective.position.y = 7;
        }
        // Restore light
        if (child.type === 'PointLight') {
          child.visible = true;
        }
      });
    }
    
    if (basesRef.current.enemyBase) {
      basesRef.current.enemyBase.health = 1000;
      basesRef.current.enemyBase.isDestroyed = false;
      basesRef.current.enemyBase.updateHealthBar();
      
      // Find and restore crystal and objective
      basesRef.current.enemyBase.children.forEach(child => {
        // Restore crystal
        if (child.type === 'Mesh' && (child as THREE.Mesh).geometry.type === 'OctahedronGeometry') {
          child.visible = true;
        }
        // Restore objective
        if (child.type === 'Mesh' && 
            (child as THREE.Mesh).geometry.type === 'CylinderGeometry' && 
            child.position.y > 5) {
          const objective = child as THREE.Mesh;
          const material = objective.material as THREE.MeshStandardMaterial;
          material.color.set(0xff0000);
          material.emissive.set(0x330000);
          objective.scale.y = 1;
          objective.position.y = 7;
        }
        // Restore light
        if (child.type === 'PointLight') {
          child.visible = true;
        }
      });
    }
  }, []);
  
  // Define MAP_SIZE as a constant outside the useEffect
  const GAME_MAP_SIZE = 200; // Total size of the game map
  const PLAYABLE_AREA = 175; // Size of the playable area
  const LANE_SQUARE_SIZE = 145; // Size of the square formed by the lanes
  
  useEffect(() => {
    if (!mountRef.current) return;
    
    // Create scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    
    // Create sky and sun
    const { sky, sun } = createSky(scene);
    
    // Camera setup
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    const cameraOffset = new THREE.Vector3(0, 30, 30); // Higher and further back
    camera.position.copy(cameraOffset);
    camera.lookAt(new THREE.Vector3(0, 0, 0));
    camera.rotation.x = -Math.PI / 3; // Steeper angle for better map view
    cameraRef.current = camera;
    
    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    
    mountRef.current?.appendChild(renderer.domElement);
    
    // Initial player position - near ally base
    const initialPlayerPosition = new THREE.Vector3(-LANE_SQUARE_SIZE/2 + 5, 0, LANE_SQUARE_SIZE/2 - 5);
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    
    // Main directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffcc, 1.2);
    directionalLight.position.copy(sun.position).normalize();
    directionalLight.castShadow = true;
    
    // Optimize shadow map
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 100;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    directionalLight.shadow.bias = -0.001;
    
    scene.add(directionalLight);
    
    // Create ground plane with simple color
    const groundGeometry = new THREE.PlaneGeometry(GAME_MAP_SIZE, GAME_MAP_SIZE);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x1a472a,
      roughness: 0.8,
      metalness: 0.0
    });
    
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    
    // Create map structure
    const mapStructure = new THREE.Group();
    
    // Calculate the intersection points of the diagonals with the lane square
    // For ally base (bottom-left intersection)
    const allyBasePos = new THREE.Vector3(-LANE_SQUARE_SIZE/2, 0, LANE_SQUARE_SIZE/2);
    
    // For enemy base (top-right intersection)
    const enemyBasePos = new THREE.Vector3(LANE_SQUARE_SIZE/2, 0, -LANE_SQUARE_SIZE/2);
    
    // Create bases - position them at the intersections of the diagonals with the lane square
    const allyBase = createBase(allyBasePos, false); // Bottom left
    const enemyBase = createBase(enemyBasePos, true); // Top right
    mapStructure.add(allyBase, enemyBase);
    
    // Store references to bases for resetting
    basesRef.current.allyBase = allyBase;
    basesRef.current.enemyBase = enemyBase;
    
    // Set base coordinates for debug display
    setBaseCoordinates({
      ally: { 
        x: allyBasePos.x, 
        y: allyBasePos.z // Bottom left in 2D coordinates
      },
      enemy: { 
        x: enemyBasePos.x, 
        y: enemyBasePos.z // Top right in 2D coordinates
      }
    });
    
    // Create towers for both teams
    // Calculate positions for ally towers (in the middle lane)
    const allyTowerDistance = 25; // Distance from base along the middle lane
    const allyBaseToEnemyBase = new THREE.Vector3().subVectors(enemyBasePos, allyBasePos).normalize();
    const allyTower1Pos = new THREE.Vector3(
      allyBasePos.x + allyBaseToEnemyBase.x * allyTowerDistance,
      0,
      allyBasePos.z + allyBaseToEnemyBase.z * allyTowerDistance
    );
    const allyTower2Pos = new THREE.Vector3(
      allyBasePos.x + allyBaseToEnemyBase.x * (allyTowerDistance * 1.7),
      0,
      allyBasePos.z + allyBaseToEnemyBase.z * (allyTowerDistance * 1.7)
    );
    
    // Calculate positions for enemy towers (in the middle lane)
    const enemyTowerDistance = 25; // Distance from base along the middle lane
    const enemyBaseToAllyBase = new THREE.Vector3().subVectors(allyBasePos, enemyBasePos).normalize();
    const enemyTower1Pos = new THREE.Vector3(
      enemyBasePos.x + enemyBaseToAllyBase.x * enemyTowerDistance,
      0,
      enemyBasePos.z + enemyBaseToAllyBase.z * enemyTowerDistance
    );
    const enemyTower2Pos = new THREE.Vector3(
      enemyBasePos.x + enemyBaseToAllyBase.x * (enemyTowerDistance * 1.7),
      0,
      enemyBasePos.z + enemyBaseToAllyBase.z * (enemyTowerDistance * 1.7)
    );
    
    // Create the towers
    const allyTower1 = createTower(allyTower1Pos, false, 300);
    const allyTower2 = createTower(allyTower2Pos, false, 300);
    const enemyTower1 = createTower(enemyTower1Pos, true, 300);
    const enemyTower2 = createTower(enemyTower2Pos, true, 300);
    
    // Add towers to the scene
    mapStructure.add(allyTower1, allyTower2, enemyTower1, enemyTower2);
    
    // Store references to towers
    towersRef.current = {
      allyTower1,
      allyTower2,
      enemyTower1,
      enemyTower2
    };
    
    // Add map boundary outline (showing the playable area)
    const boundaryGeometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      // Draw a square using lines
      -PLAYABLE_AREA/2, 0, -PLAYABLE_AREA/2,  // Start at top-left
      PLAYABLE_AREA/2, 0, -PLAYABLE_AREA/2,   // Top line
      PLAYABLE_AREA/2, 0, -PLAYABLE_AREA/2,   // Start at top-right
      PLAYABLE_AREA/2, 0, PLAYABLE_AREA/2,    // Right line
      PLAYABLE_AREA/2, 0, PLAYABLE_AREA/2,    // Start at bottom-right
      -PLAYABLE_AREA/2, 0, PLAYABLE_AREA/2,   // Bottom line
      -PLAYABLE_AREA/2, 0, PLAYABLE_AREA/2,   // Start at bottom-left
      -PLAYABLE_AREA/2, 0, -PLAYABLE_AREA/2   // Left line
    ]);
    boundaryGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    const boundaryMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
    const boundaryLines = new THREE.LineSegments(boundaryGeometry, boundaryMaterial);
    boundaryLines.position.y = 0.2; // Slightly above ground to be visible
    scene.add(boundaryLines);
    
    // Add lane square outline
    const laneSquareGeometry = new THREE.BufferGeometry();
    const laneSquareVertices = new Float32Array([
      // Draw a square using lines
      -LANE_SQUARE_SIZE/2, 0, -LANE_SQUARE_SIZE/2,  // Start at top-left
      LANE_SQUARE_SIZE/2, 0, -LANE_SQUARE_SIZE/2,   // Top line
      LANE_SQUARE_SIZE/2, 0, -LANE_SQUARE_SIZE/2,   // Start at top-right
      LANE_SQUARE_SIZE/2, 0, LANE_SQUARE_SIZE/2,    // Right line
      LANE_SQUARE_SIZE/2, 0, LANE_SQUARE_SIZE/2,    // Start at bottom-right
      -LANE_SQUARE_SIZE/2, 0, LANE_SQUARE_SIZE/2,   // Bottom line
      -LANE_SQUARE_SIZE/2, 0, LANE_SQUARE_SIZE/2,   // Start at bottom-left
      -LANE_SQUARE_SIZE/2, 0, -LANE_SQUARE_SIZE/2   // Left line
    ]);
    laneSquareGeometry.setAttribute('position', new THREE.Float32BufferAttribute(laneSquareVertices, 3));
    const laneSquareMaterial = new THREE.LineDashedMaterial({ 
      color: 0xff0000, 
      linewidth: 2,
      dashSize: 3,
      gapSize: 2
    });
    const laneSquareLines = new THREE.LineSegments(laneSquareGeometry, laneSquareMaterial);
    laneSquareLines.position.y = 0.25; // Same height as the diagonal red lines
    
    // Compute line distances for dashed lines
    laneSquareLines.computeLineDistances();
    
    scene.add(laneSquareLines);
    
    // Add cross lines across the map
    const crossLinesGeometry = new THREE.BufferGeometry();
    const crossVertices = new Float32Array([
      // First diagonal line (bottom-left to top-right) - extended to map corners
      -PLAYABLE_AREA/2, 0, PLAYABLE_AREA/2,  // Start at bottom-left map corner
      PLAYABLE_AREA/2, 0, -PLAYABLE_AREA/2,  // End at top-right map corner
      
      // Second diagonal line (top-left to bottom-right) - extended to map corners
      -PLAYABLE_AREA/2, 0, -PLAYABLE_AREA/2,  // Start at top-left map corner
      PLAYABLE_AREA/2, 0, PLAYABLE_AREA/2,    // End at bottom-right map corner
    ]);
    crossLinesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(crossVertices, 3));
    const crossLinesMaterial = new THREE.LineDashedMaterial({ 
      color: 0xff0000, 
      linewidth: 2,
      dashSize: 3,
      gapSize: 2
    });
    const crossLines = new THREE.LineSegments(crossLinesGeometry, crossLinesMaterial);
    crossLines.position.y = 0.25; // Slightly above other lines to be visible
    
    // Compute line distances for dashed lines
    crossLines.computeLineDistances();
    
    scene.add(crossLines); // Add the diagonal lines
    
    // Add map to scene
    scene.add(mapStructure);
    
    // Define lane paths for minion spawning
    const lanes = [
      {
        name: 'top',
        allySpawn: new THREE.Vector3(-LANE_SQUARE_SIZE/2 + 15, 0, -LANE_SQUARE_SIZE/2 + 15), // Further from base
        enemySpawn: new THREE.Vector3(LANE_SQUARE_SIZE/2 - 15, 0, -LANE_SQUARE_SIZE/2 + 15) // Further from base
      },
      {
        name: 'mid',
        allySpawn: new THREE.Vector3(-LANE_SQUARE_SIZE/2 + 15, 0, LANE_SQUARE_SIZE/2 - 15), // Further from base
        enemySpawn: new THREE.Vector3(LANE_SQUARE_SIZE/2 - 15, 0, -LANE_SQUARE_SIZE/2 + 15) // Further from base
      },
      {
        name: 'bottom',
        allySpawn: new THREE.Vector3(-LANE_SQUARE_SIZE/2 + 15, 0, LANE_SQUARE_SIZE/2 - 15), // Further from base
        enemySpawn: new THREE.Vector3(LANE_SQUARE_SIZE/2 - 15, 0, LANE_SQUARE_SIZE/2 - 15) // Further from base
      }
    ];
    
    // Add health to the central monument in each base
    const addHealthToMonument = (base: THREE.Group & GameObjectWithHealth) => {
      // Add health properties to the central monument
      if (base.userData.objective) {
        const monument = base.userData.objective;
        
        // Set health properties
        monument.userData.health = 2000;
        monument.userData.maxHealth = 2000;
        monument.userData.isDestroyed = false;
        monument.userData.attackCooldown = 0;
        monument.userData.attackRange = 20; // Range for monument attacks
        monument.userData.damage = 15;
        monument.userData.team = base === basesRef.current.allyBase ? 'ally' : 'enemy';
        
        // Create a health bar for the monument
        const healthBarWidth = 5;
        const healthBarHeight = 0.5;
        const healthBarYOffset = 12; // Position above the monument
        
        monument.userData.healthBar = createHealthBar(
          healthBarWidth, 
          healthBarHeight, 
          monument.position, 
          healthBarYOffset
        );
        monument.add(monument.userData.healthBar);
        
        // Add method to update health bar
        monument.userData.updateHealthBar = () => {
          if (!monument.userData.healthBar) return;
          
          const healthPercent = monument.userData.health / monument.userData.maxHealth;
          
          // Get canvas context
          const context = monument.userData.healthBar.userData.context as CanvasRenderingContext2D;
          const canvas = monument.userData.healthBar.userData.canvas as HTMLCanvasElement;
          const texture = monument.userData.healthBar.userData.texture as THREE.CanvasTexture;
          
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
        
        // Add method to take damage
        monument.userData.takeDamage = (amount: number) => {
          if (monument.userData.health <= 0 || monument.userData.isDestroyed) return;
          
          monument.userData.health -= amount;
          
          // Update state for UI
          setMonumentHealth(prev => ({
            ...prev,
            [monument.userData.team]: {
              current: monument.userData.health,
              max: monument.userData.maxHealth
            }
          }));
          
          if (monument.userData.health <= 0) {
            monument.userData.health = 0;
            monument.userData.isDestroyed = true;
            
            // Handle monument destruction
            const material = (monument as THREE.Mesh).material as THREE.MeshStandardMaterial;
            material.color.set(0x555555);
            material.emissive.set(0x000000);
            
            // Update game state
            setGameState(prev => ({
              ...prev,
              gameOver: true,
              winner: monument.userData.team === 'ally' ? 'enemy' : 'ally'
            }));
          }
          
          monument.userData.updateHealthBar();
        };
        
        // Initialize health bar
        monument.userData.updateHealthBar();
      }
    };
    
    // Handle window resize
    const onWindowResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onWindowResize);
    
    // Animation loop
    let frameCount = 0;
    let prevTime = performance.now();
    
    const animate = () => {
      // Update minions
      // ... existing minion update code ...
      
      // Update towers
      // ... existing tower update code ...
      
      // Update FPS counter
      const now = performance.now();
      const delta = now - prevTime;
      prevTime = now;
      
      // Update FPS every 10 frames
      if (frameCount % 10 === 0) {
        setFps(Math.round(1000 / delta));
      }
      frameCount++;
      
      // Render scene
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    
    animate();
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', onWindowResize);
      
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);
  
  // Handle player position change
  const handlePlayerPositionChange = (position: THREE.Vector3) => {
    setPlayerPos({ x: position.x, z: position.z });
  };
  
  // Handle player health change
  const handlePlayerHealthChange = (health: number, maxHealth: number) => {
    setPlayerHealth({
      current: health,
      max: maxHealth,
      respawnTimer: health <= 0 ? 5 : undefined
    });
  };
  
  // Handle player death
  const handlePlayerDeath = () => {
    // Start respawn timer
    let timer = 5;
    const interval = setInterval(() => {
      timer--;
      setPlayerHealth(prev => ({
        ...prev,
        respawnTimer: timer
      }));
      
      if (timer <= 0) {
        clearInterval(interval);
      }
    }, 1000);
  };

  return (
    <div ref={mountRef} className="scene-container">
      {!isControlsEnabled && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: 'white',
          fontSize: '24px',
          textAlign: 'center',
          userSelect: 'none',
          cursor: 'pointer'
        }}>
          Click to start
        </div>
      )}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '5px'
      }}>
        <div style={{
          color: '#F7FF00',
          fontSize: '16px',
          fontFamily: 'monospace',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          padding: '8px 12px',
          borderRadius: '8px',
          textShadow: '1px 1px 1px rgba(0,0,0,0.5)'
        }}>
          FPS: {fps}
        </div>
      </div>
      
      {/* Debug block for base coordinates */}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        right: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '5px'
      }}>
        <div style={{
          color: '#F7FF00',
          fontSize: '16px',
          fontFamily: 'monospace',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          padding: '8px 12px',
          borderRadius: '8px',
          textShadow: '1px 1px 1px rgba(0,0,0,0.5)'
        }}>
          Player: X: {Math.round(playerPos.x)} Y: {Math.round(-playerPos.z)}
        </div>
        <div style={{
          color: '#F7FF00',
          fontSize: '16px',
          fontFamily: 'monospace',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          padding: '8px 12px',
          borderRadius: '8px',
          textShadow: '1px 1px 1px rgba(0,0,0,0.5)'
        }}>
          Ally Base: X: {Math.round(baseCoordinates.ally.x)} Y: {Math.round(baseCoordinates.ally.y)}
        </div>
        <div style={{
          color: '#F7FF00',
          fontSize: '16px',
          fontFamily: 'monospace',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          padding: '8px 12px',
          borderRadius: '8px',
          textShadow: '1px 1px 1px rgba(0,0,0,0.5)'
        }}>
          Enemy Base: X: {Math.round(baseCoordinates.enemy.x)} Y: {Math.round(baseCoordinates.enemy.y)}
        </div>
        <div style={{
          color: '#F7FF00',
          fontSize: '16px',
          fontFamily: 'monospace',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          padding: '8px 12px',
          borderRadius: '8px',
          textShadow: '1px 1px 1px rgba(0,0,0,0.5)'
        }}>
          Lane Square: {LANE_SQUARE_SIZE}x{LANE_SQUARE_SIZE}
        </div>
        <div style={{
          color: '#F7FF00',
          fontSize: '16px',
          fontFamily: 'monospace',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          padding: '8px 12px',
          borderRadius: '8px',
          textShadow: '1px 1px 1px rgba(0,0,0,0.5)'
        }}>
          Playable Area: {PLAYABLE_AREA}x{PLAYABLE_AREA}
        </div>
      </div>
      
      {/* Game over message with restart button */}
      {gameState.gameOver && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: 'white',
          fontSize: '36px',
          fontWeight: 'bold',
          textAlign: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          padding: '20px 40px',
          borderRadius: '10px',
          textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px'
        }}>
          <div>{gameState.winner === 'ally' ? 'Victory!' : 'Defeat!'}</div>
          <button 
            onClick={resetGame}
            style={{
              backgroundColor: '#4CAF50',
              border: 'none',
              color: 'white',
              padding: '15px 32px',
              textAlign: 'center',
              textDecoration: 'none',
              display: 'inline-block',
              fontSize: '16px',
              margin: '4px 2px',
              cursor: 'pointer',
              borderRadius: '8px',
              fontWeight: 'bold',
              boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
              transition: '0.3s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#45a049';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#4CAF50';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            Restart Game
          </button>
        </div>
      )}
      
      {/* Health status display */}
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '5px'
      }}>
        <div style={{
          color: '#00ffff',
          fontSize: '16px',
          fontFamily: 'monospace',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          padding: '8px 12px',
          borderRadius: '8px',
          textShadow: '1px 1px 1px rgba(0,0,0,0.5)'
        }}>
          Ally Base: {Math.round(gameState.allyBaseHealth)} / 1000
        </div>
        <div style={{
          color: '#ff5555',
          fontSize: '16px',
          fontFamily: 'monospace',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          padding: '8px 12px',
          borderRadius: '8px',
          textShadow: '1px 1px 1px rgba(0,0,0,0.5)'
        }}>
          Enemy Base: {Math.round(gameState.enemyBaseHealth)} / 1000
        </div>
      </div>
      
      {/* Add Minimap component */}
      <Minimap 
        playerPosition={playerPos} 
        mapSize={LANE_SQUARE_SIZE} 
        lanes={[]}
      />
      
      {/* Player health bar at the bottom of the screen */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '300px',
        height: '30px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: '5px',
        padding: '3px',
        border: '1px solid #444'
      }}>
        <div style={{
          width: `${(playerHealth.current / playerHealth.max) * 100}%`,
          height: '100%',
          backgroundColor: playerHealth.current > 60 ? '#00ff00' : playerHealth.current > 30 ? '#ffff00' : '#ff0000',
          borderRadius: '3px',
          transition: 'width 0.3s ease-in-out'
        }} />
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: 'white',
          fontWeight: 'bold',
          textShadow: '1px 1px 2px black'
        }}>
          {playerHealth.respawnTimer !== undefined ? 
            `Respawning in ${playerHealth.respawnTimer}...` : 
            `${Math.ceil(playerHealth.current)} / ${playerHealth.max}`
          }
        </div>
      </div>
      
      {/* Monument health display */}
      <div style={{
        position: 'absolute',
        bottom: '60px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'row',
        gap: '20px',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        padding: '5px 10px',
        borderRadius: '5px'
      }}>
        {/* Ally Monument Health */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#00ffff', fontSize: '12px', marginBottom: '3px' }}>Ally Monument</div>
          <div style={{
            width: '120px',
            height: '15px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            borderRadius: '3px',
            padding: '2px',
            border: '1px solid #444'
          }}>
            <div style={{
              width: `${(monumentHealth.ally.current / monumentHealth.ally.max) * 100}%`,
              height: '100%',
              backgroundColor: '#00ffff',
              borderRadius: '2px',
              transition: 'width 0.3s ease-in-out'
            }} />
          </div>
        </div>
        
        {/* Enemy Monument Health */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#ff5555', fontSize: '12px', marginBottom: '3px' }}>Enemy Monument</div>
          <div style={{
            width: '120px',
            height: '15px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            borderRadius: '3px',
            padding: '2px',
            border: '1px solid #444'
          }}>
            <div style={{
              width: `${(monumentHealth.enemy.current / monumentHealth.enemy.max) * 100}%`,
              height: '100%',
              backgroundColor: '#ff5555',
              borderRadius: '2px',
              transition: 'width 0.3s ease-in-out'
            }} />
          </div>
        </div>
      </div>
      
      {/* Add MinionSpawner component */}
      {sceneRef.current && (
        <MinionSpawner
          scene={sceneRef.current}
          lanes={[
            {
              name: 'top',
              allySpawn: new THREE.Vector3(-LANE_SQUARE_SIZE/2 + 15, 0, -LANE_SQUARE_SIZE/2 + 15),
              enemySpawn: new THREE.Vector3(LANE_SQUARE_SIZE/2 - 15, 0, -LANE_SQUARE_SIZE/2 + 15)
            },
            {
              name: 'mid',
              allySpawn: new THREE.Vector3(-LANE_SQUARE_SIZE/2 + 15, 0, LANE_SQUARE_SIZE/2 - 15),
              enemySpawn: new THREE.Vector3(LANE_SQUARE_SIZE/2 - 15, 0, -LANE_SQUARE_SIZE/2 + 15)
            },
            {
              name: 'bottom',
              allySpawn: new THREE.Vector3(-LANE_SQUARE_SIZE/2 + 15, 0, LANE_SQUARE_SIZE/2 - 15),
              enemySpawn: new THREE.Vector3(LANE_SQUARE_SIZE/2 - 15, 0, LANE_SQUARE_SIZE/2 - 15)
            }
          ]}
          spawnInterval={30000}
          minionsPerWave={4}
          bases={basesRef.current}
          gameOver={gameState.gameOver}
          onMinionCountChange={(allyCount, enemyCount) => {
            // You can use this to update UI or game state based on minion counts
            console.log(`Minions: ${allyCount} allies, ${enemyCount} enemies`);
          }}
        />
      )}
      
      {/* Player component */}
      {sceneRef.current && cameraRef.current && (
        <Player
          scene={sceneRef.current}
          camera={cameraRef.current}
          initialPosition={new THREE.Vector3(-LANE_SQUARE_SIZE/2 + 5, 0, LANE_SQUARE_SIZE/2 - 5)}
          playableArea={PLAYABLE_AREA}
          team="red"
          onPositionChange={handlePlayerPositionChange}
          onHealthChange={handlePlayerHealthChange}
          onDeath={handlePlayerDeath}
          // Pass obstacles like towers, bases, etc.
        />
      )}
    </div>
  );
}