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

    const robloxUrl = `https://thumbnails.roblox.com/v1/users/avatar?userIds=${userIds.join(",")}&size=180x180&format=Png&isCircular=false`;

    try {
        const response = await fetch(robloxUrl, {
            method: "GET",
            cache: "no-store",
        });

        const bodyText = await response.text();
        if (!response.ok) {
            return NextResponse.json(
                { error: "Failed to fetch thumbnails from Roblox", details: bodyText },
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
    } catch {
        return NextResponse.json({ error: "Thumbnail proxy request failed" }, { status: 500 });
    }
}