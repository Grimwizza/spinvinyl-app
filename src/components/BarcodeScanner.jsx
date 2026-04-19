import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, CheckCircle, Loader2, Plus, Disc, ScanLine, Camera, Star, ChevronLeft } from 'lucide-react';

// ─── BarcodeScanner ───────────────────────────────────────────────────────────
// Uses @zxing/browser BrowserMultiFormatReader for live camera UPC scanning.
// Works on iOS Safari (14.3+) AND Android Chrome via getUserMedia + canvas decoding.
// Falls back to manual barcode entry only (no file-upload fallback needed).
export default function BarcodeScanner({ onClose, onAddSuccess, clearCollectionCache, authUsername }) {
    const videoRef      = useRef(null);
    const controlsRef   = useRef(null);   // ZXing IScannerControls { stop() }
    const hasScannedRef = useRef(false);  // Guard: prevent double-firing searchByBarcode

    // 'init' | 'scanning' | 'searching' | 'results' | 'empty' | 'error' | 'unsupported'
    const [phase, setPhase]             = useState('init');
    const [barcode, setBarcode]         = useState('');
    const [manualInput, setManualInput] = useState('');
    const [results, setResults]         = useState([]);
    const [errorMsg, setErrorMsg]       = useState('');
    const [adding, setAdding]           = useState(null);   // release id being added
    const [added, setAdded]             = useState({});     // { [id]: true }

    // ── Extended details state ──
    const [selectedRelease, setSelectedRelease] = useState(null);
    const [folders, setFolders]                 = useState([]);
    const [formRating, setFormRating]           = useState(0);
    const [formFolder, setFormFolder]           = useState('1'); // Default uncategorized
    const [formMediaCond, setFormMediaCond]     = useState('Mint (M)');
    const [formSleeveCond, setFormSleeveCond]   = useState('Mint (M)');
    const [formNotes, setFormNotes]             = useState('');

    // Fetch user folders on mount
    useEffect(() => {
        fetch('/api/discogs?action=getFolders')
            .then(res => res.json())
            .then(data => {
                if (data.folders) setFolders(data.folders);
            })
            .catch(e => console.error('[BarcodeScanner] Failed to fetch folders:', e));
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
    };

    const searchByBarcode = useCallback(async (code) => {
        stopCamera();
        setPhase('searching');
        setBarcode(code);
        setErrorMsg('');
        try {
            const res  = await fetch(`/api/discogs?action=barcodeSearch&barcode=${encodeURIComponent(code)}`);
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

    // Auto-start on mount
    useEffect(() => {
        startLiveScanning();
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

    // ── Save scanned UPC to localStorage ─────────────────────────────────────
    const saveUpcLocally = (upc, release, formData) => {
        try {
            const existing = JSON.parse(localStorage.getItem('spinvinyl_scanned_upcs') || '[]');
            existing.unshift({
                upc,
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
        setFormRating(0);
        setFormFolder('1');
        setFormMediaCond('Mint (M)');
        setFormSleeveCond('Mint (M)');
        setFormNotes('');
        setErrorMsg('');
    };

    const handleExtendedAdd = async (e) => {
        e.preventDefault();
        if (!selectedRelease) return;
        setAdding(selectedRelease.id);
        setErrorMsg('');

        try {
            const payload = {
                folderId: formFolder,
                rating: formRating,
                condition: formMediaCond,
                sleeve_condition: formSleeveCond,
                notes: formNotes
            };

            const res = await fetch(`/api/discogs?action=addToCollectionExtended&id=${selectedRelease.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to add to collection');

            saveUpcLocally(barcode, selectedRelease, payload);

            setAdded(prev => ({ ...prev, [selectedRelease.id]: true }));
            clearCollectionCache?.();
            onAddSuccess?.(selectedRelease.title);
        } catch (err) {
            setErrorMsg(err.message);
        } finally {
            setAdding(null);
        }
    };

    const isPreResults = ['init', 'scanning'].includes(phase);
    const isEditDetails = phase === 'editDetails';

    return (
        <div className="fixed inset-0 z-[200] flex flex-col bg-black">

            {/* ── Header ── */}
            {!isEditDetails && (
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
            )}

            {/* ── Camera viewfinder ── */}
            <div className="relative bg-black overflow-hidden" style={{ flex: isPreResults ? 1 : '0 0 0px', display: isEditDetails ? 'none' : undefined }}>
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

                {/* Camera failed — show placeholder */}
                {phase === 'unsupported' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-950">
                        <Camera size={48} className="text-gray-700" />
                    </div>
                )}
            </div>

            {/* ── Bottom panel ── */}
            <div className="bg-gray-950 border-t border-white/10 flex flex-col flex-shrink-0"
                 style={{ maxHeight: (isPreResults || isEditDetails) ? '0' : '60vh', overflow: 'hidden', transition: 'max-height 0.3s ease' }}>

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
                                const isAdded  = added[r.id];
                                const isAdding = adding === r.id;
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
                                            onClick={() => !isAdded && !isAdding && handleSelectForEdit(r)}
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

                    {/* Edit Details phase */}
                    {phase === 'editDetails' && selectedRelease && (
                        <div className="flex flex-col h-full bg-black">
                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-4 bg-gray-950 border-b border-white/5"
                                 style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
                                <button onClick={() => setPhase('results')} className="text-sm font-semibold text-gray-400 hover:text-white transition-colors">Cancel</button>
                                <h3 className="text-white font-bold text-[15px]">Edit Details</h3>
                                <div className="w-[45px]"></div>
                            </div>

                            <div className="flex-1 overflow-y-auto px-5 py-6 space-y-7 pb-24">
                                {/* Release Preview */}
                                <div className="flex gap-4 items-center">
                                    <div className="w-[72px] h-[72px] rounded-sm overflow-hidden bg-white/5 border border-white/10 flex-shrink-0 shadow-lg relative">
                                        <img src={selectedRelease.thumb || selectedRelease.cover_image || '/api/placeholder/400/400'} alt="" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex flex-col justify-center min-w-0">
                                        <p className="text-white font-bold text-[15px] leading-tight mb-1 truncate">{selectedRelease.title}</p>
                                        <p className="text-gray-400 text-[13px] leading-snug">
                                            {[selectedRelease.year, selectedRelease.country, (selectedRelease.format || []).slice(0, 2).join('/')].filter(Boolean).join(' · ')}
                                        </p>
                                    </div>
                                </div>

                                <div className="w-full h-px bg-white/[0.04]"></div>

                                <div className="space-y-6">
                                    <p className="text-[13px] text-gray-400 font-medium tracking-wide">Added to Collection: <span className="text-white ml-2">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></p>

                                    {/* Rating */}
                                    <div>
                                        <label className="block text-[13px] font-medium text-gray-400 mb-2">My Rating</label>
                                        <div className="flex items-center gap-1.5 -ml-1">
                                            {[1, 2, 3, 4, 5].map(star => (
                                                <button key={star} onClick={() => setFormRating(star)} className="p-1 hover:scale-110 active:scale-95 transition-transform">
                                                    <Star size={28} strokeWidth={1.5} className={star <= formRating ? 'fill-amber-400 text-amber-400 drop-shadow-md' : 'text-gray-600'} />
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Folder */}
                                    <div>
                                        <label className="block text-[13px] font-medium text-gray-400 mb-2">Folder</label>
                                        <div className="relative">
                                            <select value={formFolder} onChange={e => setFormFolder(e.target.value)} className="w-full appearance-none bg-white/[0.02] border border-white/[0.08] hover:border-white/20 hover:bg-white/[0.04] transition-colors rounded-xl px-4 py-3.5 text-[15px] text-white focus:outline-none focus:ring-2 ring-violet-500/50">
                                                {folders.map(f => (
                                                    <option key={f.id} value={f.id} className="bg-gray-900 text-white">{f.name} ({f.count})</option>
                                                ))}
                                                {folders.length === 0 && <option value="1" className="bg-gray-900 text-white">Uncategorized</option>}
                                            </select>
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                                <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M1 1.5L6 6.5L11 1.5" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                </svg>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Conditions */}
                                    <div className="space-y-6">
                                        <div>
                                            <label className="block text-[13px] font-medium text-gray-400 mb-2">Media Condition</label>
                                            <div className="relative">
                                                <select value={formMediaCond} onChange={e => setFormMediaCond(e.target.value)} className="w-full appearance-none bg-white/[0.02] border border-white/[0.08] hover:border-white/20 hover:bg-white/[0.04] transition-colors rounded-xl px-4 py-3.5 text-[15px] text-white focus:outline-none focus:ring-2 ring-violet-500/50">
                                                    {['Mint (M)', 'Near Mint (NM or M-)', 'Very Good Plus (VG+)', 'Very Good (VG)', 'Good Plus (G+)', 'Good (G)', 'Fair (F)', 'Poor (P)'].map(c => <option className="bg-gray-900 text-white" key={c} value={c}>{c}</option>)}
                                                </select>
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                                    <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1.5L6 6.5L11 1.5" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[13px] font-medium text-gray-400 mb-2">Sleeve Condition</label>
                                            <div className="relative">
                                                <select value={formSleeveCond} onChange={e => setFormSleeveCond(e.target.value)} className="w-full appearance-none bg-white/[0.02] border border-white/[0.08] hover:border-white/20 hover:bg-white/[0.04] transition-colors rounded-xl px-4 py-3.5 text-[15px] text-white focus:outline-none focus:ring-2 ring-violet-500/50">
                                                    {['Mint (M)', 'Near Mint (NM or M-)', 'Very Good Plus (VG+)', 'Very Good (VG)', 'Good Plus (G+)', 'Good (G)', 'Fair (F)', 'Poor (P)', 'Generic', 'No Cover'].map(c => <option className="bg-gray-900 text-white" key={c} value={c}>{c}</option>)}
                                                </select>
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                                    <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1.5L6 6.5L11 1.5" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Notes */}
                                    <div className="pb-8">
                                        <label className="block text-[13px] font-medium text-gray-400 mb-2">Notes</label>
                                        <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows="4" placeholder="Enter Notes" className="w-full bg-white/[0.02] border border-white/[0.08] hover:border-white/20 transition-colors rounded-xl px-4 py-3.5 text-[15px] text-white placeholder-gray-600 focus:outline-none focus:ring-2 ring-violet-500/50 resize-none"></textarea>
                                        <div className="text-right text-[11px] font-medium text-gray-500 mt-1.5">{formNotes.length} / 255</div>
                                    </div>
                                </div>
                            </div>
                            
                            {errorMsg && <div className="px-5 pb-4 text-[13px] font-medium text-red-400 text-center">{errorMsg}</div>}

                            <div className="p-4 bg-gray-950 border-t border-white/5 flex-shrink-0 pb-safe">
                                <button
                                    onClick={handleExtendedAdd}
                                    disabled={!!adding}
                                    className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-white hover:bg-gray-200 text-black font-bold text-[15px] transition-all disabled:opacity-70 disabled:hover:bg-white"
                                >
                                    {adding ? <Loader2 size={18} className="animate-spin text-black" /> : 'Save changes'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Empty / Error / Unsupported — manual entry only */}
                    {(phase === 'empty' || phase === 'error' || phase === 'unsupported') && (
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
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
