import { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../components/DashboardLayout.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { formatCurrency } from '../utils/helpers.js';
import { db, doc, setDoc, addDoc, collection, getDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, limit } from '../services/firebase-config.js';
import dataStore from '../utils/dataStore.js';

const BONUS_THRESHOLD = 10;
const BONUS_TZS = 1000;

export default function GlobalChat() {
    const { user, userData, refreshUserData } = useAuth();
    const { translate } = useLanguage();
    const { showToast } = useToast();
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [todayCount, setTodayCount] = useState(0);
    const [onlineCount, setOnlineCount] = useState(0);
    const [bonusClaimed, setBonusClaimed] = useState(false);
    const messagesEndRef = useRef(null);
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

        const messagesRef = query(collection(db, 'chatMessages'), orderBy('createdAt', 'desc'), limit(50));
        const msgMap = {};

        const unsubMessages = onSnapshot(messagesRef, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    msgMap[change.doc.id] = { id: change.doc.id, ...change.doc.data() };
                }
                if (change.type === 'removed') {
                    delete msgMap[change.doc.id];
                }
            });
            setMessages(Object.values(msgMap).sort((a, b) => a.createdAt - b.createdAt));
        });

        setDoc(doc(db, 'online', user.uid), { username: userData?.username, lastSeen: Date.now() });
        const onlineUnsub = onSnapshot(collection(db, 'online'), (snap) => {
            setOnlineCount(snap.size);
        });

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
        e.preventDefault();
        if (!text.trim()) return;

        try {
            await addDoc(collection(db, 'chatMessages'), {
                uid: user.uid,
                username: userData?.username || 'User',
                text: text.trim(),
                createdAt: Date.now()
            });

            const today = new Date().toISOString().split('T')[0];
            const newCount = todayCount + 1;
            await setDoc(doc(db, 'chatCount', `${user.uid}_${today}`), { count: newCount });
            setTodayCount(newCount);

            // Chat bonus: 10 messages on Wednesday (day 3)
            const isWednesday = new Date().getDay() === 3;
            if (isWednesday && newCount >= BONUS_THRESHOLD && !bonusClaimed) {
                const bonusAmt = BONUS_TZS;

                await updateDoc(doc(db, 'users', user.uid), {
                    'earnings.chat': (userData?.earnings?.chat || 0) + bonusAmt,
                    'taskBalances.chat': (userData?.taskBalances?.chat || 0) + bonusAmt,
                    totalProfit: (userData?.totalProfit || 0) + bonusAmt,
                    balance: (userData?.balance || 0) + bonusAmt
                });
                await setDoc(doc(db, 'chatBonus', `${user.uid}_${today}`), { claimed: true });
                await addDoc(collection(db, 'transactions'), {
                    uid: user.uid,
                    type: 'chat_bonus',
                    description: 'Daily chat bonus (10 messages)',
                    amount: bonusAmt,
                    createdAt: Date.now()
                });
                setBonusClaimed(true);
                refreshUserData();
                showToast(`🎉 Chat bonus: ${formatCurrency(bonusAmt, currency)}!`, 'success');
            }

            setText('');
        } catch {
            showToast(translate('common.error'), 'error');
        }
    };

    const isWednesday = new Date().getDay() === 3;

    return (
        <DashboardLayout>
            <div className="chat-container" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', padding: '0 16px' }}>
                <div className="chat-header" style={{ padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2>{translate('chat.title')}</h2>
                        <span className="online-count" style={{ fontSize: 12, color: 'var(--color-green)' }}>
                            ● {onlineCount} {translate('chat.online') || 'online'}
                        </span>
                    </div>
                    <div className="chat-bonus-indicator" style={{ marginTop: 8 }}>
                        <div className="progress-bar" style={{ height: 4, background: 'var(--border-color)', borderRadius: 4, overflow: 'hidden' }}>
                            <div className="progress-fill" style={{ width: `${Math.min((todayCount / BONUS_THRESHOLD) * 100, 100)}%`, height: '100%', background: 'var(--color-gold)' }} />
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                            {todayCount}/{BONUS_THRESHOLD} {translate('chat.messagesToday') || 'messages today'}
                            {isWednesday ? (bonusClaimed ? ' · ✅ Bonus claimed' : ' · Bonus on Wed') : ' · Bonus on Wednesdays'}
                        </p>
                    </div>
                </div>

                <div className="chat-messages" style={{ flex: 1, overflowY: 'auto', padding: '12px 0', display: 'flex', flexDirection: 'column' }}>
                    {messages.map(msg => (
                        <div key={msg.id} className={`chat-message ${msg.uid === user?.uid ? 'own' : ''}`} style={{
                            marginBottom: 8, padding: '8px 12px', borderRadius: 12,
                            background: msg.uid === user?.uid ? 'var(--color-gold-soft)' : 'var(--bg-card)',
                            alignSelf: msg.uid === user?.uid ? 'flex-end' : 'flex-start',
                            maxWidth: '80%'
                        }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-gold)', marginBottom: 2 }}>{msg.username}</div>
                            <div>{msg.text}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                                {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                <form onSubmit={sendMessage} className="chat-input" style={{ display: 'flex', gap: 8, padding: '12px 0', borderTop: '1px solid var(--border-color)' }}>
                    <input
                        className="form-control"
                        value={text}
                        onChange={e => setText(e.target.value)}
                        placeholder={translate('chat.placeholder') || 'Type a message...'}
                        style={{ flex: 1 }}
                        maxLength={500}
                    />
                    <button type="submit" className="btn btn-primary">{translate('chat.send') || 'Send'}</button>
                </form>
            </div>
        </DashboardLayout>
    );
}
