import { Router } from 'express';
import {
    initiateMobilePayment,
    getOrderStatus,
    isPalmpesaConfigured,
    validateDepositAmount,
    normalizeTzPhone
} from '../services/palmpesa.js';
import {
    verifyIdToken,
    isFirebaseAdminConfigured
} from '../services/firebaseAdmin.js';
import {
    queueDepositComplete,
    saveDepositPending
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

router.get('/palmpesa/config', (_req, res) => {
    res.json({
        enabled: isPalmpesaConfigured(),
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

        const { phone, amount, name, email, country } = req.body || {};
        const isTanzania = country === 'TZ' || country === 'Tanzania';
        if (country && !isTanzania) {
            return res.status(400).json({ success: false, error: 'PalmPesa is only available for Tanzanian users' });
        }

        const amountCheck = validateDepositAmount(amount);
        if (!amountCheck.valid) {
            return res.status(400).json({ success: false, error: amountCheck.error });
        }

        if (!phone || normalizeTzPhone(phone).length < 12) {
            return res.status(400).json({ success: false, error: 'Enter a valid Tanzanian mobile number' });
        }

        const payment = await initiateMobilePayment({
            phone,
            amount: amountCheck.amount,
            name: name || user.name || 'NEWHOPE User',
            email: email || user.email || 'user@newhope.chat'
        });

        await saveDepositPending(payment.orderId, {
            uid: user.uid,
            amountTZS: payment.amount,
            phone: payment.phone,
            type: 'deposit'
        });

        res.json({
            success: true,
            orderId: payment.orderId,
            amount: payment.amount,
            message: 'Check your phone and enter your mobile money PIN to approve the payment.'
        });
    } catch (error) {
        console.error('PalmPesa initiate error:', error);
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
        if (!orderId) {
            return res.status(400).json({ success: false, error: 'Order ID required' });
        }

        const status = await getOrderStatus(orderId);

        if (status.status === 'COMPLETED') {
            const amountTZS = status.amount || Number(req.query.amount) || 0;

            const queued = await queueDepositComplete(orderId, {
                uid: user.uid,
                amountTZS,
                transid: status.transid,
                reference: status.reference,
                channel: status.channel,
                msisdn: status.msisdn
            });

            return res.json({
                success: true,
                status: 'COMPLETED',
                queued: queued.success,
                needsClientQueue: queued.needsClientQueue || false,
                orderId,
                amountTZS,
                reference: status.reference,
                transid: status.transid,
                message: 'Payment confirmed. Crediting shop balance…'
            });
        }

        res.json({
            success: true,
            status: status.status,
            queued: false
        });
    } catch (error) {
        console.error('PalmPesa status error:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to check payment status' });
    }
});

/**
 * PalmPesa Deposit Webhook — called by PalmPesa gateway when a shop deposit payment completes.
 * Writes palmpesaStatus=COMPLETED to /palmpesaPending/{orderId} which triggers the
 * processPalmpesaDeposit Cloud Function → credits shopBalance.
 */
router.post('/palmpesa/webhook', async (req, res) => {
    try {
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

        console.log(`PalmPesa deposit webhook: order=${orderId} status=${status}`);

        if (!orderId) {
            return res.status(400).json({ success: false, error: 'Missing order_id' });
        }

        if (status !== 'COMPLETED') {
            return res.json({ success: true, action: 'ignored', status });
        }

        let fullStatus = null;
        try {
            fullStatus = await getOrderStatus(orderId);
            console.log(`Deposit webhook fetched full status for ${orderId}:`, fullStatus);
        } catch (e) {
            console.error(`Deposit webhook failed to fetch full order status for ${orderId}:`, e.message);
        }

        const amountTZS = (fullStatus?.amount) || Number(body.amount) || 0;
        const transid = fullStatus?.transid || body.transid || '';
        const reference = fullStatus?.reference || body.reference || '';
        const channel = fullStatus?.channel || body.channel || 'palmpesa';
        const msisdn = fullStatus?.msisdn || body.msisdn || '';

        const queued = await queueDepositComplete(orderId, {
            amountTZS,
            transid,
            reference,
            channel,
            msisdn
        });

        console.log(`Deposit webhook queued for order ${orderId}:`, queued);
        res.json({ success: true, queued: queued.success });
    } catch (error) {
        console.error('PalmPesa deposit webhook error:', error);
        res.status(200).json({ success: false, error: error.message });
    }
});

export default router;

