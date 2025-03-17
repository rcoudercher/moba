import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createTower } from './Tower';
import Player, { PlayerProps } from './Player';

const TestMap: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isControlsEnabled, setIsControlsEnabled] = useState(true);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [playerTeam, setPlayerTeam] = useState<'blue' | 'red'>('blue');
  const [towerTeam, setTowerTeam] = useState<'blue' | 'red'>('red');
  const towerRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // Constants
    const MAP_SIZE = 100; // 100x100 map

    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x87ceeb);

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    cameraRef.current = camera;
    camera.position.set(0, 50, 50);
    camera.lookAt(0, 0, 0);

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2.5; // Limit camera angle

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    scene.add(directionalLight);

    // Ground (100x100)
    const groundGeometry = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x7cfc00,
      roughness: 0.8,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Add map boundary outline
    const boundaryGeometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      -MAP_SIZE/2, 0, -MAP_SIZE/2,  // Start at top-left
      MAP_SIZE/2, 0, -MAP_SIZE/2,   // Top line
      MAP_SIZE/2, 0, -MAP_SIZE/2,   // Start at top-right
      MAP_SIZE/2, 0, MAP_SIZE/2,    // Right line
      MAP_SIZE/2, 0, MAP_SIZE/2,    // Start at bottom-right
      -MAP_SIZE/2, 0, MAP_SIZE/2,   // Bottom line
      -MAP_SIZE/2, 0, MAP_SIZE/2,   // Start at bottom-left
      -MAP_SIZE/2, 0, -MAP_SIZE/2   // Left line
    ]);
    boundaryGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    const boundaryMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
    const boundaryLines = new THREE.LineSegments(boundaryGeometry, boundaryMaterial);
    boundaryLines.position.y = 0.2; // Slightly above ground to be visible
    scene.add(boundaryLines);

    // Mark scene as ready
    setSceneReady(true);

    // Handle window resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    // Add event listeners
    window.addEventListener('resize', handleResize);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      setSceneReady(false);
      window.removeEventListener('resize', handleResize);
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [isControlsEnabled]);

  // Separate effect for tower creation/update
  useEffect(() => {
    if (!sceneRef.current) return;
    
    // Remove existing tower if it exists
    if (towerRef.current) {
      sceneRef.current.remove(towerRef.current);
    }
    
    // Add a new tower with current team
    const tower = createTower(
      new THREE.Vector3(0, 0, 0),  // Center of the map
      towerTeam,  // Use the tower team state
      1000,    // health
      15       // shooting range
    );
    sceneRef.current.add(tower);
    towerRef.current = tower;
    
    return () => {
      if (towerRef.current && sceneRef.current) {
        sceneRef.current.remove(towerRef.current);
      }
    };
  }, [towerTeam]);

  // Toggle player team
  const togglePlayerTeam = () => {
    setPlayerTeam(prevTeam => prevTeam === 'blue' ? 'red' : 'blue');
  };

  // Toggle tower team
  const toggleTowerTeam = () => {
    setTowerTeam(prevTeam => prevTeam === 'blue' ? 'red' : 'blue');
  };

  return (
    <div ref={mountRef} style={{ width: '100%', height: '100%' }}>
      {/* Team toggle UI */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        background: 'rgba(0, 0, 0, 0.5)',
        padding: '15px',
        borderRadius: '5px',
        color: 'white'
      }}>
        <div>
          <div style={{ marginBottom: '5px' }}>Player Team: {playerTeam}</div>
          <button 
            onClick={togglePlayerTeam}
            style={{
              padding: '8px 16px',
              background: playerTeam === 'blue' ? '#0066ff' : '#ff3333',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Switch to {playerTeam === 'blue' ? 'Red' : 'Blue'} Team
          </button>
        </div>
        
        <div style={{ marginTop: '15px' }}>
          <div style={{ marginBottom: '5px' }}>Tower Team: {towerTeam}</div>
          <button 
            onClick={toggleTowerTeam}
            style={{
              padding: '8px 16px',
              background: towerTeam === 'blue' ? '#0066ff' : '#ff3333',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Switch to {towerTeam === 'blue' ? 'Red' : 'Blue'} Tower
          </button>
        </div>
      </div>

      {sceneReady && sceneRef.current && cameraRef.current && (
        <>
          {/* Player */}
          <Player
            scene={sceneRef.current}
            camera={cameraRef.current}
            initialPosition={new THREE.Vector3(0, 0, 30)}
            playableArea={100}
            team={playerTeam}
            onPositionChange={(position) => {
              console.log('Player moved to:', position);
            }}
            onHealthChange={(health, maxHealth) => {
              console.log('Player health:', health, '/', maxHealth);
            }}
            onDeath={() => {
              console.log('Player died');
            }}
          />
        </>
      )}
    </div>
  );
};

export default TestMap; 