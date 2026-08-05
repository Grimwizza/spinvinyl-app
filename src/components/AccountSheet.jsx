import { RefreshCw, Database, FileDown, Music, X } from 'lucide-react';

export default function AccountSheet({
    isOpen,
    onClose,
    authUsername,
    offlineQueueSize,
    isSyncing,
    onSync,
    archiveStatus,
    archiving,
    archiveProgress,
    totalReleases,
    canArchive,
    onBackfillArchive,
    exporting,
    onExportJson,
    onExportCsv,
    lastfmStatus,
    onDisconnectLastfm,
    onLogout,
}) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-end">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full bg-stone-900 border-t border-white/10 rounded-t-2xl p-6 flex flex-col gap-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
                <div className="w-10 h-1 bg-white/20 rounded-full mx-auto" />

                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-black text-white truncate">{authUsername}</h2>
                    <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 text-stone-400 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Sync status */}
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${offlineQueueSize > 0 ? 'bg-amber-400' : 'bg-green-500 animate-pulse'}`} />
                        <span className="text-sm text-stone-300 font-semibold">
                            {offlineQueueSize > 0 ? `${offlineQueueSize} unsynced` : 'Connected'}
                        </span>
                    </div>
                    {offlineQueueSize > 0 && (
                        <button
                            onClick={onSync}
                            disabled={isSyncing}
                            className="flex items-center gap-1.5 px-3 py-2 min-h-[36px] rounded-full bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/30 text-amber-300 text-xs font-bold transition-colors disabled:opacity-60 active:opacity-70"
                        >
                            <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
                            {isSyncing ? 'Syncing…' : 'Sync now'}
                        </button>
                    )}
                </div>

                {/* Archive status */}
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center gap-2">
                        <Database size={14} className="text-stone-400 flex-shrink-0" />
                        <span className="text-sm text-stone-300 font-semibold">
                            {archiveStatus ? `${archiveStatus.count} archived` : 'Not backed up yet'}
                        </span>
                    </div>
                    <button
                        onClick={onBackfillArchive}
                        disabled={archiving || !canArchive}
                        className="flex items-center gap-1.5 px-3 py-2 min-h-[36px] rounded-full bg-sky-400/10 hover:bg-sky-400/20 border border-sky-400/30 text-sky-300 text-xs font-bold transition-colors disabled:opacity-60 active:opacity-70"
                    >
                        {archiving ? `Backing up ${archiveProgress}/${totalReleases}…` : 'Back up to cloud'}
                    </button>
                </div>

                {/* Data export */}
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center gap-2">
                        <FileDown size={14} className="text-stone-400 flex-shrink-0" />
                        <span className="text-sm text-stone-300 font-semibold">Export your data</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onExportCsv}
                            disabled={exporting}
                            className="px-3 py-2 min-h-[36px] rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-stone-300 text-xs font-bold transition-colors disabled:opacity-60 active:opacity-70"
                        >
                            CSV
                        </button>
                        <button
                            onClick={onExportJson}
                            disabled={exporting}
                            className="px-3 py-2 min-h-[36px] rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-stone-300 text-xs font-bold transition-colors disabled:opacity-60 active:opacity-70"
                        >
                            JSON
                        </button>
                    </div>
                </div>

                {/* Last.fm scrobbling */}
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center gap-2">
                        <Music size={14} className="text-stone-400 flex-shrink-0" />
                        <span className="text-sm text-stone-300 font-semibold">
                            {lastfmStatus?.connected ? `Last.fm: ${lastfmStatus.lastfmUsername}` : 'Last.fm not connected'}
                        </span>
                    </div>
                    {lastfmStatus?.connected ? (
                        <button
                            onClick={onDisconnectLastfm}
                            className="px-3 py-2 min-h-[36px] rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-stone-300 text-xs font-bold transition-colors"
                        >
                            Disconnect
                        </button>
                    ) : (
                        <a
                            href="/api/lastfm?action=connect"
                            className="px-3 py-2 min-h-[36px] rounded-full bg-red-400/10 hover:bg-red-400/20 border border-red-400/30 text-red-300 text-xs font-bold transition-colors flex items-center"
                        >
                            Connect Last.fm
                        </a>
                    )}
                </div>

                <button
                    onClick={onLogout}
                    className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-semibold text-stone-300 transition-colors mt-1"
                >
                    Log Out
                </button>
            </div>
        </div>
    );
}
