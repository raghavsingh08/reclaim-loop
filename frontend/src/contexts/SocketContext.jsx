import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const { isAuthenticated } = useAuth();
  
  useEffect(() => {
    let newSocket;
    
    if (isAuthenticated) {
      const socketUrl = import.meta.env.VITE_API_BASE_URL 
        ? import.meta.env.VITE_API_BASE_URL.replace('/api', '') 
        : 'http://localhost:5000';
        
      const token = localStorage.getItem('token');
      newSocket = io(socketUrl, {
        autoConnect: true,
        auth: { token },
      });

      newSocket.on('connect', () => {
      });

      newSocket.on('disconnect', () => {
      });

      setSocket(newSocket);
    }

    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [isAuthenticated]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
