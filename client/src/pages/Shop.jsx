import { useState, useEffect, useRef } from 'react';
import './css/KycScan.css';
import DashboardLayout from '../components/DashboardLayout.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { formatCurrency } from '../utils/helpers.js';
import { ConfirmModal } from '../components/Modals.jsx';
import {
    db, doc, getDoc, getDocs, addDoc, updateDoc, setDoc, deleteDoc,
    collection, query, where, orderBy, onSnapshot
} from '../services/firebase-config.js';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import DeliveryTracker from '../components/DeliveryTracker.jsx';
import ViewTrackingMap from '../components/ViewTrackingMap.jsx';

// ─── Firestore Paths ─────────────────────────────────────────────────────────
// sellerProducts/{sellerUid}/{productId}  → stored as flat sub-collection
// businessVerification/{uid}
// orders/{orderId}
// notifications/{uid}/{notifId}
// ─────────────────────────────────────────────────────────────────────────────

const MAX_DAILY_POSTS = 5;
const CATEGORIES = ['all', 'clothes', 'bundles', 'furniture', 'electronics', 'cars'];
const CAT_ICONS = {
    all: '🛍️', clothes: '👕', bundles: '📶',
    furniture: '🛋️', electronics: '💻', cars: '🚗',
};

const VerifiedBadge = ({ size = 16, style = {} }) => (
    <svg viewBox="0 0 24 24" aria-label="Verified" role="img" style={{ height: size, width: size, verticalAlign: 'text-bottom', color: '#1d9bf0', ...style }}>
        <g><path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.918-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.337 2.25c-.416-.165-.866-.25-1.336-.25-2.21 0-3.918 1.79-3.918 4 0 .495.084.965.238 1.4-1.273.65-2.148 2.02-2.148 3.6 0 1.46.74 2.76 1.834 3.45C3.157 16.29 3 16.78 3 17.3c0 2.21 1.71 4 3.918 4 .58 0 1.14-.15 1.635-.42C9.07 22.4 10.45 23.3 12 23.3s2.93-.9 3.447-2.42c.496.27 1.055.42 1.635.42 2.21 0 3.918-1.79 3.918-4 0-.52-.157-1.01-.334-1.45C21.76 15.26 22.5 13.96 22.5 12.5zm-12.75 3.32L5.875 11.9l1.45-1.45 2.425 2.41 5.925-5.91 1.45 1.45-7.375 7.42z" fill="currentColor"></path></g>
    </svg>
);

