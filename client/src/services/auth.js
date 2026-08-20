/**
 * Auth Service
 * Handles authentication and user management
 * NO CIRCULAR DEPENDENCIES
 */

import {
    auth,
    db,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    addDoc,
    collection,
    query,
    where,
    deleteDoc,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendEmailVerification,
    sendPasswordResetEmail,
    signOut,
    onAuthStateChanged,
    fetchSignInMethodsForEmail,
    deleteUser,
    arrayUnion
} from './firebase-config.js';
import { getSettings } from './settings.js';

// ============================================================
// ERROR SANITIZATION
// ============================================================

function sanitizeAuthError(error) {
    const msg = error?.message || String(error);
    if (!msg) return 'An unexpected error occurred.';
    
    // Obscure credential errors so users don't enumerate emails
    if (msg.includes('auth/invalid-credential')) return 'Incorrect password or account not found.';
    if (msg.includes('auth/user-not-found')) return 'Account not found.';
    if (msg.includes('auth/wrong-password')) return 'Incorrect password.';
    
    if (msg.includes('auth/email-already-in-use')) return 'This email address is already registered.';
    if (msg.includes('auth/weak-password')) return 'Password is too weak. Please use a stronger password.';
    if (msg.includes('auth/invalid-email')) return 'Please enter a valid email address.';
    if (msg.includes('auth/network-request-failed')) return 'Network error. Please check your connection.';
    if (msg.includes('auth/too-many-requests')) return 'Too many failed login attempts. Please try again later.';
    
    // Catch-all database permission errors
    if (msg.includes('permission-denied') || msg.includes('Missing or insufficient permissions')) {
        return 'Access denied. You do not have permission to perform this action.';
    }
    
    // Generic catch-all for any other raw database or firebase errors to avoid exposing the stack.
    if (msg.includes('Firebase') || msg.includes('auth/') || msg.includes('db')) {
        return 'An error occurred during authentication. Please try again.';
    }
    
    return msg;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

async function usernameExists(username) {
    try {
        const snapshot = await getDoc(doc(db, 'loginIndex', username));
        return snapshot.exists();
    } catch (error) {
        return false;
    }
}

async function addToLoginIndex(username, uid, email) {
    try {
        await setDoc(doc(db, 'loginIndex', username), {
            uid,
            email: email.toLowerCase(),
            username
        });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function removeFromLoginIndex(username) {
    try {
        await deleteDoc(doc(db, 'loginIndex', username));
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// old addReferral removed because it relied on separate collection

async function deleteQueryRecords(q) {
  const snapshot = await getDocs(q);
  const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
  await Promise.all(deletePromises);
}

async function deleteUserData(uid) {
    try {
        await deleteDoc(doc(db, 'users', uid));
        await deleteQueryRecords(query(collection(db, 'transactions'), where('uid', '==', uid)));
        await deleteQueryRecords(query(collection(db, 'notifications'), where('uid', '==', uid)));
        await deleteQueryRecords(query(collection(db, 'withdrawals'), where('uid', '==', uid)));
        await deleteQueryRecords(query(collection(db, 'userTasks'), where('uid', '==', uid)));
        await deleteQueryRecords(query(collection(db, 'referrals'), where('referrerUid', '==', uid)));
        return { success: true };
    } catch (error) {
        console.error('Error deleting user data:', error);
        return { success: false, error: error.message };
    }
}

// ============================================================
// AUTH OPERATIONS
// ============================================================

export async function isEmailAvailable(email) {
    try {
        const methods = await fetchSignInMethodsForEmail(auth, email);
        return methods.length === 0;
    } catch (error) {
        console.error('Error checking email:', error);
        return false;
    }
}

export async function registerUser(email, password, userData) {
    const stepLog = (step, status) => {
        console.log(`📌 STEP ${step}: ${status}`);
    };
    
    let user = null;
    let username = userData.username;
    let uid = null;
    
    try {
        const exists = await usernameExists(username);
        if (exists) {
            stepLog('1', '❌ Username already taken');
            return { success: false, error: 'Username already taken' };
        }
        stepLog('1', '✅ Username available');
        
        const emailAvailable = await isEmailAvailable(email);
        if (!emailAvailable) {
            stepLog('2', '❌ Email already registered');
            return { success: false, error: 'Email already registered' };
        }
        stepLog('2', '✅ Email available');
        
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            user = userCredential.user;
            uid = user.uid;
            stepLog('3', `✅ Auth created: ${uid}`);
        } catch (authError) {
            stepLog('3', `❌ Auth creation failed: ${authError.message}`);
            return { success: false, error: sanitizeAuthError(authError) };
        }
        
        stepLog('4', '💾 Saving user data...');
        
        const currency = userData.currency || 'TZS';
        
        let initialWelcomeBonus = 10000;
        if (currency === 'KES') initialWelcomeBonus = 500;
        else if (currency === 'TZS') initialWelcomeBonus = 10000;
        else if (currency === 'UGX') initialWelcomeBonus = 15000;
        else if (currency === 'MWK') initialWelcomeBonus = 10000;
        else if (currency === 'ZMW') initialWelcomeBonus = 100;
        else if (currency === 'RWF') initialWelcomeBonus = 5000;
        else if (currency === 'BIF') initialWelcomeBonus = 10000;
        else if (currency === 'CDF') initialWelcomeBonus = 10000;
        else if (currency === 'MZN') initialWelcomeBonus = 260; // Hardcoded exact amount for Mozambique

        const fullUserData = {
            uid: uid,
            username: username,
            email: email.toLowerCase(),
            fullName: userData.fullName || '',
            phone: userData.phone || '',
            country: userData.country || 'TZ',
            countryName: userData.countryName || 'Tanzania',
            currency: currency,
            createdAt: Date.now(),
            isActive: false,
            activationStatus: 'pending',
            balance: 0,
            totalProfit: 0,
            withdrawn: 0,
            referralCount: 0,
            referrer: userData.referrer || null,
            language: userData.language || 'en',
            theme: userData.theme || 'light',
            device: userData.device || 'Unknown',
            isVerified: false,
            role: 'user',
            profilePic: null,
            welcomeBonus: initialWelcomeBonus, // HARDCODED native amount
            referralLink: `${window.location.origin}/register?ref=${username}`,
            earnings: {
                chat: 0,
                tiktok: 0,
                facebook: 0,
                youtube: 0,
                whatsapp: 0,
                ads: 0
            },
            referrals: {
                level1: [],
                level2: [],
                level3: []
            },
            testField: 'ok'
        };
        
        try {
            await setDoc(doc(db, 'users', uid), fullUserData);
            stepLog('4', '✅ User data saved');
        } catch (dbError) {
            stepLog('4', `❌ Failed to save user data: ${dbError.message}`);
            try {
                await deleteUser(user);
                stepLog('4', '🔄 Auth user deleted (rollback)');
            } catch (deleteError) {
                console.error('❌ Could not delete auth user:', deleteError);
            }
            return { success: false, error: 'Failed to save user data' };
        }
        
        stepLog('5', '💾 Saving loginIndex...');
        try {
            await setDoc(doc(db, 'loginIndex', username), {
                uid: uid,
                email: email.toLowerCase(),
                username: username
            });
            // Write to phoneIndex as well
            await setDoc(doc(db, 'phoneIndex', userData.phone), {
                uid: uid,
                phone: userData.phone
            });
            stepLog('5', '✅ loginIndex and phoneIndex saved');
        } catch (indexError) {
            stepLog('5', `❌ Failed to save indices: ${indexError.message}`);
            try {
                await deleteUser(user);
                await deleteUserData(uid);
                stepLog('5', '🔄 Auth + user data deleted (rollback)');
            } catch (rollbackError) {}
            return { success: false, error: 'Failed to save login data' };
        }
        
        if (userData.referrer) {
            stepLog('6', `🔗 Processing referral from: ${userData.referrer}`);
            try {
                const referrerSnapshot = await getDoc(doc(db, 'loginIndex', userData.referrer));
                if (referrerSnapshot.exists()) {
                    const referrerData = referrerSnapshot.data();
                    const referrerUid = referrerData.uid;

                    const refUserSnapshot = await getDoc(doc(db, 'users', referrerUid));
                    if (refUserSnapshot.exists()) {
                        const refUserData = refUserSnapshot.data();
                        
                        // 1. Add to Level 1
                        await updateDoc(doc(db, 'users', referrerUid), {
                            'referrals.level1': arrayUnion(uid),
                            referralCount: (refUserData.referralCount || 0) + 1
                        });
                        
                        // 2. Add to Level 2
                        if (refUserData.referrer) {
                            const l2Snap = await getDoc(doc(db, 'loginIndex', refUserData.referrer));
                            if (l2Snap.exists()) {
                                const l2uid = l2Snap.data().uid;
                                await updateDoc(doc(db, 'users', l2uid), {
                                    'referrals.level2': arrayUnion(uid)
                                });
                                
                                const l2UserSnap = await getDoc(doc(db, 'users', l2uid));
                                if (l2UserSnap.exists()) {
                                    const l2UserData = l2UserSnap.data();
                                    // 3. Add to Level 3
                                    if (l2UserData.referrer) {
                                        const l3Snap = await getDoc(doc(db, 'loginIndex', l2UserData.referrer));
                                        if (l3Snap.exists()) {
                                            const l3uid = l3Snap.data().uid;
                                            await updateDoc(doc(db, 'users', l3uid), {
                                                'referrals.level3': arrayUnion(uid)
                                            });
                                        }
                                    }
                                }
                            }
                        }
                        
                    }
                    stepLog('6', '✅ Referral arrays updated');
                } else {
                    stepLog('6', '⚠️ Referrer username not found in loginIndex');
                }
            } catch (refError) {
                stepLog('6', `⚠️ Referral failed: ${refError.message}`);
            }
        }
        
        stepLog('7', '🔍 Verifying user data in RTDB (now Firestore)...');
        try {
            const verifySnapshot = await getDoc(doc(db, 'users', uid));
            if (verifySnapshot.exists()) {
                stepLog('7', '✅ Verification passed - User exists in Firestore');
            } else {
                stepLog('7', '❌ Verification failed - User NOT found in Firestore');
                try {
                    await deleteUser(user);
                    stepLog('7', '🔄 Auth user deleted (rollback)');
                } catch (deleteError) {}
                return { success: false, error: 'User data verification failed' };
            }
        } catch (verifyError) {
            stepLog('7', `❌ Verification error: ${verifyError.message}`);
            return { success: false, error: 'Verification failed' };
        }
        
        try {
            await sendEmailVerification(user);
            stepLog('8', '✅ Verification email sent');
        } catch (emailError) {}
        
        console.log('🎉 REGISTRATION COMPLETE');
        return { success: true, user, userData: fullUserData };
        
    } catch (error) {
        if (user) {
            try {
                await deleteUser(user);
            } catch (deleteError) {}
        }
        return { success: false, error: sanitizeAuthError(error) };
    }
}

export async function loginUser(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return { success: true, user: userCredential.user };
    } catch (error) {
        return { success: false, error: sanitizeAuthError(error) };
    }
}

export async function resetPassword(email) {
    try {
        await sendPasswordResetEmail(auth, email);
        return { success: true };
    } catch (error) {
        return { success: false, error: sanitizeAuthError(error) };
    }
}

export async function logoutUser() {
    try {
        await signOut(auth);
        return { success: true };
    } catch (error) {
        return { success: false, error: sanitizeAuthError(error) };
    }
}

export function getCurrentUser() {
    return auth.currentUser;
}

export async function getUserData(uid) {
    try {
        if (!uid) return null;
        
        const snapshot = await getDoc(doc(db, 'users', uid));
        
        if (snapshot.exists()) {
            return snapshot.data();
        } else {
            return null;
        }
    } catch (error) {
        return null;
    }
}

export async function isUsernameAvailable(username) {
    try {
        const snapshot = await getDoc(doc(db, 'loginIndex', username));
        return !snapshot.exists();
    } catch (error) {
        return false;
    }
}

export async function isPhoneAvailable(phone) {
    try {
        const snapshot = await getDoc(doc(db, 'phoneIndex', phone));
        return !snapshot.exists();
    } catch (error) {
        console.error('Error checking phone:', error);
        return false;
    }
}

export async function updateUserData(uid, updates) {
    try {
        await updateDoc(doc(db, 'users', uid), updates);
        return { success: true };
    } catch (error) {
        return { success: false, error: sanitizeAuthError(error) };
    }
}

export {
    auth,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendEmailVerification,
    sendPasswordResetEmail,
    signOut,
    fetchSignInMethodsForEmail,
    deleteUser
};