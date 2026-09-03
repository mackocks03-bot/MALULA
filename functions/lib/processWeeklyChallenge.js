import { logger } from 'firebase-functions';
import { generateTxHash, getFormattedDate } from './utils.js';
import { sendPushNotification } from './sendPushNotification.js';

const CHALLENGE_REWARDS = {
    TZS: { rank1: 15000, rank2: 10000, rank3: 5000, rank4_11: 500, rank12_20: 300 },
    KES: { rank1: 800,   rank2: 500,   rank3: 300,  rank4_11: 20,  rank12_20: 10 },
    UGX: { rank1: 22000, rank2: 15000, rank3: 7500, rank4_11: 600, rank12_20: 400 },
    MWK: { rank1: 10500, rank2: 7000,  rank3: 3500, rank4_11: 300, rank12_20: 200 },
    ZMW: { rank1: 150,   rank2: 100,   rank3: 50,   rank4_11: 5,   rank12_20: 3 },
    RWF: { rank1: 8000,  rank2: 5000,  rank3: 2500, rank4_11: 200, rank12_20: 150 },
    BIF: { rank1: 17500, rank2: 12000, rank3: 6000, rank4_11: 500, rank12_20: 300 },
    CDF: { rank1: 17000, rank2: 11500, rank3: 5500, rank4_11: 450, rank12_20: 300 },
    MZN: { rank1: 400,   rank2: 250,   rank3: 150,  rank4_11: 15,  rank12_20: 10 }
};

function getWeekWindow() {
    const now = new Date();
    const day = now.getDay(); // 0=Sun…6=Sat
    const diffToMon = (day === 0 ? -6 : 1 - day); // days back to Monday
    const mon = new Date(now);
    mon.setDate(now.getDate() + diffToMon);
    mon.setHours(0, 0, 0, 0);

    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    sun.setHours(23, 59, 59, 999);

    return { start: mon.getTime(), end: sun.getTime() };
}

function getRewardForRank(rankIndex, currency) {
    const rates = CHALLENGE_REWARDS[currency] || CHALLENGE_REWARDS['TZS'];
    if (rankIndex === 0) return rates.rank1;
    if (rankIndex === 1) return rates.rank2;
    if (rankIndex === 2) return rates.rank3;
    if (rankIndex >= 3 && rankIndex <= 10) return rates.rank4_11;
    if (rankIndex >= 11 && rankIndex <= 19) return rates.rank12_20;
    return 0;
}

export async function runWeeklyChallengeSweep(db) {
    logger.info('Starting weekly challenge evaluation...');
    const { start, end } = getWeekWindow();
    
    // 1. Fetch all users to compute the leaderboard
    const usersSnap = await db.collection('users').get();
    if (usersSnap.empty) {
        logger.info('No users found.');
        return;
    }

    const allUsers = usersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() }));

    // 2. Filter users activated this week
    const activatedThisWeek = allUsers.filter(u => {
        if (u.activationStatus !== 'approved' && u.isActive !== true) return false;
        const ts = u.activatedAt || u.approvedAt || u.createdAt || 0;
        return ts >= start && ts <= end;
    });

    // 3. Count weekly activations per referrer username
    const weeklyCountByUsername = {};
    activatedThisWeek.forEach(u => {
        const ref = u.referrer;
        if (ref) {
            weeklyCountByUsername[ref] = (weeklyCountByUsername[ref] || 0) + 1;
        }
    });

    // 4. Build ranked list and sort
    const ranked = allUsers
        .filter(u => u.role !== 'admin')
        .map(u => ({
            uid: u.uid,
            username: u.username || 'User',
            country: u.country || 'TZ',
            currency: u.currency || 'TZS',
            weeklyRefs: weeklyCountByUsername[u.username] || 0,
            balance: parseFloat(u.balance) || 0,
            totalProfit: parseFloat(u.totalProfit) || 0
        }))
        .filter(u => u.weeklyRefs > 0)
        .sort((a, b) => b.weeklyRefs - a.weeklyRefs);

    const top20 = ranked.slice(0, 20);

    if (top20.length === 0) {
        logger.info('No one had referrals this week. No rewards distributed.');
        return;
    }

    const batch = db.batch();
    const winnersToSave = [];
    const now = Date.now();
    const dateStr = getFormattedDate();

    for (let i = 0; i < top20.length; i++) {
        const winner = top20[i];
        const prizeAmount = getRewardForRank(i, winner.currency);
        
        if (prizeAmount <= 0) continue;

        const newBalance = winner.balance + prizeAmount;
        const newTotalProfit = winner.totalProfit + prizeAmount;

        // Update User Doc
        const userRef = db.collection('users').doc(winner.uid);
        batch.update(userRef, {
            balance: newBalance,
            totalProfit: newTotalProfit
        });

        const txHash = generateTxHash();
        
        // Add Transaction
        const txRef = db.collection('transactions').doc();
        batch.set(txRef, {
            uid: winner.uid,
            type: 'challenge_reward',
            description: `Weekly Challenge Reward - Rank #${i + 1}`,
            amount: prizeAmount,
            currency: winner.currency,
            balanceAfter: newBalance,
            txHash: txHash,
            createdAt: now
        });

        // Add Notification
        const notifRef = db.collection('notifications').doc();
        batch.set(notifRef, {
            uid: winner.uid,
            type: 'challenge_reward',
            title: `Weekly Challenge Winner! 🏆`,
            message: `Congratulations! You placed #${i + 1} in the weekly challenge and won ${prizeAmount} ${winner.currency}. Date: ${dateStr}`,
            amount: prizeAmount,
            currency: winner.currency,
            read: false,
            createdAt: now
        });

        winnersToSave.push({
            uid: winner.uid,
            username: winner.username,
            country: winner.country,
            currency: winner.currency,
            rank: i + 1,
            weeklyRefs: winner.weeklyRefs,
            prizeAmount: prizeAmount
        });
        
        // Send push notification instantly asynchronously
        sendPushNotification(
            db, 
            winner.uid, 
            'Weekly Challenge Winner! 🏆', 
            `Congratulations! You placed #${i + 1} and won ${prizeAmount} ${winner.currency}.`,
            { txId: txHash, type: 'challenge_reward', amount: prizeAmount, currency: winner.currency, rank: i + 1 }
        ).catch(e => logger.error(`Failed to send push notification to winner ${winner.uid}`, e));
    }

    // Save Winner Record Document
    const recordRef = db.collection('challengeWinners').doc(`week_${start}`);
    batch.set(recordRef, {
        weekStart: start,
        weekEnd: end,
        processedAt: now,
        winners: winnersToSave
    });

    try {
        await batch.commit();
        logger.info(`Successfully processed ${winnersToSave.length} challenge winners.`);
    } catch (error) {
        logger.error('Failed to commit weekly challenge rewards batch', error);
    }
}
