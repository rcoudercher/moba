import React from 'react';
import { useLogStore } from '../../utils/LogStore';

interface LogDisplayProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'left';
  maxHeight?: string;
  width?: string;
  title?: string;
}

const LogDisplay: React.FC<LogDisplayProps> = ({
  position = 'left',
  maxHeight = '400px',
  width = '300px',
  title = 'Game Logs'
}) => {
  const { state, clearLogs } = useLogStore();
  const { logs } = state;

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
        return '#3498db';
      case 'warning':
        return '#f39c12';
      case 'error':
        return '#e74c3c';
      case 'success':
        return '#2ecc71';
      default:
        return '#3498db';
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
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        margin: '0 0 10px 0', 
        borderBottom: '1px solid #555', 
        paddingBottom: '5px',
        order: isBottomPosition ? '1' : '0'
      }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <button 
          onClick={clearLogs}
          style={{
            background: 'rgba(255, 255, 255, 0.2)',
            border: 'none',
            color: 'white',
            padding: '3px 8px',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Clear
        </button>
      </div>
      
      <div style={{ 
        order: isBottomPosition ? '0' : '1',
        display: 'flex',
        flexDirection: 'column',
        flexGrow: 1
      }}>
        {logs.length === 0 ? (
          <div style={{ color: '#888', fontStyle: 'italic' }}>No logs yet...</div>
        ) : (
          <div style={{ 
            display: 'flex',
            flexDirection: isBottomPosition ? 'column-reverse' : 'column'
          }}>
            {logs.map((log, index) => (
              <div key={index} style={{ 
                marginBottom: '5px', 
                padding: '5px', 
                borderBottom: '1px solid #333',
                fontSize: '12px',
                borderLeft: `3px solid ${getLogTypeColor(log.type)}`,
                paddingLeft: '8px'
              }}>
                <div style={{ color: '#aaa', fontSize: '10px' }}>
                  {log.timestamp.toLocaleTimeString()}
                </div>
                <div>{log.message}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LogDisplay; 