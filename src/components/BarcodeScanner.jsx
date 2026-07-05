import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, CheckCircle, Loader2, Plus, Disc, ScanLine, Camera } from 'lucide-react';
import CollectionItemEditor from './CollectionItemEditor';

// Module-level in-memory cache for barcode searches (persists across scanner mounts/unmounts)
const barcodeCache = {};

// ─── BarcodeScanner ───────────────────────────────────────────────────────────
// Uses @zxing/browser BrowserMultiFormatReader for live camera UPC scanning.
// Works on iOS Safari (14.3+) AND Android Chrome via getUserMedia + canvas decoding.
// Also supports a manual title/artist text search for records with no barcode at all.
export default function BarcodeScanner({ onClose, onAddSuccess, clearCollectionCache, authUsername }) {
    const videoRef      = useRef(null);
    const controlsRef   = useRef(null);   // ZXing IScannerControls { stop() }
    const hasScannedRef = useRef(false);  // Guard: prevent double-firing searchByBarcode
    const isMountedRef  = useRef(true);

    // 'init' | 'scanning' | 'searchInput' | 'searching' | 'results' | 'empty' | 'error' | 'unsupported' | 'editDetails'
    const [phase, setPhase]             = useState('init');
    const [mode, setMode]               = useState('scan'); // 'scan' | 'search' — which entry point is active
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

    // ── Live scanning via @zxing/browser ─────────────────────────────────────
    // Dynamic import keeps ZXing (~500 KB) out of the initial app bundle.
    // ZXing owns the video element's stream — no separate getUserMedia or video.play() needed.
    const startLiveScanning = useCallback(async () => {
        hasScannedRef.current = false;
        setPhase('init');

        try {
            const { BrowserMultiFormatReader } = await import('@zxing/browser');
            const { NotFoundException } = await import('@zxing/library');
            const reader = new BrowserMultiFormatReader();

            setPhase('scanning');

            const controls = await reader.decodeFromConstraints(
                {
                    video: {
                        facingMode: { ideal: 'environment' },
                        width:  { ideal: 1280 },
                        height: { ideal: 720 },
                    },
                },
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
        } catch (e) {
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
    }, [searchByBarcode]);

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
        searchByText(q);
    };

    // Switch to the live-scanning camera view (from Search mode, or to resume after an add)
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
        saveUpcLocally(
            mode === 'scan' ? barcode : null,
            release,
            mode === 'search' ? { search_query: lastQuery } : {}
        );
        setAdded(prev => ({ ...prev, [release.id]: true }));
        clearCollectionCache?.();
        onAddSuccess?.(release.title);

        // Brief in-scanner confirmation, then resume scanning/searching so a whole stack
        // of records can be added in one session without closing the modal each time.
        setLastAdded(release.title);
        setTimeout(() => setLastAdded(null), 1800);
        if (mode === 'search') handleShowSearch();
        else handleShowScan();
    };

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
                    0%, 100% { border-color: rgba(167, 139, 250, 0.6); }
                    50% { border-color: rgba(192, 132, 252, 1); filter: drop-shadow(0 0 4px rgba(192, 132, 252, 0.6)); }
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
                            className={`text-xs font-bold px-2.5 py-1 rounded-full transition-colors ${mode === 'scan' ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' : 'text-gray-500 border border-transparent'}`}
                        >
                            Scan
                        </button>
                        <button
                            onClick={handleShowSearch}
                            className={`text-xs font-bold px-2.5 py-1 rounded-full transition-colors ${mode === 'search' ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' : 'text-gray-500 border border-transparent'}`}
                        >
                            Search
                        </button>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    aria-label="Close scanner"
                    className="w-10 h-10 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 transition-all flex-shrink-0"
                >
                    <X size={20} className="text-white" />
                </button>
            </div>
            )}

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
                            <div className="absolute inset-0 rounded-2xl border-2 border-violet-500/20" />
                            {/* Pulsing scanner overlay */}
                            <div className="absolute inset-0 rounded-2xl bg-violet-400/10 animate-scanner-pulse" />
                            {/* Sweeping laser line */}
                            <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-violet-400 to-transparent shadow-[0_0_8px_2px_rgba(167,139,250,0.6)] animate-scanner-sweep" />
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
                        <Loader2 size={32} className="text-violet-400 animate-spin" />
                    </div>
                )}

                {/* Camera failed — show placeholder */}
                {phase === 'unsupported' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-950">
                        <Camera size={48} className="text-gray-700" />
                    </div>
                )}
            </div>

            {/* ── Manual title/artist search view ── */}
            {isSearchInput && (
                <div className="flex-1 flex flex-col items-center justify-center px-6 bg-black">
                    <form onSubmit={handleSearchSubmit} className="w-full max-w-sm flex flex-col gap-3">
                        <p className="text-gray-400 text-sm text-center mb-2">Search by artist or album title — useful for records with no barcode</p>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="e.g. Fleetwood Mac Rumours"
                            autoFocus
                            className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 text-base text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                        />
                        <button
                            type="submit"
                            disabled={!searchQuery.trim()}
                            className="px-4 py-3 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300 text-sm font-bold min-h-[44px] disabled:opacity-40 active:opacity-70"
                        >
                            Search
                        </button>
                    </form>
                </div>
            )}

            {/* ── Bottom panel ── */}
            <div className="bg-gray-950 border-t border-white/10 flex flex-col flex-shrink-0"
                 style={{ maxHeight: (isPreResults || isEditDetails) ? '0' : '60vh', overflow: 'hidden', transition: 'max-height 0.3s ease' }}>

                {/* Panel header */}
                {!isPreResults && (
                    <div className="flex items-start justify-between px-4 py-3 border-b border-white/5 flex-shrink-0">
                        <div className="flex-1 min-w-0 pr-3">
                            {(barcode || lastQuery) && <p className="text-[10px] text-gray-600 font-mono tracking-wider truncate">{barcode || lastQuery}</p>}
                            <p className="text-sm font-medium text-gray-300">
                                {phase === 'searching' && 'Searching Discogs…'}
                                {phase === 'results' && `${results.length} release${results.length !== 1 ? 's' : ''} found`}
                                {phase === 'empty' && 'No Discogs match found'}
                                {phase === 'error' && <span className="text-red-400">{errorMsg}</span>}
                                {phase === 'unsupported' && (errorMsg || 'Live scanning not available — enter barcode manually')}
                            </p>
                        </div>
                        <button
                            onClick={mode === 'search' ? handleShowSearch : handleRescan}
                            className="text-xs text-violet-400 font-bold px-3 py-2 min-h-[44px] min-w-[70px] rounded-xl bg-violet-500/10 border border-violet-500/20 active:opacity-70 flex-shrink-0"
                        >
                            {mode === 'search' ? 'Search Again' : 'Rescan'}
                        </button>
                    </div>
                )}
            </div>

            {/* ── Full-height results / states ── */}
            {!isPreResults && (
                <div className="bg-gray-950 flex flex-col flex-1 overflow-hidden">

                    {phase === 'searching' && (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 size={28} className="text-violet-400 animate-spin" />
                        </div>
                    )}

                    {/* Results list */}
                    {phase === 'results' && (
                        <div className="overflow-y-auto flex-1" style={{ WebkitOverflowScrolling: 'touch' }}>
                            {results.map(r => {
                                const isAdded  = added[r.id];
                                const thumb    = (r.cover_image && !r.cover_image.includes('spacer')) ? r.cover_image : null;
                                return (
                                    <div key={r.id} className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.04]">
                                        {thumb ? (
                                            <img src={thumb} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0 bg-white/5" />
                                        ) : (
                                            <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                                                <Disc size={18} className="text-gray-600" />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white text-sm font-semibold leading-snug line-clamp-2">{r.title}</p>
                                            <p className="text-gray-500 text-xs mt-0.5">
                                                {[r.year, r.country, (r.format || []).slice(0, 2).join('/')].filter(Boolean).join(' · ')}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => !isAdded && handleSelectForEdit(r)}
                                            disabled={isAdded}
                                            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold min-w-[76px] min-h-[44px] justify-center flex-shrink-0 transition-all ${
                                                isAdded
                                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                    : 'bg-violet-500/20 text-violet-300 border border-violet-500/30 active:scale-95 active:opacity-80'
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
                                <p className="text-xs text-gray-500">Or enter the barcode number manually:</p>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={manualInput}
                                        onChange={e => setManualInput(e.target.value)}
                                        placeholder="e.g. 0602508007898"
                                        className="flex-1 bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 text-base text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!manualInput.trim()}
                                        className="px-4 py-3 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300 text-sm font-bold min-h-[44px] min-w-[70px] disabled:opacity-40 active:opacity-70"
                                    >
                                        Search
                                    </button>
                                </div>
                            </form>
                            <button
                                onClick={handleShowSearch}
                                className="text-xs text-gray-500 hover:text-violet-300 transition-colors text-center"
                            >
                                No barcode? Search by title instead
                            </button>
                        </div>
                    )}

                    {/* Empty / Error — search mode: let the user try a different query */}
                    {(phase === 'empty' || phase === 'error') && mode === 'search' && (
                        <div className="px-4 pt-4 pb-6">
                            <p className="text-xs text-gray-500 text-center">Try a different search, or switch to Scan to use the camera.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
