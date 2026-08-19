/**
 * PalmPesa API client (Tanzania mobile money — USSD STK push)
 * Docs: https://palmpesa.drmlelwa.co.tz
 *
 * Endpoint 02 — Webhook Payment (STK push that we use):
 *   POST https://palmpesa.drmlelwa.co.tz/api/palmpesa/initiate
 *   Body: name, email, phone, amount, transaction_id, address, postcode, callback_url
 *   Returns: { message, order_id }
 *   Callback: { order_id, payment_status }
 *
 * Endpoint 04 — Order Status:
 *   POST https://palmpesa.drmlelwa.co.tz/api/order-status
 *   Body: { order_id }
 */

const DEFAULT_BASE_URL = 'https://palmpesa.drmlelwa.co.tz/api';
const MIN_AMOUNT_TZS = 500;

function palmpesaUserId() {
    const id = process.env.PALMPESA_USER_ID;
    if (!id) return null;
    return String(id).trim();
}

function palmpesaVendor() {
    return process.env.PALMPESA_VENDOR || process.env.PALMPESA_VENDOR_ID || null;
}

function authHeader() {
    const raw = process.env.PALMPESA_API_KEY || process.env.PALMPESA_API_TOKEN || '';
    const token = raw.replace(/^Bearer\s+/i, '').trim();
    if (!token) return null;
    return `Bearer ${token}`;
}

function baseUrl() {
    return (process.env.PALMPESA_API_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
}

/** The publicly reachable callback URL for PalmPesa to push completion events */
function callbackUrl(path) {
    const appUrl = (
        process.env.SELCOM_WEBHOOK_PUBLIC_URL ||
        process.env.PUBLIC_APP_URL ||
        'http://localhost:5000'
    ).replace(/\/$/, '');
    return `${appUrl}${path}`;
}

export function isPalmpesaConfigured() {
    return Boolean(authHeader() && palmpesaUserId());
}

export function normalizeTzPhone(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.startsWith('255') && digits.length === 12) return digits;
    if (digits.startsWith('0') && digits.length === 10) return `255${digits.slice(1)}`;
    if (digits.length === 9) return `255${digits}`;
    return digits;
}

export function validateDepositAmount(amount) {
    const value = Math.round(Number(amount));
    if (!Number.isFinite(value) || value < MIN_AMOUNT_TZS) {
        return { valid: false, error: `Minimum deposit is TZS ${MIN_AMOUNT_TZS}` };
    }
    return { valid: true, amount: value };
}

async function palmRequest(path, body) {
    const authorization = authHeader();
    if (!authorization) {
        throw new Error('PalmPesa is not configured on the server');
    }

    const url = `${baseUrl()}${path}`;
    console.log(`[PalmPesa] POST ${url}`, JSON.stringify(body));

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: authorization,
            Accept: 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    let data;
    try {
        data = await response.json();
    } catch {
        data = { error: 'Invalid response from PalmPesa' };
    }

    console.log(`[PalmPesa] Response ${response.status}:`, JSON.stringify(data));

    if (!response.ok) {
        const message = data?.message || data?.error || `PalmPesa request failed (${response.status})`;
        throw new Error(message);
    }

    return data;
}

/**
 * Trigger USSD STK push to customer's phone (Endpoint 02)
 * Uses /palmpesa/initiate — requires transaction_id + callback_url
 */
export async function initiateMobilePayment({ phone, amount, name, email, type = 'deposit' }) {
    const check = validateDepositAmount(amount);
    if (!check.valid) throw new Error(check.error);

    const merchantUserId = palmpesaUserId();
    if (!merchantUserId) {
        throw new Error('PALMPESA_USER_ID is not configured on the server');
    }

    // Unique transaction ID for this STK push
    const transactionId = `NH-${merchantUserId}-${Date.now()}`;

    // Callback path depends on whether this is activation or deposit
    const cbPath = type === 'activation'
        ? '/api/activation/palmpesa/webhook'
        : '/api/deposits/palmpesa/webhook';

    // PalmPesa requires name to contain at least 2 words
    let fullName = (name || '').trim();
    if (!fullName || fullName.split(/\s+/).length < 2) fullName = 'NEWHOPE User';

    const payload = {
        name: fullName,
        email: email || 'user@newhope.chat',
        phone: normalizeTzPhone(phone),
        amount: check.amount,
        transaction_id: transactionId,
        address: 'Dar es Salaam',
        postcode: '11111',
        callback_url: callbackUrl(cbPath)
    };

    const result = await palmRequest('/palmpesa/initiate', payload);

    // Response: { message: "...", order_id: "PALMPESA..." }
    const orderId = result?.order_id || result?.orderId;
    if (!orderId) {
        throw new Error(result?.message || result?.error || 'PalmPesa did not return an order ID');
    }

    return {
        orderId,
        amount: check.amount,
        phone: payload.phone,
        transactionId,
        raw: result
    };
}

/**
 * Poll payment status (Endpoint 04)
 */
export async function getOrderStatus(orderId) {
    const result = await palmRequest('/order-status', { order_id: String(orderId) });
    const row = result?.data?.[0] || result?.data || result;
    const status = (row?.payment_status || row?.status || 'PENDING').toUpperCase();

    return {
        orderId: row?.order_id || orderId,
        status,
        amount: Number(row?.amount) || null,
        reference: row?.reference || null,
        transid: row?.transid || null,
        channel: row?.channel || null,
        msisdn: row?.msisdn || null,
        raw: result
    };
}

/**
 * Fetch all raw transactions from the undocumented PalmPesa history endpoint
 */
export async function getLiveTransactions() {
    const authorization = authHeader();
    if (!authorization) {
        throw new Error('PalmPesa is not configured on the server');
    }

    const url = `${baseUrl()}/transactions`;
    console.log(`[PalmPesa] GET ${url}`);

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            Authorization: authorization,
            Accept: 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error(`PalmPesa request failed (${response.status})`);
    }

    const data = await response.json();
    return data?.data?.transactions || [];
}
