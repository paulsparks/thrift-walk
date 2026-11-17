import sharp from "sharp";

import { db } from "@/lib/db";

import { boundedBody, fail } from "./validation";
import { randomUUID } from "node:crypto";
import {
    mkdir,
    readdir,
    readFile,
    stat,
    unlink,
    writeFile,
} from "node:fs/promises";
import path from "node:path";

const root = () => path.resolve(process.env.MEDIA_ROOT || ".media");
export async function upload(req: Request, ownerId: string) {
    const bytes = await boundedBody(req, 10 * 1024 * 1024 + 65536);
    let data: FormData;
    try {
        data = await new Response(new Uint8Array(bytes), {
            headers: { "content-type": req.headers.get("content-type") || "" },
        }).formData();
    } catch {
        return fail(422, "INVALID_IMAGE", "Choose a valid image upload.");
    }
    const file = data.get("image");
    if (!(file instanceof File) || file.size > 10 * 1024 * 1024)
        fail(
            422,
            "INVALID_IMAGE",
            "Choose a JPEG, PNG, or WebP image up to 10 MB.",
        );
    let normalized: Buffer;
    let width: number;
    let height: number;
    try {
        const image = sharp(Buffer.from(await file.arrayBuffer()), {
            limitInputPixels: 4096 * 4096,
            failOn: "warning",
        });
        const metadata = await image.metadata();
        if (
            !["jpeg", "png", "webp"].includes(metadata.format || "") ||
            !metadata.width ||
            !metadata.height ||
            metadata.width > 4096 ||
            metadata.height > 4096 ||
            (metadata.pages || 1) > 1
        )
            throw new Error("Unsupported image");
        const result = await image
            .rotate()
            .webp({ quality: 85 })
            .toBuffer({ resolveWithObject: true });
        normalized = result.data;
        if (normalized.length > 10 * 1024 * 1024)
            throw new Error("Normalized image exceeds size limit");
        width = result.info.width;
        height = result.info.height;
    } catch {
        return fail(
            422,
            "INVALID_IMAGE",
            "Use a valid, still JPEG, PNG, or WebP, at most 4096 pixels per side.",
        );
    }
    const id = randomUUID();
    await mkdir(root(), { recursive: true });
    try {
        await writeFile(path.join(root(), `${id}.webp`), normalized, {
            flag: "wx",
        });
        await writeFile(
            path.join(root(), `${id}.thumb.webp`),
            await sharp(normalized)
                .resize(256, 256, { fit: "inside", withoutEnlargement: true })
                .webp()
                .toBuffer(),
            { flag: "wx" },
        );
        await db.imageAsset.create({
            data: {
                id,
                ownerId,
                storageKey: id,
                mediaType: "image/webp",
                width,
                height,
                size: normalized.length,
            },
        });
    } catch (e) {
        await Promise.allSettled([
            unlink(path.join(root(), `${id}.webp`)),
            unlink(path.join(root(), `${id}.thumb.webp`)),
        ]);
        throw e;
    }
    return { id };
}
export async function media(id: string, thumb: boolean) {
    if (!/^[a-f0-9-]{36}$/.test(id)) fail(404, "NOT_FOUND", "Image not found.");
    // Only images attached to an item are public.
    if (
        !(await db.item.findFirst({
            where: { imageAssetId: id },
            select: { id: true },
        }))
    )
        fail(404, "NOT_FOUND", "Image not found.");
    return readFile(path.join(root(), `${id}${thumb ? ".thumb" : ""}.webp`));
}
export async function cleanupMedia() {
    const cutoff = new Date(Date.now() - 86400000);
    await db.$transaction(async (tx) => {
        // Attachment takes a SHARE lock. Skip in-flight saves, then recheck
        // references in a fresh statement while holding the candidate locks.
        const candidates = await tx.$qb
            .selectFrom("ImageAsset")
            .select("ImageAsset.id")
            .where("ImageAsset.createdAt", "<", cutoff.toISOString())
            .where((eb) =>
                eb.not(
                    eb.exists(
                        eb
                            .selectFrom("Item")
                            .select("Item.id")
                            .whereRef(
                                "Item.imageAssetId",
                                "=",
                                "ImageAsset.id",
                            ),
                    ),
                ),
            )
            .forUpdate("ImageAsset")
            .skipLocked()
            .execute();
        if (candidates.length)
            await tx.imageAsset.deleteMany({
                where: {
                    id: { in: candidates.map(({ id }) => id) },
                    items: { none: {} },
                },
            });
    });
    await mkdir(root(), { recursive: true });
    for (const name of await readdir(root())) {
        if (!/^[a-f0-9-]{36}(\.thumb)?\.webp$/.test(name)) continue;
        const file = path.join(root(), name);
        if (Date.now() - (await stat(file)).mtimeMs < 86400000) continue;
        if (
            !(await db.imageAsset.findUnique({
                where: { id: name.slice(0, 36) },
                select: { id: true },
            }))
        )
            await unlink(file);
    }
    await db.marketRate.deleteMany({ where: { expiresAt: { lt: cutoff } } });
}
