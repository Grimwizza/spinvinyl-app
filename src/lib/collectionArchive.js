// ─── Personal Collection Archive ────────────────────────────────
// Backs up each user's OWN collection (releases they own + their notes/
// rating/condition/folder) to the app's own database, so it's not solely
// dependent on Discogs staying up or the user's Discogs account staying
// active. Strictly per-user — never a shared/cross-user catalog. See
// supabase/schema_collection_archive.sql for the full reasoning.

const ARCHIVE_QUEUE_KEY = 'spinvinyl_archive_queue';         // failed single-item pushes, retried on next flush
const LAST_BACKFILL_KEY = 'spinvinyl_archive_last_backfill'; // ISO timestamp, local-only UI hint
const BATCH_SIZE = 300;

// ─── Normalize any of the three real release shapes this app sees
// (search-result shape, collection basic_information shape, or the trimmed
// object CollectionItemEditor receives) into one archive row. Every call
// site (scanner add, collection-view edit, backfill) goes through this one
// function so the mapping is never duplicated.
export function buildArchiveItem(release, saveMeta, provenanceMeta) {
    const info = release.basic_information || release;
    return {
        release_id: release.id ?? info.id,
        instance_id: saveMeta.instanceId,
        folder_id: saveMeta.folderId,
        rating: saveMeta.rating,
        fields: saveMeta.fields || [],
        barcode: provenanceMeta.barcode ?? null,
        date_added: provenanceMeta.dateAdded ?? release.date_added ?? null,
        title: info.title ?? release.title ?? null,
        artist: (info.artists || []).map(a => a.name).join(', ') || null,
        year: release.year ?? info.year ?? null,
        country: release.country ?? info.country ?? null,
        format: release.format ?? info.formats ?? null,
        label: release.label ?? info.labels ?? null,
        genre: release.genre ?? info.genres ?? null,
        style: release.style ?? info.styles ?? null,
        catno: release.catno ?? info.labels?.[0]?.catno ?? null,
        cover_image: release.cover_image ?? info.cover_image ?? null,
        thumb: release.thumb ?? info.thumb ?? null,
        provenance: provenanceMeta.provenance,
        provenance_query: provenanceMeta.provenanceQuery ?? null,
        raw: release,
    };
}

// ─── Offline queue (mirrors syncEngine.js's shape) ──────────────
const getQueue = () => {
    try { return JSON.parse(localStorage.getItem(ARCHIVE_QUEUE_KEY) || '[]'); }
    catch { return []; }
};

const saveQueue = (queue) => {
    try { localStorage.setItem(ARCHIVE_QUEUE_KEY, JSON.stringify(queue)); }
    catch (e) { console.error('[CollectionArchive] Failed to save queue:', e); }
};

/** Push one item in the background. Resolves true on success, false on failure (and queues for retry). */
export async function pushArchiveItem(item, username) {
    if (!username) return false;
    try {
        const res = await fetch('/api/collection-archive?action=upsert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ items: [item] }),
        });
        if (!res.ok) {
            if (res.status === 503) return true; // not configured yet — not a real error
            saveQueue([...getQueue(), { item, queuedAt: new Date().toISOString() }]);
            return false;
        }
        return true;
    } catch {
        saveQueue([...getQueue(), { item, queuedAt: new Date().toISOString() }]);
        return false;
    }
}

/** Retry any queued items that failed to push earlier. Safe to call when the queue is empty. */
export async function flushArchiveQueue(username) {
    const queue = getQueue();
    if (!username || queue.length === 0) return;
    const remaining = [];
    for (const q of queue) {
        const ok = await pushArchiveItem(q.item, username);
        if (!ok) remaining.push(q);
    }
    saveQueue(remaining);
}

/**
 * Backfill the user's entire existing collection into the archive.
 * Reads entirely from the already-loaded `releases` array — no Discogs API
 * calls. Idempotent (upsert), so a failed run can simply be retried from
 * scratch. Sequential batches so progress can be reported.
 */
export async function backfillCollectionArchive(releases, username, onProgress) {
    let saved = 0;
    for (let i = 0; i < releases.length; i += BATCH_SIZE) {
        const batch = releases.slice(i, i + BATCH_SIZE).map(r => buildArchiveItem(
            r,
            { instanceId: r.instance_id, folderId: r.folder_id, rating: r.rating, fields: r.notes },
            { provenance: 'backfill', dateAdded: r.date_added }
        ));
        const res = await fetch('/api/collection-archive?action=upsert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ items: batch }),
        });
        if (!res.ok) throw new Error(`Backup failed at item ${saved} of ${releases.length}`);
        saved += batch.length;
        onProgress?.(saved, releases.length);
    }
    localStorage.setItem(LAST_BACKFILL_KEY, new Date().toISOString());
    return saved;
}

/** Fetch archive status ({ count, lastUpdatedAt }) for the signed-in user. */
export async function getArchiveStatus(username) {
    if (!username) return null;
    try {
        const res = await fetch('/api/collection-archive?action=status', { credentials: 'include' });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

export const getLastBackfillAt = () => localStorage.getItem(LAST_BACKFILL_KEY);

/** Fetch every archived row for the signed-in user (full export). */
export async function getArchiveExport(username) {
    if (!username) return [];
    const res = await fetch('/api/collection-archive?action=export', { credentials: 'include' });
    if (!res.ok) throw new Error(`Export failed: ${res.status}`);
    return (await res.json()).items || [];
}

/** Fetch lending status for one archived item. */
export async function getLendingStatus(instanceId) {
    if (!instanceId) return null;
    try {
        const res = await fetch(`/api/collection-archive?action=lending&instanceId=${instanceId}`, { credentials: 'include' });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

/** Partial update of ONLY lending columns — never touches title/artist/metadata. */
export async function updateLendingStatus({ instanceId, releaseId, lentTo, lentNotes }) {
    const res = await fetch('/api/collection-archive?action=updateLending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ instanceId, releaseId, lentTo, lentNotes }),
    });
    if (!res.ok) throw new Error(`Lending update failed: ${res.status}`);
    return res.json();
}
