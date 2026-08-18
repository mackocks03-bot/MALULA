import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { db, doc, collection, getDocs, updateDoc, deleteDoc, addDoc } from '../../services/firebase-config.js';
import { approveActivation, rejectActivation, deleteActivation } from '../../services/activation.js';
import { approveWithdrawal, rejectWithdrawal, deleteWithdrawal } from '../../services/withdraw.js';
import { approveShopDeposit, rejectShopDeposit, deleteShopDeposit } from '../../services/shopDeposits.js';
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
    users: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75',
    payments: 'M2 5h20v14H2z M2 10h20',
    withdraw: 'M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
    referrals: 'M16 3.13a4 4 0 010 7.75 M11 7a4 4 0 100 8 4 4 0 000-8z',
    tasks: 'M9 11l3 3L22 4 M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
    settings: 'M12 15a3 3 0 100-6 3 3 0 000 6z',
    shop: 'M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z M3 6h18 M16 10a4 4 0 01-8 0',
    back: 'M19 12H5 M12 19l-7-7 7-7',
    check: 'M20 6L9 17l-5-5',
    x: 'M18 6L6 18 M6 6l12 12',
    trash: 'M3 6h18 M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2',
    refresh: 'M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15',
    wallet: 'M21 8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0022 16z M12 22V12 M2.3 7l9.7 5 9.7-5',
    search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0',
};

