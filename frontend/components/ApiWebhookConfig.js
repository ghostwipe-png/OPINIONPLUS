// components/ApiWebhookConfig.js
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Webhook, Plus, Trash2, Loader2, AlertTriangle, CheckCircle, XCircle, Play, RefreshCw, ChevronDown, ChevronUp, Copy, Check, Eye } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

const WEBHOOK_EVENTS = [
  { value: 'story.published', label: 'Story Published' },
  { value: 'press_release.published', label: 'Press Release Published' },
  { value: 'sponsored.published', label: 'Sponsored Content Published' },
];

async function getCsrfToken() {
  try {
    const res = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' });
    const data = await res.json();
    return data.token || '';
  } catch (e) {
    return '';
  }
}

export default function ApiWebhookConfig() {
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newEvents, setNewEvents] = useState(['story.published', 'press_release.published']);
  const [newSecret, setNewSecret] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdSecret, setCreatedSecret] = useState(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Testing state
  const [testingId, setTestingId] = useState(null);
  const [testResult, setTestResult] = useState(null);

  // Expanded webhooks (for delivery logs)
  const [expandedId, setExpandedId] = useState(null);
  const [deliveryLogs, setDeliveryLogs] = useState({});
  const [loadingLogs, setLoadingLogs] = useState({});

  // Deleting state
  const [deletingId, setDeletingId] = useState(null);

  const fetchWebhooks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api-service/webhooks`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setWebhooks(data.webhooks || []);
      } else {
        setError(data.error || 'Failed to load webhooks.');
      }
    } catch (e) {
      setError('Network error while loading webhooks.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    try {
      const csrfToken = await getCsrfToken();
      const secret = newSecret || undefined;
      const res = await fetch(`${API_BASE}/api-service/webhooks`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          webhook_name: newName,
          webhook_url: newUrl,
          events: newEvents,
          secret,
        }),
      });
      const data = await res.json();
      if (res.ok && data.webhook) {
        if (data.webhook.secret) {
          setCreatedSecret(data.webhook.secret);
        }
        setShowCreateForm(false);
        setNewName('');
        setNewUrl('');
        setNewEvents(['story.published', 'press_release.published']);
        setNewSecret('');
        fetchWebhooks();
      } else {
        alert(data.error || 'Failed to create webhook.');
      }
    } catch (e) {
      alert('Network error.');
    }
    setCreating(false);
  };

  const handleDelete = async (webhookId) => {
    if (!confirm('Delete this webhook? This cannot be undone.')) return;
    setDeletingId(webhookId);
    try {
      const csrfToken = await getCsrfToken();
      const res = await fetch(`${API_BASE}/api-service/webhooks/${webhookId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'X-CSRF-Token': csrfToken },
      });
      const data = await res.json();
      if (res.ok) {
        setWebhooks(prev => prev.filter(w => w.id !== webhookId));
      } else {
        alert(data.error || 'Failed to delete webhook.');
      }
    } catch (e) {
      alert('Network error.');
    }
    setDeletingId(null);
  };

  const handleTest = async (webhookId) => {
    setTestingId(webhookId);
    setTestResult(null);
    try {
      const csrfToken = await getCsrfToken();
      const res = await fetch(`${API_BASE}/api-service/webhooks/${webhookId}/test`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': csrfToken },
      });
      const data = await res.json();
      setTestResult({ webhookId, ...data });
    } catch (e) {
      setTestResult({ webhookId, success: false, error: 'Network error.' });
    }
    setTestingId(null);
  };

  const toggleLogs = async (webhookId) => {
    if (expandedId === webhookId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(webhookId);
    if (!deliveryLogs[webhookId]) {
      setLoadingLogs(prev => ({ ...prev, [webhookId]: true }));
      try {
        const res = await fetch(`${API_BASE}/api-service/webhooks/${webhookId}/logs`, {
          credentials: 'include',
        });
        const data = await res.json();
        if (res.ok) {
          setDeliveryLogs(prev => ({ ...prev, [webhookId]: data.logs || [] }));
        }
      } catch (e) {
        setDeliveryLogs(prev => ({ ...prev, [webhookId]: [] }));
      }
      setLoadingLogs(prev => ({ ...prev, [webhookId]: false }));
    }
  };

  const toggleEvent = (event) => {
    setNewEvents(prev =>
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
    );
  };

  const copySecret = () => {
    if (createdSecret) {
      navigator.clipboard.writeText(createdSecret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    }
  };

  const getEventLabel = (value) => {
    return WEBHOOK_EVENTS.find(e => e.value === value)?.label || value;
  };

  if (loading) {
    return (
      <div className="border border-wire bg-white p-8 rounded-sm shadow-sm">
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 bg-wire/20 rounded-sm animate-pulse" />
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
          <p className="text-sm font-medium text-signal">{error}</p>
        </div>
      )}

      {/* Created secret banner */}
      {createdSecret && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-sm">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={14} className="text-emerald-600" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Webhook Created — Save Your Secret</p>
          </div>
          <div className="flex items-center gap-2 bg-white border border-emerald-200 p-2 rounded-sm">
            <code className="flex-1 font-mono text-xs text-ink font-bold break-all">{createdSecret}</code>
            <button onClick={copySecret} className="shrink-0 bg-ink text-white p-1.5 rounded-sm hover:bg-signal transition-colors">
              {copiedSecret ? <Check size={12} /> : <Copy size={12} />}
            </button>
          </div>
          <p className="text-[9px] text-emerald-600 mt-2">This secret will not be shown again. Use it to verify webhook signatures.</p>
          <button onClick={() => setCreatedSecret(null)} className="text-[9px] font-bold text-ink underline mt-1">Dismiss</button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
          {webhooks.length} webhook{webhooks.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink bg-white border border-wire px-3 py-2 rounded-sm hover:border-ink transition-colors"
        >
          <Plus size={12} /> {showCreateForm ? 'Cancel' : 'New Webhook'}
        </button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <form onSubmit={handleCreate} className="border border-wire bg-white p-5 rounded-sm shadow-sm space-y-4">
          <div>
            <label className="text-[9px] font-bold uppercase tracking-wider text-ink-400 block mb-1">Webhook Name</label>
            <input
              required
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g. Production Notifier"
              className="w-full border border-wire rounded-sm px-3 py-2.5 text-sm font-medium bg-paper focus:outline-none focus:border-ink transition-colors"
            />
          </div>
          <div>
            <label className="text-[9px] font-bold uppercase tracking-wider text-ink-400 block mb-1">Endpoint URL</label>
            <input
              required
              type="url"
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              placeholder="https://your-server.com/webhook"
              className="w-full border border-wire rounded-sm px-3 py-2.5 text-sm font-medium bg-paper focus:outline-none focus:border-ink transition-colors"
            />
          </div>
          <div>
            <label className="text-[9px] font-bold uppercase tracking-wider text-ink-400 block mb-2">Events</label>
            <div className="flex flex-wrap gap-2">
              {WEBHOOK_EVENTS.map(event => (
                <label key={event.value} className="flex items-center gap-2 cursor-pointer p-2 border border-wire rounded-sm hover:border-ink transition-colors">
                  <input
                    type="checkbox"
                    checked={newEvents.includes(event.value)}
                    onChange={() => toggleEvent(event.value)}
                    className="rounded-sm accent-signal"
                  />
                  <span className="text-[10px] font-medium text-ink-700">{event.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[9px] font-bold uppercase tracking-wider text-ink-400 block mb-1">
              Secret (optional — auto-generated if blank)
            </label>
            <input
              value={newSecret}
              onChange={e => setNewSecret(e.target.value)}
              placeholder="Leave blank for auto-generated secret"
              className="w-full border border-wire rounded-sm px-3 py-2.5 text-sm font-mono bg-paper focus:outline-none focus:border-ink transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={creating || !newName || !newUrl || newEvents.length === 0}
            className="w-full bg-ink text-white font-bold uppercase text-xs tracking-wider py-3 rounded-sm hover:bg-signal transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <><Webhook size={14} /> Create Webhook</>}
          </button>
        </form>
      )}

      {/* Webhooks List */}
      {webhooks.length === 0 && !showCreateForm ? (
        <div className="border border-wire bg-white p-10 rounded-sm shadow-sm text-center">
          <Webhook size={32} className="text-ink-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-ink-600 uppercase tracking-wider">No webhooks configured</p>
          <p className="text-xs font-medium text-ink-400 mt-1">Create a webhook to receive real-time event notifications.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {webhooks.map(webhook => {
            const isExpanded = expandedId === webhook.id;
            const isDeleting = deletingId === webhook.id;
            const isTesting = testingId === webhook.id;
            const logs = deliveryLogs[webhook.id] || [];
            const isLoadingLogs = loadingLogs[webhook.id];
            const testRes = testResult?.webhookId === webhook.id ? testResult : null;
            const events = webhook.events || [];

            return (
              <div key={webhook.id} className="border border-wire bg-white rounded-sm shadow-sm overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-black text-ink truncate">{webhook.webhook_name}</p>
                        <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${
                          webhook.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-signal border border-red-200'
                        }`}>
                          {webhook.is_active ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                      <p className="text-xs font-mono text-ink-500 truncate mt-1">{webhook.webhook_url}</p>
                      
                      <div className="flex flex-wrap gap-1 mt-2">
                        {events.map(event => (
                          <span key={event} className="text-[7px] font-bold uppercase tracking-wider bg-paper border border-wire px-1.5 py-0.5 rounded-sm text-ink-500">
                            {getEventLabel(event)}
                          </span>
                        ))}
                      </div>

                      {webhook.last_triggered_at && (
                        <p className="text-[9px] text-ink-400 mt-1">
                          Last triggered: {new Date(webhook.last_triggered_at).toLocaleString()}
                        </p>
                      )}
                      {webhook.consecutive_failures > 0 && (
                        <p className="text-[9px] text-signal font-bold mt-0.5">
                          {webhook.consecutive_failures} consecutive failure{webhook.consecutive_failures > 1 ? 's' : ''}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleTest(webhook.id)}
                        disabled={isTesting}
                        title="Send test payload"
                        className="p-1.5 rounded-sm border border-wire hover:border-ink transition-colors"
                      >
                        {isTesting ? <Loader2 size={12} className="animate-spin text-ink" /> : <Play size={12} className="text-ink-400" />}
                      </button>
                      <button
                        onClick={() => toggleLogs(webhook.id)}
                        title="View delivery logs"
                        className="p-1.5 rounded-sm border border-wire hover:border-ink transition-colors"
                      >
                        <Eye size={12} className={isExpanded ? 'text-ink' : 'text-ink-400'} />
                      </button>
                      <button
                        onClick={() => handleDelete(webhook.id)}
                        disabled={isDeleting}
                        title="Delete webhook"
                        className="p-1.5 rounded-sm border border-wire hover:border-signal transition-colors"
                      >
                        {isDeleting ? <Loader2 size={12} className="animate-spin text-signal" /> : <Trash2 size={12} className="text-signal" />}
                      </button>
                    </div>
                  </div>

                  {/* Test result */}
                  {testRes && (
                    <div className={`mt-3 p-3 rounded-sm ${testRes.success ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                      <div className="flex items-center gap-2">
                        {testRes.success ? <CheckCircle size={12} className="text-emerald-600" /> : <XCircle size={12} className="text-signal" />}
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                          {testRes.success ? 'Test Successful' : 'Test Failed'}
                        </span>
                        <span className="text-[9px] text-ink-500 ml-auto">Status: {testRes.response_status || 'N/A'}</span>
                        <span className="text-[9px] text-ink-500">{testRes.response_time_ms}ms</span>
                      </div>
                      {testRes.response_body && (
                        <pre className="mt-2 text-[9px] text-ink-600 bg-white p-2 rounded-sm border border-wire max-h-24 overflow-y-auto whitespace-pre-wrap">
                          {testRes.response_body.slice(0, 500)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>

                {/* Delivery Logs */}
                {isExpanded && (
                  <div className="border-t border-wire bg-paper">
                    {isLoadingLogs ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 size={16} className="animate-spin text-ink" />
                      </div>
                    ) : logs.length === 0 ? (
                      <div className="p-6 text-center">
                        <p className="text-xs text-ink-400">No delivery logs yet.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-wire max-h-64 overflow-y-auto">
                        {logs.map(log => (
                          <div key={log.id} className="px-4 py-2.5 flex items-center gap-3">
                            {log.success ? (
                              <CheckCircle size={10} className="text-emerald-500 shrink-0" />
                            ) : (
                              <XCircle size={10} className="text-signal shrink-0" />
                            )}
                            <span className="text-[9px] font-bold uppercase tracking-wider text-ink-500 w-24 shrink-0">
                              {getEventLabel(log.event_type)}
                            </span>
                            <span className="text-[9px] font-mono text-ink-400">{log.response_status}</span>
                            <span className="text-[9px] text-ink-400 ml-auto">{log.response_time_ms}ms</span>
                            <span className="text-[9px] text-ink-400">{new Date(log.created_at).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}