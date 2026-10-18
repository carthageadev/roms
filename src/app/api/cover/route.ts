import { NextRequest, NextResponse } from "next/server";
import { fetchGameCover } from "@/lib/covers";

export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;
const cache = new Map<string, { url: string | null; at: number }>();

// Box art for a cartridge label. Results are cached per title so the same
// game is never looked up twice in a day; misses return null and the client
// keeps its generated label.
export async function GET(request: NextRequest) {
  const title = (request.nextUrl.searchParams.get("title") ?? "").trim().slice(0, 200);
  if (!title) return NextResponse.json({ error: "A title is required." }, { status: 400 });
  const hit = cache.get(title);
  if (hit && Date.now() - hit.at < DAY) {
    return NextResponse.json({ url: hit.url }, { headers: { "Cache-Control": "private, max-age=3600" } });
  }
  const url = await fetchGameCover(title, 20000);
  cache.set(title, { url, at: Date.now() });
  return NextResponse.json({ url }, { headers: { "Cache-Control": "private, max-age=3600" } });
}
