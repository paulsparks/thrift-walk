import { db } from "@/lib/db";
import { trusted } from "@/lib/market/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Caddy keeps this endpoint private. Check both connectivity and migration state.
export async function GET(req: Request) {
    if (req.headers.has("authorization")) {
        try {
            trusted(req);
        } catch {
            return new Response(null, { status: 403 });
        }
    }
    try {
        await db.worldRevision.findUniqueOrThrow({
            where: { id: "demo_store" },
            select: { id: true },
        });
        return Response.json(
            { status: "ok" },
            {
                headers: { "Cache-Control": "no-store" },
            },
        );
    } catch {
        return Response.json(
            { status: "unavailable" },
            {
                status: 503,
                headers: { "Cache-Control": "no-store" },
            },
        );
    }
}
