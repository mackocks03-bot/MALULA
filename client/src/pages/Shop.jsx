import { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { formatCurrency } from '../utils/helpers.js';
import { db, collection, getDocs, addDoc } from '../services/firebase-config.js';

export default function Shop() {
    const { user, userData } = useAuth();
    const { translate } = useLanguage();
    const { showToast } = useToast();
    const [products, setProducts] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ name: '', price: '', description: '' });
    const currency = userData?.currency || 'TZS';

    useEffect(() => {
        const loadProducts = async () => {
            const snap = await getDocs(collection(db, 'sellerProducts'));
            if (!snap.empty) {
                const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                setProducts(all);
            }
        };
        loadProducts();
    }, []);

    const addProduct = async (e) => {
        e.preventDefault();
        if (!form.name || !form.price) return;
        try {
            const docRef = await addDoc(collection(db, 'sellerProducts'), {
                sellerUid: user.uid,
                name: form.name,
                price: parseFloat(form.price),
                description: form.description,
                sellerName: userData?.username,
                createdAt: Date.now(),
                status: 'active'
            });
            showToast(translate('shop.productAdded') || 'Product added!', 'success');
            setShowForm(false);
            setForm({ name: '', price: '', description: '' });
            setProducts(prev => [...prev, { id: docRef.id, sellerUid: user.uid, name: form.name, price: parseFloat(form.price), description: form.description, sellerName: userData?.username }]);
        } catch {
            showToast(translate('common.error'), 'error');
        }
    };

    return (
        <DashboardLayout>
            <div className="dashboard-container">
                <div className="dashboard-content">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h2 className="page-title">{translate('shop.title')}</h2>
                        <button type="button" className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
                            {translate('shop.sellProduct') || 'Sell Product'}
                        </button>
                    </div>

                    {showForm && (
                        <form onSubmit={addProduct} className="auth-card" style={{ marginBottom: 24, padding: 20 }}>
                            <div className="form-group">
                                <label className="form-label">{translate('shop.productName') || 'Product Name'}</label>
                                <input className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{translate('shop.price') || `Price (USD or ${currency})`}</label>
                                <input type="number" step="0.01" className="form-control" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{translate('shop.description') || 'Description'}</label>
                                <textarea className="form-control" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} />
                            </div>
                            <button type="submit" className="btn btn-primary">{translate('shop.listProduct') || 'List Product'}</button>
                        </form>
                    )}

                    {products.length === 0 ? (
                        <p className="empty-state">{translate('shop.noProducts') || 'No products available'}</p>
                    ) : products.map(p => (
                        <div key={`${p.sellerUid}-${p.id}`} className="shop-product-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 16, marginBottom: 12 }}>
                            <h3>{p.name}</h3>
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{p.description}</p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                                <span style={{ fontWeight: 700, color: 'var(--color-gold)' }}>{formatCurrency(p.price || 0, currency)}</span>
                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>by {p.sellerName}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </DashboardLayout>
    );
}
