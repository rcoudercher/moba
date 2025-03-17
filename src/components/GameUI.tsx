import React from 'react';
import '../styles/GameUI.css';

interface GameUIProps {
  onReturnToMenu: () => void;
}

const GameUI: React.FC<GameUIProps> = ({ onReturnToMenu }) => {
  return (
    <div className="game-ui">
      <button className="menu-button" onClick={onReturnToMenu}>
        Main Menu
      </button>
    </div>
  );
};

export default GameUI; 