import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { formatCurrency } from '../utils/helpers.js';
import { db, doc, setDoc, addDoc, collection, getDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, limit, increment } from '../services/firebase-config.js';
import './css/GlobalChat.css';

const BONUS_THRESHOLD = 10;
const BONUS_TZS = 1000;

// Color palette for sender names (WhatsApp-style)
const SENDER_COLORS = ['#E91E63','#9C27B0','#3F51B5','#009688','#FF5722','#795548','#607D8B','#F44336'];
const senderColor = (uid) => SENDER_COLORS[uid.charCodeAt(0) % SENDER_COLORS.length];

export default function GlobalChat() {
    const { user, userData, refreshUserData } = useAuth();
    const { translate } = useLanguage();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [todayCount, setTodayCount] = useState(0);
    const [onlineCount, setOnlineCount] = useState(0);
    const [bonusClaimed, setBonusClaimed] = useState(false);
    const [sending, setSending] = useState(false);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const currency = userData?.currency || 'TZS';

    useEffect(() => {
        if (!user) return;
        const today = new Date().toISOString().split('T')[0];

        getDoc(doc(db, 'chatCount', `${user.uid}_${today}`)).then(snap => {
            setTodayCount(snap.exists() ? snap.data().count : 0);
        });
        getDoc(doc(db, 'chatBonus', `${user.uid}_${today}`)).then(snap => {
            setBonusClaimed(snap.exists());
        });

        const messagesRef = query(collection(db, 'chatMessages'), orderBy('createdAt', 'desc'), limit(80));
        const msgMap = {};
        const unsubMessages = onSnapshot(messagesRef, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added' || change.type === 'modified') {
                    msgMap[change.doc.id] = { id: change.doc.id, ...change.doc.data() };
                }
                if (change.type === 'removed') delete msgMap[change.doc.id];
            });
            setMessages(Object.values(msgMap).sort((a, b) => a.createdAt - b.createdAt));
        });

        setDoc(doc(db, 'online', user.uid), { username: userData?.username, lastSeen: Date.now() });
        const onlineUnsub = onSnapshot(collection(db, 'online'), snap => setOnlineCount(snap.size));
        const heartbeat = setInterval(() => {
            setDoc(doc(db, 'online', user.uid), { username: userData?.username, lastSeen: Date.now() });
        }, 30000);

        return () => {
            unsubMessages();
            onlineUnsub();
            clearInterval(heartbeat);
            deleteDoc(doc(db, 'online', user.uid));
        };
    }, [user, userData]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = async (e) => {
        e?.preventDefault();
        const trimmed = text.trim();
        if (!trimmed || sending) return;
        setSending(true);

        try {
            await addDoc(collection(db, 'chatMessages'), {
                uid: user.uid,
                username: userData?.username || 'User',
                text: trimmed,
                createdAt: Date.now(),
            });

            const today = new Date().toISOString().split('T')[0];
            const newCount = todayCount + 1;
            await setDoc(doc(db, 'chatCount', `${user.uid}_${today}`), { count: newCount, uid: user.uid });
            setTodayCount(newCount);

            if (newCount >= BONUS_THRESHOLD && !bonusClaimed) {
                const bonusAmt = BONUS_TZS;
                await setDoc(doc(db, 'users', user.uid), {
                    earnings: { chat: increment(bonusAmt) },
                    taskBalances: { chat: increment(bonusAmt) },
                    totalProfit: increment(bonusAmt),
                }, { merge: true });
                await setDoc(doc(db, 'chatBonus', `${user.uid}_${today}`), { claimed: true, uid: user.uid });
                await addDoc(collection(db, 'transactions'), {
                    uid: user.uid,
                    type: 'chat_bonus',
                    description: 'Daily chat bonus (10 messages)',
                    amount: bonusAmt,
                    createdAt: Date.now(),
                });
                setBonusClaimed(true);
                refreshUserData();
                showToast(`🎉 Chat bonus: ${formatCurrency(bonusAmt, currency)}!`, 'success');
            }

            setText('');
            inputRef.current?.focus();
        } catch (err) {
            console.error(err);
            showToast(translate('common.error') || 'Failed to send', 'error');
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const formatTime = (ts) =>
        ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    const formatDate = (ts) => {
        const d = new Date(ts);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        if (d.toDateString() === today.toDateString()) return 'TODAY';
        if (d.toDateString() === yesterday.toDateString()) return 'YESTERDAY';
        return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
    };

    // Group messages by date
    const msgGroups = [];
    let lastDate = null;
    messages.forEach(msg => {
        const d = msg.createdAt ? new Date(msg.createdAt).toDateString() : 'unknown';
        if (d !== lastDate) {
            msgGroups.push({ type: 'date', label: formatDate(msg.createdAt), key: d });
            lastDate = d;
        }
        msgGroups.push({ type: 'msg', ...msg });
    });

    const progressPct = Math.min((todayCount / BONUS_THRESHOLD) * 100, 100);

    return (
        <div className="wachat-root">
            {/* ── Header ── */}
            <div className="wachat-header">
                <button className="wachat-back-btn" onClick={() => navigate(-1)} aria-label="Back">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>
                <div className="wachat-avatar">💬</div>
                <div className="wachat-header-info">
                    <h2>Global Community</h2>
                    <div className="wachat-online">● {onlineCount} online</div>
                </div>
                <div className="wachat-bonus-pill">
                    {bonusClaimed ? '✅ Bonus claimed' : `${todayCount}/${BONUS_THRESHOLD} msgs`}
                </div>
            </div>

            {/* Bonus progress */}
            <div className="wachat-progress-bar">
                <div className="wachat-progress-track">
                    <div className="wachat-progress-fill" style={{ width: `${progressPct}%` }} />
                </div>
            </div>

            {/* ── Messages area ── */}
            <div className="wachat-messages">
                {messages.length === 0 && (
                    <div className="wachat-empty">
                        <span style={{ fontSize: 40 }}>💬</span>
                        <span>No messages yet. Say hello!</span>
                    </div>
                )}
                {msgGroups.map((item, i) => {
                    if (item.type === 'date') {
                        return <div key={item.key} className="wachat-date-chip">{item.label}</div>;
                    }
                    const isOwn = item.uid === user?.uid;
                    return (
                        <div key={item.id || i} className={`wachat-bubble ${isOwn ? 'outgoing' : 'incoming'}`}>
                            {!isOwn && (
                                <div className="wachat-bubble-sender" style={{ color: senderColor(item.uid) }}>
                                    {item.username}
                                </div>
                            )}
                            <div className="wachat-bubble-text">{item.text}</div>
                            <div className="wachat-bubble-meta">
                                <span className="wachat-bubble-time">{formatTime(item.createdAt)}</span>
                                {isOwn && <span className="wachat-ticks">✓✓</span>}
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* ── Input Bar ── */}
            <div className="wachat-input-bar">
                <div className="wachat-input-wrap">
                    <textarea
                        ref={inputRef}
                        className="wachat-input"
                        rows={1}
                        value={text}
                        onChange={e => setText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message…"
                        maxLength={500}
                    />
                </div>
                <button className="wachat-send-btn" type="button" onClick={sendMessage} disabled={!text.trim() || sending}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
