// components/ApiKeyManager.js
'use client';

import { useEffect, useState, useCallback } from 'react';
import { KeyRound, Plus, Trash2, RefreshCw, Copy, Check, Eye, EyeOff, Loader2, AlertTriangle, Shield, Zap } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

const VALID_SCOPES = [
  { value: 'stories:read', label: 'Stories — Read' },
  { value: 'stories:write', label: 'Stories — Write' },
  { value: 'press_release:read', label: 'Press Releases — Read' },
  { value: 'press_release:write', label: 'Press Releases — Write' },
  { value: 'sponsored:read', label: 'Sponsored — Read' },
  { value: 'sponsored:write', label: 'Sponsored — Write' },
  { value: 'analytics:read', label: 'Analytics — Read' },
  { value: 'webhooks:manage', label: 'Webhooks — Manage' },
];

const DEFAULT_SCOPES = ['stories:read', 'press_release:read', 'sponsored:read', 'analytics:read'];

async function getCsrfToken() {
  try {
    const res = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' });
    const data = await res.json();
    return data.token || '';
  } catch (e) {
    return '';
  }
}

function maskKey(key) {
  if (!key || key.length < 20) return key || '****';
  const prefix = key.startsWith('op_test_') ? 'op_test_' : 'op_live_';
  const body = key.slice(prefix.length);
  return `${prefix}${body.slice(0, 4)}****${body.slice(-4)}`;
}

