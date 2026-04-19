import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    X, CheckCircle, Loader2, Plus, Disc, Star,
    ScanText, Zap,
} from 'lucide-react';

// Module-level Tesseract worker cache — avoids re-initializing WASM on each scan
let _workerCache = null;

const getWorker = async () => {
    if (_workerCache) return _workerCache;
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng', 1, { logger: () => {} });
    await worker.setParameters({
        tessedit_pageseg_mode: '11',   // PSM.SPARSE_TEXT — finds text anywhere in image
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789- /',
    });
    _workerCache = worker;
    return worker;
};

const PROC_W = 800;
const PROC_H = 450;

// Five-pass preprocessing pipeline for reflective, low-contrast engraved text:
//   1. Perceptual grayscale (avoids red-channel lamp noise)
//   2. Glare clamp (specular reflections → 240 max, not 255)
//   3. Unsharp mask (amplifies engraving edges)
//   4. Invert (Tesseract expects dark-on-light; engravings appear bright under torch)
//   5. Adaptive local threshold (tolerates uneven illumination from angled torch)
function preprocessFrame(videoEl, canvas, ctx) {
    canvas.width  = PROC_W;
    canvas.height = PROC_H;
    ctx.drawImage(videoEl, 0, 0, PROC_W, PROC_H);
    const imageData = ctx.getImageData(0, 0, PROC_W, PROC_H);
    const data = imageData.data;
    const gray = new Uint8ClampedArray(PROC_W * PROC_H);

    // Pass 1+2: perceptual grayscale + glare clamp
    for (let i = 0; i < PROC_W * PROC_H; i++) {
        const lum = Math.round(0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]);
        gray[i] = lum > 240 ? 240 : lum;
    }

    // Pass 3+4: unsharp mask (3×3 box blur, amount=1.5) + invert combined
    const sharpened = new Uint8ClampedArray(PROC_W * PROC_H);
    for (let y = 0; y < PROC_H; y++) {
        for (let x = 0; x < PROC_W; x++) {
            const idx = y * PROC_W + x;
            let sum = 0, cnt = 0;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const ny = y + dy, nx = x + dx;
                    if (ny >= 0 && ny < PROC_H && nx >= 0 && nx < PROC_W) {
                        sum += gray[ny * PROC_W + nx]; cnt++;
                    }
                }
            }
            const v = gray[idx] + 1.5 * (gray[idx] - sum / cnt);
            sharpened[idx] = 255 - Math.max(0, Math.min(255, Math.round(v)));
        }
    }

    // Pass 5: adaptive threshold (11×11 window, offset=15)
    const HALF = 5, OFFSET = 15;
    const out = new Uint8ClampedArray(PROC_W * PROC_H * 4);
    for (let y = 0; y < PROC_H; y++) {
        for (let x = 0; x < PROC_W; x++) {
            const idx = y * PROC_W + x;
            let sum = 0, cnt = 0;
            for (let dy = -HALF; dy <= HALF; dy++) {
                for (let dx = -HALF; dx <= HALF; dx++) {
                    const ny = y + dy, nx = x + dx;
                    if (ny >= 0 && ny < PROC_H && nx >= 0 && nx < PROC_W) {
                        sum += sharpened[ny * PROC_W + nx]; cnt++;
                    }
                }
            }
            const val = sharpened[idx] < (sum / cnt) - OFFSET ? 0 : 255;
            out[idx * 4] = out[idx * 4 + 1] = out[idx * 4 + 2] = val;
            out[idx * 4 + 3] = 255;
        }
    }
    imageData.data.set(out);
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
}

const CONDITIONS = ['Mint (M)', 'Near Mint (NM or M-)', 'Very Good Plus (VG+)', 'Very Good (VG)', 'Good Plus (G+)', 'Good (G)', 'Fair (F)', 'Poor (P)'];
const SLEEVE_CONDITIONS = [...CONDITIONS, 'Generic', 'No Cover'];

