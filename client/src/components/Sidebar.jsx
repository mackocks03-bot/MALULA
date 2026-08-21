import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { logoutUser } from '../services/auth.js';
import { ConfirmModal } from './Modals.jsx';
import { useState } from 'react';
import Logo from './Logo.jsx';

const menuItems = [
    { section: 'dashboard.overview', items: [
        { to: '/dashboard', icon: 'home', label: 'dashboard.title' }
    ]},
    { section: 'dashboard.cash', items: [
        { to: '/wallet', icon: 'wallet', label: 'wallet.title' },
        { to: '/withdraw', icon: 'withdraw', label: 'withdraw.title' }
    ]},
    { section: 'dashboard.tasks', items: [
        { to: '/tasks', icon: 'tasks', label: 'tasks.title' }
    ]},
    { section: 'dashboard.team', items: [
        { to: '/affiliate', icon: 'affiliate', label: 'affiliate.title' }
    ]},
    { section: 'dashboard.rewards', items: [
        { to: '/challenge', icon: 'challenge', label: 'challenge.title' },
        { to: '/spin', icon: 'spin', label: 'spin.title' }
    ]},
    { section: 'dashboard.features', items: [
        { to: '/free', icon: 'free', label: 'free.title' },
        { to: '/shop', icon: 'shop', label: 'shop.title' },
        { to: '/chat', icon: 'chat', label: 'chat.title' }
    ]},
    { section: 'dashboard.legal', items: [
        { to: '/terms', icon: 'terms', label: 'terms.title' }
    ]}
];

const icons = {
    home: <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />,
    wallet: <><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /><circle cx="18" cy="14" r="1" /></>,
    withdraw: <><path d="M12 2v20" /><path d="M6 8l6-6 6 6" /><path d="M6 16l6 6 6-6" /></>,
    tasks: <><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><path d="M9 14l2 2 4-4" /></>,
    affiliate: <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></>,
    challenge: <><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></>,
    spin: <><path d="M21 12a9 9 0 11-6.219-8.56" /><polyline points="21 3 21 9 15 9" /></>,
    free: <><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></>,
    shop: <><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" /></>,
    chat: <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />,
    terms: <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></>
};

export default function Sidebar({ open, onClose }) {
    const { userData } = useAuth();
    const { translate } = useLanguage();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [confirmDialog, setConfirmDialog] = useState(null);

    const name = userData?.fullName || userData?.username || 'User';
    const initial = name.charAt(0).toUpperCase();

    const handleLogout = async () => {
        setConfirmDialog({
            title: 'Logout',
            message: translate('spin.confirmLogout') || 'Are you sure you want to logout?',
            isDestructive: true,
            confirmText: 'Logout',
            onConfirm: async () => {
                setConfirmDialog(null);
                try {
                    await logoutUser();
                    navigate('/login');
                } catch {
                    showToast(translate('common.error') || 'Error', 'error');
                }
            }
        });
    };

    return (
        <>
            <div className={`sidebar-overlay ${open ? 'open' : ''}`} onClick={onClose} />
            <nav className={`sidebar ${open ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <NavLink to="/dashboard" className="logo" onClick={onClose}>
                        <Logo />
                    </NavLink>
                    <button type="button" className="sidebar-close" onClick={onClose}>
                        <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                </div>

                <div className="sidebar-user">
                    <div className="avatar">{initial}</div>
                    <div className="info">
                        <div className="name">{name}</div>
                        <div className="email">{userData?.email || ''}</div>
                    </div>
                </div>

                <ul className="sidebar-menu">
                    {menuItems.map((section, i) => (
                        <li key={i}>
                            <div className="menu-section"><div className="section-title">{translate(section.section)}</div></div>
                            {section.items.map(item => (
                                <NavLink key={item.to} to={item.to} className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`} onClick={onClose}>
                                    <svg viewBox="0 0 24 24">{icons[item.icon]}</svg>
                                    <span>{translate(item.label)}</span>
                                </NavLink>
                            ))}
                        </li>
                    ))}
                    <li className="menu-section"><div className="section-title">{translate('dashboard.account')}</div></li>
                    <li>
                        <button type="button" className="menu-item" style={{ color: 'var(--color-red)' }} onClick={handleLogout}>
                            <svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                            <span>{translate('auth.logout')}</span>
                        </button>
                    </li>
                </ul>
            </nav>
            <ConfirmModal
                isOpen={!!confirmDialog}
                title={confirmDialog?.title}
                message={confirmDialog?.message}
                isDestructive={confirmDialog?.isDestructive}
                confirmText={confirmDialog?.confirmText || 'Confirm'}
                onConfirm={confirmDialog?.onConfirm}
                onCancel={() => setConfirmDialog(null)}
            />
        </>
    );
}
