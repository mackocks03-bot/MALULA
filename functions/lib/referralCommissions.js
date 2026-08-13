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
        referralL1: parseFloat(s.referralLevel1) || 2.0,
        referralL2: parseFloat(s.referralLevel2) || 1.0,
        referralL3: parseFloat(s.referralLevel3) || 0.5
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
    
    // NATIVE CONVERSION LOGIC
    const currency = referrer.currency || 'TZS';
    let rate = 2500;
    
    // Fetch rate
    const ratesSnap = await db.collection('settings').doc('rates').get();
    if (ratesSnap.exists) {
        const rates = ratesSnap.data();
        if (rates[currency] && rates[currency] > 0) {
            rate = rates[currency];
        } else if (currency === 'KES') rate = 130;
        else if (currency === 'TZS') rate = 2500;
        else if (currency === 'UGX') rate = 3700;
        else if (currency === 'MWK') rate = 1750;
        else if (currency === 'ZMW') rate = 27;
        else if (currency === 'RWF') rate = 1350;
        else if (currency === 'BIF') rate = 2900;
        else if (currency === 'CDF') rate = 2800;
        else if (currency === 'MZN') rate = 65;
    } else {
        if (currency === 'KES') rate = 130;
        else if (currency === 'TZS') rate = 2500;
        else if (currency === 'UGX') rate = 3700;
        else if (currency === 'MWK') rate = 1750;
        else if (currency === 'ZMW') rate = 27;
        else if (currency === 'RWF') rate = 1350;
        else if (currency === 'BIF') rate = 2900;
        else if (currency === 'CDF') rate = 2800;
        else if (currency === 'MZN') rate = 65;
    }
    
    const localBonusAmount = Math.round(bonusAmount * rate);

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
