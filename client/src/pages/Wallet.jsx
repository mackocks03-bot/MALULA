import { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../components/DashboardLayout.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { formatCurrency, getCountry } from '../utils/helpers.js';
import { listenToTransactions } from '../services/database.js';
import { db, doc, collection, onSnapshot, addDoc, updateDoc } from '../services/firebase-config.js';
import {
    getPalmpesaConfig,
    initiatePalmpesaDeposit,
    pollPalmpesaStatus
} from '../services/deposits.js';
import { getWithdrawalStats } from '../services/withdraw.js';

const TASK_KEYS = [
    { key: 'chat', icon: '💬' },
    { key: 'youtube', icon: '▶️' },
    { key: 'facebook', icon: '📘' },
    { key: 'whatsapp', icon: '📱' },
    { key: 'tiktok', icon: '🎵' },
    { key: 'ads', icon: '📢' }
];

const DEPOSIT_NUMBER = '61105668';
const MIN_PALMPESA_TZS = 500;

export default function Wallet() {
    const { user, userData: initialData } = useAuth();
    const { translate } = useLanguage();
    const { showToast } = useToast();
    const [userData, setUserData] = useState(initialData);
    const [transactions, setTransactions] = useState([]);
    const [depositAmount, setDepositAmount] = useState('');
    const [depositTxn, setDepositTxn] = useState('');
    const [realWithdrawn, setRealWithdrawn] = useState(0);
    const [depositing, setDepositing] = useState(false);
    const [depositMethod, setDepositMethod] = useState('auto'); // 'auto' | 'manual'
    const [copied, setCopied] = useState(false);

    const [palmpesaEnabled, setPalmpesaEnabled] = useState(false);
    const [palmpesaAmount, setPalmpesaAmount] = useState('');
    const [palmpesaPhone, setPalmpesaPhone] = useState('');
    const [palmpesaStatus, setPalmpesaStatus] = useState('idle'); // idle | pushing | waiting | success | failed
    const [palmpesaMessage, setPalmpesaMessage] = useState('');
    const pollStopRef = useRef(null);

    const country = userData?.country || 'TZ';
    const countryInfo = getCountry(country);
    const currency = userData?.currency || countryInfo.currency || 'TZS';
    const isTanzania = country === 'TZ';
    const taskBalances = userData?.taskBalances || {};

    useEffect(() => {
        if (!user) return;
        const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
            if (snap.exists()) setUserData(snap.data());
        });
        return () => unsub();
    }, [user]);

    useEffect(() => {
        if (!user) return;
        
        getWithdrawalStats(user.uid).then(r => {
            if (r.success && r.data) {
                setRealWithdrawn(r.data.totalWithdrawn || 0);
            }
        });

        const unsub = listenToTransactions(user.uid, (result) => {
            if (result.success) setTransactions(result.data || []);
        });
        return () => { if (typeof unsub === 'function') unsub(); };
    }, [user]);

    useEffect(() => {
        if (userData?.phone) setPalmpesaPhone(userData.phone);
    }, [userData?.phone]);

    useEffect(() => {
        if (!isTanzania) return;
        getPalmpesaConfig()
            .then(cfg => setPalmpesaEnabled(Boolean(cfg.enabled)))
            .catch(() => setPalmpesaEnabled(false));
    }, [isTanzania]);

    useEffect(() => pollStopRef.current?.(), []);

    const copyPaymentNumber = () => {
        navigator.clipboard.writeText(DEPOSIT_NUMBER).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const queueDepositOnClient = async (orderId, amountTZS, meta) => {
        await updateDoc(doc(db, 'palmpesaPending', orderId), {
            type: 'deposit',
            uid: user.uid,
            palmpesaStatus: 'COMPLETED',
            amountTZS,
            transid: meta.transid || '',
            reference: meta.reference || '',
            channel: 'palmpesa',
            palmpesaCompletedAt: Date.now()
        });
    };

    const submitPalmpesaDeposit = async (e) => {
        e.preventDefault();
        const amount = Math.round(Number(palmpesaAmount));
        if (!amount || amount < MIN_PALMPESA_TZS) {
            showToast(translate('wallet.palmpesaMin') || `Minimum deposit is TZS ${MIN_PALMPESA_TZS}`, 'warning');
            return;
        }
        if (!palmpesaPhone.trim()) {
            showToast(translate('wallet.palmpesaPhoneRequired') || 'Enter your mobile money number', 'warning');
            return;
        }

        setPalmpesaStatus('pushing');
        setPalmpesaMessage(translate('wallet.palmpesaSending') || 'Sending payment request to your phone…');

        try {
            const init = await initiatePalmpesaDeposit({
                phone: palmpesaPhone.trim(),
                amount,
                name: userData?.username || userData?.fullName || 'NEWHOPE User',
                email: user?.email || userData?.email || '',
                country: 'TZ'
            });

            setPalmpesaStatus('waiting');
            setPalmpesaMessage(
                translate('wallet.palmpesaWaiting') ||
                'Check your phone and enter your M-Pesa / mobile money PIN to approve.'
            );

            const { promise, stop } = pollPalmpesaStatus(init.orderId, amount, {
                onUpdate: (result) => {
                    if (result.status === 'PENDING') {
                        setPalmpesaMessage(
                            translate('wallet.palmpesaWaiting') ||
                            'Waiting for payment confirmation…'
                        );
                    }
                }
            });
            pollStopRef.current = stop;

            const result = await promise;

            if (result.needsClientQueue) {
                await queueDepositOnClient(init.orderId, amount, {
                    transid: result.transid,
                    reference: result.reference
                });
            }

            setPalmpesaStatus('success');
            setPalmpesaMessage(translate('wallet.palmpesaSuccess') || 'Payment received! Shop balance updating…');
            showToast(translate('wallet.palmpesaSuccess') || 'Deposit successful!', 'success');
            setPalmpesaAmount('');
        } catch (err) {
            setPalmpesaStatus('failed');
            setPalmpesaMessage(err.message || translate('wallet.palmpesaFailed') || 'Payment failed');
            showToast(err.message || translate('wallet.depositFailed'), 'error');
        }
    };

    const submitDeposit = async (e) => {
        e.preventDefault();
        const amt = parseFloat(depositAmount);
        if (!amt || !depositTxn.trim()) {
            showToast(translate('wallet.depositError') || 'Enter amount and transaction ID', 'warning');
            return;
        }
        setDepositing(true);
        try {
            await addDoc(collection(db, 'shopDeposits'), {
                uid: user.uid,
                amount: amt,
                transactionId: depositTxn.trim(),
                status: 'pending',
                createdAt: Date.now()
            });
            await addDoc(collection(db, 'transactions'), {
                uid: user.uid,
                type: 'deposit_pending',
                description: 'Shop deposit (pending)',
                amount: amt,
                createdAt: Date.now()
            });
            showToast(translate('wallet.depositSubmitted') || 'Deposit submitted for review', 'success');
            setDepositAmount('');
            setDepositTxn('');
        } catch {
            showToast(translate('common.error'), 'error');
        }
        setDepositing(false);
    };

    return (
        <DashboardLayout>
            <div className="dashboard-container">
                <div className="dashboard-content">
                    <h2 className="page-title">{translate('wallet.title')}</h2>

                    <div className="profit-card">
                        <div className="amount">{formatCurrency(userData?.balance || 0, currency)}</div>
                        <div className="label">{translate('wallet.mainBalance') || translate('dashboard.balance')}</div>
                    </div>

                    <div className="balance-grid">
                        <div className="balance-card">
                            <div className="amount gold">{formatCurrency(userData?.shopBalance || 0, currency)}</div>
                            <div className="label">{translate('wallet.shopBalance') || 'Shop Balance'}</div>
                        </div>
                        <div className="balance-card">
                            <div className="amount green">{formatCurrency(realWithdrawn, currency)}</div>
                            <div className="label">{translate('dashboard.withdrawn')}</div>
                        </div>
                    </div>

                    <div className="deposit-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
                        <div className="section-title">{translate('wallet.depositForShop') || 'Deposit to Shop'}</div>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                            {translate('wallet.depositNote')}
                        </p>

                        {/* Payment Method Toggle — Auto only for TZ */}
                        {isTanzania && palmpesaEnabled && (
                            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                                {[['auto', 'Automatic (M-Pesa)'], ['manual', 'Manual (USSD)']].map(([v, l]) => (
                                    <button key={v} onClick={() => setDepositMethod(v)} style={{
                                        flex: 1, padding: '8px 10px', borderRadius: 8, border: '1.5px solid',
                                        borderColor: depositMethod === v ? 'var(--color-gold, #d4af37)' : 'var(--color-border)',
                                        background: depositMethod === v ? 'rgba(212,175,55,0.1)' : 'transparent',
                                        color: depositMethod === v ? 'var(--color-gold, #d4af37)' : 'var(--text-muted)',
                                        fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all 0.2s'
                                    }}>{l}</button>
                                ))}
                            </div>
                        )}

                        {/* AUTOMATIC — PalmPesa (TZ only) */}
                        {isTanzania && palmpesaEnabled && depositMethod === 'auto' ? (
                            <>
                                <div className="deposit-payment-info" style={{ marginBottom: 12 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                        <span style={{ fontSize: 20 }}>📱</span>
                                        <div>
                                            <strong style={{ color: 'var(--color-gold)', fontSize: 13 }}>PalmPesa Automatic</strong>
                                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                                {translate('wallet.palmpesaHint') || 'M-Pesa, Airtel, Halopesa & more'}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <form onSubmit={submitPalmpesaDeposit}>
                                    <div className="form-group">
                                        <label className="form-label">{translate('wallet.amountSent') || 'Amount (TZS)'}</label>
                                        <input
                                            type="number"
                                            min={MIN_PALMPESA_TZS}
                                            step="1"
                                            className="form-control"
                                            placeholder={`Min TZS ${MIN_PALMPESA_TZS}`}
                                            value={palmpesaAmount}
                                            onChange={e => setPalmpesaAmount(e.target.value)}
                                            disabled={palmpesaStatus === 'pushing' || palmpesaStatus === 'waiting'}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{translate('wallet.senderNumber') || 'Mobile Number'}</label>
                                        <div className="phone-input-group">
                                            <span className="country-code active">+255</span>
                                            <input
                                                className="form-control"
                                                placeholder="7XX XXX XXX"
                                                value={palmpesaPhone}
                                                onChange={e => setPalmpesaPhone(e.target.value)}
                                                disabled={palmpesaStatus === 'pushing' || palmpesaStatus === 'waiting'}
                                            />
                                        </div>
                                    </div>

                                    {(palmpesaStatus === 'waiting' || palmpesaStatus === 'pushing') && (
                                        <div style={{
                                            padding: 12, borderRadius: 10, background: 'var(--color-gold-soft)',
                                            border: '1px solid var(--border-hover)', marginBottom: 12,
                                            fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 10
                                        }}>
                                            <span className="spinner" style={{
                                                width: 16, height: 16, border: '2px solid rgba(229,184,74,0.2)',
                                                borderTopColor: 'var(--color-gold)', borderRadius: '50%',
                                                animation: 'spin 0.8s linear infinite', flexShrink: 0
                                            }} />
                                            {palmpesaMessage}
                                        </div>
                                    )}

                                    {palmpesaStatus === 'success' && (
                                        <div style={{ padding: 10, borderRadius: 10, marginBottom: 10, background: 'var(--color-green-bg)', color: 'var(--color-green)', fontSize: 11 }}>
                                            ✓ {palmpesaMessage}
                                        </div>
                                    )}

                                    {palmpesaStatus === 'failed' && (
                                        <div style={{ padding: 10, borderRadius: 10, marginBottom: 10, background: 'var(--color-red-bg)', color: 'var(--color-red)', fontSize: 11 }}>
                                            {palmpesaMessage}
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        className="btn btn-primary btn-block"
                                        disabled={palmpesaStatus === 'pushing' || palmpesaStatus === 'waiting'}
                                    >
                                        {palmpesaStatus === 'pushing' || palmpesaStatus === 'waiting'
                                            ? translate('app.processing')
                                            : translate('wallet.palmpesaPay') || 'Pay with PalmPesa'}
                                    </button>
                                </form>
                            </>
                        ) : (
                            /* MANUAL — USSD (all users + TZ who choose manual) */
                            <>
                                <div style={{
                                    background: 'var(--color-bg, #f9f9f9)', borderRadius: 10, padding: '10px 14px',
                                    marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                                }}>
                                    <div>
                                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Pay to number</div>
                                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-gold, #d4af37)', letterSpacing: 1 }}>{DEPOSIT_NUMBER}</div>
                                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Account: NEW HOPE</div>
                                    </div>
                                    <button onClick={copyPaymentNumber} style={{
                                        padding: '8px 14px', borderRadius: 8, border: '1.5px solid',
                                        borderColor: copied ? '#16a34a' : 'var(--color-border)',
                                        background: copied ? 'rgba(34,197,94,0.1)' : 'transparent',
                                        color: copied ? '#16a34a' : 'var(--text-muted)',
                                        fontWeight: 700, fontSize: 11, cursor: 'pointer', display: 'flex',
                                        alignItems: 'center', gap: 5, transition: 'all 0.2s'
                                    }}>
                                        {copied ? (
                                            <><svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!</>
                                        ) : (
                                            <><svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy</>
                                        )}
                                    </button>
                                </div>
                                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
                                    {translate('wallet.depositTo') || 'Send the amount via USSD, then submit the transaction details below for verification.'}
                                </p>
                                <form onSubmit={submitDeposit}>
                                    <div className="form-group">
                                        <input type="number" step="0.01" className="form-control" placeholder={`Amount (${currency})`} value={depositAmount} onChange={e => setDepositAmount(e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                        <input className="form-control" placeholder="Transaction ID" value={depositTxn} onChange={e => setDepositTxn(e.target.value)} />
                                    </div>
                                    <button type="submit" className="btn btn-primary btn-block" disabled={depositing}>
                                        {depositing ? translate('app.processing') : translate('wallet.submitDeposit') || 'Submit Deposit'}
                                    </button>
                                </form>
                            </>
                        )}
                    </div>

                    <div className="section-title">{translate('wallet.taskBalances') || 'Task Balances'}</div>
                    <div className="task-balances-grid">
                        {TASK_KEYS.map(({ key, icon }) => (
                            <div key={key} className="task-balance-card">
                                <div className="icon">{icon}</div>
                                <div className="amount">{formatCurrency(taskBalances[key] || 0, currency)}</div>
                                <div className="label">{translate(`dashboard.${key}`) || key}</div>
                            </div>
                        ))}
                    </div>

                    <div className="section-title" style={{ marginTop: 24 }}>{translate('wallet.transactions') || 'Transactions'}</div>
                    <div className="transactions-list">
                        {transactions.length === 0 ? (
                            <p className="empty-state">{translate('wallet.noTransactions') || 'No transactions yet'}</p>
                        ) : transactions.map(tx => (
                            <div key={tx.id} className="transaction-item">
                                <div className="left">
                                    <div className="type">{tx.description || tx.type || 'Transaction'}</div>
                                    <div className="date">{tx.createdAt ? new Date(tx.createdAt).toLocaleString() : ''}</div>
                                </div>
                                <div className={`amount ${(tx.amount || 0) >= 0 ? 'positive' : 'negative'}`}>
                                    {formatCurrency(Math.abs(tx.amount || 0), currency)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