const adminLinks = [
    { to: '/admin/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { to: '/admin/users', label: 'Users Directory', icon: 'users' },
    { to: '/admin/payments', label: 'Activation Payments', icon: 'payments' },
    { to: '/admin/deposits', label: 'Wallet Deposits', icon: 'wallet' },
    { to: '/admin/withdrawals', label: 'Withdrawal Queue', icon: 'withdraw' },
    { to: '/admin/referrals', label: 'Referral Tracking', icon: 'referrals' },
    { to: '/admin/tasks', label: 'Task Assignments', icon: 'tasks' },
    { to: '/admin/shop', label: 'Vendor Management', icon: 'shop' },
    { to: '/admin/settings', label: 'System Parameters', icon: 'settings' },
];

/* ─────────────────────── Shared components ─────────────────────── */
function StatusBadge({ status }) {
    const map = {
        approved: ['success', 'APPROVED'],
        active: ['success', 'ACTIVE'],
        pending: ['warning', 'PENDING'],
        rejected: ['danger', 'REJECTED'],
        completed: ['success', 'COMPLETED'],
        COMPLETED: ['success', 'COMPLETED'],
        failed: ['danger', 'FAILED'],
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
            <div className={`gov-modal ${isDelete || isReject ? 'danger-border' : ''}`} style={isDelete || isReject ? { borderTopColor: 'var(--gov-danger)' } : {}}>
                <div className="gov-modal-header">
                    <h3>{modal.title}</h3>
                    <button className="gov-modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="gov-modal-body">
                    <p className="gov-subtitle" style={{ marginBottom: 16 }}>{modal.subtitle}</p>

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
            try { if (JSON.parse(stored).role === 'admin') { setVerified(true); return; } } catch { }
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
                    if (u.createdAt) acts.push({ type: 'user', title: `System Registration`, sub: `User: ${u.uid?.slice(0, 8)}`, time: u.createdAt });
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
            setActivity(acts.sort((a, b) => b.time - a.time).slice(0, 10));
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
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: a.type === 'user' ? '#0288D1' : a.type === 'payment' ? '#2E7D32' : '#ED6C02' }}></div>
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
function UserProfileModal({ user, onClose, onUpdateStatus, onSave }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({});

    // reset when user changes
    useEffect(() => {
        if (user) {
            setEditData({
                email: user.email || '',
                phone: user.phone || '',
                fullName: user.fullName || '',
                countryCode: user.countryCode || '',
                countryName: user.countryName || user.country || '',
                currency: user.currency || 'TZS',
                username: user.username || '',
                referralLink: user.referralLink || '',
                balance: user.balance || 0,
                totalWithdrawn: user.totalWithdrawn || 0,
                referrer: user.referrer || '',
                miningRate: user.miningRate || 0,
                downlinesLevel1: user.referrals?.level1?.length ?? user.downlines?.level1 ?? 0,
                downlinesLevel2: user.referrals?.level2?.length ?? user.downlines?.level2 ?? 0,
                downlinesLevel3: user.referrals?.level3?.length ?? user.downlines?.level3 ?? 0,
                isActive: user.isActive || false,
                activationStatus: user.activationStatus || 'pending'
            });
            setIsEditing(false);
        }
    }, [user]);

    if (!user) return null;
    const cCode = (editData.countryCode || user.countryCode || 'TZ').toLowerCase();
    const curr = editData.currency || user.currency || 'TZS';

    return (
        <div className="gov-modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="gov-modal" style={{ maxWidth: 650 }}>
                <div className="gov-modal-header">
                    <div>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <img src={`https://flagcdn.com/w40/${cCode}.png`} alt={cCode} style={{ width: 24, height: 16, borderRadius: 2 }} />
                            {isEditing ? (
                                <input className="gov-input" value={editData.username} onChange={e => setEditData({ ...editData, username: e.target.value })} placeholder="Username" style={{ padding: '4px 8px' }} />
                            ) : (
                                `Personnel Profile: ${user.username || 'N/A'}`
                            )}
                        </h3>
                        <div style={{ fontSize: 12, color: '#666', marginTop: 4, fontFamily: 'monospace' }}>UID: {user.uid}</div>
                    </div>
                    <button className="gov-modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="gov-modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxHeight: '70vh', overflowY: 'auto' }}>
                    <div>
                        <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: '#999', marginBottom: 12, borderBottom: '1px solid #eee', paddingBottom: 4 }}>Identity & Contact</h4>
                        {isEditing ? (
                            <>
                                <div style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 4 }}><b>Full Name:</b> <input className="gov-input" style={{ width: '100%', padding: 4 }} value={editData.fullName} onChange={e => setEditData({ ...editData, fullName: e.target.value })} /></div>
                                <div style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 4 }}><b>Email:</b> <input className="gov-input" style={{ width: '100%', padding: 4 }} value={editData.email} onChange={e => setEditData({ ...editData, email: e.target.value })} /></div>
                                <div style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 4 }}><b>Phone:</b> <input className="gov-input" style={{ width: '100%', padding: 4 }} value={editData.phone} onChange={e => setEditData({ ...editData, phone: e.target.value })} /></div>
                                <div style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 4 }}><b>Country Code (Flag):</b> <input className="gov-input" style={{ width: '100%', padding: 4 }} value={editData.countryCode} onChange={e => setEditData({ ...editData, countryCode: e.target.value })} placeholder="e.g. TZ, KE, NG" /></div>
                                <div style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 4 }}><b>Country Name:</b> <input className="gov-input" style={{ width: '100%', padding: 4 }} value={editData.countryName} onChange={e => setEditData({ ...editData, countryName: e.target.value })} /></div>
                                <div style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 4 }}><b>Currency:</b> <input className="gov-input" style={{ width: '100%', padding: 4 }} value={editData.currency} onChange={e => setEditData({ ...editData, currency: e.target.value })} /></div>
                            </>
                        ) : (
                            <>
                                <div style={{ marginBottom: 8 }}><b>Name:</b> {user.fullName || '—'}</div>
                                <div style={{ marginBottom: 8 }}><b>Email:</b> {user.email || '—'}</div>
                                <div style={{ marginBottom: 8 }}><b>Phone:</b> {user.phone || '—'}</div>
                                <div style={{ marginBottom: 8 }}><b>Country:</b> {user.countryName || user.country || '—'} ({cCode.toUpperCase()})</div>
                                <div style={{ marginBottom: 8 }}><b>Currency:</b> {curr}</div>
                            </>
                        )}
                        <div style={{ marginBottom: 8 }}><b>Joined:</b> {user.createdAt ? new Date(user.createdAt).toLocaleString() : '—'}</div>
                        {isEditing ? (
                            <>
                                <div style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <b>Access Status (isActive):</b>
                                    <select className="gov-input" style={{ padding: 4 }} value={editData.isActive} onChange={e => setEditData({ ...editData, isActive: e.target.value === 'true' })}>
                                        <option value="true">Active</option>
                                        <option value="false">Suspended</option>
                                    </select>
                                </div>
                                <div style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <b>Activation Step:</b>
                                    <select className="gov-input" style={{ padding: 4 }} value={editData.activationStatus} onChange={e => setEditData({ ...editData, activationStatus: e.target.value })}>
                                        <option value="pending">Pending</option>
                                        <option value="approved">Approved</option>
                                        <option value="rejected">Rejected</option>
                                    </select>
                                </div>
                            </>
                        ) : (
                            <div style={{ marginBottom: 8 }}><b>Status:</b> <StatusBadge status={user.isActive ? 'active' : 'pending'} /> <span>( {user.activationStatus || 'N/A'} )</span></div>
                        )}
                    </div>
                    <div>
                        <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: '#999', marginBottom: 12, borderBottom: '1px solid #eee', paddingBottom: 4 }}>Financial & Network</h4>
                        {isEditing ? (
                            <>
                                <div style={{ marginBottom: 8, color: '#2E7D32', fontWeight: 700, display: 'flex', flexDirection: 'column', gap: 4 }}><b>Ledger Balance ({curr}):</b> <input className="gov-input" type="number" step="0.01" style={{ width: '100%', padding: 4 }} value={editData.balance} onChange={e => setEditData({ ...editData, balance: e.target.value })} /></div>
                                <div style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 4 }}><b>Total Withdrawn ({curr}):</b> <input className="gov-input" type="number" step="0.01" style={{ width: '100%', padding: 4 }} value={editData.totalWithdrawn} onChange={e => setEditData({ ...editData, totalWithdrawn: e.target.value })} /></div>
                                <div style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 4 }}><b>Referrer ID:</b> <input className="gov-input" style={{ width: '100%', padding: 4 }} value={editData.referrer} onChange={e => setEditData({ ...editData, referrer: e.target.value })} /></div>
                                <div style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <b>Downlines (Lv1/Lv2/Lv3):</b>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        <input className="gov-input" type="number" style={{ width: 50, padding: 4 }} value={editData.downlinesLevel1} onChange={e => setEditData({ ...editData, downlinesLevel1: e.target.value })} />/
                                        <input className="gov-input" type="number" style={{ width: 50, padding: 4 }} value={editData.downlinesLevel2} onChange={e => setEditData({ ...editData, downlinesLevel2: e.target.value })} />/
                                        <input className="gov-input" type="number" style={{ width: 50, padding: 4 }} value={editData.downlinesLevel3} onChange={e => setEditData({ ...editData, downlinesLevel3: e.target.value })} />
                                    </div>
                                </div>
                                <div style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 4 }}><b>Mining Rate (/hr):</b> <input className="gov-input" type="number" step="0.01" style={{ width: '100%', padding: 4 }} value={editData.miningRate} onChange={e => setEditData({ ...editData, miningRate: e.target.value })} /></div>
                                <div style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 4 }}><b>Referral Link:</b> <input className="gov-input" style={{ width: '100%', padding: 4 }} value={editData.referralLink} onChange={e => setEditData({ ...editData, referralLink: e.target.value })} /></div>
                            </>
                        ) : (
                            <>
                                <div style={{ marginBottom: 8, color: '#2E7D32', fontWeight: 700 }}><b>Ledger Balance:</b> {curr} {(user.balance || 0).toFixed(2)}</div>
                                <div style={{ marginBottom: 8 }}><b>Total Withdrawn:</b> {curr} {(user.totalWithdrawn || 0).toFixed(2)}</div>
                                <div style={{ marginBottom: 8 }}><b>Referrer ID:</b> <span style={{ fontFamily: 'monospace' }}>{user.referrer || 'None'}</span></div>
                                <div style={{ marginBottom: 8 }}>
                                    <b>Downlines (Lv1/Lv2/Lv3):</b> {user.referrals?.level1?.length ?? user.downlines?.level1 ?? 0} / {user.referrals?.level2?.length ?? user.downlines?.level2 ?? 0} / {user.referrals?.level3?.length ?? user.downlines?.level3 ?? 0}
                                </div>
                                <div style={{ marginBottom: 8 }}><b>Mining Rate:</b> {user.miningRate || 0} / hr</div>
                                <div style={{ marginBottom: 8, fontSize: 11, wordBreak: 'break-all', marginTop: 12 }}><b>Referral Link:</b> <br /><a href={user.referralLink} target="_blank" rel="noreferrer" style={{ color: 'var(--gov-blue)' }}>{user.referralLink || 'N/A'}</a></div>
                            </>
                        )}
                    </div>
                </div>
                <div className="gov-modal-footer">
                    {isEditing ? (
                        <>
                            <button className="gov-btn gov-btn-success" onClick={() => onSave(user.uid, editData)}>Save Changes</button>
                            <button className="gov-btn gov-btn-outline" onClick={() => setIsEditing(false)}>Cancel</button>
                        </>
                    ) : (
                        <>
                            <button className="gov-btn gov-btn-primary" onClick={() => setIsEditing(true)}>Edit Details</button>
                            <button className="gov-btn gov-btn-danger" onClick={() => onUpdateStatus(user.uid, !user.isActive)}>
                                {user.isActive ? 'Suspend User' : 'Unsuspend User'}
                            </button>
                            <button className="gov-btn gov-btn-outline" onClick={onClose}>Close Registry</button>
                        </>
                    )}
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
        } catch (e) {
            showToast('Failed to update user', 'error');
        }
    };

    const handleSaveUser = async (uid, data) => {
        try {
            await updateDoc(doc(db, 'users', uid), {
                email: data.email,
                phone: data.phone,
                fullName: data.fullName,
                countryCode: data.countryCode,
                countryName: data.countryName,
                country: data.countryName, // Add fallback
                currency: data.currency,
                username: data.username,
                referralLink: data.referralLink,
                balance: Number(data.balance) || 0,
                totalWithdrawn: Number(data.totalWithdrawn) || 0,
                referrer: data.referrer,
                miningRate: Number(data.miningRate) || 0,
                isActive: data.isActive,
                activationStatus: data.activationStatus,
                'downlines.level1': Number(data.downlinesLevel1) || 0,
                'downlines.level2': Number(data.downlinesLevel2) || 0,
                'downlines.level3': Number(data.downlinesLevel3) || 0
            });
            showToast('User details updated successfully', 'success');
            setSelectedUser(null);
            loadUsers();
        } catch (e) {
            showToast('Failed to save details', 'error');
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
            <UserProfileModal user={selectedUser} onClose={() => setSelectedUser(null)} onUpdateStatus={handleUpdateStatus} onSave={handleSaveUser} />
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
                                            <div className="gov-user-avatar">{(u.username || '?').slice(0, 2).toUpperCase()}</div>
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
        Promise.all([getDocs(collection(db, 'activationPayments')), getDocs(collection(db, 'users'))]).then(([pSnap, uSnap]) => {
            if (!uSnap.empty) {
                const uMap = {};
                uSnap.docs.forEach(d => uMap[d.id] = d.data());
                setUsersMap(uMap);
            }
            setPayments(!pSnap.empty ? pSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)) : []);
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
            reason: 'Verification failed', setReason: (r) => setModal(m => ({ ...m, reason: r }))
        });
    };

    const handleConfirm = async () => {
        setProcessing(true);
        const res = modal.action === 'approve' ? await approveActivation(modal.id) :
            modal.action === 'reject' ? await rejectActivation(modal.id, modal.reason) : await deleteActivation(modal.id);
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
                                                <div className="gov-mono-text">{p.reference || p.transactionId || p.id.slice(0, 8)}</div>
                                                <div style={{ fontSize: 11, color: '#999' }}>UID: {p.uid.slice(0, 10)}...</div>
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
                                                <button className="gov-btn gov-btn-success" onClick={() => openModal('approve', p)}>Approve</button>
                                                <button className="gov-btn gov-btn-danger" onClick={() => openModal('reject', p)}>Reject</button>
                                            </>}
                                            <button className="gov-btn gov-btn-outline" onClick={() => openModal('delete', p)}>Delete</button>
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

const CopyIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
);

