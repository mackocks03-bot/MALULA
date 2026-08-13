/**
 * Database Service
 * Centralized database operations for NEWHOPE-CHAT
 * NO CIRCULAR DEPENDENCIES
 */

import { 
    db, 
    doc, 
    getDoc, 
    getDocs,
    setDoc, 
    updateDoc, 
    addDoc, 
    deleteDoc,
    onSnapshot,
    collection,
    query,
    where,
    orderBy,
    limit as firestoreLimit
} from './firebase-config.js';

// ============================================================
// USER OPERATIONS
// ============================================================

export async function getUser(uid) {
    try {
        const snapshot = await getDoc(doc(db, 'users', uid));
        if (snapshot.exists()) {
            return { success: true, data: snapshot.data(), uid };
        }
        return { success: false, data: null };
    } catch (error) {
        console.error('Error getting user:', error);
        return { success: false, error: error.message };
    }
}

export async function updateUser(uid, updates) {
    try {
        await updateDoc(doc(db, 'users', uid), updates);
        return { success: true };
    } catch (error) {
        console.error('Error updating user:', error);
        return { success: false, error: error.message };
    }
}

export function listenToUser(uid, callback) {
    const userRef = doc(db, 'users', uid);
    return onSnapshot(userRef, (snapshot) => {
        if (snapshot.exists()) {
            callback({ success: true, data: snapshot.data(), uid });
        } else {
            callback({ success: false, data: null });
        }
    });
}

// ============================================================
// USER TASKS OPERATIONS
// ============================================================

export function listenToUserTasks(uid, callback) {
    const q = query(collection(db, 'userTasks'), where('uid', '==', uid));
    return onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback({ success: true, data: tasks });
        } else {
            callback({ success: true, data: [] });
        }
    });
}

export async function getUserTasks(uid) {
    try {
        const q = query(collection(db, 'userTasks'), where('uid', '==', uid));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            return { success: true, data: tasks };
        }
        return { success: true, data: [] };
    } catch (error) {
        console.error('Error getting user tasks:', error);
        return { success: false, error: error.message };
    }
}

export async function getUserTask(uid, taskId) {
    try {
        const taskRef = doc(db, 'userTasks', `${uid}_${taskId}`);
        const snapshot = await getDoc(taskRef);
        if (snapshot.exists()) {
            return { success: true, data: snapshot.data() };
        }
        return { success: true, data: null };
    } catch (error) {
        console.error('Error getting user task:', error);
        return { success: false, error: error.message };
    }
}

export async function updateUserTask(uid, taskId, updates) {
    try {
        await updateDoc(doc(db, 'userTasks', `${uid}_${taskId}`), updates);
        return { success: true };
    } catch (error) {
        console.error('Error updating user task:', error);
        return { success: false, error: error.message };
    }
}

// ============================================================
// LOGIN INDEX OPERATIONS
// ============================================================

export async function usernameExists(username) {
    try {
        const snapshot = await getDoc(doc(db, 'loginIndex', username));
        return snapshot.exists();
    } catch (error) {
        console.error('Error checking username:', error);
        return false;
    }
}

export async function addToLoginIndex(username, uid, email) {
    try {
        await setDoc(doc(db, 'loginIndex', username), {
            uid,
            email: email.toLowerCase(),
            username
        });
        return { success: true };
    } catch (error) {
        console.error('Error adding to login index:', error);
        return { success: false, error: error.message };
    }
}

export async function removeFromLoginIndex(username) {
    try {
        await deleteDoc(doc(db, 'loginIndex', username));
        return { success: true };
    } catch (error) {
        console.error('Error removing from login index:', error);
        return { success: false, error: error.message };
    }
}

// ============================================================
// REFERRAL OPERATIONS
// ============================================================

export async function addReferral(referrerUid, referredData) {
    try {
        const result = await addDoc(collection(db, 'referrals'), {
            referrerUid,
            uid: referredData.uid,
            username: referredData.username,
            fullName: referredData.fullName || '',
            phone: referredData.phone || '',
            country: referredData.country || '',
            createdAt: Date.now(),
            isActive: false,
            level: referredData.level || 1
        });
        return { success: true, id: result.id };
    } catch (error) {
        console.error('Error adding referral:', error);
        return { success: false, error: error.message };
    }
}

export async function deleteReferrals(uid) {
    try {
        const q = query(collection(db, 'referrals'), where('referrerUid', '==', uid));
        const snapshot = await getDocs(q);
        const deletes = snapshot.docs.map(d => deleteDoc(d.ref));
        await Promise.all(deletes);
        return { success: true };
    } catch (error) {
        console.error('Error deleting referrals:', error);
        return { success: false, error: error.message };
    }
}

// ============================================================
// TRANSACTION OPERATIONS
// ============================================================

export async function addTransaction(uid, transactionData) {
    try {
        const result = await addDoc(collection(db, 'transactions'), {
            uid,
            ...transactionData,
            createdAt: Date.now()
        });
        return { success: true, id: result.id };
    } catch (error) {
        console.error('Error adding transaction:', error);
        return { success: false, error: error.message };
    }
}

