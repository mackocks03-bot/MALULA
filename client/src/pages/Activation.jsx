import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
import PaymentStepper from '../components/PaymentStepper.jsx';
import dataStore from '../utils/dataStore.js';
import { db, doc, onSnapshot, updateDoc, storage } from '../services/firebase-config.js';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getActivationFee } from '../services/settings.js';

export default function Activation() {
    const { user, userData } = useAuth();
    const { translate } = useLanguage();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [fee, setFee] = useState(0);
    const [allPaymentNumbers, setAllPaymentNumbers] = useState({});
    const [paymentNumber, setPaymentNumber] = useState('');
    const [paymentAccountName, setPaymentAccountName] = useState('');
    const [selectedMethod, setSelectedMethod] = useState(null);
    const [transactionId, setTransactionId] = useState('');
    const [paymentPhone, setPaymentPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(userData?.activationStatus || 'pending');
    const [rejectReason, setRejectReason] = useState('');

    // New Redesign States
    const [selectedNetworkDetails, setSelectedNetworkDetails] = useState(null);
    const [showAccountSheet, setShowAccountSheet] = useState(false);
    const [showProofPopup, setShowProofPopup] = useState(false);
    const [proofFile, setProofFile] = useState(null);
    const [proofPreviewUrl, setProofPreviewUrl] = useState('');
    const [useManualTZ, setUseManualTZ] = useState(false);

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

            // Fetch the whole activation settings doc (dataStore only supports collection/document paths)
            const activationDoc = await dataStore.cachedGet('activationSettings', 'settings/activation', { ttl: 2 * 60 * 1000 });
            const numbers = activationDoc?.paymentNumbers || {};
            if (numbers) setAllPaymentNumbers(numbers);
        };
        loadSettings();
    }, [country, countryInfo.currency]);

    // When a network is selected, look up its specific payment number
    useEffect(() => {
        if (!selectedNetworkDetails) return;
        const countryMap = allPaymentNumbers[country];
        if (!countryMap) {
            setPaymentNumber('');
            setPaymentAccountName('');
            return;
        }
        const networkEntry = countryMap[selectedNetworkDetails.id];
        if (networkEntry && typeof networkEntry === 'object') {
            setPaymentNumber(networkEntry.number || '');
            setPaymentAccountName(networkEntry.name || '');
        } else if (typeof networkEntry === 'string') {
            setPaymentNumber(networkEntry);
            setPaymentAccountName('');
        } else {
            setPaymentNumber('');
            setPaymentAccountName('');
        }
    }, [selectedNetworkDetails, allPaymentNumbers, country]);

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
                <div className="auth-card" style={{ maxWidth: 520, position: 'relative', overflow: 'hidden', paddingBottom: '24px' }}>
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
                            {isTanzania && palmpesaEnabled === null && (
                                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                                    <span className="spinner" style={{ display: 'inline-block', width: 24, height: 24, border: '2px solid var(--border-color)', borderTopColor: 'var(--color-gold)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                                </div>
                            )}
                            {isTanzania && palmpesaEnabled !== null && !useManualTZ && (
                                <>
                                    {showPalmpesa ? (
                                <>
                                    <div className="deposit-payment-info" style={{ marginBottom: 16 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <span style={{ fontSize: 24 }}><i className="fas fa-mobile-screen-button" style={{ color: 'var(--color-gold)' }}></i></span>
                                                <div>
                                                    <strong style={{ color: 'var(--color-gold)' }}>PalmPesa</strong>
                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                        {translate('activation.palmpesaHint') || 'Instant activation — M-Pesa, Airtel, Halopesa & more'}
                                                    </div>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => setUseManualTZ(true)}
                                                type="button"
                                                style={{
                                                    background: 'var(--background-secondary)',
                                                    border: '1px solid var(--border-color)',
                                                    color: 'var(--text-primary)',
                                                    borderRadius: '8px',
                                                    padding: '4px 10px',
                                                    fontSize: '11px',
                                                    fontWeight: 'bold',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                USSD
                                            </button>
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

                                        {/* Animated 3-step progress stepper */}
                                        {(palmpesaStatus === 'pushing' || palmpesaStatus === 'waiting' || palmpesaStatus === 'success' || palmpesaStatus === 'failed') && (
                                            <PaymentStepper
                                                status={palmpesaStatus}
                                                message={palmpesaStatus === 'success' ? 'Payment Verified! Activating your account…' : undefined}
                                            />
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
                                    <div style={{ fontSize: 36, marginBottom: 10, color: 'var(--gov-danger)' }}><i className="fas fa-mobile-button"></i> <i className="fas fa-ban" style={{ position: 'absolute', marginLeft: '-28px', color: 'red', opacity: 0.8 }}></i></div>
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
                </>
            )}

            {(!isTanzania || useManualTZ) && (status === 'pending' || status === 'rejected') && (
                        <>
                            {(status === 'pending' && userData?.activationPaymentId) ? (
                                <div style={{ textAlign: 'center', padding: '40px 16px', background: 'var(--background-secondary)', borderRadius: 16, border: '1px solid var(--border-color)', margin: '20px 0' }}>
                                    <div style={{ fontSize: 44, marginBottom: 16, color: 'var(--color-gold)' }}>
                                        <i className="fas fa-hourglass-half"></i>
                                    </div>
                                    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>Verification in Progress</h3>
                                    <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.5 }}>
                                        Your payment proof has been submitted and is currently under review by our administrators. Please be patient.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div style={{ marginBottom: 24 }}>
                                        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <i className="fas fa-wallet" style={{ color: 'var(--color-gold)' }}></i>
                                            {translate('activation.selectNetwork') || 'Select Payment Network'}
                                        </h3>
                                        <div style={{ 
                                            display: 'grid', 
                                            gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', 
                                            gap: 12 
                                        }}>
                                    {methods.map(m => (
                                        <button 
                                            key={m.id}
                                            type="button" 
                                            style={{
                                                background: selectedMethod === m.id ? 'var(--background-secondary)' : 'var(--background-card)',
                                                border: `1.5px solid ${selectedMethod === m.id ? (m.color || 'var(--color-gold)') : 'var(--border-color)'}`,
                                                borderRadius: 16,
                                                padding: '16px 12px',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 8,
                                                cursor: 'pointer',
                                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                transform: selectedMethod === m.id ? 'translateY(-2px)' : 'none',
                                                boxShadow: selectedMethod === m.id ? `0 4px 12px ${(m.color || 'var(--color-gold)')}30` : 'none'
                                            }}
                                            onClick={() => {
                                                setSelectedMethod(m.id);
                                                setSelectedNetworkDetails(m);
                                                setShowAccountSheet(true);
                                            }}
                                        >
                                            {m.image ? (
                                                <img src={m.image} alt={m.name} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'contain' }} />
                                            ) : (
                                                <div style={{ 
                                                    width: 40, 
                                                    height: 40, 
                                                    borderRadius: '50%', 
                                                    background: `${m.color || 'var(--color-gold)'}20`,
                                                    color: m.color || 'var(--color-gold)',
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'center',
                                                    fontSize: 20
                                                }}>
                                                    {m.icon || <i className="fas fa-mobile-screen-button"></i>}
                                                </div>
                                            )}
                                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center' }}>
                                                {m.name}
                                            </span>
                                            {m.ussd && (
                                                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{m.ussd}</span>
                                            )}
                                        </button>
                                    ))}
                                        </div>
                                    </div>
                                    {status === 'pending' && (
                                        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                                            {translate('activation.waiting') || 'Waiting for admin approval...'}
                                        </p>
                                    )}
                                </>
                            )}
                        </>
                    )}

                {/* --- BOTTOM SHEETS (Portal) --- */}
                {createPortal(
                    <>
                        {/* Backdrop */}
                        <div
                            onClick={() => { setShowAccountSheet(false); setShowProofPopup(false); }}
                            style={{
                                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                                background: 'rgba(0,0,0,0.65)',
                                zIndex: 100,
                                opacity: (showAccountSheet || showProofPopup) ? 1 : 0,
                                pointerEvents: (showAccountSheet || showProofPopup) ? 'auto' : 'none',
                                transition: 'opacity 0.35s ease',
                                backdropFilter: 'blur(3px)',
                                WebkitBackdropFilter: 'blur(3px)'
                            }}
                        />

                        {/* Account Details Sheet */}
                        <div style={{
                            position: 'fixed', bottom: 0, left: '50%',
                            transform: `translateX(-50%) ${showAccountSheet ? 'translateY(0)' : 'translateY(100%)'}`,
                            width: '100vw', maxWidth: '100%',
                            background: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
                            padding: '16px 20px', zIndex: 101,
                            transition: 'transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)',
                            boxShadow: '0 -10px 40px rgba(0,0,0,0.15)',
                            pointerEvents: showAccountSheet ? 'auto' : 'none'
                        }} onClick={e => e.stopPropagation()}>
                            <div style={{ width: 40, height: 4, background: 'var(--border-color)', borderRadius: 2, margin: '0 auto 16px auto' }} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                                {selectedNetworkDetails?.image ? (
                                    <img src={selectedNetworkDetails.image} alt={selectedNetworkDetails.name} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'contain' }} />
                                ) : (
                                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${selectedNetworkDetails?.color || 'var(--color-gold)'}20`, color: selectedNetworkDetails?.color || 'var(--color-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                                        {selectedNetworkDetails?.icon || <i className="fas fa-bank"></i>}
                                    </div>
                                )}
                                <div>
                                    <h3 style={{ margin: 0, fontSize: 16 }}>Pay via {selectedNetworkDetails?.name}</h3>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Send exactly the required amount below</div>
                                </div>
                            </div>
                            <div style={{ background: 'var(--background-secondary)', borderRadius: 16, padding: '16px', marginBottom: 16 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                    <div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>Amount to Send</div>
                                        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-gold)' }}>{activationAmountDisplay.formatted}</div>
                                    </div>
                                    <button onClick={() => { navigator.clipboard.writeText(fee.toString()); showToast('Amount copied!', 'success'); }} style={{ background: 'var(--background-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                        <i className="far fa-copy" style={{ fontSize: 14 }}></i>
                                    </button>
                                </div>
                                <div style={{ height: 1, background: 'var(--border-color)', marginBottom: 12 }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>Recipient details</div>
                                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{paymentNumber || 'N/A'}</div>
                                        {paymentAccountName && <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>👤 {paymentAccountName}</div>}
                                    </div>
                                    <button onClick={() => { navigator.clipboard.writeText(paymentNumber); showToast('Number copied!', 'success'); }} style={{ background: 'var(--background-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                        <i className="far fa-copy" style={{ fontSize: 14 }}></i>
                                    </button>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                <button className="btn-outline-auth" style={{ flex: 1, border: '1px solid var(--border-color)', height: 44, fontSize: 14, borderRadius: 12, background: 'var(--background-secondary)', color: 'var(--text-primary)' }} onClick={() => setShowAccountSheet(false)}>
                                    Go Back
                                </button>
                                <button className="btn-primary-auth" style={{ flex: 1, height: 44, fontSize: 14, borderRadius: 12, background: 'linear-gradient(135deg, var(--color-gold), #B8860B)', border: 'none', boxShadow: '0 4px 15px rgba(218,165,32,0.3)', color: 'white', fontWeight: 'bold' }}
                                    onClick={() => { setShowAccountSheet(false); setTimeout(() => setShowProofPopup(true), 350); }}>
                                    I Have Paid
                                </button>
                            </div>
                        </div>

                        {/* Proof Submission Sheet */}
                        <div style={{
                            position: 'fixed', bottom: 0, left: '50%',
                            transform: `translateX(-50%) ${showProofPopup ? 'translateY(0)' : 'translateY(100%)'}`,
                            width: '100vw', maxWidth: '100%',
                            background: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
                            padding: '20px', maxHeight: '85vh', overflowY: 'auto', zIndex: 111,
                            transition: 'transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)',
                            boxShadow: '0 -10px 40px rgba(0,0,0,0.15)',
                            pointerEvents: showProofPopup ? 'auto' : 'none'
                        }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <h3 style={{ margin: 0, fontSize: 16 }}>Submit Payment Proof</h3>
                                <button onClick={() => setShowProofPopup(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer' }}><i className="fas fa-times"></i></button>
                            </div>
                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                if (!selectedMethod || !transactionId.trim() || !proofFile) { showToast('Please provide transaction ID and upload a screenshot.', 'warning'); return; }
                                setLoading(true);
                                try {
                                    let screenshotUrl = '';
                                    if (proofFile) {
                                        const fileName = `activation_proofs/${user.uid}/${Date.now()}_${proofFile.name}`;
                                        const fileRef = ref(storage, fileName);
                                        await uploadBytes(fileRef, proofFile);
                                        screenshotUrl = await getDownloadURL(fileRef);
                                    }
                                    let cleanPhone = paymentPhone.trim();
                                    if (cleanPhone.startsWith('0')) cleanPhone = cleanPhone.substring(1);
                                    const finalPhone = `${countryInfo.phoneCode.replace('+', '')}${cleanPhone}`;
                                    const result = await processActivationPayment(user.uid, { method: selectedMethod, transactionId: transactionId.trim(), amount: fee, currency: countryInfo.currency, phoneNumber: finalPhone, screenshotUrl, countryCode: country });
                                    if (result.success) {
                                        showToast('Payment proof submitted successfully!', 'success');
                                        setStatus('pending'); setShowProofPopup(false); setTransactionId(''); setProofFile(null); setProofPreviewUrl('');
                                    } else { showToast(result.error || 'Submission failed.', 'error'); }
                                } catch { showToast('An error occurred during submission.', 'error'); }
                                setLoading(false);
                            }}>
                                <div className="form-group" style={{ marginBottom: 12 }}>
                                    <label className="form-label" style={{ fontSize: 12 }}>{translate('auth.phone') || 'Your Phone Number'}</label>
                                    <div className="phone-input-group">
                                        <span className="country-code active" style={{ fontSize: 14 }}>{countryInfo.phoneCode}</span>
                                        <input className="form-control" style={{ fontSize: 14 }} value={paymentPhone} onChange={e => setPaymentPhone(e.target.value.replace(/\D/g, ''))} placeholder={countryInfo.digits === 9 ? "7XX XXX XXX" : ""} required disabled={loading} />
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginBottom: 12 }}>
                                    <label className="form-label" style={{ fontSize: 12 }}>{translate('activation.transactionId') || 'Transaction ID / Hash'}</label>
                                    <input className="form-control" style={{ fontSize: 14 }} value={transactionId} onChange={e => setTransactionId(e.target.value)} placeholder="e.g. AB12CD34EF" required disabled={loading} />
                                </div>
                                <div className="form-group" style={{ marginBottom: 24 }}>
                                    <label className="form-label">Payment Screenshot</label>
                                    <div style={{ border: '2px dashed var(--border-color)', borderRadius: 12, padding: proofPreviewUrl ? '8px' : '32px 16px', textAlign: 'center', position: 'relative', cursor: 'pointer', background: 'var(--background-secondary)', transition: 'all 0.2s', overflow: 'hidden' }}>
                                        <input type="file" accept="image/*" disabled={loading} onChange={(e) => {
                                            const file = e.target.files[0];
                                            if (file) {
                                                if (file.size > 5 * 1024 * 1024) { showToast('Image must be less than 5MB', 'warning'); return; }
                                                setProofFile(file); setProofPreviewUrl(URL.createObjectURL(file));
                                            }
                                        }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, cursor: 'pointer', zIndex: 10 }} />
                                        {proofPreviewUrl ? (
                                            <div style={{ position: 'relative' }}>
                                                <img src={proofPreviewUrl} alt="Proof preview" style={{ width: '100%', maxHeight: 180, objectFit: 'contain', borderRadius: 8 }} />
                                                <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.7)', color: 'white', padding: '4px 10px', borderRadius: 20, fontSize: 11, pointerEvents: 'none' }}>Tap to change</div>
                                            </div>
                                        ) : (
                                            <div style={{ color: 'var(--text-muted)' }}>
                                                <i className="fas fa-image" style={{ fontSize: 32, marginBottom: 12, opacity: 0.5 }}></i>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Click to upload screenshot</div>
                                                <div style={{ fontSize: 11, marginTop: 4 }}>JPG, PNG (Max 5MB)</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                    <button type="button" className="btn-outline-auth" style={{ flex: 1, border: '1px solid var(--border-color)', height: 44, fontSize: 14, borderRadius: 12, background: 'var(--background-secondary)', color: 'var(--text-primary)' }}
                                        onClick={() => { setShowProofPopup(false); setTimeout(() => setShowAccountSheet(true), 150); }} disabled={loading}>Go Back</button>
                                    <button type="submit" className="btn-primary-auth" disabled={loading} style={{ flex: 1, height: 44, fontSize: 14, borderRadius: 12, background: 'linear-gradient(135deg, var(--color-gold), #B8860B)', border: 'none', boxShadow: '0 4px 15px rgba(218,165,32,0.3)', color: 'white', fontWeight: 'bold' }}>
                                        {loading ? (<span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><span className="spinner" style={{ width: 14, height: 14, border: '2px solid transparent', borderTopColor: 'currentColor', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />Sending...</span>) : 'Submit Proof'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </>,
                    document.body
                )}
                </div>
            </div>
        </>
    );
}

