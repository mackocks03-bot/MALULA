import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout.jsx';
import AppDownload from '../components/AppDownload.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { formatCurrency } from '../utils/helpers.js';
import { db, doc, onSnapshot, collection, query, where } from '../services/firebase-config.js';
import dataStore from '../utils/dataStore.js';
import { getActivationFee, getWelcomeBonus } from '../services/settings.js';
import { getWithdrawalStats } from '../services/withdraw.js';
import { getReferralTree } from '../services/referrals.js';

const VerifiedBadge = () => (
    <svg style={{ marginLeft: 6, flexShrink: 0 }} width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M10.5236 2.4593C11.3917 1.80806 12.6083 1.80806 13.4764 2.4593L15.1118 3.68593C15.4851 3.96594 15.9405 4.10398 16.4101 4.07609L18.4419 3.95543C19.524 3.89117 20.4709 4.67389 20.671 5.74868L21.0478 7.76106C21.1338 8.21989 21.3644 8.63661 21.7011 8.94821L23.1585 10.3065C23.9351 11.0264 23.9351 12.2479 23.1585 12.9678L21.7011 14.3262C21.3644 14.6378 21.1338 15.0545 21.0478 15.5133L20.671 17.5257C20.4709 18.6005 19.524 19.3832 18.4419 19.319L16.4101 19.1983C15.9405 19.1704 15.4851 19.3084 15.1118 19.5885L13.4764 20.8151C12.6083 21.4663 11.3917 21.4663 10.5236 20.8151L8.88819 19.5885C8.51486 19.3084 8.05947 19.1704 7.58992 19.1983L5.55811 19.319C4.47604 19.3832 3.5291 18.6005 3.32899 17.5257L2.95217 15.5133C2.86616 15.0545 2.63558 14.6378 2.29891 14.3262L0.841539 12.9678C0.0648873 12.2479 0.0648873 11.0264 0.841539 10.3065L2.29891 8.94821C2.63558 8.63661 2.86616 8.21989 2.95217 7.76106L3.32899 5.74868C3.5291 4.67389 4.47604 3.89117 5.55811 3.95543L7.58992 4.07609C8.05947 4.10398 8.51486 3.96594 8.88819 3.68593L10.5236 2.4593Z" fill="#3b82f6"/>
        <path fillRule="evenodd" clipRule="evenodd" d="M16.9458 9.53981C17.3995 9.06014 17.3781 8.30396 16.8984 7.8503C16.4188 7.39665 15.6626 7.41801 15.2089 7.89768L10.3702 13.0135L8.76118 11.4727C8.28318 11.015 7.52656 11.0315 7.06886 11.5095C6.61117 11.9875 6.62762 12.7441 7.10562 13.2018L9.56947 15.561C9.79973 15.7815 10.108 15.9015 10.4261 15.8953C10.7443 15.8891 11.0478 15.7573 11.2697 15.5227L16.9458 9.53981Z" fill="white"/>
    </svg>
);

