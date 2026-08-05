import { useState } from 'react';
import { Loader2, Star } from 'lucide-react';

// Discogs' fixed default field ids — always present in getCollectionFields' response.
const MEDIA_CONDITION_ID = 1;
const SLEEVE_CONDITION_ID = 2;
const NOTES_ID = 3;

const CONDITION_OPTIONS = ['Mint (M)', 'Near Mint (NM or M-)', 'Very Good Plus (VG+)', 'Very Good (VG)', 'Good Plus (G+)', 'Good (G)', 'Fair (F)', 'Poor (P)'];
const SLEEVE_CONDITION_OPTIONS = [...CONDITION_OPTIONS, 'Generic', 'No Cover'];

// Fallback field definitions used only until `collectionFields` has loaded from the API,
// so the form isn't blocked on that fetch.
const FALLBACK_FIELDS = [
    { id: MEDIA_CONDITION_ID, name: 'Media Condition', type: 'dropdown', options: CONDITION_OPTIONS },
    { id: SLEEVE_CONDITION_ID, name: 'Sleeve Condition', type: 'dropdown', options: SLEEVE_CONDITION_OPTIONS },
    { id: NOTES_ID, name: 'Notes', type: 'textarea' },
];

// ─── CollectionItemEditor ─────────────────────────────────────────────────────
// Shared "add" / "edit" form for a Discogs collection item — rating, folder, and
// dynamic per-account fields (Media/Sleeve Condition, Notes, plus any custom fields
// the user has configured on discogs.com). Used both for a freshly-scanned release
// (mode="add") and for editing an item already in the collection (mode="edit").
export default function CollectionItemEditor({
    release,
    mode = 'add',
    initialValues,
    instanceId,
    folders = [],
    folderError = false,
    collectionFields,
    onCancel,
    onSaved,
}) {
    const fieldDefs = (collectionFields?.fields?.length ? collectionFields.fields : FALLBACK_FIELDS)
        .slice()
        .sort((a, b) => (a.position ?? a.id) - (b.position ?? b.id));

    const initialFieldValues = () => {
        const map = {};
        if (initialValues?.fields) {
            for (const { field_id, value } of initialValues.fields) map[field_id] = value ?? '';
        }
        for (const f of fieldDefs) {
            if (map[f.id] === undefined) {
                map[f.id] = f.id === MEDIA_CONDITION_ID || f.id === SLEEVE_CONDITION_ID ? 'Mint (M)' : '';
            }
        }
        return map;
    };

    const [rating, setRating] = useState(initialValues?.rating ?? 0);
    const [folderId, setFolderId] = useState(initialValues?.folderId ?? '1');
    const [fieldValues, setFieldValues] = useState(initialFieldValues);
    const [saving, setSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const setFieldValue = (id, value) => setFieldValues(prev => ({ ...prev, [id]: value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setErrorMsg('');

        try {
            const payload = {
                folderId,
                rating,
                fields: fieldDefs.map(f => ({ field_id: f.id, value: fieldValues[f.id] })),
            };
            if (mode === 'edit' && instanceId) payload.instanceId = instanceId;

            const res = await fetch(`/api/discogs?action=saveCollectionItem&id=${release.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to save collection item');

            onSaved?.(release, payload, data);
        } catch (err) {
            setErrorMsg(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-black">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 bg-stone-950 border-b border-white/5"
                 style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
                <button onClick={onCancel} className="text-sm font-semibold text-stone-400 hover:text-white transition-colors">Cancel</button>
                <h3 className="text-white font-bold text-[15px]">{mode === 'edit' ? 'Edit Collection Item' : 'Edit Details'}</h3>
                <div className="w-[45px]"></div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-6 space-y-7 pb-24">
                {/* Release Preview */}
                <div className="flex gap-4 items-center">
                    <div className="w-[72px] h-[72px] rounded-sm overflow-hidden bg-white/5 border border-white/10 flex-shrink-0 shadow-lg relative">
                        <img src={release.thumb || release.cover_image || '/api/placeholder/400/400'} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex flex-col justify-center min-w-0">
                        <p className="text-white font-bold text-[15px] leading-tight mb-1 truncate">{release.title}</p>
                        <p className="text-stone-400 text-[13px] leading-snug">
                            {[release.year, release.country, (release.format || []).slice(0, 2).join('/')].filter(Boolean).join(' · ')}
                        </p>
                    </div>
                </div>

                <div className="w-full h-px bg-white/[0.04]"></div>

                <div className="space-y-6">
                    {mode === 'add' && (
                        <p className="text-[13px] text-stone-400 font-medium tracking-wide">Added to Collection: <span className="text-white ml-2">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></p>
                    )}

                    {/* Rating */}
                    <div>
                        <label className="block text-[13px] font-medium text-stone-400 mb-2">My Rating</label>
                        <div className="flex items-center gap-1.5 -ml-1">
                            {[1, 2, 3, 4, 5].map(star => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => setRating(star === rating ? 0 : star)}
                                    aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}
                                    aria-pressed={star <= rating}
                                    className="p-1 hover:scale-110 active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 rounded-lg"
                                >
                                    <Star size={28} strokeWidth={1.5} className={star <= rating ? 'fill-amber-400 text-amber-400 drop-shadow-md' : 'text-stone-600'} />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Folder */}
                    <div>
                        <label className="block text-[13px] font-medium text-stone-400 mb-2">Folder</label>
                        <div className="relative">
                            <select value={folderId} onChange={e => setFolderId(e.target.value)} className="w-full appearance-none bg-white/[0.02] border border-white/[0.08] hover:border-white/20 hover:bg-white/[0.04] transition-colors rounded-xl px-4 py-3.5 text-[15px] text-white focus:outline-none focus:ring-2 ring-terracotta-500/50">
                                {folders.map(f => (
                                    <option key={f.id} value={f.id} className="bg-stone-900 text-white">{f.name} ({f.count})</option>
                                ))}
                                {folders.length === 0 && <option value="1" className="bg-stone-900 text-white">Uncategorized</option>}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M1 1.5L6 6.5L11 1.5" stroke="#a8a29e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            </div>
                        </div>
                        {folderError && (
                            <p className="text-[12px] text-amber-400 mt-1.5">Couldn&apos;t load your folders — using Uncategorized.</p>
                        )}
                    </div>

                    {/* Dynamic fields (Media/Sleeve Condition, Notes, and any custom fields) */}
                    <div className="space-y-6">
                        {fieldDefs.map(f => (
                            <div key={f.id} className={f.id === NOTES_ID ? 'pb-8' : undefined}>
                                <label className="block text-[13px] font-medium text-stone-400 mb-2">{f.name}</label>
                                {f.type === 'dropdown' ? (
                                    <div className="relative">
                                        <select
                                            value={fieldValues[f.id] ?? ''}
                                            onChange={e => setFieldValue(f.id, e.target.value)}
                                            className="w-full appearance-none bg-white/[0.02] border border-white/[0.08] hover:border-white/20 hover:bg-white/[0.04] transition-colors rounded-xl px-4 py-3.5 text-[15px] text-white focus:outline-none focus:ring-2 ring-terracotta-500/50"
                                        >
                                            {(f.options || []).map(c => <option className="bg-stone-900 text-white" key={c} value={c}>{c}</option>)}
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                            <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1.5L6 6.5L11 1.5" stroke="#a8a29e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                        </div>
                                    </div>
                                ) : f.type === 'textarea' ? (
                                    <>
                                        <textarea
                                            value={fieldValues[f.id] ?? ''}
                                            onChange={e => setFieldValue(f.id, e.target.value.slice(0, 255))}
                                            rows="4"
                                            placeholder={`Enter ${f.name}`}
                                            className="w-full bg-white/[0.02] border border-white/[0.08] hover:border-white/20 transition-colors rounded-xl px-4 py-3.5 text-[15px] text-white placeholder-stone-600 focus:outline-none focus:ring-2 ring-terracotta-500/50 resize-none"
                                        ></textarea>
                                        <div className="text-right text-[11px] font-medium text-stone-500 mt-1.5">{(fieldValues[f.id] ?? '').length} / 255</div>
                                    </>
                                ) : (
                                    <input
                                        type="text"
                                        value={fieldValues[f.id] ?? ''}
                                        onChange={e => setFieldValue(f.id, e.target.value)}
                                        placeholder={`Enter ${f.name}`}
                                        className="w-full bg-white/[0.02] border border-white/[0.08] hover:border-white/20 transition-colors rounded-xl px-4 py-3.5 text-[15px] text-white placeholder-stone-600 focus:outline-none focus:ring-2 ring-terracotta-500/50"
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {errorMsg && <div className="px-5 pb-4 text-[13px] font-medium text-red-400 text-center">{errorMsg}</div>}

            <div className="p-4 bg-stone-950 border-t border-white/5 flex-shrink-0 pb-safe">
                <button
                    onClick={handleSubmit}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-terracotta-400 hover:bg-terracotta-300 text-stone-950 font-bold text-[15px] transition-all disabled:opacity-70 disabled:hover:bg-terracotta-400"
                >
                    {saving ? <Loader2 size={18} className="animate-spin text-stone-950" /> : 'Save changes'}
                </button>
            </div>
        </div>
    );
}
