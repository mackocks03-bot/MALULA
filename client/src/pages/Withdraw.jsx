import { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../components/DashboardLayout.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { formatCurrency } from '../utils/helpers.js';
import { requestWithdrawal, listenToUserWithdrawals, getWithdrawalStats } from '../services/withdraw.js';
import { getWithdrawLimits, getTaskWithdrawLimits } from '../services/settings.js';
import { db, doc, onSnapshot } from '../services/firebase-config.js';

/* ─── Confirmation Modal ─── */
function ConfirmModal({ data, onConfirm, onClose }) {
    if (!data) return null;
    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9000,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            animation: 'wd-fade-in 0.3s ease'
        }} onClick={e => e.target === e.currentTarget && onClose()}>
            <div style={{
                background: 'var(--color-surface, #fff)', 
                borderTopLeftRadius: 20, borderTopRightRadius: 20,
                padding: '16px 16px 20px 16px', maxWidth: 500, width: '100%',
                boxShadow: '0 -10px 40px rgba(0,0,0,0.2)',
                animation: 'wd-slide-up-sheet 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                marginBottom: 0
            }}>
                <div style={{ textAlign: 'center', marginBottom: 12 }}>
                    <div style={{ marginBottom: 4, display: 'flex', justifyContent: 'center' }}>
                        <svg viewBox="0 0 24 24" width="22" height="22" stroke="var(--color-gold, #d4af37)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>Confirm Withdrawal</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Please review your transaction details</div>
                </div>
                <div style={{ background: 'var(--color-bg, #f9f9f9)', borderRadius: 10, padding: '8px 12px', marginBottom: 12 }}>
                    {[
                        ['Account Name', data.accountName],
                        ['Phone Number', data.phone],
                        ['Wallet', data.walletLabel],
                        ['Amount', data.amountDisplay],
                        ['Fee', data.feeDisplay],
                        ['You Receive', data.receiveDisplay],
                        ['Method', data.method],
                        ['Reference', data.ref],
                    ].map(([k, v]) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid rgba(0,0,0,0.03)', fontSize: 10 }}>
                            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{k}</span>
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{v}</span>
                        </div>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={onClose} style={{
                        flex: 1, padding: '8px', borderRadius: 8, border: '1px solid var(--color-border)',
                        background: 'transparent', color: 'var(--text-muted)', fontWeight: 700, cursor: 'pointer', fontSize: 11
                    }}>Cancel</button>
                    <button onClick={onConfirm} style={{
                        flex: 2, padding: '8px', borderRadius: 8, border: 'none',
                        background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff',
                        fontWeight: 800, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                    }}>
                        <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        Confirm Request
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Success Modal ─── */
function SuccessModal({ data, onClose }) {
    if (!data) return null;
    const isRejected = data.status === 'rejected';
    const isApproved = data.status === 'approved';
    const title = isRejected ? 'Withdrawal Rejected' : 'Success!';
    const iconColor = isRejected ? '#ef4444' : '#16a34a';
    const statusText = (data.status || 'pending').toUpperCase();

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9001,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            animation: 'wd-fade-in 0.3s ease'
        }}>
            <div style={{
                background: 'var(--color-surface, #fff)', 
                borderTopLeftRadius: 20, borderTopRightRadius: 20,
                padding: '16px 16px 20px 16px', maxWidth: 500, width: '100%', textAlign: 'center',
                boxShadow: '0 -10px 40px rgba(0,0,0,0.2)',
                animation: 'wd-slide-up-sheet 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                marginBottom: 0
            }}>
                <div style={{ display: 'flex', justifyContent: 'center', animation: 'wd-bounce 0.8s ease infinite alternate', marginBottom: 8 }}>
                    {isRejected ? (
                        <svg viewBox="0 0 24 24" width="36" height="36" stroke="#ef4444" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                    ) : (
                        <svg viewBox="0 0 24 24" width="36" height="36" stroke="#16a34a" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    )}
                </div>
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    background: isRejected ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)', color: iconColor,
                    borderRadius: 99, padding: '2px 10px', fontSize: 9, fontWeight: 800, marginBottom: 8
                }}>
                    <svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                    VERIFIED REQUEST
                </div>
                <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)', marginBottom: 2 }}>{title}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 12 }}>
                    {isRejected ? (
                        `Your withdrawal of ${data.amountDisplay} was rejected.`
                    ) : (
                        <>
                            You have successfully withdrawn <strong>{data.amountDisplay}</strong>. Fee: {data.feeDisplay}.<br/>
                            You will receive your amount in less than 10 minutes. If it takes longer please contact support.
                        </>
                    )}
                </div>
                <div style={{ background: 'var(--color-bg, #f9f9f9)', borderRadius: 10, padding: '8px 12px', marginBottom: 12, textAlign: 'left' }}>
                    {[
                        ['Reference', data.ref],
                        ['Account Name', data.accountName],
                        ['Phone', data.phone],
                        ['Amount', data.amountDisplay],
                        ['Fee', data.feeDisplay],
                        ['You Receive', data.receiveDisplay],
                        ['Wallet', data.walletLabel],
                        ['Method', data.method],
                        ['Status', statusText],
                    ].map(([k, v]) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid rgba(0,0,0,0.03)', fontSize: 10 }}>
                            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{k}</span>
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{v}</span>
                        </div>
                    ))}
                </div>
                <button onClick={onClose} style={{
                    width: '100%', padding: '10px', borderRadius: 10, border: 'none',
                    background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff',
                    fontWeight: 800, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                }}>
                    Done
                </button>
            </div>
        </div>
    );
}

