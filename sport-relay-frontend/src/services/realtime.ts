import { io, Socket } from 'socket.io-client';

export const createRealtimeSocket = (): Socket => {
  const wsUrl = import.meta.env.VITE_WS_URL ?? 'http://localhost:3000';

  return io(wsUrl, {
    autoConnect: true,
    transports: ['websocket'],
    withCredentials: true,
  });
};
