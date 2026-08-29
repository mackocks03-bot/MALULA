import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { db, doc, collection, getDocs, updateDoc, deleteDoc, addDoc } from '../../services/firebase-config.js';
import { approveActivation, rejectActivation, deleteActivation, cleanupStaleActivations } from '../../services/activation.js';
import { approveWithdrawal, rejectWithdrawal, deleteWithdrawal } from '../../services/withdraw.js';
import { approveShopDeposit, rejectShopDeposit, deleteShopDeposit } from '../../services/shopDeposits.js';
import { useToast } from '../../contexts/ToastContext.jsx';

import './css/AdminShared.css';
import './css/AdminLayout.css';
import './css/AdminDashboard.css';
import './css/AdminUsers.css';
import './css/AdminPayments.css';
import './css/AdminWithdrawals.css';
import './css/AdminTasksMonitor.css';
import './css/AdminKycReview.css';
import { ConfirmModal as GlobalConfirmModal, PromptModal } from '../../components/Modals.jsx';

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Icon helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
    wallet: 'M19 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2zm0 0V5a2 2 0 00-2-2H8a2 2 0 00-2 2v2',
    search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0',
    ledger: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
};

const adminLinks = [
    { to: '/admin/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { to: '/admin/users', label: 'Users Directory', icon: 'users' },
    { to: '/admin/payments', label: 'Activation Payments', icon: 'payments' },
    { to: '/admin/deposits', label: 'Wallet Deposits', icon: 'wallet' },
    { to: '/admin/palmpesa-ledger', label: 'PalmPesa Ledger', icon: 'ledger' },
    { to: '/admin/withdrawals', label: 'Withdrawal Queue', icon: 'withdraw' },
    { to: '/admin/referrals', label: 'Referral Tracking', icon: 'referrals' },
    { to: '/admin/upliner', label: 'Upliner Editor', icon: 'referrals' },
    { to: '/admin/tasks', label: 'Task Config', icon: 'tasks' },
    { to: '/admin/task-monitor', label: 'Daily Task Logs', icon: 'tasks' },
    { to: '/admin/shop', label: 'Vendor Management', icon: 'shop' },
    { to: '/admin/settings', label: 'System Parameters', icon: 'settings' },
    { to: '/admin/orders', label: 'Order Dispatch', icon: 'shop' },
    { to: '/admin/financials', label: 'Financial Analysis', icon: 'ledger' },
];

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Shared components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
                    <button className="gov-modal-close" onClick={onClose}><i className="fas fa-times" /></button>
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

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   ADMIN LAYOUT
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
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
        if (!user || userData?.role !== 'admin') {
            setVerified(false);
            navigate('/admin/login');
            return;
        }
        setVerified(true);
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
                    <button className="gov-mobile-btn" onClick={() => setMobileOpen(!mobileOpen)}><i className="fas fa-bars" /> Menu</button>
                    <div style={{ flex: 1 }}></div>
                    <Link to="/" className="gov-btn gov-btn-outline" style={{ padding: '6px 12px', fontSize: 12 }}><i className="fas fa-arrow-right-to-bracket" /> Client Portal</Link>
                </header>

                <div className="gov-content">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}

/* ══════════════════════════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════════════════════════ */
function DashDonut({ pct = 0, color = '#4318ff', size = 56, stroke = 5 }) {
    const r = (size - stroke * 2) / 2;
    const circ = 2 * Math.PI * r;
    const dash = (Math.min(pct, 100) / 100) * circ;
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', flexShrink: 0 }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={stroke} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
                strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
                transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        </svg>
    );
}

