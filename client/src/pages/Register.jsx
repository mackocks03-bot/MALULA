import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar.jsx';
import Logo from '../components/Logo.jsx';
import AppDownload from '../components/AppDownload.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { COUNTRIES } from '../utils/helpers.js';
import { registerUser, isUsernameAvailable, isEmailAvailable } from '../services/auth.js';
import { db, doc, getDoc, sendPasswordResetEmail, auth } from '../services/firebase-config.js';

function CountrySelect({ selectedCountryCode, onChange }) {
    const [open, setOpen] = useState(false);
    const selected = COUNTRIES.find(c => c.code === selectedCountryCode) || COUNTRIES[0];
    
    return (
        <div style={{ position: 'relative' }} tabIndex={0} onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
        }}>
            <div 
                className="form-control" 
                style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                onClick={() => setOpen(!open)}
            >
                <img src={`https://flagcdn.com/w40/${selected.code.toLowerCase()}.png`} width={24} height={16} alt={selected.code} style={{ borderRadius: 2, objectFit: 'cover' }} />
                <span style={{ flex: 1 }}>{selected.name}</span>
                <span style={{ fontSize: 12, opacity: 0.5 }}>▼</span>
            </div>
            {open && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--color-surface, #fff)', border: '1px solid var(--color-border, #ddd)', borderRadius: 8, marginTop: 4, zIndex: 100, maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                    {COUNTRIES.map(c => (
                        <div 
                            key={c.code} 
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(0,0,0,0.05)', color: 'var(--color-text, #333)' }}
                            onMouseDown={() => { onChange(c.code); setOpen(false); }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <img src={`https://flagcdn.com/w40/${c.code.toLowerCase()}.png`} width={24} height={16} alt={c.code} style={{ borderRadius: 2, objectFit: 'cover' }} />
                            <span>{c.name}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function Register() {
    const { translate } = useLanguage();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [form, setForm] = useState({ fullName: '', username: '', email: '', phone: '', password: '', confirmPassword: '', country: 'TZ', agreeTerms: false });
    const [referralCode, setReferralCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [referrerValid, setReferrerValid] = useState(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const refCode = params.get('ref');
        if (refCode) {
            setReferralCode(refCode);
            getDoc(doc(db, 'loginIndex', refCode)).then(snap => setReferrerValid(snap.exists()));
        }
    }, []);

    const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

    const selectedCountry = COUNTRIES.find(c => c.code === form.country) || COUNTRIES[0];

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.agreeTerms) { showToast(translate('auth.acceptTerms'), 'warning'); return; }
        if (form.password !== form.confirmPassword) { showToast(translate('auth.passwordsDontMatch'), 'error'); return; }
        if (form.password.length < 8) { showToast(translate('login.passwordMinLength') || 'Password min 8 chars', 'error'); return; }

        let cleanPhone = form.phone.replace(/\D/g, '');
        if (cleanPhone.startsWith('0')) cleanPhone = cleanPhone.substring(1);
        if (cleanPhone.length !== selectedCountry.digits) {
            showToast(translate('register.invalidPhone') || `Phone must be exactly ${selectedCountry.digits} digits without leading zero`, 'error');
            return;
        }

        setLoading(true);
        try {
            const usernameOk = await isUsernameAvailable(form.username.trim());
            if (!usernameOk) { showToast(translate('auth.usernameTaken') || 'Username taken', 'error'); setLoading(false); return; }
            const emailOk = await isEmailAvailable(form.email.trim());
            if (!emailOk) { showToast(translate('auth.emailRegistered') || 'Email registered', 'error'); setLoading(false); return; }
            if (referralCode && referrerValid === false) {
                showToast(translate('register.invalidReferral') || 'Invalid referral code', 'error');
                setLoading(false);
                return;
            }

            const country = selectedCountry;
            const finalPhone = `${country.phoneCode.replace('+', '')}${cleanPhone}`;

            const result = await registerUser(form.email, form.password, {
                fullName: form.fullName,
                username: form.username.trim(),
                phone: finalPhone,
                rawPhone: cleanPhone,
                country: form.country,
                countryName: country.name,
                currency: country.currency,
                referrer: referralCode || null
            });
            if (result.success) {
                showToast(translate('register.success') || 'Account created!', 'success');
                navigate('/activation');
            } else {
                showToast(result.error || translate('common.error'), 'error');
            }
        } catch (err) {
            showToast(err.message || translate('common.error'), 'error');
        }
        setLoading(false);
    };

    return (
        <>
            <TopBar />
            <div className="auth-container">
                <div className="auth-card" style={{ maxWidth: 520 }}>
                    <Logo />
                    <h1 className="auth-title">{translate('auth.register')}</h1>
                    <p className="auth-subtitle">{translate('register.subtitle') || translate('home.subtitle')}</p>
                    {referralCode && (
                        <p className="auth-subtitle">
                            {translate('auth.invitedBy')}: <strong>{referralCode}</strong>
                            {referrerValid === false && <span style={{ color: 'var(--color-red)', marginLeft: 8 }}>(invalid)</span>}
                        </p>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">{translate('auth.fullName')}</label>
                            <input className="form-control" value={form.fullName} onChange={e => update('fullName', e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{translate('auth.username')}</label>
                            <input className="form-control" value={form.username} onChange={e => update('username', e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{translate('auth.email')}</label>
                            <input type="email" className="form-control" value={form.email} onChange={e => update('email', e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{translate('auth.country')}</label>
                            <CountrySelect selectedCountryCode={form.country} onChange={c => update('country', c)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{translate('auth.phone')}</label>
                            <div className="phone-input-group">
                                <span className="country-code active">{selectedCountry.phoneCode}</span>
                                <input 
                                    className="form-control" 
                                    value={form.phone} 
                                    onChange={e => update('phone', e.target.value.replace(/\D/g, ''))} 
                                    placeholder={selectedCountry.digits === 9 ? "7XX XXX XXX" : ""}
                                    required 
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">{translate('auth.password')}</label>
                            <input type="password" className="form-control" value={form.password} onChange={e => update('password', e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{translate('auth.confirmPassword')}</label>
                            <input type="password" className="form-control" value={form.confirmPassword} onChange={e => update('confirmPassword', e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                                <input type="checkbox" checked={form.agreeTerms} onChange={e => update('agreeTerms', e.target.checked)} />
                                {translate('auth.agreeTerms')}
                            </label>
                        </div>
                        <button type="submit" className="btn-primary-auth" disabled={loading}>
                            {loading ? translate('app.processing') : translate('auth.register')}
                        </button>
                    </form>
                    <div className="auth-footer">
                        {translate('auth.haveAccount')} <Link to="/login">{translate('auth.login')}</Link>
                    </div>
                    <AppDownload />
                </div>
            </div>
        </>
    );
}

export function ForgotPassword() {
    const { translate } = useLanguage();
    const { showToast } = useToast();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await sendPasswordResetEmail(auth, email);
            setSent(true);
            showToast(translate('auth.checkEmail'), 'success');
        } catch {
            showToast(translate('common.error'), 'error');
        }
        setLoading(false);
    };

    return (
        <>
            <TopBar />
            <div className="auth-container">
                <div className="auth-card">
                    <Logo />
                    <h1 className="auth-title">{translate('auth.resetPassword')}</h1>
                    {sent ? (
                        <p className="auth-subtitle">{translate('auth.checkEmail')}</p>
                    ) : (
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">{translate('auth.email')}</label>
                                <input type="email" className="form-control" value={email} onChange={e => setEmail(e.target.value)} required />
                            </div>
                            <button type="submit" className="btn-primary-auth" disabled={loading}>
                                {translate('auth.sendResetLink')}
                            </button>
                        </form>
                    )}
                    <div className="auth-footer"><Link to="/login">{translate('app.back')}</Link></div>
                </div>
            </div>
        </>
    );
}
