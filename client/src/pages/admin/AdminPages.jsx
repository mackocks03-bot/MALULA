import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { db, doc, collection, getDocs, updateDoc, deleteDoc, addDoc } from '../../services/firebase-config.js';
import { approveActivation, rejectActivation, deleteActivation } from '../../services/activation.js';
import { approveWithdrawal, rejectWithdrawal, deleteWithdrawal } from '../../services/withdraw.js';
import { useToast } from '../../contexts/ToastContext.jsx';

import './css/AdminShared.css';
import './css/AdminLayout.css';
import './css/AdminDashboard.css';
import './css/AdminUsers.css';
import './css/AdminPayments.css';
import './css/AdminWithdrawals.css';

/* ─────────────────────── Icon helper ─────────────────────── */
const Icon = ({ d, size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
    </svg>
);

const icons = {
    dashboard: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10',
    users:     'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75',
    payments:  'M2 5h20v14H2z M2 10h20',
    withdraw:  'M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
    referrals: 'M16 3.13a4 4 0 010 7.75 M11 7a4 4 0 100 8 4 4 0 000-8z',
    tasks:     'M9 11l3 3L22 4 M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
    settings:  'M12 15a3 3 0 100-6 3 3 0 000 6z',
    shop:      'M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z M3 6h18 M16 10a4 4 0 01-8 0',
    back:      'M19 12H5 M12 19l-7-7 7-7',
    check:     'M20 6L9 17l-5-5',
    x:         'M18 6L6 18 M6 6l12 12',
    trash:     'M3 6h18 M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2',
    refresh:   'M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15',
    search:    'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0',
};

const adminLinks = [
    { to: '/admin/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { to: '/admin/users',     label: 'Users Directory', icon: 'users' },
    { to: '/admin/payments',  label: 'Payment Logs', icon: 'payments' },
    { to: '/admin/withdrawals',label: 'Withdrawal Limits', icon: 'withdraw' },
    { to: '/admin/referrals', label: 'Referral Tracking', icon: 'referrals' },
    { to: '/admin/tasks',     label: 'Task Assignments', icon: 'tasks' },
    { to: '/admin/shop',      label: 'Vendor Management', icon: 'shop' },
    { to: '/admin/settings',  label: 'System Parameters', icon: 'settings' },
];

/* ─────────────────────── Shared components ─────────────────────── */
function StatusBadge({ status }) {
    const map = {
        approved: ['success', 'APPROVED'],
        active:   ['success', 'ACTIVE'],
        pending:  ['warning', 'PENDING'],
        rejected: ['danger',  'REJECTED'],
        completed:['success', 'COMPLETED'],
        COMPLETED:['success', 'COMPLETED'],
        failed:   ['danger',  'FAILED'],
    };
    const [cls, label] = map[status] || ['muted', (status || 'UNKNOWN').toUpperCase()];
    return <span className={`gov-badge gov-badge-${cls}`}>{label}</span>;
}

function ConfirmModal({ modal, onClose, onConfirm, processing }) {
    if (!modal) return null;
    const isDelete = modal.action === 'delete';
    const isReject = modal.action === 'reject';
    
    return (
        <div className="gov-modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className={`gov-modal ${isDelete || isReject ? 'danger-border' : ''}`} style={isDelete || isReject ? { borderTopColor: 'var(--gov-danger)'} : {}}>
                <div className="gov-modal-header">
                    <h3>{modal.title}</h3>
                    <button className="gov-modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="gov-modal-body">
                    <p className="gov-subtitle" style={{marginBottom: 16}}>{modal.subtitle}</p>
                    
                    <div style={{ background: '#F5F5F5', padding: 12, borderRadius: 4, marginBottom: 16 }}>
                        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                            <tbody>
                                {modal.details.map(({ label, value }) => (
                                    <tr key={label} style={{ borderBottom: '1px solid #E0E0E0' }}>
                                        <td style={{ padding: '8px 4px', fontWeight: 700, color: '#666', textTransform: 'uppercase', fontSize: 11 }}>{label}</td>
                                        <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 500 }}>{value || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {isReject && (
                        <div>
                            <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 8 }}>Rejection Reason</label>
                            <input
                                className="gov-input"
                                value={modal.reason || ''}
                                onChange={e => modal.setReason(e.target.value)}
                                placeholder="State reason for records..."
                            />
                        </div>
                    )}
                </div>
                <div className="gov-modal-footer">
                    <button className="gov-btn gov-btn-outline" onClick={onClose} disabled={processing}>Cancel</button>
                    <button
                        className={`gov-btn ${isDelete || isReject ? 'gov-btn-danger' : 'gov-btn-success'}`}
                        onClick={onConfirm} disabled={processing}
                    >
                        {processing ? 'Processing...' : (isDelete ? 'Delete Record' : isReject ? 'Reject Request' : 'Approve Request')}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   ADMIN LAYOUT
═══════════════════════════════════════════════════════════ */
export default function AdminLayout() {
    const { user, userData, loading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [verified, setVerified] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        document.body.classList.add('admin-mode');
        return () => document.body.classList.remove('admin-mode');
    }, []);

    useEffect(() => {
        if (loading) return;
        if (!user) { navigate('/admin/login'); return; }
        if (userData?.role === 'admin') { setVerified(true); return; }
        const stored = sessionStorage.getItem('adminAuth');
        if (stored) {
            try { if (JSON.parse(stored).role === 'admin') { setVerified(true); return; } } catch {}
        }
        navigate('/admin/login');
    }, [user, userData, loading, navigate]);

    if (!verified) return null;
    const displayName = userData?.username || userData?.fullName || 'System Admin';

    return (
        <div className="gov-layout-wrapper">
            <aside className={`gov-sidebar ${mobileOpen ? 'open' : ''}`}>
                <div className="gov-sidebar-header">
                    <div className="gov-sidebar-brand">NEWHOPE <span className="hl">GOV</span></div>
                    <div className="gov-sidebar-badge">AUTHORIZED ACCESS ONLY</div>
                </div>
                
                <nav className="gov-sidebar-nav">
                    {adminLinks.map(link => (
                        <Link key={link.to} to={link.to} className={`gov-sidebar-link ${location.pathname.startsWith(link.to) ? 'active' : ''}`} onClick={() => setMobileOpen(false)}>
                            <Icon d={icons[link.icon]} />
                            {link.label}
                        </Link>
                    ))}
                </nav>
                
                <div className="gov-sidebar-footer">
                    <div className="gov-user-card">
                        <div className="label">Operator ID</div>
                        <div className="name">{displayName}</div>
                        <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 4, fontFamily: 'monospace' }}>{user.uid?.slice(0, 8)}</div>
                    </div>
                </div>
            </aside>
            
            <main className="gov-main">
                <header className="gov-topbar">
                    <button className="gov-mobile-btn" onClick={() => setMobileOpen(!mobileOpen)}>☰ Menu</button>
                    <div style={{ flex: 1 }}></div>
                    <Link to="/" className="gov-btn gov-btn-outline" style={{ padding: '6px 12px', fontSize: 12 }}>Client Portal ➔</Link>
                </header>
                
                <div className="gov-content">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════════════════════════ */
export function AdminDashboard() {
    const [stats, setStats] = useState({ users: 0, active: 0, payments: 0, pendingPayments: 0, withdrawals: 0, pendingWithdrawals: 0 });
    const [activity, setActivity] = useState([]);
    const [busy, setBusy] = useState(true);

    useEffect(() => {
        Promise.all([
            getDocs(collection(db, 'users')),
            getDocs(collection(db, 'activationPayments')),
            getDocs(collection(db, 'withdrawals'))
        ]).then(([usersSnap, paymentsSnap, withdrawalsSnap]) => {
            let active = 0, pendingP = 0, totalW = 0, pendingW = 0;
            const acts = [];
            
            if (!usersSnap.empty) {
                const uVals = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
                setStats(s => ({ ...s, users: uVals.length }));
                uVals.forEach(u => {
                    if (u.isActive) active++;
                    if (u.createdAt) acts.push({ type: 'user', title: `System Registration`, sub: `User: ${u.uid?.slice(0,8)}`, time: u.createdAt });
                });
            }
            if (!paymentsSnap.empty) {
                const pVals = paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                setStats(s => ({ ...s, payments: pVals.length }));
                pVals.forEach(p => {
                    if (p.status === 'pending') pendingP++;
                    if (p.createdAt) acts.push({ type: 'payment', title: `Payment Logged`, sub: `Ref: ${p.reference || 'N/A'}`, time: p.createdAt });
                });
            }
            if (!withdrawalsSnap.empty) {
                withdrawalsSnap.docs.forEach(wDoc => {
                    const w = wDoc.data();
                    totalW++;
                    if (w.status === 'pending') pendingW++;
                    if (w.createdAt) acts.push({ type: 'withdraw', title: `Withdrawal Req`, sub: `$${(w.amountUSD || w.amount || 0).toFixed(2)}`, time: w.createdAt });
                });
            }
            
            setStats(s => ({ ...s, active, pendingPayments: pendingP, withdrawals: totalW, pendingWithdrawals: pendingW }));
            setActivity(acts.sort((a,b) => b.time - a.time).slice(0, 10));
            setBusy(false);
        });
    }, []);

    const cards = [
        { label: 'Registered Citizens', value: stats.users, icon: '📋' },
        { label: 'Active Personnel', value: stats.active, icon: '☑️' },
        { label: 'Total Invoices', value: stats.payments, icon: '📨' },
        { label: 'Pending Deposits', value: stats.pendingPayments, icon: '⏳' },
        { label: 'Total Disbursements', value: stats.withdrawals, icon: '📑' },
        { label: 'Pending Payouts', value: stats.pendingWithdrawals, icon: '⚠️' },
    ];

    return (
        <div>
            <h1 className="gov-title">System Overview</h1>
            <p className="gov-subtitle">Executive summary of platform metrics</p>
            
            <div className="gov-dash-grid">
                {cards.map((c, i) => (
                    <div key={i} className="gov-stat-card">
                        <div className="gov-stat-icon">{c.icon}</div>
                        <div className="gov-stat-content">
                            <div className="gov-stat-label">{c.label}</div>
                            <div className="gov-stat-value">{busy ? '—' : c.value}</div>
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="gov-panel" style={{ maxWidth: 600 }}>
                <div className="gov-panel-header"><div className="gov-panel-title">System Activity Log</div></div>
                <div className="gov-panel-body">
                    {busy ? <div style={{ padding: 24, textAlign: 'center', color: '#666' }}>Querying logs...</div> : (
                        activity.map((a, i) => (
                            <div className="gov-activity-item" key={i}>
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: a.type==='user'?'#0288D1':a.type==='payment'?'#2E7D32':'#ED6C02' }}></div>
                                <div className="gov-activity-text">
                                    <div className="gov-activity-title">{a.title}</div>
                                    <div className="gov-activity-sub">{a.sub}</div>
                                </div>
                                <div className="gov-activity-time">{new Date(a.time).toLocaleString()}</div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   USER PROFILE MODAL
═══════════════════════════════════════════════════════════ */
function UserProfileModal({ user, onClose, onUpdateStatus }) {
    if (!user) return null;
    const cCode = (user.countryCode || 'TZ').toLowerCase();
    
    return (
        <div className="gov-modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="gov-modal" style={{ maxWidth: 650 }}>
                <div className="gov-modal-header">
                    <div>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <img src={`https://flagcdn.com/w40/${cCode}.png`} alt={cCode} style={{ width: 24, height: 16, borderRadius: 2 }} />
                            Personnel Profile: {user.username || 'N/A'}
                        </h3>
                        <div style={{ fontSize: 12, color: '#666', marginTop: 4, fontFamily: 'monospace' }}>UID: {user.uid}</div>
                    </div>
                    <button className="gov-modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="gov-modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <div>
                        <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: '#999', marginBottom: 12, borderBottom: '1px solid #eee', paddingBottom: 4 }}>Identity & Contact</h4>
                        <div style={{ marginBottom: 8 }}><b>Email:</b> {user.email || '—'}</div>
                        <div style={{ marginBottom: 8 }}><b>Phone:</b> {user.phone || '—'}</div>
                        <div style={{ marginBottom: 8 }}><b>Country:</b> {user.countryName || user.country || '—'}</div>
                        <div style={{ marginBottom: 8 }}><b>Joined:</b> {user.createdAt ? new Date(user.createdAt).toLocaleString() : '—'}</div>
                        <div style={{ marginBottom: 8 }}><b>Status:</b> <StatusBadge status={user.isActive ? 'active' : 'pending'} /></div>
                    </div>
                    <div>
                        <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: '#999', marginBottom: 12, borderBottom: '1px solid #eee', paddingBottom: 4 }}>Financial & Network</h4>
                        <div style={{ marginBottom: 8, color: '#2E7D32', fontWeight: 700 }}><b>Ledger Balance:</b> ${(user.balance || 0).toFixed(2)}</div>
                        <div style={{ marginBottom: 8 }}><b>Total Withdrawn:</b> ${(user.totalWithdrawn || 0).toFixed(2)}</div>
                        <div style={{ marginBottom: 8 }}><b>Referrer ID:</b> <span style={{fontFamily: 'monospace'}}>{user.referrer || 'None'}</span></div>
                        <div style={{ marginBottom: 8 }}>
                            <b>Downlines (Lv1/Lv2/Lv3):</b> {user.downlines?.level1 || 0} / {user.downlines?.level2 || 0} / {user.downlines?.level3 || 0}
                        </div>
                        <div style={{ marginBottom: 8 }}><b>Mining Rate:</b> {user.miningRate || 0} / hr</div>
                    </div>
                </div>
                <div className="gov-modal-footer">
                    <button className="gov-btn gov-btn-danger" onClick={() => onUpdateStatus(user.uid, !user.isActive)}>
                        {user.isActive ? 'Suspend User' : 'Unsuspend User'}
                    </button>
                    <button className="gov-btn gov-btn-outline" onClick={onClose}>Close Registry</button>
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   USERS
═══════════════════════════════════════════════════════════ */
export function AdminUsers() {
    const { showToast } = useToast();
    const [users, setUsers] = useState([]);
    const [q, setQ] = useState('');
    const [filter, setFilter] = useState('all');
    const [selectedUser, setSelectedUser] = useState(null);

    const loadUsers = useCallback(() => {
        getDocs(collection(db, 'users')).then(snap => {
            if (!snap.empty) setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
        });
    }, []);

    useEffect(() => { loadUsers(); }, [loadUsers]);

    const handleUpdateStatus = async (uid, newStatus) => {
        try {
            await updateDoc(doc(db, 'users', uid), { isActive: newStatus });
            showToast(`User status updated to ${newStatus ? 'Active' : 'Suspended'}.`, 'success');
            setSelectedUser(null);
            loadUsers();
        } catch(e) {
            showToast('Failed to update user', 'error');
        }
    };

    const filtered = users
        .filter(u => filter === 'all' ? true : filter === 'active' ? u.isActive : !u.isActive)
        .filter(u => {
            if (!q) return true;
            const lq = q.toLowerCase();
            return u.uid?.toLowerCase().includes(lq) || u.username?.toLowerCase().includes(lq) || u.email?.toLowerCase().includes(lq) || u.phone?.toLowerCase().includes(lq);
        });

    return (
        <div>
            <UserProfileModal user={selectedUser} onClose={() => setSelectedUser(null)} onUpdateStatus={handleUpdateStatus} />
            <h1 className="gov-title">User Directory</h1>
            <p className="gov-subtitle">Comprehensive registry of all platform personnel</p>
            
            <div className="gov-users-toolbar">
                <input className="gov-input gov-users-search" placeholder="Query by ID, Name, Phone..." value={q} onChange={e => setQ(e.target.value)} />
                <div className="gov-users-filters">
                    {['all', 'active', 'pending'].map(f => (
                        <button key={f} className={`gov-btn ${filter === f ? 'gov-btn-primary' : 'gov-btn-outline'}`} onClick={() => setFilter(f)}>
                            {f.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>
            
            <div className="gov-table-container">
                <table className="gov-table">
                    <thead><tr><th>Personnel</th><th>Contact Data</th><th>Region</th><th>Ledger Balance</th><th>System Status</th></tr></thead>
                    <tbody>
                        {filtered.map(u => {
                            const cCode = (u.countryCode || 'TZ').toLowerCase();
                            return (
                                <tr key={u.uid} onClick={() => setSelectedUser(u)} style={{ cursor: 'pointer' }} title="Click to view full records">
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div className="gov-user-avatar">{(u.username || '?').slice(0,2).toUpperCase()}</div>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--gov-blue)' }}>{u.username || 'Unregistered'}</div>
                                                <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#666' }}>ID: {u.uid.slice(0, 12)}...</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div>{u.email}</div>
                                        <div style={{ fontFamily: 'monospace', color: '#666' }}>{u.phone || 'N/A'}</div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <img src={`https://flagcdn.com/w40/${cCode}.png`} alt={u.countryCode} style={{ width: 24, height: 16, borderRadius: 2 }} />
                                            <span>{u.countryName || u.country || 'N/A'}</span>
                                        </div>
                                    </td>
                                    <td style={{ fontWeight: 700, color: '#2E7D32' }}>{u.currency || 'TZS'} {Number(u.balance || 0).toLocaleString()}</td>
                                    <td><StatusBadge status={u.isActive ? 'active' : 'pending'} /></td>
                                </tr>
                            );
                        })}
                        {filtered.length === 0 && <tr><td colSpan={5}><div className="gov-empty-state">No personnel records correspond to query.</div></td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   PAYMENTS
═══════════════════════════════════════════════════════════ */
export function AdminPayments() {
    const { showToast } = useToast();
    const [payments, setPayments] = useState([]);
    const [usersMap, setUsersMap] = useState({});
    const [processing, setProcessing] = useState(false);
    const [modal, setModal] = useState(null);
    const [q, setQ] = useState('');

    const load = useCallback(() => {
        Promise.all([ getDocs(collection(db, 'activationPayments')), getDocs(collection(db, 'users')) ]).then(([pSnap, uSnap]) => {
            if (!uSnap.empty) {
                const uMap = {};
                uSnap.docs.forEach(d => uMap[d.id] = d.data());
                setUsersMap(uMap);
            }
            setPayments(!pSnap.empty ? pSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)) : []);
        });
    }, []);

    useEffect(() => { load(); }, [load]);

    const filtered = payments.filter(p => !q || p.uid?.toLowerCase().includes(q.toLowerCase()) || p.reference?.toLowerCase().includes(q.toLowerCase()));

    const openModal = (action, p) => {
        const u = usersMap[p.uid] || {};
        const currency = u.currency || p.nativeCurrency || 'TZS';
        const nativeAmt = p.amountTZS || p.nativeAmount || p.amount || 0;
        const amountDisplay = `${currency} ${Number(nativeAmt).toLocaleString()}`;
        setModal({
            action, id: p.id,
            title: action === 'approve' ? 'Approve Payment' : action === 'reject' ? 'Reject Payment' : 'Delete Record',
            subtitle: `Action required for invoice ${p.reference || p.transactionId || p.id}`,
            details: [
                { label: 'Client ID', value: p.uid },
                { label: 'Username', value: u.username || u.fullName || '—' },
                { label: 'Amount', value: amountDisplay },
                { label: 'Method', value: p.method || p.channel || 'PalmPesa' },
                { label: 'Phone', value: p.phone || p.phoneNumber || '—' },
                { label: 'Dated', value: p.createdAt ? new Date(p.createdAt).toLocaleString() : '—' }
            ],
            reason: 'Verification failed', setReason: (r) => setModal(m => ({...m, reason: r}))
        });
    };

    const handleConfirm = async () => {
        setProcessing(true);
        const res = modal.action === 'approve' ? await approveActivation(modal.id) :
                    modal.action === 'reject'  ? await rejectActivation(modal.id, modal.reason) : await deleteActivation(modal.id);
        showToast(res.success ? res.message || 'Operation successful' : res.error, res.success ? 'success' : 'error');
        if (res.success) {
            setPayments(prev => Object.values(prev).map(p => {
                if (p.id !== modal.id) return p;
                return { ...p, status: modal.action === 'approve' ? 'approved' : modal.action === 'reject' ? 'rejected' : 'deleted' };
            }).filter(p => p.status !== 'deleted'));
        }
        setModal(null); setProcessing(false);
    };

    return (
        <div>
            <ConfirmModal modal={modal} onClose={() => setModal(null)} onConfirm={handleConfirm} processing={processing} />
            <h1 className="gov-title">Payment Logs</h1>
            <p className="gov-subtitle">Official treasury incoming logs & verification queue</p>
            
            <div className="gov-payments-toolbar">
                <input className="gov-input gov-payments-search" placeholder="Search invoices..." value={q} onChange={e => setQ(e.target.value)} />
            </div>
            
            <div className="gov-table-container">
                <table className="gov-table">
                    <thead><tr><th>Invoice ID</th><th>Gateway</th><th>Transfer Amount</th><th>Timestamp</th><th>Status</th><th>Audit Actions</th></tr></thead>
                    <tbody>
                        {filtered.map(p => {
                            const u = usersMap[p.uid] || {};
                            const cCode = (u.countryCode || 'TZ').toLowerCase();
                            const rate = u.exchangeRate || 2600;
                            const currency = u.currency || 'TSh';
                            return (
                                <tr key={p.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <img src={`https://flagcdn.com/w40/${cCode}.png`} alt={cCode} style={{ width: 24, height: 16, objectFit: 'cover', borderRadius: 2 }} />
                                            <div>
                                                <div className="gov-mono-text">{p.reference || p.transactionId || p.id.slice(0,8)}</div>
                                                <div style={{ fontSize: 11, color: '#999' }}>UID: {p.uid.slice(0,10)}...</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td><b>{p.method || p.channel || 'PalmPesa'}</b></td>
                                    <td className="gov-amount-highlight">
                                        {(() => {
                                            const nativeAmt = p.amountTZS || p.nativeAmount || p.amount || 0;
                                            const cur = u.currency || p.nativeCurrency || 'TZS';
                                            return `${cur} ${Number(nativeAmt).toLocaleString()}`;
                                        })()}
                                    </td>
                                    <td>{p.createdAt ? new Date(p.createdAt).toLocaleString() : 'N/A'}</td>
                                    <td><StatusBadge status={p.status} /></td>
                                    <td>
                                        <div className="gov-action-group">
                                            {p.status !== 'completed' && p.status !== 'approved' && p.status !== 'rejected' && <>
                                                <button className="gov-btn gov-btn-success" onClick={()=>openModal('approve', p)}>Approve</button>
                                                <button className="gov-btn gov-btn-danger" onClick={()=>openModal('reject', p)}>Reject</button>
                                            </>}
                                            <button className="gov-btn gov-btn-outline" onClick={()=>openModal('delete', p)}>Delete</button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   WITHDRAWALS
═══════════════════════════════════════════════════════════ */
export function AdminWithdrawals() {
    const { showToast } = useToast();
    const [items, setItems] = useState([]);
    const [usersMap, setUsersMap] = useState({});
    const [processing, setProcessing] = useState(false);
    const [modal, setModal] = useState(null);
    const [q, setQ] = useState('');

    const load = useCallback(() => {
        Promise.all([ getDocs(collection(db, 'withdrawals')), getDocs(collection(db, 'users')) ]).then(([wSnap, uSnap]) => {
            if (!uSnap.empty) {
                const uMap = {};
                uSnap.docs.forEach(d => uMap[d.id] = d.data());
                setUsersMap(uMap);
            }
            const all = [];
            if (!wSnap.empty) {
                wSnap.docs.forEach(d => all.push({ id: d.id, ...d.data() }));
            }
            setItems(all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
        });
    }, []);

    useEffect(() => { load(); }, [load]);

    const filtered = items.filter(w => !q || w.uid?.toLowerCase().includes(q.toLowerCase()) || w.phone?.includes(q));

    const openModal = (action, w) => {
        const u = usersMap[w.uid] || {};
        const currency = w.currency || u.currency || 'TZS';
        const nativeAmt = w.amount || 0;
        setModal({
            action, id: w.id, uid: w.uid,
            title: action === 'approve' ? 'Authenticate Payout' : action === 'reject' ? 'Deny Payout' : 'Strike Record',
            subtitle: `Disbursement requisition ${w.id}`,
            details: [
                { label: 'Client ID', value: w.uid },
                { label: 'Username', value: u.username || u.fullName || '—' },
                { label: 'Amount', value: `${currency} ${Number(nativeAmt).toLocaleString()}` },
                { label: 'Fee', value: w.fee ? `${currency} ${Number(w.fee).toLocaleString()}` : 'None' },
                { label: 'Destination', value: w.phone || w.phoneNumber || w.address || '—' },
                { label: 'Gateway', value: w.method || '—' }
            ],
            reason: 'Compliance Failure', setReason: (r) => setModal(m => ({...m, reason: r}))
        });
    };

    const handleConfirm = async () => {
        setProcessing(true);
        const res = modal.action === 'approve' ? await approveWithdrawal(modal.uid, modal.id) :
                    modal.action === 'reject'  ? await rejectWithdrawal(modal.uid, modal.id, modal.reason) : await deleteWithdrawal(modal.uid, modal.id);
        showToast(res.success ? res.message || 'Complete' : res.error, res.success ? 'success' : 'error');
        if (res.success) {
            setItems(prev => Object.values(prev).map(w => {
                if (w.id !== modal.id) return w;
                return { ...w, status: modal.action === 'approve' ? 'approved' : modal.action === 'reject' ? 'rejected' : 'deleted' };
            }).filter(w => w.status !== 'deleted'));
        }
        setModal(null); setProcessing(false);
    };

    return (
        <div>
            <ConfirmModal modal={modal} onClose={() => setModal(null)} onConfirm={handleConfirm} processing={processing} />
            <h1 className="gov-title">Disbursement Queue</h1>
            <p className="gov-subtitle">Treasury payout requisitions monitoring</p>
            
            <div className="gov-withdrawals-toolbar">
                <input className="gov-input gov-withdrawals-search" placeholder="Search requistions..." value={q} onChange={e => setQ(e.target.value)} />
            </div>
            
            <div className="gov-table-container">
                <table className="gov-table">
                    <thead><tr><th>Recipient UID</th><th>Disbursement Val</th><th>Target Account / Routing</th><th>Gateway</th><th>Status</th><th>Audit Actions</th></tr></thead>
                    <tbody>
                        {filtered.map(w => {
                            const u = usersMap[w.uid] || {};
                            const cCode = (u.countryCode || 'TZ').toLowerCase();
                            const rate = u.exchangeRate || 2600;
                            const currency = u.currency || 'TSh';
                            return (
                                <tr key={w.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <img src={`https://flagcdn.com/w40/${cCode}.png`} alt={cCode} style={{ width: 24, height: 16, objectFit: 'cover', borderRadius: 2 }} />
                                            <div style={{ fontFamily: 'monospace', fontSize: 12 }}>{w.uid.slice(0, 16)}...</div>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 700, color: 'var(--gov-blue)' }}>
                                            {w.currency || u.currency || 'TZS'} {Number(w.amount || 0).toLocaleString()}
                                        </div>
                                        {w.fee > 0 && <div style={{ fontSize: 11, color: '#999' }}>Fee: {Number(w.fee).toLocaleString()}</div>}
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{w.phone || w.phoneNumber || w.address || 'MISSING'}</div>
                                        <div className="gov-wd-label">Destination</div>
                                    </td>
                                    <td><span className="gov-method-badge">{w.method || 'Unknown'}</span></td>
                                    <td><StatusBadge status={w.status} /></td>
                                    <td>
                                        <div className="gov-action-group">
                                            {w.status === 'pending' && <>
                                                <button className="gov-btn gov-btn-success" onClick={()=>openModal('approve', w)}>Authorize</button>
                                                <button className="gov-btn gov-btn-danger" onClick={()=>openModal('reject', w)}>Deny</button>
                                            </>}
                                            <button className="gov-btn gov-btn-outline" onClick={()=>openModal('delete', w)}>Delete</button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   REFERRALS
═══════════════════════════════════════════════════════════ */
export function AdminReferrals() {
    const [users, setUsers] = useState([]);
    useEffect(() => {
        getDocs(collection(db, 'users')).then(snap => {
            if (snap.empty) return;
            const all = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
            // Only those who have downlines
            setUsers(all.filter(u => u.downlines?.level1 > 0).sort((a,b) => (b.downlines?.level1||0) - (a.downlines?.level1||0)));
        });
    }, []);

    return (
        <div>
            <h1 className="gov-title">Referral Network</h1>
            <p className="gov-subtitle">Analysis of top promoters and their downline trees</p>
            <div className="gov-table-container">
                <table className="gov-table">
                    <thead><tr><th>Promoter ID</th><th>Username</th><th>Direct Recruits (Lv1)</th><th>Level 2</th><th>Level 3</th></tr></thead>
                    <tbody>
                        {users.map(u => (
                            <tr key={u.uid}>
                                <td style={{fontFamily: 'monospace'}}>{u.uid.slice(0, 12)}...</td>
                                <td style={{fontWeight: 700}}>{u.username || 'N/A'}</td>
                                <td style={{color: '#2E7D32', fontWeight: 700}}>{u.downlines?.level1 || 0} users</td>
                                <td>{u.downlines?.level2 || 0} users</td>
                                <td>{u.downlines?.level3 || 0} users</td>
                            </tr>
                        ))}
                        {users.length === 0 && <tr><td colSpan={5} className="gov-empty-state">No referral network data found.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   TASKS & SHOP & SETTINGS
═══════════════════════════════════════════════════════════ */
export function AdminTasks() {
    const { showToast } = useToast();
    const [tasks, setTasks] = useState([]);
    const [adding, setAdding] = useState(false);
    const [newTask, setNewTask] = useState({ title: '', reward: '0.50', link: '' });

    const loadTasks = useCallback(() => {
        getDocs(collection(db, 'tasks')).then(s => {
            if (!s.empty) setTasks(s.docs.map(d => ({ id: d.id, ...d.data() })));
            else setTasks([]);
        });
    }, []);

    useEffect(() => { loadTasks(); }, [loadTasks]);

    const handleCreate = async () => {
        if (!newTask.title || !newTask.reward) return;
        try {
            await addDoc(collection(db, 'tasks'), { ...newTask, reward: parseFloat(newTask.reward), createdAt: Date.now() });
            showToast('Task assigned', 'success');
            setAdding(false); setNewTask({ title: '', reward: '0.50', link: '' });
            loadTasks();
        } catch(e) { showToast('Error creating task', 'error'); }
    };
    const handleDelete = async (id) => {
        if (!window.confirm('Delete this task?')) return;
        try { await deleteDoc(doc(db, 'tasks', id)); loadTasks(); } catch(e) {}
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h1 className="gov-title">Task Assignments</h1>
                    <p className="gov-subtitle" style={{margin:0}}>Configure daily operations available to users</p>
                </div>
                <button className="gov-btn gov-btn-primary" onClick={() => setAdding(!adding)}>+ New Task</button>
            </div>
            
            {adding && (
                <div className="gov-panel" style={{ padding: 20, marginBottom: 24, maxWidth: 600 }}>
                    <div style={{marginBottom: 12}}><input className="gov-input" placeholder="Task Title" value={newTask.title} onChange={e=>setNewTask({...newTask, title: e.target.value})} /></div>
                    <div style={{marginBottom: 12}}><input className="gov-input" placeholder="Reward (USD)" type="number" step="0.01" value={newTask.reward} onChange={e=>setNewTask({...newTask, reward: e.target.value})} /></div>
                    <div style={{marginBottom: 12}}><input className="gov-input" placeholder="Target Link (optional)" value={newTask.link} onChange={e=>setNewTask({...newTask, link: e.target.value})} /></div>
                    <button className="gov-btn gov-btn-success" onClick={handleCreate}>Deploy Task</button>
                </div>
            )}
            
            <div className="gov-table-container">
                <table className="gov-table">
                    <thead><tr><th>Task ID</th><th>Description</th><th>Target Reward</th><th>Action</th></tr></thead>
                    <tbody>
                        {tasks.map(t => (
                            <tr key={t.id}>
                                <td style={{fontFamily: 'monospace'}}>{t.id.slice(0, 8)}...</td>
                                <td>{t.title}</td>
                                <td><b>${(t.reward||0).toFixed(2)}</b></td>
                                <td><button className="gov-btn gov-btn-danger" onClick={() => handleDelete(t.id)}>Delete</button></td>
                            </tr>
                        ))}
                        {tasks.length === 0 && <tr><td colSpan={4} className="gov-empty-state">No active tasks configured.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export function AdminShop() {
    const { showToast } = useToast();
    const [products, setProducts] = useState([]);
    const [adding, setAdding] = useState(false);
    const [newProduct, setNewProduct] = useState({ title: '', price: '10.00', image: '' });

    const loadProducts = useCallback(() => { getDocs(collection(db, 'products')).then(s => setProducts(!s.empty ? s.docs.map(d => ({ id: d.id, ...d.data() })) : [])); }, []);
    useEffect(() => { loadProducts(); }, [loadProducts]);

    const handleCreate = async () => {
        if (!newProduct.title || !newProduct.price) return;
        try {
            await addDoc(collection(db, 'products'), { ...newProduct, price: parseFloat(newProduct.price) });
            showToast('Item recorded', 'success');
            setAdding(false); setNewProduct({ title: '', price: '10.00', image: '' });
            loadProducts();
        } catch(e) {}
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete vendor item?')) return;
        try { await deleteDoc(doc(db, 'products', id)); loadProducts(); } catch(e) {}
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h1 className="gov-title">Vendor Management</h1>
                    <p className="gov-subtitle" style={{margin:0}}>Platform marketplace items and inventory</p>
                </div>
                <button className="gov-btn gov-btn-primary" onClick={() => setAdding(!adding)}>+ Add Product</button>
            </div>

            {adding && (
                <div className="gov-panel" style={{ padding: 20, marginBottom: 24, maxWidth: 600 }}>
                    <div style={{marginBottom: 12}}><input className="gov-input" placeholder="Item Name" value={newProduct.title} onChange={e=>setNewProduct({...newProduct, title: e.target.value})} /></div>
                    <div style={{marginBottom: 12}}><input className="gov-input" placeholder="Price (USD)" type="number" step="0.01" value={newProduct.price} onChange={e=>setNewProduct({...newProduct, price: e.target.value})} /></div>
                    <div style={{marginBottom: 12}}><input className="gov-input" placeholder="Image URL (optional)" value={newProduct.image} onChange={e=>setNewProduct({...newProduct, image: e.target.value})} /></div>
                    <button className="gov-btn gov-btn-success" onClick={handleCreate}>Stock Item</button>
                </div>
            )}

            <div className="gov-table-container">
                <table className="gov-table">
                    <thead><tr><th>Item Code</th><th>Description</th><th>Cost Basis</th><th>Audit Action</th></tr></thead>
                    <tbody>
                        {products.map((p,i) => (
                            <tr key={i}>
                                <td style={{fontFamily: 'monospace'}}>{p.id.slice(0,8)}...</td>
                                <td>{p.title || p.name}</td>
                                <td><b>${(p.price||0).toFixed(2)}</b></td>
                                <td><button className="gov-btn gov-btn-danger" onClick={() => handleDelete(p.id)}>De-list</button></td>
                            </tr>
                        ))}
                        {products.length === 0 && <tr><td colSpan={4} className="gov-empty-state">No products found in marketplace.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export function AdminSettings() {
    const { showToast } = useToast();
    const [settings, setSettings] = useState({
        activationFees: { TZS: 14500, KES: 650, UGX: 18500 },
        minWithdrawals: { TZS: 10000, KES: 500, UGX: 15000 },
        withdrawFees: { TZS: 1000, KES: 50, UGX: 1500 }
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        getDocs(collection(db, 'settings')).then(snap => {
            const merged = {};
            snap.docs.forEach(d => Object.assign(merged, d.data()));
            if (Object.keys(merged).length) {
                setSettings(s => ({
                    activationFees: { ...s.activationFees, ...(merged.activationFees || {}) },
                    minWithdrawals: { ...s.minWithdrawals, ...(merged.minWithdrawals || {}) },
                    withdrawFees: { ...s.withdrawFees, ...(merged.withdrawFees || {}) }
                }));
            }
        });
    }, []);

    const handleChange = (category, currency, val) => {
        setSettings(prev => ({
            ...prev,
            [category]: {
                ...prev[category],
                [currency]: val
            }
        }));
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const { setDoc } = await import('../../services/firebase-config.js');
            await setDoc(doc(db, 'settings', 'general'), {
                activationFees: settings.activationFees,
                minWithdrawals: settings.minWithdrawals,
                withdrawFees: settings.withdrawFees
            }, { merge: true });
            showToast('Parameters synced to database natively.', 'success');
        } catch(e) { showToast('Update override failed', 'error'); }
        setLoading(false);
    };

    const Currencies = ['TZS', 'KES', 'UGX', 'MWK', 'ZMW', 'RWF', 'BIF', 'CDF'];

    return (
        <div>
            <h1 className="gov-title">System Parameters</h1>
            <p className="gov-subtitle">Native per-country platform configuration</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, paddingBottom: 40 }}>
                
                <div className="gov-panel" style={{ padding: 24 }}>
                    <h3 style={{marginTop: 0, marginBottom: 20}}>Activation Fees (Native)</h3>
                    {Currencies.map(c => (
                        <div key={c} style={{display: 'flex', alignItems: 'center', marginBottom: 12}}>
                            <div style={{width: 60, fontWeight: 700}}>{c}</div>
                            <input className="gov-input" type="number" value={settings.activationFees[c] ?? ''} onChange={e => handleChange('activationFees', c, parseFloat(e.target.value))} style={{margin:0, flex: 1}} />
                        </div>
                    ))}
                </div>

                <div className="gov-panel" style={{ padding: 24 }}>
                    <h3 style={{marginTop: 0, marginBottom: 20}}>Minimum Withdrawals</h3>
                    {Currencies.map(c => (
                        <div key={c} style={{display: 'flex', alignItems: 'center', marginBottom: 12}}>
                            <div style={{width: 60, fontWeight: 700}}>{c}</div>
                            <input className="gov-input" type="number" value={settings.minWithdrawals[c] ?? ''} onChange={e => handleChange('minWithdrawals', c, parseFloat(e.target.value))} style={{margin:0, flex: 1}} />
                        </div>
                    ))}
                </div>

            </div>
            
            <button className="gov-btn gov-btn-primary" onClick={handleSave} disabled={loading} style={{ width: 300, display: 'block', marginBottom: 40 }}>
                {loading ? 'Applying...' : 'Apply Native Parameters'}
            </button>
        </div>
    );
}