/* ─── Error Modal ─── */
function ErrorModal({ errorMsg, onClose }) {
    if (!errorMsg) return null;
    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9002,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            animation: 'wd-fade-in 0.3s ease'
        }} onClick={e => e.target === e.currentTarget && onClose()}>
            <div style={{
                background: 'var(--color-surface, #fff)', 
                borderTopLeftRadius: 20, borderTopRightRadius: 20,
                padding: '16px 16px 20px 16px', maxWidth: 500, width: '100%', textAlign: 'center',
                boxShadow: '0 -10px 40px rgba(220,38,38,0.15)',
                animation: 'wd-slide-up-sheet 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                borderTop: '4px solid #ef4444',
                marginBottom: 0
            }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                    <svg viewBox="0 0 24 24" width="32" height="32" stroke="#ef4444" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                </div>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#ef4444', marginBottom: 4 }}>Request Failed</div>
                <div style={{ fontSize: 10, color: 'var(--text-primary)', marginBottom: 12, fontWeight: 500 }}>{errorMsg}</div>
                
                <button onClick={onClose} style={{
                    width: '100%', padding: '10px', borderRadius: 8, border: 'none',
                    background: 'var(--color-bg, #f1f5f9)', color: 'var(--text-primary)',
                    fontWeight: 800, fontSize: 12, cursor: 'pointer'
                }}>Close</button>
            </div>
        </div>
    );
}

const WALLET_LABELS = {
    balance: 'Main Balance',
    welcomeBonus: 'Welcome Bonus',
    'earnings.tiktok': 'TikTok Earnings',
    'earnings.chat': 'Chat Earnings',
    'earnings.youtube': 'YouTube Earnings',
    'earnings.facebook': 'Facebook Earnings',
    'earnings.whatsapp': 'WhatsApp Earnings',
    'earnings.ads': 'Ad Posting Earnings',
};

