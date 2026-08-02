/** Fetch Last.fm connection status for the signed-in user. */
export async function getLastfmStatus() {
    try {
        const res = await fetch('/api/lastfm?action=status', { credentials: 'include' });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

export async function disconnectLastfm() {
    try {
        const res = await fetch('/api/lastfm?action=disconnect', { method: 'POST', credentials: 'include' });
        return res.ok;
    } catch {
        return false;
    }
}

/** Fire-and-forget scrobble — never throws, never blocks the caller.
 *  Mirrors the pushArchiveItem/pushToCloud fire-and-forget pattern in
 *  SpinVinyl.jsx: a scrobble failure must never affect local spin logging. */
export function scrobbleLastfm({ artist, track, timestamp }) {
    fetch('/api/lastfm?action=scrobble', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ artist, track, timestamp }),
    }).catch(() => {}); // deliberately swallowed — see comment above
}
