/**
 * Cloud Function handler — mining reward claim processing.
 *
 * Triggered by: onDocumentWritten miningClaims/{uid}
 *
 * Client writes a claim request like:
 *   { requestedAt: <timestamp>, status: 'pending' }
 *
 * This function:
 *  1. Validates 24-hour cooldown hasn't been bypassed
 *  2. Reads the reward rate from settings (17% daily of plan value)
 *  3. Credits user balance if valid
 *  4. Updates claim record with status: 'credited' or 'rejected'
 *
 * Idempotent — guard by miningProcessed flag.
 */

const MINING_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_DAILY_RATE = 0.17; // 17%

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} uid
 * @param {object} claim  - the written claim value
 */
export async function runMiningClaimProcessing(db, uid, claim) {
    if (!claim || claim.miningProcessed === true) return;
    if (claim.status !== 'pending') return;

    const claimRef = db.collection('miningClaims').doc(uid);
    const userRef = db.collection('users').doc(uid);

    // Guard: mark as processing
    await claimRef.update({ miningProcessed: 'processing' });

    const batch = db.batch();

    try {
        const now = Date.now();

        // ── Load user ──────────────────────────────────────────────────────
        const userSnap = await userRef.get();
        if (!userSnap.exists) {
            await claimRef.update({ miningProcessed: true, status: 'rejected', rejectReason: 'User not found' });
            return;
        }

        const user = userSnap.data();
        const currency = user.currency || 'TZS';

        if (!user.isActive || user.activationStatus !== 'approved') {
            await claimRef.update({ miningProcessed: true, status: 'rejected', rejectReason: 'Account not active' });
            return;
        }

        // ── 24h cooldown check ─────────────────────────────────────────────
        const lastClaim = user.lastMiningClaim || 0;
        if (now - lastClaim < MINING_COOLDOWN_MS) {
            const remainingMs = MINING_COOLDOWN_MS - (now - lastClaim);
            const remainingHrs = (remainingMs / 3600000).toFixed(1);
            await claimRef.update({
                miningProcessed: true,
                status: 'rejected',
                rejectReason: `Cooldown active — ${remainingHrs}h remaining`
            });
            console.warn(`⏳ Mining claim rejected for ${uid} — ${remainingHrs}h cooldown remaining`);
            return;
        }

        // ── Load settings ─────────────────────────────────────────────────
        const settingsSnap = await db.collection('settings').doc('general').get();
        const settings = settingsSnap.exists ? settingsSnap.data() : {};
        const dailyRate = parseFloat(settings.miningDailyRate) || DEFAULT_DAILY_RATE;

        // Reward is based on user's active plan value or a fixed bonus
        const planValue = parseFloat(user.planValue) || parseFloat(user.activePackageValue) || 0;
        let reward = 0;

        if (planValue > 0) {
            reward = Math.round(planValue * dailyRate);
        } else {
            // Fallback: read from settings.miningFixedReward
            reward = parseFloat(settings.miningFixedReward) || 0;
            // Native conversion fallback logic if old string is tiny (0.17 USD etc)
            if (reward > 0 && reward <= 10) {
                 if (currency === 'TZS') reward = 2500;
                 else if (currency === 'KES') reward = 130;
                 else if (currency === 'UGX') reward = 3700;
                 else if (currency === 'MWK') reward = 1750;
            }
        }

        if (reward <= 0) {
            await claimRef.update({
                miningProcessed: true,
                status: 'rejected',
                rejectReason: 'No active mining plan — purchase a package to mine'
            });
            return;
        }

        // ── Credit balance ─────────────────────────────────────────────────
        const currentBalance = parseFloat(user.balance) || 0;
        const newBalance = currentBalance + reward;
        
        const txRef = db.collection('transactions').doc();

        batch.update(userRef, {
            balance: newBalance,
            totalMiningProfit: (parseFloat(user.totalMiningProfit) || 0) + reward,
            lastMiningClaim: now
        });

        batch.set(txRef, {
            uid,
            type: 'mining_reward',
            description: `Mining reward (${(dailyRate * 100).toFixed(0)}% daily)`,
            amount: reward,
            currency,
            balanceAfter: newBalance,
            createdAt: now
        });

        batch.update(claimRef, {
            status: 'credited',
            reward,
            balanceAfter: newBalance,
            creditedAt: now,
            miningProcessed: true
        });

        // Notification
        const notifRef = db.collection('notifications').doc();
        batch.set(notifRef, {
            uid,
            type: 'mining_reward',
            title: '⛏️ Mining Reward Credited!',
            message: `You earned ${reward} ${currency} from mining today. Keep mining every 24h!`,
            amount: reward,
            currency,
            read: false,
            createdAt: now
        });

        await batch.commit();

        console.log(`⛏️ Mining reward ${reward} ${currency} credited to user ${uid} (balance: ${newBalance})`);
    } catch (error) {
        // Release lock on error
        await claimRef.update({
            miningProcessed: false,
            status: 'pending',
            lastError: error.message
        });
        throw error;
    }
}
