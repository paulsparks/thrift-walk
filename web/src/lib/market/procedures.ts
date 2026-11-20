import {
    type ClientContract,
    type ClientOptions,
    type JsonValue,
    type ProceduresOptions,
    type TransactionClientContract,
    TransactionIsolationLevel,
} from "@zenstackhq/orm";

import type { MarketReceipt } from "~/zenstack/models";
import type { SchemaType } from "~/zenstack/schema";

import { fail, listingUrl, placement, text } from "./validation";
import { createHash, randomBytes, randomUUID } from "node:crypto";

// These procedures run on the internal client, after the HTTP adapter authenticates
// the caller. Keep explicit ownership checks: this client does not install policies.
// Never expose these procedures through the generic model API.
type Client = ClientContract<SchemaType>;
type Tx = TransactionClientContract<
    SchemaType,
    ClientOptions<SchemaType>,
    Record<never, never>,
    Record<never, never>
>;
export const digest = (value: string) =>
    createHash("sha256").update(value).digest("hex");
const json = (value: unknown): JsonValue => JSON.parse(JSON.stringify(value));
function user(client: Client) {
    const id = client.$auth?.id;
    if (!id) fail(401, "SESSION_ENDED", "Your session ended. Sign in again.");
    return id;
}

export async function rate(client: Client, key: string, limit = 60) {
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 60000).toISOString();
    const row = await client.$qb
        .insertInto("MarketRate")
        .values({ key, count: 1, expiresAt })
        .onConflict((oc) =>
            oc.column("key").doUpdateSet((eb) => ({
                count: eb
                    .case()
                    .when("MarketRate.expiresAt", "<", now)
                    .then(1)
                    .else(eb("MarketRate.count", "+", 1))
                    .end(),
                expiresAt: eb
                    .case()
                    .when("MarketRate.expiresAt", "<", now)
                    .then(expiresAt)
                    .else(eb.ref("MarketRate.expiresAt"))
                    .end(),
            })),
        )
        .returning("count")
        .executeTakeFirstOrThrow();
    if (row.count > limit)
        fail(429, "RATE_LIMITED", "Too many requests. Try again shortly.");
}

async function write<T>(
    client: Client,
    uid: string,
    receipt: MarketReceipt,
    fn: (tx: Tx) => Promise<T>,
): Promise<T> {
    const key = text(receipt.key, "Request ID", 100);
    return client.$transaction(async (tx) => {
        await tx.$qb
            .selectFrom("User")
            .select("id")
            .where("id", "=", uid)
            .forUpdate()
            .executeTakeFirstOrThrow();
        const old = await tx.marketRequest.findUnique({
            where: { userId_key: { userId: uid, key } },
        });
        if (old) {
            if (old.fingerprint !== receipt.fingerprint)
                fail(
                    409,
                    "REQUEST_REUSED",
                    "Request ID was already used for different data.",
                );
            return old.result as T;
        }
        const result = await fn(tx);
        await tx.marketRequest.create({
            data: {
                userId: uid,
                key,
                fingerprint: receipt.fingerprint,
                result: json(result),
            },
        });
        return result;
    });
}
async function owner(tx: Tx, uid: string, storeId: string) {
    if (
        !(await tx.store.findFirst({
            where: { id: text(storeId, "Store ID"), ownerId: uid },
            select: { id: true },
        }))
    )
        fail(404, "NOT_FOUND", "Store not found.");
}
async function identity(tx: Tx, sessionId: string) {
    const session = await tx.$qb
        .selectFrom("Session")
        .innerJoin("User", "User.id", "Session.userId")
        .select("Session.userId")
        .where("User.approved", "=", true)
        .where("Session.id", "=", text(sessionId, "Session ID"))
        .where("expiresAt", ">", (eb) => eb.fn<string>("now", []))
        .forShare()
        .executeTakeFirst();
    if (!session)
        fail(401, "SESSION_ENDED", "Your session ended. Sign in again.");
    return session.userId;
}
async function placementWrite<T>(
    client: Client,
    args: { sessionId: string; itemId: string; receipt: MarketReceipt },
    fn: (
        tx: Tx,
        item: {
            imageAssetId: string | null;
            scanJobId: string | null;
            externalUrl: string | null;
        },
    ) => Promise<T>,
) {
    const uid = await client.$transaction((tx) => identity(tx, args.sessionId));
    await rate(client, `${uid}:placement`);
    return write(client, uid, args.receipt, async (tx) => {
        await identity(tx, args.sessionId);
        await tx.$qb
            .selectFrom("WorldRevision")
            .select("id")
            .where("id", "=", "demo_store")
            .forUpdate()
            .executeTakeFirstOrThrow();
        const item = await tx.$qb
            .selectFrom("Item")
            .innerJoin("Store", "Store.id", "Item.storeId")
            .select(["Item.imageAssetId", "Item.scanJobId", "Item.externalUrl"])
            .where("Item.id", "=", text(args.itemId, "Item ID"))
            .where("Store.ownerId", "=", uid)
            .forUpdate("Item")
            .executeTakeFirst();
        if (!item) fail(404, "NOT_FOUND", "Item not found.");
        return fn(tx, item);
    });
}

