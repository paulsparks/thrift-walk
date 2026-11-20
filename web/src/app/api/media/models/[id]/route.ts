import { db } from "@/lib/db";
import { resolveScanPath } from "@/lib/scan-storage";

import { readFile } from "node:fs/promises";

export const runtime = "nodejs";

// Like listing images, models attached to store items are visible to visitors.
// Unlisted scans remain private at /api/scan/[id]/model.
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const scan = await db.scanJob.findFirst({
        where: {
            id,
            status: "Completed",
            items: { some: { storeId: { not: null } } },
        },
        select: { glbPath: true },
    });
    if (!scan?.glbPath)
        return new Response("Model unavailable", { status: 404 });
    try {
        const preview = new URL(req.url).searchParams.get("preview") === "1";
        const bytes = await readFile(
            resolveScanPath(preview ? `${id}/preview.png` : scan.glbPath),
        );
        return new Response(new Uint8Array(bytes), {
            headers: {
                "Content-Type": preview ? "image/png" : "model/gltf-binary",
                "X-Content-Type-Options": "nosniff",
                "Cache-Control": "no-store",
            },
        });
    } catch {
        return new Response("Model unavailable", { status: 404 });
    }
}