export default function Dashboard() {
    const { user, userData: initialData } = useAuth();
    const { translate } = useLanguage();
    const { showToast } = useToast();
    const [userData, setUserData] = useState(initialData);
    const [dailyMessage, setDailyMessage] = useState('Welcome to NEWHOPE-CHAT! Start earning today.');
    const [dashboardFees, setDashboardFees] = useState({ activation: 0, welcome: 0 });
    const [realWithdrawn, setRealWithdrawn] = useState(0);
    const [activeDirects, setActiveDirects] = useState(0);
    const [totalActiveReferrals, setTotalActiveReferrals] = useState(0);

    // Admin message state — dismissed only for the current session (not persisted)
    const [adminMsg, setAdminMsg] = useState(null);
    const [msgDismissed, setMsgDismissed] = useState(false);

    useEffect(() => {
        if (!user) return;
        
        getWithdrawalStats(user.uid).then(r => {
            if (r.success && r.data) {
                setRealWithdrawn(r.data.totalWithdrawn || 0);
            }
        });

        const loadTree = async () => {
            const tree = await getReferralTree(user.uid);
            const l1Active = tree.level1.filter(r => r.isActive).length;
            setActiveDirects(l1Active);
            setTotalActiveReferrals(
                l1Active +
                tree.level2.filter(r => r.isActive).length +
                tree.level3.filter(r => r.isActive).length
            );
        };
        loadTree();

        const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
            if (snap.exists()) setUserData(snap.data());
            loadTree();
        });
        return () => unsub();
    }, [user]);

    // Keep a ref to latest countryCode so the onSnapshot callback never needs to re-subscribe
    const countryCodeRef = { current: null };

    // Fetch Admin Messages — real-time listener, subscribes once per user
    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, 'adminMessages'), where('active', '==', true));
        const unsub = onSnapshot(q, (snap) => {
            const msgs = snap.docs.map(d => ({id: d.id, ...d.data()}));
            msgs.sort((a,b) => b.createdAt - a.createdAt);
            // Read country from ref so we don't need userData in dep array
            const codeMatch = countryCodeRef.current || 'TZ';
            const found = msgs.find(m =>
                m.target === 'all' ||
                m.target === `group:${codeMatch}` ||
                m.target === `user:${user.uid}`
            ) || null;
            setAdminMsg(found);
            if (found) setMsgDismissed(false); // only reset dismiss when a valid message arrives
        }, e => console.error('Error fetching admin msg', e));
        return () => unsub();
    }, [user]); // stable — only re-subscribes if user changes

    // Keep ref in sync with latest userData (runs after every render — cheap)
    countryCodeRef.current = userData?.countryCode || userData?.country || 'TZ';

    const handleDismissAdminMsg = () => {
        setMsgDismissed(true); // session-only: resets on next page load
    };


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
    const origin = window.location.origin.includes('localhost') ? 'https://newhope-chat.site' : window.location.origin;
    const referralLink = `${origin}/register?ref=${userData?.username || 'user'}`;
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

    const isTeamOne = activeDirects >= 41;

    useEffect(() => {
        if (isTeamOne) {
            document.body.classList.add('vip-mode');
        } else {
            document.body.classList.remove('vip-mode');
        }
        return () => document.body.classList.remove('vip-mode');
    }, [isTeamOne]);

    return (
        <DashboardLayout>
            <div className={`dashboard-container ${isTeamOne ? 'premium-verified-glow' : ''}`}>
                <div className="dashboard-content">
                    <div className="welcome-section">
                        <div className="greeting">
                            {translate('dashboard.welcome')} 👋{' '}
                            <span className="username-with-badge" style={{ display: 'inline-flex', alignItems: 'center' }}>
                                <span className="username">{userData?.username || 'User'}</span>
                                {isTeamOne && <VerifiedBadge />}
                            </span>
                        </div>
                    </div>

                    {adminMsg && !msgDismissed ? (
                        <div className={`admin-msg-card ${adminMsg.color || 'blue'}`}>
                            <div className="icon"><i className="fas fa-bullhorn" /></div>
                            <div className="content">
                                <div className="label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>📢 MESSAGE FROM ADMIN</span>
                                    <span style={{ fontSize: 9, opacity: 0.6, fontWeight: 500 }}>Uploaded by Admin</span>
                                </div>
                                <div className="message">{adminMsg.message}</div>
                            </div>
                            <button className="close-btn" onClick={handleDismissAdminMsg}>×</button>
                        </div>
                    ) : (
                        <div className="daily-notification">
                            <div className="icon"><svg viewBox="0 0 24 24"><path d="M12 22a10 10 0 100-20 10 10 0 000 20z" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg></div>
                            <div className="content">
                                <div className="label">📢 {translate('app.announcement')}</div>
                                <div className="message">{dailyMessage}</div>
                            </div>
                        </div>
                    )}

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
                            <div className="amount">{formatCurrency(userData?.welcomeBonus || 0, currency).split(' ')[0]} {userData?.welcomeBonus || 0}</div>
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
                        <div className="balance-card"><div className="amount green">{formatCurrency(realWithdrawn, currency)}</div><div className="label">{translate('dashboard.withdrawn')}</div></div>
                    </div>

                    <div className="earnings-section">
                        <div className="section-title">{translate('dashboard.earnings')}</div>
                        {[
                            {
                                key: 'chat',
                                icon: (
                                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" style={{ flexShrink: 0 }}>
                                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="#6C63FF" />
                                        <circle cx="8" cy="10" r="1" fill="#fff"/><circle cx="12" cy="10" r="1" fill="#fff"/><circle cx="16" cy="10" r="1" fill="#fff"/>
                                    </svg>
                                ),
                                label: translate('dashboard.chat') || 'Chat Earnings'
                            },
                            {
                                key: 'tiktok',
                                icon: (
                                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" style={{ flexShrink: 0 }}>
                                        <rect width="24" height="24" rx="6" fill="#010101"/>
                                        <path d="M16.6 6.4a3.6 3.6 0 0 1-3.6-3.6v10.4a2.4 2.4 0 1 1-2.4-2.4c.22 0 .43.03.63.08V7.77a5.6 5.6 0 1 0 5.37 5.63V9.05a6.77 6.77 0 0 0 3.6 1.04V6.87a3.6 3.6 0 0 1-3.6-.47z" fill="white"/>
                                        <path d="M15.4 5.6a3.6 3.6 0 0 0 3.6 3.47V5.87a3.6 3.6 0 0 1-2-.47 3.6 3.6 0 0 1-1.6-3.6V.8A3.6 3.6 0 0 0 12 4.4v9.43a2.4 2.4 0 0 1-1.77 2.31 2.4 2.4 0 0 1-3.03-2.31 2.4 2.4 0 0 1 2.4-2.4c.22 0 .43.03.63.08V8.37a5.6 5.6 0 1 0 5.37 5.63V5.6z" fill="#EE1D52"/>
                                        <path d="M19 9.07a6.77 6.77 0 0 1-3.6-1.04v3.04a5.6 5.6 0 0 1-5.37 5.6 5.6 5.6 0 0 1-5.63-5.6 5.6 5.6 0 0 1 5.6-5.6c.22 0 .43.01.63.04V2.88a8.8 8.8 0 0 0-.63-.04A8.8 8.8 0 0 0 1.2 11.07a8.8 8.8 0 0 0 8.8 8.8 8.8 8.8 0 0 0 8.8-8.8V6.87A6.77 6.77 0 0 0 19 9.07z" fill="#69C9D0"/>
                                    </svg>
                                ),
                                label: translate('dashboard.tiktok') || 'TikTok Earnings'
                            },
                            {
                                key: 'facebook',
                                icon: (
                                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" style={{ flexShrink: 0 }}>
                                        <rect width="24" height="24" rx="6" fill="#1877F2"/>
                                        <path d="M16.5 12H13.5V21H10.5V12H8V9H10.5V7.5C10.5 5.57 11.57 4 13.5 4H16V7H14.5C14.22 7 14 7.23 14 7.5V9H16.5L16.5 12Z" fill="white"/>
                                    </svg>
                                ),
                                label: translate('dashboard.facebook') || 'Facebook Earnings'
                            },
                            {
                                key: 'youtube',
                                icon: (
                                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" style={{ flexShrink: 0 }}>
                                        <rect width="24" height="24" rx="6" fill="#FF0000"/>
                                        <path d="M21.5 7.5s-.2-1.4-.8-2c-.8-.8-1.6-.8-2-.9C16.3 4.5 12 4.5 12 4.5s-4.3 0-6.7.1c-.4.1-1.2.1-2 .9-.6.6-.8 2-.8 2S2.3 9.1 2.3 10.7v1.5c0 1.6.2 3.2.2 3.2s.2 1.4.8 2c.8.8 1.8.8 2.3.8C6.7 18.3 12 18.3 12 18.3s4.3 0 6.7-.2c.4-.1 1.2-.1 2-.9.6-.6.8-2 .8-2s.2-1.6.2-3.2v-1.5C21.7 9.1 21.5 7.5 21.5 7.5zM10 14.5v-5.5l5.5 2.75L10 14.5z" fill="white"/>
                                    </svg>
                                ),
                                label: translate('dashboard.youtube') || 'YouTube Earnings'
                            },
                            {
                                key: 'whatsapp',
                                icon: (
                                    <svg viewBox="0 0 48 48" width="22" height="22" style={{ flexShrink: 0 }}>
                                        <rect width="48" height="48" rx="12" fill="#25D366"/>
                                        <path d="M24 8C15.16 8 8 15.16 8 24c0 2.83.74 5.49 2.03 7.8L8 40l8.44-2.02A15.93 15.93 0 0 0 24 40c8.84 0 16-7.16 16-16S32.84 8 24 8z" fill="#fff"/>
                                        <path d="M24 10.4c7.5 0 13.6 6.1 13.6 13.6 0 7.5-6.1 13.6-13.6 13.6-2.46 0-4.76-.66-6.74-1.8l-.48-.28-4.98 1.19 1.24-4.84-.32-.5A13.52 13.52 0 0 1 10.4 24c0-7.5 6.1-13.6 13.6-13.6z" fill="#25D366"/>
                                        <path d="M19.06 16.4c-.3-.67-.62-.68-.91-.7-.23-.01-.5-.01-.77-.01-.27 0-.7.1-1.07.5-.37.4-1.4 1.37-1.4 3.33s1.44 3.86 1.64 4.13c.2.27 2.78 4.43 6.86 6.03 3.4 1.34 4.09 1.07 4.82 1 .74-.06 2.38-.97 2.72-1.91.34-.94.34-1.74.24-1.91-.1-.17-.37-.27-.77-.47s-2.38-1.17-2.75-1.3c-.37-.14-.64-.2-.91.2-.27.4-1.04 1.3-1.27 1.57-.23.27-.47.3-.87.1-.4-.2-1.7-.63-3.24-2-.12-.1-.23-.2-.35-.31-.97-.93-1.6-2.06-1.79-2.46-.2-.4-.02-.62.15-.82.15-.18.33-.47.5-.7.17-.23.23-.4.33-.67.1-.27.05-.5-.05-.7-.1-.2-.89-2.18-1.23-2.98z" fill="#fff"/>
                                    </svg>
                                ),
                                label: translate('dashboard.whatsapp') || 'WhatsApp Earnings'
                            },
                            {
                                key: 'ads',
                                icon: (
                                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" style={{ flexShrink: 0 }}>
                                        <rect width="24" height="24" rx="6" fill="#FF6B35"/>
                                        <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-5 14H8v-2h6v2zm2-4H8v-2h8v2zm0-4H8V7h8v2z" fill="white"/>
                                    </svg>
                                ),
                                label: translate('dashboard.ads') || 'Ad Earnings'
                            },
                        ].map(({ key, icon, label }) => {
                            const val = taskBalances[key] || earnings[key] || 0;
                            return (
                                <div key={key} className="earning-item">
                                    <div className="left">
                                        <span className="earning-icon">{icon}</span>
                                        <span className="name">{label}</span>
                                    </div>
                                    <span className="value" style={{ color: val > 0 ? 'var(--color-green)' : undefined }}>{formatCurrency(val, currency)}</span>
                                </div>
                            );
                        })}
                        <div className="earning-item">
                            <div className="left">
                                <span className="earning-icon">
                                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" style={{ flexShrink: 0 }}>
                                        <rect width="24" height="24" rx="6" fill="#7C3AED"/>
                                        <path d="M12 5a7 7 0 1 0 7 7A7 7 0 0 0 12 5zm1 10H11v-2h2zm0-4H11V7h2z" fill="white" opacity="0.3"/>
                                        <path d="M8 12l2.5 2.5L16 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        <circle cx="12" cy="12" r="5" stroke="white" strokeWidth="1.5" fill="none" strokeDasharray="4 2"/>
                                    </svg>
                                </span>
                                <span className="name">{translate('dashboard.spinEarnings') || 'Spin Earnings'}</span>
                            </div>
                            <span className="value" style={{ color: spinEarnings > 0 ? 'var(--color-green)' : undefined }}>{formatCurrency(spinEarnings, currency)}</span>
                        </div>
                        {(userData?.welcomeBonus || 0) > 0 && (
                            <div className="earning-item">
                                <div className="left">
                                    <span className="earning-icon">
                                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" style={{ flexShrink: 0 }}>
                                            <rect width="24" height="24" rx="6" fill="#F59E0B"/>
                                            <path d="M20 12v9H4v-9" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                            <path d="M22 7H2v5h20V7z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                            <path d="M12 22V7" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                            <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                            <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                    </span>
                                    <span className="name">{translate('dashboard.welcomeBonus') || 'Welcome Bonus'}</span>
                                </div>
                                <span className="value" style={{ color: 'var(--color-green)' }}>{userData.welcomeBonus}</span>
                            </div>
                        )}

                    </div>

                    <div className="referral-section">
                        <div className="header">
                            <div>
                                <div className="count">{totalActiveReferrals}</div>
                                <div className="label">Active Referrals</div>
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

                <style>{`
                    /* ═══════════════════════════════════════════════════════
                       VIP DASHBOARD — Clone of Admin Financials design system
                       White glass cards + Gold VIP accents
                    ═══════════════════════════════════════════════════════ */

                    /* Background */
                    .premium-verified-glow::before {
                        content: '';
                        position: fixed;
                        inset: 0;
                        background: linear-gradient(135deg, #eef3fc 0%, #e6efff 50%, #f3ebff 100%);
                        z-index: -1;
                        pointer-events: none;
                    }

                    /* Animations */
                    @keyframes vipGoldShimmer {
                        0%   { background-position: -200% center; }
                        100% { background-position:  200% center; }
                    }
                    @keyframes vipFloatCard {
                        0%,100% { transform: translateY(0);   box-shadow: 0 20px 50px rgba(245,158,11,0.18), 0 0 0 2px #f59e0b; }
                        50%     { transform: translateY(-6px); box-shadow: 0 30px 70px rgba(245,158,11,0.28), 0 0 0 2px #fbbf24; }
                    }
                    @keyframes vipCardReveal {
                        from { opacity: 0; transform: translateY(12px); }
                        to   { opacity: 1; transform: translateY(0); }
                    }

                    /* Typography */
                    .premium-verified-glow .section-title,
                    .premium-verified-glow .greeting { color: #2b3674 !important; }

                    .premium-verified-glow .username-with-badge .username {
                        background: linear-gradient(90deg, #b45309, #f59e0b, #fde047, #f59e0b, #b45309);
                        background-size: 300% auto;
                        animation: vipGoldShimmer 4s linear infinite;
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: transparent;
                        font-weight: 900;
                    }

                    /* ══ Profit Card — Premium Hero Gold Card ══ */
                    .premium-verified-glow .profit-card {
                        position: relative;
                        background: linear-gradient(135deg, #1e293b 0%, #0f0c29 100%) !important;
                        border-radius: 24px !important;
                        border: none !important;
                        animation: vipFloatCard 5s ease-in-out infinite;
                        overflow: hidden;
                        /* gold border via outline + box-shadow trick */
                        outline: 2px solid #f59e0b;
                        outline-offset: 0px;
                        box-shadow: 0 20px 50px rgba(245,158,11,0.18) !important;
                    }
                    /* sweeping gold shimmer overlay */
                    .premium-verified-glow .profit-card::after {
                        content: '';
                        position: absolute; inset: 0;
                        background: linear-gradient(105deg,
                            transparent 35%,
                            rgba(253,224,71,0.15) 50%,
                            transparent 65%
                        );
                        background-size: 200% 100%;
                        animation: vipGoldShimmer 3s linear infinite;
                        pointer-events: none;
                    }
                    .premium-verified-glow .profit-card .amount {
                        background: linear-gradient(135deg, #fef08a, #f59e0b) !important;
                        -webkit-background-clip: text !important;
                        -webkit-text-fill-color: transparent !important;
                        font-size: 38px !important;
                        font-weight: 900 !important;
                        letter-spacing: -1px;
                    }
                    .premium-verified-glow .profit-card .label {
                        color: rgba(253,224,71,0.85) !important;
                        font-size: 11px !important;
                        letter-spacing: 2px;
                        text-transform: uppercase;
                        font-weight: 700 !important;
                    }

                    /* ══ All other cards — exact Admin Financials pf-metric-card clone ══ */
                    .premium-verified-glow .stat-card,
                    .premium-verified-glow .balance-card,
                    .premium-verified-glow .daily-notification,
                    .premium-verified-glow .referral-section {
                        background: rgba(255,255,255,0.8) !important;
                        backdrop-filter: blur(20px) !important;
                        border: 1px solid rgba(255,255,255,0.9) !important;
                        border-radius: 20px !important;
                        box-shadow: 0px 18px 40px rgba(112,144,176,0.12) !important;
                        color: #2b3674 !important;
                        transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
                        animation: vipCardReveal 0.5s ease both;
                    }
                    .premium-verified-glow .stat-card:hover,
                    .premium-verified-glow .balance-card:hover {
                        transform: translateY(-5px);
                        border-color: rgba(251,191,36,0.6) !important;
                        box-shadow: 0 20px 40px rgba(245,158,11,0.18) !important;
                        background: #fff !important;
                    }
                    /* amounts — indigo normally, gold on hover */
                    .premium-verified-glow .stat-card .amount,
                    .premium-verified-glow .balance-card .amount {
                        color: #4318ff !important;
                        font-weight: 800 !important;
                        font-size: 22px !important;
                        transition: color 0.3s;
                    }
                    .premium-verified-glow .stat-card:hover .amount,
                    .premium-verified-glow .balance-card:hover .amount { color: #d97706 !important; }

                    .premium-verified-glow .stat-card .label,
                    .premium-verified-glow .balance-card .label,
                    .premium-verified-glow .daily-notification .label {
                        color: #8f9bba !important;
                        font-size: 11px !important;
                        font-weight: 600 !important;
                        text-transform: uppercase;
                        letter-spacing: 0.8px;
                    }

                    /* ══ Quick Actions — Financial-style soft icon pills ══ */
                    .premium-verified-glow .quick-action {
                        background: rgba(255,255,255,0.8) !important;
                        backdrop-filter: blur(20px);
                        border: 1px solid rgba(255,255,255,0.9) !important;
                        border-radius: 20px !important;
                        box-shadow: 0px 18px 40px rgba(112,144,176,0.12) !important;
                        transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
                        padding: 14px 8px;
                        text-decoration: none;
                    }
                    .premium-verified-glow .quick-action:hover {
                        transform: translateY(-5px);
                        background: #fff !important;
                        border-color: rgba(67,24,255,0.25) !important;
                        box-shadow: 0 20px 40px rgba(67,24,255,0.12) !important;
                    }
                    .premium-verified-glow .quick-action svg {
                        stroke: #4318ff !important;
                        width: 26px; height: 26px;
                        filter: none !important;
                        transition: all 0.3s;
                    }
                    .premium-verified-glow .quick-action:hover svg {
                        stroke: #7551ff !important;
                        filter: drop-shadow(0 2px 6px rgba(67,24,255,0.3)) !important;
                    }
                    .premium-verified-glow .quick-action .label {
                        color: #8f9bba !important;
                        font-size: 10px !important;
                        font-weight: 700 !important;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    .premium-verified-glow .quick-action:hover .label { color: #2b3674 !important; }

                    /* ══ Earnings items (already polished, keep) ══ */
                    .premium-verified-glow .earnings-section { background: transparent; padding: 0; }
                    .premium-verified-glow .earning-item {
                        background: rgba(255,255,255,0.8) !important;
                        backdrop-filter: blur(12px);
                        border-radius: 16px;
                        padding: 14px 18px;
                        margin-bottom: 10px;
                        border: 1px solid rgba(255,255,255,0.9) !important;
                        display: flex; justify-content: space-between; align-items: center;
                        box-shadow: 0 4px 15px rgba(112,144,176,0.08) !important;
                        transition: all 0.3s ease;
                    }
                    .premium-verified-glow .earning-item:hover {
                        background: #fff !important;
                        transform: translateX(4px);
                        border-left: 4px solid #f59e0b !important;
                        box-shadow: 0 8px 25px rgba(245,158,11,0.15) !important;
                    }
                    .premium-verified-glow .earning-item .name { color: #2b3674 !important; font-weight: 700; font-size: 14px; }
                    .premium-verified-glow .earning-item .value { font-weight: 800; font-size: 15px; color: #4318ff !important; }
                    .premium-verified-glow .earning-item:hover .value { color: #d97706 !important; }

                    /* ══ Referral section ══ */
                    .premium-verified-glow .referral-section .header .badge,
                    .premium-verified-glow .share-btn {
                        background: linear-gradient(135deg, #4318ff, #7551ff) !important;
                        color: #fff !important;
                        border: none;
                        box-shadow: 0 8px 20px rgba(67,24,255,0.25);
                        font-weight: 700;
                    }
                    .premium-verified-glow .copy-btn {
                        background: rgba(67,24,255,0.08) !important;
                        color: #4318ff !important;
                        font-weight: 700;
                    }
                    .premium-verified-glow .referral-link-box {
                        background: #fff !important;
                        border: 1px solid rgba(67,24,255,0.15) !important;
                        color: #2b3674 !important;
                    }

                    /* ══ VIP Floating Bottom Nav (only for qualified users) ══ */
                    @keyframes vipNavItemPop {
                        0%   { transform: translateY(0) scale(1); }
                        40%  { transform: translateY(-5px) scale(1.15); }
                        70%  { transform: translateY(-2px) scale(1.08); }
                        100% { transform: translateY(0) scale(1); }
                    }
                    body.vip-mode .bottom-nav {
                        bottom: 14px !important;
                        left: 50% !important;
                        right: auto !important;
                        transform: translateX(-50%) !important;
                        width: calc(100% - 32px) !important;
                        max-width: 480px !important;
                        background: rgba(255,255,255,0.88) !important;
                        backdrop-filter: blur(24px) !important;
                        -webkit-backdrop-filter: blur(24px) !important;
                        border: 1px solid rgba(255,255,255,0.95) !important;
                        border-top: none !important;
                        border-radius: 28px !important;
                        box-shadow: 0 8px 32px rgba(112,144,176,0.2), 0 2px 8px rgba(0,0,0,0.06) !important;
                        padding: 8px 6px !important;
                        transition: all 0.4s cubic-bezier(0.4,0,0.2,1) !important;
                    }
                    body.vip-mode .bottom-nav .nav-item {
                        padding: 6px 14px !important;
                        border-radius: 20px !important;
                        font-size: 9px !important;
                        font-weight: 700 !important;
                        text-transform: uppercase !important;
                        letter-spacing: 0.4px !important;
                        color: #8f9bba !important;
                        min-width: 52px !important;
                        gap: 3px !important;
                        transition: all 0.25s cubic-bezier(0.4,0,0.2,1) !important;
                    }
                    body.vip-mode .bottom-nav .nav-item.active {
                        background: linear-gradient(135deg, #f59e0b, #d97706) !important;
                        color: #fff !important;
                        box-shadow: 0 6px 20px rgba(245,158,11,0.4) !important;
                        animation: vipNavItemPop 0.4s cubic-bezier(0.34,1.56,0.64,1) both !important;
                    }
                    body.vip-mode .bottom-nav .nav-item.active svg {
                        stroke: #fff !important;
                        filter: drop-shadow(0 2px 4px rgba(245,158,11,0.5)) !important;
                    }
                    body.vip-mode .bottom-nav .nav-item:not(.active):hover {
                        color: #d97706 !important;
                        background: rgba(245,158,11,0.1) !important;
                        transform: translateY(-2px) !important;
                    }
                `}</style>
            </div>
        </DashboardLayout>
    );
}
