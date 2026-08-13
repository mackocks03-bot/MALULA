/**
 * Shop deposit payments — PalmPesa (Tanzania)
 */

import { auth } from './firebase-config.js';

async function authHeaders() {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    const token = await user.getIdToken();
    return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

export async function getPalmpesaConfig() {
    const res = await fetch('/api/deposits/palmpesa/config');
    if (!res.ok) throw new Error('Could not load payment config');
    return res.json();
}

export async function initiatePalmpesaDeposit({ phone, amount, name, email, country }) {
    const headers = await authHeaders();
    const res = await fetch('/api/deposits/palmpesa/initiate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone, amount, name, email, country })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to start PalmPesa payment');
    }
    return data;
}

export async function checkPalmpesaDepositStatus(orderId, amount) {
    const headers = await authHeaders();
    const query = amount ? `?amount=${encodeURIComponent(amount)}` : '';
    const res = await fetch(`/api/deposits/palmpesa/status/${encodeURIComponent(orderId)}${query}`, {
        headers
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to check payment status');
    }
    return data;
}

export function pollPalmpesaStatus(orderId, amount, { intervalMs = 3000, maxAttempts = 40, onUpdate } = {}) {
    let attempts = 0;
    let stopped = false;

    const stop = () => { stopped = true; };

    const run = async () => {
        while (!stopped && attempts < maxAttempts) {
            attempts += 1;
            try {
                const result = await checkPalmpesaDepositStatus(orderId, amount);
                onUpdate?.(result);
                if (result.status === 'COMPLETED') return result;
                if (result.status === 'FAILED' || result.status === 'CANCELLED') {
                    throw new Error('Payment was not completed');
                }
            } catch (error) {
                if (attempts >= maxAttempts) throw error;
            }
            await new Promise(r => setTimeout(r, intervalMs));
        }
        throw new Error('Payment timed out. If you completed the PIN prompt, refresh your wallet.');
    };

    return { promise: run(), stop };
}

// ── Activation (account opening fee) ──

export async function getActivationPalmpesaConfig() {
    const res = await fetch('/api/activation/palmpesa/config');
    if (!res.ok) throw new Error('Could not load activation payment config');
    return res.json();
}

export async function initiatePalmpesaActivation({ phone, name, email, country }) {
    const headers = await authHeaders();
    const res = await fetch('/api/activation/palmpesa/initiate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone, name, email, country })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to start activation payment');
    }
    return data;
}

export async function checkPalmpesaActivationStatus(orderId, amount) {
    const headers = await authHeaders();
    const query = amount ? `?amount=${encodeURIComponent(amount)}` : '';
    const res = await fetch(`/api/activation/palmpesa/status/${encodeURIComponent(orderId)}${query}`, {
        headers
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to check activation payment');
    }
    return data;
}

export function pollPalmpesaActivationStatus(orderId, amount, options = {}) {
    let attempts = 0;
    let stopped = false;
    const { intervalMs = 3000, maxAttempts = 40, onUpdate } = options;
    const stop = () => { stopped = true; };

    const run = async () => {
        while (!stopped && attempts < maxAttempts) {
            attempts += 1;
            try {
                const result = await checkPalmpesaActivationStatus(orderId, amount);
                onUpdate?.(result);
                if (result.status === 'COMPLETED') return result;
                if (result.status === 'FAILED' || result.status === 'CANCELLED') {
                    throw new Error('Payment was not completed');
                }
            } catch (error) {
                if (attempts >= maxAttempts) throw error;
            }
            await new Promise(r => setTimeout(r, intervalMs));
        }
        throw new Error('Payment timed out. If you approved on your phone, wait a moment and try again.');
    };

    return { promise: run(), stop };
}
