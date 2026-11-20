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

    const result = await db.$transaction(async (tx) => {
        // Serialize deletion with item attachment, which holds a SHARE lock.
        const job = await tx.$qb
            .selectFrom("ScanJob")
            .select(["id", "status"])
            .where("id", "=", id)
            .where("ownerId", "=", session.user.id)
            .forUpdate()
            .executeTakeFirst();
        if (!job) return { status: 404, error: "Not found" };
        if (job.status !== "Completed" && job.status !== "Failed")
            return {
                status: 409,
                error: "Wait for the scan to finish before deleting it.",
            };
        if (
            await tx.item.findFirst({
                where: { scanJobId: id },
                select: { id: true },
            })
        )
            return {
                status: 409,
                error: "This scan is used by a store item. Change or delete that item first.",
            };
        await tx.scanJob.delete({ where: { id } });
        return null;
    });
    if (result)
        return NextResponse.json(
            { error: result.error },
            { status: result.status },
        );

    // The row is gone, so a leftover folder is only wasted space.
    await rm(resolveScanPath(id), { recursive: true, force: true }).catch(
        (err) => console.error("Could not remove scan files", err),
    );

    return new NextResponse(null, { status: 204 });
}
