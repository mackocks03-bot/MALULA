import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { formatCurrency } from '../utils/helpers.js';
import { getAllScheduledTasks, getScheduledTaskSettings, startTask } from '../services/tasks.js';
import { db, doc, setDoc, updateDoc, addDoc, collection, onSnapshot } from '../services/firebase-config.js';

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const FALLBACK_DAY_TASKS = {
    monday:    { icon: '📺', title: 'YouTube Watch & Earn',  category: 'youtube',   rewardPerItem: 0.08, totalItems: 10, isVideo: true },
    tuesday:   { icon: '📘', title: 'Facebook Watch & Earn', category: 'facebook',  rewardPerItem: 0.08, totalItems: 10, isVideo: true },
    wednesday: { icon: '💬', title: 'WhatsApp Status Task',  category: 'whatsapp',  rewardPerItem: 0.16, totalItems: 5,  isWhatsapp: true },
    thursday:  { icon: '📢', title: 'Ad Posting Task',       category: 'ads',       rewardPerItem: 0.08, totalItems: 10 },
    friday:    { icon: '🎵', title: 'TikTok Watch & Earn',   category: 'tiktok',    rewardPerItem: 0.08, totalItems: 10, isVideo: true },
    saturday:  { icon: '💭', title: 'Chat & Earn',           category: 'chat',      rewardPerItem: 0.08, totalItems: 10, link: '/chat' },
    sunday:    { icon: '🏆', title: 'Weekly Challenge',       category: 'challenge', rewardPerItem: 0,    totalItems: 1,  link: '/challenge' },
};

const CATEGORY_ICONS = { youtube: '📺', facebook: '📘', whatsapp: '💬', ads: '📢', tiktok: '🎵', chat: '💭', challenge: '🏆' };

