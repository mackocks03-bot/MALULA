import React from 'react';
import Logo from './Logo.jsx';

export default function CinematicLoader({ text = "Processing..." }) {
    return (
        <div className="cinematic-loader-overlay">
            <div className="cinematic-loader-content">
                <div className="loader-3d-wrapper">
                    <div className="loader-ring loader-ring-1"></div>
                    <div className="loader-ring loader-ring-2"></div>
                    <div className="loader-ring loader-ring-3"></div>
                    <div className="loader-logo-container">
                        <Logo compact={true} className="loader-logo-pulse" />
                    </div>
                </div>
                <div className="loader-text">{text}</div>
            </div>
            <style>{`
                .cinematic-loader-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 999999;
                    background: rgba(10, 10, 12, 0.9);
                    backdrop-filter: blur(16px);
                    -webkit-backdrop-filter: blur(16px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-direction: column;
                    opacity: 0;
                    animation: fadeInLoader 0.4s ease forwards;
                }
                .cinematic-loader-content {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 36px;
                    transform: translateY(20px) scale(0.95);
                    animation: floatUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                .loader-3d-wrapper {
                    position: relative;
                    width: 140px;
                    height: 140px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    perspective: 1000px;
                    transform-style: preserve-3d;
                }
                .loader-logo-container {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10;
                    transform: translateZ(30px);
                }
                .loader-logo-pulse {
                    transform-origin: center;
                    filter: drop-shadow(0 0 15px rgba(212, 175, 55, 0.5));
                    animation: pulseLogo 2s ease-in-out infinite alternate;
                }
                .loader-logo-pulse img {
                    width: 48px !important;
                    height: 48px !important;
                }
                .loader-ring {
                    position: absolute;
                    inset: 0;
                    border-radius: 50%;
                    border: 2px solid transparent;
                    transform-style: preserve-3d;
                }
                .loader-ring-1 {
                    border-top-color: var(--color-gold);
                    border-left-color: rgba(212, 175, 55, 0.4);
                    animation: rotate3D1 3s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                    box-shadow: 0 0 25px rgba(212, 175, 55, 0.15) inset;
                }
                .loader-ring-2 {
                    inset: 18px;
                    border-bottom-color: var(--color-gold);
                    border-right-color: rgba(212, 175, 55, 0.3);
                    animation: rotate3D2 4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                }
                .loader-ring-3 {
                    inset: 36px;
                    border-left-color: var(--color-gold);
                    border-top-color: rgba(212, 175, 55, 0.2);
                    animation: rotate3D3 5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                }
                .loader-text {
                    font-size: 14px;
                    font-weight: 700;
                    letter-spacing: 4px;
                    color: var(--color-gold);
                    text-transform: uppercase;
                    text-shadow: 0 0 15px rgba(212, 175, 55, 0.5);
                    animation: pulseText 1.5s ease-in-out infinite alternate;
                }

                @keyframes fadeInLoader {
                    to { opacity: 1; }
                }
                @keyframes floatUp {
                    to { transform: translateY(0) scale(1); }
                }
                @keyframes pulseLogo {
                    0% { transform: translateZ(20px) scale(0.9); filter: drop-shadow(0 0 10px rgba(212, 175, 55, 0.3)); }
                    100% { transform: translateZ(40px) scale(1.1); filter: drop-shadow(0 0 25px rgba(212, 175, 55, 0.8)); }
                }
                @keyframes pulseText {
                    0% { opacity: 0.5; letter-spacing: 3px; }
                    100% { opacity: 1; letter-spacing: 6px; }
                }
                @keyframes rotate3D1 {
                    0% { transform: rotateX(70deg) rotateY(0deg) rotateZ(0deg); }
                    100% { transform: rotateX(70deg) rotateY(360deg) rotateZ(360deg); }
                }
                @keyframes rotate3D2 {
                    0% { transform: rotateX(0deg) rotateY(70deg) rotateZ(0deg); }
                    100% { transform: rotateX(360deg) rotateY(70deg) rotateZ(360deg); }
                }
                @keyframes rotate3D3 {
                    0% { transform: rotateX(45deg) rotateY(45deg) rotateZ(0deg); }
                    100% { transform: rotateX(45deg) rotateY(45deg) rotateZ(360deg); }
                }
            `}</style>
        </div>
    );
}
