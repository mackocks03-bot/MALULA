import { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { toLocalDisplay, formatCurrency } from '../utils/helpers.js';
import { getReferralTree } from '../services/referrals.js';
import { db, doc, collection, query, where, onSnapshot } from '../services/firebase-config.js';
import dataStore from '../utils/dataStore.js';

export default function Affiliate() {
    const { user, userData: initialData } = useAuth();
    const { translate } = useLanguage();
    const { showToast } = useToast();
    const [userData, setUserData] = useState(initialData);
    const [tree, setTree] = useState({ level1: [], level2: [], level3: [] });
    const [bonuses, setBonuses] = useState({ level1: 2, level2: 1, level3: 0.5 });
    const [activeTab, setActiveTab] = useState('1');

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
            const t = await getReferralTree(user.uid);
            setTree(t);
        };
        loadTree();
        // Listen to the user document for changes in the embedded referrals arrays
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

    const referrals = tree[`level${activeTab}`] || [];

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

    return (
        <DashboardLayout>
            <div className="dashboard-container">
                <div className="dashboard-content">
                    <h2 className="page-title">{translate('affiliate.title')}</h2>

                    <div className="dash-stats-grid">
                        <div className="stat-card">
                            <div className="amount">{userData?.referralCount || 0}</div>
                            <div className="label">{translate('dashboard.referrals')}</div>
                        </div>
                        <div className="stat-card">
                            <div className="amount">{formatCurrency(userData?.totalReferralBonus || userData?.referralEarnings || 0, currency)}</div>
                            <div className="label">{translate('affiliate.earnings') || 'Referral Earnings'}</div>
                        </div>
                    </div>

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

                    <div className="bonus-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, margin: '16px 0' }}>
                        {[1, 2, 3].map(level => (
                            <div key={level} className="stat-card">
                                <div className="amount">{toLocalDisplay(bonuses[`level${level}`], currency).formatted}</div>
                                <div className="label">Level {level}</div>
                            </div>
                        ))}
                    </div>

                    <div className="tabs" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                        {['1', '2', '3'].map(tab => (
                            <button key={tab} type="button" className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab(tab)}>
                                Level {tab} ({(tree[`level${tab}`] || []).length})
                            </button>
                        ))}
                    </div>

                    {referrals.length === 0 ? (
                        <p className="empty-state">{translate('affiliate.noReferrals') || 'No referrals at this level yet'}</p>
                    ) : referrals.map((r, i) => (
                        <div key={r.uid || r.id || i} className="earning-item">
                            <div className="left">
                                <span className="name">{r.username || r.fullName || 'User'}</span>
                                <span className="date" style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>
                                    {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}
                                </span>
                            </div>
                            <span className={`badge ${r.isActive ? 'active' : 'pending'}`} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: r.isActive ? 'rgba(34,197,94,0.15)' : 'rgba(249,115,22,0.15)', color: r.isActive ? 'var(--color-green)' : 'var(--color-orange)' }}>
                                {r.isActive ? 'Active' : 'Pending'}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </DashboardLayout>
    );
}
