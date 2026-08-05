import { getArchiveExport } from './collectionArchive.js';
import { getStoredStats } from './statsEngine.js';

const triggerDownload = (filename, content, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
};

// Discogs' own shapes for genre/style are plain string arrays, but format/label
// are arrays of objects ({ name, qty, ... } / { name, catno, ... }) — flatten
// those down to just the readable name(s) instead of dumping raw JSON into a
// spreadsheet cell.
const flattenForCsv = (val) => {
    if (val == null) return '';
    if (Array.isArray(val)) {
        return val.map(flattenForCsv).filter(Boolean).join(', ');
    }
    if (typeof val === 'object') return val.name ?? JSON.stringify(val);
    return String(val);
};

const csvEscape = (val) => {
    if (val == null) return '';
    const s = flattenForCsv(val);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const COLLECTION_CSV_COLUMNS = [
    'instance_id', 'release_id', 'title', 'artist', 'year', 'country',
    'catno', 'label', 'genre', 'style', 'format', 'rating',
    'date_added', 'provenance', 'lent_to', 'lent_at', 'lent_notes',
];

const toCollectionCsv = (items) => {
    const header = COLLECTION_CSV_COLUMNS.join(',');
    const rows = items.map(it => COLLECTION_CSV_COLUMNS.map(c => csvEscape(it[c])).join(','));
    return [header, ...rows].join('\n');
};

/** Full export: collection archive rows + local stats, as one JSON download. */
export async function exportAllDataAsJson(username) {
    const collection = await getArchiveExport(username);
    const stats = getStoredStats();
    const payload = { exportedAt: new Date().toISOString(), username, collection, stats };
    triggerDownload(`spinvinyl-export-${username}-${Date.now()}.json`, JSON.stringify(payload, null, 2), 'application/json');
}

/** Collection-only export as CSV — more spreadsheet-friendly than the full JSON. */
export async function exportCollectionAsCsv(username) {
    const collection = await getArchiveExport(username);
    triggerDownload(`spinvinyl-collection-${username}-${Date.now()}.csv`, toCollectionCsv(collection), 'text/csv');
}
