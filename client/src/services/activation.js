/**
 * Activation Processing
 * Called when admin approves activation payment
 * Backend: USD, processes referral bonuses from /settings RTDB
 */

import { db, doc, getDoc, getDocs, updateDoc, addDoc, collection, deleteDoc, onSnapshot } from './firebase-config.js';

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

        const now = Date.now();
        const uid = payment.uid;
        if (!uid) return { success: false, error: 'Payment has no associated user ID' };



        // 1. Mark payment as approved to trigger Cloud Function
        await updateDoc(paymentRef, {
            status: 'approved',
            approvedAt: now,
            adminApproveRequested: true,
            adminApprovedAt: now
        });

        // 2. Wait for Cloud Function to complete
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                unsub();
                resolve({ success: false, error: 'Approval request sent, but Cloud Function timed out responding (> 20s).' });
            }, 20000);

            const unsub = onSnapshot(paymentRef, (snap) => {
                const data = snap.data();
                if (data?.activationProcessed === true) {
                    clearTimeout(timeout);
                    unsub();
                    
                    // Add activation notification for user
                    addDoc(collection(db, 'notifications'), {
                        uid,
                        type: 'activation',
                        title: 'Account Activated! 🎉',
                        message: 'Your account has been activated by admin. Welcome aboard!',
                        read: false,
                        createdAt: now
                    }).catch(console.error);

                    resolve({
                        success: true,
                        message: 'Account activated successfully! Commissions are being processed.'
                    });
                } else if (data?.processingError) {
                    clearTimeout(timeout);
                    unsub();
                    resolve({ success: false, error: `Backend processing error: ${data.processingError}` });
                }
            });
        });
    } catch (error) {
        console.error('❌ Error approving activation:', error);
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
        
        // Update user status
        if (payment.uid) {
            await updateDoc(doc(db, 'users', payment.uid), {
                activationStatus: 'rejected',
                activationPaymentId: null
            });
        }
        
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
// CLEANUP STALE ACTIVATIONS (> 15 MINS)
// ============================================================
export async function cleanupStaleActivations() {
    try {
        const snapshot = await getDocs(collection(db, 'activationPayments'));
        if (snapshot.empty) return;
        
        const now = Date.now();
        const fifteenMins = 15 * 60 * 1000;
        
        let cleaned = 0;
        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            if (data.status === 'pending' && data.createdAt) {
                if (now - data.createdAt > fifteenMins) {
                    await deleteActivation(docSnap.id);
                    cleaned++;
                }
            }
        }
        
        if (cleaned > 0) {
            console.log(`🧹 Cleaned up ${cleaned} stale activation payments.`);
        }
        
        return { success: true, cleaned };
    } catch (error) {
        console.error('❌ Error cleaning up stale activations:', error);
    }
}

// ============================================================
// DELETE ACTIVATION
// ============================================================
export async function deleteActivation(paymentId) {
    try {
        const paymentRef = doc(db, 'activationPayments', paymentId);
        const paymentSnap = await getDoc(paymentRef);
        
        if (paymentSnap.exists()) {
            const payment = paymentSnap.data();
            
            // If the payment is tied to a user, clear their pending status so they aren't stuck
            if (payment.uid) {
                await updateDoc(doc(db, 'users', payment.uid), {
                    activationStatus: 'inactive',
                    activationPaymentId: null
                });
            }
        }
        
        await deleteDoc(paymentRef);
        return { success: true, message: 'Payment record deleted' };
    } catch (error) {
        console.error('❌ Error deleting activation:', error);
        return { success: false, error: error.message };
    }
}

console.log('🔑 Activation module loaded');