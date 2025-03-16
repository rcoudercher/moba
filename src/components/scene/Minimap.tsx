import React, { useEffect, useRef } from 'react';

interface MinimapProps {
  playerPosition: { x: number, z: number };
  mapSize: number;
  lanes: THREE.Object3D[];
}

const Minimap: React.FC<MinimapProps> = ({ playerPosition, mapSize, lanes }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const minimapSize = 150;
    canvas.width = minimapSize;
    canvas.height = minimapSize;
    
    // Function to convert world coordinates to minimap coordinates
    const worldToMinimap = (x: number, z: number) => {
      // Map from world space (-mapSize/2 to mapSize/2) to canvas space (0 to minimapSize)
      const canvasX = ((x + mapSize/2) / mapSize) * minimapSize;
      const canvasY = ((z + mapSize/2) / mapSize) * minimapSize;
      return { x: canvasX, y: canvasY };
    };
    
    // Draw function
    const draw = () => {
      // Clear canvas
      ctx.fillStyle = '#1a472a'; // Dark green background
      ctx.fillRect(0, 0, minimapSize, minimapSize);
      
      // Draw lanes
      ctx.fillStyle = '#808080'; // Gray color for lanes
      
      // Mid lane (diagonal)
      ctx.save();
      ctx.translate(minimapSize/2, minimapSize/2);
      ctx.rotate(Math.PI / 4); // 45 degrees
      ctx.fillRect(-6, -minimapSize/1.4, 12, minimapSize * 1.4);
      ctx.restore();
      
      // Top lane (two segments)
      // Vertical part
      const topStart = worldToMinimap(-mapSize/2, mapSize/2);
      const topCorner = worldToMinimap(-mapSize/2, -mapSize/2);
      ctx.fillRect(topStart.x - 6, topStart.y, 12, topCorner.y - topStart.y);
      
      // Horizontal part
      const topEnd = worldToMinimap(mapSize/2, -mapSize/2);
      ctx.fillRect(topCorner.x, topCorner.y - 6, topEnd.x - topCorner.x, 12);
      
      // Bottom lane (two segments)
      // Horizontal part
      const botStart = worldToMinimap(-mapSize/2, mapSize/2);
      const botCorner = worldToMinimap(mapSize/2, mapSize/2);
      ctx.fillRect(botStart.x, botStart.y - 6, botCorner.x - botStart.x, 12);
      
      // Vertical part
      const botEnd = worldToMinimap(mapSize/2, -mapSize/2);
      ctx.fillRect(botCorner.x - 6, botCorner.y, 12, botEnd.y - botCorner.y);
      
      // Draw bases
      // Ally base (blue)
      const allyBasePos = worldToMinimap(-mapSize/2, mapSize/2);
      ctx.fillStyle = '#0000ff';
      ctx.beginPath();
      ctx.arc(allyBasePos.x, allyBasePos.y, 8, 0, Math.PI * 2);
      ctx.fill();
      
      // Enemy base (red)
      const enemyBasePos = worldToMinimap(mapSize/2, -mapSize/2);
      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      ctx.arc(enemyBasePos.x, enemyBasePos.y, 8, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw map boundary
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, minimapSize, minimapSize);
      
      // Draw player marker
      const playerPos = worldToMinimap(playerPosition.x, playerPosition.z);
      ctx.fillStyle = '#00ff00';
      ctx.beginPath();
      ctx.arc(playerPos.x, playerPos.y, 3, 0, Math.PI * 2);
      ctx.fill();
    };
    
    // Initial draw
    draw();
    
    // Set up animation frame
    let animationFrameId: number;
    
    const animate = () => {
      draw();
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animate();
    
    // Cleanup
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [playerPosition.x, playerPosition.z, mapSize]);
  
  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        border: '2px solid #666',
        borderRadius: '5px',
        width: '150px',
        height: '150px'
      }}
    />
  );
};

export default Minimap; 