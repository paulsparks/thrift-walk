import type { AuthType } from "@zenstackhq/orm";
import { RPCApiHandler } from "@zenstackhq/server/api";
import { NextRequestHandler } from "@zenstackhq/server/next";
import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { dbWithAuth } from "@/lib/db";
import { type SchemaType, schema } from "~/zenstack/schema";

const modelHandler = NextRequestHandler({
    apiHandler: new RPCApiHandler({ schema }),
    getClient: async (req: NextRequest) => {
        const session = await auth.api.getSession({ headers: req.headers });

        if (session) {
            const userContext: AuthType<SchemaType> = {
                ...session.user,
                bio: session.user.bio ?? "",
                sessions: [session.session],
            };

            return dbWithAuth.$setAuth(userContext);
        } else {
            return dbWithAuth;
        }
    },
    useAppDir: true,
});

// The generic API is read-only except the existing private wishlist operations.
// Deny nested mutation entry points; marketplace writes use /api/market.
// In particular, do not expose $procs: market procedures require the identity
// and trusted-server checks performed by the /api/market HTTP adapters.
const handler: typeof modelHandler = async (req, context) => {
    const segments = new URL(req.url).pathname.split("/").filter(Boolean);
    const model = segments.at(-2);
    const operation = segments.at(-1);
    const reads = [
        "findMany",
        "findUnique",
        "findFirst",
        "count",
        "aggregate",
        "groupBy",
    ];
    const wishlistWrite =
        model === "wishlistItem" &&
        ["create", "delete", "deleteMany"].includes(operation || "");
    if (
        (!reads.includes(operation || "") && !wishlistWrite) ||
        !["item", "wishlistItem", "user"].includes(model || "")
    ) {
        return Response.json(
            {
                code: "FORBIDDEN",
                message: "Use the validated marketplace API.",
            },
            { status: 403 },
        );
    }
    if (wishlistWrite) {
        const expected = new URL(process.env.BETTER_AUTH_URL || req.url).origin;
        if (req.headers.get("origin") !== expected)
            return Response.json(
                { code: "FORBIDDEN", message: "Invalid origin." },
                { status: 403 },
            );
    }
    const response = await modelHandler(req, context);
    response.headers.set("Cache-Control", "no-store");
    return response;
};

export {
    handler as DELETE,
    handler as GET,
    handler as PATCH,
    handler as POST,
    handler as PUT,
};
