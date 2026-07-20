'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String) {
  if (!base64String || typeof base64String !== 'string') return null;
  try {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  } catch (e) {
    console.warn('VAPID key conversion skipped: Invalid key format.');
    return null;
  }
}

export default function PushNotificationToggle() {
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [supported, setSupported] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      setSupported(false);
      setLoading(false);
      return;
    }
    checkSubscriptionStatus();
  }, []);

  const checkSubscriptionStatus = async () => {
    try {
      const registration = await navigator.serviceWorker.ready.catch(() => null);
      if (registration && registration.pushManager) {
        const existingSub = await registration.pushManager.getSubscription();
        if (existingSub) {
          setSubscribed(true);
        }
      }

      // Safe quiet check to backend status
      const res = await fetch(`${API_BASE}/notifications/status`, { credentials: 'include' }).catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        if (data?.subscribed) {
          setSubscribed(true);
        }
      }
    } catch (e) {
      // Suppress unhandled network or auth errors silently in background check
    } finally {
      setLoading(false);
    }
  };

  const toggle = async () => {
    if (processing) return;
    setProcessing(true);

    try {
      if (subscribed) {
        // Unsubscribe Flow
        const registration = await navigator.serviceWorker.ready.catch(() => null);
        if (registration && registration.pushManager) {
          const subscription = await registration.pushManager.getSubscription();
          if (subscription) {
            await subscription.unsubscribe();
          }
        }
        await fetch(`${API_BASE}/notifications/unsubscribe`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        }).catch(() => {});
        
        setSubscribed(false);
      } else {
        // Subscribe Flow
        if (!VAPID_PUBLIC_KEY) {
          alert('Push notifications are not configured yet (Missing VAPID public key).');
          setProcessing(false);
          return;
        }

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          if (permission === 'denied') {
            alert('Notifications are blocked by your browser settings. Please enable them manually in your browser address bar/settings.');
          }
          setProcessing(false);
          return;
        }

        let registration = await navigator.serviceWorker.ready.catch(() => null);
        if (!registration) {
          registration = await navigator.serviceWorker.register('/sw.js').catch(() => null);
        }

        if (!registration || !registration.pushManager) {
          throw new Error('Service Worker push manager is unavailable.');
        }

        const convertedKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        if (!convertedKey) {
          throw new Error('Invalid VAPID public key configuration.');
        }

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey,
        });

        const subRes = await fetch(`${API_BASE}/notifications/subscribe`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription.toJSON()),
        });

        if (!subRes.ok) {
          throw new Error('Failed to sync notification subscription with server.');
        }

        setSubscribed(true);
      }
    } catch (e) {
      console.error('Push notification action failed:', e.message || e);
      alert('Could not update notification preferences. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  if (!supported || loading) return null;

  return (
    <button 
      onClick={toggle} 
      disabled={processing}
      className={`text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors disabled:opacity-50 ${
        subscribed 
          ? 'bg-ink text-paper border-ink' 
          : 'border-wire text-ink-600 hover:border-ink'
      }`}
      title={subscribed ? 'Notifications enabled' : 'Click to enable breaking news alerts'}
    >
      {processing ? (
        <Loader2 size={13} className="animate-spin text-signal" />
      ) : subscribed ? (
        <Bell size={13} />
      ) : (
        <BellOff size={13} />
      )}
      {processing ? 'Processing...' : subscribed ? 'Alerts On' : 'Alerts'}
    </button>
  );
}