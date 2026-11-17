import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

import { digest, rate as enforceRate } from "./procedures";
import { fail, placement, text } from "./validation";
import { timingSafeEqual } from "node:crypto";

// HTTP authentication and compatibility adapter. Business operations live in
// registered ZenStack procedures; the game keeps its existing URL/JSON protocol.
export async function session(req: Request) {
    const s = await auth.api.getSession({
        headers: req.headers,
        query: { disableCookieCache: true },
    });
    if (!s) fail(401, "SESSION_ENDED", "Your session ended. Sign in again.");
    return s;
}
export function trusted(req: Request) {
    const expected = process.env.GAME_SERVER_SECRET;
    const actual =
        req.headers.get("authorization")?.replace(/^Bearer /, "") || "";
    if (
        !expected ||
        expected.length < 32 ||
        Buffer.byteLength(actual) !== Buffer.byteLength(expected) ||
        !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
    )
        fail(403, "FORBIDDEN", "Server authentication required.");
}
export const rate = (key: string, limit = 60) => enforceRate(db, key, limit);
export const snapshot = () => db.$procs.marketWorld();
function receipt(key: unknown, body: unknown) {
    return {
        key: text(key, "Request ID", 100),
        fingerprint: digest(JSON.stringify(body)),
    };
}
export async function clientOperation(
    req: Request,
    op: string,
    b: Record<string, unknown>,
) {
    const s = await session(req);
    const procs = db.$setAuth({
        ...s.user,
        bio: s.user.bio ?? "",
        sessions: [s.session],
    }).$procs;
    switch (op) {
        case "session":
            return { user: { id: s.user.id, name: s.user.name } };
        case "stores": {
            if (req.method === "GET") return procs.marketStores();
            if (req.method === "DELETE") {
                const id = text(b.id, "Store ID");
                return procs.marketDeleteStore({
                    args: {
                        id,
                        receipt: receipt(b.requestId, {
                            op,
                            method: "DELETE",
                            id,
                        }),
                    },
                });
            }
            const name = text(b.name, "Store name");
            return procs.marketCreateStore({
                args: { name, receipt: receipt(b.requestId, { op, name }) },
            });
        }
        case "inventory":
            return procs.marketInventory({
                args: { storeId: text(b.storeId, "Store ID") },
            });
        case "item": {
            const common = {
                storeId: text(b.storeId, "Store ID"),
                receipt: receipt(b.requestId, { op, method: req.method, ...b }),
            };
            if (req.method === "DELETE")
                return procs.marketDeleteItem({
                    args: { ...common, id: text(b.id, "Item ID") },
                });
            return procs.marketSaveItem({
                args: {
                    ...common,
                    ...(b.id ? { id: text(b.id, "Item ID") } : {}),
                    name: text(b.name, "Title"),
                    details: text(b.details, "Description", 5000),
                    imageAssetId: text(b.imageAssetId, "Image"),
                    externalUrl: text(b.externalUrl, "Listing URL", 2048),
                },
            });
        }
        case "wishlist": {
            const itemId = text(b.itemId, "Item ID");
            if (req.method === "GET")
                return procs.marketWishlist({ args: { itemId } });
            if (typeof b.saved !== "boolean")
                fail(
                    422,
                    "INVALID_INPUT",
                    "Specify the desired wishlist state.",
                );
            return procs.marketSetWishlist({
                args: {
                    itemId,
                    saved: b.saved,
                    receipt: receipt(b.requestId, {
                        op,
                        itemId,
                        saved: b.saved,
                    }),
                },
            });
        }
        case "ticket":
            return procs.marketIssueTicket();
        case "world":
            return procs.marketWorld();
        default:
            return fail(404, "NOT_FOUND", "Operation not found.");
    }
}
export async function serverOperation(
    req: Request,
    op: string,
    b: Record<string, unknown>,
) {
    trusted(req);
    const procs = db.$procs;
    switch (op) {
        case "world":
            return procs.marketWorld();
        case "redeem":
            return procs.marketRedeemTicket({
                args: {
                    ticket: text(b.ticket, "Ticket"),
                    worldId: text(b.worldId, "World ID"),
                },
            });
        case "validate":
            return procs.marketValidateSession({
                args: { sessionId: text(b.sessionId, "Session ID") },
            });
        case "place":
            return procs.marketPlace({
                args: {
                    sessionId: text(b.sessionId, "Session ID"),
                    itemId: text(b.itemId, "Item ID"),
                    worldId: text(b.worldId, "World ID"),
                    surfaceId: text(b.surfaceId, "Surface ID"),
                    ...placement(b),
                    receipt: receipt(b.requestId, {
                        op,
                        method: req.method,
                        ...b,
                    }),
                },
            });
        case "remove": {
            if (typeof b.revision !== "number" || !Number.isInteger(b.revision))
                fail(422, "INVALID_INPUT", "Invalid placement revision.");
            return procs.marketRemove({
                args: {
                    sessionId: text(b.sessionId, "Session ID"),
                    itemId: text(b.itemId, "Item ID"),
                    placementId: text(b.placementId, "Placement ID"),
                    revision: b.revision,
                    receipt: receipt(b.requestId, {
                        op,
                        method: req.method,
                        ...b,
                    }),
                },
            });
        }
        default:
            return fail(404, "NOT_FOUND", "Operation not found.");
    }
}
