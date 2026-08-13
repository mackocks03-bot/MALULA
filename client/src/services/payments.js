/**
 * Payments Service
 * Handles activation payments and transactions.
 *
 * NOTE: Welcome bonus, referral commissions (all 3 MLM levels), and
 * account activation are handled exclusively by Firebase Cloud Functions
 * (functions/index.js → processActivationPayment trigger).
 * This file only creates the pending payment record — the Cloud Function
 * fires automatically when palmpesaStatus === 'COMPLETED' or
 * adminApproveRequested === true is set on the record.
 */

import { db, doc, getDoc, getDocs, updateDoc, addDoc, collection, query, where } from './firebase-config.js';

/**
 * Create a pending activation payment record.
 * Heavy processing (bonus, commissions, notifications) is done by Cloud Functions.
 */
export async function processActivationPayment(uid, paymentData) {
  try {
    const { method, phoneNumber, transactionId, amount, currency } = paymentData;

    const paymentRef = await addDoc(collection(db, 'activationPayments'), {
      uid,
      method,
      phoneNumber: phoneNumber || '',
      transactionId: transactionId || '',
      amount: amount || 0,
      currency: currency || 'TZS',
      status: 'pending',
      createdAt: Date.now(),
      referenceCode: `NH-${Date.now().toString().slice(-6)}`
    });

    await updateDoc(doc(db, 'users', uid), {
      activationStatus: 'pending',
      activationPaymentId: paymentRef.id
    });

    return { success: true, paymentId: paymentRef.id };
  } catch (error) {
    console.error('Error processing activation payment:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Request admin approval for a manual payment record.
 * Sets adminApproveRequested = true which the Cloud Function watches.
 * Only callable by the admin panel via the server route
 * POST /api/activation/admin/approve/:paymentId.
 */
export async function requestAdminApproval(paymentId) {
  try {
    await updateDoc(doc(db, 'activationPayments', paymentId), {
      adminApproveRequested: true,
      adminApproveRequestedAt: Date.now()
    });
    return { success: true };
  } catch (error) {
    console.error('Error requesting admin approval:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get user's activation status
 */
export async function getActivationStatus(uid) {
  try {
    const snapshot = await getDoc(doc(db, 'users', uid));
    if (!snapshot.exists()) {
      return { isActive: false, status: 'not_found' };
    }
    
    const data = snapshot.data();
    
    // Check if user is active
    if (data.isActive === true) {
      return { isActive: true, status: 'active' };
    }
    
    // Check activation status
    if (data.activationStatus === 'approved') {
      return { isActive: true, status: 'active' };
    }
    
    // Check for approved payment
    const paymentsQuery = query(collection(db, 'activationPayments'), where('uid', '==', uid));
    const snapshot2 = await getDocs(paymentsQuery);
    if (!snapshot2.empty) {
      const userPayments = snapshot2.docs.map(d => d.data());
      const approvedPayment = userPayments.find(p => p.status === 'approved');
      if (approvedPayment) {
        // Update user status
        await updateDoc(doc(db, 'users', uid), {
          isActive: true,
          activationStatus: 'approved'
        });
        return { isActive: true, status: 'active' };
      }
      
      const pendingPayment = userPayments.find(p => p.status === 'pending');
      if (pendingPayment) {
        return { isActive: false, status: 'pending' };
      }
    }
    
    return { isActive: false, status: 'inactive' };
    
  } catch (error) {
    console.error('Error getting activation status:', error);
    return { isActive: false, status: 'error' };
  }
}

/**
 * Get payment methods for country
 */
export function getPaymentMethods(countryCode) {
  const methods = {
    'TZ': [
      { id: 'vodacom', name: 'Vodacom M-Pesa', icon: '📱', ussd: '*150*00#' },
      { id: 'airtel', name: 'Airtel Money', icon: '📱', ussd: '*150*60#' },
      { id: 'halopesa', name: 'Halopesa', icon: '📱', ussd: '*150*88#' },
      { id: 'crdb', name: 'CRDB Bank', icon: '🏦', ussd: '*150*03#' }
    ],
    'KE': [
      { id: 'mpesa', name: 'M-PESA', icon: '📱', ussd: '*234#' },
      { id: 'airtel', name: 'Airtel Money', icon: '📱', ussd: '*150*00#' }
    ],
    'UG': [
      { id: 'mtn', name: 'MTN Mobile Money', icon: '📱', ussd: '*165#' },
      { id: 'airtel', name: 'Airtel Money', icon: '📱', ussd: '*185#' }
    ]
  };
  
  return methods[countryCode] || methods['TZ'];
}

// ============================================================
// EXPORT
// ============================================================
export default {
  processActivationPayment,
  requestAdminApproval,
  getActivationStatus,
  getPaymentMethods
};