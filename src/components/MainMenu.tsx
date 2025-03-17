import React from 'react';
import '../styles/MainMenu.css';

export type MapType = 'main' | 'test';

interface MainMenuProps {
  onStartGame: (mapType: MapType) => void;
}

const MainMenu: React.FC<MainMenuProps> = ({ onStartGame }) => {
  return (
    <div className="main-menu">
      <div className="menu-content">
        <h1 className="game-title">League of Legends</h1>
        <div className="menu-buttons">
          <button 
            className="menu-button" 
            onClick={() => onStartGame('main')}
          >
            Start Main Game
          </button>
          <button 
            className="menu-button" 
            onClick={() => onStartGame('test')}
          >
            Test Map (Tower + Player)
          </button>
        </div>
      </div>
    </div>
  );
};

export default MainMenu; 