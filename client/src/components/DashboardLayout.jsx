import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db, collection, query, where, getDocs, onSnapshot } from '../services/firebase-config.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import TopBar from './TopBar.jsx';
import Sidebar from './Sidebar.jsx';
import BottomNav from './BottomNav.jsx';
import Logo from './Logo.jsx';

export default function DashboardLayout({ children }) {
    const { user } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [hasUnread, setHasUnread] = useState(false);

    useEffect(() => {
        if (!user) return;
        const checkNotifs = async () => {
            const q = query(collection(db, 'notifications'), where('uid', '==', user.uid), where('read', '==', false));
            const snap = await getDocs(q);
            setHasUnread(!snap.empty);
        };
        checkNotifs();
        const qNotifs = query(collection(db, 'notifications'), where('uid', '==', user.uid), where('read', '==', false));
        const unsub = onSnapshot(qNotifs, (snapshot) => {
            setHasUnread(!snapshot.empty);
        });
        return () => unsub();
    }, [user]);

    return (
        <>
            <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <TopBar showNotifications hasUnread={hasUnread} />

            <header className="page-header">
                <div className="header-left">
                    <button type="button" className="sidebar-toggle" onClick={() => setSidebarOpen(true)}>
                        <svg viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
                    </button>
                    <Link to="/dashboard" className="logo-compact">
                        <Logo compact />
                    </Link>
                </div>
                <div className="header-right">
                    <Link to="/profile" className="header-btn">
                        <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                    </Link>
                </div>
            </header>

            {children}
            <BottomNav />
        </>
    );
}
