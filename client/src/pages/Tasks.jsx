import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { formatCurrency, CURRENCY_SYMBOLS } from '../utils/helpers.js';
import { getScheduledTaskSettings, startTask } from '../services/tasks.js';
import { db, doc, setDoc, onSnapshot } from '../services/firebase-config.js';

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// SVG Icon library — no emojis
const TaskIcon = ({ cat, size = 22 }) => {
    const paths = {
        youtube:   'M22.54 6.42a2.78 2.78 0 00-1.95-1.97C18.88 4 12 4 12 4s-6.88 0-8.59.45A2.78 2.78 0 001.46 6.42 29 29 0 001 12a29 29 0 00.46 5.58A2.78 2.78 0 003.41 19c1.71.45 8.59.45 8.59.45s6.88 0 8.59-.45a2.78 2.78 0 001.95-1.97A29 29 0 0023 12a29 29 0 00-.46-5.58zM9.75 15.02V8.98L15.5 12l-5.75 3.02z',
        facebook:  'M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z',
        whatsapp:  'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z M12 24a12 12 0 100-24 12 12 0 000 24zm0-22a10 10 0 110 20A10 10 0 0112 2z',
        ads:       'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z',
        tiktok:    'M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.28 6.28 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V9.17a8.24 8.24 0 004.85 1.56V7.3a4.85 4.85 0 01-1.08-.61z',
        chat:      'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
        challenge: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
        default:   'M9 11l3 3L22 4 M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
    };
    const d = paths[cat] || paths.default;
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d={d} />
        </svg>
    );
};

