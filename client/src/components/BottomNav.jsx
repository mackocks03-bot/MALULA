import { NavLink } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext.jsx';

const navItems = [
    { to: '/dashboard', label: 'dashboard.title', icon: <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" /> },
    { to: '/tasks', label: 'tasks.title', icon: <><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><path d="M9 14l2 2 4-4" /></> },
    { to: '/affiliate', label: 'affiliate.title', icon: <><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></> },
    { to: '/wallet', label: 'wallet.title', icon: <><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /><circle cx="18" cy="14" r="1" /></> },
    { to: '/profile', label: 'profile.title', icon: <><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></> }
];

export default function BottomNav() {
    const { translate } = useLanguage();

    return (
        <nav className="bottom-nav">
            {navItems.map(item => (
                <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <svg viewBox="0 0 24 24">{item.icon}</svg>
                    <span>{translate(item.label)}</span>
                </NavLink>
            ))}
        </nav>
    );
}
