import React, { useState } from 'react';
import BaseScene from './components/scene/BaseScene';
import TestMap from './components/scene/TestMap';
import MainMenu, { MapType } from './components/MainMenu';
import GameUI from './components/GameUI';
import { LogProvider } from './utils/LogStore';
import './App.css';

const App: React.FC = () => {
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [currentMap, setCurrentMap] = useState<MapType>('main');

  const handleStartGame = (mapType: MapType) => {
    setCurrentMap(mapType);
    setIsGameStarted(true);
  };

  const handleReturnToMenu = () => {
    setIsGameStarted(false);
  };

  const renderMap = () => {
    switch (currentMap) {
      case 'main':
        return <BaseScene />;
      case 'test':
        return <TestMap />;
      default:
        return <BaseScene />;
    }
  };

  return (
    <LogProvider>
      <div className="app">
        {isGameStarted ? (
          <>
            {renderMap()}
            <GameUI onReturnToMenu={handleReturnToMenu} />
          </>
        ) : (
          <MainMenu onStartGame={handleStartGame} />
        )}
      </div>
    </LogProvider>
  );
};

export default App;
