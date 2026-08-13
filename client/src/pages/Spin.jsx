import { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { toLocalDisplay } from '../utils/helpers.js';
import { db, doc, updateDoc, addDoc, collection, query, where, getDocs } from '../services/firebase-config.js';

const SEGMENTS = [
    { label: '$0.10', value: 0.10, color: '#E5B84A' },
    { label: '$0.25', value: 0.25, color: '#5B9BF5' },
    { label: '$0.50', value: 0.50, color: '#5CD68A' },
    { label: '$1.00', value: 1.00, color: '#F06B6B' },
    { label: '$0.05', value: 0.05, color: '#A78BFA' },
    { label: '$2.00', value: 2.00, color: '#F5A962' },
    { label: '$0.20', value: 0.20, color: '#F472B6' },
    { label: 'Try Again', value: 0, color: '#7B8499' }
];

export default function Spin() {
    const { user, userData, refreshUserData } = useAuth();
    const { translate } = useLanguage();
    const { showToast } = useToast();
    const [spinning, setSpinning] = useState(false);
    const [rotation, setRotation] = useState(0);
    const [result, setResult] = useState(null);

    const [history, setHistory] = useState([]);

    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, 'spinHistory'), where('uid', '==', user.uid));
        getDocs(q).then(snap => {
            if (!snap.empty) {
                const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                list.sort((a, b) => b.createdAt - a.createdAt);
                setHistory(list.slice(0, 10));
            }
        });
    }, [user, userData?.spinsUsed]);

    const referralCount = userData?.referralCount || 0;
    const spinsAvailable = Math.floor(referralCount / 10) - (userData?.spinsUsed || 0);
    const currency = userData?.currency || 'TZS';

    const spin = async () => {
        if (spinning || spinsAvailable <= 0) return;
        setSpinning(true);
        setResult(null);

        const winIndex = Math.floor(Math.random() * SEGMENTS.length);
        const segment = SEGMENTS[winIndex];
        const extraRotation = 360 * 5 + (winIndex * (360 / SEGMENTS.length));
        setRotation(prev => prev + extraRotation);

        setTimeout(async () => {
            try {
                if (segment.value > 0) {
                    await updateDoc(doc(db, 'users', user.uid), {
                        spinEarnings: (userData?.spinEarnings || 0) + segment.value,
                        balance: (userData?.balance || 0) + segment.value,
                        totalProfit: (userData?.totalProfit || 0) + segment.value,
                        spinsUsed: (userData?.spinsUsed || 0) + 1
                    });
                    await addDoc(collection(db, 'spinHistory'), {
                        uid: user.uid,
                        amount: segment.value,
                        createdAt: Date.now()
                    });
                    showToast(`🎉 Won ${toLocalDisplay(segment.value, currency).formatted}!`, 'success');
                } else {
                    await updateDoc(doc(db, 'users', user.uid), { spinsUsed: (userData?.spinsUsed || 0) + 1 });
                    showToast(translate('spin.tryAgain') || 'Try Again!', 'info');
                }
                setResult(segment);
                refreshUserData();
            } catch {
                showToast(translate('common.error'), 'error');
            }
            setSpinning(false);
        }, 4000);
    };

    return (
        <DashboardLayout>
            <div className="dashboard-container">
                <div className="dashboard-content" style={{ textAlign: 'center' }}>
                    <h2 className="page-title">{translate('spin.title')}</h2>
                    <p className="auth-subtitle">{translate('spin.subtitle') || '1 spin per 10 referrals'}</p>

                    <div className="stat-card" style={{ marginBottom: 24 }}>
                        <div className="amount">{spinsAvailable}</div>
                        <div className="label">{translate('spin.available') || 'Spins Available'}</div>
                    </div>

                    <div className="spin-wheel-container" style={{ position: 'relative', width: 280, height: 280, margin: '0 auto 24px' }}>
                        <div
                            className="spin-wheel"
                            style={{
                                width: '100%', height: '100%', borderRadius: '50%',
                                background: `conic-gradient(${SEGMENTS.map((s, i) => `${s.color} ${i * (360 / SEGMENTS.length)}deg ${(i + 1) * (360 / SEGMENTS.length)}deg`).join(', ')})`,
                                transition: spinning ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
                                transform: `rotate(${rotation}deg)`,
                                border: '4px solid var(--color-gold)',
                                boxShadow: 'var(--shadow-glow-gold)'
                            }}
                        />
                        <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', fontSize: 24 }}>▼</div>
                    </div>

                    <button type="button" className="btn btn-primary btn-block" onClick={spin} disabled={spinning || spinsAvailable <= 0} style={{ maxWidth: 280, margin: '0 auto' }}>
                        {spinning ? translate('spin.spinning') || 'Spinning...' : translate('spin.spin') || 'SPIN!'}
                    </button>

                    {result && (
                        <p style={{ marginTop: 16, fontSize: 18, fontWeight: 700, color: 'var(--color-gold)' }}>
                            {result.value > 0 ? `🎉 ${result.label}` : result.label}
                        </p>
                    )}

                    {history.length > 0 && (
                        <div className="spin-history" style={{ marginTop: 24, textAlign: 'left' }}>
                            <div className="section-title">{translate('spin.history') || 'Spin History'}</div>
                            {history.map(h => (
                                <div key={h.id} className="earning-item">
                                    <span>{h.amount > 0 ? `+$${h.amount.toFixed(2)}` : 'Try Again'}</span>
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                        {h.createdAt ? new Date(h.createdAt).toLocaleDateString() : ''}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
