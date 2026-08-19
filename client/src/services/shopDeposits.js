/**
 * Shop Deposits Processing (Admin Only)
 * Handles approval of manual USSD wallet deposits.
 * Bypasses network commission logic.
 */

import { db, doc, getDoc, getDocs, collection, deleteDoc, writeBatch } from './firebase-config.js';

// ============================================================
// APPROVE SHOP DEPOSIT
// ============================================================
export async function approveShopDeposit(depositId, source = 'shopDeposits') {
    try {
        const depositRef = doc(db, source, depositId);
        const depositSnap = await getDoc(depositRef);
        if (!depositSnap.exists()) {
            return { success: false, error: 'Deposit record not found' };
        }

        const deposit = depositSnap.data();
        if (deposit.status === 'completed' || deposit.status === 'approved') {
            return { success: true, message: 'Already approved', alreadyProcessed: true };
        }

        const now = Date.now();
        const uid = deposit.uid;
        if (!uid) return { success: false, error: 'Deposit has no associated user ID' };

        // We need to credit the user's shopBalance
        const userRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
            return { success: false, error: 'User account not found' };
        }
        
        const userData = userSnap.data();
        const currentShopBalance = Number(userData.shopBalance) || 0;
        // ensure we pick the right amount field
        const addedAmount = Number(deposit.amount) || Number(deposit.amountTZS) || 0;
        
        if (addedAmount <= 0) {
            return { success: false, error: 'Deposit amount is zero or invalid' };
        }

        const newShopBalance = currentShopBalance + addedAmount;
        const currency = deposit.currency || userData.currency || 'TZS';

        // Perform updates atomically via writeBatch
        const batch = writeBatch(db);

        // 1. Mark deposit as completed
        batch.update(depositRef, {
            status: 'completed',
            approvedAt: now,
            adminUssdApproved: true
        });

        // 2. Increment user shopBalance
        batch.update(userRef, { shopBalance: newShopBalance });

        // 3. Add to Transactions ledger
        const txRef = doc(collection(db, 'transactions'));
        batch.set(txRef, {
            uid,
            type: 'deposit',
            description: 'Shop deposit (Manual USSD Approved)',
            amount: addedAmount,
            currency: currency,
            reference: deposit.transactionId || deposit.reference || '',
            createdAt: now
        });

        // 4. Notify user
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
            uid,
            type: 'deposit_approved',
            title: 'Deposit Successful ✅',
            message: `Your manual deposit of ${addedAmount} ${currency} has been approved.`,
            amount: addedAmount,
            currency: currency,
            txId: deposit.transactionId || deposit.reference || depositId,
            read: false,
            createdAt: now
        });

        await batch.commit();

        return { success: true, message: `Deposit of ${addedAmount} ${currency} approved. Balance updated.` };
    } catch (error) {
        console.error('❌ Error approving shop deposit:', error);
        return { success: false, error: error.message };
    }
}

// ============================================================
// REJECT SHOP DEPOSIT
// ============================================================
export async function rejectShopDeposit(depositId, reason = 'Payment details not verified', source = 'shopDeposits') {
    try {
        const depositRef = doc(db, source, depositId);
        const depositSnap = await getDoc(depositRef);
        if (!depositSnap.exists()) {
            return { success: false, error: 'Deposit record not found' };
        }
        
        const deposit = depositSnap.data();
        const currency = deposit.currency || 'TZS';
        const amount = Number(deposit.amount) || 0;
        
        const batch = writeBatch(db);
        
        // 1. Mark deposit as rejected
        batch.update(depositRef, {
            status: 'rejected',
            rejectedAt: Date.now(),
            reason: reason
        });
        
        // 2. Notify user
        if (deposit.uid) {
            const notifRef = doc(collection(db, 'notifications'));
            batch.set(notifRef, {
                uid: deposit.uid,
                type: 'deposit_rejected',
                title: 'Deposit Rejected ❌',
                message: `Your deposit of ${amount} ${currency} was rejected. Reason: ${reason}`,
                read: false,
                createdAt: Date.now()
            });
        }
        
        await batch.commit();
        
        return { success: true, message: 'Deposit rejected' };
    } catch (error) {
        console.error('❌ Error rejecting shop deposit:', error);
        return { success: false, error: error.message };
    }
}

// ============================================================
// DELETE SHOP DEPOSIT
// ============================================================
export async function deleteShopDeposit(depositId, source = 'shopDeposits') {
    try {
        await deleteDoc(doc(db, source, depositId));
        return { success: true, message: 'Deposit receipt deleted forever' };
    } catch (error) {
        console.error('❌ Error deleting shop deposit:', error);
        return { success: false, error: error.message };
    }
}