export default function ApiKeyManager({ onKeyChange }) {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // Create form state
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyType, setNewKeyType] = useState('production');
  const [newKeyScopes, setNewKeyScopes] = useState([...DEFAULT_SCOPES]);
  const [creating, setCreating] = useState(false);
  
  // Revealed keys (only shown once after creation/regeneration)
  const [revealedKeys, setRevealedKeys] = useState({});
  const [copiedKeyId, setCopiedKeyId] = useState(null);
  
  // Revoke confirmation
  const [revokingId, setRevokingId] = useState(null);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api-service/keys`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setKeys(data.keys || []);
        if (onKeyChange && data.keys?.length > 0) {
          onKeyChange(data.keys);
        }
      } else {
        setError(data.error || 'Failed to load API keys.');
      }
    } catch (e) {
      setError('Network error while loading API keys.');
    }
    setLoading(false);
  }, [onKeyChange]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreateKey = async (e) => {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    try {
      const csrfToken = await getCsrfToken();
      const res = await fetch(`${API_BASE}/api-service/keys`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          key_name: newKeyName || 'Default Key',
          key_type: newKeyType,
          scopes: newKeyScopes,
        }),
      });
      const data = await res.json();
      if (res.ok && data.key) {
        setRevealedKeys(prev => ({ ...prev, [data.key.id]: data.key.key }));
        setKeys(prev => [data.key, ...prev]);
        setShowCreateForm(false);
        setNewKeyName('');
        setNewKeyType('production');
        setNewKeyScopes([...DEFAULT_SCOPES]);
        if (onKeyChange) onKeyChange([data.key, ...keys]);
      } else {
        alert(data.error || 'Failed to create API key.');
      }
    } catch (e) {
      alert('Network error while creating API key.');
    }
    setCreating(false);
  };

  const handleRegenerate = async (keyId) => {
    if (!confirm('Regenerate this key? The old key will stop working immediately.')) return;
    try {
      const csrfToken = await getCsrfToken();
      const res = await fetch(`${API_BASE}/api-service/keys/${keyId}/regenerate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': csrfToken },
      });
      const data = await res.json();
      if (res.ok && data.key) {
        setRevealedKeys(prev => ({ ...prev, [keyId]: data.key.key }));
        alert('Key regenerated! Save the new key now — it won\'t be shown again.');
        fetchKeys();
      } else {
        alert(data.error || 'Failed to regenerate key.');
      }
    } catch (e) {
      alert('Network error.');
    }
  };

  const handleRevoke = async (keyId) => {
    if (!confirm('Revoke this API key? All requests using this key will fail.')) return;
    setRevokingId(keyId);
    try {
      const csrfToken = await getCsrfToken();
      const res = await fetch(`${API_BASE}/api-service/keys/${keyId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'X-CSRF-Token': csrfToken },
      });
      const data = await res.json();
      if (res.ok) {
        setKeys(prev => prev.filter(k => k.id !== keyId));
        setRevealedKeys(prev => {
          const updated = { ...prev };
          delete updated[keyId];
          return updated;
        });
      } else {
        alert(data.error || 'Failed to revoke key.');
      }
    } catch (e) {
      alert('Network error.');
    }
    setRevokingId(null);
  };

  const copyKey = (keyValue, keyId) => {
    navigator.clipboard.writeText(keyValue);
    setCopiedKeyId(keyId);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const toggleScope = (scope) => {
    setNewKeyScopes(prev =>
      prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]
    );
  };

  const getScopeLabel = (scopeValue) => {
    return VALID_SCOPES.find(s => s.value === scopeValue)?.label || scopeValue;
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

      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
          {keys.length} key{keys.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink bg-white border border-wire px-3 py-2 rounded-sm hover:border-ink transition-colors"
        >
          <Plus size={12} /> {showCreateForm ? 'Cancel' : 'New Key'}
        </button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <form onSubmit={handleCreateKey} className="border border-wire bg-white p-5 rounded-sm shadow-sm space-y-4">
          <div>
            <label className="text-[9px] font-bold uppercase tracking-wider text-ink-400 block mb-1">Key Name</label>
            <input
              value={newKeyName}
              onChange={e => setNewKeyName(e.target.value)}
              placeholder="e.g. Production Web App"
              className="w-full border border-wire rounded-sm px-3 py-2.5 text-sm font-medium bg-paper focus:outline-none focus:border-ink transition-colors"
            />
          </div>

          <div>
            <label className="text-[9px] font-bold uppercase tracking-wider text-ink-400 block mb-1">Key Type</label>
            <select
              value={newKeyType}
              onChange={e => setNewKeyType(e.target.value)}
              className="w-full border border-wire rounded-sm px-3 py-2.5 text-sm font-medium bg-paper focus:outline-none focus:border-ink transition-colors"
            >
              <option value="production">Production (op_live_)</option>
              <option value="test">Test (op_test_)</option>
            </select>
          </div>

          <div>
            <label className="text-[9px] font-bold uppercase tracking-wider text-ink-400 block mb-2">Scopes</label>
            <div className="grid sm:grid-cols-2 gap-2">
              {VALID_SCOPES.map(scope => (
                <label key={scope.value} className="flex items-center gap-2 cursor-pointer p-2 border border-wire rounded-sm hover:border-ink transition-colors">
                  <input
                    type="checkbox"
                    checked={newKeyScopes.includes(scope.value)}
                    onChange={() => toggleScope(scope.value)}
                    className="rounded-sm accent-signal"
                  />
                  <span className="text-[10px] font-medium text-ink-700">{scope.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={creating || newKeyScopes.length === 0}
            className="w-full bg-ink text-white font-bold uppercase text-xs tracking-wider py-3 rounded-sm hover:bg-signal transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <><KeyRound size={14} /> Create Key</>}
          </button>
        </form>
      )}

      {/* Keys List */}
      {keys.length === 0 ? (
        <div className="border border-wire bg-white p-10 rounded-sm shadow-sm text-center">
          <Shield size={32} className="text-ink-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-ink-600 uppercase tracking-wider">No API keys yet</p>
          <p className="text-xs font-medium text-ink-400 mt-1">Create your first API key to start integrating.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map(key => {
            const isRevealed = revealedKeys[key.id];
            const isCopied = copiedKeyId === key.id;
            const isRevoking = revokingId === key.id;
            const scopes = key.scopes || [];

            return (
              <div key={key.id} className={`border rounded-sm p-4 transition-colors ${key.is_active === 0 ? 'border-red-200 bg-red-50/30' : 'border-wire bg-white hover:border-ink'}`}>
                {/* Revealed key banner */}
                {isRevealed && (
                  <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-sm">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-amber-700 mb-1">Save this key now — it won't be shown again!</p>
                    <div className="flex items-center gap-2 bg-white border border-amber-200 p-2 rounded-sm">
                      <code className="flex-1 font-mono text-xs text-ink font-bold break-all">{isRevealed}</code>
                      <button onClick={() => copyKey(isRevealed, key.id)} className="shrink-0 bg-ink text-white p-1.5 rounded-sm hover:bg-signal transition-colors">
                        {isCopied ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-black text-ink truncate">{key.key_name || 'Unnamed Key'}</p>
                      <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${
                        key.key_type === 'test' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {key.key_type === 'test' ? 'Test' : 'Live'}
                      </span>
                      <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${
                        key.is_active === 0 ? 'bg-red-50 text-signal border border-red-200' : 'bg-ink-50 text-ink-500'
                      }`}>
                        {key.is_active === 0 ? 'Revoked' : 'Active'}
                      </span>
                    </div>
                    
                    <code className="text-xs text-ink-400 font-mono mt-1 block">
                      {maskKey(isRevealed || 'op_live_************************')}
                    </code>

                    {key.last_used_at && (
                      <p className="text-[9px] text-ink-400 mt-1">
                        Last used: {new Date(key.last_used_at).toLocaleString()}
                      </p>
                    )}

                    {/* Scopes */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {scopes.slice(0, 4).map(scope => (
                        <span key={scope} className="text-[7px] font-bold uppercase tracking-wider bg-paper border border-wire px-1.5 py-0.5 rounded-sm text-ink-500">
                          {getScopeLabel(scope)}
                        </span>
                      ))}
                      {scopes.length > 4 && (
                        <span className="text-[7px] font-bold text-ink-400">+{scopes.length - 4} more</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {key.is_active !== 0 && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleRegenerate(key.id)}
                        title="Regenerate key"
                        className="p-1.5 rounded-sm border border-wire hover:border-ink transition-colors"
                      >
                        <RefreshCw size={12} className="text-ink-400" />
                      </button>
                      <button
                        onClick={() => handleRevoke(key.id)}
                        disabled={isRevoking}
                        title="Revoke key"
                        className="p-1.5 rounded-sm border border-wire hover:border-signal transition-colors"
                      >
                        {isRevoking ? <Loader2 size={12} className="animate-spin text-signal" /> : <Trash2 size={12} className="text-signal" />}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}