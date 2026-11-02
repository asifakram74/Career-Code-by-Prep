import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage } from './api';
import { joinQueryRoom, onDataChanged, onReconnect, onSocket } from './socket';
import type { ConversationMessage, QueryTicket } from '../types';

// React hooks that replace Firestore onSnapshot listeners: an initial REST fetch,
// then incremental updates pushed over the socket, with a refetch on reconnect.

const activityTime = (q: QueryTicket) => q.lastReplyAt || q.updatedAt || q.createdAt || 0;
export const sortByActivity = (list: QueryTicket[]) => [...list].sort((a, b) => activityTime(b) - activityTime(a));

/**
 * Live list of tickets.
 * - scope 'mine' (default): the student's own tickets, or an admin's assigned ones
 *   (normal admins also get unassigned tickets in their categories)
 * - scope 'all': every ticket (expert/super admins only)
 * `filter` drops pushed tickets that don't belong in this view (managers receive
 * pushes for every ticket even when showing only their own).
 */
export function useLiveQueries(options: {
  scope?: 'mine' | 'all';
  enabled?: boolean;
  filter?: (q: QueryTicket) => boolean;
} = {}) {
  const { scope = 'mine', enabled = true } = options;
  const filterRef = useRef(options.filter);
  filterRef.current = options.filter;

  const [queries, setQueries] = useState<QueryTicket[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const list = await api.get<QueryTicket[]>(`/queries?scope=${scope}`);
      setQueries(sortByActivity(list));
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [scope, enabled]);

  useEffect(() => {
    if (!enabled) {
      setQueries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    refresh();
    const offUpsert = onSocket<QueryTicket>('query:upsert', (ticket) => {
      setQueries((prev) => {
        const keep = !filterRef.current || filterRef.current(ticket);
        const without = prev.filter((q) => q.id !== ticket.id);
        return keep ? sortByActivity([ticket, ...without]) : without;
      });
    });
    const offRemoved = onSocket<{ id: string }>('query:removed', ({ id }) => {
      setQueries((prev) => prev.filter((q) => q.id !== id));
    });
    const offReconnect = onReconnect(refresh);
    return () => {
      offUpsert();
      offRemoved();
      offReconnect();
    };
  }, [refresh, enabled]);

  return { queries, setQueries, loading, error, refresh };
}

/** One ticket, kept current by pushes. `initial` is shown until the fetch returns. */
export function useLiveQuery(queryId: string | null | undefined, initial?: QueryTicket | null) {
  const [ticket, setTicket] = useState<QueryTicket | null>(initial ?? null);

  useEffect(() => {
    if (!queryId) return;
    let cancelled = false;
    const load = () =>
      api
        .get<QueryTicket>(`/queries/${queryId}`)
        .then((t) => !cancelled && setTicket(t))
        .catch(() => {});
    load();
    const off = onSocket<QueryTicket>('query:upsert', (t) => {
      if (t.id === queryId) setTicket(t);
    });
    const offReconnect = onReconnect(load);
    return () => {
      cancelled = true;
      off();
      offReconnect();
    };
  }, [queryId]);

  return { ticket, setTicket };
}

/** Messages of one conversation; joins its socket room while mounted. */
export function useMessages(queryId: string | null | undefined) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(Boolean(queryId));

  useEffect(() => {
    if (!queryId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const load = () =>
      api
        .get<ConversationMessage[]>(`/queries/${queryId}/messages`)
        .then((list) => !cancelled && setMessages(list))
        .catch(() => {})
        .finally(() => !cancelled && setLoading(false));
    load();

    const leave = joinQueryRoom(queryId);
    const offNew = onSocket<ConversationMessage>('message:new', (m) => {
      if (m.queryId !== queryId) return;
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    });
    const offUpdate = onSocket<{ queryId: string; readIds: string[] }>('message:update', (u) => {
      if (u.queryId !== queryId) return;
      const ids = new Set(u.readIds);
      setMessages((prev) => prev.map((m) => (ids.has(m.id) ? { ...m, isRead: true } : m)));
    });
    const offReconnect = onReconnect(load);
    return () => {
      cancelled = true;
      leave();
      offNew();
      offUpdate();
      offReconnect();
    };
  }, [queryId]);

  /** Adds a message returned by a POST before its socket echo arrives. */
  const addMessage = useCallback((m: ConversationMessage) => {
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
  }, []);

  return { messages, setMessages, addMessage, loading };
}

/**
 * Generic GET resource that refetches when the server announces `data:changed`
 * for any of `resources` (e.g. ['categories'], ['users']).
 */
export function useApiResource<T>(path: string | null, resources: string[] = [], initial: T) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState<string | null>(null);
  const resourcesKey = resources.join(',');

  const refresh = useCallback(async () => {
    if (!path) return;
    try {
      setData(await api.get<T>(path));
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    if (!path) {
      setLoading(false);
      return;
    }
    setLoading(true);
    refresh();
    const offs = [onReconnect(refresh)];
    if (resourcesKey) offs.push(onDataChanged(resourcesKey.split(','), refresh));
    return () => offs.forEach((off) => off());
  }, [refresh, path, resourcesKey]);

  return { data, setData, loading, error, refresh };
}
