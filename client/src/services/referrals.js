/**
 * Referral Service
 * Handles referral tracking and commissions using embedded arrays
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
    
    const referredDoc = await getDoc(doc(db, 'users', referredUid));
    if (!referredDoc.exists()) return null;
    const referred = referredDoc.data();
    
    // Safety check: Prevent double crediting by checking transactions
    const txQuery = query(
      collection(db, 'transactions'),
      where('uid', '==', referrerUid),
      where('referredUid', '==', referredUid),
      where('type', '==', 'referral_bonus'),
      where('level', '==', 1)
    );
    const txSnap = await getDocs(txQuery);
    if (!txSnap.empty) return null; // Already paid for this user

    const bonuses = await getReferralBonuses();
    const bonusUSD = bonuses.level1 || 2.00;
    
    const displayCurrency = currency || referrer.currency || 'TZS';
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
      currency: displayCurrency,
      description: `Level 1 referral bonus for ${referred.username || referred.fullName}`,
      referredUid: referredUid,
      level: 1,
      createdAt: Date.now()
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
    
    const referrerDoc = await getDoc(doc(db, 'loginIndex', referrerUsername));
    if (!referrerDoc.exists()) return;
    
    const referrerUid = referrerDoc.data().uid;
    const referrerUserDoc = await getDoc(doc(db, 'users', referrerUid));
    if (!referrerUserDoc.exists()) return;
    
    const referrer = referrerUserDoc.data();
    
    const txQuery = query(
      collection(db, 'transactions'),
      where('uid', '==', referrerUid),
      where('referredUid', '==', referredUid),
      where('type', '==', 'referral_bonus'),
      where('level', '==', 2)
    );
    const txSnap = await getDocs(txQuery);
    if (!txSnap.empty) return; // Already paid

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
    
    if (referrer.referrer) {
      await processLevel3Commission(referredUid, referrer.referrer, currency);
    }
  } catch (error) { console.error('Level 2 commission error:', error); }
}

async function processLevel3Commission(referredUid, referrerUsername, currency) {
  try {
    const bonuses = await getReferralBonuses();
    const bonusUSD = bonuses.level3 || 0.50;
    
    const referrerDoc = await getDoc(doc(db, 'loginIndex', referrerUsername));
    if (!referrerDoc.exists()) return;
    
    const referrerUid = referrerDoc.data().uid;
    const referrerUserDoc = await getDoc(doc(db, 'users', referrerUid));
    if (!referrerUserDoc.exists()) return;
    
    const referrer = referrerUserDoc.data();
    
    const txQuery = query(
      collection(db, 'transactions'),
      where('uid', '==', referrerUid),
      where('referredUid', '==', referredUid),
      where('type', '==', 'referral_bonus'),
      where('level', '==', 3)
    );
    const txSnap = await getDocs(txQuery);
    if (!txSnap.empty) return; // Already paid

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

  } catch (error) { console.error('Level 3 commission error:', error); }
}

// Helper to batch fetch user details from UIDs
async function fetchUserDetailsForIds(ids) {
  if (!ids || ids.length === 0) return [];
  try {
    const promises = ids.map(id => getDoc(doc(db, 'users', id)));
    const snaps = await Promise.all(promises);
    return snaps.map(s => {
      if (!s.exists()) return null;
      const data = s.data();
      return {
        uid: data.uid,
        username: data.username,
        fullName: data.fullName,
        createdAt: data.createdAt,
        isActive: Boolean(data.activationStatus === 'approved' || data.isActive)
      };
    }).filter(d => d !== null);
  } catch(e) {
    return [];
  }
}

export async function getReferralTree(uid) {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) return { level1: [], level2: [], level3: [] };
    
    const userData = userDoc.data();
    const refs = userData.referrals || { level1: [], level2: [], level3: [] };
    
    const [level1, level2, level3] = await Promise.all([
      fetchUserDetailsForIds(refs.level1),
      fetchUserDetailsForIds(refs.level2),
      fetchUserDetailsForIds(refs.level3)
    ]);
    
    return { level1, level2, level3 };
  } catch (error) {
    return { level1: [], level2: [], level3: [] };
  }
}

export async function getReferralCount(uid) {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) return 0;
    const refs = userDoc.data().referrals || {};
    return (refs.level1 || []).length;
  } catch (error) { return 0; }
}

export default {
  getReferralBonuses,
  processReferralCommission,
  getReferralTree,
  getReferralCount
};