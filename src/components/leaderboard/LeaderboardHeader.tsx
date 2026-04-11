type LeaderboardHeaderProps = {
    isRealtimeConnected: boolean;
    realtimeStatus: string;
    onRefresh: () => void;
};

export function LeaderboardHeader({
    isRealtimeConnected,
    realtimeStatus,
    onRefresh,
}: LeaderboardHeaderProps) {
    return (
        <div className="mb-6 flex flex-col gap-4 border-b border-[#e2c8aa] pb-5 md:flex-row md:items-end md:justify-between">
            <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#a15532]">
                    Live Cups Served
                </p>
                <h1 className="mt-1 font-serif text-4xl font-semibold tracking-tight text-[#4a2d1f] md:text-5xl">
                    Coffee Tavern Live Leaderboards
                </h1>
                {/* <p className="mt-2 text-sm text-[#6f4f3c]">Freshly synced totals brewed straight from your game servers.</p> */}
                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#dab68e] bg-[#fbeedb] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#7c513a]">
                    <span
                        className={`h-2 w-2 rounded-full ${isRealtimeConnected ? "bg-emerald-500" : "bg-amber-500"}`}
                    />
                    {isRealtimeConnected ? "Live" : "Disconnected"}
                </div>
                {/* <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.11em] text-[#9a6c4e]">
                    Status: {realtimeStatus}
                </p> */}
            </div>

            <button
                type="button"
                onClick={onRefresh}
                className="rounded-xl border border-[#9e5e3e] bg-[#8d4f34] px-4 py-2 text-sm font-semibold text-[#fff7ea] shadow-[0_6px_16px_rgba(80,45,26,0.26)] transition hover:-translate-y-0.5 hover:bg-[#7b442d]"
            >
                Refresh Brew
            </button>
        </div>
    );
}