export function AdminDashboard() {
    const [stats, setStats] = useState({ users: 0, active: 0, payments: 0, pendingPayments: 0, withdrawals: 0, pendingWithdrawals: 0 });
    const [countryUsers, setCountryUsers] = useState([]);
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
                // build country breakdown
                const cMap = {};
                uVals.forEach(u => {
                    if (u.isActive) active++;
                    if (u.createdAt) acts.push({ type: 'user', title: 'System Registration', sub: `User: ${u.uid?.slice(0, 8)}`, time: u.createdAt });
                    const cc = (u.countryCode || u.country || 'tz').toLowerCase();
                    const cn = u.countryName || u.countryCode || u.country || cc.toUpperCase();
                    if (!cMap[cc]) cMap[cc] = { code: cc, name: cn, total: 0, active: 0 };
                    cMap[cc].total++;
                    if (u.isActive) cMap[cc].active++;
                });
                const sorted = Object.values(cMap).sort((a, b) => b.total - a.total);
                setCountryUsers(sorted);
            }
            if (!paymentsSnap.empty) {
                const pVals = paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                setStats(s => ({ ...s, payments: pVals.length }));
                pVals.forEach(p => {
                    if (p.status === 'pending') pendingP++;
                    if (p.createdAt) acts.push({ type: 'payment', title: 'Payment Logged', sub: `Ref: ${p.reference || 'N/A'}`, time: p.createdAt });
                });
            }
            if (!withdrawalsSnap.empty) {
                withdrawalsSnap.docs.forEach(wDoc => {
                    const w = wDoc.data();
                    totalW++;
                    if (w.status === 'pending') pendingW++;
                    if (w.createdAt) acts.push({ type: 'withdraw', title: 'Withdrawal Request', sub: `${(w.nativeAmount || w.amount || 0).toLocaleString()}`, time: w.createdAt });
                });
            }

            setStats(s => ({ ...s, active, pendingPayments: pendingP, withdrawals: totalW, pendingWithdrawals: pendingW }));
            setActivity(acts.sort((a, b) => b.time - a.time).slice(0, 12));
            setBusy(false);
        });
    }, []);

    const activePct = stats.users ? Math.round((stats.active / stats.users) * 100) : 0;
    const pendPmtPct = stats.payments ? Math.round((stats.pendingPayments / stats.payments) * 100) : 0;
    const pendWPct = stats.withdrawals ? Math.round((stats.pendingWithdrawals / stats.withdrawals) * 100) : 0;

    const cards = [
        { label: 'Registered Users', value: stats.users, icon: 'fa-users', color: '#4318ff', bg: '#e9eefd', pct: 100, sub: 'Total platform accounts' },
        { label: 'Active Personnel', value: stats.active, icon: 'fa-user-check', color: '#05cd99', bg: '#e6f9f0', pct: activePct, sub: `${activePct}% activation rate` },
        { label: 'Total Invoices', value: stats.payments, icon: 'fa-file-invoice-dollar', color: '#ffb800', bg: '#fff8e6', pct: 100 - pendPmtPct, sub: `${stats.payments - stats.pendingPayments} processed` },
        { label: 'Pending Deposits', value: stats.pendingPayments, icon: 'fa-clock', color: '#ff5630', bg: '#ffe7e3', pct: pendPmtPct, sub: 'Awaiting review' },
        { label: 'Total Disbursements', value: stats.withdrawals, icon: 'fa-money-bill-transfer', color: '#868cff', bg: '#f0eeff', pct: 100 - pendWPct, sub: `${stats.withdrawals - stats.pendingWithdrawals} completed` },
        { label: 'Pending Payouts', value: stats.pendingWithdrawals, icon: 'fa-triangle-exclamation', color: '#f6ad55', bg: '#fff7ed', pct: pendWPct, sub: 'Requires action' },
    ];

    const activityColors = { user: '#4318ff', payment: '#05cd99', withdraw: '#ff5630' };
    const activityIcons = { user: 'fa-user-plus', payment: 'fa-file-invoice-dollar', withdraw: 'fa-money-bill-transfer' };

    return (
        <div className="pf-dash-root">
            {/* ── HEADER ── */}
            <header className="pf-dash-header">
                <div>
                    <h1 className="pf-dash-title">
                        <i className="fas fa-border-all" style={{ marginRight: 10, color: '#4318ff' }} />
                        System Overview
                    </h1>
                    <p className="pf-dash-subtitle">Executive summary of all platform metrics</p>
                </div>
                <button className="pf-dash-refresh" onClick={() => window.location.reload()}>
                    <i className="fas fa-arrows-rotate" /> Refresh
                </button>
            </header>

            {/* ── STAT CARDS ── */}
            <section className="pf-dash-grid">
                {cards.map((c, i) => (
                    <div key={i} className="pf-dash-card">
                        <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
                            <DashDonut pct={busy ? 0 : c.pct} color={c.color} />
                            <div style={{
                                position: 'absolute', inset: 0, display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                background: c.bg, borderRadius: '50%',
                                margin: 5, color: c.color, fontSize: 16
                            }}>
                                <i className={`fas ${c.icon}`} />
                            </div>
                        </div>
                        <div className="pf-dash-card-info">
                            <p className="pf-dash-card-label">{c.label}</p>
                            <h3 className="pf-dash-card-value">{busy ? '—' : c.value.toLocaleString()}</h3>
                            <span className="pf-dash-card-sub" style={{ color: c.color }}>{c.sub}</span>
                        </div>
                    </div>
                ))}
            </section>

            {/* ── COUNTRY USER CARDS ── */}
            {countryUsers.length > 0 && (
                <section style={{ marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                        <i className="fas fa-earth-africa" style={{ color: '#4318ff', fontSize: 17 }} />
                        <span style={{ fontWeight: 700, fontSize: 15, color: '#2b3674' }}>Users by Country</span>
                        <span style={{ fontSize: 11, color: '#8f9bba', marginLeft: 4 }}>{countryUsers.length} regions</span>
                    </div>
                    <div className="pf-dash-country-grid">
                        {countryUsers.map(c => {
                            const actPct = c.total ? Math.round((c.active / c.total) * 100) : 0;
                            const topTotal = countryUsers[0]?.total || 1;
                            const sharePct = Math.round((c.total / topTotal) * 100);
                            return (
                                <div key={c.code} className="pf-dash-country-card">
                                    <div className="pf-dash-cc-top">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <img src={`https://flagcdn.com/w40/${c.code}.png`} alt={c.code}
                                                style={{ width: 28, height: 18, objectFit: 'cover', borderRadius: 3, flexShrink: 0 }} />
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: 12, color: '#2b3674' }}>{c.name}</div>
                                                <div style={{ fontSize: 10, color: '#8f9bba' }}>{actPct}% active</div>
                                            </div>
                                        </div>
                                        <div style={{ position: 'relative', width: 46, height: 46 }}>
                                            <DashDonut pct={actPct} color="#05cd99" size={46} stroke={4} />
                                            <div style={{
                                                position: 'absolute', inset: 0, display: 'flex',
                                                alignItems: 'center', justifyContent: 'center',
                                                fontSize: 9, fontWeight: 700, color: '#05cd99'
                                            }}>{actPct}%</div>
                                        </div>
                                    </div>
                                    <div className="pf-dash-cc-rows">
                                        <div className="pf-dash-cc-row">
                                            <span><i className="fas fa-users" style={{ color: '#4318ff', marginRight: 5 }} />Total Users</span>
                                            <strong style={{ color: '#4318ff' }}>{c.total.toLocaleString()}</strong>
                                        </div>
                                        <div className="pf-dash-cc-row">
                                            <span><i className="fas fa-user-check" style={{ color: '#05cd99', marginRight: 5 }} />Active</span>
                                            <strong style={{ color: '#05cd99' }}>{c.active.toLocaleString()}</strong>
                                        </div>
                                        <div className="pf-dash-cc-row">
                                            <span><i className="fas fa-user-xmark" style={{ color: '#ff5630', marginRight: 5 }} />Inactive</span>
                                            <strong style={{ color: '#ff5630' }}>{(c.total - c.active).toLocaleString()}</strong>
                                        </div>
                                        {/* mini share bar */}
                                        <div style={{ marginTop: 8 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#8f9bba', marginBottom: 4 }}>
                                                <span>Share of total users</span>
                                                <span>{sharePct}%</span>
                                            </div>
                                            <div style={{ height: 5, borderRadius: 10, background: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                                                <div style={{ height: '100%', width: `${sharePct}%`, background: 'linear-gradient(90deg, #4318ff, #868cff)', borderRadius: 10, transition: 'width 0.6s ease' }} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* ── ACTIVITY LOG ── */}
            <div className="pf-dash-panel">
                <div className="pf-dash-panel-header">
                    <i className="fas fa-wave-square" style={{ color: '#4318ff', marginRight: 8 }} />
                    <span>Live Activity Feed</span>
                </div>
                <div className="pf-dash-panel-body">
                    {busy ? (
                        <div className="pf-dash-loading">
                            <i className="fas fa-spinner fa-spin" /> Querying system logs...
                        </div>
                    ) : activity.length === 0 ? (
                        <div className="pf-dash-loading">No activity records found.</div>
                    ) : (
                        activity.map((a, i) => (
                            <div key={i} className="pf-dash-activity-item">
                                <div className="pf-dash-activity-dot" style={{ background: activityColors[a.type] }}>
                                    <i className={`fas ${activityIcons[a.type]}`} style={{ fontSize: 9, color: '#fff' }} />
                                </div>
                                <div className="pf-dash-activity-text">
                                    <div className="pf-dash-activity-title">{a.title}</div>
                                    <div className="pf-dash-activity-sub">{a.sub}</div>
                                </div>
                                <div className="pf-dash-activity-time">{new Date(a.time).toLocaleString()}</div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   USER PROFILE MODAL
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
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
                    <button className="gov-modal-close" onClick={onClose}><i className="fas fa-times" /></button>
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

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   USERS
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
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

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   PAYMENTS
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
export function AdminPayments() {
    const { showToast } = useToast();
    const [payments, setPayments] = useState([]);
    const [usersMap, setUsersMap] = useState({});
    const [processing, setProcessing] = useState(false);
    const [modal, setModal] = useState(null);
    const [q, setQ] = useState('');
    const [proofPreview, setProofPreview] = useState(null);

    const load = useCallback(() => {
        cleanupStaleActivations().then(() => {
            Promise.all([getDocs(collection(db, 'activationPayments')), getDocs(collection(db, 'users'))]).then(([pSnap, uSnap]) => {
                if (!uSnap.empty) {
                    const uMap = {};
                    uSnap.docs.forEach(d => uMap[d.id] = d.data());
                    setUsersMap(uMap);
                }
                setPayments(!pSnap.empty ? pSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)) : []);
            });
        }).catch(err => console.error(err));
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
            subtitle: `Action required for invoice ${p.reference || p.transactionId || p.transactionHash || p.id}`,
            details: [
                { label: 'Client ID', value: p.uid },
                { label: 'Username', value: u.username || u.fullName || '—' },
                { label: 'Amount', value: amountDisplay },
                { label: 'Method', value: p.method || p.network || p.channel || 'PalmPesa' },
                { label: 'Phone', value: p.phone || p.phoneNumber || '—' },
                { label: 'Dated', value: p.createdAt ? new Date(p.createdAt).toLocaleString() : '—' },
                ...(p.transactionHash ? [{ label: 'Txn Hash', value: <span style={{fontFamily:'monospace', color:'var(--gov-blue)'}}>{p.transactionHash}</span> }] : [])
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
            {/* Proof image lightbox */}
            {proofPreview && (
                <div
                    onClick={() => setProofPreview(null)}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 9999,
                        background: 'rgba(0,0,0,0.85)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 24, cursor: 'zoom-out'
                    }}
                >
                    <div style={{ 
                        position: 'relative', 
                        maxWidth: 500, 
                        width: '100%',
                        background: 'var(--background-card, #ffffff)',
                        padding: 16,
                        borderRadius: 16,
                        boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                        display: 'flex',
                        flexDirection: 'column',
                        maxHeight: '90vh'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text-primary, #111)' }}>Payment Proof</h3>
                            <button
                                onClick={() => setProofPreview(null)}
                                style={{
                                    background: 'var(--background-secondary, #f3f4f6)', border: 'none', borderRadius: '50%',
                                    width: 32, height: 32, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 20, color: 'var(--text-muted, #6b7280)'
                                }}
                            >×</button>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', borderRadius: 8, display: 'flex', justifyContent: 'center' }}>
                            <img
                                src={proofPreview}
                                alt="Payment proof"
                                style={{ maxWidth: '100%', objectFit: 'contain', borderRadius: 8 }}
                            />
                        </div>
                    </div>
                </div>
            )}
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
                            const cCode = (p.countryCode || u.countryCode || u.country || 'TZ').toLowerCase();
                            const rate = u.exchangeRate || 2600;
                            const currency = u.currency || p.nativeCurrency || 'TZS';
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
                                    <td>
                                        <b>{p.method || p.network || p.channel || 'PalmPesa'}</b>
                                        {p.screenshotUrl && (
                                            <button
                                                onClick={() => setProofPreview(p.screenshotUrl)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 4,
                                                    fontSize: 10, color: '#16a34a', marginTop: 4,
                                                    background: 'rgba(22,163,74,0.08)',
                                                    border: '1px solid rgba(22,163,74,0.25)',
                                                    borderRadius: 4, padding: '2px 6px',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <i className="fas fa-image" /> View Proof
                                            </button>
                                        )}
                                    </td>
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

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   WITHDRAWALS
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

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
                                                <span style={{ fontSize: 12, fontWeight: 600 }}>ðŸ‘¤ {name}</span>
                                                <button onClick={() => copyToClipboard(name)} title="Copy name" style={{ border: 'none', background: 'rgba(99,102,241,0.1)', color: '#6366f1', borderRadius: 4, padding: '2px 6px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}><CopyIcon /></button>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ðŸ“ž {phone || 'N/A'}</span>
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

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   REFERRALS
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
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
                    <button className="gov-modal-close" onClick={onClose}><i className="fas fa-times" /></button>
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
                    <b>âš  Access Error:</b> {error}
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


/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   TASKS ADMIN
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
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
                                        {cfg.videoUrl && <div style={{ fontSize: 11, color: 'var(--gov-blue)', marginTop: 4 }}>ðŸŽ¬ Video: {cfg.videoUrl.slice(0, 50)}...</div>}
                                    </div>
                                    <div style={{ textAlign: 'right', minWidth: 140 }}>
                                        <div style={{ fontWeight: 700, color: '#2E7D32', fontSize: 14 }}>TZS {tzReward.toLocaleString()}</div>
                                        <div style={{ fontSize: 11, color: '#aaa' }}>{cfg.totalItems} items Â· {Object.keys(cfg.countryRewards || {}).length} countries</div>
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
    const [confirmDialog, setConfirmDialog] = useState(null);

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
        setConfirmDialog({
            title: 'Delete Vendor Item',
            message: 'Are you sure you want to completely de-list this vendor item?',
            isDestructive: true,
            onConfirm: async () => {
                setConfirmDialog(null);
                try { await deleteDoc(doc(db, 'products', id)); loadProducts(); } catch (e) { }
            }
        });
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
            <GlobalConfirmModal
                isOpen={!!confirmDialog}
                title={confirmDialog?.title}
                message={confirmDialog?.message}
                isDestructive={confirmDialog?.isDestructive}
                onConfirm={confirmDialog?.onConfirm}
                onCancel={() => setConfirmDialog(null)}
            />
        </div>
    );
}

export function AdminSettings() {
    const { showToast } = useToast();
    const [settings, setSettings] = useState({
        activationFees: { TZS: 15500, KES: 650, UGX: 18500, MWK: 15000, ZMW: 160, RWF: 6000, BIF: 26000, CDF: 28000 },
        minWithdrawals: { TZS: 10000, KES: 500, UGX: 15000 },
        withdrawFeePercent: 13,
        taskMinWithdrawalsBase: { tiktok: 200000, chat: 300000, welcomeBonus: 50000, youtube: 100000, facebook: 100000, whatsapp: 100000, ads: 100000 }
    });
    const [rates, setRates] = useState({ TZS: 2500, KES: 130, UGX: 3700, MWK: 1750, ZMW: 27, RWF: 1350, BIF: 2900, CDF: 2800, MZN: 65 });
    const [commissions, setCommissions] = useState({ level1: 10000, level2: 3500, level3: 1000 });
    // paymentTargets: { [countryCode]: { [networkId]: { number: string, name: string } } }
    const [paymentTargets, setPaymentTargets] = useState({
        ZM: {}, BI: {}, CD: {}, KE: {}, UG: {}, MW: {}, RW: {}
    });
    const [loading, setLoading] = useState({ fees: false, withdrawals: false, taskLimits: false, rates: false, commissions: false, paymentTargets: false });

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
        // Load manual payment targets
        import('../../services/firebase-config.js').then(async m => {
            try {
                const snap = await m.getDoc(m.doc(db, 'settings', 'activation'));
                if (snap.exists()) {
                    const raw = snap.data()?.paymentNumbers || {};
                    // Directly assign whatever is in Firestore — new nested schema
                    // { cc: { networkId: { number, name } } }
                    setPaymentTargets(prev => {
                        const merged = { ...prev };
                        Object.entries(raw).forEach(([cc, val]) => {
                            if (val && typeof val === 'object') {
                                merged[cc] = { ...(merged[cc] || {}), ...val };
                            }
                        });
                        return merged;
                    });
                }
            } catch (e) { console.error('Failed to load payment targets', e); }
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

                {/* â”€â”€ Exchange Rates Panel â”€â”€ */}
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

                {/* â”€â”€ Referral Commissions Panel â”€â”€ */}
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

                {/* -- Manual Activation Payment Details -- */}
                <div className="gov-panel" style={{ padding: 24, gridColumn: '1 / -1' }}>
                    <h3 style={{ marginTop: 0, marginBottom: 6 }}>Manual Activation — Payment Numbers per Network</h3>
                    <p style={{ fontSize: 12, color: 'var(--gov-text-muted)', marginBottom: 24 }}>
                        Set the payment number and account name for each network per country. Users see the correct number when they select a network during activation.
                    </p>
                    {[
                        { cc: 'TZ', label: 'Tanzania (TZS)', networks: [{ id: 'lipa_namba', name: 'USSD (MIXX BY YAS)' }] },
                        { cc: 'ZM', label: 'Zambia (ZMW)', networks: [{ id: 'mtn', name: 'MTN Mobile Money' }, { id: 'airtel', name: 'Airtel Money' }, { id: 'zamtel', name: 'Zamtel Kwacha' }] },
                        { cc: 'BI', label: 'Burundi (BIF)', networks: [{ id: 'lumitel', name: 'Lumicash' }, { id: 'econet', name: 'EcoCash' }] },
                        { cc: 'CD', label: 'DR Congo (CDF)', networks: [{ id: 'airtel', name: 'Airtel Money' }, { id: 'orange', name: 'Orange Money' }, { id: 'vodacom', name: 'M-Pesa (Vodacom)' }] },
                        { cc: 'KE', label: 'Kenya (KES)', networks: [{ id: 'mpesa', name: 'M-PESA' }, { id: 'airtel', name: 'Airtel Money' }] },
                        { cc: 'UG', label: 'Uganda (UGX)', networks: [{ id: 'mtn', name: 'MTN Mobile Money' }, { id: 'airtel', name: 'Airtel Money' }] },
                        { cc: 'MW', label: 'Malawi (MWK)', networks: [{ id: 'airtel', name: 'Airtel Money' }, { id: 'tnm', name: 'TNM Mpamba' }] },
                        { cc: 'RW', label: 'Rwanda (RWF)', networks: [{ id: 'mtn', name: 'MTN Mobile Money' }, { id: 'airtel', name: 'Airtel Money' }] },
                    ].map(({ cc, label, networks }) => (
                        <div key={cc} style={{ marginBottom: 28 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--gov-blue)', marginBottom: 12, paddingBottom: 6, borderBottom: '2px solid var(--gov-border)' }}>
                                🌍 {label}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                                {networks.map(net => (
                                    <div key={net.id} style={{ background: 'rgba(99,102,241,0.04)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--gov-border)' }}>
                                        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 10, color: 'var(--gov-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                            {net.name}
                                        </div>
                                        <input className="gov-input" type="text" placeholder="Payment Number"
                                            value={paymentTargets[cc]?.[net.id]?.number || ''}
                                            onChange={e => setPaymentTargets(prev => ({
                                                ...prev,
                                                [cc]: { ...prev[cc], [net.id]: { ...(prev[cc]?.[net.id] || {}), number: e.target.value } }
                                            }))}
                                            style={{ margin: '0 0 8px 0', width: '100%', boxSizing: 'border-box' }}
                                        />
                                        <input className="gov-input" type="text" placeholder="Account Name"
                                            value={paymentTargets[cc]?.[net.id]?.name || ''}
                                            onChange={e => setPaymentTargets(prev => ({
                                                ...prev,
                                                [cc]: { ...prev[cc], [net.id]: { ...(prev[cc]?.[net.id] || {}), name: e.target.value } }
                                            }))}
                                            style={{ margin: 0, width: '100%', boxSizing: 'border-box' }}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    <button className="gov-btn gov-btn-primary" disabled={loading.paymentTargets}
                        style={{ marginTop: 8, width: '100%' }}
                        onClick={async () => {
                            setLoading(prev => ({ ...prev, paymentTargets: true }));
                            try {
                                const { setDoc, doc: _d } = await import('../../services/firebase-config.js');
                                await setDoc(_d(db, 'settings', 'activation'), { paymentNumbers: paymentTargets }, { merge: true });
                                showToast('Payment details saved successfully.', 'success');
                            } catch { showToast('Failed to save payment details.', 'error'); }
                            setLoading(prev => ({ ...prev, paymentTargets: false }));
                        }}
                    >
                        {loading.paymentTargets ? 'Saving...' : '💾 Save All Payment Numbers'}
                    </button>
                </div>

            </div>
        </div>
    );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   WALLET / SHOP DEPOSITS (Manual USSD + Auto PalmPesa)
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
export function AdminShopDeposits() {
    const { showToast } = useToast();
    const [deposits, setDeposits] = useState([]);
    const [usersMap, setUsersMap] = useState({});
    const [processing, setProcessing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null);
    const [q, setQ] = useState('');
    const [filter, setFilter] = useState('all');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [dSnap, pSnap, uSnap] = await Promise.all([
                getDocs(collection(db, 'shopDeposits')),
                getDocs(collection(db, 'palmpesaPending')),
                getDocs(collection(db, 'users'))
            ]);

            const uMap = {};
            if (!uSnap.empty) {
                uSnap.docs.forEach(d => uMap[d.id] = d.data());
            }
            setUsersMap(uMap);

            let all = [];
            if (!dSnap.empty) {
                all = [...all, ...dSnap.docs.map(d => ({ id: d.id, ...d.data(), source: 'shopDeposits' }))];
            }
            if (!pSnap.empty) {
                // Find pending palmpesa ones that aren't already in shopDeposits
                pSnap.docs.forEach(p => {
                    const data = p.data();
                    if (data.type === 'deposit' && !all.find(x => x.orderId === data.orderId || x.orderId === p.id)) {
                        all.push({ 
                            id: p.id, 
                            ...data, 
                            method: data.channel || 'palmpesa',
                            status: data.depositProcessed ? 'completed' : data.status || 'pending',
                            source: 'palmpesaPending'
                        });
                    }
                });
            }
            
            setDeposits(all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
        } catch (err) {
            console.error('Error loading deposits:', err);
            showToast('Failed to load deposits: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

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
            source: dep.source || 'shopDeposits',
            title: action === 'approve' ? 'Approve Wallet Deposit' : action === 'reject' ? 'Reject Deposit' : 'Delete Record',
            subtitle: `Reference: ${dep.transactionId || dep.reference || dep.id}`,
            details: [
                { label: 'Client ID', value: dep.uid },
                { label: 'Username', value: u.username || u.fullName || '—' },
                { label: 'Phone', value: u.phone || dep.msisdn || '—' },
                { label: 'Amount', value: `${currency} ${amount.toLocaleString()}` },
                { label: 'Method', value: dep.method || dep.channel || 'Manual USSD' },
                { label: 'Transaction ID', value: dep.transactionId || dep.reference || dep.orderId || '—' },
                { label: 'Current Shop Balance', value: `${currency} ${Number(u.shopBalance || 0).toLocaleString()}` },
                { label: 'Submitted', value: dep.createdAt ? new Date(dep.createdAt).toLocaleString() : '—' },
            ],
            reason: 'Payment could not be verified', setReason: (r) => setModal(m => ({ ...m, reason: r }))
        });
    };

    const handleConfirm = async () => {
        setProcessing(true);
        let res;
        if (modal.action === 'approve') res = await approveShopDeposit(modal.id, modal.source);
        else if (modal.action === 'reject') res = await rejectShopDeposit(modal.id, modal.reason, modal.source);
        else res = await deleteShopDeposit(modal.id, modal.source);

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
                        {loading ? (
                            <tr><td colSpan={7}><div style={{ textAlign: 'center', padding: 40 }}><span className="gov-spinner" /> Loading deposits...</div></td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={7}><div className="gov-empty-state">No deposit records match your query.</div></td></tr>
                        ) : (
                            filtered.map(dep => {
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
                                            {isPalmpesa ? <><i className="fas fa-bolt" /> Auto PalmPesa</> : <><i className="fas fa-mobile-screen-button" /> Manual USSD</>}
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
                        }))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/* -----------------------------------------------------------
   LIVE PALMPESA TRANSACTION LEDGER
   Pulls data directly from PalmPesa Developer API (not Firebase)
----------------------------------------------------------- */
export function AdminPalmpesaLedger() {
    const { showToast } = useToast();
    const { user } = useAuth();
    const [txns, setTxns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const [q, setQ] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');

    const load = useCallback(async () => {
        setLoading(true);
        setFetchError(null);
        try {
            const idToken = await user.getIdToken();
            const API_URL = import.meta.env.VITE_API_BASE_URL || '';
            const res = await fetch(`${API_URL}/api/deposits/palmpesa/transactions`, {
                headers: { Authorization: `Bearer ${idToken}` }
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load ledger');
            setTxns(data.transactions || []);
        } catch (err) {
            setFetchError(err.message);
            showToast('PalmPesa Ledger: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [user, showToast]);

    useEffect(() => { load(); }, [load]);

    const statusStyle = (s = '') => {
        const u = s.toUpperCase();
        if (u === 'COMPLETED' || u === 'SUCCESS') return { bg: 'rgba(46,125,50,0.12)', color: '#2E7D32' };
        if (u === 'PENDING') return { bg: 'rgba(237,108,2,0.12)', color: '#ED6C02' };
        if (u === 'FAILED' || u === 'CANCELLED') return { bg: 'rgba(211,47,47,0.12)', color: '#D32F2F' };
        return { bg: 'rgba(100,100,100,0.1)', color: '#888' };
    };

    const filtered = txns.filter(t => {
        const status = (t.payment_status || t.status || '').toUpperCase();
        const matchStatus = filterStatus === 'all' || status === filterStatus.toUpperCase();
        if (!matchStatus) return false;
        if (!q) return true;
        const lq = q.toLowerCase();
        return (
            String(t.order_id || '').toLowerCase().includes(lq) ||
            String(t.transid || '').toLowerCase().includes(lq) ||
            String(t.reference || '').toLowerCase().includes(lq) ||
            String(t.amount || '').includes(lq) ||
            String(t.msisdn || t.phone || '').includes(lq) ||
            String(t.name || '').toLowerCase().includes(lq) ||
            String(t.channel || '').toLowerCase().includes(lq)
        );
    });

    const statusCounts = {
        all: txns.length,
        completed: txns.filter(t => ['COMPLETED','SUCCESS'].includes((t.payment_status||t.status||'').toUpperCase())).length,
        pending: txns.filter(t => (t.payment_status||t.status||'').toUpperCase() === 'PENDING').length,
        failed: txns.filter(t => ['FAILED','CANCELLED'].includes((t.payment_status||t.status||'').toUpperCase())).length,
    };

    return (
        <div>
            <h1 className="gov-title">Live PalmPesa Ledger</h1>
            <p style={{ color: '#888', marginBottom: 20, fontSize: 14 }}>
                Real-time transaction history fetched directly from the PalmPesa Developer API. Data is NOT from our Firebase records.
            </p>

            <div className="gov-stats-row" style={{ marginBottom: 20 }}>
                {[
                    ['All Transactions', statusCounts.all, '#6366f1'],
                    ['Completed', statusCounts.completed, '#2E7D32'],
                    ['Pending', statusCounts.pending, '#ED6C02'],
                    ['Failed / Cancelled', statusCounts.failed, '#D32F2F'],
                ].map(([label, count, color]) => (
                    <div key={label} className="gov-stat-card" style={{ borderTop: `3px solid ${color}` }}>
                        <div className="gov-stat-value" style={{ color }}>{count}</div>
                        <div className="gov-stat-label">{label}</div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5, pointerEvents: 'none' }}>
                        <Icon d={icons.search} size={15} />
                    </span>
                    <input
                        className="gov-search-input"
                        placeholder="Search by order ID, phone, name, amount, Trans ID..."
                        value={q}
                        onChange={e => setQ(e.target.value)}
                        style={{ paddingLeft: 36 }}
                    />
                </div>
                <select className="gov-filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option value="all">All Status</option>
                    <option value="completed">Completed</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                </select>
                <button className="gov-btn gov-btn-outline" onClick={load} disabled={loading} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <Icon d={icons.refresh} size={14} />
                    {loading ? 'Loading...' : 'Refresh'}
                </button>
            </div>

            {fetchError && (
                <div className="gov-empty-state" style={{ color: '#D32F2F', border: '1px solid rgba(211,47,47,0.3)' }}>
                    Failed to connect to PalmPesa API: {fetchError}
                    <br />
                    <button className="gov-btn gov-btn-outline" style={{ marginTop: 12 }} onClick={load}>Retry</button>
                </div>
            )}

            {!fetchError && (
                <div className="gov-table-wrapper">
                    <table className="gov-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Order ID</th>
                                <th>Amount (TZS)</th>
                                <th>Phone / MSISDN</th>
                                <th>Name</th>
                                <th>Channel</th>
                                <th>Trans ID / Ref</th>
                                <th>Date</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={9}><div style={{ textAlign: 'center', padding: 40 }}><span className="gov-spinner" /> Connecting to PalmPesa...</div></td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={9}><div className="gov-empty-state">No transactions match your query.</div></td></tr>
                            ) : filtered.map((t, i) => {
                                const status = (t.payment_status || t.status || 'UNKNOWN').toUpperCase();
                                const { bg, color } = statusStyle(status);
                                const amt = Number(t.amount || 0);
                                const date = t.updated_at || t.created_at || t.date;
                                return (
                                    <tr key={t.id || t.order_id || i}>
                                        <td style={{ color: '#888', fontSize: 12 }}>{t.id || i + 1}</td>
                                        <td className="gov-mono-text" style={{ fontSize: 12 }}>{t.order_id || '—'}</td>
                                        <td style={{ fontWeight: 700 }}>
                                            <span style={{ color: amt < 0 ? '#D32F2F' : '#2E7D32' }}>
                                                TZS {Math.abs(amt).toLocaleString()}
                                                {amt < 0 && <span style={{ fontSize: 10, marginLeft: 4 }}>(debit)</span>}
                                            </span>
                                        </td>
                                        <td className="gov-mono-text" style={{ fontSize: 12 }}>{t.msisdn || t.phone || '—'}</td>
                                        <td style={{ fontSize: 13 }}>{t.name || '—'}</td>
                                        <td>
                                            <span style={{ background: 'rgba(2,136,209,0.1)', color: '#0288D1', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                                                {t.channel || t.network || 'palmpesa'}
                                            </span>
                                        </td>
                                        <td className="gov-mono-text" style={{ fontSize: 11, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                            title={t.transid || t.reference || ''}>
                                            {t.transid || t.reference || '—'}
                                        </td>
                                        <td style={{ fontSize: 12 }}>
                                            {date ? new Date(date).toLocaleString() : '—'}
                                        </td>
                                        <td>
                                            <span style={{ background: bg, color, borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                {status}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════════════════
   DAILY TASKS DASHBOARD
══════════════════════════════════════════════════════════════════════════════════ */
export function AdminTasksMonitor() {
    const { showToast } = useToast();
    const [tasks, setTasks] = useState([]);
    const [usersMap, setUsersMap] = useState({});
    const [confirmDialog, setConfirmDialog] = useState(null);
    const [q, setQ] = useState('');
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [crediting, setCrediting] = useState(false);

    // Get today's key logic perfectly synced with user perspective
    const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayKey = DAY_KEYS[new Date().getDay()];

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const uSnap = await getDocs(collection(db, 'users'));
            const uMap = {};
            uSnap.docs.forEach(d => { uMap[d.id] = { uid: d.id, ...d.data() }; });
            setUsersMap(uMap);

            const tSnap = await getDocs(collection(db, 'userTasks'));
            const todayTasks = tSnap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(t => t.taskId && t.taskId.includes(todayKey));
            
            todayTasks.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
            setTasks(todayTasks);
        } catch (err) {
            showToast('Failed to load tasks', 'error');
        }
        setLoading(false);
    }, [todayKey, showToast]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleForceCredit = async (taskItem) => {
        const u = usersMap[taskItem.uid] || {};
        setConfirmDialog({
            title: 'Force Credit Warning',
            message: `You are about to forcibly credit ${taskItem.reward || 0} ${taskItem.rewardCurrency || 'TZS'} to ${u.username || 'this user'}. Proceed?`,
            onConfirm: async () => {
                setConfirmDialog(null);
                setCrediting(true);
                try {
                    const user = usersMap[taskItem.uid];
            if (!user) throw new Error("User data missing");

            const reward = Number(taskItem.reward || 0);
            if (reward <= 0) throw new Error("Reward explicitly 0. Cannot force credit.");
            const category = taskItem.category || taskItem.taskCategory || 'general';

            const currentProfit = parseFloat(user.totalProfit) || 0;
            const earnings = user.earnings || {};
            earnings[category] = (parseFloat(earnings[category]) || 0) + reward;
            
            const taskBalances = user.taskBalances || {};
            taskBalances[category] = (parseFloat(taskBalances[category]) || 0) + reward;

            await updateDoc(doc(db, 'users', user.uid), {
                totalProfit: currentProfit + reward,
                earnings,
                taskBalances
            });

            await updateDoc(doc(db, 'userTasks', taskItem.id), {
                status: 'completed',
                taskProcessed: true,
                completedAt: Date.now(),
                updatedAt: Date.now(),
                adminForcedCredit: true
            });

            await addDoc(collection(db, 'transactions'), {
                uid: user.uid,
                type: 'task',
                description: `Task reward (Admin Force): ${taskItem.taskTitle || 'Activity completed'}`,
                amount: reward,
                currency: taskItem.rewardCurrency || user.currency || 'TZS',
                taskId: taskItem.taskId,
                category,
                balanceAfter: parseFloat(user.balance) || 0,
                createdAt: Date.now()
            });

            showToast("Credit injected successfully!", "success");
            loadData();
        } catch (err) {
            showToast("Failed: " + err.message, "error");
        }
        setCrediting(false);
            }
        });
    };

    const filtered = tasks.filter(t => {
        const u = usersMap[t.uid] || {};
        if (filter !== 'all' && t.status !== filter) return false;
        if (!q) return true;
        const sq = q.toLowerCase();
        return (u.username || '').toLowerCase().includes(sq) ||
               (u.email || '').toLowerCase().includes(sq) ||
               (u.phone || '').toLowerCase().includes(sq) ||
               t.uid.toLowerCase().includes(sq);
    });

    const getBadgeStyle = (st) => {
        if (st === 'completed') return 'atm-badge-success';
        if (st === 'failed' || st === 'rejected') return 'atm-badge-danger';
        if (st === 'pending_verification') return 'atm-badge-warning';
        return 'atm-badge-info';
    };

    return (
        <div className="admin-tasks-monitor">
            <div className="atm-header">
                <div className="atm-header-left">
                    <h2>Daily Tasks Monitor ({todayKey.toUpperCase()})</h2>
                    <p>Track user task activities, progress, and forcefully resolve failed payouts automatically.</p>
                </div>
                <div>
                    <button className="atm-btn atm-btn-refresh" onClick={loadData} disabled={loading}>
                        <Icon d={icons.refresh} /> {loading ? 'Refreshing...' : 'Refresh Live Logs'}
                    </button>
                </div>
            </div>

            <div className="atm-metrics-grid">
                <div className="atm-metric-card" style={{ borderLeftColor: '#3b82f6' }}>
                    <div className="title">Total Today</div>
                    <div className="value" style={{ color: '#3b82f6' }}>{tasks.length}</div>
                </div>
                <div className="atm-metric-card" style={{ borderLeftColor: '#10b981' }}>
                    <div className="title">Completed / Paid</div>
                    <div className="value" style={{ color: '#10b981' }}>{tasks.filter(t => t.status === 'completed').length}</div>
                </div>
                <div className="atm-metric-card" style={{ borderLeftColor: '#f59e0b' }}>
                    <div className="title">Pending System</div>
                    <div className="value" style={{ color: '#f59e0b' }}>{tasks.filter(t => t.status === 'pending_verification').length}</div>
                </div>
                <div className="atm-metric-card" style={{ borderLeftColor: '#ef4444' }}>
                    <div className="title">Failed / Rejected</div>
                    <div className="value" style={{ color: '#ef4444' }}>{tasks.filter(t => t.status === 'failed' || t.status === 'rejected').length}</div>
                </div>
            </div>

            <div className="atm-filters">
                <div className="atm-search">
                    <Icon d={icons.search} />
                    <input type="text" placeholder="Search by username, phone, email, UID..." value={q} onChange={e => setQ(e.target.value)} />
                </div>
                <select className="atm-select" value={filter} onChange={e => setFilter(e.target.value)}>
                    <option value="all">â€” All Statuses â€”</option>
                    <option value="pending_verification">Pending System</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed / Paid</option>
                    <option value="failed">Failed Drops</option>
                    <option value="rejected">Rejected</option>
                </select>
            </div>

            <div className="atm-table-wrapper">
                <table className="atm-table">
                    <thead>
                        <tr>
                            <th>User Details</th>
                            <th>Task Overview</th>
                            <th>Progress</th>
                            <th>Reward</th>
                            <th>Status & Logs</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && tasks.length === 0 ? (
                            <tr><td colSpan={6}><div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading secure task logs...</div></td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={6}><div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No task logs match your queries.</div></td></tr>
                        ) : filtered.map(t => {
                            const u = usersMap[t.uid] || {};
                            const bCls = getBadgeStyle(t.status);
                            
                            return (
                                <tr key={t.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div className="atm-avatar">
                                                {u.username ? u.username.substring(0,2).toUpperCase() : 'U'}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 700, color: '#1e293b' }}>{u.username || 'Unknown'} {u.country ? `(${u.country})` : ''}</div>
                                                <div style={{ fontSize: 12, color: '#64748b' }}>{u.phone || '—'} | {u.email || '—'}</div>
                                                <div style={{ fontSize: 10, color: '#aaa', fontFamily: 'monospace', marginTop: 4 }}>{t.uid}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 700, color: '#334155' }}>{t.taskTitle || (t.taskCategory || 'General').toUpperCase()}</div>
                                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Cat: {t.taskCategory || t.category || 'N/A'}</div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 800, color: '#0f172a' }}>{t.completed || 0} <span style={{ color: '#94a3b8', fontWeight: 500 }}>/ {t.total || '?'}</span></div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 800, color: '#059669', fontSize: 15 }}>{t.reward || 0} {t.rewardCurrency || u.currency || 'TZS'}</div>
                                    </td>
                                    <td>
                                        <div style={{ marginBottom: 6 }}>
                                            <span className={`atm-badge ${bCls}`}>
                                                {t.status.replace('_', ' ')}
                                            </span>
                                        </div>
                                        {(t.processingError || t.rejectReason) && (
                                            <div style={{ fontSize: 11, color: '#dc2626', maxWidth: 220, lineHeight: 1.3 }}>
                                                âš ï¸ {t.processingError || t.rejectReason}
                                            </div>
                                        )}
                                        {t.adminForcedCredit && (
                                            <div style={{ fontSize: 11, color: '#059669', fontWeight: 700, marginTop: 4 }}>
                                                âœ“ MANUALLY CREDITED
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        {(t.status === 'failed' || t.status === 'rejected' || t.status === 'pending_verification') ? (
                                            <button className="atm-btn atm-btn-success" onClick={() => handleForceCredit(t)} disabled={crediting}>
                                                Force Credit
                                            </button>
                                        ) : (
                                            <span style={{ fontSize: 13, color: '#cbd5e1', fontWeight: 600 }}>COMPLETED</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <GlobalConfirmModal
                isOpen={!!confirmDialog}
                title={confirmDialog?.title}
                message={confirmDialog?.message}
                isDestructive={false}
                onConfirm={confirmDialog?.onConfirm}
                onCancel={() => setConfirmDialog(null)}
            />
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════════════════
   ADMIN KYC REVIEW
══════════════════════════════════════════════════════════════════════════════════ */
export function AdminKycReview() {
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reviewApp, setReviewApp] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState(null);
    const [promptDialog, setPromptDialog] = useState(null);
    const { showToast } = useToast();

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const snap = await getDocs(collection(db, 'businessVerification'));
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt);
            setApplications(data);
        } catch (e) {
            console.error(e);
            showToast("Failed to load KYC applications", "error");
        }
        setLoading(false);
    }, [showToast]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleApprove = async () => {
        setConfirmDialog({
            title: 'Authorize Access',
            message: 'Approve this KYC application and grant full vendor access?',
            onConfirm: async () => {
                setConfirmDialog(null);
                try {
                    await updateDoc(doc(db, 'businessVerification', reviewApp.id), {
                        status: 'approved',
                        updatedAt: Date.now()
                    });
                    showToast("Vendor KYC Approved! They can now post products.", "success");
                    setReviewApp(null);
                    loadData();
                } catch (err) {
                    showToast("Approval failed", "error");
                }
            }
        });
    };

    const handleReject = async (reason) => {
        if (!reason) { showToast("Rejection reason is required", "error"); return; }
        setConfirmDialog({
            title: 'Reject Application',
            message: 'Are you sure you want to completely reject this KYC application?',
            isDestructive: true,
            onConfirm: async () => {
                setConfirmDialog(null);
                try {
                    await updateDoc(doc(db, 'businessVerification', reviewApp.id), {
                        status: 'rejected',
                        rejectReason: reason,
                        updatedAt: Date.now()
                    });
                    showToast("Vendor KYC Rejected.", "error");
                    setReviewApp(null);
                    loadData();
                } catch (err) {
                    showToast("Rejection failed", "error");
                }
            }
        });
    };

    return (
        <div className="kyc-review-container">
            {/* Modal */}
            {reviewApp && (
                <div className="kyc-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setReviewApp(null); }}>
                    <div className="kyc-modal-box">
                        <div className="kyc-modal-header">
                            <h2>Reviewing Operator Identity: <span style={{ color: '#3b82f6' }}>{reviewApp.businessName}</span></h2>
                            <button className="kyc-modal-close" onClick={() => setReviewApp(null)}>&times;</button>
                        </div>
                        
                        <div className="kyc-modal-body">
                            
                            {/* Left Data */}
                            <div className="kyc-data-panel">
                                <div className="kyc-section-title">Applicant Data Extract</div>
                                <div className="kyc-data-grid">
                                    <div className="kyc-data-item"><label>Legal Name</label><div className="val">{reviewApp.fullName}</div></div>
                                    <div className="kyc-data-item"><label>Business Name</label><div className="val">{reviewApp.businessName}</div></div>
                                    <div className="kyc-data-item"><label>ID Type</label><div className="val">{(reviewApp.idType || 'N/A').toUpperCase().replace('_', ' ')}</div></div>
                                    <div className="kyc-data-item"><label>ID Target Reference Number</label><div className="kyc-id-highlight">{reviewApp.idNumber || 'N/A'}</div></div>
                                    <div className="kyc-data-item"><label>Region / Locality</label><div className="val">{reviewApp.region || 'N/A'}</div></div>
                                    <div className="kyc-data-item"><label>Intercepted Comms</label><div className="val">{reviewApp.phone} <br/> {reviewApp.email}</div></div>
                                </div>
                            </div>

                            {/* Right Images */}
                            <div className="kyc-images-panel">
                                <div className="kyc-section-title">Cryptographic Proof & Documents</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                    <div className="kyc-image-box">
                                        <div className="kyc-image-title">FRONT OF ID</div>
                                        <div className="kyc-image-wrapper">
                                            {reviewApp.idFrontB64 ? 
                                                <img src={reviewApp.idFrontB64} alt="ID Front" /> :
                                                <div style={{ color: '#64748b', fontSize: 13 }}>No Signal Received</div>
                                            }
                                        </div>
                                    </div>
                                    <div className="kyc-image-box">
                                        <div className="kyc-image-title">BACK OF ID</div>
                                        <div className="kyc-image-wrapper">
                                            {reviewApp.idBackB64 ? 
                                                <img src={reviewApp.idBackB64} alt="ID Back" /> :
                                                <div style={{ color: '#64748b', fontSize: 13 }}>No Signal Received</div>
                                            }
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                        
                        <div className="kyc-modal-footer">
                            <button className="kyc-action-btn kyc-btn-reject" onClick={() => {
                                setPromptDialog({
                                    title: 'Denial Reason',
                                    message: 'Enter explicit reason for denial (Logged to secure node):',
                                    placeholder: 'e.g. ID Image blurry',
                                    onConfirm: (reason) => {
                                        setPromptDialog(null);
                                        handleReject(reason);
                                    }
                                });
                            }}>
                                ✕ REJECT CLEARANCE
                            </button>
                            <button className="kyc-action-btn kyc-btn-approve" onClick={handleApprove}>
                                ✓ GRANT AUTHORIZATION
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="kyc-header">
                <div>
                    <h1>KYC Processing Node</h1>
                    <p>Review submitted identity files against external registries securely.</p>
                </div>
            </div>

            <div className="kyc-table-wrapper">
                <table className="kyc-table">
                    <thead>
                        <tr>
                            <th>Upload Intel</th>
                            <th>Target Info</th>
                            <th>Entity Tag</th>
                            <th>Access Status</th>
                            <th>Directive</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && applications.length === 0 ? (
                            <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Establishing link to application databank...</td></tr>
                        ) : applications.length === 0 ? (
                            <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>No active KYC files waiting for processing.</td></tr>
                        ) : applications.map(app => (
                            <tr key={app.id}>
                                <td>
                                    <div className="kyc-cell-main">{new Date(app.createdAt).toLocaleDateString()}</div>
                                    <div className="kyc-cell-sub">{new Date(app.createdAt).toLocaleTimeString()}</div>
                                </td>
                                <td>
                                    <div className="kyc-cell-main">{app.fullName}</div>
                                    <div className="kyc-cell-sub">{app.email}</div>
                                </td>
                                <td>
                                    <div className="kyc-cell-main" style={{ color: '#3b82f6' }}>{app.businessName}</div>
                                    <div className="kyc-cell-sub">{app.businessType}</div>
                                </td>
                                <td>
                                    <span className={`kyc-badge ${app.status || 'pending'}`}>{(app.status || 'pending').toUpperCase()}</span>
                                    {app.rejectReason && <div style={{ fontSize: 11, color: '#f87171', marginTop: 6, maxWidth: 200 }}>Denial: {app.rejectReason}</div>}
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                    <button 
                                        className={app.status === 'pending' ? 'kyc-btn-review' : 'kyc-btn-reviewed'}
                                        onClick={() => setReviewApp(app)}
                                    >
                                        {app.status === 'pending' ? 'Execute Review' : 'Inspect'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <GlobalConfirmModal
                isOpen={!!confirmDialog}
                title={confirmDialog?.title}
                message={confirmDialog?.message}
                isDestructive={confirmDialog?.isDestructive}
                onConfirm={confirmDialog?.onConfirm}
                onCancel={() => setConfirmDialog(null)}
            />
            <PromptModal
                isOpen={!!promptDialog}
                title={promptDialog?.title}
                message={promptDialog?.message}
                placeholder={promptDialog?.placeholder}
                onConfirm={promptDialog?.onConfirm}
                onCancel={() => setPromptDialog(null)}
            />
        </div>
    );
}


/* ════════════════════════════════════════════════════════════════════════
   ORDERS DISPATCH MANAGEMENT
════════════════════════════════════════════════════════════════════════ */
export function AdminOrders() {
    const { showToast } = useToast();

    const [orders, setOrders] = useState([]);
    const [usersMap, setUsersMap] = useState({});
    const [productsMap, setProductsMap] = useState({});
    const [q, setQ] = useState('');
    const [loading, setLoading] = useState(true);

    const loadOrders = useCallback(async () => {
        setLoading(true);
        try {
            const [oSnap, uSnap, pSnap] = await Promise.all([
                getDocs(collection(db, 'orders')),
                getDocs(collection(db, 'users')),
                getDocs(collection(db, 'sellerProducts'))
            ]);
            
            const uMap = {};
            if (!uSnap.empty) uSnap.docs.forEach(d => uMap[d.id] = d.data());
            setUsersMap(uMap);

            const pMap = {};
            if (!pSnap.empty) pSnap.docs.forEach(d => pMap[d.id] = d.data());
            setProductsMap(pMap);

            if (!oSnap.empty) {
                const list = oSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                setOrders(list);
            } else {
                setOrders([]);
            }
        } catch (e) {
            showToast('Failed to load orders & products', 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => { loadOrders(); }, [loadOrders]);

    const handleUpdateStatus = async (orderId, newStatus) => {
        try {
            await updateDoc(doc(db, 'orders', orderId), { status: newStatus });
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
            showToast(`Status shifted to ${newStatus.toUpperCase()} successfully`, 'success');
        } catch (e) {
            showToast('Dispatch failed', 'error');
        }
    };

    const filtered = orders.filter(o => 
        !q || 
        o.id.toLowerCase().includes(q.toLowerCase()) || 
        o.productName?.toLowerCase().includes(q.toLowerCase()) ||
        o.buyerName?.toLowerCase().includes(q.toLowerCase())
    );

    return (
        <div className="admin-orders-premium">
            <style>{`
                .admin-orders-premium {
                    padding: 0 10px;
                }
                .aop-header {
                    margin-bottom: 24px;
                }
                .aop-title {
                    font-size: 28px;
                    font-weight: 800;
                    background: linear-gradient(135deg, #FFD700 0%, #F59E0B 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    margin: 0 0 6px 0;
                    letter-spacing: -0.5px;
                }
                .aop-subtitle {
                    font-size: 13px;
                    color: var(--text-secondary);
                    margin: 0;
                }
                .aop-search-bar {
                    display: flex;
                    gap: 12px;
                    margin-bottom: 24px;
                }
                .aop-search-input {
                    flex: 1;
                    background: var(--bg-input);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    padding: 12px 18px;
                    color: var(--text-primary);
                    font-size: 14px;
                    outline: none;
                    transition: border 0.2s, box-shadow 0.2s;
                }
                .aop-search-input:focus {
                    border-color: #FFD700;
                    box-shadow: 0 0 0 3px rgba(255,215,0,0.1);
                }
                .aop-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
                    gap: 20px;
                }
                .aop-card {
                    background: var(--bg-card);
                    border: 1px solid var(--border-color);
                    border-radius: 16px;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    transition: transform 0.2s, box-shadow 0.2s;
                    position: relative;
                }
                .aop-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 12px 24px -8px rgba(0,0,0,0.3);
                    border-color: rgba(255,215,0,0.3);
                }
                .aop-card-image {
                    width: 100%;
                    height: 160px;
                    object-fit: cover;
                    background: #1E293B;
                }
                .aop-card-no-image {
                    width: 100%;
                    height: 160px;
                    background: #0F172A;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 40px;
                    color: #334155;
                }
                .aop-card-content {
                    padding: 16px;
                    display: flex;
                    flex-direction: column;
                    flex: 1;
                }
                .aop-card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 12px;
                }
                .aop-card-title {
                    font-weight: 700;
                    font-size: 16px;
                    color: var(--text-primary);
                    line-height: 1.3;
                    margin: 0;
                }
                .aop-card-price {
                    font-weight: 800;
                    color: #22C55E;
                    font-size: 15px;
                    margin-top: 4px;
                }
                .aop-status-badge {
                    padding: 4px 10px;
                    border-radius: 20px;
                    font-size: 10px;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .aop-badge-pending { background: rgba(245,158,11,0.1); color: #F59E0B; border: 1px solid rgba(245,158,11,0.3); }
                .aop-badge-confirmed { background: rgba(59,130,246,0.1); color: #3B82F6; border: 1px solid rgba(59,130,246,0.3); }
                .aop-badge-traveling { background: rgba(139,92,246,0.1); color: #8B5CF6; border: 1px solid rgba(139,92,246,0.3); }
                .aop-badge-completed { background: rgba(34,197,94,0.1); color: #22C55E; border: 1px solid rgba(34,197,94,0.3); }
                .aop-badge-rejected { background: rgba(239,68,68,0.1); color: #EF4444; border: 1px solid rgba(239,68,68,0.3); }
                
                .aop-meta-row {
                    display: flex;
                    justify-content: space-between;
                    font-size: 12px;
                    padding-bottom: 12px;
                    margin-bottom: 12px;
                    border-bottom: 1px dashed var(--border-color);
                }
                .aop-meta-label {
                    color: var(--text-muted);
                    font-size: 10px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 2px;
                }
                .aop-meta-val {
                    color: var(--text-secondary);
                    font-weight: 500;
                }
                .aop-logistics-path {
                    background: rgba(0,0,0,0.2);
                    border-radius: 8px;
                    padding: 10px;
                    margin-bottom: 16px;
                }
                .aop-party {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 12px;
                }
                .aop-party-icon {
                    font-size: 14px;
                }
                .aop-action-bar {
                    margin-top: auto;
                    display: flex;
                    gap: 8px;
                }
                .aop-select {
                    flex: 1;
                    background: var(--bg-input);
                    border: 1px solid var(--border-color);
                    color: var(--text-primary);
                    padding: 8px 12px;
                    border-radius: 8px;
                    font-size: 12px;
                    font-weight: 600;
                    outline: none;
                    cursor: pointer;
                    appearance: none;
                }
                .aop-select:focus { border-color: #3B82F6; }
                .aop-empty {
                    text-align: center;
                    padding: 80px 20px;
                    color: var(--text-muted);
                    background: var(--bg-card);
                    border: 1px dashed var(--border-color);
                    border-radius: 16px;
                    font-size: 15px;
                }
            `}</style>

            <div className="aop-header">
                <h1 className="aop-title">Order Dispatch Engine</h1>
                <p className="aop-subtitle">Globally track shipping channels, inspect items, and update logistics statuses in real-time.</p>
            </div>

            <div className="aop-search-bar">
                <input 
                    className="aop-search-input" 
                    placeholder="Search by tracing ID, Product Name, or Buyer Name..." 
                    value={q} 
                    onChange={e => setQ(e.target.value)} 
                />
                <button 
                    className="gov-btn" 
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                    onClick={loadOrders}
                >
                    <Icon d={icons.refresh} />
                </button>
            </div>

            {loading ? (
                <div className="aop-empty">
                    <div className="g-spinner mx-auto mb-4" />
                    Gathering dispatch logistics...
                </div>
            ) : filtered.length === 0 ? (
                <div className="aop-empty">
                    <span style={{ fontSize: 40, display: 'block', margin: '0 auto 12px auto' }}>🚀</span>
                    No active product logistics paths established yet.
                </div>
            ) : (
                <div className="aop-grid">
                    {filtered.map(o => {
                        const buyer = usersMap[o.buyerUid] || {};
                        const seller = usersMap[o.sellerUid] || {};
                        const productExt = productsMap[o.productId] || {};
                        const img = productExt.image || productExt.imageB64 || null;
                        
                        return (
                            <div key={o.id} className="aop-card">
                                {img ? (
                                    <img src={img} alt="Product Thumbnail" className="aop-card-image" />
                                ) : (
                                    <div className="aop-card-no-image">📦</div>
                                )}
                                
                                <div className="aop-card-content">
                                    <div className="aop-card-header">
                                        <div>
                                            <h3 className="aop-card-title">{o.productName}</h3>
                                            <div className="aop-card-price">TZS {Number(o.price || 0).toLocaleString()}</div>
                                        </div>
                                        <span className={`aop-status-badge aop-badge-${o.status || 'pending'}`}>
                                            {(o.status || 'pending')}
                                        </span>
                                    </div>
                                    
                                    <div className="aop-meta-row">
                                        <div>
                                            <div className="aop-meta-label">ID TRACE</div>
                                            <div className="aop-meta-val" style={{ fontFamily: 'monospace' }}>{o.id.slice(0,8).toUpperCase()}</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div className="aop-meta-label">TIMESTAMP</div>
                                            <div className="aop-meta-val">{new Date(o.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                                        </div>
                                    </div>

                                    <div className="aop-logistics-path">
                                        <div className="aop-party" style={{ marginBottom: 8 }}>
                                            <span className="aop-party-icon">🛒</span>
                                            <div>
                                                <div className="aop-meta-label">PURCHASING ORIGIN</div>
                                                <div className="aop-meta-val">{buyer.username || o.buyerName || o.buyerUid?.slice(0,8)}</div>
                                            </div>
                                        </div>
                                        <div className="aop-party">
                                            <span className="aop-party-icon">🏪</span>
                                            <div>
                                                <div className="aop-meta-label">SELLER DISPATCH</div>
                                                <div className="aop-meta-val">{seller.username || (seller.fullName) || o.sellerUid?.slice(0,8)}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="aop-action-bar">
                                        <select 
                                            className="aop-select"
                                            value={o.status || 'pending'}
                                            onChange={(e) => handleUpdateStatus(o.id, e.target.value)}
                                        >
                                            <option value="pending" disabled>🚧 Pending</option>
                                            <option value="confirmed">✅ Confirmed</option>
                                            <option value="traveling">🚚 Assign Traveling</option>
                                            <option value="completed">🎉 Mark Completed</option>
                                            <option value="rejected">❌ Cancel Route</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
/* ═══════════════════════════════════════════════════════════
   ADMIN UPLINER EDITOR
═══════════════════════════════════════════════════════════ */
export function AdminUplinerEditor() {
    const { user: adminUser } = useAuth();
    const { showToast } = useToast();

    // ── State ──────────────────────────────────────────────
    const [allUsers, setAllUsers] = useState([]);
    const [usersMap, setUsersMap] = useState({});      // uid → userData
    const [loginIndex, setLoginIndex] = useState({});  // username.lowercase → uid
    const [loadingUsers, setLoadingUsers] = useState(true);

    // Target user (the one to re-assign)
    const [targetQuery, setTargetQuery] = useState('');
    const [targetUser, setTargetUser] = useState(null);

    // New upliner
    const [newUplinerQuery, setNewUplinerQuery] = useState('');
    const [newUplinerUser, setNewUplinerUser] = useState(null);
    const [uplinerSearchStatus, setUplinerSearchStatus] = useState(''); // '', 'found', 'not-found', 'searching'

    // UI
    const [saving, setSaving] = useState(false);
    const [circularWarning, setCircularWarning] = useState('');

    // Audit history
    const [auditLog, setAuditLog] = useState([]);
    const [loadingAudit, setLoadingAudit] = useState(true);

    // ── Load all users ─────────────────────────────────────
    const loadUsers = useCallback(() => {
        setLoadingUsers(true);
        getDocs(collection(db, 'users')).then(snap => {
            const users = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
            const map = {};
            const idx = {};
            users.forEach(u => {
                map[u.uid] = u;
                if (u.username) idx[u.username.toLowerCase()] = u.uid;
            });
            setAllUsers(users);
            setUsersMap(map);
            setLoginIndex(idx);
            setLoadingUsers(false);
        }).catch(() => setLoadingUsers(false));
    }, []);

    // ── Load audit log ─────────────────────────────────────
    const loadAudit = useCallback(() => {
        setLoadingAudit(true);
        getDocs(collection(db, 'uplinerChanges')).then(snap => {
            const entries = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => (b.changedAt || 0) - (a.changedAt || 0))
                .slice(0, 50);
            setAuditLog(entries);
            setLoadingAudit(false);
        }).catch(() => setLoadingAudit(false));
    }, []);

    useEffect(() => { loadUsers(); loadAudit(); }, [loadUsers, loadAudit]);

    // ── Filtered target user suggestions ──────────────────
    const targetSuggestions = targetQuery.length >= 2 && !targetUser
        ? allUsers.filter(u => {
              const q = targetQuery.toLowerCase();
              return u.username?.toLowerCase().includes(q)
                  || u.email?.toLowerCase().includes(q)
                  || u.uid?.toLowerCase().includes(q)
                  || u.phone?.includes(q);
          }).slice(0, 8)
        : [];

    // ── Circular reference guard ───────────────────────────
    const checkCircular = (target, proposedUpliner, uMap, idx) => {
        if (!target || !proposedUpliner) return '';
        if (proposedUpliner.uid === target.uid) return '⚠️ Cannot assign a user as their own upliner.';
        let current = proposedUpliner;
        for (let i = 0; i < 12; i++) {
            if (!current.referrer) break;
            const upUid = idx[current.referrer.toLowerCase()] || Object.values(uMap).find(u => u.username === current.referrer)?.uid;
            if (!upUid) break;
            if (upUid === target.uid) {
                return `⚠️ Circular reference! ${proposedUpliner.username} is a downline of ${target.username}. This would create an infinite commission loop.`;
            }
            current = uMap[upUid] || {};
        }
        return '';
    };

    // ── Search new upliner ────────────────────────────────
    const searchNewUpliner = async () => {
        const q = newUplinerQuery.trim();
        if (!q) return;
        setUplinerSearchStatus('searching');
        setNewUplinerUser(null);
        setCircularWarning('');

        const uid = loginIndex[q.toLowerCase()];
        let found = uid ? usersMap[uid] : null;

        if (!found) {
            // Fallback: fetch loginIndex doc directly
            try {
                const { getDoc: gd, doc: d2, db: fdb } = await import('../../services/firebase-config.js');
                const snap = await gd(d2(fdb, 'loginIndex', q));
                if (snap.exists()) {
                    const fUid = snap.data().uid;
                    found = usersMap[fUid];
                }
            } catch { /* ignore */ }
        }

        if (found) {
            setNewUplinerUser(found);
            setUplinerSearchStatus('found');
            setCircularWarning(checkCircular(targetUser, found, usersMap, loginIndex));
        } else {
            setUplinerSearchStatus('not-found');
        }
    };

    // ── Save upliner change ────────────────────────────────
    const handleSave = async () => {
        if (!targetUser || !newUplinerUser) return;
        if (circularWarning) { showToast('Fix the circular reference issue first.', 'error'); return; }
        if (targetUser.uid === newUplinerUser.uid) { showToast('Cannot assign self as upliner.', 'error'); return; }

        setSaving(true);
        try {
            const oldUplinerUsername = targetUser.referrer || null;
            const newUplinerUsername = newUplinerUser.username;
            const now = Date.now();

            // 1. Update target user's referrer
            await updateDoc(doc(db, 'users', targetUser.uid), { referrer: newUplinerUsername });

            // 2. Remove from old upliner's embedded referrals.level1 array (if present)
            if (oldUplinerUsername) {
                const oldUid = loginIndex[oldUplinerUsername.toLowerCase()]
                    || Object.values(usersMap).find(u => u.username === oldUplinerUsername)?.uid;
                if (oldUid && usersMap[oldUid]) {
                    const oldData = usersMap[oldUid];
                    const oldL1 = (oldData.referrals?.level1 || []).filter(uid => uid !== targetUser.uid);
                    if (oldL1.length !== (oldData.referrals?.level1 || []).length) {
                        await updateDoc(doc(db, 'users', oldUid), { 'referrals.level1': oldL1 });
                    }
                }
            }

            // 3. Add to new upliner's embedded referrals.level1 array (if they use it)
            const newUplinerData = usersMap[newUplinerUser.uid];
            const existingL1 = newUplinerData?.referrals?.level1 || [];
            if (existingL1.length > 0 && !existingL1.includes(targetUser.uid)) {
                await updateDoc(doc(db, 'users', newUplinerUser.uid), {
                    'referrals.level1': [...existingL1, targetUser.uid]
                });
            }

            // 4. Write audit record
            await addDoc(collection(db, 'uplinerChanges'), {
                targetUid: targetUser.uid,
                targetUsername: targetUser.username || '',
                oldUpliner: oldUplinerUsername || 'none',
                newUpliner: newUplinerUsername,
                changedBy: adminUser?.uid || 'admin',
                changedAt: now
            });

            showToast(`✅ ${targetUser.username} is now under ${newUplinerUsername}. Affiliate page will reflect this immediately.`, 'success');

            // Reset
            setTargetUser(null); setTargetQuery('');
            setNewUplinerUser(null); setNewUplinerQuery('');
            setUplinerSearchStatus(''); setCircularWarning('');
            loadUsers(); loadAudit();
        } catch (e) {
            showToast(`Failed: ${e.message}`, 'error');
        }
        setSaving(false);
    };

    const codeOf = u => (u?.countryCode || u?.country || 'TZ').toLowerCase();

    return (
        <div>
            <h1 className="gov-title">Upliner Editor</h1>
            <p className="gov-subtitle">Reassign a user's referral upliner. The Affiliate page reflects changes immediately. Past commissions are not reversed — only future activations flow to the new upliner.</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 24 }}>

                {/* ── Step 1: Select Target User ── */}
                <div className="gov-panel">
                    <div className="gov-panel-header">
                        <div className="gov-panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ background: 'var(--gov-blue)', color: '#fff', borderRadius: '50%', width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>1</span>
                            Select User to Reassign
                        </div>
                    </div>
                    <div className="gov-panel-body" style={{ padding: 16 }}>
                        <input
                            className="gov-input"
                            placeholder="Search username, phone, email, UID..."
                            value={targetQuery}
                            onChange={e => { setTargetQuery(e.target.value); setTargetUser(null); setNewUplinerUser(null); setCircularWarning(''); setUplinerSearchStatus(''); }}
                            style={{ marginBottom: 8 }}
                        />
                        {targetSuggestions.length > 0 && (
                            <div style={{ border: '1px solid #E2E8F0', borderRadius: 6, overflow: 'hidden', marginBottom: 8, maxHeight: 240, overflowY: 'auto' }}>
                                {targetSuggestions.map(u => (
                                    <div
                                        key={u.uid}
                                        onClick={() => { setTargetUser(u); setTargetQuery(u.username || u.uid); }}
                                        style={{ padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #F1F5F9', background: '#fff' }}
                                        onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                                        onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                                    >
                                        <img src={`https://flagcdn.com/w40/${codeOf(u)}.png`} alt="" style={{ width: 22, height: 15, borderRadius: 2, objectFit: 'cover' }} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 700, fontSize: 13 }}>{u.username}</div>
                                            <div style={{ fontSize: 11, color: '#94A3B8' }}>{u.email || u.phone}</div>
                                        </div>
                                        <StatusBadge status={u.isActive ? 'active' : 'pending'} />
                                    </div>
                                ))}
                            </div>
                        )}
                        {targetUser && (
                            <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 8, padding: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                    <img src={`https://flagcdn.com/w40/${codeOf(targetUser)}.png`} alt="" style={{ width: 28, height: 18, borderRadius: 3, objectFit: 'cover' }} />
                                    <div>
                                        <div style={{ fontWeight: 700 }}>{targetUser.username}</div>
                                        <div style={{ fontSize: 11, color: '#64748B', fontFamily: 'monospace' }}>{targetUser.uid}</div>
                                    </div>
                                </div>
                                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                                    <tbody>
                                        <tr><td style={{ padding: '4px 0', color: '#64748B', fontWeight: 600 }}>Current Upliner</td><td style={{ textAlign: 'right', fontWeight: 700, color: targetUser.referrer ? '#0288D1' : '#999', fontFamily: 'monospace' }}>{targetUser.referrer || '— None'}</td></tr>
                                        <tr><td style={{ padding: '4px 0', color: '#64748B', fontWeight: 600 }}>Status</td><td style={{ textAlign: 'right' }}><StatusBadge status={targetUser.isActive ? 'active' : 'pending'} /></td></tr>
                                        <tr><td style={{ padding: '4px 0', color: '#64748B', fontWeight: 600 }}>Currency</td><td style={{ textAlign: 'right' }}>{targetUser.currency || 'TZS'}</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {loadingUsers && <div style={{ color: '#94A3B8', fontSize: 13, marginTop: 8 }}>Loading users...</div>}
                    </div>
                </div>

                {/* ── Step 2: New Upliner ── */}
                <div className="gov-panel">
                    <div className="gov-panel-header">
                        <div className="gov-panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ background: 'var(--gov-blue)', color: '#fff', borderRadius: '50%', width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>2</span>
                            Set New Upliner
                        </div>
                    </div>
                    <div className="gov-panel-body" style={{ padding: 16 }}>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                            <input
                                className="gov-input"
                                placeholder="Exact username..."
                                value={newUplinerQuery}
                                onChange={e => { setNewUplinerQuery(e.target.value); setNewUplinerUser(null); setUplinerSearchStatus(''); setCircularWarning(''); }}
                                onKeyDown={e => e.key === 'Enter' && searchNewUpliner()}
                                style={{ flex: 1 }}
                                disabled={!targetUser}
                            />
                            <button
                                className="gov-btn gov-btn-primary"
                                onClick={searchNewUpliner}
                                disabled={!targetUser || !newUplinerQuery.trim() || uplinerSearchStatus === 'searching'}
                                style={{ padding: '0 14px', whiteSpace: 'nowrap' }}
                            >
                                {uplinerSearchStatus === 'searching' ? '...' : 'Find'}
                            </button>
                        </div>

                        {!targetUser && <div style={{ color: '#94A3B8', fontSize: 12, textAlign: 'center', padding: '12px 0' }}>← Select a target user first</div>}

                        {uplinerSearchStatus === 'not-found' && (
                            <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: 10, color: '#DC2626', fontSize: 13 }}>
                                ❌ Username not found. Check spelling (case-sensitive).
                            </div>
                        )}

                        {newUplinerUser && (
                            <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 8, padding: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                    <img src={`https://flagcdn.com/w40/${codeOf(newUplinerUser)}.png`} alt="" style={{ width: 28, height: 18, borderRadius: 3, objectFit: 'cover' }} />
                                    <div>
                                        <div style={{ fontWeight: 700, color: '#16A34A' }}>✓ {newUplinerUser.username}</div>
                                        <div style={{ fontSize: 11, color: '#64748B', fontFamily: 'monospace' }}>{newUplinerUser.uid}</div>
                                    </div>
                                </div>
                                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                                    <tbody>
                                        <tr><td style={{ padding: '4px 0', color: '#64748B', fontWeight: 600 }}>Their Upliner</td><td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{newUplinerUser.referrer || '— Top Level'}</td></tr>
                                        <tr><td style={{ padding: '4px 0', color: '#64748B', fontWeight: 600 }}>Status</td><td style={{ textAlign: 'right' }}><StatusBadge status={newUplinerUser.isActive ? 'active' : 'pending'} /></td></tr>
                                        <tr><td style={{ padding: '4px 0', color: '#64748B', fontWeight: 600 }}>Currency</td><td style={{ textAlign: 'right' }}>{newUplinerUser.currency || 'TZS'}</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {circularWarning && (
                            <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, padding: 10, color: '#92400E', fontSize: 13, marginTop: 8 }}>
                                {circularWarning}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Step 3: Confirm ── */}
            {targetUser && newUplinerUser && !circularWarning && (
                <div className="gov-panel" style={{ marginBottom: 24 }}>
                    <div className="gov-panel-header">
                        <div className="gov-panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ background: '#2E7D32', color: '#fff', borderRadius: '50%', width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>3</span>
                            Confirm Change
                        </div>
                    </div>
                    <div className="gov-panel-body" style={{ padding: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
                            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 16px', textAlign: 'center' }}>
                                <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, marginBottom: 2 }}>USER</div>
                                <div style={{ fontWeight: 700 }}>{targetUser.username}</div>
                            </div>
                            <div style={{ flex: 1, minWidth: 160, textAlign: 'center' }}>
                                <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6 }}>UPLINER CHANGES</div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                    <span style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 6, padding: '4px 10px', fontWeight: 700, color: '#DC2626', fontFamily: 'monospace', fontSize: 13 }}>
                                        {targetUser.referrer || 'none'}
                                    </span>
                                    <span style={{ color: '#94A3B8' }}>→</span>
                                    <span style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 6, padding: '4px 10px', fontWeight: 700, color: '#16A34A', fontFamily: 'monospace', fontSize: 13 }}>
                                        {newUplinerUser.username}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#92400E', marginBottom: 12 }}>
                            ⚠️ Past commissions already paid are NOT reversed. Affiliate page will update instantly for both old and new upliners.
                        </div>
                        <button className="gov-btn gov-btn-success" onClick={handleSave} disabled={saving} style={{ minWidth: 200 }}>
                            {saving ? 'Saving...' : '✅ Confirm & Save Upliner Change'}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Audit Log ── */}
            <div className="gov-panel">
                <div className="gov-panel-header">
                    <div className="gov-panel-title">Upliner Change History</div>
                    <button className="gov-btn gov-btn-outline" style={{ padding: '4px 10px', fontSize: 11 }} onClick={loadAudit}>↻ Refresh</button>
                </div>
                <div className="gov-table-container">
                    <table className="gov-table">
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Old Upliner</th>
                                <th>New Upliner</th>
                                <th>Timestamp</th>
                                <th>Admin UID</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loadingAudit && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: '#94A3B8' }}>Loading...</td></tr>}
                            {!loadingAudit && auditLog.length === 0 && (
                                <tr><td colSpan={5}><div className="gov-empty-state">No upliner changes recorded yet.</div></td></tr>
                            )}
                            {auditLog.map(entry => (
                                <tr key={entry.id}>
                                    <td>
                                        <div style={{ fontWeight: 700 }}>{entry.targetUsername || entry.targetUid?.slice(0, 10)}</div>
                                        <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#94A3B8' }}>{entry.targetUid?.slice(0, 14)}...</div>
                                    </td>
                                    <td><span style={{ fontFamily: 'monospace', color: '#DC2626', fontWeight: 600 }}>{entry.oldUpliner || '—'}</span></td>
                                    <td><span style={{ fontFamily: 'monospace', color: '#16A34A', fontWeight: 600 }}>{entry.newUpliner}</span></td>
                                    <td style={{ fontSize: 12 }}>{entry.changedAt ? new Date(entry.changedAt).toLocaleString() : '—'}</td>
                                    <td style={{ fontSize: 11, fontFamily: 'monospace', color: '#94A3B8' }}>{entry.changedBy?.slice(0, 12) || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
