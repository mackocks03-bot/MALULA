import { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { formatCurrency, COUNTRIES, CURRENCY_SYMBOLS } from '../utils/helpers.js';
import { getReferralTree } from '../services/referrals.js';
import { db, doc, onSnapshot } from '../services/firebase-config.js';
import dataStore from '../utils/dataStore.js';

const TABS = [
    { key: 'level1', label: 'Level 1' },
    { key: 'level2', label: 'Level 2' },
    { key: 'level3', label: 'Level 3' },
];

const TEAM_ONE_GOAL = 41;

const VerifiedBadge = () => (
    <svg style={{ marginLeft: 6, flexShrink: 0 }} width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M10.5236 2.4593C11.3917 1.80806 12.6083 1.80806 13.4764 2.4593L15.1118 3.68593C15.4851 3.96594 15.9405 4.10398 16.4101 4.07609L18.4419 3.95543C19.524 3.89117 20.4709 4.67389 20.671 5.74868L21.0478 7.76106C21.1338 8.21989 21.3644 8.63661 21.7011 8.94821L23.1585 10.3065C23.9351 11.0264 23.9351 12.2479 23.1585 12.9678L21.7011 14.3262C21.3644 14.6378 21.1338 15.0545 21.0478 15.5133L20.671 17.5257C20.4709 18.6005 19.524 19.3832 18.4419 19.319L16.4101 19.1983C15.9405 19.1704 15.4851 19.3084 15.1118 19.5885L13.4764 20.8151C12.6083 21.4663 11.3917 21.4663 10.5236 20.8151L8.88819 19.5885C8.51486 19.3084 8.05947 19.1704 7.58992 19.1983L5.55811 19.319C4.47604 19.3832 3.5291 18.6005 3.32899 17.5257L2.95217 15.5133C2.86616 15.0545 2.63558 14.6378 2.29891 14.3262L0.841539 12.9678C0.0648873 12.2479 0.0648873 11.0264 0.841539 10.3065L2.29891 8.94821C2.63558 8.63661 2.86616 8.21989 2.95217 7.76106L3.32899 5.74868C3.5291 4.67389 4.47604 3.89117 5.55811 3.95543L7.58992 4.07609C8.05947 4.10398 8.51486 3.96594 8.88819 3.68593L10.5236 2.4593Z" fill="#3b82f6"/>
        <path fillRule="evenodd" clipRule="evenodd" d="M16.9458 9.53981C17.3995 9.06014 17.3781 8.30396 16.8984 7.8503C16.4188 7.39665 15.6626 7.41801 15.2089 7.89768L10.3702 13.0135L8.76118 11.4727C8.28318 11.015 7.52656 11.0315 7.06886 11.5095C6.61117 11.9875 6.62762 12.7441 7.10562 13.2018L9.56947 15.561C9.79973 15.7815 10.108 15.9015 10.4261 15.8953C10.7443 15.8891 11.0478 15.7573 11.2697 15.5227L16.9458 9.53981Z" fill="white"/>
    </svg>
);

function PhoneIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.59 3.4 2 2 0 0 1 3.56 1.23h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.72a16 16 0 0 0 6 6l.9-.9a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
        </svg>
    );
}

