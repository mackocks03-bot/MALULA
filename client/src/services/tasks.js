/**
 * Tasks Service
 * Handles task management for NEWHOPE-CHAT
 * Supports scheduled daily tasks (YouTube, Ads, WhatsApp, etc.)
 */

import { 
    db, 
    doc, 
    getDoc, 
    getDocs, 
    setDoc, 
    updateDoc, 
    collection, 
    query, 
    where, 
    onSnapshot 
} from './firebase-config.js';
import { updateUser, getUser, addTransaction, addNotification } from './database.js';
import { toLocalDisplay } from './currency.js';

// ============================================================
// DEFAULT TASKS
// ============================================================

const DEFAULT_TASKS = [
    {
        id: 'task_1',
        title: 'Complete Your Profile',
        description: 'Fill in all your profile details including full name, phone number, and country.',
        icon: '👤',
        reward: 0.50,
        category: 'profile',
        status: 'active',
        createdAt: Date.now()
    },
    {
        id: 'task_2',
        title: 'Join Global Chat',
        description: 'Send your first message in the global chat and introduce yourself.',
        icon: '💬',
        reward: 0.30,
        category: 'chat',
        status: 'active',
        createdAt: Date.now()
    },
    {
        id: 'task_3',
        title: 'Share on TikTok',
        description: 'Create a TikTok video about NEWHOPE-CHAT and share your referral link.',
        icon: '🎵',
        reward: 0.40,
        category: 'tiktok',
        status: 'active',
        createdAt: Date.now()
    },
    {
        id: 'task_4',
        title: 'Share on Facebook',
        description: 'Share your referral link on Facebook with a personal message.',
        icon: '📘',
        reward: 0.35,
        category: 'facebook',
        status: 'active',
        createdAt: Date.now()
    },
    {
        id: 'task_5',
        title: 'Share on YouTube',
        description: 'Create a YouTube video about NEWHOPE-CHAT and share your referral link.',
        icon: '▶️',
        reward: 0.50,
        category: 'youtube',
        status: 'active',
        createdAt: Date.now()
    },
    {
        id: 'task_6',
        title: 'Share on WhatsApp',
        description: 'Share your referral link with 5 friends on WhatsApp.',
        icon: '📱',
        reward: 0.30,
        category: 'whatsapp',
        status: 'active',
        createdAt: Date.now()
    },
    {
        id: 'task_7',
        title: 'Watch Ads',
        description: 'Watch 5 ads on the platform to earn rewards.',
        icon: '📺',
        reward: 0.25,
        category: 'ads',
        status: 'active',
        createdAt: Date.now()
    },
    {
        id: 'task_8',
        title: 'Refer 3 Friends',
        description: 'Refer 3 friends who complete activation.',
        icon: '👥',
        reward: 1.00,
        category: 'referral',
        status: 'active',
        createdAt: Date.now()
    }
];

// ============================================================
// DAYS OF WEEK
// ============================================================
const DAYS = {
    0: 'Sunday',
    1: 'Monday',
    2: 'Tuesday',
    3: 'Wednesday',
    4: 'Thursday',
    5: 'Friday',
    6: 'Saturday'
};

// ============================================================
// DEFAULT SCHEDULED TASKS
// ============================================================
const DEFAULT_SCHEDULED_TASKS = {
    'Monday': {
        title: 'Watch YouTube Video',
        description: 'Watch the full video to earn your reward.',
        icon: '▶️',
        category: 'youtube',
        reward: 1000,
        isScheduled: true,
        day: 'Monday'
    },
    'Tuesday': {
        title: 'Click & Like Ad',
        description: 'View and like the ad to earn your reward.',
        icon: '👁️',
        category: 'ads',
        reward: 800,
        isScheduled: true,
        day: 'Tuesday'
    },
    'Wednesday': {
        title: 'Share on WhatsApp',
        description: 'Share our page with 5 friends on WhatsApp.',
        icon: '📱',
        category: 'whatsapp',
        reward: 600,
        isScheduled: true,
        day: 'Wednesday'
    },
    'Thursday': {
        title: 'Facebook Post Share',
        description: 'Share our post on your Facebook timeline.',
        icon: '📘',
        category: 'facebook',
        reward: 700,
        isScheduled: true,
        day: 'Thursday'
    },
    'Friday': {
        title: 'TikTok Video Share',
        description: 'Create and share a TikTok video about us.',
        icon: '🎵',
        category: 'tiktok',
        reward: 900,
        isScheduled: true,
        day: 'Friday'
    },
    'Saturday': {
        title: 'Chat Activity',
        description: 'Send 10 messages in the global chat.',
        icon: '💬',
        category: 'chat',
        reward: 500,
        isScheduled: true,
        day: 'Saturday'
    },
    'Sunday': {
        title: 'Weekly Challenge',
        description: 'Complete the weekly challenge tasks.',
        icon: '🏆',
        category: 'challenge',
        reward: 1200,
        isScheduled: true,
        day: 'Sunday'
    }
};

