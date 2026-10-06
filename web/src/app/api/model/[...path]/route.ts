import { RPCApiHandler } from "@zenstackhq/server/api";
import { NextRequestHandler } from "@zenstackhq/server/next";
import type { NextRequest } from "next/server";

import { db } from "@/lib/db";
import { schema } from "~/zenstack/schema";

const handler = NextRequestHandler({
    apiHandler: new RPCApiHandler({ schema }),
    // getSessionUser extracts the current session user from the request, its
    // implementation depends on your auth solution
    getClient: (_req: NextRequest) => db, //db.$setAuth(getSessionUser(req)),
    useAppDir: true,
});

export {
    handler as DELETE,
    handler as GET,
    handler as PATCH,
    handler as POST,
    handler as PUT,
};
