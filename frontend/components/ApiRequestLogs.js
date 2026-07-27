// components/ApiRequestLogs.js
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, AlertTriangle, FileText, Search, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Eye, Clock, Server } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

const METHOD_COLORS = {
  GET: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  POST: 'bg-blue-50 text-blue-700 border-blue-200',
  PUT: 'bg-amber-50 text-amber-700 border-amber-200',
  PATCH: 'bg-purple-50 text-purple-700 border-purple-200',
  DELETE: 'bg-red-50 text-signal border-red-200',
};

const STATUS_COLORS = {
  '2xx': 'bg-emerald-50 text-emerald-700',
  '3xx': 'bg-blue-50 text-blue-700',
  '4xx': 'bg-amber-50 text-amber-700',
  '5xx': 'bg-red-50 text-signal',
};

function getStatusGroup(code) {
  if (code >= 200 && code < 300) return '2xx';
  if (code >= 300 && code < 400) return '3xx';
  if (code >= 400 && code < 500) return '4xx';
  return '5xx';
}

function getMethodBadge(method) {
  return METHOD_COLORS[method] || 'bg-ink-50 text-ink-600 border-ink-200';
}

export default function ApiRequestLogs({ apiKeyId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [endpointFilter, setEndpointFilter] = useState('');
  
  // Expanded log detail
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [logDetail, setLogDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchLogs = useCallback(async (pageNum = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', pageNum);
      params.set('limit', '20');
      if (statusFilter) params.set('status', statusFilter);
      if (dateFilter) params.set('date', dateFilter);
      
      const res = await fetch(`${API_BASE}/api-service/logs?${params.toString()}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setLogs(data.logs || []);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
        setPage(data.page || 1);
      } else {
        setError(data.error || 'Failed to load request logs.');
      }
    } catch (e) {
      setError('Network error while loading logs.');
    }
    setLoading(false);
  }, [statusFilter, dateFilter]);

  useEffect(() => {
    fetchLogs(page);
  }, [fetchLogs, page]);

  const toggleLogDetail = async (logId) => {
    if (expandedLogId === logId) {
      setExpandedLogId(null);
      setLogDetail(null);
      return;
    }
    setExpandedLogId(logId);
    setLoadingDetail(true);
    try {
      // For now, use the existing log data — full detail endpoint can be added later
      const log = logs.find(l => l.id === logId);
      setLogDetail(log || null);
    } catch (e) {
      setLogDetail(null);
    }
    setLoadingDetail(false);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleString();
  };

  const formatResponseTime = (ms) => {
    if (!ms && ms !== 0) return '—';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  if (loading && logs.length === 0) {
    return (
      <div className="border border-wire bg-white p-6 rounded-sm shadow-sm">
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-8 bg-wire/20 rounded-sm animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-4 bg-red-50 border border-signal rounded-sm flex items-start gap-3">
          <AlertTriangle size={16} className="text-signal shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-signal">{error}</p>
            <button onClick={() => fetchLogs(page)} className="text-xs font-bold text-ink underline mt-1">Retry</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 bg-white border border-wire rounded-sm px-3 py-2 flex-1 min-w-[140px]">
          <Search size={12} className="text-ink-400 shrink-0" />
          <input
            value={endpointFilter}
            onChange={e => setEndpointFilter(e.target.value)}
            placeholder="Filter endpoint..."
            className="w-full text-xs font-medium bg-transparent focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-wire rounded-sm px-3 py-2 text-xs font-bold bg-white focus:outline-none focus:border-ink transition-colors"
        >
          <option value="">All Status</option>
          <option value="2xx">2xx Success</option>
          <option value="4xx">4xx Client Error</option>
          <option value="5xx">5xx Server Error</option>
        </select>
        <input
          type="date"
          value={dateFilter}
          onChange={e => { setDateFilter(e.target.value); setPage(1); }}
          className="border border-wire rounded-sm px-3 py-2 text-xs font-bold bg-white focus:outline-none focus:border-ink transition-colors"
        />
        <button
          onClick={() => fetchLogs(1)}
          className="text-xs font-bold uppercase tracking-wider text-ink bg-white border border-wire px-4 py-2 rounded-sm hover:border-ink transition-colors"
        >
          Apply
        </button>
      </div>

      {/* Logs Table */}
      {logs.length === 0 ? (
        <div className="border border-wire bg-white p-10 rounded-sm shadow-sm text-center">
          <FileText size={32} className="text-ink-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-ink-600 uppercase tracking-wider">No request logs yet</p>
          <p className="text-xs font-medium text-ink-400 mt-1">API request logs will appear here once you start making calls.</p>
        </div>
      ) : (
        <div className="border border-wire bg-white rounded-sm shadow-sm overflow-hidden">
          {/* Mobile: Card layout */}
          <div className="sm:hidden divide-y divide-wire">
            {logs.map(log => (
              <div key={log.id} className="p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm border ${getMethodBadge(log.method)}`}>
                    {log.method}
                  </span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm ${STATUS_COLORS[getStatusGroup(log.status_code)]}`}>
                    {log.status_code}
                  </span>
                </div>
                <p className="text-xs font-medium text-ink truncate">{log.endpoint}</p>
                <div className="flex items-center justify-between text-[9px] text-ink-400">
                  <span>{formatDate(log.created_at)}</span>
                  <span>{formatResponseTime(log.response_time_ms)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: Table layout */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-wire bg-paper">
                  <th className="text-left text-[9px] font-bold uppercase tracking-wider text-ink-400 px-4 py-3">Timestamp</th>
                  <th className="text-left text-[9px] font-bold uppercase tracking-wider text-ink-400 px-4 py-3">Method</th>
                  <th className="text-left text-[9px] font-bold uppercase tracking-wider text-ink-400 px-4 py-3">Endpoint</th>
                  <th className="text-center text-[9px] font-bold uppercase tracking-wider text-ink-400 px-4 py-3">Status</th>
                  <th className="text-center text-[9px] font-bold uppercase tracking-wider text-ink-400 px-4 py-3">Response Time</th>
                  <th className="text-center text-[9px] font-bold uppercase tracking-wider text-ink-400 px-4 py-3">IP</th>
                  <th className="text-center text-[9px] font-bold uppercase tracking-wider text-ink-400 px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-wire">
                {logs.map(log => {
                  const isExpanded = expandedLogId === log.id;
                  return (
                    <tr key={log.id} className={`hover:bg-paper/50 transition-colors ${isExpanded ? 'bg-paper' : ''}`}>
                      <td className="px-4 py-3 text-[10px] font-medium text-ink-500 whitespace-nowrap">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm border ${getMethodBadge(log.method)}`}>
                          {log.method}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-ink max-w-[200px] truncate">
                        {log.endpoint}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-sm ${STATUS_COLORS[getStatusGroup(log.status_code)]}`}>
                          {log.status_code}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-[10px] font-medium text-ink-500">
                        {formatResponseTime(log.response_time_ms)}
                      </td>
                      <td className="px-4 py-3 text-center text-[10px] font-medium text-ink-400 font-mono">
                        {log.ip_address || '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleLogDetail(log.id)}
                          className="p-1 rounded-sm hover:bg-wire/30 transition-colors"
                          title="View details"
                        >
                          {isExpanded ? <ChevronUp size={12} className="text-ink" /> : <ChevronDown size={12} className="text-ink-400" />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Expanded detail row */}
          {expandedLogId && (
            <div className="border-t-2 border-signal bg-paper p-4 sm:p-6">
              {loadingDetail ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 size={18} className="animate-spin text-ink" />
                </div>
              ) : logDetail ? (
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-ink-400 mb-1">Full Endpoint</p>
                      <p className="text-xs font-mono font-bold text-ink break-all">{logDetail.endpoint}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-ink-400 mb-1">User Agent</p>
                      <p className="text-xs font-medium text-ink-500 truncate">{logDetail.user_agent || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-ink-400 mb-1">IP Address</p>
                      <p className="text-xs font-mono font-bold text-ink">{logDetail.ip_address || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-ink-400 mb-1">Request Body Size</p>
                      <p className="text-xs font-bold text-ink">{logDetail.request_body_size || 0} bytes</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-ink-400 mb-1">Response Body Size</p>
                      <p className="text-xs font-bold text-ink">{logDetail.response_body_size || 0} bytes</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-ink-400 mb-1">Log ID</p>
                      <p className="text-xs font-mono text-ink-400">{logDetail.id}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-ink-400">No details available.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
            {total} total requests
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-ink px-3 py-1.5 border border-wire rounded-sm disabled:opacity-30 hover:border-ink transition-colors"
            >
              <ChevronLeft size={12} /> Prev
            </button>
            <span className="text-[10px] font-bold text-ink-400">
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-ink px-3 py-1.5 border border-wire rounded-sm disabled:opacity-30 hover:border-ink transition-colors"
            >
              Next <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}