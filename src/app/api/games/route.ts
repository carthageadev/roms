import { NextRequest, NextResponse } from "next/server";
import { getGames } from "@/lib/archive";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const results = await getGames({ query: params.get("q") ?? "", platform: params.get("platform") ?? "all", genre: params.get("genre") ?? "all", decade: params.get("decade") ?? "", sort: params.get("sort") ?? "featured" });
    return NextResponse.json({ games: results, total: results.length }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Catalog lookup failed", error);
    return NextResponse.json({ error: "The archive is taking a moment. Please try again." }, { status: 500 });
  }
}
