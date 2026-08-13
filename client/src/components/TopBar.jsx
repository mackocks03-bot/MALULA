import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';

export default function TopBar({ showNotifications = false, hasUnread = false }) {
    const { theme, toggleTheme } = useTheme();
    const { lang, setLanguage, getLangFlag } = useLanguage();
    const [langOpen, setLangOpen] = useState(false);

    const langs = [
        { code: 'en', label: '🇬🇧 English' },
        { code: 'sw', label: '🇹🇿 Kiswahili' },
        { code: 'fr', label: '🇫🇷 Français' }
    ];

    return (
        <div className="top-bar">
            {showNotifications && (
                <div className="notif-bell-wrapper">
                    <Link to="/notifications" className="notif-bell-btn" aria-label="Notifications">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="2">
                            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                            <path d="M13.73 21a2 2 0 01-3.46 0" />
                        </svg>
                        {hasUnread && <span className="badge-dot" />}
                    </Link>
                </div>
            )}

            <div className="lang-selector">
                <button type="button" className={`lang-btn ${langOpen ? 'open' : ''}`} onClick={() => setLangOpen(!langOpen)}>
                    <span>{getLangFlag(lang)}</span>
                    <span>{lang.toUpperCase()}</span>
                    <span className="arrow">▾</span>
                </button>
                {langOpen && (
                    <div className="lang-dropdown open">
                        {langs.map(l => (
                            <button
                                key={l.code}
                                type="button"
                                className={lang === l.code ? 'active' : ''}
                                onClick={() => { setLanguage(l.code); setLangOpen(false); }}
                            >
                                {l.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="2">
                    {theme === 'dark' ? (
                        <>
                            <circle cx="12" cy="12" r="5" />
                            <line x1="12" y1="1" x2="12" y2="3" />
                            <line x1="12" y1="21" x2="12" y2="23" />
                            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                            <line x1="1" y1="12" x2="3" y2="12" />
                            <line x1="21" y1="12" x2="23" y2="12" />
                            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                        </>
                    ) : (
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    )}
                </svg>
            </button>
        </div>
    );
}
