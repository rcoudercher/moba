import React, { useEffect, useRef } from 'react';

interface MinimapProps {
  playerPosition: { x: number, z: number };
  mapSize: number; // This is now the lane square size (150)
  lanes: THREE.Object3D[];
}

const Minimap: React.FC<MinimapProps> = ({ playerPosition, mapSize, lanes }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const minimapSize = 150; // Canvas size in pixels
    canvas.width = minimapSize;
    canvas.height = minimapSize;
    
    // Define the playable area size (180)
    const playableArea = 180;
    
    // Function to convert world coordinates to minimap coordinates
    const worldToMinimap = (x: number, z: number) => {
      // Map from world space (-playableArea/2 to playableArea/2) to canvas space (0 to minimapSize)
      const canvasX = ((x + playableArea/2) / playableArea) * minimapSize;
      const canvasY = ((z + playableArea/2) / playableArea) * minimapSize;
      return { x: canvasX, y: canvasY };
    };
    
    // Draw function
    const draw = () => {
      // Clear canvas
      ctx.fillStyle = '#1a472a'; // Dark green background
      ctx.fillRect(0, 0, minimapSize, minimapSize);
      
      // Draw trees in border (simplified as dots)
      ctx.fillStyle = '#2E8B57'; // Green for trees
      
      // Function to check if a position is in the border area
      const isInBorderArea = (x: number, z: number) => {
        const absX = Math.abs(x);
        const absZ = Math.abs(z);
        const laneHalf = mapSize / 2;
        const playableHalf = playableArea / 2;
        
        return (absX > laneHalf - 5 && absX < playableHalf) || 
               (absZ > laneHalf - 5 && absZ < playableHalf);
      };
      
      // Add dots representing trees in the border
      for (let i = -playableArea/2; i <= playableArea/2; i += 5) {
        for (let j = -playableArea/2; j <= playableArea/2; j += 5) {
          if (isInBorderArea(i, j) && Math.random() < 0.7) {
            const pos = worldToMinimap(i, j);
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 1, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      
      // Draw lanes
      ctx.fillStyle = '#808080'; // Gray color for lanes
      
      // Mid lane (diagonal)
      ctx.save();
      ctx.translate(minimapSize/2, minimapSize/2);
      ctx.rotate(Math.PI / 4); // 45 degrees
      const laneWidth = 6;
      const laneLength = (mapSize / playableArea) * minimapSize * 1.4;
      ctx.fillRect(-laneWidth/2, -laneLength/2, laneWidth, laneLength);
      ctx.restore();
      
      // Top lane (two segments)
      // Vertical part
      const topStart = worldToMinimap(-mapSize/2 + 5, mapSize/2);
      const topCorner = worldToMinimap(-mapSize/2 + 5, -mapSize/2 + 5);
      ctx.fillRect(topStart.x - laneWidth/2, topStart.y, laneWidth, topCorner.y - topStart.y);
      
      // Horizontal part
      const topEnd = worldToMinimap(mapSize/2, -mapSize/2 + 5);
      ctx.fillRect(topCorner.x, topCorner.y - laneWidth/2, topEnd.x - topCorner.x, laneWidth);
      
      // Bottom lane (two segments)
      // Horizontal part
      const botStart = worldToMinimap(-mapSize/2 + 5, mapSize/2 - 5);
      const botCorner = worldToMinimap(mapSize/2 - 5, mapSize/2 - 5);
      ctx.fillRect(botStart.x, botStart.y - laneWidth/2, botCorner.x - botStart.x, laneWidth);
      
      // Vertical part
      const botEnd = worldToMinimap(mapSize/2 - 5, -mapSize/2);
      ctx.fillRect(botCorner.x - laneWidth/2, botCorner.y, laneWidth, botEnd.y - botCorner.y);
      
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
      
      // Draw playable area boundary (white)
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, minimapSize, minimapSize);
      
      // Draw lane square boundary (gray)
      const laneStart = worldToMinimap(-mapSize/2, -mapSize/2);
      const laneSize = (mapSize / playableArea) * minimapSize;
      ctx.strokeStyle = '#aaaaaa';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        laneStart.x, 
        laneStart.y, 
        laneSize, 
        laneSize
      );
      
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