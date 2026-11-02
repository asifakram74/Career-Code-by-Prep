import { io, Socket } from 'socket.io-client';

// One Socket.IO connection per signed-in tab. The server authenticates it with
// the session cookie and pushes changes the user is allowed to see:
//   query:upsert (QueryTicket), query:removed ({id}),
//   message:new (ConversationMessage), message:update ({queryId, readIds}),
//   notification:new (NotificationItem), notification:read ({ids}|{all}|{queryId}),
//   profile:update (UserProfile), saved-answer:upsert / saved-answer:deleted,
//   data:changed ({resource}) — refetch lists such as 'users', 'categories',
//   'articles', 'reviews', 'saved-articles'.
//
// Listeners can be registered at any time; the connection itself is only opened
// by AuthContext once someone is signed in (logged-out visitors never connect).

const socket: Socket = io({ path: '/socket.io', withCredentials: true, autoConnect: false });

export function connectSocket() {
  if (socket.disconnected) socket.connect();
}

/** Drops the connection, e.g. on sign-out. A new sign-in reconnects with the new cookie. */
export function disconnectSocket() {
  socket.disconnect();
}

export function isSocketConnected() {
  return socket.connected;
}

/** Subscribes to a server event; returns an unsubscribe function. */
export function onSocket<T = unknown>(event: string, handler: (payload: T) => void): () => void {
  socket.on(event, handler as (...args: unknown[]) => void);
  return () => {
    socket.off(event, handler as (...args: unknown[]) => void);
  };
}

/** Calls `handler` whenever `data:changed` fires for one of `resources`. */
export function onDataChanged(resources: string[], handler: () => void): () => void {
  return onSocket<{ resource: string }>('data:changed', ({ resource }) => {
    if (resources.includes(resource)) handler();
  });
}

/** Runs `handler` on every (re)connect, to refetch anything missed while not connected. */
export function onReconnect(handler: () => void): () => void {
  socket.on('connect', handler);
  return () => {
    socket.off('connect', handler);
  };
}

/** Joins a conversation room while it is open; re-joins after reconnects. */
export function joinQueryRoom(queryId: string): () => void {
  const join = () => socket.emit('query:join', queryId);
  if (socket.connected) join();
  socket.on('connect', join);
  return () => {
    socket.off('connect', join);
    if (socket.connected) socket.emit('query:leave', queryId);
  };
}
