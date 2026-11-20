import type { AuthType } from "@zenstackhq/orm";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { dbWithAuth } from "@/lib/db";
import type { SchemaType } from "~/zenstack/schema";

/**
 * For server components: returns the signed-in user and a database client
 * that enforces the access policies for that user, or null if signed out.
 * Mirrors what the /api/model route does for client-side requests.
 */
export async function getSessionDb() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user.approved) return null;

    const userContext: AuthType<SchemaType> = {
        ...session.user,
        bio: session.user.bio ?? "",
        sessions: [session.session],
    };

    return { user: session.user, db: dbWithAuth.$setAuth(userContext) };
}
