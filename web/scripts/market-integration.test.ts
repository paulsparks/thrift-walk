import { NextRequest } from "next/server";
import { Pool } from "pg";
import sharp from "sharp";

import { listingUrl, placement } from "@/lib/market/validation";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

// Run ONLY against an empty disposable database; never the development database.
const origin = "http://localhost:3000";
const secret = "integration-test-server-secret-32-characters";
process.env.GAME_SERVER_SECRET = secret;
const request = (cookie: string, method = "POST") =>
    new Request(`${origin}/api/market/stores`, {
        method,
        headers: { cookie, origin },
    });
const serverRequest = () =>
    new Request(`${origin}/api/market/server/place`, {
        method: "POST",
        headers: { authorization: `Bearer ${secret}` },
    });
async function rejects(fn: () => Promise<unknown>, status: number) {
    await assert.rejects(
        fn,
        (e: unknown) => (e as { status: number }).status === status,
    );
}

test("marketplace authorization, persistence and races", async (t) => {
    assert.match(
        process.env.DATABASE_URL || "",
        /:55432\//,
        "Use the isolated test database on port 55432",
    );
    const databaseName = `market_test_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: process.env.DATABASE_URL });
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    const url = new URL(process.env.DATABASE_URL as string);
    url.pathname = `/${databaseName}`;
    process.env.DATABASE_URL = url.href;
    // Separate driver access is confined to migration fixtures and lock probes.
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const { db, dbWithAuth } = await import("@/lib/db");
    const { auth } = await import("@/lib/auth");
    const { clientOperation, serverOperation, snapshot } = await import(
        "@/lib/market/service"
    );
    t.after(async () => {
        await db.$disconnect();
        await pool.end();
        // pg-pool can resolve end() before socket-close callbacks finish.
        // Normal DROP waits for those disconnects instead of killing them and
        // emitting asynchronous connection errors after the assertions finish.
        await admin.query(`DROP DATABASE "${databaseName}"`);
        await admin.end();
    });
    for (const name of (await readdir("zenstack/migrations"))
        .filter((n) => /^\d/.test(n))
        .sort()) {
        if (name === "20261117000000_storefront") {
            await pool.query(`INSERT INTO "user"(id,name,email,"updatedAt") VALUES('legacy-user','Legacy','legacy@example.test',now());
                INSERT INTO item(id,name,details,"priceCents") VALUES('legacy-item','Legacy find','Original record',1200);
                INSERT INTO wishlist_item(id,"userId","itemId") VALUES('legacy-wishlist','legacy-user','legacy-item');`);
        }
        await pool.query(
            await readFile(`zenstack/migrations/${name}/migration.sql`, "utf8"),
        );
    }
    assert.equal(
        (await pool.query(`SELECT "storeId" FROM item WHERE id='legacy-item'`))
            .rows[0].storeId,
        null,
    );
    assert.equal(
        (
            await pool.query(
                `SELECT id FROM wishlist_item WHERE id='legacy-wishlist'`,
            )
        ).rowCount,
        1,
    );
    const users = [];
    for (const name of ["Alice", "Bob"]) {
        const r = await auth.api.signUpEmail({
            body: {
                name,
                email: `${name.toLowerCase()}@example.test`,
                password: "TestPassword123!",
            },
            asResponse: true,
        });
        assert.equal(r.status, 200, await r.clone().text());
        const cookie = r.headers
            .getSetCookie()
            .map((h) => h.split(";")[0])
            .join("; ");
        const s = await auth.api.getSession({
            headers: new Headers({ cookie }),
        });
        assert.ok(s);
        users.push({ cookie, id: s.user.id, sessionId: s.session.id });
    }
    const [a, b] = users;
    await t.test(
        "procedures require user context and remain private over HTTP",
        async () => {
            await rejects(async () => db.$procs.marketStores(), 401);
            assert.deepEqual(
                await db.$setAuth({ id: a.id }).$procs.marketStores(),
                {
                    accountId: a.id,
                    stores: [],
                },
            );
            const { POST } = await import("@/app/api/model/[...path]/route");
            for (const name of [
                "marketCreateStore",
                "marketRedeemTicket",
                "marketWorld",
            ]) {
                const response = await POST(
                    new NextRequest(`${origin}/api/model/$procs/${name}`, {
                        method: "POST",
                        headers: {
                            cookie: a.cookie,
                            origin,
                            "content-type": "application/json",
                        },
                        body: JSON.stringify({
                            args: { userId: b.id, sessionId: b.sessionId },
                        }),
                    }),
                    { params: Promise.resolve({ path: ["$procs", name] }) },
                );
                assert.equal(response.status, 403);
            }
        },
    );
    const create = () =>
        clientOperation(request(a.cookie), "stores", {
            name: "Alice’s Store",
            requestId: randomUUID(),
        });
    const concurrent = await Promise.allSettled(
        Array.from({ length: 8 }, create),
    );
    assert.equal(concurrent.filter((r) => r.status === "fulfilled").length, 3);
    assert.equal(
        Number(
            (
                await pool.query(
                    'SELECT count(*) FROM store WHERE "ownerId"=$1',
                    [a.id],
                )
            ).rows[0].count,
        ),
        3,
    );
    const bkey = randomUUID();
    const duplicated = (await Promise.all(
        Array.from({ length: 5 }, () =>
            clientOperation(request(b.cookie), "stores", {
                name: "Bob’s Store",
                requestId: bkey,
            }),
        ),
    )) as { id: string }[];
    assert.equal(new Set(duplicated.map((s) => s.id)).size, 1);
    await t.test(
        "existing receipts replay and failed writes roll back",
        async () => {
            const { digest } = await import("@/lib/market/procedures");
            const key = randomUUID(),
                name = "Previously committed store";
            const result = { id: duplicated[0].id, name };
            await pool.query(
                'INSERT INTO market_request("userId",key,fingerprint,result) VALUES($1,$2,$3,$4)',
                [
                    b.id,
                    key,
                    digest(JSON.stringify({ op: "stores", name })),
                    JSON.stringify(result),
                ],
            );
            assert.deepEqual(
                await clientOperation(request(b.cookie), "stores", {
                    name,
                    requestId: key,
                }),
                result,
            );
            const rejectedKey = randomUUID();
            await rejects(
                () =>
                    clientOperation(request(a.cookie), "stores", {
                        name: "Fourth store",
                        requestId: rejectedKey,
                    }),
                409,
            );
            assert.equal(
                await db.marketRequest.count({
                    where: { userId: a.id, key: rejectedKey },
                }),
                0,
            );
        },
    );
    await rejects(
        () =>
            clientOperation(request(b.cookie), "stores", {
                name: "Different",
                requestId: bkey,
            }),
        409,
    );
    const store = (
        await pool.query('SELECT id FROM store WHERE "ownerId"=$1 LIMIT 1', [
            a.id,
        ])
    ).rows[0].id;
    const ownStores = (await clientOperation(
        request(a.cookie, "GET"),
        "stores",
        {},
    )) as { accountId: string };
    const ownInventory = (await clientOperation(
        request(a.cookie, "GET"),
        "inventory",
        { storeId: store },
    )) as { accountId: string };
    assert.equal(ownStores.accountId, a.id);
    assert.equal(ownInventory.accountId, a.id);
    await rejects(
        () =>
            clientOperation(request(b.cookie, "GET"), "inventory", {
                storeId: store,
            }),
        404,
    );
    await rejects(() => clientOperation(request("", "GET"), "stores", {}), 401);
    const image = randomUUID();
    await pool.query(
        "INSERT INTO image_asset VALUES($1,$2,$1,'image/webp',64,64,100,now())",
        [image, a.id],
    );
    const itemBody = {
        storeId: store,
        name: "Lamp",
        details: "A warm light",
        imageAssetId: image,
        externalUrl: "https://example.com/lamp",
        requestId: randomUUID(),
    };
    const item = (await clientOperation(
        request(a.cookie),
        "item",
        itemBody,
    )) as { id: string };
    await rejects(
        () =>
            clientOperation(request(b.cookie), "item", {
                ...itemBody,
                storeId: duplicated[0].id,
                requestId: randomUUID(),
            }),
        422,
    );
    const ticket = (await clientOperation(request(a.cookie), "ticket", {})) as {
        ticket: string;
    };
    const admitted = (await serverOperation(serverRequest(), "redeem", {
        ticket: ticket.ticket,
        worldId: "demo_store",
    })) as { sessionId: string };
    assert.equal(admitted.sessionId, a.sessionId);
    await rejects(
        () =>
            serverOperation(serverRequest(), "redeem", {
                ticket: ticket.ticket,
                worldId: "demo_store",
            }),
        401,
    );
    await rejects(() => serverOperation(request(a.cookie), "place", {}), 403);
    await t.test("a ticket has only one concurrent redeemer", async () => {
        const issued = await db
            .$setAuth({ id: a.id, sessions: [{ id: a.sessionId }] })
            .$procs.marketIssueTicket();
        const results = await Promise.allSettled(
            Array.from({ length: 6 }, () =>
                serverOperation(serverRequest(), "redeem", {
                    ticket: issued.ticket,
                    worldId: "demo_store",
                }),
            ),
        );
        assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
        for (const result of results)
            if (result.status === "rejected")
                assert.equal(result.reason.status, 401);
    });
    const p = {
        sessionId: a.sessionId,
        itemId: item.id,
        worldId: "demo_store",
        surfaceId: "demo-board",
        x: 0,
        y: 1.5,
        z: -1.94,
        yaw: 0,
    };
    const placements = await Promise.allSettled(
        Array.from({ length: 6 }, () =>
            serverOperation(serverRequest(), "place", {
                ...p,
                requestId: randomUUID(),
            }),
        ),
    );
    assert.equal(placements.filter((r) => r.status === "fulfilled").length, 1);
    const frame = (await snapshot()).placements[0];
    await rejects(
        () =>
            serverOperation(serverRequest(), "remove", {
                sessionId: b.sessionId,
                itemId: item.id,
                placementId: frame.id,
                revision: 1,
                requestId: randomUUID(),
            }),
        404,
    );
    const remove = {
        sessionId: a.sessionId,
        itemId: item.id,
        placementId: frame.id,
        revision: 1,
        requestId: randomUUID(),
    };
    await serverOperation(serverRequest(), "remove", remove);
    const placeKey = randomUUID();
    const same = (await Promise.all(
        Array.from({ length: 5 }, () =>
            serverOperation(serverRequest(), "place", {
                ...p,
                requestId: placeKey,
            }),
        ),
    )) as { id: string }[];
    assert.equal(new Set(same.map((v) => v.id)).size, 1);
    await rejects(
        () =>
            serverOperation(serverRequest(), "remove", {
                ...remove,
                requestId: randomUUID(),
            }),
        409,
    );
    const saved = await Promise.all(
        Array.from({ length: 6 }, () =>
            clientOperation(request(a.cookie), "wishlist", {
                itemId: item.id,
                saved: true,
                requestId: randomUUID(),
            }),
        ),
    );
    assert.equal(saved.length, 6);
    assert.equal(
        Number(
            (
                await pool.query(
                    'SELECT count(*) FROM wishlist_item WHERE "itemId"=$1',
                    [item.id],
                )
            ).rows[0].count,
        ),
        1,
    );
    const aDb = dbWithAuth.$setAuth({ id: a.id }),
        bDb = dbWithAuth.$setAuth({ id: b.id });
    const { getProfileData } = await import("@/lib/profile");
    const aliceProfile = await getProfileData(aDb, a.id);
    assert.equal(aliceProfile.user.name, "Alice");
    assert.equal(aliceProfile.user.image, null);
    assert.equal(aliceProfile.user.bio, "");
    assert.equal(aliceProfile.stores.length, 3);
    assert.equal(aliceProfile.inventory.length, 1);
    assert.equal(aliceProfile.inventory[0].id, item.id);
    assert.equal(aliceProfile.inventory[0].storeId, store);
    assert.equal(aliceProfile.inventory[0].imageAssetId, image);
    assert.equal(aliceProfile.inventory[0].priceCents, null);
    assert.equal(aliceProfile.inventory[0].externalUrl, itemBody.externalUrl);
    assert.ok(aliceProfile.inventory[0].placement);
    assert.equal(aliceProfile.wishlist[0].item.imageAssetId, image);
    assert.equal(
        aliceProfile.wishlist[0].item.externalUrl,
        itemBody.externalUrl,
    );
    const bobProfile = await getProfileData(bDb, b.id);
    assert.equal(bobProfile.user.name, "Bob");
    assert.equal(bobProfile.stores.length, 1);
    assert.deepEqual(bobProfile.inventory, []);
    assert.deepEqual(bobProfile.wishlist, []);
    await assert.rejects(() => getProfileData(bDb, a.id));
    const updatedProfile = await auth.api.updateUser({
        headers: new Headers({ cookie: a.cookie }),
        body: {
            name: "Alice Updated",
            image: "https://example.com/avatar.png",
            bio: "  Vintage finds.\nEspecially lamps.  ",
        },
        asResponse: true,
    });
    assert.equal(updatedProfile.status, 200);
    assert.deepEqual((await getProfileData(aDb, a.id)).user, {
        name: "Alice Updated",
        image: "https://example.com/avatar.png",
        bio: "Vintage finds.\nEspecially lamps.",
    });
    assert.equal((await getProfileData(bDb, b.id)).user.name, "Bob");
    assert.equal((await getProfileData(bDb, b.id)).user.bio, "");
    const oversizedBio = await auth.api.updateUser({
        headers: new Headers({ cookie: a.cookie }),
        body: { bio: "x".repeat(501) },
        asResponse: true,
    });
    assert.equal(oversizedBio.status, 400);
    assert.equal(
        (await getProfileData(aDb, a.id)).user.bio,
        "Vintage finds.\nEspecially lamps.",
    );
    await auth.api.updateUser({
        headers: new Headers({ cookie: a.cookie }),
        body: { name: "Alice", image: null, bio: "" },
    });
    assert.equal((await getProfileData(aDb, a.id)).user.image, null);
    assert.equal((await getProfileData(aDb, a.id)).user.bio, "");
    assert.equal((await bDb.wishlistItem.findMany()).length, 0);
    assert.equal(
        (await bDb.store.findMany({ where: { id: store } })).length,
        0,
    );
    await assert.rejects(() =>
        aDb.store.create({ data: { name: "Bypass", ownerId: a.id } }),
    );
    assert.equal(
        (await aDb.itemPlacement.deleteMany({ where: { itemId: item.id } }))
            .count,
        0,
    );
    assert.equal((await snapshot()).placements.length, 1);
    await assert.rejects(() =>
        aDb.item.update({
            where: { id: item.id },
            data: { store: { update: { ownerId: b.id } } },
        }),
    );
    const before = (await snapshot()).revision;
    await clientOperation(request(a.cookie), "item", {
        ...itemBody,
        id: item.id,
        name: "Updated lamp",
        requestId: randomUUID(),
    });
    const after = await snapshot();
    assert.ok(BigInt(after.revision) > BigInt(before));
    assert.equal(after.placements[0].name, "Updated lamp");
    const deletion = { id: store, requestId: randomUUID() };
    await rejects(
        () => clientOperation(request(b.cookie, "DELETE"), "stores", deletion),
        404,
    );
    assert.equal((await snapshot()).placements.length, 1);
    const deleted = await clientOperation(
        request(a.cookie, "DELETE"),
        "stores",
        deletion,
    );
    assert.deepEqual(
        await clientOperation(request(a.cookie, "DELETE"), "stores", deletion),
        deleted,
    );
    assert.equal((await snapshot()).placements.length, 0);
    assert.ok(BigInt((await snapshot()).revision) > BigInt(after.revision));
    assert.equal(
        (await pool.query('SELECT id FROM item WHERE "storeId"=$1', [store]))
            .rowCount,
        0,
    );
    assert.equal((await aDb.wishlistItem.findMany()).length, 0);
    await create(); // Deleting a store frees a slot.
    await t.test(
        "world lock serializes overlapping placements from different owners",
        async () => {
            const aliceStore = await db.store.findFirstOrThrow({
                where: { ownerId: a.id },
            });
            const bobImage = await db.imageAsset.create({
                data: {
                    id: randomUUID(),
                    ownerId: b.id,
                    storageKey: randomUUID(),
                    mediaType: "image/webp",
                    width: 16,
                    height: 16,
                    size: 100,
                },
            });
            const owned = [
                { account: a, storeId: aliceStore.id, imageId: image },
                { account: b, storeId: duplicated[0].id, imageId: bobImage.id },
            ];
            const items = await Promise.all(
                owned.map(async (entry) => {
                    const result = await clientOperation(
                        request(entry.account.cookie),
                        "item",
                        {
                            storeId: entry.storeId,
                            name: "Overlap test",
                            details: "A concurrent placement",
                            externalUrl: "https://example.com/item",
                            imageAssetId: entry.imageId,
                            requestId: randomUUID(),
                        },
                    );
                    return result as { id: string };
                }),
            );
            const results = await Promise.allSettled(
                owned.map((entry, i) =>
                    serverOperation(serverRequest(), "place", {
                        ...p,
                        sessionId: entry.account.sessionId,
                        itemId: items[i].id,
                        requestId: randomUUID(),
                    }),
                ),
            );
            assert.equal(
                results.filter((r) => r.status === "fulfilled").length,
                1,
            );
            const failure = results.find((r) => r.status === "rejected");
            assert.equal(failure?.reason.code, "OCCUPIED");
            for (const [i, entry] of owned.entries())
                await clientOperation(
                    request(entry.account.cookie, "DELETE"),
                    "item",
                    {
                        id: items[i].id,
                        storeId: entry.storeId,
                        requestId: randomUUID(),
                    },
                );
            await db.imageAsset.delete({ where: { id: bobImage.id } });
        },
    );
    await t.test(
        "HTTP adapters preserve JSON, errors and image delivery",
        async () => {
            const market = await import("@/app/api/market/[...path]/route");
            const images = await import("@/app/api/media/[id]/route");
            const previousRoot = process.env.MEDIA_ROOT;
            const mediaRoot = await mkdtemp(
                join(tmpdir(), "thrift-procedure-http-"),
            );
            process.env.MEDIA_ROOT = mediaRoot;
            let imageId: string | undefined;
            const call = (
                op: string,
                body: Record<string, unknown>,
                cookie = b.cookie,
                requestOrigin = origin,
            ) =>
                market.POST(
                    new Request(`${origin}/api/market/${op}`, {
                        method: "POST",
                        headers: {
                            cookie,
                            origin: requestOrigin,
                            "content-type": "application/json",
                        },
                        body: JSON.stringify(body),
                    }),
                    { params: Promise.resolve({ path: op.split("/") }) },
                );
            try {
                assert.equal(
                    (
                        await call(
                            "stores",
                            { name: "Invalid origin", requestId: randomUUID() },
                            b.cookie,
                            "https://other.test",
                        )
                    ).status,
                    403,
                );
                assert.equal(
                    (
                        await call(
                            "stores",
                            { name: "No session", requestId: randomUUID() },
                            "",
                        )
                    ).status,
                    401,
                );
                assert.equal((await call("server/world", {})).status, 403);
                const invalid = await call("item", {
                    storeId: duplicated[0].id,
                    requestId: randomUUID(),
                });
                assert.equal(invalid.status, 422);
                assert.equal((await invalid.json()).code, "INVALID_INPUT");
                const form = new FormData();
                form.set(
                    "image",
                    new File(
                        [
                            new Uint8Array(
                                await sharp({
                                    create: {
                                        width: 16,
                                        height: 16,
                                        channels: 3,
                                        background: "red",
                                    },
                                })
                                    .png()
                                    .toBuffer(),
                            ),
                        ],
                        "picture.png",
                        { type: "image/png" },
                    ),
                );
                const upload = await market.POST(
                    new Request(`${origin}/api/market/upload`, {
                        method: "POST",
                        headers: { cookie: b.cookie, origin },
                        body: form,
                    }),
                    { params: Promise.resolve({ path: ["upload"] }) },
                );
                assert.equal(upload.status, 200);
                imageId = (await upload.json()).id as string;
                const body = {
                    storeId: duplicated[0].id,
                    name: "HTTP item",
                    details: "Procedure adapter test",
                    externalUrl: "https://example.com/listing",
                    imageAssetId: imageId,
                    requestId: randomUUID(),
                };
                const saved = await call("item", body);
                assert.equal(saved.status, 200);
                const item = await saved.json();
                assert.deepEqual(await (await call("item", body)).json(), item);
                const inventory = await market.GET(
                    new Request(
                        `${origin}/api/market/inventory?storeId=${duplicated[0].id}`,
                        { headers: { cookie: b.cookie } },
                    ),
                    { params: Promise.resolve({ path: ["inventory"] }) },
                );
                assert.equal(
                    inventory.headers.get("cache-control"),
                    "no-store",
                );
                const data = await inventory.json();
                assert.equal(data.accountId, b.id);
                assert.equal(
                    data.items.find(
                        (entry: { id: string }) => entry.id === item.id,
                    ).imageAssetId,
                    imageId,
                );
                const image = await images.GET(
                    new Request(`${origin}/api/media/${imageId}?thumb=1`),
                    { params: Promise.resolve({ id: imageId }) },
                );
                assert.equal(image.status, 200);
                assert.equal(image.headers.get("content-type"), "image/webp");
                assert.equal(
                    (
                        await sharp(
                            Buffer.from(await image.arrayBuffer()),
                        ).metadata()
                    ).format,
                    "webp",
                );
            } finally {
                if (imageId) {
                    await db.item.deleteMany({
                        where: { imageAssetId: imageId },
                    });
                    await db.imageAsset.deleteMany({ where: { id: imageId } });
                }
                if (previousRoot === undefined) delete process.env.MEDIA_ROOT;
                else process.env.MEDIA_ROOT = previousRoot;
                await rm(mediaRoot, { recursive: true, force: true });
            }
        },
    );
    await t.test("query-builder rate increments remain atomic", async () => {
        const { rate } = await import("@/lib/market/service");
        const key = `test:${randomUUID()}`;
        const results = await Promise.allSettled(
            Array.from({ length: 12 }, () => rate(key, 5)),
        );
        assert.equal(results.filter((r) => r.status === "fulfilled").length, 5);
        for (const result of results)
            if (result.status === "rejected")
                assert.equal(result.reason.status, 429);
        assert.equal(
            (await db.marketRate.findUniqueOrThrow({ where: { key } })).count,
            12,
        );
        await db.marketRate.update({
            where: { key },
            data: { expiresAt: new Date(0) },
        });
        await rate(key, 5);
        assert.equal(
            (await db.marketRate.findUniqueOrThrow({ where: { key } })).count,
            1,
        );
    });
    await t.test("cleanup preserves an image being attached", async () => {
        const { cleanupMedia } = await import("@/lib/market/media");
        const previousRoot = process.env.MEDIA_ROOT;
        const mediaRoot = await mkdtemp(join(tmpdir(), "thrift-media-test-"));
        process.env.MEDIA_ROOT = mediaRoot;
        const attaching = await pool.connect();
        try {
            const attached = randomUUID(),
                abandoned = randomUUID();
            for (const id of [attached, abandoned])
                await pool.query(
                    `INSERT INTO image_asset VALUES($1,$2,$1,'image/webp',64,64,100,now()-interval '25 hours')`,
                    [id, a.id],
                );
            await attaching.query("BEGIN");
            await attaching.query(
                "SELECT id FROM image_asset WHERE id=$1 FOR SHARE",
                [attached],
            );
            const savedItem = randomUUID();
            await attaching.query(
                `INSERT INTO item(id,name,details,"imageAssetId") VALUES($1,'Cleanup race','Test',$2)`,
                [savedItem, attached],
            );
            // Cleanup must finish while the attachment holds its SHARE lock.
            // A bounded timeout makes the old blocking DELETE fail this test.
            let timer: ReturnType<typeof setTimeout> | undefined;
            const running = cleanupMedia();
            try {
                await Promise.race([
                    running,
                    new Promise<never>((_, reject) => {
                        timer = setTimeout(
                            () =>
                                reject(
                                    new Error("Cleanup blocked on attachment"),
                                ),
                            5000,
                        );
                    }),
                ]);
            } finally {
                clearTimeout(timer);
                await attaching.query("COMMIT");
                await running;
            }
            await cleanupMedia();
            assert.equal(
                (
                    await pool.query(
                        'SELECT "imageAssetId" FROM item WHERE id=$1',
                        [savedItem],
                    )
                ).rows[0].imageAssetId,
                attached,
            );
            assert.equal(
                (
                    await pool.query("SELECT id FROM image_asset WHERE id=$1", [
                        abandoned,
                    ])
                ).rowCount,
                0,
            );
            assert.equal(
                (
                    await pool.query("SELECT id FROM image_asset WHERE id=$1", [
                        attached,
                    ])
                ).rowCount,
                1,
            );
        } finally {
            await attaching.query("ROLLBACK");
            attaching.release();
            if (previousRoot === undefined) delete process.env.MEDIA_ROOT;
            else process.env.MEDIA_ROOT = previousRoot;
            await rm(mediaRoot, { recursive: true, force: true });
        }
    });
    await pool.query("DELETE FROM session WHERE id=$1", [a.sessionId]);
    await rejects(
        () =>
            serverOperation(serverRequest(), "validate", {
                sessionId: a.sessionId,
            }),
        401,
    );
    await rejects(
        () => clientOperation(request(a.cookie, "GET"), "stores", {}),
        401,
    );
});

test("reject unsafe links and forged geometry", () => {
    for (const url of [
        "javascript:alert(1)",
        "file:///tmp/a",
        "http://example.com",
        "https://user:pass@example.com",
    ])
        assert.throws(() => listingUrl(url));
    assert.equal(listingUrl("https://example.com/a"), "https://example.com/a");
    for (const bad of [
        { x: NaN },
        { x: Infinity },
        { x: 2.8 },
        { y: 0.6 },
        { x: 0.15 },
        { yaw: 1 },
        { surfaceId: "anywhere" },
    ])
        assert.throws(() =>
            placement({
                worldId: "demo_store",
                surfaceId: "demo-board",
                x: 0,
                y: 1.5,
                z: -1.94,
                yaw: 0,
                ...bad,
            }),
        );
});
