import { Router } from 'express';
import {
    initiateMobilePayment,
    getOrderStatus,
    isPalmpesaConfigured,
    normalizeTzPhone
} from '../services/palmpesa.js';
import { verifyIdToken, isFirebaseAdminConfigured, initFirebaseAdmin } from '../services/firebaseAdmin.js';
import {
    queueActivationComplete,
    saveActivationPending
} from '../services/paymentQueue.js';

const router = Router();

async function requireUser(req, res) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return null;
    }
    const decoded = await verifyIdToken(token);
    if (!decoded?.uid) {
        res.status(401).json({ success: false, error: 'Invalid or expired session' });
        return null;
    }
    return decoded;
}

async function getActivationFee(currency = 'TZS') {
    const app = initFirebaseAdmin();
    if (app) {
        const firestore = app.firestore();
        const settingsSnap = await firestore.collection('settings').doc('general').get();
        const settings = settingsSnap.exists ? settingsSnap.data() : {};
        const fees = settings.activationFees || {};
        return fees[currency] || 14500;
    }
    return 14500;
}

router.get('/palmpesa/config', async (_req, res) => {
    const amountTZS = await getActivationFee('TZS');
    res.json({
        enabled: isPalmpesaConfigured(),
        amountTZS,
        minAmountTZS: 500,
        firebaseAdmin: isFirebaseAdminConfigured(),
        cloudFunctions: true
    });
});

router.post('/palmpesa/initiate', async (req, res) => {
    try {
        if (!isPalmpesaConfigured()) {
            return res.status(503).json({ success: false, error: 'PalmPesa payments are not configured' });
        }

        const user = await requireUser(req, res);
        if (!user) return;

        const { phone, name, email, country } = req.body || {};
        if (country && country !== 'TZ' && country !== 'Tanzania') {
            return res.status(400).json({ success: false, error: 'PalmPesa activation is only for Tanzanian users' });
        }

        if (!phone || normalizeTzPhone(phone).length < 12) {
            return res.status(400).json({ success: false, error: 'Enter a valid Tanzanian mobile number' });
        }

        const amountTZS = await getActivationFee('TZS');

        const payment = await initiateMobilePayment({
            phone,
            amount: amountTZS,
            name: name || user.name || 'NEWHOPE User',
            email: email || user.email || 'user@newhope.chat',
            type: 'activation'
        });

        const pending = await saveActivationPending(payment.orderId, {
            uid: user.uid,
            phone: payment.phone,
            nativeAmount: amountTZS,
            nativeCurrency: 'TZS'
        });

        res.json({
            success: true,
            orderId: payment.orderId,
            amount: amountTZS,
            paymentId: pending?.paymentId || null,
            message: 'Check your phone and enter your mobile money PIN to activate your account.'
        });
    } catch (error) {
        console.error('PalmPesa activation initiate error:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to initiate payment' });
    }
});

router.get('/palmpesa/status/:orderId', async (req, res) => {
    try {
        if (!isPalmpesaConfigured()) {
            return res.status(503).json({ success: false, error: 'PalmPesa is not configured' });
        }

        const user = await requireUser(req, res);
        if (!user) return;

        const { orderId } = req.params;
        const status = await getOrderStatus(orderId);

        if (status.status === 'COMPLETED') {
            const amountTZS = status.amount || Number(req.query.amount) || 0;

            let paymentId = null;
            const app = initFirebaseAdmin();
            if (app) {
                const pendingSnap = await app.firestore().collection('palmpesaPending').doc(orderId).get();
                if (pendingSnap.exists) paymentId = pendingSnap.data().paymentId;
            }

            const queued = await queueActivationComplete({
                paymentId,
                orderId,
                amountTZS,
                transid: status.transid,
                reference: status.reference,
                channel: status.channel,
                msisdn: status.msisdn,
                phone: status.msisdn
            });

            return res.json({
                success: true,
                status: 'COMPLETED',
                queued: queued.success,
                needsClientQueue: queued.needsClientQueue || false,
                paymentId: queued.paymentId || paymentId,
                orderId,
                amountTZS,
                reference: status.reference,
                transid: status.transid,
                message: 'Payment confirmed. Activating account and processing commissions…'
            });
        }

        res.json({
            success: true,
            status: status.status,
            queued: false
        });
    } catch (error) {
        console.error('PalmPesa activation status error:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to check payment status' });
    }
});

