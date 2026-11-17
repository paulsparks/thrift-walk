import { auth } from "@/lib/auth";
import { upload } from "@/lib/market/media";
import {
    clientOperation,
    rate,
    serverOperation,
    session,
} from "@/lib/market/service";
import {
    boundedBody,
    fail,
    MarketError,
    sameOrigin,
} from "@/lib/market/validation";

export const runtime = "nodejs";
const methods: Record<string, string[]> = {
    session: ["GET"],
    stores: ["GET", "POST", "DELETE"],
    inventory: ["GET"],
    item: ["POST", "DELETE"],
    wishlist: ["GET", "POST"],
    ticket: ["POST"],
    world: ["GET"],
    upload: ["POST"],
};
async function handle(
    req: Request,
    ctx: { params: Promise<{ path: string[] }> },
) {
    try {
        const { path } = await ctx.params;
        const internal = path.length === 2 && path[0] === "server";
        const op = path.at(-1) || "";
        if (
            internal
                ? req.method !== "POST"
                : path.length !== 1 || !methods[op]?.includes(req.method)
        )
            fail(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
        if (!internal && req.method !== "GET") sameOrigin(req);
        if (op === "session" && !internal) {
            const { response: current, headers } = await auth.api.getSession({
                headers: req.headers,
                query: { disableCookieCache: true },
                returnHeaders: true,
            });
            if (!current)
                fail(
                    401,
                    "SESSION_ENDED",
                    "Your session ended. Sign in again.",
                );
            headers.set("Cache-Control", "no-store");
            return Response.json(
                { user: { id: current.user.id, name: current.user.name } },
                { headers },
            );
        }
        let result: unknown;
        if (op === "upload" && !internal) {
            const s = await session(req);
            await rate(`${s.user.id}:upload`, 12);
            result = await upload(req, s.user.id);
        } else {
            let body: Record<string, unknown>;
            if (req.method === "GET")
                body = Object.fromEntries(new URL(req.url).searchParams);
            else {
                const raw = new TextDecoder().decode(
                    await boundedBody(req, 16384),
                );
                try {
                    body = JSON.parse(raw);
                } catch {
                    fail(422, "INVALID_JSON", "Invalid JSON.");
                }
                if (!body || Array.isArray(body) || typeof body !== "object")
                    fail(422, "INVALID_INPUT", "Expected an object.");
            }
            if ("ownerId" in body || "userId" in body)
                fail(
                    422,
                    "INVALID_INPUT",
                    "Identity must not be supplied by clients.",
                );
            result = internal
                ? await serverOperation(req, op, body)
                : await clientOperation(req, op, body);
        }
        return Response.json(result, {
            headers: { "Cache-Control": "no-store" },
        });
    } catch (e) {
        const error =
            e instanceof MarketError
                ? e
                : new MarketError(
                      503,
                      "UNAVAILABLE",
                      "Service unavailable. Please retry.",
                  );
        return Response.json(
            { code: error.code, message: error.message },
            { status: error.status, headers: { "Cache-Control": "no-store" } },
        );
    }
}

export { handle as GET, handle as POST, handle as DELETE };
