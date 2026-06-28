import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

// Empty string means it will connect to the host that served the page
const SOCKET_URL = ''; 

export const useSocket = (roomCode, username) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef();

  useEffect(() => {
    if (!roomCode || !username) return;

    const newSocket = io(SOCKET_URL, {
      path: '/socket.io/',
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      setConnected(true);
      newSocket.emit('join_room', { roomCode, username });
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [roomCode, username]);

  return { socket, connected };
};
