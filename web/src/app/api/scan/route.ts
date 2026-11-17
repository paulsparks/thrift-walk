import { type NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import {
    SCAN_MAX_NAME_LENGTH,
    SCAN_MAX_PHOTO_BYTES,
    SCAN_MAX_PHOTOS,
    SCAN_MIN_PHOTOS,
    SCAN_QUEUE,
} from "@/lib/scan-config";
import { resolveScanPath } from "@/lib/scan-storage";

import { mkdir, rm, writeFile } from "node:fs/promises";

export const runtime = "nodejs";

const MIME_EXTENSIONS: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/heic": "heic",
    "image/heif": "heif",
};
const NAME_EXTENSIONS = new Set(["jpg", "jpeg", "png", "heic", "heif"]);

/**
 * Browsers often report HEIC files as "" or application/octet-stream, so fall
 * back to the file name's extension when the MIME type isn't recognised.
 */
function photoExtension(file: File): string | undefined {
    const fromType = MIME_EXTENSIONS[file.type];
    if (fromType) return fromType;

    const fromName = file.name.split(".").pop()?.toLowerCase();
    if (!fromName || !NAME_EXTENSIONS.has(fromName)) return undefined;
    return fromName === "jpeg" ? "jpg" : fromName;
}

function error(message: string, status: number) {
    return NextResponse.json({ error: message }, { status });
}

/** Lists the signed-in user's most recent scans (polled by the scan list). */
export async function GET(req: NextRequest) {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) return error("Unauthorized", 401);

    const scans = await db.scanJob.findMany({
        where: { ownerId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
            id: true,
            name: true,
            status: true,
            progress: true,
            error: true,
            createdAt: true,
        },
    });

    return NextResponse.json({ scans });
}

/**
 * Accepts a multipart upload (`name` + several `photos`), stores the photos,
 * creates a ScanJob and queues it for the Python worker.
 */
export async function POST(req: NextRequest) {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) return error("Unauthorized", 401);

    let form: FormData;
    try {
        form = await req.formData();
    } catch {
        return error("Could not read the upload.", 400);
    }

    const name =
        String(form.get("name") ?? "")
            .trim()
            .slice(0, SCAN_MAX_NAME_LENGTH) || "Untitled item";
    const photos = form
        .getAll("photos")
        .filter((value): value is File => value instanceof File);

    if (photos.length < SCAN_MIN_PHOTOS || photos.length > SCAN_MAX_PHOTOS) {
        return error(
            `Upload between ${SCAN_MIN_PHOTOS} and ${SCAN_MAX_PHOTOS} photos.`,
            400,
        );
    }

    const extensions: string[] = [];
    for (const photo of photos) {
        const extension = photoExtension(photo);
        if (!extension) {
            return error(`${photo.name} is not a JPG, PNG or HEIC image.`, 400);
        }
        if (photo.size > SCAN_MAX_PHOTO_BYTES) {
            return error(
                `${photo.name} is larger than ${SCAN_MAX_PHOTO_BYTES / 1024 / 1024} MB.`,
                400,
            );
        }
        extensions.push(extension);
    }

    // Plain `db` (no policy plugin): scan jobs are written only by the server
    // and the worker, never by clients through /api/model.
    const job = await db.scanJob.create({
        data: { name, ownerId: session.user.id },
    });

    try {
        const imagePaths = extensions.map(
            (extension, i) =>
                `${job.id}/${String(i + 1).padStart(2, "0")}.${extension}`,
        );

        await mkdir(resolveScanPath(job.id), { recursive: true });
        // One at a time so we never hold every photo in memory at once.
        for (const [i, photo] of photos.entries()) {
            await writeFile(
                resolveScanPath(imagePaths[i]),
                Buffer.from(await photo.arrayBuffer()),
            );
        }

        await db.scanJob.update({
            where: { id: job.id },
            data: { imagePaths },
        });
        await redis.lpush(SCAN_QUEUE, JSON.stringify({ jobId: job.id }));
    } catch (err) {
        console.error("Scan upload failed", err);
        // Don't leave a job that will never be picked up.
        await rm(resolveScanPath(job.id), {
            recursive: true,
            force: true,
        }).catch(() => undefined);
        await db.scanJob
            .delete({ where: { id: job.id } })
            .catch(() => undefined);
        return error("Could not save the upload. Please try again.", 500);
    }

    return NextResponse.json({ id: job.id }, { status: 201 });
}
