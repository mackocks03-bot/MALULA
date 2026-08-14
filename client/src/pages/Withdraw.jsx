import { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { formatCurrency } from '../utils/helpers.js';
import { requestWithdrawal, listenToUserWithdrawals, getWithdrawalStats } from '../services/withdraw.js';
import { getWithdrawLimits } from '../services/settings.js';
import { db, doc, onSnapshot } from '../services/firebase-config.js';

export default function Withdraw() {
    const { user, userData: initialData } = useAuth();
    const { translate } = useLanguage();
    const { showToast } = useToast();
    const [userData, setUserData] = useState(initialData);
    const [amount, setAmount] = useState('');
    const [phone, setPhone] = useState('');
    const [method, setMethod] = useState('mpesa');
    const [wallet, setWallet] = useState('balance');
    const [loading, setLoading] = useState(false);
    const [withdrawals, setWithdrawals] = useState([]);
    const [limits, setLimits] = useState({ min: 0, max: 0, fee: 0 });
    const [stats, setStats] = useState(null);

    useEffect(() => {
        if (!user) return;
        const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
            if (snap.exists()) setUserData(snap.data());
        });
        return () => unsub();
    }, [user]);

    useEffect(() => {
        if (userData?.phone && !phone) setPhone(userData.phone);
    }, [userData, phone]);

    useEffect(() => {
        const currency = userData?.currency || 'TZS';
        getWithdrawLimits(currency).then(l => setLimits(l || { min: 0, max: 0, fee: 0 }));
    }, [userData?.currency]);

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

    const handleSubmit = async (e) => {
        e.preventDefault();
        const amt = parseFloat(amount);
        if (!amt || amt <= 0) { showToast(translate('withdraw.invalidAmount') || 'Invalid amount', 'error'); return; }
        if (!phone.trim()) { showToast(translate('withdraw.phoneRequired') || 'Phone required', 'error'); return; }

        setLoading(true);
        try {
            const result = await requestWithdrawal(user.uid, {
                amount: amt,
                phone: phone.trim(),
                method,
                wallet
            });
            if (result.success) {
                showToast(translate('withdraw.submitted') || 'Withdrawal submitted!', 'success');
                setAmount('');
            } else {
                showToast(result.error || translate('common.error'), 'error');
            }
        } catch {
            showToast(translate('common.error'), 'error');
        }
        setLoading(false);
    };

    return (
        <DashboardLayout>
            <div className="dashboard-container">
                <div className="dashboard-content">
                    <h2 className="page-title">{translate('withdraw.title')}</h2>

                    <div className="profit-card">
                        <div className="amount">{formatCurrency(availableBalance, currency)}</div>
                        <div className="label">{translate('withdraw.available') || 'Available Balance'} - {
                            wallet === 'balance' ? 'Main' : 
                            wallet === 'welcomeBonus' ? 'Welcome Bonus' : 
                            wallet.split('.')[1].charAt(0).toUpperCase() + wallet.split('.')[1].slice(1)
                        }</div>
                    </div>

                    <div className="dash-stats-grid">
                        <div className="stat-card">
                            <div className="amount">{formatCurrency(limits.min, currency)}</div>
                            <div className="label">{translate('withdraw.min') || 'Minimum'}</div>
                        </div>
                        <div className="stat-card">
                            <div className="amount">{formatCurrency(limits.max, currency)}</div>
                            <div className="label">{translate('withdraw.max') || 'Maximum'}</div>
                        </div>
                        {limits.fee > 0 && (
                            <div className="stat-card">
                                <div className="amount">{formatCurrency(limits.fee, currency)}</div>
                                <div className="label">{translate('withdraw.fee') || 'Fee'}</div>
                            </div>
                        )}
                    </div>

                    <form onSubmit={handleSubmit} className="withdraw-form">
                        <div className="form-group">
                            <label className="form-label">{translate('withdraw.wallet') || 'Select Wallet'}</label>
                            <select className="form-control" value={wallet} onChange={e => setWallet(e.target.value)}>
                                <option value="balance">Main Balance</option>
                                <option value="welcomeBonus">Welcome Bonus</option>
                                <option value="earnings.youtube">YouTube Earnings</option>
                                <option value="earnings.facebook">Facebook Earnings</option>
                                <option value="earnings.whatsapp">WhatsApp Earnings</option>
                                <option value="earnings.tiktok">TikTok Earnings</option>
                                <option value="earnings.chat">Chat Earnings</option>
                                <option value="earnings.ads">Ad Posting Earnings</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">{translate('withdraw.amount') || `Amount (USD or ${currency})`}</label>
                            <input type="number" step="0.01" className="form-control" value={amount} onChange={e => setAmount(e.target.value)} placeholder={`Min ${formatCurrency(limits.min, currency)}`} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{translate('auth.phone')}</label>
                            <input className="form-control" value={phone} onChange={e => setPhone(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{translate('withdraw.method') || 'Payment Method'}</label>
                            <select className="form-control" value={method} onChange={e => setMethod(e.target.value)}>
                                <option value="mpesa">M-Pesa</option>
                                <option value="airtel">Airtel Money</option>
                                <option value="tigo">Tigo Pesa</option>
                                <option value="halopesa">HaloPesa</option>
                            </select>
                        </div>
                        <button type="submit" className="btn-primary-auth" disabled={loading}>
                            {loading ? translate('app.processing') : translate('withdraw.submit') || 'Request Withdrawal'}
                        </button>
                    </form>

                    {stats && (
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12, textAlign: 'center' }}>
                            {translate('withdraw.totalWithdrawn') || 'Total withdrawn'}: {formatCurrency(stats.totalWithdrawn || 0, currency)}
                        </p>
                    )}

                    <div className="section-title" style={{ marginTop: 24 }}>{translate('withdraw.history') || 'Withdrawal History'}</div>
                    {withdrawals.length === 0 ? (
                        <p className="empty-state">{translate('withdraw.noHistory') || 'No withdrawals yet'}</p>
                    ) : withdrawals.map(w => (
                        <div key={w.id} className="transaction-item">
                            <div className="left">
                                <div className="type">{formatCurrency(w.amount || 0, currency)}</div>
                                <div className="date">{w.phone || w.phoneNumber} · {w.status || 'pending'}</div>
                            </div>
                            <div className="amount">{w.createdAt ? new Date(w.createdAt).toLocaleDateString() : ''}</div>
                        </div>
                    ))}
                </div>
            </div>
        </DashboardLayout>
    );
}
