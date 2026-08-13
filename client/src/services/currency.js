/**
 * Currency Service
 * Backend uses USD, displays in local currency
 * Rates fetched from RTDB /settings/rates
 */

import { db, doc, getDoc } from './firebase-config.js';

// Default rates (fallback)
let EXCHANGE_RATES = {
    USD: 1,
    TZS: 2500,
    KES: 130,
    UGX: 3700,
    MWK: 1700,
    ZMW: 25,
    RWF: 1300,
    BIF: 2800,
    CDF: 2800
};

let DEFAULT_CURRENCY = 'USD';
let ratesLoaded = false;

// Country currency mapping
const COUNTRY_CURRENCIES = {
    'TZ': 'TZS',
    'KE': 'KES',
    'UG': 'UGX',
    'MW': 'MWK',
    'ZM': 'ZMW',
    'RW': 'RWF',
    'BI': 'BIF',
    'CD': 'CDF',
    'INT': 'USD'
};

const CURRENCY_SYMBOLS = {
    TZS: 'TSh',
    KES: 'KSh',
    UGX: 'USh',
    MWK: 'MK',
    ZMW: 'ZK',
    RWF: 'FRw',
    BIF: 'FBu',
    CDF: 'FC',
    USD: '$'
};

/**
 * Load exchange rates from RTDB
 */
export async function loadExchangeRates() {
    try {
        const snapshot = await getDoc(doc(db, 'settings', 'rates'));
        if (snapshot.exists()) {
            const rates = snapshot.data();
            // Only override if valid
            for (const [key, value] of Object.entries(rates)) {
                if (value && value > 0) {
                    EXCHANGE_RATES[key] = value;
                }
            }
            ratesLoaded = true;
            console.log('💱 Exchange rates loaded from RTDB:', EXCHANGE_RATES);
            return EXCHANGE_RATES;
        } else {
            console.log('💱 No rates in RTDB, using defaults');
            ratesLoaded = true;
            return EXCHANGE_RATES;
        }
    } catch (error) {
        console.warn('⚠️ Could not fetch rates, using defaults:', error);
        ratesLoaded = true;
        return EXCHANGE_RATES;
    }
}

/**
 * Get exchange rate for currency
 */
export function getRate(currencyCode) {
    return EXCHANGE_RATES[currencyCode] || EXCHANGE_RATES['TZS'] || 2500;
}

/**
 * Get currency for country code
 */
export function getCurrencyForCountry(countryCode) {
    return COUNTRY_CURRENCIES[countryCode] || 'TZS';
}

/**
 * Convert USD to local currency
 */
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

/**
 * Convert local amount to USD
 */
export function toUSD(amount, currencyCode = 'TZS') {
    const rate = getRate(currencyCode);
    return amount / rate;
}

/**
 * Format currency amount
 */
export function formatCurrency(amount, currencyCode = 'TZS') {
    const symbol = CURRENCY_SYMBOLS[currencyCode] || currencyCode;
    return `${symbol} ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/**
 * Get all exchange rates
 */
export function getExchangeRates() {
    return EXCHANGE_RATES;
}

/**
 * Check if rates are loaded
 */
export function areRatesLoaded() {
    return ratesLoaded;
}

export { EXCHANGE_RATES, DEFAULT_CURRENCY, COUNTRY_CURRENCIES, CURRENCY_SYMBOLS };