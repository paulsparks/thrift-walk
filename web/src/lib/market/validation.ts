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
// These bounds mirror the lobby surfaces and game-side reach/occlusion checks.
export function placement(value: Record<string, unknown>) {
    const table = value.surfaceId === "lobby-table";
    if (
        value.worldId !== "demo_store" ||
        (!table && value.surfaceId !== "demo-board")
    )
        fail(422, "INVALID_SURFACE", "Choose a display wall or table.");
    const { x, y, z, yaw } = value;
    if (
        ![x, y, z, yaw].every(
            (v) => typeof v === "number" && Number.isFinite(v),
        )
    )
        fail(422, "INVALID_TRANSFORM", "Invalid item transform.");
    const p = {
        x: x as number,
        y: y as number,
        z: z as number,
        yaw: yaw as number,
    };
    const grid = table ? [p.x, p.z] : [p.x, p.y];
    const half = 0.3 * (Math.abs(Math.cos(p.yaw)) + Math.abs(Math.sin(p.yaw)));
    const outside = table
        ? Math.abs(p.x) > 1.8 - half ||
          Math.abs(p.z - 2.4) > 0.7 - half + 0.00001 ||
          Math.abs(p.y - 0.9) > 0.001
        : Math.abs(p.x) > 2.7 ||
          p.y < 0.7 ||
          p.y > 2.9 ||
          Math.abs(p.z + 1.94) > 0.001;
    if (
        outside ||
        (table ? Math.abs(p.yaw) > Math.PI + 0.00001 : p.yaw !== 0) ||
        grid.some((v) => Math.abs(v * 10 - Math.round(v * 10)) > 0.001)
    )
        fail(
            422,
            "INVALID_BOUNDS",
            table
                ? "Keep the model on the table."
                : "Keep the frame inside the display wall.",
        );
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
