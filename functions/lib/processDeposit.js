import { sendPushNotification } from './sendPushNotification.js';
import { generateTxHash, getFormattedDate } from './utils.js';
/**
 * Credit shop balance after verified PalmPesa deposit
 */
export async function runDepositProcessing(db, orderId, pending) {
    if (pending.depositProcessed === true) {
        return { success: true, alreadyProcessed: true };
    }

    const uid = pending.uid;
    if (!uid) throw new Error('Missing uid on deposit job');

    const processedRef = db.collection('palmpesaProcessed').doc(`deposit_${orderId}`);
    const existing = await processedRef.get();
    if (existing.exists) {
        return { success: true, alreadyProcessed: true, ...existing.data() };
    }

    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) throw new Error(`User not found: ${uid}`);

    const user = userSnap.data();
    const currency = user.currency || 'TZS';

    // Get exact native deposit amount
    const amountNative = Number(pending.amountTZS) || Number(pending.amount) || 0;
    const currentShop = Number(user.shopBalance) || 0;
    const newShopBalance = currentShop + amountNative;
    const now = Date.now();

    const batch = db.batch();

    // Mark as processed early (idempotency)
    batch.set(processedRef, {
        uid,
        amountNative,
        currency,
        creditedAt: now
    });

    // Update User Balance
    batch.update(userRef, { shopBalance: newShopBalance });

    // Record Deposit
    const depositRef = db.collection('shopDeposits').doc();
    batch.set(depositRef, {
        uid,
        amount: amountNative,
        currency,
        orderId,
        reference: pending.reference || '',
        transid: pending.transid || '',
        channel: pending.channel || 'palmpesa',
        msisdn: pending.msisdn || pending.phone || '',
        method: 'palmpesa',
        status: 'completed',
        createdAt: now
    });

    const txHash = generateTxHash();
    const dateStr = getFormattedDate();
    const userPhone = pending.msisdn || pending.phone || user.phone || 'your account';
    
    const message = `${txHash} confirmed your deposit of ${amountNative} ${currency}, to phone ${userPhone} has been processed and approved successfull, date ${dateStr}`;

    // Record Transaction
    const txRef = db.collection('transactions').doc();
    batch.set(txRef, {
        uid,
        type: 'deposit',
        description: 'Shop deposit (PalmPesa)',
        amount: amountNative,
        currency,
        orderId,
        createdAt: now,
        txHash: txHash
    });

    // Notify User
    const notifRef = db.collection('notifications').doc();
    batch.set(notifRef, {
        uid,
        type: 'deposit_approved',
        title: 'Deposit Successful ✅',
        message: message,
        amount: amountNative,
        currency: currency,
        txId: txHash,
        read: false,
        createdAt: now
    });

    // Mark pending job as processed
    const pendingRef = db.collection('palmpesaPending').doc(orderId);
    batch.update(pendingRef, {
        depositProcessed: true,
        status: 'completed',
        updatedAt: now,
        txHash: txHash
    });

    await batch.commit();

    console.log(`✅ Deposit ${orderId}: ${amountNative} ${currency} shop credit for ${uid}`);

    await sendPushNotification(db, uid, 'Deposit Successful ✅', message, {
        txId: txHash,
        type: 'deposit_approved',
        amount: amountNative
    });

    return { success: true, amountNative, currency, shopBalance: newShopBalance };
}
