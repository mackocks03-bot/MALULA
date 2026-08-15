/**
 * Withdraw Service
 * Handles withdrawal requests for NEWHOPE-CHAT
 */

import { 
    db, 
    doc, 
    getDoc, 
    getDocs, 
    setDoc, 
    updateDoc, 
    addDoc, 
    deleteDoc, 
    collection, 
    query, 
    where, 
    orderBy, 
    onSnapshot 
} from './firebase-config.js';
import { getUser, updateUser, addTransaction, addNotification } from './database.js';
import { getSettings, getWithdrawLimits, getTaskWithdrawLimits } from './settings.js';
import { toLocalDisplay, formatCurrency } from './currency.js';

// ============================================================
// WITHDRAWAL OPERATIONS
// ============================================================

/**
 * Request a withdrawal
 */
export async function requestWithdrawal(uid, withdrawalData) {
    try {
        // Get user data
        const userResult = await getUser(uid);
        if (!userResult.success || !userResult.data) {
            return { success: false, error: 'User not found' };
        }
        
        const userData = userResult.data;
        const currency = userData.currency || 'TZS';
        const walletType = withdrawalData.wallet || 'balance';
        
        let availableBalance = 0;
        if (walletType === 'balance') {
            availableBalance = userData.balance || 0;
        } else if (walletType === 'welcomeBonus') {
            availableBalance = userData.welcomeBonus || 0;
        } else if (walletType.startsWith('earnings.')) {
            const platform = walletType.split('.')[1];
            availableBalance = userData.earnings?.[platform] || 0;
        }
        
        // Validate amount
        const amount = withdrawalData.amount || 0;
        if (amount <= 0) {
            return { success: false, error: 'Invalid amount' };
        }
        
        
        // 🚨 NEW: Block if user already has a pending withdrawal request
        const pendingQuery = query(collection(db, 'withdrawals'), where('uid', '==', uid), where('status', '==', 'pending'));
        const pendingDocs = await getDocs(pendingQuery);
        if (!pendingDocs.empty) {
            return { success: false, error: 'You already have a pending withdrawal request. Please wait for it to be processed.' };
        }

        // Get withdrawal boundaries mapping to the specific wallet
        const limits = await getWithdrawLimits(currency);
        const minAmount = await getTaskWithdrawLimits(walletType, currency);
        const maxAmount = limits.max || 5000000;
        
        if (amount < minAmount) {
            return { 
                success: false, 
                error: `Minimum withdrawal is ${formatCurrency(minAmount, currency)}` 
            };
        }
        
        if (amount > maxAmount) {
            return { 
                success: false, 
                error: `Maximum withdrawal is ${formatCurrency(maxAmount, currency)}` 
            };
        }
        
        // Check balance
        if (amount > availableBalance) {
            return { success: false, error: 'Insufficient balance in selected wallet' };
        }
        
        // Calculate fee dynamically on top of the requested amount
        const fee = Math.floor(amount * ((limits.feePercent || 0) / 100));
        const totalDeduct = amount + fee; 
        const receiveAmount = amount; 
        
        if (totalDeduct > availableBalance) {
            return { 
                success: false, 
                error: `Insufficient balance (including fee of ${formatCurrency(fee, currency)})` 
            };
        }
        
        const referenceCode = `WD-${Date.now().toString().slice(-6)}`;
        
        // Create withdrawal request
        const withdrawRef = await addDoc(collection(db, 'withdrawals'), {
            uid: uid,
            amount: amount,                 // Gross requested
            fee: fee,                       // Fee carved out
            receiveAmount: receiveAmount,   // Net amount for admin to send
            totalDeduct: totalDeduct,       // Same as amount in this system
            wallet: walletType,
            method: withdrawalData.method || 'mpesa',
            accountName: withdrawalData.accountName || '',
            phone: withdrawalData.phone || withdrawalData.phoneNumber || '',
            note: withdrawalData.note || '',
            status: 'pending',
            currency: currency,
            createdAt: Date.now(),
            reference: referenceCode,
            updatedAt: Date.now()
        });
        
        // Update user balance (deduct)
        const updatePayload = {};
        if (walletType === 'balance') {
            updatePayload.balance = availableBalance - totalDeduct;
        } else if (walletType === 'welcomeBonus') {
            updatePayload.welcomeBonus = availableBalance - totalDeduct;
        } else if (walletType.startsWith('earnings.')) {
            updatePayload[walletType] = availableBalance - totalDeduct;
        }
        
        await updateUser(uid, updatePayload);
        
        // Add transaction
        await addTransaction(uid, {
            type: 'withdraw',
            amount: -totalDeduct,
            currency: currency,
            description: `Withdrawal request (${withdrawalData.method || 'mpesa'})`,
            reference: referenceCode,
            status: 'pending'
        });
        
        // Add notification
        const display = toLocalDisplay(amount, currency);
        await addNotification(uid, {
            type: 'withdraw',
            message: `💳 Withdrawal of ${display.formatted} submitted. Processing...`,
            reference: referenceCode
        });
        
        return { 
            success: true, 
            id: withdrawRef.id,
            reference: referenceCode
        };
        
    } catch (error) {
        console.error('Error requesting withdrawal:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get all withdrawal requests for a user
 */
export async function getUserWithdrawals(uid) {
    try {
        const q = query(
            collection(db, 'withdrawals'), 
            where('uid', '==', uid)
        );
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
            const withdrawals = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })).sort((a, b) => b.createdAt - a.createdAt);
            return { success: true, data: withdrawals };
        }
        return { success: true, data: [] };
    } catch (error) {
        console.error('Error getting user withdrawals:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get a specific withdrawal
 */
export async function getWithdrawal(uid, withdrawalId) {
    try {
        const snapshot = await getDoc(doc(db, 'withdrawals', withdrawalId));
        if (snapshot.exists() && snapshot.data().uid === uid) {
            return { success: true, data: snapshot.data() };
        }
        return { success: false, data: null };
    } catch (error) {
        console.error('Error getting withdrawal:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get all pending withdrawals (admin only)
 */
export async function getPendingWithdrawals() {
    try {
        const q = query(
            collection(db, 'withdrawals'),
            where('status', '==', 'pending')
        );
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            return { success: true, data: [] };
        }
        
        const allWithdrawals = [];
        
        // Fetch user data for each pending withdrawal
        for (const withdrawDoc of snapshot.docs) {
            const w = withdrawDoc.data();
            const wId = withdrawDoc.id;
            
            const userResult = await getUser(w.uid);
            const userData = userResult.success && userResult.data ? userResult.data : {};
            
            allWithdrawals.push({
                ...w,
                id: wId,
                username: userData.username || 'Unknown',
                fullName: userData.fullName || '',
                userEmail: userData.email || ''
            });
        }
        
        // Sort by createdAt descending
        allWithdrawals.sort((a, b) => b.createdAt - a.createdAt);
        
        return { success: true, data: allWithdrawals };
        
    } catch (error) {
        console.error('Error getting pending withdrawals:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Approve a withdrawal (admin only)
 */
export async function approveWithdrawal(uid, withdrawalId, adminNote = '') {
    try {
        // Get withdrawal data
        const withdrawalResult = await getWithdrawal(uid, withdrawalId);
        if (!withdrawalResult.success || !withdrawalResult.data) {
            return { success: false, error: 'Withdrawal not found' };
        }
        
        const withdrawal = withdrawalResult.data;
        
        // Check if already processed
        if (withdrawal.status !== 'pending') {
            return { success: false, error: `Withdrawal already ${withdrawal.status}` };
        }
        
        // Update withdrawal status
        const wdRef = doc(db, 'withdrawals', withdrawalId);
        await updateDoc(wdRef, {
            status: 'approved',
            approvedAt: Date.now(),
            updatedAt: Date.now(),
            adminNote
        });
        
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                unsub();
                resolve({ success: false, error: 'Authorization sent, but Cloud Function timed out responding (> 20s).' });
            }, 20000);

            const unsub = onSnapshot(wdRef, (snap) => {
                const data = snap.data();
                if (data?.withdrawalNotified === true) {
                    clearTimeout(timeout);
                    unsub();
                    resolve({ success: true, message: 'Withdrawal successfully authorized and recorded.' });
                }
            });
        });

    } catch (error) {
        console.error('Error approving withdrawal:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Reject a withdrawal (admin only)
 */
export async function rejectWithdrawal(uid, withdrawalId, reason = '') {
    try {
        // Get withdrawal data
        const withdrawalResult = await getWithdrawal(uid, withdrawalId);
        if (!withdrawalResult.success || !withdrawalResult.data) {
            return { success: false, error: 'Withdrawal not found' };
        }
        
        const withdrawal = withdrawalResult.data;
        
        // Check if already processed
        if (withdrawal.status !== 'pending') {
            return { success: false, error: `Withdrawal already ${withdrawal.status}` };
        }
        
        // Update withdrawal status
        const wdRef = doc(db, 'withdrawals', withdrawalId);
        await updateDoc(wdRef, {
            status: 'rejected',
            rejectedAt: Date.now(),
            updatedAt: Date.now(),
            reason
        });

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                unsub();
                resolve({ success: false, error: 'Rejection sent, but Cloud Function timed out processing refund (> 20s).' });
            }, 20000);

            const unsub = onSnapshot(wdRef, (snap) => {
                const data = snap.data();
                if (data?.withdrawalNotified === true) {
                    clearTimeout(timeout);
                    unsub();
                    resolve({ success: true, message: 'Withdrawal successfully rejected and refunded securely.' });
                }
            });
        });

    } catch (error) {
        console.error('Error rejecting withdrawal:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Delete a withdrawal record completely (admin only)
 */
export async function deleteWithdrawal(uid, withdrawalId) {
    try {
        await deleteDoc(doc(db, 'withdrawals', withdrawalId));
        return { success: true, message: 'Withdrawal deleted securely' };
    } catch (error) {
        console.error('Error deleting withdrawal:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get withdrawal statistics for a user
 */
export async function getWithdrawalStats(uid) {
    try {
        const withdrawalsResult = await getUserWithdrawals(uid);
        if (!withdrawalsResult.success) {
            return { success: false, error: withdrawalsResult.error };
        }
        
        const withdrawals = withdrawalsResult.data;
        const pending = withdrawals.filter(w => w.status === 'pending').length;
        const approved = withdrawals.filter(w => w.status === 'approved').length;
        const rejected = withdrawals.filter(w => w.status === 'rejected').length;
        
        // Calculate total withdrawn amount
        let totalWithdrawn = 0;
        for (const w of withdrawals) {
            if (w.status === 'approved') {
                totalWithdrawn += w.amount || 0;
            }
        }
        
        return { 
            success: true, 
            data: {
                pending,
                approved,
                rejected,
                total: withdrawals.length,
                totalWithdrawn
            }
        };
        
    } catch (error) {
        console.error('Error getting withdrawal stats:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Listen to user withdrawals
 */
export function listenToUserWithdrawals(uid, callback) {
    const q = query(
        collection(db, 'withdrawals'),
        where('uid', '==', uid)
    );
    return onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const withdrawals = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })).sort((a, b) => b.createdAt - a.createdAt);
            callback({ success: true, data: withdrawals });
        } else {
            callback({ success: true, data: [] });
        }
    });
}

// ============================================================
// EXPORT
// ============================================================

export default {
    requestWithdrawal,
    getUserWithdrawals,
    getWithdrawal,
    getPendingWithdrawals,
    approveWithdrawal,
    rejectWithdrawal,
    deleteWithdrawal,
    getWithdrawalStats,
    listenToUserWithdrawals
};