import React from 'react';
import Logo from './Logo.jsx';

export default function CinematicLoader({ text = "Processing..." }) {
    return (
        <div className="cinematic-loader-overlay">
            <div className="loader-inner-circle">
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
                    background: rgba(0, 0, 0, 0.4);
                    backdrop-filter: blur(4px);
                    -webkit-backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0;
                    animation: fadeInLoader 0.3s ease forwards;
                }
                .loader-inner-circle {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 16px;
                    width: 220px;
                    height: 220px;
                    background: rgba(15, 15, 20, 0.85);
                    border: 1px solid rgba(212, 175, 55, 0.2);
                    border-radius: 50%;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5), inset 0 0 20px rgba(212, 175, 55, 0.05);
                    transform: translateY(20px) scale(0.9);
                    animation: floatUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                .loader-3d-wrapper {
                    position: relative;
                    width: 90px;
                    height: 90px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    perspective: 800px;
                    transform-style: preserve-3d;
                }
                .loader-logo-container {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10;
                    transform: translateZ(20px);
                }
                .loader-logo-pulse {
                    transform-origin: center;
                    filter: drop-shadow(0 0 10px rgba(212, 175, 55, 0.5));
                    animation: pulseLogo 2s ease-in-out infinite alternate;
                }
                .loader-logo-pulse img {
                    width: 32px !important;
                    height: 32px !important;
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
                    box-shadow: 0 0 15px rgba(212, 175, 55, 0.15) inset;
                }
                .loader-ring-2 {
                    inset: 12px;
                    border-bottom-color: var(--color-gold);
                    border-right-color: rgba(212, 175, 55, 0.3);
                    animation: rotate3D2 4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                }
                .loader-ring-3 {
                    inset: 24px;
                    border-left-color: var(--color-gold);
                    border-top-color: rgba(212, 175, 55, 0.2);
                    animation: rotate3D3 5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                }
                .loader-text {
                    font-size: 11px;
                    font-weight: 700;
                    letter-spacing: 2px;
                    color: var(--color-gold);
                    text-transform: uppercase;
                    text-shadow: 0 0 10px rgba(212, 175, 55, 0.5);
                    animation: pulseText 1.5s ease-in-out infinite alternate;
                }

                @keyframes fadeInLoader {
                    to { opacity: 1; }
                }
                @keyframes floatUp {
                    to { transform: translateY(0) scale(1); }
                }
                @keyframes pulseLogo {
                    0% { transform: translateZ(10px) scale(0.9); }
                    100% { transform: translateZ(25px) scale(1.1); filter: drop-shadow(0 0 20px rgba(212, 175, 55, 0.8)); }
                }
                @keyframes pulseText {
                    0% { opacity: 0.6; }
                    100% { opacity: 1; }
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
