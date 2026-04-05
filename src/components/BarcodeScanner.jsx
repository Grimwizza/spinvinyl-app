import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, CheckCircle, Loader2, Plus, Disc, ScanLine, AlertCircle, Camera } from 'lucide-react';

// ─── BarcodeScanner ───────────────────────────────────────────────────────────
// Uses native BarcodeDetector API (Chrome/Android) for live scanning.
// Falls back to a file-capture input + manual barcode entry for iOS/Firefox.
export default function BarcodeScanner({ onClose, onAddSuccess, clearCollectionCache }) {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const animFrameRef = useRef(null);
    const detectorRef = useRef(null);

    // 'init' | 'scanning' | 'searching' | 'results' | 'empty' | 'error' | 'unsupported'
    const [phase, setPhase] = useState('init');
    const [barcode, setBarcode] = useState('');
    const [manualInput, setManualInput] = useState('');
    const [results, setResults] = useState([]);
    const [errorMsg, setErrorMsg] = useState('');
    const [adding, setAdding] = useState(null);   // release id being added
    const [added, setAdded] = useState({});        // { [id]: true }

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

    // Cleanup camera on unmount
    useEffect(() => {
        return () => stopCamera();
    }, []);

    const stopCamera = () => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
    };

    const searchByBarcode = useCallback(async (code) => {
        setPhase('searching');
        setBarcode(code);
        setErrorMsg('');
        try {
            const res = await fetch(`/api/discogs?action=barcodeSearch&barcode=${encodeURIComponent(code)}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Search failed');
            const items = data.results || [];
            setResults(items);
            setPhase(items.length > 0 ? 'results' : 'empty');
        } catch (e) {
            setErrorMsg(e.message);
            setPhase('error');
        }
    }, []);

    // ── Live scanning via BarcodeDetector ────────────────────────────────────
    const startLiveScanning = useCallback(async () => {
        if (!('BarcodeDetector' in window)) {
            setPhase('unsupported');
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }

            const formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'];
            // Filter to only formats the browser actually supports
            const supported = await BarcodeDetector.getSupportedFormats();
            const usable = formats.filter(f => supported.includes(f));
            detectorRef.current = new BarcodeDetector({ formats: usable.length > 0 ? usable : formats });

            setPhase('scanning');

            const tick = async () => {
                if (!videoRef.current || videoRef.current.readyState < 2) {
                    animFrameRef.current = requestAnimationFrame(tick);
                    return;
                }
                try {
                    const barcodes = await detectorRef.current.detect(videoRef.current);
                    if (barcodes.length > 0) {
                        stopCamera();
                        searchByBarcode(barcodes[0].rawValue);
                        return;
                    }
                } catch { /* no barcode this frame */ }
                animFrameRef.current = requestAnimationFrame(tick);
            };
            animFrameRef.current = requestAnimationFrame(tick);
        } catch (e) {
            if (e.name === 'NotAllowedError') {
                setErrorMsg('Camera permission denied. Use manual entry below.');
            } else {
                setErrorMsg('Could not start camera: ' + e.message);
            }
            setPhase('unsupported');
        }
    }, [searchByBarcode]);

    // ── File-based fallback ───────────────────────────────────────────────────
    const handleFilePick = useCallback(async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Try BarcodeDetector on the still image (works on Android even if live fails)
        if ('BarcodeDetector' in window) {
            try {
                const img = await createImageBitmap(file);
                const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'] });
                const codes = await detector.detect(img);
                if (codes.length > 0) {
                    searchByBarcode(codes[0].rawValue);
                    return;
                }
            } catch { /* fall through to manual */ }
        }
        // Couldn't auto-detect — prompt manual entry
        setErrorMsg('Barcode not detected in photo. Enter it manually below.');
        setPhase('unsupported');
    }, [searchByBarcode]);

    // Auto-start on mount
    useEffect(() => {
        startLiveScanning();
    }, [startLiveScanning]);

    const handleRescan = () => {
        setPhase('init');
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

    const handleAdd = async (release) => {
        setAdding(release.id);
        try {
            const res = await fetch(`/api/discogs?action=addToCollection&id=${release.id}`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to add to collection');
            setAdded(prev => ({ ...prev, [release.id]: true }));
            clearCollectionCache?.();
            onAddSuccess?.(release.title);
        } catch (e) {
            setErrorMsg(e.message);
        } finally {
            setAdding(null);
        }
    };

    const isPreResults = ['init', 'scanning'].includes(phase);

    return (
        <div className="fixed inset-0 z-[200] flex flex-col bg-black">

            {/* ── Header ── */}
            <div
                className="flex items-center justify-between px-4 pb-3 bg-black/80 backdrop-blur border-b border-white/10 flex-shrink-0"
                style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
            >
                <div>
                    <h2 className="text-white font-bold text-base">Scan a Record</h2>
                    <p className="text-gray-500 text-xs">Find the barcode on the back of the sleeve</p>
                </div>
                <button
                    onClick={onClose}
                    className="w-10 h-10 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-white/10 active:opacity-70 flex-shrink-0"
                >
                    <X size={20} className="text-white" />
                </button>
            </div>

            {/* ── Camera viewfinder ── */}
            <div className="relative bg-black overflow-hidden" style={{ flex: isPreResults ? 1 : '0 0 40vh' }}>
                <video
                    ref={videoRef}
                    className="absolute inset-0 w-full h-full object-cover"
                    playsInline
                    muted
                />

                {phase === 'scanning' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        {/* Dim overlay with cutout effect */}
                        <div className="absolute inset-0"
                             style={{ background: 'rgba(0,0,0,0.45)' }} />
                        {/* Scan box */}
                        <div className="relative w-72 h-44 z-10"
                             style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }}>
                            <div className="absolute inset-0 rounded-2xl border-2 border-violet-400/80" />
                            {/* Animated scan line */}
                            <div className="absolute inset-x-4 top-1/2 h-px bg-gradient-to-r from-transparent via-violet-400 to-transparent animate-pulse" />
                            {/* Corner marks */}
                            <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-violet-300 rounded-tl-2xl" />
                            <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-violet-300 rounded-tr-2xl" />
                            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-violet-300 rounded-bl-2xl" />
                            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-violet-300 rounded-br-2xl" />
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

                {/* Unsupported / camera failed — show camera placeholder */}
                {phase === 'unsupported' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-950">
                        <Camera size={48} className="text-gray-700" />
                    </div>
                )}
            </div>

            {/* ── Bottom panel ── */}
            <div className="bg-gray-950 border-t border-white/10 flex flex-col flex-shrink-0"
                 style={{ maxHeight: isPreResults ? '0' : '60vh', overflow: 'hidden', transition: 'max-height 0.3s ease' }}>

                {/* Panel header */}
                {!isPreResults && (
                    <div className="flex items-start justify-between px-4 py-3 border-b border-white/5 flex-shrink-0">
                        <div className="flex-1 min-w-0 pr-3">
                            {barcode && <p className="text-[10px] text-gray-600 font-mono tracking-wider truncate">{barcode}</p>}
                            <p className="text-sm font-medium text-gray-300">
                                {phase === 'searching' && 'Searching Discogs…'}
                                {phase === 'results' && `${results.length} release${results.length !== 1 ? 's' : ''} found`}
                                {phase === 'empty' && 'No Discogs match for this barcode'}
                                {phase === 'error' && <span className="text-red-400">{errorMsg}</span>}
                                {phase === 'unsupported' && (errorMsg || 'Live scanning not available — enter barcode manually')}
                            </p>
                        </div>
                        <button
                            onClick={handleRescan}
                            className="text-xs text-violet-400 font-bold px-3 py-2 min-h-[44px] min-w-[70px] rounded-xl bg-violet-500/10 border border-violet-500/20 active:opacity-70 flex-shrink-0"
                        >
                            Rescan
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
                                const isAdded = added[r.id];
                                const isAdding = adding === r.id;
                                const thumb = (r.cover_image && !r.cover_image.includes('spacer')) ? r.cover_image : null;
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
                                            onClick={() => !isAdded && !isAdding && handleAdd(r)}
                                            disabled={isAdded || isAdding}
                                            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold min-w-[76px] min-h-[44px] justify-center flex-shrink-0 transition-all ${
                                                isAdded
                                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                    : 'bg-violet-500/20 text-violet-300 border border-violet-500/30 active:scale-95 active:opacity-80'
                                            }`}
                                        >
                                            {isAdding
                                                ? <Loader2 size={14} className="animate-spin" />
                                                : isAdded
                                                    ? <><CheckCircle size={14} /><span>Added</span></>
                                                    : <><Plus size={14} /><span>Add</span></>
                                            }
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Empty / Error — show manual entry */}
                    {(phase === 'empty' || phase === 'error' || phase === 'unsupported') && (
                        <div className="px-4 pt-4 pb-6 flex flex-col gap-4">
                            {/* File capture button (iOS / fallback) */}
                            {phase === 'unsupported' && (
                                <label className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300 font-medium active:opacity-70 cursor-pointer min-h-[44px]">
                                    <Camera size={16} />
                                    <span>Take a Photo of the Barcode</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        className="sr-only"
                                        onChange={handleFilePick}
                                    />
                                </label>
                            )}

                            {/* Manual entry */}
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
                                {phase === 'unsupported' && (
                                    <p className="text-[11px] text-gray-600">
                                        💡 iPhone tip: open the Camera app, point at the barcode — it'll show a link you can look up.
                                    </p>
                                )}
                            </form>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
