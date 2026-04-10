import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const sanitizeUserIds = (rawUserIds: string): string[] => {
    const ids = rawUserIds
        .split(",")
        .map((id) => id.trim())
        .filter((id) => /^\d+$/.test(id));

    return [...new Set(ids)].slice(0, 100);
};

export async function GET(request: NextRequest) {
    console.warn('thumbnail route called')
    const userIdsRaw = request.nextUrl.searchParams.get("userIds") ?? "";
    const userIds = sanitizeUserIds(userIdsRaw);

    if (userIds.length === 0) {
        return NextResponse.json({ error: "No valid userIds provided" }, { status: 400 });
    }

    const robloxUrl = `https://thumbnails.roproxy.com/v1/users/avatar?userIds=${userIds.join(",")}&size=180x180&format=Png&isCircular=false`;

    console.log("[PROXY] Attempting to fetch from:", robloxUrl);

    try {
        const response = await fetch(robloxUrl, {
            method: "GET",
            cache: "no-store",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
                "Accept": "application/json"
            }
        });

        console.log("[PROXY] Received Status Code:", response.status);

        const bodyText = await response.text();

        // Log the exact raw text returned by the server, even if it fails
        console.log("[PROXY] Raw Response Body:", bodyText);

        if (!response.ok) {
            console.error("[PROXY] Request failed. Passing error to client.");
            return NextResponse.json(
                { error: "Failed to fetch thumbnails", details: bodyText },
                { status: response.status },
            );
        }

        return new NextResponse(bodyText, {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
            },
        });
    } catch (error) {
        console.error("[PROXY] Absolute Failure in try/catch block:", error);
        return NextResponse.json({ error: "Thumbnail proxy request failed" }, { status: 500 });
    }
}