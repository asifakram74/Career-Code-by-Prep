import React, { useState, useEffect, useCallback } from 'react';
import { api, errorMessage } from '../../lib/api';
import { AuditLogItem } from '../../types';
import { Activity, ShieldCheck, Search, Clock, RefreshCw } from 'lucide-react';

const REFRESH_INTERVAL_MS = 30_000;

export const AuditLogsSection: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadLogs = useCallback(async () => {
    setRefreshing(true);
    try {
      const list = await api.get<AuditLogItem[]>('/admin/audit-logs');
      setLogs(list);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, 'Could not load audit logs.'));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
    const timer = window.setInterval(loadLogs, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [loadLogs]);

  const filteredLogs = logs.filter((l) => {
    const text = `${l.actorName} ${l.actorRole} ${l.action} ${l.details || ''}`.toLowerCase();
    return text.includes(search.toLowerCase());
  });

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-pink-600" />
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              Platform Security & Audit Trail
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable log of administrative events, query reassignments, and account modifications.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search audit trail..."
              className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            />
          </div>
          <button
            type="button"
            onClick={loadLogs}
            disabled={refreshing}
            title="Refresh audit logs"
            className="p-2 border border-slate-300 rounded-xl text-slate-500 hover:text-pink-600 hover:border-pink-300 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-4 py-2.5">{error}</div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Details / Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 text-xs">
                    No audit log entries recorded yet.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-pink-50/40 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500 tabular-nums">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      {log.actorName}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-pink-50 text-pink-700 border border-pink-200">
                        {log.actorRole}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {log.action}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {log.details || log.targetId || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
