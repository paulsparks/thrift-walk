const BASE_URL = process.env.BETTER_AUTH_URL;

/**
 * Only allow same-origin relative paths as post-login redirect targets,
 * so `?redirect=https://evil.com` or `?redirect=//evil.com` can't bounce users off-site.
 */
export function getSafeRedirect(value: string | string[] | null | undefined) {
    if (typeof value !== "string") return "/";

    try {
        const url = new URL(value, BASE_URL);
        if (url.origin !== BASE_URL) return "/";
        return url.pathname + url.search + url.hash;
    } catch {
        return "/";
    }
}

/** Build a link to an auth page that carries the redirect target along. */
export function withRedirect(path: string, redirectTo: string) {
    if (redirectTo === "/") return path;
    return `${path}?${new URLSearchParams({ redirect: redirectTo })}`;
}
