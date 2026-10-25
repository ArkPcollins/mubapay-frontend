import { io } from 'socket.io-client';
import { apiBase } from './api';
import { toast } from '../components/ui/toast';

let socket = null;

/** Authenticated realtime channel (httpOnly cookie is sent automatically). Polling remains the fallback. */
export function connectSocket(qc) {
  if (socket) return socket;
  socket = io(apiBase || undefined, { path: '/socket.io', withCredentials: true, transports: ['websocket', 'polling'], reconnectionDelayMax: 30000 });
  socket.on('notification', (n) => {
    qc.invalidateQueries({ queryKey: ['notifications'] });
    if (['financial', 'security'].includes(n.category)) qc.invalidateQueries({ queryKey: ['wallet'] });
    toast({ title: n.title, body: n.body });
  });
  socket.on('message', () => qc.invalidateQueries({ queryKey: ['conversation'] }));
  socket.on('ticket:message', () => qc.invalidateQueries({ queryKey: ['ticket'] }));
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function joinRoom(room) {
  return new Promise((resolve) => {
    if (!socket) return resolve({ ok: false });
    socket.emit('join', { room }, resolve);
  });
}

export function leaveRoom(room) {
  socket?.emit('leave', { room });
}

export const getSocket = () => socket;
