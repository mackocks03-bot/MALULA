const fs = require('fs');
const filepath = 'd:/GLORIA/NEWHOPE-CHAT/client/src/pages/admin/AdminPages.jsx';
let code = fs.readFileSync(filepath, 'utf8');

// Find the start of AdminMessages function
const startIdx = code.indexOf('export function AdminMessages()');
if (startIdx === -1) { console.error('Could not find AdminMessages'); process.exit(1); }

// Extract everything before it (so we keep other components)
const before = code.substring(0, startIdx);

// Build fully updated AdminMessages component
const updated = `export function AdminMessages() {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [messages, setMessages] = useState([]);
    const [usersList, setUsersList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null); // id to confirm-delete
    const [formData, setFormData] = useState({
        message: '',
        target: 'all',
        targetValue: '',
        color: 'blue'
    });

    const loadMessages = useCallback(async () => {
        setLoading(true);
        try {
            const snap = await getDocs(collection(db, 'adminMessages'));
            setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt));
        } catch (e) {
            console.error('Error loading admin messages', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadMessages(); }, [loadMessages]);

    useEffect(() => {
        getDocs(collection(db, 'users')).then(snap => {
            if (!snap.empty) {
                setUsersList(snap.docs.map(d => ({ uid: d.id, username: d.data().username || 'Unknown' })));
            }
        });
    }, []);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!formData.message.trim()) return showToast('Enter a message', 'warning');
        if (formData.target !== 'all' && !formData.targetValue.trim()) return showToast('Enter Target ID/Code', 'warning');

        setProcessing(true);
        try {
            let finalTarget = 'all';
            if (formData.target === 'group') {
                finalTarget = \`group:\${formData.targetValue}\`;
            } else if (formData.target === 'user') {
                const searchVal = formData.targetValue.trim().toLowerCase();
                const matchedUser = usersList.find(u => u.username.toLowerCase() === searchVal || u.uid === searchVal);
                if (!matchedUser) {
                    setProcessing(false);
                    return showToast('User not found by username or ID', 'error');
                }
                finalTarget = \`user:\${matchedUser.uid}\`;
            }

            await addDoc(collection(db, 'adminMessages'), {
                message: formData.message.trim(),
                target: finalTarget,
                color: formData.color,
                createdAt: Date.now(),
                createdBy: user.uid,
                active: true
            });
            showToast('Message broadcasted successfully!', 'success');
            setFormData({ message: '', target: 'all', targetValue: '', color: 'blue' });
            loadMessages();
        } catch (e) {
            console.error(e);
            showToast('Error sending message', 'error');
        } finally {
            setProcessing(false);
        }
    };

    const confirmDelete = (id) => {
        setDeleteTarget(id);
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await deleteDoc(doc(db, 'adminMessages', deleteTarget));
            showToast('Message deleted', 'success');
            setDeleteTarget(null);
            loadMessages();
        } catch (e) {
            showToast('Error deleting', 'error');
            setDeleteTarget(null);
        }
    };
    
    const handleToggleActive = async (id, currentActive) => {
        try {
            await updateDoc(doc(db, 'adminMessages', id), { active: !currentActive });
            showToast('Status updated', 'success');
            loadMessages();
        } catch (e) {
            showToast('Error updating status', 'error');
        }
    };

    return (
        <>
        {/* Delete Confirmation Modal */}
        {deleteTarget && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,35,0.65)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: 20 }}>
                <div style={{ background: '#fff', borderRadius: 20, padding: '32px 28px', maxWidth: 380, width: '100%', boxShadow: '0 25px 60px rgba(0,0,0,0.2)', textAlign: 'center' }}>
                    <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(255,86,48,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28 }}>
                        🗑️
                    </div>
                    <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#2b3674' }}>Delete Message?</h3>
                    <p style={{ margin: '0 0 24px', fontSize: 13, color: '#8f9bba', lineHeight: 1.5 }}>This will permanently remove the broadcast and it will disappear from all user dashboards immediately.</p>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={() => setDeleteTarget(null)} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', background: '#f1f5f9', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#2b3674' }}>Cancel</button>
                        <button onClick={handleDelete} style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#ff5630,#ff8a65)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>Delete</button>
                    </div>
                </div>
            </div>
        )}

        <div className="payflow-ui">
            <header className="pf-top-bar">
                <div className="pf-greeting">
                    <h1>
                        <i className="fas fa-bullhorn" style={{ marginRight: 10, color: '#4318ff' }} />
                        Broadcast Messaging
                    </h1>
                    <p>Publish notifications directly to user dashboards</p>
                </div>
            </header>

            <div className="pf-card" style={{ maxWidth: 700, marginBottom: 24 }}>
                <div className="pf-card-header">
                    <span className="pf-card-title">
                        <i className="fas fa-edit" style={{ marginRight: 8, color: '#4318ff' }} />
                        Compose Notification
                    </span>
                </div>

                <form onSubmit={handleSend} style={{ marginTop: 8 }}>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#2b3674' }}>Message Content</label>
                        <textarea
                            value={formData.message}
                            onChange={(e) => setFormData(p => ({ ...p, message: e.target.value }))}
                            placeholder="Enter the broadcast message..."
                            rows={4}
                            style={{ width: '100%', resize: 'vertical', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.8)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
                            required
                        />
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#2b3674' }}>Audience</label>
                            <select
                                value={formData.target}
                                onChange={(e) => setFormData(p => ({ ...p, target: e.target.value, targetValue: '' }))}
                                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.8)', fontSize: 13, outline: 'none' }}
                            >
                                <option value="all">All Personnel</option>
                                <option value="group">Specific Country (e.g. TZ)</option>
                                <option value="user">Specific User</option>
                            </select>
                        </div>
                        {formData.target === 'group' && (
                            <div>
                                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#2b3674' }}>Country Code (e.g. TZ)</label>
                                <input
                                    type="text"
                                    value={formData.targetValue}
                                    onChange={(e) => setFormData(p => ({ ...p, targetValue: e.target.value }))}
                                    placeholder="TZ"
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.8)', fontSize: 13, outline: 'none' }}
                                    required
                                />
                            </div>
                        )}
                        {formData.target === 'user' && (
                            <div>
                                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#2b3674' }}>Username or UID</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        list="message-user-dropdown"
                                        type="text"
                                        value={formData.targetValue}
                                        onChange={(e) => setFormData(p => ({ ...p, targetValue: e.target.value }))}
                                        placeholder="Select or enter username..."
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.8)', fontSize: 13, outline: 'none' }}
                                        required
                                        autoComplete="off"
                                    />
                                    <datalist id="message-user-dropdown">
                                        {usersList.map((u, i) => (
                                            <option key={i} value={u.username}>{u.uid.slice(0, 8)}</option>
                                        ))}
                                    </datalist>
                                    {formData.targetValue && usersList.find(u => u.username.toLowerCase() === formData.targetValue.trim().toLowerCase() || u.uid === formData.targetValue.trim()) && (
                                        <div style={{ position: 'absolute', top: '100%', left: 0, fontSize: 11, color: '#05cd99', marginTop: 4, fontWeight: 600 }}>
                                          ✓ Valid User Selected
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        <div>
                            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#2b3674' }}>Theme / Priority</label>
                            <select
                                value={formData.color}
                                onChange={(e) => setFormData(p => ({ ...p, color: e.target.value }))}
                                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.8)', fontSize: 13, outline: 'none' }}
                            >
                                <option value="blue">Standard (Blue)</option>
                                <option value="green">Success (Green)</option>
                            </select>
                        </div>
                    </div>
                    
                    <button type="submit" className="pf-refresh-btn" disabled={processing} style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '12px', marginTop: 12 }}>
                        {processing ? 'Broadcasting...' : 'Publish Broadcast'}
                    </button>
                </form>
            </div>

            <div className="pf-card" style={{ padding: 0, overflow: 'hidden' }}>
                 <div className="pf-card-header" style={{ padding: '20px 20px 0' }}>
                    <span className="pf-card-title">
                        <i className="fas fa-history" style={{ marginRight: 8, color: '#4318ff' }} />
                        Broadcast History
                    </span>
                 </div>
                 
                 <div className="pf-table-container" style={{ marginTop: 16 }}>
                    <table style={{ width: '100%' }}>
                        <thead>
                            <tr>
                                <th style={{ padding: '12px 20px' }}>Message</th>
                                <th>Audience</th>
                                <th>Theme</th>
                                <th>Status / Date</th>
                                <th style={{ paddingRight: 20, textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={5} style={{ padding: '40px 20px', textAlign: 'center', color: '#8f9bba' }}><i className="fas fa-spinner fa-spin" style={{marginRight: 8}}/> Loading...</td></tr>
                            ) : messages.length === 0 ? (
                                <tr><td colSpan={5} style={{ padding: '40px 20px', textAlign: 'center', color: '#8f9bba' }}>No broadcast messages found.</td></tr>
                            ) : (
                                messages.map(msg => (
                                    <tr key={msg.id}>
                                        <td style={{ maxWidth: 300, whiteSpace: 'normal', fontSize: 13, borderTop: '1px solid rgba(0,0,0,0.05)', padding: '16px 20px' }}>
                                            <div style={{ color: '#2b3674', fontWeight: 500, lineHeight: 1.4 }}>{msg.message}</div>
                                        </td>
                                        <td style={{ borderTop: '1px solid rgba(0,0,0,0.05)', padding: '16px 12px' }}>
                                            <span style={{ background: 'rgba(143,155,186,0.1)', color: '#8f9bba', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                                                {msg.target === 'all' ? 'All Personnel' : msg.target.replace(':', ' ')}
                                            </span>
                                        </td>
                                        <td style={{ borderTop: '1px solid rgba(0,0,0,0.05)', padding: '16px 12px' }}>
                                            <span style={{ background: msg.color === 'green' ? 'rgba(5,205,153,0.1)' : 'rgba(67,24,255,0.1)', color: msg.color === 'green' ? '#05cd99' : '#4318ff', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                                                {msg.color.toUpperCase()}
                                            </span>
                                        </td>
                                        <td style={{ borderTop: '1px solid rgba(0,0,0,0.05)', padding: '16px 12px' }}>
                                            <div style={{ marginBottom: 4 }}>
                                                {msg.active ? (
                                                    <span style={{ color: '#05cd99', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#05cd99' }}></span> ACTIVE
                                                    </span>
                                                ) : (
                                                    <span style={{ color: '#ff5630', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff5630' }}></span> INACTIVE
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: 11, color: '#8f9bba' }}>{new Date(msg.createdAt).toLocaleString()}</div>
                                        </td>
                                        <td align="right" style={{ borderTop: '1px solid rgba(0,0,0,0.05)', padding: '16px 20px' }}>
                                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                                <button 
                                                    style={{ border: '1px solid rgba(0,0,0,0.1)', background: 'transparent', padding: '6px 10px', fontSize: 11, borderRadius: 6, cursor: 'pointer', fontWeight: 600, color: '#2b3674' }}
                                                    onClick={() => handleToggleActive(msg.id, msg.active)}
                                                >
                                                    {msg.active ? 'Deactivate' : 'Activate'}
                                                </button>
                                                <button 
                                                    style={{ border: 'none', background: 'rgba(255,86,48,0.1)', color: '#ff5630', padding: '6px 10px', fontSize: 13, borderRadius: 6, cursor: 'pointer' }}
                                                    onClick={() => confirmDelete(msg.id)}
                                                >
                                                    <i className="fas fa-trash" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                 </div>
            </div>
        </div>
        </>
    );
}`;

let code2 = before + updated;

// Ensure AdminFinancials.css is imported
if (!code2.includes("import './css/AdminFinancials.css';")) {
    code2 = code2.replace("import './css/AdminTasksMonitor.css';", "import './css/AdminTasksMonitor.css';\nimport './css/AdminFinancials.css';");
}

fs.writeFileSync(filepath, code2);
console.log('Done — AdminMessages updated with modal delete popup');
