import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar.jsx';
import Logo from '../components/Logo.jsx';
import AppDownload from '../components/AppDownload.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { loginUser, getUserData } from '../services/auth.js';
import { db, doc, getDoc, setDoc, collection, getDocs } from '../services/firebase-config.js';

export default function Login() {
    const { translate } = useLanguage();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const findUserByUsername = async (name) => {
        const snap = await getDoc(doc(db, 'loginIndex', name));
        if (snap.exists()) {
            const data = snap.data();
            return { uid: data.uid, email: data.email, username: data.username || name, country: data.country || 'TZ' };
        }
        const usersSnap = await getDocs(collection(db, 'users'));
        if (!usersSnap.empty) {
            const lower = name.toLowerCase();
            for (const docSnap of usersSnap.docs) {
                const data = docSnap.data();
                if ((data.username || '').toLowerCase() === lower) {
                    await setDoc(doc(db, 'loginIndex', data.username), { uid: docSnap.id, email: data.email || '', username: data.username, country: data.country || 'TZ' });
                    return { uid: docSnap.id, email: data.email || '', username: data.username, country: data.country || 'TZ' };
                }
            }
        }
        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!username.trim()) { setError(translate('login.usernameRequired')); return; }
        if (!password || password.length < 8) { setError(translate('login.passwordMinLength')); return; }

        setLoading(true);
        try {
            const lookup = await findUserByUsername(username.trim());
            if (!lookup) { setError(translate('login.usernameNotFound')); setLoading(false); return; }

            const result = await loginUser(lookup.email, password);
            if (!result.success) { setError(translate('login.invalidCredentials')); setLoading(false); return; }

            const userData = await getUserData(result.user.uid);
            const isActive = userData?.isActive === true || userData?.activationStatus === 'approved';
            navigate(isActive ? '/dashboard' : '/activation');
        } catch (err) {
            setError(translate('login.error'));
        }
        setLoading(false);
    };

    return (
        <>
            <TopBar />
            <div className="auth-container">
                <div className="auth-card">
                    <Logo />
                    <h1 className="auth-title">{translate('login.title')} <span className="gold">Back</span></h1>
                    <p className="auth-subtitle">{translate('login.subtitle')}</p>

                    {error && <div className="alert alert-error visible">{error}</div>}

                    <form onSubmit={handleSubmit} noValidate>
                        <div className="form-group">
                            <label className="form-label">{translate('auth.username')}</label>
                            <div className="input-wrapper">
                                <input type="text" className="form-control" value={username} onChange={e => setUsername(e.target.value)} placeholder={translate('auth.enterUsername')} autoComplete="username" />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">{translate('auth.password')}</label>
                            <div className="input-wrapper">
                                <input type={showPass ? 'text' : 'password'} className="form-control" value={password} onChange={e => setPassword(e.target.value)} placeholder={translate('auth.enterPassword')} autoComplete="current-password" />
                                <button type="button" className="toggle-password" onClick={() => setShowPass(!showPass)}>
                                    {showPass ? '🙈' : '👁'}
                                </button>
                            </div>
                        </div>
                        <div className="forgot-link">
                            <Link to="/forgot-password">{translate('auth.forgotPassword')}</Link>
                        </div>
                        <button type="submit" className="btn-primary-auth" disabled={loading}>
                            {loading && <span className="spinner" style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid rgba(26,22,18,0.15)', borderTopColor: 'var(--color-on-gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />}
                            <span>{loading ? translate('login.loggingIn') : translate('login.button')}</span>
                        </button>
                    </form>
                    <div className="auth-footer">
                        {translate('auth.noAccount')} <Link to="/register">{translate('auth.register')}</Link>
                    </div>
                    <AppDownload />
                </div>
            </div>
        </>
    );
}
