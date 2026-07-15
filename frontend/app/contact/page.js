'use client';

import { useState } from 'react';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sent, setSent] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    // No email backend is wired up yet — this opens the visitor's mail
    // client as a working fallback. Swap for a Resend/SendGrid call from
    // the Worker once Phase 2 email is set up (see README).
    const subject = encodeURIComponent(`OpinionPlus contact — ${form.name}`);
    const body = encodeURIComponent(`${form.message}\n\n— ${form.name} (${form.email})`);
    window.location.href = `mailto:hello@opinionplus.example?subject=${subject}&body=${body}`;
    setSent(true);
  };

  return (
    <div className="max-w-lg mx-auto px-5 py-16">
      <p className="wire-tag mb-3">Contact</p>
      <h1 className="editorial-h text-4xl font-bold mb-4">Talk to us.</h1>
      <p className="text-sm text-ink-600 mb-8">
        Questions, takedown requests, partnership ideas — this reaches a person, not a queue.
      </p>

      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className="wire-tag block mb-1">Name</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full border-b border-wire focus:border-ink outline-none py-2"
          />
        </div>
        <div>
          <label className="wire-tag block mb-1">Email</label>
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="w-full border-b border-wire focus:border-ink outline-none py-2"
          />
        </div>
        <div>
          <label className="wire-tag block mb-1">Message</label>
          <textarea
            required
            rows={5}
            value={form.message}
            onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            className="w-full border-b border-wire focus:border-ink outline-none py-2 resize-none"
          />
        </div>
        <button type="submit" className="btn-primary px-5 py-2.5 rounded-sm text-sm">
          Send message
        </button>
        {sent && <p className="text-xs text-ink-400">Opening your mail client…</p>}
      </form>

      <p className="text-xs text-ink-400 mt-8">
        Or write to us directly at{' '}
        <a href="mailto:hello@opinionplus.example" className="underline">
          hello@opinionplus.example
        </a>
        .
      </p>
    </div>
  );
}
