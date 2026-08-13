import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute, ActivationRoute } from './components/ProtectedRoute.jsx';

import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register, { ForgotPassword } from './pages/Register.jsx';
import Activation from './pages/Activation.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Wallet from './pages/Wallet.jsx';
import Withdraw from './pages/Withdraw.jsx';
import Tasks from './pages/Tasks.jsx';
import Affiliate from './pages/Affiliate.jsx';
import Challenge from './pages/Challenge.jsx';
import Spin from './pages/Spin.jsx';
import Free from './pages/Free.jsx';
import Shop from './pages/Shop.jsx';
import GlobalChat from './pages/GlobalChat.jsx';
import Profile from './pages/Profile.jsx';
import Notifications from './pages/Notifications.jsx';
import Terms from './pages/Terms.jsx';

import AdminLogin from './pages/admin/AdminLogin.jsx';
import AdminLayout, {
    AdminDashboard, AdminUsers, AdminPayments, AdminWithdrawals,
    AdminReferrals, AdminTasks, AdminShop, AdminSettings
} from './pages/admin/AdminPages.jsx';

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<Home />} />

            <Route path="/login" element={<ProtectedRoute guestOnly><Login /></ProtectedRoute>} />
            <Route path="/register" element={<ProtectedRoute guestOnly><Register /></ProtectedRoute>} />
            <Route path="/forgot-password" element={<ProtectedRoute guestOnly><ForgotPassword /></ProtectedRoute>} />

            <Route path="/activation" element={<ActivationRoute><Activation /></ActivationRoute>} />

            <Route path="/dashboard" element={<ProtectedRoute requireActive><Dashboard /></ProtectedRoute>} />
            <Route path="/wallet" element={<ProtectedRoute requireActive><Wallet /></ProtectedRoute>} />
            <Route path="/withdraw" element={<ProtectedRoute requireActive><Withdraw /></ProtectedRoute>} />
            <Route path="/tasks" element={<ProtectedRoute requireActive><Tasks /></ProtectedRoute>} />
            <Route path="/affiliate" element={<ProtectedRoute requireActive><Affiliate /></ProtectedRoute>} />
            <Route path="/challenge" element={<ProtectedRoute requireActive><Challenge /></ProtectedRoute>} />
            <Route path="/spin" element={<ProtectedRoute requireActive><Spin /></ProtectedRoute>} />
            <Route path="/free" element={<ProtectedRoute requireActive><Free /></ProtectedRoute>} />
            <Route path="/shop" element={<ProtectedRoute requireActive><Shop /></ProtectedRoute>} />
            <Route path="/chat" element={<ProtectedRoute requireActive><GlobalChat /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute requireActive><Profile /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute requireActive><Notifications /></ProtectedRoute>} />
            <Route path="/terms" element={<ProtectedRoute requireActive><Terms /></ProtectedRoute>} />

            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="payments" element={<AdminPayments />} />
                <Route path="withdrawals" element={<AdminWithdrawals />} />
                <Route path="referrals" element={<AdminReferrals />} />
                <Route path="tasks" element={<AdminTasks />} />
                <Route path="shop" element={<AdminShop />} />
                <Route path="settings" element={<AdminSettings />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
