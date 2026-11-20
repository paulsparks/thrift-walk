import sharp from "sharp";

import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";

const origin = "http://localhost:3100";
let cookie = "";
async function req(
    path: string,
    body?: unknown,
    method = body ? "POST" : "GET",
) {
    const r = await fetch(origin + path, {
        method,
        headers: {
            origin,
            cookie,
            ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (r.headers.getSetCookie().length)
        cookie = r.headers
            .getSetCookie()
            .map((h) => h.split(";")[0])
            .join("; ");
    return { status: r.status, data: await r.json() };
}
async function main() {
    assert.equal((await req("/api/market/session")).status, 401);
    assert.equal((await req("/api/market/server/world", {})).status, 403);
    assert.equal(
        (
            await req("/api/auth/sign-in/email", {
                email: "bob@example.test",
                password: "TestPassword123!",
            })
        ).status,
        200,
    );
    assert.equal((await req("/api/market/session")).status, 200);
    const invalidOrigin = await fetch(`${origin}/api/market/stores`, {
        method: "POST",
        headers: {
            cookie,
            origin: "https://evil.test",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "CSRF", requestId: crypto.randomUUID() }),
    });
    assert.equal(invalidOrigin.status, 403);
    const stores = await req("/api/market/stores");
    const storeId = stores.data.stores[0].id;
    async function upload(bytes: Uint8Array, type: string) {
        const form = new FormData();
        form.set("image", new File([new Uint8Array(bytes)], "image", { type }));
        const r = await fetch(`${origin}/api/market/upload`, {
            method: "POST",
            headers: { origin, cookie },
            body: form,
        });
        return { status: r.status, data: await r.json() };
    }
    assert.equal(
        (
            await upload(
                Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
                "image/png",
            )
        ).status,
        422,
    );
    assert.equal(
        (
            await upload(
                await sharp({
                    create: {
                        width: 4097,
                        height: 1,
                        channels: 3,
                        background: "red",
                    },
                })
                    .png()
                    .toBuffer(),
                "image/png",
            )
        ).status,
        422,
    );
    const image = await upload(
        await sharp({
            create: {
                width: 256,
                height: 192,
                channels: 3,
                background: "orange",
            },
        })
            .png()
            .toBuffer(),
        "image/png",
    );
    assert.equal(image.status, 200, JSON.stringify(image.data));
    const item = await req("/api/market/item", {
        storeId,
        name: "Smoke test lamp",
        details: "Native and browser transport validation",
        imageAssetId: image.data.id,
        externalUrl: "https://example.com/lamp",
        requestId: crypto.randomUUID(),
    });
    assert.equal(item.status, 200, JSON.stringify(item.data));
    const media = await fetch(`${origin}/api/media/${image.data.id}?thumb=1`, {
        headers: { cookie },
    });
    assert.equal(media.status, 200);
    assert.equal(media.headers.get("content-type"), "image/webp");
    const metadata = await sharp(
        Buffer.from(await media.arrayBuffer()),
    ).metadata();
    assert.ok(
        metadata.width &&
            metadata.height &&
            metadata.width <= 256 &&
            metadata.height <= 256,
    );
    await writeFile("/tmp/thrift-smoke-item", item.data.id);
    assert.equal(
        (await req("/api/model/item/deleteMany", { where: {} })).status,
        403,
    );
    console.log("HTTP_SMOKE_PASS", { itemId: item.data.id });
}
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
