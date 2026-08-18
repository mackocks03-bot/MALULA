import { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { formatCurrency, COUNTRIES } from '../utils/helpers.js';
import { updateUser } from '../services/database.js';
import { db, doc, getDoc } from '../services/firebase-config.js';

export default function Profile() {
    const { user, userData, refreshUserData } = useAuth();
    const { translate } = useLanguage();
    const { showToast } = useToast();
    const [form, setForm] = useState({ fullName: '', phone: '', username: '' });
    const [saving, setSaving] = useState(false);
    const [upliner, setUpliner] = useState(null);

    useEffect(() => {
        if (userData) {
            setForm({
                fullName: userData.fullName || '',
                phone: userData.phone || '',
                username: userData.username || ''
            });
            // Fetch upliner info
            if (userData.referrer) {
                fetchUpliner(userData.referrer);
            }
        }
    }, [userData]);

    const fetchUpliner = async (referrerId) => {
        try {
            // referrer can be a uid or a username — try uid first
            const byUid = await getDoc(doc(db, 'users', referrerId));
            if (byUid.exists()) {
                setUpliner(byUid.data());
                return;
            }
            // fallback: look up via loginIndex (username → uid mapping)
            const indexSnap = await getDoc(doc(db, 'loginIndex', referrerId));
            if (indexSnap.exists()) {
                const uid = indexSnap.data().uid;
                const userSnap = await getDoc(doc(db, 'users', uid));
                if (userSnap.exists()) setUpliner(userSnap.data());
            }
        } catch (e) {
            console.warn('Could not load upliner:', e);
        }
    };

    const currency = userData?.currency || 'TZS';

    const countryCode = (userData?.country || userData?.countryCode || 'TZ').toLowerCase();
    const uplinerCountryCode = (upliner?.country || upliner?.countryCode || 'TZ').toLowerCase();

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await updateUser(user.uid, form);
            await refreshUserData();
            showToast(translate('profile.saved') || 'Profile saved!', 'success');
        } catch {
            showToast(translate('common.error'), 'error');
        }
        setSaving(false);
    };

    return (
        <DashboardLayout>
            <div className="dashboard-container">
                <div className="dashboard-content" style={{ paddingTop: 0 }}>

                    {/* ── Country Flag Hero Banner ── */}
                    <div style={{
                        position: 'relative',
                        borderRadius: '0 0 24px 24px',
                        overflow: 'hidden',
                        marginBottom: 20,
                        height: 160
                    }}>
                        {/* Flag as full background */}
                        <img
                            src={`https://flagcdn.com/w640/${countryCode}.png`}
                            alt={userData?.countryName || ''}
                            style={{
                                width: '100%', height: '100%',
                                objectFit: 'cover',
                                filter: 'brightness(0.55) saturate(1.3)'
                            }}
                        />
                        {/* Gradient overlay for readability */}
                        <div style={{
                            position: 'absolute', inset: 0,
                            background: 'linear-gradient(to bottom, rgba(0,0,0,0.15), rgba(0,0,0,0.65))'
                        }} />
                        {/* Avatar + Name */}
                        <div style={{
                            position: 'absolute', inset: 0,
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'flex-end',
                            paddingBottom: 16
                        }}>
                            <div style={{
                                width: 64, height: 64, borderRadius: '50%', marginBottom: 8,
                                background: 'var(--color-gold-gradient)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: '#000', fontWeight: 800, fontSize: 26,
                                border: '3px solid rgba(255,255,255,0.5)',
                                boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
                            }}>
                                {(userData?.username || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div style={{ color: '#fff', fontWeight: 700, fontSize: 17, textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
                                {userData?.username}
                            </div>
                            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                                {userData?.countryName || ''} · {userData?.email}
                            </div>
                        </div>
                    </div>

                    {/* ── Balance + Referrals Stats ── */}
                    <div className="dash-stats-grid" style={{ marginBottom: 16 }}>
                        <div className="stat-card">
                            <div className="amount">{formatCurrency(userData?.balance || 0, currency)}</div>
                            <div className="label">{translate('dashboard.balance')}</div>
                        </div>
                        <div className="stat-card">
                            <div className="amount">{userData?.referralCount || 0}</div>
                            <div className="label">{translate('dashboard.referrals')}</div>
                        </div>
                    </div>

                    {/* ── Upliner Card ── */}
                    {userData?.referrer && (
                        <div style={{
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 14,
                            padding: '14px 16px',
                            marginBottom: 20,
                            boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
                        }}>
                            <div style={{
                                fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                                letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 10
                            }}>
                                Your Upliner
                            </div>

                            {upliner ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    {/* Flag avatar */}
                                    <div style={{ position: 'relative', flexShrink: 0 }}>
                                        <div style={{
                                            width: 48, height: 48, borderRadius: '50%', overflow: 'hidden',
                                            border: '2px solid var(--color-gold)',
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                                        }}>
                                            <img
                                                src={`https://flagcdn.com/w80/${uplinerCountryCode}.png`}
                                                alt={upliner.countryName}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                        </div>
                                        {/* Online/Active indicator */}
                                        <div style={{
                                            position: 'absolute', bottom: 0, right: 0,
                                            width: 12, height: 12, borderRadius: '50%',
                                            background: upliner.isActive ? '#22c55e' : '#f97316',
                                            border: '2px solid var(--color-surface)'
                                        }} />
                                    </div>

                                    {/* Info */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                                            {upliner.username || upliner.fullName}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                                            <img
                                                src={`https://flagcdn.com/w40/${uplinerCountryCode}.png`}
                                                alt={upliner.countryName}
                                                style={{ width: 16, height: 11, objectFit: 'cover', borderRadius: 2 }}
                                            />
                                            <span>{upliner.countryName || 'Tanzania'}</span>
                                        </div>
                                        {upliner.phone && (
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                                                +{upliner.phone}
                                            </div>
                                        )}
                                    </div>

                                    {/* Call Button */}
                                    {upliner.phone ? (
                                        <a
                                            href={`tel:+${upliner.phone}`}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 6,
                                                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                                                color: '#fff', textDecoration: 'none',
                                                borderRadius: 99, padding: '8px 14px',
                                                fontSize: 13, fontWeight: 600,
                                                flexShrink: 0,
                                                boxShadow: '0 2px 8px rgba(34,197,94,0.35)',
                                                transition: 'all 0.2s'
                                            }}
                                            title={`Call ${upliner.username}`}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.59 3.4 2 2 0 0 1 3.56 1.23h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.72a16 16 0 0 0 6 6l.9-.9a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                                            </svg>
                                            Call
                                        </a>
                                    ) : (
                                        <div style={{
                                            display: 'flex', alignItems: 'center', gap: 6,
                                            background: 'var(--color-border)', color: 'var(--text-muted)',
                                            borderRadius: 99, padding: '8px 14px', fontSize: 13
                                        }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.59 3.4 2 2 0 0 1 3.56 1.23h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.72a16 16 0 0 0 6 6l.9-.9a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                                            </svg>
                                            No phone
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{
                                        width: 48, height: 48, borderRadius: '50%',
                                        background: 'var(--color-border)',
                                        animation: 'pulse 1.5s ease-in-out infinite'
                                    }} />
                                    <div>
                                        <div style={{ width: 100, height: 12, background: 'var(--color-border)', borderRadius: 4, marginBottom: 6, animation: 'pulse 1.5s ease-in-out infinite' }} />
                                        <div style={{ width: 70, height: 10, background: 'var(--color-border)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Edit Form ── */}
                    <form onSubmit={handleSave}>
                        <div className="form-group">
                            <label className="form-label">{translate('auth.fullName')}</label>
                            <input className="form-control" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{translate('auth.username')}</label>
                            <input className="form-control" value={form.username} disabled />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{translate('auth.phone')}</label>
                            <input className="form-control" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                        </div>
                        <button type="submit" className="btn-primary-auth" disabled={saving}>
                            {saving ? translate('app.saving') : translate('profile.save') || 'Save Profile'}
                        </button>
                    </form>
                </div>
            </div>

            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.4; }
                }
            `}</style>
        </DashboardLayout>
    );
}
