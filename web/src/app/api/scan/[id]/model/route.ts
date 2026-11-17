import { type NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveScanPath } from "@/lib/scan-storage";

import { readFile } from "node:fs/promises";

export const runtime = "nodejs";

/** Streams a finished scan's .glb to its owner (web preview, game client). */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const job = await db.scanJob.findFirst({
        where: { id, ownerId: session.user.id, status: "Completed" },
        select: { name: true, glbPath: true },
    });

    if (!job?.glbPath) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let file: Buffer;
    try {
        file = await readFile(resolveScanPath(job.glbPath));
    } catch {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const filename = `${job.name.replace(/[^\w.-]+/g, "_") || "model"}.glb`;

    return new Response(new Uint8Array(file), {
        headers: {
            "Content-Type": "model/gltf-binary",
            "Content-Disposition": `inline; filename="${filename}"`,
            "Cache-Control": "private, max-age=0, must-revalidate",
        },
    });
}
