import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase-config.js';
import './css/AdminFinancials.css';

/* ── tiny SVG donut ─────────────────────────────────────── */
function DonutRing({ pct = 0, color = '#4318ff', size = 62, stroke = 5 }) {
    const r = (size - stroke * 2) / 2;
    const circ = 2 * Math.PI * r;
    const dash = (pct / 100) * circ;
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke="rgba(255,255,255,0.15)" strokeWidth={stroke} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke={color} strokeWidth={stroke}
                strokeDasharray={`${dash} ${circ}`}
                strokeLinecap="round"
                transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        </svg>
    );
}

/* ── Bar chart (SVG) ────────────────────────────────────── */
function BarChart({ countries }) {
    const top = countries.slice(0, 12);
    const maxVal = Math.max(...top.map(c => c.netProfit), 1);
    const W = 580, H = 180, BAR = 32, GAP = 8;
    const startX = 10;
    return (
        <svg viewBox={`0 0 ${W} ${H + 24}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
            <defs>
                <linearGradient id="pfBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4318ff" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#868cff" stopOpacity="0.5" />
                </linearGradient>
                <linearGradient id="pfBarNeg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff5630" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#ff8a65" stopOpacity="0.5" />
                </linearGradient>
            </defs>
            {/* baseline */}
            <line x1={startX} y1={H} x2={W} y2={H} stroke="rgba(143,155,186,0.3)" strokeWidth="1" />
            {top.map((c, i) => {
                const pct = Math.max(0, c.netProfit) / maxVal;
                const barH = Math.max(6, pct * (H - 20));
                const x = startX + i * (BAR + GAP);
                const y = H - barH;
                const positive = c.netProfit >= 0;
                return (
                    <g key={c.code}>
                        <rect x={x} y={y} width={BAR} height={barH}
                            fill={positive ? 'url(#pfBarGrad)' : 'url(#pfBarNeg)'}
                            rx="4" />
                        <text x={x + BAR / 2} y={H + 16} fill="#8f9bba"
                            fontSize="9" textAnchor="middle">{c.code.toUpperCase()}</text>
                    </g>
                );
            })}
        </svg>
    );
}

/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
export default function AdminFinancials() {
    const [countries, setCountries] = useState([]);
    const [globals, setGlobals] = useState({ users: 0, totalAct: 0, totalShop: 0, totalW: 0, totalComm: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const run = async () => {
            const [uSnap, aSnap, sSnap, wSnap, cSnap] = await Promise.all([
                getDocs(collection(db, 'users')),
                getDocs(collection(db, 'activationPayments')),
                getDocs(collection(db, 'shopDeposits')),
                getDocs(collection(db, 'withdrawals')),
                getDocs(collection(db, 'referralBonuses')),
            ]);

            /* ── build user lookup ── */
            const usersMap = {};
            const countryMap = {};
            const ensureCountry = (cc, name, cur) => {
                if (!countryMap[cc]) {
                    countryMap[cc] = {
                        code: cc, name: name || cc.toUpperCase(), currency: cur || 'TZS',
                        users: 0,
                        actSum: 0, actCount: 0,
                        shopSum: 0, shopCount: 0,
                        wSum: 0, wCount: 0,
                        commSum: 0,
                    };
                }
            };

            uSnap.forEach(d => {
                const u = d.data();
                usersMap[d.id] = u;
                const cc = (u.countryCode || 'tz').toLowerCase();
                const cur = u.currency || 'TZS';
                const cn = u.countryName || u.country || cc.toUpperCase();
                ensureCountry(cc, cn, cur);
                countryMap[cc].users++;
            });

            /* ── activation payments ── */
            let gAct = 0;
            aSnap.forEach(d => {
                const p = d.data();
                if (!['approved', 'completed', 'success'].includes(p.status)) return;
                const u = usersMap[p.uid] || {};
                const cc = (u.countryCode || u.country || p.countryCode || 'tz').toLowerCase();
                const cur = u.currency || p.nativeCurrency || 'TZS';
                const cn = u.countryName || u.country || cc.toUpperCase();
                ensureCountry(cc, cn, cur);
                const amt = Number(p.amountTZS || p.nativeAmount || p.amount || 0);
                countryMap[cc].actSum += amt;
                countryMap[cc].actCount++;
                gAct += amt;
            });

            /* ── shop deposits ── */
            let gShop = 0;
            sSnap.forEach(d => {
                const p = d.data();
                if (!['approved', 'completed', 'success'].includes(p.status)) return;
                const u = usersMap[p.uid] || {};
                const cc = (u.countryCode || u.country || p.countryCode || 'tz').toLowerCase();
                const cur = u.currency || p.nativeCurrency || 'TZS';
                const cn = u.countryName || u.country || cc.toUpperCase();
                ensureCountry(cc, cn, cur);
                const amt = Number(p.amountTZS || p.nativeAmount || p.amount || 0);
                countryMap[cc].shopSum += amt;
                countryMap[cc].shopCount++;
                gShop += amt;
            });

            /* ── withdrawals ── */
            let gW = 0;
            wSnap.forEach(d => {
                const p = d.data();
                if (!['approved', 'completed', 'COMPLETED', 'success'].includes(p.status)) return;
                const u = usersMap[p.uid] || {};
                const cc = (u.countryCode || u.country || p.countryCode || 'tz').toLowerCase();
                const cur = u.currency || 'TZS';
                const cn = u.countryName || u.country || cc.toUpperCase();
                ensureCountry(cc, cn, cur);
                const amt = Number(p.nativeAmount || p.amount || 0);
                countryMap[cc].wSum += amt;
                countryMap[cc].wCount++;
                gW += amt;
            });

            /* ── commissions paid out ── */
            let gComm = 0;
            cSnap.forEach(d => {
                const c = d.data();
                const u = usersMap[c.uid] || {};
                const cc = (u.countryCode || u.country || 'tz').toLowerCase();
                const cn = u.countryName || u.country || cc.toUpperCase();
                const cur = u.currency || c.currency || 'TZS';
                ensureCountry(cc, cn, cur);
                const amt = Number(c.amount || 0);
                countryMap[cc].commSum += amt;
                gComm += amt;
            });

            const arr = Object.values(countryMap).map(c => ({
                ...c,
                grossIn: c.actSum + c.shopSum,
                netProfit: (c.actSum + c.shopSum) - c.wSum - c.commSum,
            })).sort((a, b) => b.netProfit - a.netProfit);

            setGlobals({ users: uSnap.size, totalAct: gAct, totalShop: gShop, totalW: gW, totalComm: gComm });
            setCountries(arr);
            setLoading(false);
        };
        run();
    }, []);

    if (loading) return (
        <div style={{ padding: 60, textAlign: 'center', color: '#8f9bba', fontFamily: 'sans-serif' }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize: 32, marginBottom: 16, display: 'block', color: '#4318ff' }} />
            Loading Financial Analysis...
        </div>
    );

    const totalGross = globals.totalAct + globals.totalShop;
    const totalNet = totalGross - globals.totalW - globals.totalComm;
    const topCountry = countries[0] || {};

    /* donut pct helpers */
    const pct = (num, denom) => denom ? Math.min(100, Math.round((num / denom) * 100)) : 0;

    return (
        <div className="payflow-ui">

            {/* ── HEADER ── */}
            <header className="pf-top-bar">
                <div className="pf-greeting">
                    <h1>
                        <i className="fas fa-chart-line" style={{ marginRight: 10, color: '#4318ff' }} />
                        Financial Analysis
                    </h1>
                    <p>Real-time country-level revenue, commissions, and net profit</p>
                </div>
                <button className="pf-refresh-btn" onClick={() => window.location.reload()}>
                    <i className="fas fa-arrows-rotate" /> Refresh Ledger
                </button>
            </header>

            {/* ── GLOBAL SUMMARY CARDS ── */}
            <section className="pf-metrics-grid">

                {[
                    { label: 'Total Users', value: globals.users.toLocaleString(), icon: 'fa-users', color: '#4318ff', bg: '#e9eefd', pctVal: 100 },
                    { label: 'Activation Deposits', value: globals.totalAct.toLocaleString(), icon: 'fa-file-invoice-dollar', color: '#05cd99', bg: '#e6f9f0', pctVal: pct(globals.totalAct, totalGross) },
                    { label: 'Shop Deposits', value: globals.totalShop.toLocaleString(), icon: 'fa-wallet', color: '#ffb800', bg: '#fff8e6', pctVal: pct(globals.totalShop, totalGross) },
                    { label: 'Total Withdrawals', value: globals.totalW.toLocaleString(), icon: 'fa-money-bill-transfer', color: '#ff5630', bg: '#ffe7e3', pctVal: pct(globals.totalW, totalGross) },
                    { label: 'Commissions Paid', value: globals.totalComm.toLocaleString(), icon: 'fa-hand-holding-dollar', color: '#a855f7', bg: '#f3ebff', pctVal: pct(globals.totalComm, totalGross) },
                    { label: 'Net Company Profit', value: totalNet.toLocaleString(), icon: 'fa-sack-dollar', color: totalNet >= 0 ? '#05cd99' : '#ff5630', bg: totalNet >= 0 ? '#e6f9f0' : '#ffe7e3', pctVal: pct(Math.max(0, totalNet), totalGross) },
                ].map(card => (
                    <div className="pf-metric-card" key={card.label}>
                        <div style={{ position: 'relative', width: 62, height: 62, flexShrink: 0 }}>
                            <DonutRing pct={card.pctVal} color={card.color} />
                            <div style={{
                                position: 'absolute', inset: 0, display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                background: card.bg, borderRadius: '50%',
                                margin: 5, color: card.color, fontSize: 18
                            }}>
                                <i className={`fas ${card.icon}`} />
                            </div>
                        </div>
                        <div className="pf-metric-info">
                            <p>{card.label}</p>
                            <h3>{card.value}</h3>
                            <div className="pf-trend" style={{ color: card.color }}>
                                {card.pctVal}% <span style={{ color: '#8f9bba' }}>of gross</span>
                            </div>
                        </div>
                    </div>
                ))}
            </section>

            {/* ── PER-COUNTRY CARDS ── */}
            <section style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <i className="fas fa-earth-africa" style={{ color: '#4318ff', fontSize: 18 }} />
                    <span className="pf-card-title">Country Deposit Breakdown</span>
                </div>
                <div className="pf-country-cards-grid">
                    {countries.map(c => {
                        const isGain = c.netProfit >= 0;
                        const depPct = pct(c.actSum + c.shopSum, c.grossIn || 1);
                        const wPct = pct(c.wSum, c.grossIn || 1);
                        const commPct = pct(c.commSum, c.grossIn || 1);
                        return (
                            <div className="pf-country-card" key={c.code}>
                                <div className="pf-country-card-top">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <img src={`https://flagcdn.com/w40/${c.code}.png`} alt={c.code}
                                            style={{ width: 30, height: 20, objectFit: 'cover', borderRadius: 3 }} />
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: 13 }}>{c.name}</div>
                                            <div style={{ fontSize: 10, color: '#8f9bba' }}>{c.currency} &bull; {c.users} users</div>
                                        </div>
                                    </div>
                                    <div style={{ position: 'relative', width: 50, height: 50 }}>
                                        <DonutRing pct={pct(Math.max(0, c.netProfit), c.grossIn || 1)} color={isGain ? '#05cd99' : '#ff5630'} size={50} stroke={4} />
                                        <div style={{
                                            position: 'absolute', inset: 0, display: 'flex',
                                            alignItems: 'center', justifyContent: 'center',
                                            fontSize: 9, fontWeight: 700,
                                            color: isGain ? '#05cd99' : '#ff5630'
                                        }}>
                                            {pct(Math.max(0, c.netProfit), c.grossIn || 1)}%
                                        </div>
                                    </div>
                                </div>

                                {/* amounts */}
                                <div className="pf-country-card-rows">
                                    <div className="pf-cc-row">
                                        <span><i className="fas fa-file-invoice-dollar" style={{ color: '#05cd99', marginRight: 5 }} />Activation</span>
                                        <span style={{ color: '#05cd99' }}>+{c.actSum.toLocaleString()} {c.currency}</span>
                                    </div>
                                    <div className="pf-cc-row">
                                        <span><i className="fas fa-wallet" style={{ color: '#ffb800', marginRight: 5 }} />Shop Deposits</span>
                                        <span style={{ color: '#ffb800' }}>+{c.shopSum.toLocaleString()} {c.currency}</span>
                                    </div>
                                    <div className="pf-cc-row">
                                        <span><i className="fas fa-money-bill-transfer" style={{ color: '#ff5630', marginRight: 5 }} />Withdrawals</span>
                                        <span style={{ color: '#ff5630' }}>-{c.wSum.toLocaleString()} {c.currency}</span>
                                    </div>
                                    <div className="pf-cc-row">
                                        <span><i className="fas fa-hand-holding-dollar" style={{ color: '#a855f7', marginRight: 5 }} />Commissions</span>
                                        <span style={{ color: '#a855f7' }}>-{c.commSum.toLocaleString()} {c.currency}</span>
                                    </div>
                                    <div className="pf-cc-divider" />
                                    <div className="pf-cc-row pf-cc-profit">
                                        <span><i className={`fas ${isGain ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}`} style={{ marginRight: 5 }} />Net Profit</span>
                                        <strong style={{ color: isGain ? '#05cd99' : '#ff5630' }}>
                                            {c.netProfit.toLocaleString()} {c.currency}
                                        </strong>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* ── BAR CHART ── */}
            <div className="pf-card" style={{ marginBottom: 24 }}>
                <div className="pf-card-header">
                    <span className="pf-card-title">
                        <i className="fas fa-chart-bar" style={{ marginRight: 8, color: '#4318ff' }} />
                        Net Profit by Region (Top 12)
                    </span>
                </div>
                <div className="pf-chart-container">
                    <BarChart countries={countries} />
                </div>
            </div>

            {/* ── FULL BREAKDOWN TABLE ── */}
            <div className="pf-card">
                <div className="pf-card-header">
                    <span className="pf-card-title">
                        <i className="fas fa-table-list" style={{ marginRight: 8, color: '#4318ff' }} />
                        Complete Country Ledger
                    </span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table>
                        <thead>
                            <tr>
                                <th>Region</th>
                                <th>CCY</th>
                                <th>Users</th>
                                <th>Activation IN</th>
                                <th>Shop IN</th>
                                <th>Withdrawals OUT</th>
                                <th>Commissions OUT</th>
                                <th>Net Profit</th>
                            </tr>
                        </thead>
                        <tbody>
                            {countries.map(c => {
                                const isGain = c.netProfit >= 0;
                                return (
                                    <tr key={c.code}>
                                        <td>
                                            <div className="pf-country-flex">
                                                <img src={`https://flagcdn.com/w40/${c.code}.png`} alt={c.code} />
                                                <span>{c.name}</span>
                                            </div>
                                        </td>
                                        <td style={{ color: '#8f9bba' }}>{c.currency}</td>
                                        <td>{c.users}</td>
                                        <td style={{ color: '#05cd99' }}>+{c.actSum.toLocaleString()}</td>
                                        <td style={{ color: '#ffb800' }}>+{c.shopSum.toLocaleString()}</td>
                                        <td style={{ color: '#ff5630' }}>-{c.wSum.toLocaleString()}</td>
                                        <td style={{ color: '#a855f7' }}>-{c.commSum.toLocaleString()}</td>
                                        <td>
                                            <span style={{
                                                color: isGain ? '#05cd99' : '#ff5630',
                                                fontWeight: 700,
                                                display: 'flex', alignItems: 'center', gap: 4
                                            }}>
                                                <i className={`fas fa-circle-${isGain ? 'up' : 'down'}`} style={{ fontSize: 10 }} />
                                                {c.netProfit.toLocaleString()} {c.currency}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                            {countries.length === 0 && (
                                <tr><td colSpan="8" style={{ textAlign: 'center', padding: 24, color: '#8f9bba' }}>No data</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