export function AdminWithdrawals() {
    const { showToast } = useToast();
    const [items, setItems] = useState([]);
    const [usersMap, setUsersMap] = useState({});
    const [processing, setProcessing] = useState(false);
    const [modal, setModal] = useState(null);
    const [q, setQ] = useState('');

    const load = useCallback(() => {
        Promise.all([getDocs(collection(db, 'withdrawals')), getDocs(collection(db, 'users'))]).then(([wSnap, uSnap]) => {
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

    const filtered = items.filter(w => !q ||
        w.uid?.toLowerCase().includes(q.toLowerCase()) ||
        w.phone?.includes(q) ||
        (w.accountName || '').toLowerCase().includes(q.toLowerCase()) ||
        (w.referenceCode || '').toLowerCase().includes(q.toLowerCase()));

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(() => showToast('Copied!', 'success'));
    };

    const openModal = (action, w) => {
        const u = usersMap[w.uid] || {};
        const currency = w.currency || u.currency || 'TZS';
        const nativeAmt = w.amount || 0;
        const details = [
            { label: 'Reference', value: w.referenceCode || w.id },
            { label: 'Client ID', value: w.uid },
            { label: 'Username', value: u.username || u.fullName || '—' },
            { label: 'Account Name', value: w.accountName || '—' },
            { label: 'Wallet', value: w.wallet || 'balance' },
            { label: 'Amount', value: `${currency} ${Number(nativeAmt).toLocaleString()}` },
            { label: 'Fee', value: w.fee ? `${currency} ${Number(w.fee).toLocaleString()}` : 'None' },
            { label: 'Phone', value: w.phone || w.phoneNumber || w.address || '—' },
            { label: 'Gateway', value: w.method || '—' },
            { label: 'Date', value: w.createdAt ? new Date(w.createdAt).toLocaleString() : '—' },
        ];
        setModal({
            action, id: w.id, uid: w.uid,
            title: action === 'approve' ? 'Authenticate Payout' : action === 'reject' ? 'Deny Payout' : 'Strike Record',
            subtitle: `Requisition ${w.referenceCode || w.id}`,
            details,
            reason: 'Compliance Failure', setReason: (r) => setModal(m => ({ ...m, reason: r }))
        });
    };

    const handleConfirm = async () => {
        setProcessing(true);
        const res = modal.action === 'approve' ? await approveWithdrawal(modal.uid, modal.id) :
            modal.action === 'reject' ? await rejectWithdrawal(modal.uid, modal.id, modal.reason) : await deleteWithdrawal(modal.uid, modal.id);
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
                    <thead><tr>
                        <th>Recipient</th>
                        <th>Amount</th>
                        <th>Account Details</th>
                        <th>Wallet / Method</th>
                        <th>Reference</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr></thead>
                    <tbody>
                        {filtered.map(w => {
                            const u = usersMap[w.uid] || {};
                            const cCode = (u.country || 'tz').toLowerCase();
                            const currency = w.currency || u.currency || 'TZS';
                            const phone = w.phone || w.phoneNumber || w.address || '';
                            const name = w.accountName || u.fullName || '—';
                            return (
                                <tr key={w.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <img src={`https://flagcdn.com/w40/${cCode}.png`} alt={cCode} style={{ width: 24, height: 16, objectFit: 'cover', borderRadius: 2 }} />
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: 13 }}>{u.username || u.fullName || '—'}</div>
                                                <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#999' }}>{w.uid?.slice(0, 12)}...</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 800, color: 'var(--gov-blue)', fontSize: 14 }}>
                                            {currency} {Number(w.amount || 0).toLocaleString()} <span style={{ fontSize: 10, fontWeight: 500, color: '#666' }}>(Requested)</span>
                                        </div>
                                        {w.fee > 0 && <div style={{ fontSize: 11, color: '#ca8a04' }}>+ Fee: {currency} {Number(w.fee).toLocaleString()}</div>}
                                        <div style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                                            Payout: {currency} {Number(w.receiveAmount ?? w.amount).toLocaleString()}
                                            <button onClick={() => copyToClipboard(Number(w.receiveAmount ?? w.amount).toString())} title="Copy amount" style={{ border: 'none', background: 'rgba(22,163,74,0.1)', color: '#16a34a', borderRadius: 4, padding: '2px 6px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}><CopyIcon /></button>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span style={{ fontSize: 12, fontWeight: 600 }}>👤 {name}</span>
                                                <button onClick={() => copyToClipboard(name)} title="Copy name" style={{ border: 'none', background: 'rgba(99,102,241,0.1)', color: '#6366f1', borderRadius: 4, padding: '2px 6px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}><CopyIcon /></button>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>📞 {phone || 'N/A'}</span>
                                                {phone && <button onClick={() => copyToClipboard(phone)} title="Copy phone" style={{ border: 'none', background: 'rgba(99,102,241,0.1)', color: '#6366f1', borderRadius: 4, padding: '2px 6px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}><CopyIcon /></button>}
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ fontSize: 12, fontWeight: 700 }}>{w.wallet || 'Main Balance'}</div>
                                        <span className="gov-method-badge">{w.method || 'Unknown'}</span>
                                    </td>
                                    <td>
                                        <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>{w.referenceCode || w.id?.slice(0, 10)}</div>
                                        <div style={{ fontSize: 10, color: '#bbb' }}>{w.createdAt ? new Date(w.createdAt).toLocaleDateString() : ''}</div>
                                    </td>
                                    <td><StatusBadge status={w.status} /></td>
                                    <td>
                                        <div className="gov-action-group">
                                            {w.status === 'pending' && <>
                                                <button className="gov-btn gov-btn-success" onClick={() => openModal('approve', w)}>Authorize</button>
                                                <button className="gov-btn gov-btn-danger" onClick={() => openModal('reject', w)}>Deny</button>
                                            </>}
                                            <button className="gov-btn gov-btn-outline" onClick={() => openModal('delete', w)}>Delete</button>
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
function ReferralDetailModal({ promoter, usersMap, onClose }) {
    if (!promoter) return null;
    const cCode = (promoter.countryCode || promoter.country || 'TZ').toLowerCase();
    // Reconstruct full tree by merging array-based referrals with legacy 'referrer' records
    let lv1Uids = promoter.referrals?.level1 || [];
    let lv2Uids = promoter.referrals?.level2 || [];
    let lv3Uids = promoter.referrals?.level3 || [];

    const allUsers = Object.values(usersMap);

    // Level 1 Legacy
    const pId = promoter.username; // Legacy referrals recorded the referrer username
    const legacyLv1 = allUsers.filter(u => u.referrer && (u.referrer === pId || u.referrer === promoter.uid)).map(u => u.uid);
    lv1Uids = Array.from(new Set([...lv1Uids, ...legacyLv1]));

    // Level 2 Legacy
    if (lv1Uids.length > 0) {
        const lv1Usernames = lv1Uids.map(uid => usersMap[uid]?.username).filter(Boolean);
        const legacyLv2 = allUsers.filter(u => u.referrer && lv1Usernames.includes(u.referrer)).map(u => u.uid);
        lv2Uids = Array.from(new Set([...lv2Uids, ...legacyLv2]));
    }

    // Level 3 Legacy
    if (lv2Uids.length > 0) {
        const lv2Usernames = lv2Uids.map(uid => usersMap[uid]?.username).filter(Boolean);
        const legacyLv3 = allUsers.filter(u => u.referrer && lv2Usernames.includes(u.referrer)).map(u => u.uid);
        lv3Uids = Array.from(new Set([...lv3Uids, ...legacyLv3]));
    }

    const levels = [
        { label: 'Level 1 — Direct Recruits', uids: lv1Uids },
        { label: 'Level 2 — Indirect Recruits', uids: lv2Uids },
        { label: 'Level 3 — Extended Network', uids: lv3Uids },
    ];
    return (
        <div className="gov-modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="gov-modal" style={{ maxWidth: 720 }}>
                <div className="gov-modal-header">
                    <div>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <img src={`https://flagcdn.com/w40/${cCode}.png`} alt={cCode} style={{ width: 22, height: 15, borderRadius: 2 }} />
                            {promoter.username || 'N/A'} — Referral Tree
                        </h3>
                        <div style={{ fontSize: 11, color: '#888', fontFamily: 'monospace', marginTop: 2 }}>{promoter.uid}</div>
                    </div>
                    <button className="gov-modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="gov-modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                    {levels.map(({ label, uids }) => {
                        const active = uids.filter(uid => usersMap[uid]?.isActive).length;
                        const inactive = uids.length - active;
                        return (
                            <div key={label} style={{ marginBottom: 22 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #eee', paddingBottom: 6, marginBottom: 10 }}>
                                    <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: '#555', margin: 0 }}>{label}</h4>
                                    <span style={{ fontSize: 12, color: '#2E7D32', fontWeight: 700 }}>{active} active</span>
                                    {inactive > 0 && <span style={{ fontSize: 12, color: '#999' }}>{inactive} inactive</span>}
                                    <span style={{ fontSize: 12, color: '#aaa' }}>({uids.length} total)</span>
                                </div>
                                {uids.length === 0 ? (
                                    <p style={{ color: '#bbb', fontSize: 13, margin: 0 }}>No referrals at this level.</p>
                                ) : (
                                    <table className="gov-table" style={{ fontSize: 12 }}>
                                        <thead><tr><th>Username</th><th>Country</th><th>Phone</th><th>Joined</th><th>Status</th></tr></thead>
                                        <tbody>
                                            {uids.map(uid => {
                                                const ref = usersMap[uid];
                                                if (!ref) return (<tr key={uid}><td colSpan={5} style={{ color: '#ccc', fontFamily: 'monospace', fontSize: 11 }}>{uid} — not found</td></tr>);
                                                const rc = (ref.countryCode || ref.country || 'TZ').toLowerCase();
                                                return (
                                                    <tr key={uid}>
                                                        <td>
                                                            <div style={{ fontWeight: 600 }}>{ref.username || '—'}</div>
                                                            <div style={{ fontSize: 10, color: '#aaa' }}>{ref.email || '—'}</div>
                                                        </td>
                                                        <td>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                                                <img src={`https://flagcdn.com/w40/${rc}.png`} alt={rc} style={{ width: 18, height: 12, borderRadius: 1, objectFit: 'cover' }} />
                                                                <span>{ref.countryName || rc.toUpperCase()}</span>
                                                            </div>
                                                        </td>
                                                        <td style={{ fontFamily: 'monospace' }}>{ref.phone || '—'}</td>
                                                        <td style={{ color: '#888' }}>{ref.createdAt ? new Date(ref.createdAt).toLocaleDateString() : '—'}</td>
                                                        <td><StatusBadge status={ref.isActive ? 'active' : 'pending'} /></td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        );
                    })}
                </div>
                <div className="gov-modal-footer">
                    <button className="gov-btn gov-btn-outline" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
}

export function AdminReferrals() {
    const [users, setUsers] = useState([]);
    const [usersMap, setUsersMap] = useState({});
    const [q, setQ] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);

    useEffect(() => {
        setLoading(true);
        getDocs(collection(db, 'users'))
            .then(snap => {
                const all = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
                const map = {};
                const referrerCounts = {};

                all.forEach(u => {
                    map[u.uid] = u;
                    if (u.referrer) {
                        referrerCounts[u.referrer] = (referrerCounts[u.referrer] || 0) + 1;
                    }
                });
                setUsersMap(map);

                const getLv1 = u => {
                    const dynamicLegacyLv1 = (referrerCounts[u.username] || 0) + (referrerCounts[u.uid] || 0);
                    return Math.max(u.referrals?.level1?.length || 0, u.downlines?.level1 || 0, u.referralCount || 0, dynamicLegacyLv1);
                };

                setUsers(all.filter(u => getLv1(u) > 0).sort((a, b) => getLv1(b) - getLv1(a)));
                setLoading(false);
            })
            .catch(err => {
                setError(`Permission error: ${err.code || err.message}`);
                setLoading(false);
            });
    }, []);

    const filtered = users.filter(u => !q ||
        u.username?.toLowerCase().includes(q.toLowerCase()) ||
        u.uid?.toLowerCase().includes(q.toLowerCase()) ||
        u.email?.toLowerCase().includes(q.toLowerCase())
    );

    const countLevel = (uids = []) => {
        const active = uids.filter(uid => usersMap[uid]?.isActive).length;
        return { active, inactive: uids.length - active, total: uids.length };
    };

    return (
        <div>
            <ReferralDetailModal promoter={selected} usersMap={usersMap} onClose={() => setSelected(null)} />
            <h1 className="gov-title">Referral Network</h1>
            <p className="gov-subtitle">Click a row to see the full referral tree with active/inactive breakdown per level</p>
            {loading && <p style={{ color: '#888', padding: 16 }}>Loading referral data...</p>}
            {error && (
                <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#856404' }}>
                    <b>⚠ Access Error:</b> {error}
                </div>
            )}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
                <input className="gov-input" style={{ maxWidth: 320, padding: '8px 12px' }}
                    placeholder="Search by username, email or UID..."
                    value={q} onChange={e => setQ(e.target.value)} />
                <span style={{ fontSize: 13, color: '#888' }}>{filtered.length} promoter(s) found</span>
            </div>
            <div className="gov-table-container">
                <table className="gov-table">
                    <thead><tr>
                        <th>Promoter</th>
                        <th>Country</th>
                        <th>Level 1 (Direct)</th>
                        <th>Level 2</th>
                        <th>Level 3</th>
                        <th>Total Network</th>
                        <th>Action</th>
                    </tr></thead>
                    <tbody>
                        {filtered.map(u => {
                            const allUsers = Object.values(usersMap);
                            let lv1Uids = u.referrals?.level1 || [];
                            let lv2Uids = u.referrals?.level2 || [];
                            let lv3Uids = u.referrals?.level3 || [];

                            const pId = u.username;
                            const legacyLv1 = allUsers.filter(usr => usr.referrer && (usr.referrer === pId || usr.referrer === u.uid)).map(usr => usr.uid);
                            lv1Uids = Array.from(new Set([...lv1Uids, ...legacyLv1]));

                            if (lv1Uids.length > 0) {
                                const lv1Usernames = lv1Uids.map(uid => usersMap[uid]?.username).filter(Boolean);
                                const legacyLv2 = allUsers.filter(usr => usr.referrer && lv1Usernames.includes(usr.referrer)).map(usr => usr.uid);
                                lv2Uids = Array.from(new Set([...lv2Uids, ...legacyLv2]));
                            }

                            if (lv2Uids.length > 0) {
                                const lv2Usernames = lv2Uids.map(uid => usersMap[uid]?.username).filter(Boolean);
                                const legacyLv3 = allUsers.filter(usr => usr.referrer && lv2Usernames.includes(usr.referrer)).map(usr => usr.uid);
                                lv3Uids = Array.from(new Set([...lv3Uids, ...legacyLv3]));
                            }

                            const lv1 = countLevel(lv1Uids);
                            const lv2 = countLevel(lv2Uids);
                            const lv3 = countLevel(lv3Uids);

                            // Optional fallback if dynamic calculation somehow misses something
                            const lv1T = Math.max(lv1.total, u.downlines?.level1 || 0, u.referralCount || 0);
                            const lv2T = Math.max(lv2.total, u.downlines?.level2 || 0);
                            const lv3T = Math.max(lv3.total, u.downlines?.level3 || 0);

                            const lv1Missing = Math.max(0, lv1T - lv1.total);
                            const lv2Missing = Math.max(0, lv2T - lv2.total);
                            const lv3Missing = Math.max(0, lv3T - lv3.total);

                            const grand = lv1T + lv2T + lv3T;
                            const cCode = (u.countryCode || u.country || 'TZ').toLowerCase();

                            return (
                                <tr key={u.uid} style={{ cursor: 'pointer' }} onClick={() => setSelected(u)}>
                                    <td>
                                        <div style={{ fontWeight: 700 }}>{u.username || 'N/A'}</div>
                                        <div style={{ fontSize: 10, color: '#aaa', fontFamily: 'monospace' }}>{u.uid.slice(0, 16)}...</div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <img src={`https://flagcdn.com/w40/${cCode}.png`} alt={cCode} style={{ width: 22, height: 15, borderRadius: 2, objectFit: 'cover' }} />
                                            <span style={{ fontSize: 12 }}>{u.countryName || cCode.toUpperCase()}</span>
                                        </div>
                                    </td>
                                    <td>
                                        {lv1.total > 0 ? (
                                            <div>
                                                <span style={{ color: '#2E7D32', fontWeight: 700 }}>{lv1.active} active</span>
                                                {(lv1.inactive + lv1Missing) > 0 && <span style={{ color: '#999', fontSize: 11, marginLeft: 4 }}>/ {lv1.inactive + lv1Missing} inactive</span>}
                                            </div>
                                        ) : lv1T > 0 ? <span style={{ color: '#2E7D32', fontWeight: 700 }}>{lv1T}</span> : <span>0</span>}
                                    </td>
                                    <td>
                                        {lv2.total > 0 ? (
                                            <div>
                                                <span style={{ fontWeight: 600 }}>{lv2.active} active</span>
                                                {(lv2.inactive + lv2Missing) > 0 && <span style={{ color: '#999', fontSize: 11, marginLeft: 4 }}>/ {lv2.inactive + lv2Missing} inactive</span>}
                                            </div>
                                        ) : lv2T > 0 ? <span>{lv2T}</span> : <span>0</span>}
                                    </td>
                                    <td>
                                        {lv3.total > 0 ? (
                                            <div>
                                                <span style={{ fontWeight: 600 }}>{lv3.active} active</span>
                                                {(lv3.inactive + lv3Missing) > 0 && <span style={{ color: '#999', fontSize: 11, marginLeft: 4 }}>/ {lv3.inactive + lv3Missing} inactive</span>}
                                            </div>
                                        ) : lv3T > 0 ? <span>{lv3T}</span> : <span>0</span>}
                                    </td>
                                    <td><span style={{ fontWeight: 700, color: 'var(--gov-blue)' }}>{grand}</span></td>
                                    <td>
                                        <button className="gov-btn gov-btn-outline" style={{ fontSize: 11, padding: '4px 10px' }}
                                            onClick={e => { e.stopPropagation(); setSelected(u); }}>
                                            View Tree
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {filtered.length === 0 && !loading && <tr><td colSpan={7} className="gov-empty-state">No referral network data found.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
}


/* ═══════════════════════════════════════════════════════════
   TASKS ADMIN
═══════════════════════════════════════════════════════════ */
const TASK_CATEGORY_OPTIONS = [
    { value: 'youtube', label: 'YouTube Watch & Earn' },
    { value: 'facebook', label: 'Facebook Watch & Earn' },
    { value: 'whatsapp', label: 'WhatsApp Status Task' },
    { value: 'ads', label: 'Ad Posting Task' },
    { value: 'tiktok', label: 'TikTok Watch & Earn' },
    { value: 'chat', label: 'Chat & Earn' },
    { value: 'challenge', label: 'Weekly Challenge' },
];

const TASK_CURRENCIES = ['TZS', 'KES', 'UGX', 'MWK', 'ZMW', 'RWF', 'BIF', 'CDF'];

const WEEK_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const DEFAULT_SCHEDULE = {
    monday: { category: 'youtube', title: 'YouTube Watch & Earn', totalItems: 10, active: true, description: 'Watch 10 YouTube videos.', videoUrl: '', countryRewards: { TZS: 1000, KES: 50, UGX: 3000, MWK: 800, ZMW: 10, RWF: 500, BIF: 1000, CDF: 1000 } },
    tuesday: { category: 'facebook', title: 'Facebook Watch & Earn', totalItems: 10, active: true, description: 'Watch 10 Facebook videos.', videoUrl: '', countryRewards: { TZS: 1000, KES: 50, UGX: 3000, MWK: 800, ZMW: 10, RWF: 500, BIF: 1000, CDF: 1000 } },
    wednesday: { category: 'whatsapp', title: 'WhatsApp Status Task', totalItems: 5, active: true, description: 'Post 5 WhatsApp statuses.', videoUrl: '', countryRewards: { TZS: 2000, KES: 100, UGX: 6000, MWK: 1600, ZMW: 20, RWF: 1000, BIF: 2000, CDF: 2000 } },
    thursday: { category: 'ads', title: 'Ad Posting Task', totalItems: 10, active: true, description: 'Post 10 ads.', videoUrl: '', countryRewards: { TZS: 1000, KES: 50, UGX: 3000, MWK: 800, ZMW: 10, RWF: 500, BIF: 1000, CDF: 1000 } },
    friday: { category: 'tiktok', title: 'TikTok Watch & Earn', totalItems: 10, active: true, description: 'Watch 10 TikTok videos.', videoUrl: '', countryRewards: { TZS: 1000, KES: 50, UGX: 3000, MWK: 800, ZMW: 10, RWF: 500, BIF: 1000, CDF: 1000 } },
    saturday: { category: 'chat', title: 'Chat & Earn', totalItems: 10, active: true, description: 'Send 10 chat messages.', videoUrl: '', countryRewards: { TZS: 1000, KES: 50, UGX: 3000, MWK: 800, ZMW: 10, RWF: 500, BIF: 1000, CDF: 1000 } },
    sunday: { category: 'challenge', title: 'Weekly Challenge', totalItems: 1, active: true, description: 'Complete weekly challenge.', videoUrl: '', countryRewards: { TZS: 5000, KES: 250, UGX: 15000, MWK: 4000, ZMW: 50, RWF: 2500, BIF: 5000, CDF: 5000 } },
};

export function AdminTasks() {
    const { showToast } = useToast();
    const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE);
    const [editing, setEditing] = useState(null);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        import('../../services/tasks.js').then(({ getScheduledTaskSettings }) => {
            getScheduledTaskSettings().then(r => {
                if (r.success && r.data && Object.keys(r.data).length > 0) {
                    setSchedule(prev => {
                        const merged = { ...prev };
                        for (const day of WEEK_DAYS) {
                            if (r.data[day]) merged[day] = {
                                ...prev[day],
                                ...r.data[day],
                                countryRewards: { ...(prev[day]?.countryRewards || {}), ...(r.data[day]?.countryRewards || {}) }
                            };
                        }
                        return merged;
                    });
                }
                setLoading(false);
            });
        });
    }, []);

    const handleSaveDay = async (day) => {
        setSaving(true);
        try {
            const { updateScheduledTaskSettings } = await import('../../services/tasks.js');
            const result = await updateScheduledTaskSettings(day, schedule[day]);
            if (result.success) {
                showToast(`${day.charAt(0).toUpperCase() + day.slice(1)} task saved!`, 'success');
                setEditing(null);
            } else {
                showToast('Save failed: ' + (result.error || 'Unknown error'), 'error');
            }
        } catch (e) {
            showToast('Error: ' + e.message, 'error');
        }
        setSaving(false);
    };

    const updateDayField = (day, field, value) => {
        setSchedule(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
    };

    const updateCountryReward = (day, currency, value) => {
        setSchedule(prev => ({
            ...prev,
            [day]: {
                ...prev[day],
                countryRewards: { ...(prev[day]?.countryRewards || {}), [currency]: parseFloat(value) || 0 }
            }
        }));
    };

    const dayLabel = (day) => day.charAt(0).toUpperCase() + day.slice(1);

    if (loading) return <div style={{ padding: 32, color: '#888' }}>Loading task schedule...</div>;

    return (
        <div>
            <h1 className="gov-title">Task Schedule Manager</h1>
            <p className="gov-subtitle">Configure per-country earnings and video URLs for each daily task. Changes apply immediately to all users.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {WEEK_DAYS.map(day => {
                    const cfg = schedule[day] || {};
                    const catOption = TASK_CATEGORY_OPTIONS.find(o => o.value === cfg.category);
                    const tzReward = cfg.countryRewards?.TZS || 0;
                    const isEditing = editing === day;

                    return (
                        <div key={day} className="gov-panel" style={{ padding: '16px 20px', opacity: cfg.active === false ? 0.55 : 1 }}>
                            {!isEditing ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                                    <div style={{ minWidth: 100, fontWeight: 700, fontSize: 15, color: 'var(--gov-blue)' }}>{dayLabel(day)}</div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600 }}>{catOption?.label || cfg.category}</div>
                                        <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{cfg.description}</div>
                                        {cfg.videoUrl && <div style={{ fontSize: 11, color: 'var(--gov-blue)', marginTop: 4 }}>🎬 Video: {cfg.videoUrl.slice(0, 50)}...</div>}
                                    </div>
                                    <div style={{ textAlign: 'right', minWidth: 140 }}>
                                        <div style={{ fontWeight: 700, color: '#2E7D32', fontSize: 14 }}>TZS {tzReward.toLocaleString()}</div>
                                        <div style={{ fontSize: 11, color: '#aaa' }}>{cfg.totalItems} items · {Object.keys(cfg.countryRewards || {}).length} countries</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: cfg.active !== false ? '#e8f5e9' : '#fafafa', color: cfg.active !== false ? '#2E7D32' : '#aaa', border: `1px solid ${cfg.active !== false ? '#c8e6c9' : '#eee'}` }}>
                                            {cfg.active !== false ? 'Active' : 'Off'}
                                        </span>
                                        <button className="gov-btn gov-btn-outline" onClick={() => setEditing(day)}>Edit</button>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--gov-blue)', marginBottom: 16 }}>Editing: {dayLabel(day)}</div>

                                    {/* Basic Settings */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                                        <div>
                                            <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>Task Category</label>
                                            <select className="gov-input" value={cfg.category || ''} onChange={e => {
                                                const opt = TASK_CATEGORY_OPTIONS.find(o => o.value === e.target.value);
                                                updateDayField(day, 'category', e.target.value);
                                                if (opt) updateDayField(day, 'title', opt.label);
                                            }}>
                                                {TASK_CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>Custom Title</label>
                                            <input className="gov-input" value={cfg.title || ''} onChange={e => updateDayField(day, 'title', e.target.value)} placeholder="Task title shown to users" />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>Total Items (Videos/Tasks Count)</label>
                                            <input className="gov-input" type="number" step="1" value={cfg.totalItems || 1} onChange={e => updateDayField(day, 'totalItems', parseInt(e.target.value) || 1)} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>Video URL (for YouTube/Facebook/TikTok)</label>
                                            <input className="gov-input" value={cfg.videoUrl || ''} onChange={e => updateDayField(day, 'videoUrl', e.target.value)} placeholder="https://youtube.com/watch?v=..." />
                                        </div>
                                        <div style={{ gridColumn: '1 / -1' }}>
                                            <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>Description</label>
                                            <input className="gov-input" value={cfg.description || ''} onChange={e => updateDayField(day, 'description', e.target.value)} placeholder="Description shown to users" />
                                        </div>
                                    </div>

                                    {/* Per-Country Earnings */}
                                    <div style={{ marginBottom: 16 }}>
                                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 0.5 }}>Earnings Per Country (Total Task Reward)</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                                            {TASK_CURRENCIES.map(curr => (
                                                <div key={curr} style={{ background: '#f8f9fa', borderRadius: 8, padding: '10px 12px', border: '1.5px solid #e0e0e0' }}>
                                                    <label style={{ fontSize: 11, color: '#888', fontWeight: 700, display: 'block', marginBottom: 4 }}>{curr}</label>
                                                    <input
                                                        className="gov-input"
                                                        type="number"
                                                        step="1"
                                                        style={{ margin: 0, padding: '6px 8px', fontWeight: 700, fontSize: 15 }}
                                                        value={cfg.countryRewards?.[curr] ?? ''}
                                                        onChange={e => updateCountryReward(day, curr, e.target.value)}
                                                        placeholder="0"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                                            <input type="checkbox" checked={cfg.active !== false} onChange={e => updateDayField(day, 'active', e.target.checked)} />
                                            Task Active
                                        </label>
                                        <button className="gov-btn gov-btn-primary" onClick={() => handleSaveDay(day)} disabled={saving}>
                                            {saving ? 'Saving...' : 'Save Changes'}
                                        </button>
                                        <button className="gov-btn gov-btn-outline" onClick={() => setEditing(null)}>Cancel</button>
                                        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#2E7D32' }}>
                                            TZS earnings: <b>{(cfg.countryRewards?.TZS || 0).toLocaleString()}</b>
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
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
        } catch (e) { }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete vendor item?')) return;
        try { await deleteDoc(doc(db, 'products', id)); loadProducts(); } catch (e) { }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h1 className="gov-title">Vendor Management</h1>
                    <p className="gov-subtitle" style={{ margin: 0 }}>Platform marketplace items and inventory</p>
                </div>
                <button className="gov-btn gov-btn-primary" onClick={() => setAdding(!adding)}>+ Add Product</button>
            </div>

            {adding && (
                <div className="gov-panel" style={{ padding: 20, marginBottom: 24, maxWidth: 600 }}>
                    <div style={{ marginBottom: 12 }}><input className="gov-input" placeholder="Item Name" value={newProduct.title} onChange={e => setNewProduct({ ...newProduct, title: e.target.value })} /></div>
                    <div style={{ marginBottom: 12 }}><input className="gov-input" placeholder="Price (USD)" type="number" step="0.01" value={newProduct.price} onChange={e => setNewProduct({ ...newProduct, price: e.target.value })} /></div>
                    <div style={{ marginBottom: 12 }}><input className="gov-input" placeholder="Image URL (optional)" value={newProduct.image} onChange={e => setNewProduct({ ...newProduct, image: e.target.value })} /></div>
                    <button className="gov-btn gov-btn-success" onClick={handleCreate}>Stock Item</button>
                </div>
            )}

            <div className="gov-table-container">
                <table className="gov-table">
                    <thead><tr><th>Item Code</th><th>Description</th><th>Cost Basis</th><th>Audit Action</th></tr></thead>
                    <tbody>
                        {products.map((p, i) => (
                            <tr key={i}>
                                <td style={{ fontFamily: 'monospace' }}>{p.id.slice(0, 8)}...</td>
                                <td>{p.title || p.name}</td>
                                <td><b>${(p.price || 0).toFixed(2)}</b></td>
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
        withdrawFeePercent: 13,
        taskMinWithdrawalsBase: { tiktok: 200000, chat: 300000, welcomeBonus: 50000, youtube: 100000, facebook: 100000, whatsapp: 100000, ads: 100000 }
    });
    const [rates, setRates] = useState({ TZS: 2500, KES: 130, UGX: 3700, MWK: 1750, ZMW: 27, RWF: 1350, BIF: 2900, CDF: 2800, MZN: 65 });
    const [commissions, setCommissions] = useState({ level1: 9000, level2: 3000, level3: 1000 });
    const [loading, setLoading] = useState({ fees: false, withdrawals: false, taskLimits: false, rates: false, commissions: false });

    useEffect(() => {
        getDocs(collection(db, 'settings')).then(snap => {
            const merged = {};
            snap.docs.forEach(d => Object.assign(merged, { [d.id]: d.data() }));
            const general = merged.general || {};
            const ratesDoc = merged.rates || {};

            if (Object.keys(general).length) {
                setSettings(s => ({
                    activationFees: { ...s.activationFees, ...(general.activationFees || {}) },
                    minWithdrawals: { ...s.minWithdrawals, ...(general.minWithdrawals || {}) },
                    withdrawFeePercent: general.withdrawFeePercent !== undefined ? general.withdrawFeePercent : s.withdrawFeePercent,
                    taskMinWithdrawalsBase: { ...s.taskMinWithdrawalsBase, ...(general.taskMinWithdrawalsBase || {}) }
                }));
                // Commissions stored as base multipliers, convert to TZS for display
                const tzRate = ratesDoc.TZS || 2500;
                if (general.referralLevel1) setCommissions({ level1: Math.round(general.referralLevel1 * tzRate), level2: Math.round((general.referralLevel2 || 1.2) * tzRate), level3: Math.round((general.referralLevel3 || 0.4) * tzRate) });
            }
            if (Object.keys(ratesDoc).length) {
                setRates(r => ({ ...r, ...ratesDoc }));
            }
        });
    }, []);

    const handleChange = (category, key, val) => {
        setSettings(prev => ({
            ...prev,
            [category]: { ...prev[category], [key]: val }
        }));
    };

    const makeSaveHandler = (fields, key, label) => async () => {
        setLoading(prev => ({ ...prev, [key]: true }));
        try {
            const { setDoc } = await import('../../services/firebase-config.js');
            const payload = {};
            fields.forEach(f => { payload[f] = settings[f]; });
            await setDoc(doc(db, 'settings', 'general'), payload, { merge: true });
            showToast(`${label} saved successfully.`, 'success');
        } catch (e) { showToast('Failed to save. Try again.', 'error'); }
        setLoading(prev => ({ ...prev, [key]: false }));
    };

    const Currencies = ['TZS', 'KES', 'UGX', 'MWK', 'ZMW', 'RWF', 'BIF', 'CDF'];
    const TaskWallets = ['tiktok', 'chat', 'welcomeBonus', 'youtube', 'facebook', 'whatsapp', 'ads'];
    const saveFees = makeSaveHandler(['activationFees'], 'fees', 'Activation Fees');
    const saveWithdrawals = makeSaveHandler(['minWithdrawals', 'withdrawFeePercent'], 'withdrawals', 'Withdrawal Limits');
    const saveTaskLimits = makeSaveHandler(['taskMinWithdrawalsBase'], 'taskLimits', 'Task Wallet Limits');

    return (
        <div>
            <h1 className="gov-title">System Parameters</h1>
            <p className="gov-subtitle">Native per-country platform configuration</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, paddingBottom: 40 }}>

                <div className="gov-panel" style={{ padding: 24 }}>
                    <h3 style={{ marginTop: 0, marginBottom: 20 }}>Activation Fees (Native)</h3>
                    {Currencies.map(c => (
                        <div key={c} style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                            <div style={{ width: 60, fontWeight: 700 }}>{c}</div>
                            <input className="gov-input" type="number" value={settings.activationFees[c] ?? ''} onChange={e => handleChange('activationFees', c, parseFloat(e.target.value))} style={{ margin: 0, flex: 1 }} />
                        </div>
                    ))}
                    <button className="gov-btn gov-btn-primary" onClick={saveFees} disabled={loading.fees} style={{ marginTop: 16, width: '100%' }}>
                        {loading.fees ? 'Saving...' : 'Save Activation Fees'}
                    </button>
                </div>

                <div className="gov-panel" style={{ padding: 24 }}>
                    <h3 style={{ marginTop: 0, marginBottom: 20 }}>Withdrawal Parameters</h3>

                    <div style={{ marginBottom: 20, padding: 12, background: 'rgba(99,102,241,0.05)', borderRadius: 8, border: '1px solid rgba(99,102,241,0.2)' }}>
                        <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--gov-blue)' }}>Universal Withdrawal Fee (%)</div>
                        <input
                            className="gov-input"
                            type="number"
                            step="0.1"
                            value={settings.withdrawFeePercent ?? ''}
                            onChange={e => setSettings(prev => ({ ...prev, withdrawFeePercent: parseFloat(e.target.value) || 0 }))}
                            style={{ margin: 0, width: '100%' }}
                        />
                    </div>

                    <div style={{ fontWeight: 700, marginBottom: 12 }}>Minimum Withdrawal Amounts</div>
                    {Currencies.map(c => (
                        <div key={c} style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                            <div style={{ width: 60, fontWeight: 700 }}>{c}</div>
                            <input className="gov-input" type="number" value={settings.minWithdrawals[c] ?? ''} onChange={e => handleChange('minWithdrawals', c, parseFloat(e.target.value))} style={{ margin: 0, flex: 1 }} />
                        </div>
                    ))}
                    <button className="gov-btn gov-btn-primary" onClick={saveWithdrawals} disabled={loading.withdrawals} style={{ marginTop: 16, width: '100%' }}>
                        {loading.withdrawals ? 'Saving...' : 'Save Withdrawal Limits'}
                    </button>
                </div>

                <div className="gov-panel" style={{ padding: 24 }}>
                    <h3 style={{ marginTop: 0, marginBottom: 20 }}>Task Wallets Minimum (Base TZS)</h3>
                    {['tiktok', 'chat', 'welcomeBonus', 'youtube', 'facebook', 'whatsapp', 'ads'].map(w => (
                        <div key={w} style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                            <div style={{ width: 100, fontWeight: 700, fontSize: 12, textTransform: 'capitalize' }}>{w === 'welcomeBonus' ? 'Welcome' : w.charAt(0).toUpperCase() + w.slice(1)}</div>
                            <input className="gov-input" type="number" value={settings.taskMinWithdrawalsBase[w] ?? ''} onChange={e => handleChange('taskMinWithdrawalsBase', w, parseFloat(e.target.value))} style={{ margin: 0, flex: 1 }} />
                        </div>
                    ))}
                    <button className="gov-btn gov-btn-primary" onClick={saveTaskLimits} disabled={loading.taskLimits} style={{ marginTop: 16, width: '100%' }}>
                        {loading.taskLimits ? 'Saving...' : 'Save Task Wallet Limits'}
                    </button>
                </div>

                {/* ── Exchange Rates Panel ── */}
                <div className="gov-panel" style={{ padding: 24 }}>
                    <h3 style={{ marginTop: 0, marginBottom: 6 }}>Exchange Rates (per USD)</h3>
                    <p style={{ fontSize: 12, color: 'var(--gov-text-muted)', marginBottom: 20 }}>
                        These rates convert USD base amounts to local currency for commissions, task earnings, and withdrawals.
                    </p>
                    {Object.keys(rates).map(c => (
                        <div key={c} style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                            <div style={{ width: 60, fontWeight: 700 }}>{c}</div>
                            <input
                                className="gov-input"
                                type="number"
                                value={rates[c] ?? ''}
                                onChange={e => setRates(prev => ({ ...prev, [c]: parseFloat(e.target.value) || 0 }))}
                                style={{ margin: 0, flex: 1 }}
                            />
                        </div>
                    ))}
                    <button
                        className="gov-btn gov-btn-primary"
                        disabled={loading.rates}
                        style={{ marginTop: 16, width: '100%' }}
                        onClick={async () => {
                            setLoading(prev => ({ ...prev, rates: true }));
                            try {
                                const { setDoc } = await import('../../services/firebase-config.js');
                                await setDoc(doc(db, 'settings', 'rates'), rates, { merge: true });
                                showToast('Exchange rates saved.', 'success');
                            } catch { showToast('Failed to save rates.', 'error'); }
                            setLoading(prev => ({ ...prev, rates: false }));
                        }}
                    >
                        {loading.rates ? 'Saving...' : 'Save Exchange Rates'}
                    </button>
                </div>

                {/* ── Referral Commissions Panel ── */}
                <div className="gov-panel" style={{ padding: 24 }}>
                    <h3 style={{ marginTop: 0, marginBottom: 6 }}>Referral Commissions (TZS)</h3>
                    <p style={{ fontSize: 12, color: 'var(--gov-text-muted)', marginBottom: 20 }}>
                        Enter amounts in TZS. They will be auto-converted to other currencies using the exchange rates above.
                    </p>
                    {[1, 2, 3].map(lvl => (
                        <div key={lvl} style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                            <div style={{ width: 80, fontWeight: 700 }}>Level {lvl}</div>
                            <input
                                className="gov-input"
                                type="number"
                                value={commissions[`level${lvl}`] ?? ''}
                                onChange={e => setCommissions(prev => ({ ...prev, [`level${lvl}`]: parseFloat(e.target.value) || 0 }))}
                                style={{ margin: 0, flex: 1 }}
                                placeholder={lvl === 1 ? '9000' : lvl === 2 ? '3000' : '1000'}
                            />
                            <span style={{ marginLeft: 8, color: 'var(--gov-text-muted)', fontSize: 11 }}>TZS</span>
                        </div>
                    ))}
                    <button
                        className="gov-btn gov-btn-primary"
                        disabled={loading.commissions}
                        style={{ marginTop: 16, width: '100%' }}
                        onClick={async () => {
                            setLoading(prev => ({ ...prev, commissions: true }));
                            try {
                                const { setDoc } = await import('../../services/firebase-config.js');
                                const tzRate = rates.TZS || 2500;
                                await setDoc(doc(db, 'settings', 'general'), {
                                    referralLevel1: commissions.level1 / tzRate,
                                    referralLevel2: commissions.level2 / tzRate,
                                    referralLevel3: commissions.level3 / tzRate,
                                }, { merge: true });
                                showToast('Referral commissions saved.', 'success');
                            } catch { showToast('Failed to save commissions.', 'error'); }
                            setLoading(prev => ({ ...prev, commissions: false }));
                        }}
                    >
                        {loading.commissions ? 'Saving...' : 'Save Referral Commissions'}
                    </button>
                </div>

            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   WALLET / SHOP DEPOSITS (Manual USSD + Auto PalmPesa)
═══════════════════════════════════════════════════════════ */
export function AdminShopDeposits() {
    const { showToast } = useToast();
    const [deposits, setDeposits] = useState([]);
    const [usersMap, setUsersMap] = useState({});
    const [processing, setProcessing] = useState(false);
    const [modal, setModal] = useState(null);
    const [q, setQ] = useState('');
    const [filter, setFilter] = useState('all');

    const load = useCallback(() => {
        Promise.all([
            getDocs(collection(db, 'shopDeposits')),
            getDocs(collection(db, 'users'))
        ]).then(([dSnap, uSnap]) => {
            if (!uSnap.empty) {
                const uMap = {};
                uSnap.docs.forEach(d => uMap[d.id] = d.data());
                setUsersMap(uMap);
            }
            const all = dSnap.empty ? [] : dSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            setDeposits(all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
        });
    }, []);

    useEffect(() => { load(); }, [load]);

    const filtered = deposits
        .filter(d => filter === 'all' ? true : d.status === filter)
        .filter(d => {
            if (!q) return true;
            const lq = q.toLowerCase();
            return (
                d.uid?.toLowerCase().includes(lq) ||
                (d.transactionId || d.reference || '').toLowerCase().includes(lq) ||
                (usersMap[d.uid]?.username || '').toLowerCase().includes(lq) ||
                (usersMap[d.uid]?.phone || '').includes(lq)
            );
        });

    const openModal = (action, dep) => {
        const u = usersMap[dep.uid] || {};
        const currency = dep.currency || u.currency || 'TZS';
        const amount = Number(dep.amount || dep.amountTZS || 0);
        setModal({
            action,
            id: dep.id,
            title: action === 'approve' ? 'Approve Wallet Deposit' : action === 'reject' ? 'Reject Deposit' : 'Delete Record',
            subtitle: `Reference: ${dep.transactionId || dep.reference || dep.id}`,
            details: [
                { label: 'Client ID', value: dep.uid },
                { label: 'Username', value: u.username || u.fullName || '—' },
                { label: 'Phone', value: u.phone || dep.msisdn || '—' },
                { label: 'Amount', value: `${currency} ${amount.toLocaleString()}` },
                { label: 'Method', value: dep.method || dep.channel || 'Manual USSD' },
                { label: 'Transaction ID', value: dep.transactionId || dep.reference || dep.orderId || '—' },
                { label: 'Current Balance', value: `${currency} ${Number(u.shopBalance || 0).toLocaleString()}` },
                { label: 'Submitted', value: dep.createdAt ? new Date(dep.createdAt).toLocaleString() : '—' },
            ],
            reason: 'Payment could not be verified', setReason: (r) => setModal(m => ({ ...m, reason: r }))
        });
    };

    const handleConfirm = async () => {
        setProcessing(true);
        let res;
        if (modal.action === 'approve') res = await approveShopDeposit(modal.id);
        else if (modal.action === 'reject') res = await rejectShopDeposit(modal.id, modal.reason);
        else res = await deleteShopDeposit(modal.id);

        showToast(res.success ? res.message || 'Done' : res.error, res.success ? 'success' : 'error');
        if (res.success) {
            if (modal.action === 'delete') {
                setDeposits(prev => prev.filter(d => d.id !== modal.id));
            } else {
                const newStatus = modal.action === 'approve' ? 'completed' : 'rejected';
                setDeposits(prev => prev.map(d => d.id === modal.id ? { ...d, status: newStatus } : d));
            }
        }
        setModal(null);
        setProcessing(false);
    };

    const statusCounts = {
        all: deposits.length,
        pending: deposits.filter(d => d.status === 'pending').length,
        completed: deposits.filter(d => d.status === 'completed').length,
        rejected: deposits.filter(d => d.status === 'rejected').length,
    };

    return (
        <div>
            <ConfirmModal modal={modal} onClose={() => setModal(null)} onConfirm={handleConfirm} processing={processing} />

            <h1 className="gov-title">Wallet Deposits</h1>
            <p className="gov-subtitle">Manual USSD &amp; automatic PalmPesa shop deposit approvals</p>

            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginBottom: 24 }}>
                {[['Total', statusCounts.all, '#0288D1'], ['Pending', statusCounts.pending, '#ED6C02'], ['Approved', statusCounts.completed, '#2E7D32'], ['Rejected', statusCounts.rejected, '#C62828']].map(([label, count, color]) => (
                    <div key={label} className="gov-stat-card" style={{ borderLeft: `4px solid ${color}` }}>
                        <div className="gov-stat-content">
                            <div className="gov-stat-label">{label}</div>
                            <div className="gov-stat-value" style={{ color }}>{count}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Toolbar */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                    className="gov-input"
                    style={{ flex: 1, minWidth: 200 }}
                    placeholder="Search by user, phone, transaction ID..."
                    value={q}
                    onChange={e => setQ(e.target.value)}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                    {['all', 'pending', 'completed', 'rejected'].map(f => (
                        <button
                            key={f}
                            className={`gov-btn ${filter === f ? 'gov-btn-primary' : 'gov-btn-outline'}`}
                            onClick={() => setFilter(f)}
                            style={{ fontSize: 12, padding: '6px 12px' }}
                        >
                            {f.toUpperCase()}
                        </button>
                    ))}
                </div>
                <button className="gov-btn gov-btn-outline" onClick={load} title="Refresh">
                    <Icon d={icons.refresh} size={14} /> &nbsp;Refresh
                </button>
            </div>

            <div className="gov-table-container">
                <table className="gov-table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Amount</th>
                            <th>Method</th>
                            <th>Transaction ID / Ref</th>
                            <th>Submitted</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(dep => {
                            const u = usersMap[dep.uid] || {};
                            const cCode = (u.country || u.countryCode || 'tz').toLowerCase();
                            const currency = dep.currency || u.currency || 'TZS';
                            const amount = Number(dep.amount || dep.amountTZS || 0);
                            const method = dep.method || dep.channel || 'Manual USSD';
                            const isPalmpesa = method?.toLowerCase().includes('palmpesa') || method?.toLowerCase().includes('auto');

                            return (
                                <tr key={dep.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <img src={`https://flagcdn.com/w40/${cCode}.png`} alt={cCode} style={{ width: 24, height: 16, objectFit: 'cover', borderRadius: 2 }} />
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: 13 }}>{u.username || u.fullName || '—'}</div>
                                                <div style={{ fontSize: 11, color: '#999', fontFamily: 'monospace' }}>{dep.uid?.slice(0, 10)}...</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ fontWeight: 700, color: '#2E7D32' }}>{currency} {amount.toLocaleString()}</td>
                                    <td>
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 4,
                                            background: isPalmpesa ? 'rgba(2,136,209,0.1)' : 'rgba(237,108,2,0.1)',
                                            color: isPalmpesa ? '#0288D1' : '#ED6C02',
                                            borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700
                                        }}>
                                            {isPalmpesa ? '⚡ Auto PalmPesa' : '📱 Manual USSD'}
                                        </span>
                                    </td>
                                    <td className="gov-mono-text" style={{ fontSize: 12 }}>{dep.transactionId || dep.reference || dep.orderId || '—'}</td>
                                    <td style={{ fontSize: 12 }}>{dep.createdAt ? new Date(dep.createdAt).toLocaleString() : '—'}</td>
                                    <td><StatusBadge status={dep.status} /></td>
                                    <td>
                                        <div className="gov-action-group">
                                            {dep.status === 'pending' && (
                                                <>
                                                    <button className="gov-btn gov-btn-success" onClick={() => openModal('approve', dep)}>Approve</button>
                                                    <button className="gov-btn gov-btn-danger" onClick={() => openModal('reject', dep)}>Reject</button>
                                                </>
                                            )}
                                            <button className="gov-btn gov-btn-outline" onClick={() => openModal('delete', dep)}>Delete</button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {filtered.length === 0 && (
                            <tr><td colSpan={7}><div className="gov-empty-state">No deposit records match your query.</div></td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
