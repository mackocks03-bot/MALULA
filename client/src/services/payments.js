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
    const { method, phoneNumber, transactionId, amount, currency, screenshotUrl, countryCode } = paymentData;

    const paymentRef = await addDoc(collection(db, 'activationPayments'), {
      uid,
      method,
      phoneNumber: phoneNumber || '',
      transactionId: transactionId || '',
      transactionHash: transactionId || '',
      amount: amount || 0,
      currency: currency || 'TZS',
      screenshotUrl: screenshotUrl || '',
      countryCode: countryCode || 'TZ',
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
      { id: 'lipa_namba', name: 'USSD (Lipa Namba: MIXX BY YAS)', icon: '📱', color: '#ff0000', ussd: '*150*01#' }
    ],
    'KE': [
      { id: 'mpesa', name: 'M-PESA', image: '/assets/images/kenya/vodacom.png', ussd: '*234#' },
      { id: 'airtel', name: 'Airtel Money', image: '/assets/images/kenya/airtel.png', ussd: '*150*00#' }
    ],
    'UG': [
      { id: 'mtn', name: 'MTN Mobile Money', image: '/assets/images/uganda/mtn.png', ussd: '*165#' },
      { id: 'airtel', name: 'Airtel Money', image: '/assets/images/uganda/airtel.png', ussd: '*185#' }
    ],
    'ZM': [
      { id: 'mtn', name: 'MTN Mobile Money', image: '/assets/images/zambia/mtn.png', color: '#ffcc00' },
      { id: 'airtel', name: 'Airtel Money', image: '/assets/images/zambia/airtel.png', color: '#ff0000' },
      { id: 'zamtel', name: 'Zamtel Kwacha', icon: '📱', color: '#00cc00' }
    ],
    'BI': [
      { id: 'lumitel', name: 'Lumicash', image: '/assets/images/burundi/lumicash.png', color: '#ff9900' },
      { id: 'econet', name: 'EcoCash', icon: '📱', color: '#0066cc' }
    ],
    'CD': [
      { id: 'airtel', name: 'Airtel Money', image: '/assets/images/drc/airtel.png', color: '#ff0000' },
      { id: 'orange', name: 'Orange Money', icon: '📱', color: '#ff6600' },
      { id: 'vodacom', name: 'M-Pesa (Vodacom)', image: '/assets/images/drc/vodacom.png', color: '#e60000' }
    ],
    'MW': [
      { id: 'airtel', name: 'Airtel Money', image: '/assets/images/malawi/airtel.png', color: '#ff0000' },
      { id: 'tnm', name: 'TNM Mpamba', image: '/assets/images/malawi/tnm.png', color: '#009933' }
    ],
    'RW': [
      { id: 'mtn', name: 'MTN Mobile Money', image: '/assets/images/rwanda/mtn.png', color: '#ffcc00' },
      { id: 'airtel', name: 'Airtel Money', image: '/assets/images/rwanda/airtel.png', color: '#ff0000' }
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