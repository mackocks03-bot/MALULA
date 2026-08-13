/**
 * Referral Service
 * Handles referral tracking and commissions
 */

import { db, doc, getDoc, getDocs, updateDoc, addDoc, collection, query, where } from './firebase-config.js';
import { getReferralBonuses } from './settings.js';
import { toLocalDisplay } from './currency.js';

export { getReferralBonuses };

export async function processReferralCommission(referredUid, referrerUsername, currency) {
  try {
    if (!referrerUsername) return null;
    
    // Find referrer by username (case-sensitive)
    const referrerDoc = await getDoc(doc(db, 'loginIndex', referrerUsername));
    if (!referrerDoc.exists()) return null;
    
    const referrerUid = referrerDoc.data().uid;
    const referrerUserDoc = await getDoc(doc(db, 'users', referrerUid));
    if (!referrerUserDoc.exists()) return null;
    
    const referrer = referrerUserDoc.data();
    
    // Check if this referral already exists
    const q = query(collection(db, 'referrals'), where('referrerUid', '==', referrerUid), where('uid', '==', referredUid));
    const existingSnapshot = await getDocs(q);
    
    if (!existingSnapshot.empty && existingSnapshot.docs[0].data().isActive) return null;
    
    const referredDoc = await getDoc(doc(db, 'users', referredUid));
    if (!referredDoc.exists()) return null;
    
    const referred = referredDoc.data();
    
    const bonuses = await getReferralBonuses();
    const bonusUSD = bonuses.level1 || 2.00;
    
    const displayCurrency = currency || referrer.currency || 'TZS';
    
    const currentBalance = referrer.balance || 0;
    const currentProfit = referrer.totalProfit || 0;
    const currentReferrals = referrer.referralCount || 0;
    
    await updateDoc(doc(db, 'users', referrerUid), {
      balance: currentBalance + bonusUSD,
      totalProfit: currentProfit + bonusUSD,
      referralCount: currentReferrals + 1
    });
    
    await addDoc(collection(db, 'transactions'), {
      uid: referrerUid,
      type: 'referral_bonus',
      amount: bonusUSD,
      currency: displayCurrency,
      description: `Level 1 referral bonus for ${referred.username || referred.fullName}`,
      referredUid: referredUid,
      level: 1,
      createdAt: Date.now()
    });
    
    // Update the existing referral doc (created at registration) instead of adding a duplicate
    const existingRef = existingSnapshot.docs[0]?.ref;
    if (existingRef) {
      await updateDoc(existingRef, {
        isActive: true,
        bonusUSD: bonusUSD,
        currency: displayCurrency,
        activatedAt: Date.now()
      });
    } else {
      await addDoc(collection(db, 'referrals'), {
        referrerUid,
        uid: referredUid,
        username: referred.username,
        fullName: referred.fullName,
        phone: referred.phone,
        country: referred.country,
        createdAt: Date.now(),
        isActive: true,
        level: 1,
        bonusUSD: bonusUSD,
        currency: displayCurrency
      });
    }
    
    if (referrer.referrer) {
      await processLevel2Commission(referredUid, referrer.referrer, displayCurrency);
    }
    
    return { success: true, bonus: bonusUSD, level: 1 };
  } catch (error) { return null; }
}