export const marketProcedures = {
    marketStores: async ({ client }) => {
        const uid = user(client);
        return {
            accountId: uid,
            stores: await client.store.findMany({
                where: { ownerId: uid },
                orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                select: { id: true, name: true },
            }),
        };
    },
    marketCreateStore: async ({ client, args }) => {
        const uid = user(client),
            name = text(args.name, "Store name");
        await rate(client, `${uid}:stores`);
        return write(client, uid, args.receipt, async (tx) => {
            if ((await tx.store.count({ where: { ownerId: uid } })) >= 3)
                fail(409, "STORE_LIMIT", "3 of 3 stores created");
            return tx.store.create({
                data: { id: randomUUID(), ownerId: uid, name },
                select: { id: true, name: true },
            });
        });
    },
    marketDeleteStore: async ({ client, args }) => {
        const uid = user(client);
        await rate(client, `${uid}:stores`);
        return write(client, uid, args.receipt, async (tx) => {
            await owner(tx, uid, args.id);
            await tx.store.delete({ where: { id: args.id } });
            return { id: args.id };
        });
    },
    marketInventory: async ({ client, args }) => {
        const uid = user(client);
        return client.$transaction(async (tx) => {
            await owner(tx, uid, args.storeId);
            const items = await tx.item.findMany({
                where: { storeId: args.storeId },
                include: { placement: true },
                orderBy: { createdAt: "desc" },
            });
            return json({
                accountId: uid,
                items: items.map(({ placement: frame, ...item }) => ({
                    ...item,
                    placementId: frame?.id ?? null,
                    placementRevision: frame?.revision ?? null,
                })),
            });
        });
    },
    marketSaveItem: async ({ client, args }) => {
        const uid = user(client);
        await rate(client, `${uid}:item`);
        return write(client, uid, args.receipt, async (tx) => {
            await owner(tx, uid, args.storeId);
            if (
                args.id &&
                !(await tx.item.findFirst({
                    where: { id: args.id, storeId: args.storeId },
                    select: { id: true },
                }))
            )
                fail(404, "NOT_FOUND", "Item not found.");
            if (!!args.imageAssetId === !!args.scanJobId)
                fail(
                    422,
                    "INVALID_MEDIA",
                    "Choose either an image or a completed 3D scan.",
                );
            const data = {
                name: text(args.name, "Title"),
                details: text(args.details, "Description", 5000),
                externalUrl: listingUrl(args.externalUrl),
                imageAssetId: args.imageAssetId
                    ? text(args.imageAssetId, "Image")
                    : null,
                scanJobId: args.scanJobId
                    ? text(args.scanJobId, "3D scan")
                    : null,
            };
            if (data.imageAssetId) {
                const image = await tx.$qb
                    .selectFrom("ImageAsset")
                    .select("id")
                    .where("id", "=", data.imageAssetId)
                    .where("ownerId", "=", uid)
                    .forShare()
                    .executeTakeFirst();
                if (!image)
                    fail(
                        422,
                        "INVALID_IMAGE",
                        "Upload an image owned by this account.",
                    );
            } else {
                const scan = await tx.$qb
                    .selectFrom("ScanJob")
                    .select("id")
                    .where("id", "=", text(data.scanJobId, "3D scan"))
                    .where("ownerId", "=", uid)
                    .where("status", "=", "Completed")
                    .where("glbPath", "is not", null)
                    .forShare()
                    .executeTakeFirst();
                if (!scan)
                    fail(
                        422,
                        "INVALID_SCAN",
                        "Choose a completed 3D scan owned by this account.",
                    );
            }
            if (args.id) {
                const previous = await tx.item.findUniqueOrThrow({
                    where: { id: args.id },
                    select: { scanJobId: true },
                });
                if (!!previous.scanJobId !== !!data.scanJobId)
                    await tx.itemPlacement.deleteMany({
                        where: { itemId: args.id },
                    });
                return tx.item.update({
                    where: { id: args.id },
                    data,
                    select: { id: true },
                });
            }
            return tx.item.create({
                data: { ...data, id: randomUUID(), storeId: args.storeId },
                select: { id: true },
            });
        });
    },
    marketDeleteItem: async ({ client, args }) => {
        const uid = user(client);
        await rate(client, `${uid}:item`);
        return write(client, uid, args.receipt, async (tx) => {
            await owner(tx, uid, args.storeId);
            const removed = await tx.item.deleteMany({
                where: { id: args.id, storeId: args.storeId },
            });
            if (!removed.count) fail(404, "NOT_FOUND", "Item not found.");
            return { id: args.id };
        });
    },
    marketWishlist: async ({ client, args }) => ({
        saved: !!(await client.wishlistItem.findUnique({
            where: {
                userId_itemId: {
                    userId: user(client),
                    itemId: text(args.itemId, "Item ID"),
                },
            },
            select: { id: true },
        })),
    }),
    marketSetWishlist: async ({ client, args }) => {
        const uid = user(client),
            itemId = text(args.itemId, "Item ID");
        await rate(client, `${uid}:wishlist`);
        return write(client, uid, args.receipt, async (tx) => {
            if (
                !(await tx.$qb
                    .selectFrom("Item")
                    .select("id")
                    .where("id", "=", itemId)
                    .forShare()
                    .executeTakeFirst())
            )
                fail(404, "NOT_FOUND", "This item is unavailable.");
            if (args.saved)
                await tx.wishlistItem.createMany({
                    data: [{ id: randomUUID(), userId: uid, itemId }],
                    skipDuplicates: true,
                });
            else
                await tx.wishlistItem.deleteMany({
                    where: { userId: uid, itemId },
                });
            return { saved: args.saved };
        });
    },
    marketIssueTicket: async ({ client }) => {
        const uid = user(client),
            sid = client.$auth?.sessions?.[0]?.id;
        if (!sid)
            fail(401, "SESSION_ENDED", "Your session ended. Sign in again.");
        await rate(client, `${uid}:ticket`);
        return client.$transaction(async (tx) => {
            if ((await identity(tx, sid)) !== uid)
                fail(
                    401,
                    "SESSION_ENDED",
                    "Your session ended. Sign in again.",
                );
            const ticket = randomBytes(32).toString("hex");
            const now = new Date();
            await tx.gameTicket.deleteMany({
                where: { expiresAt: { lt: now } },
            });
            await tx.gameTicket.create({
                data: {
                    hash: digest(ticket),
                    sessionId: sid,
                    worldId: "demo_store",
                    expiresAt: new Date(now.getTime() + 30000),
                },
            });
            return { ticket };
        });
    },
    marketWorld: async ({ client }) =>
        client.$transaction(
            async (tx) => {
                const rev = await tx.worldRevision.findUniqueOrThrow({
                    where: { id: "demo_store" },
                });
                const frames = await tx.itemPlacement.findMany({
                    where: {
                        worldId: "demo_store",
                        item: { storeId: { not: null } },
                    },
                    include: { item: { include: { store: true } } },
                    orderBy: { id: "asc" },
                });
                return {
                    revision: String(rev.revision),
                    placements: frames.flatMap(({ item, ...frame }) =>
                        item.store
                            ? [
                                  {
                                      ...frame,
                                      name: item.name,
                                      details: item.details,
                                      externalUrl: item.externalUrl,
                                      imageAssetId: item.imageAssetId,
                                      scanJobId: item.scanJobId,
                                      storeName: item.store.name,
                                  },
                              ]
                            : [],
                    ),
                };
            },
            { isolationLevel: TransactionIsolationLevel.RepeatableRead },
        ),
    marketRedeemTicket: async ({ client, args }) =>
        client.$transaction(async (tx) => {
            const ticket = await tx.$qb
                .deleteFrom("GameTicket")
                .where("hash", "=", digest(text(args.ticket, "Ticket")))
                .where("worldId", "=", args.worldId)
                .where("expiresAt", ">", (eb) => eb.fn<string>("now", []))
                .returning("sessionId")
                .executeTakeFirst();
            if (!ticket)
                fail(
                    401,
                    "INVALID_TICKET",
                    "Admission ticket expired or was already used.",
                );
            const userId = await identity(tx, ticket.sessionId);
            const account = await tx.user.findUniqueOrThrow({
                where: { id: userId },
                select: { name: true },
            });
            return { sessionId: ticket.sessionId, userId, name: account.name };
        }),
    marketValidateSession: async ({ client, args }) =>
        client.$transaction(async (tx) => ({
            userId: await identity(tx, args.sessionId),
        })),
    marketPlace: async ({ client, args }) =>
        placementWrite(client, args, async (tx, item) => {
            if ((!item.imageAssetId && !item.scanJobId) || !item.externalUrl)
                fail(422, "INCOMPLETE_ITEM", "Finish setup in browser.");
            const expectedSurface = item.scanJobId
                ? "lobby-table"
                : "demo-board";
            if (args.surfaceId !== expectedSurface)
                fail(
                    422,
                    "WRONG_SURFACE",
                    item.scanJobId
                        ? "Place 3D models on a table."
                        : "Place image frames on a wall.",
                );
            const p = placement(args);
            if (
                await tx.itemPlacement.findUnique({
                    where: { itemId: args.itemId },
                    select: { id: true },
                })
            )
                fail(
                    409,
                    "ALREADY_PLACED",
                    "Item is already placed. Refresh inventory.",
                );
            const neighbors = await tx.itemPlacement.findMany({
                where: { worldId: args.worldId, surfaceId: args.surfaceId },
                select: { x: true, y: true, z: true, yaw: true },
            });
            const halfWidth = (yaw: number) =>
                0.3 * (Math.abs(Math.cos(yaw)) + Math.abs(Math.sin(yaw)));
            if (
                neighbors.some((other) => {
                    const separation = item.scanJobId
                        ? halfWidth(p.yaw) + halfWidth(other.yaw) + 0.01
                        : 0.61;
                    return (
                        Math.abs(other.x - p.x) < separation &&
                        (item.scanJobId
                            ? Math.abs(other.z - p.z) < separation
                            : Math.abs(other.y - p.y) < 0.81)
                    );
                })
            )
                fail(409, "OCCUPIED", "That space is occupied.");
            return json(
                await tx.itemPlacement.create({
                    data: {
                        id: randomUUID(),
                        itemId: args.itemId,
                        worldId: args.worldId,
                        surfaceId: args.surfaceId,
                        ...p,
                    },
                }),
            );
        }),
    marketRemove: async ({ client, args }) =>
        placementWrite(client, args, async (tx) => {
            const removed = await tx.itemPlacement.deleteMany({
                where: {
                    id: text(args.placementId, "Placement ID"),
                    itemId: args.itemId,
                    revision: args.revision,
                },
            });
            if (!removed.count)
                fail(
                    409,
                    "PLACEMENT_CHANGED",
                    "Placement changed. Refresh inventory.",
                );
            return { id: args.placementId };
        }),
} satisfies ProceduresOptions<SchemaType>;
