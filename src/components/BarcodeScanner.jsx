import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { X, CheckCircle, Loader2, Plus, Disc, ScanLine, Camera, Sparkles } from 'lucide-react';
import CollectionItemEditor from './CollectionItemEditor';

// Module-level in-memory cache for barcode searches (persists across scanner mounts/unmounts)
const barcodeCache = {};

// Lightweight relevance nudge on top of Discogs' own search ranking — not a full
// re-sort. Boosts standard full-length vinyl pressings (LP/Album) slightly above
// singles/EPs/box sets/promos, using a stable sort so ties keep Discogs' original order.
const FORMAT_SCORE = { LP: 2, Album: 1, Single: -1, EP: -1, 'Box Set': -1, Promo: -2, Unofficial: -3, Test: -2 };
function scoreResultFormat(r) {
    return (r.format || []).reduce((score, f) => score + (FORMAT_SCORE[f] || 0), 0);
}

const CAMERA_CONSTRAINTS = {
    video: {
        facingMode: { ideal: 'environment' },
        width:  { ideal: 1280 },
        height: { ideal: 720 },
    },
};
const BARCODE_FORMATS = ['upc_a', 'upc_e', 'ean_13', 'ean_8'];

// Native Shape Detection API — decodes without any JS/WASM overhead where available
// (Chrome/Edge 83+, Safari 17+). Firefox lacks it entirely, so this is always a
// feature-detected upgrade over @zxing/browser, never a hard requirement.
async function isNativeBarcodeDetectorViable() {
    if (!('BarcodeDetector' in window)) return false;
    try {
        const formats = await window.BarcodeDetector.getSupportedFormats();
        return BARCODE_FORMATS.some(f => formats.includes(f));
    } catch {
        return false;
    }
}

// Downscale a captured photo before sending it to /api/identify — phone camera photos
// can be several MB; this keeps payload size (and Anthropic API cost) small while
// preserving enough detail to read cover/label text.
function downscaleImageToDataUrl(file, { maxDim = 1280, quality = 0.8 } = {}) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            let { width, height } = img;
            if (width > maxDim || height > maxDim) {
                const scale = maxDim / Math.max(width, height);
                width = Math.round(width * scale);
                height = Math.round(height * scale);
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = url;
    });
}