async function processLevel2Commission(referredUid, referrerUsername, currency) {
  try {
    const bonuses = await getReferralBonuses();
    const bonusUSD = bonuses.level2 || 1.00;
    
    // Use exact username (no toLowerCase) — loginIndex keys are case-sensitive
    const referrerDoc = await getDoc(doc(db, 'loginIndex', referrerUsername));
    if (!referrerDoc.exists()) return;
    
    const referrerUid = referrerDoc.data().uid;
    const referrerUserDoc = await getDoc(doc(db, 'users', referrerUid));
    if (!referrerUserDoc.exists()) return;
    
    const referrer = referrerUserDoc.data();
    
    const currentBalance = referrer.balance || 0;
    const currentProfit = referrer.totalProfit || 0;
    
    await updateDoc(doc(db, 'users', referrerUid), {
      balance: currentBalance + bonusUSD,
      totalProfit: currentProfit + bonusUSD
    });
    
    await addDoc(collection(db, 'transactions'), {
      uid: referrerUid,
      type: 'referral_bonus',
      amount: bonusUSD,
      currency: currency,
      description: 'Level 2 referral bonus',
      referredUid: referredUid,
      level: 2,
      createdAt: Date.now()
    });
    
    // Check for existing level-2 referral doc, update or create
    const existingQ = query(collection(db, 'referrals'), where('referrerUid', '==', referrerUid), where('uid', '==', referredUid), where('level', '==', 2));
    const existingSnap = await getDocs(existingQ);
    if (!existingSnap.empty) {
      await updateDoc(existingSnap.docs[0].ref, { isActive: true, bonusUSD, currency, activatedAt: Date.now() });
    } else {
      await addDoc(collection(db, 'referrals'), {
        referrerUid,
        uid: referredUid,
        isActive: true,
        level: 2,
        bonusUSD: bonusUSD,
        currency: currency,
        createdAt: Date.now()
      });
    }
    
    if (referrer.referrer) {
      await processLevel3Commission(referredUid, referrer.referrer, currency);
    }
  } catch (error) { console.error('Level 2 commission error:', error); }
}

async function processLevel3Commission(referredUid, referrerUsername, currency) {
  try {
    const bonuses = await getReferralBonuses();
    const bonusUSD = bonuses.level3 || 0.50;
    
    // Use exact username (no toLowerCase) — loginIndex keys are case-sensitive
    const referrerDoc = await getDoc(doc(db, 'loginIndex', referrerUsername));
    if (!referrerDoc.exists()) return;
    
    const referrerUid = referrerDoc.data().uid;
    const referrerUserDoc = await getDoc(doc(db, 'users', referrerUid));
    if (!referrerUserDoc.exists()) return;
    
    const referrer = referrerUserDoc.data();
    
    const currentBalance = referrer.balance || 0;
    const currentProfit = referrer.totalProfit || 0;
    
    await updateDoc(doc(db, 'users', referrerUid), {
      balance: currentBalance + bonusUSD,
      totalProfit: currentProfit + bonusUSD
    });
    
    await addDoc(collection(db, 'transactions'), {
      uid: referrerUid,
      type: 'referral_bonus',
      amount: bonusUSD,
      currency: currency,
      description: 'Level 3 referral bonus',
      referredUid: referredUid,
      level: 3,
      createdAt: Date.now()
    });
    
    // Check for existing level-3 referral doc, update or create
    const existingQ = query(collection(db, 'referrals'), where('referrerUid', '==', referrerUid), where('uid', '==', referredUid), where('level', '==', 3));
    const existingSnap = await getDocs(existingQ);
    if (!existingSnap.empty) {
      await updateDoc(existingSnap.docs[0].ref, { isActive: true, bonusUSD, currency, activatedAt: Date.now() });
    } else {
      await addDoc(collection(db, 'referrals'), {
        referrerUid,
        uid: referredUid,
        isActive: true,
        level: 3,
        bonusUSD: bonusUSD,
        currency: currency,
        createdAt: Date.now()
      });
    }
  } catch (error) { console.error('Level 3 commission error:', error); }
}

export async function getReferralTree(uid) {
  try {
    const q = query(collection(db, 'referrals'), where('referrerUid', '==', uid));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return { level1: [], level2: [], level3: [] };
    }
    
    const referrals = snapshot.docs.map(doc => doc.data());
    
    const level1 = referrals.filter(r => r.level === 1 || !r.level);
    const level2 = referrals.filter(r => r.level === 2);
    const level3 = referrals.filter(r => r.level === 3);
    
    return { level1, level2, level3 };
  } catch (error) {
    return { level1: [], level2: [], level3: [] };
  }
}

export async function getReferralCount(uid) {
  try {
    const tree = await getReferralTree(uid);
    return tree.level1.length;
  } catch (error) { return 0; }
}

export default {
  getReferralBonuses,
  processReferralCommission,
  getReferralTree,
  getReferralCount
};