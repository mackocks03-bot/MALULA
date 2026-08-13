export default function Logo({ compact = false, className = '' }) {
    return (
        <div className={`${compact ? 'logo-compact' : 'auth-logo'} ${className}`}>
            <img src="/assets/logo.png" alt="NEWHOPE-CHAT" onError={(e) => { e.target.style.display = 'none'; }} />
            <span className="brand">
                <span className="new">NEW</span>
                <span className="hope">HOPE</span>
                <span className="chat">CHAT</span>
            </span>
        </div>
    );
}
