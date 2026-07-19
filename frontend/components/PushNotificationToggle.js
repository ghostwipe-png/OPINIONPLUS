'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String) {
  if (!base64String) return null;
  try {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  } catch (e) {
    console.error('Invalid VAPID key format:', e);
    return null;
  }
}

export default function PushNotificationToggle() {
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setSupported(false);
      setLoading(false);
      return;
    }
    checkAndAutoSubscribe();
  }, []);

  const checkAndAutoSubscribe = async () => {
    try {
      const res = await fetch(`${API_BASE}/notifications/status`, { credentials: 'include' });
      const data = await res.json();
      if (data.subscribed) { setSubscribed(true); setLoading(false); return; }

      if (Notification.permission === 'granted') {
        await doSubscribe();
      } else if (Notification.permission === 'default') {
        setTimeout(async () => {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') await doSubscribe();
        }, 3000);
      }
    } catch (e) { /* ignore */ }
    setLoading(false);
  };

  const doSubscribe = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      
      const convertedKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      if (!convertedKey) {
        console.error('Invalid VAPID public key');
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey,
      });

      await fetch(`${API_BASE}/notifications/subscribe`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });

      setSubscribed(true);
    } catch (e) {
      console.error('Push subscribe error:', e);
    }
  };

  const toggle = async () => {
    if (subscribed) {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) await subscription.unsubscribe();
        await fetch(`${API_BASE}/notifications/unsubscribe`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } });
        setSubscribed(false);
      } catch (e) { console.error('Push unsubscribe error:', e); }
    } else {
      if (Notification.permission === 'denied') {
        alert('Notifications are blocked. Enable them in your browser settings.');
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission === 'granted') await doSubscribe();
    }
  };

  if (!supported || loading) return null;

  return (
    <button onClick={toggle} className={`text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors ${subscribed ? 'bg-ink text-paper border-ink' : 'border-wire text-ink-600 hover:border-ink'}`}
      title={subscribed ? 'Notifications on' : 'Get breaking news alerts'}>
      {subscribed ? <Bell size={13} /> : <BellOff size={13} />}
      {subscribed ? 'Alerts on' : 'Alerts'}
    </button>
  );
}