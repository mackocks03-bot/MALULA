/**
 * PaymentStepper — Animated 3-step horizontal progress indicator for PalmPesa deposits.
 *
 * Props:
 *   status: 'pushing' | 'waiting' | 'success' | 'failed' | '' (hidden)
 *   message: optional override message shown below the stepper
 */
import './css/PaymentStepper.css';

const STEPS = [
    { key: 'initiating', label: 'Initiating' },
    { key: 'prompt',     label: 'Prompt Sent' },
    { key: 'complete',   label: 'Complete' },
];

/**
 * Map palmpesaStatus → per-step state
 * Returns an array of 'idle' | 'active' | 'done' | 'failed'
 */
function getStepStates(status) {
    switch (status) {
        case 'pushing':
            return ['active', 'idle', 'idle'];
        case 'waiting':
            return ['done', 'active', 'idle'];
        case 'success':
            return ['done', 'done', 'done'];
        case 'failed':
            return ['done', 'failed', 'idle'];
        default:
            return ['idle', 'idle', 'idle'];
    }
}

/** line between step i and i+1 is filled when step i is 'done' */
function lineState(stepStates, lineIndex) {
    return stepStates[lineIndex] === 'done' ? 'active' : '';
}

const defaultMessages = {
    pushing: 'Connecting to PalmPesa gateway…',
    waiting: 'Prompt sent! Enter your mobile money PIN to approve.',
    success: '✓ Payment confirmed. Crediting your shop balance…',
    failed:  'Payment was not completed. Please try again.',
};

export default function PaymentStepper({ status, message }) {
    if (!status || status === '') return null;

    const stepStates = getStepStates(status);
    const msg = message || defaultMessages[status] || '';
    const msgClass = status === 'success' ? 'success' : status === 'failed' ? 'failed' : '';

    return (
        <div className="pst-wrapper">
            {/* ── Circles + connectors ── */}
            <div className="pst-row">
                {STEPS.map((step, i) => (
                    <div key={step.key} style={{ display: 'contents' }}>
                        {/* Circle */}
                        <div className={`pst-circle ${stepStates[i]}`}>
                            {/* Number shown when idle/active */}
                            <span className="pst-num">{i + 1}</span>
                            {/* Check SVG shown when done */}
                            <svg viewBox="0 0 24 24" width="20" height="20" className="pst-check">
                                <polyline points="4 12 9 17 20 7" />
                            </svg>
                            {/* X icon when failed */}
                            {stepStates[i] === 'failed' && (
                                <svg viewBox="0 0 24 24" width="18" height="18"
                                    stroke="#ef4444" strokeWidth="3" fill="none"
                                    strokeLinecap="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            )}
                        </div>
                        {/* Connector line (not after last step) */}
                        {i < STEPS.length - 1 && (
                            <div className="pst-line">
                                <div className={`pst-line-fill ${lineState(stepStates, i)}`} />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* ── Labels ── */}
            <div className="pst-labels">
                {STEPS.map((step, i) => (
                    <div key={step.key} className={`pst-label ${stepStates[i]}`}>
                        {step.label}
                    </div>
                ))}
            </div>

            {/* ── Status message ── */}
            {msg && <div className={`pst-message ${msgClass}`}>{msg}</div>}
        </div>
    );
}
