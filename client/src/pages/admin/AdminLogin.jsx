import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { loginUser, getUserData } from '../../services/auth.js';
import Logo from '../../components/Logo.jsx';
import '../../admin.css';

export default function AdminLogin() {
    const { translate } = useLanguage();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const result = await loginUser(email, password);
            if (!result.success) { showToast('Invalid credentials', 'error'); setLoading(false); return; }
            const userData = await getUserData(result.user.uid);
            if (userData?.role !== 'admin') {
                showToast('Access denied - Admin only', 'error');
                setLoading(false);
                return;
            }
            sessionStorage.setItem('adminAuth', JSON.stringify({ ...userData, uid: result.user.uid }));
            navigate('/admin/dashboard');
        } catch {
            showToast('Login failed', 'error');
        }
        setLoading(false);
    };

    return (
        <div className="admin-login-container">
            <div className="admin-login-card">
                <Logo />
                <span className="badge">Admin Panel</span>
                <h1>Admin Login</h1>
                <p className="subtitle">Sign in with admin credentials</p>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Email</label>
                        <input type="email" className="form-control" value={email} onChange={e => setEmail(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input type="password" className="form-control" value={password} onChange={e => setPassword(e.target.value)} required />
                    </div>
                    <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>
                <p style={{ marginTop: 16, fontSize: 13 }}><Link to="/">← Back to App</Link></p>
            </div>
        </div>
    );
}