// ============================================================
// TASK OPERATIONS
// ============================================================

/**
 * Initialize default tasks if they don't exist
 */
export async function initializeTasks() {
    try {
        const snapshot = await getDocs(collection(db, 'tasks'));
        if (snapshot.empty) {
            // Add default tasks
            const promises = DEFAULT_TASKS.map(task => 
                setDoc(doc(db, 'tasks', task.id), task)
            );
            await Promise.all(promises);
            console.log('✅ Default tasks initialized');
        }
        
        // Initialize scheduled task settings
        const settingsSnapshot = await getDoc(doc(db, 'settings', 'taskSettings'));
        if (!settingsSnapshot.exists()) {
            const defaultSettings = {};
            for (const [day, task] of Object.entries(DEFAULT_SCHEDULED_TASKS)) {
                defaultSettings[day.toLowerCase()] = {
                    link: '',
                    image: '',
                    active: true,
                    reward: task.reward,
                    title: task.title,
                    description: task.description
                };
            }
            await setDoc(doc(db, 'settings', 'taskSettings'), defaultSettings);
            console.log('✅ Scheduled task settings initialized');
        }
        
        return { success: true };
    } catch (error) {
        console.error('Error initializing tasks:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get all tasks
 */
export async function getAllTasks() {
    try {
        const snapshot = await getDocs(collection(db, 'tasks'));
        if (!snapshot.empty) {
            const tasks = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            return { success: true, data: tasks };
        }
        return { success: true, data: [] };
    } catch (error) {
        console.error('Error getting tasks:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get active tasks
 */
export async function getActiveTasks() {
    const result = await getAllTasks();
    if (result.success) {
        result.data = result.data.filter(task => task.status === 'active');
    }
    return result;
}

/**
 * Get scheduled tasks for today
 */
export function getScheduledTasksForToday() {
    const today = new Date().getDay();
    const dayName = DAYS[today];
    const task = DEFAULT_SCHEDULED_TASKS[dayName];
    
    if (!task) return null;
    
    return {
        ...task,
        id: `scheduled_${dayName.toLowerCase()}`,
        dayKey: dayName.toLowerCase()
    };
}

/**
 * Get all scheduled tasks for the week
 */
export function getAllScheduledTasks() {
    const tasks = [];
    const today = new Date().getDay();
    
    for (let i = 0; i < 7; i++) {
        const dayIndex = (today + i) % 7;
        const dayName = DAYS[dayIndex];
        const task = DEFAULT_SCHEDULED_TASKS[dayName];
        
        if (task) {
            tasks.push({
                ...task,
                id: `scheduled_${dayName.toLowerCase()}`,
                dayKey: dayName.toLowerCase(),
                dayOrder: i,
                isToday: i === 0
            });
        }
    }
    
    return tasks;
}

/**
 * Get task by ID
 */
export async function getTaskById(taskId) {
    try {
        // First check if it's a scheduled task
        if (taskId.startsWith('scheduled_')) {
            const dayKey = taskId.replace('scheduled_', '');
            const dayName = dayKey.charAt(0).toUpperCase() + dayKey.slice(1);
            const task = DEFAULT_SCHEDULED_TASKS[dayName];
            if (task) {
                return { 
                    success: true, 
                    data: {
                        ...task,
                        id: taskId,
                        isScheduled: true,
                        day: dayName
                    }
                };
            }
            return { success: false, data: null };
        }
        
        // Regular task from Firebase
        const snapshot = await getDoc(doc(db, 'tasks', taskId));
        if (snapshot.exists()) {
            return { success: true, data: snapshot.data() };
        }
        return { success: false, data: null };
    } catch (error) {
        console.error('Error getting task by ID:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get user's task progress
 */
export async function getUserTaskProgress(uid) {
    try {
        const q = query(collection(db, 'userTasks'), where('uid', '==', uid));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const tasks = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            return { success: true, data: tasks };
        }
        return { success: true, data: [] };
    } catch (error) {
        console.error('Error getting user task progress:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get user's task progress for a specific task
 */
export async function getUserTask(uid, taskId) {
    try {
        const docId = `${uid}_${taskId}`;
        const snapshot = await getDoc(doc(db, 'userTasks', docId));
        if (snapshot.exists()) {
            return { success: true, data: snapshot.data() };
        }
        return { success: true, data: null };
    } catch (error) {
        console.error('Error getting user task:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Start a task
 */
export async function startTask(uid, taskId) {
    try {
        // Check if task exists
        const taskResult = await getTaskById(taskId);
        if (!taskResult.success || !taskResult.data) {
            return { success: false, error: 'Task not found' };
        }
        
        const task = taskResult.data;
        
        // Check if task is active (for regular tasks)
        if (!task.isScheduled && task.status !== 'active') {
            return { success: false, error: 'Task is not active' };
        }
        
        // Check if user already started this task
        const userTaskResult = await getUserTask(uid, taskId);
        if (userTaskResult.success && userTaskResult.data) {
            const userTask = userTaskResult.data;
            if (userTask.status === 'in-progress') {
                return { success: false, error: 'Task already in progress' };
            }
            if (userTask.status === 'completed') {
                return { success: false, error: 'Task already completed' };
            }
        }
        
        // Start the task
        const docId = `${uid}_${taskId}`;
        await setDoc(doc(db, 'userTasks', docId), {
            uid: uid,
            taskId: taskId,
            taskTitle: task.title,
            taskCategory: task.category || 'general',
            status: 'in-progress',
            startedAt: Date.now(),
            updatedAt: Date.now()
        });
        
        return { success: true };
    } catch (error) {
        console.error('Error starting task:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Complete a task
 */
export async function completeTask(uid, taskId) {
    try {
        // Check if task exists
        const taskResult = await getTaskById(taskId);
        if (!taskResult.success || !taskResult.data) {
            return { success: false, error: 'Task not found' };
        }
        
        const task = taskResult.data;
        const reward = task.reward || 0;
        const category = task.category || 'general';
        
        // Check if user has started this task
        const userTaskResult = await getUserTask(uid, taskId);
        if (!userTaskResult.success || !userTaskResult.data) {
            return { success: false, error: 'Task not started' };
        }
        
        const userTask = userTaskResult.data;
        if (userTask.status === 'completed') {
            return { success: false, error: 'Task already completed' };
        }
        if (userTask.status === 'pending') {
            return { success: false, error: 'Task is pending verification' };
        }
        
        // Get user data
        const userResult = await getUser(uid);
        if (!userResult.success || !userResult.data) {
            return { success: false, error: 'User not found' };
        }
        
        const userData = userResult.data;
        const currency = userData.currency || 'TZS';
        
        // Update user balance
        const currentBalance = userData.balance || 0;
        const currentProfit = userData.totalProfit || 0;
        
        await updateDoc(doc(db, 'users', uid), {
            balance: currentBalance + reward,
            totalProfit: currentProfit + reward
        });
        
        // Update earnings based on category
        const earnings = userData.earnings || {};
        const categoryEarnings = earnings[category] || 0;
        earnings[category] = categoryEarnings + reward;
        
        await updateDoc(doc(db, 'users', uid), {
            earnings: earnings
        });
        
        // Add transaction
        await addTransaction(uid, {
            type: 'task',
            amount: reward,
            currency: currency,
            description: `Task reward: ${task.title}`,
            taskId: taskId,
            category: category
        });
        
        // Update user task status
        const docId = `${uid}_${taskId}`;
        await updateDoc(doc(db, 'userTasks', docId), {
            status: 'completed',
            completedAt: Date.now(),
            updatedAt: Date.now(),
            reward: reward,
            category: category
        });
        
        // Add notification
        const display = toLocalDisplay(reward, currency);
        await addNotification(uid, {
            type: 'earning',
            message: `🎉 Task completed! You earned ${display.formatted} from "${task.title}"`,
            taskId: taskId
        });
        
        return { success: true, reward, task };
    } catch (error) {
        console.error('Error completing task:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Complete a task with verification (admin only)
 */
export async function completeTaskWithVerification(uid, taskId, adminNote = '') {
    try {
        // Check if task exists
        const taskResult = await getTaskById(taskId);
        if (!taskResult.success || !taskResult.data) {
            return { success: false, error: 'Task not found' };
        }
        
        const task = taskResult.data;
        const reward = task.reward || 0;
        const category = task.category || 'general';
        
        // Check if user has started this task
        const userTaskResult = await getUserTask(uid, taskId);
        if (!userTaskResult.success || !userTaskResult.data) {
            return { success: false, error: 'Task not started' };
        }
        
        // Get user data
        const userResult = await getUser(uid);
        if (!userResult.success || !userResult.data) {
            return { success: false, error: 'User not found' };
        }
        
        const userData = userResult.data;
        const currency = userData.currency || 'TZS';
        
        // Update user balance
        const currentBalance = userData.balance || 0;
        const currentProfit = userData.totalProfit || 0;
        
        await updateDoc(doc(db, 'users', uid), {
            balance: currentBalance + reward,
            totalProfit: currentProfit + reward
        });
        
        // Update earnings based on category
        const earnings = userData.earnings || {};
        const categoryEarnings = earnings[category] || 0;
        earnings[category] = categoryEarnings + reward;
        
        await updateDoc(doc(db, 'users', uid), {
            earnings: earnings
        });
        
        // Add transaction
        await addTransaction(uid, {
            type: 'task',
            amount: reward,
            currency: currency,
            description: `Task reward: ${task.title} (verified by admin)`,
            taskId: taskId,
            category: category
        });
        
        // Update user task status
        const docId = `${uid}_${taskId}`;
        await updateDoc(doc(db, 'userTasks', docId), {
            status: 'completed',
            completedAt: Date.now(),
            updatedAt: Date.now(),
            verifiedBy: 'admin',
            adminNote: adminNote,
            reward: reward,
            category: category
        });
        
        // Add notification
        const display = toLocalDisplay(reward, currency);
        await addNotification(uid, {
            type: 'earning',
            message: `🎉 Task verified! You earned ${display.formatted} from "${task.title}"`,
            taskId: taskId
        });
        
        return { success: true, reward, task };
    } catch (error) {
        console.error('Error completing task with verification:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get available tasks for a user
 */
export async function getAvailableTasks(uid) {
    try {
        // Get all active tasks
        const tasksResult = await getActiveTasks();
        if (!tasksResult.success) {
            return { success: false, error: tasksResult.error };
        }
        
        // Get user's completed tasks
        const userTasksResult = await getUserTaskProgress(uid);
        if (!userTasksResult.success) {
            return { success: false, error: userTasksResult.error };
        }
        
        const completedTaskIds = userTasksResult.data
            .filter(ut => ut.status === 'completed' || ut.status === 'in-progress')
            .map(ut => ut.taskId);
        
        // Filter available tasks
        const availableTasks = tasksResult.data.filter(
            task => !completedTaskIds.includes(task.id)
        );
        
        // Add scheduled tasks for today
        const todayTask = getScheduledTasksForToday();
        if (todayTask && !completedTaskIds.includes(`scheduled_${todayTask.dayKey}`)) {
            availableTasks.push({
                ...todayTask,
                id: `scheduled_${todayTask.dayKey}`,
                isScheduled: true,
                status: 'active'
            });
        }
        
        return { success: true, data: availableTasks };
    } catch (error) {
        console.error('Error getting available tasks:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get task statistics for a user
 */
export async function getTaskStats(uid) {
    try {
        const userTasksResult = await getUserTaskProgress(uid);
        if (!userTasksResult.success) {
            return { success: false, error: userTasksResult.error };
        }
        
        const tasks = userTasksResult.data;
        const total = tasks.length;
        const completed = tasks.filter(t => t.status === 'completed').length;
        const inProgress = tasks.filter(t => t.status === 'in-progress').length;
        const pending = tasks.filter(t => t.status === 'pending').length;
        
        // Calculate total rewards earned from tasks
        let totalRewards = 0;
        for (const task of tasks) {
            if (task.status === 'completed') {
                totalRewards += task.reward || 0;
            }
        }
        
        return { 
            success: true, 
            data: {
                total,
                completed,
                inProgress,
                pending,
                totalRewards
            }
        };
    } catch (error) {
        console.error('Error getting task stats:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Listen to user task progress
 */
export function listenToUserTasks(uid, callback) {
    const q = query(collection(db, 'userTasks'), where('uid', '==', uid));
    return onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const tasks = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            callback({ success: true, data: tasks });
        } else {
            callback({ success: true, data: [] });
        }
    });
}

/**
 * Update scheduled task settings (admin)
 */
export async function updateScheduledTaskSettings(dayKey, settings) {
    try {
        const currentRef = doc(db, 'settings', 'taskSettings');
        const currentSettings = (await getDoc(currentRef)).data() || {};
        currentSettings[dayKey] = { ...currentSettings[dayKey], ...settings };
        await setDoc(currentRef, currentSettings);
        return { success: true };
    } catch (error) {
        console.error('Error updating scheduled task settings:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get scheduled task settings (admin)
 */
export async function getScheduledTaskSettings() {
    try {
        const snapshot = await getDoc(doc(db, 'settings', 'taskSettings'));
        if (snapshot.exists()) {
            return { success: true, data: snapshot.data() };
        }
        return { success: true, data: {} };
    } catch (error) {
        console.error('Error getting scheduled task settings:', error);
        return { success: false, error: error.message };
    }
}

// ============================================================
// EXPORT
// ============================================================

export default {
    initializeTasks,
    getAllTasks,
    getActiveTasks,
    getTaskById,
    getUserTaskProgress,
    getUserTask,
    startTask,
    completeTask,
    completeTaskWithVerification,
    getAvailableTasks,
    getTaskStats,
    listenToUserTasks,
    getScheduledTasksForToday,
    getAllScheduledTasks,
    updateScheduledTaskSettings,
    getScheduledTaskSettings
};