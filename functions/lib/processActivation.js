import { loadBonusSettings, processAllReferralCommissions } from './referralCommissions.js';
import { sendPushNotification } from './sendPushNotification.js';

/**
 * Full activation: welcome bonus + 3-level commissions + notifications
 * Idempotent — safe to retry via activationProcessed flag
 */
export async function runActivationProcessing(db, paymentId, payment) {
    const paymentRef = db.collection('activationPayments').doc(paymentId);
    const paymentSnap = await paymentRef.get();
    
    if (paymentSnap.exists && paymentSnap.data().activationProcessed === true) {
        console.log(`Payment ${paymentId} already processed`);
        return { success: true, alreadyProcessed: true };
    }

    const userId = payment.uid;
    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
        throw new Error(`User not found: ${userId}`);
    }

    const user = { uid: userId, ...userSnap.data() };
    if (user.isActive && user.activationStatus === 'approved') {
        await paymentRef.update({
            activationProcessed: true,
            status: 'approved',
            approvedAt: Date.now()
        });
        return { success: true, alreadyActive: true };
    }

    await paymentRef.update({ activationProcessed: 'processing' });

    try {
        const bonuses = await loadBonusSettings(db);
        const currentBalance = parseFloat(user.balance) || 0;
        const now = Date.now();

        await userRef.update({
            isActive: true,
            activationStatus: 'approved',
            activatedAt: now
        });

        const commissionResults = await processAllReferralCommissions(db, paymentId, user);

        await db.collection('notifications').add({
            uid: userId, // Keep explicit uid tracking since it's at root level now
            type: 'activation',
            title: 'Account Activated! 🎉',
            message: `Your account is now active and ready for use!`,
            txId: paymentId,
            read: false,
            createdAt: now
        });

        await paymentRef.update({
            status: 'approved',
            approvedAt: now,
            activationProcessed: true,
            welcomeBonus: 0,
            referralL1: bonuses.referralL1,
            referralL2: bonuses.referralL2,
            referralL3: bonuses.referralL3,
            commissionsProcessed: commissionResults.length,
            processedBy: 'cloud-function',
            processingError: null
        });

        console.log(`✅ Activation ${paymentId}: user ${user.username}, ${commissionResults.length} commissions`);
        
        await sendPushNotification(db, userId, 'Account Activated! 🎉', `Your account is now active and ready for use!`, {
            txId: paymentId,
            type: 'activation'
        });

        return {
            success: true,
            userId,
            welcomeBonus: 0,
            newBalance: currentBalance,
            commissionResults
        };
    } catch (error) {
        await paymentRef.update({
            activationProcessed: false,
            processingError: error.message,
            lastProcessingAttempt: Date.now()
        });
        throw error;
    }
}
