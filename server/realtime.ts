import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { eq } from 'drizzle-orm';
import { config } from './config';
import { db, t } from './db';
import { userFromToken, isManager } from './auth';
import { adminCategoryIds, loadVisibleQuery, type QueryRow } from './access';

// Rooms:
//   user:<id>        every socket of one user
//   managers         expert + super admins (see all queries)
//   query:<id>       sockets currently viewing one conversation
//
// Events sent to clients (payloads are serialized rows):
//   query:upsert     a ticket was created or changed
//   query:removed    a ticket was deleted or hidden for this user
//   message:new      a chat message was added           (query room)
//   message:update   messages changed, e.g. read flags   (query room)
//   notification:new a notification for this user
//   profile:update   the signed-in user's profile changed
//   data:changed     { resource } — refetch a list (categories, users, articles, reviews, …)

let io: Server | null = null;

function parseCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

export function attachRealtime(server: HttpServer) {
  io = new Server(server, { path: '/socket.io', serveClient: false });

  io.use(async (socket, next) => {
    try {
      const found = await userFromToken(parseCookie(socket.handshake.headers.cookie, config.sessionCookie));
      if (!found) return next(new Error('unauthorized'));
      socket.data.userId = found.user.id;
      next();
    } catch (err) {
      next(err as Error);
    }
  });

  io.on('connection', async (socket) => {
    const userId: string = socket.data.userId;
    const [user] = await db.select().from(t.users).where(eq(t.users.id, userId)).limit(1);
    if (!user) return socket.disconnect(true);

    socket.join(`user:${userId}`);
    if (isManager(user.role)) socket.join('managers');
    // Normal admins also see unassigned tickets in their categories.
    if (user.role === 'normal_admin') {
      for (const catId of await adminCategoryIds(userId)) socket.join(`category:${catId}`);
    }
    await setOnline(userId, true);

    // Clients join a conversation room while it is open; access is checked here.
    socket.on('query:join', async (queryId: unknown, ack?: (ok: boolean) => void) => {
      try {
        if (typeof queryId !== 'string') throw new Error('bad id');
        const [fresh] = await db.select().from(t.users).where(eq(t.users.id, userId)).limit(1);
        if (!fresh || fresh.status !== 'active') throw new Error('inactive');
        await loadVisibleQuery(fresh, queryId);
        socket.join(`query:${queryId}`);
        ack?.(true);
      } catch {
        ack?.(false);
      }
    });
    socket.on('query:leave', (queryId: unknown) => {
      if (typeof queryId === 'string') socket.leave(`query:${queryId}`);
    });

    socket.on('disconnect', async () => {
      const remaining = await io!.in(`user:${userId}`).fetchSockets();
      if (!remaining.length) await setOnline(userId, false);
    });
  });

  return io;
}

async function setOnline(userId: string, online: boolean) {
  await db.update(t.users).set({ isOnline: online, lastActiveAt: Date.now() }).where(eq(t.users.id, userId));
}

export function emitToUser(userId: string | null | undefined, event: string, payload: unknown) {
  if (userId) io?.to(`user:${userId}`).emit(event, payload);
}

export function emitToManagers(event: string, payload: unknown) {
  io?.to('managers').emit(event, payload);
}

export function emitToQueryRoom(queryId: string, event: string, payload: unknown) {
  io?.to(`query:${queryId}`).emit(event, payload);
}

/**
 * Everyone who can see the ticket: its student, its admin, all managers, and —
 * while unassigned — the normal admins of its category.
 */
export function emitQueryChange(q: QueryRow, event: string, payload: unknown) {
  if (!io) return;
  const rooms = ['managers', ...[q.studentId, q.expertId].filter(Boolean).map((id) => `user:${id}`)];
  if (!q.expertId && q.categoryId) rooms.push(`category:${q.categoryId}`);
  // A single emit to several rooms reaches each socket once.
  io.to(rooms).emit(event, payload);
}

/** Re-syncs a user's category rooms after their assignments change. */
export async function refreshCategoryRooms(userId: string) {
  if (!io) return;
  const cats = new Set(await adminCategoryIds(userId));
  for (const socket of await io.in(`user:${userId}`).fetchSockets()) {
    for (const room of socket.rooms) {
      if (room.startsWith('category:') && !cats.has(room.slice(9))) socket.leave(room);
    }
    for (const id of cats) socket.join(`category:${id}`);
  }
}

/** Disconnects every socket of a user (deactivation, deletion, password reset). */
export function disconnectUser(userId: string) {
  io?.in(`user:${userId}`).disconnectSockets(true);
}

/** Tells every connected client a shared list changed so it can refetch. */
export function broadcastChange(resource: string) {
  io?.emit('data:changed', { resource });
}
