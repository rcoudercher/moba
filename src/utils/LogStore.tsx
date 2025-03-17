import React, { createContext, useContext, useReducer, ReactNode } from 'react';

// Define log entry type
export interface LogEntry {
  message: string;
  timestamp: Date;
  type?: 'info' | 'warning' | 'error' | 'success';
}

// Define log store state
interface LogState {
  logs: LogEntry[];
}

// Define log store actions
type LogAction = 
  | { type: 'ADD_LOG'; payload: LogEntry }
  | { type: 'CLEAR_LOGS' };

// Create initial state
const initialState: LogState = {
  logs: []
};

// Create reducer function
const logReducer = (state: LogState, action: LogAction): LogState => {
  switch (action.type) {
    case 'ADD_LOG':
      return {
        ...state,
        logs: [action.payload, ...state.logs.slice(0, 19)] // Keep only 20 most recent logs
      };
    case 'CLEAR_LOGS':
      return {
        ...state,
        logs: []
      };
    default:
      return state;
  }
};

// Create context
const LogContext = createContext<{
  state: LogState;
  addLog: (message: string, type?: 'info' | 'warning' | 'error' | 'success') => void;
  clearLogs: () => void;
} | undefined>(undefined);

// Create provider component
export const LogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(logReducer, initialState);

  // Add log function
  const addLog = (message: string, type: 'info' | 'warning' | 'error' | 'success' = 'info') => {
    dispatch({
      type: 'ADD_LOG',
      payload: {
        message,
        timestamp: new Date(),
        type
      }
    });
  };

  // Clear logs function
  const clearLogs = () => {
    dispatch({ type: 'CLEAR_LOGS' });
  };

  return (
    <LogContext.Provider value={{ state, addLog, clearLogs }}>
      {children}
    </LogContext.Provider>
  );
};

// Create custom hook for using the log store
export const useLogStore = () => {
  const context = useContext(LogContext);
  if (context === undefined) {
    throw new Error('useLogStore must be used within a LogProvider');
  }
  return context;
};

// Export a global method for adding logs from anywhere (useful for non-React code)
export const setupGlobalLogger = () => {
  let addLogFunction: ((message: string, type?: 'info' | 'warning' | 'error' | 'success') => void) | null = null;
  
  return {
    setAddLogFunction: (fn: (message: string, type?: 'info' | 'warning' | 'error' | 'success') => void) => {
      addLogFunction = fn;
    },
    log: (message: string, type: 'info' | 'warning' | 'error' | 'success' = 'info') => {
      if (addLogFunction) {
        addLogFunction(message, type);
      } else {
        console.warn('Global logger not initialized yet');
      }
    }
  };
};

export const globalLogger = setupGlobalLogger();

 