/**
 * PalmPesa Webhook — called by PalmPesa gateway when payment completes.
 * Eliminates reliance on client-side polling.
 * PalmPesa posts: { order_id, payment_status, amount, transid, reference, msisdn, channel }
 */
router.post('/palmpesa/webhook', async (req, res) => {
    try {
        // Optional webhook secret validation
        const secret = process.env.PALMPESA_WEBHOOK_SECRET;
        if (secret) {
            const provided = req.headers['x-palmpesa-secret'] || req.headers['x-webhook-secret'] || '';
            if (provided !== secret) {
                return res.status(401).json({ success: false, error: 'Invalid webhook secret' });
            }
        }

        const body = req.body || {};
        const orderId = body.order_id || body.orderId;
        const status = (body.payment_status || body.status || '').toUpperCase();

        console.log(`PalmPesa activation webhook: order=${orderId} status=${status}`);

        if (!orderId) {
            return res.status(400).json({ success: false, error: 'Missing order_id' });
        }

        if (status !== 'COMPLETED') {
            // Acknowledge but do nothing for non-completed events
            return res.json({ success: true, action: 'ignored', status });
        }

        let fullStatus = null;
        try {
            fullStatus = await getOrderStatus(orderId);
            console.log(`Webhook fetched full status for ${orderId}:`, fullStatus);
        } catch (e) {
            console.error(`Webhook failed to fetch full order status for ${orderId}:`, e.message);
        }

        const amountTZS = (fullStatus?.amount) || Number(body.amount) || 0;
        const transid = fullStatus?.transid || body.transid || '';
        const reference = fullStatus?.reference || body.reference || '';
        const channel = fullStatus?.channel || body.channel || 'palmpesa';
        const msisdn = fullStatus?.msisdn || body.msisdn || '';

        const queued = await queueActivationComplete({
            paymentId: null, // resolved from orderId inside queueActivationComplete
            orderId,
            amountTZS,
            transid,
            reference,
            channel,
            msisdn,
            phone: msisdn
        });

        console.log(`Webhook queued activation for order ${orderId}:`, queued);
        res.json({ success: true, queued: queued.success });
    } catch (error) {
        console.error('PalmPesa activation webhook error:', error);
        // Always return 200 to PalmPesa to prevent retries for server errors
        res.status(200).json({ success: false, error: error.message });
    }
});

/**
 * Admin approval — sets adminApproveRequested on RTDB record.
 * Cloud Function (shouldProcessActivation) already watches this flag and fires activation.
 * Requires ADMIN_SECRET header.
 */
router.post('/admin/approve/:paymentId', async (req, res) => {
    try {
        const adminSecret = process.env.ADMIN_SECRET;
        if (adminSecret) {
            const provided = req.headers['x-admin-secret'] || req.headers.authorization?.replace('Bearer ', '') || '';
            if (provided !== adminSecret) {
                return res.status(403).json({ success: false, error: 'Forbidden' });
            }
        }

        const { paymentId } = req.params;
        if (!paymentId) {
            return res.status(400).json({ success: false, error: 'Missing paymentId' });
        }

        const app = initFirebaseAdmin();
        if (!app) {
            return res.status(503).json({ success: false, error: 'Firebase Admin not configured' });
        }

        const firestore = app.firestore();
        const paymentSnap = await firestore.collection('activationPayments').doc(paymentId).get();
        if (!paymentSnap.exists) {
            return res.status(404).json({ success: false, error: 'Payment record not found' });
        }

        const payment = paymentSnap.data();
        if (payment.activationProcessed === true) {
            return res.json({ success: true, alreadyProcessed: true });
        }

        // Setting adminApproveRequested triggers the Cloud Function
        await firestore.collection('activationPayments').doc(paymentId).update({
            adminApproveRequested: true,
            adminApproveRequestedAt: Date.now(),
            adminApprovedBy: req.body?.adminId || 'admin'
        });

        console.log(`Admin approval requested for payment ${paymentId} — Cloud Function will process`);
        res.json({
            success: true,
            paymentId,
            message: 'Approval queued — Cloud Function will activate account and process commissions'
        });
    } catch (error) {
        console.error('Admin approve error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;

