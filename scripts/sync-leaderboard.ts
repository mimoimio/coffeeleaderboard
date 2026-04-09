import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

type OpenCloudEntry = {
  key?: string;
  id?: string;
  value?: unknown;
};

type UsersBatchResponse = {
  data: Array<{
    id: number;
    name: string;
    displayName: string;
  }>;
};

type LeaderboardUpsertRow = {
  user_id: string;
  username: string;
  cups_served: number;
  updated_at: string;
};

const REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ROBLOX_OPEN_CLOUD_API_KEY",
  "ROBLOX_UNIVERSE_ID",
] as const;

const ORDERED_DATASTORE_NAME = process.env.ROBLOX_ORDERED_DATASTORE_NAME ?? "CupsServedLeaderboard";
const ORDERED_DATASTORE_SCOPE = process.env.ROBLOX_ORDERED_DATASTORE_SCOPE ?? "global";
const OPEN_CLOUD_BASE_URL = "https://apis.roblox.com/cloud/v2";
const ROBLOX_USERS_BATCH_URL = "https://users.roblox.com/v1/users";
const DEBUG_SYNC = process.env.DEBUG_SYNC === "1";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const debugLog = (message: string) => {
  if (!DEBUG_SYNC) return;
  console.log(`[sync-leaderboard] ${message}`);
};

const ensureEnv = () => {
  debugLog("Validating required environment variables");
  for (const envKey of REQUIRED_ENV) {
    if (!process.env[envKey]) {
      throw new Error(`Missing required env var: ${envKey}`);
    }
  }
  debugLog("Environment validation passed");
};

const fetchWithRetry = async (
  input: RequestInfo | URL,
  init: RequestInit,
  maxRetries = 5,
): Promise<Response> => {
  let attempt = 0;

  while (true) {
    debugLog(`HTTP request attempt ${attempt + 1}: ${String(input)}`);
    const response = await fetch(input, init);

    if (response.status !== 429) {
      return response;
    }

    attempt += 1;
    if (attempt > maxRetries) {
      throw new Error("Rate limit exceeded too many times.");
    }

    const retryAfterHeader = response.headers.get("retry-after");
    const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : 0;
    const backoffMs = Math.max(retryAfterMs, 500 * 2 ** attempt);
    debugLog(`Received 429. Backing off for ${backoffMs}ms`);
    await sleep(backoffMs);
  }
};

const parseCupsValue = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  if (value && typeof value === "object") {
    const withNumericValue = value as { value?: unknown; amount?: unknown; total?: unknown };
    const candidate = withNumericValue.value ?? withNumericValue.amount ?? withNumericValue.total;
    return parseCupsValue(candidate);
  }

  return 0;
};

const parseEntry = (entry: OpenCloudEntry): { userId: string; cups: number } | null => {
  const rawKey = entry.key ?? entry.id;
  if (!rawKey) return null;

  const userId = String(rawKey);
  const cups = parseCupsValue(entry.value);

  return { userId, cups };
};

