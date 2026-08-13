import { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { formatCurrency } from '../utils/helpers.js';
import { updateUser } from '../services/database.js';

export default function Profile() {
    const { user, userData, refreshUserData } = useAuth();
    const { translate } = useLanguage();
    const { showToast } = useToast();
    const [form, setForm] = useState({ fullName: '', phone: '', username: '' });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (userData) {
            setForm({
                fullName: userData.fullName || '',
                phone: userData.phone || '',
                username: userData.username || ''
            });
        }
    }, [userData]);

    const currency = userData?.currency || 'TZS';

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
                <div className="dashboard-content">
                    <div style={{ textAlign: 'center', marginBottom: 24 }}>
                        <div className="avatar" style={{ width: 80, height: 80, fontSize: 32, margin: '0 auto 12px', borderRadius: '50%', background: 'var(--color-gold-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-on-gold)', fontWeight: 700 }}>
                            {(userData?.username || 'U').charAt(0).toUpperCase()}
                        </div>
                        <h2>{userData?.username}</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{userData?.email}</p>
                    </div>

                    <div className="dash-stats-grid">
                        <div className="stat-card">
                            <div className="amount">{formatCurrency(userData?.balance || 0, currency)}</div>
                            <div className="label">{translate('dashboard.balance')}</div>
                        </div>
                        <div className="stat-card">
                            <div className="amount">{userData?.referralCount || 0}</div>
                            <div className="label">{translate('dashboard.referrals')}</div>
                        </div>
                    </div>

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
        </DashboardLayout>
    );
}
