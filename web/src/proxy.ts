import { type NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";

/** Pages reachable without a session. Everything else is gated by default. */
const PUBLIC_PAGES = new Set(["/sign-in", "/sign-up"]);

function isPublic(pathname: string) {
    return PUBLIC_PAGES.has(pathname) || pathname.startsWith("/api/auth/");
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

    if (isPublic(pathname)) {
        return NextResponse.next();
    }

    const session = await auth.api.getSession({ headers: request.headers });

    if (session) {
        return NextResponse.next();
    }

    if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = "/sign-in";
    signInUrl.search = "";
    // Keep the original path and query string so we can send them back after sign-in.
    signInUrl.searchParams.set("redirect", pathname + search);

    return NextResponse.redirect(signInUrl);
}

export const config = {
    // Run on everything except static assets.
    // Default-deny: new pages are protected automatically.
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
    ],
};
