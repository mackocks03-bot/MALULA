/**
 * Cloud Function handler — task reward claim processing.
 *
 * Triggered by: onDocumentWritten userTasks/{userTaskId}
 *
 * Client writes a claim request with status: 'pending_verification'
 */

export async function runTaskProcessing(db, userTaskId, triggerClaim) {
    if (!triggerClaim || triggerClaim.taskProcessed === true || triggerClaim.status !== 'pending_verification') return;

    const uid = triggerClaim.uid;
    const taskId = triggerClaim.taskId;
    
    if (!uid || !taskId) return;

    // Hardcoded daily rewards per country perfectly matching frontend configurations to prevent injection attacks
    const DAILY_REWARDS = {
        sunday:    { TZS: 5000, KES: 250, UGX: 15000, MWK: 4000, ZMW: 50, RWF: 2500, BIF: 5000, CDF: 5000 },
        monday:    { TZS: 1000, KES: 50,  UGX: 3000,  MWK: 800,  ZMW: 10, RWF: 500,  BIF: 1000, CDF: 1000 },
        tuesday:   { TZS: 1000, KES: 50,  UGX: 3000,  MWK: 800,  ZMW: 10, RWF: 500,  BIF: 1000, CDF: 1000 },
        wednesday: { TZS: 2000, KES: 100, UGX: 6000,  MWK: 1600, ZMW: 20, RWF: 1000, BIF: 2000, CDF: 2000 },
        thursday:  { TZS: 1000, KES: 50,  UGX: 3000,  MWK: 800,  ZMW: 10, RWF: 500,  BIF: 1000, CDF: 1000 },
        friday:    { TZS: 1000, KES: 50,  UGX: 3000,  MWK: 800,  ZMW: 10, RWF: 500,  BIF: 1000, CDF: 1000 },
        saturday:  { TZS: 1000, KES: 50,  UGX: 3000,  MWK: 800,  ZMW: 10, RWF: 500,  BIF: 1000, CDF: 1000 }
    };

    // Calculate server day explicitly
    const nowMs = Date.now();
    const serverDate = new Date(nowMs + (3 * 3600000)); // Dar es Salaam / EAT / UTC+3
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const serverDay = dayNames[serverDate.getUTCDay()];

    const claimRef = db.collection('userTasks').doc(userTaskId);
    const userRef = db.collection('users').doc(uid);

    try {
        await db.runTransaction(async (t) => {
            // ── Verify Claim Exists & Not Processed ───────────────────────────────
            const claimSnap = await t.get(claimRef);
            if (!claimSnap.exists) {
                throw new Error("Claim does not exist");
            }

            const claim = claimSnap.data();
            if (claim.taskProcessed === true || claim.taskProcessed === 'processing' || claim.status !== 'pending_verification') {
                return; // Guard against race conditions and double spends!
            }

            const adminForced = claim.adminForcedCredit === true;

            if (!adminForced && !taskId.includes(serverDay)) {
                const msg = `Day mismatch: taskId="${taskId}" serverDay="${serverDay}" userTaskId="${userTaskId}"`;
                console.warn('Task rejected —', msg);
                t.update(claimRef, {
                    taskProcessed: true,
                    status: 'rejected',
                    rejectReason: 'Day mismatch: ' + msg
                });
                return;
            }

            // Lock document from concurrent runs immediately
            t.update(claimRef, { taskProcessed: 'processing' });

            // ── Verify User Status ────────────────────────────────────────────────
            const userSnap = await t.get(userRef);
            if (!userSnap.exists) {
                t.update(claimRef, { taskProcessed: true, status: 'rejected', rejectReason: 'User not found' });
                return;
            }

            const user = userSnap.data();
            const currency = user.currency || 'TZS';

            // Accept either flag — admin may set one but not both
            const isActivated = user.isActive === true || user.activationStatus === 'approved';
            if (!adminForced && !isActivated) {
                const reason = `isActive=${user.isActive} activationStatus=${user.activationStatus}`;
                console.warn(`Task rejected — account not active for uid=${uid}: ${reason}`);
                t.update(claimRef, { taskProcessed: true, status: 'rejected', rejectReason: 'Account not active: ' + reason });
                return;
            }

            // ── Strictly Enforce Hardcoded Reward ─────────────────────────────────
            // Overrides whatever `reward` the client requested. Spoofing is blocked.
            const reward = DAILY_REWARDS[serverDay]?.[currency] || DAILY_REWARDS[serverDay]?.TZS || 0;
            const category = claim.category || claim.taskCategory || 'general';

            if (reward <= 0) {
                t.update(claimRef, { taskProcessed: true, status: 'rejected', rejectReason: 'Invalid task reward configuration' });
                return;
            }

            // ── Execute Balances ──────────────────────────────────────────────────
            const currentBalance = parseFloat(user.balance) || 0;
            const currentProfit = parseFloat(user.totalProfit) || 0;
            
            const earnings = user.earnings || {};
            const categoryEarnings = parseFloat(earnings[category]) || 0;
            earnings[category] = categoryEarnings + reward;
            
            const taskBalances = user.taskBalances || {};
            const categoryTaskBal = parseFloat(taskBalances[category]) || 0;
            taskBalances[category] = categoryTaskBal + reward;

            const txRef = db.collection('transactions').doc();
            const notifRef = db.collection('notifications').doc();

            t.update(userRef, {
                totalProfit: currentProfit + reward,
                earnings: earnings,
                taskBalances: taskBalances
            });

            t.set(txRef, {
                uid,
                type: 'task',
                description: `Task reward: ${claim.taskTitle || 'Activity completed'}`,
                amount: reward,
                currency,
                taskId,
                category,
                balanceAfter: currentBalance,
                createdAt: nowMs
            });

            t.set(notifRef, {
                uid,
                type: 'earning',
                title: 'Task Completed! 🎉',
                message: `You earned ${reward} ${currency} from "${claim.taskTitle || 'task'}".`,
                amount: reward,
                currency,
                taskId,
                read: false,
                createdAt: nowMs
            });

            // Mark claim strictly processed
            t.update(claimRef, {
                status: 'completed',
                completedAt: nowMs,
                updatedAt: nowMs,
                reward: reward, // Store the truth
                taskProcessed: true
            });
            console.log(`✅ Task reward securely credited using strict lookup: ${reward} ${currency} to user ${uid}`);
        });
    } catch (error) {
        if (error.message !== 'Claim does not exist') {
            await claimRef.update({
                taskProcessed: false,
                processingError: error.message,
                status: 'failed'
            });
        }
        console.error("Task processing transaction failed:", error);
    }
}
