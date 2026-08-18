import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar.jsx';
import Logo from '../components/Logo.jsx';
import CinematicLoader from '../components/CinematicLoader.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { toLocalDisplay, getCountry } from '../utils/helpers.js';
import { processActivationPayment, getPaymentMethods } from '../services/payments.js';
import {
    getActivationPalmpesaConfig,
    initiatePalmpesaActivation,
    pollPalmpesaActivationStatus
} from '../services/deposits.js';
import dataStore from '../utils/dataStore.js';
import { db, doc, onSnapshot, updateDoc } from '../services/firebase-config.js';
import { getActivationFee } from '../services/settings.js';

export default function Activation() {
    const { user, userData } = useAuth();
    const { translate } = useLanguage();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [fee, setFee] = useState(0);
    const [paymentNumber, setPaymentNumber] = useState('');
    const [selectedMethod, setSelectedMethod] = useState(null);
    const [transactionId, setTransactionId] = useState('');
    const [paymentPhone, setPaymentPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(userData?.activationStatus || 'pending');
    const [rejectReason, setRejectReason] = useState('');

    const [palmpesaEnabled, setPalmpesaEnabled] = useState(null); // null = loading
    const [palmpesaAmountTZS, setPalmpesaAmountTZS] = useState(null);
    const [palmpesaStatus, setPalmpesaStatus] = useState('idle'); // 'idle' | 'pushing' | 'waiting' | 'failed' | 'success'
    const [palmpesaMessage, setPalmpesaMessage] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);
    const successTriggered = useRef(false);
    const pollStopRef = useRef(null);

    const country = userData?.country || 'TZ';
    const countryInfo = getCountry(country);
    const methods = getPaymentMethods(country);
    const isTanzania = country === 'TZ';

    useEffect(() => {
        if (userData?.phone) setPaymentPhone(userData.phone);
    }, [userData]);

    useEffect(() => {
        const loadSettings = async () => {
            const nativeFee = await getActivationFee(countryInfo.currency || 'TZS');
            setFee(nativeFee);
            
            const numbers = await dataStore.cachedGet('paymentNumbers', 'settings/activation/paymentNumbers');
            if (numbers?.[country]) setPaymentNumber(numbers[country]);
        };
        loadSettings();
    }, [country, countryInfo.currency]);

    useEffect(() => {
        if (!isTanzania) return;
        loadPalmpesaConfig();
    }, [isTanzania]);

    const loadPalmpesaConfig = () => {
        setPalmpesaEnabled(null); // show loading while retrying
        getActivationPalmpesaConfig()
            .then(cfg => {
                setPalmpesaEnabled(Boolean(cfg.enabled));
                if (cfg.amountTZS) setPalmpesaAmountTZS(cfg.amountTZS);
            })
            .catch(() => setPalmpesaEnabled(false));
    };

    useEffect(() => {
        if (!user) return;
        const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setStatus(data.activationStatus || 'pending');
                
                // Only consider it activated when isActive is actually true. 
                // This prevents navigation loops when activationStatus is 'approved' 
                // but Context doesn't see isActive=true yet.
                if (data.isActive && !successTriggered.current) {
                    successTriggered.current = true;
                    setIsSuccess(true);
                    
                    showToast(translate('activation.success') || 'Account activated successfully!', 'success');
                    
                    setTimeout(() => {
                        window.location.href = '/dashboard';
                    }, 2500);
                }
            }
        });
        return () => unsub();
    }, [user, showToast, translate]);

    useEffect(() => () => pollStopRef.current?.(), []);

    const queueActivationOnClient = async (paymentId, orderId, meta) => {
        if (!paymentId) return;
        await updateDoc(doc(db, 'activationPayments', paymentId), {
            palmpesaStatus: 'COMPLETED',
            orderId,
            transid: meta.transid || '',
            reference: meta.reference || '',
            channel: 'palmpesa',
            amountTZS: meta.amountTZS || null,
            palmpesaCompletedAt: Date.now()
        });
    };

    const submitPalmpesaActivation = async (e) => {
        e.preventDefault();
        
        let cleanPhone = paymentPhone.trim().replace(/\D/g, '');
        // Strip country code prefix if user pasted it in already (e.g. 255XXXXXXXXX)
        const dialCode = countryInfo.phoneCode.replace('+', '');
        if (cleanPhone.startsWith(dialCode) && cleanPhone.length === dialCode.length + countryInfo.digits) {
            cleanPhone = cleanPhone.substring(dialCode.length);
        }
        // Strip leading zero
        if (cleanPhone.startsWith('0')) cleanPhone = cleanPhone.substring(1);

        if (cleanPhone.length !== countryInfo.digits) {
            showToast(translate('register.invalidPhone') || `Phone must be ${countryInfo.digits} digits (e.g. 7XX XXX XXX)`, 'warning');
            return;
        }

        const finalPhone = `${dialCode}${cleanPhone}`;

        setLoading(true);
        setPalmpesaStatus('pushing');
        setPalmpesaMessage(translate('wallet.palmpesaSending') || 'Sending payment request to your phone…');

        try {
            const init = await initiatePalmpesaActivation({
                phone: finalPhone,
                name: userData?.username || userData?.fullName || 'NEWHOPE User',
                email: user?.email || userData?.email || '',
                country: 'TZ'
            });

            if (init.amount) setPalmpesaAmountTZS(init.amount);

            setPalmpesaStatus('waiting');
            setPalmpesaMessage(
                translate('activation.palmpesaWaiting') ||
                'Enter your mobile money PIN on your phone to activate your account.'
            );

            const { promise, stop } = pollPalmpesaActivationStatus(init.orderId, init.amount, {
                onUpdate: () => {
                    setPalmpesaMessage(
                        translate('activation.palmpesaWaiting') ||
                        'Waiting for payment confirmation…'
                    );
                }
            });
            pollStopRef.current = stop;

            const result = await promise;

            if (result.needsClientQueue && init.paymentId) {
                await queueActivationOnClient(init.paymentId, init.orderId, {
                    transid: result.transid,
                    reference: result.reference,
                    amountTZS: init.amount
                });
            }

            setPalmpesaMessage(
                translate('activation.processingCommissions') ||
                'Payment received! Activating account...'
            );
            // Don't set success here yet; let the RTDB listener do it when isActive becomes true

        } catch (err) {
            setPalmpesaStatus('failed');
            setPalmpesaMessage(err.message || translate('activation.submitFailed'));
            showToast(err.message || translate('common.error'), 'error');
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedMethod || !transactionId.trim()) {
            showToast(translate('activation.fillAll') || translate('activation.enterTransactionId'), 'warning');
            return;
        }
        
        let cleanPhone = paymentPhone.trim();
        if (cleanPhone.startsWith('0')) cleanPhone = cleanPhone.substring(1);
        if (cleanPhone.length !== countryInfo.digits) {
            showToast(translate('register.invalidPhone') || `Phone must be exactly ${countryInfo.digits} digits without leading zero`, 'warning');
            return;
        }

        const finalPhone = `${countryInfo.phoneCode.replace('+', '')}${cleanPhone}`;

        setLoading(true);
        try {
            const result = await processActivationPayment(user.uid, {
                method: selectedMethod,
                transactionId: transactionId.trim(),
                amount: fee,
                currency: countryInfo.currency,
                phoneNumber: finalPhone
            });
            if (result.success) {
                showToast(translate('activation.submitted') || 'Payment submitted!', 'success');
                setStatus('pending');
            } else {
                showToast(result.error || translate('common.error'), 'error');
            }
        } catch {
            showToast(translate('common.error'), 'error');
        }
        setLoading(false);
    };

    const activationAmountDisplay = palmpesaAmountTZS
        ? { formatted: `TSh ${palmpesaAmountTZS.toLocaleString('en-US')}` }
        : { formatted: `${countryInfo.currency} ${Number(fee).toLocaleString('en-US')}` };
        
    const selectedMethodData = methods.find(m => m.id === selectedMethod);
    const showPalmpesa = isTanzania && palmpesaEnabled;
    const globalLoading = loading || palmpesaStatus === 'pushing' || palmpesaStatus === 'waiting' || (isTanzania && palmpesaEnabled === null);

    return (
        <>
            <TopBar />
            <div className="auth-container">
                <div className="auth-card" style={{ maxWidth: 520 }}>
                    <Logo />
                    <h1 className="auth-title">{translate('activation.title') || 'Account Activation'}</h1>
                    <p className="auth-subtitle">{translate('activation.subtitle') || 'Pay the opening fee to activate your account'}</p>

                    <div className="stat-card" style={{ marginBottom: 20, textAlign: 'center' }}>
                        <div className="amount">{activationAmountDisplay.formatted}</div>
                        <div className="label">{translate('dashboard.openingFee')}</div>
                    </div>

                    {isSuccess && (
                        <div style={{
                            padding: '30px 20px', borderRadius: 16, marginBottom: 20,
                            background: 'rgba(16, 185, 129, 0.1)', border: '2px solid rgba(16, 185, 129, 0.4)',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                            animation: 'modalPopIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
                        }}>
                            <div style={{
                                width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #10B981, #059669)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
                                animation: 'pulse 1s var(--transition-base) infinite, bounce 2s var(--transition-base) infinite', boxShadow: '0 0 30px rgba(16, 185, 129, 0.5)',
                                transformOrigin: 'center'
                            }}>
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                            </div>
                            <div style={{ color: '#10B981', fontWeight: 800, fontSize: 22, animation: 'fadeInUp 0.5s ease', marginBottom: 8 }}>
                                Account Activated Successfull!
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: 15, animation: 'fadeInUp 0.7s ease', display: 'flex', alignItems: 'center', gap: 6 }}>
                                Redirecting...
                            </div>
                        </div>
                    )}

                    {!isSuccess && status === 'rejected' && (
                        <div className="alert alert-error visible" style={{ marginBottom: 16 }}>
                            {translate('activation.rejected') || 'Activation rejected.'} {rejectReason}
                        </div>
                    )}

                    {!isSuccess && (status === 'pending' || status === 'rejected') && (
                        <>
                            {isTanzania && palmpesaEnabled !== null && (
                                <>
                                    {showPalmpesa ? (
                                <>
                                    <div className="deposit-payment-info" style={{ marginBottom: 16 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <span style={{ fontSize: 24 }}>📱</span>
                                            <div>
                                                <strong style={{ color: 'var(--color-gold)' }}>PalmPesa</strong>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                    {translate('activation.palmpesaHint') || 'Instant activation — M-Pesa, Airtel, Halopesa & more'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <form onSubmit={submitPalmpesaActivation}>
                                        <div className="form-group">
                                            <label className="form-label">{translate('activation.phoneLabel') || translate('auth.phone')}</label>
                                            <div className="phone-input-group">
                                                <span className="country-code active">{countryInfo.phoneCode}</span>
                                                <input
                                                    className="form-control"
                                                    value={paymentPhone}
                                                    onChange={e => setPaymentPhone(e.target.value.replace(/\D/g, ''))}
                                                    placeholder={countryInfo.digits === 9 ? "7XX XXX XXX" : ""}
                                                    disabled={loading || palmpesaStatus === 'waiting'}
                                                />
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14, marginBottom: 20, marginTop: 4 }}>
                                            <div style={{ background: '#E60000', padding: '4px 6px', borderRadius: 6, display: 'flex', alignItems: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.05)', height: 26, width: 44, justifyContent: 'center' }}>
                                                <svg width="24" height="24" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M20,12 C26,12 28,16 28,20 C28,26 22,28 17,28 C17,28 16,23 20,23 C23,23 23,17 20,17 C16,17 12,23 12,23 C12,17 14,12 20,12 Z" fill="white"/>
                                                    <circle cx="20" cy="18" r="4" fill="white"/>
                                                </svg>
                                            </div>
                                            <div style={{ background: '#0033A0', padding: '4px 6px', borderRadius: 6, display: 'flex', alignItems: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.05)', height: 26, width: 44, justifyContent: 'center' }}>
                                                <svg width="24" height="24" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <text x="20" y="28" fontFamily="sans-serif" fontSize="24" fontWeight="bold" fill="white" textAnchor="middle">tigo</text>
                                                </svg>
                                            </div>
                                            <div style={{ background: '#FF0000', padding: '4px 6px', borderRadius: 6, display: 'flex', alignItems: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.05)', height: 26, width: 44, justifyContent: 'center' }}>
                                                <svg width="28" height="20" viewBox="0 0 60 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M15 35 L 25 10 L 35 10 L 45 35 L 38 35 L 35 25 L 25 25 L 22 35 Z M 28 18 L 32 18 L 30 12 Z" fill="white"/>
                                                </svg>
                                            </div>
                                            <div style={{ background: '#F86704', padding: '4px 6px', borderRadius: 6, display: 'flex', alignItems: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.05)', height: 26, width: 44, justifyContent: 'center' }}>
                                                <svg width="32" height="18" viewBox="0 0 60 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M15 5 L15 25 M30 5 L30 25 M15 15 L30 15" stroke="white" strokeWidth="5" strokeLinecap="round"/>
                                                    <circle cx="45" cy="15" r="8" stroke="white" strokeWidth="4"/>
                                                </svg>
                                            </div>
                                        </div>

                                        {palmpesaStatus === 'failed' && (
                                            <div style={{
                                                padding: 12, borderRadius: 10, marginBottom: 12,
                                                background: 'var(--color-red-bg)', color: 'var(--color-red)', fontSize: 13
                                            }}>
                                                {palmpesaMessage}
                                            </div>
                                        )}

                                        {palmpesaStatus === 'success' && (
                                            <div style={{
                                                padding: '16px 12px', borderRadius: 12, marginBottom: 16,
                                                background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)',
                                                display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'
                                            }}>
                                                <div style={{
                                                    width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #10B981, #059669)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
                                                    animation: 'pulse 1s var(--transition-base) infinite', boxShadow: '0 0 20px rgba(16, 185, 129, 0.2)'
                                                }}>
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'modalPopIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                                                        <polyline points="20 6 9 17 4 12"></polyline>
                                                    </svg>
                                                </div>
                                                <div style={{ color: '#10B981', fontWeight: 600, fontSize: 16, animation: 'fadeInUp 0.5s ease' }}>Payment Verified!</div>
                                                <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4, animation: 'fadeInUp 0.6s ease' }}>Activating account...</div>
                                            </div>
                                        )}

                                        {palmpesaStatus === 'waiting' && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'rgba(212,175,55,0.05)', border: '1px solid var(--color-gold)', borderRadius: 12, marginBottom: 16 }}>
                                                <span className="spinner" style={{ flexShrink: 0, display: 'inline-block', width: 22, height: 22, border: '2.5px solid var(--color-gold)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1.2s linear infinite' }} />
                                                <p style={{ margin: 0, fontSize: 13, color: 'var(--color-gold)', fontWeight: 600, lineHeight: 1.4 }}>
                                                    {translate('activation.palmpesaPrompt') || 'Prompt has been sent to your phone. Please enter pin to complete payment.'}
                                                </p>
                                            </div>
                                        )}

                                        <button
                                            type="submit"
                                            className="btn-primary-auth"
                                            disabled={loading || palmpesaStatus === 'waiting' || palmpesaStatus === 'pushing'}
                                        >
                                            {(loading || palmpesaStatus === 'pushing' || palmpesaStatus === 'waiting') ? (
                                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                                    <span className="spinner" style={{ width: 14, height: 14, border: '2px solid transparent', borderTopColor: 'currentColor', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                                                    {palmpesaStatus === 'pushing' ? 'Sending...' : 'Waiting for PIN...'}
                                                </span>
                                            ) : (
                                                translate('activation.palmpesaPay') || 'Pay & Activate with PalmPesa'
                                            )}
                                        </button>
                                    </form>
                                </>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '24px 16px' }}>
                                    <div style={{ fontSize: 36, marginBottom: 10 }}>📵</div>
                                    <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
                                        Automatic M-Pesa payment is temporarily unavailable.
                                    </p>
                                    <button
                                        onClick={loadPalmpesaConfig}
                                        style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 8,
                                            background: 'transparent',
                                            border: '1.5px solid var(--color-gold)',
                                            color: 'var(--color-gold)',
                                            borderRadius: 99, padding: '8px 20px',
                                            fontSize: 13, fontWeight: 700, cursor: 'pointer'
                                        }}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="23 4 23 10 17 10"/>
                                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                                        </svg>
                                        Retry
                                    </button>
                                </div>
                            )}
                            {palmpesaEnabled !== null && isTanzania && null}
                        </>
                    )}

                    {!isTanzania && (status === 'pending' || status === 'rejected') && (
                        <>
                                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                                        {translate('activation.instructions') || 'Select payment method, pay, then enter transaction ID.'}
                                    </p>
                                    {paymentNumber && (
                                        <div className="stat-card" style={{ marginBottom: 16 }}>
                                            <div className="label">{translate('activation.payTo') || 'Pay To'}</div>
                                            <div className="amount" style={{ fontSize: 18 }}>{paymentNumber}</div>
                                        </div>
                                    )}
                                    <div className="payment-methods" style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
                                        {methods.map(m => (
                                            <button key={m.id} type="button" className={`btn ${selectedMethod === m.id ? 'btn-primary' : 'btn-outline'}`} onClick={() => setSelectedMethod(m.id)}>
                                                {m.icon} {m.name} {m.ussd && <span style={{ fontSize: 11, opacity: 0.7 }}>({m.ussd})</span>}
                                            </button>
                                        ))}
                                    </div>
                                    {selectedMethodData?.ussd && (
                                        <p style={{ fontSize: 12, color: 'var(--color-gold)', marginBottom: 12, textAlign: 'center' }}>
                                            Dial: <strong>{selectedMethodData.ussd}</strong>
                                        </p>
                                    )}
                                    <form onSubmit={handleSubmit}>
                                        <div className="form-group">
                                            <label className="form-label">{translate('auth.phone')}</label>
                                            <div className="phone-input-group">
                                                <span className="country-code active">{countryInfo.phoneCode}</span>
                                                <input 
                                                    className="form-control" 
                                                    value={paymentPhone} 
                                                    onChange={e => setPaymentPhone(e.target.value.replace(/\D/g, ''))} 
                                                    placeholder={countryInfo.digits === 9 ? "7XX XXX XXX" : ""}
                                                    required 
                                                />
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">{translate('activation.transactionId') || 'Transaction ID'}</label>
                                            <input className="form-control" value={transactionId} onChange={e => setTransactionId(e.target.value)} placeholder="Enter transaction ID" required />
                                        </div>
                                        <button type="submit" className="btn-primary-auth" disabled={loading}>
                                            {loading ? (
                                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                                    <span className="spinner" style={{ width: 14, height: 14, border: '2px solid transparent', borderTopColor: 'currentColor', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                                                    {translate('app.processing') || 'Processing...'}
                                                </span>
                                            ) : (
                                                translate('activation.confirm') || 'Confirm Payment'
                                            )}
                                        </button>
                                    </form>
                                    {status === 'pending' && (
                                        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                                            {translate('activation.waiting') || 'Waiting for admin approval...'}
                                        </p>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>

        </>
    );
}
