import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout.jsx';
import AppDownload from '../components/AppDownload.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { formatCurrency } from '../utils/helpers.js';
import { db, doc, onSnapshot } from '../services/firebase-config.js';
import dataStore from '../utils/dataStore.js';
import { getActivationFee, getWelcomeBonus } from '../services/settings.js';

export default function Dashboard() {
    const { user, userData: initialData } = useAuth();
    const { translate } = useLanguage();
    const { showToast } = useToast();
    const [userData, setUserData] = useState(initialData);
    const [dailyMessage, setDailyMessage] = useState('Welcome to NEWHOPE-CHAT! Start earning today.');
    const [dashboardFees, setDashboardFees] = useState({ activation: 0, welcome: 0 });

    useEffect(() => {
        if (!user) return;
        const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
            if (snap.exists()) setUserData(snap.data());
        });
        return () => unsub();
    }, [user]);

    useEffect(() => {
        dataStore.getGeneralSettings().then(s => {
            if (s?.dailyMessage) setDailyMessage(s.dailyMessage);
        });
    }, []);

    useEffect(() => {
        const currency = userData?.currency || 'TZS';
        async function fetchFees() {
            const activation = await getActivationFee(currency);
            const welcome = await getWelcomeBonus ? await getWelcomeBonus(currency) : 0;
            setDashboardFees({ activation, welcome });
        }
        fetchFees();
    }, [userData?.currency]);

    const currency = userData?.currency || 'TZS';
    const spinEarnings = parseFloat(userData?.spinEarnings || 0);
    const totalAllEarnings = (userData?.totalProfit || 0) + spinEarnings;
    const referralLink = `${window.location.origin}/register?ref=${userData?.username || 'user'}`;
    const taskBalances = userData?.taskBalances || {};
    const earnings = userData?.earnings || {};

    const displayEarning = (key) => formatCurrency(taskBalances[key] || earnings[key] || 0, currency);

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(referralLink);
            showToast('✅ ' + (translate('common.copied') || 'Copied!'), 'success');
        } catch {
            showToast(translate('common.error'), 'error');
        }
    };

    return (
        <DashboardLayout>
            <div className="dashboard-container">
                <div className="dashboard-content">
                    <div className="welcome-section">
                        <div className="greeting">
                            {translate('dashboard.welcome')} 👋{' '}
                            <span className="username-with-badge">
                                <span className="username">{userData?.username || 'User'}</span>
                                {(userData?.referralCount >= 41) && <span className="blue-tick" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: '50%', background: 'var(--color-blue)', color: 'white', fontSize: 10 }}>✓</span>}
                            </span>
                        </div>
                    </div>

                    <div className="daily-notification">
                        <div className="icon"><svg viewBox="0 0 24 24"><path d="M12 22a10 10 0 100-20 10 10 0 000 20z" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg></div>
                        <div className="content">
                            <div className="label">📢 {translate('app.announcement')}</div>
                            <div className="message">{dailyMessage}</div>
                        </div>
                    </div>

                    <AppDownload />

                    <div className="profit-card">
                        <div className="glow" /><div className="glow-2" />
                        <div className="amount">{formatCurrency(totalAllEarnings, currency)}</div>
                        <div className="label">{translate('dashboard.totalProfit')}</div>
                    </div>

                    <div className="dash-stats-grid">
                        <div className="stat-card">
                            <div className="amount">{formatCurrency(dashboardFees.activation, currency)}</div>
                            <div className="label">{translate('dashboard.openingFee')}</div>
                        </div>
                        <div className="stat-card">
                            <div className="amount">{formatCurrency(dashboardFees.welcome, currency)}</div>
                            <div className="label">{translate('dashboard.welcomeBonus')}</div>
                        </div>
                    </div>

                    <div className="quick-actions">
                        <Link to="/spin" className="quick-action"><svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 11-6.219-8.56" /><polyline points="21 3 21 9 15 9" /></svg><span className="label">{translate('dashboard.spin')}</span></Link>
                        <Link to="/withdraw" className="quick-action"><svg viewBox="0 0 24 24"><path d="M12 2v20" /><path d="M6 8l6-6 6 6" /><path d="M6 16l6 6 6-6" /></svg><span className="label">{translate('dashboard.withdraw')}</span></Link>
                        <Link to="/tasks" className="quick-action"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><path d="M9 14l2 2 4-4" /></svg><span className="label">{translate('tasks.title')}</span></Link>
                        <Link to="/affiliate" className="quick-action"><svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg><span className="label">{translate('dashboard.team')}</span></Link>
                        <button type="button" className="quick-action" onClick={copyLink}><svg viewBox="0 0 24 24"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg><span className="label">{translate('dashboard.invite')}</span></button>
                    </div>

                    <div className="balance-grid">
                        <div className="balance-card"><div className="amount gold">{formatCurrency(userData?.balance || 0, currency)}</div><div className="label">{translate('dashboard.balance')}</div></div>
                        <div className="balance-card"><div className="amount green">{formatCurrency(userData?.withdrawn || 0, currency)}</div><div className="label">{translate('dashboard.withdrawn')}</div></div>
                    </div>

                    <div className="earnings-section">
                        <div className="section-title">{translate('dashboard.earnings')}</div>
                        {[
                            { key: 'chat',     icon: '💭', label: translate('dashboard.chat')     || 'Chat Earnings' },
                            { key: 'tiktok',   icon: '🎵', label: translate('dashboard.tiktok')   || 'TikTok Earnings' },
                            { key: 'facebook', icon: '📘', label: translate('dashboard.facebook') || 'Facebook Earnings' },
                            { key: 'youtube',  icon: '📺', label: translate('dashboard.youtube')  || 'YouTube Earnings' },
                            { key: 'whatsapp', icon: '💬', label: translate('dashboard.whatsapp') || 'WhatsApp Earnings' },
                            { key: 'ads',      icon: '📢', label: translate('dashboard.ads')      || 'Ad Earnings' },
                        ].map(({ key, icon, label }) => {
                            const val = taskBalances[key] || earnings[key] || 0;
                            return (
                                <div key={key} className="earning-item">
                                    <div className="left"><span className="name">{icon} {label}</span></div>
                                    <span className="value" style={{ color: val > 0 ? 'var(--color-green)' : undefined }}>{formatCurrency(val, currency)}</span>
                                </div>
                            );
                        })}
                        <div className="earning-item">
                            <div className="left"><span className="name">🎰 {translate('dashboard.spinEarnings') || 'Spin Earnings'}</span></div>
                            <span className="value" style={{ color: spinEarnings > 0 ? 'var(--color-green)' : undefined }}>{formatCurrency(spinEarnings, currency)}</span>
                        </div>
                        {(userData?.welcomeBonus || 0) > 0 && (
                            <div className="earning-item">
                                <div className="left"><span className="name">🎁 {translate('dashboard.welcomeBonus') || 'Welcome Bonus'}</span></div>
                                <span className="value" style={{ color: 'var(--color-green)' }}>{userData.welcomeBonus}</span>
                            </div>
                        )}

                    </div>

                    <div className="referral-section">
                        <div className="header">
                            <div>
                                <div className="count">{userData?.referralCount || 0}</div>
                                <div className="label">{translate('dashboard.referrals')}</div>
                            </div>
                            <span className="badge" style={{ background: 'var(--color-gold)', color: 'var(--color-on-gold)', padding: '2px 10px', borderRadius: 'var(--radius-full)', fontSize: 11, fontWeight: 600 }}>REFERRAL LINK</span>
                        </div>
                        <div className="referral-link-box">
                            <span className="link">{referralLink}</span>
                            <button type="button" className="copy-btn" onClick={copyLink}>
                                <svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                                <span>{translate('common.copy')}</span>
                            </button>
                        </div>
                        <div className="share-buttons">
                            <button type="button" className="share-btn whatsapp" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent('Join NEWHOPE-CHAT: ' + referralLink)}`, '_blank')}>
                                WhatsApp
                            </button>
                            <button type="button" className="share-btn facebook" onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`, '_blank')}>
                                Facebook
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