const FALLBACK_DAY_TASKS = {
    monday:    { title: 'YouTube Watch & Earn',  category: 'youtube',   totalItems: 10, isVideo: true,     countryRewards: { TZS: 1000, KES: 50, UGX: 3000, MWK: 800, ZMW: 10, RWF: 500, BIF: 1000, CDF: 1000 } },
    tuesday:   { title: 'Facebook Watch & Earn', category: 'facebook',  totalItems: 10, isVideo: true,     countryRewards: { TZS: 1000, KES: 50, UGX: 3000, MWK: 800, ZMW: 10, RWF: 500, BIF: 1000, CDF: 1000 } },
    wednesday: { title: 'WhatsApp Status Task',  category: 'whatsapp',  totalItems: 5,  isWhatsapp: true,  countryRewards: { TZS: 2000, KES: 100, UGX: 6000, MWK: 1600, ZMW: 20, RWF: 1000, BIF: 2000, CDF: 2000 } },
    thursday:  { title: 'Ad Posting Task',       category: 'ads',       totalItems: 10,                    countryRewards: { TZS: 1000, KES: 50, UGX: 3000, MWK: 800, ZMW: 10, RWF: 500, BIF: 1000, CDF: 1000 } },
    friday:    { title: 'TikTok Watch & Earn',   category: 'tiktok',    totalItems: 10, isVideo: true,     countryRewards: { TZS: 1000, KES: 50, UGX: 3000, MWK: 800, ZMW: 10, RWF: 500, BIF: 1000, CDF: 1000 } },
    saturday:  { title: 'Chat & Earn',           category: 'chat',      totalItems: 10,                    countryRewards: { TZS: 1000, KES: 50, UGX: 3000, MWK: 800, ZMW: 10, RWF: 500, BIF: 1000, CDF: 1000 }, link: '/chat' },
    sunday:    { title: 'Weekly Challenge',       category: 'challenge', totalItems: 1,                     countryRewards: { TZS: 5000, KES: 250, UGX: 15000, MWK: 4000, ZMW: 50, RWF: 2500, BIF: 5000, CDF: 5000 }, link: '/challenge' },
};

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

    const cat = adminCfg.category || todayFallback.category;
    const todayTask = {
        ...todayFallback,
        ...adminCfg,
        countryRewards: { ...(todayFallback.countryRewards || {}), ...(adminCfg.countryRewards || {}) },
        isVideo: ['youtube', 'facebook', 'tiktok'].includes(cat),
        isWhatsapp: cat === 'whatsapp',
        link: cat === 'chat' ? '/chat' : cat === 'challenge' ? '/challenge' : adminCfg.link || todayFallback.link,
    };

    const currency = userData?.currency || 'TZS';
    const taskReward = todayTask.countryRewards?.[currency] ?? todayTask.countryRewards?.TZS ?? 0;
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

    const completed = taskProgress.completed || 0;
    const total = todayTask?.totalItems || 1;
    const progress = Math.min((completed / total) * 100, 100);
    const isDone = taskProgress.status === 'completed' || taskProgress.status === 'pending_verification' || completed >= total;

    useEffect(() => {
        if (!watching || isDone) return;
        if (watchSeconds >= 15) {
            setWatching(false);
            completeItem();
            return;
        }
        const timer = setInterval(() => setWatchSeconds(s => s + 1), 1000);
        return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [watching, watchSeconds, isDone]);

    const completeItem = async () => {
        if (todayTask.link || isDone) return;
        setCompleting(true);
        try {
            const newCompleted = completed + 1;
            const updates = { ...taskProgress, completed: newCompleted, lastUpdated: Date.now(), status: 'in-progress' };

            if (newCompleted >= total) {
                updates.status = 'pending_verification';
                updates.reward = taskReward;
                updates.rewardCurrency = currency;
                updates.category = todayTask.category;
                updates.taskTitle = todayTask.title;
                updates.taskId = taskKey;
                showToast(translate('tasks.completed') || 'Task submitted! Your reward is being processed.', 'success');
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
        if (watching || isDone) return;
        setWatching(true);
        setWatchSeconds(0);
    };

    // Build the video embed URL from admin-uploaded videoUrl
    const getEmbedUrl = (url) => {
        if (!url) return null;
        try {
            if (url.includes('youtube.com/watch')) {
                const u = new URL(url);
                return `https://www.youtube.com/embed/${u.searchParams.get('v')}?autoplay=1&controls=0&rel=0`;
            }
            if (url.includes('youtu.be/')) {
                const id = url.split('youtu.be/')[1].split('?')[0];
                return `https://www.youtube.com/embed/${id}?autoplay=1&controls=0&rel=0`;
            }
            if (url.includes('tiktok.com')) return null; // TikTok embeds don't support iframe well
            if (url.includes('facebook.com/')) {
                return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&autoplay=true`;
            }
        } catch {}
        return null;
    };

    const embedUrl = getEmbedUrl(todayTask.videoUrl);

    // Currency symbol helper
    const currSym = CURRENCY_SYMBOLS[currency] || currency;

    return (
        <DashboardLayout>
            <div className="dashboard-container">
                <div className="dashboard-content">
                    <h2 className="page-title">{translate('tasks.title')}</h2>

                    <div className="task-card animate-in">
                        <div className="task-header">
                            <span className="task-icon" style={{ color: 'var(--color-gold)' }}>
                                <TaskIcon cat={cat} size={28} />
                            </span>
                            <div>
                                <h3>{todayTask?.title}</h3>
                                <p className="task-reward">
                                    {currSym} {taskReward.toLocaleString()} {translate('tasks.reward') || 'reward'}
                                </p>
                                {todayTask.description && (
                                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{todayTask.description}</p>
                                )}
                            </div>
                        </div>

                        <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${progress}%` }} />
                        </div>
                        <p className="progress-text">{completed}/{total} {translate('tasks.completed') || 'completed'}</p>

                        {isDone && taskProgress.status === 'pending_verification' && (
                            <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(212,175,55,0.1)', border: '1px solid var(--border-hover)', color: 'var(--color-gold)', fontSize: 13, fontWeight: 600, marginBottom: 8, textAlign: 'center' }}>
                                ✓ Task submitted — reward processing...
                            </div>
                        )}

                        {isDone && taskProgress.status === 'completed' && (
                            <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(34,197,94,0.1)', border: '1px solid #16a34a', color: '#16a34a', fontSize: 13, fontWeight: 600, marginBottom: 8, textAlign: 'center' }}>
                                ✓ Completed! {currSym} {taskReward.toLocaleString()} credited to your account.
                            </div>
                        )}

                        {!isDone && (
                            <>
                                {todayTask?.link ? (
                                    todayTask.link.startsWith('http') ? (
                                        <a href={todayTask.link} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-block">
                                            {translate('tasks.goToTask') || 'Go to Task'}
                                        </a>
                                    ) : (
                                        <Link to={todayTask.link} className="btn btn-primary btn-block">
                                            {translate('tasks.goToTask') || 'Go to Task'}
                                        </Link>
                                    )
                                ) : todayTask?.isVideo ? (
                                    <div className="video-container">
                                        {!watching ? (
                                            <button type="button" className="btn btn-primary btn-block watch-video-btn" onClick={startVideoWatch}>
                                                <TaskIcon cat={cat} size={16} />
                                                &nbsp;{translate('tasks.watchVideo') || 'Watch Video Now'}
                                            </button>
                                        ) : (
                                            <>
                                                {embedUrl ? (
                                                    <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', marginBottom: 12, background: '#000', paddingTop: '56.25%' }}>
                                                        <iframe
                                                            src={embedUrl}
                                                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
                                                            allow="autoplay; encrypted-media"
                                                            allowFullScreen
                                                            title="Task Video"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div style={{ background: '#111', borderRadius: 12, height: 180, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                                                        <TaskIcon cat={cat} size={36} />
                                                        <div style={{ color: '#fff', marginTop: 8, fontSize: 14 }}>Watching... {watchSeconds}s / 15s</div>
                                                    </div>
                                                )}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'var(--color-gold-soft)', border: '1px solid var(--border-hover)', marginBottom: 8 }}>
                                                    <span className="spinner" style={{ width: 14, height: 14, border: '2px solid rgba(212,175,55,0.2)', borderTopColor: 'var(--color-gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                                                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                                        {watchSeconds < 15
                                                            ? `Watching... ${15 - watchSeconds}s remaining`
                                                            : 'Processing reward…'
                                                        }
                                                    </span>
                                                </div>
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
                                        <button type="button" className="btn btn-primary btn-block" onClick={completeItem} disabled={completing}>
                                            NIMEPOST
                                        </button>
                                    </div>
                                ) : (
                                    <button type="button" className="btn btn-primary btn-block" onClick={completeItem} disabled={completing}>
                                        {translate('tasks.complete') || 'Complete Item'}
                                    </button>
                                )}
                            </>
                        )}
                    </div>

                    {/* ── Weekly Schedule ── */}
                    <div className="section-title">{translate('tasks.weeklySchedule') || 'Weekly Schedule'}</div>
                    {DAY_KEYS.slice(1).concat(DAY_KEYS.slice(0, 1)).map((dayKey) => {
                        const fallback = FALLBACK_DAY_TASKS[dayKey] || {};
                        const admCfg = adminSettings[dayKey] || {};
                        const merged = {
                            ...fallback,
                            ...admCfg,
                            countryRewards: { ...(fallback.countryRewards || {}), ...(admCfg.countryRewards || {}) }
                        };
                        const dayCat = merged.category;
                        const localReward = merged.countryRewards?.[currency] ?? merged.countryRewards?.TZS ?? 0;
                        const isToday = dayKey === todayKey;
                        const isOff = merged.active === false;
                        return (
                            <div key={dayKey} className="earning-item" style={{ opacity: isOff ? 0.4 : isToday ? 1 : 0.65 }}>
                                <div className="left" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{ color: isToday ? 'var(--color-gold)' : 'var(--text-muted)', flexShrink: 0 }}>
                                        <TaskIcon cat={dayCat} size={18} />
                                    </span>
                                    <span style={{ fontWeight: isToday ? 700 : 400 }}>
                                        {merged.title || fallback.title}
                                        {isToday && <span style={{ marginLeft: 6, background: 'var(--color-gold)', color: '#000', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 8 }}>TODAY</span>}
                                        {isOff && <span style={{ marginLeft: 6, color: '#aaa', fontSize: 10 }}>OFF</span>}
                                    </span>
                                </div>
                                <span className="value" style={{ color: isToday ? 'var(--color-green)' : undefined }}>
                                    {isOff ? '—' : `${currSym} ${localReward.toLocaleString()}`}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </DashboardLayout>
    );
}
