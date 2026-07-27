// components/ApiDocsBrowser.js
'use client';

import { useEffect, useState } from 'react';
import { Loader2, AlertTriangle, Book, ChevronDown, ChevronUp, Copy, Check, Search, ExternalLink } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

const METHOD_COLORS = {
  GET: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  POST: 'bg-blue-50 text-blue-700 border-blue-200',
  PUT: 'bg-amber-50 text-amber-700 border-amber-200',
  PATCH: 'bg-purple-50 text-purple-700 border-purple-200',
  DELETE: 'bg-red-50 text-signal border-red-200',
};

export default function ApiDocsBrowser() {
  const [docs, setDocs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState({});
  const [expandedEndpoints, setExpandedEndpoints] = useState({});
  const [copiedCode, setCopiedCode] = useState(null);

  useEffect(() => {
    const fetchDocs = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${API_BASE}/api-service/docs/endpoints`);
        const data = await res.json();
        if (res.ok) {
          setDocs(data);
          // Auto-expand first category
          if (data.categories?.length > 0) {
            setExpandedCategories({ [data.categories[0].name]: true });
          }
        } else {
          setError(data.error || 'Failed to load documentation.');
        }
      } catch (e) {
        setError('Network error while loading docs.');
      }
      setLoading(false);
    };
    fetchDocs();
  }, []);

  const toggleCategory = (name) => {
    setExpandedCategories(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const toggleEndpoint = (id) => {
    setExpandedEndpoints(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyCode = (code, id) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Filter endpoints by search query
  const filterEndpoints = (endpoints) => {
    if (!searchQuery.trim()) return endpoints;
    const q = searchQuery.toLowerCase();
    return endpoints.filter(ep =>
      ep.path.toLowerCase().includes(q) ||
      ep.description.toLowerCase().includes(q) ||
      ep.method.toLowerCase().includes(q)
    );
  };

  // Filter categories that have matching endpoints
  const filteredCategories = docs?.categories?.map(cat => ({
    ...cat,
    endpoints: filterEndpoints(cat.endpoints || []),
  })).filter(cat => cat.endpoints.length > 0) || [];

  if (loading) {
    return (
      <div className="border border-wire bg-white p-8 rounded-sm shadow-sm">
        <div className="space-y-4">
          <div className="h-6 w-48 bg-wire/20 rounded-sm animate-pulse" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 bg-wire/20 rounded-sm animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-wire bg-white p-8 rounded-sm shadow-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle size={16} className="text-signal shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-signal">Failed to load docs</p>
            <p className="text-xs text-ink-500 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!docs || filteredCategories.length === 0) {
    return (
      <div className="border border-wire bg-white p-10 rounded-sm shadow-sm text-center">
        <Book size={32} className="text-ink-300 mx-auto mb-3" />
        <p className="text-sm font-bold text-ink-600 uppercase tracking-wider">
          {searchQuery ? 'No endpoints match your search' : 'No documentation available'}
        </p>
        <p className="text-xs font-medium text-ink-400 mt-1">
          {searchQuery ? 'Try a different search term.' : 'Check back soon for endpoint documentation.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search + Auth info */}
      <div className="border border-wire bg-white p-4 rounded-sm shadow-sm space-y-3">
        <div className="flex items-center gap-2 bg-paper border border-wire rounded-sm px-3 py-2">
          <Search size={14} className="text-ink-400 shrink-0" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search endpoints..."
            className="w-full text-xs font-medium bg-transparent focus:outline-none"
          />
        </div>

        {docs.authentication && (
          <div className="p-3 bg-paper border border-wire rounded-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-2">Authentication</p>
            <code className="text-xs font-mono text-ink bg-white border border-wire px-2 py-1 rounded-sm block">
              {docs.authentication.header}
            </code>
          </div>
        )}

        {docs.rate_limiting && (
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-ink-500">
              <span className="uppercase tracking-wider">Free:</span>
              <span>{docs.rate_limiting.free}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-ink-500">
              <span className="uppercase tracking-wider">Pro:</span>
              <span>{docs.rate_limiting.pro}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-ink-500">
              <span className="uppercase tracking-wider">Enterprise:</span>
              <span>{docs.rate_limiting.enterprise}</span>
            </div>
          </div>
        )}
      </div>

      {/* Categories + Endpoints */}
      <div className="space-y-2">
        {filteredCategories.map(category => {
          const isCatExpanded = expandedCategories[category.name] || false;
          return (
            <div key={category.name} className="border border-wire bg-white rounded-sm shadow-sm overflow-hidden">
              <button
                onClick={() => toggleCategory(category.name)}
                className="w-full flex items-center justify-between px-4 py-3 bg-paper hover:bg-wire/20 transition-colors text-left"
              >
                <span className="text-sm font-black text-ink uppercase tracking-wider">
                  {category.name}
                </span>
                {isCatExpanded ? <ChevronUp size={14} className="text-ink-400" /> : <ChevronDown size={14} className="text-ink-400" />}
              </button>

              {isCatExpanded && (
                <div className="divide-y divide-wire">
                  {category.endpoints.map((ep, idx) => {
                    const epId = `${category.name}-${ep.method}-${ep.path}-${idx}`;
                    const isEpExpanded = expandedEndpoints[epId] || false;
                    return (
                      <div key={epId}>
                        <button
                          onClick={() => toggleEndpoint(epId)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-paper/50 transition-colors"
                        >
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm border shrink-0 ${METHOD_COLORS[ep.method] || 'bg-ink-50 text-ink-600 border-ink-200'}`}>
                            {ep.method}
                          </span>
                          <code className="text-xs font-mono font-bold text-ink flex-1 truncate">{ep.path}</code>
                          <span className="text-xs text-ink-400 truncate max-w-[200px] hidden sm:block">{ep.description}</span>
                          {isEpExpanded ? <ChevronUp size={12} className="text-ink-400 shrink-0" /> : <ChevronDown size={12} className="text-ink-400 shrink-0" />}
                        </button>

                        {isEpExpanded && (
                          <div className="px-4 pb-4 pt-2 bg-paper/30 space-y-4 border-t border-wire">
                            <p className="text-xs text-ink-600">{ep.description}</p>

                            {/* Scopes */}
                            {ep.scopes?.length > 0 && (
                              <div>
                                <p className="text-[9px] font-bold uppercase tracking-wider text-ink-400 mb-1">Required Scopes</p>
                                <div className="flex flex-wrap gap-1">
                                  {ep.scopes.map(scope => (
                                    <span key={scope} className="text-[8px] font-bold uppercase bg-ink-50 border border-ink-200 text-ink-600 px-1.5 py-0.5 rounded-sm">
                                      {scope}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Parameters */}
                            {ep.params?.length > 0 && (
                              <div>
                                <p className="text-[9px] font-bold uppercase tracking-wider text-ink-400 mb-2">Parameters</p>
                                <div className="border border-wire rounded-sm overflow-hidden">
                                  <table className="w-full">
                                    <thead>
                                      <tr className="bg-paper border-b border-wire">
                                        <th className="text-left text-[8px] font-bold uppercase tracking-wider text-ink-400 px-3 py-2">Name</th>
                                        <th className="text-left text-[8px] font-bold uppercase tracking-wider text-ink-400 px-3 py-2">Type</th>
                                        <th className="text-left text-[8px] font-bold uppercase tracking-wider text-ink-400 px-3 py-2">Required</th>
                                        <th className="text-left text-[8px] font-bold uppercase tracking-wider text-ink-400 px-3 py-2">Description</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-wire">
                                      {ep.params.map(param => (
                                        <tr key={param.name}>
                                          <td className="px-3 py-2 text-[10px] font-mono font-bold text-ink">{param.name}</td>
                                          <td className="px-3 py-2 text-[10px] text-ink-500">{param.type}</td>
                                          <td className="px-3 py-2">
                                            <span className={`text-[8px] font-bold uppercase ${param.required ? 'text-signal' : 'text-ink-400'}`}>
                                              {param.required ? 'Yes' : 'No'}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2 text-[10px] text-ink-500">{param.description}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* Example Request */}
                            {ep.example_request && (
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-[9px] font-bold uppercase tracking-wider text-ink-400">Example Request</p>
                                  <button
                                    onClick={() => copyCode(ep.example_request, epId)}
                                    className="flex items-center gap-1 text-[9px] font-bold text-ink-400 hover:text-ink transition-colors"
                                  >
                                    {copiedCode === epId ? <Check size={10} /> : <Copy size={10} />}
                                    {copiedCode === epId ? 'Copied' : 'Copy'}
                                  </button>
                                </div>
                                <pre className="bg-ink p-3 rounded-sm text-emerald-400 font-mono text-[10px] overflow-x-auto whitespace-pre-wrap">
                                  {ep.example_request}
                                </pre>
                              </div>
                            )}

                            {/* Example Response */}
                            {ep.example_response && (
                              <div>
                                <p className="text-[9px] font-bold uppercase tracking-wider text-ink-400 mb-1">Example Response</p>
                                <pre className="bg-ink p-3 rounded-sm text-emerald-400 font-mono text-[10px] overflow-x-auto whitespace-pre-wrap">
                                  {JSON.stringify(ep.example_response, null, 2)}
                                </pre>
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
        })}
      </div>

      {/* Base URL */}
      {docs.base_url && (
        <div className="text-center">
          <p className="text-[9px] font-bold uppercase tracking-wider text-ink-400">
            Base URL: <code className="text-ink font-mono">{docs.base_url}</code>
          </p>
        </div>
      )}
    </div>
  );
}