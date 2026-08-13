/**
 * Queue payment completion in RTDB — Cloud Functions process commissions & balances
 */

import { initFirebaseAdmin } from './firebaseAdmin.js';

function db() {
    const app = initFirebaseAdmin();
    return app ? app.firestore() : null;
}

export function isQueueAvailable() {
    return Boolean(db());
}

export async function queueActivationComplete({ paymentId, orderId, ...meta }) {
    const firestore = db();
    if (!firestore) return { success: false, needsClientQueue: true };

    let resolvedPaymentId = paymentId;
    if (!resolvedPaymentId && orderId) {
        const pendingSnap = await firestore.collection('palmpesaPending').doc(orderId).get();
        if (pendingSnap.exists) {
            resolvedPaymentId = pendingSnap.data().paymentId;
        }
    }
    if (!resolvedPaymentId) {
        return { success: false, error: 'Payment record not found' };
    }

    const batch = firestore.batch();
    const paymentRef = firestore.collection('activationPayments').doc(resolvedPaymentId);
    batch.update(paymentRef, {
        palmpesaStatus: 'COMPLETED',
        orderId: orderId || meta.orderId || null,
        transid: meta.transid || '',
        reference: meta.reference || '',
        channel: meta.channel || 'palmpesa',
        msisdn: meta.msisdn || meta.phone || '',
        amountTZS: meta.amountTZS || null,
        palmpesaCompletedAt: Date.now()
    });

    if (orderId) {
        const pendingRef = firestore.collection('palmpesaPending').doc(orderId);
        batch.update(pendingRef, {
            palmpesaStatus: 'COMPLETED',
            status: 'completed'
        });
    }

    await batch.commit();

    return { success: true, queued: true, paymentId: resolvedPaymentId };
}

export async function queueDepositComplete(orderId, meta = {}) {
    const firestore = db();
    if (!firestore) return { success: false, needsClientQueue: true };

    await firestore.collection('palmpesaPending').doc(orderId).update({
        type: 'deposit',
        palmpesaStatus: 'COMPLETED',
        uid: meta.uid,
        amountTZS: meta.amountTZS,
        transid: meta.transid || '',
        reference: meta.reference || '',
        channel: meta.channel || 'palmpesa',
        msisdn: meta.msisdn || '',
        palmpesaCompletedAt: Date.now()
    });

    return { success: true, queued: true, orderId };
}

export async function saveActivationPending(orderId, data) {
    const firestore = db();
    if (!firestore) return null;

    const paymentRef = firestore.collection('activationPayments').doc();
    const paymentId = paymentRef.id;

    const batch = firestore.batch();

    batch.set(paymentRef, {
        uid: data.uid,
        method: 'palmpesa',
        phoneNumber: data.phone || '',
        transactionId: '',
        orderId,
        amount: data.nativeAmount,
        currency: data.nativeCurrency || 'TZS',
        status: 'pending',
        createdAt: Date.now(),
        referenceCode: `NH-${Date.now().toString().slice(-6)}`
    });

    batch.set(firestore.collection('palmpesaPending').doc(orderId), {
        ...data,
        type: 'activation',
        paymentId,
        amountTZS: data.nativeAmount,
        status: 'pending',
        createdAt: Date.now()
    });

    batch.update(firestore.collection('users').doc(data.uid), {
        activationStatus: 'pending',
        activationPaymentId: paymentId
    });

    await batch.commit();

    return { paymentId, nativeAmount: data.nativeAmount };
}

export async function saveDepositPending(orderId, data) {
    const firestore = db();
    if (!firestore) return;

    await firestore.collection('palmpesaPending').doc(orderId).set({
        ...data,
        type: 'deposit',
        status: 'pending',
        createdAt: Date.now()
    });
}
