const fs = require('fs');
const path = 'client/src/pages/admin/AdminPages.jsx';
let c = fs.readFileSync(path, 'utf8');
const lines = c.split('\n').map(l => {
    if (l.includes('Active Personnel') && l.includes('icon:'))
        return "        { label: 'Active Personnel', value: stats.active, icon: '\u2611\ufe0f' },";
    if (l.includes('Pending Deposits') && l.includes('icon:'))
        return "        { label: 'Pending Deposits', value: stats.pendingPayments, icon: '\u23f3' },";
    if (l.includes('Pending Payouts') && l.includes('icon:'))
        return "        { label: 'Pending Payouts', value: stats.pendingWithdrawals, icon: '\u26a0\ufe0f' },";
    return l;
});
fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log('done');
