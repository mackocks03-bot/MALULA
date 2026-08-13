/**
 * Settings Service
 * Handles all platform settings
 */

import { db, doc, getDoc, setDoc } from './firebase-config.js';

// ============================================================
// DEFAULT SETTINGS
// ============================================================

const DEFAULT_SETTINGS = {
    // Native Activation Fees
    activationFees: { TZS: 14500, KES: 650, UGX: 18500, MWK: 15000, ZMW: 150, RWF: 6000, BIF: 15000, CDF: 15000 },
    
    // Welcome Bonuses (native)
    welcomeBonuses: { TZS: 10000, KES: 500, UGX: 15000, MWK: 10000, ZMW: 100, RWF: 5000, BIF: 10000, CDF: 10000 },
    
    // Referral Bonuses in Base USD (used for cross-country native conversions via exchange rate)
    referralBonusLevel1: 2.00,
    referralBonusLevel2: 1.00,
    referralBonusLevel3: 0.50,
    
    // Currency
    currency: 'TZS',
    language: 'en',
    theme: 'light',
    
    // Daily Message
    dailyMessage: 'Welcome to NEWHOPE-CHAT! Start earning today.',
    
    // Native Withdrawal Limits & Fees
    minWithdrawals: { TZS: 10000, KES: 500, UGX: 15000, MWK: 10000, ZMW: 100, RWF: 5000, BIF: 10000, CDF: 10000 },
    maxWithdrawals: { TZS: 1250000, KES: 65000, UGX: 1850000, MWK: 1500000, ZMW: 15000, RWF: 600000, BIF: 1500000, CDF: 1500000 },
    withdrawFees: { TZS: 1000, KES: 50, UGX: 1500, MWK: 1000, ZMW: 10, RWF: 500, BIF: 1000, CDF: 1000 },
    
    // Commission Structure
    commissionLevel1: 10,
    commissionLevel2: 5,
    commissionLevel3: 2
};

// ============================================================
// SETTINGS OPERATIONS
// ============================================================

/**
 * Get all settings
 */
export async function getSettings() {
    try {
        const snapshot = await getDoc(doc(db, 'settings', 'general'));
        if (snapshot.exists()) {
            return snapshot.data();
        }
        return DEFAULT_SETTINGS;
    } catch (error) {
        console.error('Error getting settings:', error);
        return DEFAULT_SETTINGS;
    }
}

/**
 * Get a specific setting
 */
export async function getSetting(key) {
    const settings = await getSettings();
    return settings[key] !== undefined ? settings[key] : DEFAULT_SETTINGS[key];
}

/**
 * Update settings
 */
export async function updateSettings(updates) {
    try {
        const currentSettings = await getSettings();
        const merged = { ...currentSettings, ...updates };
        await setDoc(doc(db, 'settings', 'general'), merged);
        return merged;
    } catch (error) {
        console.error('Error updating settings:', error);
        throw error;
    }
}

/**
 * Get native activation fee
 */
export async function getActivationFee(currency = 'TZS') {
    const settings = await getSettings();
    return settings.activationFees?.[currency] || DEFAULT_SETTINGS.activationFees[currency] || 14500;
}

/**
 * Get native welcome bonus
 */
export async function getWelcomeBonus(currency = 'TZS') {
    const settings = await getSettings();
    return settings.welcomeBonuses?.[currency] || DEFAULT_SETTINGS.welcomeBonuses[currency] || 10000;
}

/**
 * Get referral bonuses (fixed amounts)
 */
export async function getReferralBonuses() {
    const settings = await getSettings();
    return {
        level1: settings.referralBonusLevel1 || DEFAULT_SETTINGS.referralBonusLevel1,
        level2: settings.referralBonusLevel2 || DEFAULT_SETTINGS.referralBonusLevel2,
        level3: settings.referralBonusLevel3 || DEFAULT_SETTINGS.referralBonusLevel3
    };
}

/**
 * Update referral bonuses
 */
export async function updateReferralBonuses(bonuses) {
    const updates = {};
    if (bonuses.level1 !== undefined) updates.referralBonusLevel1 = bonuses.level1;
    if (bonuses.level2 !== undefined) updates.referralBonusLevel2 = bonuses.level2;
    if (bonuses.level3 !== undefined) updates.referralBonusLevel3 = bonuses.level3;
    return await updateSettings(updates);
}

/**
 * Get withdrawal limits natively
 */
export async function getWithdrawLimits(currency = 'TZS') {
    const settings = await getSettings();
    return {
        min: settings.minWithdrawals?.[currency] || DEFAULT_SETTINGS.minWithdrawals[currency] || 10000,
        max: settings.maxWithdrawals?.[currency] || DEFAULT_SETTINGS.maxWithdrawals[currency] || 1250000,
        fee: settings.withdrawFees?.[currency] || DEFAULT_SETTINGS.withdrawFees[currency] || 1000
    };
}

/**
 * Get commission structure
 */
export async function getCommissionStructure() {
    const settings = await getSettings();
    return {
        level1: settings.commissionLevel1 || DEFAULT_SETTINGS.commissionLevel1,
        level2: settings.commissionLevel2 || DEFAULT_SETTINGS.commissionLevel2,
        level3: settings.commissionLevel3 || DEFAULT_SETTINGS.commissionLevel3
    };
}

/**
 * Get daily message
 */
export async function getDailyMessage() {
    return await getSetting('dailyMessage');
}

/**
 * Update daily message
 */
export async function updateDailyMessage(message) {
    return await updateSettings({ dailyMessage: message });
}

// ============================================================
// EXPORT
// ============================================================

export default {
    getSettings,
    getSetting,
    updateSettings,
    getActivationFee,
    getWelcomeBonus,
    getReferralBonuses,
    updateReferralBonuses,
    getWithdrawLimits,
    getCommissionStructure,
    getDailyMessage,
    updateDailyMessage,
    DEFAULT_SETTINGS
};