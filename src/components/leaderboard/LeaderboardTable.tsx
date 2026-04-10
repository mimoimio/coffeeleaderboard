import type { LeaderboardRow as LeaderboardRowType } from "@/src/lib/types";

import { LeaderboardRow } from "./LeaderboardRow";

type LeaderboardTableProps = {
    rows: LeaderboardRowType[];
    isLoading: boolean;
    error: string | null;
    resolveThumbnailUrl: (userId: string) => string | undefined;
    formatDate: (iso: string) => string;
};

export function LeaderboardTable({
    rows,
    isLoading,
    error,
    resolveThumbnailUrl,
    formatDate,
}: LeaderboardTableProps) {
    return (
        <div className="overflow-hidden rounded-2xl border border-[#d9bc9c] bg-[#fffdf9] shadow-[0_8px_24px_rgba(101,62,37,0.1)]">
            <table className="w-full border-separate [border-spacing:0_0.42rem] px-2 text-left text-sm">
                <thead className="bg-linear-to-r from-[#6b3f2b] to-[#8c553b] text-[#fff7ef]">
                    <tr>
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">Username</th>
                        <th className="px-4 py-3">User ID</th>
                        <th className="px-4 py-3">Cups</th>
                        <th className="px-4 py-3">Updated</th>
                    </tr>
                </thead>
                <tbody>
                    {isLoading && (
                        <tr>
                            <td className="px-4 py-6 text-[#8b684f]" colSpan={5}>
                                Loading leaderboard...
                            </td>
                        </tr>
                    )}

                    {!isLoading && error && (
                        <tr>
                            <td className="px-4 py-6 font-medium text-red-700" colSpan={5}>
                                {error}
                            </td>
                        </tr>
                    )}

                    {!isLoading && !error && rows.length === 0 && (
                        <tr>
                            <td className="px-4 py-6 text-[#8b684f]" colSpan={5}>
                                No players yet.
                            </td>
                        </tr>
                    )}

                    {!isLoading &&
                        !error &&
                        rows.map((row, index) => (
                            <LeaderboardRow
                                key={row.user_id}
                                row={row}
                                rank={index + 1}
                                thumbnailUrl={resolveThumbnailUrl(row.user_id)}
                                formatDate={formatDate}
                            />
                        ))}
                </tbody>
            </table>
        </div>
    );
}