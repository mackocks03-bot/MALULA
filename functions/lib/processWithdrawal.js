/**
 * Cloud Function handler — withdrawal status changes.
 *
 * Triggered by: onDocumentWritten withdrawals/{withdrawalId}
 *
 * Responsibilities:
 *  - On new withdrawal request: notify admin (via /adminNotifications)
 *  - On status → approved: credit nothing (funds already deducted at request time),
 *    notify user, log transaction
 *  - On status → rejected: refund the full amount, notify user, log transaction
 *
 * Idempotent — guarded by withdrawalNotified / withdrawalRefunded flags.
 */
import { sendPushNotification } from './sendPushNotification.js';
import { generateTxHash, getFormattedDate } from './utils.js';

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} uid
 * @param {string} withdrawalId
 * @param {object|null} before  - value before the write
 * @param {object|null} after   - value after the write
 */
export async function runWithdrawalProcessing(db, uid, withdrawalId, before, after) {
    if (!after) return; // Deletion — ignore

    const now = Date.now();

    // ── New withdrawal request ──────────────────────────────────────────────
    const isNew = !before && after.status === 'pending';
    if (isNew) {
        // Notify admin dashboard
        await db.collection('adminNotifications').add({
            type: 'withdrawal_request',
            uid,
            withdrawalId,
            amount: after.amount || 0,
            currency: after.currency || 'USD',
            method: after.method || 'unknown',
            username: after.username || uid,
            read: false,
            createdAt: now
        });

        console.log(`📬 New withdrawal request ${withdrawalId} from ${uid} — admin notified`);
        return;
    }

    const statusChanged = before?.status !== after?.status;
    if (!statusChanged) return;

    const newStatus = after.status;
    const batch = db.batch();
    
    // Fetch user for phone number
    let userPhone = after.phone || after.account || after.accountNumber || '';
    let currentBalance = 0;
    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (userSnap.exists) {
        const userData = userSnap.data();
        if (!userPhone) userPhone = userData.phone || '';
        currentBalance = parseFloat(userData.balance) || 0;
    }
    
    const txHash = generateTxHash();
    const dateStr = getFormattedDate();

    // ── Approved ────────────────────────────────────────────────────────────
    if (newStatus === 'approved') {
        if (after.withdrawalNotified === true) {
            console.log(`Withdrawal ${withdrawalId} already notified`);
            return;
        }
        
        const message = `${txHash} confirmed your withdraw of ${Number(after.amount || 0)} ${after.currency || 'USD'}, to phone ${userPhone} has been processed and approved successfull, date ${dateStr}`;

        const notifRef = db.collection('notifications').doc();
        batch.set(notifRef, {
            uid,
            type: 'withdrawal_approved',
            title: 'Withdrawal Successful ✅',
            message: message,
            amount: after.amount || 0,
            currency: after.currency || 'USD',
            method: after.method || '',
            txId: txHash,
            read: false,
            createdAt: now
        });

        const withdrawRef = db.collection('withdrawals').doc(withdrawalId);
        batch.update(withdrawRef, {
            withdrawalNotified: true,
            notifiedAt: now,
            txHash: txHash
        });
        
        await batch.commit();

        console.log(`✅ Withdrawal ${withdrawalId} approved — user ${uid} notified`);
        
        await sendPushNotification(db, uid, 'Withdrawal Successful ✅', message, {
            txId: txHash,
            type: 'withdrawal_approved',
            amount: after.amount || 0
        });
        
        return;
    }

    // ── Rejected ─────────────────────────────────────────────────────────────
    if (newStatus === 'rejected') {
        if (after.withdrawalRefunded === true) {
            console.log(`Withdrawal ${withdrawalId} already refunded`);
            return;
        }

        // Refund the amount back to the user's balance
        const amount = parseFloat(after.amount) || 0;
        const totalDeduct = parseFloat(after.totalDeduct) || amount; // use totalDeduct for fee precision
        
        if (totalDeduct > 0 && userSnap.exists) {
            const newBalance = currentBalance + totalDeduct;

            batch.update(userRef, { balance: newBalance });

            const txRef = db.collection('transactions').doc();
            batch.set(txRef, {
                uid,
                type: 'withdrawal_refund',
                description: `Withdrawal refunded — ${after.rejectReason || 'rejected by admin'}`,
                amount: totalDeduct,
                currency: after.currency || 'USD',
                balanceAfter: newBalance,
                withdrawalId,
                createdAt: now,
                txHash: txHash
            });
        }
        
        const message = `${txHash} confirmed your withdraw of ${Number(after.amount || 0)} ${after.currency || 'USD'} has been rejected and refunded, date ${dateStr}`;

        const notifRef = db.collection('notifications').doc();
        batch.set(notifRef, {
            uid,
            type: 'withdrawal_rejected',
            title: 'Withdrawal Failed ❌',
            message: message,
            amount: after.amount || 0,
            currency: after.currency || 'USD',
            txId: txHash,
            read: false,
            createdAt: now
        });

        const withdrawRef = db.collection('withdrawals').doc(withdrawalId);
        batch.update(withdrawRef, {
            withdrawalRefunded: totalDeduct > 0,
            withdrawalNotified: true,
            notifiedAt: now,
            txHash: txHash
        });

        await batch.commit();

        console.log(`❌ Withdrawal ${withdrawalId} rejected — user ${uid} refunded ${totalDeduct} and notified`);
        
        await sendPushNotification(db, uid, 'Withdrawal Failed ❌', message, {
            txId: txHash,
            type: 'withdrawal_rejected',
            amount: after.amount || 0
        });
    }
}
