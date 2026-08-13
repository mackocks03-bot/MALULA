/**
 * DataStore - Centralized Cache Service
 * Reduces duplicate Firebase reads across all pages
 * Uses in-memory cache with configurable TTL
 */

import { db, doc, getDoc } from '../services/firebase-config.js';

class DataStore {
    constructor() {
        this.cache = new Map();
        this.pendingRequests = new Map();
        this.defaultTTL = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Get data from cache or Firebase
     * @param {string} key - Cache key
     * @param {string} firebasePath - RTDB path
     * @param {object} options - { forceRefresh, ttl }
     */
    async cachedGet(key, firebasePath, options = {}) {
        const { forceRefresh = false, ttl = this.defaultTTL } = options;

        // Return cached if valid
        if (!forceRefresh && this.cache.has(key)) {
            const cached = this.cache.get(key);
            if (Date.now() - cached.timestamp < ttl) {
                return cached.data;
            }
        }

        // Deduplicate concurrent requests
        if (this.pendingRequests.has(key)) {
            return this.pendingRequests.get(key);
        }

        const requestPromise = this._fetchData(key, firebasePath, ttl);
        this.pendingRequests.set(key, requestPromise);

        try {
            const data = await requestPromise;
            return data;
        } finally {
            this.pendingRequests.delete(key);
        }
    }

    async _fetchData(key, firebasePath, ttl) {
        try {
            // firebasePath will now be [collection, document]
            const [collectionStr, documentStr] = firebasePath.split('/');
            const docRef = documentStr ? doc(db, collectionStr, documentStr) : doc(db, collectionStr);
            const snapshot = await getDoc(docRef);
            const data = snapshot.exists() ? snapshot.data() : null;

            this.cache.set(key, {
                data,
                timestamp: Date.now(),
                ttl
            });

            return data;
        } catch (error) {
            console.error(`DataStore fetch error for ${key}:`, error);
            throw error;
        }
    }

    /**
     * Set data directly to cache
     */
    setCache(key, data, ttl = this.defaultTTL) {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl
        });
    }

    /**
     * Get from cache only (no Firebase)
     */
    getCache(key) {
        if (this.cache.has(key)) {
            const cached = this.cache.get(key);
            if (Date.now() - cached.timestamp < cached.ttl) {
                return cached.data;
            }
        }
        return null;
    }

    /**
     * Invalidate specific cache key
     */
    invalidate(key) {
        this.cache.delete(key);
    }

    /**
     * Invalidate all keys matching pattern
     */
    invalidatePattern(pattern) {
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Clear entire cache
     */
    clearAll() {
        this.cache.clear();
        this.pendingRequests.clear();
    }

    // ============================================================
    // CONVENIENCE METHODS
    // ============================================================

    /**
     * Get user profile (cached)
     */
    async getUserProfile(uid) {
        if (!uid) return null;
        return this.cachedGet(`user_${uid}`, `users/${uid}`, { ttl: 2 * 60 * 1000 });
    }

    /**
     * Get settings (cached, long TTL)
     */
    async getSettings(forceRefresh = false) {
        return this.cachedGet('settings', 'settings/general', {
            forceRefresh,
            ttl: 10 * 60 * 1000 // 10 minutes
        });
    }

    /**
     * Get specific settings group
     */
    async getSettingsGroup(group, forceRefresh = false) {
        const settings = await this.getSettings(forceRefresh);
        return settings?.[group] || {};
    }

    /**
     * Get activation settings
     */
    async getActivationSettings(forceRefresh = false) {
        return this.getSettingsGroup('activation', forceRefresh);
    }

    /**
     * Get currency rates
     */
    async getCurrencyRates(forceRefresh = false) {
        return this.getSettingsGroup('currency', forceRefresh);
    }

    /**
     * Get referral settings
     */
    async getReferralSettings(forceRefresh = false) {
        return this.getSettingsGroup('referrals', forceRefresh);
    }

    /**
     * Get fee tiers
     */
    async getFeeTiers(forceRefresh = false) {
        return this.getSettingsGroup('fees', forceRefresh);
    }

    /**
     * Get challenge rewards
     */
    async getChallengeRewards(forceRefresh = false) {
        return this.getSettingsGroup('challenge', forceRefresh);
    }

    /**
     * Get task settings
     */
    async getTaskSettings(forceRefresh = false) {
        return this.getSettingsGroup('tasks', forceRefresh);
    }

    /**
     * Get general settings
     */
    async getGeneralSettings(forceRefresh = false) {
        return this.getSettingsGroup('general', forceRefresh);
    }

    /**
     * Preload essential data for dashboard
     */
    async preloadDashboard(uid) {
        if (!uid) return;
        await Promise.allSettled([
            this.getUserProfile(uid),
            this.getSettings()
        ]);
    }
}

// Singleton instance
export const dataStore = new DataStore();
export default dataStore;

console.log('📦 DataStore: Centralized cache service loaded');