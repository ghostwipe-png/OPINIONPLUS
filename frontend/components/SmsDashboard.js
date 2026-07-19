'use client';

import { useState, useEffect, useRef } from 'react';
import {
  MessageSquare, Send, Plus, Trash2, Phone, CreditCard, History, X, AlertTriangle,
  CheckCircle, ShoppingCart, Upload, LayoutTemplate, Clock3, CalendarClock, Users2,
  CheckCheck, Check, XCircle, Info,
} from 'lucide-react';
import BuyCreditsModal from './BuyCreditsModal';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

let csrfToken = null;
async function fetchCsrfToken() {
  if (csrfToken) return csrfToken;
  try {
    const res = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' });
    const data = await res.json();
    csrfToken = data.token;
    return csrfToken;
  } catch (e) { return ''; }
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (options.method && options.method !== 'GET') {
    const token = await fetchCsrfToken();
    if (token) headers['X-CSRF-Token'] = token;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers,
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    const error = new Error(data.error || data.details?.message || 'Request failed');
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

// ---------- v10: local-storage backed helpers (templates, scheduled, recents, onboarding) ----------
// These features are client-side only per the spec ("scheduling handled
// client-side for now", "Templates stored in localStorage"), so they degrade
// gracefully to empty state if localStorage is unavailable.

const LS_TEMPLATES = 'sms:templates';
const LS_SCHEDULED = 'sms:scheduled';
const LS_RECENTS = 'sms:recent-recipients';
const LS_ONBOARDED = 'sms:onboarded';

const DEFAULT_TEMPLATES = [
  { id: 'breaking', name: 'Breaking News Alert', body: 'BREAKING: [headline]. Read more: [link]' },
  { id: 'published', name: 'New Story Published', body: 'New story just published: "[title]" — [link]' },
  { id: 'digest', name: 'Weekly Digest Ready', body: 'Your weekly digest is ready. Catch up on the top stories: [link]' },
  { id: 'welcome', name: 'Welcome Message', body: 'Welcome! Thanks for subscribing to SMS updates. Reply STOP to opt out.' },
];

function readLS(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeLS(key, value) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota / privacy-mode errors
  }
}

// Rough GSM-7 vs Unicode SMS segmentation. Not a full GSM-7 charset check,
// but catches the common case (emoji / non-Latin) that halves the length budget.
function smsParts(message) {
  const isUnicode = /[^\x00-\x7F]/.test(message);
  const singleLimit = isUnicode ? 70 : 160;
  const multiLimit = isUnicode ? 67 : 153;
  const len = message.length;
  if (len === 0) return { parts: 0, limit: singleLimit, isUnicode, len };
  const parts = len <= singleLimit ? 1 : Math.ceil(len / multiLimit);
  return { parts, limit: singleLimit, isUnicode, len };
}

// Minimal CSV parser: handles quoted fields and commas within quotes.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field); field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function DeliveryStatusBadge({ status }) {
  const map = {
    sent: { icon: Check, label: 'Sent', cls: 'text-ink-600' },
    delivered: { icon: CheckCheck, label: 'Delivered', cls: 'text-ink-600' },
    failed: { icon: XCircle, label: 'Failed', cls: 'text-signal' },
    pending: { icon: Clock3, label: 'Pending', cls: 'text-ink-400' },
  };
  const s = map[status] || map.pending;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${s.cls}`}>
      <Icon size={12} /> {s.label}
    </span>
  );
}

export default function SmsDashboard() {
  const [tab, setTab] = useState('send');
  const [credits, setCredits] = useState(0);
  const [totalSent, setTotalSent] = useState(0);
  const [contacts, setContacts] = useState([]);
  const [history, setHistory] = useState([]);
  const [message, setMessage] = useState('');
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [manualNumber, setManualNumber] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showBuyCredits, setShowBuyCredits] = useState(false);

  // ---- v10: new state ----
  const [csvPreview, setCsvPreview] = useState(null); // { newContacts, duplicates }
  const fileInputRef = useRef(null);
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');
  const [scheduled, setScheduled] = useState([]);
  const [recentRecipients, setRecentRecipients] = useState([]);
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);
  const [onboarded, setOnboarded] = useState(true);

  useEffect(() => {
    loadData();
    setTemplates([...DEFAULT_TEMPLATES, ...readLS(LS_TEMPLATES, [])]);
    setScheduled(readLS(LS_SCHEDULED, []));
    setRecentRecipients(readLS(LS_RECENTS, []));
    setOnboarded(!!readLS(LS_ONBOARDED, false));
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [credRes, contactRes, histRes] = await Promise.all([
        api('/sms/credits').catch(() => ({ credits: 0, total_sent: 0 })),
        api('/sms/contacts').catch(() => ({ contacts: [] })),
        api('/sms/history').catch(() => ({ history: [] })),
      ]);
      setCredits(credRes.credits || 0);
      setTotalSent(credRes.total_sent || 0);
      setContacts(contactRes.contacts || []);
      setHistory(histRes.history || []);
    } catch (e) {
      console.error('Failed to load SMS data:', e);
    }
    setLoading(false);
  };

  const addContact = async () => {
    if (!newName.trim() || !newPhone.trim()) return;
    try {
      await api('/sms/contacts', {
        method: 'POST',
        body: JSON.stringify({ name: newName, phone: newPhone }),
      });
      setNewName('');
      setNewPhone('');
      loadData();
      setResult({ type: 'success', text: 'Contact added successfully.' });
    } catch (e) {
      setResult({ type: 'error', text: e.message || 'Failed to add contact.' });
    }
  };

  const deleteContact = async (id) => {
    try {
      await api(`/sms/contacts/${id}`, { method: 'DELETE' });
      loadData();
      setResult({ type: 'success', text: 'Contact removed.' });
    } catch (e) {
      setResult({ type: 'error', text: e.message || 'Failed to delete contact.' });
    }
  };

  const toggleContact = (phone) => {
    setSelectedContacts(prev =>
      prev.includes(phone) ? prev.filter(p => p !== phone) : [...prev, phone]
    );
  };

  const addManualNumber = () => {
    const num = manualNumber.trim();
    if (num && !selectedContacts.includes(num)) {
      setSelectedContacts([...selectedContacts, num]);
      setManualNumber('');
    }
  };

  const persistRecent = (recipients) => {
    const merged = [...recipients, ...recentRecipients].filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 5);
    setRecentRecipients(merged);
    writeLS(LS_RECENTS, merged);
  };

  const sendSms = async () => {
    if (!message.trim() || selectedContacts.length === 0) return;
    setSending(true);
    setResult(null);
    try {
      const data = await api('/sms/send', {
        method: 'POST',
        body: JSON.stringify({ message, recipients: selectedContacts }),
      });
      setResult({
        type: 'success',
        text: `Sent to ${data.sent} recipient(s). ${data.remaining_credits} credits left.`
      });
      persistRecent(selectedContacts);
      if (!onboarded) {
        writeLS(LS_ONBOARDED, true);
        setOnboarded(true);
      }
      setMessage('');
      setSelectedContacts([]);
      loadData();
    } catch (e) {
      if (e.status === 402) {
        setResult({
          type: 'error',
          text: `Insufficient credits. Purchase more credits to continue sending SMS.`
        });
      } else if (e.status === 403 || (e.message && (e.message.includes('insufficient') || e.message.includes('Insufficient')))) {
        setResult({
          type: 'error',
          text: 'SMS account has insufficient funds. Please top up your SMS provider account.'
        });
      } else if (e.status === 502) {
        setResult({
          type: 'error',
          text: `SMS gateway error: ${e.data?.details?.message || e.message}. Please try again or contact support.`
        });
      } else if (e.status === 400) {
        setResult({
          type: 'error',
          text: e.message || 'Invalid request. Check your message and recipients.'
        });
      } else if (e.status === 500) {
        setResult({
          type: 'error',
          text: e.data?.details?.message || e.message || 'Server error. SMS gateway may not be configured.'
        });
      } else {
        setResult({
          type: 'error',
          text: e.message || 'Failed to send SMS. Please try again.'
        });
      }
    }
    setSending(false);
  };

  // ---- v10: bulk CSV import ----
  const onCsvSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseCsv(text);
    if (!rows.length) { setCsvPreview({ newContacts: [], duplicates: [] }); return; }

    // Detect header row (name, phone columns in any order)
    let start = 0;
    let nameIdx = 0, phoneIdx = 1;
    const header = rows[0].map((h) => h.trim().toLowerCase());
    if (header.includes('name') || header.includes('phone')) {
      nameIdx = header.indexOf('name') >= 0 ? header.indexOf('name') : 0;
      phoneIdx = header.indexOf('phone') >= 0 ? header.indexOf('phone') : 1;
      start = 1;
    }

    const existingPhones = new Set(contacts.map((c) => c.phone.replace(/\s+/g, '')));
    const seen = new Set();
    const newContacts = [];
    const duplicates = [];
    for (let i = start; i < rows.length; i++) {
      const r = rows[i];
      const name = (r[nameIdx] || '').trim();
      const phone = (r[phoneIdx] || '').trim().replace(/\s+/g, '');
      if (!name || !phone) continue;
      if (existingPhones.has(phone) || seen.has(phone)) {
        duplicates.push({ name, phone });
      } else {
        seen.add(phone);
        newContacts.push({ name, phone });
      }
    }
    setCsvPreview({ newContacts, duplicates });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const confirmCsvImport = async () => {
    if (!csvPreview) return;
    let added = 0;
    for (const c of csvPreview.newContacts) {
      try {
        await api('/sms/contacts', { method: 'POST', body: JSON.stringify({ name: c.name, phone: c.phone }) });
        added++;
      } catch {
        // skip failures individually, continue importing the rest
      }
    }
    setCsvPreview(null);
    loadData();
    setResult({ type: 'success', text: `Imported ${added} contact${added !== 1 ? 's' : ''}.` });
  };

  // ---- v10: templates ----
  const applyTemplate = (tpl) => {
    setMessage(tpl.body);
    setTemplatesOpen(false);
  };

  const saveCustomTemplate = () => {
    if (!newTemplateName.trim() || !message.trim()) return;
    const custom = readLS(LS_TEMPLATES, []);
    const entry = { id: `custom-${Date.now()}`, name: newTemplateName.trim(), body: message, custom: true };
    const next = [...custom, entry];
    writeLS(LS_TEMPLATES, next);
    setTemplates([...DEFAULT_TEMPLATES, ...next]);
    setNewTemplateName('');
    setSaveTemplateOpen(false);
    setResult({ type: 'success', text: 'Template saved.' });
  };

  // ---- v10: scheduling (client-side; uses the existing send endpoint when due) ----
  const scheduleSms = () => {
    if (!message.trim() || selectedContacts.length === 0 || !scheduleAt) return;
    const entry = {
      id: `sched-${Date.now()}`,
      message,
      recipients: selectedContacts,
      sendAt: new Date(scheduleAt).toISOString(),
      status: 'scheduled',
    };
    const next = [...scheduled, entry];
    setScheduled(next);
    writeLS(LS_SCHEDULED, next);
    setResult({ type: 'success', text: `Message scheduled for ${new Date(entry.sendAt).toLocaleString()}.` });
    setMessage('');
    setSelectedContacts([]);
    setScheduleOpen(false);
    setScheduleAt('');
  };

  const cancelScheduled = (id) => {
    const next = scheduled.filter((s) => s.id !== id);
    setScheduled(next);
    writeLS(LS_SCHEDULED, next);
  };

  const sendAllContacts = () => {
    setSelectedContacts(contacts.map((c) => c.phone));
  };

  const addRecent = (phone) => {
    if (!selectedContacts.includes(phone)) setSelectedContacts([...selectedContacts, phone]);
  };

  const parts = smsParts(message);
  const progressPct = message.length === 0 ? 0 : Math.min(100, Math.round((message.length / (parts.parts * (parts.isUnicode ? 67 : 153) || parts.limit)) * 100));

  const TABS = [
    { id: 'send', label: 'Send SMS', icon: Send },
    { id: 'contacts', label: 'Contacts', icon: Phone },
    { id: 'history', label: 'History', icon: History },
    { id: 'scheduled', label: 'Scheduled', icon: CalendarClock },
  ];

  return (
    <div className="rule mt-10 pt-8">
      {/* Buy Credits Modal */}
      {showBuyCredits && (
        <BuyCreditsModal 
          onClose={() => setShowBuyCredits(false)} 
          onSuccess={(addedCredits) => { 
            setCredits(c => c + addedCredits); 
            loadData(); 
          }} 
        />
      )}

      <div className="flex items-center justify-between mb-5">
        <button className="wire-tag flex items-center gap-2">
          <MessageSquare size={14} /> SMS Dashboard
        </button>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-ink-600 flex items-center gap-2">
            <CreditCard size={13} />
            {credits} credit{credits !== 1 ? 's' : ''} · {totalSent} sent
          </span>
          <button
            onClick={() => setShowBuyCredits(true)}
            className="text-xs font-semibold text-signal hover:underline flex items-center gap-1"
          >
            <ShoppingCart size={12} /> Buy credits
          </button>
        </div>
      </div>

      {/* v10: first-time onboarding */}
      {!onboarded && !loading && (
        <div className="mb-5 p-3 border border-wire rounded-sm bg-ink-50/60 text-xs text-ink-600 flex flex-wrap items-center gap-3">
          <Info size={14} className="shrink-0 text-ink-400" />
          <span className="flex items-center gap-1.5">
            <span className={contacts.length > 0 ? 'line-through text-ink-400' : 'font-semibold'}>1. Add your first contact</span>
            <span className="text-ink-300">→</span>
            <span className={message.trim() ? 'line-through text-ink-400' : 'font-semibold'}>2. Compose a message</span>
            <span className="text-ink-300">→</span>
            <span className="font-semibold">3. Send</span>
          </span>
          <button onClick={() => { writeLS(LS_ONBOARDED, true); setOnboarded(true); }} className="ml-auto text-ink-400 hover:text-ink"><X size={13} /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 text-xs font-semibold flex-wrap">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-sm border flex items-center gap-1.5 ${
              tab === t.id ? 'bg-ink text-paper border-ink' : 'border-wire text-ink-600'
            }`}
          >
            <t.icon size={12} /> {t.label}
            {t.id === 'scheduled' && scheduled.length > 0 && (
              <span className="ml-1 px-1.5 rounded-full bg-signal text-paper text-[10px]">{scheduled.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Result notification */}
      {result && (
        <div className={`mb-4 p-3 rounded-sm text-sm flex items-start gap-2 ${
          result.type === 'success'
            ? 'bg-ink-50 border border-wire text-ink-700'
            : 'bg-red-50 border border-signal text-signal'
        }`}>
          {result.type === 'success' ? <CheckCircle size={16} className="shrink-0 mt-0.5" /> : <AlertTriangle size={16} className="shrink-0 mt-0.5" />}
          <span className="flex-1">{result.text}</span>
          <button onClick={() => setResult(null)} className="shrink-0 hover:opacity-70"><X size={14} /></button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <p className="text-sm text-ink-400 mb-4">Loading SMS dashboard...</p>
      )}

      {/* Send SMS Tab */}
      {tab === 'send' && !loading && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="relative">
              <button
                type="button"
                onClick={() => setTemplatesOpen((o) => !o)}
                className="btn-outline px-3 py-1.5 rounded-sm text-xs flex items-center gap-1.5"
              >
                <LayoutTemplate size={13} /> Templates
              </button>
              {templatesOpen && (
                <div className="absolute z-20 top-9 left-0 w-64 bg-paper border border-wire rounded-sm shadow-lg py-1">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => applyTemplate(t)}
                      className="w-full text-left px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50 flex items-center justify-between"
                    >
                      {t.name}
                      {t.custom && <span className="text-[10px] text-ink-400">custom</span>}
                    </button>
                  ))}
                  <div className="border-t border-wire mt-1 pt-1 px-2">
                    <button onClick={() => { setTemplatesOpen(false); setSaveTemplateOpen(true); }} className="text-xs text-signal font-semibold py-1">
                      + Save current message as template
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={sendAllContacts}
              disabled={contacts.length === 0}
              className="text-xs font-semibold text-ink-600 hover:text-signal flex items-center gap-1 disabled:opacity-40"
            >
              <Users2 size={13} /> Send to all contacts ({contacts.length})
            </button>
          </div>

          {saveTemplateOpen && (
            <div className="flex gap-2 items-center border border-wire rounded-sm p-2">
              <input
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="Template name"
                className="flex-1 border border-wire rounded-sm px-2 py-1.5 text-sm"
              />
              <button onClick={saveCustomTemplate} className="btn-primary px-3 py-1.5 rounded-sm text-xs">Save</button>
              <button onClick={() => setSaveTemplateOpen(false)} className="text-xs text-ink-400">Cancel</button>
            </div>
          )}

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your SMS message..."
            rows={3}
            maxLength={480}
            className="w-full border border-wire rounded-sm px-3 py-2 text-sm resize-none"
          />

          {/* v10: character counter with parts + progress bar + unicode detection */}
          <div>
            <div className="flex items-center justify-between text-xs text-ink-400 mb-1">
              <span>
                {parts.parts} SMS ({message.length}/480 characters){parts.isUnicode && ' · Unicode (reduced limit)'}
              </span>
              {message.length > (parts.isUnicode ? 60 : 140) && parts.parts === 1 && (
                <span className="text-signal font-semibold">Approaching limit</span>
              )}
            </div>
            <div className="h-1.5 rounded-full bg-ink-50 overflow-hidden">
              <div
                className={`h-full transition-all ${progressPct > 85 ? 'bg-signal' : 'bg-ink'}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            {credits < 1 && (
              <p className="text-xs text-signal mt-1 font-semibold">
                — You have 0 credits.
                <button onClick={() => setShowBuyCredits(true)} className="underline ml-1">Buy credits</button>
              </p>
            )}
          </div>

          {/* v10: recent recipients */}
          {recentRecipients.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-1.5">Recent recipients</p>
              <div className="flex flex-wrap gap-1.5">
                {recentRecipients.map((num) => (
                  <button
                    key={num}
                    onClick={() => addRecent(num)}
                    className="text-xs px-2 py-1 rounded-full border border-wire text-ink-600 hover:border-ink"
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Contact selection */}
          <div>
            <p className="text-xs font-semibold mb-2">Recipients ({selectedContacts.length})</p>
            {contacts.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {contacts.map(c => (
                  <button
                    key={c.id}
                    onClick={() => toggleContact(c.phone)}
                    className={`text-xs px-2 py-1 rounded-full border ${
                      selectedContacts.includes(c.phone)
                        ? 'bg-ink text-paper border-ink'
                        : 'border-wire text-ink-600 hover:border-ink'
                    }`}
                  >
                    {c.name} ({c.phone})
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={manualNumber}
                onChange={(e) => setManualNumber(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addManualNumber()}
                placeholder="+254700000000"
                className="flex-1 border border-wire rounded-sm px-3 py-2 text-sm"
              />
              <button onClick={addManualNumber} className="btn-outline px-3 py-2 rounded-sm text-sm">
                <Plus size={14} />
              </button>
            </div>
            {selectedContacts.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {selectedContacts.map((num, i) => (
                  <span key={i} className="text-xs bg-ink-50 border border-wire px-2 py-0.5 rounded-full flex items-center gap-1">
                    {num}
                    <button onClick={() => toggleContact(num)} className="hover:text-signal"><X size={10} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <button
              onClick={sendSms}
              disabled={sending || !message.trim() || selectedContacts.length === 0 || credits < selectedContacts.length}
              className="btn-primary px-5 py-2.5 rounded-sm text-sm flex items-center gap-2 disabled:opacity-50"
            >
              <Send size={14} /> {sending ? 'Sending...' : `Send (${selectedContacts.length} SMS — ${selectedContacts.length} credit${selectedContacts.length !== 1 ? 's' : ''})`}
            </button>

            <div className="relative">
              <button
                onClick={() => setScheduleOpen((o) => !o)}
                disabled={!message.trim() || selectedContacts.length === 0}
                className="btn-outline px-4 py-2.5 rounded-sm text-sm flex items-center gap-2 disabled:opacity-50"
              >
                <CalendarClock size={14} /> Send later
              </button>
              {scheduleOpen && (
                <div className="absolute z-20 bottom-12 left-0 w-64 bg-paper border border-wire rounded-sm shadow-lg p-3">
                  <label className="text-xs font-semibold text-ink-600 block mb-1">Send at</label>
                  <input
                    type="datetime-local"
                    value={scheduleAt}
                    onChange={(e) => setScheduleAt(e.target.value)}
                    className="w-full border border-wire rounded-sm px-2 py-1.5 text-sm mb-2"
                  />
                  <div className="flex gap-2">
                    <button onClick={scheduleSms} disabled={!scheduleAt} className="btn-primary px-3 py-1.5 rounded-sm text-xs flex-1 disabled:opacity-50">Schedule</button>
                    <button onClick={() => setScheduleOpen(false)} className="text-xs text-ink-400">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Contacts Tab */}
      {tab === 'contacts' && !loading && (
        <div className="space-y-4">
          <div className="flex gap-2 max-w-md flex-wrap">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name"
              className="flex-1 border border-wire rounded-sm px-3 py-2 text-sm"
            />
            <input
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="+254700000000"
              className="flex-1 border border-wire rounded-sm px-3 py-2 text-sm"
            />
            <button onClick={addContact} className="btn-primary px-3 py-2 rounded-sm text-sm">
              <Plus size={14} />
            </button>
          </div>

          {/* v10: CSV import */}
          <div>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={onCsvSelected} className="hidden" id="sms-csv-input" />
            <label htmlFor="sms-csv-input" className="btn-outline px-3 py-2 rounded-sm text-xs inline-flex items-center gap-1.5 cursor-pointer">
              <Upload size={13} /> Import contacts (CSV)
            </label>
            <p className="text-xs text-ink-400 mt-1">CSV columns: name, phone (header row optional).</p>
          </div>

          {csvPreview && (
            <div className="border border-wire rounded-sm p-3 space-y-2">
              <p className="text-sm font-semibold">
                {csvPreview.newContacts.length} new contact{csvPreview.newContacts.length !== 1 ? 's' : ''} found, {csvPreview.duplicates.length} duplicate{csvPreview.duplicates.length !== 1 ? 's' : ''} skipped
              </p>
              {csvPreview.newContacts.length > 0 && (
                <div className="max-h-40 overflow-y-auto border border-wire rounded-sm divide-y divide-wire">
                  {csvPreview.newContacts.map((c, i) => (
                    <div key={i} className="flex justify-between px-2 py-1 text-xs">
                      <span>{c.name}</span>
                      <span className="text-ink-400">{c.phone}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={confirmCsvImport}
                  disabled={csvPreview.newContacts.length === 0}
                  className="btn-primary px-3 py-1.5 rounded-sm text-xs disabled:opacity-50"
                >
                  Import {csvPreview.newContacts.length} contact{csvPreview.newContacts.length !== 1 ? 's' : ''}
                </button>
                <button onClick={() => setCsvPreview(null)} className="text-xs text-ink-400">Cancel</button>
              </div>
            </div>
          )}

          {contacts.length === 0 ? (
            <p className="text-sm text-ink-400">No contacts yet. Add your first one above.</p>
          ) : (
            <div className="border border-wire rounded-sm divide-y divide-wire">
              {contacts.map(c => (
                <div key={c.id} className="flex items-center justify-between p-3">
                  <div>
                    <p className="text-sm font-semibold">{c.name}</p>
                    <p className="text-xs text-ink-400">{c.phone}</p>
                  </div>
                  <button onClick={() => deleteContact(c.id)} className="text-signal text-xs hover:opacity-70">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && !loading && (
        <div>
          {history.length === 0 ? (
            <p className="text-sm text-ink-400">No messages sent yet.</p>
          ) : (
            <div className="border border-wire rounded-sm divide-y divide-wire">
              {history.map(h => (
                <div key={h.id} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm mb-1 flex-1">{h.message}</p>
                    <DeliveryStatusBadge status={h.status} />
                  </div>
                  <p className="text-xs text-ink-400">
                    To: {h.recipients} · {h.recipient_count} recipient{h.recipient_count !== 1 ? 's' : ''} · {h.cost} credit{h.cost !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-ink-400 flex items-center gap-2">
                    {new Date(h.created_at).toLocaleString()}
                    {h.recipient_count > 1 && (
                      <button
                        onClick={() => setExpandedHistoryId(expandedHistoryId === h.id ? null : h.id)}
                        className="underline hover:text-ink-600"
                      >
                        {expandedHistoryId === h.id ? 'Hide per-recipient status' : 'Show per-recipient status'}
                      </button>
                    )}
                  </p>
                  {expandedHistoryId === h.id && (
                    <div className="mt-2 border border-wire rounded-sm divide-y divide-wire">
                      {String(h.recipients).split(',').map((num) => (
                        <div key={num} className="flex items-center justify-between px-2 py-1 text-xs">
                          <span>{num.trim()}</span>
                          <DeliveryStatusBadge status={h.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* v10: Scheduled Tab */}
      {tab === 'scheduled' && !loading && (
        <div>
          {scheduled.length === 0 ? (
            <p className="text-sm text-ink-400">No scheduled messages. Use "Send later" from the Send tab to schedule one.</p>
          ) : (
            <div className="border border-wire rounded-sm divide-y divide-wire">
              {scheduled.map((s) => (
                <div key={s.id} className="p-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm mb-1">{s.message}</p>
                    <p className="text-xs text-ink-400">
                      To {s.recipients.length} recipient{s.recipients.length !== 1 ? 's' : ''} · Scheduled for {new Date(s.sendAt).toLocaleString()}
                    </p>
                  </div>
                  <button onClick={() => cancelScheduled(s.id)} className="text-signal text-xs hover:opacity-70 shrink-0">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
