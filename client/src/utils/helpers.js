export const COUNTRIES = [
    { code: 'TZ', name: 'Tanzania', flag: 'tz', phoneCode: '+255', digits: 9, currency: 'TZS' },
    { code: 'KE', name: 'Kenya', flag: 'ke', phoneCode: '+254', digits: 9, currency: 'KES' },
    { code: 'UG', name: 'Uganda', flag: 'ug', phoneCode: '+256', digits: 9, currency: 'UGX' },
    { code: 'MW', name: 'Malawi', flag: 'mw', phoneCode: '+265', digits: 9, currency: 'MWK' },
    { code: 'ZM', name: 'Zambia', flag: 'zm', phoneCode: '+260', digits: 9, currency: 'ZMW' },
    { code: 'RW', name: 'Rwanda', flag: 'rw', phoneCode: '+250', digits: 9, currency: 'RWF' },
    { code: 'BI', name: 'Burundi', flag: 'bi', phoneCode: '+257', digits: 8, currency: 'BIF' },
    { code: 'CD', name: 'DR Congo', flag: 'cd', phoneCode: '+243', digits: 9, currency: 'CDF' }
];

export const CURRENCY_SYMBOLS = {
    TZS: 'TSh', KES: 'KSh', UGX: 'USh', MWK: 'MK',
    ZMW: 'ZK', RWF: 'FRw', BIF: 'FBu', CDF: 'FC', USD: '$'
};

let exchangeRates = {
    TZS: 2500, KES: 130, UGX: 3700, MWK: 1700,
    ZMW: 25, RWF: 1300, BIF: 2800, CDF: 2800, USD: 1
};

let ratesLoaded = false;

export function getRate(currencyCode) {
    return exchangeRates[currencyCode] || exchangeRates.TZS || 2500;
}

export function toLocalDisplay(amountUSD, currencyCode = 'TZS') {
    const rate = getRate(currencyCode);
    const localAmount = amountUSD * rate;
    const symbol = CURRENCY_SYMBOLS[currencyCode] || currencyCode;
    return {
        usd: amountUSD,
        local: localAmount,
        currency: currencyCode,
        formatted: `${symbol} ${localAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    };
}

export function toUSD(amount, currencyCode = 'TZS') {
    return amount / getRate(currencyCode);
}

export function formatCurrency(amount, currencyCode = 'TZS') {
    const symbol = CURRENCY_SYMBOLS[currencyCode] || currencyCode;
    return `${symbol} ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function getCountry(code) {
    return COUNTRIES.find(c => c.code === code) || COUNTRIES[0];
}

export function getCurrencyForCountry(countryCode) {
    return getCountry(countryCode)?.currency || 'TZS';
}

export async function loadExchangeRates() {
    if (ratesLoaded) return exchangeRates;
    try {
        const { db, doc, getDoc } = await import('../services/firebase-config.js');
        const snapshot = await getDoc(doc(db, 'settings', 'rates'));
        if (snapshot.exists()) {
            const rates = snapshot.data();
            for (const [key, value] of Object.entries(rates)) {
                if (value && value > 0) exchangeRates[key] = value;
            }
        }
    } catch (e) {
        console.warn('Could not load exchange rates:', e);
    }
    ratesLoaded = true;
    return exchangeRates;
}

export function isUserActive(userData) {
    if (!userData) return false;
    return userData.isActive === true || userData.activationStatus === 'approved';
}
