import { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { formatCurrency } from '../utils/helpers.js';
import { db, collection, getDocs } from '../services/firebase-config.js';
import dataStore from '../utils/dataStore.js';

export default function Challenge() {
    const { user, userData } = useAuth();
    const { translate } = useLanguage();
    const [leaderboard, setLeaderboard] = useState([]);
    const [prizePool, setPrizePool] = useState(0);
    const currency = userData?.currency || 'TZS';

    useEffect(() => {
        const load = async () => {
            const settings = await dataStore.getChallengeRewards();
            if (settings?.prizePool) setPrizePool(settings.prizePool);

            const usersSnap = await getDocs(collection(db, 'users'));
            if (!usersSnap.empty) {
                const usersList = [];
                usersSnap.forEach(docSnap => {
                    const data = docSnap.data();
                    usersList.push({ uid: docSnap.id, username: data.username, referralCount: data.referralCount || 0, weeklyReferrals: data.weeklyReferrals || 0 });
                });
                usersList.sort((a, b) => b.weeklyReferrals - a.weeklyReferrals);
                setLeaderboard(usersList.slice(0, 20));
            }
        };
        load();
    }, []);

    const myRank = leaderboard.findIndex(u => u.uid === user?.uid) + 1;

    return (
        <DashboardLayout>
            <div className="dashboard-container">
                <div className="dashboard-content">
                    <h2 className="page-title">{translate('challenge.title')}</h2>

                    <div className="profit-card">
                        <div className="amount">{formatCurrency(prizePool, currency)}</div>
                        <div className="label">{translate('challenge.prizePool') || 'Prize Pool'}</div>
                    </div>

                    {myRank > 0 && (
                        <div className="stat-card" style={{ marginBottom: 16, textAlign: 'center' }}>
                            <div className="amount">#{myRank}</div>
                            <div className="label">{translate('challenge.yourRank') || 'Your Rank'}</div>
                        </div>
                    )}

                    <div className="section-title">{translate('challenge.leaderboard') || 'Leaderboard'}</div>
                    {leaderboard.map((u, i) => (
                        <div key={u.uid} className={`earning-item ${u.uid === user?.uid ? 'highlight' : ''}`}>
                            <div className="left">
                                <span className="rank" style={{ fontWeight: 700, marginRight: 8, color: i < 3 ? 'var(--color-gold)' : 'inherit' }}>#{i + 1}</span>
                                <span className="name">{u.username}</span>
                            </div>
                            <span className="value">{u.weeklyReferrals} refs</span>
                        </div>
                    ))}
                </div>
            </div>
        </DashboardLayout>
    );
}