// ─── Business Verification Modal ─────────────────────────────────────────────
function VerifyModal({ userData, onClose, onSuccess }) {
    const [form, setForm] = useState({
        fullName: userData?.fullName || '',
        phone: userData?.phone || '',
        businessName: '',
        businessType: '',
        businessDesc: '',
        idType: '',
        idNumber: '',
        region: '',
        idFrontB64: null,
        idBackB64: null
    });
    
    const [scanning, setScanning] = useState(false);
    const [scanText, setScanText] = useState('INITIALIZING SECURE UPLINK...');
    const [scanProgress, setScanProgress] = useState(0);

    const frontRef = useRef();
    const backRef = useRef();
    const { showToast } = useToast();
    const { user } = useAuth();

    const handleImageChange = (e, field) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setForm(f => ({ ...f, [field]: reader.result }));
        reader.readAsDataURL(file);
    };

    const submit = async (e) => {
        e.preventDefault();
        if (!form.fullName || !form.phone || !form.businessName || !form.businessType) {
            showToast('Please fill all business details', 'error'); return;
        }
        if (!form.idType || !form.idNumber || !form.region || !form.idFrontB64 || !form.idBackB64) {
            showToast('All KYC documents and ID fields are strictly required', 'error'); return;
        }

        // ── Require location access before proceeding ──────────────────────
        let gpsLocation = null;
        try {
            if (!navigator.geolocation) throw new Error('no_geo');
            const pos = await new Promise((res, rej) =>
                navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000, enableHighAccuracy: true })
            );
            gpsLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        } catch {
            showToast('📍 Location access is required for KYC verification. Please allow location and try again.', 'error');
            return;
        }

        // Trigger AI Simulation
        setScanning(true);
        setScanProgress(0);

        let progress = 0;
        const steps = [
            "EXTRACTING BIOMETRIC MARKERS...",
            "VERIFYING GOVERNMENT REGISTRY...",
            "ANALYZING DOCUMENT HOLOGRAPHY...",
            "CRYPTOGRAPHIC HASH GENERATED.",
            "FINALIZING CLEARANCE..."
        ];

        const interval = setInterval(() => {
            progress += (Math.random() * 15) + 5;
            if (progress >= 95) progress = 95;
            setScanProgress(progress);
            
            const stepIndex = Math.min(Math.floor(progress / 20), steps.length - 1);
            setScanText(steps[stepIndex]);
        }, 400);

        // Perform actual background upload in parallel
        try {
            await import('../services/firebase-config.js').then(({ db, doc, setDoc }) =>
                setDoc(doc(db, 'businessVerification', user.uid), {
                    uid: user.uid,
                    username: userData?.username || '',
                    email: user.email || '',
                    ...form,
                    // ── GPS location saved here — visible to admin ──
                    gpsLocation: gpsLocation || null,
                    gpsRecordedAt: Date.now(),
                    status: 'pending',
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                })
            );
            await import('../services/firebase-config.js').then(({ db, collection, addDoc }) => 
                addDoc(collection(db, 'adminNotifications'), {
                    type: 'business_verification',
                    uid: user.uid,
                    username: userData?.username,
                    businessName: form.businessName,
                    message: `${form.fullName} submitted full KYC for verification`,
                    createdAt: Date.now(),
                    read: false,
                })
            );

            // Wait specifically to let the dramatic animation play out
            setTimeout(() => {
                clearInterval(interval);
                setScanProgress(100);
                setScanText('KYC SECURELY TRANSMITTED');
                setTimeout(() => {
                    showToast('Application submitted! Pending review.', 'success');
                    onSuccess();
                    onClose();
                }, 800);
            }, 3800); // Dramatic 3.8s wait
            
        } catch (err) {
            clearInterval(interval);
            setScanning(false);
            showToast('Error securely submitting application', 'error');
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }} onClick={e => { if (e.target === e.currentTarget && !scanning) onClose(); }}>
            
            <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                borderRadius: 16, padding: 24, width: '100%', maxWidth: 700,
                maxHeight: '92vh', overflowY: 'auto', position: 'relative',
            }}>
                <button onClick={onClose} disabled={scanning} style={{
                    position: 'absolute', top: 12, right: 16, background: 'none',
                    border: 'none', color: 'var(--text-muted)', fontSize: 22, cursor: scanning ? 'not-allowed' : 'pointer',
                    opacity: scanning ? 0 : 1
                }}>✕</button>

                {/* AI Scan overlay rendered outside modal scroll container */}
                {scanning && (
                    <div className="kyc-scan-overlay">
                        {/* Matrix rain columns */}
                        {['10%','20%','32%','45%','58%','70%','82%','92%'].map((left, i) => (
                            <div key={i} className="kyc-matrix-col" style={{
                                left, animationDuration: `${2.5 + i * 0.4}s`, animationDelay: `${i * 0.2}s`
                            }}>{'01011001100110010110100101'.split('').join('\n')}</div>
                        ))}
                        <div className="kyc-scan-topbar" />
                        <div className="kyc-scan-container">
                            <div className="kyc-grid" />
                            <div className="kyc-face-outline" />
                            <div className="kyc-corner-tr" />
                            <div className="kyc-corner-bl" />
                            <div className="kyc-eye-wrapper">
                                <div className="kyc-eyes-row">
                                    <div className="kyc-eye" />
                                    <div className="kyc-eye" style={{ animationDelay: '0.4s' }} />
                                </div>
                            </div>
                            <div className="kyc-laser" />
                        </div>
                        <div className="kyc-status-text">{scanText}</div>
                        <div className="kyc-progress-bar">
                            <div className="kyc-progress-fill" style={{ width: `${scanProgress}%` }} />
                        </div>
                        <div className="kyc-data-readout">
                            [{new Date().toISOString()}]<br />
                            NODE: KYC-SECURE-01 · PROTOCOL: AES-256<br />
                            Do not close this secure window
                        </div>
                    </div>
                )}

                <div style={{ textAlign: 'center', fontSize: 40, marginBottom: 8 }}>🏪</div>
                <h3 style={{ textAlign: 'center', color: 'var(--text-primary)', marginBottom: 4 }}>Business KYC Verification</h3>
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, marginBottom: 24 }}>Complete your profile and provide identity documentation securely.</p>
                
                <form onSubmit={submit}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
                        {/* LEFT COLUMN: Business & Basics */}
                        <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: 8, marginBottom: 12 }}>1. Business & Contact Data</div>
                            {[
                                { id: 'fullName', label: 'Full Legal Name *', type: 'text' },
                                { id: 'phone', label: 'Contact Phone *', type: 'tel' },
                                { id: 'businessName', label: 'Business Name *', type: 'text' },
                                { id: 'region', label: 'Operating Region / City *', type: 'text' },
                            ].map(({ id, label, type }) => (
                                <div key={id} style={{ marginBottom: 12 }}>
                                    <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>{label}</label>
                                    <input
                                        type={type} className="form-control"
                                        value={form[id]} required
                                        onChange={e => setForm(f => ({ ...f, [id]: e.target.value }))}
                                    />
                                </div>
                            ))}
                            
                            <div style={{ marginBottom: 12 }}>
                                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Business Type *</label>
                                <select className="form-control" value={form.businessType} required
                                    onChange={e => setForm(f => ({ ...f, businessType: e.target.value }))}>
                                    <option value="">Select type</option>
                                    {['retail', 'wholesale', 'service', 'online', 'other'].map(t => (
                                        <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ marginBottom: 12 }}>
                                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Description / What you sell</label>
                                <textarea className="form-control" rows={2} value={form.businessDesc}
                                    onChange={e => setForm(f => ({ ...f, businessDesc: e.target.value }))} />
                            </div>
                        </div>

                        {/* RIGHT COLUMN: KYC Data */}
                        <div>
                            <div style={{ fontWeight: 600, color: 'var(--color-gold)', borderBottom: '1px solid var(--border-color)', paddingBottom: 8, marginBottom: 12 }}>2. KYC Identity Verification</div>
                            
                            <div style={{ marginBottom: 12 }}>
                                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Document Type *</label>
                                <select className="form-control" value={form.idType} required
                                    onChange={e => setForm(f => ({ ...f, idType: e.target.value }))}>
                                    <option value="">Select Government ID</option>
                                    <option value="national_id">National ID Card</option>
                                    <option value="passport">Passport</option>
                                    <option value="driver_license">Driver's License</option>
                                    <option value="voter_id">Voter ID</option>
                                </select>
                            </div>

                            <div style={{ marginBottom: 16 }}>
                                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>ID Document Number *</label>
                                <input
                                    type="text" className="form-control" placeholder="Enter ID number exactly as shown"
                                    value={form.idNumber} required
                                    onChange={e => setForm(f => ({ ...f, idNumber: e.target.value }))}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                                {/* ID FRONT */}
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4, fontWeight: 600 }}>ID FRONT IMAGE *</label>
                                    <div onClick={() => frontRef.current?.click()} style={{
                                        height: 100, background: 'var(--bg-input)', border: '1.5px dashed var(--border-color)',
                                        borderRadius: 10, cursor: 'pointer', textAlign: 'center', display: 'flex', flexDirection: 'column',
                                        alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 4
                                    }}>
                                        {form.idFrontB64 ? (
                                            <img src={form.idFrontB64} alt="ID Front" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                        ) : (
                                            <>
                                                <span style={{ fontSize: 24, marginBottom: 4 }}>📄</span>
                                                <span style={{ fontSize: 10, color: 'var(--text-muted)', padding: '0 8px' }}>Tap to upload Front of ID</span>
                                            </>
                                        )}
                                        <input ref={frontRef} type="file" accept="image/*" style={{ display: 'none' }} required={!form.idFrontB64} onChange={e => handleImageChange(e, 'idFrontB64')} />
                                    </div>
                                </div>

                                {/* ID BACK */}
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4, fontWeight: 600 }}>ID BACK IMAGE *</label>
                                    <div onClick={() => backRef.current?.click()} style={{
                                        height: 100, background: 'var(--bg-input)', border: '1.5px dashed var(--border-color)',
                                        borderRadius: 10, cursor: 'pointer', textAlign: 'center', display: 'flex', flexDirection: 'column',
                                        alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 4
                                    }}>
                                        {form.idBackB64 ? (
                                            <img src={form.idBackB64} alt="ID Back" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                        ) : (
                                            <>
                                                <span style={{ fontSize: 24, marginBottom: 4 }}>🪪</span>
                                                <span style={{ fontSize: 10, color: 'var(--text-muted)', padding: '0 8px' }}>Tap to upload Back of ID</span>
                                            </>
                                        )}
                                        <input ref={backRef} type="file" accept="image/*" style={{ display: 'none' }} required={!form.idBackB64} onChange={e => handleImageChange(e, 'idBackB64')} />
                                    </div>
                                </div>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--color-gold)', background: 'rgba(255,215,0,0.1)', padding: 10, borderRadius: 8 }}>
                                🔒 Your identity verification documents are securely processed and are never shared publicly.
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10, marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
                        <button type="submit" className="btn btn-primary" style={{ flex: 2, padding: '14px', fontSize: 15, fontWeight: 700 }} disabled={scanning}>
                            {scanning ? 'Transmitting...' : 'Submit Verification'}
                        </button>
                        <button type="button" className="btn" onClick={onClose} disabled={scanning}
                            style={{ flex: 1, background: 'var(--bg-input)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Product Zoom Modal ───────────────────────────────────────────────────────
function ProductZoom({ product, currency, currentUid, onClose, onOrder }) {
    const price = formatCurrency(product.price || 0, currency);
    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.94)',
            backdropFilter: 'blur(12px)', zIndex: 3000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={{
                background: 'var(--bg-card)', borderRadius: 16,
                maxWidth: 480, width: '100%', overflow: 'hidden',
                maxHeight: '90vh', overflowY: 'auto',
            }}>
                <div style={{ position: 'relative', background: 'var(--bg-input)', minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {product.image
                        ? <img src={product.image} alt={product.name} style={{ width: '100%', maxHeight: '60vh', objectFit: 'contain' }} />
                        : <div style={{ fontSize: 64, color: 'var(--text-muted)', padding: 60 }}>📦</div>
                    }
                    <button onClick={onClose} style={{
                        position: 'absolute', top: 10, right: 10, width: 36, height: 36,
                        borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)',
                        color: 'white', fontSize: 18, cursor: 'pointer',
                    }}>✕</button>
                </div>
                <div style={{ padding: 20 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{product.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', margin: '6px 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                        👤 {product.sellerName} {product.isVerifiedSeller && <VerifiedBadge size={14} />}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-gold)', margin: '8px 0' }}>{price}</div>
                    {product.description && <div style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '10px 0' }}>{product.description}</div>}
                    {product.sellerUid !== currentUid
                        ? <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} onClick={() => { onOrder(product); onClose(); }}>
                            🛒 Order Now
                          </button>
                        : <div style={{ textAlign: 'center', padding: 12, background: 'var(--bg-input)', borderRadius: 10, color: 'var(--text-muted)' }}>
                            This is your product
                          </div>
                    }
                </div>
            </div>
        </div>
    );
}

