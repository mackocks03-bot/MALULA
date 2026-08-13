/**
 * Optional Firebase Admin — used to credit shop balance after verified PalmPesa payments
 */

import admin from 'firebase-admin';

let ready = false;


export function isFirebaseAdminConfigured() {
    return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
}

export function initFirebaseAdmin() {
    if (ready) return admin;
    const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!json) return null;

    const databaseURL = process.env.FIREBASE_DATABASE_URL
        || 'https://xxxx-connection-default-rtdb.firebaseio.com';

    admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(json)),
        databaseURL
    });
    ready = true;
    return admin;
}

export async function verifyIdToken(idToken) {
    if (!idToken) return null;

    const app = initFirebaseAdmin();
    if (app) {
        try {
            return await app.auth().verifyIdToken(idToken);
        } catch (err) {
            console.warn('[verifyIdToken] Firebase Admin failed:', err.message);
            /* try REST fallback */
        }
    }

    const apiKey = process.env.FIREBASE_API_KEY;
    if (!apiKey) {
        console.warn('[verifyIdToken] No FIREBASE_API_KEY set');
        return null;
    }

    try {
        const res = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken })
            }
        );
        const data = await res.json();
        if (!res.ok || !data.users?.[0]) {
            console.warn('[verifyIdToken] REST fallback failed:', res.status, JSON.stringify(data));
            return null;
        }
        const u = data.users[0];
        return { uid: u.localId, email: u.email, name: u.displayName };
    } catch (err) {
        console.warn('[verifyIdToken] REST fallback threw:', err.message);
        return null;
    }
}

function defaultRate(currency) {
    const rates = { TZS: 2500, KES: 130, UGX: 3700, USD: 1 };
    return rates[currency] || 2500;
}

async function getExchangeRate(currency = 'TZS') {
    const app = initFirebaseAdmin();
    if (!app) return defaultRate(currency);
    const snap = await app.firestore().collection('settings').doc('rates').get();
    const data = snap.data();
    const value = data?.[currency];
    return value && value > 0 ? value : defaultRate(currency);
}

/**
 * Credit shop balance once per PalmPesa order (idempotent)
 */
export async function creditPalmpesaDeposit(uid, {
    orderId,
    amountTZS,
    reference,
    transid,
    channel,
    msisdn
}) {
    const app = initFirebaseAdmin();
    if (!app) {
        return { success: false, error: 'Firebase Admin not configured' };
    }

    const db = app.firestore();
    const processedRef = db.collection('palmpesaProcessed').doc(orderId);
    const existing = await processedRef.get();
    if (existing.exists) {
        return { success: true, alreadyProcessed: true, ...existing.data() };
    }

    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
        return { success: false, error: 'User not found' };
    }

    const user = userSnap.data();
    const currency = user.currency || 'TZS';
    const currentShop = Number(user.shopBalance) || 0;
    const newShopBalance = currentShop + amountTZS;
    const now = Date.now();

    const depositRef = db.collection('shopDeposits').doc();
    const txRef = db.collection('transactions').doc();

    const batch = db.batch();

    batch.update(userRef, { shopBalance: newShopBalance });
    batch.set(depositRef, {
        uid,
        amount: amountTZS,
        currency,
        orderId,
        reference: reference || '',
        transid: transid || '',
        channel: channel || 'palmpesa',
        msisdn: msisdn || '',
        method: 'palmpesa',
        status: 'completed',
        createdAt: now
    });
    batch.set(txRef, {
        uid,
        type: 'deposit',
        description: 'Shop deposit (PalmPesa)',
        amount: amountTZS,
        currency,
        orderId,
        createdAt: now
    });
    batch.set(processedRef, {
        uid,
        amountTZS,
        amountUSD,
        creditedAt: now
    });
    const pendingRef = db.collection('palmpesaPending').doc(orderId);
    batch.update(pendingRef, { status: 'completed' });

    await batch.commit();

    return {
        success: true,
        amountUSD,
        amountTZS,
        shopBalance: newShopBalance
    };
}

export async function savePendingOrder(orderId, data) {
    const app = initFirebaseAdmin();
    if (!app) return;
    await app.firestore().collection('palmpesaPending').doc(orderId).set({
        ...data,
        status: 'pending',
        createdAt: Date.now()
    });
}
