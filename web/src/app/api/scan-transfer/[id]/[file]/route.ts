import { db } from "@/lib/db";
import { resolveScanPath } from "@/lib/scan-storage";
import { validTransferToken } from "@/lib/scan-transfer";

import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string; file: string }> };
const limits: Record<string, number> = {
    "model.glb": 32 * 1024 * 1024,
    "preview.png": 8 * 1024 * 1024,
    "result.json": 1024,
};

async function authorize(req: Request, ctx: Context) {
    const { id, file } = await ctx.params;
    const url = new URL(req.url);
    if (
        !validTransferToken(
            req.method,
            id,
            file,
            url.searchParams.get("expires") ?? "",
            url.searchParams.get("token") ?? "",
        )
    )
        return null;
    const job = await db.scanJob.findUnique({
        where: { id, owner: { approved: true } },
        select: { status: true, imagePaths: true },
    });
    if (job?.status !== "Processing") return null;
    if (req.method === "GET" && !job.imagePaths.includes(`${id}/${file}`))
        return null;
    if (req.method === "PUT" && !Object.hasOwn(limits, file)) return null;
    return { id, file };
}

export async function GET(req: Request, ctx: Context) {
    const access = await authorize(req, ctx);
    if (!access) return new Response(null, { status: 403 });
    try {
        const data = await readFile(
            resolveScanPath(`${access.id}/${access.file}`),
        );
        return new Response(data, {
            headers: {
                "Content-Type": "application/octet-stream",
                "Cache-Control": "no-store",
            },
        });
    } catch {
        return new Response(null, { status: 404 });
    }
}

export async function PUT(req: Request, ctx: Context) {
    const access = await authorize(req, ctx);
    if (!access) return new Response(null, { status: 403 });
    if (!req.body) return new Response(null, { status: 400 });
    const destination = resolveScanPath(`${access.id}/${access.file}`);
    const temporary = `${destination}.${randomUUID()}.tmp`;
    await mkdir(path.dirname(destination), { recursive: true });
    const out = await open(temporary, "wx", 0o600);
    const reader = req.body.getReader();
    let size = 0;
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            size += value.length;
            if (size > limits[access.file]) {
                await reader.cancel();
                return new Response(null, { status: 413 });
            }
            await out.writeFile(value);
        }
        if (!size) return new Response(null, { status: 400 });
        await out.sync();
        await out.close();
        await rename(temporary, destination);
        return new Response(null, { status: 204 });
    } finally {
        await out.close();
        await rm(temporary, { force: true });
    }
}