// ─── BarcodeScanner ───────────────────────────────────────────────────────────
// Uses @zxing/browser BrowserMultiFormatReader for live camera UPC scanning.
// Works on iOS Safari (14.3+) AND Android Chrome via getUserMedia + canvas decoding.
// Also supports a manual title/artist text search for records with no barcode at all.
export default function BarcodeScanner({ onClose, onAddSuccess, clearCollectionCache, authUsername }) {
    const videoRef         = useRef(null);
    const controlsRef      = useRef(null);   // ZXing IScannerControls { stop() }
    const hasScannedRef    = useRef(false);  // Guard: prevent double-firing searchByBarcode
    const isMountedRef     = useRef(true);
    const activeDecoderRef = useRef(null);   // 'native' | 'zxing' | null — which backend currently owns the stream
    const rafIdRef         = useRef(null);   // requestAnimationFrame id for the native polling loop
    const photoInputRef    = useRef(null);   // hidden <input type=file> for AI cover-photo capture

    // 'init' | 'scanning' | 'searchInput' | 'identifying' | 'searching' | 'results' | 'empty' | 'error' | 'unsupported' | 'editDetails'
    const [phase, setPhase]             = useState('init');
    const [mode, setMode]               = useState('scan'); // 'scan' | 'search' | 'matrix' | 'photo' — which entry point is active
    const [barcode, setBarcode]         = useState('');
    const [manualInput, setManualInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [lastQuery, setLastQuery]     = useState('');
    const [results, setResults]         = useState([]);
    const [errorMsg, setErrorMsg]       = useState('');
    const [added, setAdded]             = useState({});     // { [id]: true }
    const [lastAdded, setLastAdded]     = useState(null);   // title shown in the brief "Added ✓" pill

    // ── Extended details state ──
    const [selectedRelease, setSelectedRelease] = useState(null);
    const [folders, setFolders]                 = useState([]);
    const [folderError, setFolderError]         = useState(false);
    const [collectionFields, setCollectionFields] = useState(null);

    // Setup mounted status tracking
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // Fetch user folders on mount
    useEffect(() => {
        fetch('/api/discogs?action=getFolders')
            .then(res => res.json())
            .then(data => {
                if (!isMountedRef.current) return;
                if (data.folders) setFolders(data.folders);
                else setFolderError(true);
            })
            .catch(e => {
                console.error('[BarcodeScanner] Failed to fetch folders:', e);
                if (isMountedRef.current) setFolderError(true);
            });
    }, []);

    // Fetch the user's collection field definitions (Media/Sleeve Condition, Notes, custom fields) on mount
    useEffect(() => {
        fetch('/api/discogs?action=getCollectionFields')
            .then(res => res.json())
            .then(data => {
                if (isMountedRef.current && data.fields) setCollectionFields(data);
            })
            .catch(e => console.error('[BarcodeScanner] Failed to fetch collection fields:', e));
    }, []);

    // Body scroll lock
    useEffect(() => {
        const scrollY = window.scrollY;
        document.body.classList.add('modal-open');
        document.body.style.top = `-${scrollY}px`;
        return () => {
            document.body.classList.remove('modal-open');
            document.body.style.top = '';
            window.scrollTo(0, scrollY);
        };
    }, []);

    // Cleanup ZXing controls on unmount
    useEffect(() => {
        return () => stopCamera();
    }, []);

    const stopCamera = () => {
        if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }
        activeDecoderRef.current = null;

        if (controlsRef.current) {
            try { controlsRef.current.stop(); } catch { /* ignore */ }
            controlsRef.current = null;
        }
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject;
            if (stream && typeof stream.getTracks === 'function') {
                stream.getTracks().forEach(track => {
                    try { track.stop(); } catch { /* ignore */ }
                });
            }
            videoRef.current.srcObject = null;
        }
    };

    const searchByBarcode = useCallback(async (code) => {
        stopCamera();
        setPhase('searching');
        setBarcode(code);
        setErrorMsg('');

        if (barcodeCache[code]) {
            const items = barcodeCache[code];
            setResults(items);
            setPhase(items.length > 0 ? 'results' : 'empty');
            return;
        }

        try {
            const res  = await fetch(`/api/discogs?action=barcodeSearch&barcode=${encodeURIComponent(code)}`);
            const data = await res.json();
            if (!isMountedRef.current) return;
            if (!res.ok) throw new Error(data.error || 'Search failed');
            const items = data.results || [];
            barcodeCache[code] = items;
            setResults(items);
            setPhase(items.length > 0 ? 'results' : 'empty');
        } catch (e) {
            if (!isMountedRef.current) return;
            setErrorMsg(e.message);
            setPhase('error');
        }
    }, []);

    const searchByText = useCallback(async (query) => {
        stopCamera();
        setPhase('searching');
        setLastQuery(query);
        setErrorMsg('');

        try {
            const res  = await fetch(`/api/discogs?action=searchByText&q=${encodeURIComponent(query)}`);
            const data = await res.json();
            if (!isMountedRef.current) return;
            if (!res.ok) throw new Error(data.error || 'Search failed');
            const items = data.results || [];
            setResults(items);
            setPhase(items.length > 0 ? 'results' : 'empty');
        } catch (e) {
            if (!isMountedRef.current) return;
            setErrorMsg(e.message);
            setPhase('error');
        }
    }, []);

    // Matrix/runout etching search — for identifying a specific pressing
    const searchByMatrix = useCallback(async (query) => {
        stopCamera();
        setPhase('searching');
        setLastQuery(query);
        setErrorMsg('');

        try {
            const res  = await fetch(`/api/discogs?action=matrixSearch&q=${encodeURIComponent(query)}`);
            const data = await res.json();
            if (!isMountedRef.current) return;
            if (!res.ok) throw new Error(data.error || 'Search failed');
            const items = data.results || [];
            setResults(items);
            setPhase(items.length > 0 ? 'results' : 'empty');
        } catch (e) {
            if (!isMountedRef.current) return;
            setErrorMsg(e.message);
            setPhase('error');
        }
    }, []);

    // ── Live scanning: native BarcodeDetector (near-instant, zero JS/WASM overhead)
    // where the browser supports it, falling back to @zxing/browser everywhere else
    // (Firefox, older Safari/Chrome). Both paths share the same hasScannedRef guard
    // and error-message mapping in startLiveScanning below.

    // Fallback path — ZXing owns the video element's stream, no separate getUserMedia needed.
    // Dynamic import keeps ZXing (~500 KB) out of the initial app bundle.
    const startZxingScanning = useCallback(async () => {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const { NotFoundException } = await import('@zxing/library');
        const reader = new BrowserMultiFormatReader();

        setPhase('scanning');

        const controls = await reader.decodeFromConstraints(
            CAMERA_CONSTRAINTS,
            videoRef.current,
            (result, err) => {
                if (result && !hasScannedRef.current) {
                    hasScannedRef.current = true;
                    searchByBarcode(result.getText());
                }
                // NotFoundException fires every frame when no barcode is visible — this is normal, ignore it
                if (err && !(err instanceof NotFoundException)) {
                    console.warn('[BarcodeScanner] ZXing decode error:', err);
                }
            }
        );

        // The scanner may have been closed (or "Search" tapped) while the camera was still
        // starting up — if so, stop the stream immediately instead of leaving it running.
        if (!isMountedRef.current) {
            try { controls.stop(); } catch { /* ignore */ }
            return;
        }

        controlsRef.current = controls;
        activeDecoderRef.current = 'zxing';
    }, [searchByBarcode]);

    // Native path — BarcodeDetector is a low-level decoder, not a stream owner, so this
    // acquires the camera directly and polls frames via a self-chained requestAnimationFrame
    // loop (the next frame is only scheduled once the current detect() resolves, so calls
    // never overlap/queue up).
    const startNativeScanning = useCallback(async () => {
        const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);

        if (!isMountedRef.current) {
            stream.getTracks().forEach(t => { try { t.stop(); } catch { /* ignore */ } });
            return;
        }

        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        activeDecoderRef.current = 'native';
        setPhase('scanning');

        const detector = new window.BarcodeDetector({ formats: BARCODE_FORMATS });

        const tick = async () => {
            // A stale tick scheduled before a mode-switch/unmount/rescan is a no-op.
            if (!isMountedRef.current || activeDecoderRef.current !== 'native') return;
            try {
                if (videoRef.current.readyState >= 2) { // HAVE_CURRENT_DATA — frame is decodable
                    const codes = await detector.detect(videoRef.current);
                    if (codes.length > 0 && !hasScannedRef.current) {
                        hasScannedRef.current = true;
                        searchByBarcode(codes[0].rawValue); // calls stopCamera() internally
                        return;
                    }
                }
            } catch (e) {
                console.warn('[BarcodeScanner] BarcodeDetector decode error:', e);
            }
            rafIdRef.current = requestAnimationFrame(tick);
        };
        rafIdRef.current = requestAnimationFrame(tick);
    }, [searchByBarcode]);

    const startLiveScanning = useCallback(async () => {
        hasScannedRef.current = false;
        setPhase('init');

        try {
            const useNative = await isNativeBarcodeDetectorViable();
            if (useNative) {
                await startNativeScanning();
            } else {
                await startZxingScanning();
            }
        } catch (e) {
            // Both paths' getUserMedia (native calls it directly; ZXing calls it internally)
            // throw the same DOMException names, so one mapping covers both backends.
            const msgs = {
                NotAllowedError:      'Camera permission denied. Allow camera access in your browser settings, or enter the barcode manually below.',
                PermissionDeniedError: 'Camera permission denied. Allow camera access in your browser settings, or enter the barcode manually below.',
                NotFoundError:        'No camera found on this device. Enter the barcode manually below.',
                DevicesNotFoundError: 'No camera found on this device. Enter the barcode manually below.',
                NotReadableError:     'Camera is in use by another app. Close it and try again, or enter the barcode manually.',
                TrackStartError:      'Camera is in use by another app. Close it and try again, or enter the barcode manually.',
                OverconstrainedError: 'Camera does not support the required settings. Enter the barcode manually below.',
            };
            setErrorMsg(msgs[e.name] || `Could not start camera: ${e.message}`);
            setPhase('unsupported');
        }
    }, [startNativeScanning, startZxingScanning]);

    // Auto-start the camera when the scanner first opens (it always mounts in 'scan' mode).
    // Without this, `phase` sits at its initial 'init' value forever — nothing else kicks
    // off `startLiveScanning`, so the modal just shows the loading spinner indefinitely.
    useEffect(() => {
        startLiveScanning();
        return () => stopCamera();
    }, [startLiveScanning]);

    const handleRescan = () => {
        setBarcode('');
        setManualInput('');
        setResults([]);
        setErrorMsg('');
        setAdded({});
        startLiveScanning();
    };

    const handleManualSubmit = (e) => {
        e.preventDefault();
        const code = manualInput.trim();
        if (!code) return;
        searchByBarcode(code);
    };

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        const q = searchQuery.trim();
        if (!q) return;
        if (mode === 'matrix') searchByMatrix(q);
        else searchByText(q);
    };

    // Switch to the live-scanning camera view (from Search/Matrix mode, or to resume after an add)
    const handleShowScan = () => {
        setMode('scan');
        setSearchQuery('');
        handleRescan();
    };

    // Switch to the manual title/artist search view (stops the camera)
    const handleShowSearch = () => {
        stopCamera();
        setMode('search');
        setPhase('searchInput');
        setErrorMsg('');
        setResults([]);
    };

    // Switch to the matrix/runout etching search view (stops the camera)
    const handleShowMatrix = () => {
        stopCamera();
        setMode('matrix');
        setPhase('searchInput');
        setErrorMsg('');
        setResults([]);
    };

    // Trigger the native camera-app/photo-library picker for AI cover identification.
    // Deliberately does not touch getUserMedia — see plan notes on capture mechanism.
    const handleShowPhoto = () => {
        stopCamera();
        setMode('photo');
        setErrorMsg('');
        setResults([]);
        photoInputRef.current?.click();
    };

    const handlePhotoFileChange = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // allow re-selecting the identical file next time
        if (!file) {
            // User cancelled the picker — return to a clean, recoverable state
            handleShowScan();
            return;
        }

        setMode('photo');
        setPhase('identifying');
        setErrorMsg('');

        try {
            const dataUrl = await downscaleImageToDataUrl(file, { maxDim: 1280, quality: 0.8 });
            const res  = await fetch('/api/identify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: dataUrl }),
            });
            const data = await res.json();
            if (!isMountedRef.current) return;
            if (!res.ok) throw new Error(data.error || 'Identify failed');

            const { artist, title } = data;
            if (artist && title) {
                // Confident extraction — go straight to the existing results flow
                const query = `${artist} ${title}`;
                setSearchQuery(query);
                await searchByText(query);
            } else {
                // Partial or unusable extraction — fall back to manual search, pre-filled
                const partial = [artist, title].filter(Boolean).join(' ');
                setMode('search');
                setPhase('searchInput');
                setSearchQuery(partial);
            }
        } catch (err) {
            if (!isMountedRef.current) return;
            console.warn('[BarcodeScanner] Photo identify failed:', err);
            setMode('search');
            setPhase('searchInput');
            setSearchQuery('');
        }
    };

    // ── Save scanned/searched item to localStorage ───────────────────────────
    const saveUpcLocally = (upc, release, formData) => {
        try {
            const existing = JSON.parse(localStorage.getItem('spinvinyl_scanned_upcs') || '[]');
            existing.unshift({
                upc: upc || null,
                discogs_username: authUsername || null,
                release_id:       String(release.id),
                release_title:    release.title,
                scanned_at:       new Date().toISOString(),
                ...formData
            });
            localStorage.setItem('spinvinyl_scanned_upcs', JSON.stringify(existing));
        } catch (e) {
            console.warn('[BarcodeScanner] Failed to save UPC locally:', e);
        }
    };

    const handleSelectForEdit = (release) => {
        setSelectedRelease(release);
        setPhase('editDetails');
        setErrorMsg('');
    };

    const handleItemSaved = (release) => {
        const provenance = mode === 'search' ? { search_query: lastQuery }
            : mode === 'matrix' ? { matrix_query: lastQuery }
            : mode === 'photo'  ? { photo_query: lastQuery }
            : {};
        saveUpcLocally(mode === 'scan' ? barcode : null, release, provenance);
        setAdded(prev => ({ ...prev, [release.id]: true }));
        clearCollectionCache?.();
        onAddSuccess?.(release.title);

        // Brief in-scanner confirmation, then resume scanning/searching so a whole stack
        // of records can be added in one session without closing the modal each time.
        setLastAdded(release.title);
        setTimeout(() => setLastAdded(null), 1800);
        if (mode === 'search') handleShowSearch();
        else if (mode === 'matrix') handleShowMatrix();
        else if (mode === 'photo') handleShowPhoto();
        else handleShowScan();
    };

    const sortedResults = useMemo(() => {
        return results
            .map((r, i) => ({ r, i, score: scoreResultFormat(r) }))
            .sort((a, b) => b.score - a.score || a.i - b.i) // stable: ties preserve Discogs' order
            .map(({ r }) => r);
    }, [results]);

    const isPreResults    = ['init', 'scanning', 'searchInput'].includes(phase);
    const isSearchInput   = phase === 'searchInput';
    const isEditDetails   = phase === 'editDetails';

    return (
        <div className="fixed inset-0 z-[200] flex flex-col bg-black">
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes scanner-sweep {
                    0% { top: 0%; opacity: 0.3; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { top: 100%; transform: translateY(-100%); opacity: 0.3; }
                }
                @keyframes scanner-pulse {
                    0%, 100% { opacity: 0.08; }
                    50% { opacity: 0.25; }
                }
                @keyframes corner-glow {
                    0%, 100% { border-color: rgba(217, 119, 72, 0.6); }
                    50% { border-color: rgba(217, 180, 99, 1); filter: drop-shadow(0 0 4px rgba(217, 180, 99, 0.6)); }
                }
                .animate-scanner-sweep {
                    animation: scanner-sweep 2.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                }
                .animate-scanner-pulse {
                    animation: scanner-pulse 1.8s ease-in-out infinite;
                }
                .animate-corner-glow {
                    animation: corner-glow 1.8s ease-in-out infinite;
                }
            `}} />

            {/* ── Header ── */}
            {!isEditDetails && (
            <div
                className="flex items-center justify-between px-4 pb-3 bg-black/80 backdrop-blur border-b border-white/10 flex-shrink-0"
                style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
            >
                <div>
                    <h2 className="text-white font-bold text-base">Scan a Record</h2>
                    <div className="flex items-center gap-1.5 mt-1.5">
                        <button
                            onClick={handleShowScan}
                            className={`text-xs font-bold px-2.5 py-1 rounded-full transition-colors ${mode === 'scan' ? 'bg-terracotta-500/20 text-terracotta-300 border border-terracotta-500/30' : 'text-stone-500 border border-transparent'}`}
                        >
                            Scan
                        </button>
                        <button
                            onClick={handleShowSearch}
                            className={`text-xs font-bold px-2.5 py-1 rounded-full transition-colors ${mode === 'search' ? 'bg-terracotta-500/20 text-terracotta-300 border border-terracotta-500/30' : 'text-stone-500 border border-transparent'}`}
                        >
                            Search
                        </button>
                        <button
                            onClick={handleShowMatrix}
                            className={`text-xs font-bold px-2.5 py-1 rounded-full transition-colors ${mode === 'matrix' ? 'bg-terracotta-500/20 text-terracotta-300 border border-terracotta-500/30' : 'text-stone-500 border border-transparent'}`}
                        >
                            Matrix
                        </button>
                        <button
                            onClick={handleShowPhoto}
                            aria-label="Identify by photo"
                            title="Identify by photo"
                            className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors ${mode === 'photo' ? 'bg-terracotta-500/20 text-terracotta-300 border border-terracotta-500/30' : 'text-stone-500 border border-transparent hover:text-terracotta-300'}`}
                        >
                            <Sparkles size={13} />
                        </button>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    aria-label="Close scanner"
                    className="w-10 h-10 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 transition-all flex-shrink-0"
                >
                    <X size={20} className="text-white" />
                </button>
            </div>
            )}

            <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoFileChange}
                className="hidden"
            />

            {/* ── Brief "Added ✓" confirmation while continuing to scan/search ── */}
            {lastAdded && !isEditDetails && (
                <div
                    className="absolute left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-full bg-green-500/90 text-black text-sm font-bold flex items-center gap-2 shadow-lg"
                    style={{ top: 'calc(max(16px, env(safe-area-inset-top)) + 72px)' }}
                >
                    <CheckCircle size={16} />
                    <span>Added &ldquo;{lastAdded}&rdquo;</span>
                </div>
            )}

            {/* ── Camera viewfinder ── */}
            <div className="relative bg-black overflow-hidden" style={{ flex: isPreResults ? 1 : '0 0 0px', display: (isEditDetails || isSearchInput) ? 'none' : undefined }}>
                <video
                    ref={videoRef}
                    className="absolute inset-0 w-full h-full object-cover"
                    playsInline
                    muted
                />

                {phase === 'scanning' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        {/* Dim overlay */}
                        <div className="absolute inset-0"
                             style={{ background: 'rgba(0,0,0,0.45)' }} />
                        {/* Scan box */}
                        <div className="relative w-72 h-44 z-10"
                             style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }}>
                            <div className="absolute inset-0 rounded-2xl border-2 border-terracotta-500/20" />
                            {/* Pulsing scanner overlay */}
                            <div className="absolute inset-0 rounded-2xl bg-terracotta-400/10 animate-scanner-pulse" />
                            {/* Sweeping laser line */}
                            <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-terracotta-400 to-transparent shadow-[0_0_8px_2px_rgba(217,119,72,0.6)] animate-scanner-sweep" />
                            {/* Corner marks */}
                            <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 rounded-tl-2xl animate-corner-glow" />
                            <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 rounded-tr-2xl animate-corner-glow" />
                            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 rounded-bl-2xl animate-corner-glow" />
                            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 rounded-br-2xl animate-corner-glow" />
                        </div>
                        <p className="relative z-10 text-white/70 text-sm mt-5 font-medium">
                            <ScanLine size={14} className="inline mr-1.5 mb-0.5" />
                            Scanning…
                        </p>
                    </div>
                )}

                {phase === 'init' && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 size={32} className="text-terracotta-400 animate-spin" />
                    </div>
                )}

                {/* Camera failed — show placeholder */}
                {phase === 'unsupported' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-stone-950">
                        <Camera size={48} className="text-stone-700" />
                    </div>
                )}
            </div>

            {/* ── Manual title/artist search view ── */}
            {isSearchInput && (
                <div className="flex-1 flex flex-col items-center justify-center px-6 bg-black">
                    <form onSubmit={handleSearchSubmit} className="w-full max-w-sm flex flex-col gap-3">
                        <p className="text-stone-400 text-sm text-center mb-2">
                            {mode === 'matrix'
                                ? 'Search by matrix/runout etching — identifies the exact pressing, stamped in the vinyl near the label'
                                : 'Search by artist or album title — useful for records with no barcode'}
                        </p>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder={mode === 'matrix' ? 'e.g. ST-746 A-1' : 'e.g. Fleetwood Mac Rumours'}
                            autoFocus
                            className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 text-base text-white placeholder-stone-600 focus:outline-none focus:border-terracotta-500/50 transition-colors"
                        />
                        <button
                            type="submit"
                            disabled={!searchQuery.trim()}
                            className="px-4 py-3 rounded-xl bg-terracotta-500/20 border border-terracotta-500/30 text-terracotta-300 text-sm font-bold min-h-[44px] disabled:opacity-40 active:opacity-70"
                        >
                            Search
                        </button>
                    </form>
                </div>
            )}

            {/* ── Bottom panel ── */}
            <div className="bg-stone-950 border-t border-white/10 flex flex-col flex-shrink-0"
                 style={{ maxHeight: (isPreResults || isEditDetails) ? '0' : '60vh', overflow: 'hidden', transition: 'max-height 0.3s ease' }}>

                {/* Panel header */}
                {!isPreResults && (
                    <div className="flex items-start justify-between px-4 py-3 border-b border-white/5 flex-shrink-0">
                        <div className="flex-1 min-w-0 pr-3">
                            {(barcode || lastQuery) && <p className="text-[10px] text-stone-600 font-mono tracking-wider truncate">{barcode || lastQuery}</p>}
                            <p className="text-sm font-medium text-stone-300">
                                {phase === 'identifying' && 'Reading the cover…'}
                                {phase === 'searching' && 'Searching Discogs…'}
                                {phase === 'results' && `${results.length} release${results.length !== 1 ? 's' : ''} found`}
                                {phase === 'empty' && 'No Discogs match found'}
                                {phase === 'error' && <span className="text-red-400">{errorMsg}</span>}
                                {phase === 'unsupported' && (errorMsg || 'Live scanning not available — enter barcode manually')}
                            </p>
                        </div>
                        <button
                            onClick={mode === 'search' ? handleShowSearch : mode === 'matrix' ? handleShowMatrix : mode === 'photo' ? handleShowPhoto : handleRescan}
                            className="text-xs text-terracotta-400 font-bold px-3 py-2 min-h-[44px] min-w-[70px] rounded-xl bg-terracotta-500/10 border border-terracotta-500/20 active:opacity-70 flex-shrink-0"
                        >
                            {mode === 'search' || mode === 'matrix' ? 'Search Again' : mode === 'photo' ? 'Retake Photo' : 'Rescan'}
                        </button>
                    </div>
                )}
            </div>

            {/* ── Full-height results / states ── */}
            {!isPreResults && (
                <div className="bg-stone-950 flex flex-col flex-1 overflow-hidden">

                    {(phase === 'searching' || phase === 'identifying') && (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 size={28} className="text-terracotta-400 animate-spin" />
                        </div>
                    )}

                    {/* Results list */}
                    {phase === 'results' && (
                        <div className="overflow-y-auto flex-1" style={{ WebkitOverflowScrolling: 'touch' }}>
                            {sortedResults.map((r, idx) => {
                                const isAdded  = added[r.id];
                                const thumb    = (r.cover_image && !r.cover_image.includes('spacer')) ? r.cover_image : null;
                                const isBest   = idx === 0 && sortedResults.length > 1;
                                const badges   = [r.year, r.country, (r.format || []).slice(0, 2).join('/')].filter(Boolean);
                                return (
                                    <div key={r.id} className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.04]">
                                        {thumb ? (
                                            <img src={thumb} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0 bg-white/5" />
                                        ) : (
                                            <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                                                <Disc size={18} className="text-stone-600" />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            {isBest && (
                                                <span className="inline-block text-[9px] font-bold uppercase tracking-wide text-terracotta-300 bg-terracotta-500/15 border border-terracotta-500/25 rounded px-1.5 py-0.5 mb-1">
                                                    Best match
                                                </span>
                                            )}
                                            <p className="text-white text-sm font-semibold leading-snug line-clamp-2">{r.title}</p>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {badges.map((b, i) => (
                                                    <span key={i} className="text-[10px] text-stone-400 bg-white/5 rounded px-1.5 py-0.5">
                                                        {b}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => !isAdded && handleSelectForEdit(r)}
                                            disabled={isAdded}
                                            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold min-w-[76px] min-h-[44px] justify-center flex-shrink-0 transition-all ${
                                                isAdded
                                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                    : 'bg-terracotta-500/20 text-terracotta-300 border border-terracotta-500/30 active:scale-95 active:opacity-80'
                                            }`}
                                        >
                                            {isAdded
                                                ? <><CheckCircle size={14} /><span>Added</span></>
                                                : <><Plus size={14} /><span>Add</span></>
                                            }
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Edit Details phase */}
                    {phase === 'editDetails' && selectedRelease && (
                        <CollectionItemEditor
                            release={selectedRelease}
                            mode="add"
                            folders={folders}
                            folderError={folderError}
                            collectionFields={collectionFields}
                            onCancel={() => setPhase('results')}
                            onSaved={handleItemSaved}
                        />
                    )}

                    {/* Empty / Error / Unsupported — manual barcode entry (scan mode only) */}
                    {(phase === 'empty' || phase === 'error' || phase === 'unsupported') && mode === 'scan' && (
                        <div className="px-4 pt-4 pb-6 flex flex-col gap-4">
                            <form onSubmit={handleManualSubmit} className="flex flex-col gap-3">
                                <p className="text-xs text-stone-500">Or enter the barcode number manually:</p>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={manualInput}
                                        onChange={e => setManualInput(e.target.value)}
                                        placeholder="e.g. 0602508007898"
                                        className="flex-1 bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 text-base text-white placeholder-stone-600 focus:outline-none focus:border-terracotta-500/50 transition-colors"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!manualInput.trim()}
                                        className="px-4 py-3 rounded-xl bg-terracotta-500/20 border border-terracotta-500/30 text-terracotta-300 text-sm font-bold min-h-[44px] min-w-[70px] disabled:opacity-40 active:opacity-70"
                                    >
                                        Search
                                    </button>
                                </div>
                            </form>
                            <button
                                onClick={handleShowSearch}
                                className="text-xs text-stone-500 hover:text-terracotta-300 transition-colors text-center"
                            >
                                No barcode? Search by title instead
                            </button>
                            <button
                                onClick={handleShowPhoto}
                                className="text-xs text-stone-500 hover:text-terracotta-300 transition-colors text-center"
                            >
                                Can&rsquo;t find it? Snap the cover instead
                            </button>
                        </div>
                    )}

                    {/* Empty / Error — search/matrix mode: let the user try a different query */}
                    {(phase === 'empty' || phase === 'error') && (mode === 'search' || mode === 'matrix') && (
                        <div className="px-4 pt-4 pb-6 flex flex-col gap-3">
                            <p className="text-xs text-stone-500 text-center">Try a different search, or switch to Scan to use the camera.</p>
                            <button
                                onClick={handleShowPhoto}
                                className="text-xs text-terracotta-400 font-bold text-center"
                            >
                                Snap the cover instead
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
