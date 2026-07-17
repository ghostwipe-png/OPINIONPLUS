'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, Send, Plus, Trash2, Phone, CreditCard, History, X, AlertTriangle, CheckCircle, ShoppingCart } from 'lucide-react';
import BuyCreditsModal from './BuyCreditsModal';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
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

  useEffect(() => {
    loadData();
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

  const TABS = [
    { id: 'send', label: 'Send SMS', icon: Send },
    { id: 'contacts', label: 'Contacts', icon: Phone },
    { id: 'history', label: 'History', icon: History },
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

      {/* Tabs */}
      <div className="flex gap-2 mb-6 text-xs font-semibold">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-sm border flex items-center gap-1.5 ${
              tab === t.id ? 'bg-ink text-paper border-ink' : 'border-wire text-ink-600'
            }`}
          >
            <t.icon size={12} /> {t.label}
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
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your SMS message..."
            rows={3}
            maxLength={480}
            className="w-full border border-wire rounded-sm px-3 py-2 text-sm resize-none"
          />
          <p className="text-xs text-ink-400">
            {message.length}/480 characters ({Math.ceil(message.length / 160)} SMS)
            {credits < 1 && (
              <span className="text-signal ml-2 font-semibold">
                — You have 0 credits. 
                <button onClick={() => setShowBuyCredits(true)} className="underline ml-1">Buy credits</button>
              </span>
            )}
          </p>

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

          <button
            onClick={sendSms}
            disabled={sending || !message.trim() || selectedContacts.length === 0 || credits < selectedContacts.length}
            className="btn-primary px-5 py-2.5 rounded-sm text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <Send size={14} /> {sending ? 'Sending...' : `Send (${selectedContacts.length} SMS — ${selectedContacts.length} credit${selectedContacts.length !== 1 ? 's' : ''})`}
          </button>
        </div>
      )}

      {/* Contacts Tab */}
      {tab === 'contacts' && !loading && (
        <div className="space-y-4">
          <div className="flex gap-2 max-w-md">
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
                  <p className="text-sm mb-1">{h.message}</p>
                  <p className="text-xs text-ink-400">
                    To: {h.recipients} · {h.recipient_count} recipient{h.recipient_count !== 1 ? 's' : ''} · {h.cost} credit{h.cost !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-ink-400">
                    {new Date(h.created_at).toLocaleString()} · Status: <span className={`font-semibold ${h.status === 'sent' || h.status === 'delivered' ? 'text-ink-600' : 'text-signal'}`}>{h.status}</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}