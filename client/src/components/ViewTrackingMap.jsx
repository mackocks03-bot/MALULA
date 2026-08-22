import React, { useState, useEffect, useRef } from 'react';

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

export default function ViewTrackingMap({ order, onClose }) {
    const mapDivRef   = useRef(null);
    const mapInstRef  = useRef(null);
    const animRef     = useRef(null);

    const [buyerName, setBuyerName] = useState('Buyer Location');
    const [sellerName, setSellerName] = useState('Seller Location');
    const [statusMsg, setStatusMsg] = useState('LOADING DISPATCH DATA...');

    useEffect(() => {
        let mounted = true;
        let vehicleMarker = null;

        const run = async () => {
            // 1. Load Leaflet
            injectCss('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', 'leaflet-css');
            await injectScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', 'leaflet-js');
            if (!mounted || !mapDivRef.current) return;

            const L = window.L;
            delete L.Icon.Default.prototype._getIconUrl;
            L.Icon.Default.mergeOptions({
                iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
                iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            });

            // 2. Map Init
            const map = L.map(mapDivRef.current, { zoomControl: false, attributionControl: false }).setView([0, 20], 2);
            mapInstRef.current = map;

            L.tileLayer(
                'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                { maxZoom: 19, attribution: 'Esri' }
            ).addTo(map);

            // Fetch seller's actual GPS from KYC if possible, else simulate
            let buyerLat, buyerLng, sellerLat, sellerLng;
            
            try {
                // If the order already saved GPS coords, we could use them, but we didn't add them to the order.
                // We will just read the actual user GPS right now to represent the buyer, and fetch the seller's KYC GPS.
                const { db, doc, getDoc } = await import('../services/firebase-config.js');
                
                // Get Seller GPS
                const sellerKyc = await getDoc(doc(db, 'businessVerification', order.sellerUid));
                if (sellerKyc.exists() && sellerKyc.data().gpsLocation) {
                    sellerLat = sellerKyc.data().gpsLocation.lat;
                    sellerLng = sellerKyc.data().gpsLocation.lng;
                }

                // Get Buyer GPS
                const buyerKyc = await getDoc(doc(db, 'businessVerification', order.buyerUid));
                if (buyerKyc.exists() && buyerKyc.data().gpsLocation) {
                    buyerLat = buyerKyc.data().gpsLocation.lat;
                    buyerLng = buyerKyc.data().gpsLocation.lng;
                } else if (navigator.geolocation) {
                    // fallback to current live location
                    const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10000 }));
                    buyerLat = pos.coords.latitude;
                    buyerLng = pos.coords.longitude;
                }
            } catch (err) {
                console.error("GPS Fetch Error:", err);
            }

            // Fallbacks if data missing
            if (!buyerLat) { buyerLat = -6.7924; buyerLng = 39.2083; }
            if (!sellerLat) { sellerLat = buyerLat + (Math.random() - 0.5) * 0.04; sellerLng = buyerLng + (Math.random() - 0.5) * 0.04; }

            // 3. Routing and Resolving Names
            let routeCoords = null;
            let resolvedBuyerName = 'Buyer Dest';
            let resolvedSellerName = 'Vendor';

            try {
                const [routeRes, buyerGeo, sellerGeo] = await Promise.allSettled([
                    fetch(`https://router.project-osrm.org/route/v1/driving/${sellerLng},${sellerLat};${buyerLng},${buyerLat}?overview=full&geometries=geojson`),
                    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${buyerLat}&lon=${buyerLng}&zoom=14`),
                    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${sellerLat}&lon=${sellerLng}&zoom=14`)
                ]);

                if (routeRes.status === 'fulfilled') {
                    const json = await routeRes.value.json();
                    if (json.routes?.[0]) routeCoords = json.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
                }
                if (buyerGeo.status === 'fulfilled') {
                    const bJson = await buyerGeo.value.json();
                    const bAddr = bJson.address || {};
                    resolvedBuyerName = bAddr.village || bAddr.suburb || bAddr.street || bAddr.town || bAddr.city || 'Buyer Dest';
                    if (mounted) setBuyerName(resolvedBuyerName);
                }
                if (sellerGeo.status === 'fulfilled') {
                    const sJson = await sellerGeo.value.json();
                    const sAddr = sJson.address || {};
                    resolvedSellerName = sAddr.village || sAddr.suburb || sAddr.street || sAddr.town || sAddr.city || 'Vendor';
                    if (mounted) setSellerName(`🏪 ${resolvedSellerName}`);
                }
            } catch (err) { }

            if (!mounted) return;
            if (!routeCoords) routeCoords = [[sellerLat, sellerLng], [buyerLat, buyerLng]];

            // Draw Route
            L.polyline(routeCoords, { color: '#00ffff', weight: 5, opacity: 0.9, dashArray: '12, 6' }).addTo(map);
            L.polyline(routeCoords, { color: '#00ffff', weight: 12, opacity: 0.18 }).addTo(map);

            // Markers
            const sellerIcon = L.divIcon({
                className: '',
                html: `<div style="width:18px;height:18px;background:#fbbf24;border-radius:50%;border:3px solid #fff;box-shadow:0 0 14px #fbbf24,0 0 28px rgba(251,191,36,0.5)"></div>`,
                iconAnchor: [9, 9],
            });
            L.marker([sellerLat, sellerLng], { icon: sellerIcon }).addTo(map).bindPopup(`<b>${resolvedSellerName}</b>`).openPopup();

            const buyerIcon = L.divIcon({
                className: '',
                html: `<div style="width:18px;height:18px;background:#00ffff;border-radius:50%;border:3px solid #fff;box-shadow:0 0 14px #00ffff,0 0 28px rgba(0,255,255,0.5)"></div>`,
                iconAnchor: [9, 9],
            });
            L.marker([buyerLat, buyerLng], { icon: buyerIcon }).addTo(map).bindPopup(`<b>${resolvedBuyerName}</b>`);

            map.fitBounds(L.latLngBounds(routeCoords), { padding: [30, 30] });

            // 4. Status Animations
            const oStatus = order.status || 'pending';
            if (oStatus === 'pending') {
                setStatusMsg('ORDER PENDING DISPATCH');
            } else if (oStatus === 'completed') {
                setStatusMsg('DELIVERY COMPLETED ✔');
                const vIcon = L.divIcon({ className: '', html: `<div style="font-size:22px;filter:drop-shadow(0 0 6px #22C55E)">🚚</div>`, iconAnchor: [11, 11] });
                L.marker(routeCoords[routeCoords.length - 1], { icon: vIcon }).addTo(map);
            } else if (oStatus === 'traveling') {
                setStatusMsg('ACTIVE TRANSIT — TRUCK EN ROUTE');
                const vIcon = L.divIcon({ className: '', html: `<div style="font-size:22px;filter:drop-shadow(0 0 6px #00ffff)">🚚</div>`, iconAnchor: [11, 11] });
                vehicleMarker = L.marker(routeCoords[0], { icon: vIcon }).addTo(map);

                // Ping-pong animation
                let step = 0;
                let direction = 1;
                const totalSteps = 150;
                const totalPoints = routeCoords.length;

                animRef.current = setInterval(() => {
                    if (!mounted) { clearInterval(animRef.current); return; }
                    step += direction;
                    if (step >= totalSteps) { direction = -1; }
                    else if (step <= 0) { direction = 1; }

                    const progress = step / totalSteps;
                    const idx = Math.min(Math.floor(progress * (totalPoints - 1)), totalPoints - 2);
                    const t = (progress * (totalPoints - 1)) - idx;
                    const lat = routeCoords[idx][0] + t * (routeCoords[idx + 1][0] - routeCoords[idx][0]);
                    const lng = routeCoords[idx][1] + t * (routeCoords[idx + 1][1] - routeCoords[idx][1]);
                    vehicleMarker.setLatLng([lat, lng]);
                }, 50);
            }
        };

        run();
        return () => {
            mounted = false;
            if (animRef.current) clearInterval(animRef.current);
            if (mapInstRef.current) { mapInstRef.current.remove(); mapInstRef.current = null; }
        };
    }, [order]);

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(5px)', zIndex: 9999,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
            animation: 'fadeInBg 0.3s'
        }}>
            <div style={{
                background: 'var(--bg-card)', borderTop: `1px solid var(--border-color)`,
                width: '100%', maxWidth: 600, overflow: 'hidden',
                boxShadow: `0 -10px 40px rgba(0,0,0,0.5)`,
                borderTopLeftRadius: 20, borderTopRightRadius: 20,
                animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                paddingBottom: 'env(safe-area-inset-bottom)'
            }}>
                <div style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '10px 0 6px' }}>
                    <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-color)' }} />
                </div>
                
                <div style={{ padding: '4px 20px 14px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 13, letterSpacing: 1.5 }}>TRACKING: {order.productName?.toUpperCase()}</div>
                    </div>
                    <div style={{
                        background: order.status === 'completed' ? 'rgba(34,197,94,0.1)' : order.status === 'traveling' ? 'rgba(59,130,246,0.1)' : 'rgba(249,115,22,0.1)',
                        color: order.status === 'completed' ? '#22C55E' : order.status === 'traveling' ? '#3B82F6' : '#F97316',
                        padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700
                    }}>
                        {(order.status || 'pending').toUpperCase()}
                    </div>
                </div>

                <div style={{ height: 320, position: 'relative', background: '#0d1420' }}>
                    <div ref={mapDivRef} style={{ height: '100%', width: '100%' }} />
                </div>

                <div style={{ padding: '7px 16px', background: '#0a0f1c', fontSize: 10, color: 'var(--color-gold)', letterSpacing: 1, fontFamily: 'monospace', borderBottom: '1px solid var(--border-color)' }}>
                    [ {statusMsg} ]
                </div>

                <div style={{ display: 'flex', gap: 10, padding: 16 }}>
                    <button style={{ flex: 1, padding: '13px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: 10, cursor: 'pointer', fontSize: 13 }} onClick={onClose}>
                        CLOSE MAP
                    </button>
                </div>
            </div>
        </div>
    );
}
