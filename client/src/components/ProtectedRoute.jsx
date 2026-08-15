import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

export function ProtectedRoute({ children, requireActive = false, guestOnly = false }) {
    const { user, userData, loading, isActive } = useAuth();

    if (loading) {
        return (
            <div className="auth-container">
                <div className="auth-card" style={{ textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '20px auto', width: 40, height: 40, border: '3px solid var(--border-color)', borderTopColor: 'var(--color-gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    <p>Loading...</p>
                </div>
            </div>
        );
    }

    if (guestOnly) {
        return children;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (requireActive && !isActive) {
        return <Navigate to="/activation" replace />;
    }

    return children;
}

export function ActivationRoute({ children }) {
    const { user, loading, isActive } = useAuth();

    if (loading) return null;
    if (!user) return <Navigate to="/login" replace />;
    if (isActive) return <Navigate to="/dashboard" replace />;
    return children;
}
