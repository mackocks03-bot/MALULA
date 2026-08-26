import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase-config.js';
import './css/AdminFinancials.css'; // our scoped styles

export default function AdminFinancials() {
    const [stats, setStats] = useState({ countries: [], globalTotals: { users: 0, actCount: 0, shopCount: 0, withdrawCount: 0 } });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            const [uSnap, aSnap, sSnap, wSnap] = await Promise.all([
                getDocs(collection(db, 'users')),
                getDocs(collection(db, 'activationPayments')),
                getDocs(collection(db, 'shopDeposits')),
                getDocs(collection(db, 'withdrawals')),
            ]);

            const usersMap = {};
            let totalUsers = 0;
            const countryMeta = {}; // cc -> { code, name, currency, actSum, actCount, shopSum, shopCount, wSum, wCount }

            uSnap.forEach(d => {
                const u = d.data();
                usersMap[d.id] = u;
                totalUsers++;
                const cc = (u.countryCode || u.country || 'TZ').toLowerCase();
                const cn = u.countryName || u.country || 'Tanzania';
                const cur = u.currency || 'TZS';
                if (!countryMeta[cc]) {
                    countryMeta[cc] = { code: cc, name: cn, currency: cur, users: 0, actSum: 0, actCount: 0, shopSum: 0, shopCount: 0, wSum: 0, wCount: 0 };
                }
                countryMeta[cc].users++;
            });

            let actCountGlobal = 0;
            aSnap.forEach(d => {
                const p = d.data();
                if (p.status !== 'approved' && p.status !== 'completed' && p.status !== 'success') return;
                const u = usersMap[p.uid] || {};
                const cc = (p.countryCode || u.countryCode || u.country || 'TZ').toLowerCase();
                const cur = u.currency || p.nativeCurrency || 'TZS';
                if (!countryMeta[cc]) countryMeta[cc] = { code: cc, name: 'Unknown', currency: cur, users: 0, actSum: 0, actCount: 0, shopSum: 0, shopCount: 0, wSum: 0, wCount: 0 };
                
                const nativeAmt = Number(p.amountTZS || p.nativeAmount || p.amount || 0);
                countryMeta[cc].actSum += nativeAmt;
                countryMeta[cc].actCount++;
                actCountGlobal++;
            });

            let shopCountGlobal = 0;
            sSnap.forEach(d => {
                const p = d.data();
                if (p.status !== 'approved' && p.status !== 'completed' && p.status !== 'success') return;
                const u = usersMap[p.uid] || {};
                const cc = (p.countryCode || u.countryCode || u.country || 'TZ').toLowerCase();
                const cur = u.currency || p.nativeCurrency || 'TZS';
                if (!countryMeta[cc]) countryMeta[cc] = { code: cc, name: 'Unknown', currency: cur, users: 0, actSum: 0, actCount: 0, shopSum: 0, shopCount: 0, wSum: 0, wCount: 0 };
                
                const nativeAmt = Number(p.amountTZS || p.nativeAmount || p.amount || 0);
                countryMeta[cc].shopSum += nativeAmt;
                countryMeta[cc].shopCount++;
                shopCountGlobal++;
            });

            let withdrawCountGlobal = 0;
            wSnap.forEach(d => {
                const p = d.data();
                if (p.status !== 'approved' && p.status !== 'completed' && p.status !== 'COMPLETED' && p.status !== 'success') return;
                const u = usersMap[p.uid] || {};
                const cc = (p.countryCode || u.countryCode || u.country || 'TZ').toLowerCase();
                const cur = u.currency || 'TZS';
                if (!countryMeta[cc]) countryMeta[cc] = { code: cc, name: 'Unknown', currency: cur, users: 0, actSum: 0, actCount: 0, shopSum: 0, shopCount: 0, wSum: 0, wCount: 0 };
                
                const nativeAmt = Number(p.nativeAmount || p.amount || 0);
                countryMeta[cc].wSum += nativeAmt;
                countryMeta[cc].wCount++;
                withdrawCountGlobal++;
            });

            const countriesArr = Object.values(countryMeta).map(c => {
                return {
                    ...c,
                    netProfit: (c.actSum + c.shopSum) - c.wSum
                };
            }).sort((a, b) => b.actSum - a.actSum); 

            setStats({ 
                countries: countriesArr, 
                globalTotals: { users: totalUsers, actCount: actCountGlobal, shopCount: shopCountGlobal, withdrawCount: withdrawCountGlobal }
            });
            setLoading(false);
        };
        fetchData();
    }, []);

    if (loading) {
        return <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>Loading Financial Analysis...</div>;
    }

    const { countries, globalTotals } = stats;

    return (
        <div className="payflow-ui">
            <header className="pf-top-bar">
                <div className="pf-greeting">
                    <h1>Company Financial Analysis 📊</h1>
                    <p>Real-time calculation of country-based deposits, withdrawals, and net profit.</p>
                </div>
                <div className="pf-top-actions">
                    <button className="pf-icon-btn">
                        <i className="fa-regular fa-calendar"></i>
                    </button>
                    <button className="pf-btn-primary" onClick={() => window.location.reload()} style={{border: 'none', background: 'var(--pf-accent-blue)', color:'white', padding: '10px 20px', borderRadius: '30px', cursor:'pointer', fontWeight: 600}}>
                        <i className="fa-solid fa-arrows-rotate"></i> Refresh Ledger
                    </button>
                </div>
            </header>

            <section className="pf-metrics-grid">
                <div className="pf-metric-card">
                    <div className="pf-metric-info">
                        <p>Total User Records</p>
                        <h3>{globalTotals.users.toLocaleString()}</h3>
                        <div className="pf-trend"><i className="fa-solid fa-earth-americas"></i> <span>Across {countries.length} Regions</span></div>
                    </div>
                    <div className="pf-metric-icon"><i className="fa-solid fa-users"></i></div>
                </div>

                <div className="pf-metric-card">
                    <div className="pf-metric-info">
                        <p>Total Activation Pmts</p>
                        <h3>{globalTotals.actCount.toLocaleString()}</h3>
                        <div className="pf-trend positive"><i className="fa-solid fa-arrow-up"></i> <span>Completed</span></div>
                    </div>
                    <div className="pf-metric-icon"><i className="fa-solid fa-file-invoice-dollar"></i></div>
                </div>

                <div className="pf-metric-card">
                    <div className="pf-metric-info">
                        <p>Total Shop Deposits</p>
                        <h3>{globalTotals.shopCount.toLocaleString()}</h3>
                        <div className="pf-trend positive"><i className="fa-solid fa-arrow-up"></i> <span>Completed</span></div>
                    </div>
                    <div className="pf-metric-icon"><i className="fa-solid fa-wallet"></i></div>
                </div>

                <div className="pf-metric-card">
                    <div className="pf-metric-info">
                        <p>Total Withdrawals</p>
                        <h3>{globalTotals.withdrawCount.toLocaleString()}</h3>
                        <div className="pf-trend" style={{color: '#ff5630'}}><i className="fa-solid fa-arrow-down"></i> <span style={{color: '#8f9bba'}}>Disbursed</span></div>
                    </div>
                    <div className="pf-metric-icon" style={{background: '#ffe7e3', color: '#ff5630'}}><i className="fa-solid fa-money-bill-transfer"></i></div>
                </div>
            </section>

            <section className="pf-charts-grid">
                <div className="pf-card" style={{ gridColumn: '1 / -1' }}>
                    <div className="pf-card-header">
                        <span className="pf-card-title">Top 12 Country Financials (Graphical)</span>
                    </div>
                    <div className="pf-chart-container">
                        <svg className="pf-chart-svg" viewBox="0 0 600 200" preserveAspectRatio="none">
                            <defs>
                                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#4318ff" stopOpacity="0.25"/>
                                    <stop offset="100%" stopColor="#4318ff" stopOpacity="0.0"/>
                                </linearGradient>
                            </defs>
                            {/* Simple dynamic bar chart representing Net Profit per region */}
                            {countries.slice(0, 12).map((c, i) => {
                                const maxProfit = Math.max(...countries.slice(0, 12).map(x => Math.max(0, x.netProfit)), 1);
                                const h = Math.max(10, (Math.max(0, c.netProfit) / maxProfit) * 150);
                                const x = 40 + (i * 45);
                                const y = 180 - h;
                                return (
                                    <g key={c.code}>
                                        <rect x={x} y={y} width="20" height={h} fill="url(#chartGradient)" />
                                        <rect x={x} y={y} width="20" height="4" fill="#4318ff" />
                                        <text x={x+10} y="195" fill="#8f9bba" fontSize="10" textAnchor="middle" textTransform="uppercase">{c.code}</text>
                                    </g>
                                );
                            })}
                            <line x1="20" y1="180" x2="580" y2="180" stroke="#8f9bba" strokeOpacity="0.3" />
                        </svg>
                    </div>
                </div>
            </section>

            <section className="pf-table-container pf-card" style={{ border: 'none', background: 'var(--pf-card-bg)', borderRadius: 'var(--pf-radius-lg)'}}>
                <div className="pf-card-header" style={{ padding: '22px 22px 0 22px' }}>
                    <span className="pf-card-title">Country Breakdown & Region Profit Analysis</span>
                </div>
                <div style={{ padding: '10px 22px 22px 22px', overflowX: 'auto' }}>
                    <table>
                        <thead>
                            <tr>
                                <th>Region</th>
                                <th>Currency</th>
                                <th>Users</th>
                                <th>Activation (+IN)</th>
                                <th>Shop Dep (+IN)</th>
                                <th>Withdraws (-OUT)</th>
                                <th>Net Profit</th>
                            </tr>
                        </thead>
                        <tbody>
                            {countries.map(c => {
                                const isPositive = c.netProfit >= 0;
                                return (
                                    <tr key={c.code}>
                                        <td>
                                            <div className="pf-country-flex">
                                                <img src={`https://flagcdn.com/w40/${c.code}.png`} alt={c.code} />
                                                <span style={{ fontWeight: 700 }}>{c.name}</span>
                                            </div>
                                        </td>
                                        <td style={{ color: 'var(--pf-text-muted)' }}>{c.currency}</td>
                                        <td>{c.users.toLocaleString()}</td>
                                        <td style={{ color: '#05cd99' }}>+{c.actSum.toLocaleString()}</td>
                                        <td style={{ color: '#05cd99' }}>+{c.shopSum.toLocaleString()}</td>
                                        <td style={{ color: '#ff5630' }}>-{c.wSum.toLocaleString()}</td>
                                        <td style={{ color: isPositive ? '#05cd99' : '#ff5630', fontWeight: 700 }}>
                                            {c.netProfit.toLocaleString()} {c.currency}
                                        </td>
                                    </tr>
                                );
                            })}
                            {countries.length === 0 && (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: 20, color: '#8f9bba' }}>No financial data found</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
