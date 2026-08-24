import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onDocumentWritten, onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { runActivationProcessing } from './lib/processActivation.js';
import { runDepositProcessing } from './lib/processDeposit.js';
import { runWithdrawalProcessing } from './lib/processWithdrawal.js';
import { runMiningClaimProcessing } from './lib/processMining.js';
import { runTaskProcessing } from './lib/processTask.js';
import { sendBeemSMS } from './lib/sendBeemSMS.js';

initializeApp();

const RTDB_REGION = 'us-central1';

function shouldProcessActivation(payment) {
    if (!payment || payment.activationProcessed === true) return false;
    if (payment.activationProcessed === 'processing') return false;
    return payment.palmpesaStatus === 'COMPLETED' || payment.adminApproveRequested === true;
}

/**
 * Heavy lifting: activate account + welcome bonus + 3-level MLM commissions
 * Triggers when PalmPesa payment completes OR admin requests approval
 */
export const processActivationPayment = onDocumentWritten(
    {
        document: 'activationPayments/{paymentId}',
        region: RTDB_REGION,
        timeoutSeconds: 120,
        memory: '256MiB'
    },
    async (event) => {
        if (!event.data) return;
        const after = event.data.after ? event.data.after.data() : null;
        if (!shouldProcessActivation(after)) return;

        const paymentId = event.params.paymentId;
        const db = getFirestore();

        logger.info(`Processing activation payment ${paymentId}`);

        try {
            await runActivationProcessing(db, paymentId, after);
        } catch (error) {
            logger.error(`Activation processing failed ${paymentId}`, error);
            throw error;
        }
    }
);

/**
 * Credit shop balance after PalmPesa wallet deposit
 */
export const processPalmpesaDeposit = onDocumentWritten(
    {
        document: 'palmpesaPending/{orderId}',
        region: RTDB_REGION,
        timeoutSeconds: 60,
        memory: '256MiB'
    },
    async (event) => {
        if (!event.data) return;
        const after = event.data.after ? event.data.after.data() : null;
        if (!after) return;
        if (after.type !== 'deposit') return;
        if (after.palmpesaStatus !== 'COMPLETED') return;
        if (after.depositProcessed === true) return;

        const orderId = event.params.orderId;
        const db = getFirestore();

        logger.info(`Processing PalmPesa deposit ${orderId}`);

        try {
            await runDepositProcessing(db, orderId, after);
        } catch (error) {
            logger.error(`Deposit processing failed ${orderId}`, error);
            throw error;
        }
    }
);

/**
 * Handle withdrawal status changes:
 *  - New pending request → notify admin
 *  - Approved → notify user
 *  - Rejected → refund + notify user
 */
export const onWithdrawalChanged = onDocumentWritten(
    {
        document: 'withdrawals/{withdrawalId}',
        region: RTDB_REGION,
        timeoutSeconds: 60,
        memory: '256MiB'
    },
    async (event) => {
        if (!event.data) return;
        const before = event.data.before ? event.data.before.data() : null;
        const after = event.data.after ? event.data.after.data() : null;
        const { withdrawalId } = event.params;
        const db = getFirestore();
        const uid = after ? after.uid : (before ? before.uid : null);

        if (!uid) return;

        logger.info(`Withdrawal change: ${uid}/${withdrawalId}`);

        try {
            await runWithdrawalProcessing(db, uid, withdrawalId, before, after);
        } catch (error) {
            logger.error(`Withdrawal processing failed ${withdrawalId}`, error);
            throw error;
        }
    }
);

/**
 * Validate and credit daily mining reward claims server-side.
 * Client writes { status: 'pending', requestedAt: timestamp } to /miningClaims/{uid}.
 * This function verifies the 24h cooldown and credits the reward.
 */
export const onMiningClaimRequested = onDocumentWritten(
    {
        document: 'miningClaims/{uid}',
        region: RTDB_REGION,
        timeoutSeconds: 60,
        memory: '256MiB'
    },
    async (event) => {
        if (!event.data) return;
        const after = event.data.after ? event.data.after.data() : null;
        if (!after || after.status !== 'pending') return;

        const { uid } = event.params;
        const db = getFirestore();

        logger.info(`Mining claim from user ${uid}`);

        try {
            await runMiningClaimProcessing(db, uid, after);
        } catch (error) {
            logger.error(`Mining claim processing failed for ${uid}`, error);
            throw error;
        }
    }
);

/**
 * Validate and credit task rewards server-side.
 * Client writes { status: 'pending_verification', reward: X } to /userTasks/{userTaskId}.
 */
export const onTaskCompleted = onDocumentWritten(
    {
        document: 'userTasks/{userTaskId}',
        region: RTDB_REGION,
        timeoutSeconds: 60,
        memory: '256MiB'
    },
    async (event) => {
        if (!event.data) return;
        const after = event.data.after ? event.data.after.data() : null;
        if (!after || after.status !== 'pending_verification') return;

        const { userTaskId } = event.params;
        const db = getFirestore();

        logger.info('Task claim: ' + userTaskId);

        try {
            await runTaskProcessing(db, userTaskId, after);
        } catch (error) {
            logger.error('Task failed: ' + userTaskId, error);
            throw error;
        }
    }
);

/**
 * Scheduled Cron Job: Force process stuck tasks
 * Runs every 30 minutes to sweep for any 'pending_verification' tasks that
 * were interrupted by user network drops or incomplete writes.
 */
export const sweepStuckTasks = onSchedule(
    { schedule: 'every 30 minutes', region: RTDB_REGION, timeoutSeconds: 300, memory: '256MiB' },
    async (event) => {
        const db = getFirestore();
        logger.info('Starting stuck task sweeper...');
        try {
            const snapshot = await db.collection('userTasks')
                .where('status', '==', 'pending_verification')
                .get();

            let processedCount = 0;
            for (const doc of snapshot.docs) {
                const data = doc.data();
                // Skip if already processed to avoid double spend
                if (data.taskProcessed === true || data.taskProcessed === 'processing') continue;

                logger.info(`Sweeper retrying stuck task: ${doc.id}`);
                await runTaskProcessing(db, doc.id, data);
                processedCount++;
            }
            logger.info(`Sweeper finished. Processed ${processedCount} stuck tasks.`);
        } catch (error) {
            logger.error('Stuck task sweeper failed', error);
        }
    }
);

/**
 * Trigger SMS notification on user registration for Tanzanian users
 */
export const onUserRegistered = onDocumentCreated(
    {
        document: 'users/{userId}',
        region: RTDB_REGION,
        timeoutSeconds: 30,
        memory: '256MiB'
    },
    async (event) => {
        if (!event.data) return;
        const user = event.data.data();

        // Trigger only for Tanzanian users
        if (user.country === 'TZ' || user.currency === 'TZS') {
            const username = user.username || 'User';
            const message = `Welcome to NEW HOPE, ${username}! Your account has been successfully created. Please activate your account for 15,500 TSH to start earning by chatting with foreigners.`;

            try {
                if (user.phone) {
                    const res = await sendBeemSMS(user.phone, message);
                    logger.info(`SMS sent successfully to ${username} (${user.phone}):`, res);
                } else {
                    logger.warn(`No phone number found for new TZ user: ${event.params.userId}`);
                }
            } catch (err) {
                logger.error(`Failed to send SMS to ${user.phone}:`, err);
            }
        }
    }
);
