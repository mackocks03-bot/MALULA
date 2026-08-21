import React from 'react';

// ── Generic Overlay ──
const Overlay = ({ children, onClose }) => (
    <div style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20
    }} onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
        {children}
    </div>
);

// ── Confirm Modal ──
export const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Confirm', cancelText = 'Cancel', isDestructive = false }) => {
    if (!isOpen) return null;
    return (
        <Overlay onClose={onCancel}>
            <div style={{
                background: 'var(--bg-card, #1e293b)', 
                border: '1px solid var(--border-color, #334155)',
                borderRadius: 16, padding: 24, width: '100%', maxWidth: 400,
                boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                color: 'var(--text-primary, #f8fafc)'
            }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: 18, fontWeight: 700 }}>{title}</h3>
                <p style={{ margin: '0 0 24px 0', fontSize: 14, color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.5 }}>{message}</p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                    <button onClick={onCancel} style={{
                        padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-color, #334155)',
                        background: 'transparent', color: 'var(--text-primary, #f8fafc)', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                    }}>{cancelText}</button>
                    <button onClick={onConfirm} style={{
                        padding: '10px 16px', borderRadius: 8, border: 'none',
                        background: isDestructive ? '#ef4444' : 'var(--color-gold, #3b82f6)', 
                        color: isDestructive ? 'white' : '#0f172a', 
                        fontSize: 13, fontWeight: 700, cursor: 'pointer'
                    }}>{confirmText}</button>
                </div>
            </div>
        </Overlay>
    );
};

// ── Prompt Modal ──
export const PromptModal = ({ isOpen, title, message, onConfirm, onCancel, placeholder = '', confirmText = 'Submit', cancelText = 'Cancel' }) => {
    const [inputValue, setInputValue] = React.useState('');
    
    // Reset input when opening
    React.useEffect(() => {
        if (isOpen) setInputValue('');
    }, [isOpen]);

    if (!isOpen) return null;
    
    return (
        <Overlay onClose={onCancel}>
            <div style={{
                background: 'var(--bg-card, #1e293b)', 
                border: '1px solid var(--border-color, #334155)',
                borderRadius: 16, padding: 24, width: '100%', maxWidth: 400,
                boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                color: 'var(--text-primary, #f8fafc)'
            }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: 18, fontWeight: 700 }}>{title}</h3>
                <p style={{ margin: '0 0 16px 0', fontSize: 14, color: 'var(--text-secondary, #94a3b8)' }}>{message}</p>
                <input 
                    type="text" 
                    autoFocus
                    value={inputValue} 
                    onChange={e => setInputValue(e.target.value)}
                    placeholder={placeholder}
                    onKeyDown={e => { if(e.key === 'Enter' && inputValue.trim()) onConfirm(inputValue.trim()); }}
                    style={{
                        width: '100%', padding: '12px 14px', borderRadius: 8,
                        background: 'var(--bg-input, #0f172a)', border: '1px solid var(--border-color, #334155)',
                        color: 'var(--text-primary, white)', fontSize: 14, marginBottom: 24,
                        boxSizing: 'border-box'
                    }}
                />
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                    <button onClick={onCancel} style={{
                        padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-color, #334155)',
                        background: 'transparent', color: 'var(--text-primary, #f8fafc)', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                    }}>{cancelText}</button>
                    <button onClick={() => { if(inputValue.trim()) onConfirm(inputValue.trim()); }} disabled={!inputValue.trim()} style={{
                        padding: '10px 16px', borderRadius: 8, border: 'none',
                        background: inputValue.trim() ? 'var(--color-gold, #3b82f6)' : 'var(--bg-input, #0f172a)', 
                        color: inputValue.trim() ? '#0f172a' : 'var(--text-muted, #64748b)', 
                        fontSize: 13, fontWeight: 700, cursor: inputValue.trim() ? 'pointer' : 'not-allowed'
                    }}>{confirmText}</button>
                </div>
            </div>
        </Overlay>
    );
};
