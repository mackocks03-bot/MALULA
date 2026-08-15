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
                borderTopLeftRadius: 28, borderTopRightRadius: 28,
                padding: '32px 24px 40px 24px', maxWidth: 500, width: '100%',
                boxShadow: '0 -10px 40px rgba(0,0,0,0.2)',
                animation: 'wd-slide-up-sheet 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                marginBottom: 0
            }}>
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
                    <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text-primary)' }}>Confirm Withdrawal</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Please review your transaction details</div>
                </div>
                <div style={{ background: 'var(--color-bg, #f9f9f9)', borderRadius: 12, padding: '16px', marginBottom: 20 }}>
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
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(0,0,0,0.05)', fontSize: 13 }}>
                            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{k}</span>
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{v}</span>
                        </div>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <button onClick={onClose} style={{
                        flex: 1, padding: '12px', borderRadius: 10, border: '1px solid var(--color-border)',
                        background: 'transparent', color: 'var(--text-muted)', fontWeight: 700, cursor: 'pointer', fontSize: 14
                    }}>Cancel</button>
                    <button onClick={onConfirm} style={{
                        flex: 2, padding: '12px', borderRadius: 10, border: 'none',
                        background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff',
                        fontWeight: 800, cursor: 'pointer', fontSize: 14
                    }}>✅ Confirm Request</button>
                </div>
            </div>
        </div>
    );
}

/* ─── Success Modal ─── */
function SuccessModal({ data, onClose }) {
    if (!data) return null;
    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9001,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            animation: 'wd-fade-in 0.3s ease'
        }}>
            <div style={{
                background: 'var(--color-surface, #fff)', 
                borderTopLeftRadius: 28, borderTopRightRadius: 28,
                padding: '40px 24px 40px 24px', maxWidth: 500, width: '100%', textAlign: 'center',
                boxShadow: '0 -10px 40px rgba(0,0,0,0.2)',
                animation: 'wd-slide-up-sheet 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                marginBottom: 0
            }}>
                <div style={{ fontSize: 64, animation: 'wd-bounce 0.8s ease infinite alternate', marginBottom: 12 }}>✅</div>
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: 'rgba(34,197,94,0.12)', color: '#16a34a',
                    borderRadius: 99, padding: '4px 14px', fontSize: 12, fontWeight: 700, marginBottom: 14
                }}>
                    <span style={{ fontSize: 14 }}>🏅</span> VERIFIED REQUEST
                </div>
                <div style={{ fontWeight: 800, fontSize: 22, color: 'var(--text-primary)', marginBottom: 4 }}>Request Submitted!</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>Your withdrawal is now pending admin approval.</div>
                <div style={{ background: 'var(--color-bg, #f9f9f9)', borderRadius: 12, padding: 16, marginBottom: 20, textAlign: 'left' }}>
                    {[
                        ['Reference', data.ref],
                        ['Account Name', data.accountName],
                        ['Phone', data.phone],
                        ['Amount', data.amountDisplay],
                        ['Fee', data.feeDisplay],
                        ['You Receive', data.receiveDisplay],
                        ['Wallet', data.walletLabel],
                        ['Method', data.method],
                        ['Status', '⏳ Pending'],
                    ].map(([k, v]) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(0,0,0,0.05)', fontSize: 12 }}>
                            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{k}</span>
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{v}</span>
                        </div>
                    ))}
                </div>
                <button onClick={onClose} style={{
                    width: '100%', padding: '13px', borderRadius: 12, border: 'none',
                    background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff',
                    fontWeight: 800, fontSize: 15, cursor: 'pointer'
                }}>Done 🎉</button>
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
                borderTopLeftRadius: 28, borderTopRightRadius: 28,
                padding: '40px 24px 40px 24px', maxWidth: 500, width: '100%', textAlign: 'center',
                boxShadow: '0 -10px 40px rgba(220,38,38,0.15)',
                animation: 'wd-slide-up-sheet 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                borderTop: '4px solid #ef4444',
                marginBottom: 0
            }}>
                <div style={{ fontSize: 54, marginBottom: 16 }}>⚠️</div>
                <div style={{ fontWeight: 800, fontSize: 22, color: '#ef4444', marginBottom: 8 }}>Request Failed</div>
                <div style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 24, fontWeight: 500 }}>{errorMsg}</div>
                
                <button onClick={onClose} style={{
                    width: '100%', padding: '13px', borderRadius: 12, border: 'none',
                    background: 'var(--color-bg, #f1f5f9)', color: 'var(--text-primary)',
                    fontWeight: 800, fontSize: 15, cursor: 'pointer'
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
                setSuccessData({ ...data });
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

                        <button type="submit" className="btn-primary-auth" disabled={loading || !!amountError}>
                            {loading ? translate('app.processing') : 'Review & Request Withdrawal →'}
                        </button>
                    </form>

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
                                    receiveDisplay: formatCurrency(w.receiveAmount||w.amount, currency), walletLabel: w.wallet, method: w.method
                                });
                            }}>
                                <div className="record-left">
                                    <div className="record-icon" style={{background:'#f5f5f5', border:'1px solid #eee'}}>
                                        <span style={{fontSize: '1.2rem'}}>💸</span>
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
