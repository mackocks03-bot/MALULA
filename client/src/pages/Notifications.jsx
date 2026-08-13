import { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { markAllNotificationsRead } from '../services/database.js';
import { db, doc, collection, onSnapshot, updateDoc, query, where } from '../services/firebase-config.js';

export default function Notifications() {
    const { user } = useAuth();
    const { translate } = useLanguage();
    const [notifications, setNotifications] = useState([]);

    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, 'notifications'), where('uid', '==', user.uid));
        const unsub = onSnapshot(q, (snap) => {
            if (!snap.empty) {
                const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                setNotifications(list);
            } else {
                setNotifications([]);
            }
        });
        return () => unsub();
    }, [user]);

    const markRead = async (id) => {
        await updateDoc(doc(db, 'notifications', id), { read: true });
    };

    const markAllRead = async () => {
        if (user) await markAllNotificationsRead(user.uid);
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <DashboardLayout>
            <div className="dashboard-container">
                <div className="dashboard-content">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h2 className="page-title">{translate('notifications.title') || 'Notifications'}</h2>
                        {unreadCount > 0 && (
                            <button type="button" className="btn btn-outline" style={{ fontSize: 12, padding: '6px 12px' }} onClick={markAllRead}>
                                {translate('notifications.markAllRead') || 'Mark all read'}
                            </button>
                        )}
                    </div>

                    {notifications.length === 0 ? (
                        <p className="empty-state">{translate('notifications.empty') || 'No notifications'}</p>
                    ) : notifications.map(n => {
                        const isApprove = n.type.includes('approved') || n.type.includes('deposit') || n.type === 'activation';
                        const isReject = n.type.includes('rejected') || n.type.includes('error');
                        return (
                        <div
                            key={n.id}
                            className="notification-item"
                            style={{
                                background: n.read ? 'var(--bg-card)' : 'var(--bg-body)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 12, padding: '16px 20px', marginBottom: 12,
                                cursor: 'pointer',
                                display: 'flex', gap: 16, alignItems: 'flex-start',
                                transition: 'all 0.2s',
                                boxShadow: n.read ? 'none' : '0 4px 12px rgba(0,0,0,0.05)'
                            }}
                            onClick={() => !n.read && markRead(n.id)}
                            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
                            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                        >
                            <div style={{
                                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                                background: isApprove ? 'rgba(16, 185, 129, 0.1)' : isReject ? 'rgba(2ef, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                color: isApprove ? '#10B981' : isReject ? '#EF4444' : '#F59E0B',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                {isApprove ? (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                ) : isReject ? (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                ) : (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                                )}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                                    <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {n.title || 'System Notice'}
                                        {!n.read && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF4444' }} />}
                                    </h4>
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                        {n.createdAt ? new Date(n.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                                    </span>
                                </div>
                                <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: n.txId ? 12 : 0 }}>
                                    {n.message || n.body}
                                </p>
                                
                                {n.txId && (
                                    <div style={{
                                        background: 'rgba(0,0,0,0.02)', border: '1px dashed var(--border-color)',
                                        borderRadius: 8, padding: 12, marginTop: 12,
                                        display: 'grid', gap: 8
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                            <span style={{ color: 'var(--text-muted)' }}>Amount</span>
                                            <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                                                {Number(n.amount || 0).toFixed(2)} {n.currency || 'USD'}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                            <span style={{ color: 'var(--text-muted)' }}>TxID</span>
                                            <span style={{ fontWeight: 600, color: 'var(--color-text)', fontFamily: 'monospace', background: 'var(--bg-card)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border-color)', cursor: 'copy' }} onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(n.txId); }}>
                                                {n.txId.substring(0, 5)}...{n.txId.substring(n.txId.length - 5)} 📋
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                    })}
                </div>
            </div>
        </DashboardLayout>
    );
}
