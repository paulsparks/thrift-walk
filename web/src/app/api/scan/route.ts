import { type NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import {
    SCAN_MAX_ACTIVE_PER_USER,
    SCAN_MAX_NAME_LENGTH,
    SCAN_MAX_PHOTO_BYTES,
    SCAN_MAX_PHOTOS,
    SCAN_MAX_QUEUED_TOTAL,
    SCAN_MAX_STORED_PER_USER,
    SCAN_MIN_PHOTOS,
    SCAN_QUEUE,
    type ScanStatus,
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

const ACTIVE_STATUSES: ScanStatus[] = ["Pending", "Processing"];

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

/**
 * Cheap checks that run before the upload body is read, so a rejected request
 * never costs memory, disk or worker time. Returns an error response, or null
 * if the user may submit another scan.
 */
async function admissionError(ownerId: string) {
    const [active, queued, stored] = await Promise.all([
        db.scanJob.count({
            where: { ownerId, status: { in: ACTIVE_STATUSES } },
        }),
        db.scanJob.count({ where: { status: { in: ACTIVE_STATUSES } } }),
        db.scanJob.count({ where: { ownerId } }),
    ]);

    if (active >= SCAN_MAX_ACTIVE_PER_USER) {
        return error(
            `You already have ${SCAN_MAX_ACTIVE_PER_USER} scans in progress. Wait for one to finish.`,
            429,
        );
    }
    if (queued >= SCAN_MAX_QUEUED_TOTAL) {
        return error("The scanner is busy right now. Try again soon.", 503);
    }
    if (stored >= SCAN_MAX_STORED_PER_USER) {
        return error(
            `You can keep ${SCAN_MAX_STORED_PER_USER} scans. Delete some to add more.`,
            409,
        );
    }
    return null;
}

/** Lists the signed-in user's most recent scans (polled by the scan list). */
export async function GET(req: NextRequest) {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) return error("Unauthorized", 401);

    const scans = await db.scanJob.findMany({
        where: { ownerId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: SCAN_MAX_STORED_PER_USER,
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
    const ownerId = session.user.id;

    const rejected = await admissionError(ownerId);
    if (rejected) return rejected;

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
        data: { name, ownerId },
    });

    // Two uploads can pass the early check at the same moment. Count again now
    // that this job exists, and back out (before saving any photo) if the user
    // went over. At worst both back out; neither can slip past the limit.
    const activeNow = await db.scanJob.count({
        where: { ownerId, status: { in: ACTIVE_STATUSES } },
    });
    if (activeNow > SCAN_MAX_ACTIVE_PER_USER) {
        await db.scanJob
            .delete({ where: { id: job.id } })
            .catch(() => undefined);
        return error(
            `You already have ${SCAN_MAX_ACTIVE_PER_USER} scans in progress. Wait for one to finish.`,
            429,
        );
    }

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
