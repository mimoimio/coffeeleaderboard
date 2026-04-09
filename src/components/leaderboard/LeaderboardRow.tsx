"use client";

import { motion, useAnimationControls } from "framer-motion";
import { useEffect, useRef } from "react";

import type { LeaderboardRow as LeaderboardRowType } from "@/src/lib/types";

type LeaderboardRowProps = {
    row: LeaderboardRowType;
    rank: number;
    thumbnailUrl?: string;
    formatDate: (iso: string) => string;
};

export function LeaderboardRow({ row, rank, thumbnailUrl, formatDate }: LeaderboardRowProps) {
    const controls = useAnimationControls();
    const previousCupsRef = useRef<number | null>(null);

    useEffect(() => {
        const previousCups = previousCupsRef.current;
        previousCupsRef.current = row.cups_served;

        if (previousCups === null || previousCups === row.cups_served) {
            return;
        }

        controls.stop();
        void (async () => {
            await controls.start({
                rotate: -1,
                scale: 1.05,
                transition: {
                    type: "spring",
                    stiffness: 2000,
                    damping: 20,
                },
            });

            await controls.start({
                rotate: 0,
                scale: 1,
                transition: {
                    type: "spring",
                    stiffness: 2000,
                    damping: 20,
                },
            });
        })();
    }, [controls, row.cups_served]);

    return (
        <motion.tr
            key={row.user_id}
            className="origin-center"
            initial={false}
            animate={controls}
        >
            <td className="rounded-l-xl border-y border-l border-[#e5ccb1] bg-[#fffdf8] px-4 py-3 font-semibold text-[#6a4b38] shadow-[0_2px_7px_rgba(85,54,35,0.08)]">
                {rank}
            </td>
            <td className="border-y border-[#e5ccb1] bg-[#fffdf8] px-4 py-3 font-semibold text-[#4f3425] shadow-[0_2px_7px_rgba(85,54,35,0.08)]">
                <div className="flex items-center gap-3">
                    {thumbnailUrl ? (
                        <img
                            src={thumbnailUrl}
                            alt={`${row.username} avatar`}
                            className="h-10 w-10 rounded-xl border border-[#d8ba99] object-cover shadow-[0_2px_8px_rgba(86,52,31,0.18)]"
                            loading="lazy"
                        />
                    ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#d8ba99] bg-[#f5e5d2] text-xs font-bold text-[#6f4e3a]">
                            {row.username.slice(0, 1).toUpperCase() || "?"}
                        </div>
                    )}
                    <span>{row.username}</span>
                </div>
            </td>
            <td className="border-y border-[#e5ccb1] bg-[#fffdf8] px-4 py-3 font-mono text-xs text-[#7f5d46] shadow-[0_2px_7px_rgba(85,54,35,0.08)]">
                {row.user_id}
            </td>
            <td className="border-y border-[#e5ccb1] bg-[#fffdf8] px-4 py-3 shadow-[0_2px_7px_rgba(85,54,35,0.08)]">
                <span className="inline-flex rounded-full border border-[#d6a478] bg-[#f4d8bc] px-3 py-1 text-xs font-bold text-[#7f3f20]">
                    {row.cups_served.toLocaleString()} cups
                </span>
            </td>
            <td className="rounded-r-xl border-y border-r border-[#e5ccb1] bg-[#fffdf8] px-4 py-3 text-[#7f5d46] shadow-[0_2px_7px_rgba(85,54,35,0.08)]">
                {formatDate(row.updated_at)}
            </td>
        </motion.tr>
    );
}