export default function Tasks() {
    const { user, userData } = useAuth();
    const { translate } = useLanguage();
    const { showToast } = useToast();
    const [taskProgress, setTaskProgress] = useState({});
    const [completing, setCompleting] = useState(false);
    const [watching, setWatching] = useState(false);
    const [watchSeconds, setWatchSeconds] = useState(0);
    const [adminSettings, setAdminSettings] = useState({});

    const todayKey = DAY_KEYS[new Date().getDay()];
    const todayFallback = FALLBACK_DAY_TASKS[todayKey] || {};
    const adminCfg = adminSettings[todayKey] || {};

    // Merge: admin config overrides fallback, but preserve flags based on category
    const cat = adminCfg.category || todayFallback.category;
    const todayTask = {
        ...todayFallback,
        ...adminCfg,
        icon: CATEGORY_ICONS[cat] || todayFallback.icon || '📋',
        isVideo: ['youtube', 'facebook', 'tiktok'].includes(cat),
        isWhatsapp: cat === 'whatsapp',
        link: cat === 'chat' ? '/chat' : cat === 'challenge' ? '/challenge' : adminCfg.link || todayFallback.link,
    };

    const currency = userData?.currency || 'TZS';
    const taskKey = `task_${todayKey}_${new Date().toISOString().split('T')[0]}`;
    const scheduledId = `scheduled_${todayKey}`;

    useEffect(() => {
        getScheduledTaskSettings().then(r => {
            if (r.success && r.data) setAdminSettings(r.data);
        });
        if (user) startTask(user.uid, scheduledId).catch(() => {});
    }, [user, scheduledId]);

    useEffect(() => {
        if (!user) return;
        const unsub = onSnapshot(doc(db, 'userTasks', `${user.uid}_${taskKey}`), (snap) => {
            setTaskProgress(snap.exists() ? snap.data() : { completed: 0, status: 'in-progress' });
        });
        return () => unsub();
    }, [user, taskKey]);

    useEffect(() => {
        if (!watching) return;
        const timer = setInterval(() => setWatchSeconds(s => s + 1), 1000);
        return () => clearInterval(timer);
    }, [watching]);

    const completed = taskProgress.completed || 0;
    const total = todayTask?.totalItems || 1;
    const progress = Math.min((completed / total) * 100, 100);
    const isDone = taskProgress.status === 'completed' || completed >= total;

    const creditReward = async (rewardUSD) => {
        const cat = todayTask.category;
        const taskBalances = { ...(userData?.taskBalances || {}) };
        taskBalances[cat] = (taskBalances[cat] || 0) + rewardUSD;
        await updateDoc(doc(db, 'users', user.uid), {
            taskBalances,
            balance: (userData?.balance || 0) + rewardUSD,
            totalProfit: (userData?.totalProfit || 0) + rewardUSD,
            [`earnings.${cat}`]: (userData?.earnings?.[cat] || 0) + rewardUSD
        });
        await addDoc(collection(db, 'transactions'), {
            uid: user.uid,
            type: 'task_reward',
            category: cat,
            amount: rewardUSD,
            description: todayTask.title,
            createdAt: Date.now()
        });
    };

    const completeItem = async () => {
        if (todayTask.link || isDone) return;
        setCompleting(true);
        try {
            const newCompleted = completed + 1;
            const updates = { ...taskProgress, completed: newCompleted, lastUpdated: Date.now(), status: 'in-progress' };

            if (newCompleted >= total) {
                updates.status = 'completed';
                updates.completedAt = Date.now();
                const totalReward = todayTask.rewardPerItem * total;
                await creditReward(totalReward);
                showToast(`✅ ${translate('tasks.completed') || 'Task complete!'} +${formatCurrency(totalReward, currency)}`, 'success');
            } else {
                showToast(`+1 ${translate('tasks.progress') || 'progress'} (${newCompleted}/${total})`, 'info');
            }

            await setDoc(doc(db, 'userTasks', `${user.uid}_${taskKey}`), { uid: user.uid, ...updates });
        } catch {
            showToast(translate('common.error'), 'error');
        }
        setCompleting(false);
    };

    const startVideoWatch = () => {
        if (watching) return;
        setWatching(true);
        setWatchSeconds(0);
    };

    const finishVideoWatch = async () => {
        if (watchSeconds < 15) {
            showToast(translate('tasks.watchMore') || 'Watch for at least 15 seconds', 'warning');
            return;
        }
        setWatching(false);
        await completeItem();
    };

    const weekTasks = getAllScheduledTasks();

    return (
        <DashboardLayout>
            <div className="dashboard-container">
                <div className="dashboard-content">
                    <h2 className="page-title">{translate('tasks.title')}</h2>

                    <div className="task-card animate-in">
                        <div className="task-header">
                            <span className="task-icon">{todayTask?.icon}</span>
                            <div>
                                <h3>{todayTask?.title}</h3>
                                <p className="task-reward">{formatCurrency(todayTask?.rewardPerItem * todayTask?.totalItems || 0, currency)} {translate('tasks.reward') || 'reward'}</p>
                            </div>
                        </div>

                        <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${progress}%` }} />
                        </div>
                        <p className="progress-text">{completed}/{total} {translate('tasks.completed') || 'completed'}</p>

                        {todayTask?.link ? (
                            <Link to={todayTask.link} className="btn btn-primary btn-block">{translate('tasks.goToTask') || 'Go to Task'}</Link>
                        ) : todayTask?.isVideo ? (
                            <div className="video-container">
                                {!watching ? (
                                    <button type="button" className="btn btn-primary btn-block watch-video-btn" onClick={startVideoWatch} disabled={isDone}>
                                        {translate('tasks.watchVideo') || 'Watch Video'}
                                    </button>
                                ) : (
                                    <>
                                        <div style={{ background: '#000', borderRadius: 12, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, color: '#fff' }}>
                                            ▶ {watchSeconds}s / 15s
                                        </div>
                                        <button type="button" className="btn btn-primary btn-block" onClick={finishVideoWatch} disabled={watchSeconds < 15}>
                                            {translate('tasks.claimReward') || 'Claim Reward'}
                                        </button>
                                    </>
                                )}
                            </div>
                        ) : todayTask?.isWhatsapp ? (
                            <div>
                                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                                    {translate('tasks.whatsappHint') || 'Download images, post on WhatsApp status for 2 hours, then confirm.'}
                                </p>
                                <button type="button" className="btn btn-outline btn-block" style={{ marginBottom: 8 }} onClick={() => showToast(translate('tasks.imagesDownloaded') || 'Images ready', 'info')}>
                                    {translate('tasks.downloadImages') || 'Download Images'}
                                </button>
                                <button type="button" className="btn btn-primary btn-block" onClick={completeItem} disabled={completing || isDone}>
                                    {isDone ? translate('tasks.completed') : 'NIMEPOST'}
                                </button>
                            </div>
                        ) : (
                            <button type="button" className="btn btn-primary btn-block" onClick={completeItem} disabled={completing || isDone}>
                                {isDone ? translate('tasks.completed') : translate('tasks.complete') || 'Complete Item'}
                            </button>
                        )}
                    </div>

                    <div className="section-title">{translate('tasks.weeklySchedule') || 'Weekly Schedule'}</div>
                    {DAY_KEYS.slice(1).concat(DAY_KEYS.slice(0, 1)).map((dayKey, i) => {
                        const fallback = FALLBACK_DAY_TASKS[dayKey] || {};
                        const admCfg = adminSettings[dayKey] || {};
                        const merged = { ...fallback, ...admCfg };
                        const dayCat = merged.category;
                        const dayIcon = CATEGORY_ICONS[dayCat] || fallback.icon || '📋';
                        const rewardUSD = (merged.rewardPerItem || 0) * (merged.totalItems || 1);
                        const isToday = dayKey === todayKey;
                        const isOff = merged.active === false;
                        return (
                            <div key={dayKey} className="earning-item" style={{ opacity: isOff ? 0.4 : isToday ? 1 : 0.65 }}>
                                <div className="left">
                                    <span style={{ fontWeight: isToday ? 700 : 400 }}>
                                        {dayIcon} {merged.title || fallback.title}
                                        {isToday && <span style={{ marginLeft: 6, background: 'var(--color-gold)', color: '#000', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 8 }}>TODAY</span>}
                                        {isOff && <span style={{ marginLeft: 6, color: '#aaa', fontSize: 10 }}>OFF</span>}
                                    </span>
                                </div>
                                <span className="value" style={{ color: isToday ? 'var(--color-green)' : undefined }}>
                                    {isOff ? '—' : formatCurrency(rewardUSD, currency)}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </DashboardLayout>
    );
}
