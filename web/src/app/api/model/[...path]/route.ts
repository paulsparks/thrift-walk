import type { AuthType } from "@zenstackhq/orm";
import { RPCApiHandler } from "@zenstackhq/server/api";
import { NextRequestHandler } from "@zenstackhq/server/next";
import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { dbWithAuth } from "@/lib/db";
import { type SchemaType, schema } from "~/zenstack/schema";

const handler = NextRequestHandler({
    apiHandler: new RPCApiHandler({ schema }),
    getClient: async (req: NextRequest) => {
        const session = await auth.api.getSession({ headers: req.headers });

        if (session) {
            const userContext: AuthType<SchemaType> = {
                ...session.user,
                sessions: [session.session],
            };

            return dbWithAuth.$setAuth(userContext);
        } else {
            return dbWithAuth;
        }
    },
    useAppDir: true,
});

export {
    handler as DELETE,
    handler as GET,
    handler as PATCH,
    handler as POST,
    handler as PUT,
};
