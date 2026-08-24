import { FieldValue } from 'firebase-admin/firestore';
import { sendPushNotification } from './sendPushNotification.js';

/**
 * Resolve referrer username → UID via loginIndex (exact then lowercase)
 */
export async function resolveReferrerUid(db, referrerUsername) {
    if (!referrerUsername) return null;

    const candidates = [referrerUsername];
    const lower = String(referrerUsername).toLowerCase();
    if (lower !== referrerUsername) candidates.push(lower);

    for (const name of candidates) {
        const snap = await db.collection('loginIndex').doc(name).get();
        if (snap.exists) return snap.data().uid;
    }
    return null;
}

export async function loadBonusSettings(db) {
    const snap = await db.collection('settings').doc('general').get();
    const s = snap.exists ? snap.data() : {};
    return {
        welcomeBonus: parseFloat(s.welcomeBonus) || 4.0,
        referralL1: parseFloat(s.referralLevel1) || 3.6, // 9000 TZS
        referralL2: parseFloat(s.referralLevel2) || 1.2, // 3000 TZS
        referralL3: parseFloat(s.referralLevel3) || 0.4  // 1000 TZS
    };
}

/**
 * Credit one referral level — idempotent per payment + level
 */
export async function processReferralBonus(db, {
    paymentId,
    referrerUsername,
    newUserId,
    newUsername,
    level,
    bonusAmount
}) {
    if (!referrerUsername || bonusAmount <= 0) return null;

    const referrerUid = await resolveReferrerUid(db, referrerUsername);
    if (!referrerUid) {
        console.warn(`Referrer not found: ${referrerUsername}`);
        return null;
    }

    const commissionId = `${paymentId}_level${level}`;
    const commissionLogRef = db.collection('commissionLog').doc(commissionId);
    const logged = await commissionLogRef.get();
    if (logged.exists) {
        return logged.data();
    }

    const referrerRef = db.collection('users').doc(referrerUid);
    const referrerSnap = await referrerRef.get();
    if (!referrerSnap.exists) return null;

    const referrer = referrerSnap.data();

    // NATIVE CONVERSION LOGIC (Hardcoded Server Matrix)
    const currency = referrer.currency || 'TZS';
    
    const COMMISSIONS = {
        TZS: { 1: 10000, 2: 3500, 3: 1000 },
        KES: { 1: 500,  2: 150,  3: 50 },
        UGX: { 1: 13500,2: 4500, 3: 1500 },
        MWK: { 1: 6300, 2: 2100, 3: 700 },
        RWF: { 1: 5000, 2: 1500, 3: 500 },
        ZMW: { 1: 80,   2: 30,   3: 10 },
        BIF: { 1: 9000, 2: 4000, 3: 1500 },
        CDF: { 1: 10000,2: 3500, 3: 1000 },
        MZN: { 1: 250,  2: 80,   3: 25 },
    };

    const currencyMatrix = COMMISSIONS[currency] || COMMISSIONS.TZS;
    const localBonusAmount = currencyMatrix[level];

    if (!localBonusAmount || localBonusAmount <= 0) return null;

    const balance = parseFloat(referrer.balance) || 0;
    const newBalance = balance + localBonusAmount;
    const now = Date.now();

    const userUpdates = {
        balance: newBalance,
        totalReferralBonus: (parseFloat(referrer.totalReferralBonus) || 0) + localBonusAmount,
        totalProfit: (parseFloat(referrer.totalProfit) || 0) + localBonusAmount
    };
    if (level === 1) {
        userUpdates.referralCount = (parseInt(referrer.referralCount, 10) || 0) + 1;
    }

    await referrerRef.update(userUpdates);

    await db.collection('referralBonuses').add({
        uid: referrerUid,
        fromUid: newUserId,
        fromUsername: newUsername || 'unknown',
        level,
        amount: localBonusAmount,
        amountUSD: bonusAmount,
        currency,
        type: 'activation',
        paymentId,
        createdAt: now
    });

    // (Legacy referrals collection update removed. Frontend Affiliate page now reads native referral sub-arrays directly from user objects and dynamically infers activity statuses)

    await db.collection('notifications').add({
        uid: referrerUid,
        type: 'referral_bonus',
        title: `Level ${level} Referral Bonus! 🎉`,
        message: `${newUsername || 'User'} activated! You earned ${localBonusAmount} ${currency} (Level ${level})`,
        amount: localBonusAmount,
        currency,
        level,
        fromUser: newUsername || 'user',
        read: false,
        createdAt: now
    });

    await db.collection('transactions').add({
        uid: referrerUid,
        type: 'referral_bonus',
        description: `Level ${level} referral bonus from ${newUsername}`,
        amount: localBonusAmount,
        currency,
        balanceAfter: newBalance,
        fromUser: newUsername,
        paymentId,
        createdAt: now
    });

    const result = {
        level,
        uid: referrerUid,
        username: referrerUsername,
        amount: localBonusAmount,
        bonusUSD: bonusAmount,
        referrerUsername: referrer.referrer || null
    };

    await commissionLogRef.set(result);
    console.log(`✅ L${level} commission ${localBonusAmount} ${currency} → ${referrerUsername}`);

    // Send push notification instantly to the upliner!
    await sendPushNotification(
        db, 
        referrerUid, 
        'New Commission Received! 💸', 
        `You just earned ${localBonusAmount} ${currency} from ${newUsername} (Level ${level})!`,
        { type: 'commission', amount: localBonusAmount, currency, level }
    );

    return result;
}

/**
 * Process all 3 MLM levels for an activation payment
 */
export async function processAllReferralCommissions(db, paymentId, user) {
    const bonuses = await loadBonusSettings(db);
    const results = [];
    const referrer = user.referrer;
    if (!referrer) return results;

    const l1 = await processReferralBonus(db, {
        paymentId,
        referrerUsername: referrer,
        newUserId: user.uid || user.id,
        newUsername: user.username,
        level: 1,
        bonusAmount: bonuses.referralL1
    });
    if (l1) {
        results.push(l1);
        if (l1.referrerUsername) {
            const l2 = await processReferralBonus(db, {
                paymentId,
                referrerUsername: l1.referrerUsername,
                newUserId: user.uid || user.id,
                newUsername: user.username,
                level: 2,
                bonusAmount: bonuses.referralL2
            });
            if (l2) {
                results.push(l2);
                if (l2.referrerUsername) {
                    const l3 = await processReferralBonus(db, {
                        paymentId,
                        referrerUsername: l2.referrerUsername,
                        newUserId: user.uid || user.id,
                        newUsername: user.username,
                        level: 3,
                        bonusAmount: bonuses.referralL3
                    });
                    if (l3) results.push(l3);
                }
            }
        }
    }
    return results;
}
