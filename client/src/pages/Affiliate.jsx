import { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { formatCurrency } from '../utils/helpers.js';
import { getReferralTree } from '../services/referrals.js';
import { db, doc, onSnapshot, getDoc } from '../services/firebase-config.js';
import dataStore from '../utils/dataStore.js';

const TABS = [
    { key: 'all',    label: 'All' },
    { key: 'level1', label: 'Level 1' },
    { key: 'level2', label: 'Level 2' },
    { key: 'level3', label: 'Level 3' },
];

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
    const [activeTab, setActiveTab] = useState('all');
    const [loading, setLoading] = useState(true);

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
        const fetchCommissions = async () => {
            try {
                // Read raw base multipliers from settings/general
                const generalSnap = await getDoc(doc(db, 'settings', 'general'));
                const general = generalSnap.exists() ? generalSnap.data() : {};
                const l1Base = parseFloat(general.referralLevel1) || 3.6;
                const l2Base = parseFloat(general.referralLevel2) || 1.2;
                const l3Base = parseFloat(general.referralLevel3) || 0.4;

                // Fetch the exchange rate for the user's currency
                const userCurrency = userData?.currency || 'TZS';
                let rate = 2500;
                const ratesSnap = await getDoc(doc(db, 'settings', 'rates'));
                if (ratesSnap.exists()) {
                    const rates = ratesSnap.data();
                    if (rates[userCurrency] && rates[userCurrency] > 0) rate = rates[userCurrency];
                }

                // Convert to native amounts
                setBonuses({
                    level1: Math.round(l1Base * rate),
                    level2: Math.round(l2Base * rate),
                    level3: Math.round(l3Base * rate)
                });
            } catch (e) {
                console.error('Failed to load commission rates:', e);
            }
        };
        fetchCommissions();
    }, [userData?.currency]);

    const allReferrals = [
        ...tree.level1.map(r => ({ ...r, _level: 1 })),
        ...tree.level2.map(r => ({ ...r, _level: 2 })),
        ...tree.level3.map(r => ({ ...r, _level: 3 })),
    ];

    const referrals = activeTab === 'all' ? allReferrals : (tree[activeTab] || []);

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

    const tabCount = (key) => (key === 'all' ? allReferrals.length : (tree[key] || []).length);

    return (
        <DashboardLayout>
            <div className="dashboard-container">
                <div className="dashboard-content">
                    <h2 className="page-title" style={{ textAlign: 'center', marginBottom: 16 }}>
                        {translate('affiliate.title')}
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

                    {/* ── Bonus Levels ── */}
                    <div className="bonus-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, margin: '16px 0' }}>
                        {[1, 2, 3].map(level => (
                            <div key={level} className="stat-card" style={{ padding: '10px' }}>
                                <div className="amount" style={{ fontSize: 14 }}>{formatCurrency(bonuses[`level${level}`], currency)}</div>
                                <div className="label">Level {level}</div>
                            </div>
                        ))}
                    </div>

                    {/* ── Tabs ── */}
                    <div style={{
                        display: 'flex', gap: 6, marginBottom: 12, borderBottom: '1px solid var(--color-border)', overflowX: 'auto', paddingBottom: 6
                    }}>
                        {TABS.map(tab => {
                            const isActive = activeTab === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`btn ${isActive ? 'btn-primary' : 'btn-outline'}`}
                                    style={{
                                        padding: '8px 14px',
                                        fontSize: 12,
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    {tab.label}
                                    <span style={{
                                        background: isActive ? 'rgba(255,255,255,0.2)' : 'var(--color-border)',
                                        borderRadius: '99px', fontSize: 10, padding: '2px 6px', fontWeight: 700
                                    }}>
                                        {tabCount(tab.key)}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* ── Compact 3D List Layout ── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: 24, marginBottom: 8, animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</div>
                                <div style={{ fontSize: 12 }}>Loading network...</div>
                            </div>
                        ) : referrals.length === 0 ? (
                            <p className="empty-state">{translate('affiliate.noReferrals') || 'Network is Empty'}</p>
                        ) : (
                            referrals.map((r, i) => (
                                <div
                                    key={r.uid || i}
                                    className="earning-item compact-row"
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '10px 12px',
                                        animationDelay: `${i * 0.03}s`
                                    }}
                                >
                                    {/* Left: Avatar + Name + Level */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                                        <div style={{
                                            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                                            background: `linear-gradient(135deg, hsl(${(r.username || '').charCodeAt(0) * 17 % 360}, 65%, 55%), hsl(${(r.username || '').charCodeAt(0) * 23 % 360}, 65%, 45%))`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: '#fff', fontSize: 14, fontWeight: 700
                                        }}>
                                            {(r.username || r.fullName || '?').charAt(0).toUpperCase()}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>
                                                {r.username || r.fullName || 'User'}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                                                <span>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}</span>
                                                {activeTab === 'all' && (
                                                    <span style={{
                                                        background: ['', 'rgba(99,102,241,0.1)', 'rgba(168,85,247,0.1)', 'rgba(236,72,153,0.1)'][r._level || 1],
                                                        color: ['', '#6366f1', '#a855f7', '#ec4899'][r._level || 1],
                                                        padding: '1px 6px', borderRadius: 4, fontWeight: 600, fontSize: 10
                                                    }}>
                                                        L{r._level}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Status + Call */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 4,
                                            background: r.isActive ? 'rgba(34,197,94,0.1)' : 'rgba(249,115,22,0.1)',
                                            color: r.isActive ? 'var(--color-green)' : 'var(--color-orange)',
                                            borderRadius: 99, fontSize: 10, padding: '3px 8px', fontWeight: 600
                                        }}>
                                            {r.isActive ? 'Active' : 'Pending'}
                                        </span>
                                        
                                        {r.phone ? (
                                            <a href={`tel:+${r.phone}`} className="btn-call-compact" title={`Call ${r.username}`}>
                                                <PhoneIcon />
                                            </a>
                                        ) : (
                                            <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.1, color: 'var(--text-muted)' }}>
                                                <PhoneIcon />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <style>{`
                        @keyframes spin {
                            to { transform: rotate(360deg); }
                        }
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
                        .btn-call-compact:hover {
                            background: var(--color-green);
                            color: #fff;
                            transform: scale(1.1);
                        }
                        .btn-call-compact:active {
                            transform: scale(0.95);
                        }
                    `}</style>
                </div>
            </div>
        </DashboardLayout>
    );
}
