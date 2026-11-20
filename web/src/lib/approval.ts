import { auth } from "./auth";
import { db } from "./db";
import { rate } from "./market/procedures";
import { fail } from "./market/validation";
import { randomInt } from "node:crypto";

export function currentSession(headers: Headers) {
    return auth.api.getSession({
        headers,
        query: { disableCookieCache: true },
    });
}

async function requireAdmin(headers: Headers) {
    const session = await currentSession(headers);
    if (!session?.user.approved || session.user.role !== "Admin")
        fail(403, "FORBIDDEN", "An approved administrator is required.");
}

export async function listCodes(headers: Headers) {
    await requireAdmin(headers);
    const rows = await db.approvalCode.findMany({ orderBy: { code: "asc" } });
    return rows.map((row) => row.code);
}

export async function deleteCode(headers: Headers, code: string) {
    await requireAdmin(headers);
    if (typeof code !== "string" || !/^\d{6}$/.test(code))
        fail(422, "INVALID_CODE", "Invalid approval code.");
    await db.approvalCode.deleteMany({ where: { code } });
}

export async function issueCode(headers: Headers) {
    await requireAdmin(headers);
    for (let attempt = 0; attempt < 100; attempt++) {
        const code = randomInt(1000000).toString().padStart(6, "0");
        const created = await db.$qb
            .insertInto("ApprovalCode")
            .values({ code })
            .onConflict((oc) => oc.doNothing())
            .returning("code")
            .executeTakeFirst();
        if (created) return created.code;
    }
    return fail(503, "UNAVAILABLE", "Could not generate a code. Try again.");
}

export async function redeemCode(headers: Headers, code: unknown) {
    const session = await currentSession(headers);
    if (!session) fail(401, "UNAUTHORIZED", "Sign in to enter a code.");
    if (session.user.approved) return;
    await rate(db, `approval:${session.user.id}`, 5);
    if (typeof code !== "string" || !/^\d{6}$/.test(code))
        fail(422, "INVALID_CODE", "Enter a six-digit code.");
    await db.$transaction(async (tx) => {
        // Lock this account before consuming a code. Parallel submissions for
        // the same account can only spend one, even with two valid codes.
        const user = await tx.$qb
            .selectFrom("User")
            .select("approved")
            .where("id", "=", session.user.id)
            .forUpdate()
            .executeTakeFirstOrThrow();
        if (user.approved) return;
        const used = await tx.approvalCode.deleteMany({ where: { code } });
        if (!used.count)
            fail(
                422,
                "INVALID_CODE",
                "This code is invalid or has already been used.",
            );
        await tx.user.update({
            where: { id: session.user.id },
            data: { approved: true },
        });
    });
}
