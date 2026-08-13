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
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

    const shareWa = () => window.open(`https://wa.me/?text=${encodeURIComponent('🔥 Join NOW: ' + referralLink)}`, '_blank');
    const shareFb = () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`, '_blank');

    const tabCount = (key) => (key === 'all' ? allReferrals.length : (tree[key] || []).length);

    return (
        <DashboardLayout>
            <div className="dashboard-container" style={{ paddingBottom: 60 }}>
                <div className="dashboard-content">
                    <h2 className="page-title" style={{ textAlign: 'center', marginBottom: 24, fontSize: 24, color: '#ffffff', textShadow: '0 2px 10px rgba(255,255,255,0.2)' }}>
                        {translate('affiliate.title')}
                    </h2>

                    {/* ── 💎 Giant Earnings Card Top & Centered ── */}
                    <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 24, padding: '32px 16px', marginBottom: 24,
                        boxShadow: '0 10px 40px -10px rgba(99,102,241,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
                        backdropFilter: 'blur(10px)',
                        animation: 'floating 6s ease-in-out infinite'
                    }}>
                        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8, fontWeight: 600 }}>
                            Total Referral Earnings
                        </div>
                        <div style={{ color: '#ffffff', fontSize: 44, fontWeight: 900, textShadow: '0 4px 20px rgba(99,102,241,0.5)', display: 'flex', alignItems: 'baseline', gap: 6 }}>
                            {formatCurrency(userData?.totalReferralBonus || userData?.referralEarnings || 0, currency)}
                        </div>
                    </div>

                    {/* ── Active / Inactive Counts ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 24 }}>
                        <div style={{
                            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 16, padding: '16px', textAlign: 'center',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                        }}>
                            <div style={{ fontSize: 32, fontWeight: 800, color: '#fff', textShadow: '0 2px 10px rgba(34,197,94,0.4)', marginBottom: 4 }}>
                                {loading ? '–' : activeCount}
                            </div>
                            <div style={{ color: '#22c55e', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Active Users</div>
                        </div>

                        <div style={{
                            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: 16, padding: '16px', textAlign: 'center',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                        }}>
                            <div style={{ fontSize: 32, fontWeight: 800, color: '#fff', textShadow: '0 2px 10px rgba(249,115,22,0.4)', marginBottom: 4 }}>
                                {loading ? '–' : inactiveCount}
                            </div>
                            <div style={{ color: '#f97316', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Inactive Users</div>
                        </div>
                    </div>

                    {/* ── Referral Link Box ── */}
                    <div className="referral-section" style={{
                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '20px', marginBottom: 24,
                        boxShadow: '0 4px 24px rgba(0,0,0,0.15)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, padding: 4, marginBottom: 16 }}>
                            <span style={{ flex: 1, padding: '0 12px', color: '#fff', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0.9 }}>
                                {referralLink}
                            </span>
                            <button type="button" onClick={copyLink} style={{
                                background: 'linear-gradient(90deg, var(--color-primary), #8b5cf6)', border: 'none', color: '#fff',
                                padding: '10px 20px', borderRadius: 8, fontWeight: 600, cursor: 'pointer', transition: 'transform 0.2s, filter 0.2s',
                                boxShadow: '0 4px 12px rgba(99,102,241,0.3)'
                            }} onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'} onMouseLeave={e => e.currentTarget.style.filter = 'none'}>
                                Copy
                            </button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <button type="button" onClick={shareWa} style={{ background: 'rgba(37,211,102,0.1)', color: '#25D366', border: '1px solid rgba(37,211,102,0.3)', padding: 12, borderRadius: 10, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
                                WhatsApp
                            </button>
                            <button type="button" onClick={shareFb} style={{ background: 'rgba(24,119,242,0.1)', color: '#1877F2', border: '1px solid rgba(24,119,242,0.3)', padding: 12, borderRadius: 10, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                                Facebook
                            </button>
                        </div>
                    </div>

                    {/* ── Bonus Guidelines ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
                        {[1, 2, 3].map(level => (
                            <div key={level} style={{
                                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '12px 4px', textAlign: 'center',
                                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)'
                            }}>
                                <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', textShadow: '0 0 8px rgba(255,255,255,0.4)', marginBottom: 2 }}>
                                    {toLocalDisplay(bonuses[`level${level}`], currency).formatted}
                                </div>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>L{level} Prize</div>
                            </div>
                        ))}
                    </div>

                    {/* ── Tabs ── */}
                    <div style={{
                        display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.1)', overflowX: 'auto', paddingBottom: 4
                    }}>
                        {TABS.map(tab => {
                            const isActive = activeTab === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => setActiveTab(tab.key)}
                                    style={{
                                        padding: '12px 20px',
                                        border: 'none',
                                        background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                                        borderRadius: '8px',
                                        color: isActive ? '#fff' : 'rgba(255,255,255,0.5)',
                                        fontWeight: isActive ? 700 : 500,
                                        fontSize: 14,
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.1)' : 'none',
                                        transform: isActive ? 'translateY(-2px)' : 'none'
                                    }}
                                >
                                    {tab.label}
                                    <span style={{
                                        background: isActive ? '#fff' : 'rgba(255,255,255,0.1)',
                                        color: isActive ? '#000' : 'rgba(255,255,255,0.5)',
                                        borderRadius: '99px',
                                        fontSize: 11,
                                        padding: '2px 8px',
                                        fontWeight: 800,
                                        boxShadow: isActive ? '0 2px 6px rgba(0,0,0,0.2)' : 'none'
                                    }}>
                                        {tabCount(tab.key)}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* ── 💎 Super Premium List Layout ── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.5)' }}>
                                <div style={{ fontSize: 32, marginBottom: 12, animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</div>
                                <div style={{ fontSize: 14, fontWeight: 500, letterSpacing: 1 }}>LOADING NETWORK...</div>
                            </div>
                        ) : referrals.length === 0 ? (
                            <div style={{
                                textAlign: 'center', padding: '60px 20px', background: 'rgba(255,255,255,0.02)',
                                border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 20
                            }}>
                                <div style={{ fontSize: 48, marginBottom: 16 }}>🚀</div>
                                <div style={{ fontWeight: 800, color: '#fff', fontSize: 18, marginBottom: 8 }}>{translate('affiliate.noReferrals') || 'Network is Empty'}</div>
                                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>Share your link and start scaling your team!</div>
                            </div>
                        ) : (
                            referrals.map((r, i) => (
                                <div
                                    key={r.uid || i}
                                    className="referral-row"
                                    style={{
                                        position: 'relative',
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid rgba(255,255,255,0.06)',
                                        borderRadius: 16,
                                        padding: '16px',
                                        animation: `slideUpFade 0.4s cubic-bezier(0.4, 0, 0.2, 1) both`,
                                        animationDelay: `${i * 0.05}s`,
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                                    }}
                                >
                                    {/* Left: Avatar + Name + Level */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1 }}>
                                        <div style={{
                                            width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                                            background: `linear-gradient(135deg, hsl(${(r.username || '').charCodeAt(0) * 17 % 360}, 70%, 65%), hsl(${(r.username || '').charCodeAt(0) * 23 % 360}, 80%, 55%))`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: '#fff', fontSize: 18, fontWeight: 800,
                                            boxShadow: '0 4px 10px rgba(0,0,0,0.2), inset 0 2px 4px rgba(255,255,255,0.3)'
                                        }}>
                                            {(r.username || r.fullName || '?').charAt(0).toUpperCase()}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ color: '#fff', fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 2 }}>
                                                {r.username || r.fullName || 'User'}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                                                <span>{r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-GB') : 'Just joined'}</span>
                                                {activeTab === 'all' && (
                                                    <span style={{
                                                        background: ['', 'rgba(99,102,241,0.2)', 'rgba(168,85,247,0.2)', 'rgba(236,72,153,0.2)'][r._level || 1],
                                                        color: ['', '#818cf8', '#a78bfa', '#f472b6'][r._level || 1],
                                                        padding: '2px 6px', borderRadius: 6, fontWeight: 700, fontSize: 10
                                                    }}>
                                                        Level {r._level}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Status + Call */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 6,
                                            background: r.isActive ? 'rgba(34,197,94,0.1)' : 'rgba(249,115,22,0.1)',
                                            color: r.isActive ? '#4ade80' : '#fb923c',
                                            border: `1px solid ${r.isActive ? 'rgba(34,197,94,0.3)' : 'rgba(249,115,22,0.3)'}`,
                                            borderRadius: 99, fontSize: 11, padding: '4px 12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1
                                        }}>
                                            <span style={{
                                                width: 6, height: 6, borderRadius: '50%',
                                                background: r.isActive ? '#4ade80' : '#fb923c',
                                                display: 'inline-block',
                                                boxShadow: r.isActive ? '0 0 8px #4ade80' : '0 0 8px #fb923c',
                                                animation: r.isActive ? 'none' : 'pulsePoint 2s infinite'
                                            }} />
                                            {r.isActive ? 'Active' : 'Pending'}
                                        </span>
                                        
                                        {r.phone ? (
                                            <a
                                                href={`tel:+${r.phone}`}
                                                className="btn-call-3d"
                                                title={`Call ${r.username}`}
                                            >
                                                <PhoneIcon />
                                            </a>
                                        ) : (
                                            <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.2 }}>
                                                <PhoneIcon />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <style>{`
                        @keyframes slideUpFade {
                            from { opacity: 0; transform: translateY(12px) scale(0.98); }
                            to   { opacity: 1; transform: translateY(0) scale(1); }
                        }
                        @keyframes spin {
                            to { transform: rotate(360deg); }
                        }
                        @keyframes floating {
                            0% { transform: translateY(0px); }
                            50% { transform: translateY(-8px); }
                            100% { transform: translateY(0px); }
                        }
                        @keyframes pulsePoint {
                            0%, 100% { opacity: 1; transform: scale(1); }
                            50% { opacity: 0.5; transform: scale(1.5); }
                        }
                        .referral-row:hover {
                            background: rgba(255,255,255,0.06) !important;
                            border-color: rgba(255,255,255,0.15) !important;
                            transform: translateY(-2px) scale(1.01) !important;
                            box-shadow: 0 10px 24px -10px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1) !important;
                        }
                        .btn-call-3d {
                            display: inline-flex; align-items: center; justify-content: center;
                            width: 40px; height: 40px; border-radius: 50%;
                            background: linear-gradient(135deg, #22c55e, #16a34a);
                            color: #fff; text-decoration: none;
                            box-shadow: 0 4px 12px rgba(34,197,94,0.4), inset 0 2px 4px rgba(255,255,255,0.4);
                            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                        }
                        .btn-call-3d:hover {
                            transform: scale(1.1) translateY(-2px);
                            box-shadow: 0 8px 16px rgba(34,197,94,0.5), inset 0 2px 4px rgba(255,255,255,0.6);
                        }
                        .btn-call-3d:active {
                            transform: scale(0.95);
                            box-shadow: 0 2px 6px rgba(34,197,94,0.3);
                        }
                    `}</style>
                </div>
            </div>
        </DashboardLayout>
    );
}
