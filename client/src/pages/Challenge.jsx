import { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import {
    db, collection, query, where, getDocs,
    onSnapshot, orderBy, limit
} from '../services/firebase-config.js';
import dataStore from '../utils/dataStore.js';
import './css/Challenge.css';

/* ─── Constants ─── */
const PEOPLE_4_11  = 8;
const PEOPLE_12_20 = 9;

const CHALLENGE_REWARDS = {
    TZS: { rank1: 15000, rank2: 10000, rank3: 5000, rank4_11: 500, rank12_20: 300 },
    KES: { rank1: 800,   rank2: 500,   rank3: 300,  rank4_11: 20,  rank12_20: 10 },
    UGX: { rank1: 22000, rank2: 15000, rank3: 7500, rank4_11: 600, rank12_20: 400 },
    MWK: { rank1: 10500, rank2: 7000,  rank3: 3500, rank4_11: 300, rank12_20: 200 },
    ZMW: { rank1: 150,   rank2: 100,   rank3: 50,   rank4_11: 5,   rank12_20: 3 },
    RWF: { rank1: 8000,  rank2: 5000,  rank3: 2500, rank4_11: 200, rank12_20: 150 },
    BIF: { rank1: 17500, rank2: 12000, rank3: 6000, rank4_11: 500, rank12_20: 300 },
    CDF: { rank1: 17000, rank2: 11500, rank3: 5500, rank4_11: 450, rank12_20: 300 },
    MZN: { rank1: 400,   rank2: 250,   rank3: 150,  rank4_11: 15,  rank12_20: 10 }
};

/* Country code → emoji flag */
const FLAG = {
    TZ: '🇹🇿', KE: '🇰🇪', UG: '🇺🇬', MW: '🇲🇼',
    ZM: '🇿🇲', RW: '🇷🇼', BI: '🇧🇮', CD: '🇨🇩',
    MZ: '🇲🇿', GH: '🇬🇭', NG: '🇳🇬', ZA: '🇿🇦',
    ET: '🇪🇹', SN: '🇸🇳', CI: '🇨🇮', CM: '🇨🇲',
    DEFAULT: '🌍',
};

function getFlag(code) { return FLAG[code?.toUpperCase()] || FLAG.DEFAULT; }

function formatLocal(amount, currency) {
    const syms = { TZS:'TSh', KES:'KSh', UGX:'USh', MWK:'MK', ZMW:'ZK', RWF:'RF', BIF:'BIF', CDF:'FC', MZN:'MT' };
    return `${syms[currency] || currency} ${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

/* ─── Get current week window: Mon 00:00 → Sun 23:59 ─── */
function getWeekWindow() {
    const now   = new Date();
    const day   = now.getDay();                         // 0=Sun…6=Sat
    const diffToMon = (day === 0 ? -6 : 1 - day);     // days back to Monday
    const mon   = new Date(now);
    mon.setDate(now.getDate() + diffToMon);
    mon.setHours(0, 0, 0, 0);

    const sun   = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    sun.setHours(23, 59, 59, 999);

    return { start: mon.getTime(), end: sun.getTime() };
}

/* ─── Countdown to Sunday 23:59 ─── */
function getNextSunday() {
    const { end } = getWeekWindow();
    return end;
}
function pad(n) { return String(n).padStart(2, '0'); }

function useCountdown() {
    const [parts, setParts] = useState({ days: '00', hours: '00', mins: '00', secs: '00' });
    useEffect(() => {
        const end  = getNextSunday();
        const tick = () => {
            const dist = end - Date.now();
            if (dist <= 0) { setParts({ days: '00', hours: '00', mins: '00', secs: '00' }); return; }
            setParts({
                days:  pad(Math.floor(dist / 86400000)),
                hours: pad(Math.floor((dist % 86400000) / 3600000)),
                mins:  pad(Math.floor((dist % 3600000) / 60000)),
                secs:  pad(Math.floor((dist % 60000) / 1000)),
            });
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, []);
    return parts;
}

/* ═══════════════════════════════════════════════════════════
   Main Component
═══════════════════════════════════════════════════════════ */
export default function Challenge() {
    const { user, userData } = useAuth();
    const { translate }      = useLanguage();

    const country  = userData?.country || 'TZ';
    const currMap  = { TZ:'TZS', KE:'KES', UG:'UGX', MW:'MWK', ZM:'ZMW', RW:'RWF', BI:'BIF', CD:'CDF' };
    const currency = currMap[country] || 'TZS';

    const [pastWinners, setPastWinners] = useState([]);
    const [rankedList,setRanked   ] = useState([]);  // [{uid, username, country, weeklyRefs, ...}]
    const [allUsers,  setAllUsers ] = useState([]);  // raw snapshot kept for "your card"
    const [search,    setSearch   ] = useState('');
    const [loading,   setLoading  ] = useState(true);
    const countdown = useCountdown();

    /* ── Load Past Winners ── */
    useEffect(() => {
        (async () => {
            try {
                const snap = await getDocs(query(collection(db, 'challengeWinners'), orderBy('weekEnd', 'desc'), limit(1)));
                const winnersList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                setPastWinners(winnersList);
            } catch (err) {
                console.error("Error fetching past winners:", err);
            }
        })();
    }, []);

    /* ── Weekly leaderboard: count referrals activated THIS week ── */
    useEffect(() => {
        setLoading(true);

        const { start, end } = getWeekWindow();

        /*
         * Strategy:
         *  1. Listen to all users (for referrer uid lookup + their referrals arrays)
         *  2. From the full user list, find those activated this week
         *     = activationStatus === 'approved'  AND  activatedAt (or createdAt) in [start, end]
         *  3. Group by referrer uid → count
         *  4. Sort and rank
         */
        const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(1000));

        const unsub = onSnapshot(q, (snap) => {
            const all = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
            setAllUsers(all);

            /* Build uid → userData map for quick lookup */
            const uidMap = {};
            all.forEach(u => { uidMap[u.uid] = u; });

            /* Users activated this week */
            const activatedThisWeek = all.filter(u => {
                if (u.activationStatus !== 'approved' && u.isActive !== true) return false;
                const ts = u.activatedAt || u.approvedAt || u.createdAt || 0;
                return ts >= start && ts <= end;
            });

            /* Count weekly activations per referrer username → then map to uid */
            const weeklyCountByUsername = {};
            activatedThisWeek.forEach(u => {
                const ref = u.referrer;
                if (ref) {
                    weeklyCountByUsername[ref] = (weeklyCountByUsername[ref] || 0) + 1;
                }
            });

            /* Build ranked list — only users who have ≥1 weekly activation */
            const ranked = all
                .filter(u => u.role !== 'admin')
                .map(u => ({
                    uid:        u.uid,
                    username:   u.username || 'User',
                    fullName:   u.fullName  || '',
                    country:    u.country   || '',
                    countryName:u.countryName || '',
                    weeklyRefs: weeklyCountByUsername[u.username] || 0,
                }))
                .filter(u => u.weeklyRefs > 0)
                .sort((a, b) => b.weeklyRefs - a.weeklyRefs);

            setRanked(ranked);
            setLoading(false);
        });

        return () => unsub();
    }, []);

    /* ─── Derived ─── */
    const myRates = CHALLENGE_REWARDS[currency] || CHALLENGE_REWARDS.TZS;
    const totalPool = myRates.rank1 + myRates.rank2 + myRates.rank3 + (myRates.rank4_11 * PEOPLE_4_11) + (myRates.rank12_20 * PEOPLE_12_20);

    const filtered = search
        ? rankedList.filter(u =>
            (u.username  || '').toLowerCase().includes(search.toLowerCase()) ||
            (u.fullName  || '').toLowerCase().includes(search.toLowerCase()) ||
            (u.countryName || '').toLowerCase().includes(search.toLowerCase()))
        : rankedList;
    const top20   = filtered.slice(0, 20);
    const maxRefs = top20[0]?.weeklyRefs || 1;

    /* Current user's weekly count */
    const myWeeklyRefs = rankedList.find(u => u.uid === user?.uid)?.weeklyRefs || 0;
    const myRankIdx    = rankedList.findIndex(u => u.uid === user?.uid);
    const myProgress   = myWeeklyRefs > 0 ? Math.min((myWeeklyRefs / maxRefs) * 100, 100) : 0;

    function rankColor(i) {
        if (i === 0) return '#FFD700';
        if (i === 1) return '#C0C0C0';
        if (i === 2) return '#CD7F32';
        return 'var(--text-muted)';
    }
    function avatarClass(i) {
        if (i === 0) return 'ch-avatar gold';
        if (i === 1) return 'ch-avatar silver';
        if (i === 2) return 'ch-avatar bronze';
        return 'ch-avatar default';
    }
    function rewardLabel(i) {
        if (i === 0) return formatLocal(myRates.rank1, currency);
        if (i === 1) return formatLocal(myRates.rank2, currency);
        if (i === 2) return formatLocal(myRates.rank3, currency);
        if (i >= 3 && i <= 10) return formatLocal(myRates.rank4_11, currency);
        if (i >= 11 && i <= 19) return formatLocal(myRates.rank12_20, currency);
        return '';
    }

    return (
        <DashboardLayout>
            <div className="ch-container">
                <div className="ch-content">

                    {/* ── Hero ── */}
                    <div className="ch-hero">
                        <h1 className="ch-title">
                            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2"
                                style={{ verticalAlign: 'middle', color: 'var(--color-gold)', flexShrink: 0 }}>
                                <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                            </svg>
                            <span className="gold">{translate('challenge.title') || 'Weekly Challenge'}</span>
                        </h1>
                        <p className="ch-subtitle">{translate('challenge.subtitle') || 'Invite more friends and become Top 20 this week.'}</p>
                        <div className="ch-pool-pill">{formatLocal(totalPool, currency)} Prize Pool</div>

                        {/* Countdown */}
                        <div className="ch-countdown">
                            {[['Days', countdown.days], ['Hours', countdown.hours], ['Mins', countdown.mins], ['Secs', countdown.secs]].map(([label, val]) => (
                                <div key={label} className="ch-time-box">
                                    <div className="ch-time-num">{val}</div>
                                    <div className="ch-time-label">{label}</div>
                                </div>
                            ))}
                        </div>

                        {/* Week window badge */}
                        <div className="ch-week-badge">
                            {(() => {
                                const { start, end } = getWeekWindow();
                                const fmt = (ts) => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                                return `📅 This week: ${fmt(start)} – ${fmt(end)}`;
                            })()}
                        </div>
                    </div>

                    {/* ── Rewards ── */}
                    <div className="ch-section">
                        <div className="ch-section-title">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--color-gold)" strokeWidth="2">
                                <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
                            </svg>
                            {translate('challenge.rewards') || 'Weekly Rewards'}
                        </div>
                        <div className="ch-rewards-grid">
                            {[
                                ['🥇 1st Place', formatLocal(myRates.rank1, currency)],
                                ['🥈 2nd Place', formatLocal(myRates.rank2, currency)],
                                ['🥉 3rd Place', formatLocal(myRates.rank3, currency)],
                                ['4th – 11th', `${formatLocal(myRates.rank4_11, currency)} each`],
                            ].map(([place, prize]) => (
                                <div key={place} className="ch-reward-item">
                                    <span className="ch-place">{place}</span>
                                    <span className="ch-prize">{prize}</span>
                                </div>
                            ))}
                            <div className="ch-reward-item ch-reward-wide">
                                <span className="ch-place">12th – 20th</span>
                                <span className="ch-prize">{formatLocal(myRates.rank12_20, currency)} each</span>
                            </div>
                        </div>
                    </div>

                    {/* ── Leaderboard ── */}
                    <div className="ch-lb-header">
                        <div className="ch-section-title" style={{ marginBottom: 0 }}>
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--color-gold)" strokeWidth="2">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                            </svg>
                            {translate('challenge.top20') || 'Top 20 This Week'}
                        </div>
                        <span className="ch-badge-count">{top20.length}</span>
                    </div>

                    <input
                        className="ch-search"
                        placeholder={translate('challenge.search') || 'Search username or country…'}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />

                    <div className="ch-lb-list">
                        {loading ? (
                            <div className="ch-empty">
                                <div className="ch-spinner" />
                                <p style={{ marginTop: 12 }}>Loading this week's rankings…</p>
                            </div>
                        ) : top20.length === 0 ? (
                            <div className="ch-empty">
                                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                                </svg>
                                <h4>{search ? 'No results found' : 'No activations yet this week'}</h4>
                                <p>Invite friends to activate their accounts and climb the board!</p>
                            </div>
                        ) : top20.map((u, i) => {
                            const isMe    = u.uid === user?.uid;
                            const progress= Math.min((u.weeklyRefs / maxRefs) * 100, 100);
                            const letter  = (u.fullName || u.username || 'U').charAt(0).toUpperCase();
                            const flag    = getFlag(u.country);
                            return (
                                <div key={u.uid} className={`ch-lb-item${isMe ? ' ch-lb-me' : ''}`}>
                                    <div className="ch-lb-left">
                                        <div className="ch-rank" style={{ color: rankColor(i) }}>#{i + 1}</div>
                                        <div className={avatarClass(i)}>
                                            {i < 3 ? letter : <span style={{ fontSize: 18 }}>{flag}</span>}
                                        </div>
                                        <div className="ch-user-info">
                                            <div className="ch-name">
                                                {u.username || 'User'}
                                                {isMe && <span className="ch-you-tag"> (You)</span>}
                                            </div>
                                            <div className="ch-sub">
                                                <span className="ch-flag-inline">{flag}</span>
                                                {u.countryName || u.country || ''}
                                                &nbsp;·&nbsp;{rewardLabel(i)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="ch-lb-right">
                                        <div className="ch-refs">{u.weeklyRefs}</div>
                                        <div className="ch-refs-label">this week</div>
                                        <div className="ch-bar-wrap">
                                            <div className="ch-bar" style={{ width: `${progress}%` }} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* ── Your Position ── */}
                    <div className="ch-section" style={{ marginTop: 24 }}>
                        <div className="ch-section-title">{translate('challenge.yourPosition') || 'Your Position'}</div>
                        <div className="ch-your-card">
                            <div className="ch-lb-left">
                                <div className="ch-rank" style={{ color: 'var(--color-gold)' }}>
                                    {myRankIdx >= 0 ? `#${myRankIdx + 1}` : '#--'}
                                </div>
                                <div className="ch-avatar gold">
                                    {(userData?.username || 'U').charAt(0).toUpperCase()}
                                </div>
                                <div className="ch-user-info">
                                    <div className="ch-name">{userData?.username || 'You'}</div>
                                    <div className="ch-sub">
                                        <span className="ch-flag-inline">{getFlag(country)}</span>
                                        {myWeeklyRefs > 0 ? 'Your Weekly Progress' : 'Refer activated friends to appear here'}
                                    </div>
                                </div>
                            </div>
                            <div className="ch-lb-right">
                                <div className="ch-refs">{myWeeklyRefs}</div>
                                <div className="ch-refs-label">this week</div>
                                <div className="ch-bar-wrap">
                                    <div className="ch-bar" style={{ width: `${myProgress}%` }} />
                                </div>
                            </div>
                        </div>
                    </div>

                    
                    {/* ── Past Winners ── */}
                    {pastWinners.length > 0 && (
                        <div className="ch-section" style={{ marginTop: 24, marginBottom: 24 }}>
                            <div className="ch-section-title">
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--color-gold)" strokeWidth="2">
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                                </svg>
                                {translate('challenge.pastWinners') || "Last Week's Winners"}
                            </div>
                            <div className="ch-glass" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {pastWinners.map(week => (
                                    <div key={week.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px' }}>
                                        <div style={{ fontSize: 13, color: '#8f9bba', marginBottom: 12, fontWeight: 600 }}>
                                            Week ending {new Date(week.weekEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </div>
                                        <div style={{ display: 'grid', gap: '10px' }}>
                                            {week.winners && week.winners.slice(0, 3).map((w, idx) => (
                                                <div key={w.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.1)', padding: '10px 14px', borderRadius: 10 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                        <span style={{ fontSize: 16, width: 20 }}>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</span>
                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                            <span style={{ fontWeight: 700, color: '#fff', fontSize: 14 }}>{w.username}</span>
                                                            <span style={{ fontSize: 12, color: '#8f9bba' }}>{getFlag(w.country)} {w.weeklyRefs} referrals</span>
                                                        </div>
                                                    </div>
                                                    <div style={{ fontWeight: 700, color: '#05cd99', fontSize: 14 }}>
                                                        +{formatLocal(w.prizeAmount, w.currency)}
                                                    </div>
                                                </div>
                                            ))}
                                            {week.winners && week.winners.length > 3 && (
                                                <div style={{ textAlign: 'center', fontSize: 12, color: '#8f9bba', marginTop: 4 }}>
                                                    + {week.winners.length - 3} more winners
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Rules ── */}
                    <div className="ch-section" style={{ marginBottom: 32 }}>
                        <div className="ch-section-title">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--color-gold)" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                                <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                            </svg>
                            {translate('challenge.rules') || 'Rules'}
                        </div>
                        <div className="ch-glass">
                            <ul className="ch-rules">
                                {[
                                    translate('challenge.rule1') || 'Only referrals who activate their account THIS week are counted.',
                                    translate('challenge.rule2') || 'The leaderboard resets every Monday at midnight.',
                                    translate('challenge.rule3') || 'Fake or self-referred accounts are disqualified.',
                                    translate('challenge.rule4') || 'Leaderboard updates in real time.',
                                    translate('challenge.rule5') || 'Rewards are paid every Sunday night.',
                                ].map((rule, i) => <li key={i}>{rule}</li>)}
                            </ul>
                        </div>
                    </div>

                </div>
            </div>
        </DashboardLayout>
    );
}
