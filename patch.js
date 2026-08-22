const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'client/src/pages/admin/AdminPages.jsx');

const appendData = `

/* ════════════════════════════════════════════════════════════════════════
   ORDERS DISPATCH MANAGEMENT
════════════════════════════════════════════════════════════════════════ */
export function AdminOrders() {
    const { showToast } = require('../../contexts/ToastContext.jsx').useToast();
    const { useState, useEffect, useCallback } = require('react');
    const { db, doc, collection, getDocs, updateDoc } = require('../../services/firebase-config.js');
    
    // Using standard React context and imports that exist in the file scope
    // The required hooks are actually already imported at the top of AdminPages.jsx
    
    const [orders, setOrders] = useState([]);
    const [usersMap, setUsersMap] = useState({});
    const [q, setQ] = useState('');
    const [loading, setLoading] = useState(true);

    const loadOrders = useCallback(async () => {
        setLoading(true);
        try {
            const [oSnap, uSnap] = await Promise.all([
                getDocs(collection(db, 'orders')),
                getDocs(collection(db, 'users'))
            ]);
            
            const uMap = {};
            if (!uSnap.empty) uSnap.docs.forEach(d => uMap[d.id] = d.data());
            setUsersMap(uMap);

            if (!oSnap.empty) {
                const list = oSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                setOrders(list);
            } else {
                setOrders([]);
            }
        } catch (e) {
            showToast('Failed to load orders', 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => { loadOrders(); }, [loadOrders]);

    const handleUpdateStatus = async (orderId, newStatus) => {
        try {
            await updateDoc(doc(db, 'orders', orderId), { status: newStatus });
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
            showToast(\`Order status updated to \${newStatus.toUpperCase()}\`, 'success');
        } catch (e) {
            showToast('Failed to update status', 'error');
        }
    };

    const filtered = orders.filter(o => 
        !q || 
        o.id.toLowerCase().includes(q.toLowerCase()) || 
        o.productName?.toLowerCase().includes(q.toLowerCase()) ||
        o.buyerName?.toLowerCase().includes(q.toLowerCase())
    );

    return (
        <div>
            <h1 className="gov-title">Order Dispatch Control</h1>
            <p className="gov-subtitle">Global supply chain management and live transit triggering</p>

            <div className="gov-items-toolbar" style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                <input className="gov-input" style={{ flex: 1 }} placeholder="Search by Order ID, Product, or Buyer..." value={q} onChange={e => setQ(e.target.value)} />
                <button className="gov-btn gov-btn-outline" onClick={loadOrders}>Refresh</button>
            </div>

            <div className="gov-table-container">
                <table className="gov-table">
                    <thead><tr>
                        <th>Order ID / Date</th>
                        <th>Product Details</th>
                        <th>Buyer & Seller</th>
                        <th>Status</th>
                        <th>Dispatch Actions</th>
                    </tr></thead>
                    <tbody>
                        {loading && <tr><td colSpan={5}><div className="gov-empty-state">Loading dispatch vectors...</div></td></tr>}
                        {!loading && filtered.map(o => {
                            const buyer = usersMap[o.buyerUid] || {};
                            const seller = usersMap[o.sellerUid] || {};
                            return (
                                <tr key={o.id}>
                                    <td>
                                        <div className="gov-mono-text" style={{ fontSize: 13, textTransform: 'uppercase' }}>{o.id.slice(0,10)}</div>
                                        <div style={{ fontSize: 11, color: '#999' }}>{new Date(o.createdAt).toLocaleString()}</div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{o.productName}</div>
                                        <div style={{ color: 'var(--gov-success)', fontWeight: 700 }}>TZS {Number(o.price || 0).toLocaleString()}</div>
                                    </td>
                                    <td>
                                        <div>
                                            <span style={{ fontSize: 10,  color: '#999' }}>B:</span> {buyer.username || o.buyerName || o.buyerUid?.slice(0,6)} <br/>
                                            <span style={{ fontSize: 10,  color: '#999' }}>S:</span> {seller.username || o.sellerUid?.slice(0,6)}
                                        </div>
                                    </td>
                                    <td>
                                        <span className={\`gov-badge gov-badge-\${{ pending: 'warning', confirmed: 'success', traveling: 'primary', completed: 'success', rejected: 'danger' }[o.status || 'pending']} \`} style={{
                                            background: { pending: '#fef3c7', confirmed: '#dcfce7', traveling: '#e0f2fe', completed: '#dcfce7', rejected: '#fee2e2' }[o.status || 'pending'],
                                            color: { pending: '#d97706', confirmed: '#166534', traveling: '#0369a1', completed: '#166534', rejected: '#991b1b' }[o.status || 'pending'],
                                            padding: '4px 10px', borderRadius: 4, fontWeight: 700, fontSize: 11
                                        }}>
                                            {(o.status || 'pending').toUpperCase()}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="gov-action-group">
                                            <select 
                                                className="gov-input" 
                                                style={{ padding: '4px 8px', width: 140, fontSize: 12, height: 'auto' }}
                                                value={o.status || 'pending'}
                                                onChange={(e) => handleUpdateStatus(o.id, e.target.value)}
                                            >
                                                <option value="pending">Pending</option>
                                                <option value="confirmed">Confirmed</option>
                                                <option value="traveling">Traveling (Transit)</option>
                                                <option value="completed">Completed</option>
                                                <option value="rejected">Rejected / Cancelled</option>
                                            </select>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                        {!loading && filtered.length === 0 && <tr><td colSpan={5}><div className="gov-empty-state">No active logistics routes found.</div></td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
`;

fs.appendFileSync(file, appendData);
console.log("Appended to file");
