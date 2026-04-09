import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET() {
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

    const { data, error } = await supabase
        .from("leaderboard")
        .select("user_id, username, cups_served, updated_at")
        .order("cups_served", { ascending: false })
        .limit(20);

    if (error) {
        console.log(error)
        return NextResponse.json({ error: error.code }, { status: 500 });
    }

    return NextResponse.json(
        { entries: data ?? [] },
        {
            status: 200,
            headers: {
                "Cache-Control": "no-store, max-age=0",
            },
        },
    );
}