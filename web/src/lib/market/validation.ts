export class MarketError extends Error {
    constructor(
        public status: number,
        public code: string,
        message: string,
    ) {
        super(message);
    }
}
export function fail(status: number, code: string, message: string): never {
    throw new MarketError(status, code, message);
}
export function text(value: unknown, field: string, max = 120): string {
    if (typeof value !== "string" || !value.trim() || value.trim().length > max)
        fail(
            422,
            "INVALID_INPUT",
            `${field} must contain 1–${max} characters.`,
        );
    return value.trim();
}
export function listingUrl(value: unknown): string {
    const raw = text(value, "Listing URL", 2048);
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        return fail(422, "INVALID_URL", "Enter an HTTPS listing URL.");
    }
    if (url.protocol !== "https:" || url.username || url.password)
        fail(422, "INVALID_URL", "Use HTTPS without embedded credentials.");
    return url.href;
}
// Shared demo board: center (0, 1.8, -2), size 6 × 3, front normal +Z.
// Frame size .6 × .8; grid .1. The game also verifies reach and occlusion.
export function placement(value: Record<string, unknown>) {
    if (value.worldId !== "demo_store" || value.surfaceId !== "demo-board")
        fail(422, "INVALID_SURFACE", "Choose a display wall.");
    const { x, y, z, yaw } = value;
    if (
        ![x, y, z, yaw].every(
            (v) => typeof v === "number" && Number.isFinite(v),
        )
    )
        fail(422, "INVALID_TRANSFORM", "Invalid frame transform.");
    const p = {
        x: x as number,
        y: y as number,
        z: z as number,
        yaw: yaw as number,
    };
    if (
        Math.abs(p.x) > 2.7 ||
        p.y < 0.7 ||
        p.y > 2.9 ||
        Math.abs(p.z + 1.94) > 0.001 ||
        p.yaw !== 0 ||
        [p.x, p.y].some((v) => Math.abs(v * 10 - Math.round(v * 10)) > 0.001)
    )
        fail(422, "INVALID_BOUNDS", "Keep the frame inside the display wall.");
    return p;
}
export function sameOrigin(req: Request) {
    const expected = new URL(process.env.BETTER_AUTH_URL || req.url).origin;
    if (req.headers.get("origin") !== expected)
        fail(403, "INVALID_ORIGIN", "Request origin was rejected.");
}

export async function boundedBody(
    req: Request,
    limit: number,
): Promise<Uint8Array> {
    const reader = req.body?.getReader();
    if (!reader) return new Uint8Array();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
        const next = await reader.read();
        if (next.done) break;
        size += next.value.length;
        if (size > limit) {
            await reader.cancel();
            fail(422, "REQUEST_TOO_LARGE", "Request exceeds the allowed size.");
        }
        chunks.push(next.value);
    }
    return Buffer.concat(chunks);
}
