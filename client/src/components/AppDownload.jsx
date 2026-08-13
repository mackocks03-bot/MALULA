import React from 'react';
import { useLanguage } from '../contexts/LanguageContext.jsx';

export default function AppDownload() {
    const { translate } = useLanguage();

    const handleDownload = () => {
        // Direct download link logic - can be an external APK URL or Google Play URL
        window.open('https://play.google.com/store/apps', '_blank');
    };

    return (
        <div style={{
            background: 'linear-gradient(135deg, rgba(46, 204, 113, 0.1), rgba(39, 174, 96, 0.2))',
            border: '1px solid rgba(46, 204, 113, 0.3)',
            borderRadius: '12px',
            padding: '16px',
            marginTop: '20px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            boxShadow: '0 4px 12px rgba(46, 204, 113, 0.1)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'rgba(46, 204, 113, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#2ecc71'
                }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.523 15.3414c-.0536 0-.0996-.0461-.0996-.0997v-4.1084c0-.0536.046-.0997.0996-.0997h1.6111c.0536 0 .0996.0461.0996.0997v4.1084c0 .0536-.046.0997-.0996.0997h-1.6111zm-10.9575 0c-.0536 0-.0996-.0461-.0996-.0997v-4.1084c0-.0536.046-.0997.0996-.0997h1.611c.0536 0 .0996.0461.0996.0997v4.1084c0 .0536-.046.0997-.0996.0997h-1.611zm5.4855 2.1584c-3.1555 0-5.7483-2.1793-6.262-5.0684h12.524c-.5136 2.8891-3.1065 5.0684-6.262 5.0684zm0-10.7417c-2.3274 0-4.385.9458-5.8348 2.4594l-1.428-1.4279c.0396-.0396.104-.0383.1422.0028l1.3283 1.428c1.3995-1.1278 3.161-1.8028 5.0684-1.8028 1.9074 0 3.669.675 5.0683 1.8028l1.3283-1.428c.0381-.041.1026-.0424.1422-.0028l-1.428 1.4279c-1.4498-1.5136-3.5074-2.4594-5.8348-2.4594z"/>
                    </svg>
                </div>
                <div>
                    <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--color-text)' }}>
                        {translate('app.downloadAndroid') || 'Android App Available'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-dim)', opacity: 0.8, marginTop: '2px' }}>
                        Faster, smoother, more reliable.
                    </div>
                </div>
            </div>
            <button
                type="button"
                onClick={handleDownload}
                style={{
                    background: '#2ecc71',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 4px 6px rgba(46, 204, 113, 0.2)',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
                {translate('app.install') || 'Install'}
            </button>
        </div>
    );
}
