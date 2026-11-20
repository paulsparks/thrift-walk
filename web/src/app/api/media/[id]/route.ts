import { media } from "@/lib/market/media";
export const runtime = "nodejs";
export async function GET(
    req: Request,
    ctx: { params: Promise<{ id: string }> },
) {
    try {
        const bytes = await media(
            (await ctx.params).id,
            new URL(req.url).searchParams.get("thumb") === "1",
        );
        return new Response(new Uint8Array(bytes), {
            headers: {
                "Content-Type": "image/webp",
                "X-Content-Type-Options": "nosniff",
                "Cache-Control": "private, no-store",
            },
        });
    } catch {
        return new Response("Image unavailable", { status: 404 });
    }
}
