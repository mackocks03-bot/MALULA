import DashboardLayout from '../components/DashboardLayout.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';

export default function Terms() {
    const { translate } = useLanguage();

    return (
        <DashboardLayout>
            <div className="dashboard-container">
                <div className="dashboard-content">
                    <h2 className="page-title">{translate('terms.title')}</h2>
                    <div className="terms-content" style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                        <h3 style={{ color: 'var(--text-primary)', marginBottom: 12 }}>{translate('terms.heading') || 'Terms & Conditions'}</h3>
                        <p>{translate('terms.intro') || 'Welcome to NEWHOPE-CHAT. By using our platform, you agree to the following terms and conditions.'}</p>
                        <h4 style={{ color: 'var(--text-primary)', margin: '16px 0 8px' }}>1. Account Registration</h4>
                        <p>{translate('terms.registration') || 'You must provide accurate information when registering. One account per person is allowed.'}</p>
                        <h4 style={{ color: 'var(--text-primary)', margin: '16px 0 8px' }}>2. Earnings & Withdrawals</h4>
                        <p>{translate('terms.earnings') || 'Earnings are subject to task completion and admin verification. Minimum withdrawal is $4 USD.'}</p>
                        <h4 style={{ color: 'var(--text-primary)', margin: '16px 0 8px' }}>3. Referral Program</h4>
                        <p>{translate('terms.referrals') || 'Referral bonuses are paid when referred users complete activation. Multi-level referral structure applies.'}</p>
                        <h4 style={{ color: 'var(--text-primary)', margin: '16px 0 8px' }}>4. Prohibited Activities</h4>
                        <p>{translate('terms.prohibited') || 'Fake accounts, spam, and fraudulent activity will result in account termination.'}</p>
                        <h4 style={{ color: 'var(--text-primary)', margin: '16px 0 8px' }}>5. Privacy</h4>
                        <p>{translate('terms.privacy') || 'We protect your personal data and do not share it with third parties without consent.'}</p>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
