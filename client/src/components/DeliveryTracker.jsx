import React, { useState, useEffect, useRef } from 'react';
import { getDistance } from 'geolib';

// ─── Pure imperative Leaflet loaded from CDN via <script> injection ───────────
// This avoids ALL react-leaflet Context/Consumer issues entirely.

function injectScript(src, id) {
    return new Promise((resolve, reject) => {
        if (document.getElementById(id)) { resolve(); return; }
        const s = document.createElement('script');
        s.id = id; s.src = src; s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
    });
}

function injectCss(href, id) {
    if (document.getElementById(id)) return;
    const l = document.createElement('link');
    l.id = id; l.rel = 'stylesheet'; l.href = href;
    document.head.appendChild(l);
}

export default function DeliveryTracker({ productName, amount, onClose, onComplete }) {
    const mapDivRef   = useRef(null);
    const mapInstRef  = useRef(null);
    const animRef     = useRef(null);

    const [phase, setPhase]       = useState('locating');
    // locating → zooming → routing → dispatching → ready
    const [distance, setDistance] = useState(null);
    const [statusMsg, setStatusMsg] = useState('ACQUIRING SATELLITE LOCK...');

    useEffect(() => {
        let mounted = true;
        let marker  = null;

        const run = async () => {
            // 1. Load Leaflet CSS + JS
            injectCss('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', 'leaflet-css');
            await injectScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', 'leaflet-js');
            if (!mounted || !mapDivRef.current) return;

            const L = window.L;

            // Fix broken default icon paths (common with bundlers)
            delete L.Icon.Default.prototype._getIconUrl;
            L.Icon.Default.mergeOptions({
                iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
                iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            });

            // 2. Create map — start at world view
            const map = L.map(mapDivRef.current, {
                zoomControl: false, attributionControl: false,
            }).setView([0, 20], 2);
            mapInstRef.current = map;

            // 3. Satellite tile layer (Esri World Imagery) — shows real houses/roads
            L.tileLayer(
                'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                { maxZoom: 19, attribution: 'Esri' }
            ).addTo(map);

            // 4. Get real GPS
            const getPos = () => new Promise((res, rej) => {
                if (!navigator.geolocation) { rej(new Error('no_geo')); return; }
                navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10000, enableHighAccuracy: true });
            });

            let buyerLat, buyerLng, sellerLat, sellerLng;

            try {
                if (mounted) { setPhase('locating'); setStatusMsg('AWAITING GPS SIGNAL — ALLOW LOCATION ACCESS'); }
                const pos = await getPos();
                buyerLat = pos.coords.latitude;
                buyerLng = pos.coords.longitude;
            } catch {
                // Fallback
                buyerLat = -6.7924; buyerLng = 39.2083;
                if (mounted) setStatusMsg('LOCATION RESTRICTED — USING REGIONAL NODE');
            }

            // Simulate seller ~2-5km away
            sellerLat = buyerLat + (Math.random() - 0.5) * 0.04;
            sellerLng = buyerLng + (Math.random() - 0.5) * 0.04;

            const dist = Math.max(1, Math.round(
                getDistance({ latitude: buyerLat, longitude: buyerLng },
                            { latitude: sellerLat, longitude: sellerLng }) / 1000
            ));
            if (mounted) setDistance(dist);

            // 5. Fly to buyer's real location (dramatic satellite zoom-in)
            if (mounted) { setPhase('zooming'); setStatusMsg('SATELLITE ZOOM-IN — TARGETING LOCATION...'); }
            map.flyTo([buyerLat, buyerLng], 16, { duration: 3.5, easeLinearity: 0.15 });

            await new Promise(r => setTimeout(r, 4000)); // wait for fly-in
            if (!mounted) return;

            // 6. Fetch REAL road route via OSRM (free, no API key)
            if (mounted) { setPhase('routing'); setStatusMsg('CALCULATING ROAD ROUTE VIA SATELLITE...'); }

            let routeCoords = null;
            try {
                const res = await fetch(
                    `https://router.project-osrm.org/route/v1/driving/${sellerLng},${sellerLat};${buyerLng},${buyerLat}?overview=full&geometries=geojson`
                );
                const json = await res.json();
                if (json.routes?.[0]) {
                    routeCoords = json.routes[0].geometry.coordinates
                        .map(([lng, lat]) => [lat, lng]); // OSRM gives [lng,lat], Leaflet wants [lat,lng]
                }
            } catch { /* fallback to straight line */ }

            if (!mounted) return;

            // Fallback: straight line with intermediate points
            if (!routeCoords) {
                routeCoords = [
                    [sellerLat, sellerLng],
                    [(sellerLat + buyerLat) / 2 + 0.001, (sellerLng + buyerLng) / 2],
                    [buyerLat, buyerLng],
                ];
            }

            // 7. Draw route line (cyan glow)
            const routeLine = L.polyline(routeCoords, {
                color: '#00ffff', weight: 5, opacity: 0.9, dashArray: '12, 6',
            }).addTo(map);

            // Glowing effect — second thicker transparent line underneath
            L.polyline(routeCoords, {
                color: '#00ffff', weight: 12, opacity: 0.18,
            }).addTo(map);

            // Seller marker (gold)
            const sellerIcon = window.L.divIcon({
                className: '',
                html: `<div style="width:18px;height:18px;background:#fbbf24;border-radius:50%;border:3px solid #fff;box-shadow:0 0 14px #fbbf24,0 0 28px rgba(251,191,36,0.5)"></div>`,
                iconAnchor: [9, 9],
            });
            L.marker([sellerLat, sellerLng], { icon: sellerIcon }).addTo(map)
                .bindPopup('<b>🏪 Seller</b>').openPopup();

            // Buyer marker (cyan)
            const buyerIcon = window.L.divIcon({
                className: '',
                html: `<div style="width:18px;height:18px;background:#00ffff;border-radius:50%;border:3px solid #fff;box-shadow:0 0 14px #00ffff,0 0 28px rgba(0,255,255,0.5)"></div>`,
                iconAnchor: [9, 9],
            });
            L.marker([buyerLat, buyerLng], { icon: buyerIcon }).addTo(map)
                .bindPopup('<b>📍 Your Location</b>');

            // Fit both markers in view
            map.fitBounds(L.latLngBounds(routeCoords), { padding: [30, 30] });

            // 8. Animate vehicle along the road
            if (mounted) { setPhase('dispatching'); setStatusMsg('VEHICLE DISPATCHED — EN ROUTE TO BUYER...'); }

            const vehicleIcon = window.L.divIcon({
                className: '',
                html: `<div style="font-size:22px;filter:drop-shadow(0 0 6px #00ffff)">🚚</div>`,
                iconAnchor: [11, 11],
            });
            marker = L.marker(routeCoords[0], { icon: vehicleIcon }).addTo(map);

            // Interpolate position along the route
            const totalSteps = 120;
            let step = 0;
            const totalPoints = routeCoords.length;

            animRef.current = setInterval(() => {
                if (!mounted) { clearInterval(animRef.current); return; }
                step++;
                const progress = step / totalSteps; // 0 → 1
                const idx = Math.min(Math.floor(progress * (totalPoints - 1)), totalPoints - 2);
                const t   = (progress * (totalPoints - 1)) - idx;
                const lat = routeCoords[idx][0] + t * (routeCoords[idx + 1][0] - routeCoords[idx][0]);
                const lng = routeCoords[idx][1] + t * (routeCoords[idx + 1][1] - routeCoords[idx][1]);
                marker.setLatLng([lat, lng]);

                if (step >= totalSteps) {
                    clearInterval(animRef.current);
                    marker.setLatLng([buyerLat, buyerLng]);
                    if (mounted) { setPhase('ready'); setStatusMsg('DELIVERY ROUTE CONFIRMED ✔'); }
                }
            }, 60); // ~7 seconds total animation
        };

        run().catch(console.error);

        return () => {
            mounted = false;
            if (animRef.current) clearInterval(animRef.current);
            if (mapInstRef.current) { mapInstRef.current.remove(); mapInstRef.current = null; }
        };
    }, []);

    const phaseColors = {
        locating:    '#F97316',
        zooming:     '#3B82F6',
        routing:     '#8B5CF6',
        dispatching: '#F59E0B',
        ready:       '#22C55E',
    };
    const color = phaseColors[phase] || '#00ffff';

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)',
            backdropFilter: 'blur(10px)', zIndex: 9999,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
            <div style={{
                background: 'var(--bg-card)', border: `1px solid ${color}44`,
                borderRadius: 16, width: '100%', maxWidth: 500, overflow: 'hidden',
                boxShadow: `0 0 40px ${color}22`,
            }}>
                {/* Header */}
                <div style={{ padding: '12px 16px', background: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ color, fontWeight: 700, fontSize: 12, letterSpacing: 2 }}>🛰️ DELIVERY TRACKING SYSTEM</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 2 }}>{productName}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, animation: 'dtPulse 1s ease-in-out infinite' }} />
                        <span style={{ fontSize: 10, color, fontWeight: 700 }}>{phase.toUpperCase()}</span>
                    </div>
                </div>

                {/* Map */}
                <div style={{ height: 300, position: 'relative', background: '#0d1420' }}>
                    <div ref={mapDivRef} style={{ height: '100%', width: '100%' }} />
                    {phase === 'locating' && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', background: 'rgba(10,15,28,0.8)' }}>
                            <div style={{ width: 32, height: 32, border: '3px solid #ffffff22', borderTopColor: '#00ffff', borderRadius: '50%', animation: 'dtSpin 0.85s linear infinite', marginBottom: 14 }} />
                            <div style={{ fontSize: 11, color: '#00ffff', letterSpacing: 2, fontFamily: 'monospace' }}>SEARCHING FOR GPS SIGNAL...</div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>Please allow location access</div>
                        </div>
                    )}
                </div>

                {/* Status bar */}
                <div style={{ padding: '7px 16px', background: '#0a0f1c', fontSize: 10, color, letterSpacing: 1, fontFamily: 'monospace', borderBottom: '1px solid var(--border-color)' }}>
                    [ {statusMsg} ]
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: 8, padding: '12px 16px 0' }}>
                    <div style={{ flex: 1, background: 'var(--bg-input)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: 1, marginBottom: 4 }}>DISTANCE</div>
                        <div style={{ fontSize: 20, color: 'var(--color-gold)', fontWeight: 700 }}>
                            {distance != null ? `${distance} KM` : '-- KM'}
                        </div>
                    </div>
                    <div style={{ flex: 1, background: 'var(--bg-input)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: 1, marginBottom: 4 }}>ORDER VALUE</div>
                        <div style={{ fontSize: 20, color: '#22C55E', fontWeight: 700 }}>{amount}</div>
                    </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 10, padding: 16 }}>
                    <button
                        style={{
                            flex: 2, padding: '13px', fontWeight: 700, fontSize: 14, borderRadius: 10, border: 'none',
                            background: phase === 'ready' ? 'var(--color-gold)' : '#1e293b',
                            color: phase === 'ready' ? '#0F172A' : '#475569',
                            cursor: phase === 'ready' ? 'pointer' : 'not-allowed',
                            transition: 'all 0.3s',
                        }}
                        onClick={phase === 'ready' ? onComplete : undefined}
                    >
                        {phase === 'ready' ? '🚀 CONFIRM & PLACE ORDER' : '⏳ TRACKING...'}
                    </button>
                    <button
                        style={{ flex: 1, padding: '13px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: 10, cursor: 'pointer', fontSize: 13 }}
                        onClick={onClose}
                    >CANCEL</button>
                </div>
            </div>

            <style>{`
                @keyframes dtSpin    { 100% { transform: rotate(360deg); } }
                @keyframes dtPulse   { 0%,100% { opacity:1; } 50% { opacity:0.25; } }
            `}</style>
        </div>
    );
}
