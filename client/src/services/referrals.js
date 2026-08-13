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
    
    if (!existingSnapshot.empty) return null;
    
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
    
    const referrerLower = referrerUsername.toLowerCase();
    const referrerDoc = await getDoc(doc(db, 'loginIndex', referrerLower));
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
    
    await addDoc(collection(db, 'referrals'), {
      referrerUid,
      uid: referredUid,
      isActive: true,
      level: 2,
      bonusUSD: bonusUSD,
      currency: currency,
      createdAt: Date.now()
    });
    
    if (referrer.referrer) {
      await processLevel3Commission(referredUid, referrer.referrer, currency);
    }
  } catch (error) {}
}

async function processLevel3Commission(referredUid, referrerUsername, currency) {
  try {
    const bonuses = await getReferralBonuses();
    const bonusUSD = bonuses.level3 || 0.50;
    
    const referrerLower = referrerUsername.toLowerCase();
    const referrerDoc = await getDoc(doc(db, 'loginIndex', referrerLower));
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
    
    await addDoc(collection(db, 'referrals'), {
      referrerUid,
      uid: referredUid,
      isActive: true,
      level: 3,
      bonusUSD: bonusUSD,
      currency: currency,
      createdAt: Date.now()
    });
  } catch (error) {}
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