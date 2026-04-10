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
    const userIdsRaw = request.nextUrl.searchParams.get("userIds") ?? "";
    const userIds = sanitizeUserIds(userIdsRaw);

    if (userIds.length === 0) {
        return NextResponse.json({ error: "No valid userIds provided" }, { status: 400 });
    }

    const robloxUrl = `https://thumbnails.roproxy.com/v1/users/avatar?userIds=${userIds.join(",")}&size=180x180&format=Png&isCircular=false`;

    try {
        const response = await fetch(robloxUrl, {
            method: "GET",
            cache: "no-store",
            headers: {
                // Mimic a standard desktop browser to bypass Roblox bot protection
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
                "Accept": "application/json"
            }
        });

        const bodyText = await response.text();

        if (!response.ok) {
            return NextResponse.json(
                { error: "Failed to fetch thumbnails from Roblox", details: bodyText },
                { status: response.status },
            );
        }

        console.log("SUCCESSFULLY FETCH THUMBNAILS")
        return new NextResponse(bodyText, {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
            },
        });
    } catch {
        console.log("FAILED TO FETCH THUMBNAILS")
        return NextResponse.json({ error: "Thumbnail proxy request failed" }, { status: 500 });
    }
}