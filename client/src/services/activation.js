/**
 * Activation Processing
 * Called when admin approves activation payment
 * Backend: USD, processes referral bonuses from /settings RTDB
 */

import { db, doc, getDoc, getDocs, updateDoc, addDoc, collection, deleteDoc } from './firebase-config.js';

// ============================================================
// APPROVE ACTIVATION
// ============================================================
export async function approveActivation(paymentId) {
    try {
        const paymentRef = doc(db, 'activationPayments', paymentId);
        const paymentSnap = await getDoc(paymentRef);
        if (!paymentSnap.exists()) {
            return { success: false, error: 'Payment not found' };
        }

        const payment = paymentSnap.data();
        if (payment.activationProcessed || payment.status === 'approved') {
            return { success: true, message: 'Already activated', alreadyProcessed: true };
        }

        // Queue for Firebase Cloud Function — processes welcome bonus + 3-level commissions
        await updateDoc(paymentRef, {
            adminApproveRequested: true,
            adminApprovedAt: Date.now()
        });

        return {
            success: true,
            message: 'Activation queued. Commissions are being processed by Cloud Functions.'
        };
    } catch (error) {
        console.error('❌ Error queuing activation:', error);
        return { success: false, error: error.message };
    }
}

// ============================================================
// REJECT ACTIVATION
// ============================================================
export async function rejectActivation(paymentId, reason = 'Payment not verified') {
    try {
        const paymentRef = doc(db, 'activationPayments', paymentId);
        const paymentSnap = await getDoc(paymentRef);
        if (!paymentSnap.exists()) {
            return { success: false, error: 'Payment not found' };
        }
        
        const payment = paymentSnap.data();
        
        await updateDoc(paymentRef, {
            status: 'rejected',
            rejectedAt: Date.now(),
            reason: reason
        });
        
        // Notify user
        await addDoc(collection(db, 'notifications'), {
            uid: payment.uid,
            type: 'activation',
            title: 'Activation Rejected',
            message: `Your activation was rejected. Reason: ${reason}`,
            read: false,
            createdAt: Date.now()
        });
        
        return { success: true, message: 'Activation rejected' };
        
    } catch (error) {
        console.error('❌ Error rejecting activation:', error);
        return { success: false, error: error.message };
    }
}

// ============================================================
// GET PENDING ACTIVATIONS
// ============================================================
export async function getPendingActivations() {
    try {
        const snapshot = await getDocs(collection(db, 'activationPayments'));
        if (snapshot.empty) return [];
        
        return snapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(p => p.status === 'pending')
            .sort((a, b) => b.createdAt - a.createdAt);
            
    } catch (error) {
        console.error('❌ Error getting pending activations:', error);
        return [];
    }
}

// ============================================================
// DELETE ACTIVATION
// ============================================================
export async function deleteActivation(paymentId) {
    try {
        await deleteDoc(doc(db, 'activationPayments', paymentId));
        return { success: true, message: 'Payment record deleted' };
    } catch (error) {
        console.error('❌ Error deleting activation:', error);
        return { success: false, error: error.message };
    }
}

console.log('🔑 Activation module loaded');