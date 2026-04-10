"use client";

import { useCallback, useEffect, useState } from "react";

import { LeaderboardHeader } from "@/src/components/leaderboard/LeaderboardHeader";
import { LeaderboardTable } from "@/src/components/leaderboard/LeaderboardTable";
import { getBrowserSupabaseClient } from "@/src/lib/supabase-browser";
import type { LeaderboardRow as LeaderboardItem } from "@/src/lib/types";

type RobloxThumbnailResponse = {
  data?: Array<{
    targetId: number;
    state: string;
    imageUrl?: string;
  }>;
};

type ThumbnailCacheEntry = {
  imageUrl: string;
  cachedAt: number;
};

const THUMBNAIL_CACHE_KEY = "roblox-thumbnail-cache-v1";
const THUMBNAIL_TTL_MS = 24 * 60 * 60 * 1000;
const THUMBNAIL_BATCH_SIZE = 50;

const getThumbnails = async (userIds: string[]): Promise<Record<string, string>> => {
  if (userIds.length === 0) return {};

  const roproxyUrl = `https://thumbnails.roproxy.com/v1/users/avatar?userIds=${userIds.join(",")}&size=180x180&format=Png&isCircular=false`;

  try {
    const res = await fetch(roproxyUrl, {
      method: "GET",
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error("Failed to fetch thumbnails");
    }

    const data = (await res.json()) as RobloxThumbnailResponse;
    const thumbnailMap: Record<string, string> = {};

    for (const item of data.data ?? []) {
      if (!item.imageUrl) continue;
      thumbnailMap[String(item.targetId)] = item.imageUrl;
    }

    return thumbnailMap;
  } catch (fetchError) {
    console.error("Thumbnail fetch failed:", fetchError);
    return {};
  }
};

const formatDate = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
};

