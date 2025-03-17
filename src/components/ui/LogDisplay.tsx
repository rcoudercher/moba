import React from 'react';
import { useLogStore } from '../../utils/LogStore';

interface LogDisplayProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'left';
  maxHeight?: string;
  width?: string;
  maxLogs?: number;
}

const LogDisplay: React.FC<LogDisplayProps> = ({
  position = 'left',
  maxHeight = '400px',
  width = '300px',
  maxLogs = 5
}) => {
  const { state } = useLogStore();
  const { logs } = state;

  // Get the latest logs, limited by maxLogs
  const latestLogs = [...logs]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, maxLogs);

  // Position styles
  const getPositionStyle = () => {
    switch (position) {
      case 'top-left':
        return { top: '20px', left: '20px' };
      case 'top-right':
        return { top: '20px', right: '20px' };
      case 'bottom-left':
        return { bottom: '20px', left: '20px' };
      case 'bottom-right':
        return { bottom: '20px', right: '20px' };
      case 'left':
        return { top: '200px', left: '20px' };
      default:
        return { top: '200px', left: '20px' };
    }
  };

  // Get color for log type
  const getLogTypeColor = (type?: 'info' | 'warning' | 'error' | 'success') => {
    switch (type) {
      case 'info':
        return 'white';
      case 'warning':
        return 'orange';
      case 'error':
        return 'red';
      case 'success':
        return 'white';
      default:
        return 'white';
    }
  };

  // Determine if logs should display in reverse order (for bottom positions)
  const isBottomPosition = position.startsWith('bottom');

  return (
    <div style={{
      position: 'absolute',
      ...getPositionStyle(),
      zIndex: 100,
      background: 'rgba(0, 0, 0, 0.7)',
      padding: '15px',
      borderRadius: '5px',
      color: 'white',
      width,
      maxHeight,
      overflowY: 'auto'
    }}>
      {latestLogs.length === 0 ? (
        <div style={{ color: '#888', fontStyle: 'italic' }}>No logs yet...</div>
      ) : (
        <div style={{ 
          display: 'flex',
          flexDirection: 'column'
        }}>
          {latestLogs.map((log, index) => (
            <div 
              key={index} 
              style={{ 
                marginBottom: '3px',
                fontSize: '12px',
                color: getLogTypeColor(log.type)
              }}
            >
              [{log.timestamp.toLocaleTimeString()}] {log.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LogDisplay; 