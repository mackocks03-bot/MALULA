import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { auth, onAuthStateChanged, db, doc, setDoc } from '../services/firebase-config.js';
import { getUserData } from '../services/auth.js';
import { loadExchangeRates } from '../utils/helpers.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadExchangeRates();
        const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser);
            if (firebaseUser) {
                try {
                    let data = await getUserData(firebaseUser.uid);
                    if (!data) {
                        const minimalData = {
                            uid: firebaseUser.uid,
                            email: firebaseUser.email || '',
                            username: firebaseUser.email ? firebaseUser.email.split('@')[0] : 'user',
                            createdAt: Date.now(),
                            isActive: false,
                            activationStatus: 'pending',
                            balance: 0,
                            totalProfit: 0,
                            referralCount: 0,
                            currency: 'TZS',
                            earnings: { chat: 0, tiktok: 0, facebook: 0, youtube: 0, whatsapp: 0, ads: 0 }
                        };
                        await setDoc(doc(db, 'users', firebaseUser.uid), minimalData);
                        data = minimalData;
                    }
                    setUserData(data);
                } catch (e) {
                    console.error('Error loading user data:', e);
                    setUserData(null);
                }
            } else {
                setUserData(null);
            }
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const refreshUserData = useCallback(async () => {
        if (!user) return null;
        const data = await getUserData(user.uid);
        setUserData(data);
        return data;
    }, [user]);

    const isActive = userData?.isActive === true || userData?.activationStatus === 'approved';

    return (
        <AuthContext.Provider value={{ user, userData, loading, refreshUserData, isActive, isAuthenticated: !!user }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