export async function getTransactions(uid, limitCount = 50) {
    try {
        const q = query(
            collection(db, 'transactions'), 
            where('uid', '==', uid),
            orderBy('createdAt', 'desc'),
            firestoreLimit(limitCount)
        );
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
            const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            return { success: true, data: transactions };
        }
        return { success: true, data: [] };
    } catch (error) {
        console.error('Error getting transactions:', error);
        return { success: false, error: error.message };
    }
}

export function listenToTransactions(uid, callback, limitCount = 20) {
    const q = query(
        collection(db, 'transactions'),
        where('uid', '==', uid),
        orderBy('createdAt', 'desc'),
        firestoreLimit(limitCount)
    );
    
    return onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback({ success: true, data: transactions });
        } else {
            callback({ success: true, data: [] });
        }
    });
}

// ============================================================
// NOTIFICATION OPERATIONS
// ============================================================

export async function addNotification(uid, notificationData) {
    try {
        const result = await addDoc(collection(db, 'notifications'), {
            uid,
            ...notificationData,
            read: false,
            createdAt: Date.now()
        });
        return { success: true, id: result.id };
    } catch (error) {
        console.error('Error adding notification:', error);
        return { success: false, error: error.message };
    }
}

export async function getNotifications(uid) {
    try {
        const q = query(
            collection(db, 'notifications'), 
            where('uid', '==', uid),
            orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            return { success: true, data: notifications };
        }
        return { success: true, data: [] };
    } catch (error) {
        console.error('Error getting notifications:', error);
        return { success: false, error: error.message };
    }
}

export async function markNotificationRead(uid, notificationId) {
    try {
        await updateDoc(doc(db, 'notifications', notificationId), {
            read: true
        });
        return { success: true };
    } catch (error) {
        console.error('Error marking notification as read:', error);
        return { success: false, error: error.message };
    }
}

export async function markAllNotificationsRead(uid) {
    try {
        const q = query(collection(db, 'notifications'), where('uid', '==', uid), where('read', '==', false));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const updates = snapshot.docs.map(d => updateDoc(d.ref, { read: true }));
            await Promise.all(updates);
        }
        return { success: true };
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        return { success: false, error: error.message };
    }
}

// ============================================================
// SETTINGS OPERATIONS
// ============================================================

export async function getSettings() {
    try {
        const snapshot = await getDoc(doc(db, 'settings', 'general'));
        if (snapshot.exists()) {
            return { success: true, data: snapshot.data() };
        }
        return { success: false, data: null };
    } catch (error) {
        console.error('Error getting settings:', error);
        return { success: false, error: error.message };
    }
}

export async function updateSettings(updates) {
    try {
        const current = await getSettings();
        const merged = { ...(current.data || {}), ...updates };
        await setDoc(doc(db, 'settings', 'general'), merged);
        return { success: true, data: merged };
    } catch (error) {
        console.error('Error updating settings:', error);
        return { success: false, error: error.message };
    }
}

// ============================================================
// TOP AFFILIATES
// ============================================================

export async function getTopAffiliates(limitCount = 20) {
    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, orderBy('referralCount', 'desc'), firestoreLimit(limitCount));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
            const users = snapshot.docs.map(docData => ({
                uid: docData.id,
                username: docData.data().username || 'User',
                fullName: docData.data().fullName || '',
                country: docData.data().country || '🌍',
                referrals: docData.data().referralCount || 0,
                totalProfit: docData.data().totalProfit || 0,
                ...docData.data()
            }));
            
            return { success: true, data: users };
        }
        return { success: true, data: [] };
    } catch (error) {
        console.error('Error getting top affiliates:', error);
        return { success: false, error: error.message };
    }
}

// ============================================================
// DELETE USER DATA (Rollback)
// ============================================================

export async function deleteUserData(uid) {
    try {
        await deleteDoc(doc(db, 'users', uid));
        
        const deleteCollectionByUser = async (colName) => {
            const q = query(collection(db, colName), where('uid', '==', uid));
            const snap = await getDocs(q);
            const deletes = snap.docs.map(d => deleteDoc(d.ref));
            await Promise.all(deletes);
        };
        
        await deleteCollectionByUser('transactions');
        await deleteCollectionByUser('notifications');
        await deleteCollectionByUser('withdrawals');
        await deleteCollectionByUser('userTasks');
        
        const qRef = query(collection(db, 'referrals'), where('referrerUid', '==', uid));
        const refSnap = await getDocs(qRef);
        const refDeletes = refSnap.docs.map(d => deleteDoc(d.ref));
        await Promise.all(refDeletes);

        return { success: true };
    } catch (error) {
        console.error('Error deleting user data:', error);
        return { success: false, error: error.message };
    }
}

// ============================================================
// EXPORT ALL
// ============================================================

export default {
    getUser,
    updateUser,
    listenToUser,
    listenToUserTasks,
    getUserTasks,
    getUserTask,
    updateUserTask,
    usernameExists,
    addToLoginIndex,
    removeFromLoginIndex,
    addReferral,
    deleteReferrals,
    addTransaction,
    getTransactions,
    listenToTransactions,
    addNotification,
    getNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    getSettings,
    updateSettings,
    getTopAffiliates,
    deleteUserData
};