const listOrderedDataStoreEntries = async (): Promise<Map<string, number>> => {
  const apiKey = process.env.ROBLOX_OPEN_CLOUD_API_KEY as string;
  const universeId = process.env.ROBLOX_UNIVERSE_ID as string;

  const totals = new Map<string, number>();
  let pageToken: string | null = null;
  let pageCount = 0;

  do {
    pageCount += 1;
    const params = new URLSearchParams({
      maxPageSize: "100",
    });

    if (pageToken) {
      params.set("pageToken", pageToken);
    }

    const url = `${OPEN_CLOUD_BASE_URL}/universes/${universeId}/ordered-data-stores/${encodeURIComponent(
      ORDERED_DATASTORE_NAME,
    )}/scopes/${encodeURIComponent(ORDERED_DATASTORE_SCOPE)}/entries?${params.toString()}`;

    const response = await fetchWithRetry(url, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "content-type": "application/json",
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Open Cloud request failed (${response.status}): ${body}`);
    }

    const json = (await response.json()) as {
      nextPageToken?: string;
      pageToken?: string;
      orderedDataStoreEntries?: OpenCloudEntry[];
      entries?: OpenCloudEntry[];
      data?: OpenCloudEntry[];
    };

    const entries = json.orderedDataStoreEntries ?? json.entries ?? json.data ?? [];
    debugLog(`Fetched page ${pageCount}, entries: ${entries.length}`);

    for (const entry of entries) {
      const parsed = parseEntry(entry);
      if (!parsed) continue;
      totals.set(parsed.userId, parsed.cups);
    }

    pageToken = json.nextPageToken ?? json.pageToken ?? null;
  } while (pageToken);

  console.log(`Fetched ${totals.size} total OrderedDataStore records from Roblox Open Cloud.`);

  return totals;
};

const chunk = <T>(values: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < values.length; i += size) {
    chunks.push(values.slice(i, i + size));
  }
  return chunks;
};

const resolveUsernames = async (userIds: string[]): Promise<Map<string, string>> => {
  const usernameMap = new Map<string, string>();
  const idChunks = chunk(userIds, 50);
  console.log(`Resolving usernames for ${userIds.length} Roblox users in ${idChunks.length} batch(es).`);

  for (const [index, ids] of idChunks.entries()) {
    debugLog(`Resolving username batch ${index + 1}/${idChunks.length}`);
    const payload = {
      userIds: ids.map((id) => Number(id)).filter((id) => Number.isFinite(id)),
      excludeBannedUsers: false,
    };

    if (payload.userIds.length === 0) continue;

    try {
      const response = await fetchWithRetry(ROBLOX_USERS_BATCH_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.text();
        console.warn(`Users API request failed for batch ${index + 1}: (${response.status}) ${body}`);
        continue;
      }

      const json = (await response.json()) as UsersBatchResponse;
      for (const user of json.data) {
        usernameMap.set(String(user.id), user.name);
      }
    } catch (error) {
      console.warn(
        `Users API resolution failed for batch ${index + 1}/${idChunks.length}; using fallback usernames for that batch.`,
        error,
      );
    }

    await sleep(200);
  }

  return usernameMap;
};

const bulkUpsertToSupabase = async (rows: LeaderboardUpsertRow[]) => {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  const batchSize = 500;
  const chunksToInsert = chunk(rows, batchSize);
  console.log(`Upserting ${rows.length} rows into Supabase in ${chunksToInsert.length} batch(es).`);

  for (const [index, rowsChunk] of chunksToInsert.entries()) {
    debugLog(`Upserting Supabase batch ${index + 1}/${chunksToInsert.length}`);
    const { error } = await supabase
      .from("leaderboard")
      .upsert(rowsChunk, { onConflict: "user_id" });

    if (error) {
      throw new Error(`Supabase upsert failed: ${error.message}`);
    }
  }
};

const main = async () => {
  ensureEnv();
  console.log("Starting historical leaderboard sync...");

  const totalsByUser = await listOrderedDataStoreEntries();
  const userIds = [...totalsByUser.keys()];

  if (userIds.length === 0) {
    console.log("No historical leaderboard records found.");
    return;
  }

  const usernamesByUserId = await resolveUsernames(userIds);
  const nowIso = new Date().toISOString();

  const rows: LeaderboardUpsertRow[] = userIds.map((userId) => ({
    user_id: userId,
    username: usernamesByUserId.get(userId) ?? `User_${userId}`,
    cups_served: totalsByUser.get(userId) ?? 0,
    updated_at: nowIso,
  }));

  await bulkUpsertToSupabase(rows);
  console.log(`Synced ${rows.length} leaderboard rows to Supabase.`);
};

main().catch((error) => {
  console.error("Historical sync failed:", error);
  process.exit(1);
});