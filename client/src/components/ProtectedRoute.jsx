import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import CinematicLoader from './CinematicLoader.jsx';

export function ProtectedRoute({ children, requireActive = false, guestOnly = false }) {
    const { user, userData, loading, isActive } = useAuth();

    if (loading) {
        return <CinematicLoader text="Securing connection..." />;
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