export default function Home() {
  const [rows, setRows] = useState<LeaderboardItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState("CONNECTING");
  const [thumbnailCache, setThumbnailCache] = useState<Record<string, ThumbnailCacheEntry>>({});

  const logRealtime = useCallback((message: string, details?: unknown) => {
    if (details === undefined) {
      console.log(`[realtime] ${message}`);
      return;
    }
    console.log(`[realtime] ${message}`, details);
  }, []);

  const loadLeaderboard = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/leaderboard", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Could not load leaderboard");
      }

      const data = (await response.json()) as { entries: LeaderboardItem[] };
      setRows(data.entries ?? []);
    } catch {
      setError("Failed to load leaderboard. Try refresh.");
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  const isThumbnailFresh = useCallback((entry: ThumbnailCacheEntry | undefined) => {
    if (!entry) return false;
    return Date.now() - entry.cachedAt < THUMBNAIL_TTL_MS;
  }, []);

  // 1. INITIAL LOAD
  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  // 1.5 LOAD THUMBNAIL CACHE
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(THUMBNAIL_CACHE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as Record<string, ThumbnailCacheEntry>;
      const cleaned: Record<string, ThumbnailCacheEntry> = {};

      for (const [userId, entry] of Object.entries(parsed)) {
        if (
          entry &&
          typeof entry.imageUrl === "string" &&
          typeof entry.cachedAt === "number" &&
          Date.now() - entry.cachedAt < THUMBNAIL_TTL_MS
        ) {
          cleaned[userId] = entry;
        }
      }

      setThumbnailCache(cleaned);
    } catch {
      // Ignore invalid local cache data.
    }
  }, []);

  // 1.6 SAVE THUMBNAIL CACHE
  useEffect(() => {
    try {
      window.localStorage.setItem(THUMBNAIL_CACHE_KEY, JSON.stringify(thumbnailCache));
    } catch {
      // Ignore storage write failures.
    }
  }, [thumbnailCache]);

  // 1.7 FETCH MISSING THUMBNAILS
  useEffect(() => {
    const missingUserIds = rows
      .map((row) => row.user_id)
      .filter((userId) => /^\d+$/.test(userId))
      .filter((userId) => !isThumbnailFresh(thumbnailCache[userId]));

    if (missingUserIds.length === 0) return;

    let isCancelled = false;

    const fetchMissingThumbnails = async () => {
      for (let i = 0; i < missingUserIds.length; i += THUMBNAIL_BATCH_SIZE) {
        const batch = missingUserIds.slice(i, i + THUMBNAIL_BATCH_SIZE);

        try {
          const thumbnailMap = await getThumbnails(batch);
          const now = Date.now();

          if (isCancelled) return;

          setThumbnailCache((current) => {
            const next = { ...current };

            for (const [userId, imageUrl] of Object.entries(thumbnailMap)) {
              next[userId] = {
                imageUrl,
                cachedAt: now,
              };
            }

            return next;
          });
        } catch {
          // Ignore thumbnail fetch failures and keep rendering without image.
        }
      }
    };

    void fetchMissingThumbnails();

    return () => {
      isCancelled = true;
    };
  }, [rows, thumbnailCache, isThumbnailFresh]);

  // 2. REALTIME SUBSCRIPTION (UPDATED)
  useEffect(() => {
    logRealtime("Attempting realtime connection");
    const supabase = getBrowserSupabaseClient();

    if (!supabase) {
      setIsRealtimeConnected(false);
      setRealtimeStatus("MISSING_SUPABASE_PUBLIC_ENV");
      logRealtime("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
      return;
    }

    logRealtime("Supabase browser client initialized");

    const channel = supabase
      .channel("leaderboard-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leaderboard" },
        (payload) => {
          setRealtimeStatus("EVENT_RECEIVED");
          logRealtime("Updating React State visually", payload.eventType);

          setRows((currentRows) => {
            if (payload.eventType === "UPDATE") {
              const updatedRow = payload.new as LeaderboardItem;
              return currentRows
                .map((row) => (row.user_id === updatedRow.user_id ? updatedRow : row))
                .sort((a, b) => b.cups_served - a.cups_served);
            }

            if (payload.eventType === "INSERT") {
              const newRow = payload.new as LeaderboardItem;
              if (currentRows.some((r) => r.user_id === newRow.user_id)) return currentRows;
              return [...currentRows, newRow].sort((a, b) => b.cups_served - a.cups_served);
            }

            return currentRows;
          });
        }
      )
      .subscribe((status) => {
        setRealtimeStatus(status);
        setIsRealtimeConnected(status === "SUBSCRIBED");
        logRealtime(`Channel status changed: ${status}`);
      });

    return () => {
      logRealtime("Cleaning up realtime channel");
      setIsRealtimeConnected(false);
      void supabase.removeChannel(channel);
    };
  }, [logRealtime]);

  // 3. POLLING FALLBACK
  useEffect(() => {
    const pollInterval = window.setInterval(() => {
      if (!isRealtimeConnected) {
        logRealtime("Realtime not connected, polling /api/leaderboard");
        void loadLeaderboard(false);
      }
    }, 3000);

    return () => {
      window.clearInterval(pollInterval);
    };
  }, [isRealtimeConnected, loadLeaderboard, logRealtime]);

  const resolveThumbnailUrl = useCallback(
    (userId: string) => thumbnailCache[userId]?.imageUrl,
    [thumbnailCache],
  );

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-linear-to-b from-[#f6e9d7] via-[#f8efe4] to-[#efe1d0] px-4 py-10 text-zinc-900 md:px-8">
      <div className="pointer-events-none absolute -left-16 top-10 h-40 w-40 rounded-full bg-[#d97d46]/20 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-1/3 h-48 w-48 rounded-full bg-[#9f5e3f]/15 blur-3xl" />

      <section className="relative mx-auto w-full max-w-5xl rounded-4xl border border-[#d7b38d] bg-[#fff8ef]/90 p-6 shadow-[0_18px_50px_rgba(86,52,31,0.18)] backdrop-blur md:p-8">
        <LeaderboardHeader
          isRealtimeConnected={isRealtimeConnected}
          realtimeStatus={realtimeStatus}
          onRefresh={() => {
            void loadLeaderboard();
          }}
        />

        <LeaderboardTable
          rows={rows}
          isLoading={isLoading}
          error={error}
          resolveThumbnailUrl={resolveThumbnailUrl}
          formatDate={formatDate}
        />
      </section>
    </main>
  );
}