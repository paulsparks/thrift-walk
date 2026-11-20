import { type NextRequest, NextResponse } from "next/server";

import { currentSession } from "@/lib/approval";
import { auth } from "@/lib/auth";

/** Pages reachable without a session. Everything else is gated by default. */
const PUBLIC_PAGES = new Set([
    "/sign-in",
    "/sign-up",
    "/forgot-password",
    "/reset-password",
    "/api/auth/sign-in/email",
    "/api/auth/sign-up/email",
    "/api/auth/sign-in/social",
    "/api/auth/callback/google",
    "/api/auth/error",
    "/api/auth/sign-out",
    "/api/auth/request-password-reset",
    "/api/auth/reset-password",
]);

function isPublic(pathname: string) {
    return (
        PUBLIC_PAGES.has(pathname) ||
        /^\/api\/auth\/reset-password\/[^/]+$/.test(pathname)
    );
}

async function signOut(request: NextRequest) {
    const response = NextResponse.redirect(new URL("/sign-in", request.url));

    try {
        // Invalidates the session in the DB and returns the Set-Cookie headers that clear it.
        const { headers } = await auth.api.signOut({
            headers: request.headers,
            returnHeaders: true,
        });
        for (const cookie of headers.getSetCookie()) {
            response.headers.append("set-cookie", cookie);
        }
    } catch {
        // No session / already signed out: still land on the sign-in page.
    }

    return response;
}

export default async function proxy(request: NextRequest) {
    const { pathname, search } = request.nextUrl;

    if (pathname === "/sign-out") {
        return signOut(request);
    }

    if (
        isPublic(pathname) ||
        pathname.startsWith("/api/market/server/") ||
        pathname.startsWith("/api/scan-transfer/") ||
        (pathname === "/api/health" && request.headers.has("authorization"))
    ) {
        return NextResponse.next();
    }

    const session = await currentSession(request.headers);

    if (session?.user.approved || (session && pathname === "/approval")) {
        return NextResponse.next();
    }

    if (pathname.startsWith("/api/")) {
        const message = session
            ? "Account approval required."
            : "Sign in required.";
        return NextResponse.json(
            {
                error: message,
                message,
                code: session ? "APPROVAL_REQUIRED" : "SESSION_ENDED",
            },
            {
                status: session ? 403 : 401,
                headers: { "Cache-Control": "no-store" },
            },
        );
    }

    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = session ? "/approval" : "/sign-in";
    signInUrl.search = "";
    // Keep the original path and query string so we can send them back after sign-in.
    signInUrl.searchParams.set("redirect", pathname + search);

    return NextResponse.redirect(signInUrl);
}

export const config = {
    matcher: ["/((?!_next/static/|favicon\\.ico$).*)"],
};