export default function MatrixScanner({ onClose, onAddSuccess, clearCollectionCache }) {
    const videoRef     = useRef(null);
    const canvasRef    = useRef(null);
    const canvasCtxRef = useRef(null);
    const streamRef    = useRef(null);

    const [phase, setPhase]               = useState('init');
    const [extractedText, setExtractedText] = useState('');
    const [manualInput, setManualInput]   = useState('');
    const [results, setResults]           = useState([]);
    const [errorMsg, setErrorMsg]         = useState('');
    const [torchOn, setTorchOn]           = useState(false);
    const [torchAvailable, setTorchAvailable] = useState(true);
    const [adding, setAdding]             = useState(null);
    const [added, setAdded]               = useState({});

    // editDetails form state
    const [selectedRelease, setSelectedRelease] = useState(null);
    const [folders, setFolders]           = useState([]);
    const [formRating, setFormRating]     = useState(0);
    const [formFolder, setFormFolder]     = useState('1');
    const [formMediaCond, setFormMediaCond]   = useState('Mint (M)');
    const [formSleeveCond, setFormSleeveCond] = useState('Mint (M)');
    const [formNotes, setFormNotes]       = useState('');

    useEffect(() => {
        fetch('/api/discogs?action=getFolders')
            .then(r => r.json())
            .then(d => { if (d.folders) setFolders(d.folders); })
            .catch(() => {});
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

    // Teardown on unmount
    useEffect(() => {
        return () => {
            stopCamera();
            if (_workerCache) {
                _workerCache.terminate().catch(() => {});
                _workerCache = null;
            }
        };
    }, []);

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        if (videoRef.current) videoRef.current.srcObject = null;
    };

    const startCamera = useCallback(async () => {
        setPhase('init');
        setResults([]);
        setExtractedText('');
        setErrorMsg('');
        setAdded({});
        setTorchOn(false);
        setTorchAvailable(true);

        if (canvasRef.current && !canvasCtxRef.current) {
            canvasCtxRef.current = canvasRef.current.getContext('2d');
        }

        try {
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: { exact: 'environment' },
                        width:  { ideal: 1920, min: 1280 },
                        height: { ideal: 1080, min: 720 },
                    },
                    audio: false,
                });
            } catch (e) {
                if (e.name === 'OverconstrainedError' || e.name === 'NotFoundError') {
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
                        audio: false,
                    });
                } else { throw e; }
            }

            streamRef.current = stream;
            videoRef.current.srcObject = stream;
            await videoRef.current.play();

            const [track] = stream.getVideoTracks();
            const caps = track.getCapabilities?.() ?? {};
            setTorchAvailable(!!caps.torch);

            setPhase('scanning');
            // Pre-warm Tesseract while user positions camera
            getWorker().catch(() => {});
        } catch (e) {
            const msgs = {
                NotAllowedError:       'Camera permission denied. Allow camera access in your browser settings.',
                PermissionDeniedError: 'Camera permission denied. Allow camera access in your browser settings.',
                NotFoundError:         'No rear camera found on this device.',
                NotReadableError:      'Camera is in use by another app. Close it and try again.',
            };
            setErrorMsg(msgs[e.name] || `Could not start camera: ${e.message}`);
            setPhase('unsupported');
        }
    }, []);

    useEffect(() => { startCamera(); }, [startCamera]);

    const toggleTorch = async () => {
        if (!streamRef.current) return;
        const [track] = streamRef.current.getVideoTracks();
        if (!track) return;
        const caps = track.getCapabilities?.() ?? {};
        if (!caps.torch) { setTorchAvailable(false); return; }
        const next = !torchOn;
        try {
            await track.applyConstraints({ advanced: [{ torch: next }] });
            setTorchOn(next);
        } catch {
            setTorchAvailable(false);
        }
    };

    const searchByMatrix = useCallback(async (text) => {
        setPhase('searching');
        setErrorMsg('');
        try {
            const res  = await fetch(`/api/discogs?action=matrixSearch&q=${encodeURIComponent(text)}`);
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

    const captureAndOCR = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current || !canvasCtxRef.current) return;
        setPhase('capturing');

        const frameResults = [];
        for (let i = 0; i < 3; i++) {
            const dataUrl = preprocessFrame(videoRef.current, canvasRef.current, canvasCtxRef.current);
            setPhase('processing');
            try {
                const worker = await getWorker();
                const { data } = await worker.recognize(dataUrl);
                frameResults.push({ text: data.text.trim(), confidence: data.confidence });
            } catch (err) {
                console.warn('[MatrixScanner] OCR frame', i, 'failed:', err);
            }
            if (i < 2) await new Promise(r => setTimeout(r, 400));
        }

        if (frameResults.length === 0) {
            setErrorMsg('OCR failed. Check permissions and try again.');
            setPhase('error');
            return;
        }

        frameResults.sort((a, b) => b.confidence - a.confidence);
        const best = frameResults[0];

        if (!best.text || best.confidence < 40) {
            setErrorMsg('Could not read matrix text. Hold camera steady with torch on, close to the dead wax area.');
            setPhase('empty');
            return;
        }

        setExtractedText(best.text);
        await searchByMatrix(best.text);
    }, [searchByMatrix]);

    const handleManualSubmit = (e) => {
        e.preventDefault();
        const text = manualInput.trim();
        if (!text) return;
        setExtractedText(text);
        searchByMatrix(text);
    };

    const handleRescan = () => {
        stopCamera();
        setManualInput('');
        startCamera();
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
            const res = await fetch(`/api/discogs?action=addToCollectionExtended&id=${selectedRelease.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    folderId: formFolder,
                    rating: formRating,
                    condition: formMediaCond,
                    sleeve_condition: formSleeveCond,
                    notes: formNotes,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to add to collection');
            setAdded(prev => ({ ...prev, [selectedRelease.id]: true }));
            clearCollectionCache?.();
            onAddSuccess?.(selectedRelease.title);
        } catch (err) {
            setErrorMsg(err.message);
        } finally {
            setAdding(null);
        }
    };

    const isPreResults  = ['init', 'scanning', 'capturing', 'processing'].includes(phase);
    const isActive      = ['init', 'scanning'].includes(phase);
    const isEditDetails = phase === 'editDetails';

    return (
        <div className="fixed inset-0 z-[200] flex flex-col bg-black">

            {/* Header */}
            {!isEditDetails && (
                <div
                    className="flex items-center justify-between px-4 pb-3 bg-black/80 backdrop-blur border-b border-white/10 flex-shrink-0"
                    style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
                >
                    <div>
                        <h2 className="text-white font-bold text-base">Scan Matrix Number</h2>
                        <p className="text-gray-500 text-xs">Point at the dead wax runout groove</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-white/10 active:opacity-70 flex-shrink-0"
                    >
                        <X size={20} className="text-white" />
                    </button>
                </div>
            )}

            {/* Camera viewfinder */}
            <div
                className="relative bg-black overflow-hidden"
                style={{ flex: isPreResults ? 1 : '0 0 0px', display: isEditDetails ? 'none' : undefined }}
            >
                <video
                    ref={videoRef}
                    className="absolute inset-0 w-full h-full object-cover"
                    playsInline
                    muted
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Circular reticle — dead wax is a ring, not a rectangle */}
                {phase === 'scanning' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.40)' }} />
                        <div
                            className="relative z-10 w-56 h-56 rounded-full border-2 border-amber-400/70"
                            style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.40)' }}
                        >
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                            </div>
                        </div>
                        <p className="relative z-10 text-white/70 text-sm mt-5 font-medium">
                            <ScanText size={14} className="inline mr-1.5 mb-0.5" />
                            Aim at the dead wax — then tap Scan
                        </p>
                    </div>
                )}

                {phase === 'init' && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 size={32} className="text-amber-400 animate-spin" />
                    </div>
                )}

                {(phase === 'capturing' || phase === 'processing') && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
                        <Loader2 size={36} className="text-amber-400 animate-spin mb-3" />
                        <p className="text-white/80 text-sm font-medium">
                            {phase === 'capturing' ? 'Capturing frame…' : 'Running OCR…'}
                        </p>
                    </div>
                )}

                {phase === 'unsupported' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-950">
                        <Disc size={48} className="text-gray-700" />
                    </div>
                )}

                {/* Torch + Scan buttons */}
                {isActive && (
                    <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-6 pointer-events-auto z-20">
                        {torchAvailable && (
                            <button
                                onClick={toggleTorch}
                                className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all active:scale-90 ${
                                    torchOn
                                        ? 'bg-amber-400 border-amber-300 shadow-lg shadow-amber-400/40'
                                        : 'bg-white/10 border-white/20'
                                }`}
                            >
                                <Zap size={22} className={torchOn ? 'text-black' : 'text-white'} />
                            </button>
                        )}
                        <button
                            onClick={captureAndOCR}
                            className="w-20 h-20 rounded-full bg-amber-400 border-4 border-amber-200 flex items-center justify-center shadow-2xl shadow-amber-400/40 active:scale-95 transition-transform"
                        >
                            <ScanText size={30} className="text-black" />
                        </button>
                    </div>
                )}
            </div>

            {/* Post-capture status bar */}
            {!isPreResults && !isEditDetails && (
                <div className="bg-gray-950 border-t border-white/10 flex items-start justify-between px-4 py-3 flex-shrink-0">
                    <div className="flex-1 min-w-0 pr-3">
                        {extractedText && (
                            <p className="text-[10px] text-gray-600 font-mono tracking-wider truncate">
                                &ldquo;{extractedText}&rdquo;
                            </p>
                        )}
                        <p className="text-sm font-medium text-gray-300">
                            {phase === 'searching'   && 'Searching Discogs…'}
                            {phase === 'results'     && `${results.length} release${results.length !== 1 ? 's' : ''} found`}
                            {(phase === 'empty' || phase === 'unsupported') && (errorMsg || 'No match — try scanning again or enter manually')}
                            {phase === 'error'       && <span className="text-red-400">{errorMsg}</span>}
                        </p>
                    </div>
                    <button
                        onClick={handleRescan}
                        className="text-xs text-amber-400 font-bold px-3 py-2 min-h-[44px] min-w-[70px] rounded-xl bg-amber-500/10 border border-amber-500/20 active:opacity-70 flex-shrink-0"
                    >
                        Rescan
                    </button>
                </div>
            )}

            {/* Results / states panel */}
            {!isPreResults && !isEditDetails && (
                <div className="bg-gray-950 flex flex-col flex-1 overflow-hidden">

                    {phase === 'searching' && (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 size={28} className="text-amber-400 animate-spin" />
                        </div>
                    )}

                    {phase === 'results' && (
                        <div className="overflow-y-auto flex-1" style={{ WebkitOverflowScrolling: 'touch' }}>
                            {results.map(r => {
                                const isAdded  = added[r.id];
                                const isAdding = adding === r.id;
                                const thumb = (r.cover_image && !r.cover_image.includes('spacer')) ? r.cover_image : null;
                                return (
                                    <div key={r.id} className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.04]">
                                        {thumb
                                            ? <img src={thumb} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0 bg-white/5" />
                                            : <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0"><Disc size={18} className="text-gray-600" /></div>
                                        }
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
                                                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 active:scale-95 active:opacity-80'
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

                    {/* Manual entry fallback for empty / error / unsupported */}
                    {(phase === 'empty' || phase === 'error' || phase === 'unsupported') && (
                        <div className="px-4 pt-4 pb-6">
                            <form onSubmit={handleManualSubmit} className="flex flex-col gap-3">
                                <p className="text-xs text-gray-500">Or enter the matrix number manually:</p>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={manualInput}
                                        onChange={e => setManualInput(e.target.value)}
                                        placeholder="e.g. BSS-1-A STERLING"
                                        className="flex-1 bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 text-base text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!manualInput.trim()}
                                        className="px-4 py-3 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300 text-sm font-bold min-h-[44px] min-w-[70px] disabled:opacity-40 active:opacity-70"
                                    >
                                        Search
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            )}

            {/* editDetails phase */}
            {isEditDetails && selectedRelease && (
                <div className="flex flex-col h-full bg-black">
                    <div
                        className="flex items-center justify-between px-4 py-4 bg-gray-950 border-b border-white/5"
                        style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
                    >
                        <button
                            onClick={() => setPhase('results')}
                            className="text-sm font-semibold text-gray-400 hover:text-white transition-colors min-h-[44px] px-1"
                        >
                            Cancel
                        </button>
                        <h3 className="text-white font-bold text-[15px]">Edit Details</h3>
                        <div className="w-[45px]" />
                    </div>

                    <div className="flex-1 overflow-y-auto px-5 py-6 space-y-7" style={{ WebkitOverflowScrolling: 'touch' }}>
                        {/* Release preview */}
                        <div className="flex gap-4 items-center">
                            <div className="w-[72px] h-[72px] rounded-sm overflow-hidden bg-white/5 border border-white/10 flex-shrink-0 shadow-lg">
                                <img
                                    src={selectedRelease.thumb || selectedRelease.cover_image || ''}
                                    alt=""
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div className="flex flex-col justify-center min-w-0">
                                <p className="text-white font-bold text-[15px] leading-tight mb-1 line-clamp-2">{selectedRelease.title}</p>
                                <p className="text-gray-400 text-[13px] leading-snug">
                                    {[selectedRelease.year, selectedRelease.country, (selectedRelease.format || []).slice(0, 2).join('/')].filter(Boolean).join(' · ')}
                                </p>
                            </div>
                        </div>

                        <div className="w-full h-px bg-white/[0.04]" />

                        <div className="space-y-6 pb-8">
                            {/* Rating */}
                            <div>
                                <label className="block text-[13px] font-medium text-gray-400 mb-2">My Rating</label>
                                <div className="flex items-center gap-1.5 -ml-1">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <button
                                            key={star}
                                            onClick={() => setFormRating(star)}
                                            className="p-1 hover:scale-110 active:scale-95 transition-transform"
                                        >
                                            <Star
                                                size={28}
                                                strokeWidth={1.5}
                                                className={star <= formRating ? 'fill-amber-400 text-amber-400 drop-shadow-md' : 'text-gray-600'}
                                            />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Folder */}
                            <div>
                                <label className="block text-[13px] font-medium text-gray-400 mb-2">Folder</label>
                                <div className="relative">
                                    <select
                                        value={formFolder}
                                        onChange={e => setFormFolder(e.target.value)}
                                        className="w-full appearance-none bg-white/[0.02] border border-white/[0.08] rounded-xl px-4 py-3.5 text-[15px] text-white focus:outline-none focus:ring-2 ring-amber-500/50"
                                    >
                                        {folders.length === 0
                                            ? <option value="1" className="bg-gray-900">Uncategorized</option>
                                            : folders.map(f => <option key={f.id} value={f.id} className="bg-gray-900">{f.name} ({f.count})</option>)
                                        }
                                    </select>
                                </div>
                            </div>

                            {/* Media Condition */}
                            <div>
                                <label className="block text-[13px] font-medium text-gray-400 mb-2">Media Condition</label>
                                <div className="relative">
                                    <select
                                        value={formMediaCond}
                                        onChange={e => setFormMediaCond(e.target.value)}
                                        className="w-full appearance-none bg-white/[0.02] border border-white/[0.08] rounded-xl px-4 py-3.5 text-[15px] text-white focus:outline-none focus:ring-2 ring-amber-500/50"
                                    >
                                        {CONDITIONS.map(c => <option key={c} value={c} className="bg-gray-900">{c}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Sleeve Condition */}
                            <div>
                                <label className="block text-[13px] font-medium text-gray-400 mb-2">Sleeve Condition</label>
                                <div className="relative">
                                    <select
                                        value={formSleeveCond}
                                        onChange={e => setFormSleeveCond(e.target.value)}
                                        className="w-full appearance-none bg-white/[0.02] border border-white/[0.08] rounded-xl px-4 py-3.5 text-[15px] text-white focus:outline-none focus:ring-2 ring-amber-500/50"
                                    >
                                        {SLEEVE_CONDITIONS.map(c => <option key={c} value={c} className="bg-gray-900">{c}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-[13px] font-medium text-gray-400 mb-2">Notes</label>
                                <textarea
                                    value={formNotes}
                                    onChange={e => setFormNotes(e.target.value.slice(0, 255))}
                                    rows={4}
                                    placeholder="Enter Notes"
                                    className="w-full bg-white/[0.02] border border-white/[0.08] rounded-xl px-4 py-3.5 text-[15px] text-white placeholder-gray-600 focus:outline-none focus:ring-2 ring-amber-500/50 resize-none"
                                />
                                <div className="text-right text-[11px] font-medium text-gray-500 mt-1.5">{formNotes.length} / 255</div>
                            </div>
                        </div>
                    </div>

                    {errorMsg && (
                        <div className="px-5 pb-4 text-[13px] font-medium text-red-400 text-center">{errorMsg}</div>
                    )}

                    <div className="p-4 bg-gray-950 border-t border-white/5 flex-shrink-0" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
                        <button
                            onClick={handleExtendedAdd}
                            disabled={!!adding}
                            className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-white hover:bg-gray-200 text-black font-bold text-[15px] transition-all disabled:opacity-70"
                        >
                            {adding ? <Loader2 size={18} className="animate-spin text-black" /> : 'Save to Collection'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
