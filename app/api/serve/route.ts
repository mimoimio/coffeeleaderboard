import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import type { LeaderboardRow, RobloxServePayload } from "@/src/lib/types";

export const runtime = "edge";

const getBearerToken = (authorizationHeader: string | null): string | null => {
  console.log('done')
  console.log(authorizationHeader)
  if (!authorizationHeader) return null;

  const [scheme, token] = authorizationHeader.split(" ");
  console.log(scheme)
  console.log(token)
  if (scheme?.toLowerCase() === "bearer" && token) {
    return token;
  }

  return authorizationHeader;
};

const isValidPayload = (value: unknown): value is RobloxServePayload => {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<RobloxServePayload>;

  // console.log((typeof payload.UserId === "string") ? "string" : "nah string")
  // console.log((typeof payload.Name === "string") ? "string" : "nah string")
  // console.log((typeof payload.TotalCupsServed === "number") ? "number" : "nah number")
  // console.log(payload.TotalCupsServed)
// {"UserId": "5470482596", "Name": "Mimoimior", "TotalCupsServed": 999}

  const isnumber = typeof payload.TotalCupsServed === "number"
  if (!isnumber) {
    payload.TotalCupsServed = Number(payload.TotalCupsServed)
  }
  // console.log(payload.TotalCupsServed)
  return (
    typeof payload.UserId === "string" &&
    typeof payload.Name === "string" &&
    typeof payload.TotalCupsServed === "number" &&
    Number.isFinite(payload.TotalCupsServed)
  );
};

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.ROBLOX_INGEST_SECRET;
  const providedSecret = getBearerToken(request.headers.get("Authorization"));

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: RobloxServePayload;

  try {
    const parsedBody: unknown = await request.json();
    if (!isValidPayload(parsedBody)) {
      console.log("invalid")
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    payload = parsedBody;
  } catch {
    console.log("malformed")
    return NextResponse.json({ error: "Malformed JSON body" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return NextResponse.json(
      { error: "Supabase environment variables are not configured" },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const row: LeaderboardRow = {
    user_id: payload.UserId,
    username: payload.Name,
    cups_served: payload.TotalCupsServed,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("leaderboard")
    .upsert(row, { onConflict: "user_id" });

  if (error) {
    return NextResponse.json({ error: "Failed to upsert leaderboard row" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}