export default function Affiliate() {
    const { user, userData: initialData } = useAuth();
    const { translate } = useLanguage();
    const { showToast } = useToast();
    const [userData, setUserData] = useState(initialData);
    const [tree, setTree] = useState({ level1: [], level2: [], level3: [] });
    const [bonuses, setBonuses] = useState({ level1: 0, level2: 0, level3: 0 });
    const [activeTab, setActiveTab] = useState('level1');
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [limit, setLimit] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    const currency = userData?.currency || 'TZS';
    const referralLink = `${window.location.origin}/register?ref=${userData?.username || 'user'}`;

    useEffect(() => {
        if (!user) return;
        const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
            if (snap.exists()) setUserData(snap.data());
        });
        return () => unsub();
    }, [user]);

    useEffect(() => {
        if (!user) return;
        const loadTree = async () => {
            setLoading(true);
            const t = await getReferralTree(user.uid);
            setTree(t);
            setLoading(false);
        };
        loadTree();
        const unsub = onSnapshot(doc(db, 'users', user.uid), () => loadTree());
        return () => unsub();
    }, [user]);

    useEffect(() => {
        // Hardcoded commission matrix — mirrors functions/lib/referralCommissions.js exactly
        const COMMISSIONS = {
            TZS: { level1: 10000,  level2: 3500, level3: 1000 },
            KES: { level1: 500,   level2: 150,  level3: 50 },
            UGX: { level1: 13500, level2: 4500, level3: 1500 },
            MWK: { level1: 6300,  level2: 2100, level3: 700 },
            RWF: { level1: 5000,  level2: 1500, level3: 500 },
            ZMW: { level1: 80,    level2: 30,   level3: 10 },
            BIF: { level1: 9000,  level2: 4000, level3: 1500 },
            CDF: { level1: 10000, level2: 3500, level3: 1000 },
            MZN: { level1: 250,   level2: 80,   level3: 25 },
        };
        const userCurrency = userData?.currency || 'TZS';
        setBonuses(COMMISSIONS[userCurrency] || COMMISSIONS.TZS);
    }, [userData?.currency]);

    const allReferrals = [
        ...tree.level1.map(r => ({ ...r, _level: 1 })),
        ...tree.level2.map(r => ({ ...r, _level: 2 })),
        ...tree.level3.map(r => ({ ...r, _level: 3 })),
    ];

    const referrals = allReferrals.filter(r => `level${r._level}` === activeTab);

    const filteredReferrals = referrals.filter(r => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        const username = (r.username || r.fullName || 'User').toLowerCase();
        return username.includes(q);
    });

    const totalPages = Math.ceil(filteredReferrals.length / limit) || 1;
    const paginatedReferrals = filteredReferrals.slice((currentPage - 1) * limit, currentPage * limit);

    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, searchQuery, limit]);

    const directCount = tree.level1.filter(r => r.isActive).length;
    const directProgress = Math.min((directCount / TEAM_ONE_GOAL) * 100, 100);

    const activeCount = allReferrals.filter(r => r.isActive).length;
    const inactiveCount = allReferrals.filter(r => !r.isActive).length;

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(referralLink);
            showToast('✅ Copied!', 'success');
        } catch {
            showToast('Error', 'error');
        }
    };

    const shareWa = () => window.open(`https://wa.me/?text=${encodeURIComponent('Join NEWHOPE-CHAT: ' + referralLink)}`, '_blank');
    const shareFb = () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`, '_blank');

    const tabCount = (key) => (tree[key] || []).length;

    return (
        <DashboardLayout>
            <div className="dashboard-container">
                <div className="dashboard-content">
                    <h2 className="page-title" style={{ textAlign: 'center', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {translate('affiliate.title')}
                        {directCount >= TEAM_ONE_GOAL && <VerifiedBadge />}
                    </h2>

                    {/* ── Giant Earnings Card Top & Centered ── */}
                    <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1))',
                        border: '1px solid var(--color-border)',
                        borderRadius: 12, padding: '20px 16px', marginBottom: 16,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                    }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, fontWeight: 600 }}>
                            Total Referral Earnings
                        </div>
                        <div style={{ color: 'var(--color-primary)', fontSize: 26, fontWeight: 800 }}>
                            {formatCurrency(userData?.totalReferralBonus || userData?.referralEarnings || 0, currency)}
                        </div>
                    </div>

                    {/* ── Active / Inactive Counts ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
                        <div className="stat-card" style={{ padding: '12px', textAlign: 'center' }}>
                            <div className="amount" style={{ color: 'var(--color-green)' }}>
                                {loading ? '–' : activeCount}
                            </div>
                            <div className="label">Active Users</div>
                        </div>

                        <div className="stat-card" style={{ padding: '12px', textAlign: 'center' }}>
                            <div className="amount" style={{ color: 'var(--color-orange)' }}>
                                {loading ? '–' : inactiveCount}
                            </div>
                            <div className="label">Inactive Users</div>
                        </div>
                    </div>

                    {/* ── Referral Link Box ── */}
                    <div className="referral-section">
                        <div className="referral-link-box">
                            <span className="link">{referralLink}</span>
                            <button type="button" className="copy-btn" onClick={copyLink}>{translate('common.copy')}</button>
                        </div>
                        <div className="share-buttons">
                            <button type="button" className="share-btn whatsapp share-wa" onClick={shareWa}>WhatsApp</button>
                            <button type="button" className="share-btn facebook share-fb" onClick={shareFb}>Facebook</button>
                        </div>
                    </div>

                    {/* ── Team One Progress Bar ── */}
                    <div className="t1-card" style={{ margin: '16px 0 8px' }}>
                        {/* Header row */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div className="t1-icon-wrap">
                                    <span style={{ fontSize: 18 }}>🎯</span>
                                </div>
                                <div>
                                    <div style={{ color: '#2b3674', fontSize: 13, fontWeight: 800, letterSpacing: 0.2 }}>Team One Goal</div>
                                    <div style={{ color: '#8f9bba', fontSize: 11, marginTop: 1 }}>Direct referrals · Level 1</div>
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div className="t1-count">
                                    <span className="t1-count-num">{loading ? '–' : directCount}</span>
                                    <span style={{ color: '#8f9bba', fontSize: 13, fontWeight: 500 }}>/{TEAM_ONE_GOAL}</span>
                                </div>
                                <div style={{ fontSize: 10, marginTop: 2 }}>
                                    {!loading && (
                                        directCount >= TEAM_ONE_GOAL
                                            ? <span style={{ color: '#22c55e', fontWeight: 700 }}>✅ Achieved!</span>
                                            : <span style={{ color: '#8f9bba' }}>{TEAM_ONE_GOAL - directCount} remaining</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Progress bar + pulse tip */}
                        <div style={{ position: 'relative', marginBottom: 8 }}>
                            <div className="t1-track">
                                <div className="t1-fill" style={{ width: loading ? '0%' : `${directProgress}%` }}>
                                    {!loading && directProgress > 2 && directProgress < 100 && (
                                        <div className="t1-tip-pulse" />
                                    )}
                                </div>
                            </div>
                            {[25, 50, 75, 100].map(pct => {
                                const reached = directProgress >= pct;
                                return (
                                    <div key={pct} className={`t1-milestone ${reached ? 't1-milestone--reached' : ''}`}
                                        style={{ left: `${pct}%` }} />
                                );
                            })}
                        </div>

                        {/* Footer labels */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#8f9bba', fontSize: 10 }}>0</span>
                            <div className="t1-pct-badge">
                                {loading ? '…' : `${Math.round(directProgress)}% complete`}
                            </div>
                            <span style={{ color: '#8f9bba', fontSize: 10 }}>{TEAM_ONE_GOAL}</span>
                        </div>
                    </div>

                    {/* ── Bonus Levels ── */}
                    <div className="bonus-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, margin: '8px 0 16px' }}>
                        {[1, 2, 3].map(level => (
                            <div key={level} className="stat-card" style={{ padding: '10px' }}>
                                <div className="amount" style={{ fontSize: 14 }}>{formatCurrency(bonuses[`level${level}`], currency)}</div>
                                <div className="label">Level {level}</div>
                            </div>
                        ))}
                    </div>

                    {/* ── Tabs ── */}
                    <div className="lvl-tab-tray">
                        {TABS.map(tab => {
                            const isActive = activeTab === tab.key;
                            const lvNum = parseInt(tab.key.replace('level', ''));
                            const lvColors = ['', '#4318ff', '#7551ff', '#868cff'];
                            return (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`lvl-tab-btn ${isActive ? 'lvl-tab-btn--active' : ''}`}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span className={`lvl-tab-dot ${isActive ? 'lvl-tab-dot--active' : ''}`}
                                            style={{ background: isActive ? '#fff' : lvColors[lvNum] }} />
                                        <span className="lvl-tab-label">{tab.label}</span>
                                        <span className={`lvl-tab-badge ${isActive ? 'lvl-tab-badge--active' : ''}`}>
                                            {tabCount(tab.key)}
                                        </span>
                                    </div>
                                    <div className="lvl-tab-commission">
                                        +{formatCurrency(bonuses[tab.key], currency)}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* ── Search Bar Toggle ── */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                        {!isSearchOpen && !searchQuery ? (
                            <button
                                type="button"
                                onClick={() => setIsSearchOpen(true)}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    width: 44, height: 44, borderRadius: '50%',
                                    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                                    color: '#4318ff', cursor: 'pointer',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                                    transition: 'all 0.2s', flexShrink: 0
                                }}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                </svg>
                            </button>
                        ) : (
                            <div style={{ position: 'relative', width: '100%', animation: 'searchFadeIn 0.2s ease-out' }}>
                                <div style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#4318ff', pointerEvents: 'none', display: 'flex' }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="11" cy="11" r="8"></circle>
                                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                    </svg>
                                </div>
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder={translate('affiliate.search') || "Search by username..."}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '12px 42px 12px 44px',
                                        borderRadius: 12,
                                        border: '2px solid #4318ff',
                                        background: 'var(--color-surface)',
                                        color: 'var(--text-primary)',
                                        outline: 'none',
                                        fontSize: 14,
                                        fontWeight: 500,
                                        boxShadow: '0 0 0 4px rgba(67,24,255,0.15)',
                                        transition: 'all 0.25s ease'
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsSearchOpen(false);
                                        setSearchQuery('');
                                    }}
                                    style={{
                                        position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                                        background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: '50%',
                                        width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s'
                                    }}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* ── Compact 3D List Layout ── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: 24, marginBottom: 8, animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</div>
                                <div style={{ fontSize: 12 }}>Loading network...</div>
                            </div>
                        ) : filteredReferrals.length === 0 ? (
                            <p className="empty-state">{searchQuery ? 'No matching referrals found.' : (translate('affiliate.noReferrals') || 'Network is Empty')}</p>
                        ) : (
                            paginatedReferrals.map((r, i) => {
                                const rCountryCode = (r.country || r.countryCode || 'TZ').toLowerCase();

                                // Commission is always earned in the REFERRER'S (logged-in user's) currency
                                const mySymbol = CURRENCY_SYMBOLS[currency] || currency;
                                const COMMISSION_MATRIX = {
                                    TZS: [10000, 3500, 1000], KES: [500, 150, 50],
                                    UGX: [13500, 4500, 1500], MWK: [6300, 2100, 700],
                                    RWF: [5000, 1500, 500], ZMW: [80, 30, 10],
                                    BIF: [9000, 4000, 1500], CDF: [10000, 3500, 1000], MZN: [250, 80, 25],
                                };
                                const levelIndex = (r._level || 1) - 1;
                                const commissions = COMMISSION_MATRIX[currency] || COMMISSION_MATRIX.TZS;
                                const rCommission = commissions[levelIndex] ?? commissions[0];

                                return (
                                    <div
                                        key={r.uid || i}
                                        className="earning-item compact-row"
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: '10px 12px',
                                            animationDelay: `${i * 0.03}s`
                                        }}
                                    >
                                        {/* Left: Flag + Name + Level */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                                            {/* Country flag circle avatar */}
                                            <div style={{
                                                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                                                overflow: 'hidden',
                                                border: '2px solid var(--color-border)',
                                                boxShadow: '0 1px 4px rgba(0,0,0,0.1)'
                                            }}>
                                                <img
                                                    src={`https://flagcdn.com/w80/${rCountryCode}.png`}
                                                    alt={r.countryName || rCountryCode}
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                    onError={e => {
                                                        e.target.style.display = 'none';
                                                        e.target.parentNode.textContent = (r.username || '?').charAt(0).toUpperCase();
                                                    }}
                                                />
                                            </div>

                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {r.username || r.fullName || 'User'}
                                                    </span>
                                                    <span style={{
                                                        background: ['', 'rgba(99,102,241,0.12)', 'rgba(168,85,247,0.12)', 'rgba(236,72,153,0.12)'][r._level || 1],
                                                        color: ['', '#6366f1', '#a855f7', '#ec4899'][r._level || 1],
                                                        padding: '1px 5px', borderRadius: 4, fontWeight: 700, fontSize: 10,
                                                        flexShrink: 0
                                                    }}>
                                                        L{r._level}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                                    <img
                                                        src={`https://flagcdn.com/w40/${rCountryCode}.png`}
                                                        alt={rCountryCode}
                                                        style={{ width: 14, height: 10, objectFit: 'cover', borderRadius: 1 }}
                                                    />
                                                    <span>{r.countryName || rCountryCode.toUpperCase()}</span>
                                                    <span style={{
                                                        background: 'rgba(212,175,55,0.1)',
                                                        color: 'var(--color-gold)',
                                                        padding: '0 5px', borderRadius: 4, fontWeight: 600
                                                    }}>
                                                        +{mySymbol} {Number(rCommission).toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right: Status + Call */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                                background: r.isActive ? 'rgba(34,197,94,0.1)' : 'rgba(249,115,22,0.1)',
                                                color: r.isActive ? 'var(--color-green)' : 'var(--color-orange)',
                                                borderRadius: 99, fontSize: 10, padding: '3px 8px', fontWeight: 600
                                            }}>
                                                {r.isActive ? 'Active' : 'Inactive'}
                                            </span>

                                            {r.phone ? (
                                                <a href={`tel:+${r.phone}`} className="btn-call-compact" title={`Call ${r.username}`}>
                                                    <PhoneIcon />
                                                </a>
                                            ) : (
                                                <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.15, color: 'var(--text-muted)' }}>
                                                    <PhoneIcon />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* ── Pagination Controls ── */}
                    {!loading && filteredReferrals.length > 0 && (
                        <div style={{ marginTop: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    style={{
                                        padding: '6px 12px', borderRadius: 8, border: 'none',
                                        background: currentPage === 1 ? 'rgba(0,0,0,0.05)' : 'rgba(67,24,255,0.1)',
                                        color: currentPage === 1 ? 'var(--text-muted)' : '#4318ff',
                                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                        fontWeight: 600, fontSize: 12,
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    Previous
                                </button>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                                    Page {currentPage} of {totalPages}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    style={{
                                        padding: '6px 12px', borderRadius: 8, border: 'none',
                                        background: currentPage === totalPages ? 'rgba(0,0,0,0.05)' : 'rgba(67,24,255,0.1)',
                                        color: currentPage === totalPages ? 'var(--text-muted)' : '#4318ff',
                                        cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                                        fontWeight: 600, fontSize: 12,
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    Next
                                </button>
                            </div>
                            
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 4 }}>Per page:</span>
                                {[10, 30, 50, 100].map(val => (
                                    <button
                                        key={val}
                                        type="button"
                                        onClick={() => setLimit(val)}
                                        style={{
                                            padding: '4px 10px', borderRadius: 6, border: 'none',
                                            background: limit === val ? 'linear-gradient(135deg, #4318ff, #7551ff)' : 'rgba(0,0,0,0.05)',
                                            color: limit === val ? '#fff' : 'var(--text-secondary)',
                                            cursor: 'pointer', fontWeight: 700, fontSize: 11,
                                            boxShadow: limit === val ? '0 2px 6px rgba(67,24,255,0.2)' : 'none',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {val}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <style>{`
                        @keyframes spin { to { transform: rotate(360deg); } }
                        @keyframes searchFadeIn { from { opacity: 0; transform: scaleX(0.85); transform-origin: right; } to { opacity: 1; transform: scaleX(1); transform-origin: right; } }

                        /* ══ Team One Card ══ */
                        @keyframes t1Grow { from { width: 0% !important; } }
                        @keyframes t1Shimmer {
                            0%   { background-position: 0% 50%; }
                            50%  { background-position: 100% 50%; }
                            100% { background-position: 0% 50%; }
                        }
                        @keyframes t1Pulse {
                            0%, 100% { transform: scale(1); opacity: 0.9; box-shadow: 0 0 0 0 rgba(236,72,153,0.7); }
                            50%       { transform: scale(1.25); opacity: 1; box-shadow: 0 0 0 6px rgba(236,72,153,0); }
                        }
                        @keyframes t1FadeIn {
                            from { opacity: 0; transform: translateY(6px); }
                            to   { opacity: 1; transform: translateY(0); }
                        }
                        .t1-card {
                            background: rgba(255,255,255,0.75);
                            backdrop-filter: blur(20px);
                            border: 1px solid rgba(255,255,255,0.9);
                            border-radius: 16px;
                            padding: 14px 16px;
                            box-shadow: 0 8px 32px rgba(112,144,176,0.13);
                            animation: t1FadeIn 0.5s ease both;
                        }
                        .t1-icon-wrap {
                            width: 34px; height: 34px; border-radius: 10px;
                            display: flex; align-items: center; justify-content: center;
                            background: linear-gradient(135deg, rgba(67,24,255,0.1), rgba(134,140,255,0.15));
                            border: 1px solid rgba(67,24,255,0.12);
                            flex-shrink: 0;
                        }
                        .t1-count { display: flex; align-items: baseline; gap: 1px; }
                        .t1-count-num {
                            font-size: 22px; font-weight: 900; letter-spacing: -0.5px;
                            background: linear-gradient(135deg, #4318ff, #868cff);
                            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                            background-clip: text;
                        }
                        .t1-track {
                            width: 100%; height: 8px;
                            background: rgba(67,24,255,0.08);
                            border-radius: 99px;
                            overflow: visible;
                            position: relative;
                            border: 1px solid rgba(67,24,255,0.06);
                        }
                        .t1-fill {
                            height: 100%; border-radius: 99px;
                            background: linear-gradient(90deg, #4318ff, #7551ff, #868cff);
                            background-size: 200% 100%;
                            animation:
                                t1Grow 1.4s cubic-bezier(0.34,1.56,0.64,1) both,
                                t1Shimmer 4s ease infinite 1.4s;
                            transition: width 1s cubic-bezier(0.34,1.56,0.64,1);
                            box-shadow: 0 0 8px rgba(67,24,255,0.3), 0 0 20px rgba(134,140,255,0.2);
                            position: relative;
                        }
                        .t1-tip-pulse {
                            position: absolute; right: -4px; top: 50%;
                            transform: translateY(-50%);
                            width: 12px; height: 12px; border-radius: 50%;
                            background: radial-gradient(circle, #fff 30%, #868cff 70%);
                            box-shadow: 0 0 6px #4318ff, 0 0 12px rgba(134,140,255,0.5);
                            animation: t1Pulse 1.4s ease-in-out infinite;
                        }
                        .t1-milestone {
                            position: absolute; top: 50%;
                            transform: translate(-50%, -50%);
                            width: 5px; height: 5px; border-radius: 50%;
                            background: rgba(67,24,255,0.15);
                            border: 1px solid rgba(67,24,255,0.2);
                            z-index: 2;
                            transition: background 0.5s, box-shadow 0.5s;
                        }
                        .t1-milestone--reached {
                            background: #4318ff;
                            box-shadow: 0 0 5px rgba(67,24,255,0.5);
                        }
                        .t1-pct-badge {
                            background: linear-gradient(90deg, rgba(67,24,255,0.08), rgba(134,140,255,0.1));
                            border: 1px solid rgba(67,24,255,0.15);
                            border-radius: 99px; padding: 2px 10px;
                            font-size: 10px; font-weight: 700;
                            color: #4318ff;
                            letter-spacing: 0.3px;
                        }

                        /* ══ Referral rows ══ */
                        .compact-row {
                            background: var(--color-surface);
                            border: 1px solid var(--color-border);
                            border-radius: 10px;
                            transition: transform 0.2s, box-shadow 0.2s;
                        }
                        .compact-row:hover {
                            transform: translateY(-1px);
                            box-shadow: 0 4px 10px rgba(0,0,0,0.06);
                        }
                        .btn-call-compact {
                            display: inline-flex; align-items: center; justify-content: center;
                            width: 28px; height: 28px; border-radius: 50%;
                            background: rgba(34,197,94,0.15);
                            color: var(--color-green); text-decoration: none;
                            transition: all 0.2s;
                        }
                        .btn-call-compact:hover { background: var(--color-green); color: #fff; transform: scale(1.1); }
                        .btn-call-compact:active { transform: scale(0.95); }

                        /* ══ Level Tab Switcher ══ */
                        @keyframes tabSlideIn {
                            from { opacity: 0; transform: scale(0.95); }
                            to   { opacity: 1; transform: scale(1); }
                        }
                        .lvl-tab-tray {
                            display: grid;
                            grid-template-columns: repeat(3, 1fr);
                            gap: 6px;
                            margin-bottom: 14px;
                            background: rgba(255,255,255,0.55);
                            backdrop-filter: blur(12px);
                            border: 1px solid rgba(255,255,255,0.85);
                            border-radius: 14px;
                            padding: 5px;
                            box-shadow: 0 4px 16px rgba(112,144,176,0.1);
                        }
                        .lvl-tab-btn {
                            display: flex; flex-direction: column; align-items: center; justify-content: center;
                            gap: 2px;
                            padding: 10px 8px;
                            border: none; cursor: pointer;
                            border-radius: 10px;
                            background: transparent;
                            transition: background 0.25s, box-shadow 0.25s, transform 0.15s;
                        }
                        .lvl-tab-btn:hover:not(.lvl-tab-btn--active) {
                            background: rgba(67,24,255,0.05);
                            transform: translateY(-1px);
                        }
                        .lvl-tab-btn--active {
                            background: linear-gradient(135deg, #4318ff, #7551ff);
                            box-shadow: 0 4px 14px rgba(67,24,255,0.28);
                            animation: tabSlideIn 0.25s ease both;
                        }
                        .lvl-tab-dot {
                            width: 6px; height: 6px; border-radius: 50%;
                            flex-shrink: 0;
                            transition: background 0.25s, transform 0.2s;
                        }
                        .lvl-tab-dot--active { transform: scale(1.2); }
                        .lvl-tab-label {
                            font-size: 12px; font-weight: 700;
                            color: #2b3674;
                            transition: color 0.25s;
                        }
                        .lvl-tab-btn--active .lvl-tab-label { color: #fff; }
                        .lvl-tab-badge {
                            background: rgba(67,24,255,0.1);
                            color: #4318ff;
                            border-radius: 99px; padding: 1px 6px;
                            font-size: 10px; font-weight: 800;
                            transition: background 0.25s, color 0.25s;
                        }
                        .lvl-tab-badge--active {
                            background: rgba(255,255,255,0.25);
                            color: #fff;
                        }
                        .lvl-tab-commission {
                            font-size: 10px; font-weight: 600;
                            color: #8f9bba;
                            transition: color 0.25s;
                            white-space: nowrap;
                        }
                        .lvl-tab-btn--active .lvl-tab-commission { color: rgba(255,255,255,0.7); }
                    `}</style>
                </div>
            </div>
        </DashboardLayout>
    );
}
