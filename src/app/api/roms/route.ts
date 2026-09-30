import { NextRequest, NextResponse } from "next/server";
import { searchRomIndex } from "@/lib/rom-index";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
	try {
		const params = request.nextUrl.searchParams;
		const query = params.get("q") ?? "";
		const limit = Number(params.get("limit") ?? "12");
		const { games, total } = await searchRomIndex(query, limit);
		return NextResponse.json({ games, total }, { headers: { "Cache-Control": "no-store" } });
	} catch (error) {
		console.error("Real index lookup failed", error);
		return NextResponse.json({ error: "The full index is taking a moment. Please try again." }, { status: 500 });
	}
}