// ─── Order Success Modal ──────────────────────────────────────────────────────
function OrderSuccess({ amount, productName, onClose }) {
    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
            <div style={{
                background: 'var(--bg-card)', borderRadius: 16, padding: 28,
                width: '100%', maxWidth: 380, textAlign: 'center', position: 'relative',
            }}>
                <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 16, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 22, cursor: 'pointer' }}>✕</button>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
                <h3 style={{ color: '#22C55E', marginBottom: 8 }}>Order Placed!</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12 }}>
                    Your order for &quot;{productName}&quot; has been submitted.
                </p>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-gold)', marginBottom: 20 }}>{amount}</div>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={onClose}>👍 Great</button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// KYC PREVIEW CARD  (shown to user after submission)
// ─────────────────────────────────────────────────────────────────────────────
function KycPreviewCard({ kycData, onClose }) {
    const statusLabels = { pending: 'AWAITING CLEARANCE', approved: 'ACCESS GRANTED', rejected: 'ACCESS DENIED' };
    const statusClass = kycData.status || 'pending';
    return (
        <div className="kyc-preview-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="kyc-preview-card">
                <div className="kyc-preview-sweep" />
                <div className="kyc-preview-header">
                    <div className="kyc-preview-header-icon">🆔</div>
                    <div className="kyc-preview-header-title">
                        <h3>IDENTITY FILE</h3>
                        <p>KYC Verification Record</p>
                    </div>
                </div>
                <div className="kyc-preview-body">
                    <div className={`kyc-preview-status ${statusClass}`}>
                        <div className="kyc-pulse-dot" />
                        {statusLabels[statusClass] || 'PROCESSING'}
                    </div>
                    <div className="kyc-preview-field">
                        <label>Legal Name</label>
                        <div className="pval">{kycData.fullName}</div>
                    </div>
                    <div className="kyc-preview-field">
                        <label>Business Entity</label>
                        <div className="pval">{kycData.businessName} <span style={{ color: 'rgba(0,255,255,0.4)', fontSize: 12 }}>({kycData.businessType})</span></div>
                    </div>
                    <div className="kyc-preview-field">
                        <label>Document Class</label>
                        <div className="pval">{(kycData.idType || 'N/A').toUpperCase().replace('_', ' ')}</div>
                    </div>
                    <div className="kyc-preview-field">
                        <label>Reference ID</label>
                        <div className="kyc-preview-id-badge">{kycData.idNumber || '—'}</div>
                    </div>
                    <div className="kyc-preview-field">
                        <label>Region</label>
                        <div className="pval">{kycData.region || '—'}</div>
                    </div>
                    <div className="kyc-preview-field">
                        <label>Submitted</label>
                        <div className="pval" style={{ fontSize: 12 }}>{new Date(kycData.createdAt).toLocaleString()}</div>
                    </div>
                </div>
                <div className="kyc-preview-footer">
                    <button className="kyc-preview-close-btn" onClick={onClose}>[ CLOSE RECORD ]</button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SHOP COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function Shop() {
    const { user, userData } = useAuth();
    const { translate } = useLanguage();
    const { showToast } = useToast();

    const currency = userData?.currency || 'TZS';

    // ── Verification state ────────────────────────────────────────────────────
    const [bizStatus, setBizStatus] = useState('not-applied'); // not-applied|pending|approved|rejected
    const isVerified = bizStatus === 'approved';

    // ── Products ──────────────────────────────────────────────────────────────
    const [allProducts, setAllProducts] = useState([]);
    const [myProducts, setMyProducts] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(true);

    // ── UI state ──────────────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState('all'); // all|clothes|…|sell
    const [bottomPage, setBottomPage] = useState('shop'); // shop|orders|business
    const [zoomProduct, setZoomProduct] = useState(null);
    const [showVerifyModal, setShowVerifyModal] = useState(false);
    const [orderSuccess, setOrderSuccess] = useState(null);
    const [showKycPreview, setShowKycPreview] = useState(false);
    const [kycData, setKycData] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState(null);
    const [trackingProduct, setTrackingProduct] = useState(null);

    // ── Certificate Generation ────────────────────────────────────────────────
    const certRef = useRef(null);
    const [generatingCert, setGeneratingCert] = useState(false);

    const handleDownloadCertificate = async (format = 'image') => {
        if (!certRef.current || !kycData) return;
        setGeneratingCert(format);
        showToast(`Generating ${format === 'pdf' ? 'PDF' : 'image'} certificate...`, 'info');
        try {
            await new Promise(r => setTimeout(r, 100));
            const canvas = await html2canvas(certRef.current, { scale: 3, useCORS: true, backgroundColor: '#0a0f1c' });
            const safeName = kycData.businessName.replace(/\s+/g, '_');
            if (format === 'pdf') {
                const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width / 3, canvas.height / 3] });
                const imgData = canvas.toDataURL('image/jpeg', 0.95);
                pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width / 3, canvas.height / 3);
                pdf.save(`NEW-HOPE_CHAT_Certificate_${safeName}.pdf`);
            } else {
                const imgData = canvas.toDataURL('image/jpeg', 0.95);
                const link = document.createElement('a');
                link.href = imgData;
                link.download = `NEW-HOPE_CHAT_Certificate_${safeName}.jpg`;
                link.click();
            }
            showToast('Certificate Downloaded!', 'success');
        } catch (e) {
            console.error(e);
            showToast('Failed to generate certificate', 'error');
        } finally {
            setGeneratingCert(null);
        }
    };

    // ── Orders ────────────────────────────────────────────────────────────────
    const [orders, setOrders] = useState([]);
    const [myPurchases, setMyPurchases] = useState([]);
    const [ordersSubTab, setOrdersSubTab] = useState('purchases'); // 'purchases' | 'deliver'
    const [pendingOrderCount, setPendingOrderCount] = useState(0);
    const [viewingOrder, setViewingOrder] = useState(null);

    // ── Sell form ─────────────────────────────────────────────────────────────
    const [todayPosts, setTodayPosts] = useState(0);
    const [selling, setSelling] = useState(false);
    const [sellForm, setSellForm] = useState({ name: '', desc: '', price: '', category: 'clothes', phone: '', image: null, imageB64: null });
    const fileRef = useRef();

    // ─────────────────────────────────────────────────────────────────────────
    // LOAD BUSINESS STATUS
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!user) return;
        const load = async () => {
            const snap = await getDoc(doc(db, 'businessVerification', user.uid));
            if (snap.exists()) {
                const data = snap.data();
                setBizStatus(data.status || 'not-applied');
                setKycData(data);
            }
        };
        load();
    }, [user]);

    // ─────────────────────────────────────────────────────────────────────────
    // LOAD ALL PRODUCTS (batched seller cache)
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        const load = async () => {
            setLoadingProducts(true);
            try {
                // Flat structure: collection 'sellerProducts' with sellerUid field
                const snap = await getDocs(collection(db, 'sellerProducts'));
                if (snap.empty) { setAllProducts([]); setLoadingProducts(false); return; }

                const raw = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.status === 'available');

                // Batch-load unique seller profiles
                const uids = [...new Set(raw.map(p => p.sellerUid).filter(Boolean))];
                const bizSnaps = await Promise.all(uids.map(uid =>
                    getDoc(doc(db, 'businessVerification', uid)).then(s => ({ uid, verified: s.exists() && s.data()?.status === 'approved' })).catch(() => ({ uid, verified: false }))
                ));
                const verifiedMap = Object.fromEntries(bizSnaps.map(b => [b.uid, b.verified]));

                const products = raw.map(p => ({
                    ...p,
                    isVerifiedSeller: verifiedMap[p.sellerUid] || false,
                })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

                setAllProducts(products);
            } catch (e) { console.error(e); }
            setLoadingProducts(false);
        };
        load();
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // LOAD MY PRODUCTS (realtime)
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, 'sellerProducts'), where('sellerUid', '==', user.uid));
        const unsub = onSnapshot(q, snap => {
            const prods = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            setMyProducts(prods);
            const today = new Date().toDateString();
            setTodayPosts(prods.filter(p => new Date(p.createdAt).toDateString() === today).length);
        });
        return () => unsub();
    }, [user]);

    // ─────────────────────────────────────────────────────────────────────────
    // LOAD ORDERS (realtime — as seller)
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, 'orders'), where('sellerUid', '==', user.uid));
        const unsub = onSnapshot(q, snap => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            setOrders(list);
            setPendingOrderCount(list.filter(o => o.status === 'pending').length);
        }, err => console.error('Seller orders query error:', err));
        return () => unsub();
    }, [user]);

    // ─────────────────────────────────────────────────────────────────────────
    // LOAD PURCHASES (realtime — as buyer)
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, 'orders'), where('buyerUid', '==', user.uid));
        const unsub = onSnapshot(q, snap => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            setMyPurchases(list);
        }, err => console.error('Buyer purchases query error:', err));
        return () => unsub();
    }, [user]);

    // ─────────────────────────────────────────────────────────────────────────
    // PLACE ORDER (5% commission)
    // ─────────────────────────────────────────────────────────────────────────
    const placeOrder = (product) => {
        if (!user || product.sellerUid === user.uid) { showToast('Cannot order your own product', 'error'); return; }
        setTrackingProduct(product);
    };

    const finalizeOrder = async (product) => {
        setTrackingProduct(null);
        try {
            const price = product.price || 0;
            const commission = price * 0.05;
            const sellerAmount = price - commission;

            // ── Check buyer has enough shopBalance ────────────────────────────
            const buyerSnap = await getDoc(doc(db, 'users', user.uid));
            const shopBalance = buyerSnap.exists() ? (buyerSnap.data().shopBalance || 0) : 0;
            if (shopBalance < price) {
                showToast(`Insufficient shop balance. You need ${formatCurrency(price, currency)} but have ${formatCurrency(shopBalance, currency)}.`, 'error');
                return;
            }

            // ── Deduct from buyer's shopBalance ──────────────────────────────
            await updateDoc(doc(db, 'users', user.uid), {
                shopBalance: shopBalance - price,
            });

            await addDoc(collection(db, 'orders'), {
                productId: product.id,
                productName: product.name,
                price,
                sellerUid: product.sellerUid,
                buyerUid: user.uid,
                buyerName: userData?.fullName || userData?.username || 'Customer',
                buyerPhone: userData?.phone || '',
                commission,
                sellerAmount,
                status: 'pending',
                createdAt: Date.now(),
            });

            // Notify seller
            await addDoc(collection(db, 'notifications'), {
                uid: product.sellerUid,
                type: 'order',
                message: `🛒 New order for "${product.name}" (${formatCurrency(price, currency)})`,
                read: false,
                createdAt: Date.now(),
            });

            setOrderSuccess({ amount: formatCurrency(price, currency), productName: product.name });
        } catch (e) {
            console.error(e);
            showToast('Error placing order: ' + e.message, 'error');
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // DELETE PRODUCT
    // ─────────────────────────────────────────────────────────────────────────
    const deleteProduct = async (id) => {
        setConfirmDialog({
            title: 'Delete Product',
            message: 'Are you sure you want to delete this product? This action cannot be undone.',
            isDestructive: true,
            onConfirm: async () => {
                setConfirmDialog(null);
                try {
                    await deleteDoc(doc(db, 'sellerProducts', id));
                    showToast('Product deleted', 'success');
                } catch { showToast('Error', 'error'); }
            }
        });
    };

    // ─────────────────────────────────────────────────────────────────────────
    // UPDATE ORDER STATUS
    // ─────────────────────────────────────────────────────────────────────────
    const updateOrder = async (oid, status) => {
        try {
            await updateDoc(doc(db, 'orders', oid), { status, updatedAt: Date.now() });
            showToast(`Order ${status}!`, 'success');
        } catch { showToast('Error', 'error'); }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // SELL FORM SUBMIT
    // ─────────────────────────────────────────────────────────────────────────
    const handleSellSubmit = async (e) => {
        e.preventDefault();
        if (!isVerified) { showToast('Get verified first', 'error'); return; }
        if (todayPosts >= MAX_DAILY_POSTS) { showToast(`Daily limit: ${MAX_DAILY_POSTS} posts`, 'error'); return; }
        if (!sellForm.imageB64) { showToast('Upload a product image', 'error'); return; }

        setSelling(true);
        try {
            await addDoc(collection(db, 'sellerProducts'), {
                name: sellForm.name.trim(),
                description: sellForm.desc.trim(),
                price: parseFloat(sellForm.price) || 0,
                category: sellForm.category,
                phone: sellForm.phone.trim(),
                image: sellForm.imageB64,
                status: 'available',
                sellerUid: user.uid,
                sellerName: userData?.fullName || userData?.username || 'Seller',
                createdAt: Date.now(),
            });
            showToast('Product listed!', 'success');
            setSellForm({ name: '', desc: '', price: '', category: 'clothes', phone: '', image: null, imageB64: null });
            if (fileRef.current) fileRef.current.value = '';
        } catch { showToast('Error listing product', 'error'); }
        setSelling(false);
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setSellForm(f => ({ ...f, image: file.name, imageB64: reader.result }));
        reader.readAsDataURL(file);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // FILTERED PRODUCTS
    // ─────────────────────────────────────────────────────────────────────────
    const filtered = activeTab === 'all' || !CATEGORIES.includes(activeTab)
        ? allProducts
        : allProducts.filter(p => p.category === activeTab);

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────
    const showProductGrid = bottomPage === 'shop' && activeTab !== 'sell';
    const showSellSection = bottomPage === 'shop' && activeTab === 'sell';

    return (
        <DashboardLayout>
            {/* Modals */}
            {showVerifyModal && (
                <VerifyModal
                    userData={userData}
                    onClose={() => setShowVerifyModal(false)}
                    onSuccess={() => setBizStatus('pending')}
                />
            )}
            {showKycPreview && kycData && (
                <KycPreviewCard kycData={kycData} onClose={() => setShowKycPreview(false)} />
            )}
            <ConfirmModal
                isOpen={!!confirmDialog}
                title={confirmDialog?.title}
                message={confirmDialog?.message}
                isDestructive={confirmDialog?.isDestructive}
                onConfirm={confirmDialog?.onConfirm}
                onCancel={() => setConfirmDialog(null)}
            />

            {/* ── Hidden Certificate Node For HTML2Canvas ── */}
            <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', pointerEvents: 'none' }}>
                <div ref={certRef} style={{
                    width: 700, height: 480, background: '#0a0f1c', border: '12px solid #00ffff',
                    padding: '30px 40px', fontFamily: "'Space Mono', monospace", color: '#fff', position: 'relative', overflow: 'hidden',
                    boxSizing: 'border-box'
                }}>
                    {/* Watermark */}
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.05, fontSize: 80, fontWeight: 900, transform: 'rotate(-25deg)', whiteSpace: 'nowrap' }}>
                        NEW-HOPE CHAT
                    </div>
                    {/* Content */}
                    <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid rgba(0,255,255,0.3)', paddingBottom: 15, marginBottom: 25 }}>
                            <div>
                                <h1 style={{ margin: 0, color: '#00ffff', fontSize: 32, letterSpacing: 2 }}>OFFICIAL VENDOR</h1>
                                <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>NEW-HOPE SECURE PLATFORM CERTIFICATE</div>
                            </div>
                            <VerifiedBadge size={54} />
                        </div>

                        <div style={{ flex: 1 }}>
                            <h2 style={{ fontSize: 28, margin: '0 0 6px 0', textTransform: 'uppercase', letterSpacing: 1 }}>{kycData?.businessName || 'Business Name'}</h2>
                            <div style={{ color: '#00ff7e', fontWeight: 700, fontSize: 16, marginBottom: 30 }}>({kycData?.businessType || 'BUSINESS'})</div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                                <div>
                                    <div style={{ fontSize: 11, color: 'rgba(0,255,255,0.6)', marginBottom: 6 }}>OPERATOR NAME</div>
                                    <div style={{ fontSize: 17, borderBottom: '1px dashed #334155', paddingBottom: 6 }}>{kycData?.fullName || 'N/A'}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: 'rgba(0,255,255,0.6)', marginBottom: 6 }}>REGISTRY NUMBER</div>
                                    <div style={{ fontSize: 17, borderBottom: '1px dashed #334155', paddingBottom: 6, color: '#fbbf24' }}>{kycData?.idNumber || 'N/A'}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: 'rgba(0,255,255,0.6)', marginBottom: 6 }}>LOCATION / REGION</div>
                                    <div style={{ fontSize: 17, borderBottom: '1px dashed #334155', paddingBottom: 6 }}>{kycData?.region || 'N/A'}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: 'rgba(0,255,255,0.6)', marginBottom: 6 }}>AUTHORIZATION DATE</div>
                                    <div style={{ fontSize: 17, borderBottom: '1px dashed #334155', paddingBottom: 6 }}>{new Date(kycData?.updatedAt || kycData?.createdAt || Date.now()).toLocaleDateString()}</div>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '2px solid rgba(0,255,255,0.1)', paddingTop: 16 }}>
                            <div>
                                <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>VERIFICATION ID RECORD</div>
                                <div style={{ fontSize: 10, color: '#00ffff' }}>{kycData?.id || 'AUTH-0000-0000'}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ color: '#00ff7e', fontWeight: 700, fontSize: 15, letterSpacing: 1 }}>STATUS: ACTIVE & VERIFIED</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {zoomProduct && (
                <ProductZoom
                    product={zoomProduct}
                    currency={currency}
                    currentUid={user?.uid}
                    onClose={() => setZoomProduct(null)}
                    onOrder={placeOrder}
                />
            )}
            {orderSuccess && (
                <OrderSuccess
                    amount={orderSuccess.amount}
                    productName={orderSuccess.productName}
                    onClose={() => setOrderSuccess(null)}
                />
            )}
            {trackingProduct && (
                <DeliveryTracker
                    productName={trackingProduct.name}
                    amount={formatCurrency(trackingProduct.price || 0, currency)}
                    onClose={() => setTrackingProduct(null)}
                    onComplete={() => finalizeOrder(trackingProduct)}
                />
            )}

            <div style={{ minHeight: '100vh', paddingBottom: 80 }}>
                <div style={{ maxWidth: 540, margin: '0 auto', padding: '0 12px' }}>

                    {/* ── Shop Top Nav ───────────────────────────────────────────── */}
                    <div style={{ margin: '16px 0', background: 'var(--bg-card)', borderRadius: 12, padding: 6, display: 'flex', border: '1px solid var(--border-color)' }}>
                        {[
                            { key: 'shop',     icon: '🛍️', label: 'Shop' },
                            { key: 'orders',   icon: '📦', label: 'Orders', badge: pendingOrderCount },
                            { key: 'business', icon: '🏪', label: 'Business' },
                        ].map(({ key, icon, label, badge }) => (
                            <button key={key} onClick={() => { setBottomPage(key); if (key === 'shop') setActiveTab('all'); }} style={{
                                flex: 1, padding: '8px 0', background: bottomPage === key ? 'var(--color-gold)' : 'transparent',
                                color: bottomPage === key ? '#0F172A' : 'var(--text-secondary)',
                                border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, position: 'relative'
                            }}>
                                <span>{icon}</span> {label}
                                {badge > 0 && <span style={{ position: 'absolute', top: -5, right: 10, background: '#EF4444', color: 'white', borderRadius: '50%', padding: '2px 6px', fontSize: 9 }}>{badge}</span>}
                            </button>
                        ))}
                    </div>

                    {/* ── Business Card ─────────────────────────────────────── */}
                    {bottomPage === 'shop' && (
                        <div style={{
                            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                            borderRadius: 12, padding: 16, marginBottom: 14,
                        }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>
                            🏪 {translate('shop.business') || 'Business Profile'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                            {translate('shop.verify') || 'Apply for verification to start selling'}
                        </div>
                        <div style={{ marginBottom: 10 }}>
                            {{
                                'not-applied': <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Not applied</span>,
                                'pending':     <span style={{ color: '#F97316', fontSize: 12 }}>⏳ Under Review</span>,
                                'approved':    <span style={{ color: '#22C55E', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}><VerifiedBadge size={14} /> Verified Seller</span>,
                                'rejected':    <span style={{ color: '#EF4444', fontSize: 12 }}>❌ Rejected</span>,
                            }[bizStatus]}
                        </div>
                        <button
                            className="btn btn-primary" style={{ width: '100%', marginBottom: kycData ? 8 : 0 }}
                            disabled={bizStatus === 'pending' || bizStatus === 'approved'}
                            onClick={() => {
                                if (bizStatus === 'approved') { showToast('Already verified', 'info'); return; }
                                if (bizStatus === 'pending') { showToast('Under review', 'info'); return; }
                                setShowVerifyModal(true);
                            }}
                        >
                            {bizStatus === 'approved' ? '✅ Verified' : bizStatus === 'pending' ? '⏳ Pending Review' : bizStatus === 'rejected' ? 'Re-apply' : 'Apply for Verification'}
                        </button>
                        {kycData && bizStatus === 'approved' && (
                            <div style={{ display: 'flex', gap: 8, marginTop: 0 }}>
                                <button
                                    onClick={() => handleDownloadCertificate('image')}
                                    disabled={!!generatingCert}
                                    style={{
                                        flex: 1, padding: '12px 6px',
                                        background: generatingCert === 'image' ? '#1d4ed8' : '#2563eb',
                                        color: '#ffffff', border: 'none',
                                        borderRadius: 8, fontFamily: "'Space Mono', monospace",
                                        fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                                        cursor: generatingCert ? 'wait' : 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                                        boxShadow: '0 2px 12px rgba(37,99,235,0.5)',
                                        transition: 'background 0.2s',
                                    }}
                                >
                                    {generatingCert === 'image' ? '⏳' : '🖼️'} SAVE IMAGE
                                </button>
                                <button
                                    onClick={() => handleDownloadCertificate('pdf')}
                                    disabled={!!generatingCert}
                                    style={{
                                        flex: 1, padding: '12px 6px',
                                        background: generatingCert === 'pdf' ? '#b91c1c' : '#dc2626',
                                        color: '#ffffff', border: 'none',
                                        borderRadius: 8, fontFamily: "'Space Mono', monospace",
                                        fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                                        cursor: generatingCert ? 'wait' : 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                                        boxShadow: '0 2px 12px rgba(220,38,38,0.5)',
                                        transition: 'background 0.2s',
                                    }}
                                >
                                    {generatingCert === 'pdf' ? '⏳' : '📄'} SAVE PDF
                                </button>
                            </div>
                        )}
                        {kycData && bizStatus !== 'approved' && (
                            <button
                                onClick={() => setShowKycPreview(true)}
                                style={{
                                    width: '100%', padding: '10px', background: 'rgba(0,255,255,0.06)',
                                    color: '#00ffff', border: '1px solid rgba(0,255,255,0.25)',
                                    borderRadius: 8, fontFamily: "'Space Mono', monospace",
                                    fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                }}
                            >
                                🔍 View My KYC Record
                            </button>
                        )}
                    </div>
                    )}

                    {/* ── Category Tabs ─────────────────────────────────────── */}
                    {bottomPage === 'shop' && (
                        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 12, scrollbarWidth: 'none' }}>
                            {CATEGORIES.map(cat => (
                                <button key={cat} onClick={() => setActiveTab(cat)} style={{
                                    padding: '7px 14px', borderRadius: 20, border: '1px solid',
                                    borderColor: activeTab === cat ? 'var(--color-gold)' : 'var(--border-color)',
                                    background: activeTab === cat ? 'rgba(255,215,0,0.1)' : 'var(--bg-input)',
                                    color: activeTab === cat ? 'var(--color-gold)' : 'var(--text-secondary)',
                                    fontSize: 11, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
                                    display: 'flex', alignItems: 'center', gap: 4,
                                }}>
                                    {CAT_ICONS[cat]} {cat.charAt(0).toUpperCase() + cat.slice(1)}
                                </button>
                            ))}
                            <button onClick={() => { if (!isVerified) { showToast('Get verified first', 'error'); return; } setActiveTab('sell'); }} style={{
                                padding: '7px 14px', borderRadius: 20, border: '1px solid',
                                borderColor: activeTab === 'sell' ? 'var(--color-gold)' : 'var(--border-color)',
                                background: activeTab === 'sell' ? 'rgba(255,215,0,0.1)' : 'var(--bg-input)',
                                color: activeTab === 'sell' ? 'var(--color-gold)' : 'var(--text-secondary)',
                                fontSize: 11, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
                                display: 'flex', alignItems: 'center', gap: 4,
                            }}>
                                ➕ Sell
                            </button>
                        </div>
                    )}

                    {/* ── Product Grid ──────────────────────────────────────── */}
                    {showProductGrid && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, marginBottom: 16 }}>
                            {loadingProducts ? (
                                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                                    Loading products...
                                </div>
                            ) : filtered.length === 0 ? (
                                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                                    <div style={{ fontSize: 40, marginBottom: 8 }}>🛒</div>
                                    <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{translate('shop.noProducts') || 'No products yet'}</div>
                                </div>
                            ) : filtered.map(p => {
                                const own = user && p.sellerUid === user.uid;
                                return (
                                    <div key={p.id}
                                        onClick={() => setZoomProduct(p)}
                                        style={{
                                            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                                            borderRadius: 12, padding: 12, textAlign: 'center', cursor: 'pointer',
                                            transition: 'all 0.2s',
                                        }}>
                                        {p.image
                                            ? <img src={p.image} alt={p.name} style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 8, marginBottom: 8, display: 'block' }} />
                                            : <div style={{ width: '100%', height: 100, background: 'var(--bg-input)', borderRadius: 8, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>📦</div>
                                        }
                                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                                        {p.desc && (
                                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', margin: '2px 0 6px', lineHeight: 1.3 }}>
                                                {p.desc}
                                            </div>
                                        )}
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, flexWrap: 'wrap' }}>
                                            <span style={{ background: 'var(--bg-card)', padding: '2px 6px', borderRadius: 4, fontSize: 9, letterSpacing: 0.5, border: '1px solid var(--border-color)', textTransform: 'uppercase' }}>
                                                {p.category || 'OTHER'}
                                            </span>
                                            <span>by {p.sellerName}</span>
                                            {p.isVerifiedSeller && <VerifiedBadge size={12} />}
                                        </div>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-gold)', margin: '4px 0' }}>{formatCurrency(p.price || 0, currency)}</div>
                                        {own
                                            ? <button className="btn" onClick={e => { e.stopPropagation(); deleteProduct(p.id); }} style={{ width: '100%', padding: 6, background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: 'none', borderRadius: 8, fontSize: 11, cursor: 'pointer' }}>
                                                🗑️ Delete
                                              </button>
                                            : <button className="btn" onClick={e => { e.stopPropagation(); placeOrder(p); }} style={{ width: '100%', padding: 6, background: 'var(--color-gold)', color: '#0F172A', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                                🛒 Order Now
                                              </button>
                                        }
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* ── Sell Form ─────────────────────────────────────────── */}
                    {showSellSection && (
                        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 16 }}>
                            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 4 }}>➕ Sell Your Product</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                                Today: <strong style={{ color: 'var(--color-gold)' }}>{todayPosts}</strong> / {MAX_DAILY_POSTS} posts
                                {todayPosts >= MAX_DAILY_POSTS && <span style={{ color: '#EF4444', marginLeft: 6 }}>Limit reached</span>}
                            </div>
                            <form onSubmit={handleSellSubmit}>
                                {[
                                    { label: 'Product Name', id: 'name', type: 'text', placeholder: 'e.g. iPhone 13' },
                                    { label: 'Price (local currency)', id: 'price', type: 'number', placeholder: 'e.g. 50000' },
                                    { label: 'Contact Phone', id: 'phone', type: 'tel', placeholder: 'e.g. 0712345678' },
                                ].map(({ label, id, type, placeholder }) => (
                                    <div key={id} style={{ marginBottom: 12 }}>
                                        <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>{label}</label>
                                        <input
                                            type={type} className="form-control" placeholder={placeholder}
                                            value={sellForm[id]} required
                                            onChange={e => setSellForm(f => ({ ...f, [id]: e.target.value }))}
                                        />
                                    </div>
                                ))}
                                <div style={{ marginBottom: 12 }}>
                                    <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Description</label>
                                    <textarea className="form-control" rows={2} placeholder="Describe your product..."
                                        value={sellForm.desc} onChange={e => setSellForm(f => ({ ...f, desc: e.target.value }))} />
                                </div>
                                <div style={{ marginBottom: 12 }}>
                                    <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Category</label>
                                    <select className="form-control" value={sellForm.category}
                                        onChange={e => setSellForm(f => ({ ...f, category: e.target.value }))}>
                                        {['clothes', 'bundles', 'furniture', 'electronics', 'cars', 'other'].map(c => (
                                            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ marginBottom: 16 }}>
                                    <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Product Image *</label>
                                    <div onClick={() => fileRef.current?.click()} style={{
                                        padding: 12, background: 'var(--bg-input)', border: '1.5px dashed var(--border-color)',
                                        borderRadius: 10, cursor: 'pointer', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13,
                                    }}>
                                        {sellForm.imageB64
                                            ? <img src={sellForm.imageB64} alt="preview" style={{ maxHeight: 100, borderRadius: 8 }} />
                                            : <span>📷 Click to upload image</span>
                                        }
                                        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />
                                    </div>
                                </div>
                                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={selling || todayPosts >= MAX_DAILY_POSTS}>
                                    {selling ? 'Listing...' : '➕ List Product'}
                                </button>
                            </form>

                            {/* My listed products */}
                            {myProducts.length > 0 && (
                                <div style={{ marginTop: 20 }}>
                                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-secondary)', marginBottom: 10 }}>📦 Your Listed Products</div>
                                    {myProducts.map(p => (
                                        <div key={p.id} style={{
                                            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                                            background: 'var(--bg-input)', border: '1px solid var(--border-color)',
                                            borderRadius: 10, marginBottom: 6,
                                        }}>
                                            {p.image
                                                ? <img src={p.image} alt={p.name} style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                                                : <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>📦</div>
                                            }
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                                                <div style={{ fontSize: 12, color: 'var(--color-gold)', fontWeight: 600 }}>{formatCurrency(p.price || 0, currency)}</div>
                                            </div>
                                            <span style={{
                                                fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                                                background: p.status === 'available' ? 'rgba(34,197,94,0.1)' : 'rgba(249,115,22,0.1)',
                                                color: p.status === 'available' ? '#22C55E' : '#F97316',
                                            }}>{p.status === 'available' ? 'Available' : 'Sold'}</span>
                                            <button onClick={() => deleteProduct(p.id)} style={{ padding: '4px 8px', border: 'none', borderRadius: 6, background: 'rgba(239,68,68,0.1)', color: '#EF4444', cursor: 'pointer', fontSize: 12 }}>🗑️</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Orders Page ───────────────────────────────────────── */}
                    {bottomPage === 'orders' && (
                        <div>
                            <div style={{ display: 'flex', gap: 6, marginBottom: 16, background: 'var(--bg-input)', padding: 4, borderRadius: 12 }}>
                                <button
                                    onClick={() => setOrdersSubTab('purchases')}
                                    style={{ flex: 1, padding: '8px 0', border: 'none', borderRadius: 8, background: ordersSubTab === 'purchases' ? 'var(--color-gold)' : 'transparent', color: ordersSubTab === 'purchases' ? '#0F172A' : 'var(--text-secondary)', fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s' }}
                                >🛍️ My Purchases</button>
                                <button
                                    onClick={() => setOrdersSubTab('deliver')}
                                    style={{ flex: 1, padding: '8px 0', border: 'none', borderRadius: 8, background: ordersSubTab === 'deliver' ? 'var(--color-gold)' : 'transparent', color: ordersSubTab === 'deliver' ? '#0F172A' : 'var(--text-secondary)', fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s' }}
                                >🚚 Deliveries</button>
                            </div>

                            {/* MY PURCHASES SECTION */}
                            {ordersSubTab === 'purchases' && (
                                <div>
                            {myPurchases.length === 0 ? (
                                <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24, fontStyle: 'italic' }}>No purchases yet. Start shopping!</div>
                            ) : myPurchases.map(o => (
                                <div key={o.id} style={{
                                    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                                    borderRadius: 10, padding: 12, marginBottom: 8, display: 'flex', flexDirection: 'column'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>{o.productName}</span>
                                        <span style={{ fontWeight: 700, color: 'var(--color-gold)' }}>{formatCurrency(o.price || 0, currency)}</span>
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(o.createdAt).toLocaleDateString()}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                                        <span style={{
                                            fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 10,
                                            background: { pending: 'rgba(249,115,22,0.1)', traveling: 'rgba(59,130,246,0.1)', completed: 'rgba(34,197,94,0.1)', rejected: 'rgba(239,68,68,0.1)' }[o.status] || 'transparent',
                                            color: { pending: '#F97316', traveling: '#3B82F6', completed: '#22C55E', rejected: '#EF4444' }[o.status] || 'var(--text-muted)',
                                        }}>
                                            {(o.status || 'pending').toUpperCase()}
                                        </span>
                                        <button onClick={() => setViewingOrder(o)} style={{ padding: '6px 14px', border: '1px solid var(--border-color)', borderRadius: 20, background: 'var(--bg-input)', color: 'var(--color-gold)', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>📍 Track Order</button>
                                    </div>
                                </div>
                            ))}
                                </div>
                            )}
                            {/* ORDERS TO DELIVER (SELLER) SECTION */}
                            {ordersSubTab === 'deliver' && (
                                <div>
                            {orders.length === 0 ? (
                                <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24, fontStyle: 'italic' }}>No orders placed on your products yet.</div>
                            ) : orders.map(o => (
                                <div key={o.id} style={{
                                    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                                    borderRadius: 10, padding: 12, marginBottom: 8,
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>{o.productName}</span>
                                        <span style={{ fontWeight: 700, color: 'var(--color-gold)' }}>{formatCurrency(o.price || 0, currency)}</span>
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                                        {o.buyerName} {o.buyerPhone ? `· ${o.buyerPhone}` : ''}
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(o.createdAt).toLocaleDateString()}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                                        <span style={{
                                            fontSize: 10, fontWeight: 600, padding: '2px 10px', borderRadius: 10,
                                            background: { pending: 'rgba(249,115,22,0.1)', confirmed: 'rgba(59,130,246,0.1)', traveling: 'rgba(59,130,246,0.1)', completed: 'rgba(34,197,94,0.1)', rejected: 'rgba(239,68,68,0.1)' }[o.status] || 'transparent',
                                            color: { pending: '#F97316', confirmed: '#3B82F6', traveling: '#3B82F6', completed: '#22C55E', rejected: '#EF4444' }[o.status] || 'var(--text-muted)',
                                        }}>
                                            {(o.status || 'pending').charAt(0).toUpperCase() + (o.status || 'pending').slice(1)}
                                        </span>
                                        {o.commission ? <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Commission: {formatCurrency(o.commission, currency)}</span> : null}
                                    </div>
                                    {o.status === 'pending' && (
                                        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                                            <button onClick={() => updateOrder(o.id, 'confirmed')} style={{ padding: '4px 12px', border: 'none', borderRadius: 6, background: '#22C55E', color: 'white', fontSize: 11, cursor: 'pointer' }}>✅ Confirm</button>
                                            <button onClick={() => updateOrder(o.id, 'rejected')} style={{ padding: '4px 12px', border: 'none', borderRadius: 6, background: '#EF4444', color: 'white', fontSize: 11, cursor: 'pointer' }}>❌ Reject</button>
                                        </div>
                                    )}
                                </div>
                            ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Business Profile ──────────────────────────────────── */}
                    {bottomPage === 'business' && (
                        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 20 }}>
                            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 12 }}>🏪 Business Profile</div>
                            <div style={{ marginBottom: 12 }}>
                                {{
                                    'not-applied': <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Not yet applied</span>,
                                    'pending':     <span style={{ color: '#F97316', background: 'rgba(249,115,22,0.1)', padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>⏳ Under Review</span>,
                                    'approved':    <span style={{ color: '#22C55E', background: 'rgba(34,197,94,0.1)', padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>✅ Verified</span>,
                                    'rejected':    <span style={{ color: '#EF4444', background: 'rgba(239,68,68,0.1)', padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>❌ Rejected</span>,
                                }[bizStatus]}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 13, marginBottom: 12 }}>
                                <span style={{ color: 'var(--text-muted)' }}>Full Name:</span>
                                <span style={{ color: 'var(--text-primary)' }}>{userData?.fullName || '-'}</span>
                                <span style={{ color: 'var(--text-muted)' }}>Phone:</span>
                                <span style={{ color: 'var(--text-primary)' }}>{userData?.phone || '-'}</span>
                                <span style={{ color: 'var(--text-muted)' }}>Username:</span>
                                <span style={{ color: 'var(--text-primary)' }}>{userData?.username || '-'}</span>
                            </div>
                            {bizStatus === 'approved' && <div style={{ padding: 12, background: 'rgba(34,197,94,0.06)', color: '#22C55E', borderRadius: 8, fontSize: 12 }}>✅ You can post up to {MAX_DAILY_POSTS} products per day.</div>}
                            {bizStatus === 'pending' && <div style={{ padding: 12, background: 'rgba(249,115,22,0.06)', color: '#F97316', borderRadius: 8, fontSize: 12 }}>⏳ Your application is under review.</div>}
                            {(bizStatus === 'not-applied' || bizStatus === 'rejected') && (
                                <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }} onClick={() => setShowVerifyModal(true)}>
                                    {bizStatus === 'rejected' ? 'Re-apply' : 'Apply to Start Selling'}
                                </button>
                            )}
                        </div>
                    )}

                </div>
            </div>

            {/* View Order Map Modal */}
            {viewingOrder && (
                <ViewTrackingMap order={viewingOrder} onClose={() => setViewingOrder(null)} />
            )}
        </DashboardLayout>
    );
}
