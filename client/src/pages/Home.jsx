import { Link } from 'react-router-dom';
import TopBar from '../components/TopBar.jsx';
import Logo from '../components/Logo.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';

export default function Home() {
    const { translate } = useLanguage();

    return (
        <>
            <TopBar />
            <div className="auth-container">
                <div className="auth-card">
                    <Logo />
                    <h1 className="auth-title">
                        {translate('home.welcome')} <span className="gold">NEWHOPE-CHAT</span>
                    </h1>
                    <p className="auth-subtitle">{translate('home.subtitle')}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
                        <Link to="/login" className="btn btn-primary btn-block">{translate('auth.login')}</Link>
                        <Link to="/register" className="btn btn-outline btn-block">{translate('auth.register')}</Link>
                    </div>
                    <div className="auth-footer">
                        <span>{translate('home.tagline')}</span>
                    </div>
                </div>
            </div>
        </>
    );
}
