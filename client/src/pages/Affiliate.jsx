import { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { toLocalDisplay, formatCurrency } from '../utils/helpers.js';
import { getReferralTree } from '../services/referrals.js';
import { db, doc, onSnapshot } from '../services/firebase-config.js';
import dataStore from '../utils/dataStore.js';

const TABS = [
    { key: 'all',    label: 'All' },
    { key: 'level1', label: 'Level 1' },
    { key: 'level2', label: 'Level 2' },
    { key: 'level3', label: 'Level 3' },
];

function PhoneIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    const [bonuses, setBonuses] = useState({ level1: 2, level2: 1, level3: 0.5 });
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
        dataStore.getReferralSettings().then(s => {
            if (s) setBonuses({
                level1: s.level1 || s.level1Bonus || 2,
                level2: s.level2 || s.level2Bonus || 1,
                level3: s.level3 || s.level3Bonus || 0.5
            });
        });
    }, []);

    // Tagged referrals with their level for "All" tab
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
            showToast('✅ ' + (translate('common.copied') || 'Copied!'), 'success');
        } catch {
            showToast(translate('common.error'), 'error');
        }
    };

    const shareWa = () => window.open(`https://wa.me/?text=${encodeURIComponent('Join NEWHOPE-CHAT: ' + referralLink)}`, '_blank');
    const shareFb = () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`, '_blank');

    const tabCount = (key) => {
        if (key === 'all') return allReferrals.length;
        return (tree[key] || []).length;
    };

    return (
        <DashboardLayout>
            <div className="dashboard-container">
                <div className="dashboard-content">
                    <h2 className="page-title">{translate('affiliate.title')}</h2>

                    {/* ── Stats Row ── */}
                    <div className="dash-stats-grid" style={{ marginBottom: 16 }}>
                        {/* Active Count */}
                        <div className="stat-card" style={{ position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #22c55e, #16a34a)', borderRadius: '8px 8px 0 0' }} />
                            <div className="amount" style={{ color: 'var(--color-green, #22c55e)', fontSize: 28, fontWeight: 700 }}>
                                {loading ? '–' : activeCount}
                            </div>
                            <div className="label">Active</div>
                        </div>
                        {/* Inactive Count */}
                        <div className="stat-card" style={{ position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #f97316, #ea580c)', borderRadius: '8px 8px 0 0' }} />
                            <div className="amount" style={{ color: 'var(--color-orange, #f97316)', fontSize: 28, fontWeight: 700 }}>
                                {loading ? '–' : inactiveCount}
                            </div>
                            <div className="label">Pending / Inactive</div>
                        </div>
                        {/* Earnings */}
                        <div className="stat-card" style={{ position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', borderRadius: '8px 8px 0 0' }} />
                            <div className="amount" style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-primary, #6366f1)' }}>
                                {formatCurrency(userData?.totalReferralBonus || userData?.referralEarnings || 0, currency)}
                            </div>
                            <div className="label">{translate('affiliate.earnings') || 'Referral Earnings'}</div>
                        </div>
                    </div>

                    {/* ── Referral Link ── */}
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
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, margin: '16px 0' }}>
                        {[1, 2, 3].map(level => (
                            <div key={level} className="stat-card" style={{ textAlign: 'center' }}>
                                <div className="amount" style={{ fontSize: 16 }}>{toLocalDisplay(bonuses[`level${level}`], currency).formatted}</div>
                                <div className="label" style={{ fontSize: 11 }}>L{level} Bonus</div>
                            </div>
                        ))}
                    </div>

                    {/* ── Tabs ── */}
                    <div style={{ display: 'flex', gap: 0, marginBottom: 0, borderBottom: '2px solid var(--color-border, rgba(0,0,0,0.08))', overflowX: 'auto' }}>
                        {TABS.map(tab => {
                            const isActive = activeTab === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => setActiveTab(tab.key)}
                                    style={{
                                        padding: '10px 18px',
                                        border: 'none',
                                        borderBottom: isActive ? '2px solid var(--color-primary, #6366f1)' : '2px solid transparent',
                                        marginBottom: -2,
                                        background: 'transparent',
                                        color: isActive ? 'var(--color-primary, #6366f1)' : 'var(--text-muted, #888)',
                                        fontWeight: isActive ? 700 : 400,
                                        fontSize: 13,
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        transition: 'all 0.2s ease',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6
                                    }}
                                >
                                    {tab.label}
                                    <span style={{
                                        background: isActive ? 'var(--color-primary, #6366f1)' : 'var(--color-border, rgba(0,0,0,0.1))',
                                        color: isActive ? '#fff' : 'var(--text-muted, #888)',
                                        borderRadius: 99,
                                        fontSize: 10,
                                        padding: '1px 7px',
                                        fontWeight: 600,
                                        transition: 'all 0.2s ease'
                                    }}>
                                        {tabCount(tab.key)}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* ── Table ── */}
                    <div style={{ overflowX: 'auto', marginTop: 0 }}>
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: 24, marginBottom: 8, animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</div>
                                <div style={{ fontSize: 13 }}>Loading referrals…</div>
                            </div>
                        ) : referrals.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: 40, marginBottom: 12 }}>🤝</div>
                                <div style={{ fontWeight: 600, marginBottom: 4 }}>{translate('affiliate.noReferrals') || 'No referrals yet'}</div>
                                <div style={{ fontSize: 12 }}>Share your link to start earning!</div>
                            </div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--color-border, rgba(0,0,0,0.08))' }}>
                                        <th style={thStyle}>#</th>
                                        <th style={thStyle}>Username</th>
                                        <th style={thStyle}>Joined</th>
                                        {activeTab === 'all' && <th style={thStyle}>Level</th>}
                                        <th style={thStyle}>Status</th>
                                        <th style={{ ...thStyle, textAlign: 'center' }}>Call</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {referrals.map((r, i) => (
                                        <tr
                                            key={r.uid || i}
                                            style={{
                                                borderBottom: '1px solid var(--color-border, rgba(0,0,0,0.06))',
                                                transition: 'background 0.15s ease',
                                                animation: `fadeInRow 0.3s ease both`,
                                                animationDelay: `${i * 0.04}s`
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-hover, rgba(0,0,0,0.03))'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <td style={tdStyle}>{i + 1}</td>
                                            <td style={{ ...tdStyle, fontWeight: 600 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span style={{
                                                        width: 30, height: 30, borderRadius: '50%',
                                                        background: `hsl(${(r.username || '').charCodeAt(0) * 13 % 360}, 55%, 60%)`,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0
                                                    }}>
                                                        {(r.username || r.fullName || '?').charAt(0).toUpperCase()}
                                                    </span>
                                                    {r.username || r.fullName || 'User'}
                                                </div>
                                            </td>
                                            <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>
                                                {r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                            </td>
                                            {activeTab === 'all' && (
                                                <td style={tdStyle}>
                                                    <span style={{
                                                        background: ['', 'rgba(99,102,241,0.15)', 'rgba(168,85,247,0.15)', 'rgba(236,72,153,0.15)'][r._level || 1],
                                                        color: ['', '#6366f1', '#8b5cf6', '#ec4899'][r._level || 1],
                                                        borderRadius: 99, fontSize: 11, padding: '2px 8px', fontWeight: 600
                                                    }}>
                                                        L{r._level}
                                                    </span>
                                                </td>
                                            )}
                                            <td style={tdStyle}>
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                                    background: r.isActive ? 'rgba(34,197,94,0.12)' : 'rgba(249,115,22,0.12)',
                                                    color: r.isActive ? '#16a34a' : '#ea580c',
                                                    borderRadius: 99, fontSize: 11, padding: '3px 10px', fontWeight: 600
                                                }}>
                                                    <span style={{
                                                        width: 6, height: 6, borderRadius: '50%',
                                                        background: r.isActive ? '#22c55e' : '#f97316',
                                                        display: 'inline-block',
                                                        boxShadow: r.isActive ? '0 0 0 2px rgba(34,197,94,0.3)' : '0 0 0 2px rgba(249,115,22,0.3)'
                                                    }} />
                                                    {r.isActive ? 'Active' : 'Pending'}
                                                </span>
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                {r.phone ? (
                                                    <a
                                                        href={`tel:+${r.phone}`}
                                                        style={{
                                                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                            width: 32, height: 32, borderRadius: '50%',
                                                            background: 'rgba(34,197,94,0.12)', color: '#16a34a',
                                                            textDecoration: 'none', transition: 'all 0.2s ease'
                                                        }}
                                                        onMouseEnter={e => { e.currentTarget.style.background = '#22c55e'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.transform = 'scale(1.15)'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(34,197,94,0.12)'; e.currentTarget.style.color = '#16a34a'; e.currentTarget.style.transform = 'scale(1)'; }}
                                                        title={`Call ${r.username}`}
                                                    >
                                                        <PhoneIcon />
                                                    </a>
                                                ) : (
                                                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <style>{`
                        @keyframes fadeInRow {
                            from { opacity: 0; transform: translateY(6px); }
                            to   { opacity: 1; transform: translateY(0); }
                        }
                        @keyframes spin {
                            to { transform: rotate(360deg); }
                        }
                    `}</style>
                </div>
            </div>
        </DashboardLayout>
    );
}

const thStyle = {
    padding: '10px 12px',
    textAlign: 'left',
    fontWeight: 600,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--text-muted, #888)',
    whiteSpace: 'nowrap'
};

const tdStyle = {
    padding: '12px 12px',
    verticalAlign: 'middle'
};