export default function Withdraw() {
    const { user, userData: initialData } = useAuth();
    const { translate } = useLanguage();
    const { showToast } = useToast();
    const [userData, setUserData] = useState(initialData);
    const [amount, setAmount] = useState('');
    const [phone, setPhone] = useState('');
    const [accountName, setAccountName] = useState('');
    const [wallet, setWallet] = useState('balance');
    const countryCode = (initialData?.country || 'TZ').toUpperCase();

    const COUNTRY_METHODS = {
        TZ: [{v: 'mpesa', l: 'M-Pesa'}, {v: 'airtel', l: 'Airtel Money'}, {v: 'tigo', l: 'Tigo Pesa'}, {v: 'halopesa', l: 'HaloPesa'}],
        KE: [{v: 'mpesa', l: 'M-Pesa'}, {v: 'airtel', l: 'Airtel Money'}],
        UG: [{v: 'mtn', l: 'MTN Mobile Money'}, {v: 'airtel', l: 'Airtel Money'}],
        RW: [{v: 'mtn', l: 'MTN Mobile Money'}, {v: 'airtel', l: 'Airtel Money'}],
        MZ: [{v: 'emola', l: 'e-Mola'}, {v: 'mpesa', l: 'M-Pesa'}],
        ZM: [{v: 'mtn', l: 'MTN Mobile Money'}, {v: 'airtel', l: 'Airtel Money'}],
        MW: [{v: 'airtel', l: 'Airtel Money'}],
        DEFAULT: [{v: 'mpesa', l: 'M-Pesa'}, {v: 'airtel', l: 'Airtel Money'}, {v: 'mtn', l: 'MTN Mobile Money'}, {v: 'emola', l: 'e-Mola'}]
    };
    
    const availableMethods = COUNTRY_METHODS[countryCode] || COUNTRY_METHODS.DEFAULT;
    
    const [method, setMethod] = useState(availableMethods[0].v);
    const [loading, setLoading] = useState(false);
    const [withdrawals, setWithdrawals] = useState([]);
    const [limits, setLimits] = useState({ min: 0, max: 0, fee: 0 });
    const [stats, setStats] = useState(null);
    const [confirmData, setConfirmData] = useState(null);
    const [successData, setSuccessData] = useState(null);
    const [errorData, setErrorData] = useState(null);
    const [amountError, setAmountError] = useState('');
    const [shaking, setShaking] = useState(false);
    const amtRef = useRef(null);

    useEffect(() => {
        if (!user) return;
        const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
            if (snap.exists()) setUserData(snap.data());
        });
        return () => unsub();
    }, [user]);

    useEffect(() => {
        if (userData?.phone && !phone) setPhone(userData.phone);
        if (userData?.fullName && !accountName) setAccountName(userData.fullName);
    }, [userData]);

    useEffect(() => {
        const currency = userData?.currency || 'TZS';
        async function fetchLimits() {
            const generic = await getWithdrawLimits(currency) || { min: 0, max: 0, feePercent: 0 };
            const minAmount = await getTaskWithdrawLimits(wallet, currency);
            setLimits({ min: minAmount !== undefined ? minAmount : generic.min, max: generic.max, feePercent: generic.feePercent || 0 });
        }
        fetchLimits();
    }, [userData?.currency, wallet]);

    useEffect(() => {
        if (!user) return;
        const unsub = listenToUserWithdrawals(user.uid, (result) => {
            if (result.success) setWithdrawals(result.data || []);
        });
        getWithdrawalStats(user.uid).then(r => { if (r.success) setStats(r.data); });
        return () => { if (typeof unsub === 'function') unsub(); };
    }, [user]);

    const currency = userData?.currency || 'TZS';
    const availableBalance =
        wallet === 'balance' ? (userData?.balance || 0) :
        wallet === 'welcomeBonus' ? (userData?.welcomeBonus || 0) :
        wallet.startsWith('earnings.') ? (userData?.earnings?.[wallet.split('.')[1]] || 0) : 0;

    const amt = parseFloat(amount) || 0;
    const fee = Math.floor(amt * ((limits.feePercent || 0) / 100));
    const totalDeduct = amt + fee;
    const youReceive = amt;
    const hasPendingWithdrawal = withdrawals.some(w => w.status === 'pending');

    // Live validation on amount change
    useEffect(() => {
        if (!amount) { setAmountError(''); return; }
        if (amt <= 0) {
            triggerShake('Enter a valid amount.');
        } else if (limits.min > 0 && amt < limits.min) {
            triggerShake(`Minimum is ${formatCurrency(limits.min, currency)}`);
        } else if (limits.max > 0 && amt > limits.max) {
            triggerShake(`Maximum is ${formatCurrency(limits.max, currency)}`);
        } else if (totalDeduct > availableBalance) {
            triggerShake(`Insufficient balance (Requires ${formatCurrency(totalDeduct, currency)} total)`);
        } else {
            setAmountError('');
        }
    }, [amount, limits, availableBalance]);

    const triggerShake = (msg) => {
        setAmountError(msg);
        setShaking(true);
        setTimeout(() => setShaking(false), 450);
    };

    const generateRef = () => `WD-${Date.now().toString().slice(-8)}`;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (hasPendingWithdrawal) {
            triggerShake('You already have a pending request.');
            return;
        }
        if (!accountName.trim()) { showToast('Account holder name is required', 'error'); return; }
        if (!phone.trim()) { showToast('Phone number is required', 'error'); return; }
        if (!amt || amt <= 0 || amountError) { triggerShake(amountError || 'Enter a valid amount'); return; }

        const ref = generateRef();
        setConfirmData({
            ref,
            accountName: accountName.trim(),
            phone: phone.trim(),
            walletLabel: WALLET_LABELS[wallet] || wallet,
            amountDisplay: formatCurrency(amt, currency),
            feeDisplay: fee > 0 ? formatCurrency(fee, currency) : 'Free',
            receiveDisplay: formatCurrency(youReceive, currency),
            method: method.charAt(0).toUpperCase() + method.slice(1),
        });
    };

    const handleConfirm = async () => {
        const data = confirmData;
        setConfirmData(null);
        setLoading(true);
        try {
            const result = await requestWithdrawal(user.uid, {
                amount: amt,
                phone: data.phone,
                accountName: data.accountName,
                method,
                wallet,
                referenceCode: data.ref,
            });
            if (result.success) {
                setSuccessData({ ...data, status: 'pending' });
                setAmount('');
            } else {
                setErrorData(result.error || translate('common.error'));
            }
        } catch {
            setErrorData(translate('common.error'));
        }
        setLoading(false);
    };

    return (
        <DashboardLayout>
            <ConfirmModal data={confirmData} onConfirm={handleConfirm} onClose={() => setConfirmData(null)} />
            <SuccessModal data={successData} onClose={() => setSuccessData(null)} />
            <ErrorModal errorMsg={errorData} onClose={() => setErrorData(null)} />

            <div className="dashboard-container">
                <div className="dashboard-content">
                    <h2 className="page-title">{translate('withdraw.title')}</h2>

                    <div className="profit-card">
                        <div className="amount">{formatCurrency(availableBalance, currency)}</div>
                        <div className="label">{WALLET_LABELS[wallet] || 'Selected Wallet'}</div>
                    </div>

                    <div className="dash-stats-grid">
                        <div className="stat-card">
                            <div className="amount">{formatCurrency(limits.min, currency)}</div>
                            <div className="label">Minimum</div>
                        </div>
                        <div className="stat-card">
                            <div className="amount">{formatCurrency(limits.max, currency)}</div>
                            <div className="label">Maximum</div>
                        </div>
                        <div className="stat-card">
                            <div className="amount">{limits.feePercent}%</div>
                            <div className="label">Fee</div>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="withdraw-form">

                        {/* Wallet */}
                        <div className="form-group">
                            <label className="form-label">Select Wallet</label>
                            <select className="form-control" value={wallet} onChange={e => setWallet(e.target.value)}>
                                {Object.entries(WALLET_LABELS).map(([v, l]) => (
                                    <option key={v} value={v}>{l}</option>
                                ))}
                            </select>
                        </div>

                        {/* Account Holder Name */}
                        <div className="form-group">
                            <label className="form-label">Account Holder Name</label>
                            <input
                                className="form-control"
                                value={accountName}
                                onChange={e => setAccountName(e.target.value)}
                                placeholder="Name registered on mobile money"
                            />
                        </div>

                        {/* Amount with live validation */}
                        <div className="form-group">
                            <label className="form-label">Amount ({currency})</label>
                            <input
                                ref={amtRef}
                                type="number"
                                step="1"
                                className="form-control"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                placeholder={`Min ${formatCurrency(limits.min, currency)}`}
                                style={amountError ? { borderColor: '#ef4444' } : {}}
                            />
                            {amountError && (
                                <div className={shaking ? 'wd-shake' : ''} style={{
                                    color: '#ef4444', fontSize: 12, marginTop: 5, fontWeight: 600,
                                    display: 'flex', alignItems: 'center', gap: 4
                                }}>
                                    ⚠️ {amountError}
                                </div>
                            )}
                            {!amountError && amt > 0 && (
                                <div style={{ fontSize: 12, marginTop: 5, color: 'var(--text-muted)' }}>
                                    Fee: <b>{fee > 0 ? formatCurrency(fee, currency) : 'Free'}</b> · Deducted from balance: <b style={{ color: '#ef4444' }}>{formatCurrency(totalDeduct, currency)}</b>
                                </div>
                            )}
                        </div>

                        {/* Phone */}
                        <div className="form-group">
                            <label className="form-label">{translate('auth.phone')}</label>
                            <input className="form-control" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Mobile money phone number" />
                        </div>

                        {/* Method */}
                        <div className="form-group">
                            <label className="form-label">Payment Method</label>
                            <select className="form-control" value={method} onChange={e => setMethod(e.target.value)}>
                                {availableMethods.map(m => (
                                    <option key={m.v} value={m.v}>{m.l}</option>
                                ))}
                            </select>
                        </div>

                        <button type="submit" className="btn-primary-auth" disabled={loading || !!amountError || hasPendingWithdrawal}>
                            {hasPendingWithdrawal ? 'Request Pending' : loading ? translate('app.processing') : 'Review & Request Withdrawal →'}
                        </button>
                    </form>

                    {hasPendingWithdrawal && (
                        <div style={{ marginTop: 16, padding: '12px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#d97706', borderRadius: '10px', fontSize: 13, textAlign: 'center', fontWeight: '600' }}>
                            You have a pending withdrawal request. Please wait for it to be processed before making a new one.
                        </div>
                    )}

                    {stats && (
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12, textAlign: 'center' }}>
                            Total withdrawn: {formatCurrency(stats.totalWithdrawn || 0, currency)}
                        </p>
                    )}

                    <div className="section-title" style={{ marginTop: 24 }}>Withdrawal History</div>
                    {withdrawals.length === 0 ? (
                        <p className="empty-state">No withdrawals yet</p>
                    ) : withdrawals.map(w => {
                        const statusColor = w.status === 'approved' ? '#16a34a' : w.status === 'rejected' ? '#dc2626' : '#f59e0b';
                        const statusBg = w.status === 'approved' ? 'rgba(34,197,94,0.12)' : w.status === 'rejected' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)';
                        return (
                            <div key={w.id} className="record-card" onClick={() => {
                                setSuccessData({
                                    ref: w.referenceCode, accountName: w.accountName, phone: w.phone||w.phoneNumber, 
                                    amountDisplay: formatCurrency(w.amount, currency), feeDisplay: formatCurrency(w.fee, currency),
                                    receiveDisplay: formatCurrency(w.receiveAmount||w.amount, currency), walletLabel: w.wallet, method: w.method,
                                    status: w.status
                                });
                            }}>
                                <div className="record-left">
                                    <div className="record-icon" style={{background:'#f5f5f5', border:'1px solid #eee', color: 'var(--color-gold)'}}>
                                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                                    </div>
                                    <div>
                                        <div className="record-network">{(w.method || 'Unknown').toUpperCase()}</div>
                                        <div className="record-hash">{w.referenceCode || w.id?.slice(0, 10)}</div>
                                        <div className="record-date">{w.createdAt ? new Date(w.createdAt).toLocaleString('en-GB') : ''}</div>
                                    </div>
                                </div>
                                <div className="record-right">
                                    <div className="record-amount" style={{color: statusColor}}>-{formatCurrency(w.amount || 0, currency)}</div>
                                    <span className="record-badge" style={{background: statusBg, color: statusColor}}>{(w.status || 'pending')}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <style>{`
                @keyframes wd-fade-in { from { opacity: 0; } to { opacity: 1; } }
                @keyframes wd-pop { from { transform: scale(0.7); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                @keyframes wd-bounce { from { transform: translateY(0); } to { transform: translateY(-10px); } }
                @keyframes wd-slide-up-sheet { from { transform: translateY(100%); } to { transform: translateY(0); } }
                @keyframes wd-shake { 0%,100% { transform: translateX(0); } 20%,60% { transform: translateX(-6px); } 40%,80% { transform: translateX(6px); } }
                .wd-shake { animation: wd-shake 0.4s ease !important; }

                /* Premium Record Cards */
                .record-card {
                    background: var(--color-surface, #ffffff);
                    border: 1px solid var(--color-border, #eaeaea);
                    border-radius: 14px;
                    padding: 14px 16px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    cursor: pointer;
                    transition: transform 0.15s, box-shadow 0.15s;
                    gap: 12px;
                    margin-bottom: 12px;
                }
                .record-card:active { transform: scale(0.97); }

                .record-left { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }
                .record-icon { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                .record-network { font-size: 0.88rem; font-weight: 700; color: var(--text-primary); }
                .record-hash { font-size: 0.72rem; font-family: monospace; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px; margin-top: 2px; }
                .record-date { font-size: 0.7rem; color: var(--text-muted); margin-top: 2px; }

                .record-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
                .record-amount { font-size: 1rem; font-weight: 800; }
                .record-badge { font-size: 0.68rem; font-weight: 700; padding: 2px 8px; border-radius: 20px; text-transform: capitalize; }
            `}</style>
        </DashboardLayout>
    );
}
