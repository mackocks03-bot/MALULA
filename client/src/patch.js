const fs = require('fs');
const filepath = 'd:/GLORIA/NEWHOPE-CHAT/client/src/pages/admin/AdminPages.jsx';
let code = fs.readFileSync(filepath, 'utf8');

// Add usersList state
code = code.replace(/const \[processing, setProcessing\] = useState\(false\);/, 'const [processing, setProcessing] = useState(false);\n    const [usersList, setUsersList] = useState([]);');

// Add users fetching
code = code.replace(/useEffect\(\(\) => \{ loadMessages\(\); \}, \[loadMessages\]\);/, "useEffect(() => { loadMessages(); }, [loadMessages]);\n\n    useEffect(() => {\n        getDocs(collection(db, 'users')).then(snap => {\n            if (!snap.empty) {\n                setUsersList(snap.docs.map(d => ({ uid: d.id, username: d.data().username || 'Unknown' })));\n            }\n        });\n    }, []);");

// Update handleSend logic for target === 'user'
const newHandleSend = `let finalTarget = 'all';
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

            await addDoc(collection(db, 'adminMessages'), {`;
code = code.replace(/const finalTarget = formData\.target === 'all' \? 'all' : `\${formData\.target}:\${formData\.targetValue}`;\s*await addDoc\(collection\(db, 'adminMessages'\), \{/, newHandleSend);


// Update UI for User selection
const oldUI = `                        {formData.target !== 'all' && (
                            <div>
                                <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>{formData.target === 'group' ? 'Country Code (e.g. TZ)' : 'User UID'}</label>
                                <input
                                    type="text"
                                    className="gov-input"
                                    value={formData.targetValue}
                                    onChange={(e) => setFormData(p => ({ ...p, targetValue: e.target.value }))}
                                    placeholder={formData.target === 'group' ? 'TZ' : 'UID...'}
                                    style={{ width: '100%' }}
                                    required
                                />
                            </div>
                        )}`;

const newUI = `                        {formData.target === 'group' && (
                            <div>
                                <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Country Code (e.g. TZ)</label>
                                <input
                                    type="text"
                                    className="gov-input"
                                    value={formData.targetValue}
                                    onChange={(e) => setFormData(p => ({ ...p, targetValue: e.target.value }))}
                                    placeholder="TZ"
                                    style={{ width: '100%' }}
                                    required
                                />
                            </div>
                        )}
                        {formData.target === 'user' && (
                            <div>
                                <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Username or UID</label>
                                <input
                                    list="message-user-dropdown"
                                    type="text"
                                    className="gov-input"
                                    value={formData.targetValue}
                                    onChange={(e) => setFormData(p => ({ ...p, targetValue: e.target.value }))}
                                    placeholder="Select or enter username..."
                                    style={{ width: '100%' }}
                                    required
                                    autoComplete="off"
                                />
                                <datalist id="message-user-dropdown">
                                    {usersList.map((u, i) => (
                                        <option key={i} value={u.username}>{u.uid.slice(0, 8)}</option>
                                    ))}
                                </datalist>
                                {formData.targetValue && usersList.find(u => u.username.toLowerCase() === formData.targetValue.trim().toLowerCase() || u.uid === formData.targetValue.trim()) && (
                                    <div style={{ fontSize: 11, color: '#16A34A', marginTop: 4 }}>
                                      ✓ Valid User Selected
                                    </div>
                                )}
                            </div>
                        )}`;
                        
code = code.replace(oldUI, newUI);

fs.writeFileSync(filepath, code);
console.log('Patched AdminPages.jsx');
