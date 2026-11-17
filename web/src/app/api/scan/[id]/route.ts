import { type NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveScanPath } from "@/lib/scan-storage";

import { rm } from "node:fs/promises";

export const runtime = "nodejs";

/** Permanently deletes one of the signed-in user's finished scans. */
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // One conditional delete, so a scan the worker has just picked up can
    // never be removed from under it.
    const { count } = await db.scanJob.deleteMany({
        where: {
            id,
            ownerId: session.user.id,
            status: { in: ["Completed", "Failed"] },
        },
    });

    if (count === 0) {
        const exists = await db.scanJob.findFirst({
            where: { id, ownerId: session.user.id },
            select: { id: true },
        });
        return exists
            ? NextResponse.json(
                  { error: "Wait for the scan to finish before deleting it." },
                  { status: 409 },
              )
            : NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // The row is gone, so a leftover folder is only wasted space.
    await rm(resolveScanPath(id), { recursive: true, force: true }).catch(
        (err) => console.error("Could not remove scan files", err),
    );

    return new NextResponse(null, { status: 204 });
}
