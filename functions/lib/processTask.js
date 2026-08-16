/**
 * Cloud Function handler — task reward claim processing.
 *
 * Triggered by: onDocumentWritten userTasks/{userTaskId}
 *
 * Client writes a claim request:
 *   { status: 'pending_verification', taskId, taskTitle, category, reward }
 *
 * This function:
 *  1. Validates the user and active status
 *  2. Credits user balance securely based on the provided reward
 *  3. Updates claim record with status: 'completed'
 *
 * Idempotent — guarded by taskProcessed flag.
 */

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} userTaskId
 * @param {object} claim  - the written userTask value
 */
export async function runTaskProcessing(db, userTaskId, claim) {
    if (!claim || claim.taskProcessed === true) return;
    if (claim.status !== 'pending_verification') return;

    const uid = claim.uid;
    const taskId = claim.taskId;
    
    if (!uid || !taskId) return;

    // Reject immediately if the timestamp doesn't match the current server timezone (Dar es Salaam / EAT / UTC+3)
    const nowMs = Date.now();
    const serverDate = new Date(nowMs + (3 * 3600000));
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const serverDay = dayNames[serverDate.getUTCDay()];

    if (!taskId.includes(serverDay)) {
        await db.collection('userTasks').doc(userTaskId).update({
            taskProcessed: true,
            status: 'rejected',
            rejectReason: 'Timezone manipulation blocked. Submitted task does not match server day.'
        });
        return;
    }

    const claimRef = db.collection('userTasks').doc(userTaskId);
    const userRef = db.collection('users').doc(uid);

    // Guard: mark as processing
    await claimRef.update({ taskProcessed: 'processing' });

    const batch = db.batch();

    try {
        const now = Date.now();

        // ── Load user ──────────────────────────────────────────────────────
        const userSnap = await userRef.get();
        if (!userSnap.exists) {
            await claimRef.update({ taskProcessed: true, status: 'rejected', rejectReason: 'User not found' });
            return;
        }

        const user = userSnap.data();
        const currency = claim.rewardCurrency || user.currency || 'TZS';

        if (!user.isActive || user.activationStatus !== 'approved') {
            await claimRef.update({ taskProcessed: true, status: 'rejected', rejectReason: 'Account not active' });
            return;
        }

        const reward = parseFloat(claim.reward) || 0;
        const category = claim.category || claim.taskCategory || 'general';

        if (reward <= 0) {
            await claimRef.update({
                taskProcessed: true,
                status: 'rejected',
                rejectReason: 'Invalid task reward'
            });
            return;
        }

        // ── Credit balance ─────────────────────────────────────────────────
        const currentBalance = parseFloat(user.balance) || 0;
        const currentProfit = parseFloat(user.totalProfit) || 0;
        const newBalance = currentBalance + reward;
        
        const earnings = user.earnings || {};
        const categoryEarnings = parseFloat(earnings[category]) || 0;
        earnings[category] = categoryEarnings + reward;
        
        const taskBalances = user.taskBalances || {};
        const categoryTaskBal = parseFloat(taskBalances[category]) || 0;
        taskBalances[category] = categoryTaskBal + reward;

        const txRef = db.collection('transactions').doc();

        batch.update(userRef, {
            balance: newBalance,
            totalProfit: currentProfit + reward,
            earnings: earnings,
            taskBalances: taskBalances
        });

        batch.set(txRef, {
            uid,
            type: 'task',
            description: `Task reward: ${claim.taskTitle || 'Activity completed'}`,
            amount: reward,
            currency,
            taskId,
            category,
            balanceAfter: newBalance,
            createdAt: now
        });

        batch.update(claimRef, {
            status: 'completed',
            completedAt: now,
            updatedAt: now,
            taskProcessed: true
        });

        // Notification
        const notifRef = db.collection('notifications').doc();
        batch.set(notifRef, {
            uid,
            type: 'earning',
            title: 'Task Completed! 🎉',
            message: `You earned ${reward} ${currency} from "${claim.taskTitle || 'task'}".`,
            amount: reward,
            currency,
            taskId,
            read: false,
            createdAt: now
        });

        await batch.commit();

        console.log(`✅ Task reward ${reward} ${currency} credited to user ${uid} (balance: ${newBalance})`);
    } catch (error) {
        // Release lock on error
        await claimRef.update({
            taskProcessed: false,
            processingError: error.message,
            status: 'failed'
        });
        throw error;
    }
}
